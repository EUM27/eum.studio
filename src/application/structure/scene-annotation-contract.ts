import { entityId, type EntityId } from "../../domain/writing";
import {
  parseSceneMetadataBindingProjection,
  type SceneMetadataBindingProjection,
} from "./scene-metadata-binding-contract";

export type SceneAnnotationProjection = {
  readonly schemaVersion: 1;
  readonly sceneAnnotationId: EntityId<"SceneAnnotation">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly binding: SceneMetadataBindingProjection;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceCandidateId: EntityId<"SceneExtractionCandidate">;
  readonly sourceSceneItemId: EntityId<"SceneExtractionItem">;
  readonly title: string;
  readonly summary: string;
  readonly povCharacterId: EntityId<"Character"> | null;
  readonly location: string;
  readonly time: string;
  readonly characterIds: readonly EntityId<"Character">[];
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListSceneAnnotationsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SceneAnnotationList = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly annotations: readonly SceneAnnotationProjection[];
};

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

function text(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function nonEmpty(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = text(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(input, field, label));
}

function positiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function instant(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = nonEmpty(input, field, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}.${field} must be a valid instant`);
  }
  return value;
}

function ids<TEntity extends string>(
  value: unknown,
  label: string,
): readonly EntityId<TEntity>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const values = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be non-empty`);
    }
    return entityId<TEntity>(entry.trim());
  });
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(values);
}

export function parseSceneAnnotationProjection(
  value: unknown,
): SceneAnnotationProjection {
  const label = "SceneAnnotationProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "sceneAnnotationId",
      "revision",
      "workId",
      "sceneKey",
      "binding",
      "documentId",
      "documentRevisionId",
      "sourceCandidateId",
      "sourceSceneItemId",
      "title",
      "summary",
      "povCharacterId",
      "location",
      "time",
      "characterIds",
      "goal",
      "conflict",
      "outcome",
      "createdAt",
      "updatedAt",
    ],
    label,
  );
  schema(input, label);
  const sceneAnnotationId = id<"SceneAnnotation">(
    input,
    "sceneAnnotationId",
    label,
  );
  const workId = id<"Work">(input, "workId", label);
  const sceneKey = nonEmpty(input, "sceneKey", label);
  const binding = parseSceneMetadataBindingProjection(input.binding);
  if (
    binding.workId !== workId ||
    binding.metadataKind !== "annotation" ||
    binding.metadataId !== sceneAnnotationId ||
    binding.sourceSceneKey !== sceneKey
  ) {
    throw new Error(`${label}.binding does not match the annotation`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneAnnotationId,
    revision: positiveInteger(input, "revision", label),
    workId,
    sceneKey,
    binding,
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    sourceCandidateId: id<"SceneExtractionCandidate">(
      input,
      "sourceCandidateId",
      label,
    ),
    sourceSceneItemId: id<"SceneExtractionItem">(
      input,
      "sourceSceneItemId",
      label,
    ),
    title: nonEmpty(input, "title", label),
    summary: text(input, "summary", label),
    povCharacterId: input.povCharacterId === null
      ? null
      : id<"Character">(input, "povCharacterId", label),
    location: text(input, "location", label),
    time: text(input, "time", label),
    characterIds: ids<"Character">(
      input.characterIds,
      `${label}.characterIds`,
    ),
    goal: text(input, "goal", label),
    conflict: text(input, "conflict", label),
    outcome: text(input, "outcome", label),
    createdAt: instant(input, "createdAt", label),
    updatedAt: instant(input, "updatedAt", label),
  });
}

export function parseListSceneAnnotationsCommand(
  value: unknown,
): ListSceneAnnotationsCommand {
  const label = "ListSceneAnnotationsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseSceneAnnotationList(value: unknown): SceneAnnotationList {
  const label = "SceneAnnotationList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "annotations"], label);
  schema(input, label);
  if (!Array.isArray(input.annotations)) {
    throw new Error(`${label}.annotations must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const annotations = Object.freeze(
    input.annotations.map((entry) => parseSceneAnnotationProjection(entry)),
  );
  if (annotations.some((annotation) => annotation.workId !== workId)) {
    throw new Error(`${label}.annotations cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, annotations });
}
