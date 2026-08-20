import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  runNodeSqliteStorageMigration,
  type NodeSqliteMigrationCatalogStep,
} from "../platform/storage/node-sqlite-migration";
import type { Poc3StorageOpenProfile } from "../platform/storage/node-sqlite-ledger-profile";

const SCENE_DRAFT_MIGRATION_ID = "local-workspace-scene-draft-v11-to-v12";

const SCENE_DRAFT_MIGRATION_STATEMENTS = Object.freeze([
  `
    CREATE TABLE assistant_scene_draft_candidates (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      request_id TEXT NOT NULL UNIQUE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      work_id TEXT NOT NULL,
      plot_thread_id TEXT NOT NULL,
      plot_thread_revision INTEGER NOT NULL CHECK (plot_thread_revision > 0),
      target_document_id TEXT NOT NULL,
      target_document_revision_id TEXT NOT NULL,
      insertion_offset INTEGER NOT NULL CHECK (insertion_offset >= 0),
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL CHECK (prompt_version = 'scene-draft-v1'),
      context_json TEXT NOT NULL,
      generated_text TEXT NOT NULL,
      draft_text TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ready', 'applied')),
      applied_document_revision_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (work_id, id),
      CHECK (
        (status = 'ready' AND applied_document_revision_id IS NULL)
        OR
        (status = 'applied' AND applied_document_revision_id IS NOT NULL)
      ),
      FOREIGN KEY (work_id)
        REFERENCES works (id)
        ON DELETE RESTRICT,
      FOREIGN KEY (work_id, plot_thread_id)
        REFERENCES plot_threads (work_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (
        work_id,
        target_document_id,
        target_document_revision_id
      ) REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (
        work_id,
        target_document_id,
        applied_document_revision_id
      ) REFERENCES document_revisions (work_id, document_id, id)
        ON DELETE RESTRICT
    ) STRICT
  `,
  `
    CREATE INDEX assistant_scene_draft_work_plot_status_idx
      ON assistant_scene_draft_candidates (
        work_id,
        plot_thread_id,
        status,
        updated_at
      )
  `,
]);

const SCENE_DRAFT_MIGRATION_VERIFICATION_QUERY = `
  SELECT
    (
      SELECT COUNT(*)
      FROM pragma_table_info('assistant_scene_draft_candidates')
    ) AS column_count,
    (
      SELECT COUNT(DISTINCT id)
      FROM pragma_foreign_key_list('assistant_scene_draft_candidates')
    ) AS foreign_key_count,
    (
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'index' AND name = 'assistant_scene_draft_work_plot_status_idx'
    ) AS index_count,
    (
      SELECT COUNT(*)
      FROM assistant_scene_draft_candidates
    ) AS candidate_count,
    (
      SELECT COUNT(*)
      FROM pragma_foreign_key_check
    ) AS foreign_key_violation_count
`;

const SCENE_DRAFT_MIGRATION_VERIFICATION_ROWS = Object.freeze([
  Object.freeze({
    column_count: 20,
    foreign_key_count: 4,
    index_count: 1,
    candidate_count: 0,
    foreign_key_violation_count: 0,
  }),
]);

const SCENE_DRAFT_LOGICAL_SNAPSHOT_QUERY = `
  SELECT
    'scene-music-queue' AS entity_kind,
    id,
    work_id,
    scene_key || char(31) || scene_annotation_id || char(31) ||
      scene_annotation_revision || char(31) || provider_id || char(31) ||
      query_text AS value_a,
    revision || char(31) || status || char(31) || options_json || char(31) ||
      COALESCE(selected_option_id, '') || char(31) || created_at || char(31) ||
      updated_at AS value_b
  FROM scene_music_queue_candidates
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

const SCENE_DRAFT_MIGRATION_DEFINITION = JSON.stringify({
  migrationId: SCENE_DRAFT_MIGRATION_ID,
  fromSchemaVersion: 11,
  toSchemaVersion: 12,
  statements: SCENE_DRAFT_MIGRATION_STATEMENTS,
  verification: {
    query: SCENE_DRAFT_MIGRATION_VERIFICATION_QUERY,
    expectedRows: SCENE_DRAFT_MIGRATION_VERIFICATION_ROWS,
  },
  logicalSnapshot: {
    scopeIdentity: "local-workspace-scene-draft-inputs-v11",
    query: SCENE_DRAFT_LOGICAL_SNAPSHOT_QUERY,
    verifyAfterChecksumOnNoOp: true,
  },
});

export const SCENE_DRAFT_MIGRATION_DEFINITION_BYTES = Buffer.from(
  SCENE_DRAFT_MIGRATION_DEFINITION,
  "utf8",
);

const SCENE_DRAFT_MIGRATION_DEFINITION_CHECKSUM =
  "4f7c92d2c447d1a066760d007f4f9cd6f01227161feb4389fefd9fae58c9bbfd";

const SCENE_DRAFT_MIGRATION_STEP: NodeSqliteMigrationCatalogStep = Object.freeze({
  migrationId: SCENE_DRAFT_MIGRATION_ID,
  fromSchemaVersion: 11,
  toSchemaVersion: 12,
  definitionBytes: SCENE_DRAFT_MIGRATION_DEFINITION_BYTES,
  expectedDefinitionChecksumValue: SCENE_DRAFT_MIGRATION_DEFINITION_CHECKSUM,
  statements: SCENE_DRAFT_MIGRATION_STATEMENTS,
  verification: Object.freeze({
    query: SCENE_DRAFT_MIGRATION_VERIFICATION_QUERY,
    expectedRows: SCENE_DRAFT_MIGRATION_VERIFICATION_ROWS,
  }),
  logicalSnapshot: Object.freeze({
    scopeIdentity: "local-workspace-scene-draft-inputs-v11",
    query: SCENE_DRAFT_LOGICAL_SNAPSHOT_QUERY,
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

export async function migrateLocalWorkspaceSceneDraftsIfNeeded(
  profile: Poc3StorageOpenProfile,
): Promise<boolean> {
  try {
    await access(profile.databasePath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  if (readExistingSchemaVersion(profile.databasePath) !== 11) return false;
  await runNodeSqliteStorageMigration({
    databasePath: profile.databasePath,
    requestedSettings: profile.requestedSettings,
    targetSchemaVersion: 12,
    catalog: [SCENE_DRAFT_MIGRATION_STEP],
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
