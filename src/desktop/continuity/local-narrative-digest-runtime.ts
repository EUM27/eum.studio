import { createHash, randomUUID } from "node:crypto";

import type {
  AssistantContextAccessResult,
  AssistantContextRequest,
} from "../../application/assistant/assistant-context-permission";
import type { StorageService } from "../../application/storage/storage-service";
import {
  NARRATIVE_DIGEST_PROMPT_VERSION,
  parseNarrativeDigestConnectorExecution,
  parseNarrativeDigestListProjection,
  parseNarrativeDigestProjection,
  parseNarrativeDigestResult,
  type GenerateNarrativeDigestCommand,
  type GenerateSceneNarrativeDigestCommand,
  type ListNarrativeDigestsCommand,
  type NarrativeDigestListProjection,
  type NarrativeDigestCanonicalSource,
  type NarrativeDigestConnectorExecution,
  type NarrativeDigestConnectorInput,
  type NarrativeDigestProjection,
  type NarrativeDigestResult,
  type RegenerateNarrativeDigestCommand,
} from "../../application/continuity/narrative-digest-contract";
import {
  createNarrativeDigestSourceManifestHash,
  parseNarrativeDigestSceneSource,
  parseNarrativeDigestSourceManifest,
  projectNarrativeDigestIntegrity,
  type NarrativeDigestScope,
  type NarrativeDigestSceneSource,
  type NarrativeDigestSourceManifest,
} from "../../application/continuity/narrative-digest-manifest";
import { entityId, type EntityId } from "../../domain/writing";
import type { LocalContextPlanner } from "./local-context-planner";

type Statement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
}>;

export type NarrativeDigestDatabase = Readonly<{
  prepare(sql: string): Statement;
}>;

export type NarrativeDigestDocumentTarget = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  currentRevisionId: EntityId<"DocumentRevision">;
  text: string;
}>;

export type NarrativeDigestConnector = Readonly<{
  destinationId: string;
  contextTokenBudget: number;
  isConnected(): boolean;
  execute(input: NarrativeDigestConnectorInput): Promise<NarrativeDigestConnectorExecution>;
}>;

export type PreparedNarrativeDigest = Readonly<{
  workId: EntityId<"Work">;
  scope: NarrativeDigestScope;
  sceneSource: NarrativeDigestSceneSource | null;
  sourceManifest: NarrativeDigestSourceManifest;
  sourceManifestHash: string;
  existingDigest: NarrativeDigestProjection | null;
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  contextManifestId: EntityId<"AssistantContextManifest">;
  connectorInput: NarrativeDigestConnectorInput;
  startedAt: string;
  planDurationMs: number;
  authorizeDurationMs: number;
  manifestDurationMs: number;
  execute(): Promise<NarrativeDigestConnectorExecution>;
}>;

export type PrepareNarrativeDigestResult =
  | Readonly<{ result: NarrativeDigestResult }>
  | PreparedNarrativeDigest;

export type LocalNarrativeDigestService = Readonly<{
  generate(command: GenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  generateScene(command: GenerateSceneNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  regenerate(command: RegenerateNarrativeDigestCommand): Promise<NarrativeDigestResult>;
  list(command: ListNarrativeDigestsCommand): NarrativeDigestListProjection;
  prepareScene(
    command: GenerateSceneNarrativeDigestCommand,
    options?: Readonly<{ reuseExisting?: boolean }>,
  ): Promise<PrepareNarrativeDigestResult>;
  recordPrepared(
    prepared: PreparedNarrativeDigest,
    execution: NarrativeDigestConnectorExecution,
    connectorDurationMs?: number,
  ): Promise<NarrativeDigestResult>;
}>;

function required(row: Record<string, unknown>, field: string, label: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}.${field} must be non-empty text`);
  return value;
}

function integer(row: Record<string, unknown>, field: string, label: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label}.${field} must be an integer`);
  return value;
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== "string") throw new Error(`${label} must be JSON text`);
  try { return JSON.parse(value); } catch { throw new Error(`${label} is invalid JSON`); }
}

