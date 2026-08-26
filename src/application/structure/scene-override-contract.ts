import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type SceneOverrideOperation =
  | "add"
  | "delete"
  | "ignore"
  | "merge"
  | "split";

export type CreateSceneOverrideCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactQuote: string;
  readonly operation: SceneOverrideOperation;
  readonly note: string;
};

export type ListSceneOverridesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type RelocateSceneSegmentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly sceneId: EntityId<"Scene"> | null;
  readonly startAnchorId: EntityId<"Anchor">;
  readonly endAnchorId: EntityId<"Anchor"> | null;
  readonly previousFrom: number;
  readonly previousTo: number;
  readonly from: number;
  readonly to: number;
  readonly exactQuote: string;
};

export type SceneOverrideBoundaryProjection = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly exactQuote: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: { readonly from: number; readonly to: number } | null;
};

export type SceneOverrideProjection = {
  readonly schemaVersion: 1;
  readonly sceneOverrideId: EntityId<"SceneOverride">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly operation: SceneOverrideOperation;
  readonly baseRuleSetRevision: number;
  readonly note: string;
  readonly boundaries: readonly SceneOverrideBoundaryProjection[];
  readonly createdAt: string;
};

export type SceneOverrideListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sceneOverrides: readonly SceneOverrideProjection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function stringValue(
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

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label);
  if (value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function integer(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function operation(value: unknown, label: string): SceneOverrideOperation {
  if (
    value !== "add" &&
    value !== "delete" &&
    value !== "ignore" &&
    value !== "merge" &&
    value !== "split"
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseCreateSceneOverrideCommand(
  value: unknown,
): CreateSceneOverrideCommand {
  const label = "CreateSceneOverrideCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "selection",
      "exactQuote",
      "operation",
      "note",
    ],
    label,
  );
  schema(input, label);
  const selectionLabel = `${label}.selection`;
  const selection = record(input.selection, selectionLabel);
  exactFields(selection, ["anchor", "head"], selectionLabel);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    selection: Object.freeze({
      anchor: integer(selection, "anchor", selectionLabel),
      head: integer(selection, "head", selectionLabel),
    }),
    exactQuote: stringValue(input, "exactQuote", label),
    operation: operation(input.operation, `${label}.operation`),
    note: stringValue(input, "note", label),
  });
}

export function parseListSceneOverridesCommand(
  value: unknown,
): ListSceneOverridesCommand {
  const label = "ListSceneOverridesCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseRelocateSceneSegmentCommand(
  value: unknown,
): RelocateSceneSegmentCommand {
  const label = "RelocateSceneSegmentCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "sceneId",
      "startAnchorId",
      "endAnchorId",
      "previousFrom",
      "previousTo",
      "from",
      "to",
      "exactQuote",
    ],
    label,
  );
  schema(input, label);
  const from = integer(input, "from", label);
  const to = integer(input, "to", label);
  const previousFrom = integer(input, "previousFrom", label);
  const previousTo = integer(input, "previousTo", label);
  if (to <= from) {
    throw new Error(`${label}.to must be greater than from`);
  }
  if (previousTo <= previousFrom) {
    throw new Error(`${label}.previousTo must be greater than previousFrom`);
  }
  const sceneId = input.sceneId === null
    ? null
    : id<"Scene">(input, "sceneId", label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    sceneId,
    startAnchorId: id<"Anchor">(input, "startAnchorId", label),
    endAnchorId: input.endAnchorId === null
      ? null
      : id<"Anchor">(input, "endAnchorId", label),
    previousFrom,
    previousTo,
    from,
    to,
    exactQuote: stringValue(input, "exactQuote", label),
  });
}

function parseBoundary(
  value: unknown,
  label: string,
): SceneOverrideBoundaryProjection {
  const input = record(value, label);
  exactFields(
    input,
    ["anchorId", "documentRevisionId", "exactQuote", "integrity", "range"],
    label,
  );
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  let range: SceneOverrideBoundaryProjection["range"] = null;
  if (input.range !== null) {
    const rangeInput = record(input.range, `${label}.range`);
    exactFields(rangeInput, ["from", "to"], `${label}.range`);
    const from = integer(rangeInput, "from", `${label}.range`);
    const to = integer(rangeInput, "to", `${label}.range`);
    if (to < from) {
      throw new Error(`${label}.range.to must not precede from`);
    }
    range = Object.freeze({ from, to });
  }
  if ((input.integrity === "resolved") !== (range !== null)) {
    throw new Error(`${label}.range does not match integrity`);
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input, "anchorId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    exactQuote: stringValue(input, "exactQuote", label),
    integrity: input.integrity,
    range,
  });
}

export function parseSceneOverrideProjection(
  value: unknown,
): SceneOverrideProjection {
  const label = "SceneOverrideProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "sceneOverrideId",
      "workId",
      "documentId",
      "operation",
      "baseRuleSetRevision",
      "note",
      "boundaries",
      "createdAt",
    ],
    label,
  );
  schema(input, label);
  if (!Array.isArray(input.boundaries) || input.boundaries.length === 0) {
    throw new Error(`${label}.boundaries must contain at least one boundary`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sceneOverrideId: id<"SceneOverride">(input, "sceneOverrideId", label),
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    operation: operation(input.operation, `${label}.operation`),
    baseRuleSetRevision: integer(input, "baseRuleSetRevision", label),
    note: stringValue(input, "note", label),
    boundaries: Object.freeze(
      input.boundaries.map((boundary, index) =>
        parseBoundary(boundary, `${label}.boundaries[${index}]`),
      ),
    ),
    createdAt: nonEmptyString(input, "createdAt", label),
  });
}

export function parseSceneOverrideListProjection(
  value: unknown,
): SceneOverrideListProjection {
  const label = "SceneOverrideListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "sceneOverrides"], label);
  schema(input, label);
  if (!Array.isArray(input.sceneOverrides)) {
    throw new Error(`${label}.sceneOverrides must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const sceneOverrides = Object.freeze(
    input.sceneOverrides.map((sceneOverride, index) => {
      const parsed = parseSceneOverrideProjection(sceneOverride);
      if (parsed.workId !== workId) {
        throw new Error(`${label}.sceneOverrides[${index}] is outside its Work`);
      }
      return parsed;
    }),
  );
  return Object.freeze({ schemaVersion: 1, workId, sceneOverrides });
}
