import { randomUUID } from "node:crypto";

import type { StorageService } from "../../application/storage/storage-service";
import {
  parseAssistantEntityContextPolicyList,
  parseAssistantEntityContextPolicyProjection,
  type AssistantEntityContextPolicyList,
  type AssistantEntityContextPolicyProjection,
  type ListAssistantEntityContextPoliciesCommand,
  type SaveAssistantEntityContextPolicyCommand,
} from "../../application/continuity/assistant-context-policy";
import {
  parseAssistantContextActivityList,
  parseAssistantContextManifestList,
  parseAssistantContextManifestProjection,
  type AssistantContextActivityList,
  type AssistantContextActivityProjection,
  type AssistantContextManifestList,
  type AssistantContextManifestProjection,
  type AssistantContextPlanProjection,
  type ListAssistantContextActivitiesCommand,
  type ListAssistantContextManifestsCommand,
} from "../../application/continuity/assistant-context-manifest";
import {
  planAssistantContext,
  type ContextPlannerCandidate,
  type PlanAssistantContextInput,
} from "../../application/continuity/context-planner";
import { parseCanonEntityRef, type CanonEntityRef } from "../../application/canon/canon-entity-ref";
import type { AssistantContextRange } from "../../application/assistant/assistant-context-permission";
import { entityId, type EntityId } from "../../domain/writing";

type Statement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
}>;

export type ContextPlannerDatabase = Readonly<{
  prepare(sql: string): Statement;
}>;

type EntitySnapshot = Readonly<{
  entity: CanonEntityRef;
  revision: number;
  updatedAt: string;
  text: string;
  characterIds: readonly string[];
  status: string;
}>;

export type RecordContextManifestInput = Readonly<{
  workId: EntityId<"Work">;
  receiptId: EntityId<"AssistantContextReceipt">;
  plan: Extract<AssistantContextPlanProjection, { status: "planned" }>;
}>;

export type RecordContextActivityInput = Readonly<{
  workId: EntityId<"Work">;
  receiptId: EntityId<"AssistantContextReceipt">;
  manifestId: EntityId<"AssistantContextManifest">;
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
  candidateCount: number;
}>;

export type LocalContextPlanner = Readonly<{
  listPolicies(command: ListAssistantEntityContextPoliciesCommand): AssistantEntityContextPolicyList;
  savePolicy(command: SaveAssistantEntityContextPolicyCommand): Promise<AssistantEntityContextPolicyProjection>;
  plan(input: PlanAssistantContextInput): AssistantContextPlanProjection;
  recordManifest(input: RecordContextManifestInput): Promise<AssistantContextManifestProjection>;
  listManifests(command: ListAssistantContextManifestsCommand): AssistantContextManifestList;
  recordActivity(input: RecordContextActivityInput): Promise<AssistantContextActivityProjection>;
  listActivities(command: ListAssistantContextActivitiesCommand): AssistantContextActivityList;
}>;

