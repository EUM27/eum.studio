import { entityId, type EntityId } from "../../domain/writing";
import {
  parseSceneMetadataBindingProjection,
  type SceneMetadataBindingProjection,
} from "../structure/scene-metadata-binding-contract";
import {
  parseYouTubeVideoProjection,
  type YouTubeVideoProjection,
} from "./youtube-music";

export type SceneMusicQueueOption = {
  readonly optionId: EntityId<"SceneMusicQueueOption">;
  readonly tracks: readonly YouTubeVideoProjection[];
};

export type SceneMusicQueueCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"SceneMusicQueueCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly binding: SceneMetadataBindingProjection;
  readonly sceneAnnotationId: EntityId<"SceneAnnotation">;
  readonly sceneAnnotationRevision: number;
  readonly providerId: string;
  readonly query: string;
  readonly status: "ready" | "selected" | "superseded";
  readonly integrity: "current" | "stale";
  readonly options: readonly SceneMusicQueueOption[];
  readonly selectedOptionId: EntityId<"SceneMusicQueueOption"> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SearchSceneMusicQueuesCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"SceneMusicQueueRequest">;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly expectedAnnotationRevision: number;
  readonly query: string;
};

export type ListSceneMusicQueueCandidatesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SelectSceneMusicQueueCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidateId: EntityId<"SceneMusicQueueCandidate">;
  readonly expectedCandidateRevision: number;
  readonly optionId: EntityId<"SceneMusicQueueOption">;
};

export type SceneMusicQueueCandidateList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly candidates: readonly SceneMusicQueueCandidate[];
};

export type SceneMusicQueueSearchResult =
  | Readonly<{ schemaVersion: 1; status: "connection-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: SceneMusicQueueCandidate;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function id<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(value, label));
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function instant(value: unknown, label: string): string {
  const parsed = nonEmpty(value, label);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new Error(`${label} must be a valid instant`);
  }
  return parsed;
}

function parseOption(value: unknown, label: string): SceneMusicQueueOption {
  const input = record(value, label);
  exact(input, ["optionId", "tracks"], label);
  if (!Array.isArray(input.tracks) || input.tracks.length === 0) {
    throw new Error(`${label}.tracks must be a non-empty array`);
  }
  const tracks = Object.freeze(input.tracks.map((entry, index) => {
    return parseYouTubeVideoProjection(entry, `${label}.tracks[${index}]`);
  }));
  if (new Set(tracks.map((track) => track.videoId)).size !== tracks.length) {
    throw new Error(`${label}.tracks contain duplicate video identities`);
  }
  return Object.freeze({
    optionId: id<"SceneMusicQueueOption">(
      input.optionId,
      `${label}.optionId`,
    ),
    tracks,
  });
}

