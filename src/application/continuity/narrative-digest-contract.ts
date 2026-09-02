import { entityId, type EntityId } from "../../domain/writing";
import {
  parseAssistantContextRange,
  type AssistantContextPermissionMissing,
  type AssistantContextRange,
} from "../assistant/assistant-context-permission";
import {
  parseNarrativeDigestScope,
  parseNarrativeDigestSceneTrigger,
  parseNarrativeDigestSceneSource,
  parseNarrativeDigestSourceManifest,
  type NarrativeDigestSceneSource,
  type NarrativeDigestSceneTrigger,
  type NarrativeDigestScope,
  type NarrativeDigestSourceManifest,
} from "./narrative-digest-manifest";

export const NARRATIVE_DIGEST_PROMPT_VERSION = "eum-narrative-digest-v2" as const;

export type NarrativeDigestProjection = Readonly<{
  schemaVersion: 1;
  digestId: EntityId<"NarrativeDigest">;
  workId: EntityId<"Work">;
  scope: NarrativeDigestScope;
  sceneSource: NarrativeDigestSceneSource | null;
  sourceManifest: NarrativeDigestSourceManifest;
  sourceManifestHash: string;
  text: string;
  providerId: string;
  modelId: string;
  promptVersion: string;
  integrity: "current" | "stale";
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  createdAt: string;
}>;

export type NarrativeDigestListProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  digests: readonly NarrativeDigestProjection[];
}>;

export type GenerateNarrativeDigestCommand = Readonly<{
  schemaVersion: 1;
  requestId: EntityId<"NarrativeDigestRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  scope: NarrativeDigestScope;
  documentIds: readonly EntityId<"Document">[];
}>;

export type RegenerateNarrativeDigestCommand = Readonly<{
  schemaVersion: 1;
  requestId: EntityId<"NarrativeDigestRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  digestId: EntityId<"NarrativeDigest">;
}>;

export type GenerateSceneNarrativeDigestCommand = Readonly<{
  schemaVersion: 1;
  requestId: EntityId<"NarrativeDigestRequest">;
  workId: EntityId<"Work">;
  conversationId: EntityId<"AssistantConversation">;
  sceneId: EntityId<"Scene">;
  sourceRange: AssistantContextRange;
  trigger: NarrativeDigestSceneTrigger;
}>;

export type ListNarrativeDigestsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type NarrativeDigestResult =
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
  | Readonly<{
      schemaVersion: 1;
      status: "generated";
      digest: NarrativeDigestProjection;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "unchanged";
      digest: NarrativeDigestProjection;
    }>;

export type NarrativeDigestCanonicalSource = Readonly<{
  kind:
    | "event-block"
    | "character"
    | "character-relation"
    | "lore-entry"
    | "continuity-thread"
    | "character-knowledge";
  id: string;
  revision: number;
  content: Readonly<Record<string, string>>;
}>;

export type NarrativeDigestConnectorInput = Readonly<{
  requestId: EntityId<"NarrativeDigestRequest">;
  scope: NarrativeDigestScope;
  sourceManifest: NarrativeDigestSourceManifest;
  documents: readonly Readonly<{
    documentId: EntityId<"Document">;
    documentRevisionId: EntityId<"DocumentRevision">;
    from: number;
    to: number;
    text: string;
  }>[];
  sceneSource: NarrativeDigestSceneSource | null;
  canonicalSources: readonly NarrativeDigestCanonicalSource[];
}>;

export type NarrativeDigestConnectorExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof NARRATIVE_DIGEST_PROMPT_VERSION;
  text: string;
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

function documentIds(value: unknown, label: string): readonly EntityId<"Document">[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty explicit array`);
  }
  const ids = value.map((entry, index) => id<"Document">(entry, `${label}[${index}]`))
    .sort((a, b) => String(a).localeCompare(String(b)));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicates`);
  return Object.freeze(ids);
}

export function parseGenerateNarrativeDigestCommand(
  value: unknown,
): GenerateNarrativeDigestCommand {
  const label = "GenerateNarrativeDigestCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "conversationId", "scope", "documentIds"], label);
  schema(input, label);
  const scope = parseNarrativeDigestScope(input.scope);
  if (scope.kind === "scene") {
    throw new Error(`${label}.scope Scene requires the exact Scene command`);
  }
  const documents = documentIds(input.documentIds, `${label}.documentIds`);
  if (scope.kind === "document" && !documents.includes(scope.documentId)) {
    throw new Error(`${label}.documentIds must include the document scope`);
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"NarrativeDigestRequest">(input.requestId, `${label}.requestId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    conversationId: id<"AssistantConversation">(input.conversationId, `${label}.conversationId`),
    scope,
    documentIds: documents,
  });
}

export function parseRegenerateNarrativeDigestCommand(
  value: unknown,
): RegenerateNarrativeDigestCommand {
  const label = "RegenerateNarrativeDigestCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "requestId", "workId", "conversationId", "digestId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"NarrativeDigestRequest">(input.requestId, `${label}.requestId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    conversationId: id<"AssistantConversation">(input.conversationId, `${label}.conversationId`),
    digestId: id<"NarrativeDigest">(input.digestId, `${label}.digestId`),
  });
}

export function parseGenerateSceneNarrativeDigestCommand(
  value: unknown,
): GenerateSceneNarrativeDigestCommand {
  const label = "GenerateSceneNarrativeDigestCommand";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "requestId",
    "workId",
    "conversationId",
    "sceneId",
    "sourceRange",
    "trigger",
  ], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    requestId: id<"NarrativeDigestRequest">(input.requestId, `${label}.requestId`),
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

