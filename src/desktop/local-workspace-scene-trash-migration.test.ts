import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  migrateLocalWorkspaceSceneTrashIfNeeded,
  SCENE_TRASH_MIGRATION_DEFINITION_BYTES,
  SCENE_TRASH_MIGRATION_DEFINITION_CHECKSUM,
} from "./local-workspace-scene-trash-migration";

describe("local workspace Scene trash migration", () => {
  it("adds empty lossless trash ledgers to schema 16 and is idempotent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-trash-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const database = new DatabaseSync(databasePath);
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE storage_ledger_identity (
          checksum_identity TEXT PRIMARY KEY,
          target_schema_version INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE migration_receipts (
          id TEXT PRIMARY KEY,
          migration_id TEXT NOT NULL UNIQUE,
          from_schema_version INTEGER NOT NULL,
          to_schema_version INTEGER NOT NULL,
          migration_checksum_identity TEXT NOT NULL,
          migration_checksum_value TEXT NOT NULL,
          before_checksum_value TEXT NOT NULL,
          after_checksum_value TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          progress_receipt_json TEXT NOT NULL
        ) STRICT;
        CREATE TABLE works (id TEXT PRIMARY KEY, revision INTEGER, updated_at TEXT, retired_at TEXT) STRICT;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE document_revisions (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, document_id TEXT NOT NULL,
          UNIQUE (work_id, document_id, id)
        ) STRICT;
        CREATE TABLE scene_identities (
          id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL,
          retired_at TEXT, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_lineage_operations (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_episode_segments (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_overrides (
          id TEXT PRIMARY KEY, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_metadata_bindings (
          id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL,
          retired_at TEXT, work_id TEXT NOT NULL, UNIQUE (work_id, id)
        ) STRICT;
        INSERT INTO storage_ledger_identity VALUES ('eum-studio-ledger-sha256-v1', 16);
        PRAGMA user_version = 16;
      `);
    } finally {
      database.close();
    }
    const profile = parsePoc3StorageOpenProfile({
      databasePath,
      checksumIdentity: "eum-studio-ledger-sha256-v1",
      requestedSettings: {
        journalMode: {
          applySql: "PRAGMA journal_mode = WAL",
          verifySql: "PRAGMA journal_mode",
          expectedRows: [{ journal_mode: "wal" }],
        },
        synchronous: {
          applySql: "PRAGMA synchronous = FULL",
          verifySql: "PRAGMA synchronous",
          expectedRows: [{ synchronous: 2 }],
        },
        foreignKeys: {
          applySql: "PRAGMA foreign_keys = ON",
          verifySql: "PRAGMA foreign_keys",
          expectedRows: [{ foreign_keys: 1 }],
        },
      },
      targetSchemaVersion: 17,
    });
    try {
      await expect(migrateLocalWorkspaceSceneTrashIfNeeded(profile))
        .resolves.toBe(true);
      await expect(migrateLocalWorkspaceSceneTrashIfNeeded(profile))
        .resolves.toBe(false);
      const migrated = new DatabaseSync(databasePath, { readOnly: true });
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 17 });
        expect(migrated.prepare(`
          SELECT target_schema_version AS "targetSchemaVersion"
          FROM storage_ledger_identity
        `).get()).toEqual({ targetSchemaVersion: 17 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM sqlite_master
          WHERE type = 'table' AND name LIKE 'scene_trash_%'
        `).get()).toEqual({ count: 5 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM migration_receipts
          WHERE migration_id = 'local-workspace-scene-trash-v16-to-v17'
        `).get()).toEqual({ count: 1 });
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition checksum", () => {
    expect(createHash("sha256")
      .update(SCENE_TRASH_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(SCENE_TRASH_MIGRATION_DEFINITION_CHECKSUM);
  });
});
