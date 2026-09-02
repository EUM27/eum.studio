import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-scene-metadata-v15-to-v16";

const MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS manuscript_annotations (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_anchor_id TEXT NOT NULL,
      body TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id, source_document_id)
        REFERENCES documents (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_document_id, source_anchor_id)
        REFERENCES anchors (work_id, document_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS manuscript_annotations_active_source_idx
      ON manuscript_annotations (work_id, source_document_id, updated_at)
      WHERE retired_at IS NULL
  `,
  `
    CREATE TABLE scene_lineage_operations (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      operation TEXT NOT NULL
        CHECK (operation IN ('split', 'merge', 'move', 'delete', 'restore')),
      command_ref TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, operation, command_ref),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE TABLE scene_lineage_members (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      lineage_operation_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      UNIQUE (work_id, id),
      UNIQUE (work_id, lineage_operation_id, role, ordinal),
      UNIQUE (work_id, lineage_operation_id, scene_id, role),
      FOREIGN KEY (work_id, lineage_operation_id)
        REFERENCES scene_lineage_operations (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_id)
        REFERENCES scene_identities (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX scene_lineage_members_scene_idx
      ON scene_lineage_members (work_id, scene_id, role, created_at)
  `,
  `
    CREATE TABLE scene_metadata_bindings (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      retired_at TEXT,
      work_id TEXT NOT NULL,
      metadata_kind TEXT NOT NULL
        CHECK (metadata_kind IN ('annotation', 'event-override', 'music-queue')),
      metadata_id TEXT NOT NULL,
      source_scene_key TEXT NOT NULL,
      scene_id TEXT,
      status TEXT NOT NULL
        CHECK (status IN ('current', 'needs-review', 'detached')),
      proposed_scene_id TEXT,
      lineage_operation_id TEXT,
      UNIQUE (work_id, id),
      CHECK (status <> 'current' OR scene_id IS NOT NULL),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_id)
        REFERENCES scene_identities (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, proposed_scene_id)
        REFERENCES scene_identities (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, lineage_operation_id)
        REFERENCES scene_lineage_operations (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE UNIQUE INDEX scene_metadata_bindings_active_source_idx
      ON scene_metadata_bindings (work_id, metadata_kind, metadata_id)
      WHERE retired_at IS NULL
  `,
  `
    CREATE INDEX scene_metadata_bindings_scene_status_idx
      ON scene_metadata_bindings (work_id, scene_id, status, updated_at)
      WHERE retired_at IS NULL
  `,
  `
    CREATE TRIGGER scene_metadata_bindings_source_insert
    BEFORE INSERT ON scene_metadata_bindings
    WHEN
      (NEW.metadata_kind = 'annotation' AND NOT EXISTS (
        SELECT 1 FROM scene_annotations
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      )) OR
      (NEW.metadata_kind = 'event-override' AND NOT EXISTS (
        SELECT 1 FROM scene_event_overrides
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      )) OR
      (NEW.metadata_kind = 'music-queue' AND NOT EXISTS (
        SELECT 1 FROM scene_music_queue_candidates
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      ))
    BEGIN
      SELECT RAISE(ABORT, 'Scene metadata binding source is missing');
    END
  `,
  `
    CREATE TRIGGER scene_metadata_bindings_source_update
    BEFORE UPDATE OF work_id, metadata_kind, metadata_id ON scene_metadata_bindings
    WHEN
      (NEW.metadata_kind = 'annotation' AND NOT EXISTS (
        SELECT 1 FROM scene_annotations
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      )) OR
      (NEW.metadata_kind = 'event-override' AND NOT EXISTS (
        SELECT 1 FROM scene_event_overrides
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      )) OR
      (NEW.metadata_kind = 'music-queue' AND NOT EXISTS (
        SELECT 1 FROM scene_music_queue_candidates
        WHERE work_id = NEW.work_id AND id = NEW.metadata_id
      ))
    BEGIN
      SELECT RAISE(ABORT, 'Scene metadata binding source is missing');
    END
  `,
  `
    INSERT INTO scene_metadata_bindings (
      id, schema_version, revision, created_at, updated_at, retired_at,
      work_id, metadata_kind, metadata_id, source_scene_key, scene_id,
      status, proposed_scene_id, lineage_operation_id
    )
    SELECT
      'scene-binding:annotation:' || work_id || ':' || id,
      1, 1, created_at, updated_at, NULL,
      work_id, 'annotation', id, scene_key, NULL,
      'needs-review', NULL, NULL
    FROM scene_annotations
  `,
  `
    INSERT INTO scene_metadata_bindings (
      id, schema_version, revision, created_at, updated_at, retired_at,
      work_id, metadata_kind, metadata_id, source_scene_key, scene_id,
      status, proposed_scene_id, lineage_operation_id
    )
    SELECT
      'scene-binding:event-override:' || work_id || ':' || id,
      1, 1, created_at, updated_at, retired_at,
      work_id, 'event-override', id, scene_key, NULL,
      CASE WHEN retired_at IS NULL THEN 'needs-review' ELSE 'detached' END,
      NULL, NULL
    FROM scene_event_overrides
  `,
  `
    INSERT INTO scene_metadata_bindings (
      id, schema_version, revision, created_at, updated_at, retired_at,
      work_id, metadata_kind, metadata_id, source_scene_key, scene_id,
      status, proposed_scene_id, lineage_operation_id
    )
    SELECT
      'scene-binding:music-queue:' || work_id || ':' || id,
      1, 1, created_at, updated_at, NULL,
      work_id, 'music-queue', id, scene_key, NULL,
      'needs-review', NULL, NULL
    FROM scene_music_queue_candidates
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*) FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'scene_lineage_operations',
        'scene_lineage_members',
        'scene_metadata_bindings'
      )
    ) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_lineage_operations'))
      AS lineage_operation_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_lineage_members'))
      AS lineage_member_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_metadata_bindings'))
      AS metadata_binding_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('manuscript_annotations'))
      AS manuscript_annotation_column_count,
    (
      SELECT COUNT(*) FROM sqlite_master
      WHERE type = 'trigger' AND name IN (
        'scene_metadata_bindings_source_insert',
        'scene_metadata_bindings_source_update'
      )
    ) AS trigger_count,
    (
      SELECT COUNT(*) FROM sqlite_master
      WHERE type = 'index' AND name IN (
        'scene_lineage_members_scene_idx',
        'scene_metadata_bindings_active_source_idx',
        'scene_metadata_bindings_scene_status_idx',
        'manuscript_annotations_active_source_idx'
      )
    ) AS index_count,
    (
      (SELECT COUNT(*) FROM scene_annotations) -
      (SELECT COUNT(*) FROM scene_metadata_bindings
        WHERE metadata_kind = 'annotation')
    ) AS annotation_binding_delta,
    (
      (SELECT COUNT(*) FROM scene_event_overrides) -
      (SELECT COUNT(*) FROM scene_metadata_bindings
        WHERE metadata_kind = 'event-override')
    ) AS event_override_binding_delta,
    (
      (SELECT COUNT(*) FROM scene_music_queue_candidates) -
      (SELECT COUNT(*) FROM scene_metadata_bindings
        WHERE metadata_kind = 'music-queue')
    ) AS music_queue_binding_delta,
    (
      SELECT COUNT(*)
      FROM scene_metadata_bindings AS binding
      WHERE
        (binding.metadata_kind = 'annotation' AND NOT EXISTS (
          SELECT 1 FROM scene_annotations AS source
          WHERE source.work_id = binding.work_id
            AND source.id = binding.metadata_id
            AND source.scene_key = binding.source_scene_key
        )) OR
        (binding.metadata_kind = 'event-override' AND NOT EXISTS (
          SELECT 1 FROM scene_event_overrides AS source
          WHERE source.work_id = binding.work_id
            AND source.id = binding.metadata_id
            AND source.scene_key = binding.source_scene_key
        )) OR
        (binding.metadata_kind = 'music-queue' AND NOT EXISTS (
          SELECT 1 FROM scene_music_queue_candidates AS source
          WHERE source.work_id = binding.work_id
            AND source.id = binding.metadata_id
            AND source.scene_key = binding.source_scene_key
        ))
    ) AS source_key_mismatch_count,
    (SELECT COUNT(*) FROM scene_metadata_bindings WHERE scene_id IS NOT NULL)
      AS guessed_scene_count,
    (SELECT COUNT(*) FROM scene_metadata_bindings WHERE status = 'current')
      AS current_binding_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check)
      AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    table_count: 3,
    lineage_operation_column_count: 9,
    lineage_member_column_count: 11,
    metadata_binding_column_count: 14,
    manuscript_annotation_column_count: 11,
    trigger_count: 2,
    index_count: 4,
    annotation_binding_delta: 0,
    event_override_binding_delta: 0,
    music_queue_binding_delta: 0,
    source_key_mismatch_count: 0,
    guessed_scene_count: 0,
    current_binding_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'scene-annotation' AS entity_kind,
    id,
    work_id,
    scene_key,
    CAST(revision AS TEXT) || ':' || title AS value,
    created_at,
    updated_at,
    NULL AS retired_at
  FROM scene_annotations
  UNION ALL
  SELECT
    'scene-event-override',
    id,
    work_id,
    scene_key,
    CAST(revision AS TEXT) || ':' || operation,
    created_at,
    updated_at,
    retired_at
  FROM scene_event_overrides
  UNION ALL
  SELECT
    'scene-music-queue',
    id,
    work_id,
    scene_key,
    CAST(revision AS TEXT) || ':' || status || ':' || query_text,
    created_at,
    updated_at,
    NULL
  FROM scene_music_queue_candidates
  ORDER BY entity_kind, work_id, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 15,
  toSchemaVersion: 16,
  statements: MIGRATION_STATEMENTS,
  verification: {
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-metadata-inputs-v15",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_METADATA_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

const MIGRATION_DEFINITION_CHECKSUM =
  "ce30b862faad687084bc662d8909f506c107519ae8516d1e3b3afd6d975f49ec";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 15,
  toSchemaVersion: 16,
  definitionBytes: SCENE_METADATA_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: MIGRATION_DEFINITION_CHECKSUM,
  statements: MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-metadata-inputs-v15",
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

export async function migrateLocalWorkspaceSceneMetadataIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 15) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 16,
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
