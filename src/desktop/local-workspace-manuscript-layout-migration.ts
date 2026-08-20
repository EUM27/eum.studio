import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-manuscript-layout-v12-to-v13";

const MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE work_manuscript_layout_settings (
      work_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM pragma_table_info('work_manuscript_layout_settings')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('work_manuscript_layout_settings')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM work_manuscript_layout_settings
    ) AS setting_count,
    (
      SELECT COUNT(*)
      FROM pragma_foreign_key_check
    ) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    column_count: 5,
    foreign_key_count: 1,
    setting_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'scene-draft' AS entity_kind,
    id,
    work_id,
    plot_thread_id || char(31) || target_document_id || char(31) ||
      target_document_revision_id AS value_a,
    revision || char(31) || status || char(31) || draft_text AS value_b
  FROM assistant_scene_draft_candidates
  UNION ALL
  SELECT
    'work',
    id,
    id,
    title,
    revision || char(31) || created_at || char(31) || updated_at
  FROM works
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 12,
  toSchemaVersion: 13,
  statements: MIGRATION_STATEMENTS,
  verification: {
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-manuscript-layout-inputs-v12",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const MANUSCRIPT_LAYOUT_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

const MIGRATION_DEFINITION_CHECKSUM =
  "d192bc28831275f5b56aa15412e88746aaa4dba6fc3fc60ba8f73606c171cd23";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 12,
  toSchemaVersion: 13,
  definitionBytes: MANUSCRIPT_LAYOUT_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: MIGRATION_DEFINITION_CHECKSUM,
  statements: MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-manuscript-layout-inputs-v12",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  }),
});

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT";
}

function readExistingSchemaVersion(databasePath: string): number | null {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const identityTable = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'storage_ledger_identity'
    `).all();
    if (identityTable.length === 0) return null;
    const rows = database.prepare(`
      SELECT target_schema_version AS "targetSchemaVersion"
      FROM storage_ledger_identity
    `).all() as readonly Record<string, unknown>[];
    if (rows.length !== 1) {
      throw new Error("Local workspace storage identity is ambiguous");
    }
    const value = rows[0]?.targetSchemaVersion;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return value;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceManuscriptLayoutIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 12) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 13,
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
