import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { CONTEXT_PLANNER_SCHEMA_STATEMENTS } from "../platform/storage/context-planner-schema";
import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-context-planner-v20-to-v21";
export const CONTEXT_PLANNER_MIGRATION_STATEMENTS = Object.freeze([
  ...CONTEXT_PLANNER_SCHEMA_STATEMENTS,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
      'assistant_entity_context_policies','assistant_context_manifests',
      'assistant_context_activities'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_entity_context_policies')) AS policy_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_context_manifests')) AS manifest_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_context_activities')) AS activity_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN (
      'assistant_entity_context_policies_work_idx','assistant_context_manifests_work_idx',
      'assistant_context_activities_work_idx'
    )) AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN (
      'assistant_context_policy_ref_validate_insert','assistant_context_policy_ref_validate_update',
      'assistant_context_manifests_no_update','assistant_context_manifests_no_delete',
      'assistant_context_activities_no_update','assistant_context_activities_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM assistant_entity_context_policies) AS policy_count,
    (SELECT COUNT(*) FROM assistant_context_manifests) AS manifest_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 3,
  policy_column_count: 9,
  manifest_column_count: 8,
  activity_column_count: 20,
  index_count: 3,
  trigger_count: 6,
  policy_count: 0,
  manifest_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'work' AS entity_kind, id, id AS work_id, revision, updated_at AS value_a,
    COALESCE(retired_at,'') AS value_b FROM works
  UNION ALL SELECT 'character', id, work_id, revision, updated_at, COALESCE(retired_at,'') FROM characters
  UNION ALL SELECT 'continuity', id, work_id, revision, updated_at, status FROM continuity_threads
  UNION ALL SELECT 'knowledge', id, work_id, revision, updated_at, status FROM character_knowledge
  UNION ALL SELECT 'receipt', id, work_id, schema_version, capability, destination_id FROM assistant_context_receipts
  ORDER BY entity_kind, work_id, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 20,
  toSchemaVersion: 21,
  statements: CONTEXT_PLANNER_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-context-planner-inputs-v20",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CONTEXT_PLANNER_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const CONTEXT_PLANNER_MIGRATION_DEFINITION_CHECKSUM =
  "16fb9da9f10d9d6775f4a85f954adbed65de34d5db6bb576dc93ae152144f04f";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 20,
  toSchemaVersion: 21,
  definitionBytes: CONTEXT_PLANNER_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: CONTEXT_PLANNER_MIGRATION_DEFINITION_CHECKSUM,
  statements: CONTEXT_PLANNER_MIGRATION_STATEMENTS,
  verification: Object.freeze({ query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-context-planner-inputs-v20",
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
    if (database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='storage_ledger_identity'`).all().length === 0) return null;
    const row = database.prepare(`SELECT target_schema_version AS value FROM storage_ledger_identity`).get() as { value?: unknown } | undefined;
    if (typeof row?.value !== "number" || !Number.isSafeInteger(row.value)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return row.value;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceContextPlannerIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 20) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 21,
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