export function parseListNarrativeDigestsCommand(value: unknown): ListNarrativeDigestsCommand {
  const label = "ListNarrativeDigestsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1, workId: id<"Work">(input.workId, `${label}.workId`) });
}

export function parseNarrativeDigestProjection(value: unknown): NarrativeDigestProjection {
  const label = "NarrativeDigestProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "digestId", "workId", "scope", "sceneSource", "sourceManifest", "sourceManifestHash", "text", "providerId", "modelId", "promptVersion", "integrity", "contextReceiptId", "createdAt"], label);
  schema(input, label);
  if (input.integrity !== "current" && input.integrity !== "stale") {
    throw new Error(`${label}.integrity is unsupported`);
  }
  const scope = parseNarrativeDigestScope(input.scope);
  const sourceManifest = parseNarrativeDigestSourceManifest(input.sourceManifest);
  const sceneSource = input.sceneSource === null
    ? null
    : parseNarrativeDigestSceneSource(input.sceneSource);
  const promptVersion = text(input.promptVersion, `${label}.promptVersion`);
  if (JSON.stringify(scope) !== JSON.stringify(sourceManifest.scope)) {
    throw new Error(`${label}.scope disagrees with source manifest`);
  }
  if (promptVersion !== sourceManifest.promptVersion) {
    throw new Error(`${label}.promptVersion disagrees with source manifest`);
  }
  if (
    (scope.kind === "scene") !== (sceneSource !== null) ||
    (scope.kind === "scene" && sceneSource?.sceneId !== scope.sceneId)
  ) {
    throw new Error(`${label}.sceneSource disagrees with scope`);
  }
  const createdAt = text(input.createdAt, `${label}.createdAt`);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error(`${label}.createdAt must be an instant`);
  return Object.freeze({
    schemaVersion: 1,
    digestId: id<"NarrativeDigest">(input.digestId, `${label}.digestId`),
    workId: id<"Work">(input.workId, `${label}.workId`),
    scope,
    sceneSource,
    sourceManifest,
    sourceManifestHash: text(input.sourceManifestHash, `${label}.sourceManifestHash`),
    text: text(input.text, `${label}.text`),
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    promptVersion,
    integrity: input.integrity,
    contextReceiptId: id<"AssistantContextReceipt">(
      input.contextReceiptId,
      `${label}.contextReceiptId`,
    ),
    createdAt,
  });
}

export function parseNarrativeDigestListProjection(value: unknown): NarrativeDigestListProjection {
  const label = "NarrativeDigestListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "digests"], label);
  schema(input, label);
  const workId = id<"Work">(input.workId, `${label}.workId`);
  if (!Array.isArray(input.digests)) throw new Error(`${label}.digests must be an array`);
  const digests = Object.freeze(input.digests.map(parseNarrativeDigestProjection));
  if (digests.some((digest) => digest.workId !== workId)) {
    throw new Error(`${label}.digests must belong to the requested Work`);
  }
  return Object.freeze({ schemaVersion: 1, workId, digests });
}

export function parseNarrativeDigestResult(value: unknown): NarrativeDigestResult {
  const label = "NarrativeDigestResult";
  const input = record(value, label);
  if (input.status === "login-required") {
    exact(input, ["schemaVersion", "status"], label); schema(input, label);
    return Object.freeze({ schemaVersion: 1, status: "login-required" });
  }
  if (input.status === "generated" || input.status === "unchanged") {
    exact(input, ["schemaVersion", "status", "digest"], label); schema(input, label);
    return Object.freeze({
      schemaVersion: 1,
      status: input.status,
      digest: parseNarrativeDigestProjection(input.digest),
    });
  }
  if (input.status === "permission-required") {
    exact(input, ["schemaVersion", "status", "missing", "destinationId"], label); schema(input, label);
    if (!Array.isArray(input.missing) || input.missing.some((entry) => entry !== "local-read" && entry !== "external-transmit")) throw new Error(`${label}.missing is invalid`);
    return Object.freeze({ schemaVersion: 1, status: "permission-required", missing: Object.freeze(input.missing as AssistantContextPermissionMissing[]), destinationId: text(input.destinationId, `${label}.destinationId`) });
  }
  if (input.status === "context-rejected") {
    exact(input, ["schemaVersion", "status", "reason", "documentId"], label); schema(input, label);
    if (input.reason !== "source-unavailable" && input.reason !== "outside-work" && input.reason !== "stale-context" && input.reason !== "invalid-range") throw new Error(`${label}.reason is invalid`);
    return Object.freeze({ schemaVersion: 1, status: "context-rejected", reason: input.reason, documentId: id<"Document">(input.documentId, `${label}.documentId`) });
  }
  throw new Error(`${label}.status is unsupported`);
}

export function parseNarrativeDigestConnectorExecution(
  value: unknown,
): NarrativeDigestConnectorExecution {
  const label = "NarrativeDigestConnectorExecution";
  const input = record(value, label);
  exact(input, ["providerId", "modelId", "promptVersion", "text"], label);
  if (input.promptVersion !== NARRATIVE_DIGEST_PROMPT_VERSION) {
    throw new Error(`${label}.promptVersion is unsupported`);
  }
  return Object.freeze({
    providerId: text(input.providerId, `${label}.providerId`),
    modelId: text(input.modelId, `${label}.modelId`),
    promptVersion: NARRATIVE_DIGEST_PROMPT_VERSION,
    text: text(input.text, `${label}.text`),
  });
}
