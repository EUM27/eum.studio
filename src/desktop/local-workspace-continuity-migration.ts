import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";
import { CONTINUITY_SCHEMA_STATEMENTS } from "../platform/storage/continuity-schema";

const MIGRATION_ID = "local-workspace-continuity-v18-to-v19";

const CONTEXT_CAPABILITIES_SQL = [
  "'vocabulary-lookup'",
  "'lore-review'",
  "'character.extract'",
  "'scene.extract'",
  "'canon.review'",
  "'continuity.review'",
  "'publishing-operations'",
].join(", ");

export const CONTINUITY_MIGRATION_STATEMENTS = Object.freeze([
  "PRAGMA defer_foreign_keys = ON",
  `
    CREATE TABLE assistant_context_permission_grants_v19 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      conversation_id TEXT,
      capability TEXT NOT NULL CHECK (capability IN (${CONTEXT_CAPABILITIES_SQL})),
      destination_id TEXT NOT NULL,
      local_scope TEXT NOT NULL CHECK (
        local_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')
      ),
      external_scope TEXT NOT NULL CHECK (
        external_scope IN ('none', 'selection', 'paragraph', 'scene', 'chapter', 'work')
      ),
      duration TEXT NOT NULL CHECK (duration IN ('once', 'conversation', 'work')),
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      consumed_at TEXT,
      UNIQUE (work_id, id),
      CHECK (
        (duration = 'work' AND conversation_id IS NULL) OR
        (duration <> 'work' AND conversation_id IS NOT NULL)
      ),
      CHECK (duration = 'once' OR consumed_at IS NULL),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_permission_grants_v19 (
      id, schema_version, revision, work_id, conversation_id, capability,
      destination_id, local_scope, external_scope, duration, created_at,
      revoked_at, consumed_at
    )
    SELECT
      id, schema_version, revision, work_id, conversation_id, capability,
      destination_id, local_scope, external_scope, duration, created_at,
      revoked_at, consumed_at
    FROM assistant_context_permission_grants
  `,
  "DROP TABLE assistant_context_permission_grants",
  "ALTER TABLE assistant_context_permission_grants_v19 RENAME TO assistant_context_permission_grants",
  "PRAGMA legacy_alter_table = ON",
  "ALTER TABLE assistant_context_receipts RENAME TO assistant_context_receipts_v18",
  `
    CREATE TABLE assistant_context_receipts (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (capability IN (${CONTEXT_CAPABILITIES_SQL})),
      destination_id TEXT NOT NULL,
      read_ranges_json TEXT NOT NULL,
      transmitted_ranges_json TEXT NOT NULL,
      read_character_count INTEGER NOT NULL CHECK (read_character_count >= 0),
      transmitted_character_count INTEGER NOT NULL CHECK (
        transmitted_character_count >= 0
      ),
      grant_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, request_id),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_receipts (
      id, schema_version, request_id, work_id, conversation_id, capability,
      destination_id, read_ranges_json, transmitted_ranges_json,
      read_character_count, transmitted_character_count, grant_ids_json,
      created_at
    )
    SELECT
      id, schema_version, request_id, work_id, conversation_id, capability,
      destination_id, read_ranges_json, transmitted_ranges_json,
      read_character_count, transmitted_character_count, grant_ids_json,
      created_at
    FROM assistant_context_receipts_v18
  `,
  "DROP TABLE assistant_context_receipts_v18",
  "PRAGMA legacy_alter_table = OFF",
  ...CONTINUITY_SCHEMA_STATEMENTS,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (
      'continuity_threads', 'continuity_thread_entity_refs',
      'continuity_thread_evidence', 'continuity_thread_history',
      'assistant_continuity_review_candidates',
      'assistant_continuity_review_items',
      'assistant_continuity_review_evidence',
      'assistant_continuity_review_decisions'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('continuity_threads'))
      AS thread_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('continuity_thread_entity_refs'))
      AS ref_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('continuity_thread_evidence'))
      AS evidence_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('continuity_thread_history'))
      AS history_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_continuity_review_candidates'))
      AS candidate_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_continuity_review_items'))
      AS item_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_continuity_review_evidence'))
      AS review_evidence_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('assistant_continuity_review_decisions'))
      AS decision_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN (
      'continuity_threads_work_status_idx',
      'continuity_thread_evidence_thread_idx',
      'assistant_continuity_review_candidates_work_idx',
      'assistant_continuity_review_items_candidate_idx'
    )) AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN (
      'continuity_thread_refs_validate_insert',
      'continuity_thread_refs_validate_update',
      'continuity_thread_history_no_update',
      'continuity_thread_history_no_delete',
      'assistant_continuity_review_decisions_no_update',
      'assistant_continuity_review_decisions_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (
      'assistant_context_permission_grants', 'assistant_context_receipts'
    ) AND sql LIKE '%continuity.review%') AS continuity_capability_table_count,
    (SELECT COUNT(*) FROM continuity_threads) AS thread_count,
    (SELECT COUNT(*) FROM assistant_continuity_review_candidates)
      AS candidate_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 8,
  thread_column_count: 12,
  ref_column_count: 5,
  evidence_column_count: 13,
  history_column_count: 11,
  candidate_column_count: 17,
  item_column_count: 15,
  review_evidence_column_count: 12,
  decision_column_count: 11,
  index_count: 4,
  trigger_count: 6,
  continuity_capability_table_count: 2,
  thread_count: 0,
  candidate_count: 0,
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
  SELECT 'character-relation', id, work_id, revision, updated_at,
    COALESCE(retired_at, '')
  FROM character_relations
  UNION ALL
  SELECT 'lore-entry', id, work_id, revision, updated_at, COALESCE(retired_at, '')
  FROM lore_entries
  UNION ALL
  SELECT 'permission', id, work_id, revision, capability,
    destination_id || char(31) || local_scope || char(31) || external_scope ||
      char(31) || duration || char(31) || COALESCE(conversation_id, '') ||
      char(31) || COALESCE(revoked_at, '') || char(31) || COALESCE(consumed_at, '')
  FROM assistant_context_permission_grants
  UNION ALL
  SELECT 'receipt', id, work_id, schema_version, capability,
    destination_id || char(31) || read_ranges_json || char(31) ||
      transmitted_ranges_json || char(31) || grant_ids_json || char(31) ||
      CAST(read_character_count AS TEXT) || char(31) ||
      CAST(transmitted_character_count AS TEXT)
  FROM assistant_context_receipts
  UNION ALL
  SELECT 'canon-candidate', id, work_id, revision, status,
    source_document_revision_id || char(31) || context_receipt_id
  FROM assistant_canon_review_candidates
  ORDER BY entity_kind, work_id, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 18,
  toSchemaVersion: 19,
  statements: CONTINUITY_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-continuity-inputs-v18",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CONTINUITY_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

export const CONTINUITY_MIGRATION_DEFINITION_CHECKSUM =
  "d653b477fea88adab8fa4e9b3db17012b5641c047cd660b1a683973775205f48";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 18,
  toSchemaVersion: 19,
  definitionBytes: CONTINUITY_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: CONTINUITY_MIGRATION_DEFINITION_CHECKSUM,
  statements: CONTINUITY_MIGRATION_STATEMENTS,
  verification: Object.freeze({ query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-continuity-inputs-v18",
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

export async function migrateLocalWorkspaceContinuityIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 18) return false;
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
    targetSchemaVersion: 19,
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
