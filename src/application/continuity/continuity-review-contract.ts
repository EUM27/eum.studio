import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";
import {
  CONTINUITY_THREAD_KINDS,
  type ContinuityThreadKind,
} from "./continuity-thread-contract";

export const CONTINUITY_REVIEW_PROMPT_VERSION =
  "eum-continuity-review-v1" as const;

export type ContinuityAssertionBasis = "explicit-evidence" | "model-inference";

export type ContinuityReviewDraft = Readonly<{
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  subjectRefs: readonly CanonEntityRef[];
}>;

export type ContinuityReviewEvidence = Readonly<{
  evidenceId: EntityId<"ContinuityReviewEvidence">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  exactText: string;
  anchorId: EntityId<"Anchor"> | null;
}>;

export type ContinuityReviewItem = Readonly<{
  itemId: EntityId<"ContinuityReviewItem">;
  assertionBasis: ContinuityAssertionBasis;
  draft: ContinuityReviewDraft;
  reason: string;
  evidence: readonly ContinuityReviewEvidence[];
  potentialDuplicateThreadIds: readonly EntityId<"ContinuityThread">[];
  status: "pending" | "approved" | "rejected";
  appliedThreadId: EntityId<"ContinuityThread"> | null;
}>;

export type ContinuityReviewCandidate = Readonly<{
  schemaVersion: 1;
  candidateId: EntityId<"ContinuityReviewCandidate">;
  revision: number;
  requestId: EntityId<"ContinuityReviewRequest">;
  workId: EntityId<"Work">;
  sourceRange: AssistantContextRange;
  providerId: string;
  modelId: string;
  promptVersion: typeof CONTINUITY_REVIEW_PROMPT_VERSION;
  status: "ready" | "stale" | "completed" | "superseded";
  items: readonly ContinuityReviewItem[];
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  createdAt: string;
  updatedAt: string;
}>;

export type ContinuityReviewCandidateList = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidates: readonly ContinuityReviewCandidate[];
}>;

export type RunContinuityReviewCommand = Readonly<{
  schemaVersion: 1;
  requestId: EntityId<"ContinuityReviewRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  sourceRange: AssistantContextRange;
}>;

export type ListContinuityReviewCandidatesCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  status: "all" | "actionable" | "completed";
}>;

export type UpdateContinuityReviewItemCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidateId: EntityId<"ContinuityReviewCandidate">;
  expectedCandidateRevision: number;
  itemId: EntityId<"ContinuityReviewItem">;
  draft: ContinuityReviewDraft;
}>;

export type DecideContinuityReviewItemCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidateId: EntityId<"ContinuityReviewCandidate">;
  expectedCandidateRevision: number;
  itemId: EntityId<"ContinuityReviewItem">;
  decision: "approve" | "reject";
  acknowledgedDuplicateThreadIds: readonly EntityId<"ContinuityThread">[];
}>;

export type ContinuityReviewDecisionReceipt = Readonly<{
  schemaVersion: 1;
  receiptId: EntityId<"ContinuityReviewDecisionReceipt">;
  workId: EntityId<"Work">;
  candidateId: EntityId<"ContinuityReviewCandidate">;
  itemId: EntityId<"ContinuityReviewItem">;
  decision: "approve" | "reject";
  outcome: "applied" | "rejected";
  threadId: EntityId<"ContinuityThread"> | null;
  threadRevisionAfter: number | null;
  sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  createdAt: string;
}>;

export type ContinuityReviewDecisionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "applied" | "rejected";
      candidate: ContinuityReviewCandidate;
      receipt: ContinuityReviewDecisionReceipt;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "source-stale" | "candidate-stale" | "duplicate-review-required";
      candidate: ContinuityReviewCandidate;
      missingDuplicateThreadIds: readonly EntityId<"ContinuityThread">[];
    }>;

