import { entityId, type EntityId } from "../../domain/writing";

export type NarrativeDigestScope =
  | Readonly<{ kind: "work" }>
  | Readonly<{ kind: "document"; documentId: EntityId<"Document"> }>
  | Readonly<{ kind: "scene"; sceneId: EntityId<"Scene"> }>
  | Readonly<{ kind: "character"; characterId: EntityId<"Character"> }>
  | Readonly<{
      kind: "relationship";
      firstCharacterId: EntityId<"Character">;
      secondCharacterId: EntityId<"Character">;
    }>;

export type NarrativeDigestVersionRef = Readonly<{
  entityId: string;
  revision: number;
}>;

export type NarrativeDigestDocumentVersionRef = Readonly<{
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
}>;

export const NARRATIVE_DIGEST_SCENE_TRIGGERS = [
  "scene-transition",
  "scene-split",
  "episode-transition",
  "manual",
] as const;

export type NarrativeDigestSceneTrigger =
  (typeof NARRATIVE_DIGEST_SCENE_TRIGGERS)[number];

export function parseNarrativeDigestSceneTrigger(
  value: unknown,
  label = "NarrativeDigestSceneTrigger",
): NarrativeDigestSceneTrigger {
  if (
    typeof value !== "string" ||
    !NARRATIVE_DIGEST_SCENE_TRIGGERS.includes(
      value as NarrativeDigestSceneTrigger,
    )
  ) {
    throw new Error(`${label} is unsupported`);
  }
  return value as NarrativeDigestSceneTrigger;
}

export type NarrativeDigestSceneSource = Readonly<{
  sceneId: EntityId<"Scene">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  textHash: string;
  trigger: NarrativeDigestSceneTrigger;
}>;

