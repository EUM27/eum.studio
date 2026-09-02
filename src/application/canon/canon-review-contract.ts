import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseCanonEntityRef,
  type CanonEntityRef as SharedCanonEntityRef,
} from "./canon-entity-ref";

export const CANON_REVIEW_PROMPT_VERSION = "eum-canon-review-v1" as const;

export const CANON_TARGET_KINDS = [
  "character",
  "character-relation",
  "lore-entry",
] as const;

export const CANON_CHARACTER_FIELDS = [
  "name",
  "aliases",
  "role",
  "summary",
  "appearance",
  "personality",
  "speech",
  "goal",
  "conflict",
  "note",
] as const;

export const CANON_CHARACTER_RELATION_FIELDS = [
  "fromCharacterId",
  "toCharacterId",
  "kind",
  "description",
] as const;

export const CANON_LORE_ENTRY_FIELDS = [
  "title",
  "content",
  "category",
  "aliases",
  "enabled",
] as const;

export type CanonTargetKind = (typeof CANON_TARGET_KINDS)[number];
export type CanonCharacterField = (typeof CANON_CHARACTER_FIELDS)[number];
export type CanonCharacterRelationField =
  (typeof CANON_CHARACTER_RELATION_FIELDS)[number];
export type CanonLoreEntryField = (typeof CANON_LORE_ENTRY_FIELDS)[number];
export type CanonFieldName =
  | CanonCharacterField
  | CanonCharacterRelationField
  | CanonLoreEntryField;
export type CanonFieldValue = string | boolean | readonly string[];
export type CanonAssertionBasis = "explicit-evidence" | "model-inference";

export type CanonEntityRef = Extract<
  SharedCanonEntityRef,
  { readonly kind: CanonTargetKind }
>;

type CanonCreateTarget =
  | Readonly<{ kind: "character"; operation: "create" }>
  | Readonly<{ kind: "character-relation"; operation: "create" }>
  | Readonly<{ kind: "lore-entry"; operation: "create" }>;

type CanonUpdateTarget =
  | Readonly<{
      kind: "character";
      operation: "update";
      characterId: EntityId<"Character">;
      expectedRevision: number;
    }>
  | Readonly<{
      kind: "character-relation";
      operation: "update";
      relationId: EntityId<"CharacterRelation">;
      expectedRevision: number;
    }>
  | Readonly<{
      kind: "lore-entry";
      operation: "update";
      loreEntryId: EntityId<"LoreEntry">;
      expectedRevision: number;
    }>;

type CanonUnresolvedTarget =
  | Readonly<{
      kind: "character";
      operation: "unresolved";
      matchingTargetIds: readonly EntityId<"Character">[];
    }>
  | Readonly<{
      kind: "character-relation";
      operation: "unresolved";
      matchingTargetIds: readonly EntityId<"CharacterRelation">[];
    }>
  | Readonly<{
      kind: "lore-entry";
      operation: "unresolved";
      matchingTargetIds: readonly EntityId<"LoreEntry">[];
    }>;

export type CanonReviewTarget =
  | CanonCreateTarget
  | CanonUpdateTarget
  | CanonUnresolvedTarget;

export type CanonFieldChange = Readonly<{
  field: CanonFieldName;
  before: CanonFieldValue | null;
  after: CanonFieldValue;
  selected: boolean;
}>;

export type CanonReviewEvidence = Readonly<{
  evidenceId: EntityId<"CanonReviewEvidence">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  exactText: string;
  anchorId: EntityId<"Anchor"> | null;
}>;

export type CanonReviewItem = Readonly<{
  itemId: EntityId<"CanonReviewItem">;
  targetHint: string;
  target: CanonReviewTarget;
  assertionBasis: CanonAssertionBasis;
  reason: string;
  evidence: readonly CanonReviewEvidence[];
  fieldChanges: readonly CanonFieldChange[];
  status: "pending" | "approved" | "rejected";
  appliedTargetId: string | null;
}>;

export type CanonReviewCandidate = Readonly<{
  schemaVersion: 1;
  candidateId: EntityId<"CanonReviewCandidate">;
  revision: number;
  requestId: EntityId<"CanonReviewRequest">;
  workId: EntityId<"Work">;
  sourceRange: AssistantContextRange;
  providerId: string;
  modelId: string;
  promptVersion: typeof CANON_REVIEW_PROMPT_VERSION;
  status: "ready" | "stale" | "completed" | "superseded";
  items: readonly CanonReviewItem[];
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  createdAt: string;
  updatedAt: string;
}>;

