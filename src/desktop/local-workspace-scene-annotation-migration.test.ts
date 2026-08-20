import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { migrateLocalWorkspaceSceneAnnotationsIfNeeded } from "./local-workspace-scene-annotation-migration";

describe("local workspace scene annotation migration", () => {
  it("preserves v9 scene inputs and makes existing scene items pending annotation review", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "eum-scene-annotation-migration-"),
    );
    const databasePath = path.join(root, "workspace.sqlite3");
    const workId = randomUUID();
    const documentId = randomUUID();
    const revisionId = randomUUID();
    const candidateId = randomUUID();
    const sceneItemId = randomUUID();
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
        CREATE TABLE works (id TEXT PRIMARY KEY) STRICT;
        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          UNIQUE (work_id, id),
          FOREIGN KEY (work_id) REFERENCES works (id)
        ) STRICT;
        CREATE TABLE document_revisions (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          UNIQUE (work_id, document_id, id),
          FOREIGN KEY (work_id, document_id) REFERENCES documents (work_id, id)
        ) STRICT;
        CREATE TABLE characters (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          revision INTEGER NOT NULL,
          name TEXT NOT NULL,
          aliases_json TEXT NOT NULL,
          role TEXT NOT NULL,
          summary TEXT NOT NULL,
          appearance TEXT NOT NULL,
          personality TEXT NOT NULL,
          speech TEXT NOT NULL,
          goal TEXT NOT NULL,
          conflict TEXT NOT NULL,
          note TEXT NOT NULL,
          retired_at TEXT,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE assistant_scene_extraction_candidates (
          id TEXT PRIMARY KEY,
          schema_version INTEGER NOT NULL,
          request_id TEXT NOT NULL UNIQUE,
          revision INTEGER NOT NULL,
          work_id TEXT NOT NULL,
          source_document_id TEXT NOT NULL,
          source_document_revision_id TEXT NOT NULL,
          source_from INTEGER NOT NULL,
          source_to INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          prompt_version TEXT NOT NULL,
          status TEXT NOT NULL,
          scenes_json TEXT NOT NULL,
          boundaries_json TEXT NOT NULL,
          context_receipt_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (work_id, id)
        ) STRICT;
        CREATE TABLE scene_overrides (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          base_rule_set_revision INTEGER NOT NULL,
          note TEXT,
          retired_at TEXT
        ) STRICT;
      `);
      database.prepare(
        "INSERT INTO storage_ledger_identity VALUES (?, 9)",
      ).run("eum-studio-ledger-sha256-v1");
      database.prepare("INSERT INTO works VALUES (?)").run(workId);
      database.prepare("INSERT INTO documents VALUES (?, ?)").run(
        documentId,
        workId,
      );
      database.prepare("INSERT INTO document_revisions VALUES (?, ?, ?)").run(
        revisionId,
        workId,
        documentId,
      );
      const scenes = [{
        sceneItemId,
        title: "닫힌 방",
        fromParagraphId: "p1",
        toParagraphId: "p1",
        range: {
          documentId,
          documentRevisionId: revisionId,
          from: 0,
          to: 5,
        },
        summary: "문이 닫힌다.",
        povCharacterId: null,
        location: "방",
        time: "",
        characterIds: [],
        goal: "",
        conflict: "",
        outcome: "",
      }];
      database.prepare(`
        INSERT INTO assistant_scene_extraction_candidates VALUES (
          ?, 1, ?, 1, ?, ?, ?, 0, 5, 'provider', 'model',
          'scene-extraction-v1', 'completed', ?, '[]', ?, ?, ?
        )
      `).run(
        candidateId,
        randomUUID(),
        workId,
        documentId,
        revisionId,
        JSON.stringify(scenes),
        randomUUID(),
        createdAt,
        createdAt,
      );
      database.exec("PRAGMA user_version = 9");
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
        targetSchemaVersion: 10,
      });
      await expect(
        migrateLocalWorkspaceSceneAnnotationsIfNeeded(profile),
      ).resolves.toBe(true);

      const migrated = new DatabaseSync(databasePath);
      migrated.exec("PRAGMA foreign_keys = ON");
      try {
        expect(migrated.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 10,
        });
        const candidate = migrated.prepare(`
          SELECT revision, status, scenes_json AS scenesJson
          FROM assistant_scene_extraction_candidates
          WHERE id = ?
        `).get(candidateId) as Record<string, unknown>;
        expect(candidate).toMatchObject({ revision: 2, status: "ready" });
        expect(JSON.parse(String(candidate.scenesJson))).toMatchObject([{
          sceneItemId,
          annotationStatus: "pending",
          sceneAnnotationId: null,
        }]);
        expect(migrated.prepare(`
          SELECT COUNT(*) AS count FROM pragma_table_info('scene_annotations')
        `).get()).toEqual({ count: 20 });
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
