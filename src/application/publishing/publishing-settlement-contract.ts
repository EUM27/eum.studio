import { entityId, type EntityId } from "../../domain/writing";

export type PublishingSettlementLineItemInput = {
  readonly settlementLineItemId: EntityId<"PublishingSettlementLineItem"> | null;
  readonly label: string;
  readonly amount: number;
  readonly note: string;
};

export type PublishingSettlementLineItemProjection = Omit<
  PublishingSettlementLineItemInput,
  "settlementLineItemId"
> & {
  readonly settlementLineItemId: EntityId<"PublishingSettlementLineItem">;
};

export type CreatePublishingSettlementCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly publicationId: EntityId<"PublishingPublication">;
  readonly title: string;
  readonly periodStartsOn: string | null;
  readonly periodEndsOn: string | null;
  readonly issuedOn: string | null;
  readonly reviewStatus: string;
  readonly currencyCode: string;
  readonly reportedAmount: number | null;
  readonly items: readonly PublishingSettlementLineItemInput[];
  readonly note: string;
};

export type ListPublishingSettlementsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work"> | null;
};

export type UpdatePublishingSettlementCommand = {
  readonly schemaVersion: 1;
  readonly settlementId: EntityId<"PublishingSettlement">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly periodStartsOn?: string | null;
    readonly periodEndsOn?: string | null;
    readonly issuedOn?: string | null;
    readonly reviewStatus?: string;
    readonly currencyCode?: string;
    readonly reportedAmount?: number | null;
    readonly items?: readonly PublishingSettlementLineItemInput[];
    readonly note?: string;
  };
};