export type CanonReviewCandidateList = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidates: readonly CanonReviewCandidate[];
}>;

export type RunCanonReviewCommand = Readonly<{
  schemaVersion: 1;
  requestId: EntityId<"CanonReviewRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  sourceRange: AssistantContextRange;
  requestedTargetKinds: readonly CanonTargetKind[];
}>;

export type ListCanonReviewCandidatesCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  status: "all" | "actionable" | "completed";
}>;

export type UpdateCanonReviewItemCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidateId: EntityId<"CanonReviewCandidate">;
  expectedCandidateRevision: number;
  itemId: EntityId<"CanonReviewItem">;
  fieldChanges: readonly CanonFieldChange[];
}>;

export type CanonReviewTargetSelection =
  | Readonly<{ kind: "create" }>
  | Readonly<{
      kind: "update";
      targetId: string;
      expectedRevision: number;
    }>;

export type ResolveCanonReviewItemTargetCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidateId: EntityId<"CanonReviewCandidate">;
  expectedCandidateRevision: number;
  itemId: EntityId<"CanonReviewItem">;
  target: CanonReviewTargetSelection;
}>;

export type DecideCanonReviewItemCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  candidateId: EntityId<"CanonReviewCandidate">;
  expectedCandidateRevision: number;
  itemId: EntityId<"CanonReviewItem">;
  decision: Readonly<{ kind: "approve" | "reject" }>;
}>;

export type CanonReviewDecisionReceipt = Readonly<{
  schemaVersion: 1;
  receiptId: EntityId<"CanonReviewDecisionReceipt">;
  workId: EntityId<"Work">;
  candidateId: EntityId<"CanonReviewCandidate">;
  itemId: EntityId<"CanonReviewItem">;
  decision: "approve" | "reject";
  outcome: "applied" | "noop" | "rejected";
  target: CanonEntityRef | null;
  targetRevisionBefore: number | null;
  targetRevisionAfter: number | null;
  selectedFields: readonly CanonFieldName[];
  sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  createdAt: string;
}>;

export type CanonReviewDecisionResult =
  | Readonly<{
      schemaVersion: 1;
      status: "applied" | "nothing-selected" | "rejected";
      candidate: CanonReviewCandidate;
      receipt: CanonReviewDecisionReceipt;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "source-stale" | "target-stale";
      candidate: CanonReviewCandidate;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "target-unresolved" | "inference-requires-user-authorship";
      candidate: CanonReviewCandidate;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "possible-duplicate";
      candidate: CanonReviewCandidate;
      matchingTargetIds: readonly string[];
    }>;

export type CanonReviewResult =
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
      candidate: CanonReviewCandidate;
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
    throw new Error(`${label}.schemaVersion must be 1`);
  }
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
  return value;
}

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = stringValue(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value;
}

function identifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(nonEmptyString(input, field, label));
}

function nullableIdentifier<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  return input[field] === null
    ? null
    : identifier<TEntity>(input, field, label);
}

function positiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}.${field} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
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

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const entries = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be non-empty`);
    }
    return entry.trim();
  });
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${label} contains duplicate values`);
  }
  return Object.freeze(entries);
}

