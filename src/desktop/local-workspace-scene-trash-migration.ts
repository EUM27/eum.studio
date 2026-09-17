import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const MIGRATION_ID = "local-workspace-scene-trash-v16-to-v17";

export const SCENE_TRASH_SCHEMA_STATEMENTS = Object.freeze([
  `
    CREATE TABLE IF NOT EXISTS scene_trash_entries (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      restored_at TEXT,
      work_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      scene_identity_pre_delete_revision INTEGER NOT NULL
        CHECK (scene_identity_pre_delete_revision > 0),
      scene_identity_post_delete_revision INTEGER NOT NULL
        CHECK (scene_identity_post_delete_revision > scene_identity_pre_delete_revision),
      source_scene_key TEXT NOT NULL,
      source_rule_set_revision INTEGER NOT NULL CHECK (source_rule_set_revision > 0),
      preview_fingerprint TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      delete_lineage_operation_id TEXT NOT NULL,
      restore_lineage_operation_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'restored', 'undone')),
      UNIQUE (work_id, id),
      FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_id)
        REFERENCES scene_identities (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, delete_lineage_operation_id)
        REFERENCES scene_lineage_operations (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, restore_lineage_operation_id)
        REFERENCES scene_lineage_operations (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_trash_entries_work_status_idx
      ON scene_trash_entries (work_id, status, created_at, id)
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_trash_documents (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      trash_entry_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      before_revision_id TEXT NOT NULL,
      deleted_revision_id TEXT NOT NULL,
      restored_revision_id TEXT,
      scene_key TEXT NOT NULL,
      scene_from INTEGER NOT NULL CHECK (scene_from >= 0),
      scene_to INTEGER NOT NULL CHECK (scene_to > scene_from),
      deletion_from INTEGER NOT NULL CHECK (deletion_from >= 0),
      deletion_to INTEGER NOT NULL CHECK (deletion_to > deletion_from),
      deleted_text_hash TEXT NOT NULL,
      deleted_utf16_length INTEGER NOT NULL CHECK (deleted_utf16_length > 0),
      first_excerpt TEXT NOT NULL,
      last_excerpt TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, trash_entry_id, ordinal),
      UNIQUE (work_id, trash_entry_id, document_id),
      CHECK (deleted_utf16_length = deletion_to - deletion_from),
      FOREIGN KEY (work_id, trash_entry_id)
        REFERENCES scene_trash_entries (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id)
        REFERENCES documents (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id, before_revision_id)
        REFERENCES document_revisions (work_id, document_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id, deleted_revision_id)
        REFERENCES document_revisions (work_id, document_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id, restored_revision_id)
        REFERENCES document_revisions (work_id, document_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_trash_documents_document_idx
      ON scene_trash_documents (work_id, document_id, created_at)
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_trash_segments (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      trash_entry_id TEXT NOT NULL,
      segment_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      pre_delete_revision INTEGER NOT NULL CHECK (pre_delete_revision > 0),
      post_delete_revision INTEGER NOT NULL CHECK (post_delete_revision > pre_delete_revision),
      UNIQUE (work_id, id),
      UNIQUE (work_id, trash_entry_id, ordinal),
      UNIQUE (work_id, trash_entry_id, segment_id),
      FOREIGN KEY (work_id, trash_entry_id)
        REFERENCES scene_trash_entries (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, segment_id)
        REFERENCES scene_episode_segments (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id)
        REFERENCES documents (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_trash_segments_entry_idx
      ON scene_trash_segments (work_id, trash_entry_id, ordinal)
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_trash_overrides (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      trash_entry_id TEXT NOT NULL,
      scene_override_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      pre_delete_revision INTEGER NOT NULL CHECK (pre_delete_revision > 0),
      post_delete_revision INTEGER NOT NULL CHECK (post_delete_revision > pre_delete_revision),
      UNIQUE (work_id, id),
      UNIQUE (work_id, trash_entry_id, ordinal),
      UNIQUE (work_id, trash_entry_id, scene_override_id),
      FOREIGN KEY (work_id, trash_entry_id)
        REFERENCES scene_trash_entries (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_override_id)
        REFERENCES scene_overrides (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_trash_overrides_entry_idx
      ON scene_trash_overrides (work_id, trash_entry_id, ordinal)
  `,
  `
    CREATE TABLE IF NOT EXISTS scene_trash_bindings (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      work_id TEXT NOT NULL,
      trash_entry_id TEXT NOT NULL,
      scene_metadata_binding_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      pre_delete_revision INTEGER NOT NULL CHECK (pre_delete_revision > 0),
      post_delete_revision INTEGER NOT NULL CHECK (post_delete_revision > pre_delete_revision),
      scene_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('current', 'needs-review', 'detached')),
      proposed_scene_id TEXT,
      lineage_operation_id TEXT,
      UNIQUE (work_id, id),
      UNIQUE (work_id, trash_entry_id, ordinal),
      UNIQUE (work_id, trash_entry_id, scene_metadata_binding_id),
      FOREIGN KEY (work_id, trash_entry_id)
        REFERENCES scene_trash_entries (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_metadata_binding_id)
        REFERENCES scene_metadata_bindings (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, scene_id)
        REFERENCES scene_identities (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, proposed_scene_id)
        REFERENCES scene_identities (work_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (work_id, lineage_operation_id)
        REFERENCES scene_lineage_operations (work_id, id) ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX IF NOT EXISTS scene_trash_bindings_entry_idx
      ON scene_trash_bindings (work_id, trash_entry_id, ordinal)
  `,
]);

const VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (
      'scene_trash_entries', 'scene_trash_documents', 'scene_trash_segments',
      'scene_trash_overrides', 'scene_trash_bindings'
    )) AS table_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_trash_entries')) AS entry_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_trash_documents')) AS document_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_trash_segments')) AS segment_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_trash_overrides')) AS override_column_count,
    (SELECT COUNT(*) FROM pragma_table_info('scene_trash_bindings')) AS binding_column_count,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN (
      'scene_trash_entries_work_status_idx', 'scene_trash_documents_document_idx',
      'scene_trash_segments_entry_idx', 'scene_trash_overrides_entry_idx',
      'scene_trash_bindings_entry_idx'
    )) AS index_count,
    (SELECT COUNT(*) FROM scene_trash_entries) AS entry_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const VERIFICATION_ROWS = Object.freeze([Object.freeze({
  table_count: 5,
  entry_column_count: 17,
  document_column_count: 21,
  segment_column_count: 12,
  override_column_count: 11,
  binding_column_count: 15,
  index_count: 5,
  entry_count: 0,
  foreign_key_violation_count: 0,
})]);

const LOGICAL_SNAPSHOT_QUERY = `
  SELECT 'work' AS entity_kind, id, revision, updated_at, retired_at
  FROM works
  UNION ALL
  SELECT 'scene-identity', id, revision, updated_at, retired_at
  FROM scene_identities
  UNION ALL
  SELECT 'scene-binding', id, revision, updated_at, retired_at
  FROM scene_metadata_bindings
  ORDER BY entity_kind, id
`;

const MIGRATION_DEFINITION = JSON.stringify({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 16,
  toSchemaVersion: 17,
  statements: SCENE_TRASH_SCHEMA_STATEMENTS,
  verification: { query: VERIFICATION_QUERY, expectedRows: VERIFICATION_ROWS },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-trash-inputs-v16",
    query: LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_TRASH_MIGRATION_DEFINITION_BYTES = Buffer.from(
  MIGRATION_DEFINITION,
  "utf8",
);

export const SCENE_TRASH_MIGRATION_DEFINITION_CHECKSUM =
  "a4a92d770b7cb73ba891aebcb4e54f258bdd6a9d2d61e0e5e718e3a8471baf5c";

const MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: MIGRATION_ID,
  fromSchemaVersion: 16,
  toSchemaVersion: 17,
  definitionBytes: SCENE_TRASH_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: SCENE_TRASH_MIGRATION_DEFINITION_CHECKSUM,
  statements: SCENE_TRASH_SCHEMA_STATEMENTS,
  verification: Object.freeze({
    query: VERIFICATION_QUERY,
    expectedRows: VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-trash-inputs-v16",
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
    if (database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'storage_ledger_identity'
    `).all().length === 0) return null;
    const rows = database.prepare(`
      SELECT target_schema_version AS "targetSchemaVersion"
      FROM storage_ledger_identity
    `).all() as readonly Record<string, unknown>[];
    if (rows.length !== 1) {
      throw new Error("Local workspace storage identity is ambiguous");
    }
    const version = rows[0]?.targetSchemaVersion;
    if (typeof version !== "number" || !Number.isSafeInteger(version)) {
      throw new Error("Local workspace storage schema version is invalid");
    }
    return version;
  } finally {
    database.close();
  }
}

export async function migrateLocalWorkspaceSceneTrashIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 16) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 17,
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
