import { entityId, type EntityId } from "../../domain/writing";
import {
  authorizeAssistantContextRequest,
  parseAssistantContextRange,
  type AssistantContextAuthorization,
  type AssistantContextDocumentVersion,
  type AssistantContextPermissionGrant,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "./assistant-context-permission";

export type RunAssistantVocabularySuggestionCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantVocabularySuggestionRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly query: string;
  readonly sourceRange: AssistantContextRange | null;
};

export type AssistantVocabularySuggestion = {
  readonly word: string;
  readonly nuance: string;
  readonly example: string;
};

export type AssistantVocabularySuggestionPayload = {
  readonly suggestions: readonly AssistantVocabularySuggestion[];
  readonly note: string;
};

export type AssistantVocabularySuggestionCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"AssistantVocabularySuggestionCandidate">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly query: string;
  readonly sourceRange: AssistantContextRange | null;
  readonly suggestions: readonly AssistantVocabularySuggestion[];
  readonly note: string;
  readonly connectorReceiptId: EntityId<"ConnectorReceipt">;
  readonly contextReceiptId: EntityId<"AssistantContextReceipt"> | null;
  readonly createdAt: string;
};

export type AssistantVocabularySuggestionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "context-rejected";
      reason:
        | "source-unavailable"
        | "outside-work"
        | "stale-context"
        | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: AssistantVocabularySuggestionCandidate;
    }>;

export type AssistantVocabularySuggestionAuthorization =
  | Exclude<AssistantContextAuthorization, { allowed: true }>
  | Readonly<{
      allowed: true;
      command: RunAssistantVocabularySuggestionCommand;
      context: Extract<AssistantContextAuthorization, { allowed: true }>;
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

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
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

function instant(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = nonEmptyString(input, field, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label}.${field} must be a valid instant`);
  }
  return value;
}

export function parseRunAssistantVocabularySuggestionCommand(
  value: unknown,
): RunAssistantVocabularySuggestionCommand {
  const label = "RunAssistantVocabularySuggestionCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "connectionId",
    "query",
    "sourceRange",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"AssistantVocabularySuggestionRequest">(
      input,
      "requestId",
      label,
    ),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    connectionId: identifier<"AssistantConnection">(
      input,
      "connectionId",
      label,
    ),
    query: nonEmptyString(input, "query", label),
    sourceRange: input.sourceRange === null
      ? null
      : parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
  });
}

export function parseAssistantVocabularySuggestionPayload(
  value: unknown,
): AssistantVocabularySuggestionPayload {
  const label = "AssistantVocabularySuggestionPayload";
  const input = record(value, label);
  exact(input, ["suggestions", "note"], label);
  if (!Array.isArray(input.suggestions)) {
    throw new Error(`${label}.suggestions must be an array`);
  }
  const suggestions = Object.freeze(input.suggestions.map((entry, index) => {
    const entryLabel = `${label}.suggestions[${index}]`;
    const suggestion = record(entry, entryLabel);
    exact(suggestion, ["word", "nuance", "example"], entryLabel);
    return Object.freeze({
      word: nonEmptyString(suggestion, "word", entryLabel),
      nuance: stringValue(suggestion, "nuance", entryLabel),
      example: stringValue(suggestion, "example", entryLabel),
    });
  }));
  return Object.freeze({
    suggestions,
    note: stringValue(input, "note", label),
  });
}

export function authorizeAssistantVocabularySuggestion(input: {
  readonly command: unknown;
  readonly grants: readonly AssistantContextPermissionGrant[];
  readonly documents: readonly AssistantContextDocumentVersion[];
}): AssistantVocabularySuggestionAuthorization {
  const command = parseRunAssistantVocabularySuggestionCommand(input.command);
  const ranges = command.sourceRange === null ? [] : [command.sourceRange];
  const context = authorizeAssistantContextRequest({
    request: {
      schemaVersion: 1,
      requestId: entityId<"AssistantContextRequest">(command.requestId),
      workId: command.workId,
      conversationId: command.conversationId,
      capability: "vocabulary-lookup",
      destinationId: command.connectionId,
      requiredLocalScope: command.sourceRange === null ? "none" : "selection",
      requiredExternalScope: command.sourceRange === null ? "none" : "selection",
      readRanges: ranges,
      transmittedRanges: ranges,
    },
    grants: input.grants,
    documents: input.documents,
  });
  return context.allowed
    ? Object.freeze({ allowed: true, command, context })
    : context;
}

export function parseAssistantVocabularySuggestionCandidate(
  value: unknown,
): AssistantVocabularySuggestionCandidate {
  const label = "AssistantVocabularySuggestionCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "candidateId",
    "workId",
    "conversationId",
    "connectionId",
    "query",
    "sourceRange",
    "suggestions",
    "note",
    "connectorReceiptId",
    "contextReceiptId",
    "createdAt",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  const payload = parseAssistantVocabularySuggestionPayload({
    suggestions: input.suggestions,
    note: input.note,
  });
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"AssistantVocabularySuggestionCandidate">(
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
    connectionId: identifier<"AssistantConnection">(
      input,
      "connectionId",
      label,
    ),
    query: nonEmptyString(input, "query", label),
    sourceRange: input.sourceRange === null
      ? null
      : parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    suggestions: payload.suggestions,
    note: payload.note,
    connectorReceiptId: identifier<"ConnectorReceipt">(
      input,
      "connectorReceiptId",
      label,
    ),
    contextReceiptId: input.contextReceiptId === null
      ? null
      : identifier<"AssistantContextReceipt">(
          input,
          "contextReceiptId",
          label,
        ),
    createdAt: instant(input, "createdAt", label),
  });
}

export function createAssistantVocabularySuggestionCandidate(input: {
  readonly authorization: Extract<
    AssistantVocabularySuggestionAuthorization,
    { allowed: true }
  >;
  readonly payload: unknown;
  readonly candidateId: string;
  readonly connectorReceiptId: string;
  readonly contextReceiptId: string | null;
  readonly createdAt: string;
}): AssistantVocabularySuggestionCandidate {
  const payload = parseAssistantVocabularySuggestionPayload(input.payload);
  const command = input.authorization.command;
  return parseAssistantVocabularySuggestionCandidate({
    schemaVersion: 1,
    candidateId: input.candidateId,
    workId: command.workId,
    conversationId: command.conversationId,
    connectionId: command.connectionId,
    query: command.query,
    sourceRange: command.sourceRange,
    suggestions: payload.suggestions,
    note: payload.note,
    connectorReceiptId: input.connectorReceiptId,
    contextReceiptId: input.contextReceiptId,
    createdAt: input.createdAt,
  });
}

export function parseAssistantVocabularySuggestionResult(
  value: unknown,
): AssistantVocabularySuggestionResult {
  const label = "AssistantVocabularySuggestionResult";
  const input = record(value, label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing"], label);
    if (!Array.isArray(input.missing)) {
      throw new Error(`${label}.missing must be an array`);
    }
    const missing = Object.freeze(input.missing.map((entry) => {
      if (entry !== "local-read" && entry !== "external-transmit") {
        throw new Error(`${label}.missing contains an unsupported value`);
      }
      return entry;
    }));
    if (new Set(missing).size !== missing.length) {
      throw new Error(`${label}.missing contains duplicates`);
    }
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing,
    });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
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
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "candidate",
      candidate: parseAssistantVocabularySuggestionCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}
