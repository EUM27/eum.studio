import { entityId, type EntityId } from "../../domain/writing";

export type CreateForeshadowLineCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
};

export type ListForeshadowLinesCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateForeshadowLineCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly title?: string;
    readonly note?: string;
  };
};

export type RetireForeshadowLineCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly expectedRevision: number;
};

export type ForeshadowLineProjection = {
  readonly schemaVersion: 1;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type ForeshadowLineListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly lines: readonly ForeshadowLineProjection[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
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

function assertOptionalFields(
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

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
  }
}

function readString(
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

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = readString(input, field, label);
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readTrimmedNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = readString(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readEntityId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(
    readTrimmedNonEmptyString(input, field, label),
  );
}

function readRevision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

export function parseCreateForeshadowLineCommand(
  value: unknown,
): CreateForeshadowLineCommand {
  const label = "CreateForeshadowLineCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "title", "note"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    title: readTrimmedNonEmptyString(input, "title", label),
    note: readString(input, "note", label),
  });
}

export function parseListForeshadowLinesCommand(
  value: unknown,
): ListForeshadowLinesCommand {
  const label = "ListForeshadowLinesCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

export function parseUpdateForeshadowLineCommand(
  value: unknown,
): UpdateForeshadowLineCommand {
  const label = "UpdateForeshadowLineCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "lineId",
    "expectedRevision",
    "changes",
  ], label);
  readSchemaVersion(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = readRecord(input.changes, changesLabel);
  assertOptionalFields(changesInput, ["title", "note"], changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  const changes = Object.freeze({
    ...(Object.hasOwn(changesInput, "title")
      ? { title: readTrimmedNonEmptyString(changesInput, "title", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "note")
      ? { note: readString(changesInput, "note", changesLabel) }
      : {}),
  });
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    lineId: readEntityId<"ForeshadowLine">(input, "lineId", label),
    expectedRevision: readRevision(input, "expectedRevision", label),
    changes,
  });
}

export function parseRetireForeshadowLineCommand(
  value: unknown,
): RetireForeshadowLineCommand {
  const label = "RetireForeshadowLineCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "lineId",
    "expectedRevision",
  ], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    lineId: readEntityId<"ForeshadowLine">(input, "lineId", label),
    expectedRevision: readRevision(input, "expectedRevision", label),
  });
}

export function parseForeshadowLineProjection(
  value: unknown,
): ForeshadowLineProjection {
  const label = "ForeshadowLineProjection";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "lineId",
    "revision",
    "workId",
    "title",
    "note",
    "createdAt",
    "updatedAt",
    "retiredAt",
  ], label);
  readSchemaVersion(input, label);
  if (input.retiredAt !== null && typeof input.retiredAt !== "string") {
    throw new Error(`${label}.retiredAt must be a string or null`);
  }
  return Object.freeze({
    schemaVersion: 1,
    lineId: readEntityId<"ForeshadowLine">(input, "lineId", label),
    revision: readRevision(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    title: readTrimmedNonEmptyString(input, "title", label),
    note: readString(input, "note", label),
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parseForeshadowLineListProjection(
  value: unknown,
): ForeshadowLineListProjection {
  const label = "ForeshadowLineListProjection";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "lines"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.lines)) {
    throw new Error(`${label}.lines must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const lines = Object.freeze(input.lines.map((lineValue, index) => {
    const line = parseForeshadowLineProjection(lineValue);
    if (line.workId !== workId) {
      throw new Error(`${label}.lines[${index}] is outside Work ${workId}`);
    }
    return line;
  }));
  return Object.freeze({ schemaVersion: 1, workId, lines });
}