function required(row: Record<string, unknown>, field: string, label: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be non-empty text`);
  }
  return value;
}

function optionalText(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  return typeof value === "string" ? value : "";
}

function integer(row: Record<string, unknown>, field: string, label: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== "string") throw new Error(`${label} must be JSON text`);
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
}

function assertWork(database: ContextPlannerDatabase, workId: EntityId<"Work">): void {
  if (database.prepare(`SELECT id FROM works WHERE id=? AND retired_at IS NULL`).all(workId).length !== 1) {
    throw new Error(`Unknown Work: ${workId}`);
  }
}

function snapshot(
  kind: CanonEntityRef["kind"],
  row: Record<string, unknown>,
  textFields: readonly string[],
  characterFields: readonly string[] = [],
  status = "current",
): EntitySnapshot {
  const label = `${kind} context row`;
  return Object.freeze({
    entity: parseCanonEntityRef({ kind, id: required(row, "id", label) }),
    revision: integer(row, "revision", label),
    updatedAt: required(row, "updatedAt", label),
    text: textFields.map((field) => optionalText(row, field)).filter(Boolean).join("\n"),
    characterIds: Object.freeze(characterFields.map((field) => required(row, field, label))),
    status,
  });
}

function readSnapshots(
  database: ContextPlannerDatabase,
  workId: EntityId<"Work">,
): readonly EntitySnapshot[] {
  const rows: EntitySnapshot[] = [];
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",name,role,summary,goal,conflict,note
    FROM characters WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot(
    "character",
    row,
    ["name", "role", "summary", "goal", "conflict", "note"],
    ["id"],
  )));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",kind,description,
      from_character_id AS "fromCharacterId",to_character_id AS "toCharacterId"
    FROM character_relations WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot(
    "character-relation",
    row,
    ["kind", "description"],
    ["fromCharacterId", "toCharacterId"],
  )));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",title,content,category
    FROM lore_entries WHERE work_id=? AND retired_at IS NULL AND enabled=1 ORDER BY id
  `).all(workId).map((row) => snapshot("lore-entry", row, ["title", "content", "category"])));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",title,note
    FROM event_blocks WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot("event-block", row, ["title", "note"])));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",title,summary,note
    FROM plot_threads WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot("plot-thread", row, ["title", "summary", "note"])));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",title,note
    FROM foreshadow_lines WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot("foreshadow-line", row, ["title", "note"])));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt"
    FROM scene_identities WHERE work_id=? AND retired_at IS NULL ORDER BY id
  `).all(workId).map((row) => snapshot("scene", row, ["id"])));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",title,note,status
    FROM continuity_threads WHERE work_id=? ORDER BY id
  `).all(workId).map((row) => snapshot(
    "continuity-thread",
    row,
    ["title", "note"],
    [],
    required(row, "status", "Continuity context row"),
  )));
  rows.push(...database.prepare(`
    SELECT id,revision,updated_at AS "updatedAt",statement,stance,truth_status AS "truthStatus",
      character_id AS "characterId",status
    FROM character_knowledge WHERE work_id=? AND status='active' ORDER BY id
  `).all(workId).map((row) => snapshot(
    "character-knowledge",
    row,
    ["statement", "stance", "truthStatus"],
    ["characterId"],
    required(row, "status", "Knowledge context row"),
  )));
  return Object.freeze(rows);
}

function policyRows(database: ContextPlannerDatabase, workId: EntityId<"Work">) {
  return database.prepare(`
    SELECT revision,entity_kind AS "entityKind",entity_id AS "entityId",mode,
      updated_at AS "updatedAt"
    FROM assistant_entity_context_policies WHERE work_id=? ORDER BY entity_kind,entity_id
  `).all(workId);
}

function policyMap(database: ContextPlannerDatabase, workId: EntityId<"Work">) {
  return new Map(policyRows(database, workId).map((row) => [
    `${required(row, "entityKind", "Context policy row")}:${required(row, "entityId", "Context policy row")}`,
    row,
  ]));
}

