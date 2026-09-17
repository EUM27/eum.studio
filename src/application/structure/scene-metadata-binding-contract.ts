import { entityId, type EntityId } from "../../domain/writing";

export type SceneMetadataKind = "annotation" | "event-override" | "music-queue";
export type SceneMetadataBindingStatus = "current" | "needsReview" | "detached";

export type SceneMetadataBindingProjection = {
  readonly schemaVersion: 1;
  readonly sceneMetadataBindingId: EntityId<"SceneMetadataBinding">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly metadataKind: SceneMetadataKind;
  readonly metadataId: string;
  readonly sourceSceneKey: string;
  readonly sceneId: EntityId<"Scene"> | null;
  readonly status: SceneMetadataBindingStatus;
  readonly proposedSceneId: EntityId<"Scene"> | null;
  readonly lineageOperationId: EntityId<"SceneLineageOperation"> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RebindSceneMetadataCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sceneMetadataBindingId: EntityId<"SceneMetadataBinding">;
  readonly expectedBindingRevision: number;
  readonly targetSceneId: EntityId<"Scene"> | null;
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

function nullableId<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> | null {
  return value === null ? null : id<TEntity>(value, label);
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

export function parseSceneMetadataBindingProjection(
  value: unknown,
): SceneMetadataBindingProjection {
  const label = "SceneMetadataBindingProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "sceneMetadataBindingId", "revision", "workId",
    "metadataKind", "metadataId", "sourceSceneKey", "sceneId", "status",
    "proposedSceneId", "lineageOperationId", "createdAt", "updatedAt",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (
    input.metadataKind !== "annotation" &&
    input.metadataKind !== "event-override" &&
    input.metadataKind !== "music-queue"
  ) {
    throw new Error(`${label}.metadataKind is unsupported`);
  }
  if (
    input.status !== "current" &&
    input.status !== "needsReview" &&
    input.status !== "detached"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  const sceneId = nullableId<"Scene">(input.sceneId, `${label}.sceneId`);
  if (input.status === "current" && sceneId === null) {
    throw new Error(`${label}.current status requires sceneId`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneMetadataBindingId: id<"SceneMetadataBinding">(
      input.sceneMetadataBindingId,
      `${label}.sceneMetadataBindingId`,
    ),
    revision: positiveInteger(input.revision, `${label}.revision`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    metadataKind: input.metadataKind,
    metadataId: nonEmpty(input.metadataId, `${label}.metadataId`),
    sourceSceneKey: nonEmpty(input.sourceSceneKey, `${label}.sourceSceneKey`),
    sceneId,
    status: input.status,
    proposedSceneId: nullableId<"Scene">(
      input.proposedSceneId,
      `${label}.proposedSceneId`,
    ),
    lineageOperationId: nullableId<"SceneLineageOperation">(
      input.lineageOperationId,
      `${label}.lineageOperationId`,
    ),
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseRebindSceneMetadataCommand(
  value: unknown,
): RebindSceneMetadataCommand {
  const label = "RebindSceneMetadataCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "sceneMetadataBindingId",
    "expectedBindingRevision",
    "targetSceneId",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    sceneMetadataBindingId: id<"SceneMetadataBinding">(
      input.sceneMetadataBindingId,
      `${label}.sceneMetadataBindingId`,
    ),
    expectedBindingRevision: positiveInteger(
      input.expectedBindingRevision,
      `${label}.expectedBindingRevision`,
    ),
    targetSceneId: nullableId<"Scene">(
      input.targetSceneId,
      `${label}.targetSceneId`,
    ),
  });
}
