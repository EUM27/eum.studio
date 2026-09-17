import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-episode-range-move-v14-to-v15";

const MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE scene_identities (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE scene_episode_segments (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      anchor_id TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, scene_id, anchor_id),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_id)
        REFERENCES scene_identities (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id, anchor_id)
        REFERENCES anchors (work_id, document_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX scene_episode_segments_active_scene_idx
    ON scene_episode_segments (work_id, scene_id, document_id)
    WHERE retired_at IS NULL
  `,
  `
    CREATE TABLE episode_range_moves (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      undone_at TEXT,
      work_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      target_document_id TEXT NOT NULL,
      from_offset INTEGER NOT NULL CHECK (from_offset >= 0),
      to_offset INTEGER NOT NULL CHECK (to_offset > from_offset),
      placement TEXT NOT NULL CHECK (placement IN ('start', 'end')),
      source_before_revision_id TEXT NOT NULL,
      target_before_revision_id TEXT NOT NULL,
      source_after_revision_id TEXT NOT NULL,
      target_after_revision_id TEXT NOT NULL,
      created_scene_ids_json TEXT NOT NULL,
      scene_ids_json TEXT NOT NULL,
      created_segment_ids_json TEXT NOT NULL,
      retired_segment_ids_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'undone')),
      UNIQUE (work_id, id),
      CHECK (source_document_id <> target_document_id),
      CHECK (
        (status = 'active' AND undone_at IS NULL) OR
        (status = 'undone' AND undone_at IS NOT NULL)
      ),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, target_document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_before_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, target_document_id, target_before_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_after_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, target_document_id, target_after_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX episode_range_moves_active_documents_idx
    ON episode_range_moves (
      work_id,
      source_document_id,
      target_document_id,
      status
    )
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM pragma_table_info('scene_identities'))
      AS scene_identity_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_episode_segments'))
      AS scene_segment_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('episode_range_moves'))
      AS move_column_count,
    (SELECT COUNT(*) FROM scene_identities) AS scene_identity_count,
    (SELECT COUNT(*) FROM scene_episode_segments) AS scene_segment_count,
    (SELECT COUNT(*) FROM episode_range_moves) AS move_count,
    (
      SELECT COUNT(*)
      FROM pragma_index_list('scene_episode_segments')
      WHERE name = 'scene_episode_segments_active_scene_idx'
        AND partial = 1
    ) AS scene_segment_index_count,
    (
      SELECT COUNT(*)
      FROM pragma_index_list('episode_range_moves')
      WHERE name = 'episode_range_moves_active_documents_idx'
    ) AS move_index_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check)
      AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    scene_identity_column_count: 7,
    scene_segment_column_count: 10,
    move_column_count: 21,
    scene_identity_count: 0,
    scene_segment_count: 0,
    move_count: 0,
    scene_segment_index_count: 1,
    move_index_count: 1,
    foreign_key_violation_count: 0,
  }),
]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'work' AS entity_kind, id, id AS work_id, title AS value
  FROM works
  UNION ALL
  SELECT 'document', id, work_id, title
  FROM documents
  UNION ALL
  SELECT 'document-revision', id, work_id, document_id
  FROM document_revisions
  UNION ALL
  SELECT 'anchor', id, work_id, document_id
  FROM anchors
  ORDER BY entity_kind, work_id, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 14,
  toSchemaVersion: 15,
  statements: MIGRATION_STATEMENTS,
  verification: {
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-episode-range-move-inputs-v14",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const EPISODE_RANGE_MOVE_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

const MIGRATION_DEFINITION_CHECKSUM =
  "cf0db9a631832b9a0afe130139d8687ad322d422a0427d03728e02f91ad2cc16";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 14,
  toSchemaVersion: 15,
  definitionBytes: EPISODE_RANGE_MOVE_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: MIGRATION_DEFINITION_CHECKSUM,
  statements: MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-episode-range-move-inputs-v14",
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
    const identityTable = database.prepare(`
      SELECT name FROM sqlite_master
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

export async function migrateLocalWorkspaceEpisodeRangeMovesIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 14) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 15,
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
