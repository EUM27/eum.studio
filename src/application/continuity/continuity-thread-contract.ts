import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseCanonEntityRef,
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../canon/canon-entity-ref";

export const CONTINUITY_THREAD_KINDS = [
  "promise",
  "open-question",
  "temporary-state",
  "inventory",
  "location",
  "injury",
  "relationship-state",
  "constraint",
  "other",
] as const;

export type ContinuityThreadKind = (typeof CONTINUITY_THREAD_KINDS)[number];
export type ContinuityThreadStatus = "open" | "resolved" | "dismissed";
export type ContinuityResolutionMode = "manual" | "evidence";
export type ContinuityIntegrity = "resolved" | "needsReview" | "broken";

export type ContinuityEvidenceProjection = Readonly<{
  anchorId: EntityId<"Anchor">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  exactText: string;
  integrity: ContinuityIntegrity;
  range: Readonly<{ from: number; to: number }> | null;
}>;

export type ContinuityTransitionProjection = Readonly<{
  transitionId: EntityId<"ContinuityTransition">;
  threadId: EntityId<"ContinuityThread">;
  kind: "created" | "updated" | "resolved" | "dismissed";
  revisionBefore: number | null;
  revisionAfter: number;
  resolutionMode: ContinuityResolutionMode | null;
  reason: string;
  evidenceAnchorIds: readonly EntityId<"Anchor">[];
  createdAt: string;
}>;

export type ContinuityThreadProjection = Readonly<{
  schemaVersion: 1;
  threadId: EntityId<"ContinuityThread">;
  revision: number;
  workId: EntityId<"Work">;
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  subjectRefs: readonly CanonEntityRef[];
  status: ContinuityThreadStatus;
  openedEvidence: readonly ContinuityEvidenceProjection[];
  resolutionEvidence: readonly ContinuityEvidenceProjection[];
  history: readonly ContinuityTransitionProjection[];
  openedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}>;

export type ContinuityProjectedSource = Readonly<{
  sourceKind: "plot-thread" | "foreshadow-line" | "character-goal";
  entity: Extract<
    CanonEntityRef,
    { kind: "plot-thread" | "foreshadow-line" | "character" }
  >;
  revision: number;
  title: string;
  note: string;
  active: boolean;
}>;

export type ContinuityOverviewProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  threads: readonly ContinuityThreadProjection[];
  projectedSources: readonly ContinuityProjectedSource[];
}>;

export type CreateContinuityThreadCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  subjectRefs: readonly CanonEntityRef[];
  openedEvidenceRange: AssistantContextRange | null;
}>;

export type UpdateContinuityThreadCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  threadId: EntityId<"ContinuityThread">;
  expectedRevision: number;
  kind: ContinuityThreadKind;
  title: string;
  note: string;
  subjectRefs: readonly CanonEntityRef[];
}>;

export type ResolveContinuityThreadCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  threadId: EntityId<"ContinuityThread">;
  expectedRevision: number;
  resolutionMode: ContinuityResolutionMode;
  resolutionEvidenceRange: AssistantContextRange | null;
  reason: string;
}>;

export type DismissContinuityThreadCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  threadId: EntityId<"ContinuityThread">;
  expectedRevision: number;
  reason: string;
}>;

export type ListContinuityThreadsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  status: "all" | "open" | "closed";
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

