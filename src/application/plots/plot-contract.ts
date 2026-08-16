import { entityId, type EntityId } from "../../domain/writing";

export type CreatePlotThreadCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly note: string;
};

export type ListPlotThreadsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdatePlotThreadCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly title?: string;
    readonly stage?: string;
    readonly summary?: string;
    readonly note?: string;
  };
};

export type RetirePlotThreadCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly expectedRevision: number;
};

export type PlotThreadProjection = {
  readonly schemaVersion: 1;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type PlotThreadListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly plots: readonly PlotThreadProjection[];
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

function optionalFields(
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

function trimmedNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label).trim();
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
  return entityId<TEntity>(trimmedNonEmptyString(input, field, label));
}

function revision(
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

export function parseCreatePlotThreadCommand(
  value: unknown,
): CreatePlotThreadCommand {
  const label = "CreatePlotThreadCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "title", "stage", "summary", "note"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    title: trimmedNonEmptyString(input, "title", label),
    stage: stringValue(input, "stage", label),
    summary: stringValue(input, "summary", label),
    note: stringValue(input, "note", label),
  });
}

export function parseListPlotThreadsCommand(
  value: unknown,
): ListPlotThreadsCommand {
  const label = "ListPlotThreadsCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUpdatePlotThreadCommand(
  value: unknown,
): UpdatePlotThreadCommand {
  const label = "UpdatePlotThreadCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "plotThreadId", "expectedRevision", "changes"],
    label,
  );
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, ["title", "stage", "summary", "note"], changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  const changes = Object.freeze({
    ...(Object.hasOwn(changesInput, "title")
      ? { title: trimmedNonEmptyString(changesInput, "title", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "stage")
      ? { stage: stringValue(changesInput, "stage", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "summary")
      ? { summary: stringValue(changesInput, "summary", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "note")
      ? { note: stringValue(changesInput, "note", changesLabel) }
      : {}),
  });
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    plotThreadId: id<"PlotThread">(input, "plotThreadId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes,
  });
}

export function parseRetirePlotThreadCommand(
  value: unknown,
): RetirePlotThreadCommand {
  const label = "RetirePlotThreadCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "plotThreadId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    plotThreadId: id<"PlotThread">(input, "plotThreadId", label),
    expectedRevision: revision(input, "expectedRevision", label),
  });
}

export function parsePlotThreadProjection(value: unknown): PlotThreadProjection {
  const label = "PlotThreadProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "plotThreadId",
      "revision",
      "workId",
      "title",
      "stage",
      "summary",
      "note",
      "createdAt",
      "updatedAt",
      "retiredAt",
    ],
    label,
  );
  schema(input, label);
  if (input.retiredAt !== null && typeof input.retiredAt !== "string") {
    throw new Error(`${label}.retiredAt must be a string or null`);
  }
  return Object.freeze({
    schemaVersion: 1,
    plotThreadId: id<"PlotThread">(input, "plotThreadId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    title: trimmedNonEmptyString(input, "title", label),
    stage: stringValue(input, "stage", label),
    summary: stringValue(input, "summary", label),
    note: stringValue(input, "note", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parsePlotThreadListProjection(
  value: unknown,
): PlotThreadListProjection {
  const label = "PlotThreadListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "plots"], label);
  schema(input, label);
  if (!Array.isArray(input.plots)) {
    throw new Error(`${label}.plots must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const plots = Object.freeze(input.plots.map((value, index) => {
    const plot = parsePlotThreadProjection(value);
    if (plot.workId !== workId) {
      throw new Error(`${label}.plots[${index}] is outside Work ${workId}`);
    }
    return plot;
  }));
  return Object.freeze({ schemaVersion: 1, workId, plots });
}
