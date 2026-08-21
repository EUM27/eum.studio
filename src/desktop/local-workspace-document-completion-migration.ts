import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-document-completion-v13-to-v14";

const MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE document_completion_status (
      work_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      completed_at TEXT,
      completed_date TEXT,
      completed_time_zone TEXT,
      completed_document_revision_id TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (work_id, document_id),
      CHECK (
        (
          completed_at IS NULL AND
          completed_date IS NULL AND
          completed_time_zone IS NULL AND
          completed_document_revision_id IS NULL
        ) OR (
          completed_at IS NOT NULL AND
          completed_date IS NOT NULL AND
          completed_time_zone IS NOT NULL AND
          completed_document_revision_id IS NOT NULL
        )
      ),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (
        work_id,
        document_id,
        completed_document_revision_id
      )
        REFERENCES document_revisions (
          work_id,
          document_id,
          id
        )
        ON DELETE RESTRICT
    ) STRICT
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM pragma_table_info('document_completion_status')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('document_completion_status')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM document_completion_status
    ) AS completion_count,
    (
      SELECT COUNT(*)
      FROM pragma_foreign_key_check
    ) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    column_count: 9,
    foreign_key_count: 3,
    completion_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'document' AS entity_kind,
    id,
    work_id,
    title AS value_a,
    revision || char(31) || updated_at || char(31) ||
      COALESCE(retired_at, '') || char(31) || COALESCE(archived_at, '') AS value_b
  FROM documents
  UNION ALL
  SELECT
    'work',
    id,
    id,
    title,
    revision || char(31) || updated_at || char(31) || COALESCE(retired_at, '')
  FROM works
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 13,
  toSchemaVersion: 14,
  statements: MIGRATION_STATEMENTS,
  verification: {
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-document-completion-inputs-v13",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const DOCUMENT_COMPLETION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

const MIGRATION_DEFINITION_CHECKSUM =
  "8ac105b191fba714e6f27a7e428bdf3fc80093a722c87e320ca663dd604c0ffe";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 13,
  toSchemaVersion: 14,
  definitionBytes: DOCUMENT_COMPLETION_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: MIGRATION_DEFINITION_CHECKSUM,
  statements: MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-document-completion-inputs-v13",
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

export async function migrateLocalWorkspaceDocumentCompletionIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 13) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 14,
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
