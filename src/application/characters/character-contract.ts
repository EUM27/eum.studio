import { entityId, type EntityId } from "../../domain/writing";

export type CreateCharacterCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly name: string;
  readonly role: string;
  readonly summary: string;
  readonly note: string;
};

export type ListCharactersCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateCharacterCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly characterId: EntityId<"Character">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly name?: string;
    readonly role?: string;
    readonly summary?: string;
    readonly note?: string;
  };
};

export type RetireCharacterCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly characterId: EntityId<"Character">;
  readonly expectedRevision: number;
};

export type CharacterProjection = {
  readonly schemaVersion: 1;
  readonly characterId: EntityId<"Character">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly name: string;
  readonly role: string;
  readonly summary: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type CharacterListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly characters: readonly CharacterProjection[];
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

export function parseCreateCharacterCommand(value: unknown): CreateCharacterCommand {
  const label = "CreateCharacterCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "name", "role", "summary", "note"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    name: trimmedNonEmptyString(input, "name", label),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    note: stringValue(input, "note", label),
  });
}

export function parseListCharactersCommand(value: unknown): ListCharactersCommand {
  const label = "ListCharactersCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUpdateCharacterCommand(value: unknown): UpdateCharacterCommand {
  const label = "UpdateCharacterCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "characterId", "expectedRevision", "changes"],
    label,
  );
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, ["name", "role", "summary", "note"], changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  const changes = Object.freeze({
    ...(Object.hasOwn(changesInput, "name")
      ? { name: trimmedNonEmptyString(changesInput, "name", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "role")
      ? { role: stringValue(changesInput, "role", changesLabel) }
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
    characterId: id<"Character">(input, "characterId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes,
  });
}

export function parseRetireCharacterCommand(value: unknown): RetireCharacterCommand {
  const label = "RetireCharacterCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "characterId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    characterId: id<"Character">(input, "characterId", label),
    expectedRevision: revision(input, "expectedRevision", label),
  });
}

export function parseCharacterProjection(value: unknown): CharacterProjection {
  const label = "CharacterProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "characterId",
      "revision",
      "workId",
      "name",
      "role",
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
    characterId: id<"Character">(input, "characterId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    name: trimmedNonEmptyString(input, "name", label),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    note: stringValue(input, "note", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parseCharacterListProjection(value: unknown): CharacterListProjection {
  const label = "CharacterListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "characters"], label);
  schema(input, label);
  if (!Array.isArray(input.characters)) {
    throw new Error(`${label}.characters must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const characters = Object.freeze(input.characters.map((value, index) => {
    const character = parseCharacterProjection(value);
    if (character.workId !== workId) {
      throw new Error(
        `${label}.characters[${index}] is outside Work ${workId}`,
      );
    }
    return character;
  }));
  return Object.freeze({ schemaVersion: 1, workId, characters });
}
