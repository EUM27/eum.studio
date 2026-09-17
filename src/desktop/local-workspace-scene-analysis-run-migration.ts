import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import {
  SCENE_ANALYSIS_RUN_SCHEMA_STATEMENTS,
} from "../platform/storage/scene-analysis-schema";

const MIGRATION_ID = "local-workspace-scene-analysis-runs-v23-to-v24";

export const SCENE_ANALYSIS_RUN_MIGRATION_STATEMENTS =
  SCENE_ANALYSIS_RUN_SCHEMA_STATEMENTS;

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='table' AND name='scene_analysis_runs') AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_analysis_runs')) AS column_count,
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='index' AND name='scene_analysis_runs_work_updated_idx') AS index_count,
    (SELECT COUNT(*) FROM scene_analysis_runs) AS run_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 1,
  column_count: 14,
  index_count: 1,
  run_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'digest' AS entity_kind,id,work_id,source_manifest_hash AS value_a,
    text AS value_b FROM narrative_digests
  UNION ALL
  SELECT 'scene-source',digest_id,work_id,source_fingerprint,
    scene_id || char(31) || document_revision_id
    FROM narrative_digest_scene_sources
  UNION ALL
  SELECT 'setting',work_id,work_id,CAST(revision AS TEXT),
    CAST(enabled AS TEXT) || char(31) || updated_at
    FROM work_scene_analysis_settings
  ORDER BY entity_kind,work_id,id,value_a
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 23,
  toSchemaVersion: 24,
  statements: SCENE_ANALYSIS_RUN_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-analysis-inputs-v23",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_CHECKSUM =
  "228c54e5911b1217cbf6f540c90289c5b2d0655f2108625b1beab2c283bbe325";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 23,
  toSchemaVersion: 24,
  definitionBytes: SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue:
    SCENE_ANALYSIS_RUN_MIGRATION_DEFINITION_CHECKSUM,
  statements: SCENE_ANALYSIS_RUN_MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-analysis-inputs-v23",
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

export async function migrateLocalWorkspaceSceneAnalysisRunsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 23) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 24,
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
