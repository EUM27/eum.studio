import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const CHARACTER_EXTRACTION_MIGRATION_ID =
  "local-workspace-character-extraction-v5-to-v6";

const CHARACTER_EXTRACTION_MIGRATION_STATEMENTS = Object.freeze([
  "PRAGMA defer_foreign_keys = ON",
  `
    CREATE TABLE assistant_context_permission_grants_v6 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      conversation_id TEXT,
      capability TEXT NOT NULL CHECK (
        capability IN ('vocabulary-lookup', 'lore-review', 'character.extract')
      ),
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
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_permission_grants_v6 (
      id,
      schema_version,
      revision,
      work_id,
      conversation_id,
      capability,
      destination_id,
      local_scope,
      external_scope,
      duration,
      created_at,
      revoked_at,
      consumed_at
    )
    SELECT
      id,
      schema_version,
      revision,
      work_id,
      conversation_id,
      capability,
      destination_id,
      local_scope,
      external_scope,
      duration,
      created_at,
      revoked_at,
      consumed_at
    FROM assistant_context_permission_grants
  `,
  "DROP TABLE assistant_context_permission_grants",
  "ALTER TABLE assistant_context_permission_grants_v6 RENAME TO assistant_context_permission_grants",
  "PRAGMA legacy_alter_table = ON",
  "ALTER TABLE assistant_context_receipts RENAME TO assistant_context_receipts_v5",
  `
    CREATE TABLE assistant_context_receipts (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (
        capability IN ('vocabulary-lookup', 'lore-review', 'character.extract')
      ),
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
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO assistant_context_receipts (
      id,
      schema_version,
      request_id,
      work_id,
      conversation_id,
      capability,
      destination_id,
      read_ranges_json,
      transmitted_ranges_json,
      read_character_count,
      transmitted_character_count,
      grant_ids_json,
      created_at
    )
    SELECT
      id,
      schema_version,
      request_id,
      work_id,
      conversation_id,
      capability,
      destination_id,
      read_ranges_json,
      transmitted_ranges_json,
      read_character_count,
      transmitted_character_count,
      grant_ids_json,
      created_at
    FROM assistant_context_receipts_v5
  `,
  "DROP TABLE assistant_context_receipts_v5",
  "PRAGMA legacy_alter_table = OFF",
  "ALTER TABLE characters ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE characters ADD COLUMN appearance TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE characters ADD COLUMN personality TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE characters ADD COLUMN speech TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE characters ADD COLUMN goal TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE characters ADD COLUMN conflict TEXT NOT NULL DEFAULT ''",
  `
    CREATE TABLE character_evidence (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_anchor_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (work_id, character_id, source_anchor_id),
      FOREIGN KEY (work_id, character_id)
        REFERENCES characters (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_anchor_id)
        REFERENCES anchors (work_id, document_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE assistant_character_extraction_candidates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_document_revision_id TEXT NOT NULL,
      source_from INTEGER NOT NULL CHECK (source_from >= 0),
      source_to INTEGER NOT NULL CHECK (source_to > source_from),
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ready', 'stale', 'completed')),
      items_json TEXT NOT NULL,
      context_receipt_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, context_receipt_id)
        REFERENCES assistant_context_receipts (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX assistant_character_extraction_work_status_idx
      ON assistant_character_extraction_candidates (work_id, status, updated_at)
  `,
]);

const CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM pragma_table_info('characters')) AS character_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('character_evidence')) AS evidence_column_count,
    (
      SELECT COUNT(*)
      FROM pragma_table_info('assistant_character_extraction_candidates')
    ) AS candidate_column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('character_evidence')
    ) AS evidence_foreign_key_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('assistant_character_extraction_candidates')
    ) AS candidate_foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name = 'assistant_character_extraction_work_status_idx'
    ) AS candidate_index_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'table'
        AND name IN (
          'assistant_context_permission_grants',
          'assistant_context_receipts'
        )
        AND sql LIKE '%character.extract%'
    ) AS character_capability_table_count,
    (SELECT COUNT(*) FROM character_evidence) AS evidence_count,
    (
      SELECT COUNT(*) FROM assistant_character_extraction_candidates
    ) AS candidate_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    character_column_count: 17,
    evidence_column_count: 6,
    candidate_column_count: 17,
    evidence_foreign_key_count: 2,
    candidate_foreign_key_count: 3,
    candidate_index_count: 1,
    character_capability_table_count: 2,
    evidence_count: 0,
    candidate_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const CHARACTER_EXTRACTION_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'character' AS entity_kind,
    id,
    work_id,
    revision,
    name AS value_a,
    role || char(31) || summary || char(31) || note AS value_b,
    created_at AS value_c,
    updated_at AS value_d,
    retired_at AS value_e
  FROM characters
  UNION ALL
  SELECT
    'permission',
    id,
    work_id,
    revision,
    capability,
    destination_id || char(31) || local_scope || char(31) || external_scope ||
      char(31) || duration || char(31) || COALESCE(conversation_id, ''),
    created_at,
    COALESCE(revoked_at, ''),
    consumed_at
  FROM assistant_context_permission_grants
  UNION ALL
  SELECT
    'receipt',
    id,
    work_id,
    schema_version,
    capability,
    destination_id || char(31) || read_ranges_json || char(31) ||
      transmitted_ranges_json || char(31) || grant_ids_json,
    created_at,
    CAST(read_character_count AS TEXT),
    CAST(transmitted_character_count AS TEXT)
  FROM assistant_context_receipts
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const CHARACTER_EXTRACTION_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: CHARACTER_EXTRACTION_MIGRATION_ID,
  fromSchemaVersion: 5,
  toSchemaVersion: 6,
  statements: CHARACTER_EXTRACTION_MIGRATION_STATEMENTS,
  verification: {
    query: CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_QUERY,
    expectedRows: CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-character-inputs-v5",
    query: CHARACTER_EXTRACTION_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CHARACTER_EXTRACTION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  CHARACTER_EXTRACTION_MIGRATION_DEFINITION,
  "utf8",
);

const CHARACTER_EXTRACTION_MIGRATION_DEFINITION_CHECKSUM =
  "8ab69ee3b411065f61056469383e2b00825c769397bae66e304089a491adf2db";

const CHARACTER_EXTRACTION_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: CHARACTER_EXTRACTION_MIGRATION_ID,
    fromSchemaVersion: 5,
    toSchemaVersion: 6,
    definitionBytes: CHARACTER_EXTRACTION_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      CHARACTER_EXTRACTION_MIGRATION_DEFINITION_CHECKSUM,
    statements: CHARACTER_EXTRACTION_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_QUERY,
      expectedRows: CHARACTER_EXTRACTION_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-character-inputs-v5",
      query: CHARACTER_EXTRACTION_LOGICAL_SNAPSHOT_QUERY,
      verifyAfterChecksumOnNoOp: true,
    }),
  });

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}

function readExistingSchemaVersion(databasePath: string): number | null {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const identityTable = database.prepare(`
      SELECT name
      FROM sqlite_master
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

export async function migrateLocalWorkspaceCharacterExtractionIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 5) return false;
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
    targetSchemaVersion: 6,
    foreignKeyMode: "temporarily-disabled",
    catalog: [CHARACTER_EXTRACTION_MIGRATION_STEP],
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
