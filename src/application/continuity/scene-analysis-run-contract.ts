import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseNarrativeDigestProjection,
  type NarrativeDigestProjection,
} from "./narrative-digest-contract";
import {
  parseNarrativeDigestSceneTrigger,
  type NarrativeDigestSceneTrigger,
} from "./narrative-digest-manifest";

export const SCENE_ANALYSIS_LORE_STATUSES = [
  "pending",
  "candidate",
  "no-change",
  "login-required",
  "permission-required",
  "context-rejected",
  "failed",
] as const;

export type SceneAnalysisLoreStatus =
  (typeof SCENE_ANALYSIS_LORE_STATUSES)[number];

export type SceneAnalysisRunProjection = Readonly<{
  schemaVersion: 1;
  runId: EntityId<"SceneAnalysisRun">;
  revision: number;
  workId: EntityId<"Work">;
  sceneId: EntityId<"Scene">;
  digestId: EntityId<"NarrativeDigest">;
  sourceFingerprint: string;
  trigger: NarrativeDigestSceneTrigger;
  loreStatus: SceneAnalysisLoreStatus;
  canonCandidateId: EntityId<"CanonReviewCandidate"> | null;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type SceneAnalysisRunListProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  runs: readonly SceneAnalysisRunProjection[];
}>;

export type RunAutomaticSceneAnalysisCommand = Readonly<{
  schemaVersion: 1;
  digestRequestId: EntityId<"NarrativeDigestRequest">;
  canonRequestId: EntityId<"CanonReviewRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  sceneId: EntityId<"Scene">;
  sourceRange: AssistantContextRange;
  trigger: NarrativeDigestSceneTrigger;
}>;

export type ListSceneAnalysisRunsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

type PermissionRequiredFields = Readonly<{
  schemaVersion: 1;
  missing: readonly AssistantContextPermissionMissing[];
  destinationId: string;
}>;

type ContextRejectedFields = Readonly<{
  schemaVersion: 1;
  reason: "source-unavailable" | "outside-work" | "stale-context" | "invalid-range";
  documentId: EntityId<"Document">;
}>;

export type AutomaticSceneAnalysisResult =
  | Readonly<{ schemaVersion: 1; status: "disabled" | "login-required" }>
  | Readonly<PermissionRequiredFields & { status: "permission-required" }>
  | Readonly<ContextRejectedFields & { status: "context-rejected" }>
  | Readonly<{
      schemaVersion: 1;
      status: "completed" | "unchanged" | "lore-login-required" | "lore-failed";
      digest: NarrativeDigestProjection;
      run: SceneAnalysisRunProjection;
    }>
  | Readonly<PermissionRequiredFields & {
      status: "lore-permission-required";
      digest: NarrativeDigestProjection;
      run: SceneAnalysisRunProjection;
    }>
  | Readonly<ContextRejectedFields & {
      status: "lore-context-rejected";
      digest: NarrativeDigestProjection;
      run: SceneAnalysisRunProjection;
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
  ) throw new Error(`${label} fields do not match the schema`);
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

