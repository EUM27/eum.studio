import { entityId, type EntityId } from "../../domain/writing";
import {
  MANUSCRIPT_PREFLIGHT_FINDING_KINDS,
  type ManuscriptPreflightFindingKind,
  type ManuscriptPreflightReport,
} from "../editor/manuscript-preflight";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "./assistant-context-permission";

export type RunAssistantNotationReviewCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantContextRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly sourceRange: AssistantContextRange;
};

export type AssistantNotationFinding = {
  readonly kind: ManuscriptPreflightFindingKind;
  readonly range: AssistantContextRange;
  readonly label: string | null;
};

export type AssistantNotationCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"AssistantNotationCandidate">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly sourceRange: AssistantContextRange;
  readonly findings: readonly AssistantNotationFinding[];
  readonly regexError: string | null;
  readonly receiptId: EntityId<"AssistantContextReceipt">;
  readonly createdAt: string;
};

export type AssistantNotationReviewResult =
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "context-rejected";
      reason: "source-unavailable" | "outside-work" | "stale-context" | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: AssistantNotationCandidate;
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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value.trim();
}

function identifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function instant(input: Record<string, unknown>, field: string, label: string): string {
  const value = nonEmptyString(input, field, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}.${field} must be a valid instant`);
  }
  return value;
}

function parseFinding(value: unknown, label: string): AssistantNotationFinding {
  const input = record(value, label);
  exact(input, ["kind", "range", "label"], label);
  if (
    typeof input.kind !== "string" ||
    !MANUSCRIPT_PREFLIGHT_FINDING_KINDS.includes(
      input.kind as ManuscriptPreflightFindingKind,
    )
  ) {
    throw new Error(`${label}.kind is unsupported`);
  }
  if (input.label !== null && typeof input.label !== "string") {
    throw new Error(`${label}.label must be a string or null`);
  }
  return Object.freeze({
    kind: input.kind as ManuscriptPreflightFindingKind,
    range: parseAssistantContextRange(input.range, `${label}.range`),
    label: input.label,
  });
}

export function parseRunAssistantNotationReviewCommand(
  value: unknown,
): RunAssistantNotationReviewCommand {
  const label = "RunAssistantNotationReviewCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "destinationId",
    "sourceRange",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"AssistantContextRequest">(input, "requestId", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    destinationId: nonEmptyString(input, "destinationId", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
  });
}

export function createAssistantNotationFindings(input: {
  readonly sourceRange: AssistantContextRange;
  readonly report: ManuscriptPreflightReport;
}): readonly AssistantNotationFinding[] {
  if (input.report.source.length !== input.sourceRange.to - input.sourceRange.from) {
    throw new Error("Assistant notation report does not match the exact source range");
  }
  return Object.freeze(input.report.findings.flatMap((finding) =>
    finding.matches.map((match) => Object.freeze({
      kind: finding.kind,
      range: Object.freeze({
        documentId: input.sourceRange.documentId,
        documentRevisionId: input.sourceRange.documentRevisionId,
        from: input.sourceRange.from + match.from,
        to: input.sourceRange.from + match.to,
      }),
      label: match.label ?? null,
    })),
  ));
}

export function parseAssistantNotationCandidate(
  value: unknown,
): AssistantNotationCandidate {
  const label = "AssistantNotationCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "candidateId",
    "workId",
    "conversationId",
    "destinationId",
    "sourceRange",
    "findings",
    "regexError",
    "receiptId",
    "createdAt",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.findings)) {
    throw new Error(`${label}.findings must be an array`);
  }
  if (input.regexError !== null && typeof input.regexError !== "string") {
    throw new Error(`${label}.regexError must be a string or null`);
  }
  const sourceRange = parseAssistantContextRange(
    input.sourceRange,
    `${label}.sourceRange`,
  );
  const findings = Object.freeze(input.findings.map((entry, index) => {
    const finding = parseFinding(entry, `${label}.findings[${index}]`);
    if (
      finding.range.documentId !== sourceRange.documentId ||
      finding.range.documentRevisionId !== sourceRange.documentRevisionId ||
      finding.range.from < sourceRange.from ||
      finding.range.to > sourceRange.to
    ) {
      throw new Error(`${label}.findings[${index}] is outside the exact source range`);
    }
    return finding;
  }));
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"AssistantNotationCandidate">(
      input,
      "candidateId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    destinationId: nonEmptyString(input, "destinationId", label),
    sourceRange,
    findings,
    regexError: input.regexError,
    receiptId: identifier<"AssistantContextReceipt">(input, "receiptId", label),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantNotationReviewResult(
  value: unknown,
): AssistantNotationReviewResult {
  const label = "AssistantNotationReviewResult";
  const input = record(value, label);
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseAssistantNotationCandidate(input.candidate),
    });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing"], label);
    schema(input, label);
    if (!Array.isArray(input.missing)) {
      throw new Error(`${label}.missing must be an array`);
    }
    const missing = Object.freeze(input.missing.map((entry) => {
      if (entry !== "local-read" && entry !== "external-transmit") {
        throw new Error(`${label}.missing contains an unsupported value`);
      }
      return entry;
    }));
    return Object.freeze({ schemaVersion: 1, status: "permission-required", missing });
  }
  exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
  schema(input, label);
  if (input.status !== "context-rejected") {
    throw new Error(`${label}.status is unsupported`);
  }
  if (
    input.reason !== "source-unavailable" &&
    input.reason !== "outside-work" &&
    input.reason !== "stale-context" &&
    input.reason !== "invalid-range"
  ) {
    throw new Error(`${label}.reason is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "context-rejected",
    reason: input.reason,
    documentId: identifier<"Document">(input, "documentId", label),
  });
}
