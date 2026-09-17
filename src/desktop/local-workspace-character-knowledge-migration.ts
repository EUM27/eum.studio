import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { CHARACTER_KNOWLEDGE_SCHEMA_STATEMENTS } from "../platform/storage/character-knowledge-schema";

const MIGRATION_ID = "local-workspace-character-knowledge-v19-to-v20";

export const CHARACTER_KNOWLEDGE_MIGRATION_STATEMENTS = Object.freeze([
  ...CHARACTER_KNOWLEDGE_SCHEMA_STATEMENTS,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (
      'character_knowledge', 'character_knowledge_entity_refs',
      'character_knowledge_evidence', 'character_knowledge_history'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('character_knowledge'))
      AS knowledge_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('character_knowledge_entity_refs'))
      AS ref_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('character_knowledge_evidence'))
      AS evidence_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('character_knowledge_history'))
      AS history_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN (
      'character_knowledge_work_character_status_idx',
      'character_knowledge_active_statement_idx',
      'character_knowledge_evidence_entry_idx'
    )) AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN (
      'character_knowledge_refs_validate_insert',
      'character_knowledge_refs_validate_update',
      'character_knowledge_history_no_update',
      'character_knowledge_history_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM character_knowledge) AS knowledge_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 4,
  knowledge_column_count: 14,
  ref_column_count: 5,
  evidence_column_count: 12,
  history_column_count: 11,
  index_count: 3,
  trigger_count: 4,
  knowledge_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'work' AS entity_kind, id, id AS work_id, revision,
    updated_at AS value_a, COALESCE(retired_at, '') AS value_b
  FROM works
  UNION ALL
  SELECT 'character', id, work_id, revision, updated_at, COALESCE(retired_at, '')
  FROM characters
  UNION ALL
  SELECT 'continuity-thread', id, work_id, revision, updated_at, status
  FROM continuity_threads
  ORDER BY entity_kind, work_id, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 19,
  toSchemaVersion: 20,
  statements: CHARACTER_KNOWLEDGE_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-character-knowledge-inputs-v19",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

export const CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_CHECKSUM =
  "26636b137c36a7fadf7aea068f67e94fd787f014a96e860dee9632f228abf8cc";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 19,
  toSchemaVersion: 20,
  definitionBytes: CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: CHARACTER_KNOWLEDGE_MIGRATION_DEFINITION_CHECKSUM,
  statements: CHARACTER_KNOWLEDGE_MIGRATION_STATEMENTS,
  verification: Object.freeze({ query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-character-knowledge-inputs-v19",
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
    if (database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'storage_ledger_identity'
    `).all().length === 0) return null;
    const rows = database.prepare(`
      SELECT target_schema_version AS "targetSchemaVersion"
      FROM storage_ledger_identity
    `).all() as readonly Record<string, unknown>[];
    if (rows.length !== 1) throw new Error("Local workspace storage identity is ambiguous");
    const version = rows[0]?.targetSchemaVersion;
    if (typeof version !== "number" || !Number.isSafeInteger(version)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return version;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceCharacterKnowledgeIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 19) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 20,
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