function targetKind(value: unknown, label: string): CanonTargetKind {
  if (!(CANON_TARGET_KINDS as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as CanonTargetKind;
}

function fieldsForTarget(kind: CanonTargetKind): readonly CanonFieldName[] {
  if (kind === "character") return CANON_CHARACTER_FIELDS;
  if (kind === "character-relation") return CANON_CHARACTER_RELATION_FIELDS;
  return CANON_LORE_ENTRY_FIELDS;
}

function parseFieldName(value: unknown, label: string): CanonFieldName {
  const allFields: readonly string[] = [
    ...CANON_CHARACTER_FIELDS,
    ...CANON_CHARACTER_RELATION_FIELDS,
    ...CANON_LORE_ENTRY_FIELDS,
  ];
  if (typeof value !== "string" || !allFields.includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as CanonFieldName;
}

function parseFieldValue(
  value: unknown,
  field: CanonFieldName,
  label: string,
): CanonFieldValue {
  if (field === "aliases") return stringArray(value, label);
  if (field === "enabled") {
    if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
    return value;
  }
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (
    (field === "name" || field === "title" || field === "kind" ||
      field === "fromCharacterId" || field === "toCharacterId") &&
    value.trim().length === 0
  ) {
    throw new Error(`${label} must be non-empty`);
  }
  return value;
}

function parseFieldChange(
  value: unknown,
  label: string,
  kind?: CanonTargetKind,
  operation?: CanonReviewTarget["operation"],
): CanonFieldChange {
  const input = record(value, label);
  exact(input, ["field", "before", "after", "selected"], label);
  const field = parseFieldName(input.field, `${label}.field`);
  if (kind !== undefined && !fieldsForTarget(kind).includes(field)) {
    throw new Error(`${label}.field is unsupported for ${kind}`);
  }
  if (typeof input.selected !== "boolean") {
    throw new Error(`${label}.selected must be boolean`);
  }
  const before = input.before === null
    ? null
    : parseFieldValue(input.before, field, `${label}.before`);
  const after = parseFieldValue(input.after, field, `${label}.after`);
  if (operation === "update" && before === null) {
    throw new Error(`${label}.before must describe the update base`);
  }
  if (operation !== undefined && operation !== "update" && before !== null) {
    throw new Error(`${label}.before must be null before target resolution`);
  }
  if (
    before !== null &&
    (Array.isArray(before) !== Array.isArray(after) ||
      typeof before !== typeof after)
  ) {
    throw new Error(`${label}.before and after types must match`);
  }
  return Object.freeze({ field, before, after, selected: input.selected });
}

function parseFieldChanges(
  value: unknown,
  label: string,
  kind?: CanonTargetKind,
  operation?: CanonReviewTarget["operation"],
): readonly CanonFieldChange[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const changes = Object.freeze(value.map((entry, index) =>
    parseFieldChange(entry, `${label}[${index}]`, kind, operation)
  ));
  if (new Set(changes.map((entry) => entry.field)).size !== changes.length) {
    throw new Error(`${label} contains duplicate fields`);
  }
  return changes;
}

function parseTarget(value: unknown, label: string): CanonReviewTarget {
  const input = record(value, label);
  const kind = targetKind(input.kind, `${label}.kind`);
  if (input.operation === "create") {
    exact(input, ["kind", "operation"], label);
    return Object.freeze({ kind, operation: "create" }) as CanonCreateTarget;
  }
  if (input.operation === "unresolved") {
    exact(input, ["kind", "operation", "matchingTargetIds"], label);
    const ids = stringArray(input.matchingTargetIds, `${label}.matchingTargetIds`);
    return Object.freeze({
      kind,
      operation: "unresolved",
      matchingTargetIds: Object.freeze(ids.map((id) => entityId(id))),
    }) as CanonUnresolvedTarget;
  }
  if (input.operation !== "update") {
    throw new Error(`${label}.operation is unsupported`);
  }
  if (kind === "character") {
    exact(input, ["kind", "operation", "characterId", "expectedRevision"], label);
    return Object.freeze({
      kind,
      operation: "update",
      characterId: identifier<"Character">(input, "characterId", label),
      expectedRevision: positiveInteger(input, "expectedRevision", label),
    });
  }
  if (kind === "character-relation") {
    exact(input, ["kind", "operation", "relationId", "expectedRevision"], label);
    return Object.freeze({
      kind,
      operation: "update",
      relationId: identifier<"CharacterRelation">(input, "relationId", label),
      expectedRevision: positiveInteger(input, "expectedRevision", label),
    });
  }
  exact(input, ["kind", "operation", "loreEntryId", "expectedRevision"], label);
  return Object.freeze({
    kind,
    operation: "update",
    loreEntryId: identifier<"LoreEntry">(input, "loreEntryId", label),
    expectedRevision: positiveInteger(input, "expectedRevision", label),
  });
}

function parseEvidence(value: unknown, label: string): CanonReviewEvidence {
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
  const from = nonNegativeInteger(input, "from", label);
  const to = nonNegativeInteger(input, "to", label);
  if (to <= from) throw new Error(`${label} must be non-empty`);
  const exactText = nonEmptyString(input, "exactText", label);
  if (exactText.length !== to - from) {
    throw new Error(`${label}.exactText length must match its exact range`);
  }
  return Object.freeze({
    evidenceId: identifier<"CanonReviewEvidence">(input, "evidenceId", label),
    documentId: identifier<"Document">(input, "documentId", label),
    documentRevisionId: identifier<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
    from,
    to,
    exactText,
    anchorId: nullableIdentifier<"Anchor">(input, "anchorId", label),
  });
}

function parseItem(value: unknown, label: string): CanonReviewItem {
  const input = record(value, label);
  exact(input, [
    "itemId",
    "targetHint",
    "target",
    "assertionBasis",
    "reason",
    "evidence",
    "fieldChanges",
    "status",
    "appliedTargetId",
  ], label);
  const target = parseTarget(input.target, `${label}.target`);
  if (
    input.assertionBasis !== "explicit-evidence" &&
    input.assertionBasis !== "model-inference"
  ) {
    throw new Error(`${label}.assertionBasis is unsupported`);
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error(`${label}.evidence must be a non-empty array`);
  }
  if (
    input.status !== "pending" && input.status !== "approved" &&
    input.status !== "rejected"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  const appliedTargetId = input.appliedTargetId === null
    ? null
    : nonEmptyString(input, "appliedTargetId", label);
  if (input.status !== "approved" && appliedTargetId !== null) {
    throw new Error(`${label}.appliedTargetId requires approved status`);
  }
  const evidence = Object.freeze(input.evidence.map((entry, index) =>
    parseEvidence(entry, `${label}.evidence[${index}]`)
  ));
  if (new Set(evidence.map((entry) => entry.evidenceId)).size !== evidence.length) {
    throw new Error(`${label}.evidence contains duplicate identities`);
  }
  return Object.freeze({
    itemId: identifier<"CanonReviewItem">(input, "itemId", label),
    targetHint: nonEmptyString(input, "targetHint", label),
    target,
    assertionBasis: input.assertionBasis,
    reason: nonEmptyString(input, "reason", label),
    evidence,
    fieldChanges: parseFieldChanges(
      input.fieldChanges,
      `${label}.fieldChanges`,
      target.kind,
      target.operation,
    ),
    status: input.status,
    appliedTargetId,
  });
}

export function parseCanonReviewCandidate(value: unknown): CanonReviewCandidate {
  const label = "CanonReviewCandidate";
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
  if (input.promptVersion !== CANON_REVIEW_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  if (
    input.status !== "ready" && input.status !== "stale" &&
    input.status !== "completed" && input.status !== "superseded"
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
    throw new Error(`${label}.items contain duplicate identities`);
  }
  if (input.status === "completed" && items.some((item) => item.status === "pending")) {
    throw new Error(`${label}.completed status contains a pending item`);
  }
  return Object.freeze({
    schemaVersion: 1,
    candidateId: identifier<"CanonReviewCandidate">(input, "candidateId", label),
    revision: positiveInteger(input, "revision", label),
    requestId: identifier<"CanonReviewRequest">(input, "requestId", label),
    workId: identifier<"Work">(input, "workId", label),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    providerId: nonEmptyString(input, "providerId", label),
    modelId: nonEmptyString(input, "modelId", label),
    promptVersion: CANON_REVIEW_PROMPT_VERSION,
    status: input.status,
    items,
    contextReceiptId: identifier<"AssistantContextReceipt">(
      input,
      "contextReceiptId",
      label,
    ),
    createdAt: instant(input, "createdAt", label),
    updatedAt: instant(input, "updatedAt", label),
  });
}

export function parseRunCanonReviewCommand(value: unknown): RunCanonReviewCommand {
  const label = "RunCanonReviewCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "sourceRange",
    "requestedTargetKinds",
  ], label);
  schema(input, label);
  if (!Array.isArray(input.requestedTargetKinds) || input.requestedTargetKinds.length === 0) {
    throw new Error(`${label}.requestedTargetKinds must be a non-empty array`);
  }
  const requestedTargetKinds = Object.freeze(input.requestedTargetKinds.map(
    (entry, index) => targetKind(entry, `${label}.requestedTargetKinds[${index}]`),
  ));
  if (new Set(requestedTargetKinds).size !== requestedTargetKinds.length) {
    throw new Error(`${label}.requestedTargetKinds contains duplicates`);
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: identifier<"CanonReviewRequest">(input, "requestId", label),
    workId: identifier<"Work">(input, "workId", label),
    conversationId: identifier<"AssistantConversation">(
      input,
      "conversationId",
      label,
    ),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    requestedTargetKinds,
  });
}

export function parseListCanonReviewCandidatesCommand(
  value: unknown,
): ListCanonReviewCandidatesCommand {
  const label = "ListCanonReviewCandidatesCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "status"], label);
  schema(input, label);
  if (
    input.status !== "all" && input.status !== "actionable" &&
    input.status !== "completed"
  ) {
    throw new Error(`${label}.status is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identifier<"Work">(input, "workId", label),
    status: input.status,
  });
}

function parseCandidateIdentityCommand(
  value: unknown,
  label: string,
  fields: readonly string[],
) {
  const input = record(value, label);
  exact(input, fields, label);
  schema(input, label);
  return Object.freeze({
    input,
    workId: identifier<"Work">(input, "workId", label),
    candidateId: identifier<"CanonReviewCandidate">(input, "candidateId", label),
    expectedCandidateRevision: positiveInteger(
      input,
      "expectedCandidateRevision",
      label,
    ),
    itemId: identifier<"CanonReviewItem">(input, "itemId", label),
  });
}

export function parseUpdateCanonReviewItemCommand(
  value: unknown,
): UpdateCanonReviewItemCommand {
  const label = "UpdateCanonReviewItemCommand";
  const base = parseCandidateIdentityCommand(value, label, [
    "schemaVersion",
    "workId",
    "candidateId",
    "expectedCandidateRevision",
    "itemId",
    "fieldChanges",
  ]);
  return Object.freeze({
    schemaVersion: 1,
    workId: base.workId,
    candidateId: base.candidateId,
    expectedCandidateRevision: base.expectedCandidateRevision,
    itemId: base.itemId,
    fieldChanges: parseFieldChanges(
      base.input.fieldChanges,
      `${label}.fieldChanges`,
    ),
  });
}

function parseTargetSelection(
  value: unknown,
  label: string,
): CanonReviewTargetSelection {
  const input = record(value, label);
  if (input.kind === "create") {
    exact(input, ["kind"], label);
    return Object.freeze({ kind: "create" });
  }
  if (input.kind !== "update") throw new Error(`${label}.kind is unsupported`);
  exact(input, ["kind", "targetId", "expectedRevision"], label);
  return Object.freeze({
    kind: "update",
    targetId: nonEmptyString(input, "targetId", label),
    expectedRevision: positiveInteger(input, "expectedRevision", label),
  });
}

export function parseResolveCanonReviewItemTargetCommand(
  value: unknown,
): ResolveCanonReviewItemTargetCommand {
  const label = "ResolveCanonReviewItemTargetCommand";
  const base = parseCandidateIdentityCommand(value, label, [
    "schemaVersion",
    "workId",
    "candidateId",
    "expectedCandidateRevision",
    "itemId",
    "target",
  ]);
  return Object.freeze({
    schemaVersion: 1,
    workId: base.workId,
    candidateId: base.candidateId,
    expectedCandidateRevision: base.expectedCandidateRevision,
    itemId: base.itemId,
    target: parseTargetSelection(base.input.target, `${label}.target`),
  });
}

export function parseDecideCanonReviewItemCommand(
  value: unknown,
): DecideCanonReviewItemCommand {
  const label = "DecideCanonReviewItemCommand";
  const base = parseCandidateIdentityCommand(value, label, [
    "schemaVersion",
    "workId",
    "candidateId",
    "expectedCandidateRevision",
    "itemId",
    "decision",
  ]);
  const decisionInput = record(base.input.decision, `${label}.decision`);
  exact(decisionInput, ["kind"], `${label}.decision`);
  if (decisionInput.kind !== "approve" && decisionInput.kind !== "reject") {
    throw new Error(`${label}.decision.kind is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: base.workId,
    candidateId: base.candidateId,
    expectedCandidateRevision: base.expectedCandidateRevision,
    itemId: base.itemId,
    decision: Object.freeze({ kind: decisionInput.kind }),
  });
}

function parseEntityRef(value: unknown, label: string): CanonEntityRef {
  const parsed = parseCanonEntityRef(value, label);
  targetKind(parsed.kind, `${label}.kind`);
  return parsed as CanonEntityRef;
}

export function parseCanonReviewDecisionReceipt(
  value: unknown,
): CanonReviewDecisionReceipt {
  const label = "CanonReviewDecisionReceipt";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "receiptId",
    "workId",
    "candidateId",
    "itemId",
    "decision",
    "outcome",
    "target",
    "targetRevisionBefore",
    "targetRevisionAfter",
    "selectedFields",
    "sourceDocumentRevisionId",
    "createdAt",
  ], label);
  schema(input, label);
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new Error(`${label}.decision is unsupported`);
  }
  if (input.outcome !== "applied" && input.outcome !== "noop" && input.outcome !== "rejected") {
    throw new Error(`${label}.outcome is unsupported`);
  }
  if (!Array.isArray(input.selectedFields)) {
    throw new Error(`${label}.selectedFields must be an array`);
  }
  const selectedFields = Object.freeze(input.selectedFields.map((entry, index) =>
    parseFieldName(entry, `${label}.selectedFields[${index}]`)
  ));
  if (new Set(selectedFields).size !== selectedFields.length) {
    throw new Error(`${label}.selectedFields contains duplicates`);
  }
  const parseNullableRevision = (field: string) => input[field] === null
    ? null
    : positiveInteger(input, field, label);
  return Object.freeze({
    schemaVersion: 1,
    receiptId: identifier<"CanonReviewDecisionReceipt">(input, "receiptId", label),
    workId: identifier<"Work">(input, "workId", label),
    candidateId: identifier<"CanonReviewCandidate">(input, "candidateId", label),
    itemId: identifier<"CanonReviewItem">(input, "itemId", label),
    decision: input.decision,
    outcome: input.outcome,
    target: input.target === null ? null : parseEntityRef(input.target, `${label}.target`),
    targetRevisionBefore: parseNullableRevision("targetRevisionBefore"),
    targetRevisionAfter: parseNullableRevision("targetRevisionAfter"),
    selectedFields,
    sourceDocumentRevisionId: identifier<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    createdAt: instant(input, "createdAt", label),
  });
}

