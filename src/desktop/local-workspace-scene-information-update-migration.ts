import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";

const MIGRATION_ID = "local-workspace-scene-information-update-v25-to-v26";

export const SCENE_INFORMATION_UPDATE_MIGRATION_STATEMENTS = Object.freeze([
  "PRAGMA defer_foreign_keys = ON",
  `
    CREATE TABLE assistant_canon_review_items_v26 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      target_kind TEXT NOT NULL CHECK (
        target_kind IN (
          'character','character-relation','lore-entry','character-knowledge'
        )
      ),
      operation TEXT NOT NULL CHECK (
        operation IN ('create', 'update', 'unresolved')
      ),
      target_hint TEXT NOT NULL,
      target_id TEXT,
      matching_target_ids_json TEXT NOT NULL,
      expected_target_revision INTEGER CHECK (expected_target_revision > 0),
      assertion_basis TEXT NOT NULL CHECK (
        assertion_basis IN ('explicit-evidence', 'model-inference')
      ),
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      applied_target_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, id),
      CHECK (
        (operation = 'update' AND target_id IS NOT NULL AND expected_target_revision IS NOT NULL) OR
        (operation <> 'update' AND target_id IS NULL AND expected_target_revision IS NULL)
      ),
      CHECK (status = 'approved' OR applied_target_id IS NULL),
      FOREIGN KEY (work_id, candidate_id)
        REFERENCES assistant_canon_review_candidates (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    INSERT INTO assistant_canon_review_items_v26 (
      id,schema_version,work_id,candidate_id,target_kind,operation,target_hint,
      target_id,matching_target_ids_json,expected_target_revision,
      assertion_basis,reason,status,applied_target_id,created_at,updated_at
    ) SELECT
      id,schema_version,work_id,candidate_id,target_kind,operation,target_hint,
      target_id,matching_target_ids_json,expected_target_revision,
      assertion_basis,reason,status,applied_target_id,created_at,updated_at
    FROM assistant_canon_review_items
  `,
  "DROP TABLE assistant_canon_review_items",
  "ALTER TABLE assistant_canon_review_items_v26 RENAME TO assistant_canon_review_items",
  `
    CREATE INDEX assistant_canon_review_items_candidate_status_idx
      ON assistant_canon_review_items (work_id, candidate_id, status, id)
  `,
  `
    CREATE TABLE assistant_canon_review_decision_receipts_v26 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
      outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'noop', 'rejected')),
      target_kind TEXT CHECK (
        target_kind IN (
          'character','character-relation','lore-entry','character-knowledge'
        )
      ),
      target_id TEXT,
      target_revision_before INTEGER CHECK (target_revision_before > 0),
      target_revision_after INTEGER CHECK (target_revision_after > 0),
      selected_fields_json TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, candidate_id, item_id),
      CHECK ((target_kind IS NULL) = (target_id IS NULL)),
      FOREIGN KEY (work_id, candidate_id, item_id)
        REFERENCES assistant_canon_review_items (work_id, candidate_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    INSERT INTO assistant_canon_review_decision_receipts_v26 (
      id,schema_version,work_id,candidate_id,item_id,decision,outcome,
      target_kind,target_id,target_revision_before,target_revision_after,
      selected_fields_json,source_document_revision_id,created_at
    ) SELECT
      id,schema_version,work_id,candidate_id,item_id,decision,outcome,
      target_kind,target_id,target_revision_before,target_revision_after,
      selected_fields_json,source_document_revision_id,created_at
    FROM assistant_canon_review_decision_receipts
  `,
  "DROP TABLE assistant_canon_review_decision_receipts",
  "ALTER TABLE assistant_canon_review_decision_receipts_v26 RENAME TO assistant_canon_review_decision_receipts",
  `
    CREATE INDEX assistant_canon_review_decisions_candidate_idx
      ON assistant_canon_review_decision_receipts (work_id, candidate_id, created_at)
  `,
  `
    CREATE TRIGGER assistant_canon_review_decisions_no_update
    BEFORE UPDATE ON assistant_canon_review_decision_receipts
    BEGIN
      SELECT RAISE(ABORT, 'assistant_canon_review_decision_receipts is immutable');
    END
  `,
  `
    CREATE TRIGGER assistant_canon_review_decisions_no_delete
    BEFORE DELETE ON assistant_canon_review_decision_receipts
    BEGIN
      SELECT RAISE(ABORT, 'assistant_canon_review_decision_receipts is immutable');
    END
  `,
  `
    CREATE TABLE scene_information_update_batches (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version=1),
      revision INTEGER NOT NULL CHECK (revision>=1),
      work_id TEXT NOT NULL,
      scene_analysis_run_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL,
      packet_hash TEXT NOT NULL,
      previous_packet_hash TEXT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      reviewed_entities_json TEXT NOT NULL,
      digest_id TEXT NOT NULL,
      canon_candidate_id TEXT,
      continuity_candidate_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('complete','partial','failed')),
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id,id),
      UNIQUE (work_id,scene_analysis_run_id),
      UNIQUE (work_id,source_fingerprint),
      UNIQUE (work_id,packet_hash),
      CHECK (
        (status='complete' AND last_error IS NULL) OR
        (status<>'complete' AND last_error IS NOT NULL AND length(trim(last_error))>0)
      ),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_analysis_run_id)
        REFERENCES scene_analysis_runs(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,scene_id)
        REFERENCES scene_identities(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,digest_id)
        REFERENCES narrative_digests(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,canon_candidate_id)
        REFERENCES assistant_canon_review_candidates(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,continuity_candidate_id)
        REFERENCES assistant_continuity_review_candidates(work_id,id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id,previous_packet_hash)
        REFERENCES scene_information_update_batches(work_id,packet_hash)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX scene_information_update_batches_work_created_idx
      ON scene_information_update_batches(work_id,created_at,id)
  `,
  `
    CREATE INDEX scene_information_update_batches_scene_created_idx
      ON scene_information_update_batches(work_id,scene_id,created_at,id)
  `,
  `
    CREATE TRIGGER scene_information_update_batches_no_update
    BEFORE UPDATE ON scene_information_update_batches
    BEGIN
      SELECT RAISE(ABORT, 'scene_information_update_batches is immutable');
    END
  `,
  `
    CREATE TRIGGER scene_information_update_batches_no_delete
    BEFORE DELETE ON scene_information_update_batches
    BEGIN
      SELECT RAISE(ABORT, 'scene_information_update_batches is immutable');
    END
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM pragma_table_info('assistant_canon_review_items'))
      AS item_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_canon_review_decision_receipts'))
      AS decision_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_information_update_batches'))
      AS batch_column_count,
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='table' AND name='assistant_canon_review_items'
        AND sql LIKE '%character-knowledge%') AS knowledge_item_table_count,
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='table' AND name='assistant_canon_review_decision_receipts'
        AND sql LIKE '%character-knowledge%') AS knowledge_decision_table_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN (
      'assistant_canon_review_items_candidate_status_idx',
      'assistant_canon_review_decisions_candidate_idx',
      'scene_information_update_batches_work_created_idx',
      'scene_information_update_batches_scene_created_idx'
    )) AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN (
      'assistant_canon_review_decisions_no_update',
      'assistant_canon_review_decisions_no_delete',
      'scene_information_update_batches_no_update',
      'scene_information_update_batches_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM scene_information_update_batches) AS batch_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  item_column_count: 16,
  decision_column_count: 14,
  batch_column_count: 21,
  knowledge_item_table_count: 1,
  knowledge_decision_table_count: 1,
  index_count: 4,
  trigger_count: 4,
  batch_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'canon-item' AS entity_kind,id AS entity_id,work_id,
    candidate_id || char(31) || target_kind || char(31) || operation ||
      char(31) || target_hint || char(31) || COALESCE(target_id,'') ||
      char(31) || status AS value
  FROM assistant_canon_review_items
  UNION ALL
  SELECT 'canon-decision',id,work_id,
    candidate_id || char(31) || item_id || char(31) || decision ||
      char(31) || outcome || char(31) || COALESCE(target_kind,'') ||
      char(31) || COALESCE(target_id,'')
  FROM assistant_canon_review_decision_receipts
  UNION ALL
  SELECT 'scene-run',id,work_id,
    scene_id || char(31) || digest_id || char(31) || source_fingerprint ||
      char(31) || lore_status || char(31) || COALESCE(canon_candidate_id,'')
  FROM scene_analysis_runs
  ORDER BY entity_kind,work_id,entity_id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 25,
  toSchemaVersion: 26,
  statements: SCENE_INFORMATION_UPDATE_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-information-inputs-v25",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_CHECKSUM =
  "e563f95e41a40ec2b977688c1f4e9eb99374480d3cc8c155ecf1a176decb9743";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 25,
  toSchemaVersion: 26,
  definitionBytes: SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue:
    SCENE_INFORMATION_UPDATE_MIGRATION_DEFINITION_CHECKSUM,
  statements: SCENE_INFORMATION_UPDATE_MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-information-inputs-v25",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  }),
});

function missing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT";
}

function version(databasePath: string): number | null {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = database.prepare(`
      SELECT target_schema_version AS value FROM storage_ledger_identity
    `).get() as { value?: unknown } | undefined;
    if (row === undefined) return null;
    if (typeof row.value !== "number" || !Number.isSafeInteger(row.value)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return row.value;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceSceneInformationUpdateIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 25) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: {
      ...profile.requestedSettings,
      foreignKeys: {
        applySql: "PRAGMA foreign_keys = OFF",
        verifySql: "PRAGMA foreign_keys",
        expectedRows: [{ foreign_keys: 0 }],
      },
    },
    targetSchemaVersion: 26,
    foreignKeyMode: "temporarily-disabled",
    catalog: [MIGRATION_STEP],
    checksum: {
      identity: profile.checksumIdentity,
      canonicalTextBytes: (value) => Buffer.from(value, "utf8"),
      checksum: (bytes) => createHash("sha256").update(bytes).digest("hex"),
    },
    clock: { now: () => new Date().toISOString() },
    receiptIdFactory: { create: () => randomUUID() },
  });
  return true;
}
