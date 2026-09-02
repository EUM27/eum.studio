import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { parsePoc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  NARRATIVE_DIGEST_MIGRATION_DEFINITION_BYTES,
  NARRATIVE_DIGEST_MIGRATION_DEFINITION_CHECKSUM,
  migrateLocalWorkspaceNarrativeDigestIfNeeded,
} from "./local-workspace-narrative-digest-migration";

function profile(databasePath: string) {
  return parsePoc3StorageOpenProfile({ databasePath, checksumIdentity: "eum-studio-ledger-sha256-v1", requestedSettings: {
    journalMode: { applySql: "PRAGMA journal_mode = WAL", verifySql: "PRAGMA journal_mode", expectedRows: [{ journal_mode: "wal" }] },
    synchronous: { applySql: "PRAGMA synchronous = FULL", verifySql: "PRAGMA synchronous", expectedRows: [{ synchronous: 2 }] },
    foreignKeys: { applySql: "PRAGMA foreign_keys = ON", verifySql: "PRAGMA foreign_keys", expectedRows: [{ foreign_keys: 1 }] },
  }, targetSchemaVersion: 22 });
}

function schema21(databasePath: string): void {
  const db = new DatabaseSync(databasePath);
  try { db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE storage_ledger_identity(checksum_identity TEXT PRIMARY KEY,target_schema_version INTEGER NOT NULL) STRICT;
    CREATE TABLE migration_receipts(id TEXT PRIMARY KEY,migration_id TEXT UNIQUE NOT NULL,from_schema_version INTEGER NOT NULL,to_schema_version INTEGER NOT NULL,migration_checksum_identity TEXT NOT NULL,migration_checksum_value TEXT NOT NULL,before_checksum_value TEXT NOT NULL,after_checksum_value TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT NOT NULL,progress_receipt_json TEXT NOT NULL) STRICT;
    CREATE TABLE works(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,retired_at TEXT,UNIQUE(id)) STRICT;
    CREATE TABLE documents(id TEXT PRIMARY KEY,work_id TEXT NOT NULL,UNIQUE(work_id,id)) STRICT;
    CREATE TABLE document_revisions(id TEXT PRIMARY KEY,work_id TEXT NOT NULL,document_id TEXT NOT NULL,UNIQUE(work_id,document_id,id)) STRICT;
    CREATE TABLE characters(id TEXT PRIMARY KEY,work_id TEXT NOT NULL,UNIQUE(work_id,id)) STRICT;
    CREATE TABLE assistant_context_permission_grants(id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL,revision INTEGER NOT NULL,work_id TEXT NOT NULL,conversation_id TEXT,capability TEXT NOT NULL CHECK(capability IN('canon.review','continuity.review')),destination_id TEXT NOT NULL,local_scope TEXT NOT NULL,external_scope TEXT NOT NULL,duration TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT,consumed_at TEXT,UNIQUE(work_id,id)) STRICT;
    CREATE TABLE assistant_context_receipts(id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL,request_id TEXT NOT NULL,work_id TEXT NOT NULL,conversation_id TEXT NOT NULL,capability TEXT NOT NULL CHECK(capability IN('canon.review','continuity.review')),destination_id TEXT NOT NULL,read_ranges_json TEXT NOT NULL,transmitted_ranges_json TEXT NOT NULL,read_character_count INTEGER NOT NULL,transmitted_character_count INTEGER NOT NULL,grant_ids_json TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(work_id,id),UNIQUE(work_id,request_id)) STRICT;
    CREATE TABLE assistant_context_manifests(id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL,receipt_id TEXT NOT NULL,work_id TEXT NOT NULL,entries_json TEXT NOT NULL,excluded_json TEXT NOT NULL,estimated_token_count INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(work_id,id),UNIQUE(work_id,receipt_id)) STRICT;
    CREATE TABLE assistant_context_activities(id TEXT PRIMARY KEY,schema_version INTEGER NOT NULL,work_id TEXT NOT NULL,receipt_id TEXT NOT NULL,manifest_id TEXT NOT NULL,capability TEXT NOT NULL CHECK(capability IN('canon.review','continuity.review')),destination_id TEXT NOT NULL,provider_id TEXT NOT NULL,model_id TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT NOT NULL,plan_duration_ms INTEGER NOT NULL,authorize_duration_ms INTEGER NOT NULL,connector_duration_ms INTEGER NOT NULL,persist_duration_ms INTEGER NOT NULL,read_ranges_json TEXT NOT NULL,transmitted_ranges_json TEXT NOT NULL,read_character_count INTEGER NOT NULL,transmitted_character_count INTEGER NOT NULL,candidate_count INTEGER NOT NULL,UNIQUE(work_id,id)) STRICT;
    INSERT INTO storage_ledger_identity VALUES('eum-studio-ledger-sha256-v1',21);
    INSERT INTO works VALUES('work-1',1,'2026-08-29T00:00:00.000Z',NULL);
    INSERT INTO documents VALUES('document-1','work-1');
    INSERT INTO document_revisions VALUES('revision-1','work-1','document-1');
    INSERT INTO characters VALUES('character-1','work-1');
    INSERT INTO assistant_context_permission_grants VALUES('grant-1',1,1,'work-1','conversation-1','canon.review','provider','selection','selection','conversation','2026-08-29T00:00:00.000Z',NULL,NULL);
    INSERT INTO assistant_context_receipts VALUES('receipt-1',1,'request-1','work-1','conversation-1','canon.review','provider','[]','[]',0,0,'[]','2026-08-29T00:00:00.000Z');
    INSERT INTO assistant_context_manifests VALUES('manifest-1',1,'receipt-1','work-1','[]','[]',0,'2026-08-29T00:00:00.000Z');
    INSERT INTO assistant_context_activities VALUES('activity-1',1,'work-1','receipt-1','manifest-1','canon.review','provider','provider','model','2026-08-29T00:00:00.000Z','2026-08-29T00:00:01.000Z',1,1,1,1,'[]','[]',0,0,0);
    PRAGMA user_version=21;
  `); } finally { db.close(); }
}

describe("NarrativeDigest migration", () => {
  it("preserves Gate 4 rows and adds narrative.digest capability plus empty digest ledgers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eum-digest-migration-"));
    const databasePath = path.join(root, "workspace.sqlite3"); schema21(databasePath);
    try {
      await expect(migrateLocalWorkspaceNarrativeDigestIfNeeded(profile(databasePath))).resolves.toBe(true);
      await expect(migrateLocalWorkspaceNarrativeDigestIfNeeded(profile(databasePath))).resolves.toBe(false);
      const db = new DatabaseSync(databasePath);
      try {
        expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: 22 });
        expect(db.prepare(`SELECT capability FROM assistant_context_activities WHERE id='activity-1'`).get()).toEqual({ capability: "canon.review" });
        db.prepare(`INSERT INTO assistant_context_permission_grants VALUES('grant-digest',1,1,'work-1','conversation-1','narrative.digest','provider','chapter','chapter','conversation','2026-08-29T00:00:02.000Z',NULL,NULL)`).run();
        expect(db.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN('narrative_digests','narrative_digest_documents')`).get()).toEqual({ count: 2 });
        expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally { db.close(); }
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("pins the reviewed definition checksum", () => {
    expect(createHash("sha256").update(NARRATIVE_DIGEST_MIGRATION_DEFINITION_BYTES).digest("hex"))
      .toBe(NARRATIVE_DIGEST_MIGRATION_DEFINITION_CHECKSUM);
  });
});
