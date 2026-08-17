import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const PLOT_BOARD_MIGRATION_ID = "local-workspace-plot-board-v3-to-v4";

const PLOT_BOARD_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE plot_boards (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      title TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('sequence', 'time-map')),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
    ) STRICT
  `,
  `
    CREATE TABLE plot_lanes (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      plot_board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (
        kind IN ('default', 'main', 'subplot', 'stage', 'custom')
      ),
      order_key TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, plot_board_id, id),
      FOREIGN KEY (work_id, plot_board_id)
        REFERENCES plot_boards (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX plot_lanes_default_idx
      ON plot_lanes (work_id, plot_board_id)
      WHERE kind = 'default'
  `,
  `
    CREATE TABLE plot_placements (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      plot_board_id TEXT NOT NULL,
      plot_lane_id TEXT NOT NULL,
      plot_thread_id TEXT NOT NULL,
      order_key TEXT NOT NULL,
      story_time REAL,
      story_time_end REAL,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, plot_board_id)
        REFERENCES plot_boards (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, plot_board_id, plot_lane_id)
        REFERENCES plot_lanes (work_id, plot_board_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, plot_thread_id)
        REFERENCES plot_threads (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX plot_placements_active_plot_idx
      ON plot_placements (work_id, plot_board_id, plot_thread_id)
      WHERE retired_at IS NULL
  `,
  `
    CREATE UNIQUE INDEX plot_placements_active_order_idx
      ON plot_placements (work_id, plot_board_id, plot_lane_id, order_key)
      WHERE retired_at IS NULL
  `,
  `
    CREATE INDEX plot_placements_lane_active_idx
      ON plot_placements (work_id, plot_board_id, plot_lane_id, retired_at)
  `,
]);

const PLOT_BOARD_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'plot_boards', 'plot_lanes', 'plot_placements'
      )
    ) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('plot_boards')) AS board_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('plot_lanes')) AS lane_column_count,
    (
      SELECT COUNT(*) FROM pragma_table_info('plot_placements')
    ) AS placement_column_count,
    (
      SELECT COUNT(DISTINCT id) FROM pragma_foreign_key_list('plot_boards')
    ) AS board_foreign_key_count,
    (
      SELECT COUNT(DISTINCT id) FROM pragma_foreign_key_list('plot_lanes')
    ) AS lane_foreign_key_count,
    (
      SELECT COUNT(DISTINCT id) FROM pragma_foreign_key_list('plot_placements')
    ) AS placement_foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'index' AND name IN (
        'plot_lanes_default_idx',
        'plot_placements_active_plot_idx',
        'plot_placements_active_order_idx',
        'plot_placements_lane_active_idx'
      )
    ) AS index_count,
    (SELECT COUNT(*) FROM plot_boards) AS board_count,
    (SELECT COUNT(*) FROM plot_lanes) AS lane_count,
    (SELECT COUNT(*) FROM plot_placements) AS placement_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const PLOT_BOARD_LOGICAL_SNAPSHOT_QUERY = `
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
    'PlotThread',
    id,
    work_id,
    revision,
    title,
    summary,
    retired_at
  FROM plot_threads
  UNION ALL
  SELECT
    'PlotEventLink',
    id,
    work_id,
    revision,
    plot_thread_id,
    event_block_id || ':' || role || ':' || created_from,
    retired_at
  FROM plot_event_links
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const PLOT_BOARD_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    table_count: 3,
    board_column_count: 8,
    lane_column_count: 10,
    placement_column_count: 13,
    board_foreign_key_count: 1,
    lane_foreign_key_count: 1,
    placement_foreign_key_count: 3,
    index_count: 4,
    board_count: 0,
    lane_count: 0,
    placement_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const PLOT_BOARD_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: PLOT_BOARD_MIGRATION_ID,
  fromSchemaVersion: 3,
  toSchemaVersion: 4,
  statements: PLOT_BOARD_MIGRATION_STATEMENTS,
  verification: {
    query: PLOT_BOARD_MIGRATION_VERIFICATION_QUERY,
    expectedRows: PLOT_BOARD_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-plot-board-content-v3",
    query: PLOT_BOARD_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

const PLOT_BOARD_MIGRATION_DEFINITION_BYTES = Buffer.from(
  PLOT_BOARD_MIGRATION_DEFINITION,
  "utf8",
);

const PLOT_BOARD_MIGRATION_DEFINITION_CHECKSUM =
  "1d754dd59640a9ac25cfd5153585be068c5bfb6616da9067012f4db4ec41fcd6";

const PLOT_BOARD_MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: PLOT_BOARD_MIGRATION_ID,
  fromSchemaVersion: 3,
  toSchemaVersion: 4,
  definitionBytes: PLOT_BOARD_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: PLOT_BOARD_MIGRATION_DEFINITION_CHECKSUM,
  statements: PLOT_BOARD_MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: PLOT_BOARD_MIGRATION_VERIFICATION_QUERY,
    expectedRows: PLOT_BOARD_MIGRATION_VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-plot-board-content-v3",
    query: PLOT_BOARD_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspacePlotBoardsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 3) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 4,
    catalog: [PLOT_BOARD_MIGRATION_STEP],
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