function scopeColumns(scope: NarrativeDigestScope): Readonly<{
  documentId: string | null;
  sceneId: string | null;
  firstCharacterId: string | null;
  secondCharacterId: string | null;
}> {
  return Object.freeze({
    documentId: scope.kind === "document"
      ? scope.documentId
      : null,
    sceneId: scope.kind === "scene" ? scope.sceneId : null,
    firstCharacterId: scope.kind === "character"
      ? scope.characterId
      : scope.kind === "relationship" ? scope.firstCharacterId : null,
    secondCharacterId: scope.kind === "relationship" ? scope.secondCharacterId : null,
  });
}

function scopeFromRow(row: Record<string, unknown>): NarrativeDigestScope {
  const kind = required(row,"scopeKind","NarrativeDigest row");
  if (kind === "work") return Object.freeze({ kind });
  if (kind === "document") return Object.freeze({ kind, documentId: entityId<"Document">(required(row,"scopeDocumentId","NarrativeDigest row")) });
  if (kind === "scene") return Object.freeze({
    kind,
    sceneId: entityId<"Scene">(required(row,"scopeSceneId","NarrativeDigest row")),
  });
  if (kind === "character") return Object.freeze({ kind, characterId: entityId<"Character">(required(row,"scopeFirstCharacterId","NarrativeDigest row")) });
  if (kind === "relationship") return Object.freeze({
    kind,
    firstCharacterId: entityId<"Character">(required(row,"scopeFirstCharacterId","NarrativeDigest row")),
    secondCharacterId: entityId<"Character">(required(row,"scopeSecondCharacterId","NarrativeDigest row")),
  });
  throw new Error(`NarrativeDigest scope is unsupported: ${kind}`);
}

function assertWork(database: NarrativeDigestDatabase, workId: EntityId<"Work">): void {
  if (database.prepare(`SELECT id FROM works WHERE id=? AND retired_at IS NULL`).all(workId).length !== 1) {
    throw new Error(`Unknown Work: ${workId}`);
  }
}

function assertScope(database: NarrativeDigestDatabase, workId: EntityId<"Work">, scope: NarrativeDigestScope): void {
  if (scope.kind === "document") {
    if (database.prepare(`SELECT id FROM documents WHERE work_id=? AND id=? AND retired_at IS NULL`).all(workId,scope.documentId).length !== 1) {
      throw new Error(`NarrativeDigest Document is outside Work: ${scope.documentId}`);
    }
  } else if (scope.kind === "scene") {
    if (database.prepare(`SELECT id FROM scene_identities WHERE work_id=? AND id=? AND retired_at IS NULL`).all(workId,scope.sceneId).length !== 1) {
      throw new Error(`NarrativeDigest Scene is outside Work: ${scope.sceneId}`);
    }
  } else if (scope.kind === "character") {
    if (database.prepare(`SELECT id FROM characters WHERE work_id=? AND id=? AND retired_at IS NULL`).all(workId,scope.characterId).length !== 1) {
      throw new Error(`NarrativeDigest Character is outside Work: ${scope.characterId}`);
    }
  } else if (scope.kind === "relationship") {
    for (const characterId of [scope.firstCharacterId,scope.secondCharacterId]) {
      if (database.prepare(`SELECT id FROM characters WHERE work_id=? AND id=? AND retired_at IS NULL`).all(workId,characterId).length !== 1) {
        throw new Error(`NarrativeDigest Character is outside Work: ${characterId}`);
      }
    }
  }
}

const SOURCE_QUERY = Object.freeze({
  "event-block": `SELECT revision,title,note FROM event_blocks WHERE work_id=? AND id=? AND retired_at IS NULL`,
  character: `SELECT revision,name,role,summary,goal,conflict,note FROM characters WHERE work_id=? AND id=? AND retired_at IS NULL`,
  "character-relation": `SELECT revision,kind,description,from_character_id AS "fromCharacterId",to_character_id AS "toCharacterId" FROM character_relations WHERE work_id=? AND id=? AND retired_at IS NULL`,
  "lore-entry": `SELECT revision,title,content,category FROM lore_entries WHERE work_id=? AND id=? AND retired_at IS NULL AND enabled=1`,
  "continuity-thread": `SELECT revision,title,note,status FROM continuity_threads WHERE work_id=? AND id=? AND status='open'`,
  "character-knowledge": `SELECT revision,statement,stance,truth_status AS "truthStatus",character_id AS "characterId",status FROM character_knowledge WHERE work_id=? AND id=? AND status='active'`,
});