export type ContinuityReviewResult =
  | Readonly<{ schemaVersion: 1; status: "login-required" }>
  | Readonly<{
      schemaVersion: 1;
      status: "permission-required";
      missing: readonly AssistantContextPermissionMissing[];
      destinationId: string;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "context-rejected";
      reason: "source-unavailable" | "outside-work" | "stale-context" | "invalid-range";
      documentId: EntityId<"Document">;
    }>
  | Readonly<{ schemaVersion: 1; status: "no-change" }>
  | Readonly<{
      schemaVersion: 1;
      status: "candidate";
      candidate: ContinuityReviewCandidate;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string) {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string) {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  if (!allowEmpty && value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return allowEmpty ? value : value.trim();
}

function exactText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty exact text`);
  }
  return value;
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  return entityId<TEntity>(text(value, label));
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function nullableId<TEntity extends string>(value: unknown, label: string) {
  return value === null ? null : id<TEntity>(value, label);
}

function instant(value: unknown, label: string) {
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function stringIdList<TEntity extends string>(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const values = Object.freeze(value.map((entry, index) =>
    id<TEntity>(entry, `${label}[${index}]`)
  ));
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return values;
}

export function parseContinuityReviewDraft(
  value: unknown,
  label = "ContinuityReviewDraft",
): ContinuityReviewDraft {
  const input = record(value, label);
  exact(input, ["kind", "title", "note", "subjectRefs"], label);
  if (!(CONTINUITY_THREAD_KINDS as readonly unknown[]).includes(input.kind)) {
    throw new Error(`${label}.kind is unsupported`);
  }
  return Object.freeze({
    kind: input.kind as ContinuityThreadKind,
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, true),
    subjectRefs: parseCanonEntityRefList(input.subjectRefs, `${label}.subjectRefs`),
  });
}

function parseEvidence(value: unknown, label: string): ContinuityReviewEvidence {
  const input = record(value, label);
  exact(input, [
    "evidenceId",
    "documentId",
    "documentRevisionId",
    "from",
    "to",
    "exactText",
    "anchorId",
  ], label);
  const from = nonNegativeInteger(input.from, `${label}.from`);
  const to = nonNegativeInteger(input.to, `${label}.to`);
  if (to <= from) throw new Error(`${label} must be a non-empty range`);
  return Object.freeze({
    evidenceId: id<"ContinuityReviewEvidence">(
      input.evidenceId,
      `${label}.evidenceId`,
    ),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentRevisionId: id<"DocumentRevision">(
      input.documentRevisionId,
      `${label}.documentRevisionId`,
    ),
    from,
    to,
    exactText: exactText(input.exactText, `${label}.exactText`),
    anchorId: nullableId<"Anchor">(input.anchorId, `${label}.anchorId`),
  });
}

function parseItem(value: unknown, label: string): ContinuityReviewItem {
  const input = record(value, label);
  exact(input, [
    "itemId",
    "assertionBasis",
    "draft",
    "reason",
    "evidence",
    "potentialDuplicateThreadIds",
    "status",
    "appliedThreadId",
  ], label);
  if (
    input.assertionBasis !== "explicit-evidence" &&
    input.assertionBasis !== "model-inference"
  ) {
    throw new Error(`${label}.assertionBasis is unsupported`);
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error(`${label}.evidence must be a non-empty array`);
  }
  const evidence = Object.freeze(input.evidence.map((entry, index) =>
    parseEvidence(entry, `${label}.evidence[${index}]`)
  ));
  if (new Set(evidence.map((entry) => entry.evidenceId)).size !== evidence.length) {
    throw new Error(`${label}.evidence contains duplicates`);
  }
  if (input.status !== "pending" && input.status !== "approved" && input.status !== "rejected") {
    throw new Error(`${label}.status is unsupported`);
  }
  const appliedThreadId = nullableId<"ContinuityThread">(
    input.appliedThreadId,
    `${label}.appliedThreadId`,
  );
  if ((input.status === "approved") !== (appliedThreadId !== null)) {
    throw new Error(`${label}.appliedThreadId does not match status`);
  }
  return Object.freeze({
    itemId: id<"ContinuityReviewItem">(input.itemId, `${label}.itemId`),
    assertionBasis: input.assertionBasis,
    draft: parseContinuityReviewDraft(input.draft, `${label}.draft`),
    reason: text(input.reason, `${label}.reason`),
    evidence,
    potentialDuplicateThreadIds: stringIdList<"ContinuityThread">(
      input.potentialDuplicateThreadIds,
      `${label}.potentialDuplicateThreadIds`,
    ),
    status: input.status,
    appliedThreadId,
  });
}

export function parseContinuityReviewCandidate(
  value: unknown,
): ContinuityReviewCandidate {
  const label = "ContinuityReviewCandidate";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "candidateId",
    "revision",
    "requestId",
    "workId",
    "sourceRange",
    "providerId",
    "modelId",
    "promptVersion",
    "status",
    "items",
    "contextReceiptId",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (input.promptVersion !== CONTINUITY_REVIEW_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  if (
    input.status !== "ready" &&
    input.status !== "stale" &&
    input.status !== "completed" &&
    input.status !== "superseded"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error(`${label}.items must be a non-empty array`);
  }
  const items = Object.freeze(input.items.map((entry, index) =>
    parseItem(entry, `${label}.items[${index}]`)
  ));
  if (new Set(items.map((entry) => entry.itemId)).size !== items.length) {
    throw new Error(`${label}.items contains duplicates`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: id<"ContinuityReviewCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    revision: positiveInteger(input.revision, `${label}.revision`),
    requestId: id<"ContinuityReviewRequest">(input.requestId, `${label}.requestId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
    status: input.status,
    items,
    contextReceiptId: id<"AssistantContextReceipt">(
      input.contextReceiptId,
      `${label}.contextReceiptId`,
    ),
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseContinuityReviewCandidateList(
  value: unknown,
): ContinuityReviewCandidateList {
  const label = "ContinuityReviewCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const candidates = Object.freeze(input.candidates.map((entry, index) => {
    const parsed = parseContinuityReviewCandidate(entry);
    if (parsed.workId !== workId) {
      throw new Error(`${label}.candidates[${index}] is outside Work`);
    }
    return parsed;
  }));
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseRunContinuityReviewCommand(value: unknown): RunContinuityReviewCommand {
  const label = "RunContinuityReviewCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "conversationId", "sourceRange"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"ContinuityReviewRequest">(input.requestId, `${label}.requestId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    conversationId: id<"AssistantConversation">(
      input.conversationId,
      `${label}.conversationId`,
    ),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
  });
}

