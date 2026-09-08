import type { ManuscriptFormattingProfile } from "../../../application/editor/manuscript-formatting";
import { parseManuscriptEditorDocumentState,serializeManuscriptEditorDocumentState } from "../../../application/editor/manuscript-formatting";
import type { ChangeBatch } from "../../../application/persistence/change-batch";
import type { RevisionSaveReceipt } from "../../../application/persistence/save-change-batch";
import type { EntityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readRequiredString } from "./scalars";

export type AcceptedBatch = {
  readonly batch: ChangeBatch;
  readonly receipt: RevisionSaveReceipt;
  readonly editorStateJson: string | undefined;
};

export const DOCUMENT_REVISION_ROWS_SQL = `
SELECT
  dr.id AS "revisionId",
  dr.work_id AS "workId",
  dr.document_id AS "documentId",
  dr.parent_revision_id AS "parentRevisionId",
  dr.length AS "length",
  dr.cause AS "cause",
  dr.created_at AS "createdAt",
  dr.durable_at AS "durableAt",
  CASE WHEN m.current_revision_id = dr.id THEN 1 ELSE 0 END AS "isCurrent"
FROM document_revisions AS dr
JOIN manuscripts AS m
  ON m.work_id = dr.work_id
  AND m.document_id = dr.document_id
WHERE dr.work_id = ? AND dr.document_id = ?
ORDER BY dr.created_at DESC, dr.id DESC
`;

export const WORK_SNAPSHOT_ROWS_SQL = `
SELECT
  ws.id AS "workSnapshotId",
  ws.work_id AS "workId",
  ws.label AS "label",
  ws.cause AS "cause",
  ws.manifest_hash AS "manifestHash",
  ws.created_at AS "createdAt",
  wsdr.document_id AS "documentId",
  wsdr.document_revision_id AS "documentRevisionId"
FROM work_snapshots AS ws
LEFT JOIN work_snapshot_document_revisions AS wsdr
  ON wsdr.work_id = ws.work_id
  AND wsdr.work_snapshot_id = ws.id
WHERE ws.work_id = ?
ORDER BY ws.created_at DESC, ws.id DESC, wsdr.document_id ASC
`;

export const WORK_STRUCTURE_REVISION_ROWS_SQL = `
SELECT 'Anchor' AS "entityKind", id AS "entityId", revision AS "revision"
FROM anchors
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'EventBlock', id, revision
FROM event_blocks
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'EventSource', id, revision
FROM event_sources
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'PlotEventLink', id, revision
FROM plot_event_links
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'RangeGroup', id, revision
FROM range_groups
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'SceneOverride', id, revision
FROM scene_overrides
WHERE work_id = ? AND retired_at IS NULL
ORDER BY "entityKind" ASC, "entityId" ASC
`;

export function shouldInsertBlobManifest(
  database: NodeSqliteDatabase,
  input: {
    readonly blobRef: string;
    readonly checksumIdentity: string;
    readonly checksumValue: string;
    readonly byteLength: number;
  },
): boolean {
  const rows = database
    .prepare(`
      SELECT
        checksum_identity AS "checksumIdentity",
        checksum_value AS "checksumValue",
        byte_length AS "byteLength"
      FROM blob_manifests
      WHERE blob_ref = ?
    `)
    .all(input.blobRef);
  if (rows.length === 0) {
    return true;
  }
  if (rows.length !== 1) {
    throw new Error(`Blob manifest identity is ambiguous: ${input.blobRef}`);
  }
  const row = rows[0] ?? {};
  if (
    row.checksumIdentity !== input.checksumIdentity ||
    row.checksumValue !== input.checksumValue ||
    row.byteLength !== input.byteLength
  ) {
    throw new Error(`Blob manifest content conflict: ${input.blobRef}`);
  }
  return false;
}

export function readRevisionEditorStateJson(
  database: NodeSqliteDatabase,
  input: {
    readonly revisionId: EntityId<"DocumentRevision">;
    readonly workId: EntityId<"Work">;
    readonly documentId: EntityId<"Document">;
  },
): string | undefined {
  const rows = database
    .prepare(`
      SELECT editor_state_json AS "editorStateJson"
      FROM document_revision_editor_states
      WHERE
        revision_id = ?
        AND work_id = ?
        AND document_id = ?
    `)
    .all(input.revisionId, input.workId, input.documentId);
  if (rows.length === 0) {
    return undefined;
  }
  if (rows.length !== 1) {
    throw new Error(
      `Editor state identity is ambiguous: ${input.revisionId}`,
    );
  }
  return readRequiredString(
    rows[0] ?? {},
    "editorStateJson",
    "Document revision editor state",
  );
}

export function canonicalizeEditorStateJson(
  editorStateJson: string,
  profile: ManuscriptFormattingProfile,
  textLength: number,
): string {
  return serializeManuscriptEditorDocumentState(
    parseManuscriptEditorDocumentState(
      JSON.parse(editorStateJson),
      profile,
      textLength,
    ),
  );
}

