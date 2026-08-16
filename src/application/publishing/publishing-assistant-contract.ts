import { entityId, type EntityId } from "../../domain/writing";
import {
  type AssistantConnectorExecutionReceipt,
} from "../assistant/assistant-connector-manifest";
import {
  parsePublishingSourceProjection,
  type PublishingSourceProjection,
} from "./publishing-source-contract";
import {
  parsePublishingSubmissionProjection,
  type PublishingSubmissionProjection,
} from "./publishing-submission-contract";

export const PUBLISHING_ASSISTANT_INTENT_KINDS = [
  "record-submissions",
  "query-open",
  "query-unsubmitted",
] as const;

export type PublishingAssistantIntentKind =
  (typeof PUBLISHING_ASSISTANT_INTENT_KINDS)[number];

export type PublishingAssistantIntentPayload = {
  readonly kind: PublishingAssistantIntentKind;
  readonly workLabel: string | null;
  readonly partnerLabels: readonly string[];
  readonly submittedOn: string | null;
};

export type RunPublishingAssistantCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantConnectorRequest">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly statement: string;
};

export type ApprovePublishingAssistantCandidateCommand = {
  readonly schemaVersion: 1;
  readonly candidateId: string;
};

export type PublishingAssistantRegistry = {
  readonly currentDate: string;
  readonly works: readonly {
    readonly workId: EntityId<"Work">;
    readonly title: string;
  }[];
  readonly partners: readonly {
    readonly partnerId: EntityId<"PublishingPartner">;
    readonly name: string;
  }[];
  readonly submissions: readonly {
    readonly submissionId: EntityId<"PublishingSubmission">;
    readonly workId: EntityId<"Work">;
    readonly partnerId: EntityId<"PublishingPartner">;
    readonly submittedOn: string | null;
    readonly respondedOn: string | null;
  }[];
};

export type PublishingAssistantRecordCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly statement: string;
  readonly workId: EntityId<"Work">;
  readonly workTitleSnapshot: string;
  readonly records: readonly {
    readonly partnerId: EntityId<"PublishingPartner">;
    readonly partnerNameSnapshot: string;
    readonly submittedOn: string | null;
  }[];
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly connectorReceiptId: EntityId<"ConnectorReceipt">;
  readonly createdAt: string;
};

export type PublishingAssistantResult =
  | {
      readonly schemaVersion: 1;
      readonly status: "needs-confirmation";
      readonly statement: string;
      readonly reasons: readonly string[];
      readonly receipt: AssistantConnectorExecutionReceipt;
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "query";
      readonly statement: string;
      readonly query: "open" | "unsubmitted";
      readonly workId: EntityId<"Work"> | null;
      readonly submissionIds: readonly EntityId<"PublishingSubmission">[];
      readonly partnerIds: readonly EntityId<"PublishingPartner">[];
      readonly receipt: AssistantConnectorExecutionReceipt;
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "record-candidate";
      readonly candidate: PublishingAssistantRecordCandidate;
      readonly receipt: AssistantConnectorExecutionReceipt;
    };

