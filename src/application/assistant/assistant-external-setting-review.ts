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
import {
  ASSISTANT_SETTING_KINDS,
  parseAssistantSettingReviewSource,
  type AssistantSettingKind,
  type AssistantSettingReference,
  type AssistantSettingReviewSource,
} from "./assistant-setting-review";

export type RunAssistantExternalSettingReviewCommand = {
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantExternalSettingReviewRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly query: string;
  readonly sourceRange: AssistantContextRange;
};

export type AssistantExternalSettingProposal = {
  readonly action: "create" | "update";
  readonly settingKind: AssistantSettingKind;
  readonly target: AssistantSettingReference | null;
  readonly label: string;
  readonly field: string;
  readonly value: string;
  readonly evidenceRange: AssistantContextRange | null;
  readonly certainty: "explicit" | "inferred";
};

export type AssistantExternalSettingReviewNote = {
  readonly kind: "duplicate" | "conflict" | "category";
  readonly message: string;
  readonly references: readonly AssistantSettingReference[];
};

export type AssistantExternalSettingReviewPayload = {
  readonly reply: string;
  readonly proposals: readonly AssistantExternalSettingProposal[];
  readonly reviewNotes: readonly AssistantExternalSettingReviewNote[];
};

export type AssistantExternalSettingReviewReceipt = {
  readonly schemaVersion: 1;
  readonly receiptId: EntityId<"AssistantExternalSettingReviewReceipt">;
  readonly requestId: EntityId<"AssistantExternalSettingReviewRequest">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly sourceRange: AssistantContextRange;
  readonly transmittedSettings: readonly AssistantSettingReference[];
  readonly transmittedSettingCount: number;
  readonly connectorReceiptId: EntityId<"ConnectorReceipt">;
  readonly contextReceiptId: EntityId<"AssistantContextReceipt">;
  readonly createdAt: string;
};

export type AssistantExternalSettingReviewCandidate = {
  readonly schemaVersion: 1;
  readonly candidateId: EntityId<"AssistantExternalSettingReviewCandidate">;
  readonly workId: EntityId<"Work">;
  readonly conversationId: EntityId<"AssistantConversation">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly query: string;
  readonly reply: string;
  readonly proposals: readonly AssistantExternalSettingProposal[];
  readonly reviewNotes: readonly AssistantExternalSettingReviewNote[];
  readonly receiptId: EntityId<"AssistantExternalSettingReviewReceipt">;
  readonly createdAt: string;
};

export type AssistantExternalSettingReviewAuthorization =
  | Exclude<AssistantContextAuthorization, { allowed: true }>
  | Readonly<{
      allowed: true;
      command: RunAssistantExternalSettingReviewCommand;
      context: Extract<AssistantContextAuthorization, { allowed: true }>;
      settings: readonly AssistantSettingReviewSource[];
    }>;

export type AssistantExternalSettingReviewResult =
  | AssistantRequestFailure
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
      receipt: AssistantExternalSettingReviewReceipt;
      candidate: AssistantExternalSettingReviewCandidate;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (Object.keys(input).length !== expected.size || Object.keys(input).some((field) => !expected.has(field))) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function stringValue(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value.trim();
}

function nonEmptyString(input: Record<string, unknown>, field: string, label: string): string {
  const value = stringValue(input, field, label);
  if (value.length === 0) throw new Error(`${label}.${field} must be non-empty`);
  return value;
}