function canonicalSource(
  database: NarrativeDigestDatabase,
  workId: EntityId<"Work">,
  kind: NarrativeDigestCanonicalSource["kind"],
  id: string,
  expectedRevision: number,
): NarrativeDigestCanonicalSource {
  const rows = database.prepare(SOURCE_QUERY[kind]).all(workId,id);
  if (rows.length !== 1) throw new Error(`NarrativeDigest canonical source disappeared: ${kind}/${id}`);
  const row = rows[0]!;
  const revision = integer(row,"revision","NarrativeDigest canonical source");
  if (revision !== expectedRevision) throw new Error(`NarrativeDigest canonical source changed: ${kind}/${id}`);
  const content = Object.fromEntries(Object.entries(row)
    .filter(([field]) => field !== "revision")
    .map(([field,value]) => [field,value === null ? "" : String(value)]));
  return Object.freeze({ kind,id,revision,content: Object.freeze(content) });
}

function scopePlannerFields(scope: NarrativeDigestScope): Readonly<{
  povCharacterId: EntityId<"Character"> | null;
  userQuery: string;
}> {
  return Object.freeze({
    povCharacterId: scope.kind === "character"
      ? scope.characterId
      : scope.kind === "relationship" ? scope.firstCharacterId : null,
    userQuery: scope.kind === "relationship" ? String(scope.secondCharacterId) : "",
  });
}

