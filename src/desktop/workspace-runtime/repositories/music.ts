import type { SceneMusicQueueCandidate,SceneMusicQueueSearchResult,SearchSceneMusicQueuesCommand } from "../../../application/music/scene-music-queue-contract";
import { parseSceneMusicQueueCandidate } from "../../../application/music/scene-music-queue-contract";
import type { YouTubeVideoProjection } from "../../../application/music/youtube-music";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { EntityId } from "../../../domain/writing";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableString,readRequiredInteger,readRequiredString } from "./scalars";
import { parseJoinedSceneMetadataBinding } from "./scene-annotations";

export type StoredSceneMusicQueueCandidateRow = Omit<
  SceneMusicQueueCandidate,
  "integrity"
>;

export type PreparedSceneMusicQueueSearch =
  | Readonly<{ result: SceneMusicQueueSearchResult }>
  | Readonly<{
      command: SearchSceneMusicQueuesCommand;
      sceneAnnotation: SceneAnnotationProjection;
      execute: () => Promise<readonly YouTubeVideoProjection[]>;
    }>;

export const SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL = `
SELECT
  candidate.id AS "candidateId",
  candidate.request_id AS "requestId",
  candidate.revision AS "revision",
  candidate.work_id AS "workId",
  candidate.scene_key AS "sceneKey",
  candidate.scene_annotation_id AS "sceneAnnotationId",
  candidate.scene_annotation_revision AS "sceneAnnotationRevision",
  candidate.provider_id AS "providerId",
  candidate.query_text AS "query",
  candidate.status AS "status",
  candidate.options_json AS "optionsJson",
  candidate.selected_option_id AS "selectedOptionId",
  candidate.created_at AS "createdAt",
  candidate.updated_at AS "updatedAt",
  binding.id AS "bindingId",
  binding.revision AS "bindingRevision",
  binding.source_scene_key AS "bindingSourceSceneKey",
  binding.scene_id AS "bindingSceneId",
  binding.status AS "bindingStatus",
  binding.proposed_scene_id AS "bindingProposedSceneId",
  binding.lineage_operation_id AS "bindingLineageOperationId",
  binding.created_at AS "bindingCreatedAt",
  binding.updated_at AS "bindingUpdatedAt"
FROM scene_music_queue_candidates AS candidate
JOIN scene_metadata_bindings AS binding
  ON binding.work_id = candidate.work_id
  AND binding.metadata_kind = 'music-queue'
  AND binding.metadata_id = candidate.id
  AND binding.retired_at IS NULL
WHERE candidate.work_id = ?
ORDER BY candidate.updated_at DESC, candidate.id DESC
`;

export const SCENE_MUSIC_QUEUE_CANDIDATE_BY_ID_SQL = `
${SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL.replace(
  "WHERE candidate.work_id = ?",
  "WHERE candidate.work_id = ? AND candidate.id = ?",
)}
`;

export function parseStoredSceneMusicQueueCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneMusicQueueCandidateRow {
  const candidateId = readRequiredString(row, "candidateId", label);
  const workId = readRequiredString(row, "workId", label);
  const sceneKey = readRequiredString(row, "sceneKey", label);
  return parseSceneMusicQueueCandidate({
    schemaVersion: 1,
    candidateId,
    revision: readRequiredInteger(row, "revision", label),
    workId,
    sceneKey,
    binding: parseJoinedSceneMetadataBinding(
      row,
      label,
      "music-queue",
      candidateId,
      workId,
      sceneKey,
    ),
    sceneAnnotationId: readRequiredString(row, "sceneAnnotationId", label),
    sceneAnnotationRevision: readRequiredInteger(
      row,
      "sceneAnnotationRevision",
      label,
    ),
    providerId: readRequiredString(row, "providerId", label),
    query: readRequiredString(row, "query", label),
    status: readRequiredString(row, "status", label),
    integrity: "current",
    options: JSON.parse(readRequiredString(row, "optionsJson", label)),
    selectedOptionId: readNullableString(row, "selectedOptionId", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

export function readStoredSceneMusicQueueCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneMusicQueueCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneMusicQueueCandidateRow(
        row,
        `Scene music queue Candidate rows[${index}]`,
      )),
  );
}

export function readStoredSceneMusicQueueCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneMusicQueueCandidate">,
): StoredSceneMusicQueueCandidateRow | null {
  const rows = database.prepare(SCENE_MUSIC_QUEUE_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Scene music queue Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredSceneMusicQueueCandidateRow(
    rows[0] ?? {},
    "Scene music queue Candidate lookup",
  );
}