export type PublishingSettlementProjection = {
  readonly schemaVersion: 1;
  readonly settlementId: EntityId<"PublishingSettlement">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly publicationId: EntityId<"PublishingPublication">;
  readonly title: string;
  readonly workTitleSnapshot: string;
  readonly publicationTitleSnapshot: string;
  readonly periodStartsOn: string | null;
  readonly periodEndsOn: string | null;
  readonly issuedOn: string | null;
  readonly reviewStatus: string;
  readonly currencyCode: string;
  readonly reportedAmount: number | null;
  readonly items: readonly PublishingSettlementLineItemProjection[];
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingSettlementListProjection = {
  readonly schemaVersion: 1;
  readonly settlements: readonly PublishingSettlementProjection[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string, requireAll = true): void {
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

function id<TEntity extends string>(input: Record<string, unknown>, field: string, label: string): EntityId<TEntity> {
  return entityId<TEntity>(nonEmpty(input, field, label));
}

function nullableId<TEntity extends string>(input: Record<string, unknown>, field: string, label: string): EntityId<TEntity> | null {
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
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${field} must be a finite amount or null`);
  }
  return value;
}

function lineItems(
  input: Record<string, unknown>,
  field: string,
  label: string,
  requireIds: boolean,
): readonly PublishingSettlementLineItemInput[] {
  const value = input[field];
  if (!Array.isArray(value)) throw new Error(`${label}.${field} must be an array`);
  const seenIds = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const itemLabel = `${label}.${field}[${index}]`;
    const item = record(entry, itemLabel);
    exact(item, ["settlementLineItemId", "label", "amount", "note"], itemLabel);
    const settlementLineItemId = nullableId<"PublishingSettlementLineItem">(
      item,
      "settlementLineItemId",
      itemLabel,
    );
    if (requireIds && settlementLineItemId === null) {
      throw new Error(`${itemLabel}.settlementLineItemId must be non-null`);
    }
    if (settlementLineItemId !== null) {
      if (seenIds.has(settlementLineItemId)) {
        throw new Error(`${label}.${field} contains duplicate item IDs`);
      }
      seenIds.add(settlementLineItemId);
    }
    const itemAmount = amount(item, "amount", itemLabel);
    if (itemAmount === null) throw new Error(`${itemLabel}.amount must be finite`);
    return Object.freeze({
      settlementLineItemId,
      label: nonEmpty(item, "label", itemLabel),
      amount: itemAmount,
      note: text(item, "note", itemLabel),
    });
  }));
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
  "publicationId",
  "title",
  "periodStartsOn",
  "periodEndsOn",
  "issuedOn",
  "reviewStatus",
  "currencyCode",
  "reportedAmount",
  "items",
  "note",
] as const;

const UPDATE_FIELDS = [
  "periodStartsOn",
  "periodEndsOn",
  "issuedOn",
  "reviewStatus",
  "currencyCode",
  "reportedAmount",
  "items",
  "note",
] as const;

export function parseCreatePublishingSettlementCommand(value: unknown): CreatePublishingSettlementCommand {
  const label = "CreatePublishingSettlementCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    publicationId: id<"PublishingPublication">(input, "publicationId", label),
    title: text(input, "title", label),
    periodStartsOn: date(input, "periodStartsOn", label),
    periodEndsOn: date(input, "periodEndsOn", label),
    issuedOn: date(input, "issuedOn", label),
    reviewStatus: text(input, "reviewStatus", label),
    currencyCode: text(input, "currencyCode", label),
    reportedAmount: amount(input, "reportedAmount", label),
    items: lineItems(input, "items", label, false),
    note: text(input, "note", label),
  });
}

export function parseListPublishingSettlementsCommand(value: unknown): ListPublishingSettlementsCommand {
  const label = "ListPublishingSettlementsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1, workId: nullableId<"Work">(input, "workId", label) });
}

export function parseUpdatePublishingSettlementCommand(value: unknown): UpdatePublishingSettlementCommand {
  const label = "UpdatePublishingSettlementCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "settlementId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changes = record(input.changes, changesLabel);
  exact(changes, UPDATE_FIELDS, changesLabel, false);
  if (Object.keys(changes).length === 0) throw new Error(`${changesLabel} must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    settlementId: id<"PublishingSettlement">(input, "settlementId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changes, "periodStartsOn") ? { periodStartsOn: date(changes, "periodStartsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "periodEndsOn") ? { periodEndsOn: date(changes, "periodEndsOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "issuedOn") ? { issuedOn: date(changes, "issuedOn", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "reviewStatus") ? { reviewStatus: text(changes, "reviewStatus", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "currencyCode") ? { currencyCode: text(changes, "currencyCode", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "reportedAmount") ? { reportedAmount: amount(changes, "reportedAmount", changesLabel) } : {}),
      ...(Object.hasOwn(changes, "items") ? { items: lineItems(changes, "items", changesLabel, false) } : {}),
      ...(Object.hasOwn(changes, "note") ? { note: text(changes, "note", changesLabel) } : {}),
    }),
  });
}

export function parsePublishingSettlementProjection(value: unknown): PublishingSettlementProjection {
  const label = "PublishingSettlementProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "settlementId",
    "revision",
    ...CREATE_FIELDS,
    "workTitleSnapshot",
    "publicationTitleSnapshot",
    "sourceIds",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    settlementId: id<"PublishingSettlement">(input, "settlementId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    publicationId: id<"PublishingPublication">(input, "publicationId", label),
    title: text(input, "title", label),
    workTitleSnapshot: text(input, "workTitleSnapshot", label),
    publicationTitleSnapshot: text(input, "publicationTitleSnapshot", label),
    periodStartsOn: date(input, "periodStartsOn", label),
    periodEndsOn: date(input, "periodEndsOn", label),
    issuedOn: date(input, "issuedOn", label),
    reviewStatus: text(input, "reviewStatus", label),
    currencyCode: text(input, "currencyCode", label),
    reportedAmount: amount(input, "reportedAmount", label),
    items: lineItems(input, "items", label, true) as readonly PublishingSettlementLineItemProjection[],
    note: text(input, "note", label),
    sourceIds: strings(input, "sourceIds", label),
    createdAt: nonEmpty(input, "createdAt", label),
    updatedAt: nonEmpty(input, "updatedAt", label),
  });
}

export function parsePublishingSettlementListProjection(value: unknown): PublishingSettlementListProjection {
  const label = "PublishingSettlementListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "settlements"], label);
  schema(input, label);
  if (!Array.isArray(input.settlements)) throw new Error(`${label}.settlements must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    settlements: Object.freeze(input.settlements.map(parsePublishingSettlementProjection)),
  });
}
