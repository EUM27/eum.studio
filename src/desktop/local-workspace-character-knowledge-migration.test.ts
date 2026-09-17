import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_BYTES,
  CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceCharacterKnowledgeIfNeeded,
} from "./local-workspace-character-knowledge-migration";

function profile(databasePath: string) {
  return parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
    },
    targetSchemaVersion: 20,
  });
}

function createSchema19(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE storage_ledger_identity (
        checksum_identity TEXT PRIMARY KEY,
        target_schema_version INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE migration_receipts (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL UNIQUE,
        from_schema_version INTEGER NOT NULL, to_schema_version INTEGER NOT NULL,
        migration_checksum_identity TEXT NOT NULL,
        migration_checksum_value TEXT NOT NULL, before_checksum_value TEXT NOT NULL,
        after_checksum_value TEXT NOT NULL, started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL, progress_receipt_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE works (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL,
        retired_at TEXT, UNIQUE (id)
      ) STRICT;
      CREATE TABLE characters (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE (work_id, id),
        FOREIGN KEY (work_id) REFERENCES works (id)
      ) STRICT;
      CREATE TABLE character_relations (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE lore_entries (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE event_blocks (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE plot_threads (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE foreshadow_lines (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE scene_identities (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE continuity_threads (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL, status TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE documents (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
      ) STRICT;
      CREATE TABLE document_revisions (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, document_id TEXT NOT NULL,
        UNIQUE (work_id, document_id, id)
      ) STRICT;
      CREATE TABLE anchors (
        id TEXT PRIMARY KEY, work_id TEXT NOT NULL, document_id TEXT NOT NULL,
        UNIQUE (work_id, document_id, id)
      ) STRICT;
      INSERT INTO storage_ledger_identity VALUES ('eum-studio-ledger-sha256-v1', 19);
      INSERT INTO works VALUES ('work-1', 4, '2026-08-29T00:00:00.000Z', NULL);
      INSERT INTO characters VALUES (
        'character-1', 'work-1', 2, '2026-08-29T00:00:00.000Z', NULL
      );
      INSERT INTO continuity_threads VALUES (
        'thread-1', 'work-1', 1, '2026-08-29T00:00:00.000Z', 'open'
      );
      PRAGMA user_version = 19;
    `);
  } finally {
    database.close();
  }
}

describe("local workspace CharacterKnowledge migration", () => {
  it("preserves schema 19 rows while adding empty Gate 3 ledgers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-knowledge-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    createSchema19(databasePath);
    try {
      await expect(migrateLocalWorkspaceCharacterKnowledgeIfNeeded(profile(databasePath)))
        .resolves.toBe(true);
      await expect(migrateLocalWorkspaceCharacterKnowledgeIfNeeded(profile(databasePath)))
        .resolves.toBe(false);
      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({ user_version: 20 });
        expect(migrated.prepare(`
          SELECT revision, status FROM continuity_threads WHERE id = 'thread-1'
        `).get()).toEqual({ revision: 1, status: "open" });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM sqlite_master
          WHERE type = 'table' AND name LIKE 'character_knowledge%'
        `).get()).toEqual({ count: 4 });
        expect(migrated.prepare("SELECT COUNT(*) AS count FROM character_knowledge").get())
          .toEqual({ count: 0 });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition checksum", () => {
    expect(createHash("sha256")
      .update(CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_CHECKSUM);
  });
});
