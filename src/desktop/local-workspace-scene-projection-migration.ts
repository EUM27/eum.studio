import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const SCENE_PROJECTION_MIGRATION_ID =
  "local-workspace-scene-projection-v4-to-v5";

const SCENE_PROJECTION_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE scene_rule_sets (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      boundary_rules_json TEXT NOT NULL,
      normalization_policy TEXT NOT NULL CHECK (
        normalization_policy IN ('preserve', 'trim-line-whitespace')
      ),
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    CREATE TABLE scene_event_overrides (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      scene_key TEXT NOT NULL,
      event_block_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('include', 'exclude')),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, event_block_id)
        REFERENCES event_blocks (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX scene_event_overrides_active_pair_idx
      ON scene_event_overrides (work_id, scene_key, event_block_id)
      WHERE retired_at IS NULL
  `,
]);

const SCENE_PROJECTION_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'scene_rule_sets', 'scene_event_overrides'
      )
    ) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_rule_sets')) AS rule_column_count,
    (
      SELECT COUNT(*) FROM pragma_table_info('scene_event_overrides')
    ) AS event_override_column_count,
    (
      SELECT COUNT(DISTINCT id) FROM pragma_foreign_key_list('scene_rule_sets')
    ) AS rule_foreign_key_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('scene_event_overrides')
    ) AS event_override_foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name = 'scene_event_overrides_active_pair_idx'
    ) AS index_count,
    (SELECT COUNT(*) FROM scene_rule_sets) AS rule_count,
    (SELECT COUNT(*) FROM scene_event_overrides) AS event_override_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const SCENE_PROJECTION_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    table_count: 2,
    rule_column_count: 11,
    event_override_column_count: 10,
    rule_foreign_key_count: 1,
    event_override_foreign_key_count: 1,
    index_count: 1,
    rule_count: 0,
    event_override_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const SCENE_PROJECTION_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'EventBlock' AS entity_kind,
    id,
    work_id,
    revision,
    title,
    COALESCE(note, '') AS detail,
    retired_at
  FROM event_blocks
  UNION ALL
  SELECT
    'SceneOverride',
    id,
    work_id,
    revision,
    document_id,
    operation || ':' || CAST(base_rule_set_revision AS TEXT),
    retired_at
  FROM scene_overrides
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const SCENE_PROJECTION_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: SCENE_PROJECTION_MIGRATION_ID,
  fromSchemaVersion: 4,
  toSchemaVersion: 5,
  statements: SCENE_PROJECTION_MIGRATION_STATEMENTS,
  verification: {
    query: SCENE_PROJECTION_MIGRATION_VERIFICATION_QUERY,
    expectedRows: SCENE_PROJECTION_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-inputs-v4",
    query: SCENE_PROJECTION_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_PROJECTION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  SCENE_PROJECTION_MIGRATION_DEFINITION,
  "utf8",
);

const SCENE_PROJECTION_MIGRATION_DEFINITION_CHECKSUM =
  "060d616b6c39b94044040a22871a86676c442935cc84048489c0850f40e34593";

const SCENE_PROJECTION_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: SCENE_PROJECTION_MIGRATION_ID,
    fromSchemaVersion: 4,
    toSchemaVersion: 5,
    definitionBytes: SCENE_PROJECTION_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      SCENE_PROJECTION_MIGRATION_DEFINITION_CHECKSUM,
    statements: SCENE_PROJECTION_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: SCENE_PROJECTION_MIGRATION_VERIFICATION_QUERY,
      expectedRows: SCENE_PROJECTION_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-scene-inputs-v4",
      query: SCENE_PROJECTION_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceSceneProjectionIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 4) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 5,
    catalog: [SCENE_PROJECTION_MIGRATION_STEP],
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
