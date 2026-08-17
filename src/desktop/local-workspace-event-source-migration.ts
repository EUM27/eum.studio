import {
  createHash,
  randomUUID,
} from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type {
  Poc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";

const EVENT_SOURCE_MIGRATION_ID =
  "local-workspace-event-source-v1-to-v2";

const EVENT_SOURCE_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TEMP TABLE event_source_backfill AS
    SELECT
      lower(hex(randomblob(16))) AS event_source_id,
      id AS event_block_id,
      work_id,
      range_group_id,
      created_at,
      updated_at,
      retired_at
    FROM event_blocks
  `,
  `
    CREATE TEMP TABLE event_source_migration_counts AS
    SELECT
      (SELECT COUNT(*) FROM event_blocks) AS event_count,
      (SELECT COUNT(*) FROM activity_interval_event_blocks) AS activity_link_count
  `,
  `
    CREATE TABLE event_blocks_v2 (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      parent_event_id TEXT,
      title TEXT NOT NULL,
      note TEXT,
      stage_ref TEXT,
      order_key TEXT NOT NULL,
      collapsed INTEGER NOT NULL,
      relation_ids_json TEXT,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, parent_event_id)
        REFERENCES event_blocks_v2 (work_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    INSERT INTO event_blocks_v2 (
      id,
      schema_version,
      revision,
      created_at,
      updated_at,
      retired_at,
      work_id,
      parent_event_id,
      title,
      note,
      stage_ref,
      order_key,
      collapsed,
      relation_ids_json
    )
    SELECT
      id,
      schema_version,
      revision,
      created_at,
      updated_at,
      retired_at,
      work_id,
      parent_event_id,
      title,
      note,
      stage_ref,
      order_key,
      collapsed,
      relation_ids_json
    FROM event_blocks
  `,
  `
    CREATE TABLE activity_interval_event_blocks_v2 (
      work_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      activity_interval_id TEXT NOT NULL,
      event_block_id TEXT NOT NULL,
      PRIMARY KEY (
        activity_interval_id,
        event_block_id
      ),
      FOREIGN KEY (
        work_id,
        session_id,
        activity_interval_id
      )
        REFERENCES activity_intervals (
          work_id,
          session_id,
          id
        )
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, event_block_id)
        REFERENCES event_blocks_v2 (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    INSERT INTO activity_interval_event_blocks_v2 (
      work_id,
      session_id,
      activity_interval_id,
      event_block_id
    )
    SELECT
      work_id,
      session_id,
      activity_interval_id,
      event_block_id
    FROM activity_interval_event_blocks
  `,
  "DROP TABLE activity_interval_event_blocks",
  "UPDATE event_blocks SET parent_event_id = NULL WHERE parent_event_id IS NOT NULL",
  "DROP TABLE event_blocks",
  "ALTER TABLE event_blocks_v2 RENAME TO event_blocks",
  "ALTER TABLE activity_interval_event_blocks_v2 RENAME TO activity_interval_event_blocks",
  `
    CREATE TABLE event_sources (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      event_block_id TEXT NOT NULL,
      range_group_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('primary', 'supporting')),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, event_block_id)
        REFERENCES event_blocks (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, range_group_id)
        REFERENCES range_groups (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX event_sources_event_block_active_idx
      ON event_sources (work_id, event_block_id, retired_at)
  `,
  `
    INSERT INTO event_sources (
      id,
      schema_version,
      revision,
      created_at,
      updated_at,
      retired_at,
      work_id,
      event_block_id,
      range_group_id,
      role
    )
    SELECT
      event_source_id,
      2,
      1,
      created_at,
      updated_at,
      retired_at,
      work_id,
      event_block_id,
      range_group_id,
      'primary'
    FROM event_source_backfill
  `,
]);

const EVENT_SOURCE_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      (SELECT event_count FROM event_source_migration_counts) -
      (SELECT COUNT(*) FROM event_blocks)
    ) AS event_count_delta,
    (
      (SELECT COUNT(*) FROM event_source_backfill) -
      (SELECT COUNT(*) FROM event_sources)
    ) AS source_count_delta,
    (
      (SELECT activity_link_count FROM event_source_migration_counts) -
      (SELECT COUNT(*) FROM activity_interval_event_blocks)
    ) AS activity_link_count_delta,
    (
      SELECT COUNT(*)
      FROM event_source_backfill AS b
      LEFT JOIN event_sources AS s
        ON s.id = b.event_source_id
        AND s.work_id = b.work_id
        AND s.event_block_id = b.event_block_id
        AND s.range_group_id = b.range_group_id
      WHERE s.id IS NULL
    ) AS missing_backfill_count,
    (
      SELECT COUNT(*)
      FROM event_sources AS s
      JOIN event_blocks AS e
        ON e.id = s.event_block_id
      WHERE e.work_id <> s.work_id
    ) AS event_ownership_violation_count,
    (
      SELECT COUNT(*)
      FROM event_sources AS s
      JOIN range_groups AS rg
        ON rg.id = s.range_group_id
      WHERE rg.work_id <> s.work_id
    ) AS range_ownership_violation_count,
    (
      SELECT COUNT(*)
      FROM event_sources
      WHERE role <> 'primary'
    ) AS non_primary_backfill_count,
    (
      SELECT COUNT(*)
      FROM pragma_table_info('event_blocks')
      WHERE name = 'range_group_id'
    ) AS legacy_range_column_count
`;

const EVENT_SOURCE_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    id,
    schema_version,
    revision,
    created_at,
    updated_at,
    retired_at,
    work_id,
    parent_event_id,
    title,
    note,
    stage_ref,
    order_key,
    collapsed,
    relation_ids_json
  FROM event_blocks
  ORDER BY work_id ASC, id ASC
`;

const EVENT_SOURCE_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: EVENT_SOURCE_MIGRATION_ID,
  fromSchemaVersion: 1,
  toSchemaVersion: 2,
  statements: EVENT_SOURCE_MIGRATION_STATEMENTS,
  verification: {
    query: EVENT_SOURCE_MIGRATION_VERIFICATION_QUERY,
    expectedRows: [{
      event_count_delta: 0,
      source_count_delta: 0,
      activity_link_count_delta: 0,
      missing_backfill_count: 0,
      event_ownership_violation_count: 0,
      range_ownership_violation_count: 0,
      non_primary_backfill_count: 0,
      legacy_range_column_count: 0,
    }],
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-event-block-content-v1",
    query: EVENT_SOURCE_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

const EVENT_SOURCE_MIGRATION_DEFINITION_BYTES = Buffer.from(
  EVENT_SOURCE_MIGRATION_DEFINITION,
  "utf8",
);

const EVENT_SOURCE_MIGRATION_DEFINITION_CHECKSUM =
  "8930594390709d89f1cb81776a3bf0505a2e30a850855d290f2491643d2b21e2";

const EVENT_SOURCE_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: EVENT_SOURCE_MIGRATION_ID,
    fromSchemaVersion: 1,
    toSchemaVersion: 2,
    definitionBytes: EVENT_SOURCE_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      EVENT_SOURCE_MIGRATION_DEFINITION_CHECKSUM,
    statements: EVENT_SOURCE_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: EVENT_SOURCE_MIGRATION_VERIFICATION_QUERY,
      expectedRows: Object.freeze([Object.freeze({
        event_count_delta: 0,
        source_count_delta: 0,
        activity_link_count_delta: 0,
        missing_backfill_count: 0,
        event_ownership_violation_count: 0,
        range_ownership_violation_count: 0,
        non_primary_backfill_count: 0,
        legacy_range_column_count: 0,
      })]),
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-event-block-content-v1",
      query: EVENT_SOURCE_LOGICAL_SNAPSHOT_QUERY,
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
    if (identityTable.length === 0) {
      return null;
    }
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

export async function migrateLocalWorkspaceEventSourcesIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) {
      return false;
    }
    throw error;
  }
  const currentSchemaVersion = readExistingSchemaVersion(profile.databasePath);
  if (currentSchemaVersion !== 1) {
    return false;
  }
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: profile.targetSchemaVersion,
    catalog: [EVENT_SOURCE_MIGRATION_STEP],
    checksum: {
      identity: profile.checksumIdentity,
      canonicalTextBytes: (value) => Buffer.from(value, "utf8"),
      checksum: (bytes) => createHash("sha256").update(bytes).digest("hex"),
    },
    clock: {
      now: () => new Date().toISOString(),
    },
    receiptIdFactory: {
      create: () => randomUUID(),
    },
  });
  return true;
}