function overlapKeys(
  database: ContextPlannerDatabase,
  workId: EntityId<"Work">,
  range: AssistantContextRange | null,
): ReadonlySet<string> {
  const keys = new Set<string>();
  if (range === null) return keys;
  const current = database.prepare(`
    SELECT current_revision_id AS "revisionId" FROM manuscripts
    WHERE work_id=? AND document_id=?
  `).all(workId, range.documentId);
  if (current.length !== 1 || required(current[0]!, "revisionId", "Context source") !== range.documentRevisionId) {
    throw new Error(`Context source revision is stale: ${range.documentRevisionId}`);
  }
  const anchorArgs = [workId, range.documentId, range.documentRevisionId, range.to, range.from] as const;
  for (const row of database.prepare(`
    SELECT evidence.character_id AS id FROM character_evidence AS evidence
    JOIN anchors AS anchor ON anchor.work_id=evidence.work_id AND anchor.id=evidence.source_anchor_id
    WHERE evidence.work_id=? AND evidence.source_document_id=? AND anchor.resolved_revision_id=?
      AND anchor.start_offset < ? AND anchor.end_offset > ?
  `).all(...anchorArgs)) keys.add(`character:${required(row, "id", "Character overlap")}`);
  for (const row of database.prepare(`
    SELECT evidence.lore_entry_id AS id FROM lore_entry_evidence AS evidence
    JOIN anchors AS anchor ON anchor.work_id=evidence.work_id AND anchor.id=evidence.source_anchor_id
    WHERE evidence.work_id=? AND evidence.source_document_id=? AND anchor.resolved_revision_id=?
      AND anchor.start_offset < ? AND anchor.end_offset > ?
  `).all(...anchorArgs)) keys.add(`lore-entry:${required(row, "id", "Lore overlap")}`);
  for (const row of database.prepare(`
    SELECT knowledge_id AS id FROM character_knowledge_evidence
    WHERE work_id=? AND source_document_id=? AND source_document_revision_id=?
      AND source_from < ? AND source_to > ?
  `).all(...anchorArgs)) keys.add(`character-knowledge:${required(row, "id", "Knowledge overlap")}`);
  for (const row of database.prepare(`
    SELECT thread_id AS id FROM continuity_thread_evidence
    WHERE work_id=? AND source_document_id=? AND source_document_revision_id=?
      AND source_from < ? AND source_to > ?
  `).all(...anchorArgs)) keys.add(`continuity-thread:${required(row, "id", "Continuity overlap")}`);
  for (const row of database.prepare(`
    SELECT source.event_block_id AS id FROM event_sources AS source
    JOIN range_group_anchors AS member ON member.range_group_id=source.range_group_id
    JOIN anchors AS anchor ON anchor.id=member.anchor_id AND anchor.work_id=source.work_id
    WHERE source.work_id=? AND anchor.document_id=? AND anchor.resolved_revision_id=?
      AND anchor.start_offset < ? AND anchor.end_offset > ? AND source.retired_at IS NULL
  `).all(...anchorArgs)) keys.add(`event-block:${required(row, "id", "Event overlap")}`);
  return keys;
}

function readManifest(
  database: ContextPlannerDatabase,
  workId: EntityId<"Work">,
  manifestId: string,
): AssistantContextManifestProjection {
  const rows = database.prepare(`
    SELECT id AS "manifestId",receipt_id AS "receiptId",work_id AS "workId",
      entries_json AS "entriesJson",excluded_json AS "excludedJson",
      estimated_token_count AS "estimatedTokenCount",created_at AS "createdAt"
    FROM assistant_context_manifests WHERE work_id=? AND id=?
  `).all(workId, manifestId);
  if (rows.length !== 1) throw new Error(`Unknown AssistantContextManifest: ${manifestId}`);
  const row = rows[0]!;
  return parseAssistantContextManifestProjection({
    schemaVersion: 1,
    manifestId: required(row, "manifestId", "Context manifest row"),
    receiptId: required(row, "receiptId", "Context manifest row"),
    workId: required(row, "workId", "Context manifest row"),
    entries: parseJson(row.entriesJson, "Context manifest entries"),
    excluded: parseJson(row.excludedJson, "Context manifest exclusions"),
    estimatedTokenCount: integer(row, "estimatedTokenCount", "Context manifest row"),
    createdAt: required(row, "createdAt", "Context manifest row"),
  });
}

