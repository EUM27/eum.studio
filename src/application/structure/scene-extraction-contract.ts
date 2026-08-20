import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseSceneProjectionList,
  type SceneProjectionList,
} from "./scene-projection";
import {
  parseSceneAnnotationList,
  type SceneAnnotationList,
} from "./scene-annotation-contract";

export const SCENE_EXTRACTION_PROMPT_VERSION = "scene-extraction-v1" as const;

export type RunSceneExtractionCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"SceneExtractionRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly sourceRange: AssistantContextRange;
};

export type ListSceneExtractionCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SceneExtractionParagraph = {
  readonly paragraphId: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
};

export type SceneExtractionModelScene = {
  readonly title: string;
  readonly fromParagraphId: string;
  readonly toParagraphId: string;
  readonly summary: string;
  readonly povCharacter: string;
  readonly location: string;
  readonly time: string;
  readonly characters: readonly string[];
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
};

export type SceneExtractionModelPayload = {
  readonly scenes: readonly SceneExtractionModelScene[];
};

export type SceneExtractionScene = {
  readonly sceneItemId: EntityId<"SceneExtractionItem">;
  readonly title: string;
  readonly fromParagraphId: string;
  readonly toParagraphId: string;
  readonly range: Readonly<{
    documentId: EntityId<"Document">;
    documentRevisionId: EntityId<"DocumentRevision">;
    from: number;
    to: number;
  }>;
  readonly summary: string;
  readonly povCharacterId: EntityId<"Character"> | null;
  readonly location: string;
  readonly time: string;
  readonly characterIds: readonly EntityId<"Character">[];
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
  readonly annotationStatus: "pending" | "approved" | "excluded";
  readonly sceneAnnotationId: EntityId<"SceneAnnotation"> | null;
};

export type SceneExtractionBoundary = {
  readonly boundaryId: EntityId<"SceneExtractionBoundary">;
  readonly fromSceneItemId: EntityId<"SceneExtractionItem">;
  readonly toSceneItemId: EntityId<"SceneExtractionItem">;
  readonly offset: number;
  readonly status: "pending" | "accepted" | "excluded";
  readonly sceneOverrideId: EntityId<"SceneOverride"> | null;
};

export type SceneExtractionCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"SceneExtractionCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceRange: AssistantContextRange;
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: typeof SCENE_EXTRACTION_PROMPT_VERSION;
  readonly status: "ready" | "stale" | "completed";
  readonly scenes: readonly SceneExtractionScene[];
  readonly boundaries: readonly SceneExtractionBoundary[];
  readonly contextReceiptId: EntityId<"AssistantContextReceipt">;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SceneExtractionCandidateList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly SceneExtractionCandidate[];
};

export type DecideSceneExtractionBoundaryCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneExtractionCandidate">;
  readonly expectedCandidateRevision: number;
  readonly boundaryId: EntityId<"SceneExtractionBoundary">;
  readonly decision: "accept" | "exclude";
};

export type SceneExtractionAnnotationDecision =
  | Readonly<{
      kind: "accept";
      sceneKey: string;
      expectedAnnotationRevision: number | null;
    }>
  | Readonly<{ kind: "exclude" }>;

export type DecideSceneExtractionAnnotationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneExtractionCandidate">;
  readonly expectedCandidateRevision: number;
  readonly sceneItemId: EntityId<"SceneExtractionItem">;
  readonly decision: SceneExtractionAnnotationDecision;
};

export type SceneExtractionDecisionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "applied";
      candidate: SceneExtractionCandidate;
      sceneProjection: SceneProjectionList;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "stale";
      candidate: SceneExtractionCandidate;
    }>;

export type SceneExtractionAnnotationDecisionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "applied";
      candidate: SceneExtractionCandidate;
      annotations: SceneAnnotationList;
      sceneProjection: SceneProjectionList;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "stale";
      candidate: SceneExtractionCandidate;
    }>;

