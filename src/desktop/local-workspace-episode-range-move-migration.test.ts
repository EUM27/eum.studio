import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceEpisodeRangeMovesIfNeeded } from "./local-workspace-episode-range-move-migration";

describe("local episode range move migration", () => {
  it("adds empty move and scene-segment ledgers without changing manuscripts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-episode-range-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    try {
      const workId = randomUUID();
      const documentId = randomUUID();
      const revisionId = randomUUID();
      const anchorId = randomUUID();
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
            title TEXT NOT NULL
          ) STRICT;
          CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            work_id TEXT NOT NULL,
            title TEXT NOT NULL,
            UNIQUE (work_id, id)
          ) STRICT;
          CREATE TABLE document_revisions (
            id TEXT PRIMARY KEY,
            work_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            UNIQUE (work_id, document_id, id)
          ) STRICT;
          CREATE TABLE anchors (
            id TEXT PRIMARY KEY,
            work_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            UNIQUE (work_id, id),
            UNIQUE (work_id, document_id, id)
          ) STRICT;
        `);
        database.prepare("INSERT INTO storage_ledger_identity VALUES (?, 14)")
          .run("eum-studio-ledger-sha256-v1");
        database.prepare("INSERT INTO works VALUES (?, ?)")
          .run(workId, "작품");
        database.prepare("INSERT INTO documents VALUES (?, ?, ?)")
          .run(documentId, workId, "9화");
        database.prepare("INSERT INTO document_revisions VALUES (?, ?, ?)")
          .run(revisionId, workId, documentId);
        database.prepare("INSERT INTO anchors VALUES (?, ?, ?)")
          .run(anchorId, workId, documentId);
        database.exec("PRAGMA user_version = 14");
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
        targetSchemaVersion: 14,
      });

      await expect(migrateLocalWorkspaceEpisodeRangeMovesIfNeeded(profile))
        .resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      try {
        expect(migrated.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 15 });
        expect(migrated.prepare(`
          SELECT name FROM sqlite_schema
          WHERE type = 'table'
            AND name IN (
              'scene_identities',
              'scene_episode_segments',
              'episode_range_moves'
            )
          ORDER BY name
        `).all()).toEqual([
          { name: "episode_range_moves" },
          { name: "scene_episode_segments" },
          { name: "scene_identities" },
        ]);
        expect(migrated.prepare("SELECT title FROM works WHERE id = ?").get(workId))
          .toEqual({ title: "작품" });
        expect(migrated.prepare("SELECT title FROM documents WHERE id = ?").get(documentId))
          .toEqual({ title: "9화" });
        expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        migrated.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
