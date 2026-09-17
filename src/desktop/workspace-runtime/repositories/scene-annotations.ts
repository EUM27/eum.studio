import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import { parseSceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { SceneMetadataBindingProjection } from "../../../application/structure/scene-metadata-binding-contract";
import { parseSceneMetadataBindingProjection } from "../../../application/structure/scene-metadata-binding-contract";
import type { EntityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableString,readRequiredInteger,readRequiredString,readString } from "./scalars";
import type { StoredSceneMetadataSourceRow } from "./scene-geometry";

export type StoredSceneAnnotationRow = SceneAnnotationProjection;

export const SCENE_ANNOTATION_ROWS_SQL = `
SELECT
  annotation.id AS "sceneAnnotationId",
  annotation.revision AS "revision",
  annotation.work_id AS "workId",
  annotation.scene_key AS "sceneKey",
  annotation.document_id AS "documentId",
  annotation.document_revision_id AS "documentRevisionId",
  annotation.source_candidate_id AS "sourceCandidateId",
  annotation.source_scene_item_id AS "sourceSceneItemId",
  annotation.title AS "title",
  annotation.summary AS "summary",
  annotation.pov_character_id AS "povCharacterId",
  annotation.location AS "location",
  annotation.time AS "time",
  annotation.character_ids_json AS "characterIdsJson",
  annotation.goal AS "goal",
  annotation.conflict AS "conflict",
  annotation.outcome AS "outcome",
  annotation.created_at AS "createdAt",
  annotation.updated_at AS "updatedAt",
  binding.id AS "bindingId",
  binding.revision AS "bindingRevision",
  binding.source_scene_key AS "bindingSourceSceneKey",
  binding.scene_id AS "bindingSceneId",
  binding.status AS "bindingStatus",
  binding.proposed_scene_id AS "bindingProposedSceneId",
  binding.lineage_operation_id AS "bindingLineageOperationId",
  binding.created_at AS "bindingCreatedAt",
  binding.updated_at AS "bindingUpdatedAt"
FROM scene_annotations AS annotation
JOIN scene_metadata_bindings AS binding
  ON binding.work_id = annotation.work_id
  AND binding.metadata_kind = 'annotation'
  AND binding.metadata_id = annotation.id
  AND binding.retired_at IS NULL
WHERE annotation.work_id = ?
ORDER BY annotation.updated_at DESC, annotation.id ASC
`;

export const SCENE_ANNOTATION_BY_KEY_SQL = `
${SCENE_ANNOTATION_ROWS_SQL.replace(
  "WHERE annotation.work_id = ?",
  "WHERE annotation.work_id = ? AND annotation.scene_key = ?",
)}
`;

export function parseJoinedSceneMetadataBinding(
  row: Record<string, unknown>,
  label: string,
  metadataKind: StoredSceneMetadataSourceRow["metadataKind"],
  metadataId: string,
  workId: string,
  sourceSceneKey: string,
): SceneMetadataBindingProjection {
  const status = readRequiredString(row, "bindingStatus", label);
  if (
    status !== "current" &&
    status !== "needs-review" &&
    status !== "detached"
  ) {
    throw new Error(`${label}.bindingStatus is invalid`);
  }
  return parseSceneMetadataBindingProjection({
    schemaVersion: 1,
    sceneMetadataBindingId: readRequiredString(row, "bindingId", label),
    revision: readRequiredInteger(row, "bindingRevision", label),
    workId,
    metadataKind,
    metadataId,
    sourceSceneKey,
    sceneId: readNullableString(row, "bindingSceneId", label),
    status: status === "needs-review" ? "needsReview" : status,
    proposedSceneId: readNullableString(
      row,
      "bindingProposedSceneId",
      label,
    ),
    lineageOperationId: readNullableString(
      row,
      "bindingLineageOperationId",
      label,
    ),
    createdAt: readRequiredString(row, "bindingCreatedAt", label),
    updatedAt: readRequiredString(row, "bindingUpdatedAt", label),
  });
}

export function parseStoredSceneAnnotationRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneAnnotationRow {
  const sceneAnnotationId = readRequiredString(row, "sceneAnnotationId", label);
  const workId = readRequiredString(row, "workId", label);
  const sceneKey = readRequiredString(row, "sceneKey", label);
  return parseSceneAnnotationProjection({
    schemaVersion: 1,
    sceneAnnotationId,
    revision: readRequiredInteger(row, "revision", label),
    workId,
    sceneKey,
    binding: parseJoinedSceneMetadataBinding(
      row,
      label,
      "annotation",
      sceneAnnotationId,
      workId,
      sceneKey,
    ),
    documentId: readRequiredString(row, "documentId", label),
    documentRevisionId: readRequiredString(row, "documentRevisionId", label),
    sourceCandidateId: readRequiredString(row, "sourceCandidateId", label),
    sourceSceneItemId: readRequiredString(row, "sourceSceneItemId", label),
    title: readRequiredString(row, "title", label),
    summary: readString(row, "summary", label),
    povCharacterId: readNullableString(row, "povCharacterId", label),
    location: readString(row, "location", label),
    time: readString(row, "time", label),
    characterIds: JSON.parse(
      readRequiredString(row, "characterIdsJson", label),
    ),
    goal: readString(row, "goal", label),
    conflict: readString(row, "conflict", label),
    outcome: readString(row, "outcome", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

export function readStoredSceneAnnotationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneAnnotationRow[] {
  return Object.freeze(
    database.prepare(SCENE_ANNOTATION_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneAnnotationRow(
        row,
        `Scene annotation rows[${index}]`,
      )),
  );
}

export function readStoredSceneAnnotationRowByKey(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  sceneKey: string,
): StoredSceneAnnotationRow | null {
  const rows = database.prepare(SCENE_ANNOTATION_BY_KEY_SQL).all(
    workId,
    sceneKey,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene annotation lookup is ambiguous: ${sceneKey}`);
  }
  return parseStoredSceneAnnotationRow(
    rows[0] ?? {},
    "Scene annotation lookup",
  );
}

