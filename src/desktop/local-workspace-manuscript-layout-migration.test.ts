import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { migrateLocalWorkspaceManuscriptLayoutIfNeeded } from "./local-workspace-manuscript-layout-migration";
import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

describe("local Work manuscript layout migration", () => {
  it("adds the Work-owned settings table without changing existing Work rows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-layout-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    try {
      const workId = randomUUID();
      const createdAt = "2026-08-19T00:00:00.000Z";
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
          CREATE TABLE assistant_scene_draft_candidates (
            id TEXT PRIMARY KEY,
            work_id TEXT NOT NULL,
            plot_thread_id TEXT NOT NULL,
            target_document_id TEXT NOT NULL,
            target_document_revision_id TEXT NOT NULL,
            revision INTEGER NOT NULL,
            status TEXT NOT NULL,
            draft_text TEXT NOT NULL
          ) STRICT;
        `);
        database.prepare("INSERT INTO storage_ledger_identity VALUES (?, 12)")
          .run("eum-studio-ledger-sha256-v1");
        database.prepare("INSERT INTO works VALUES (?, 1, ?, ?, ?)")
          .run(workId, "작품", createdAt, createdAt);
        database.exec("PRAGMA user_version = 12");
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
        targetSchemaVersion: 12,
      });

      await expect(migrateLocalWorkspaceManuscriptLayoutIfNeeded(
        profile,
      )).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 13 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count
          FROM pragma_table_info('work_manuscript_layout_settings')
        `).get()).toEqual({ count: 5 });
        expect(migrated.prepare("SELECT title FROM works WHERE id = ?").get(workId))
          .toEqual({ title: "작품" });
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
