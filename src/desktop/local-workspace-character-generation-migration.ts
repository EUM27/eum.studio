import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const CHARACTER_GENERATION_MIGRATION_ID =
  "local-workspace-character-generation-v8-to-v9";

const CHARACTER_GENERATION_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE assistant_character_generation_candidates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ready', 'completed')),
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX assistant_character_generation_work_status_idx
      ON assistant_character_generation_candidates (work_id, status, updated_at)
  `,
]);

const CHARACTER_GENERATION_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM pragma_table_info('assistant_character_generation_candidates')
    ) AS candidate_column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('assistant_character_generation_candidates')
    ) AS candidate_foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name = 'assistant_character_generation_work_status_idx'
    ) AS candidate_index_count,
    (SELECT COUNT(*) FROM assistant_character_generation_candidates) AS candidate_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const CHARACTER_GENERATION_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    candidate_column_count: 13,
    candidate_foreign_key_count: 1,
    candidate_index_count: 1,
    candidate_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const CHARACTER_GENERATION_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'character' AS entity_kind,
    id,
    work_id,
    revision,
    name AS value_a,
    aliases_json || char(31) || role || char(31) || summary || char(31) ||
      appearance || char(31) || personality || char(31) || speech || char(31) ||
      goal || char(31) || conflict || char(31) || note || char(31) ||
      COALESCE(retired_at, '') AS value_b
  FROM characters
  UNION ALL
  SELECT
    'character-extraction-candidate',
    id,
    work_id,
    revision,
    status,
    items_json
  FROM assistant_character_extraction_candidates
  UNION ALL
  SELECT
    'character-relation',
    id,
    work_id,
    revision,
    kind,
    description || char(31) || COALESCE(retired_at, '')
  FROM character_relations
  UNION ALL
  SELECT
    'scene-extraction-candidate',
    id,
    work_id,
    revision,
    status,
    scenes_json || char(31) || boundaries_json
  FROM assistant_scene_extraction_candidates
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const CHARACTER_GENERATION_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: CHARACTER_GENERATION_MIGRATION_ID,
  fromSchemaVersion: 8,
  toSchemaVersion: 9,
  statements: CHARACTER_GENERATION_MIGRATION_STATEMENTS,
  verification: {
    query: CHARACTER_GENERATION_MIGRATION_VERIFICATION_QUERY,
    expectedRows: CHARACTER_GENERATION_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-character-generation-inputs-v8",
    query: CHARACTER_GENERATION_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CHARACTER_GENERATION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  CHARACTER_GENERATION_MIGRATION_DEFINITION,
  "utf8",
);

const CHARACTER_GENERATION_MIGRATION_DEFINITION_CHECKSUM =
  "41ef17130f190cf2fee80315ff0e059748d78eeab433d23208e641b6c7fec554";

const CHARACTER_GENERATION_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: CHARACTER_GENERATION_MIGRATION_ID,
    fromSchemaVersion: 8,
    toSchemaVersion: 9,
    definitionBytes: CHARACTER_GENERATION_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      CHARACTER_GENERATION_MIGRATION_DEFINITION_CHECKSUM,
    statements: CHARACTER_GENERATION_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: CHARACTER_GENERATION_MIGRATION_VERIFICATION_QUERY,
      expectedRows: CHARACTER_GENERATION_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-character-generation-inputs-v8",
      query: CHARACTER_GENERATION_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceCharacterGenerationIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 8) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 9,
    catalog: [CHARACTER_GENERATION_MIGRATION_STEP],
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