export type SceneExtractionResult =
  | Readonly<{ schemaVersion: 1; status: "login-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
      destinationId: string;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "context-rejected";
      reason:
        | "source-unavailable"
        | "outside-work"
        | "stale-context"
        | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: SceneExtractionCandidate;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string) {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string) {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function text(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function nonEmpty(input: Record<string, unknown>, field: string, label: string): string {
  const value = text(input, field, label).trim();
  if (!value) throw new Error(`${label}.${field} must be non-empty`);
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(input, field, label));
}

function integer(
  input: Record<string, unknown>,
  field: string,
  label: string,
  minimum = 0,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label}.${field} must be an integer >= ${minimum}`);
  }
  return value;
}

function instant(input: Record<string, unknown>, field: string, label: string): string {
  return nonEmpty(input, field, label);
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const items = value.map((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(`${label}[${index}] must be non-empty`);
    }
    return entry.trim();
  });
  if (new Set(items).size !== items.length) throw new Error(`${label} has duplicates`);
  return Object.freeze(items);
}

function parseModelScene(value: unknown, label: string): SceneExtractionModelScene {
  const input = record(value, label);
  exact(input, [
    "title",
    "fromParagraphId",
    "toParagraphId",
    "summary",
    "povCharacter",
    "location",
    "time",
    "characters",
    "goal",
    "conflict",
    "outcome",
  ], label);
  return Object.freeze({
    title: nonEmpty(input, "title", label),
    fromParagraphId: nonEmpty(input, "fromParagraphId", label),
    toParagraphId: nonEmpty(input, "toParagraphId", label),
    summary: text(input, "summary", label),
    povCharacter: text(input, "povCharacter", label),
    location: text(input, "location", label),
    time: text(input, "time", label),
    characters: stringArray(input.characters, `${label}.characters`),
    goal: text(input, "goal", label),
    conflict: text(input, "conflict", label),
    outcome: text(input, "outcome", label),
  });
}

export function parseSceneExtractionModelPayload(
  value: unknown,
): SceneExtractionModelPayload {
  const label = "SceneExtractionModelPayload";
  const input = record(value, label);
  exact(input, ["scenes"], label);
  if (!Array.isArray(input.scenes)) throw new Error(`${label}.scenes must be an array`);
  return Object.freeze({
    scenes: Object.freeze(input.scenes.map((scene, index) =>
      parseModelScene(scene, `${label}.scenes[${index}]`)
    )),
  });
}

export function createSceneExtractionParagraphs(input: {
  readonly sourceRange: AssistantContextRange;
  readonly manuscript: string;
}): readonly SceneExtractionParagraph[] {
  const paragraphs: SceneExtractionParagraph[] = [];
  const pattern = /[^\n]*(?:\n|$)/gu;
  for (const match of input.manuscript.matchAll(pattern)) {
    const raw = match[0] ?? "";
    const paragraphText = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
    if (paragraphText.length === 0 && match.index === input.manuscript.length) break;
    const relativeFrom = match.index ?? 0;
    paragraphs.push(Object.freeze({
      paragraphId: `p${paragraphs.length + 1}`,
      from: input.sourceRange.from + relativeFrom,
      to: input.sourceRange.from + relativeFrom + paragraphText.length,
      text: paragraphText,
    }));
  }
  return Object.freeze(paragraphs);
}

export function resolveSceneExtractionModelScenes(input: {
  readonly sourceRange: AssistantContextRange;
  readonly paragraphs: readonly SceneExtractionParagraph[];
  readonly payload: SceneExtractionModelPayload;
}): readonly Readonly<{
  proposal: SceneExtractionModelScene;
  range: SceneExtractionScene["range"];
}>[] {
  let previousEndIndex = -1;
  return Object.freeze(input.payload.scenes.map((proposal, index) => {
    const fromIndex = input.paragraphs.findIndex(
      (paragraph) => paragraph.paragraphId === proposal.fromParagraphId,
    );
    const toIndex = input.paragraphs.findIndex(
      (paragraph) => paragraph.paragraphId === proposal.toParagraphId,
    );
    if (fromIndex < 0 || toIndex < fromIndex) {
      throw new Error(`Scene extraction scene[${index}] has invalid paragraph references`);
    }
    if (fromIndex <= previousEndIndex) {
      throw new Error(`Scene extraction scene[${index}] overlaps a previous scene`);
    }
    previousEndIndex = toIndex;
    const from = input.paragraphs[fromIndex]!;
    const to = input.paragraphs[toIndex]!;
    return Object.freeze({
      proposal,
      range: Object.freeze({
        documentId: input.sourceRange.documentId,
        documentRevisionId: input.sourceRange.documentRevisionId,
        from: from.from,
        to: to.to,
      }),
    });
  }));
}

function parseScene(value: unknown, label: string): SceneExtractionScene {
  const input = record(value, label);
  exact(input, [
    "sceneItemId", "title", "fromParagraphId", "toParagraphId", "range",
    "summary", "povCharacterId", "location", "time", "characterIds",
    "goal", "conflict", "outcome", "annotationStatus", "sceneAnnotationId",
  ], label);
  const range = parseAssistantContextRange(input.range, `${label}.range`);
  if (!Array.isArray(input.characterIds)) throw new Error(`${label}.characterIds must be an array`);
  const rawCharacterIds = input.characterIds;
  const characterIds = Object.freeze(rawCharacterIds.map((value, index) =>
    id<"Character">({ value }, "value", `${label}.characterIds[${index}]`)
  ));
  if (
    input.annotationStatus !== "pending" &&
    input.annotationStatus !== "approved" &&
    input.annotationStatus !== "excluded"
  ) {
    throw new Error(`${label}.annotationStatus is unsupported`);
  }
  const sceneAnnotationId = input.sceneAnnotationId === null
    ? null
    : id<"SceneAnnotation">(input, "sceneAnnotationId", label);
  if ((input.annotationStatus === "approved") !== (sceneAnnotationId !== null)) {
    throw new Error(`${label}.sceneAnnotationId does not match status`);
  }
  return Object.freeze({
    sceneItemId: id<"SceneExtractionItem">(input, "sceneItemId", label),
    title: nonEmpty(input, "title", label),
    fromParagraphId: nonEmpty(input, "fromParagraphId", label),
    toParagraphId: nonEmpty(input, "toParagraphId", label),
    range,
    summary: text(input, "summary", label),
    povCharacterId: input.povCharacterId === null
      ? null
      : id<"Character">(input, "povCharacterId", label),
    location: text(input, "location", label),
    time: text(input, "time", label),
    characterIds,
    goal: text(input, "goal", label),
    conflict: text(input, "conflict", label),
    outcome: text(input, "outcome", label),
    annotationStatus: input.annotationStatus,
    sceneAnnotationId,
  });
}

function parseBoundary(value: unknown, label: string): SceneExtractionBoundary {
  const input = record(value, label);
  exact(input, [
    "boundaryId", "fromSceneItemId", "toSceneItemId", "offset", "status",
    "sceneOverrideId",
  ], label);
  if (input.status !== "pending" && input.status !== "accepted" && input.status !== "excluded") {
    throw new Error(`${label}.status is unsupported`);
  }
  const sceneOverrideId = input.sceneOverrideId === null
    ? null
    : id<"SceneOverride">(input, "sceneOverrideId", label);
  if ((input.status === "accepted") !== (sceneOverrideId !== null)) {
    throw new Error(`${label}.sceneOverrideId does not match status`);
  }
  return Object.freeze({
    boundaryId: id<"SceneExtractionBoundary">(input, "boundaryId", label),
    fromSceneItemId: id<"SceneExtractionItem">(input, "fromSceneItemId", label),
    toSceneItemId: id<"SceneExtractionItem">(input, "toSceneItemId", label),
    offset: integer(input, "offset", label),
    status: input.status,
    sceneOverrideId,
  });
}

export function parseSceneExtractionCandidate(value: unknown): SceneExtractionCandidate {
  const label = "SceneExtractionCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "candidateId", "revision", "workId", "sourceRange",
    "providerId", "modelId", "promptVersion", "status", "scenes", "boundaries",
    "contextReceiptId", "createdAt", "updatedAt",
  ], label);
  schema(input, label);
  if (input.promptVersion !== SCENE_EXTRACTION_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  if (input.status !== "ready" && input.status !== "stale" && input.status !== "completed") {
    throw new Error(`${label}.status is unsupported`);
  }
  if (!Array.isArray(input.scenes) || !Array.isArray(input.boundaries)) {
    throw new Error(`${label} scene fields must be arrays`);
  }
  const scenes = Object.freeze(input.scenes.map((scene, index) =>
    parseScene(scene, `${label}.scenes[${index}]`)
  ));
  const sceneIds = new Set(scenes.map((scene) => scene.sceneItemId));
  const boundaries = Object.freeze(input.boundaries.map((boundary, index) => {
    const parsed = parseBoundary(boundary, `${label}.boundaries[${index}]`);
    if (!sceneIds.has(parsed.fromSceneItemId) || !sceneIds.has(parsed.toSceneItemId)) {
      throw new Error(`${label}.boundaries[${index}] references an unknown scene`);
    }
    return parsed;
  }));
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"SceneExtractionCandidate">(input, "candidateId", label),
    revision: integer(input, "revision", label, 1),
    workId: id<"Work">(input, "workId", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    providerId: nonEmpty(input, "providerId", label),
    modelId: nonEmpty(input, "modelId", label),
    promptVersion: SCENE_EXTRACTION_PROMPT_VERSION,
    status: input.status,
    scenes,
    boundaries,
    contextReceiptId: id<"AssistantContextReceipt">(input, "contextReceiptId", label),
    createdAt: instant(input, "createdAt", label),
    updatedAt: instant(input, "updatedAt", label),
  });
}

export function parseRunSceneExtractionCommand(value: unknown): RunSceneExtractionCommand {
  const label = "RunSceneExtractionCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "conversationId", "sourceRange"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"SceneExtractionRequest">(input, "requestId", label),
    workId: id<"Work">(input, "workId", label),
    conversationId: id<"AssistantConversation">(input, "conversationId", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
  });
}

export function parseListSceneExtractionCandidatesCommand(
  value: unknown,
): ListSceneExtractionCandidatesCommand {
  const label = "ListSceneExtractionCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1, workId: id<"Work">(input, "workId", label) });
}

export function parseDecideSceneExtractionBoundaryCommand(
  value: unknown,
): DecideSceneExtractionBoundaryCommand {
  const label = "DecideSceneExtractionBoundaryCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
    "boundaryId", "decision",
  ], label);
  schema(input, label);
  if (input.decision !== "accept" && input.decision !== "exclude") {
    throw new Error(`${label}.decision is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    candidateId: id<"SceneExtractionCandidate">(input, "candidateId", label),
    expectedCandidateRevision: integer(input, "expectedCandidateRevision", label, 1),
    boundaryId: id<"SceneExtractionBoundary">(input, "boundaryId", label),
    decision: input.decision,
  });
}

