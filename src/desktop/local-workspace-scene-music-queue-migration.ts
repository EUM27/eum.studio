import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const SCENE_MUSIC_QUEUE_MIGRATION_ID =
  "local-workspace-scene-music-queue-v10-to-v11";

const SCENE_MUSIC_QUEUE_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE scene_music_queue_candidates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      scene_key TEXT NOT NULL,
      scene_annotation_id TEXT NOT NULL,
      scene_annotation_revision INTEGER NOT NULL
        CHECK (scene_annotation_revision > 0),
      provider_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('ready', 'selected', 'superseded')),
      options_json TEXT NOT NULL,
      selected_option_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      CHECK (
        (status = 'ready' AND selected_option_id IS NULL)
        OR
        (status IN ('selected', 'superseded') AND selected_option_id IS NOT NULL)
      ),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_annotation_id)
        REFERENCES scene_annotations (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX scene_music_queue_work_scene_status_idx
      ON scene_music_queue_candidates (
        work_id,
        scene_key,
        status,
        updated_at
      )
  `,
]);

const SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM pragma_table_info('scene_music_queue_candidates')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('scene_music_queue_candidates')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE
        type = 'index'
        AND name = 'scene_music_queue_work_scene_status_idx'
    ) AS index_count,
    (
      SELECT COUNT(*)
      FROM scene_music_queue_candidates
    ) AS candidate_count,
    (
      SELECT COUNT(*)
      FROM pragma_foreign_key_check
    ) AS foreign_key_violation_count
`;

const SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    column_count: 15,
    foreign_key_count: 2,
    index_count: 1,
    candidate_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const SCENE_MUSIC_QUEUE_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'scene-annotation' AS entity_kind,
    id,
    work_id,
    scene_key || char(31) || document_id || char(31) ||
      document_revision_id || char(31) || source_candidate_id || char(31) ||
      source_scene_item_id || char(31) || title AS value_a,
    summary || char(31) || COALESCE(pov_character_id, '') || char(31) ||
      location || char(31) || time || char(31) || character_ids_json ||
      char(31) || goal || char(31) || conflict || char(31) || outcome ||
      char(31) || revision || char(31) || created_at || char(31) || updated_at
      AS value_b
  FROM scene_annotations
  UNION ALL
  SELECT
    'work',
    id,
    id,
    title,
    revision || char(31) || created_at || char(31) || updated_at
  FROM works
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: SCENE_MUSIC_QUEUE_MIGRATION_ID,
  fromSchemaVersion: 10,
  toSchemaVersion: 11,
  statements: SCENE_MUSIC_QUEUE_MIGRATION_STATEMENTS,
  verification: {
    query: SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_QUERY,
    expectedRows: SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-music-queue-inputs-v10",
    query: SCENE_MUSIC_QUEUE_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION_BYTES = Buffer.from(
  SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION,
  "utf8",
);

const SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION_CHECKSUM =
  "491167ae0e876f740eee581cab47c42ebc2915069c46d58877d5767eb4a3dea2";

const SCENE_MUSIC_QUEUE_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: SCENE_MUSIC_QUEUE_MIGRATION_ID,
    fromSchemaVersion: 10,
    toSchemaVersion: 11,
    definitionBytes: SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      SCENE_MUSIC_QUEUE_MIGRATION_DEFINITION_CHECKSUM,
    statements: SCENE_MUSIC_QUEUE_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_QUERY,
      expectedRows: SCENE_MUSIC_QUEUE_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-scene-music-queue-inputs-v10",
      query: SCENE_MUSIC_QUEUE_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceSceneMusicQueuesIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 10) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 11,
    catalog: [SCENE_MUSIC_QUEUE_MIGRATION_STEP],
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
