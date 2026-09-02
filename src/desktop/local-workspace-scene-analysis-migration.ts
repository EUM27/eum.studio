import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { runNodeSqliteStorageMigration } from "../platform/storage/node-sqlite-migration";
import type { NodeSqliteMigrationCatalogStep } from "../platform/storage/node-sqlite-migration";
import { NARRATIVE_DIGEST_SCHEMA_STATEMENTS } from "../platform/storage/narrative-digest-schema";
import {
  WORK_SCENE_ANALYSIS_SETTINGS_SCHEMA_STATEMENTS,
} from "../platform/storage/scene-analysis-schema";

const MIGRATION_ID = "local-workspace-scene-analysis-v22-to-v23";

export const SCENE_ANALYSIS_MIGRATION_STATEMENTS = Object.freeze([
  `DROP TRIGGER IF EXISTS narrative_digest_documents_no_delete`,
  `DROP TRIGGER IF EXISTS narrative_digest_documents_no_update`,
  `DROP TRIGGER IF EXISTS narrative_digests_no_delete`,
  `DROP TRIGGER IF EXISTS narrative_digests_no_update`,
  `DROP INDEX IF EXISTS narrative_digests_work_scope_idx`,
  `ALTER TABLE narrative_digest_documents RENAME TO narrative_digest_documents_v22`,
  `ALTER TABLE narrative_digests RENAME TO narrative_digests_v22`,
  ...NARRATIVE_DIGEST_SCHEMA_STATEMENTS,
  `
    INSERT INTO narrative_digests (
      id,schema_version,work_id,scope_kind,scope_document_id,scope_scene_id,
      scope_first_character_id,scope_second_character_id,source_manifest_json,
      source_manifest_hash,text,provider_id,model_id,prompt_version,
      context_receipt_id,created_at
    )
    SELECT id,schema_version,work_id,scope_kind,scope_document_id,NULL,
      scope_first_character_id,scope_second_character_id,source_manifest_json,
      source_manifest_hash,text,provider_id,model_id,prompt_version,
      context_receipt_id,created_at
    FROM narrative_digests_v22
  `,
  `
    INSERT INTO narrative_digest_documents (
      work_id,digest_id,document_id,document_revision_id,order_index
    )
    SELECT work_id,digest_id,document_id,document_revision_id,order_index
    FROM narrative_digest_documents_v22
  `,
  `DROP TABLE narrative_digest_documents_v22`,
  `DROP TABLE narrative_digests_v22`,
  ...WORK_SCENE_ANALYSIS_SETTINGS_SCHEMA_STATEMENTS,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
      'narrative_digests','narrative_digest_documents',
      'narrative_digest_scene_sources','work_scene_analysis_settings'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('narrative_digests')) AS digest_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('narrative_digest_documents')) AS document_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('narrative_digest_scene_sources')) AS scene_source_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('work_scene_analysis_settings')) AS settings_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='narrative_digests_work_scope_idx') AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN (
      'narrative_digests_no_update','narrative_digests_no_delete',
      'narrative_digest_documents_no_update','narrative_digest_documents_no_delete',
      'narrative_digest_scene_sources_no_update','narrative_digest_scene_sources_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM narrative_digest_scene_sources) AS scene_source_count,
    (SELECT COUNT(*) FROM work_scene_analysis_settings) AS settings_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 4,
  digest_column_count: 16,
  document_column_count: 5,
  scene_source_column_count: 10,
  settings_column_count: 5,
  index_count: 1,
  trigger_count: 6,
  scene_source_count: 0,
  settings_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'digest' AS entity_kind,id,work_id,scope_kind AS value_a,
    COALESCE(scope_document_id,'') || char(31) ||
    COALESCE(scope_first_character_id,'') || char(31) ||
    COALESCE(scope_second_character_id,'') || char(31) ||
    source_manifest_hash || char(31) || text || char(31) || context_receipt_id AS value_b
  FROM narrative_digests
  UNION ALL
  SELECT 'digest-document',digest_id,work_id,document_id,
    document_revision_id || char(31) || CAST(order_index AS TEXT)
  FROM narrative_digest_documents
  ORDER BY entity_kind,work_id,id,value_a
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 22,
  toSchemaVersion: 23,
  statements: SCENE_ANALYSIS_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-analysis-inputs-v22",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_ANALYSIS_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const SCENE_ANALYSIS_MIGRATION_DEFINITION_CHECKSUM =
  "05ed93aeb71fba328b6bb13bbbb03583e12c7700951cc9a000b874e40e701bcd";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 22,
  toSchemaVersion: 23,
  definitionBytes: SCENE_ANALYSIS_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: SCENE_ANALYSIS_MIGRATION_DEFINITION_CHECKSUM,
  statements: SCENE_ANALYSIS_MIGRATION_STATEMENTS,
  verification: Object.freeze({ query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-analysis-inputs-v22",
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
    const rows = database.prepare(`
      SELECT target_schema_version AS "targetSchemaVersion"
      FROM storage_ledger_identity
    `).all() as readonly Record<string, unknown>[];
    if (rows.length === 0) return null;
    const value = rows[0]?.targetSchemaVersion;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return value;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceSceneAnalysisIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 22) return false;
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
    targetSchemaVersion: 23,
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
