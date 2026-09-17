import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { CANON_REVIEW_SCHEMA_STATEMENTS } from "../platform/storage/canon-review-schema";
import { SCENE_ANALYSIS_RUN_SCHEMA_STATEMENTS } from "../platform/storage/scene-analysis-schema";
import {
  SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_BYTES,
  SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceSceneInformationUpdateIfNeeded,
} from "./local-workspace-scene-information-update-migration";

function profile(databasePath: string) {
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
    targetSchemaVersion: 26,
  });
}

function createSchema25Fixture(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      PRAGMA foreign_keys=OFF;
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
      CREATE TABLE works(id TEXT PRIMARY KEY) STRICT;
      CREATE TABLE documents(
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        UNIQUE(work_id,id)
      ) STRICT;
      CREATE TABLE document_revisions(
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        UNIQUE(work_id,document_id,id)
      ) STRICT;
      CREATE TABLE assistant_context_receipts(
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        UNIQUE(work_id,id)
      ) STRICT;
      ${CANON_REVIEW_SCHEMA_STATEMENTS.join(";\n")};
      ${SCENE_ANALYSIS_RUN_SCHEMA_STATEMENTS.join(";\n")};
      INSERT INTO works VALUES('work-1');
      INSERT INTO documents VALUES('document-1','work-1');
      INSERT INTO document_revisions VALUES('revision-1','work-1','document-1');
      INSERT INTO assistant_context_receipts VALUES('receipt-1','work-1');
      INSERT INTO assistant_canon_review_candidates (
        id,schema_version,revision,created_at,updated_at,retired_at,request_id,
        work_id,source_document_id,source_document_revision_id,source_from,
        source_to,provider_id,model_id,prompt_version,context_receipt_id,status
      ) VALUES (
        'candidate-1',1,2,'2026-09-04T00:00:00.000Z',
        '2026-09-04T00:00:01.000Z',NULL,'request-1','work-1','document-1',
        'revision-1',0,4,'provider-1','model-1','eum-canon-review-v1',
        'receipt-1','completed'
      );
      INSERT INTO assistant_canon_review_items (
        id,schema_version,work_id,candidate_id,target_kind,operation,target_hint,
        target_id,matching_target_ids_json,expected_target_revision,
        assertion_basis,reason,status,applied_target_id,created_at,updated_at
      ) VALUES (
        'item-1',1,'work-1','candidate-1','lore-entry','create','북문',NULL,
        '[]',NULL,'explicit-evidence','직접 근거','approved','lore-1',
        '2026-09-04T00:00:00.000Z','2026-09-04T00:00:01.000Z'
      );
      INSERT INTO assistant_canon_review_decision_receipts (
        id,schema_version,work_id,candidate_id,item_id,decision,outcome,
        target_kind,target_id,target_revision_before,target_revision_after,
        selected_fields_json,source_document_revision_id,created_at
      ) VALUES (
        'decision-1',1,'work-1','candidate-1','item-1','approve','applied',
        'lore-entry','lore-1',NULL,1,'["title"]','revision-1',
        '2026-09-04T00:00:01.000Z'
      );
      INSERT INTO storage_ledger_identity
        VALUES('eum-studio-ledger-sha256-v1',25);
      PRAGMA user_version=25;
    `);
  } finally {
    database.close();
  }
}

describe("Scene information update migration", () => {
  it("widens Canon targets and adds the immutable update-batch ledger", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-scene-info-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3");
    createSchema25Fixture(databasePath);
    try {
      await expect(migrateLocalWorkspaceSceneInformationUpdateIfNeeded(
        profile(databasePath),
      )).resolves.toBe(true);
      const database = new DatabaseSync(databasePath, { readOnly: true });
      try {
        expect(database.prepare("PRAGMA user_version").get())
          .toEqual({ user_version: 26 });
        const itemSql = database.prepare(`
          SELECT sql FROM sqlite_master
          WHERE type='table' AND name='assistant_canon_review_items'
        `).get() as { sql: string };
        expect(itemSql.sql).toContain("'character-knowledge'");
        expect(database.prepare(`
          SELECT COUNT(*) AS columns
          FROM pragma_table_info('scene_information_update_batches')
        `).get()).toEqual({ columns: 21 });
        expect(database.prepare(`
          SELECT target_kind AS "targetKind",status,applied_target_id AS "appliedTargetId"
          FROM assistant_canon_review_items WHERE id='item-1'
        `).get()).toEqual({
          targetKind: "lore-entry",
          status: "approved",
          appliedTargetId: "lore-1",
        });
        expect(database.prepare(`
          SELECT decision,outcome,target_kind AS "targetKind",target_id AS "targetId"
          FROM assistant_canon_review_decision_receipts WHERE id='decision-1'
        `).get()).toEqual({
          decision: "approve",
          outcome: "applied",
          targetKind: "lore-entry",
          targetId: "lore-1",
        });
        expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        database.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed migration definition", () => {
    expect(createHash("sha256")
      .update(SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_BYTES)
      .digest("hex"))
      .toBe(SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_CHECKSUM);
  });
});
