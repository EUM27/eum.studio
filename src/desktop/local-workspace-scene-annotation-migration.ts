import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const SCENE_ANNOTATION_MIGRATION_ID =
  "local-workspace-scene-annotation-v9-to-v10";

const SCENE_ANNOTATION_MIGRATION_STATEMENTS = Object.freeze([
  `
    UPDATE assistant_scene_extraction_candidates
    SET scenes_json = COALESCE((
      SELECT json_group_array(
        json_set(
          item.value,
          '$.annotationStatus',
          'pending',
          '$.sceneAnnotationId',
          json('null')
        )
      )
      FROM json_each(assistant_scene_extraction_candidates.scenes_json) AS item
      ORDER BY CAST(item.key AS INTEGER) ASC
    ), '[]')
  `,
  `
    UPDATE assistant_scene_extraction_candidates
    SET
      revision = revision + 1,
      status = CASE
        WHEN status = 'stale' THEN 'stale'
        WHEN json_array_length(scenes_json) = 0 THEN 'completed'
        ELSE 'ready'
      END
  `,
  `
    CREATE TABLE scene_annotations (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      scene_key TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_revision_id TEXT NOT NULL,
      source_candidate_id TEXT NOT NULL,
      source_scene_item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      pov_character_id TEXT,
      location TEXT NOT NULL,
      time TEXT NOT NULL,
      character_ids_json TEXT NOT NULL,
      goal TEXT NOT NULL,
      conflict TEXT NOT NULL,
      outcome TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      UNIQUE (work_id, scene_key),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, document_id, document_revision_id)
        REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, source_candidate_id)
        REFERENCES assistant_scene_extraction_candidates (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, pov_character_id)
        REFERENCES characters (work_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX scene_annotations_work_document_idx
      ON scene_annotations (work_id, document_id, updated_at)
  `,
]);

const SCENE_ANNOTATION_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (SELECT COUNT(*) FROM pragma_table_info('scene_annotations')) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('scene_annotations')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'index' AND name = 'scene_annotations_work_document_idx'
    ) AS index_count,
    (
      SELECT COUNT(*)
      FROM assistant_scene_extraction_candidates AS candidate,
           json_each(candidate.scenes_json) AS item
      WHERE
        json_type(item.value, '$.annotationStatus') <> 'text'
        OR json_type(item.value, '$.sceneAnnotationId') <> 'null'
    ) AS invalid_candidate_scene_count,
    (SELECT COUNT(*) FROM scene_annotations) AS annotation_count,
    (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violation_count
`;

const SCENE_ANNOTATION_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    column_count: 20,
    foreign_key_count: 4,
    index_count: 1,
    invalid_candidate_scene_count: 0,
    annotation_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const SCENE_ANNOTATION_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'character' AS entity_kind,
    id,
    work_id,
    name AS value_a,
    aliases_json || char(31) || role || char(31) || summary || char(31) ||
      appearance || char(31) || personality || char(31) || speech || char(31) ||
      goal || char(31) || conflict || char(31) || note || char(31) ||
      COALESCE(retired_at, '') AS value_b
  FROM characters
  UNION ALL
  SELECT
    'scene-candidate-source',
    id,
    work_id,
    source_document_id || char(31) || source_document_revision_id || char(31) ||
      source_from || char(31) || source_to,
    provider_id || char(31) || model_id || char(31) || prompt_version || char(31) ||
      boundaries_json || char(31) || context_receipt_id || char(31) ||
      created_at || char(31) || updated_at
  FROM assistant_scene_extraction_candidates
  UNION ALL
  SELECT
    'scene-override',
    id,
    work_id,
    document_id || char(31) || operation || char(31) || base_rule_set_revision,
    COALESCE(note, '') || char(31) || COALESCE(retired_at, '')
  FROM scene_overrides
  ORDER BY entity_kind ASC, work_id ASC, id ASC
`;

const SCENE_ANNOTATION_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: SCENE_ANNOTATION_MIGRATION_ID,
  fromSchemaVersion: 9,
  toSchemaVersion: 10,
  statements: SCENE_ANNOTATION_MIGRATION_STATEMENTS,
  verification: {
    query: SCENE_ANNOTATION_MIGRATION_VERIFICATION_QUERY,
    expectedRows: SCENE_ANNOTATION_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-annotation-inputs-v9",
    query: SCENE_ANNOTATION_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_ANNOTATION_MIGRATION_DEFINITION_BYTES = Buffer.from(
  SCENE_ANNOTATION_MIGRATION_DEFINITION,
  "utf8",
);

const SCENE_ANNOTATION_MIGRATION_DEFINITION_CHECKSUM =
  "300057fbc85911220f74a6aea46e2da793955bf491c6a77b81c939bd32857736";

const SCENE_ANNOTATION_MIGRATION_STEP: NodeSqliteMigrationCatalogStep =
  Object.freeze({
    migrationId: SCENE_ANNOTATION_MIGRATION_ID,
    fromSchemaVersion: 9,
    toSchemaVersion: 10,
    definitionBytes: SCENE_ANNOTATION_MIGRATION_DEFINITION_BYTES,
    expectedDefinitionChecksumValue:
      SCENE_ANNOTATION_MIGRATION_DEFINITION_CHECKSUM,
    statements: SCENE_ANNOTATION_MIGRATION_STATEMENTS,
    verification: Object.freeze({
      query: SCENE_ANNOTATION_MIGRATION_VERIFICATION_QUERY,
      expectedRows: SCENE_ANNOTATION_MIGRATION_VERIFICATION_ROWS,
    }),
    logicalSnapshot: Object.freeze({
      scopeIdentity: "local-workspace-scene-annotation-inputs-v9",
      query: SCENE_ANNOTATION_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceSceneAnnotationsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 9) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 10,
    catalog: [SCENE_ANNOTATION_MIGRATION_STEP],
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
