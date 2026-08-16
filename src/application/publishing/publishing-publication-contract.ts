import { entityId, type EntityId } from "../../domain/writing";

export type CreatePublishingPublicationCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly contractId: EntityId<"PublishingContract"> | null;
  readonly channelPartnerId: EntityId<"PublishingPartner"> | null;
  readonly title: string;
  readonly status: string;
  readonly format: string;
  readonly scheduledOn: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly publishedUnitCount: number | null;
  readonly plannedUnitCount: number | null;
  readonly scheduleNote: string;
  readonly note: string;
};

export type ListPublishingPublicationsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work"> | null;
};

export type UpdatePublishingPublicationCommand = {
  readonly schemaVersion: 1;
  readonly publicationId: EntityId<"PublishingPublication">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly contractId?: EntityId<"PublishingContract"> | null;
    readonly channelPartnerId?: EntityId<"PublishingPartner"> | null;
    readonly status?: string;
    readonly format?: string;
    readonly scheduledOn?: string | null;
    readonly startsOn?: string | null;
    readonly endsOn?: string | null;
    readonly publishedUnitCount?: number | null;
    readonly plannedUnitCount?: number | null;
    readonly scheduleNote?: string;
    readonly note?: string;
  };
};

export type PublishingPublicationProjection = {
  readonly schemaVersion: 1;
  readonly publicationId: EntityId<"PublishingPublication">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly contractId: EntityId<"PublishingContract"> | null;
  readonly channelPartnerId: EntityId<"PublishingPartner"> | null;
  readonly title: string;
  readonly workTitleSnapshot: string;
  readonly channelNameSnapshot: string;
  readonly status: string;
  readonly format: string;
  readonly scheduledOn: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly publishedUnitCount: number | null;
  readonly plannedUnitCount: number | null;
  readonly scheduleNote: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingPublicationListProjection = {
  readonly schemaVersion: 1;
  readonly publications: readonly PublishingPublicationProjection[];
};

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
  requireAll = true,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
  if (requireAll) {
    for (const field of fields) {
      if (!(field in input)) throw new Error(`${label} is missing ${field}`);
    }
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

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(input, field, label));
}

function nullableId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  return input[field] === null ? null : id<TEntity>(input, field, label);
}

function revision(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function date(input: Record<string, unknown>, field: string, label: string): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${label}.${field} must be a date or null`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label}.${field} must be a calendar date`);
  }
  return value;
}

function count(input: Record<string, unknown>, field: string, label: string): number | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer or null`);
  }
  return value;
}

function strings(input: Record<string, unknown>, field: string, label: string): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value)) throw new Error(`${label}.${field} must be an array`);
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}.${field}[${index}] must be non-empty`);
    }
    return entry.trim();
  }));
}

const CREATE_FIELDS = [
  "workId",
  "contractId",
  "channelPartnerId",
  "title",
  "status",
  "format",
  "scheduledOn",
  "startsOn",
  "endsOn",
  "publishedUnitCount",
  "plannedUnitCount",
  "scheduleNote",
  "note",
] as const;

const UPDATE_FIELDS = [
  "contractId",
  "channelPartnerId",
  "status",
  "format",
  "scheduledOn",
  "startsOn",
  "endsOn",
  "publishedUnitCount",
  "plannedUnitCount",
  "scheduleNote",
  "note",
] as const;

export function parseCreatePublishingPublicationCommand(
  value: unknown,
): CreatePublishingPublicationCommand {
  const label = "CreatePublishingPublicationCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    contractId: nullableId<"PublishingContract">(input, "contractId", label),
    channelPartnerId: nullableId<"PublishingPartner">(input, "channelPartnerId", label),
    title: text(input, "title", label),
    status: text(input, "status", label),
    format: text(input, "format", label),
    scheduledOn: date(input, "scheduledOn", label),
    startsOn: date(input, "startsOn", label),
    endsOn: date(input, "endsOn", label),
    publishedUnitCount: count(input, "publishedUnitCount", label),
    plannedUnitCount: count(input, "plannedUnitCount", label),
    scheduleNote: text(input, "scheduleNote", label),
    note: text(input, "note", label),
  });
}

export function parseListPublishingPublicationsCommand(
  value: unknown,
): ListPublishingPublicationsCommand {
  const label = "ListPublishingPublicationsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: nullableId<"Work">(input, "workId", label),
  });
}

export function parseUpdatePublishingPublicationCommand(
  value: unknown,
): UpdatePublishingPublicationCommand {
  const label = "UpdatePublishingPublicationCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "publicationId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changes = record(input.changes, changesLabel);
  exact(changes, UPDATE_FIELDS, changesLabel, false);
  if (Object.keys(changes).length === 0) throw new Error(`${changesLabel} must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    publicationId: id<"PublishingPublication">(input, "publicationId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changes, "contractId") ? { contractId: nullableId<"PublishingContract">(changes, "contractId", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "channelPartnerId") ? { channelPartnerId: nullableId<"PublishingPartner">(changes, "channelPartnerId", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "status") ? { status: text(changes, "status", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "format") ? { format: text(changes, "format", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "scheduledOn") ? { scheduledOn: date(changes, "scheduledOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "startsOn") ? { startsOn: date(changes, "startsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "endsOn") ? { endsOn: date(changes, "endsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "publishedUnitCount") ? { publishedUnitCount: count(changes, "publishedUnitCount", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "plannedUnitCount") ? { plannedUnitCount: count(changes, "plannedUnitCount", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "scheduleNote") ? { scheduleNote: text(changes, "scheduleNote", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "note") ? { note: text(changes, "note", changesLabel) } : {}),
    }),
  });
}

export function parsePublishingPublicationProjection(
  value: unknown,
): PublishingPublicationProjection {
  const label = "PublishingPublicationProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "publicationId",
    "revision",
    ...CREATE_FIELDS,
    "workTitleSnapshot",
    "channelNameSnapshot",
    "sourceIds",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    publicationId: id<"PublishingPublication">(input, "publicationId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    contractId: nullableId<"PublishingContract">(input, "contractId", label),
    channelPartnerId: nullableId<"PublishingPartner">(input, "channelPartnerId", label),
    title: text(input, "title", label),
    workTitleSnapshot: text(input, "workTitleSnapshot", label),
    channelNameSnapshot: text(input, "channelNameSnapshot", label),
    status: text(input, "status", label),
    format: text(input, "format", label),
    scheduledOn: date(input, "scheduledOn", label),
    startsOn: date(input, "startsOn", label),
    endsOn: date(input, "endsOn", label),
    publishedUnitCount: count(input, "publishedUnitCount", label),
    plannedUnitCount: count(input, "plannedUnitCount", label),
    scheduleNote: text(input, "scheduleNote", label),
    note: text(input, "note", label),
    sourceIds: strings(input, "sourceIds", label),
    createdAt: nonEmpty(input, "createdAt", label),
    updatedAt: nonEmpty(input, "updatedAt", label),
  });
}

export function parsePublishingPublicationListProjection(
  value: unknown,
): PublishingPublicationListProjection {
  const label = "PublishingPublicationListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "publications"], label);
  schema(input, label);
  if (!Array.isArray(input.publications)) throw new Error(`${label}.publications must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    publications: Object.freeze(input.publications.map(parsePublishingPublicationProjection)),
  });
}
