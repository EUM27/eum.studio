import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceSceneDraftsIfNeeded } from "./local-workspace-scene-draft-migration";

describe("local workspace scene draft migration", () => {
  it("preserves v11 Works and scene music queues while adding an empty draft Candidate table", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-draft-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = randomUUID();
    const queueId = randomUUID();
    const createdAt = "2026-08-17T00:00:00.000Z";
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
        CREATE TABLE works (
          id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE plot_threads (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE document_revisions (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          UNIQUE (work_id, document_id, id)
        ) STRICT;
        CREATE TABLE scene_music_queue_candidates (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          scene_key TEXT NOT NULL,
          scene_annotation_id TEXT NOT NULL,
          scene_annotation_revision INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          query_text TEXT NOT NULL,
          revision INTEGER NOT NULL,
          status TEXT NOT NULL,
          options_json TEXT NOT NULL,
          selected_option_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
      `);
      database.prepare("INSERT INTO storage_ledger_identity VALUES (?, 11)")
        .run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?, 1, ?, ?, ?)")
        .run(workId, "작품", createdAt, createdAt);
      database.prepare(`
        INSERT INTO scene_music_queue_candidates VALUES (
          ?, ?, 'scene-a', 'annotation-a', 1, 'spotify', '밤', 2,
          'selected', '[]', 'option-a', ?, ?
        )
      `).run(queueId, workId, createdAt, createdAt);
      database.exec("PRAGMA user_version = 11");
    } finally {
      database.close();
    }

    try {
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
        targetSchemaVersion: 12,
      });
      await expect(migrateLocalWorkspaceSceneDraftsIfNeeded(profile))
        .resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      migrated.exec("PRAGMA foreign_keys = ON");
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 12 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count
          FROM pragma_table_info('assistant_scene_draft_candidates')
        `).get()).toEqual({ count: 20 });
        expect(migrated.prepare(`
          SELECT status, selected_option_id AS selectedOptionId
          FROM scene_music_queue_candidates WHERE id = ?
        `).get(queueId)).toEqual({ status: "selected", selectedOptionId: "option-a" });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM assistant_scene_draft_candidates
        `).get()).toEqual({ count: 0 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM pragma_foreign_key_check
        `).get()).toEqual({ count: 0 });
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
