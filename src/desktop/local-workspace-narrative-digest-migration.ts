import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { NARRATIVE_DIGEST_V22_SCHEMA_STATEMENTS } from "../platform/storage/narrative-digest-v22-schema";
import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-narrative-digest-v21-to-v22";
const CONTEXT_CAPABILITIES_SQL = [
  "'vocabulary-lookup'",
  "'lore-review'",
  "'character.extract'",
  "'scene.extract'",
  "'canon.review'",
  "'continuity.review'",
  "'narrative.digest'",
  "'publishing-operations'",
].join(", ");

export const NARRATIVE_DIGEST_MIGRATION_STATEMENTS = Object.freeze([
  "PRAGMA defer_foreign_keys = ON",
  `
    CREATE TABLE assistant_context_permission_grants_v22 (
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
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_permission_grants_v22
    SELECT * FROM assistant_context_permission_grants
  `,
  "DROP TABLE assistant_context_permission_grants",
  "ALTER TABLE assistant_context_permission_grants_v22 RENAME TO assistant_context_permission_grants",
  `
    CREATE TABLE assistant_context_receipts_v22 (
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
      transmitted_character_count INTEGER NOT NULL CHECK (transmitted_character_count >= 0),
      grant_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, request_id),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_receipts_v22
    SELECT * FROM assistant_context_receipts
  `,
  "DROP TABLE assistant_context_receipts",
  "ALTER TABLE assistant_context_receipts_v22 RENAME TO assistant_context_receipts",
  `
    CREATE TABLE assistant_context_activities_v22 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      work_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      manifest_id TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (capability IN (${CONTEXT_CAPABILITIES_SQL})),
      destination_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      plan_duration_ms INTEGER NOT NULL CHECK (plan_duration_ms >= 0),
      authorize_duration_ms INTEGER NOT NULL CHECK (authorize_duration_ms >= 0),
      connector_duration_ms INTEGER NOT NULL CHECK (connector_duration_ms >= 0),
      persist_duration_ms INTEGER NOT NULL CHECK (persist_duration_ms >= 0),
      read_ranges_json TEXT NOT NULL,
      transmitted_ranges_json TEXT NOT NULL,
      read_character_count INTEGER NOT NULL CHECK (read_character_count >= 0),
      transmitted_character_count INTEGER NOT NULL CHECK (transmitted_character_count >= 0),
      candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id,receipt_id)
        REFERENCES assistant_context_receipts(work_id,id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id,manifest_id)
        REFERENCES assistant_context_manifests(work_id,id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_activities_v22
    SELECT * FROM assistant_context_activities
  `,
  "DROP TRIGGER IF EXISTS assistant_context_activities_no_update",
  "DROP TRIGGER IF EXISTS assistant_context_activities_no_delete",
  "DROP INDEX IF EXISTS assistant_context_activities_work_idx",
  "DROP TABLE assistant_context_activities",
  "ALTER TABLE assistant_context_activities_v22 RENAME TO assistant_context_activities",
  `
    CREATE INDEX assistant_context_activities_work_idx
      ON assistant_context_activities(work_id,completed_at,id)
  `,
  `
    CREATE TRIGGER assistant_context_activities_no_update
    BEFORE UPDATE ON assistant_context_activities
    BEGIN SELECT RAISE(ABORT,'assistant_context_activities is immutable'); END
  `,
  `
    CREATE TRIGGER assistant_context_activities_no_delete
    BEFORE DELETE ON assistant_context_activities
    BEGIN SELECT RAISE(ABORT,'assistant_context_activities is immutable'); END
  `,
  ...NARRATIVE_DIGEST_V22_SCHEMA_STATEMENTS,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
      'narrative_digests','narrative_digest_documents'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('narrative_digests')) AS digest_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('narrative_digest_documents')) AS document_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='narrative_digests_work_scope_idx') AS index_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN (
      'narrative_digests_no_update','narrative_digests_no_delete',
      'narrative_digest_documents_no_update','narrative_digest_documents_no_delete'
    )) AS trigger_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (
      'assistant_context_permission_grants','assistant_context_receipts','assistant_context_activities'
    ) AND sql LIKE '%narrative.digest%') AS narrative_capability_table_count,
    (SELECT COUNT(*) FROM narrative_digests) AS digest_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 2,
  digest_column_count: 15,
  document_column_count: 5,
  index_count: 1,
  trigger_count: 4,
  narrative_capability_table_count: 3,
  digest_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'work' AS entity_kind,id,id AS work_id,revision,updated_at AS value_a,
    COALESCE(retired_at,'') AS value_b FROM works
  UNION ALL SELECT 'grant',id,work_id,revision,capability,destination_id
    FROM assistant_context_permission_grants
  UNION ALL SELECT 'receipt',id,work_id,schema_version,capability,destination_id
    FROM assistant_context_receipts
  UNION ALL SELECT 'manifest',id,work_id,schema_version,receipt_id,
    CAST(estimated_token_count AS TEXT) FROM assistant_context_manifests
  UNION ALL SELECT 'activity',id,work_id,schema_version,capability,
    receipt_id || char(31) || manifest_id FROM assistant_context_activities
  ORDER BY entity_kind,work_id,id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 21,
  toSchemaVersion: 22,
  statements: NARRATIVE_DIGEST_MIGRATION_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-narrative-digest-inputs-v21",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const NARRATIVE_DIGEST_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);
export const NARRATIVE_DIGEST_MIGRATION_DEFINITION_CHECKSUM =
  "2a58768056ce93850de5c70508969e446480e77851b218b64d3b56fcbde81fcf";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 21,
  toSchemaVersion: 22,
  definitionBytes: NARRATIVE_DIGEST_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: NARRATIVE_DIGEST_MIGRATION_DEFINITION_CHECKSUM,
  statements: NARRATIVE_DIGEST_MIGRATION_STATEMENTS,
  verification: Object.freeze({ query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-narrative-digest-inputs-v21",
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

export async function migrateLocalWorkspaceNarrativeDigestIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  if (version(profile.databasePath) !== 21) return false;
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
    targetSchemaVersion: 22,
    foreignKeyMode: "temporarily-disabled",
    catalog: [MIGRATION_STEP],
    checksum: {
      identity: profile.checksumIdentity,
      canonicalTextBytes: (value) => Buffer.from(value,"utf8"),
      checksum: (bytes) => createHash("sha256").update(bytes).digest("hex"),
    },
    clock: { now: () => new Date().toISOString() },
    receiptIdFactory: { create: () => randomUUID() },
  });
  return true;
}