export function parseListContinuityReviewCandidatesCommand(
  value: unknown,
): ListContinuityReviewCandidatesCommand {
  const label = "ListContinuityReviewCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "status"], label);
  schema(input, label);
  if (input.status !== "all" && input.status !== "actionable" && input.status !== "completed") {
    throw new Error(`${label}.status is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    status: input.status,
  });
}

function candidateIdentity(value: unknown, label: string, extraFields: readonly string[]) {
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "candidateId",
    "expectedCandidateRevision",
    "itemId",
    ...extraFields,
  ], label);
  schema(input, label);
  return {
    input,
    workId: id<"Work">(input.workId, `${label}.workId`),
    candidateId: id<"ContinuityReviewCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    expectedCandidateRevision: positiveInteger(
      input.expectedCandidateRevision,
      `${label}.expectedCandidateRevision`,
    ),
    itemId: id<"ContinuityReviewItem">(input.itemId, `${label}.itemId`),
  } as const;
}

export function parseUpdateContinuityReviewItemCommand(
  value: unknown,
): UpdateContinuityReviewItemCommand {
  const label = "UpdateContinuityReviewItemCommand";
  const base = candidateIdentity(value, label, ["draft"]);
  return Object.freeze({
    schemaVersion: 1,
    workId: base.workId,
    candidateId: base.candidateId,
    expectedCandidateRevision: base.expectedCandidateRevision,
    itemId: base.itemId,
    draft: parseContinuityReviewDraft(base.input.draft, `${label}.draft`),
  });
}

export function parseDecideContinuityReviewItemCommand(
  value: unknown,
): DecideContinuityReviewItemCommand {
  const label = "DecideContinuityReviewItemCommand";
  const base = candidateIdentity(value, label, [
    "decision",
    "acknowledgedDuplicateThreadIds",
  ]);
  if (base.input.decision !== "approve" && base.input.decision !== "reject") {
    throw new Error(`${label}.decision is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: base.workId,
    candidateId: base.candidateId,
    expectedCandidateRevision: base.expectedCandidateRevision,
    itemId: base.itemId,
    decision: base.input.decision,
    acknowledgedDuplicateThreadIds: stringIdList<"ContinuityThread">(
      base.input.acknowledgedDuplicateThreadIds,
      `${label}.acknowledgedDuplicateThreadIds`,
    ),
  });
}

