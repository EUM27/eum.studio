import { entityId, type EntityId } from "../../domain/writing";

export type CreateCharacterCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
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
    readonly aliases?: readonly string[];
    readonly role?: string;
    readonly summary?: string;
    readonly appearance?: string;
    readonly personality?: string;
    readonly speech?: string;
    readonly goal?: string;
    readonly conflict?: string;
    readonly note?: string;
  };
};

export type AddCharacterEvidenceCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly characterId: EntityId<"Character">;
  readonly expectedRevision: number;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly selection: Readonly<{
    anchor: number;
    head: number;
  }>;
};

export type CharacterEvidenceProjection = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: Readonly<{ from: number; to: number }> | null;
  readonly createdAt: string;
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
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
  readonly note: string;
  readonly evidences: readonly CharacterEvidenceProjection[];
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

function nonNegativeInteger(
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

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const items = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return entry.trim();
  });
  if (new Set(items).size !== items.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return Object.freeze(items);
}

function parseSelection(value: unknown, label: string) {
  const input = record(value, label);
  exactFields(input, ["anchor", "head"], label);
  return Object.freeze({
    anchor: nonNegativeInteger(input, "anchor", label),
    head: nonNegativeInteger(input, "head", label),
  });
}

function parseEvidence(value: unknown, label: string): CharacterEvidenceProjection {
  const input = record(value, label);
  exactFields(
    input,
    [
      "anchorId",
      "documentId",
      "documentRevisionId",
      "exactText",
      "integrity",
      "range",
      "createdAt",
    ],
    label,
  );
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is unsupported`);
  }
  let range: CharacterEvidenceProjection["range"] = null;
  if (input.range !== null) {
    const rangeInput = record(input.range, `${label}.range`);
    exactFields(rangeInput, ["from", "to"], `${label}.range`);
    const from = nonNegativeInteger(rangeInput, "from", `${label}.range`);
    const to = nonNegativeInteger(rangeInput, "to", `${label}.range`);
    if (to <= from) {
      throw new Error(`${label}.range must be non-empty`);
    }
    range = Object.freeze({ from, to });
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input, "anchorId", label),
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    exactText: nonEmptyString(input, "exactText", label),
    integrity: input.integrity,
    range,
    createdAt: nonEmptyString(input, "createdAt", label),
  });
}

export function parseCreateCharacterCommand(value: unknown): CreateCharacterCommand {
  const label = "CreateCharacterCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "name",
      "aliases",
      "role",
      "summary",
      "appearance",
      "personality",
      "speech",
      "goal",
      "conflict",
      "note",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    name: trimmedNonEmptyString(input, "name", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    appearance: stringValue(input, "appearance", label),
    personality: stringValue(input, "personality", label),
    speech: stringValue(input, "speech", label),
    goal: stringValue(input, "goal", label),
    conflict: stringValue(input, "conflict", label),
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
  optionalFields(
    changesInput,
    [
      "name",
      "aliases",
      "role",
      "summary",
      "appearance",
      "personality",
      "speech",
      "goal",
      "conflict",
      "note",
    ],
    changesLabel,
  );
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  const changes = Object.freeze({
    ...(Object.hasOwn(changesInput, "name")
      ? { name: trimmedNonEmptyString(changesInput, "name", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "aliases")
      ? { aliases: stringArray(changesInput.aliases, `${changesLabel}.aliases`) }
      : {}),
    ...(Object.hasOwn(changesInput, "role")
      ? { role: stringValue(changesInput, "role", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "summary")
      ? { summary: stringValue(changesInput, "summary", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "appearance")
      ? { appearance: stringValue(changesInput, "appearance", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "personality")
      ? { personality: stringValue(changesInput, "personality", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "speech")
      ? { speech: stringValue(changesInput, "speech", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "goal")
      ? { goal: stringValue(changesInput, "goal", changesLabel) }
      : {}),
    ...(Object.hasOwn(changesInput, "conflict")
      ? { conflict: stringValue(changesInput, "conflict", changesLabel) }
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

export function parseAddCharacterEvidenceCommand(
  value: unknown,
): AddCharacterEvidenceCommand {
  const label = "AddCharacterEvidenceCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "characterId",
      "expectedRevision",
      "documentId",
      "documentRevisionId",
      "selection",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    characterId: id<"Character">(input, "characterId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    selection: parseSelection(input.selection, `${label}.selection`),
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
      "aliases",
      "role",
      "summary",
      "appearance",
      "personality",
      "speech",
      "goal",
      "conflict",
      "note",
      "evidences",
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
  if (!Array.isArray(input.evidences)) {
    throw new Error(`${label}.evidences must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    characterId: id<"Character">(input, "characterId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    name: trimmedNonEmptyString(input, "name", label),
    aliases: stringArray(input.aliases, `${label}.aliases`),
    role: stringValue(input, "role", label),
    summary: stringValue(input, "summary", label),
    appearance: stringValue(input, "appearance", label),
    personality: stringValue(input, "personality", label),
    speech: stringValue(input, "speech", label),
    goal: stringValue(input, "goal", label),
    conflict: stringValue(input, "conflict", label),
    note: stringValue(input, "note", label),
    evidences: Object.freeze(
      input.evidences.map((evidence, index) =>
        parseEvidence(evidence, `${label}.evidences[${index}]`)
      ),
    ),
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