export type PublishingAssistantApprovalResult = {
  readonly schemaVersion: 1;
  readonly source: PublishingSourceProjection;
  readonly submissions: readonly PublishingSubmissionProjection[];
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
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function text(
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

function nonEmptyText(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = text(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function nullableText(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string or null`);
  }
  return value;
}

function isoTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return value;
}

function calendarDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function nullableCalendarDate(value: unknown, label: string): string | null {
  return value === null ? null : calendarDate(value, label);
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return Object.freeze(
    value.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
  );
}

function parseReceipt(value: unknown): AssistantConnectorExecutionReceipt {
  const label = "AssistantConnectorExecutionReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "receiptId",
    "requestId",
    "connectionId",
    "connectorKind",
    "operation",
    "requestFingerprint",
    "startedAt",
    "completedAt",
    "resultState",
  ], label);
  schema(input, label);
  if (input.operation !== "publishing-intent") {
    throw new Error(`${label}.operation must be publishing-intent`);
  }
  if (input.resultState !== "succeeded") {
    throw new Error(`${label}.resultState must be succeeded`);
  }
  return Object.freeze({
    schemaVersion: 1,
    receiptId: entityId<"ConnectorReceipt">(nonEmptyText(input, "receiptId", label)),
    requestId: entityId<"AssistantConnectorRequest">(nonEmptyText(input, "requestId", label)),
    connectionId: entityId<"AssistantConnection">(nonEmptyText(input, "connectionId", label)),
    connectorKind: nonEmptyText(input, "connectorKind", label),
    operation: "publishing-intent",
    requestFingerprint: nonEmptyText(input, "requestFingerprint", label),
    startedAt: isoTimestamp(input.startedAt, `${label}.startedAt`),
    completedAt: isoTimestamp(input.completedAt, `${label}.completedAt`),
    resultState: "succeeded",
  });
}

export function parseRunPublishingAssistantCommand(
  value: unknown,
): RunPublishingAssistantCommand {
  const label = "RunPublishingAssistantCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "connectionId", "statement"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: entityId<"AssistantConnectorRequest">(
      nonEmptyText(input, "requestId", label),
    ),
    connectionId: entityId<"AssistantConnection">(
      nonEmptyText(input, "connectionId", label),
    ),
    statement: nonEmptyText(input, "statement", label),
  });
}

export function parseApprovePublishingAssistantCandidateCommand(
  value: unknown,
): ApprovePublishingAssistantCandidateCommand {
  const label = "ApprovePublishingAssistantCandidateCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidateId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    candidateId: nonEmptyText(input, "candidateId", label),
  });
}

export function parsePublishingAssistantIntentPayload(
  value: unknown,
): PublishingAssistantIntentPayload {
  const label = "PublishingAssistantIntentPayload";
  const input = record(value, label);
  exact(input, ["kind", "workLabel", "partnerLabels", "submittedOn"], label);
  if (!PUBLISHING_ASSISTANT_INTENT_KINDS.includes(
    input.kind as PublishingAssistantIntentKind,
  )) {
    throw new Error(`${label}.kind is not supported`);
  }
  const workLabel = nullableText(input, "workLabel", label);
  return Object.freeze({
    kind: input.kind as PublishingAssistantIntentKind,
    workLabel: workLabel === null || workLabel.trim().length === 0
      ? null
      : workLabel.trim(),
    partnerLabels: stringArray(input.partnerLabels, `${label}.partnerLabels`),
    submittedOn: nullableCalendarDate(input.submittedOn, `${label}.submittedOn`),
  });
}

export function buildPublishingAssistantRegistry(
  value: PublishingAssistantRegistry,
): PublishingAssistantRegistry {
  return Object.freeze({
    currentDate: calendarDate(value.currentDate, "PublishingAssistantRegistry.currentDate"),
    works: Object.freeze(value.works.map((entry, index) => Object.freeze({
      workId: entityId<"Work">(
        nonEmptyText(record(entry, `PublishingAssistantRegistry.works[${index}]`), "workId", `PublishingAssistantRegistry.works[${index}]`),
      ),
      title: text(record(entry, `PublishingAssistantRegistry.works[${index}]`), "title", `PublishingAssistantRegistry.works[${index}]`),
    }))),
    partners: Object.freeze(value.partners.map((entry, index) => Object.freeze({
      partnerId: entityId<"PublishingPartner">(
        nonEmptyText(record(entry, `PublishingAssistantRegistry.partners[${index}]`), "partnerId", `PublishingAssistantRegistry.partners[${index}]`),
      ),
      name: text(record(entry, `PublishingAssistantRegistry.partners[${index}]`), "name", `PublishingAssistantRegistry.partners[${index}]`),
    }))),
    submissions: Object.freeze(value.submissions.map((entry, index) => {
      const label = `PublishingAssistantRegistry.submissions[${index}]`;
      const input = record(entry, label);
      return Object.freeze({
        submissionId: entityId<"PublishingSubmission">(
          nonEmptyText(input, "submissionId", label),
        ),
        workId: entityId<"Work">(nonEmptyText(input, "workId", label)),
        partnerId: entityId<"PublishingPartner">(
          nonEmptyText(input, "partnerId", label),
        ),
        submittedOn: nullableCalendarDate(input.submittedOn, `${label}.submittedOn`),
        respondedOn: nullableCalendarDate(input.respondedOn, `${label}.respondedOn`),
      });
    })),
  });
}

function normalizedLabel(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function resolveUnique<T>(
  label: string,
  entries: readonly T[],
  readLabel: (entry: T) => string,
): { readonly kind: "missing" | "ambiguous" } | {
  readonly kind: "matched";
  readonly entry: T;
} {
  const normalized = normalizedLabel(label);
  const matches = entries.filter(
    (entry) => normalizedLabel(readLabel(entry)) === normalized,
  );
  if (matches.length === 0) return { kind: "missing" };
  if (matches.length > 1) return { kind: "ambiguous" };
  return { kind: "matched", entry: matches[0]! };
}

export function resolvePublishingAssistantIntent(input: {
  readonly intent: PublishingAssistantIntentPayload;
  readonly registry: PublishingAssistantRegistry;
  readonly statement: string;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly receipt: AssistantConnectorExecutionReceipt;
  readonly candidateId: string;
  readonly createdAt: string;
}): PublishingAssistantResult {
  const workMatch = input.intent.workLabel === null
    ? null
    : resolveUnique(input.intent.workLabel, input.registry.works, (work) => work.title);
  if (workMatch !== null && workMatch.kind !== "matched") {
    return Object.freeze({
      schemaVersion: 1,
      status: "needs-confirmation",
      statement: input.statement,
      reasons: Object.freeze([
        workMatch.kind === "ambiguous"
          ? "작품 이름이 둘 이상 일치합니다."
          : "작품을 찾지 못했습니다.",
      ]),
      receipt: input.receipt,
    });
  }

  if (input.intent.kind === "query-open") {
    const workId = workMatch?.kind === "matched" ? workMatch.entry.workId : null;
    return Object.freeze({
      schemaVersion: 1,
      status: "query",
      statement: input.statement,
      query: "open",
      workId,
      submissionIds: Object.freeze(input.registry.submissions
        .filter((submission) => submission.respondedOn === null)
        .filter((submission) => workId === null || submission.workId === workId)
        .map((submission) => submission.submissionId)),
      partnerIds: Object.freeze([]),
      receipt: input.receipt,
    });
  }

  if (input.intent.kind === "query-unsubmitted") {
    if (workMatch === null || workMatch.kind !== "matched") {
      return Object.freeze({
        schemaVersion: 1,
        status: "needs-confirmation",
        statement: input.statement,
        reasons: Object.freeze(["작품을 지정해야 합니다."]),
        receipt: input.receipt,
      });
    }
    const submittedPartnerIds = new Set(
      input.registry.submissions
        .filter((submission) => submission.workId === workMatch.entry.workId)
        .map((submission) => submission.partnerId),
    );
    return Object.freeze({
      schemaVersion: 1,
      status: "query",
      statement: input.statement,
      query: "unsubmitted",
      workId: workMatch.entry.workId,
      submissionIds: Object.freeze([]),
      partnerIds: Object.freeze(input.registry.partners
        .filter((partner) => !submittedPartnerIds.has(partner.partnerId))
        .map((partner) => partner.partnerId)),
      receipt: input.receipt,
    });
  }

  if (workMatch === null || workMatch.kind !== "matched") {
    return Object.freeze({
      schemaVersion: 1,
      status: "needs-confirmation",
      statement: input.statement,
      reasons: Object.freeze(["작품을 지정해야 합니다."]),
      receipt: input.receipt,
    });
  }
  if (input.intent.partnerLabels.length === 0) {
    return Object.freeze({
      schemaVersion: 1,
      status: "needs-confirmation",
      statement: input.statement,
      reasons: Object.freeze(["투고처를 지정해야 합니다."]),
      receipt: input.receipt,
    });
  }
  const resolvedPartners = input.intent.partnerLabels.map((label) => ({
    label,
    match: resolveUnique(label, input.registry.partners, (partner) => partner.name),
  }));
  const unresolved = resolvedPartners.filter(({ match }) => match.kind !== "matched");
  if (unresolved.length > 0) {
    return Object.freeze({
      schemaVersion: 1,
      status: "needs-confirmation",
      statement: input.statement,
      reasons: Object.freeze(unresolved.map(({ label, match }) =>
        match.kind === "ambiguous"
          ? `${label}: 둘 이상 일치합니다.`
          : `${label}: 찾지 못했습니다.`,
      )),
      receipt: input.receipt,
    });
  }
  const candidate: PublishingAssistantRecordCandidate = Object.freeze({
    schemaVersion: 1,
    candidateId: input.candidateId,
    statement: input.statement,
    workId: workMatch.entry.workId,
    workTitleSnapshot: workMatch.entry.title,
    records: Object.freeze(resolvedPartners.map(({ match }) => {
      if (match.kind !== "matched") {
        throw new Error("Unresolved publishing partner reached Candidate creation");
      }
      return Object.freeze({
        partnerId: match.entry.partnerId,
        partnerNameSnapshot: match.entry.name,
        submittedOn: input.intent.submittedOn,
      });
    })),
    connectionId: input.connectionId,
    connectorReceiptId: input.receipt.receiptId,
    createdAt: isoTimestamp(input.createdAt, "PublishingAssistantRecordCandidate.createdAt"),
  });
  return Object.freeze({
    schemaVersion: 1,
    status: "record-candidate",
    candidate,
    receipt: input.receipt,
  });
}

function parseCandidate(value: unknown): PublishingAssistantRecordCandidate {
  const label = "PublishingAssistantRecordCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "candidateId",
    "statement",
    "workId",
    "workTitleSnapshot",
    "records",
    "connectionId",
    "connectorReceiptId",
    "createdAt",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.records)) {
    throw new Error(`${label}.records must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: nonEmptyText(input, "candidateId", label),
    statement: nonEmptyText(input, "statement", label),
    workId: entityId<"Work">(nonEmptyText(input, "workId", label)),
    workTitleSnapshot: text(input, "workTitleSnapshot", label),
    records: Object.freeze(input.records.map((entry, index) => {
      const entryLabel = `${label}.records[${index}]`;
      const row = record(entry, entryLabel);
      exact(row, ["partnerId", "partnerNameSnapshot", "submittedOn"], entryLabel);
      return Object.freeze({
        partnerId: entityId<"PublishingPartner">(
          nonEmptyText(row, "partnerId", entryLabel),
        ),
        partnerNameSnapshot: text(row, "partnerNameSnapshot", entryLabel),
        submittedOn: nullableCalendarDate(row.submittedOn, `${entryLabel}.submittedOn`),
      });
    })),
    connectionId: entityId<"AssistantConnection">(
      nonEmptyText(input, "connectionId", label),
    ),
    connectorReceiptId: entityId<"ConnectorReceipt">(
      nonEmptyText(input, "connectorReceiptId", label),
    ),
    createdAt: isoTimestamp(input.createdAt, `${label}.createdAt`),
  });
}

export function parsePublishingAssistantResult(value: unknown): PublishingAssistantResult {
  const label = "PublishingAssistantResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "needs-confirmation") {
    exact(input, ["schemaVersion", "status", "statement", "reasons", "receipt"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "needs-confirmation",
      statement: text(input, "statement", label),
      reasons: stringArray(input.reasons, `${label}.reasons`),
      receipt: parseReceipt(input.receipt),
    });
  }
  if (input.status === "query") {
    exact(input, [
      "schemaVersion",
      "status",
      "statement",
      "query",
      "workId",
      "submissionIds",
      "partnerIds",
      "receipt",
    ], label);
    if (input.query !== "open" && input.query !== "unsubmitted") {
      throw new Error(`${label}.query is not supported`);
    }
    const workId = input.workId === null
      ? null
      : entityId<"Work">(nonEmptyText(input, "workId", label));
    return Object.freeze({
      schemaVersion: 1,
      status: "query",
      statement: text(input, "statement", label),
      query: input.query,
      workId,
      submissionIds: Object.freeze(stringArray(input.submissionIds, `${label}.submissionIds`)
        .map((id) => entityId<"PublishingSubmission">(id))),
      partnerIds: Object.freeze(stringArray(input.partnerIds, `${label}.partnerIds`)
        .map((id) => entityId<"PublishingPartner">(id))),
      receipt: parseReceipt(input.receipt),
    });
  }
  if (input.status === "record-candidate") {
    exact(input, ["schemaVersion", "status", "candidate", "receipt"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "record-candidate",
      candidate: parseCandidate(input.candidate),
      receipt: parseReceipt(input.receipt),
    });
  }
  throw new Error(`${label}.status is not supported`);
}

export function parsePublishingAssistantApprovalResult(
  value: unknown,
): PublishingAssistantApprovalResult {
  const label = "PublishingAssistantApprovalResult";
  const input = record(value, label);
  exact(input, ["schemaVersion", "source", "submissions"], label);
  schema(input, label);
  if (!Array.isArray(input.submissions)) {
    throw new Error(`${label}.submissions must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    source: parsePublishingSourceProjection(input.source),
    submissions: Object.freeze(
      input.submissions.map(parsePublishingSubmissionProjection),
    ),
  });
}
