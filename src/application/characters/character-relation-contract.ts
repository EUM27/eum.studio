import { entityId, type EntityId } from "../../domain/writing";

export type CreateCharacterRelationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly fromCharacterId: EntityId<"Character">;
  readonly toCharacterId: EntityId<"Character">;
  readonly kind: string;
  readonly description: string;
};

export type ListCharacterRelationsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateCharacterRelationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly relationId: EntityId<"CharacterRelation">;
  readonly expectedRevision: number;
  readonly changes: Readonly<{
    readonly fromCharacterId?: EntityId<"Character">;
    readonly toCharacterId?: EntityId<"Character">;
    readonly kind?: string;
    readonly description?: string;
  }>;
};

export type RetireCharacterRelationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly relationId: EntityId<"CharacterRelation">;
  readonly expectedRevision: number;
};

export type CharacterRelationRetirementReason = "user" | "character-retired";

export type CharacterRelationProjection = {
  readonly schemaVersion: 1;
  readonly relationId: EntityId<"CharacterRelation">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly fromCharacterId: EntityId<"Character">;
  readonly toCharacterId: EntityId<"Character">;
  readonly kind: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly retirementReason: CharacterRelationRetirementReason | null;
};

export type CharacterRelationListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly relations: readonly CharacterRelationProjection[];
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
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
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
    throw new Error(`Unsupported ${label} schemaVersion`);
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
  return entityId<TEntity>(nonEmptyString(input, field, label));
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

export function parseCreateCharacterRelationCommand(
  value: unknown,
): CreateCharacterRelationCommand {
  const label = "CreateCharacterRelationCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "fromCharacterId",
      "toCharacterId",
      "kind",
      "description",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    fromCharacterId: id<"Character">(input, "fromCharacterId", label),
    toCharacterId: id<"Character">(input, "toCharacterId", label),
    kind: nonEmptyString(input, "kind", label),
    description: stringValue(input, "description", label),
  });
}

export function parseListCharacterRelationsCommand(
  value: unknown,
): ListCharacterRelationsCommand {
  const label = "ListCharacterRelationsCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUpdateCharacterRelationCommand(
  value: unknown,
): UpdateCharacterRelationCommand {
  const label = "UpdateCharacterRelationCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "relationId", "expectedRevision", "changes"],
    label,
  );
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(
    changesInput,
    ["fromCharacterId", "toCharacterId", "kind", "description"],
    changesLabel,
  );
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    relationId: id<"CharacterRelation">(input, "relationId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changesInput, "fromCharacterId")
        ? {
            fromCharacterId: id<"Character">(
              changesInput,
              "fromCharacterId",
              changesLabel,
            ),
          }
        : {}),
      ...(Object.hasOwn(changesInput, "toCharacterId")
        ? {
            toCharacterId: id<"Character">(
              changesInput,
              "toCharacterId",
              changesLabel,
            ),
          }
        : {}),
      ...(Object.hasOwn(changesInput, "kind")
        ? { kind: nonEmptyString(changesInput, "kind", changesLabel) }
        : {}),
      ...(Object.hasOwn(changesInput, "description")
        ? { description: stringValue(changesInput, "description", changesLabel) }
        : {}),
    }),
  });
}

export function parseRetireCharacterRelationCommand(
  value: unknown,
): RetireCharacterRelationCommand {
  const label = "RetireCharacterRelationCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "relationId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    relationId: id<"CharacterRelation">(input, "relationId", label),
    expectedRevision: revision(input, "expectedRevision", label),
  });
}

export function parseCharacterRelationProjection(
  value: unknown,
): CharacterRelationProjection {
  const label = "CharacterRelationProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "relationId",
      "revision",
      "workId",
      "fromCharacterId",
      "toCharacterId",
      "kind",
      "description",
      "createdAt",
      "updatedAt",
      "retiredAt",
      "retirementReason",
    ],
    label,
  );
  schema(input, label);
  const retiredAt = input.retiredAt;
  if (retiredAt !== null && (typeof retiredAt !== "string" || !retiredAt)) {
    throw new Error(`${label}.retiredAt must be a non-empty string or null`);
  }
  const retirementReason = input.retirementReason;
  if (
    retirementReason !== null &&
    retirementReason !== "user" &&
    retirementReason !== "character-retired"
  ) {
    throw new Error(`${label}.retirementReason is unsupported`);
  }
  if ((retiredAt === null) !== (retirementReason === null)) {
    throw new Error(`${label} retirement state is inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    relationId: id<"CharacterRelation">(input, "relationId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    fromCharacterId: id<"Character">(input, "fromCharacterId", label),
    toCharacterId: id<"Character">(input, "toCharacterId", label),
    kind: nonEmptyString(input, "kind", label),
    description: stringValue(input, "description", label),
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
    retiredAt,
    retirementReason,
  });
}

export function parseCharacterRelationListProjection(
  value: unknown,
): CharacterRelationListProjection {
  const label = "CharacterRelationListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "relations"], label);
  schema(input, label);
  if (!Array.isArray(input.relations)) {
    throw new Error(`${label}.relations must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const relations = Object.freeze(input.relations.map((relation, index) => {
    const projection = parseCharacterRelationProjection(relation);
    if (projection.workId !== workId) {
      throw new Error(`${label}.relations[${index}] is outside Work ${workId}`);
    }
    return projection;
  }));
  return Object.freeze({ schemaVersion: 1, workId, relations });
}