export function createLocalNarrativeDigestService(input: Readonly<{
  database: NarrativeDigestDatabase;
  ledger: Pick<StorageService,"transaction">;
  getDocument(documentId: EntityId<"Document">): NarrativeDigestDocumentTarget | undefined;
  authorizeContext(request: AssistantContextRequest): AssistantContextAccessResult;
  contextPlanner: Pick<LocalContextPlanner,"plan" | "recordManifest" | "recordActivity">;
  connector?: NarrativeDigestConnector;
  now?: () => string;
  measureNow?: () => number;
  createId?: () => string;
  checksum?: (canonical: string) => string;
}>): LocalNarrativeDigestService {
  const now = input.now ?? (() => new Date().toISOString());
  const measureNow = input.measureNow ?? Date.now;
  const createId = input.createId ?? randomUUID;
  const checksum = input.checksum ?? ((canonical: string) => createHash("sha256").update(canonical).digest("hex"));

  const documentsFor = (workId: EntityId<"Work">, documentIds: readonly EntityId<"Document">[]) => {
    const documents: NarrativeDigestDocumentTarget[] = [];
    for (const documentId of documentIds) {
      const target = input.getDocument(documentId);
      if (target === undefined) return Object.freeze({ rejected: { reason: "source-unavailable" as const, documentId } });
      if (target.workId !== workId) return Object.freeze({ rejected: { reason: "outside-work" as const, documentId } });
      documents.push(target);
    }
    return Object.freeze({ documents: Object.freeze(documents) });
  };

  const planFor = (
    workId: EntityId<"Work">,
    scope: NarrativeDigestScope,
    documents: readonly NarrativeDigestDocumentTarget[],
    tokenBudget: number,
    sceneSource: NarrativeDigestSceneSource | null = null,
  ) => {
    const exact = sceneSource !== null
      ? documents.find((document) => document.documentId === sceneSource.documentId)
      : scope.kind === "document"
        ? documents.find((document) => document.documentId === scope.documentId)
        : undefined;
    const fields = scopePlannerFields(scope);
    return input.contextPlanner.plan({
      schemaVersion: 1,
      workId,
      capability: "narrative.digest",
      sourceRange: exact === undefined ? null : {
        documentId: exact.documentId,
        documentRevisionId: exact.currentRevisionId,
        from: sceneSource?.from ?? 0,
        to: sceneSource?.to ?? exact.text.length,
      },
      sceneId: sceneSource?.sceneId ?? null,
      povCharacterId: fields.povCharacterId,
      userQuery: fields.userQuery,
      tokenBudget,
    });
  };

  const manifestFrom = (
    scope: NarrativeDigestScope,
    documents: readonly NarrativeDigestDocumentTarget[],
    entries: Extract<ReturnType<typeof planFor>,{ status:"planned" }>["entries"],
  ): NarrativeDigestSourceManifest => {
    const refs = (kind: NarrativeDigestCanonicalSource["kind"]) => entries
      .flatMap((entry) => entry.kind === "entity" && entry.entity.kind === kind
        ? [{ entityId: String(entry.entity.id), revision: entry.entityRevision }]
        : []);
    return parseNarrativeDigestSourceManifest({
      schemaVersion: 1,
      scope,
      promptVersion: NARRATIVE_DIGEST_PROMPT_VERSION,
      documents: documents.map((document) => ({ documentId: document.documentId, documentRevisionId: document.currentRevisionId })),
      eventBlocks: refs("event-block"),
      characters: refs("character"),
      characterRelations: refs("character-relation"),
      loreEntries: refs("lore-entry"),
      continuityThreads: refs("continuity-thread"),
      characterKnowledge: refs("character-knowledge"),
    });
  };

  const sourcesFrom = (workId: EntityId<"Work">, manifest: NarrativeDigestSourceManifest) => Object.freeze([
    ...manifest.eventBlocks.map((ref) => canonicalSource(input.database,workId,"event-block",ref.entityId,ref.revision)),
    ...manifest.characters.map((ref) => canonicalSource(input.database,workId,"character",ref.entityId,ref.revision)),
    ...manifest.characterRelations.map((ref) => canonicalSource(input.database,workId,"character-relation",ref.entityId,ref.revision)),
    ...manifest.loreEntries.map((ref) => canonicalSource(input.database,workId,"lore-entry",ref.entityId,ref.revision)),
    ...manifest.continuityThreads.map((ref) => canonicalSource(input.database,workId,"continuity-thread",ref.entityId,ref.revision)),
    ...manifest.characterKnowledge.map((ref) => canonicalSource(input.database,workId,"character-knowledge",ref.entityId,ref.revision)),
  ]);

  const currentHash = (
    workId: EntityId<"Work">,
    scope: NarrativeDigestScope,
    documentIds: readonly EntityId<"Document">[],
    sceneSource: NarrativeDigestSceneSource | null = null,
  ): string | null => {
    try {
      const resolved = documentsFor(workId,documentIds);
      if (!("documents" in resolved)) return null;
      const connector = input.connector;
      if (connector === undefined) return null;
      if (sceneSource !== null) {
        const target = resolved.documents.find(
          (document) => document.documentId === sceneSource.documentId,
        );
        if (
          target === undefined ||
          target.currentRevisionId !== sceneSource.documentRevisionId ||
          sceneSource.to > target.text.length ||
          checksum(target.text.slice(sceneSource.from, sceneSource.to)) !==
            sceneSource.textHash
        ) return null;
      }
      const plan = planFor(
        workId,
        scope,
        resolved.documents,
        connector.contextTokenBudget,
        sceneSource,
      );
      if (plan.status !== "planned") return null;
      return createNarrativeDigestSourceManifestHash(
        manifestFrom(scope,resolved.documents,plan.entries),
        checksum,
        sceneSource,
      );
    } catch { return null; }
  };

  const readRows = (workId: EntityId<"Work">) => input.database.prepare(`
    SELECT digest.id AS "digestId",digest.work_id AS "workId",
      digest.scope_kind AS "scopeKind",
      digest.scope_document_id AS "scopeDocumentId",
      digest.scope_scene_id AS "scopeSceneId",
      digest.scope_first_character_id AS "scopeFirstCharacterId",
      digest.scope_second_character_id AS "scopeSecondCharacterId",
      digest.source_manifest_json AS "sourceManifestJson",
      digest.source_manifest_hash AS "sourceManifestHash",digest.text,
      digest.provider_id AS "providerId",digest.model_id AS "modelId",
      digest.prompt_version AS "promptVersion",
      digest.context_receipt_id AS "contextReceiptId",
      digest.created_at AS "createdAt",
      scene.scene_id AS "sceneSourceSceneId",
      scene.document_id AS "sceneSourceDocumentId",
      scene.document_revision_id AS "sceneSourceDocumentRevisionId",
      scene.from_offset AS "sceneSourceFrom",
      scene.to_offset AS "sceneSourceTo",
      scene.text_hash AS "sceneSourceTextHash",
      scene.source_fingerprint AS "sceneSourceFingerprint",
      scene.trigger_kind AS "sceneSourceTrigger"
    FROM narrative_digests digest
    LEFT JOIN narrative_digest_scene_sources scene
      ON scene.work_id=digest.work_id AND scene.digest_id=digest.id
    WHERE digest.work_id=?
    ORDER BY digest.created_at DESC,digest.id DESC
  `).all(workId);

  const sceneSourceFromRow = (
    row: Record<string, unknown>,
  ): NarrativeDigestSceneSource | null => {
    if (row.scopeKind !== "scene") return null;
    return parseNarrativeDigestSceneSource({
      sceneId: required(row,"sceneSourceSceneId","NarrativeDigest Scene source"),
      documentId: required(row,"sceneSourceDocumentId","NarrativeDigest Scene source"),
      documentRevisionId: required(row,"sceneSourceDocumentRevisionId","NarrativeDigest Scene source"),
      from: integer(row,"sceneSourceFrom","NarrativeDigest Scene source"),
      to: integer(row,"sceneSourceTo","NarrativeDigest Scene source"),
      textHash: required(row,"sceneSourceTextHash","NarrativeDigest Scene source"),
      trigger: required(row,"sceneSourceTrigger","NarrativeDigest Scene source"),
    });
  };

  const projection = (row: Record<string,unknown>): NarrativeDigestProjection => {
    const workId = entityId<"Work">(required(row,"workId","NarrativeDigest row"));
    const sourceManifest = parseNarrativeDigestSourceManifest(parseJson(row.sourceManifestJson,"NarrativeDigest source manifest"));
    const sceneSource = sceneSourceFromRow(row);
    const documentIds = sourceManifest.documents.map((document) => document.documentId);
    const storedHash = required(row,"sourceManifestHash","NarrativeDigest row");
    const liveHash = currentHash(workId,sourceManifest.scope,documentIds,sceneSource);
    return parseNarrativeDigestProjection({
      schemaVersion: 1,
      digestId: required(row,"digestId","NarrativeDigest row"),
      workId,
      scope: scopeFromRow(row),
      sceneSource,
      sourceManifest,
      sourceManifestHash: storedHash,
      text: required(row,"text","NarrativeDigest row"),
      providerId: required(row,"providerId","NarrativeDigest row"),
      modelId: required(row,"modelId","NarrativeDigest row"),
      promptVersion: required(row,"promptVersion","NarrativeDigest row"),
      integrity: liveHash === null ? "stale" : projectNarrativeDigestIntegrity(storedHash,liveHash),
      contextReceiptId: required(row,"contextReceiptId","NarrativeDigest row"),
      createdAt: required(row,"createdAt","NarrativeDigest row"),
    });
  };

  const list = (command: ListNarrativeDigestsCommand) => {
    assertWork(input.database,command.workId);
    return parseNarrativeDigestListProjection({
      schemaVersion: 1,
      workId: command.workId,
      digests: readRows(command.workId).map(projection),
    });
  };

  const prepareGenerated = async (command: Readonly<{
    requestId: EntityId<"NarrativeDigestRequest">;
    workId: EntityId<"Work">;
    conversationId: EntityId<"AssistantConversation">;
    scope: NarrativeDigestScope;
    documentIds: readonly EntityId<"Document">[];
    sceneSource: NarrativeDigestSceneSource | null;
  }>, options: Readonly<{
    reuseExisting?: boolean;
  }> = {}): Promise<PrepareNarrativeDigestResult> => {
    assertWork(input.database,command.workId);
    assertScope(input.database,command.workId,command.scope);
    const connector = input.connector;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    const resolved = documentsFor(command.workId,command.documentIds);
    if (!("documents" in resolved)) {
      return Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "context-rejected",
          ...resolved.rejected,
        }),
      });
    }
    if (command.sceneSource !== null) {
      const target = resolved.documents.find(
        (document) => document.documentId === command.sceneSource?.documentId,
      );
      if (target === undefined) {
        return Object.freeze({
          result: parseNarrativeDigestResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: "source-unavailable",
            documentId: command.sceneSource.documentId,
          }),
        });
      }
      if (target.currentRevisionId !== command.sceneSource.documentRevisionId) {
        return Object.freeze({
          result: parseNarrativeDigestResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: "stale-context",
            documentId: target.documentId,
          }),
        });
      }
      if (command.sceneSource.to > target.text.length) {
        return Object.freeze({
          result: parseNarrativeDigestResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: "invalid-range",
            documentId: target.documentId,
          }),
        });
      }
      if (
        checksum(target.text.slice(command.sceneSource.from, command.sceneSource.to)) !==
          command.sceneSource.textHash
      ) {
        return Object.freeze({
          result: parseNarrativeDigestResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: "stale-context",
            documentId: target.documentId,
          }),
        });
      }
    }
    const startedAt = now();
    const planStarted = measureNow();
    const plan = planFor(
      command.workId,
      command.scope,
      resolved.documents,
      connector.contextTokenBudget,
      command.sceneSource,
    );
    const planDuration = Math.max(0,measureNow()-planStarted);
    if (plan.status === "required-context-over-budget") {
      throw new Error(`required-context-over-budget: ${plan.requiredTokenCount}/${plan.tokenBudget}`);
    }
    const sourceManifest = manifestFrom(command.scope,resolved.documents,plan.entries);
    const sourceManifestHash = createNarrativeDigestSourceManifestHash(
      sourceManifest,
      checksum,
      command.sceneSource,
    );
    let existingDigest: NarrativeDigestProjection | null = null;
    if (command.sceneSource !== null) {
      const existing = readRows(command.workId).find(
        (candidate) => candidate.sceneSourceFingerprint === sourceManifestHash,
      );
      if (existing !== undefined) {
        existingDigest = projection(existing);
        if (options.reuseExisting !== true) {
          return Object.freeze({
            result: parseNarrativeDigestResult({
              schemaVersion: 1,
              status: "unchanged",
              digest: existingDigest,
            }),
          });
        }
      }
    }
    const canonicalSources = sourcesFrom(command.workId,sourceManifest);
    const ranges = Object.freeze(resolved.documents.map((document) => {
      const exactScene = command.sceneSource?.documentId === document.documentId
        ? command.sceneSource
        : null;
      return Object.freeze({
        documentId: document.documentId,
        documentRevisionId: document.currentRevisionId,
        from: exactScene?.from ?? 0,
        to: exactScene?.to ?? document.text.length,
      });
    }));
    const contextScope = command.sceneSource !== null
      ? "scene" as const
      : command.scope.kind === "work" || ranges.length > 1
        ? "work" as const
        : "chapter" as const;
    const authorizeStarted = measureNow();
    const access = input.authorizeContext({
      schemaVersion: 1,
      requestId: entityId<"AssistantContextRequest">(command.requestId),
      workId: command.workId,
      conversationId: command.conversationId,
      capability: "narrative.digest",
      destinationId: connector.destinationId,
      requiredLocalScope: contextScope,
      requiredExternalScope: contextScope,
      readRanges: ranges,
      transmittedRanges: ranges,
    });
    const authorizeDuration = Math.max(0,measureNow()-authorizeStarted);
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseNarrativeDigestResult({ schemaVersion: 1,status: "permission-required",missing: access.missing,destinationId: connector.destinationId })
          : parseNarrativeDigestResult({ schemaVersion: 1,status: "context-rejected",reason: access.reason,documentId: access.documentId }),
      });
    }
    const manifestStarted = measureNow();
    const contextManifest = await input.contextPlanner.recordManifest({ workId: command.workId,receiptId: access.receipt.receiptId,plan });
    const manifestDuration = Math.max(0,measureNow()-manifestStarted);
    const connectorInput = Object.freeze({
      requestId: command.requestId,
      scope: command.scope,
      sourceManifest,
      documents: Object.freeze(resolved.documents.map((document) => Object.freeze({
        documentId: document.documentId,
        documentRevisionId: document.currentRevisionId,
        from: command.sceneSource?.documentId === document.documentId
          ? command.sceneSource.from
          : 0,
        to: command.sceneSource?.documentId === document.documentId
          ? command.sceneSource.to
          : document.text.length,
        text: command.sceneSource?.documentId === document.documentId
          ? document.text.slice(command.sceneSource.from, command.sceneSource.to)
          : document.text,
      }))),
      sceneSource: command.sceneSource,
      canonicalSources,
    });
    return Object.freeze({
      workId: command.workId,
      scope: command.scope,
      sceneSource: command.sceneSource,
      sourceManifest,
      sourceManifestHash,
      existingDigest,
      contextReceiptId: access.receipt.receiptId,
      contextManifestId: contextManifest.manifestId,
      connectorInput,
      startedAt,
      planDurationMs: planDuration,
      authorizeDurationMs: authorizeDuration,
      manifestDurationMs: manifestDuration,
      execute: () => connector.execute(connectorInput),
    });
  };

  const recordPrepared = async (
    prepared: PreparedNarrativeDigest,
    rawExecution: NarrativeDigestConnectorExecution,
    connectorDurationMs = 0,
  ): Promise<NarrativeDigestResult> => {
    const execution = parseNarrativeDigestConnectorExecution(rawExecution);
    const persistStarted = measureNow();
    const digestId = prepared.existingDigest?.digestId ??
      entityId<"NarrativeDigest">(createId());
    const createdAt = now();
    const columns = scopeColumns(prepared.scope);
    if (prepared.existingDigest === null) {
      await input.ledger.transaction(async (transaction) => {
        transaction.write({
        kind: "narrativeDigest",
        id: digestId,
        schemaVersion: 1,
        workId: prepared.workId,
        scopeKind: prepared.scope.kind,
        scopeDocumentId: prepared.sceneSource?.documentId ?? columns.documentId,
        scopeSceneId: columns.sceneId,
        scopeFirstCharacterId: columns.firstCharacterId,
        scopeSecondCharacterId: columns.secondCharacterId,
        sourceManifest: prepared.sourceManifest,
        sourceManifestHash: prepared.sourceManifestHash,
        text: execution.text.trim(),
        providerId: execution.providerId.trim(),
        modelId: execution.modelId.trim(),
        promptVersion: execution.promptVersion,
        contextReceiptId: prepared.contextReceiptId,
        createdAt,
        documents: prepared.sourceManifest.documents.map((document,index) => ({ ...document,orderIndex: index })),
        sceneSource: prepared.sceneSource === null
          ? null
          : {
              ...prepared.sceneSource,
              sourceFingerprint: prepared.sourceManifestHash,
            },
        });
      });
    }
    const persistDuration = Math.max(0,measureNow()-persistStarted);
    await input.contextPlanner.recordActivity({
      workId: prepared.workId,
      receiptId: prepared.contextReceiptId,
      manifestId: prepared.contextManifestId,
      providerId: execution.providerId,
      modelId: execution.modelId,
      startedAt: prepared.startedAt,
      completedAt: now(),
      stageDurationsMs: {
        plan: prepared.planDurationMs,
        authorize: prepared.authorizeDurationMs,
        connector: connectorDurationMs,
        persist: prepared.manifestDurationMs+persistDuration,
      },
      candidateCount: 0,
    });
    const row = readRows(prepared.workId).find((candidate) => candidate.digestId === digestId);
    if (row === undefined) throw new Error(`Generated NarrativeDigest disappeared: ${digestId}`);
    return parseNarrativeDigestResult({
      schemaVersion: 1,
      status: prepared.existingDigest === null ? "generated" : "unchanged",
      digest: projection(row),
    });
  };

  const generatePrepared = async (command: Readonly<{
    requestId: EntityId<"NarrativeDigestRequest">;
    workId: EntityId<"Work">;
    conversationId: EntityId<"AssistantConversation">;
    scope: NarrativeDigestScope;
    documentIds: readonly EntityId<"Document">[];
    sceneSource: NarrativeDigestSceneSource | null;
  }>): Promise<NarrativeDigestResult> => {
    const prepared = await prepareGenerated(command);
    if ("result" in prepared) return prepared.result;
    const connectorStarted = measureNow();
    const execution = await prepared.execute();
    return recordPrepared(
      prepared,
      execution,
      Math.max(0,measureNow()-connectorStarted),
    );
  };

  const generate = (command: GenerateNarrativeDigestCommand) =>
    generatePrepared({ ...command, sceneSource: null });

  const prepareScene = (
    command: GenerateSceneNarrativeDigestCommand,
    options: Readonly<{ reuseExisting?: boolean }> = {},
  ): Promise<PrepareNarrativeDigestResult> => {
    const target = input.getDocument(command.sourceRange.documentId);
    if (target === undefined) {
      return Promise.resolve(Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "source-unavailable",
          documentId: command.sourceRange.documentId,
        }),
      }));
    }
    if (target.workId !== command.workId) {
      return Promise.resolve(Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "outside-work",
          documentId: command.sourceRange.documentId,
        }),
      }));
    }
    if (target.currentRevisionId !== command.sourceRange.documentRevisionId) {
      return Promise.resolve(Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "stale-context",
          documentId: command.sourceRange.documentId,
        }),
      }));
    }
    if (command.sourceRange.to > target.text.length) {
      return Promise.resolve(Object.freeze({
        result: parseNarrativeDigestResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "invalid-range",
          documentId: command.sourceRange.documentId,
        }),
      }));
    }
    const sceneSource = parseNarrativeDigestSceneSource({
      sceneId: command.sceneId,
      documentId: command.sourceRange.documentId,
      documentRevisionId: command.sourceRange.documentRevisionId,
      from: command.sourceRange.from,
      to: command.sourceRange.to,
      textHash: checksum(target.text.slice(command.sourceRange.from, command.sourceRange.to)),
      trigger: command.trigger,
    });
    return prepareGenerated({
      requestId: command.requestId,
      workId: command.workId,
      conversationId: command.conversationId,
      scope: Object.freeze({ kind: "scene", sceneId: command.sceneId }),
      documentIds: Object.freeze([command.sourceRange.documentId]),
      sceneSource,
    }, options);
  };

  const generateScene = async (
    command: GenerateSceneNarrativeDigestCommand,
  ): Promise<NarrativeDigestResult> => {
    const prepared = await prepareScene(command);
    if ("result" in prepared) return prepared.result;
    const connectorStarted = measureNow();
    const execution = await prepared.execute();
    return recordPrepared(
      prepared,
      execution,
      Math.max(0,measureNow()-connectorStarted),
    );
  };

  const regenerate = async (command: RegenerateNarrativeDigestCommand): Promise<NarrativeDigestResult> => {
    assertWork(input.database,command.workId);
    const row = readRows(command.workId).find((candidate) => candidate.digestId === command.digestId);
    if (row === undefined) throw new Error(`Unknown NarrativeDigest: ${command.digestId}`);
    const sourceManifest = parseNarrativeDigestSourceManifest(parseJson(row.sourceManifestJson,"NarrativeDigest source manifest"));
    const sceneSource = sceneSourceFromRow(row);
    if (sceneSource !== null) {
      return generateScene({
        schemaVersion: 1,
        requestId: command.requestId,
        workId: command.workId,
        conversationId: command.conversationId,
        sceneId: sceneSource.sceneId,
        sourceRange: {
          documentId: sceneSource.documentId,
          documentRevisionId: sceneSource.documentRevisionId,
          from: sceneSource.from,
          to: sceneSource.to,
        },
        trigger: "manual",
      });
    }
    return generate({
      schemaVersion: 1,
      requestId: command.requestId,
      workId: command.workId,
      conversationId: command.conversationId,
      scope: sourceManifest.scope,
      documentIds: sourceManifest.documents.map((document) => document.documentId),
    });
  };

  return Object.freeze({
    generate,
    generateScene,
    regenerate,
    list,
    prepareScene,
    recordPrepared,
  });
}
