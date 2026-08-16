import { entityId, type EntityId } from "../../domain/writing";

export type LinkLoreForeshadowCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly lineId: EntityId<"ForeshadowLine">;
};

export type ListLoreForeshadowLinksCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UnlinkLoreForeshadowCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly linkId: EntityId<"LoreForeshadowLink">;
  readonly expectedRevision: number;
};

export type LoreForeshadowUnlinkReason =
  | "user"
  | "lore-retired"
  | "foreshadow-retired";

export type LoreForeshadowLinkProjection = {
  readonly schemaVersion: 1;
  readonly linkId: EntityId<"LoreForeshadowLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
  readonly unlinkReason: LoreForeshadowUnlinkReason | null;
};

export type LoreForeshadowLinkListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly links: readonly LoreForeshadowLinkProjection[];
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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(stringValue(input, field, label));
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

export function parseLinkLoreForeshadowCommand(
  value: unknown,
): LinkLoreForeshadowCommand {
  const label = "LinkLoreForeshadowCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "loreEntryId", "lineId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    lineId: id<"ForeshadowLine">(input, "lineId", label),
  });
}

export function parseListLoreForeshadowLinksCommand(
  value: unknown,
): ListLoreForeshadowLinksCommand {
  const label = "ListLoreForeshadowLinksCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUnlinkLoreForeshadowCommand(
  value: unknown,
): UnlinkLoreForeshadowCommand {
  const label = "UnlinkLoreForeshadowCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "linkId", "expectedRevision"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    linkId: id<"LoreForeshadowLink">(input, "linkId", label),
    expectedRevision: revision(input, "expectedRevision", label),
  });
}

export function parseLoreForeshadowLinkProjection(
  value: unknown,
): LoreForeshadowLinkProjection {
  const label = "LoreForeshadowLinkProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "linkId",
      "revision",
      "workId",
      "loreEntryId",
      "lineId",
      "linkedAt",
      "unlinkedAt",
      "unlinkReason",
    ],
    label,
  );
  schema(input, label);
  const unlinkedAt = input.unlinkedAt;
  if (unlinkedAt !== null && (typeof unlinkedAt !== "string" || !unlinkedAt)) {
    throw new Error(`${label}.unlinkedAt must be a non-empty string or null`);
  }
  const unlinkReason = input.unlinkReason;
  if (
    unlinkReason !== null &&
    unlinkReason !== "user" &&
    unlinkReason !== "lore-retired" &&
    unlinkReason !== "foreshadow-retired"
  ) {
    throw new Error(`${label}.unlinkReason is invalid`);
  }
  if ((unlinkedAt === null) !== (unlinkReason === null)) {
    throw new Error(`${label} unlink state is inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    linkId: id<"LoreForeshadowLink">(input, "linkId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    loreEntryId: id<"LoreEntry">(input, "loreEntryId", label),
    lineId: id<"ForeshadowLine">(input, "lineId", label),
    linkedAt: stringValue(input, "linkedAt", label),
    unlinkedAt,
    unlinkReason,
  });
}

export function parseLoreForeshadowLinkListProjection(
  value: unknown,
): LoreForeshadowLinkListProjection {
  const label = "LoreForeshadowLinkListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "links"], label);
  schema(input, label);
  if (!Array.isArray(input.links)) {
    throw new Error(`${label}.links must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const links = Object.freeze(input.links.map((link, index) => {
    const projection = parseLoreForeshadowLinkProjection(link);
    if (projection.workId !== workId) {
      throw new Error(`${label}.links[${index}] is outside Work ${workId}`);
    }
    return projection;
  }));
  return Object.freeze({ schemaVersion: 1, workId, links });
}