function identifier<TEntity extends string>(input: Record<string, unknown>, field: string, label: string): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function instant(input: Record<string, unknown>, field: string, label: string): string {
  const value = nonEmptyString(input, field, label);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label}.${field} must be a valid instant`);
  return value;
}

function positiveInteger(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function settingKind(input: Record<string, unknown>, field: string, label: string): AssistantSettingKind {
  const value = input[field];
  if (!ASSISTANT_SETTING_KINDS.includes(value as AssistantSettingKind)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as AssistantSettingKind;
}

function parseReference(value: unknown, label: string): AssistantSettingReference {
  const input = record(value, label);
  exact(input, ["kind", "entityId", "revision"], label);
  return Object.freeze({
    kind: settingKind(input, "kind", label),
    entityId: nonEmptyString(input, "entityId", label),
    revision: positiveInteger(input, "revision", label),
  });
}

function parseReferences(value: unknown, label: string): readonly AssistantSettingReference[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const references = Object.freeze(value.map((entry, index) => parseReference(entry, `${label}[${index}]`)));
  const identities = references.map((reference) => `${reference.kind}\u001f${reference.entityId}\u001f${reference.revision}`);
  if (new Set(identities).size !== identities.length) throw new Error(`${label} contains duplicates`);
  return references;
}

function sameReference(left: AssistantSettingReference, right: AssistantSettingReference): boolean {
  return left.kind === right.kind && left.entityId === right.entityId && left.revision === right.revision;
}

function sourceReference(source: AssistantSettingReviewSource): AssistantSettingReference {
  return Object.freeze({ kind: source.kind, entityId: source.entityId, revision: source.revision });
}

function rangeInside(source: AssistantContextRange, candidate: AssistantContextRange): boolean {
  return source.documentId === candidate.documentId &&
    source.documentRevisionId === candidate.documentRevisionId &&
    candidate.from >= source.from && candidate.to <= source.to;
}

function parseProposal(value: unknown, label: string, sourceRange?: AssistantContextRange): AssistantExternalSettingProposal {
  const input = record(value, label);
  exact(input, ["action", "settingKind", "target", "label", "field", "value", "evidenceRange", "certainty"], label);
  if (input.action !== "create" && input.action !== "update") throw new Error(`${label}.action is unsupported`);
  const target = input.target === null ? null : parseReference(input.target, `${label}.target`);
  if ((input.action === "create") !== (target === null)) throw new Error(`${label}.target does not match action`);
  const evidenceRange = input.evidenceRange === null
    ? null
    : parseAssistantContextRange(input.evidenceRange, `${label}.evidenceRange`);
  if (sourceRange !== undefined && evidenceRange !== null && !rangeInside(sourceRange, evidenceRange)) {
    throw new Error(`${label}.evidenceRange is outside transmitted manuscript`);
  }
  if (input.certainty !== "explicit" && input.certainty !== "inferred") throw new Error(`${label}.certainty is unsupported`);
  return Object.freeze({
    action: input.action,
    settingKind: settingKind(input, "settingKind", label),
    target,
    label: nonEmptyString(input, "label", label),
    field: nonEmptyString(input, "field", label),
    value: nonEmptyString(input, "value", label),
    evidenceRange,
    certainty: input.certainty,
  });
}

function parseReviewNote(value: unknown, label: string): AssistantExternalSettingReviewNote {
  const input = record(value, label);
  exact(input, ["kind", "message", "references"], label);
  if (input.kind !== "duplicate" && input.kind !== "conflict" && input.kind !== "category") {
    throw new Error(`${label}.kind is unsupported`);
  }
  return Object.freeze({
    kind: input.kind,
    message: nonEmptyString(input, "message", label),
    references: parseReferences(input.references, `${label}.references`),
  });
}

export function parseAssistantExternalSettingReviewPayload(
  value: unknown,
  sourceRange?: AssistantContextRange,
): AssistantExternalSettingReviewPayload {
  const label = "AssistantExternalSettingReviewPayload";
  const input = record(value, label);
  exact(input, ["reply", "proposals", "reviewNotes"], label);
  if (!Array.isArray(input.proposals) || !Array.isArray(input.reviewNotes)) {
    throw new Error(`${label} proposal and review note collections must be arrays`);
  }
  return Object.freeze({
    reply: stringValue(input, "reply", label),
    proposals: Object.freeze(input.proposals.map((entry, index) => parseProposal(entry, `${label}.proposals[${index}]`, sourceRange))),
    reviewNotes: Object.freeze(input.reviewNotes.map((entry, index) => parseReviewNote(entry, `${label}.reviewNotes[${index}]`))),
  });
}

export function parseRunAssistantExternalSettingReviewCommand(value: unknown): RunAssistantExternalSettingReviewCommand {
  const label = "RunAssistantExternalSettingReviewCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "conversationId", "connectionId", "query", "sourceRange"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"AssistantExternalSettingReviewRequest">(input, "requestId", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(input, "conversationId", label),
    connectionId: identifier<"AssistantConnection">(input, "connectionId", label),
    query: nonEmptyString(input, "query", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
  });
}

export function authorizeAssistantExternalSettingReview(input: {
  readonly command: unknown;
  readonly grants: readonly AssistantContextPermissionGrant[];
  readonly documents: readonly AssistantContextDocumentVersion[];
  readonly settings: readonly AssistantSettingReviewSource[];
}): AssistantExternalSettingReviewAuthorization {
  const command = parseRunAssistantExternalSettingReviewCommand(input.command);
  const settings = Object.freeze(input.settings.map((source) => parseAssistantSettingReviewSource(source)));
  if (settings.some((source) => source.workId !== command.workId)) throw new Error("Assistant setting source is outside requested Work");
  const context = authorizeAssistantContextRequest({
    request: {
      schemaVersion: 1,
      requestId: entityId<"AssistantContextRequest">(command.requestId),
      workId: command.workId,
      conversationId: command.conversationId,
      capability: "lore-review",
      destinationId: command.connectionId,
      requiredLocalScope: "work",
      requiredExternalScope: "work",
      readRanges: [command.sourceRange],
      transmittedRanges: [command.sourceRange],
    },
    grants: input.grants,
    documents: input.documents,
  });
  return context.allowed ? Object.freeze({ allowed: true, command, context, settings }) : context;
}

export function parseAssistantExternalSettingReviewReceipt(value: unknown): AssistantExternalSettingReviewReceipt {
  const label = "AssistantExternalSettingReviewReceipt";
  const input = record(value, label);
  exact(input, ["schemaVersion", "receiptId", "requestId", "workId", "conversationId", "connectionId", "sourceRange", "transmittedSettings", "transmittedSettingCount", "connectorReceiptId", "contextReceiptId", "createdAt"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  const transmittedSettings = parseReferences(input.transmittedSettings, `${label}.transmittedSettings`);
  const transmittedSettingCount = input.transmittedSettingCount;
  if (typeof transmittedSettingCount !== "number" || !Number.isSafeInteger(transmittedSettingCount) || transmittedSettingCount !== transmittedSettings.length) {
    throw new Error(`${label}.transmittedSettingCount does not match references`);
  }
  return Object.freeze({
    schemaVersion: 1,
    receiptId: identifier<"AssistantExternalSettingReviewReceipt">(input, "receiptId", label),
    requestId: identifier<"AssistantExternalSettingReviewRequest">(input, "requestId", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(input, "conversationId", label),
    connectionId: identifier<"AssistantConnection">(input, "connectionId", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    transmittedSettings,
    transmittedSettingCount,
    connectorReceiptId: identifier<"ConnectorReceipt">(input, "connectorReceiptId", label),
    contextReceiptId: identifier<"AssistantContextReceipt">(input, "contextReceiptId", label),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseAssistantExternalSettingReviewCandidate(value: unknown): AssistantExternalSettingReviewCandidate {
  const label = "AssistantExternalSettingReviewCandidate";
  const input = record(value, label);
  exact(input, ["schemaVersion", "candidateId", "workId", "conversationId", "connectionId", "query", "reply", "proposals", "reviewNotes", "receiptId", "createdAt"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  const payload = parseAssistantExternalSettingReviewPayload({ reply: input.reply, proposals: input.proposals, reviewNotes: input.reviewNotes });
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"AssistantExternalSettingReviewCandidate">(input, "candidateId", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(input, "conversationId", label),
    connectionId: identifier<"AssistantConnection">(input, "connectionId", label),
    query: nonEmptyString(input, "query", label),
    reply: payload.reply,
    proposals: payload.proposals,
    reviewNotes: payload.reviewNotes,
    receiptId: identifier<"AssistantExternalSettingReviewReceipt">(input, "receiptId", label),
    createdAt: instant(input, "createdAt", label),
  });
}

export function createAssistantExternalSettingReviewRecords(input: {
  readonly authorization: Extract<AssistantExternalSettingReviewAuthorization, { allowed: true }>;
  readonly payload: unknown;
  readonly candidateId: string;
  readonly receiptId: string;
  readonly connectorReceiptId: string;
  readonly contextReceiptId: string;
  readonly createdAt: string;
}): Readonly<{ receipt: AssistantExternalSettingReviewReceipt; candidate: AssistantExternalSettingReviewCandidate }> {
  const payload = parseAssistantExternalSettingReviewPayload(
    input.payload,
    input.authorization.command.sourceRange,
  );
  const references = Object.freeze(input.authorization.settings.map(sourceReference));
  for (const proposal of payload.proposals) {
    if (proposal.target !== null && !references.some((reference) => sameReference(reference, proposal.target!))) {
      throw new Error("Assistant setting proposal target was not transmitted");
    }
    if (proposal.target !== null && proposal.target.kind !== proposal.settingKind) {
      throw new Error("Assistant setting proposal target kind does not match proposal");
    }
  }
  for (const note of payload.reviewNotes) {
    if (note.references.some((reference) => !references.some((source) => sameReference(source, reference)))) {
      throw new Error("Assistant setting review note references a setting that was not transmitted");
    }
  }
  const command = input.authorization.command;
  const receipt = parseAssistantExternalSettingReviewReceipt({
    schemaVersion: 1,
    receiptId: input.receiptId,
    requestId: command.requestId,
    workId: command.workId,
    conversationId: command.conversationId,
    connectionId: command.connectionId,
    sourceRange: command.sourceRange,
    transmittedSettings: references,
    transmittedSettingCount: references.length,
    connectorReceiptId: input.connectorReceiptId,
    contextReceiptId: input.contextReceiptId,
    createdAt: input.createdAt,
  });
  const candidate = parseAssistantExternalSettingReviewCandidate({
    schemaVersion: 1,
    candidateId: input.candidateId,
    workId: command.workId,
    conversationId: command.conversationId,
    connectionId: command.connectionId,
    query: command.query,
    reply: payload.reply,
    proposals: payload.proposals,
    reviewNotes: payload.reviewNotes,
    receiptId: receipt.receiptId,
    createdAt: input.createdAt,
  });
  return Object.freeze({ receipt, candidate });
}

export function parseAssistantExternalSettingReviewResult(value: unknown): AssistantExternalSettingReviewResult {
  const label = "AssistantExternalSettingReviewResult";
  const input = record(value, label);
  if (input.status === "failed") return parseAssistantRequestFailure(input);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing"], label);
    if (!Array.isArray(input.missing)) throw new Error(`${label}.missing must be an array`);
    const missing = Object.freeze(input.missing.map((entry) => {
      if (entry !== "local-read" && entry !== "external-transmit") throw new Error(`${label}.missing contains an unsupported value`);
      return entry;
    }));
    return Object.freeze({ schemaVersion: 1, status: "permission-required", missing });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
    if (input.reason !== "source-unavailable" && input.reason !== "outside-work" && input.reason !== "stale-context" && input.reason !== "invalid-range") {
      throw new Error(`${label}.reason is unsupported`);
    }
    return Object.freeze({ schemaVersion: 1, status: "context-rejected", reason: input.reason, documentId: identifier<"Document">(input, "documentId", label) });
  }
  if (input.status === "candidate") {
    exact(input, ["schemaVersion", "status", "receipt", "candidate"], label);
    const receipt = parseAssistantExternalSettingReviewReceipt(input.receipt);
    const candidate = parseAssistantExternalSettingReviewCandidate(input.candidate);
    if (receipt.receiptId !== candidate.receiptId || receipt.workId !== candidate.workId || receipt.connectionId !== candidate.connectionId) {
      throw new Error(`${label} receipt and Candidate do not match`);
    }
    return Object.freeze({ schemaVersion: 1, status: "candidate", receipt, candidate });
  }
  throw new Error(`${label}.status is unsupported`);
}
import { parseAssistantRequestFailure, type AssistantRequestFailure } from "./assistant-request-lifecycle";