function readActivity(
  database: ContextPlannerDatabase,
  workId: EntityId<"Work">,
  activityId: string,
): AssistantContextActivityProjection {
  const rows = database.prepare(`
    SELECT id AS "activityId",work_id AS "workId",receipt_id AS "receiptId",
      manifest_id AS "manifestId",capability,destination_id AS "destinationId",
      provider_id AS "providerId",model_id AS "modelId",started_at AS "startedAt",
      completed_at AS "completedAt",plan_duration_ms AS "planDurationMs",
      authorize_duration_ms AS "authorizeDurationMs",connector_duration_ms AS "connectorDurationMs",
      persist_duration_ms AS "persistDurationMs",read_ranges_json AS "readRangesJson",
      transmitted_ranges_json AS "transmittedRangesJson",read_character_count AS "readCharacterCount",
      transmitted_character_count AS "transmittedCharacterCount",candidate_count AS "candidateCount"
    FROM assistant_context_activities WHERE work_id=? AND id=?
  `).all(workId, activityId);
  if (rows.length !== 1) throw new Error(`Unknown AssistantContextActivity: ${activityId}`);
  const row = rows[0]!;
  return parseAssistantContextActivityList({
    schemaVersion: 1,
    workId,
    activities: [{
      schemaVersion: 1,
      activityId: required(row, "activityId", "Context activity row"),
      workId: required(row, "workId", "Context activity row"),
      receiptId: required(row, "receiptId", "Context activity row"),
      manifestId: required(row, "manifestId", "Context activity row"),
      capability: required(row, "capability", "Context activity row"),
      destinationId: required(row, "destinationId", "Context activity row"),
      providerId: required(row, "providerId", "Context activity row"),
      modelId: required(row, "modelId", "Context activity row"),
      startedAt: required(row, "startedAt", "Context activity row"),
      completedAt: required(row, "completedAt", "Context activity row"),
      stageDurationsMs: {
        plan: integer(row, "planDurationMs", "Context activity row"),
        authorize: integer(row, "authorizeDurationMs", "Context activity row"),
        connector: integer(row, "connectorDurationMs", "Context activity row"),
        persist: integer(row, "persistDurationMs", "Context activity row"),
      },
      readRanges: parseJson(row.readRangesJson, "Context activity read ranges"),
      transmittedRanges: parseJson(row.transmittedRangesJson, "Context activity transmitted ranges"),
      readCharacterCount: integer(row, "readCharacterCount", "Context activity row"),
      transmittedCharacterCount: integer(row, "transmittedCharacterCount", "Context activity row"),
      candidateCount: integer(row, "candidateCount", "Context activity row"),
    }],
  }).activities[0]!;
}

