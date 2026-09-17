import { entityId, type EntityId } from "../../domain/writing";
import {
  ASSISTANT_CAPABILITIES,
  parseAssistantContextRange,
  type AssistantCapability,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import { parseCanonEntityRef, type CanonEntityRef } from "../canon/canon-entity-ref";

export const CONTEXT_INCLUSION_REASONS = [
  "required-policy",
  "user-selected",
  "current-scene",
  "exact-source-overlap",
  "direct-relation",
  "open-continuity",
  "pov-knowledge",
  "recent-change",
  "derived-digest",
] as const;

export const CONTEXT_EXCLUSION_REASONS = [
  "withheld-policy",
  "outside-work",
  "stale-derived",
  "duplicate",
  "over-budget",
  "not-relevant",
  "missing-revision",
] as const;

export type ContextInclusionReason = (typeof CONTEXT_INCLUSION_REASONS)[number];
export type ContextExclusionReason = (typeof CONTEXT_EXCLUSION_REASONS)[number];

export type AssistantContextManifestEntry =
  | Readonly<{
      kind: "entity";
      entity: CanonEntityRef;
      entityRevision: number;
      inclusionReason: ContextInclusionReason;
    }>
  | Readonly<{
      kind: "digest";
      digestId: EntityId<"NarrativeDigest">;
      sourceManifestHash: string;
      inclusionReason: ContextInclusionReason;
    }>;

export type AssistantContextExcludedEntry =
  | Readonly<{
      kind: "entity";
      entity: CanonEntityRef;
      entityRevision: number;
      reason: ContextExclusionReason;
    }>
  | Readonly<{
      kind: "digest";
      digestId: EntityId<"NarrativeDigest">;
      sourceManifestHash: string;
      reason: ContextExclusionReason;
    }>;

export type AssistantContextPlanProjection =
  | Readonly<{
      schemaVersion: 1;
      status: "planned";
      workId: EntityId<"Work">;
      capability: AssistantCapability;
      tokenBudget: number;
      estimatedTokenCount: number;
      entries: readonly AssistantContextManifestEntry[];
      excluded: readonly AssistantContextExcludedEntry[];
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "required-context-over-budget";
      workId: EntityId<"Work">;
      capability: AssistantCapability;
      tokenBudget: number;
      requiredTokenCount: number;
      requiredEntries: readonly AssistantContextManifestEntry[];
      excluded: readonly AssistantContextExcludedEntry[];
    }>;

export type AssistantContextManifestProjection = Readonly<{
  schemaVersion: 1;
  manifestId: EntityId<"AssistantContextManifest">;
  receiptId: EntityId<"AssistantContextReceipt">;
  workId: EntityId<"Work">;
  entries: readonly AssistantContextManifestEntry[];
  excluded: readonly AssistantContextExcludedEntry[];
  estimatedTokenCount: number;
  createdAt: string;
}>;

export type AssistantContextActivityProjection = Readonly<{
  schemaVersion: 1;
  activityId: EntityId<"AssistantContextActivity">;
  workId: EntityId<"Work">;
  receiptId: EntityId<"AssistantContextReceipt">;
  manifestId: EntityId<"AssistantContextManifest">;
  capability: AssistantCapability;
  destinationId: string;
  providerId: string;
  modelId: string;
  startedAt: string;
  completedAt: string;
  stageDurationsMs: Readonly<{
    plan: number;
    authorize: number;
    connector: number;
    persist: number;
  }>;
  readRanges: readonly AssistantContextRange[];
  transmittedRanges: readonly AssistantContextRange[];
  readCharacterCount: number;
  transmittedCharacterCount: number;
  candidateCount: number;
}>;

export type AssistantContextActivityList = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  activities: readonly AssistantContextActivityProjection[];
}>;

export type AssistantContextManifestList = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  manifests: readonly AssistantContextManifestProjection[];
}>;

export type ListAssistantContextManifestsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type ListAssistantContextActivitiesCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  if (Object.keys(input).length !== expected.size || Object.keys(input).some((key) => !expected.has(key))) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  return entityId<TEntity>(text(value, label));
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const parsed = count(value, label);
  if (parsed < 1) throw new Error(`${label} must be positive`);
  return parsed;
}

