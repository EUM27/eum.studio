import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type GetWorkQuickMemoCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveWorkQuickMemoCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly expectedRevision: number;
  readonly text: string;
};

export type WorkQuickMemoProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly text: string;
  readonly updatedAt: string | null;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(value: unknown, label: string): 1 {
  if (value !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return 1;
}

function workId(value: unknown, label: string): EntityId<"Work"> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<"Work">(value);
}

function revision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function nullableInstant(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be null or an absolute instant`);
  }
  return new Date(value).toISOString();
}

export function parseGetWorkQuickMemoCommand(
  value: unknown,
): GetWorkQuickMemoCommand {
  const input = record(value, "GetWorkQuickMemoCommand");
  exact(input, ["schemaVersion", "workId"], "GetWorkQuickMemoCommand");
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "GetWorkQuickMemoCommand"),
    workId: workId(input.workId, "GetWorkQuickMemoCommand.workId"),
  });
}

export function parseSaveWorkQuickMemoCommand(
  value: unknown,
): SaveWorkQuickMemoCommand {
  const input = record(value, "SaveWorkQuickMemoCommand");
  exact(
    input,
    ["schemaVersion", "workId", "expectedRevision", "text"],
    "SaveWorkQuickMemoCommand",
  );
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "SaveWorkQuickMemoCommand"),
    workId: workId(input.workId, "SaveWorkQuickMemoCommand.workId"),
    expectedRevision: revision(
      input.expectedRevision,
      "SaveWorkQuickMemoCommand.expectedRevision",
    ),
    text: text(input.text, "SaveWorkQuickMemoCommand.text"),
  });
}

export function parseWorkQuickMemoProjection(
  value: unknown,
): WorkQuickMemoProjection {
  const input = record(value, "Work quick memo projection");
  exact(
    input,
    ["schemaVersion", "workId", "revision", "text", "updatedAt"],
    "Work quick memo projection",
  );
  const memoText = text(input.text, "Work quick memo projection.text");
  const updatedAt = nullableInstant(
    input.updatedAt,
    "Work quick memo projection.updatedAt",
  );
  const parsedRevision = revision(
    input.revision,
    "Work quick memo projection.revision",
  );
  if (
    (parsedRevision === 0 && (memoText !== "" || updatedAt !== null)) ||
    (parsedRevision > 0 && updatedAt === null)
  ) {
    throw new Error("Work quick memo empty-state fields are inconsistent");
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "Work quick memo projection"),
    workId: workId(input.workId, "Work quick memo projection.workId"),
    revision: parsedRevision,
    text: memoText,
    updatedAt,
  });
}
