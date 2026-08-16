import { entityId, type EntityId } from "../../domain/writing";

export type CreatePublishingContractCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly submissionId: EntityId<"PublishingSubmission"> | null;
  readonly title: string;
  readonly status: string;
  readonly signedOn: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly rightsScope: string;
  readonly advanceAmount: number | null;
  readonly currencyCode: string;
  readonly revenueShareNote: string;
  readonly note: string;
};

export type ListPublishingContractsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work"> | null;
};

export type UpdatePublishingContractCommand = {
  readonly schemaVersion: 1;
  readonly contractId: EntityId<"PublishingContract">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly status?: string;
    readonly signedOn?: string | null;
    readonly startsOn?: string | null;
    readonly endsOn?: string | null;
    readonly rightsScope?: string;
    readonly advanceAmount?: number | null;
    readonly currencyCode?: string;
    readonly revenueShareNote?: string;
    readonly note?: string;
  };
};

export type PublishingContractProjection = {
  readonly schemaVersion: 1;
  readonly contractId: EntityId<"PublishingContract">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly submissionId: EntityId<"PublishingSubmission"> | null;
  readonly title: string;
  readonly workTitleSnapshot: string;
  readonly partnerNameSnapshot: string;
  readonly status: string;
  readonly signedOn: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly rightsScope: string;
  readonly advanceAmount: number | null;
  readonly currencyCode: string;
  readonly revenueShareNote: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingContractListProjection = {
  readonly schemaVersion: 1;
  readonly contracts: readonly PublishingContractProjection[];
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

function amount(input: Record<string, unknown>, field: string, label: string): number | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative amount or null`);
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
  "partnerId",
  "submissionId",
  "title",
  "status",
  "signedOn",
  "startsOn",
  "endsOn",
  "rightsScope",
  "advanceAmount",
  "currencyCode",
  "revenueShareNote",
  "note",
] as const;

const UPDATE_FIELDS = [
  "status",
  "signedOn",
  "startsOn",
  "endsOn",
  "rightsScope",
  "advanceAmount",
  "currencyCode",
  "revenueShareNote",
  "note",
] as const;

export function parseCreatePublishingContractCommand(
  value: unknown,
): CreatePublishingContractCommand {
  const label = "CreatePublishingContractCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    submissionId: nullableId<"PublishingSubmission">(input, "submissionId", label),
    title: text(input, "title", label),
    status: text(input, "status", label),
    signedOn: date(input, "signedOn", label),
    startsOn: date(input, "startsOn", label),
    endsOn: date(input, "endsOn", label),
    rightsScope: text(input, "rightsScope", label),
    advanceAmount: amount(input, "advanceAmount", label),
    currencyCode: text(input, "currencyCode", label),
    revenueShareNote: text(input, "revenueShareNote", label),
    note: text(input, "note", label),
  });
}

export function parseListPublishingContractsCommand(
  value: unknown,
): ListPublishingContractsCommand {
  const label = "ListPublishingContractsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: nullableId<"Work">(input, "workId", label),
  });
}

export function parseUpdatePublishingContractCommand(
  value: unknown,
): UpdatePublishingContractCommand {
  const label = "UpdatePublishingContractCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "contractId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changes = record(input.changes, changesLabel);
  exact(changes, UPDATE_FIELDS, changesLabel, false);
  if (Object.keys(changes).length === 0) throw new Error(`${changesLabel} must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    contractId: id<"PublishingContract">(input, "contractId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changes, "status") ? { status: text(changes, "status", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "signedOn") ? { signedOn: date(changes, "signedOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "startsOn") ? { startsOn: date(changes, "startsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "endsOn") ? { endsOn: date(changes, "endsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "rightsScope") ? { rightsScope: text(changes, "rightsScope", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "advanceAmount") ? { advanceAmount: amount(changes, "advanceAmount", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "currencyCode") ? { currencyCode: text(changes, "currencyCode", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "revenueShareNote") ? { revenueShareNote: text(changes, "revenueShareNote", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "note") ? { note: text(changes, "note", changesLabel) } : {}),
    }),
  });
}

export function parsePublishingContractProjection(
  value: unknown,
): PublishingContractProjection {
  const label = "PublishingContractProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "contractId",
    "revision",
    ...CREATE_FIELDS,
    "workTitleSnapshot",
    "partnerNameSnapshot",
    "sourceIds",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    contractId: id<"PublishingContract">(input, "contractId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    partnerId: id<"PublishingPartner">(input, "partnerId", label),
    submissionId: nullableId<"PublishingSubmission">(input, "submissionId", label),
    title: text(input, "title", label),
    workTitleSnapshot: text(input, "workTitleSnapshot", label),
    partnerNameSnapshot: nonEmpty(input, "partnerNameSnapshot", label),
    status: text(input, "status", label),
    signedOn: date(input, "signedOn", label),
    startsOn: date(input, "startsOn", label),
    endsOn: date(input, "endsOn", label),
    rightsScope: text(input, "rightsScope", label),
    advanceAmount: amount(input, "advanceAmount", label),
    currencyCode: text(input, "currencyCode", label),
    revenueShareNote: text(input, "revenueShareNote", label),
    note: text(input, "note", label),
    sourceIds: strings(input, "sourceIds", label),
    createdAt: nonEmpty(input, "createdAt", label),
    updatedAt: nonEmpty(input, "updatedAt", label),
  });
}

export function parsePublishingContractListProjection(
  value: unknown,
): PublishingContractListProjection {
  const label = "PublishingContractListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "contracts"], label);
  schema(input, label);
  if (!Array.isArray(input.contracts)) throw new Error(`${label}.contracts must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    contracts: Object.freeze(input.contracts.map(parsePublishingContractProjection)),
  });
}