function instant(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function capability(value: unknown, label: string): AssistantCapability {
  if (!(ASSISTANT_CAPABILITIES as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as AssistantCapability;
}

function inclusion(value: unknown, label: string): ContextInclusionReason {
  if (!(CONTEXT_INCLUSION_REASONS as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as ContextInclusionReason;
}

function exclusion(value: unknown, label: string): ContextExclusionReason {
  if (!(CONTEXT_EXCLUSION_REASONS as readonly unknown[]).includes(value)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as ContextExclusionReason;
}

function parseEntry(value: unknown, label: string): AssistantContextManifestEntry {
  const input = record(value, label);
  if (input.kind === "entity") {
    exact(input, ["kind", "entity", "entityRevision", "inclusionReason"], label);
    return Object.freeze({
      kind: "entity",
      entity: parseCanonEntityRef(input.entity, `${label}.entity`),
      entityRevision: positive(input.entityRevision, `${label}.entityRevision`),
      inclusionReason: inclusion(input.inclusionReason, `${label}.inclusionReason`),
    });
  }
  if (input.kind === "digest") {
    exact(input, ["kind", "digestId", "sourceManifestHash", "inclusionReason"], label);
    return Object.freeze({
      kind: "digest",
      digestId: id<"NarrativeDigest">(input.digestId, `${label}.digestId`),
      sourceManifestHash: text(input.sourceManifestHash, `${label}.sourceManifestHash`),
      inclusionReason: inclusion(input.inclusionReason, `${label}.inclusionReason`),
    });
  }
  throw new Error(`${label}.kind is unsupported`);
}

function parseExcluded(value: unknown, label: string): AssistantContextExcludedEntry {
  const input = record(value, label);
  if (input.kind === "entity") {
    exact(input, ["kind", "entity", "entityRevision", "reason"], label);
    return Object.freeze({
      kind: "entity",
      entity: parseCanonEntityRef(input.entity, `${label}.entity`),
      entityRevision: positive(input.entityRevision, `${label}.entityRevision`),
      reason: exclusion(input.reason, `${label}.reason`),
    });
  }
  if (input.kind === "digest") {
    exact(input, ["kind", "digestId", "sourceManifestHash", "reason"], label);
    return Object.freeze({
      kind: "digest",
      digestId: id<"NarrativeDigest">(input.digestId, `${label}.digestId`),
      sourceManifestHash: text(input.sourceManifestHash, `${label}.sourceManifestHash`),
      reason: exclusion(input.reason, `${label}.reason`),
    });
  }
  throw new Error(`${label}.kind is unsupported`);
}

function list<T>(value: unknown, label: string, parse: (entry: unknown, label: string) => T): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) => parse(entry, `${label}[${index}]`)));
}

export function parseAssistantContextPlanProjection(value: unknown): AssistantContextPlanProjection {
  const label = "AssistantContextPlanProjection";
  const input = record(value, label);
  if (input.status === "planned") {
    exact(input, ["schemaVersion", "status", "workId", "capability", "tokenBudget", "estimatedTokenCount", "entries", "excluded"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: "planned",
      workId: id<"Work">(input.workId, `${label}.workId`),
      capability: capability(input.capability, `${label}.capability`),
      tokenBudget: count(input.tokenBudget, `${label}.tokenBudget`),
      estimatedTokenCount: count(input.estimatedTokenCount, `${label}.estimatedTokenCount`),
      entries: list(input.entries, `${label}.entries`, parseEntry),
      excluded: list(input.excluded, `${label}.excluded`, parseExcluded),
    });
  }
  if (input.status === "required-context-over-budget") {
    exact(input, ["schemaVersion", "status", "workId", "capability", "tokenBudget", "requiredTokenCount", "requiredEntries", "excluded"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: "required-context-over-budget",
      workId: id<"Work">(input.workId, `${label}.workId`),
      capability: capability(input.capability, `${label}.capability`),
      tokenBudget: count(input.tokenBudget, `${label}.tokenBudget`),
      requiredTokenCount: count(input.requiredTokenCount, `${label}.requiredTokenCount`),
      requiredEntries: list(input.requiredEntries, `${label}.requiredEntries`, parseEntry),
      excluded: list(input.excluded, `${label}.excluded`, parseExcluded),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseAssistantContextManifestProjection(
  value: unknown,
): AssistantContextManifestProjection {
  const label = "AssistantContextManifestProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "manifestId", "receiptId", "workId", "entries", "excluded", "estimatedTokenCount", "createdAt"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    manifestId: id<"AssistantContextManifest">(input.manifestId, `${label}.manifestId`),
    receiptId: id<"AssistantContextReceipt">(input.receiptId, `${label}.receiptId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    entries: list(input.entries, `${label}.entries`, parseEntry),
    excluded: list(input.excluded, `${label}.excluded`, parseExcluded),
    estimatedTokenCount: count(input.estimatedTokenCount, `${label}.estimatedTokenCount`),
    createdAt: instant(input.createdAt, `${label}.createdAt`),
  });
}

function parseActivity(value: unknown, label: string): AssistantContextActivityProjection {
  const input = record(value, label);
  exact(input, ["schemaVersion", "activityId", "workId", "receiptId", "manifestId", "capability", "destinationId", "providerId", "modelId", "startedAt", "completedAt", "stageDurationsMs", "readRanges", "transmittedRanges", "readCharacterCount", "transmittedCharacterCount", "candidateCount"], label);
  schema(input, label);
  const durations = record(input.stageDurationsMs, `${label}.stageDurationsMs`);
  exact(durations, ["plan", "authorize", "connector", "persist"], `${label}.stageDurationsMs`);
  return Object.freeze({
    schemaVersion: 1,
    activityId: id<"AssistantContextActivity">(input.activityId, `${label}.activityId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    receiptId: id<"AssistantContextReceipt">(input.receiptId, `${label}.receiptId`),
    manifestId: id<"AssistantContextManifest">(input.manifestId, `${label}.manifestId`),
    capability: capability(input.capability, `${label}.capability`),
    destinationId: text(input.destinationId, `${label}.destinationId`),
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    startedAt: instant(input.startedAt, `${label}.startedAt`),
    completedAt: instant(input.completedAt, `${label}.completedAt`),
    stageDurationsMs: Object.freeze({
      plan: count(durations.plan, `${label}.stageDurationsMs.plan`),
      authorize: count(durations.authorize, `${label}.stageDurationsMs.authorize`),
      connector: count(durations.connector, `${label}.stageDurationsMs.connector`),
      persist: count(durations.persist, `${label}.stageDurationsMs.persist`),
    }),
    readRanges: list(input.readRanges, `${label}.readRanges`, (entry, entryLabel) =>
      parseAssistantContextRange(entry, entryLabel)),
    transmittedRanges: list(
      input.transmittedRanges,
      `${label}.transmittedRanges`,
      (entry, entryLabel) => parseAssistantContextRange(entry, entryLabel),
    ),
    readCharacterCount: count(input.readCharacterCount, `${label}.readCharacterCount`),
    transmittedCharacterCount: count(input.transmittedCharacterCount, `${label}.transmittedCharacterCount`),
    candidateCount: count(input.candidateCount, `${label}.candidateCount`),
  });
}

export function parseAssistantContextActivityList(value: unknown): AssistantContextActivityList {
  const label = "AssistantContextActivityList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "activities"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const activities = list(input.activities, `${label}.activities`, parseActivity);
  if (activities.some((activity) => activity.workId !== workId)) {
    throw new Error(`${label}.activities must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, activities });
}

export function parseAssistantContextManifestList(value: unknown): AssistantContextManifestList {
  const label = "AssistantContextManifestList";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "manifests"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  const manifests = list(
    input.manifests,
    `${label}.manifests`,
    (entry) => parseAssistantContextManifestProjection(entry),
  );
  if (manifests.some((manifest) => manifest.workId !== workId)) {
    throw new Error(`${label}.manifests must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, manifests });
}

function parseWorkCommand<T extends ListAssistantContextManifestsCommand | ListAssistantContextActivitiesCommand>(
  value: unknown,
  label: string,
): T {
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
  }) as T;
}

export function parseListAssistantContextManifestsCommand(
  value: unknown,
): ListAssistantContextManifestsCommand {
  return parseWorkCommand(value, "ListAssistantContextManifestsCommand");
}

export function parseListAssistantContextActivitiesCommand(
  value: unknown,
): ListAssistantContextActivitiesCommand {
  return parseWorkCommand(value, "ListAssistantContextActivitiesCommand");
}