export function parseContinuityReviewDecisionReceipt(
  value: unknown,
): ContinuityReviewDecisionReceipt {
  const label = "ContinuityReviewDecisionReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "receiptId",
    "workId",
    "candidateId",
    "itemId",
    "decision",
    "outcome",
    "threadId",
    "threadRevisionAfter",
    "sourceDocumentRevisionId",
    "createdAt",
  ], label);
  schema(input, label);
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new Error(`${label}.decision is unsupported`);
  }
  if (input.outcome !== "applied" && input.outcome !== "rejected") {
    throw new Error(`${label}.outcome is unsupported`);
  }
  const threadId = nullableId<"ContinuityThread">(input.threadId, `${label}.threadId`);
  const threadRevisionAfter = input.threadRevisionAfter === null
    ? null
    : positiveInteger(input.threadRevisionAfter, `${label}.threadRevisionAfter`);
  if (
    (input.outcome === "applied") !== (threadId !== null) ||
    (threadId === null) !== (threadRevisionAfter === null) ||
    (input.decision === "approve") !== (input.outcome === "applied")
  ) {
    throw new Error(`${label} target does not match its decision outcome`);
  }
  return Object.freeze({
    schemaVersion: 1,
    receiptId: id<"ContinuityReviewDecisionReceipt">(
      input.receiptId,
      `${label}.receiptId`,
    ),
    workId: id<"Work">(input.workId, `${label}.workId`),
    candidateId: id<"ContinuityReviewCandidate">(
      input.candidateId,
      `${label}.candidateId`,
    ),
    itemId: id<"ContinuityReviewItem">(input.itemId, `${label}.itemId`),
    decision: input.decision,
    outcome: input.outcome,
    threadId,
    threadRevisionAfter,
    sourceDocumentRevisionId: id<"DocumentRevision">(
      input.sourceDocumentRevisionId,
      `${label}.sourceDocumentRevisionId`,
    ),
    createdAt: instant(input.createdAt, `${label}.createdAt`),
  });
}

export function parseContinuityReviewDecisionResult(
  value: unknown,
): ContinuityReviewDecisionResult {
  const label = "ContinuityReviewDecisionResult";
  const input = record(value, label);
  if (input.status === "applied" || input.status === "rejected") {
    exact(input, ["schemaVersion", "status", "candidate", "receipt"], label);
    schema(input, label);
    const candidate = parseContinuityReviewCandidate(input.candidate);
    const receipt = parseContinuityReviewDecisionReceipt(input.receipt);
    if (
      candidate.workId !== receipt.workId ||
      candidate.candidateId !== receipt.candidateId ||
      receipt.decision !== (input.status === "applied" ? "approve" : "reject")
    ) {
      throw new Error(`${label}.receipt does not match Candidate`);
    }
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      candidate,
      receipt,
    });
  }
  exact(input, [
    "schemaVersion",
    "status",
    "candidate",
    "missingDuplicateThreadIds",
  ], label);
  schema(input, label);
  if (
    input.status !== "source-stale" &&
    input.status !== "candidate-stale" &&
    input.status !== "duplicate-review-required"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: input.status,
    candidate: parseContinuityReviewCandidate(input.candidate),
    missingDuplicateThreadIds: stringIdList<"ContinuityThread">(
      input.missingDuplicateThreadIds,
      `${label}.missingDuplicateThreadIds`,
    ),
  });
}

export function parseContinuityReviewResult(value: unknown): ContinuityReviewResult {
  const label = "ContinuityReviewResult";
  const input = record(value, label);
  if (input.status === "login-required" || input.status === "no-change") {
    exact(input, ["schemaVersion", "status"], label);
    schema(input, label);
    return Object.freeze({ schemaVersion: 1, status: input.status });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing", "destinationId"], label);
    schema(input, label);
    if (!Array.isArray(input.missing) || input.missing.some(
      (entry) => entry !== "local-read" && entry !== "external-transmit",
    )) {
      throw new Error(`${label}.missing is invalid`);
    }
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing: Object.freeze([...input.missing]) as readonly AssistantContextPermissionMissing[],
      destinationId: text(input.destinationId, `${label}.destinationId`),
    });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
    schema(input, label);
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
      documentId: id<"Document">(input.documentId, `${label}.documentId`),
    });
  }
  exact(input, ["schemaVersion", "status", "candidate"], label);
  schema(input, label);
  if (input.status !== "candidate") throw new Error(`${label}.status is unsupported`);
  return Object.freeze({
    schemaVersion: 1,
    status: "candidate",
    candidate: parseContinuityReviewCandidate(input.candidate),
  });
}