export function parseDecideSceneExtractionAnnotationCommand(
  value: unknown,
): DecideSceneExtractionAnnotationCommand {
  const label = "DecideSceneExtractionAnnotationCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
    "sceneItemId", "decision",
  ], label);
  schema(input, label);
  const rawDecision = record(input.decision, `${label}.decision`);
  let decision: SceneExtractionAnnotationDecision;
  if (rawDecision.kind === "exclude") {
    exact(rawDecision, ["kind"], `${label}.decision`);
    decision = Object.freeze({ kind: "exclude" });
  } else if (rawDecision.kind === "accept") {
    exact(
      rawDecision,
      ["kind", "sceneKey", "expectedAnnotationRevision"],
      `${label}.decision`,
    );
    const expectedAnnotationRevision = rawDecision.expectedAnnotationRevision === null
      ? null
      : integer(
          rawDecision,
          "expectedAnnotationRevision",
          `${label}.decision`,
          1,
        );
    decision = Object.freeze({
      kind: "accept",
      sceneKey: nonEmpty(rawDecision, "sceneKey", `${label}.decision`),
      expectedAnnotationRevision,
    });
  } else {
    throw new Error(`${label}.decision.kind is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    candidateId: id<"SceneExtractionCandidate">(
      input,
      "candidateId",
      label,
    ),
    expectedCandidateRevision: integer(
      input,
      "expectedCandidateRevision",
      label,
      1,
    ),
    sceneItemId: id<"SceneExtractionItem">(input, "sceneItemId", label),
    decision,
  });
}

export function parseSceneExtractionCandidateList(
  value: unknown,
): SceneExtractionCandidateList {
  const label = "SceneExtractionCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) throw new Error(`${label}.candidates must be an array`);
  const workId = id<"Work">(input, "workId", label);
  const candidates = Object.freeze(input.candidates.map((candidate, index) => {
    const parsed = parseSceneExtractionCandidate(candidate);
    if (parsed.workId !== workId) throw new Error(`${label}.candidates[${index}] is outside Work`);
    return parsed;
  }));
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseSceneExtractionResult(value: unknown): SceneExtractionResult {
  const label = "SceneExtractionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "login-required") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "login-required" });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing", "destinationId"], label);
    if (!Array.isArray(input.missing)) throw new Error(`${label}.missing must be an array`);
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing: Object.freeze(input.missing as AssistantContextPermissionMissing[]),
      destinationId: nonEmpty(input, "destinationId", label),
    });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
    if (
      input.reason !== "source-unavailable" && input.reason !== "outside-work" &&
      input.reason !== "stale-context" && input.reason !== "invalid-range"
    ) throw new Error(`${label}.reason is unsupported`);
    return Object.freeze({
      schemaVersion: 1,
      status: "context-rejected",
      reason: input.reason,
      documentId: id<"Document">(input, "documentId", label),
    });
  }
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseSceneExtractionCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseSceneExtractionDecisionResult(
  value: unknown,
): SceneExtractionDecisionResult {
  const label = "SceneExtractionDecisionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "stale") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "stale",
      candidate: parseSceneExtractionCandidate(input.candidate),
    });
  }
  if (input.status === "applied") {
    exact(input, ["schemaVersion", "status", "candidate", "sceneProjection"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "applied",
      candidate: parseSceneExtractionCandidate(input.candidate),
      sceneProjection: parseSceneProjectionList(input.sceneProjection),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseSceneExtractionAnnotationDecisionResult(
  value: unknown,
): SceneExtractionAnnotationDecisionResult {
  const label = "SceneExtractionAnnotationDecisionResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "stale") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "stale",
      candidate: parseSceneExtractionCandidate(input.candidate),
    });
  }
  if (input.status === "applied") {
    exact(
      input,
      [
        "schemaVersion", "status", "candidate", "annotations",
        "sceneProjection",
      ],
      label,
    );
    return Object.freeze({
      schemaVersion: 1,
      status: "applied",
      candidate: parseSceneExtractionCandidate(input.candidate),
      annotations: parseSceneAnnotationList(input.annotations),
      sceneProjection: parseSceneProjectionList(input.sceneProjection),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}
