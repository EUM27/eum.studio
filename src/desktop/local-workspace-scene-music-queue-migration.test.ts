import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceSceneMusicQueuesIfNeeded } from "./local-workspace-scene-music-queue-migration";

describe("local workspace scene music queue migration", () => {
  it("preserves v10 Works and SceneAnnotations while adding an empty queue Candidate table", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "eum-scene-music-queue-migration-"),
    );
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = randomUUID();
    const annotationId = randomUUID();
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
        CREATE TABLE scene_annotations (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          work_id TEXT NOT NULL,
          scene_key TEXT NOT NULL,
          document_id TEXT NOT NULL,
          document_revision_id TEXT NOT NULL,
          source_candidate_id TEXT NOT NULL,
          source_scene_item_id TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          pov_character_id TEXT,
          location TEXT NOT NULL,
          time TEXT NOT NULL,
          character_ids_json TEXT NOT NULL,
          goal TEXT NOT NULL,
          conflict TEXT NOT NULL,
          outcome TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
      `);
      database.prepare(
        "INSERT INTO storage_ledger_identity VALUES (?, 10)",
      ).run("eum-studio-ledger-sha256-v1");
      database.prepare(
        "INSERT INTO works VALUES (?, 1, ?, ?, ?)",
      ).run(workId, "작품", createdAt, createdAt);
      database.prepare(`
        INSERT INTO scene_annotations VALUES (
          ?, 1, 2, ?, 'scene-a', 'document-a', 'revision-a',
          'candidate-a', 'item-a', '닫힌 방', '대화가 멈춘다.', NULL,
          '방', '밤', '[]', '문을 연다.', '문이 잠겼다.', '기다린다.', ?, ?
        )
      `).run(annotationId, workId, createdAt, createdAt);
      database.exec("PRAGMA user_version = 10");
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
        targetSchemaVersion: 11,
      });
      await expect(
        migrateLocalWorkspaceSceneMusicQueuesIfNeeded(profile),
      ).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      migrated.exec("PRAGMA foreign_keys = ON");
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 11,
        });
        expect(migrated.prepare(`
          SELECT target_schema_version AS targetSchemaVersion
          FROM storage_ledger_identity
        `).get()).toEqual({ targetSchemaVersion: 11 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count
          FROM pragma_table_info('scene_music_queue_candidates')
        `).get()).toEqual({ count: 15 });
        expect(migrated.prepare(`
          SELECT title, revision FROM scene_annotations WHERE id = ?
        `).get(annotationId)).toEqual({ title: "닫힌 방", revision: 2 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM scene_music_queue_candidates
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