function text(
  value: unknown,
  label: string,
  options: Readonly<{ allowEmpty?: boolean }> = {},
): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const trimmed = value.trim();
  if (options.allowEmpty !== true && trimmed.length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return options.allowEmpty === true ? value : trimmed;
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

function nullablePositiveInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function instant(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function nullableInstant(value: unknown, label: string): string | null {
  return value === null ? null : instant(value, label);
}

function threadKind(value: unknown, label: string): ContinuityThreadKind {
  if (!(CONTINUITY_THREAD_KINDS as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as ContinuityThreadKind;
}

function nullableRange(value: unknown, label: string): AssistantContextRange | null {
  return value === null ? null : parseAssistantContextRange(value, label);
}

function parseEvidence(
  value: unknown,
  label: string,
): ContinuityEvidenceProjection {
  const input = record(value, label);
  exact(input, [
    "anchorId",
    "documentId",
    "documentRevisionId",
    "exactText",
    "integrity",
    "range",
  ], label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is unsupported`);
  }
  let range: Readonly<{ from: number; to: number }> | null = null;
  if (input.range !== null) {
    const rangeInput = record(input.range, `${label}.range`);
    exact(rangeInput, ["from", "to"], `${label}.range`);
    const from = Number(rangeInput.from);
    const to = Number(rangeInput.to);
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from < 0 ||
      to <= from
    ) {
      throw new Error(`${label}.range is invalid`);
    }
    range = Object.freeze({ from, to });
  }
  if (input.integrity === "resolved" && range === null) {
    throw new Error(`${label}.resolved evidence requires a range`);
  }
  return Object.freeze({
    anchorId: id<"Anchor">(input.anchorId, `${label}.anchorId`),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentRevisionId: id<"DocumentRevision">(
      input.documentRevisionId,
      `${label}.documentRevisionId`,
    ),
    exactText: exactText(input.exactText, `${label}.exactText`),
    integrity: input.integrity,
    range,
  });
}

function parseEvidenceList(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const entries = Object.freeze(value.map((entry, index) =>
    parseEvidence(entry, `${label}[${index}]`)
  ));
  const ids = entries.map((entry) => entry.anchorId);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains duplicate Anchors`);
  }
  return entries;
}

function parseTransition(
  value: unknown,
  label: string,
): ContinuityTransitionProjection {
  const input = record(value, label);
  exact(input, [
    "transitionId",
    "threadId",
    "kind",
    "revisionBefore",
    "revisionAfter",
    "resolutionMode",
    "reason",
    "evidenceAnchorIds",
    "createdAt",
  ], label);
  if (
    input.kind !== "created" &&
    input.kind !== "updated" &&
    input.kind !== "resolved" &&
    input.kind !== "dismissed"
  ) {
    throw new Error(`${label}.kind is unsupported`);
  }
  if (
    input.resolutionMode !== null &&
    input.resolutionMode !== "manual" &&
    input.resolutionMode !== "evidence"
  ) {
    throw new Error(`${label}.resolutionMode is unsupported`);
  }
  if (!Array.isArray(input.evidenceAnchorIds)) {
    throw new Error(`${label}.evidenceAnchorIds must be an array`);
  }
  const evidenceAnchorIds = Object.freeze(input.evidenceAnchorIds.map(
    (entry, index) => id<"Anchor">(entry, `${label}.evidenceAnchorIds[${index}]`),
  ));
  if (new Set(evidenceAnchorIds).size !== evidenceAnchorIds.length) {
    throw new Error(`${label}.evidenceAnchorIds contains duplicates`);
  }
  const revisionBefore = nullablePositiveInteger(
    input.revisionBefore,
    `${label}.revisionBefore`,
  );
  const revisionAfter = positiveInteger(input.revisionAfter, `${label}.revisionAfter`);
  if (
    (input.kind === "created") !== (revisionBefore === null) ||
    (revisionBefore !== null && revisionAfter !== revisionBefore + 1)
  ) {
    throw new Error(`${label} revision transition is invalid`);
  }
  return Object.freeze({
    transitionId: id<"ContinuityTransition">(
      input.transitionId,
      `${label}.transitionId`,
    ),
    threadId: id<"ContinuityThread">(input.threadId, `${label}.threadId`),
    kind: input.kind,
    revisionBefore,
    revisionAfter,
    resolutionMode: input.resolutionMode,
    reason: text(input.reason, `${label}.reason`, { allowEmpty: true }),
    evidenceAnchorIds,
    createdAt: instant(input.createdAt, `${label}.createdAt`),
  });
}

export function parseCreateContinuityThreadCommand(
  value: unknown,
): CreateContinuityThreadCommand {
  const label = "CreateContinuityThreadCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "kind",
    "title",
    "note",
    "subjectRefs",
    "openedEvidenceRange",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    kind: threadKind(input.kind, `${label}.kind`),
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, { allowEmpty: true }),
    subjectRefs: parseCanonEntityRefList(input.subjectRefs, `${label}.subjectRefs`),
    openedEvidenceRange: nullableRange(
      input.openedEvidenceRange,
      `${label}.openedEvidenceRange`,
    ),
  });
}

export function parseUpdateContinuityThreadCommand(
  value: unknown,
): UpdateContinuityThreadCommand {
  const label = "UpdateContinuityThreadCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "threadId",
    "expectedRevision",
    "kind",
    "title",
    "note",
    "subjectRefs",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    threadId: id<"ContinuityThread">(input.threadId, `${label}.threadId`),
    expectedRevision: positiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    kind: threadKind(input.kind, `${label}.kind`),
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, { allowEmpty: true }),
    subjectRefs: parseCanonEntityRefList(input.subjectRefs, `${label}.subjectRefs`),
  });
}

export function parseResolveContinuityThreadCommand(
  value: unknown,
): ResolveContinuityThreadCommand {
  const label = "ResolveContinuityThreadCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "workId",
    "threadId",
    "expectedRevision",
    "resolutionMode",
    "resolutionEvidenceRange",
    "reason",
  ], label);
  schema(input, label);
  if (input.resolutionMode !== "manual" && input.resolutionMode !== "evidence") {
    throw new Error(`${label}.resolutionMode is unsupported`);
  }
  const resolutionEvidenceRange = nullableRange(
    input.resolutionEvidenceRange,
    `${label}.resolutionEvidenceRange`,
  );
  if (input.resolutionMode === "evidence" && resolutionEvidenceRange === null) {
    throw new Error(`${label} evidence mode requires an exact range`);
  }
  if (input.resolutionMode === "manual" && resolutionEvidenceRange !== null) {
    throw new Error(`${label} manual mode cannot include an evidence range`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    threadId: id<"ContinuityThread">(input.threadId, `${label}.threadId`),
    expectedRevision: positiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    resolutionMode: input.resolutionMode,
    resolutionEvidenceRange,
    reason: text(input.reason, `${label}.reason`),
  });
}

