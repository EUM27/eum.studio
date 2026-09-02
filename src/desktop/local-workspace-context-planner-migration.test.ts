import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  CONTEXT_PLANNER_MIGRATION_DEFINITION_BYTES,
  CONTEXT_PLANNER_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceContextPlannerIfNeeded,
} from "./local-workspace-context-planner-migration";

function profile(databasePath: string) {
  return parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: "eum-studio-ledger-sha256-v1",
    requestedSettings: {
      journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
      synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
      foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
    },
    targetSchemaVersion: 21,
  });
}

function createSchema20(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE storage_ledger_identity (checksum_identity TEXT PRIMARY KEY, target_schema_version INTEGER NOT NULL) STRICT;
      CREATE TABLE migration_receipts (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL UNIQUE,
        from_schema_version INTEGER NOT NULL, to_schema_version INTEGER NOT NULL,
        migration_checksum_identity TEXT NOT NULL, migration_checksum_value TEXT NOT NULL,
        before_checksum_value TEXT NOT NULL, after_checksum_value TEXT NOT NULL,
        started_at TEXT NOT NULL, completed_at TEXT NOT NULL,
        progress_receipt_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE works (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(id)) STRICT;
      CREATE TABLE characters (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE character_relations (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE lore_entries (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE event_blocks (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE plot_threads (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE foreshadow_lines (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE scene_identities (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, retired_at TEXT, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE continuity_threads (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE character_knowledge (id TEXT PRIMARY KEY, work_id TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL, UNIQUE(work_id,id)) STRICT;
      CREATE TABLE assistant_context_receipts (
        id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, request_id TEXT NOT NULL,
        work_id TEXT NOT NULL, conversation_id TEXT NOT NULL, capability TEXT NOT NULL,
        destination_id TEXT NOT NULL, read_ranges_json TEXT NOT NULL,
        transmitted_ranges_json TEXT NOT NULL, read_character_count INTEGER NOT NULL,
        transmitted_character_count INTEGER NOT NULL, grant_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL, UNIQUE(work_id,id), UNIQUE(work_id,request_id)
      ) STRICT;
      INSERT INTO storage_ledger_identity VALUES ('eum-studio-ledger-sha256-v1', 20);
      INSERT INTO works VALUES ('work-1', 3, '2026-08-29T00:00:00.000Z', NULL);
      INSERT INTO characters VALUES ('character-1','work-1',2,'2026-08-29T00:00:00.000Z',NULL);
      INSERT INTO continuity_threads VALUES ('thread-1','work-1',1,'2026-08-29T00:00:00.000Z','open');
      INSERT INTO character_knowledge VALUES ('knowledge-1','work-1',1,'2026-08-29T00:00:00.000Z','active');
      INSERT INTO assistant_context_receipts VALUES (
        'receipt-1',1,'request-1','work-1','conversation-1','canon.review',
        'provider-1','[]','[]',0,0,'[]','2026-08-29T00:00:00.000Z'
      );
      PRAGMA user_version = 20;
    `);
  } finally {
    database.close();
  }
}

describe("local workspace Context Planner migration", () => {
  it("preserves schema 20 rows while adding empty Gate 4 ledgers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-context-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    createSchema20(databasePath);
    try {
      await expect(migrateLocalWorkspaceContextPlannerIfNeeded(profile(databasePath))).resolves.toBe(true);
      await expect(migrateLocalWorkspaceContextPlannerIfNeeded(profile(databasePath))).resolves.toBe(false);
      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({ user_version: 21 });
        expect(migrated.prepare(`SELECT revision, status FROM character_knowledge WHERE id='knowledge-1'`).get())
          .toEqual({ revision: 1, status: "active" });
        expect(migrated.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('assistant_entity_context_policies','assistant_context_manifests','assistant_context_activities')`).get())
          .toEqual({ count: 3 });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition checksum", () => {
    expect(createHash("sha256").update(CONTEXT_PLANNER_MIGRATION_DEFINITION_BYTES).digest("hex"))
      .toBe(CONTEXT_PLANNER_MIGRATION_DEFINITION_CHECKSUM);
  });
});