export function parseSceneMusicQueueCandidate(
  value: unknown,
): SceneMusicQueueCandidate {
  const label = "SceneMusicQueueCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "candidateId", "revision", "workId", "sceneKey", "binding",
    "sceneAnnotationId", "sceneAnnotationRevision", "providerId", "query",
    "status", "integrity", "options", "selectedOptionId", "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (
    input.status !== "ready" &&
    input.status !== "selected" &&
    input.status !== "superseded"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  if (input.integrity !== "current" && input.integrity !== "stale") {
    throw new Error(`${label}.integrity is unsupported`);
  }
  if (!Array.isArray(input.options)) {
    throw new Error(`${label}.options must be an array`);
  }
  const options = Object.freeze(
    input.options.map((entry, index) =>
      parseOption(entry, `${label}.options[${index}]`)
    ),
  );
  if (new Set(options.map((option) => option.optionId)).size !== options.length) {
    throw new Error(`${label}.options contain duplicate identities`);
  }
  const selectedOptionId = input.selectedOptionId === null
    ? null
    : id<"SceneMusicQueueOption">(
        input.selectedOptionId,
        `${label}.selectedOptionId`,
      );
  if (
    (input.status === "ready") !== (selectedOptionId === null) ||
    (selectedOptionId !== null &&
      !options.some((option) => option.optionId === selectedOptionId))
  ) {
    throw new Error(`${label}.selectedOptionId does not match status`);
  }
  const candidateId = id<"SceneMusicQueueCandidate">(
    input.candidateId,
    `${label}.candidateId`,
  );
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const sceneKey = nonEmpty(input.sceneKey, `${label}.sceneKey`);
  const binding = parseSceneMetadataBindingProjection(input.binding);
  if (
    binding.workId !== workId ||
    binding.metadataKind !== "music-queue" ||
    binding.metadataId !== candidateId ||
    binding.sourceSceneKey !== sceneKey
  ) {
    throw new Error(`${label}.binding does not match the music Candidate`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId,
    revision: positiveInteger(input.revision, `${label}.revision`),
    workId,
    sceneKey,
    binding,
    sceneAnnotationId: id<"SceneAnnotation">(
      input.sceneAnnotationId,
      `${label}.sceneAnnotationId`,
    ),
    sceneAnnotationRevision: positiveInteger(
      input.sceneAnnotationRevision,
      `${label}.sceneAnnotationRevision`,
    ),
    providerId: nonEmpty(input.providerId, `${label}.providerId`),
    query: nonEmpty(input.query, `${label}.query`),
    status: input.status,
    integrity: input.integrity,
    options,
    selectedOptionId,
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseSearchSceneMusicQueuesCommand(
  value: unknown,
): SearchSceneMusicQueuesCommand {
  const label = "SearchSceneMusicQueuesCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "requestId", "workId", "sceneKey",
    "expectedAnnotationRevision", "query",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"SceneMusicQueueRequest">(
      input.requestId,
      `${label}.requestId`,
    ),
    workId: id<"Work">(input.workId, `${label}.workId`),
    sceneKey: nonEmpty(input.sceneKey, `${label}.sceneKey`),
    expectedAnnotationRevision: positiveInteger(
      input.expectedAnnotationRevision,
      `${label}.expectedAnnotationRevision`,
    ),
    query: nonEmpty(input.query, `${label}.query`),
  });
}

export function parseListSceneMusicQueueCandidatesCommand(
  value: unknown,
): ListSceneMusicQueueCandidatesCommand {
  const label = "ListSceneMusicQueueCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
  });
}

export function parseSelectSceneMusicQueueCommand(
  value: unknown,
): SelectSceneMusicQueueCommand {
  const label = "SelectSceneMusicQueueCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "workId", "candidateId", "expectedCandidateRevision",
    "optionId",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    candidateId: id<"SceneMusicQueueCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    expectedCandidateRevision: positiveInteger(
      input.expectedCandidateRevision,
      `${label}.expectedCandidateRevision`,
    ),
    optionId: id<"SceneMusicQueueOption">(
      input.optionId,
      `${label}.optionId`,
    ),
  });
}

export function parseSceneMusicQueueCandidateList(
  value: unknown,
): SceneMusicQueueCandidateList {
  const label = "SceneMusicQueueCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const candidates = Object.freeze(
    input.candidates.map((entry) => parseSceneMusicQueueCandidate(entry)),
  );
  if (candidates.some((candidate) => candidate.workId !== workId)) {
    throw new Error(`${label}.candidates cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseSceneMusicQueueSearchResult(
  value: unknown,
): SceneMusicQueueSearchResult {
  const label = "SceneMusicQueueSearchResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "connection-required") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "connection-required" });
  }
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseSceneMusicQueueCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function selectedSceneMusicQueueOption(
  candidate: SceneMusicQueueCandidate,
): SceneMusicQueueOption | null {
  if (candidate.status !== "selected" || candidate.integrity !== "current") {
    return null;
  }
  return candidate.options.find(
    (option) => option.optionId === candidate.selectedOptionId,
  ) ?? null;
}
