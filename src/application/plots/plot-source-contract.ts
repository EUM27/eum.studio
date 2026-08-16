import { entityId, type EntityId } from "../../domain/writing";

export type LinkPlotThreadSourceCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly expectedSourceId: EntityId<"PlotThreadSource"> | null;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
};

export type ListPlotThreadSourcesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type PlotThreadSourceRange = {
  readonly from: number;
  readonly to: number;
};

export type PlotThreadSourceProjection = {
  readonly schemaVersion: 1;
  readonly sourceId: EntityId<"PlotThreadSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: PlotThreadSourceRange | null;
  readonly createdAt: string;
};

export type PlotThreadSourceListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly sources: readonly PlotThreadSourceProjection[];
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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
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
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  const value = stringValue(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function offset(
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

function revision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = offset(input, field, label);
  if (value < 1) {
    throw new Error(`${label}.${field} must be at least 1`);
  }
  return value;
}

export function parseLinkPlotThreadSourceCommand(
  value: unknown,
): LinkPlotThreadSourceCommand {
  const label = "LinkPlotThreadSourceCommand";
  const input = record(value, label);
  exactFields(input, [
    "schemaVersion",
    "workId",
    "plotThreadId",
    "expectedSourceId",
    "documentId",
    "selection",
    "exactText",
  ], label);
  schema(input, label);
  const selectionLabel = `${label}.selection`;
  const selectionInput = record(input.selection, selectionLabel);
  exactFields(selectionInput, ["anchor", "head"], selectionLabel);
  const anchor = offset(selectionInput, "anchor", selectionLabel);
  const head = offset(selectionInput, "head", selectionLabel);
  if (anchor === head) {
    throw new Error(`${label}.selection must not be empty`);
  }
  if (
    input.expectedSourceId !== null &&
    typeof input.expectedSourceId !== "string"
  ) {
    throw new Error(`${label}.expectedSourceId must be a string or null`);
  }
  const expectedSourceId = input.expectedSourceId === null
    ? null
    : id<"PlotThreadSource">(input, "expectedSourceId", label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    plotThreadId: id<"PlotThread">(input, "plotThreadId", label),
    expectedSourceId,
    documentId: id<"Document">(input, "documentId", label),
    selection: Object.freeze({ anchor, head }),
    exactText: nonEmptyString(input, "exactText", label),
  });
}

export function parseListPlotThreadSourcesCommand(
  value: unknown,
): ListPlotThreadSourcesCommand {
  const label = "ListPlotThreadSourcesCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

function range(value: unknown, label: string): PlotThreadSourceRange | null {
  if (value === null) return null;
  const input = record(value, label);
  exactFields(input, ["from", "to"], label);
  const from = offset(input, "from", label);
  const to = offset(input, "to", label);
  if (to < from) {
    throw new Error(`${label}.to must not precede from`);
  }
  return Object.freeze({ from, to });
}

export function parsePlotThreadSourceProjection(
  value: unknown,
): PlotThreadSourceProjection {
  const label = "PlotThreadSourceProjection";
  const input = record(value, label);
  exactFields(input, [
    "schemaVersion",
    "sourceId",
    "revision",
    "workId",
    "plotThreadId",
    "sourceDocumentId",
    "sourceDocumentRevisionId",
    "sourceAnchorId",
    "exactText",
    "integrity",
    "range",
    "createdAt",
  ], label);
  schema(input, label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  const sourceRange = range(input.range, `${label}.range`);
  if (input.integrity === "resolved" && sourceRange === null) {
    throw new Error(`${label}.range is required when resolved`);
  }
  if (input.integrity !== "resolved" && sourceRange !== null) {
    throw new Error(`${label}.range must be null when unresolved`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sourceId: id<"PlotThreadSource">(input, "sourceId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    plotThreadId: id<"PlotThread">(input, "plotThreadId", label),
    sourceDocumentId: id<"Document">(input, "sourceDocumentId", label),
    sourceDocumentRevisionId: id<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    sourceAnchorId: id<"Anchor">(input, "sourceAnchorId", label),
    exactText: nonEmptyString(input, "exactText", label),
    integrity: input.integrity,
    range: sourceRange,
    createdAt: nonEmptyString(input, "createdAt", label),
  });
}

export function parsePlotThreadSourceListProjection(
  value: unknown,
): PlotThreadSourceListProjection {
  const label = "PlotThreadSourceListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "sources"], label);
  schema(input, label);
  if (!Array.isArray(input.sources)) {
    throw new Error(`${label}.sources must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const sources = Object.freeze(input.sources.map((value, index) => {
    const source = parsePlotThreadSourceProjection(value);
    if (source.workId !== workId) {
      throw new Error(`${label}.sources[${index}] is outside Work ${workId}`);
    }
    return source;
  }));
  return Object.freeze({ schemaVersion: 1, workId, sources });
}