export function createLocalContextPlanner(input: Readonly<{
  database: ContextPlannerDatabase;
  ledger: Pick<StorageService, "transaction">;
  estimateTokens?: (text: string) => number;
  now?: () => string;
  createId?: () => string;
}>): LocalContextPlanner {
  const now = input.now ?? (() => new Date().toISOString());
  const createId = input.createId ?? randomUUID;
  const estimateTokens = input.estimateTokens ?? ((text: string) => Math.max(1, text.length));

  const listPolicies = (command: ListAssistantEntityContextPoliciesCommand) => {
    assertWork(input.database, command.workId);
    const stored = policyMap(input.database, command.workId);
    const policies = readSnapshots(input.database, command.workId).map((source) => {
      const row = stored.get(`${source.entity.kind}:${source.entity.id}`);
      return parseAssistantEntityContextPolicyProjection({
        schemaVersion: 1,
        workId: command.workId,
        entity: source.entity,
        revision: row === undefined ? 0 : integer(row, "revision", "Context policy row"),
        mode: row === undefined ? "relevant" : required(row, "mode", "Context policy row"),
        updatedAt: row === undefined ? source.updatedAt : required(row, "updatedAt", "Context policy row"),
      });
    });
    return parseAssistantEntityContextPolicyList({
      schemaVersion: 1,
      workId: command.workId,
      policies,
    });
  };

  const savePolicy = async (command: SaveAssistantEntityContextPolicyCommand) => {
    assertWork(input.database, command.workId);
    const source = readSnapshots(input.database, command.workId).find((entry) =>
      entry.entity.kind === command.entity.kind && entry.entity.id === command.entity.id
    );
    if (source === undefined) {
      throw new Error(`Context policy entity is outside Work: ${command.entity.kind}/${command.entity.id}`);
    }
    const rows = input.database.prepare(`
      SELECT revision FROM assistant_entity_context_policies
      WHERE work_id=? AND entity_kind=? AND entity_id=?
    `).all(command.workId, command.entity.kind, command.entity.id);
    const currentRevision = rows.length === 0
      ? null
      : integer(rows[0]!, "revision", "Context policy row");
    if (currentRevision !== command.expectedRevision) {
      throw new Error(`Assistant context policy revision conflict: ${command.entity.kind}/${command.entity.id}`);
    }
    const updatedAt = now();
    await input.ledger.transaction(async (transaction) => {
      if (currentRevision === null) {
        transaction.write({
          kind: "assistantContextPolicy",
          id: createId(),
          schemaVersion: 1,
          revision: 1,
          createdAt: updatedAt,
          updatedAt,
          workId: command.workId,
          entityKind: command.entity.kind,
          entityId: command.entity.id,
          mode: command.mode,
        });
      } else {
        transaction.write({
          kind: "assistantContextPolicyUpdate",
          workId: command.workId,
          entityKind: command.entity.kind,
          entityId: command.entity.id,
          expectedRevision: currentRevision,
          mode: command.mode,
          updatedAt,
        });
      }
    });
    const saved = listPolicies({ schemaVersion: 1, workId: command.workId }).policies.find(
      (policy) => policy.entity.kind === command.entity.kind && policy.entity.id === command.entity.id,
    );
    if (saved === undefined) throw new Error("Saved context policy disappeared");
    return saved;
  };

  const plan = (command: PlanAssistantContextInput) => {
    assertWork(input.database, command.workId);
    const policies = policyMap(input.database, command.workId);
    const overlaps = overlapKeys(input.database, command.workId, command.sourceRange);
    const candidates: ContextPlannerCandidate[] = readSnapshots(input.database, command.workId)
      .filter((source) => source.entity.kind !== "continuity-thread" || source.status === "open")
      .map((source) => {
        const key = `${source.entity.kind}:${source.entity.id}`;
        const policy = policies.get(key);
        const policyMode = policy === undefined
          ? "relevant" as const
          : required(policy, "mode", "Context policy row") as ContextPlannerCandidate["policyMode"];
        const currentSceneRelated = source.entity.kind === "scene" &&
          command.sceneId !== null && source.entity.id === command.sceneId;
        const exactSourceOverlap = overlaps.has(key);
        const directRelation = command.povCharacterId !== null &&
          source.entity.kind === "character-relation" &&
          source.characterIds.includes(command.povCharacterId);
        const povKnowledge = command.povCharacterId !== null &&
          source.entity.kind === "character-knowledge" &&
          source.characterIds.includes(command.povCharacterId);
        const openContinuity = source.entity.kind === "continuity-thread";
        const inclusionReason = currentSceneRelated
          ? "current-scene" as const
          : exactSourceOverlap
            ? "exact-source-overlap" as const
            : directRelation
              ? "direct-relation" as const
              : openContinuity
                ? "open-continuity" as const
                : povKnowledge
                  ? "pov-knowledge" as const
                  : "recent-change" as const;
        const priority = currentSceneRelated || exactSourceOverlap || directRelation
          ? "direct" as const
          : openContinuity || povKnowledge
            ? "continuity" as const
            : source.entity.kind === "plot-thread" || source.entity.kind === "foreshadow-line"
              ? "supporting" as const
              : "recent" as const;
        return Object.freeze({
          workId: command.workId,
          entity: source.entity,
          entityRevision: source.revision,
          policyMode,
          inclusionReason,
          priority,
          estimatedTokenCount: estimateTokens(source.text || String(source.entity.id)),
          userSelected: false,
          userSelectionAuthorized: false,
          currentSceneRelated,
          exactSourceOverlap,
          current: true,
          updatedAt: source.updatedAt,
        });
      });
    return planAssistantContext(command, candidates);
  };

  const recordManifest = async (request: RecordContextManifestInput) => {
    if (request.plan.workId !== request.workId) throw new Error("Context plan is outside Work");
    const receipts = input.database.prepare(`
      SELECT capability FROM assistant_context_receipts WHERE work_id=? AND id=?
    `).all(request.workId, request.receiptId);
    if (receipts.length !== 1 || required(receipts[0]!, "capability", "Context receipt") !== request.plan.capability) {
      throw new Error("Context receipt does not match the planned Work/capability");
    }
    const manifestId = entityId<"AssistantContextManifest">(createId());
    const createdAt = now();
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "assistantContextManifest",
        id: manifestId,
        schemaVersion: 1,
        workId: request.workId,
        receiptId: request.receiptId,
        entries: request.plan.entries,
        excluded: request.plan.excluded,
        estimatedTokenCount: request.plan.estimatedTokenCount,
        createdAt,
      });
    });
    return readManifest(input.database, request.workId, manifestId);
  };

  const listManifests = (command: ListAssistantContextManifestsCommand) => {
    assertWork(input.database, command.workId);
    const ids = input.database.prepare(`
      SELECT id FROM assistant_context_manifests WHERE work_id=? ORDER BY created_at DESC,id DESC
    `).all(command.workId).map((row) => required(row, "id", "Context manifest list row"));
    return parseAssistantContextManifestList({
      schemaVersion: 1,
      workId: command.workId,
      manifests: ids.map((id) => readManifest(input.database, command.workId, id)),
    });
  };

  const recordActivity = async (request: RecordContextActivityInput) => {
    const rows = input.database.prepare(`
      SELECT capability,destination_id AS "destinationId",read_ranges_json AS "readRangesJson",
        transmitted_ranges_json AS "transmittedRangesJson",read_character_count AS "readCharacterCount",
        transmitted_character_count AS "transmittedCharacterCount"
      FROM assistant_context_receipts WHERE work_id=? AND id=?
    `).all(request.workId, request.receiptId);
    if (rows.length !== 1) throw new Error("Context activity receipt is outside Work");
    const manifest = readManifest(input.database, request.workId, request.manifestId);
    if (manifest.receiptId !== request.receiptId) {
      throw new Error("Context activity manifest and receipt do not match");
    }
    const receipt = rows[0]!;
    const activityId = entityId<"AssistantContextActivity">(createId());
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "assistantContextActivity",
        id: activityId,
        schemaVersion: 1,
        workId: request.workId,
        receiptId: request.receiptId,
        manifestId: request.manifestId,
        capability: required(receipt, "capability", "Context receipt"),
        destinationId: required(receipt, "destinationId", "Context receipt"),
        providerId: request.providerId,
        modelId: request.modelId,
        startedAt: request.startedAt,
        completedAt: request.completedAt,
        planDurationMs: request.stageDurationsMs.plan,
        authorizeDurationMs: request.stageDurationsMs.authorize,
        connectorDurationMs: request.stageDurationsMs.connector,
        persistDurationMs: request.stageDurationsMs.persist,
        readRanges: parseJson(receipt.readRangesJson, "Context receipt read ranges") as readonly unknown[],
        transmittedRanges: parseJson(receipt.transmittedRangesJson, "Context receipt transmitted ranges") as readonly unknown[],
        readCharacterCount: integer(receipt, "readCharacterCount", "Context receipt"),
        transmittedCharacterCount: integer(receipt, "transmittedCharacterCount", "Context receipt"),
        candidateCount: request.candidateCount,
      });
    });
    return readActivity(input.database, request.workId, activityId);
  };

  const listActivities = (command: ListAssistantContextActivitiesCommand) => {
    assertWork(input.database, command.workId);
    const ids = input.database.prepare(`
      SELECT id FROM assistant_context_activities WHERE work_id=? ORDER BY completed_at DESC,id DESC
    `).all(command.workId).map((row) => required(row, "id", "Context activity list row"));
    return parseAssistantContextActivityList({
      schemaVersion: 1,
      workId: command.workId,
      activities: ids.map((id) => readActivity(input.database, command.workId, id)),
    });
  };

  return Object.freeze({
    listPolicies,
    savePolicy,
    plan,
    recordManifest,
    listManifests,
    recordActivity,
    listActivities,
  });
}