export function parseDismissContinuityThreadCommand(
  value: unknown,
): DismissContinuityThreadCommand {
  const label = "DismissContinuityThreadCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "threadId", "expectedRevision", "reason"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    threadId: id<"ContinuityThread">(input.threadId, `${label}.threadId`),
    expectedRevision: positiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    reason: text(input.reason, `${label}.reason`),
  });
}

export function parseListContinuityThreadsCommand(
  value: unknown,
): ListContinuityThreadsCommand {
  const label = "ListContinuityThreadsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "status"], label);
  schema(input, label);
  if (input.status !== "all" && input.status !== "open" && input.status !== "closed") {
    throw new Error(`${label}.status is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
    status: input.status,
  });
}

export function parseContinuityThreadProjection(
  value: unknown,
): ContinuityThreadProjection {
  const label = "ContinuityThreadProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "threadId",
    "revision",
    "workId",
    "kind",
    "title",
    "note",
    "subjectRefs",
    "status",
    "openedEvidence",
    "resolutionEvidence",
    "history",
    "openedAt",
    "resolvedAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (input.status !== "open" && input.status !== "resolved" && input.status !== "dismissed") {
    throw new Error(`${label}.status is unsupported`);
  }
  const threadId = id<"ContinuityThread">(input.threadId, `${label}.threadId`);
  const resolvedAt = nullableInstant(input.resolvedAt, `${label}.resolvedAt`);
  if ((input.status === "open") !== (resolvedAt === null)) {
    throw new Error(`${label}.resolvedAt does not match status`);
  }
  if (!Array.isArray(input.history)) throw new Error(`${label}.history must be an array`);
  const history = Object.freeze(input.history.map((entry, index) => {
    const parsed = parseTransition(entry, `${label}.history[${index}]`);
    if (parsed.threadId !== threadId) {
      throw new Error(`${label}.history[${index}] belongs to another thread`);
    }
    return parsed;
  }));
  return Object.freeze({
    schemaVersion: 1,
    threadId,
    revision: positiveInteger(input.revision, `${label}.revision`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    kind: threadKind(input.kind, `${label}.kind`),
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, { allowEmpty: true }),
    subjectRefs: parseCanonEntityRefList(input.subjectRefs, `${label}.subjectRefs`),
    status: input.status,
    openedEvidence: parseEvidenceList(input.openedEvidence, `${label}.openedEvidence`),
    resolutionEvidence: parseEvidenceList(
      input.resolutionEvidence,
      `${label}.resolutionEvidence`,
    ),
    history,
    openedAt: instant(input.openedAt, `${label}.openedAt`),
    resolvedAt,
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

function parseProjectedSource(
  value: unknown,
  label: string,
): ContinuityProjectedSource {
  const input = record(value, label);
  exact(input, ["sourceKind", "entity", "revision", "title", "note", "active"], label);
  if (
    input.sourceKind !== "plot-thread" &&
    input.sourceKind !== "foreshadow-line" &&
    input.sourceKind !== "character-goal"
  ) {
    throw new Error(`${label}.sourceKind is unsupported`);
  }
  const entity = parseCanonEntityRef(input.entity, `${label}.entity`);
  const expectedKind = input.sourceKind === "character-goal"
    ? "character"
    : input.sourceKind;
  if (entity.kind !== expectedKind) {
    throw new Error(`${label}.entity does not match sourceKind`);
  }
  if (typeof input.active !== "boolean") throw new Error(`${label}.active must be boolean`);
  return Object.freeze({
    sourceKind: input.sourceKind,
    entity: entity as ContinuityProjectedSource["entity"],
    revision: positiveInteger(input.revision, `${label}.revision`),
    title: text(input.title, `${label}.title`),
    note: text(input.note, `${label}.note`, { allowEmpty: true }),
    active: input.active,
  });
}

export function parseContinuityOverviewProjection(
  value: unknown,
): ContinuityOverviewProjection {
  const label = "ContinuityOverviewProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "threads", "projectedSources"], label);
  schema(input, label);
  if (!Array.isArray(input.threads) || !Array.isArray(input.projectedSources)) {
    throw new Error(`${label} collections must be arrays`);
  }
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const threads = Object.freeze(input.threads.map((entry, index) => {
    const parsed = parseContinuityThreadProjection(entry);
    if (parsed.workId !== workId) {
      throw new Error(`${label}.threads[${index}] is outside Work`);
    }
    return parsed;
  }));
  const projectedSources = Object.freeze(input.projectedSources.map(
    (entry, index) => parseProjectedSource(entry, `${label}.projectedSources[${index}]`),
  ));
  const sourceKeys = projectedSources.map((entry) =>
    `${entry.sourceKind}:${entry.entity.kind}:${entry.entity.id}`
  );
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    throw new Error(`${label}.projectedSources contains duplicates`);
  }
  return Object.freeze({ schemaVersion: 1, workId, threads, projectedSources });
}
