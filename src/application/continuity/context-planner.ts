import { entityId, type EntityId } from "../../domain/writing";
import {
  ASSISTANT_CAPABILITIES,
  parseAssistantContextRange,
  type AssistantCapability,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import { canonEntityRefKey, type CanonEntityRef } from "../canon/canon-entity-ref";
import type { AssistantContextMode } from "./assistant-context-policy";
import {
  parseAssistantContextPlanProjection,
  type AssistantContextExcludedEntry,
  type AssistantContextManifestEntry,
  type AssistantContextPlanProjection,
  type ContextInclusionReason,
} from "./assistant-context-manifest";

export type ContextPriority = "required" | "direct" | "continuity" | "recent" | "supporting";

export type PlanAssistantContextInput = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  capability: AssistantCapability;
  sourceRange: AssistantContextRange | null;
  sceneId: EntityId<"Scene"> | null;
  povCharacterId: EntityId<"Character"> | null;
  userQuery: string;
  tokenBudget: number;
}>;

export type ContextPlannerCandidate = Readonly<{
  workId: EntityId<"Work">;
  entity: CanonEntityRef;
  entityRevision: number;
  policyMode: AssistantContextMode;
  inclusionReason: ContextInclusionReason;
  priority: ContextPriority;
  estimatedTokenCount: number;
  userSelected: boolean;
  userSelectionAuthorized: boolean;
  currentSceneRelated: boolean;
  exactSourceOverlap: boolean;
  current: boolean;
  updatedAt: string;
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

function nullableId<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be an identity or null`);
  }
  return entityId<TEntity>(value.trim());
}

export function parsePlanAssistantContextInput(value: unknown): PlanAssistantContextInput {
  const label = "PlanAssistantContextInput";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "capability", "sourceRange", "sceneId", "povCharacterId", "userQuery", "tokenBudget"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  if (typeof input.workId !== "string" || input.workId.trim().length === 0) {
    throw new Error(`${label}.workId must be an identity`);
  }
  if (!(ASSISTANT_CAPABILITIES as readonly unknown[]).includes(input.capability)) {
    throw new Error(`${label}.capability is unsupported`);
  }
  if (typeof input.userQuery !== "string") throw new Error(`${label}.userQuery must be text`);
  if (typeof input.tokenBudget !== "number" || !Number.isSafeInteger(input.tokenBudget) || input.tokenBudget < 0) {
    throw new Error(`${label}.tokenBudget must be a non-negative safe integer`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">(input.workId.trim()),
    capability: input.capability as AssistantCapability,
    sourceRange: input.sourceRange === null
      ? null
      : parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    sceneId: nullableId<"Scene">(input.sceneId, `${label}.sceneId`),
    povCharacterId: nullableId<"Character">(
      input.povCharacterId,
      `${label}.povCharacterId`,
    ),
    userQuery: input.userQuery,
    tokenBudget: input.tokenBudget,
  });
}

const PRIORITY_ORDER: Readonly<Record<ContextPriority, number>> = Object.freeze({
  required: 0,
  direct: 1,
  continuity: 2,
  recent: 3,
  supporting: 4,
});

function normalized(candidate: ContextPlannerCandidate): ContextPlannerCandidate {
  if (candidate.policyMode === "required") {
    return Object.freeze({
      ...candidate,
      priority: "required",
      inclusionReason: "required-policy",
    });
  }
  if (candidate.userSelected && candidate.userSelectionAuthorized) {
    return Object.freeze({
      ...candidate,
      priority: "direct",
      inclusionReason: "user-selected",
    });
  }
  return candidate;
}

function compareCandidates(left: ContextPlannerCandidate, right: ContextPlannerCandidate): number {
  const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  if (priority !== 0) return priority;
  if (left.userSelected !== right.userSelected) return left.userSelected ? -1 : 1;
  if (left.currentSceneRelated !== right.currentSceneRelated) {
    return left.currentSceneRelated ? -1 : 1;
  }
  if (left.exactSourceOverlap !== right.exactSourceOverlap) {
    return left.exactSourceOverlap ? -1 : 1;
  }
  const updated = right.updatedAt.localeCompare(left.updatedAt);
  if (updated !== 0) return updated;
  const kind = left.entity.kind.localeCompare(right.entity.kind);
  if (kind !== 0) return kind;
  return String(left.entity.id).localeCompare(String(right.entity.id));
}

function entry(candidate: ContextPlannerCandidate): AssistantContextManifestEntry {
  return Object.freeze({
    kind: "entity",
    entity: candidate.entity,
    entityRevision: candidate.entityRevision,
    inclusionReason: candidate.inclusionReason,
  });
}

function excluded(
  candidate: ContextPlannerCandidate,
  reason: AssistantContextExcludedEntry["reason"],
): AssistantContextExcludedEntry {
  return Object.freeze({
    kind: "entity",
    entity: candidate.entity,
    entityRevision: Math.max(1, candidate.entityRevision),
    reason,
  });
}

function compareExcluded(left: AssistantContextExcludedEntry, right: AssistantContextExcludedEntry): number {
  const leftKey = left.kind === "entity" ? canonEntityRefKey(left.entity) : `digest:${left.digestId}`;
  const rightKey = right.kind === "entity" ? canonEntityRefKey(right.entity) : `digest:${right.digestId}`;
  const key = leftKey.localeCompare(rightKey);
  return key === 0 ? left.reason.localeCompare(right.reason) : key;
}

export function planAssistantContext(
  rawInput: PlanAssistantContextInput,
  rawCandidates: readonly ContextPlannerCandidate[],
): AssistantContextPlanProjection {
  const input = parsePlanAssistantContextInput(rawInput);
  const preliminaryExcluded: AssistantContextExcludedEntry[] = [];
  const eligible: ContextPlannerCandidate[] = [];

  for (const raw of rawCandidates) {
    const candidate = normalized(raw);
    if (candidate.workId !== input.workId) {
      preliminaryExcluded.push(excluded(candidate, "outside-work"));
    } else if (candidate.entityRevision < 1) {
      preliminaryExcluded.push(excluded(candidate, "missing-revision"));
    } else if (!candidate.current) {
      preliminaryExcluded.push(excluded(candidate, "stale-derived"));
    } else if (
      candidate.policyMode === "withheld" &&
      !(candidate.userSelected && candidate.userSelectionAuthorized)
    ) {
      preliminaryExcluded.push(excluded(candidate, "withheld-policy"));
    } else {
      eligible.push(candidate);
    }
  }

  const selectedByKey = new Map<string, ContextPlannerCandidate>();
  for (const candidate of [...eligible].sort(compareCandidates)) {
    const key = canonEntityRefKey(candidate.entity);
    if (selectedByKey.has(key)) {
      preliminaryExcluded.push(excluded(candidate, "duplicate"));
    } else {
      selectedByKey.set(key, candidate);
    }
  }
  const candidates = [...selectedByKey.values()].sort(compareCandidates);
  const required = candidates.filter((candidate) => candidate.priority === "required");
  const requiredTokenCount = required.reduce(
    (total, candidate) => total + candidate.estimatedTokenCount,
    0,
  );
  const baseExcluded = preliminaryExcluded.sort(compareExcluded);
  if (requiredTokenCount > input.tokenBudget) {
    return parseAssistantContextPlanProjection({
      schemaVersion: 1,
      status: "required-context-over-budget",
      workId: input.workId,
      capability: input.capability,
      tokenBudget: input.tokenBudget,
      requiredTokenCount,
      requiredEntries: required.map(entry),
      excluded: baseExcluded,
    });
  }

  const entries: AssistantContextManifestEntry[] = required.map(entry);
  const budgetExcluded: AssistantContextExcludedEntry[] = [];
  let estimatedTokenCount = requiredTokenCount;
  for (const candidate of candidates.filter((value) => value.priority !== "required")) {
    if (estimatedTokenCount + candidate.estimatedTokenCount <= input.tokenBudget) {
      entries.push(entry(candidate));
      estimatedTokenCount += candidate.estimatedTokenCount;
    } else {
      budgetExcluded.push(excluded(candidate, "over-budget"));
    }
  }
  return parseAssistantContextPlanProjection({
    schemaVersion: 1,
    status: "planned",
    workId: input.workId,
    capability: input.capability,
    tokenBudget: input.tokenBudget,
    estimatedTokenCount,
    entries,
    excluded: [...baseExcluded, ...budgetExcluded].sort(compareExcluded),
  });
}
