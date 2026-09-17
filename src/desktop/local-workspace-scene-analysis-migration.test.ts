import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { NARRATIVE_DIGEST_V22_SCHEMA_STATEMENTS } from "../platform/storage/narrative-digest-v22-schema";
import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  SCENE_ANALYSIS_MIGRATION_DEFINITION_BYTES,
  SCENE_ANALYSIS_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceSceneAnalysisIfNeeded,
} from "./local-workspace-scene-analysis-migration";
import {
  SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_BYTES,
  SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceSceneAnalysisRunsIfNeeded,
} from "./local-workspace-scene-analysis-run-migration";

function profile(databasePath: string, targetSchemaVersion = 23) {
  return parsePoc3StorageOpenProfile({
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
    targetSchemaVersion,
  });
}

function schema22(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE storage_ledger_identity(
        checksum_identity TEXT PRIMARY KEY,
        target_schema_version INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE migration_receipts(
        id TEXT PRIMARY KEY,
        migration_id TEXT UNIQUE NOT NULL,
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
      CREATE TABLE works(id TEXT PRIMARY KEY,retired_at TEXT,UNIQUE(id)) STRICT;
      CREATE TABLE documents(
        id TEXT PRIMARY KEY,work_id TEXT NOT NULL,retired_at TEXT,
        UNIQUE(work_id,id)
      ) STRICT;
      CREATE TABLE document_revisions(
        id TEXT PRIMARY KEY,work_id TEXT NOT NULL,document_id TEXT NOT NULL,
        UNIQUE(work_id,document_id,id)
      ) STRICT;
      CREATE TABLE characters(
        id TEXT PRIMARY KEY,work_id TEXT NOT NULL,retired_at TEXT,
        UNIQUE(work_id,id)
      ) STRICT;
      CREATE TABLE scene_identities(
        id TEXT PRIMARY KEY,work_id TEXT NOT NULL,retired_at TEXT,
        UNIQUE(work_id,id)
      ) STRICT;
      CREATE TABLE assistant_context_receipts(
        id TEXT PRIMARY KEY,work_id TEXT NOT NULL,UNIQUE(work_id,id)
      ) STRICT;
      INSERT INTO storage_ledger_identity VALUES('eum-studio-ledger-sha256-v1',22);
      INSERT INTO works VALUES('work-1',NULL);
      INSERT INTO documents VALUES('document-1','work-1',NULL);
      INSERT INTO document_revisions VALUES('revision-1','work-1','document-1');
      INSERT INTO characters VALUES('character-1','work-1',NULL);
      INSERT INTO scene_identities VALUES('scene-1','work-1',NULL);
      INSERT INTO assistant_context_receipts VALUES('receipt-1','work-1');
    `);
    database.exec(`${NARRATIVE_DIGEST_V22_SCHEMA_STATEMENTS.join(";\n")};`);
    database.prepare(`
      INSERT INTO narrative_digests (
        id,schema_version,work_id,scope_kind,scope_document_id,
        scope_first_character_id,scope_second_character_id,
        source_manifest_json,source_manifest_hash,text,provider_id,model_id,
        prompt_version,context_receipt_id,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      "digest-1", 1, "work-1", "document", "document-1", null, null,
      JSON.stringify({
        schemaVersion: 1,
        scope: { kind: "document", documentId: "document-1" },
        promptVersion: "eum-narrative-digest-v1",
        documents: [{ documentId: "document-1", documentRevisionId: "revision-1" }],
        eventBlocks: [], characters: [], characterRelations: [], loreEntries: [],
        continuityThreads: [], characterKnowledge: [],
      }),
      "manifest-hash", "기존 요약", "provider", "model",
      "eum-narrative-digest-v1", "receipt-1", "2026-08-29T00:00:00.000Z",
    );
    database.prepare(`
      INSERT INTO narrative_digest_documents VALUES(?,?,?,?,?)
    `).run("work-1", "digest-1", "document-1", "revision-1", 0);
    database.exec("PRAGMA user_version=22");
  } finally {
    database.close();
  }
}

describe("Scene analysis migration", () => {
  it("preserves immutable digests and adds Scene source and Work setting ledgers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-analysis-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    schema22(databasePath);
    try {
      await expect(migrateLocalWorkspaceSceneAnalysisIfNeeded(profile(databasePath)))
        .resolves.toBe(true);
      await expect(migrateLocalWorkspaceSceneAnalysisIfNeeded(profile(databasePath)))
        .resolves.toBe(false);
      const database = new DatabaseSync(databasePath);
      try {
        expect(database.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 23 });
        expect(database.prepare(`
          SELECT text,scope_kind AS "scopeKind",scope_scene_id AS "scopeSceneId"
          FROM narrative_digests WHERE id='digest-1'
        `).get()).toEqual({
          text: "기존 요약",
          scopeKind: "document",
          scopeSceneId: null,
        });
        expect(database.prepare(`
          SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN (
            'narrative_digest_scene_sources','work_scene_analysis_settings'
          )
        `).get()).toEqual({ count: 2 });
        expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        database.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed definition checksum", () => {
    expect(createHash("sha256")
      .update(SCENE_ANALYSIS_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(SCENE_ANALYSIS_MIGRATION_DEFINITION_CHECKSUM);
  });

  it("adds a retryable Scene analysis run ledger without changing schema 23 data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-analysis-run-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    schema22(databasePath);
    try {
      await migrateLocalWorkspaceSceneAnalysisIfNeeded(profile(databasePath));
      await expect(migrateLocalWorkspaceSceneAnalysisRunsIfNeeded(
        profile(databasePath, 24),
      )).resolves.toBe(true);
      await expect(migrateLocalWorkspaceSceneAnalysisRunsIfNeeded(
        profile(databasePath, 24),
      )).resolves.toBe(false);
      const database = new DatabaseSync(databasePath);
      try {
        expect(database.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 24 });
        expect(database.prepare(`
          SELECT
            (SELECT COUNT(*) FROM narrative_digests) AS digests,
            (SELECT COUNT(*) FROM scene_analysis_runs) AS runs,
            (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreignKeyViolations
        `).get()).toEqual({ digests: 1, runs: 0, foreignKeyViolations: 0 });
      } finally {
        database.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the Scene analysis run migration checksum", () => {
    expect(createHash("sha256")
      .update(SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_CHECKSUM);
  });
});
