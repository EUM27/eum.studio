import { entityId, type EntityId } from "../../domain/writing";

export const CANON_ENTITY_KINDS = [
  "character",
  "character-relation",
  "lore-entry",
  "event-block",
  "plot-thread",
  "foreshadow-line",
  "scene",
  "continuity-thread",
  "character-knowledge",
] as const;

export type CanonEntityKind = (typeof CANON_ENTITY_KINDS)[number];

export type CanonEntityRef =
  | Readonly<{ kind: "character"; id: EntityId<"Character"> }>
  | Readonly<{
      kind: "character-relation";
      id: EntityId<"CharacterRelation">;
    }>
  | Readonly<{ kind: "lore-entry"; id: EntityId<"LoreEntry"> }>
  | Readonly<{ kind: "event-block"; id: EntityId<"EventBlock"> }>
  | Readonly<{ kind: "plot-thread"; id: EntityId<"PlotThread"> }>
  | Readonly<{ kind: "foreshadow-line"; id: EntityId<"ForeshadowLine"> }>
  | Readonly<{ kind: "scene"; id: EntityId<"Scene"> }>
  | Readonly<{
      kind: "continuity-thread";
      id: EntityId<"ContinuityThread">;
    }>
  | Readonly<{
      kind: "character-knowledge";
      id: EntityId<"CharacterKnowledge">;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function identity(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty identity`);
  }
  return value.trim();
}

export function parseCanonEntityRef(
  value: unknown,
  label = "CanonEntityRef",
): CanonEntityRef {
  const input = record(value, label);
  exact(input, ["kind", "id"], label);
  if (!(CANON_ENTITY_KINDS as readonly unknown[]).includes(input.kind)) {
    throw new Error(`${label}.kind is unsupported`);
  }
  const id = identity(input.id, `${label}.id`);
  switch (input.kind as CanonEntityKind) {
    case "character":
      return Object.freeze({ kind: "character", id: entityId<"Character">(id) });
    case "character-relation":
      return Object.freeze({
        kind: "character-relation",
        id: entityId<"CharacterRelation">(id),
      });
    case "lore-entry":
      return Object.freeze({ kind: "lore-entry", id: entityId<"LoreEntry">(id) });
    case "event-block":
      return Object.freeze({ kind: "event-block", id: entityId<"EventBlock">(id) });
    case "plot-thread":
      return Object.freeze({ kind: "plot-thread", id: entityId<"PlotThread">(id) });
    case "foreshadow-line":
      return Object.freeze({
        kind: "foreshadow-line",
        id: entityId<"ForeshadowLine">(id),
      });
    case "scene":
      return Object.freeze({ kind: "scene", id: entityId<"Scene">(id) });
    case "continuity-thread":
      return Object.freeze({
        kind: "continuity-thread",
        id: entityId<"ContinuityThread">(id),
      });
    case "character-knowledge":
      return Object.freeze({
        kind: "character-knowledge",
        id: entityId<"CharacterKnowledge">(id),
      });
  }
}

export function canonEntityRefKey(value: CanonEntityRef): string {
  return `${value.kind}:${value.id}`;
}

export function parseCanonEntityRefList(
  value: unknown,
  label = "CanonEntityRefList",
): readonly CanonEntityRef[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const refs = Object.freeze(value.map((entry, index) =>
    parseCanonEntityRef(entry, `${label}[${index}]`)
  ));
  const keys = refs.map(canonEntityRefKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} contains duplicate references`);
  }
  return refs;
}

