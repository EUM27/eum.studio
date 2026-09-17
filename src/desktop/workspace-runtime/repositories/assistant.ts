import type { CharacterExtractionCandidate,CharacterExtractionParagraph,CharacterExtractionResult,RunCharacterExtractionCommand } from "../../../application/characters/character-extraction-contract";
import { parseCharacterExtractionCandidate } from "../../../application/characters/character-extraction-contract";
import type { CharacterGenerationCandidate,CharacterGenerationResult,RunCharacterGenerationCommand } from "../../../application/characters/character-generation-contract";
import { parseCharacterGenerationCandidate } from "../../../application/characters/character-generation-contract";
import type { RunSceneDraftCommand,RunSceneDraftResult,SceneDraftCandidate,SceneDraftContext } from "../../../application/structure/scene-draft-contract";
import { parseSceneDraftCandidate,parseSceneDraftContext } from "../../../application/structure/scene-draft-contract";
import type { RunSceneExtractionCommand,SceneExtractionCandidate,SceneExtractionParagraph,SceneExtractionResult } from "../../../application/structure/scene-extraction-contract";
import { parseSceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import type { CharacterExtractionExecution,CharacterGenerationExecution,SceneDraftExecution,SceneExtractionExecution } from "../contracts";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { readNullableString,readRequiredInteger,readRequiredString } from "./scalars";

export type StoredCharacterExtractionCandidateRow = {
  readonly requestId: EntityId<"CharacterExtractionRequest">;
  readonly candidate: CharacterExtractionCandidate;
};

export type StoredCharacterGenerationCandidateRow = {
  readonly requestId: EntityId<"CharacterGenerationRequest">;
  readonly candidate: CharacterGenerationCandidate;
};

export type StoredSceneExtractionCandidateRow = {
  readonly requestId: EntityId<"SceneExtractionRequest">;
  readonly candidate: SceneExtractionCandidate;
};

export type StoredSceneDraftCandidateRow = {
  readonly requestId: EntityId<"SceneDraftRequest">;
  readonly candidate: Omit<SceneDraftCandidate, "integrity">;
};

export type PreparedCharacterExtraction =
  | Readonly<{ result: CharacterExtractionResult }>
  | Readonly<{
      command: RunCharacterExtractionCommand;
      contextReceiptId: EntityId<"AssistantContextReceipt">;
      paragraphs: readonly CharacterExtractionParagraph[];
      execute: () => Promise<CharacterExtractionExecution>;
    }>;

export type PreparedCharacterGeneration =
  | Readonly<{ result: CharacterGenerationResult }>
  | Readonly<{
      command: RunCharacterGenerationCommand;
      execute: () => Promise<CharacterGenerationExecution>;
    }>;

export type PreparedSceneExtraction =
  | Readonly<{ result: SceneExtractionResult }>
  | Readonly<{
      command: RunSceneExtractionCommand;
      contextReceiptId: EntityId<"AssistantContextReceipt">;
      paragraphs: readonly SceneExtractionParagraph[];
      execute: () => Promise<SceneExtractionExecution>;
    }>;

export type PreparedSceneDraft =
  | Readonly<{ result: RunSceneDraftResult }>
  | Readonly<{
      command: RunSceneDraftCommand;
      context: SceneDraftContext;
      execute: () => Promise<SceneDraftExecution>;
    }>;

export const CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_from AS "sourceFrom",
  source_to AS "sourceTo",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  items_json AS "itemsJson",
  context_receipt_id AS "contextReceiptId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_character_extraction_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

export const CHARACTER_EXTRACTION_CANDIDATE_BY_ID_SQL = `
${CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

export const CHARACTER_GENERATION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  brief_json AS "briefJson",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  items_json AS "itemsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_character_generation_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

export const CHARACTER_GENERATION_CANDIDATE_BY_ID_SQL = `
${CHARACTER_GENERATION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

export const SCENE_EXTRACTION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_from AS "sourceFrom",
  source_to AS "sourceTo",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  scenes_json AS "scenesJson",
  boundaries_json AS "boundariesJson",
  context_receipt_id AS "contextReceiptId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_scene_extraction_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

export const SCENE_EXTRACTION_CANDIDATE_BY_ID_SQL = `
${SCENE_EXTRACTION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

export const SCENE_DRAFT_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  plot_thread_id AS "plotThreadId",
  plot_thread_revision AS "plotThreadRevision",
  target_document_id AS "targetDocumentId",
  target_document_revision_id AS "targetDocumentRevisionId",
  insertion_offset AS "insertionOffset",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  context_json AS "contextJson",
  generated_text AS "generatedText",
  draft_text AS "draftText",
  status AS "status",
  applied_document_revision_id AS "appliedDocumentRevisionId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_scene_draft_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

export const SCENE_DRAFT_CANDIDATE_BY_ID_SQL = `
${SCENE_DRAFT_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

export function parseStoredCharacterExtractionCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterExtractionCandidateRow {
  const itemsJson = readRequiredString(row, "itemsJson", label);
  const sourceRange = {
    documentId: readRequiredString(row, "sourceDocumentId", label),
    documentRevisionId: readRequiredString(
      row,
      "sourceDocumentRevisionId",
      label,
    ),
    from: readRequiredInteger(row, "sourceFrom", label),
    to: readRequiredInteger(row, "sourceTo", label),
  };
  return Object.freeze({
    requestId: entityId<"CharacterExtractionRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseCharacterExtractionCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      sourceRange,
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      items: JSON.parse(itemsJson),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

export function readStoredCharacterExtractionCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterExtractionCandidateRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterExtractionCandidateRow(
        row,
        `Character extraction Candidate rows[${index}]`,
      )),
  );
}

export function readStoredCharacterExtractionCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"CharacterExtractionCandidate">,
): StoredCharacterExtractionCandidateRow | null {
  const rows = database.prepare(
    CHARACTER_EXTRACTION_CANDIDATE_BY_ID_SQL,
  ).all(workId, candidateId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Character extraction Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredCharacterExtractionCandidateRow(
    rows[0] ?? {},
    "Character extraction Candidate lookup",
  );
}

export function parseStoredCharacterGenerationCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterGenerationCandidateRow {
  return Object.freeze({
    requestId: entityId<"CharacterGenerationRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseCharacterGenerationCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      brief: JSON.parse(readRequiredString(row, "briefJson", label)),
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      items: JSON.parse(readRequiredString(row, "itemsJson", label)),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

export function readStoredCharacterGenerationCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterGenerationCandidateRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_GENERATION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterGenerationCandidateRow(
        row,
        `Character generation Candidate rows[${index}]`,
      )),
  );
}

export function readStoredCharacterGenerationCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"CharacterGenerationCandidate">,
): StoredCharacterGenerationCandidateRow | null {
  const rows = database.prepare(
    CHARACTER_GENERATION_CANDIDATE_BY_ID_SQL,
  ).all(workId, candidateId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Character generation Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredCharacterGenerationCandidateRow(
    rows[0] ?? {},
    "Character generation Candidate lookup",
  );
}

export function parseStoredSceneExtractionCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneExtractionCandidateRow {
  return Object.freeze({
    requestId: entityId<"SceneExtractionRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseSceneExtractionCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      sourceRange: {
        documentId: readRequiredString(row, "sourceDocumentId", label),
        documentRevisionId: readRequiredString(
          row,
          "sourceDocumentRevisionId",
          label,
        ),
        from: readRequiredInteger(row, "sourceFrom", label),
        to: readRequiredInteger(row, "sourceTo", label),
      },
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      scenes: JSON.parse(readRequiredString(row, "scenesJson", label)),
      boundaries: JSON.parse(readRequiredString(row, "boundariesJson", label)),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

export function readStoredSceneExtractionCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneExtractionCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_EXTRACTION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneExtractionCandidateRow(
        row,
        `Scene extraction Candidate rows[${index}]`,
      )),
  );
}

export function readStoredSceneExtractionCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneExtractionCandidate">,
): StoredSceneExtractionCandidateRow | null {
  const rows = database.prepare(SCENE_EXTRACTION_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene extraction Candidate lookup is ambiguous: ${candidateId}`);
  }
  return parseStoredSceneExtractionCandidateRow(
    rows[0] ?? {},
    "Scene extraction Candidate lookup",
  );
}

export function parseStoredSceneDraftCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneDraftCandidateRow {
  const context = parseSceneDraftContext(
    JSON.parse(readRequiredString(row, "contextJson", label)),
  );
  const plotThreadId = entityId<"PlotThread">(
    readRequiredString(row, "plotThreadId", label),
  );
  const plotThreadRevision = readRequiredInteger(
    row,
    "plotThreadRevision",
    label,
  );
  if (
    context.plot.plotThreadId !== plotThreadId ||
    context.plot.revision !== plotThreadRevision
  ) {
    throw new Error(`${label} plot context does not match stored columns`);
  }
  const candidate = parseSceneDraftCandidate({
    schemaVersion: 1,
    candidateId: readRequiredString(row, "candidateId", label),
    revision: readRequiredInteger(row, "revision", label),
    workId: readRequiredString(row, "workId", label),
    context,
    target: {
      documentId: readRequiredString(row, "targetDocumentId", label),
      documentRevisionId: readRequiredString(
        row,
        "targetDocumentRevisionId",
        label,
      ),
      insertionOffset: readRequiredInteger(row, "insertionOffset", label),
    },
    providerId: readRequiredString(row, "providerId", label),
    modelId: readRequiredString(row, "modelId", label),
    promptVersion: readRequiredString(row, "promptVersion", label),
    generatedText: readRequiredString(row, "generatedText", label),
    draftText: readRequiredString(row, "draftText", label),
    status: readRequiredString(row, "status", label),
    integrity: "current",
    appliedDocumentRevisionId: readNullableString(
      row,
      "appliedDocumentRevisionId",
      label,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    requestId: entityId<"SceneDraftRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate,
  });
}

export function readStoredSceneDraftCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneDraftCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_DRAFT_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneDraftCandidateRow(
        row,
        `Scene draft Candidate rows[${index}]`,
      )),
  );
}

export function readStoredSceneDraftCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneDraftCandidate">,
): StoredSceneDraftCandidateRow | null {
  const rows = database.prepare(SCENE_DRAFT_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene draft Candidate lookup is ambiguous: ${candidateId}`);
  }
  return parseStoredSceneDraftCandidateRow(
    rows[0] ?? {},
    "Scene draft Candidate lookup",
  );
}

