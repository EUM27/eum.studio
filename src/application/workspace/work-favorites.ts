import { entityId, type EntityId } from "../../domain/writing";

export type WorkFavoritesProjection = {
  readonly schemaVersion: 1;
  readonly workIds: readonly EntityId<"Work">[];
};

export type SetWorkFavoriteCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly favorite: boolean;
};

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

function readWorkId(value: unknown, label: string): EntityId<"Work"> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<"Work">(value);
}

export function parseSetWorkFavoriteCommand(
  value: unknown,
): SetWorkFavoriteCommand {
  const input = readRecord(value, "SetWorkFavoriteCommand");
  assertOnlyFields(
    input,
    ["schemaVersion", "workId", "favorite"],
    "SetWorkFavoriteCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SetWorkFavoriteCommand.schemaVersion must be 1");
  }
  if (typeof input.favorite !== "boolean") {
    throw new Error("SetWorkFavoriteCommand.favorite must be a boolean");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readWorkId(input.workId, "SetWorkFavoriteCommand.workId"),
    favorite: input.favorite,
  });
}

export function parseWorkFavoritesProjection(
  value: unknown,
): WorkFavoritesProjection {
  const input = readRecord(value, "WorkFavoritesProjection");
  assertOnlyFields(
    input,
    ["schemaVersion", "workIds"],
    "WorkFavoritesProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("WorkFavoritesProjection.schemaVersion must be 1");
  }
  if (!Array.isArray(input.workIds)) {
    throw new Error("WorkFavoritesProjection.workIds must be an array");
  }
  const workIds = input.workIds.map((workId, index) =>
    readWorkId(workId, `WorkFavoritesProjection.workIds[${index}]`),
  );
  if (new Set(workIds).size !== workIds.length) {
    throw new Error("Duplicate favorite Work identity");
  }
  return Object.freeze({
    schemaVersion: 1,
    workIds: Object.freeze(workIds),
  });
}