function integer(value: unknown, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function instant(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be an instant`);
  return parsed;
}

function permissionMissing(value: unknown, label: string) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => entry !== "local-read" && entry !== "external-transmit")
  ) throw new Error(`${label} is invalid`);
  return Object.freeze([...value]) as readonly AssistantContextPermissionMissing[];
}

function rejectionReason(
  value: unknown,
  label: string,
): ContextRejectedFields["reason"] {
  if (
    value !== "source-unavailable" &&
    value !== "outside-work" &&
    value !== "stale-context" &&
    value !== "invalid-range"
  ) throw new Error(`${label} is invalid`);
  return value;
}

export function parseRunAutomaticSceneAnalysisCommand(
  value: unknown,
): RunAutomaticSceneAnalysisCommand {
  const label = "RunAutomaticSceneAnalysisCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "digestRequestId",
    "canonRequestId",
    "workId",
    "conversationId",
    "sceneId",
    "sourceRange",
    "trigger",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    digestRequestId: id<"NarrativeDigestRequest">(
      input.digestRequestId,
      `${label}.digestRequestId`,
    ),
    canonRequestId: id<"CanonReviewRequest">(
      input.canonRequestId,
      `${label}.canonRequestId`,
    ),
    workId: id<"Work">(input.workId, `${label}.workId`),
    conversationId: id<"AssistantConversation">(
      input.conversationId,
      `${label}.conversationId`,
    ),
    sceneId: id<"Scene">(input.sceneId, `${label}.sceneId`),
    sourceRange: parseAssistantContextRange(input.sourceRange, `${label}.sourceRange`),
    trigger: parseNarrativeDigestSceneTrigger(input.trigger, `${label}.trigger`),
  });
}

export function parseListSceneAnalysisRunsCommand(
  value: unknown,
): ListSceneAnalysisRunsCommand {
  const label = "ListSceneAnalysisRunsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input.workId, `${label}.workId`),
  });
}

export function parseSceneAnalysisRunProjection(
  value: unknown,
): SceneAnalysisRunProjection {
  const label = "SceneAnalysisRunProjection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "runId",
    "revision",
    "workId",
    "sceneId",
    "digestId",
    "sourceFingerprint",
    "trigger",
    "loreStatus",
    "canonCandidateId",
    "attemptCount",
    "lastError",
    "createdAt",
    "updatedAt",
  ], label);
  schema(input, label);
  if (
    typeof input.loreStatus !== "string" ||
    !SCENE_ANALYSIS_LORE_STATUSES.includes(input.loreStatus as SceneAnalysisLoreStatus)
  ) throw new Error(`${label}.loreStatus is unsupported`);
  const loreStatus = input.loreStatus as SceneAnalysisLoreStatus;
  const canonCandidateId = input.canonCandidateId === null
    ? null
    : id<"CanonReviewCandidate">(
        input.canonCandidateId,
        `${label}.canonCandidateId`,
      );
  if ((loreStatus === "candidate") !== (canonCandidateId !== null)) {
    throw new Error(`${label}.canonCandidateId disagrees with loreStatus`);
  }
  const lastError = input.lastError === null
    ? null
    : text(input.lastError, `${label}.lastError`);
  if ((loreStatus === "failed") !== (lastError !== null)) {
    throw new Error(`${label}.lastError disagrees with loreStatus`);
  }
  return Object.freeze({
    schemaVersion: 1,
    runId: id<"SceneAnalysisRun">(input.runId, `${label}.runId`),
    revision: integer(input.revision, `${label}.revision`, 1),
    workId: id<"Work">(input.workId, `${label}.workId`),
    sceneId: id<"Scene">(input.sceneId, `${label}.sceneId`),
    digestId: id<"NarrativeDigest">(input.digestId, `${label}.digestId`),
    sourceFingerprint: text(input.sourceFingerprint, `${label}.sourceFingerprint`),
    trigger: parseNarrativeDigestSceneTrigger(input.trigger, `${label}.trigger`),
    loreStatus,
    canonCandidateId,
    attemptCount: integer(input.attemptCount, `${label}.attemptCount`, 0),
    lastError,
    createdAt: instant(input.createdAt, `${label}.createdAt`),
    updatedAt: instant(input.updatedAt, `${label}.updatedAt`),
  });
}

export function parseSceneAnalysisRunListProjection(
  value: unknown,
): SceneAnalysisRunListProjection {
  const label = "SceneAnalysisRunListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "runs"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  if (!Array.isArray(input.runs)) throw new Error(`${label}.runs must be an array`);
  const runs = Object.freeze(input.runs.map(parseSceneAnalysisRunProjection));
  if (runs.some((run) => run.workId !== workId)) {
    throw new Error(`${label}.runs must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, runs });
}

export function parseAutomaticSceneAnalysisResult(
  value: unknown,
): AutomaticSceneAnalysisResult {
  const label = "AutomaticSceneAnalysisResult";
  const input = record(value, label);
  if (input.status === "disabled" || input.status === "login-required") {
    exact(input, ["schemaVersion", "status"], label);
    schema(input, label);
    return Object.freeze({ schemaVersion: 1, status: input.status });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing", "destinationId"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      missing: permissionMissing(input.missing, `${label}.missing`),
      destinationId: text(input.destinationId, `${label}.destinationId`),
    });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      reason: rejectionReason(input.reason, `${label}.reason`),
      documentId: id<"Document">(input.documentId, `${label}.documentId`),
    });
  }
  const terminal = [
    "completed",
    "unchanged",
    "lore-login-required",
    "lore-failed",
  ] as const;
  if (terminal.includes(input.status as (typeof terminal)[number])) {
    exact(input, ["schemaVersion", "status", "digest", "run"], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status as (typeof terminal)[number],
      digest: parseNarrativeDigestProjection(input.digest),
      run: parseSceneAnalysisRunProjection(input.run),
    });
  }
  if (input.status === "lore-permission-required") {
    exact(input, [
      "schemaVersion",
      "status",
      "missing",
      "destinationId",
      "digest",
      "run",
    ], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      missing: permissionMissing(input.missing, `${label}.missing`),
      destinationId: text(input.destinationId, `${label}.destinationId`),
      digest: parseNarrativeDigestProjection(input.digest),
      run: parseSceneAnalysisRunProjection(input.run),
    });
  }
  if (input.status === "lore-context-rejected") {
    exact(input, [
      "schemaVersion",
      "status",
      "reason",
      "documentId",
      "digest",
      "run",
    ], label);
    schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      reason: rejectionReason(input.reason, `${label}.reason`),
      documentId: id<"Document">(input.documentId, `${label}.documentId`),
      digest: parseNarrativeDigestProjection(input.digest),
      run: parseSceneAnalysisRunProjection(input.run),
    });
  }
  throw new Error(`${label}.status is unsupported`);
}
