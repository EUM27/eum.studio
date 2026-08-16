import { entityId, type EntityId } from "../../domain/writing";
import type { PublishingSettlementProjection } from "./publishing-settlement-contract";

export type CreatePublishingPaymentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly settlementId: EntityId<"PublishingSettlement"> | null;
  readonly receivedOn: string | null;
  readonly confirmedOn: string | null;
  readonly amount: number;
  readonly currencyCode: string;
  readonly matchStatus: string;
  readonly payerLabel: string;
  readonly reference: string;
  readonly note: string;
};

export type ListPublishingPaymentsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work"> | null;
};

export type UpdatePublishingPaymentCommand = {
  readonly schemaVersion: 1;
  readonly paymentId: EntityId<"PublishingPayment">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly settlementId?: EntityId<"PublishingSettlement"> | null;
    readonly receivedOn?: string | null;
    readonly confirmedOn?: string | null;
    readonly amount?: number;
    readonly currencyCode?: string;
    readonly matchStatus?: string;
    readonly payerLabel?: string;
    readonly reference?: string;
    readonly note?: string;
  };
};

export type PublishingPaymentProjection = {
  readonly schemaVersion: 1;
  readonly paymentId: EntityId<"PublishingPayment">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly settlementId: EntityId<"PublishingSettlement"> | null;
  readonly workTitleSnapshot: string;
  readonly settlementTitleSnapshot: string;
  readonly receivedOn: string | null;
  readonly confirmedOn: string | null;
  readonly amount: number;
  readonly currencyCode: string;
  readonly matchStatus: string;
  readonly payerLabel: string;
  readonly reference: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PublishingPaymentListProjection = {
  readonly schemaVersion: 1;
  readonly payments: readonly PublishingPaymentProjection[];
};

export type PublishingSettlementReceivableProjection = {
  readonly settlementId: EntityId<"PublishingSettlement">;
  readonly currencyCode: string;
  readonly expectedAmount: number | null;
  readonly matchedAmount: number;
  readonly outstandingAmount: number | null;
  readonly matchedPaymentIds: readonly EntityId<"PublishingPayment">[];
  readonly mismatchedPaymentIds: readonly EntityId<"PublishingPayment">[];
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

function amount(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${field} must be a finite amount`);
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
  "settlementId",
  "receivedOn",
  "confirmedOn",
  "amount",
  "currencyCode",
  "matchStatus",
  "payerLabel",
  "reference",
  "note",
] as const;

const UPDATE_FIELDS = [
  "settlementId",
  "receivedOn",
  "confirmedOn",
  "amount",
  "currencyCode",
  "matchStatus",
  "payerLabel",
  "reference",
  "note",
] as const;

export function parseCreatePublishingPaymentCommand(value: unknown): CreatePublishingPaymentCommand {
  const label = "CreatePublishingPaymentCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", ...CREATE_FIELDS], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    settlementId: nullableId<"PublishingSettlement">(input, "settlementId", label),
    receivedOn: date(input, "receivedOn", label),
    confirmedOn: date(input, "confirmedOn", label),
    amount: amount(input, "amount", label),
    currencyCode: text(input, "currencyCode", label),
    matchStatus: text(input, "matchStatus", label),
    payerLabel: text(input, "payerLabel", label),
    reference: text(input, "reference", label),
    note: text(input, "note", label),
  });
}

export function parseListPublishingPaymentsCommand(value: unknown): ListPublishingPaymentsCommand {
  const label = "ListPublishingPaymentsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: nullableId<"Work">(input, "workId", label),
  });
}

export function parseUpdatePublishingPaymentCommand(value: unknown): UpdatePublishingPaymentCommand {
  const label = "UpdatePublishingPaymentCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "paymentId", "expectedRevision", "changes"], label);
  schema(input, label);
  const changesLabel = `${label}.changes`;
  const changes = record(input.changes, changesLabel);
  exact(changes, UPDATE_FIELDS, changesLabel, false);
  if (Object.keys(changes).length === 0) throw new Error(`${changesLabel} must not be empty`);
  return Object.freeze({
    schemaVersion: 1,
    paymentId: id<"PublishingPayment">(input, "paymentId", label),
    expectedRevision: revision(input, "expectedRevision", label),
    changes: Object.freeze({
      ...(Object.hasOwn(changes, "settlementId")
        ? { settlementId: nullableId<"PublishingSettlement">(changes, "settlementId", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "receivedOn")
        ? { receivedOn: date(changes, "receivedOn", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "confirmedOn")
        ? { confirmedOn: date(changes, "confirmedOn", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "amount")
        ? { amount: amount(changes, "amount", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "currencyCode")
        ? { currencyCode: text(changes, "currencyCode", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "matchStatus")
        ? { matchStatus: text(changes, "matchStatus", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "payerLabel")
        ? { payerLabel: text(changes, "payerLabel", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "reference")
        ? { reference: text(changes, "reference", changesLabel) }
        : {}),
      ...(Object.hasOwn(changes, "note")
        ? { note: text(changes, "note", changesLabel) }
        : {}),
    }),
  });
}

export function parsePublishingPaymentProjection(value: unknown): PublishingPaymentProjection {
  const label = "PublishingPaymentProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "paymentId",
    "revision",
    ...CREATE_FIELDS,
    "workTitleSnapshot",
    "settlementTitleSnapshot",
    "sourceIds",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    paymentId: id<"PublishingPayment">(input, "paymentId", label),
    revision: revision(input, "revision", label),
    workId: id<"Work">(input, "workId", label),
    settlementId: nullableId<"PublishingSettlement">(input, "settlementId", label),
    workTitleSnapshot: text(input, "workTitleSnapshot", label),
    settlementTitleSnapshot: text(input, "settlementTitleSnapshot", label),
    receivedOn: date(input, "receivedOn", label),
    confirmedOn: date(input, "confirmedOn", label),
    amount: amount(input, "amount", label),
    currencyCode: text(input, "currencyCode", label),
    matchStatus: text(input, "matchStatus", label),
    payerLabel: text(input, "payerLabel", label),
    reference: text(input, "reference", label),
    note: text(input, "note", label),
    sourceIds: strings(input, "sourceIds", label),
    createdAt: nonEmpty(input, "createdAt", label),
    updatedAt: nonEmpty(input, "updatedAt", label),
  });
}

export function parsePublishingPaymentListProjection(value: unknown): PublishingPaymentListProjection {
  const label = "PublishingPaymentListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "payments"], label);
  schema(input, label);
  if (!Array.isArray(input.payments)) throw new Error(`${label}.payments must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    payments: Object.freeze(input.payments.map(parsePublishingPaymentProjection)),
  });
}

export function derivePublishingSettlementReceivable(input: {
  readonly settlement: PublishingSettlementProjection;
  readonly payments: readonly PublishingPaymentProjection[];
}): PublishingSettlementReceivableProjection {
  const related = input.payments.filter(
    (payment) => payment.settlementId === input.settlement.settlementId
      && payment.workId === input.settlement.workId,
  );
  const matched = related.filter(
    (payment) => payment.currencyCode === input.settlement.currencyCode,
  );
  const matchedAmount = matched.reduce((total, payment) => total + payment.amount, 0);
  return Object.freeze({
    settlementId: input.settlement.settlementId,
    currencyCode: input.settlement.currencyCode,
    expectedAmount: input.settlement.reportedAmount,
    matchedAmount,
    outstandingAmount: input.settlement.reportedAmount === null
      ? null
      : input.settlement.reportedAmount - matchedAmount,
    matchedPaymentIds: Object.freeze(matched.map((payment) => payment.paymentId)),
    mismatchedPaymentIds: Object.freeze(
      related
        .filter((payment) => payment.currencyCode !== input.settlement.currencyCode)
        .map((payment) => payment.paymentId),
    ),
  });
}