export function parseCanonReviewCandidateList(value: unknown): CanonReviewCandidateList {
  const label = "CanonReviewCandidateList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "candidates"], label);
  schema(input, label);
  if (!Array.isArray(input.candidates)) {
    throw new Error(`${label}.candidates must be an array`);
  }
  const workId = identifier<"Work">(input, "workId", label);
  const candidates = Object.freeze(input.candidates.map(parseCanonReviewCandidate));
  if (candidates.some((candidate) => candidate.workId !== workId)) {
    throw new Error(`${label}.candidates cross the Work boundary`);
  }
  return Object.freeze({ schemaVersion: 1, workId, candidates });
}

export function parseCanonReviewResult(value: unknown): CanonReviewResult {
  const label = "CanonReviewResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "login-required" || input.status === "no-change") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: input.status });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing", "destinationId"], label);
    if (!Array.isArray(input.missing)) throw new Error(`${label}.missing must be an array`);
    const missing = Object.freeze(input.missing.map((entry) => {
      if (entry !== "local-read" && entry !== "external-transmit") {
        throw new Error(`${label}.missing contains an unsupported value`);
      }
      return entry;
    }));
    return Object.freeze({
      schemaVersion: 1,
      status: "permission-required",
      missing,
      destinationId: nonEmptyString(input, "destinationId", label),
    });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
    if (
      input.reason !== "source-unavailable" && input.reason !== "outside-work" &&
      input.reason !== "stale-context" && input.reason !== "invalid-range"
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
      candidate: parseCanonReviewCandidate(input.candidate),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseCanonReviewDecisionResult(
  value: unknown,
): CanonReviewDecisionResult {
  const label = "CanonReviewDecisionResult";
  const input = record(value, label);
  schema(input, label);
  if (
    input.status === "applied" || input.status === "nothing-selected" ||
    input.status === "rejected"
  ) {
    exact(input, ["schemaVersion", "status", "candidate", "receipt"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      candidate: parseCanonReviewCandidate(input.candidate),
      receipt: parseCanonReviewDecisionReceipt(input.receipt),
    });
  }
  if (
    input.status === "source-stale" || input.status === "target-stale" ||
    input.status === "target-unresolved" ||
    input.status === "inference-requires-user-authorship"
  ) {
    exact(input, ["schemaVersion", "status", "candidate"], label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      candidate: parseCanonReviewCandidate(input.candidate),
    });
  }
  if (input.status === "possible-duplicate") {
    exact(input, [
      "schemaVersion",
      "status",
      "candidate",
      "matchingTargetIds",
    ], label);
    return Object.freeze({
      schemaVersion: 1,
      status: "possible-duplicate",
      candidate: parseCanonReviewCandidate(input.candidate),
      matchingTargetIds: stringArray(
        input.matchingTargetIds,
        `${label}.matchingTargetIds`,
      ),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}
