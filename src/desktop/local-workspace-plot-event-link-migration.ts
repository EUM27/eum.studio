import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const PLOT_EVENT_LINK_MIGRATION_ID =
  "local-workspace-plot-event-link-v2-to-v3";

const PLOT_EVENT_LINK_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE plot_event_links (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      plot_thread_id TEXT NOT NULL,
      event_block_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('primary', 'supporting')),
      created_from TEXT NOT NULL CHECK (
        created_from IN ('event-to-plot', 'plot-to-event', 'manual-link')
      ),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, plot_thread_id)
        REFERENCES plot_threads (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, event_block_id)
        REFERENCES event_blocks (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX plot_event_links_active_pair_idx
      ON plot_event_links (work_id, plot_thread_id, event_block_id)
      WHERE retired_at IS NULL
  `,
  `
    CREATE UNIQUE INDEX plot_event_links_active_primary_idx
      ON plot_event_links (work_id, plot_thread_id)
      WHERE retired_at IS NULL AND role = 'primary'
  `,
  `
    CREATE INDEX plot_event_links_event_active_idx
      ON plot_event_links (work_id, event_block_id, retired_at)
  `,
]);

const PLOT_EVENT_LINK_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'table' AND name = 'plot_event_links'
    ) AS table_count,
    (
      SELECT COUNT(*)
      FROM pragma_table_info('plot_event_links')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('plot_event_links')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name IN (
          'plot_event_links_active_pair_idx',
          'plot_event_links_active_primary_idx',
          'plot_event_links_event_active_idx'
        )
    ) AS index_count,
    (SELECT COUNT(*) FROM plot_event_links) AS link_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const PLOT_EVENT_LINK_LOGICAL_SNAPSHOT_QUERY = `
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
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const PLOT_EVENT_LINK_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: PLOT_EVENT_LINK_MIGRATION_ID,
  fromSchemaVersion: 2,
  toSchemaVersion: 3,
  statements: PLOT_EVENT_LINK_MIGRATION_STATEMENTS,
  verification: {
    query: PLOT_EVENT_LINK_MIGRATION_VERIFICATION_QUERY,
    expectedRows: [{
      table_count: 1,
      column_count: 11,
      foreign_key_count: 2,
      index_count: 3,
      link_count: 0,
      foreign_key_violation_count: 0,
    }],
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-plot-event-content-v2",
    query: PLOT_EVENT_LINK_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

const PLOT_EVENT_LINK_MIGRATION_DEFINITION_BYTES = Buffer.from(
  PLOT_EVENT_LINK_MIGRATION_DEFINITION,
  "utf8",
);

const PLOT_EVENT_LINK_MIGRATION_DEFINITION_CHECKSUM =
  "fe1be835846f0596d03988c8f8eb73821d01bd45ce8ce3ea277e5c2d77f5a597";

const PLOT_EVENT_LINK_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: PLOT_EVENT_LINK_MIGRATION_ID,
    fromSchemaVersion: 2,
    toSchemaVersion: 3,
    definitionBytes: PLOT_EVENT_LINK_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      PLOT_EVENT_LINK_MIGRATION_DEFINITION_CHECKSUM,
    statements: PLOT_EVENT_LINK_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: PLOT_EVENT_LINK_MIGRATION_VERIFICATION_QUERY,
      expectedRows: Object.freeze([Object.freeze({
        table_count: 1,
        column_count: 11,
        foreign_key_count: 2,
        index_count: 3,
        link_count: 0,
        foreign_key_violation_count: 0,
      })]),
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-plot-event-content-v2",
      query: PLOT_EVENT_LINK_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspacePlotEventLinksIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 2) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 3,
    catalog: [PLOT_EVENT_LINK_MIGRATION_STEP],
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
