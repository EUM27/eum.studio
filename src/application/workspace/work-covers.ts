import { entityId, type EntityId } from "../../domain/writing";

export type WorkCoverProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly mediaType: string;
  readonly contentBase64: string;
};

export type WorkCoversProjection = {
  readonly schemaVersion: 1;
  readonly covers: readonly WorkCoverProjection[];
};

export type SelectWorkCoverCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveWorkCoverCommand = WorkCoverProjection;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readWorkId(value: unknown, label: string): EntityId<"Work"> {
  return entityId<"Work">(readNonEmptyString(value, label));
}

export function parseSelectWorkCoverCommand(
  value: unknown,
): SelectWorkCoverCommand {
  const input = readRecord(value, "SelectWorkCoverCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId"],
    "SelectWorkCoverCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SelectWorkCoverCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readWorkId(input.workId, "SelectWorkCoverCommand.workId"),
  });
}

export function parseSaveWorkCoverCommand(
  value: unknown,
): SaveWorkCoverCommand {
  const input = readRecord(value, "SaveWorkCoverCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "mediaType", "contentBase64"],
    "SaveWorkCoverCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveWorkCoverCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readWorkId(input.workId, "SaveWorkCoverCommand.workId"),
    mediaType: readNonEmptyString(
      input.mediaType,
      "SaveWorkCoverCommand.mediaType",
    ),
    contentBase64: readNonEmptyString(
      input.contentBase64,
      "SaveWorkCoverCommand.contentBase64",
    ),
  });
}

export function parseWorkCoverProjection(
  value: unknown,
): WorkCoverProjection {
  return parseSaveWorkCoverCommand(value);
}

export function parseWorkCoversProjection(
  value: unknown,
): WorkCoversProjection {
  const input = readRecord(value, "WorkCoversProjection");
  assertOnlyFields(
    input,
    ["schemaVersion", "covers"],
    "WorkCoversProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("WorkCoversProjection.schemaVersion must be 1");
  }
  if (!Array.isArray(input.covers)) {
    throw new Error("WorkCoversProjection.covers must be an array");
  }
  const covers = input.covers.map((cover) => parseWorkCoverProjection(cover));
  if (new Set(covers.map((cover) => cover.workId)).size !== covers.length) {
    throw new Error("Duplicate Work cover identity");
  }
  return Object.freeze({
    schemaVersion: 1,
    covers: Object.freeze(covers),
  });
}
