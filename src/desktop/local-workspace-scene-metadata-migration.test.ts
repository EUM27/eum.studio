import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceSceneMetadataIfNeeded } from "./local-workspace-scene-metadata-migration";

describe("local workspace Scene metadata migration", () => {
  it("inventories every legacy sceneKey metadata row without guessing a Scene identity", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-metadata-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = randomUUID();
    const annotationId = randomUUID();
    const eventOverrideId = randomUUID();
    const musicQueueId = randomUUID();
    const createdAt = "2026-08-28T00:00:00.000Z";
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
        CREATE TABLE works (id TEXT PRIMARY KEY) STRICT;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE anchors (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          UNIQUE (work_id, document_id, id)
        ) STRICT;
        CREATE TABLE scene_identities (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_annotations (
          id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          work_id TEXT NOT NULL,
          scene_key TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_event_overrides (
          id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          retired_at TEXT,
          work_id TEXT NOT NULL,
          scene_key TEXT NOT NULL,
          operation TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_music_queue_candidates (
          id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL,
          work_id TEXT NOT NULL,
          scene_key TEXT NOT NULL,
          status TEXT NOT NULL,
          query_text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        PRAGMA user_version = 15;
      `);
      database.prepare(
        "INSERT INTO storage_ledger_identity VALUES (?, 15)",
      ).run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?)").run(workId);
      database.prepare(`
        INSERT INTO scene_annotations VALUES (?, 3, ?, ?, ?, ?, ?)
      `).run(
        annotationId,
        workId,
        "legacy-scene-annotation",
        "보존할 장면 주석",
        createdAt,
        createdAt,
      );
      database.prepare(`
        INSERT INTO scene_event_overrides VALUES (
          ?, 2, ?, ?, NULL, ?, ?, 'include'
        )
      `).run(
        eventOverrideId,
        createdAt,
        createdAt,
        workId,
        "legacy-scene-event",
      );
      database.prepare(`
        INSERT INTO scene_music_queue_candidates VALUES (
          ?, 4, ?, ?, 'selected', ?, ?, ?
        )
      `).run(
        musicQueueId,
        workId,
        "legacy-scene-music",
        "보존할 음악 검색어",
        createdAt,
        createdAt,
      );
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
      targetSchemaVersion: 16,
    });

    try {
      await expect(
        migrateLocalWorkspaceSceneMetadataIfNeeded(profile),
      ).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      migrated.exec("PRAGMA foreign_keys = ON");
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 16,
        });
        expect(migrated.prepare(`
          SELECT target_schema_version AS "targetSchemaVersion"
          FROM storage_ledger_identity
        `).get()).toEqual({ targetSchemaVersion: 16 });
        expect(migrated.prepare(`
          SELECT metadata_kind AS "metadataKind", metadata_id AS "metadataId",
            source_scene_key AS "sourceSceneKey", scene_id AS "sceneId",
            status, proposed_scene_id AS "proposedSceneId"
          FROM scene_metadata_bindings
          ORDER BY metadata_kind
        `).all()).toEqual([
          {
            metadataKind: "annotation",
            metadataId: annotationId,
            sourceSceneKey: "legacy-scene-annotation",
            sceneId: null,
            status: "needs-review",
            proposedSceneId: null,
          },
          {
            metadataKind: "event-override",
            metadataId: eventOverrideId,
            sourceSceneKey: "legacy-scene-event",
            sceneId: null,
            status: "needs-review",
            proposedSceneId: null,
          },
          {
            metadataKind: "music-queue",
            metadataId: musicQueueId,
            sourceSceneKey: "legacy-scene-music",
            sceneId: null,
            status: "needs-review",
            proposedSceneId: null,
          },
        ]);
        expect(migrated.prepare(`
          SELECT title FROM scene_annotations WHERE id = ?
        `).get(annotationId)).toEqual({ title: "보존할 장면 주석" });
        expect(migrated.prepare(`
          SELECT operation FROM scene_event_overrides WHERE id = ?
        `).get(eventOverrideId)).toEqual({ operation: "include" });
        expect(migrated.prepare(`
          SELECT query_text AS "queryText"
          FROM scene_music_queue_candidates WHERE id = ?
        `).get(musicQueueId)).toEqual({ queryText: "보존할 음악 검색어" });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM pragma_table_info('manuscript_annotations')
        `).get()).toEqual({ count: 11 });
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM pragma_foreign_key_check
        `).get()).toEqual({ count: 0 });
        expect(() => migrated.prepare(`
          INSERT INTO scene_metadata_bindings (
            id, schema_version, revision, created_at, updated_at, retired_at,
            work_id, metadata_kind, metadata_id, source_scene_key, scene_id,
            status, proposed_scene_id, lineage_operation_id
          ) VALUES (?, 1, 1, ?, ?, NULL, ?, 'annotation', ?, ?, NULL,
            'needs-review', NULL, NULL)
        `).run(
          randomUUID(),
          createdAt,
          createdAt,
          workId,
          randomUUID(),
          "missing-source",
        )).toThrow("Scene metadata binding source is missing");
      } finally {
        migrated.close();
      }

      await expect(
        migrateLocalWorkspaceSceneMetadataIfNeeded(profile),
      ).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
