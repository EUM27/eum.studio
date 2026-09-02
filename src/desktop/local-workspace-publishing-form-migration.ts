import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import {
  PUBLISHING_FORM_SCHEMA_STATEMENTS,
} from "../platform/storage/publishing-form-schema";

const MIGRATION_ID = "local-workspace-publishing-forms-v24-to-v25";

export const PUBLISHING_FORM_MIGRATION_STATEMENTS =
  PUBLISHING_FORM_SCHEMA_STATEMENTS;

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='table' AND name IN (
        'publishing_form_templates','publishing_form_responses'
      )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('publishing_form_templates'))
      AS template_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('publishing_form_responses'))
      AS response_column_count,
    (SELECT COUNT(*) FROM sqlite_master
      WHERE type='index' AND name IN (
        'publishing_form_templates_active_base_idx',
        'publishing_form_templates_active_partner_idx',
        'publishing_form_responses_work_updated_idx'
      )) AS index_count,
    (SELECT COUNT(*) FROM publishing_form_templates) AS template_count,
    (SELECT COUNT(*) FROM publishing_form_responses) AS response_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 2,
  template_column_count: 12,
  response_column_count: 10,
  index_count: 3,
  template_count: 0,
  response_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'partner' AS entity_kind,id AS entity_id,
    CAST(revision AS TEXT) AS revision,
    name || char(31) || submission_method || char(31) || required_length
      || char(31) || source_ids_json AS value
  FROM publishing_partners
  UNION ALL
  SELECT 'submission',id,CAST(revision AS TEXT),
    work_id || char(31) || partner_id || char(31) || submission_package_id
      || char(31) || status || char(31) || source_ids_json
  FROM publishing_submissions
  UNION ALL
  SELECT 'contract',id,CAST(revision AS TEXT),
    work_id || char(31) || partner_id || char(31) || status
      || char(31) || source_ids_json
  FROM publishing_contracts
  UNION ALL
  SELECT 'publication',id,CAST(revision AS TEXT),
    work_id || char(31) || COALESCE(contract_id,'') || char(31) || status
      || char(31) || source_ids_json
  FROM publishing_publications
  UNION ALL
  SELECT 'settlement',id,CAST(revision AS TEXT),
    work_id || char(31) || publication_id || char(31) || review_status
      || char(31) || source_ids_json
  FROM publishing_settlements
  UNION ALL
  SELECT 'payment',id,CAST(revision AS TEXT),
    work_id || char(31) || COALESCE(settlement_id,'') || char(31) || match_status
      || char(31) || source_ids_json
  FROM publishing_payments
  UNION ALL
  SELECT 'source',id,CAST(revision AS TEXT),
    source_kind || char(31) || label || char(31) || imported_fields_json
  FROM publishing_sources
  ORDER BY entity_kind,entity_id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 24,
  toSchemaVersion: 25,
  statements: PUBLISHING_FORM_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-publishing-ledgers-v24",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const PUBLISHING_FORM_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const PUBLISHING_FORM_MIGRATION_DEFINITION_CHECKSUM =
  "79cb1d4c1c5a9a7de65088bd66474b7f6e46396df224074b8532447b46442346";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 24,
  toSchemaVersion: 25,
  definitionBytes: PUBLISHING_FORM_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue:
    PUBLISHING_FORM_MIGRATION_DEFINITION_CHECKSUM,
  statements: PUBLISHING_FORM_MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-publishing-ledgers-v24",
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

export async function migrateLocalWorkspacePublishingFormsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 24) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 25,
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
