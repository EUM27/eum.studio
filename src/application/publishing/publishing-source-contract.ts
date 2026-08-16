import { entityId, type EntityId } from "../../domain/writing";

export type CreatePublishingSourceCommand = {
  readonly schemaVersion: 1;
  readonly kind: string;
  readonly label: string;
  readonly url: string | null;
  readonly observedAt: string | null;
  readonly authority: string;
  readonly importedFields: Readonly<Record<string, string>>;
};

export type ListPublishingSourcesCommand = {
  readonly schemaVersion: 1;
};

export type PublishingSourceProjection = CreatePublishingSourceCommand & {
  readonly sourceId: EntityId<"PublishingSource">;
  readonly revision: number;
  readonly createdAt: string;
};

export type PublishingSourceListProjection = {
  readonly schemaVersion: 1;
  readonly sources: readonly PublishingSourceProjection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
  for (const field of fields) {
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
}

function text(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function nonEmpty(input: Record<string, unknown>, field: string, label: string): string {
  const value = text(input, field, label).trim();
  if (value.length === 0) throw new Error(`${label}.${field} must be non-empty`);
  return value;
}

function nullableText(input: Record<string, unknown>, field: string, label: string): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string or null`);
  return value;
}

function timestamp(input: Record<string, unknown>, field: string, label: string): string | null {
  const value = nullableText(input, field, label);
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label}.${field} must be an ISO timestamp or null`);
  }
  return value;
}

function requiredTimestamp(input: Record<string, unknown>, field: string, label: string): string {
  const value = timestamp(input, field, label);
  if (value === null) throw new Error(`${label}.${field} must be an ISO timestamp`);
  return value;
}

function revision(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function importedFields(
  input: Record<string, unknown>,
  field: string,
  label: string,
): Readonly<Record<string, string>> {
  const value = record(input[field], `${label}.${field}`);
  const normalized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.trim().length === 0 || typeof entry !== "string") {
      throw new Error(`${label}.${field} must contain non-empty string keys and string values`);
    }
    normalized[key] = entry;
  }
  return Object.freeze(normalized);
}

const CREATE_FIELDS = [
  "kind",
  "label",
  "url",
  "observedAt",
  "authority",
  "importedFields",
] as const;

export function parseCreatePublishingSourceCommand(value: unknown): CreatePublishingSourceCommand {
  const label = "CreatePublishingSourceCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    kind: nonEmpty(input, "kind", label),
    label: nonEmpty(input, "label", label),
    url: nullableText(input, "url", label),
    observedAt: timestamp(input, "observedAt", label),
    authority: text(input, "authority", label),
    importedFields: importedFields(input, "importedFields", label),
  });
}

export function parseListPublishingSourcesCommand(value: unknown): ListPublishingSourcesCommand {
  const label = "ListPublishingSourcesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parsePublishingSourceProjection(value: unknown): PublishingSourceProjection {
  const label = "PublishingSourceProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "sourceId",
    "revision",
    ...CREATE_FIELDS,
    "createdAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    sourceId: entityId<"PublishingSource">(nonEmpty(input, "sourceId", label)),
    revision: revision(input, "revision", label),
    kind: nonEmpty(input, "kind", label),
    label: nonEmpty(input, "label", label),
    url: nullableText(input, "url", label),
    observedAt: timestamp(input, "observedAt", label),
    authority: text(input, "authority", label),
    importedFields: importedFields(input, "importedFields", label),
    createdAt: requiredTimestamp(input, "createdAt", label),
  });
}

export function parsePublishingSourceListProjection(value: unknown): PublishingSourceListProjection {
  const label = "PublishingSourceListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "sources"], label);
  schema(input, label);
  if (!Array.isArray(input.sources)) throw new Error(`${label}.sources must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    sources: Object.freeze(input.sources.map(parsePublishingSourceProjection)),
  });
}