export type NarrativeDigestSourceManifest = Readonly<{
  schemaVersion: 1;
  scope: NarrativeDigestScope;
  promptVersion: string;
  documents: readonly NarrativeDigestDocumentVersionRef[];
  eventBlocks: readonly NarrativeDigestVersionRef[];
  characters: readonly NarrativeDigestVersionRef[];
  characterRelations: readonly NarrativeDigestVersionRef[];
  loreEntries: readonly NarrativeDigestVersionRef[];
  continuityThreads: readonly NarrativeDigestVersionRef[];
  characterKnowledge: readonly NarrativeDigestVersionRef[];
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

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function id<TEntity extends string>(value: unknown, label: string): EntityId<TEntity> {
  return entityId<TEntity>(text(value, label));
}

export function parseNarrativeDigestScope(value: unknown): NarrativeDigestScope {
  const label = "NarrativeDigest scope";
  const input = record(value, label);
  if (input.kind === "work") {
    exact(input, ["kind"], label);
    return Object.freeze({ kind: "work" });
  }
  if (input.kind === "document") {
    exact(input, ["kind", "documentId"], label);
    return Object.freeze({ kind: "document", documentId: id<"Document">(input.documentId, `${label}.documentId`) });
  }
  if (input.kind === "scene") {
    exact(input, ["kind", "sceneId"], label);
    return Object.freeze({
      kind: "scene",
      sceneId: id<"Scene">(input.sceneId, `${label}.sceneId`),
    });
  }
  if (input.kind === "character") {
    exact(input, ["kind", "characterId"], label);
    return Object.freeze({ kind: "character", characterId: id<"Character">(input.characterId, `${label}.characterId`) });
  }
  if (input.kind === "relationship") {
    exact(input, ["kind", "firstCharacterId", "secondCharacterId"], label);
    const first = id<"Character">(input.firstCharacterId, `${label}.firstCharacterId`);
    const second = id<"Character">(input.secondCharacterId, `${label}.secondCharacterId`);
    if (first === second) throw new Error(`${label} relationship Characters must be different`);
    const [firstCharacterId, secondCharacterId] = [first, second].sort((a, b) => String(a).localeCompare(String(b)));
    return Object.freeze({ kind: "relationship", firstCharacterId: firstCharacterId!, secondCharacterId: secondCharacterId! });
  }
  throw new Error(`${label} is unsupported`);
}

export function parseNarrativeDigestSceneSource(
  value: unknown,
): NarrativeDigestSceneSource {
  const label = "NarrativeDigestSceneSource";
  const input = record(value, label);
  exact(input, [
    "sceneId",
    "documentId",
    "documentRevisionId",
    "from",
    "to",
    "textHash",
    "trigger",
  ], label);
  if (
    typeof input.from !== "number" ||
    typeof input.to !== "number" ||
    !Number.isSafeInteger(input.from) ||
    !Number.isSafeInteger(input.to) ||
    input.from < 0 ||
    input.to <= input.from
  ) {
    throw new Error(`${label} range is invalid`);
  }
  const trigger = parseNarrativeDigestSceneTrigger(
    input.trigger,
    `${label}.trigger`,
  );
  return Object.freeze({
    sceneId: id<"Scene">(input.sceneId, `${label}.sceneId`),
    documentId: id<"Document">(input.documentId, `${label}.documentId`),
    documentRevisionId: id<"DocumentRevision">(
      input.documentRevisionId,
      `${label}.documentRevisionId`,
    ),
    from: input.from,
    to: input.to,
    textHash: text(input.textHash, `${label}.textHash`),
    trigger,
  });
}

function parseDocuments(value: unknown, label: string): readonly NarrativeDigestDocumentVersionRef[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const rows = value.map((entry, index) => {
    const rowLabel = `${label}[${index}]`;
    const input = record(entry, rowLabel);
    exact(input, ["documentId", "documentRevisionId"], rowLabel);
    return Object.freeze({
      documentId: id<"Document">(input.documentId, `${rowLabel}.documentId`),
      documentRevisionId: id<"DocumentRevision">(
        input.documentRevisionId,
        `${rowLabel}.documentRevisionId`,
      ),
    });
  }).sort((a, b) => String(a.documentId).localeCompare(String(b.documentId)));
  if (new Set(rows.map((entry) => entry.documentId)).size !== rows.length) {
    throw new Error(`${label} contains duplicate documents`);
  }
  return Object.freeze(rows);
}

function parseVersions(value: unknown, label: string): readonly NarrativeDigestVersionRef[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const rows = value.map((entry, index) => {
    const rowLabel = `${label}[${index}]`;
    const input = record(entry, rowLabel);
    exact(input, ["entityId", "revision"], rowLabel);
    if (typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 1) {
      throw new Error(`${rowLabel}.revision must be positive`);
    }
    return Object.freeze({ entityId: text(input.entityId, `${rowLabel}.entityId`), revision: input.revision });
  }).sort((a, b) => a.entityId.localeCompare(b.entityId));
  if (new Set(rows.map((entry) => entry.entityId)).size !== rows.length) {
    throw new Error(`${label} contains duplicate entities`);
  }
  return Object.freeze(rows);
}

export function parseNarrativeDigestSourceManifest(value: unknown): NarrativeDigestSourceManifest {
  const label = "NarrativeDigestSourceManifest";
  const input = record(value, label);
  exact(input, [
    "schemaVersion", "scope", "promptVersion", "documents", "eventBlocks",
    "characters", "characterRelations", "loreEntries", "continuityThreads",
    "characterKnowledge",
  ], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return Object.freeze({
    schemaVersion: 1,
    scope: parseNarrativeDigestScope(input.scope),
    promptVersion: text(input.promptVersion, `${label}.promptVersion`),
    documents: parseDocuments(input.documents, `${label}.documents`),
    eventBlocks: parseVersions(input.eventBlocks, `${label}.eventBlocks`),
    characters: parseVersions(input.characters, `${label}.characters`),
    characterRelations: parseVersions(input.characterRelations, `${label}.characterRelations`),
    loreEntries: parseVersions(input.loreEntries, `${label}.loreEntries`),
    continuityThreads: parseVersions(input.continuityThreads, `${label}.continuityThreads`),
    characterKnowledge: parseVersions(input.characterKnowledge, `${label}.characterKnowledge`),
  });
}

export function canonicalizeNarrativeDigestSourceManifest(
  value: NarrativeDigestSourceManifest,
): string {
  return JSON.stringify(parseNarrativeDigestSourceManifest(value));
}

export function createNarrativeDigestSourceManifestHash(
  manifest: NarrativeDigestSourceManifest,
  checksum: (canonical: string) => string,
  sceneSource?: NarrativeDigestSceneSource | null,
): string {
  const canonicalManifest = canonicalizeNarrativeDigestSourceManifest(manifest);
  const canonical = sceneSource === undefined || sceneSource === null
    ? canonicalManifest
    : (() => {
        const parsed = parseNarrativeDigestSceneSource(sceneSource);
        const stableSceneSource = {
          sceneId: parsed.sceneId,
          documentId: parsed.documentId,
          documentRevisionId: parsed.documentRevisionId,
          from: parsed.from,
          to: parsed.to,
          textHash: parsed.textHash,
        };
        return JSON.stringify({
          manifest: JSON.parse(canonicalManifest),
          sceneSource: stableSceneSource,
        });
      })();
  const result = checksum(canonical);
  if (typeof result !== "string" || result.trim().length === 0) {
    throw new Error("NarrativeDigest source manifest checksum must be non-empty");
  }
  return result.trim();
}

export function projectNarrativeDigestIntegrity(
  storedSourceManifestHash: string,
  currentSourceManifestHash: string,
): "current" | "stale" {
  return storedSourceManifestHash === currentSourceManifestHash ? "current" : "stale";
}
