import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const CHARACTER_RELATION_MIGRATION_ID =
  "local-workspace-character-relation-v6-to-v7";

const CHARACTER_RELATION_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE character_relations (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      retirement_reason TEXT CHECK (
        retirement_reason IN ('user', 'character-retired')
      ),
      work_id TEXT NOT NULL,
      from_character_id TEXT NOT NULL,
      to_character_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      UNIQUE (work_id, id),
      CHECK ((retired_at IS NULL) = (retirement_reason IS NULL)),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, from_character_id)
        REFERENCES characters (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, to_character_id)
        REFERENCES characters (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX character_relations_work_active_idx
      ON character_relations (
        work_id,
        from_character_id,
        to_character_id,
        retired_at
      )
  `,
]);

const CHARACTER_RELATION_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'table' AND name = 'character_relations'
    ) AS table_count,
    (
      SELECT COUNT(*) FROM pragma_table_info('character_relations')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('character_relations')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name = 'character_relations_work_active_idx'
    ) AS index_count,
    (SELECT COUNT(*) FROM character_relations) AS relation_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const CHARACTER_RELATION_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    table_count: 1,
    column_count: 12,
    foreign_key_count: 3,
    index_count: 1,
    relation_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const CHARACTER_RELATION_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    id,
    work_id,
    revision,
    name,
    aliases_json,
    role,
    summary,
    appearance,
    personality,
    speech,
    goal,
    conflict,
    note,
    retired_at
  FROM characters
  ORDER BY work_id ASC, id ASC
`;

const CHARACTER_RELATION_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: CHARACTER_RELATION_MIGRATION_ID,
  fromSchemaVersion: 6,
  toSchemaVersion: 7,
  statements: CHARACTER_RELATION_MIGRATION_STATEMENTS,
  verification: {
    query: CHARACTER_RELATION_MIGRATION_VERIFICATION_QUERY,
    expectedRows: CHARACTER_RELATION_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-character-content-v6",
    query: CHARACTER_RELATION_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const CHARACTER_RELATION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  CHARACTER_RELATION_MIGRATION_DEFINITION,
  "utf8",
);

const CHARACTER_RELATION_MIGRATION_DEFINITION_CHECKSUM =
  "59fabd931398cd47d10b30baf56a706bcb2e4b850d94cfbcbba712f82109c6f2";

const CHARACTER_RELATION_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: CHARACTER_RELATION_MIGRATION_ID,
    fromSchemaVersion: 6,
    toSchemaVersion: 7,
    definitionBytes: CHARACTER_RELATION_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      CHARACTER_RELATION_MIGRATION_DEFINITION_CHECKSUM,
    statements: CHARACTER_RELATION_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: CHARACTER_RELATION_MIGRATION_VERIFICATION_QUERY,
      expectedRows: CHARACTER_RELATION_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-character-content-v6",
      query: CHARACTER_RELATION_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceCharacterRelationsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 6) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 7,
    catalog: [CHARACTER_RELATION_MIGRATION_STEP],
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
