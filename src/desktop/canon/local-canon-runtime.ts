import { randomUUID } from "node:crypto";

import {
  createAnchorForKnownRevisionContent,
  type AnchorPolicy,
  type DescribeAnchorEvidence,
} from "../../application/anchors/create-anchor";
import {
  CANON_CHARACTER_FIELDS,
  CANON_CHARACTER_KNOWLEDGE_FIELDS,
  CANON_CHARACTER_RELATION_FIELDS,
  CANON_LORE_ENTRY_FIELDS,
  CANON_REVIEW_PROMPT_VERSION,
  parseCanonReviewCandidate,
  parseCanonReviewCandidateList,
  parseCanonReviewDecisionReceipt,
  parseCanonReviewDecisionResult,
  parseCanonReviewResult,
  type CanonEntityRef,
  type CanonFieldChange,
  type CanonFieldName,
  type CanonFieldValue,
  type CanonReviewCandidate,
  type CanonReviewCandidateList,
  type CanonReviewDecisionReceipt,
  type CanonReviewDecisionResult,
  type CanonReviewItem,
  type CanonReviewResult,
  type DecideCanonReviewItemCommand,
  type ListCanonReviewCandidatesCommand,
  type ResolveCanonReviewItemTargetCommand,
  type RunCanonReviewCommand,
  type UpdateCanonReviewItemCommand,
} from "../../application/canon/canon-review-contract";
import {
  CANON_ENTITY_KINDS,
  canonEntityRefKey,
  parseCanonEntityRef,
} from "../../application/canon/canon-entity-ref";
import {
  createCanonReviewParagraphs,
  parseCanonReviewExecution,
  type CanonReviewConnectorInput,
  type CanonReviewExecution,
} from "../../application/canon/canon-review-model-output";
import {
  canonFieldValuesEqual,
  planCanonReviewItems,
  resolveCanonReviewItemTarget,
  type CanonPendingFieldChange,
  type CanonReviewSourceSnapshot,
} from "../../application/canon/canon-review-planner";
import type {
  AssistantContextAccessResult,
  AssistantContextRequest,
} from "../../application/assistant/assistant-context-permission";
import type { StorageService } from "../../application/storage/storage-service";
import type {
  Poc3AnchorRecord,
  Poc3CanonReviewCandidateRecord,
  Poc3CanonReviewFieldChangeData,
} from "../../domain/poc-3-storage-ledger";
import { entityId, type Anchor, type EntityId } from "../../domain/writing";

type NodeSqliteStatement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
  run(...parameters: readonly unknown[]): unknown;
}>;

export type CanonSqliteDatabase = Readonly<{
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
}>;

export type CanonDocumentTarget = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  currentRevisionId: EntityId<"DocumentRevision">;
  text: string;
}>;

export type CanonReviewConnector = Readonly<{
  destinationId: string;
  isConnected(): boolean;
  execute(input: CanonReviewConnectorInput): Promise<CanonReviewExecution>;
}>;

export type PreparedCanonReview = Readonly<{
  command: RunCanonReviewCommand;
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  manuscript: string;
  connectorInput: CanonReviewConnectorInput;
  execute(): Promise<CanonReviewExecution>;
}>;

export type PrepareCanonReviewResult =
  | Readonly<{ result: CanonReviewResult }>
  | PreparedCanonReview;

export type LocalCanonService = Readonly<{
  prepareReview(command: RunCanonReviewCommand): PrepareCanonReviewResult;
  recordReview(
    prepared: PreparedCanonReview,
    execution: CanonReviewExecution,
  ): Promise<CanonReviewResult>;
  list(command: ListCanonReviewCandidatesCommand): CanonReviewCandidateList;
  updateItem(command: UpdateCanonReviewItemCommand): Promise<CanonReviewCandidate>;
  resolveTarget(
    command: ResolveCanonReviewItemTargetCommand,
  ): Promise<CanonReviewCandidate>;
  decide(command: DecideCanonReviewItemCommand): Promise<CanonReviewDecisionResult>;
}>;

function requiredString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function textValue(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function integerValue(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
}

function nullableString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  return row[field] === null ? null : requiredString(row, field, label);
}

function nullableInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number | null {
  return row[field] === null ? null : integerValue(row, field, label);
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const entries = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}[${index}] must be non-empty`);
    }
    return entry;
  });
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(entries);
}

function fieldValue(value: unknown, label: string): CanonFieldValue {
  if (typeof value === "string" || typeof value === "boolean") return value;
  return stringArray(value, label);
}

function changedRows(value: unknown): number {
  if (typeof value !== "object" || value === null || !("changes" in value)) {
    throw new Error("SQLite update returned no change count");
  }
  const changes = (value as { readonly changes: unknown }).changes;
  if (typeof changes !== "number" && typeof changes !== "bigint") {
    throw new Error("SQLite update returned an invalid change count");
  }
  return Number(changes);
}

function targetId(item: CanonReviewItem): string | null {
  if (item.target.operation !== "update") return null;
  if (item.target.kind === "character") return item.target.characterId;
  if (item.target.kind === "character-relation") return item.target.relationId;
  if (item.target.kind === "lore-entry") return item.target.loreEntryId;
  return item.target.knowledgeId;
}

function expectedTargetRevision(item: CanonReviewItem): number | null {
  return item.target.operation === "update"
    ? item.target.expectedRevision
    : null;
}

function matchingTargetIds(item: CanonReviewItem): readonly string[] {
  return item.target.operation === "unresolved"
    ? item.target.matchingTargetIds
    : targetId(item) === null
      ? Object.freeze([])
      : Object.freeze([targetId(item)!]);
}

function fieldRecord(
  change: CanonFieldChange,
  orderIndex: number,
): Poc3CanonReviewFieldChangeData {
  return Object.freeze({
    field: change.field,
    before: change.before,
    after: change.after,
    selected: change.selected,
    orderIndex,
  });
}

function anchorRecord(workId: EntityId<"Work">, anchor: Anchor): Poc3AnchorRecord {
  return Object.freeze({
    kind: "anchor",
    ...anchor.meta,
    workId,
    documentId: anchor.documentId,
    originRevisionId: anchor.originRevisionId,
    resolvedRevisionId: anchor.resolvedRevisionId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    exactQuote: anchor.exactQuote,
    prefixContext: anchor.prefixContext,
    suffixContext: anchor.suffixContext,
    quoteHash: anchor.quoteHash,
    contextHash: anchor.contextHash,
    ...(anchor.lineageRef === undefined ? {} : { lineageRef: anchor.lineageRef }),
    status: anchor.status,
    resolutionEvidenceJson: JSON.stringify(anchor.resolutionEvidence),
  });
}

function readSources(
  database: CanonSqliteDatabase,
  workId: EntityId<"Work">,
): readonly CanonReviewSourceSnapshot[] {
  const characters = database.prepare(`
    SELECT
      id, revision, work_id AS "workId", retired_at AS "retiredAt",
      name, aliases_json AS "aliasesJson", role, summary, appearance,
      personality, speech, goal, conflict, note
    FROM characters WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => {
    const label = "Canon character row";
    return Object.freeze({
      kind: "character" as const,
      id: requiredString(row, "id", label),
      revision: integerValue(row, "revision", label),
      workId: requiredString(row, "workId", label),
      retiredAt: nullableString(row, "retiredAt", label),
      fields: Object.freeze({
        name: requiredString(row, "name", label),
        aliases: stringArray(
          parseJson(textValue(row, "aliasesJson", label), `${label}.aliasesJson`),
          `${label}.aliases`,
        ),
        role: textValue(row, "role", label),
        summary: textValue(row, "summary", label),
        appearance: textValue(row, "appearance", label),
        personality: textValue(row, "personality", label),
        speech: textValue(row, "speech", label),
        goal: textValue(row, "goal", label),
        conflict: textValue(row, "conflict", label),
        note: textValue(row, "note", label),
      }),
    });
  });
  const relations = database.prepare(`
    SELECT
      id, revision, work_id AS "workId", retired_at AS "retiredAt",
      from_character_id AS "fromCharacterId",
      to_character_id AS "toCharacterId", kind, description
    FROM character_relations WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => {
    const label = "Canon character relation row";
    return Object.freeze({
      kind: "character-relation" as const,
      id: requiredString(row, "id", label),
      revision: integerValue(row, "revision", label),
      workId: requiredString(row, "workId", label),
      retiredAt: nullableString(row, "retiredAt", label),
      fields: Object.freeze({
        fromCharacterId: requiredString(row, "fromCharacterId", label),
        toCharacterId: requiredString(row, "toCharacterId", label),
        kind: requiredString(row, "kind", label),
        description: textValue(row, "description", label),
      }),
    });
  });
  const lore = database.prepare(`
    SELECT
      id, revision, work_id AS "workId", retired_at AS "retiredAt",
      title, content, category, aliases_json AS "aliasesJson", enabled
    FROM lore_entries WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => {
    const label = "Canon Lore row";
    const enabled = integerValue(row, "enabled", label);
    if (enabled !== 0 && enabled !== 1) throw new Error(`${label}.enabled is invalid`);
    return Object.freeze({
      kind: "lore-entry" as const,
      id: requiredString(row, "id", label),
      revision: integerValue(row, "revision", label),
      workId: requiredString(row, "workId", label),
      retiredAt: nullableString(row, "retiredAt", label),
      fields: Object.freeze({
        title: requiredString(row, "title", label),
        content: textValue(row, "content", label),
        category: textValue(row, "category", label),
        aliases: stringArray(
          parseJson(textValue(row, "aliasesJson", label), `${label}.aliasesJson`),
          `${label}.aliases`,
        ),
        enabled: enabled === 1,
      }),
    });
  });
  const referenceRows = database.prepare(`
    SELECT knowledge_id AS "knowledgeId", entity_kind AS "entityKind",
      entity_id AS "entityId", order_index AS "orderIndex"
    FROM character_knowledge_entity_refs
    WHERE work_id = ? ORDER BY knowledge_id, order_index
  `).all(workId);
  const referencesByKnowledge = new Map<string, string[]>();
  for (const row of referenceRows) {
    const label = "Canon CharacterKnowledge reference row";
    const knowledgeId = requiredString(row, "knowledgeId", label);
    const key = canonEntityRefKey(parseCanonEntityRef({
      kind: requiredString(row, "entityKind", label),
      id: requiredString(row, "entityId", label),
    }, label));
    const references = referencesByKnowledge.get(knowledgeId) ?? [];
    references.push(key);
    referencesByKnowledge.set(knowledgeId, references);
  }
  const knowledge = database.prepare(`
    SELECT id, revision, work_id AS "workId", character_id AS "characterId",
      statement, stance, truth_status AS "truthStatus", status,
      updated_at AS "updatedAt"
    FROM character_knowledge WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => {
    const label = "Canon CharacterKnowledge row";
    const id = requiredString(row, "id", label);
    const status = requiredString(row, "status", label);
    return Object.freeze({
      kind: "character-knowledge" as const,
      id,
      revision: integerValue(row, "revision", label),
      workId: requiredString(row, "workId", label),
      retiredAt: status === "active"
        ? null
        : requiredString(row, "updatedAt", label),
      fields: Object.freeze({
        characterId: requiredString(row, "characterId", label),
        statement: requiredString(row, "statement", label),
        stance: requiredString(row, "stance", label),
        truthStatus: requiredString(row, "truthStatus", label),
        aboutRefKeys: Object.freeze([
          ...(referencesByKnowledge.get(id) ?? []),
        ]),
      }),
    });
  });
  return Object.freeze([...characters, ...relations, ...lore, ...knowledge]);
}

function readPendingFieldChanges(
  database: CanonSqliteDatabase,
  workId: EntityId<"Work">,
): readonly CanonPendingFieldChange[] {
  return Object.freeze(database.prepare(`
    SELECT
      candidate.source_document_revision_id AS "sourceDocumentRevisionId",
      item.target_kind AS "targetKind", item.operation,
      item.target_hint AS "targetHint", item.target_id AS "targetId",
      field.field_name AS "field", field.after_json AS "afterJson"
    FROM assistant_canon_review_field_changes AS field
    JOIN assistant_canon_review_items AS item
      ON item.work_id = field.work_id AND item.candidate_id = field.candidate_id
        AND item.id = field.item_id
    JOIN assistant_canon_review_candidates AS candidate
      ON candidate.work_id = item.work_id AND candidate.id = item.candidate_id
    WHERE
      candidate.work_id = ? AND candidate.status = 'ready' AND
      item.status = 'pending'
  `).all(workId).map((row) => {
    const label = "Pending canon field row";
    const operation = requiredString(row, "operation", label);
    const targetHint = requiredString(row, "targetHint", label);
    const storedTargetId = nullableString(row, "targetId", label);
    return Object.freeze({
      sourceDocumentRevisionId: requiredString(
        row,
        "sourceDocumentRevisionId",
        label,
      ),
      targetKind: requiredString(row, "targetKind", label) as CanonPendingFieldChange["targetKind"],
      targetIdentity: storedTargetId ?? `${operation}:${targetHint}`,
      field: requiredString(row, "field", label) as CanonFieldName,
      after: fieldValue(
        parseJson(textValue(row, "afterJson", label), `${label}.afterJson`),
        `${label}.after`,
      ),
    });
  }));
}

function readCandidate(
  database: CanonSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"CanonReviewCandidate">,
): CanonReviewCandidate | null {
  const headers = database.prepare(`
    SELECT
      id AS "candidateId", revision, request_id AS "requestId",
      work_id AS "workId", source_document_id AS "sourceDocumentId",
      source_document_revision_id AS "sourceDocumentRevisionId",
      source_from AS "sourceFrom", source_to AS "sourceTo",
      provider_id AS "providerId", model_id AS "modelId",
      prompt_version AS "promptVersion", status,
      context_receipt_id AS "contextReceiptId", created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM assistant_canon_review_candidates
    WHERE work_id = ? AND id = ? AND retired_at IS NULL
  `).all(workId, candidateId);
  if (headers.length === 0) return null;
  if (headers.length !== 1) throw new Error(`Canon Candidate is ambiguous: ${candidateId}`);
  return projectCandidate(database, headers[0]!);
}

function targetProjection(row: Record<string, unknown>) {
  const label = "Canon review item row";
  const kind = requiredString(row, "targetKind", label);
  const operation = requiredString(row, "operation", label);
  const storedTargetId = nullableString(row, "targetId", label);
  const expectedRevision = nullableInteger(row, "expectedTargetRevision", label);
  if (operation === "create") return { kind, operation };
  if (operation === "unresolved") {
    return {
      kind,
      operation,
      matchingTargetIds: stringArray(
        parseJson(
          textValue(row, "matchingTargetIdsJson", label),
          `${label}.matchingTargetIdsJson`,
        ),
        `${label}.matchingTargetIds`,
      ),
    };
  }
  if (operation !== "update" || storedTargetId === null || expectedRevision === null) {
    throw new Error("Canon review item target is invalid");
  }
  if (kind === "character") {
    return {
      kind,
      operation,
      characterId: storedTargetId,
      expectedRevision,
    };
  }
  if (kind === "character-relation") {
    return { kind, operation, relationId: storedTargetId, expectedRevision };
  }
  if (kind === "lore-entry") {
    return { kind, operation, loreEntryId: storedTargetId, expectedRevision };
  }
  return { kind, operation, knowledgeId: storedTargetId, expectedRevision };
}

function projectCandidate(
  database: CanonSqliteDatabase,
  header: Record<string, unknown>,
): CanonReviewCandidate {
  const label = "Canon review Candidate row";
  const candidateId = requiredString(header, "candidateId", label);
  const workId = requiredString(header, "workId", label);
  const itemRows = database.prepare(`
    SELECT
      id AS "itemId", target_kind AS "targetKind", operation,
      target_hint AS "targetHint", target_id AS "targetId",
      matching_target_ids_json AS "matchingTargetIdsJson",
      expected_target_revision AS "expectedTargetRevision",
      assertion_basis AS "assertionBasis", reason, status,
      applied_target_id AS "appliedTargetId"
    FROM assistant_canon_review_items
    WHERE work_id = ? AND candidate_id = ?
    ORDER BY created_at, id
  `).all(workId, candidateId);
  const items = itemRows.map((row) => {
    const itemLabel = "Canon review item row";
    const itemId = requiredString(row, "itemId", itemLabel);
    const fieldChanges = database.prepare(`
      SELECT
        field_name AS "field", before_json AS "beforeJson",
        after_json AS "afterJson", selected
      FROM assistant_canon_review_field_changes
      WHERE work_id = ? AND candidate_id = ? AND item_id = ?
      ORDER BY order_index
    `).all(workId, candidateId, itemId).map((fieldRow) => {
      const fieldLabel = "Canon review field row";
      const selected = integerValue(fieldRow, "selected", fieldLabel);
      return {
        field: requiredString(fieldRow, "field", fieldLabel),
        before: parseJson(
          textValue(fieldRow, "beforeJson", fieldLabel),
          `${fieldLabel}.beforeJson`,
        ),
        after: parseJson(
          textValue(fieldRow, "afterJson", fieldLabel),
          `${fieldLabel}.afterJson`,
        ),
        selected: selected === 1,
      };
    });
    const evidence = database.prepare(`
      SELECT
        id AS "evidenceId", source_document_id AS "documentId",
        source_document_revision_id AS "documentRevisionId",
        source_from AS "sourceFrom", source_to AS "sourceTo", exact_text AS "exactText",
        anchor_id AS "anchorId"
      FROM assistant_canon_review_evidence
      WHERE work_id = ? AND candidate_id = ? AND item_id = ?
      ORDER BY order_index
    `).all(workId, candidateId, itemId).map((evidenceRow) => ({
      evidenceId: requiredString(evidenceRow, "evidenceId", "Canon evidence row"),
      documentId: requiredString(evidenceRow, "documentId", "Canon evidence row"),
      documentRevisionId: requiredString(
        evidenceRow,
        "documentRevisionId",
        "Canon evidence row",
      ),
      from: integerValue(evidenceRow, "sourceFrom", "Canon evidence row"),
      to: integerValue(evidenceRow, "sourceTo", "Canon evidence row"),
      exactText: requiredString(evidenceRow, "exactText", "Canon evidence row"),
      anchorId: nullableString(evidenceRow, "anchorId", "Canon evidence row"),
    }));
    return {
      itemId,
      targetHint: requiredString(row, "targetHint", itemLabel),
      target: targetProjection(row),
      assertionBasis: requiredString(row, "assertionBasis", itemLabel),
      reason: requiredString(row, "reason", itemLabel),
      evidence,
      fieldChanges,
      status: requiredString(row, "status", itemLabel),
      appliedTargetId: nullableString(row, "appliedTargetId", itemLabel),
    };
  });
  return parseCanonReviewCandidate({
    schemaVersion: 1,
    candidateId,
    revision: integerValue(header, "revision", label),
    requestId: requiredString(header, "requestId", label),
    workId,
    sourceRange: {
      documentId: requiredString(header, "sourceDocumentId", label),
      documentRevisionId: requiredString(
        header,
        "sourceDocumentRevisionId",
        label,
      ),
      from: integerValue(header, "sourceFrom", label),
      to: integerValue(header, "sourceTo", label),
    },
    providerId: requiredString(header, "providerId", label),
    modelId: requiredString(header, "modelId", label),
    promptVersion: requiredString(header, "promptVersion", label),
    status: requiredString(header, "status", label),
    items,
    contextReceiptId: requiredString(header, "contextReceiptId", label),
    createdAt: requiredString(header, "createdAt", label),
    updatedAt: requiredString(header, "updatedAt", label),
  });
}

function readCandidates(
  database: CanonSqliteDatabase,
  command: ListCanonReviewCandidatesCommand,
): readonly CanonReviewCandidate[] {
  const statusSql = command.status === "actionable"
    ? "AND status IN ('ready', 'stale')"
    : command.status === "completed"
      ? "AND status IN ('completed', 'superseded')"
      : "";
  return Object.freeze(database.prepare(`
    SELECT
      id AS "candidateId", revision, request_id AS "requestId",
      work_id AS "workId", source_document_id AS "sourceDocumentId",
      source_document_revision_id AS "sourceDocumentRevisionId",
      source_from AS "sourceFrom", source_to AS "sourceTo",
      provider_id AS "providerId", model_id AS "modelId",
      prompt_version AS "promptVersion", status,
      context_receipt_id AS "contextReceiptId", created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM assistant_canon_review_candidates
    WHERE work_id = ? AND retired_at IS NULL ${statusSql}
    ORDER BY updated_at DESC, id DESC
  `).all(command.workId).map((row) => projectCandidate(database, row)));
}

function candidateLedgerRecord(candidate: CanonReviewCandidate): Poc3CanonReviewCandidateRecord {
  return Object.freeze({
    kind: "canonReviewCandidate",
    id: candidate.candidateId,
    schemaVersion: candidate.schemaVersion,
    revision: candidate.revision,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    requestId: candidate.requestId,
    workId: candidate.workId,
    sourceDocumentId: candidate.sourceRange.documentId,
    sourceDocumentRevisionId: candidate.sourceRange.documentRevisionId,
    sourceFrom: candidate.sourceRange.from,
    sourceTo: candidate.sourceRange.to,
    providerId: candidate.providerId,
    modelId: candidate.modelId,
    promptVersion: candidate.promptVersion,
    status: candidate.status,
    contextReceiptId: candidate.contextReceiptId,
    items: candidate.items.map((item) => Object.freeze({
      id: item.itemId,
      targetKind: item.target.kind,
      operation: item.target.operation,
      targetHint: item.targetHint,
      targetId: targetId(item),
      matchingTargetIds: matchingTargetIds(item),
      expectedTargetRevision: expectedTargetRevision(item),
      assertionBasis: item.assertionBasis,
      reason: item.reason,
      status: item.status,
      appliedTargetId: item.appliedTargetId,
      fieldChanges: item.fieldChanges.map(fieldRecord),
      evidence: item.evidence.map((entry, orderIndex) => Object.freeze({
        id: entry.evidenceId,
        sourceDocumentId: entry.documentId,
        sourceDocumentRevisionId: entry.documentRevisionId,
        sourceFrom: entry.from,
        sourceTo: entry.to,
        exactText: entry.exactText,
        orderIndex,
      })),
    })),
  });
}

function sourceForItem(
  item: CanonReviewItem,
  sources: readonly CanonReviewSourceSnapshot[],
): CanonReviewSourceSnapshot | null {
  const id = targetId(item);
  if (id === null) return null;
  return sources.find((source) => source.kind === item.target.kind && source.id === id) ?? null;
}

function sourceFields(source: CanonReviewSourceSnapshot): Record<string, CanonFieldValue> {
  return { ...source.fields } as Record<string, CanonFieldValue>;
}

function applySelectedChanges(
  source: CanonReviewSourceSnapshot | null,
  changes: readonly CanonFieldChange[],
): Record<string, CanonFieldValue> {
  const result = source === null ? {} : sourceFields(source);
  for (const change of changes) result[change.field] = change.after;
  return result;
}

function activeDuplicateIds(
  item: CanonReviewItem,
  sources: readonly CanonReviewSourceSnapshot[],
): readonly string[] {
  if (item.target.operation !== "create") return Object.freeze([]);
  const fields = applySelectedChanges(null, item.fieldChanges);
  if (item.target.kind === "character") {
    const names = new Set([
      String(fields.name ?? ""),
      ...(Array.isArray(fields.aliases) ? fields.aliases : []),
    ].filter(Boolean));
    return Object.freeze(sources.flatMap((source) =>
      source.kind === "character" && source.retiredAt === null &&
          [source.fields.name, ...source.fields.aliases].some((name) => names.has(name))
        ? [source.id]
        : []
    ));
  }
  if (item.target.kind === "lore-entry") {
    const names = new Set([
      String(fields.title ?? ""),
      ...(Array.isArray(fields.aliases) ? fields.aliases : []),
    ].filter(Boolean));
    return Object.freeze(sources.flatMap((source) =>
      source.kind === "lore-entry" && source.retiredAt === null &&
          [source.fields.title, ...source.fields.aliases].some((name) => names.has(name))
        ? [source.id]
        : []
    ));
  }
  if (item.target.kind === "character-relation") {
    return Object.freeze(sources.flatMap((source) =>
      source.kind === "character-relation" && source.retiredAt === null &&
          source.fields.fromCharacterId === fields.fromCharacterId &&
          source.fields.toCharacterId === fields.toCharacterId &&
          source.fields.kind === fields.kind
        ? [source.id]
        : []
    ));
  }
  return Object.freeze(sources.flatMap((source) =>
    source.kind === "character-knowledge" && source.retiredAt === null &&
        source.fields.characterId === fields.characterId &&
        source.fields.statement === fields.statement
      ? [source.id]
      : []
  ));
}

function entityRef(kind: CanonReviewItem["target"]["kind"], id: string): CanonEntityRef {
  if (kind === "character") {
    return Object.freeze({ kind, id: entityId<"Character">(id) });
  }
  if (kind === "character-relation") {
    return Object.freeze({ kind, id: entityId<"CharacterRelation">(id) });
  }
  if (kind === "lore-entry") {
    return Object.freeze({ kind, id: entityId<"LoreEntry">(id) });
  }
  return Object.freeze({ kind, id: entityId<"CharacterKnowledge">(id) });
}

function knowledgeRefRecords(values: readonly string[]) {
  return Object.freeze(values.map((value, orderIndex) => {
    const separator = value.indexOf(":");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`Canon CharacterKnowledge reference is invalid: ${value}`);
    }
    const ref = parseCanonEntityRef({
      kind: value.slice(0, separator),
      id: value.slice(separator + 1),
    }, "Canon CharacterKnowledge reference");
    return Object.freeze({
      entityKind: ref.kind,
      entityId: ref.id,
      orderIndex,
    });
  }));
}

function assertOwnedKnowledgeRefs(
  database: CanonSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: string,
  refs: readonly Readonly<{
    entityKind: string;
    entityId: string;
    orderIndex: number;
  }>[],
): void {
  if (database.prepare(`
    SELECT id FROM characters
    WHERE work_id = ? AND id = ? AND retired_at IS NULL
  `).all(workId, characterId).length !== 1) {
    throw new Error(`Canon CharacterKnowledge character is outside Work: ${characterId}`);
  }
  const tables: Readonly<Record<(typeof CANON_ENTITY_KINDS)[number], string>> = {
    character: "characters",
    "character-relation": "character_relations",
    "lore-entry": "lore_entries",
    "event-block": "event_blocks",
    "plot-thread": "plot_threads",
    "foreshadow-line": "foreshadow_lines",
    scene: "scene_identities",
    "continuity-thread": "continuity_threads",
    "character-knowledge": "character_knowledge",
  };
  for (const ref of refs) {
    const kind = ref.entityKind as (typeof CANON_ENTITY_KINDS)[number];
    const table = tables[kind];
    if (
      table === undefined ||
      database.prepare(`SELECT id FROM ${table} WHERE work_id = ? AND id = ?`)
        .all(workId, ref.entityId).length !== 1
    ) {
      throw new Error(
        `Canon CharacterKnowledge reference is outside Work: ${ref.entityKind}:${ref.entityId}`,
      );
    }
  }
}

function requiredField<T extends CanonFieldValue>(
  fields: Record<string, CanonFieldValue>,
  field: string,
  type: "string" | "boolean" | "array",
): T {
  const value = fields[field];
  const valid = type === "array"
    ? Array.isArray(value)
    : typeof value === type;
  if (!valid) throw new Error(`Canon field is unavailable: ${field}`);
  return value as T;
}

function nextCandidateStatus(candidate: CanonReviewCandidate, itemId: string) {
  return candidate.items.some((item) =>
    item.itemId !== itemId && item.status === "pending"
  ) ? "ready" as const : "completed" as const;
}

export function createLocalCanonService(input: Readonly<{
  database: CanonSqliteDatabase;
  ledger: Pick<StorageService, "transaction">;
  schemaVersion: number;
  anchorPolicy: AnchorPolicy;
  describeAnchorEvidence: DescribeAnchorEvidence;
  getDocument(documentId: EntityId<"Document">): CanonDocumentTarget | undefined;
  authorizeContext(request: AssistantContextRequest): AssistantContextAccessResult;
  connector?: CanonReviewConnector;
  now?: () => string;
  createId?: () => string;
}>): LocalCanonService {
  const now = input.now ?? (() => new Date().toISOString());
  const createId = input.createId ?? randomUUID;

  const assertWork = (workId: EntityId<"Work">) => {
    const rows = input.database.prepare(`
      SELECT id FROM works WHERE id = ? AND retired_at IS NULL
    `).all(workId);
    if (rows.length !== 1) throw new Error(`Unknown Work: ${workId}`);
  };

  const markStale = (candidate: CanonReviewCandidate) => {
    const updatedAt = now();
    const update = input.database.prepare(`
      UPDATE assistant_canon_review_candidates
      SET revision = revision + 1, status = 'stale', updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'ready'
    `).run(updatedAt, candidate.workId, candidate.candidateId, candidate.revision);
    if (changedRows(update) !== 1) {
      throw new Error(`Canon review Candidate changed: ${candidate.candidateId}`);
    }
    const stale = readCandidate(input.database, candidate.workId, candidate.candidateId);
    if (stale === null) throw new Error("Canon review Candidate disappeared");
    return stale;
  };

  const prepareReview = (command: RunCanonReviewCommand): PrepareCanonReviewResult => {
    assertWork(command.workId);
    const connector = input.connector;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseCanonReviewResult({ schemaVersion: 1, status: "login-required" }),
      });
    }
    const access = input.authorizeContext({
      schemaVersion: 1,
      requestId: entityId<"AssistantContextRequest">(command.requestId),
      workId: command.workId,
      conversationId: command.conversationId,
      capability: "canon.review",
      destinationId: connector.destinationId,
      requiredLocalScope: "selection",
      requiredExternalScope: "selection",
      readRanges: [command.sourceRange],
      transmittedRanges: [command.sourceRange],
    });
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseCanonReviewResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseCanonReviewResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const target = input.getDocument(command.sourceRange.documentId);
    if (target === undefined) {
      throw new Error(`Authorized canon source disappeared: ${command.sourceRange.documentId}`);
    }
    const manuscript = target.text.slice(command.sourceRange.from, command.sourceRange.to);
    const paragraphs = createCanonReviewParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    const characterReferences = readSources(input.database, command.workId)
      .flatMap((source) => source.kind === "character" && source.retiredAt === null &&
          [source.fields.name, ...source.fields.aliases].some((name) =>
            manuscript.includes(name)
          )
        ? [Object.freeze({
            characterId: entityId<"Character">(source.id),
            name: source.fields.name,
            aliases: source.fields.aliases,
          })]
        : []);
    const connectorInput = Object.freeze({
      requestId: command.requestId,
      requestedTargetKinds: command.requestedTargetKinds,
      paragraphs,
      characterReferences: Object.freeze(characterReferences),
    });
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      manuscript,
      connectorInput,
      execute: () => connector.execute(connectorInput),
    });
  };

  const recordReview = async (
    prepared: PreparedCanonReview,
    rawExecution: CanonReviewExecution,
  ): Promise<CanonReviewResult> => {
    const execution = parseCanonReviewExecution(rawExecution);
    assertWork(prepared.command.workId);
    const currentDocument = input.getDocument(prepared.command.sourceRange.documentId);
    const stale = currentDocument === undefined ||
      currentDocument.workId !== prepared.command.workId ||
      currentDocument.currentRevisionId !== prepared.command.sourceRange.documentRevisionId;
    const items = planCanonReviewItems({
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      manuscript: prepared.manuscript,
      payload: execution.payload,
      requestedTargetKinds: prepared.command.requestedTargetKinds,
      sources: readSources(input.database, prepared.command.workId),
      pendingFieldChanges: readPendingFieldChanges(
        input.database,
        prepared.command.workId,
      ),
      itemIdFactory: { create: createId },
      evidenceIdFactory: { create: createId },
    });
    if (items.length === 0) {
      return parseCanonReviewResult({ schemaVersion: 1, status: "no-change" });
    }
    const createdAt = now();
    const candidate = parseCanonReviewCandidate({
      schemaVersion: 1,
      candidateId: createId(),
      revision: 1,
      requestId: prepared.command.requestId,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: execution.providerId,
      modelId: execution.modelId,
      promptVersion: CANON_REVIEW_PROMPT_VERSION,
      status: stale ? "stale" : "ready",
      items,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    await input.ledger.transaction(async (transaction) => {
      transaction.write(candidateLedgerRecord(candidate));
    });
    return parseCanonReviewResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  };

  const list = (command: ListCanonReviewCandidatesCommand) => {
    assertWork(command.workId);
    return parseCanonReviewCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readCandidates(input.database, command),
    });
  };

  const updateItem = async (command: UpdateCanonReviewItemCommand) => {
    assertWork(command.workId);
    const candidate = readCandidate(input.database, command.workId, command.candidateId);
    if (candidate === null || candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Canon review Candidate revision conflict: ${command.candidateId}`);
    }
    if (candidate.status !== "ready") throw new Error("Canon review Candidate is not actionable");
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(`Canon review item is not pending: ${command.itemId}`);
    }
    if (command.fieldChanges.length !== item.fieldChanges.length) {
      throw new Error("Canon review edit cannot add or remove fields");
    }
    const requested = new Map(command.fieldChanges.map((change) => [change.field, change]));
    const changes = item.fieldChanges.map((current) => {
      const next = requested.get(current.field);
      if (next === undefined ||
        (current.before === null) !== (next.before === null) ||
        (current.before !== null && next.before !== null &&
          !canonFieldValuesEqual(current.before, next.before))) {
        throw new Error(`Canon review base field changed: ${current.field}`);
      }
      return next;
    });
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "canonReviewCandidateUpdate",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        itemId: item.itemId,
        targetKind: item.target.kind,
        operation: item.target.operation,
        targetId: targetId(item),
        matchingTargetIds: matchingTargetIds(item),
        expectedTargetRevision: expectedTargetRevision(item),
        fieldChanges: changes.map(fieldRecord),
        updatedAt: now(),
      });
    });
    const updated = readCandidate(input.database, command.workId, command.candidateId);
    if (updated === null) throw new Error("Canon review Candidate disappeared");
    return updated;
  };

  const resolveTarget = async (command: ResolveCanonReviewItemTargetCommand) => {
    assertWork(command.workId);
    const candidate = readCandidate(input.database, command.workId, command.candidateId);
    if (candidate === null || candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Canon review Candidate revision conflict: ${command.candidateId}`);
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.target.operation !== "unresolved") {
      throw new Error(`Canon review item target is not unresolved: ${command.itemId}`);
    }
    const resolved = resolveCanonReviewItemTarget({
      workId: command.workId,
      item,
      selection: command.target,
      sources: readSources(input.database, command.workId),
    });
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "canonReviewCandidateUpdate",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        itemId: item.itemId,
        targetKind: resolved.target.kind,
        operation: resolved.target.operation,
        targetId: targetId(resolved),
        matchingTargetIds: matchingTargetIds(resolved),
        expectedTargetRevision: expectedTargetRevision(resolved),
        fieldChanges: resolved.fieldChanges.map(fieldRecord),
        updatedAt: now(),
      });
    });
    const updated = readCandidate(input.database, command.workId, command.candidateId);
    if (updated === null) throw new Error("Canon review Candidate disappeared");
    return updated;
  };

  const createDecisionReceipt = (values: Readonly<{
    candidate: CanonReviewCandidate;
    item: CanonReviewItem;
    decision: "approve" | "reject";
    outcome: "applied" | "noop" | "rejected";
    target: CanonEntityRef | null;
    targetRevisionBefore: number | null;
    targetRevisionAfter: number | null;
    selectedFields: readonly CanonFieldName[];
    createdAt: string;
  }>): CanonReviewDecisionReceipt => parseCanonReviewDecisionReceipt({
    schemaVersion: 1,
    receiptId: createId(),
    workId: values.candidate.workId,
    candidateId: values.candidate.candidateId,
    itemId: values.item.itemId,
    decision: values.decision,
    outcome: values.outcome,
    target: values.target,
    targetRevisionBefore: values.targetRevisionBefore,
    targetRevisionAfter: values.targetRevisionAfter,
    selectedFields: values.selectedFields,
    sourceDocumentRevisionId: values.candidate.sourceRange.documentRevisionId,
    createdAt: values.createdAt,
  });

  const writeDecision = async (values: Readonly<{
    candidate: CanonReviewCandidate;
    item: CanonReviewItem;
    itemStatus: "approved" | "rejected";
    appliedTargetId: string | null;
    receipt: CanonReviewDecisionReceipt;
    additionalWrites?: (transaction: Parameters<Parameters<StorageService["transaction"]>[0]>[0]) => void;
  }>) => {
    const updatedAt = values.receipt.createdAt;
    await input.ledger.transaction(async (transaction) => {
      values.additionalWrites?.(transaction);
      transaction.write({
        kind: "canonReviewItemDecision",
        id: values.candidate.candidateId,
        workId: values.candidate.workId,
        itemId: values.item.itemId,
        expectedRevision: values.candidate.revision,
        candidateStatus: nextCandidateStatus(values.candidate, values.item.itemId),
        itemStatus: values.itemStatus,
        appliedTargetId: values.appliedTargetId,
        updatedAt,
        receipt: {
          id: values.receipt.receiptId,
          schemaVersion: values.receipt.schemaVersion,
          decision: values.receipt.decision,
          outcome: values.receipt.outcome,
          targetKind: values.receipt.target?.kind ?? null,
          targetId: values.receipt.target?.id ?? null,
          targetRevisionBefore: values.receipt.targetRevisionBefore,
          targetRevisionAfter: values.receipt.targetRevisionAfter,
          selectedFields: values.receipt.selectedFields,
          sourceDocumentRevisionId: values.receipt.sourceDocumentRevisionId,
          createdAt: values.receipt.createdAt,
        },
      });
    });
  };

  const decide = async (command: DecideCanonReviewItemCommand) => {
    assertWork(command.workId);
    const candidate = readCandidate(input.database, command.workId, command.candidateId);
    if (candidate === null || candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Canon review Candidate revision conflict: ${command.candidateId}`);
    }
    if (candidate.status !== "ready") throw new Error("Canon review Candidate is not actionable");
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(`Canon review item is not pending: ${command.itemId}`);
    }
    const sourceDocument = input.getDocument(candidate.sourceRange.documentId);
    const sourceStale = sourceDocument === undefined ||
      sourceDocument.workId !== candidate.workId ||
      sourceDocument.currentRevisionId !== candidate.sourceRange.documentRevisionId ||
      item.evidence.some((evidence) =>
        sourceDocument.text.slice(evidence.from, evidence.to) !== evidence.exactText
      );
    if (sourceStale) {
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "source-stale",
        candidate: markStale(candidate),
      });
    }
    const sources = readSources(input.database, command.workId);
    const currentSource = sourceForItem(item, sources);
    if (command.decision.kind === "reject") {
      const rejectedAt = now();
      const receipt = createDecisionReceipt({
        candidate,
        item,
        decision: "reject",
        outcome: "rejected",
        target: currentSource === null
          ? null
          : entityRef(currentSource.kind, currentSource.id),
        targetRevisionBefore: currentSource?.revision ?? null,
        targetRevisionAfter: currentSource?.revision ?? null,
        selectedFields: [],
        createdAt: rejectedAt,
      });
      await writeDecision({
        candidate,
        item,
        itemStatus: "rejected",
        appliedTargetId: null,
        receipt,
      });
      const updated = readCandidate(input.database, candidate.workId, candidate.candidateId)!;
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "rejected",
        candidate: updated,
        receipt,
      });
    }
    if (item.assertionBasis === "model-inference") {
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "inference-requires-user-authorship",
        candidate,
      });
    }
    if (item.target.operation === "unresolved") {
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "target-unresolved",
        candidate,
      });
    }
    if (
      item.target.operation === "update" &&
      (currentSource === null || currentSource.revision !== item.target.expectedRevision)
    ) {
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "target-stale",
        candidate: markStale(candidate),
      });
    }
    const duplicates = activeDuplicateIds(item, sources);
    if (duplicates.length > 0) {
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "possible-duplicate",
        candidate,
        matchingTargetIds: duplicates,
      });
    }
    const selected = item.fieldChanges.filter((change) => change.selected);
    const effective = currentSource === null
      ? selected
      : selected.filter((change) =>
          !canonFieldValuesEqual(
            sourceFields(currentSource)[change.field]!,
            change.after,
          )
        );
    if (selected.length > 0 && item.target.operation === "create") {
      const expectedFields = item.target.kind === "character"
        ? CANON_CHARACTER_FIELDS
        : item.target.kind === "character-relation"
          ? CANON_CHARACTER_RELATION_FIELDS
          : item.target.kind === "lore-entry"
            ? CANON_LORE_ENTRY_FIELDS
            : CANON_CHARACTER_KNOWLEDGE_FIELDS;
      if (expectedFields.some((field) => !selected.some((change) => change.field === field))) {
        throw new Error("Canon create approval requires every canonical field");
      }
    }
    const decidedAt = now();
    if (effective.length === 0) {
      const target = currentSource === null
        ? null
        : entityRef(currentSource.kind, currentSource.id);
      const receipt = createDecisionReceipt({
        candidate,
        item,
        decision: "approve",
        outcome: "noop",
        target,
        targetRevisionBefore: currentSource?.revision ?? null,
        targetRevisionAfter: currentSource?.revision ?? null,
        selectedFields: selected.map((change) => change.field),
        createdAt: decidedAt,
      });
      await writeDecision({
        candidate,
        item,
        itemStatus: "approved",
        appliedTargetId: target?.id ?? null,
        receipt,
      });
      const updated = readCandidate(input.database, candidate.workId, candidate.candidateId)!;
      return parseCanonReviewDecisionResult({
        schemaVersion: 1,
        status: "nothing-selected",
        candidate: updated,
        receipt,
      });
    }
    const targetIdentity = item.target.kind === "character-knowledge"
      ? createId()
      : currentSource?.id ?? createId();
    const nextFields = applySelectedChanges(currentSource, effective);
    if (item.target.kind === "character-relation") {
      const activeCharacters = new Set(sources.flatMap((source) =>
        source.kind === "character" && source.retiredAt === null ? [source.id] : []
      ));
      for (const field of ["fromCharacterId", "toCharacterId"]) {
        if (!activeCharacters.has(requiredField<string>(nextFields, field, "string"))) {
          throw new Error(`Canon relation character endpoint is unavailable: ${field}`);
        }
      }
    }
    const studioRows = input.database.prepare(`
      SELECT studio_id AS "studioId" FROM works WHERE id = ? AND retired_at IS NULL
    `).all(candidate.workId);
    if (studioRows.length !== 1) throw new Error(`Unknown Work: ${candidate.workId}`);
    const actorRef = requiredString(studioRows[0]!, "studioId", "Canon Work row");
    const anchors = item.evidence.map((evidence) => {
      const document = input.getDocument(evidence.documentId);
      if (
        document === undefined || document.workId !== candidate.workId ||
        document.currentRevisionId !== evidence.documentRevisionId ||
        document.text.slice(evidence.from, evidence.to) !== evidence.exactText
      ) {
        throw new Error("Canon review evidence changed before approval");
      }
      const anchorId = entityId<"Anchor">(createId());
      const anchor = createAnchorForKnownRevisionContent({
        meta: {
          id: anchorId,
          schemaVersion: input.schemaVersion,
          revision: 1,
          createdAt: decidedAt,
          updatedAt: decidedAt,
        },
        documentId: evidence.documentId,
        documentRevisionId: evidence.documentRevisionId,
        content: document.text,
        startOffset: evidence.from,
        endOffset: evidence.to,
        policy: input.anchorPolicy,
        commandRef: item.itemId,
        actorRef,
        describeEvidence: input.describeAnchorEvidence,
      });
      return Object.freeze({ evidence, anchorId, anchor });
    });
    const target = entityRef(item.target.kind, targetIdentity);
    const targetRevisionBefore = item.target.kind === "character-knowledge"
      ? null
      : currentSource?.revision ?? null;
    const targetRevisionAfter = item.target.kind === "character-knowledge"
      ? 1
      : currentSource === null ? 1 : currentSource.revision + 1;
    const receipt = createDecisionReceipt({
      candidate,
      item,
      decision: "approve",
      outcome: "applied",
      target,
      targetRevisionBefore,
      targetRevisionAfter,
      selectedFields: effective.map((change) => change.field),
      createdAt: decidedAt,
    });
    const existingLoreAnchorIds = item.target.kind === "lore-entry" && currentSource !== null
      ? input.database.prepare(`
          SELECT source_anchor_id AS "anchorId"
          FROM lore_entry_evidence
          WHERE work_id = ? AND lore_entry_id = ? ORDER BY created_at, source_anchor_id
        `).all(candidate.workId, currentSource.id).map((row) =>
          requiredString(row, "anchorId", "Lore evidence row")
        )
      : [];
    await writeDecision({
      candidate,
      item,
      itemStatus: "approved",
      appliedTargetId: targetIdentity,
      receipt,
      additionalWrites: (transaction) => {
        if (item.target.kind === "character") {
          const values = {
            name: requiredField<string>(nextFields, "name", "string"),
            aliases: requiredField<readonly string[]>(nextFields, "aliases", "array"),
            role: requiredField<string>(nextFields, "role", "string"),
            summary: requiredField<string>(nextFields, "summary", "string"),
            appearance: requiredField<string>(nextFields, "appearance", "string"),
            personality: requiredField<string>(nextFields, "personality", "string"),
            speech: requiredField<string>(nextFields, "speech", "string"),
            goal: requiredField<string>(nextFields, "goal", "string"),
            conflict: requiredField<string>(nextFields, "conflict", "string"),
            note: requiredField<string>(nextFields, "note", "string"),
          };
          transaction.write(currentSource === null ? {
            kind: "character",
            id: targetIdentity,
            schemaVersion: input.schemaVersion,
            revision: 1,
            createdAt: decidedAt,
            updatedAt: decidedAt,
            workId: candidate.workId,
            ...values,
          } : {
            kind: "characterUpdate",
            id: targetIdentity,
            workId: candidate.workId,
            expectedRevision: currentSource.revision,
            schemaVersion: input.schemaVersion,
            updatedAt: decidedAt,
            ...values,
          });
        } else if (item.target.kind === "character-relation") {
          const values = {
            fromCharacterId: requiredField<string>(
              nextFields,
              "fromCharacterId",
              "string",
            ),
            toCharacterId: requiredField<string>(
              nextFields,
              "toCharacterId",
              "string",
            ),
            relationKind: requiredField<string>(nextFields, "kind", "string"),
            description: requiredField<string>(
              nextFields,
              "description",
              "string",
            ),
          };
          transaction.write(currentSource === null ? {
            kind: "characterRelation",
            id: targetIdentity,
            schemaVersion: input.schemaVersion,
            revision: 1,
            createdAt: decidedAt,
            updatedAt: decidedAt,
            workId: candidate.workId,
            ...values,
          } : {
            kind: "characterRelationUpdate",
            id: targetIdentity,
            workId: candidate.workId,
            expectedRevision: currentSource.revision,
            updatedAt: decidedAt,
            ...values,
          });
        } else if (item.target.kind === "lore-entry") {
          const values = {
            title: requiredField<string>(nextFields, "title", "string"),
            content: requiredField<string>(nextFields, "content", "string"),
            category: requiredField<string>(nextFields, "category", "string"),
            aliases: requiredField<readonly string[]>(nextFields, "aliases", "array"),
            enabled: requiredField<boolean>(nextFields, "enabled", "boolean"),
          };
          transaction.write(currentSource === null ? {
            kind: "loreEntry",
            id: targetIdentity,
            schemaVersion: input.schemaVersion,
            revision: 1,
            createdAt: decidedAt,
            updatedAt: decidedAt,
            workId: candidate.workId,
            ...values,
          } : {
            kind: "loreEntryUpdate",
            id: targetIdentity,
            workId: candidate.workId,
            expectedRevision: currentSource.revision,
            schemaVersion: input.schemaVersion,
            updatedAt: decidedAt,
            ...values,
          });
          transaction.write({
            kind: "loreEntryHistory",
            id: createId(),
            schemaVersion: input.schemaVersion,
            workId: candidate.workId,
            loreEntryId: targetIdentity,
            entryRevision: targetRevisionAfter,
            changeKind: currentSource === null ? "created" : "updated",
            ...values,
            evidenceAnchorIds: [
              ...existingLoreAnchorIds,
              ...anchors.map((entry) => entry.anchorId),
            ],
            changedAt: decidedAt,
          });
        } else {
          const characterId = requiredField<string>(
            nextFields,
            "characterId",
            "string",
          );
          const statement = requiredField<string>(
            nextFields,
            "statement",
            "string",
          );
          const stance = requiredField<string>(nextFields, "stance", "string");
          const truthStatus = requiredField<string>(
            nextFields,
            "truthStatus",
            "string",
          );
          const aboutRefs = knowledgeRefRecords(requiredField<readonly string[]>(
            nextFields,
            "aboutRefKeys",
            "array",
          ));
          assertOwnedKnowledgeRefs(
            input.database,
            candidate.workId,
            characterId,
            aboutRefs,
          );
          if (currentSource !== null) {
            transaction.write({
              kind: "characterKnowledgeStatus",
              id: currentSource.id,
              workId: candidate.workId,
              expectedRevision: currentSource.revision,
              status: "superseded",
              supersededByKnowledgeId: targetIdentity,
              retiredReason: null,
              updatedAt: decidedAt,
            });
          }
          transaction.write({
            kind: "characterKnowledge",
            id: targetIdentity,
            schemaVersion: 1,
            revision: 1,
            createdAt: decidedAt,
            updatedAt: decidedAt,
            workId: candidate.workId,
            characterId,
            statement,
            stance,
            truthStatus,
            status: "active",
            supersedesKnowledgeId: currentSource?.id ?? null,
            supersededByKnowledgeId: null,
            retiredReason: null,
            aboutRefs,
          });
          if (currentSource !== null) {
            transaction.write({
              kind: "characterKnowledgeTransition",
              id: createId(),
              schemaVersion: 1,
              workId: candidate.workId,
              knowledgeId: currentSource.id,
              transitionKind: "superseded",
              revisionBefore: currentSource.revision,
              revisionAfter: currentSource.revision + 1,
              successorKnowledgeId: targetIdentity,
              reason: "정보 변화 후보 승인",
              evidenceAnchorIds: anchors.map((entry) => entry.anchorId),
              createdAt: decidedAt,
            });
          }
          transaction.write({
            kind: "characterKnowledgeTransition",
            id: createId(),
            schemaVersion: 1,
            workId: candidate.workId,
            knowledgeId: targetIdentity,
            transitionKind: "created",
            revisionBefore: null,
            revisionAfter: 1,
            successorKnowledgeId: null,
            reason: currentSource === null
              ? "정보 변화 후보 승인"
              : `${currentSource.id} 대체`,
            evidenceAnchorIds: anchors.map((entry) => entry.anchorId),
            createdAt: decidedAt,
          });
        }
        for (const entry of anchors) {
          transaction.write(anchorRecord(candidate.workId, entry.anchor));
          transaction.write({
            kind: "canonReviewEvidence",
            id: entry.evidence.evidenceId,
            workId: candidate.workId,
            candidateId: candidate.candidateId,
            itemId: item.itemId,
            anchorId: entry.anchorId,
          });
          if (item.target.kind === "character") {
            transaction.write({
              kind: "characterEvidence",
              id: createId(),
              workId: candidate.workId,
              characterId: targetIdentity,
              sourceDocumentId: entry.evidence.documentId,
              sourceAnchorId: entry.anchorId,
              createdAt: decidedAt,
            });
          } else if (item.target.kind === "lore-entry") {
            transaction.write({
              kind: "loreEntryEvidence",
              id: createId(),
              workId: candidate.workId,
              loreEntryId: targetIdentity,
              sourceDocumentId: entry.evidence.documentId,
              sourceAnchorId: entry.anchorId,
              createdAt: decidedAt,
            });
          } else if (item.target.kind === "character-knowledge") {
            transaction.write({
              kind: "characterKnowledgeEvidence",
              id: createId(),
              schemaVersion: 1,
              workId: candidate.workId,
              knowledgeId: targetIdentity,
              sourceDocumentId: entry.evidence.documentId,
              sourceDocumentRevisionId: entry.evidence.documentRevisionId,
              sourceFrom: entry.evidence.from,
              sourceTo: entry.evidence.to,
              exactText: entry.evidence.exactText,
              anchorId: entry.anchorId,
              orderIndex: anchors.indexOf(entry),
              createdAt: decidedAt,
            });
          }
        }
      },
    });
    const updated = readCandidate(input.database, candidate.workId, candidate.candidateId);
    if (updated === null) throw new Error("Canon review Candidate disappeared");
    return parseCanonReviewDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: updated,
      receipt,
    });
  };

  return Object.freeze({
    prepareReview,
    recordReview,
    list,
    updateItem,
    resolveTarget,
    decide,
  });
}
