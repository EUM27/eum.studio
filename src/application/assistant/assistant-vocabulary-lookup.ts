import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "./assistant-context-permission";

export type RunAssistantVocabularyLookupCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantContextRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly sourceRange: AssistantContextRange;
};

export type AssistantVocabularyOccurrence = AssistantContextRange;

export type AssistantVocabularyCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"AssistantVocabularyCandidate">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly destinationId: string;
  readonly sourceRange: AssistantContextRange;
  readonly query: string;
  readonly occurrences: readonly AssistantVocabularyOccurrence[];
  readonly receiptId: EntityId<"AssistantContextReceipt">;
  readonly createdAt: string;
};

export type AssistantVocabularyLookupResult =
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
      candidate: AssistantVocabularyCandidate;
    }>;

export type AssistantVocabularySearchDocument = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly text: string;
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
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
  preserve = false,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0 || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return preserve ? value : value.trim();
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

export function parseRunAssistantVocabularyLookupCommand(
  value: unknown,
): RunAssistantVocabularyLookupCommand {
  const label = "RunAssistantVocabularyLookupCommand";
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
    sourceRange: parseAssistantContextRange(
      input.sourceRange,
      `${label}.sourceRange`,
    ),
  });
}

export function findExactVocabularyOccurrences(input: {
  readonly workId: EntityId<"Work">;
  readonly query: string;
  readonly documents: readonly AssistantVocabularySearchDocument[];
}): readonly AssistantVocabularyOccurrence[] {
  if (input.query.length === 0) {
    throw new Error("Vocabulary lookup query must be non-empty");
  }
  const occurrences: AssistantVocabularyOccurrence[] = [];
  for (const document of input.documents) {
    if (document.workId !== input.workId) continue;
    let from = document.text.indexOf(input.query);
    while (from >= 0) {
      occurrences.push(Object.freeze({
        documentId: document.documentId,
        documentRevisionId: document.documentRevisionId,
        from,
        to: from + input.query.length,
      }));
      from = document.text.indexOf(input.query, from + 1);
    }
  }
  return Object.freeze(occurrences);
}

export function parseAssistantVocabularyCandidate(
  value: unknown,
): AssistantVocabularyCandidate {
  const label = "AssistantVocabularyCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "candidateId",
    "workId",
    "conversationId",
    "destinationId",
    "sourceRange",
    "query",
    "occurrences",
    "receiptId",
    "createdAt",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.occurrences)) {
    throw new Error(`${label}.occurrences must be an array`);
  }
  const occurrences = Object.freeze(input.occurrences.map((occurrence, index) =>
    parseAssistantContextRange(occurrence, `${label}.occurrences[${index}]`)
  ));
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"AssistantVocabularyCandidate">(
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
    sourceRange: parseAssistantContextRange(
      input.sourceRange,
      `${label}.sourceRange`,
    ),
    query: nonEmptyString(input, "query", label, true),
    occurrences,
    receiptId: identifier<"AssistantContextReceipt">(input, "receiptId", label),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantVocabularyLookupResult(
  value: unknown,
): AssistantVocabularyLookupResult {
  const label = "AssistantVocabularyLookupResult";
  const input = record(value, label);
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseAssistantVocabularyCandidate(input.candidate),
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
