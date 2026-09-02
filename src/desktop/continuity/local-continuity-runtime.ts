import { randomUUID } from "node:crypto";

import {
  createAnchorForKnownRevisionContent,
  type AnchorPolicy,
  type DescribeAnchorEvidence,
} from "../../application/anchors/create-anchor";
import type {
  AssistantContextAccessResult,
  AssistantContextRange,
  AssistantContextRequest,
} from "../../application/assistant/assistant-context-permission";
import {
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../../application/canon/canon-entity-ref";
import {
  CONTINUITY_REVIEW_PROMPT_VERSION,
  parseContinuityReviewCandidate,
  parseContinuityReviewCandidateList,
  parseContinuityReviewDecisionReceipt,
  parseContinuityReviewDecisionResult,
  parseContinuityReviewResult,
  type ContinuityReviewCandidate,
  type ContinuityReviewCandidateList,
  type ContinuityReviewDecisionReceipt,
  type ContinuityReviewDecisionResult,
  type ContinuityReviewItem,
  type ContinuityReviewResult,
  type DecideContinuityReviewItemCommand,
  type ListContinuityReviewCandidatesCommand,
  type RunContinuityReviewCommand,
  type UpdateContinuityReviewItemCommand,
} from "../../application/continuity/continuity-review-contract";
import {
  createContinuityReviewParagraphs,
  parseContinuityReviewExecution,
  type ContinuityReviewConnectorInput,
  type ContinuityReviewExecution,
  type ContinuityReviewParagraph,
  type ContinuityReviewSubjectReference,
} from "../../application/continuity/continuity-review-model-output";
import {
  findPotentialContinuityDuplicateThreadIds,
  planContinuityReviewItems,
  type ContinuityThreadSourceSnapshot,
} from "../../application/continuity/continuity-review-planner";
import {
  parseContinuityOverviewProjection,
  parseContinuityThreadProjection,
  type ContinuityEvidenceProjection,
  type ContinuityOverviewProjection,
  type ContinuityThreadProjection,
  type CreateContinuityThreadCommand,
  type DismissContinuityThreadCommand,
  type ListContinuityThreadsCommand,
  type ResolveContinuityThreadCommand,
  type UpdateContinuityThreadCommand,
} from "../../application/continuity/continuity-thread-contract";
import type { StorageService } from "../../application/storage/storage-service";
import type {
  Poc3AnchorRecord,
  Poc3ContinuityReviewCandidateRecord,
  Poc3ContinuitySubjectRefData,
} from "../../domain/poc-3-storage-ledger";
import { entityId, type Anchor, type EntityId } from "../../domain/writing";

type SqliteStatement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
  run(...parameters: readonly unknown[]): unknown;
}>;

export type ContinuitySqliteDatabase = Readonly<{
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}>;

export type ContinuityDocumentTarget = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  currentRevisionId: EntityId<"DocumentRevision">;
  text: string;
}>;

export type ContinuityReviewConnector = Readonly<{
  destinationId: string;
  isConnected(): boolean;
  execute(input: ContinuityReviewConnectorInput): Promise<ContinuityReviewExecution>;
}>;

export type ContinuityEvidenceAnchorResolution = Readonly<{
  documentRevisionId: EntityId<"DocumentRevision">;
  integrity: "resolved" | "needsReview" | "broken";
  range: Readonly<{ from: number; to: number }> | null;
}>;

export type PreparedContinuityReview = Readonly<{
  command: RunContinuityReviewCommand;
  contextReceiptId: EntityId<"AssistantContextReceipt">;
  manuscript: string;
  paragraphs: readonly ContinuityReviewParagraph[];
  subjectReferences: readonly ContinuityReviewSubjectReference[];
  execute(): Promise<ContinuityReviewExecution>;
}>;

export type PrepareContinuityReviewResult =
  | Readonly<{ result: ContinuityReviewResult }>
  | PreparedContinuityReview;

export type LocalContinuityService = Readonly<{
  create(command: CreateContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  update(command: UpdateContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  list(command: ListContinuityThreadsCommand): Promise<ContinuityOverviewProjection>;
  resolve(command: ResolveContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  dismiss(command: DismissContinuityThreadCommand): Promise<ContinuityThreadProjection>;
  prepareReview(command: RunContinuityReviewCommand): PrepareContinuityReviewResult;
  recordReview(
    prepared: PreparedContinuityReview,
    execution: ContinuityReviewExecution,
  ): Promise<ContinuityReviewResult>;
  listCandidates(
    command: ListContinuityReviewCandidatesCommand,
  ): ContinuityReviewCandidateList;
  updateItem(command: UpdateContinuityReviewItemCommand): Promise<ContinuityReviewCandidate>;
  decide(command: DecideContinuityReviewItemCommand): Promise<ContinuityReviewDecisionResult>;
}>;

type StoredContinuityEvidence = Readonly<{
  anchorId: EntityId<"Anchor">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  exactText: string;
  phase: "opened" | "resolution";
}>;

const SUPPORTED_SUBJECT_KINDS = new Set<CanonEntityRef["kind"]>([
  "character",
  "character-relation",
  "lore-entry",
  "event-block",
  "plot-thread",
  "foreshadow-line",
  "scene",
]);

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

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const result = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${label}[${index}] must be non-empty text`);
    }
    return entry;
  });
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(result);
}

function subjectRefRecords(
  refs: readonly CanonEntityRef[],
): readonly Poc3ContinuitySubjectRefData[] {
  return Object.freeze(refs.map((ref, orderIndex) => Object.freeze({
    entityKind: ref.kind,
    entityId: ref.id,
    orderIndex,
  })));
}

function refsFromRecords(
  refs: readonly Poc3ContinuitySubjectRefData[],
  label: string,
): readonly CanonEntityRef[] {
  return parseCanonEntityRefList(refs.map((ref) => ({
    kind: ref.entityKind,
    id: ref.entityId,
  })), label);
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

function readActorRef(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
): string {
  const rows = database.prepare(`
    SELECT studio_id AS "studioId"
    FROM works WHERE id = ? AND retired_at IS NULL
  `).all(workId);
  if (rows.length !== 1) throw new Error(`Unknown Work: ${workId}`);
  return requiredString(rows[0]!, "studioId", "Continuity Work row");
}

function assertWork(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
): void {
  readActorRef(database, workId);
}

function readOwnedSubjectRefs(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
): readonly CanonEntityRef[] {
  const definitions = [
    ["character", "characters"],
    ["character-relation", "character_relations"],
    ["lore-entry", "lore_entries"],
    ["event-block", "event_blocks"],
    ["plot-thread", "plot_threads"],
    ["foreshadow-line", "foreshadow_lines"],
    ["scene", "scene_identities"],
  ] as const;
  const raw = definitions.flatMap(([kind, table]) =>
    database.prepare(`
      SELECT id FROM ${table}
      WHERE work_id = ? AND retired_at IS NULL ORDER BY id
    `).all(workId).map((row) => ({
      kind,
      id: requiredString(row, "id", `Continuity ${table} row`),
    }))
  );
  return parseCanonEntityRefList(raw, "Continuity Work subject refs");
}

function assertOwnedSubjectRefs(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
  refs: readonly CanonEntityRef[],
): void {
  const owned = new Set(readOwnedSubjectRefs(database, workId).map((ref) =>
    `${ref.kind}:${ref.id}`
  ));
  for (const ref of refs) {
    if (!SUPPORTED_SUBJECT_KINDS.has(ref.kind) || !owned.has(`${ref.kind}:${ref.id}`)) {
      throw new Error(`Continuity subject is outside Work: ${ref.kind}/${ref.id}`);
    }
  }
}

function readConnectorSubjectReferences(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
  manuscript: string,
): readonly ContinuityReviewSubjectReference[] {
  const characterRows = database.prepare(`
    SELECT id, revision, name, aliases_json AS "aliasesJson"
    FROM characters
    WHERE work_id = ? AND retired_at IS NULL ORDER BY id
  `).all(workId).flatMap((row) => {
    const label = requiredString(row, "name", "Continuity Character row");
    const aliases = stringArray(
      parseJson(textValue(row, "aliasesJson", "Continuity Character row"), "Character aliases"),
      "Character aliases",
    );
    return [label, ...aliases].some((name) => manuscript.includes(name))
      ? [Object.freeze({
          entity: Object.freeze({
            kind: "character" as const,
            id: entityId<"Character">(requiredString(row, "id", "Continuity Character row")),
          }),
          revision: integerValue(row, "revision", "Continuity Character row"),
          label,
        })]
      : [];
  });
  const labeledDefinitions = [
    ["lore-entry", "lore_entries", "title"],
    ["event-block", "event_blocks", "title"],
    ["plot-thread", "plot_threads", "title"],
    ["foreshadow-line", "foreshadow_lines", "title"],
  ] as const;
  const labeledRows = labeledDefinitions.flatMap(([kind, table, labelField]) =>
    database.prepare(`
      SELECT id, revision, ${labelField} AS label
      FROM ${table}
      WHERE work_id = ? AND retired_at IS NULL ORDER BY id
    `).all(workId).flatMap((row) => {
      const label = requiredString(row, "label", `Continuity ${table} row`);
      if (!manuscript.includes(label)) return [];
      return [Object.freeze({
        entity: Object.freeze({ kind, id: requiredString(row, "id", `Continuity ${table} row`) }),
        revision: integerValue(row, "revision", `Continuity ${table} row`),
        label,
      }) as ContinuityReviewSubjectReference];
    })
  );
  return Object.freeze([...characterRows, ...labeledRows]);
}

function readThreadSnapshots(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
): readonly ContinuityThreadSourceSnapshot[] {
  return Object.freeze(database.prepare(`
    SELECT id, revision, work_id AS "workId", kind, title, note, status
    FROM continuity_threads WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => {
    const threadId = requiredString(row, "id", "Continuity thread row");
    const refs = database.prepare(`
      SELECT entity_kind AS "entityKind", entity_id AS "entityId", order_index AS "orderIndex"
      FROM continuity_thread_entity_refs
      WHERE work_id = ? AND thread_id = ? ORDER BY order_index
    `).all(workId, threadId).map((refRow) => ({
      entityKind: requiredString(refRow, "entityKind", "Continuity subject row"),
      entityId: requiredString(refRow, "entityId", "Continuity subject row"),
      orderIndex: integerValue(refRow, "orderIndex", "Continuity subject row"),
    }));
    return Object.freeze({
      threadId: entityId<"ContinuityThread">(threadId),
      workId: entityId<"Work">(requiredString(row, "workId", "Continuity thread row")),
      revision: integerValue(row, "revision", "Continuity thread row"),
      kind: requiredString(row, "kind", "Continuity thread row") as ContinuityThreadSourceSnapshot["kind"],
      title: requiredString(row, "title", "Continuity thread row"),
      note: textValue(row, "note", "Continuity thread row"),
      status: requiredString(row, "status", "Continuity thread row") as ContinuityThreadSourceSnapshot["status"],
      subjectRefs: refsFromRecords(refs, "Continuity thread subject refs"),
    });
  }));
}

function readThreadHeader(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
  threadId: EntityId<"ContinuityThread">,
): ContinuityThreadSourceSnapshot | null {
  return readThreadSnapshots(database, workId).find((entry) => entry.threadId === threadId) ?? null;
}

function readStoredEvidence(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
  threadId: EntityId<"ContinuityThread">,
): readonly StoredContinuityEvidence[] {
  return Object.freeze(database.prepare(`
    SELECT
      evidence.phase, evidence.source_document_id AS "documentId",
      evidence.source_document_revision_id AS "documentRevisionId",
      evidence.source_from AS "sourceFrom", evidence.source_to AS "sourceTo",
      evidence.exact_text AS "exactText", evidence.anchor_id AS "anchorId",
      anchor.exact_quote AS "anchorExactText"
    FROM continuity_thread_evidence AS evidence
    JOIN anchors AS anchor
      ON anchor.work_id = evidence.work_id AND anchor.document_id = evidence.source_document_id
        AND anchor.id = evidence.anchor_id
    WHERE evidence.work_id = ? AND evidence.thread_id = ?
    ORDER BY evidence.phase, evidence.order_index
  `).all(workId, threadId).map((row) => {
    const label = "Continuity evidence row";
    const exactText = requiredString(row, "exactText", label);
    if (exactText !== requiredString(row, "anchorExactText", label)) {
      throw new Error("Continuity evidence snapshot does not match its Anchor");
    }
    const phase = requiredString(row, "phase", label);
    if (phase !== "opened" && phase !== "resolution") {
      throw new Error(`Unsupported Continuity evidence phase: ${phase}`);
    }
    return Object.freeze({
      phase,
      anchorId: entityId<"Anchor">(requiredString(row, "anchorId", label)),
      documentId: entityId<"Document">(requiredString(row, "documentId", label)),
      documentRevisionId: entityId<"DocumentRevision">(
        requiredString(row, "documentRevisionId", label),
      ),
      from: integerValue(row, "sourceFrom", label),
      to: integerValue(row, "sourceTo", label),
      exactText,
    });
  }));
}

function defaultResolveEvidenceAnchor(
  getDocument: (documentId: EntityId<"Document">) => ContinuityDocumentTarget | undefined,
  workId: EntityId<"Work">,
  evidence: StoredContinuityEvidence,
): ContinuityEvidenceAnchorResolution {
  const target = getDocument(evidence.documentId);
  if (target === undefined || target.workId !== workId) {
    return Object.freeze({
      documentRevisionId: evidence.documentRevisionId,
      integrity: "broken",
      range: null,
    });
  }
  if (
    target.currentRevisionId === evidence.documentRevisionId &&
    target.text.slice(evidence.from, evidence.to) === evidence.exactText
  ) {
    return Object.freeze({
      documentRevisionId: target.currentRevisionId,
      integrity: "resolved",
      range: Object.freeze({ from: evidence.from, to: evidence.to }),
    });
  }
  const first = target.text.indexOf(evidence.exactText);
  if (first < 0) {
    return Object.freeze({
      documentRevisionId: target.currentRevisionId,
      integrity: "broken",
      range: null,
    });
  }
  if (target.text.indexOf(evidence.exactText, first + 1) >= 0) {
    return Object.freeze({
      documentRevisionId: target.currentRevisionId,
      integrity: "needsReview",
      range: null,
    });
  }
  return Object.freeze({
    documentRevisionId: target.currentRevisionId,
    integrity: "resolved",
    range: Object.freeze({ from: first, to: first + evidence.exactText.length }),
  });
}

async function projectThread(
  input: Readonly<{
    database: ContinuitySqliteDatabase;
    getDocument(documentId: EntityId<"Document">): ContinuityDocumentTarget | undefined;
    resolveEvidenceAnchor?: (input: Readonly<{
      workId: EntityId<"Work">;
      anchorId: EntityId<"Anchor">;
      documentId: EntityId<"Document">;
      sourceDocumentRevisionId: EntityId<"DocumentRevision">;
      exactText: string;
      sourceRange: Readonly<{ from: number; to: number }>;
    }>) => Promise<ContinuityEvidenceAnchorResolution>;
    workId: EntityId<"Work">;
    threadId: EntityId<"ContinuityThread">;
  }>,
): Promise<ContinuityThreadProjection> {
  const rows = input.database.prepare(`
    SELECT
      id AS "threadId", revision, work_id AS "workId", kind, title, note,
      status, opened_at AS "openedAt", resolved_at AS "resolvedAt",
      updated_at AS "updatedAt"
    FROM continuity_threads WHERE work_id = ? AND id = ?
  `).all(input.workId, input.threadId);
  if (rows.length !== 1) throw new Error(`Unknown Continuity thread: ${input.threadId}`);
  const row = rows[0]!;
  const refs = input.database.prepare(`
    SELECT entity_kind AS "entityKind", entity_id AS "entityId", order_index AS "orderIndex"
    FROM continuity_thread_entity_refs
    WHERE work_id = ? AND thread_id = ? ORDER BY order_index
  `).all(input.workId, input.threadId).map((refRow) => ({
    entityKind: requiredString(refRow, "entityKind", "Continuity subject row"),
    entityId: requiredString(refRow, "entityId", "Continuity subject row"),
    orderIndex: integerValue(refRow, "orderIndex", "Continuity subject row"),
  }));
  const storedEvidence = readStoredEvidence(input.database, input.workId, input.threadId);
  const evidence = await Promise.all(storedEvidence.map(async (entry) => {
    const resolution = input.resolveEvidenceAnchor === undefined
      ? defaultResolveEvidenceAnchor(input.getDocument, input.workId, entry)
      : await input.resolveEvidenceAnchor({
          workId: input.workId,
          anchorId: entry.anchorId,
          documentId: entry.documentId,
          sourceDocumentRevisionId: entry.documentRevisionId,
          exactText: entry.exactText,
          sourceRange: Object.freeze({ from: entry.from, to: entry.to }),
        });
    return Object.freeze({
      phase: entry.phase,
      projection: Object.freeze({
        anchorId: entry.anchorId,
        documentId: entry.documentId,
        documentRevisionId: resolution.documentRevisionId,
        exactText: entry.exactText,
        integrity: resolution.integrity,
        range: resolution.range,
      }) satisfies ContinuityEvidenceProjection,
    });
  }));
  const history = input.database.prepare(`
    SELECT
      id AS "transitionId", thread_id AS "threadId",
      transition_kind AS kind, revision_before AS "revisionBefore",
      revision_after AS "revisionAfter", resolution_mode AS "resolutionMode",
      reason, evidence_anchor_ids_json AS "evidenceAnchorIdsJson",
      created_at AS "createdAt"
    FROM continuity_thread_history
    WHERE work_id = ? AND thread_id = ? ORDER BY revision_after
  `).all(input.workId, input.threadId).map((historyRow) => ({
    transitionId: requiredString(historyRow, "transitionId", "Continuity history row"),
    threadId: requiredString(historyRow, "threadId", "Continuity history row"),
    kind: requiredString(historyRow, "kind", "Continuity history row"),
    revisionBefore: historyRow.revisionBefore === null
      ? null
      : integerValue(historyRow, "revisionBefore", "Continuity history row"),
    revisionAfter: integerValue(historyRow, "revisionAfter", "Continuity history row"),
    resolutionMode: nullableString(historyRow, "resolutionMode", "Continuity history row"),
    reason: textValue(historyRow, "reason", "Continuity history row"),
    evidenceAnchorIds: stringArray(
      parseJson(
        textValue(historyRow, "evidenceAnchorIdsJson", "Continuity history row"),
        "Continuity history evidence Anchors",
      ),
      "Continuity history evidence Anchors",
    ),
    createdAt: requiredString(historyRow, "createdAt", "Continuity history row"),
  }));
  return parseContinuityThreadProjection({
    schemaVersion: 1,
    threadId: requiredString(row, "threadId", "Continuity thread row"),
    revision: integerValue(row, "revision", "Continuity thread row"),
    workId: requiredString(row, "workId", "Continuity thread row"),
    kind: requiredString(row, "kind", "Continuity thread row"),
    title: requiredString(row, "title", "Continuity thread row"),
    note: textValue(row, "note", "Continuity thread row"),
    subjectRefs: refsFromRecords(refs, "Continuity thread subject refs"),
    status: requiredString(row, "status", "Continuity thread row"),
    openedEvidence: evidence.filter((entry) => entry.phase === "opened").map((entry) => entry.projection),
    resolutionEvidence: evidence.filter((entry) => entry.phase === "resolution").map((entry) => entry.projection),
    history,
    openedAt: requiredString(row, "openedAt", "Continuity thread row"),
    resolvedAt: nullableString(row, "resolvedAt", "Continuity thread row"),
    updatedAt: requiredString(row, "updatedAt", "Continuity thread row"),
  });
}

function readProjectedSources(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
) {
  const plots = database.prepare(`
    SELECT id, revision, title, summary, note, retired_at AS "retiredAt"
    FROM plot_threads WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => ({
    sourceKind: "plot-thread" as const,
    entity: { kind: "plot-thread" as const, id: requiredString(row, "id", "Plot row") },
    revision: integerValue(row, "revision", "Plot row"),
    title: requiredString(row, "title", "Plot row"),
    note: [textValue(row, "summary", "Plot row"), textValue(row, "note", "Plot row")]
      .filter((value) => value.trim().length > 0).join("\n"),
    active: nullableString(row, "retiredAt", "Plot row") === null,
  }));
  const foreshadow = database.prepare(`
    SELECT id, revision, title, note, retired_at AS "retiredAt"
    FROM foreshadow_lines WHERE work_id = ? ORDER BY id
  `).all(workId).map((row) => ({
    sourceKind: "foreshadow-line" as const,
    entity: {
      kind: "foreshadow-line" as const,
      id: requiredString(row, "id", "Foreshadow row"),
    },
    revision: integerValue(row, "revision", "Foreshadow row"),
    title: requiredString(row, "title", "Foreshadow row"),
    note: textValue(row, "note", "Foreshadow row"),
    active: nullableString(row, "retiredAt", "Foreshadow row") === null,
  }));
  const goals = database.prepare(`
    SELECT id, revision, name, goal, retired_at AS "retiredAt"
    FROM characters WHERE work_id = ? AND trim(goal) <> '' ORDER BY id
  `).all(workId).map((row) => ({
    sourceKind: "character-goal" as const,
    entity: { kind: "character" as const, id: requiredString(row, "id", "Character goal row") },
    revision: integerValue(row, "revision", "Character goal row"),
    title: `${requiredString(row, "name", "Character goal row")} · 목표`,
    note: requiredString(row, "goal", "Character goal row"),
    active: nullableString(row, "retiredAt", "Character goal row") === null,
  }));
  return Object.freeze([...plots, ...foreshadow, ...goals]);
}

function projectCandidate(
  database: ContinuitySqliteDatabase,
  header: Record<string, unknown>,
): ContinuityReviewCandidate {
  const label = "Continuity review Candidate row";
  const workId = requiredString(header, "workId", label);
  const candidateId = requiredString(header, "candidateId", label);
  const items = database.prepare(`
    SELECT
      id AS "itemId", assertion_basis AS "assertionBasis",
      thread_kind AS "threadKind", title, note,
      subject_refs_json AS "subjectRefsJson", reason,
      potential_duplicate_thread_ids_json AS "duplicateIdsJson",
      status, applied_thread_id AS "appliedThreadId"
    FROM assistant_continuity_review_items
    WHERE work_id = ? AND candidate_id = ? ORDER BY created_at, id
  `).all(workId, candidateId).map((row) => {
    const itemId = requiredString(row, "itemId", "Continuity review item row");
    const refsRaw = parseJson(
      textValue(row, "subjectRefsJson", "Continuity review item row"),
      "Continuity review subject refs",
    );
    if (!Array.isArray(refsRaw)) throw new Error("Continuity review subject refs must be an array");
    const refs = refsRaw.map((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new Error(`Continuity review subject ref[${index}] is invalid`);
      }
      const record = entry as Record<string, unknown>;
      return {
        entityKind: requiredString(record, "entityKind", "Continuity review subject ref"),
        entityId: requiredString(record, "entityId", "Continuity review subject ref"),
        orderIndex: integerValue(record, "orderIndex", "Continuity review subject ref"),
      };
    });
    const evidence = database.prepare(`
      SELECT
        id AS "evidenceId", source_document_id AS "documentId",
        source_document_revision_id AS "documentRevisionId",
        source_from AS "sourceFrom", source_to AS "sourceTo",
        exact_text AS "exactText", anchor_id AS "anchorId"
      FROM assistant_continuity_review_evidence
      WHERE work_id = ? AND candidate_id = ? AND item_id = ? ORDER BY order_index
    `).all(workId, candidateId, itemId).map((evidenceRow) => ({
      evidenceId: requiredString(evidenceRow, "evidenceId", "Continuity review evidence row"),
      documentId: requiredString(evidenceRow, "documentId", "Continuity review evidence row"),
      documentRevisionId: requiredString(
        evidenceRow,
        "documentRevisionId",
        "Continuity review evidence row",
      ),
      from: integerValue(evidenceRow, "sourceFrom", "Continuity review evidence row"),
      to: integerValue(evidenceRow, "sourceTo", "Continuity review evidence row"),
      exactText: requiredString(evidenceRow, "exactText", "Continuity review evidence row"),
      anchorId: nullableString(evidenceRow, "anchorId", "Continuity review evidence row"),
    }));
    return {
      itemId,
      assertionBasis: requiredString(row, "assertionBasis", "Continuity review item row"),
      draft: {
        kind: requiredString(row, "threadKind", "Continuity review item row"),
        title: requiredString(row, "title", "Continuity review item row"),
        note: textValue(row, "note", "Continuity review item row"),
        subjectRefs: refsFromRecords(refs, "Continuity review subject refs"),
      },
      reason: requiredString(row, "reason", "Continuity review item row"),
      evidence,
      potentialDuplicateThreadIds: stringArray(
        parseJson(
          textValue(row, "duplicateIdsJson", "Continuity review item row"),
          "Continuity review duplicate ids",
        ),
        "Continuity review duplicate ids",
      ),
      status: requiredString(row, "status", "Continuity review item row"),
      appliedThreadId: nullableString(row, "appliedThreadId", "Continuity review item row"),
    };
  });
  return parseContinuityReviewCandidate({
    schemaVersion: 1,
    candidateId,
    revision: integerValue(header, "revision", label),
    requestId: requiredString(header, "requestId", label),
    workId,
    sourceRange: {
      documentId: requiredString(header, "sourceDocumentId", label),
      documentRevisionId: requiredString(header, "sourceDocumentRevisionId", label),
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

function candidateHeaderSql(statusSql = "") {
  return `
    SELECT
      id AS "candidateId", revision, request_id AS "requestId",
      work_id AS "workId", source_document_id AS "sourceDocumentId",
      source_document_revision_id AS "sourceDocumentRevisionId",
      source_from AS "sourceFrom", source_to AS "sourceTo",
      provider_id AS "providerId", model_id AS "modelId",
      prompt_version AS "promptVersion", status,
      context_receipt_id AS "contextReceiptId", created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM assistant_continuity_review_candidates
    WHERE work_id = ? AND retired_at IS NULL ${statusSql}
  `;
}

function readCandidate(
  database: ContinuitySqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"ContinuityReviewCandidate">,
): ContinuityReviewCandidate | null {
  const rows = database.prepare(`${candidateHeaderSql("AND id = ?")} LIMIT 2`)
    .all(workId, candidateId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error(`Continuity Candidate is ambiguous: ${candidateId}`);
  return projectCandidate(database, rows[0]!);
}

function readCandidates(
  database: ContinuitySqliteDatabase,
  command: ListContinuityReviewCandidatesCommand,
): readonly ContinuityReviewCandidate[] {
  const filter = command.status === "actionable"
    ? "AND status IN ('ready', 'stale')"
    : command.status === "completed"
      ? "AND status IN ('completed', 'superseded')"
      : "";
  return Object.freeze(database.prepare(
    `${candidateHeaderSql(filter)} ORDER BY updated_at DESC, id DESC`,
  ).all(command.workId).map((row) => projectCandidate(database, row)));
}

function candidateLedgerRecord(
  candidate: ContinuityReviewCandidate,
): Poc3ContinuityReviewCandidateRecord {
  return Object.freeze({
    kind: "continuityReviewCandidate",
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
      assertionBasis: item.assertionBasis,
      threadKind: item.draft.kind,
      title: item.draft.title,
      note: item.draft.note,
      subjectRefs: subjectRefRecords(item.draft.subjectRefs),
      reason: item.reason,
      potentialDuplicateThreadIds: item.potentialDuplicateThreadIds,
      status: item.status,
      appliedThreadId: item.appliedThreadId,
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

function nextCandidateStatus(candidate: ContinuityReviewCandidate, itemId: string) {
  return candidate.items.some((item) => item.itemId !== itemId && item.status === "pending")
    ? "ready" as const
    : "completed" as const;
}

export function createLocalContinuityService(input: Readonly<{
  database: ContinuitySqliteDatabase;
  ledger: Pick<StorageService, "transaction">;
  schemaVersion: number;
  anchorPolicy: AnchorPolicy;
  describeAnchorEvidence: DescribeAnchorEvidence;
  getDocument(documentId: EntityId<"Document">): ContinuityDocumentTarget | undefined;
  authorizeContext(request: AssistantContextRequest): AssistantContextAccessResult;
  resolveEvidenceAnchor?: (input: Readonly<{
    workId: EntityId<"Work">;
    anchorId: EntityId<"Anchor">;
    documentId: EntityId<"Document">;
    sourceDocumentRevisionId: EntityId<"DocumentRevision">;
    exactText: string;
    sourceRange: Readonly<{ from: number; to: number }>;
  }>) => Promise<ContinuityEvidenceAnchorResolution>;
  connector?: ContinuityReviewConnector;
  now?: () => string;
  createId?: () => string;
}>): LocalContinuityService {
  const now = input.now ?? (() => new Date().toISOString());
  const createId = input.createId ?? randomUUID;

  const createAnchor = (
    workId: EntityId<"Work">,
    range: AssistantContextRange,
    commandRef: string,
    createdAt: string,
  ) => {
    const document = input.getDocument(range.documentId);
    if (document === undefined) {
      throw new Error(`Continuity source is unavailable: ${range.documentId}`);
    }
    if (document.workId !== workId) {
      throw new Error(`Continuity source is outside Work: ${range.documentId}`);
    }
    if (document.currentRevisionId !== range.documentRevisionId) {
      throw new Error(`Continuity source revision is stale: ${range.documentRevisionId}`);
    }
    if (
      range.from < 0 || range.to <= range.from || range.to > document.text.length
    ) {
      throw new Error(`Continuity source range is invalid: ${range.documentId}`);
    }
    const anchorId = entityId<"Anchor">(createId());
    const anchor = createAnchorForKnownRevisionContent({
      meta: {
        id: anchorId,
        schemaVersion: input.schemaVersion,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      documentId: range.documentId,
      documentRevisionId: range.documentRevisionId,
      content: document.text,
      startOffset: range.from,
      endOffset: range.to,
      policy: input.anchorPolicy,
      commandRef,
      actorRef: readActorRef(input.database, workId),
      describeEvidence: input.describeAnchorEvidence,
    });
    return Object.freeze({ document, anchorId, anchor });
  };

  const getProjectedThread = (
    workId: EntityId<"Work">,
    threadId: EntityId<"ContinuityThread">,
  ) => projectThread({
    database: input.database,
    getDocument: input.getDocument,
    ...(input.resolveEvidenceAnchor === undefined
      ? {}
      : { resolveEvidenceAnchor: input.resolveEvidenceAnchor }),
    workId,
    threadId,
  });

  const create = async (command: CreateContinuityThreadCommand) => {
    assertWork(input.database, command.workId);
    assertOwnedSubjectRefs(input.database, command.workId, command.subjectRefs);
    const createdAt = now();
    const threadId = entityId<"ContinuityThread">(createId());
    const evidence = command.openedEvidenceRange === null
      ? null
      : createAnchor(command.workId, command.openedEvidenceRange, threadId, createdAt);
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityThread",
        id: threadId,
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        workId: command.workId,
        threadKind: command.kind,
        title: command.title,
        note: command.note,
        status: "open",
        openedAt: createdAt,
        resolvedAt: null,
        subjectRefs: subjectRefRecords(command.subjectRefs),
      });
      if (evidence !== null) {
        transaction.write(anchorRecord(command.workId, evidence.anchor));
        transaction.write({
          kind: "continuityEvidence",
          id: createId(),
          schemaVersion: 1,
          workId: command.workId,
          threadId,
          phase: "opened",
          sourceDocumentId: command.openedEvidenceRange!.documentId,
          sourceDocumentRevisionId: command.openedEvidenceRange!.documentRevisionId,
          sourceFrom: command.openedEvidenceRange!.from,
          sourceTo: command.openedEvidenceRange!.to,
          exactText: evidence.anchor.exactQuote,
          anchorId: evidence.anchorId,
          orderIndex: 0,
          createdAt,
        });
      }
      transaction.write({
        kind: "continuityTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        threadId,
        transitionKind: "created",
        revisionBefore: null,
        revisionAfter: 1,
        resolutionMode: null,
        reason: "",
        evidenceAnchorIds: evidence === null ? [] : [evidence.anchorId],
        createdAt,
      });
    });
    return getProjectedThread(command.workId, threadId);
  };

  const update = async (command: UpdateContinuityThreadCommand) => {
    assertWork(input.database, command.workId);
    assertOwnedSubjectRefs(input.database, command.workId, command.subjectRefs);
    const current = readThreadHeader(input.database, command.workId, command.threadId);
    if (current === null || current.revision !== command.expectedRevision) {
      throw new Error(`Continuity thread revision conflict: ${command.threadId}`);
    }
    if (current.status !== "open") throw new Error("Closed Continuity thread cannot be edited");
    const updatedAt = now();
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityThreadUpdate",
        id: command.threadId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        threadKind: command.kind,
        title: command.title,
        note: command.note,
        status: "open",
        resolvedAt: null,
        subjectRefs: subjectRefRecords(command.subjectRefs),
        updatedAt,
      });
      transaction.write({
        kind: "continuityTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        threadId: command.threadId,
        transitionKind: "updated",
        revisionBefore: command.expectedRevision,
        revisionAfter: command.expectedRevision + 1,
        resolutionMode: null,
        reason: "",
        evidenceAnchorIds: [],
        createdAt: updatedAt,
      });
    });
    return getProjectedThread(command.workId, command.threadId);
  };

  const closeThread = async (
    command: ResolveContinuityThreadCommand | DismissContinuityThreadCommand,
  ) => {
    assertWork(input.database, command.workId);
    const current = readThreadHeader(input.database, command.workId, command.threadId);
    if (current === null || current.revision !== command.expectedRevision) {
      throw new Error(`Continuity thread revision conflict: ${command.threadId}`);
    }
    if (current.status !== "open") throw new Error("Continuity thread is already closed");
    const closedAt = now();
    const isDismiss = !("resolutionMode" in command);
    const evidence = isDismiss || command.resolutionEvidenceRange === null
      ? null
      : createAnchor(command.workId, command.resolutionEvidenceRange, command.threadId, closedAt);
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityThreadUpdate",
        id: command.threadId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        threadKind: current.kind,
        title: current.title,
        note: current.note,
        status: isDismiss ? "dismissed" : "resolved",
        resolvedAt: closedAt,
        subjectRefs: subjectRefRecords(current.subjectRefs),
        updatedAt: closedAt,
      });
      if (evidence !== null && !isDismiss) {
        transaction.write(anchorRecord(command.workId, evidence.anchor));
        transaction.write({
          kind: "continuityEvidence",
          id: createId(),
          schemaVersion: 1,
          workId: command.workId,
          threadId: command.threadId,
          phase: "resolution",
          sourceDocumentId: command.resolutionEvidenceRange!.documentId,
          sourceDocumentRevisionId: command.resolutionEvidenceRange!.documentRevisionId,
          sourceFrom: command.resolutionEvidenceRange!.from,
          sourceTo: command.resolutionEvidenceRange!.to,
          exactText: evidence.anchor.exactQuote,
          anchorId: evidence.anchorId,
          orderIndex: 0,
          createdAt: closedAt,
        });
      }
      transaction.write({
        kind: "continuityTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        threadId: command.threadId,
        transitionKind: isDismiss ? "dismissed" : "resolved",
        revisionBefore: command.expectedRevision,
        revisionAfter: command.expectedRevision + 1,
        resolutionMode: isDismiss ? null : command.resolutionMode,
        reason: command.reason,
        evidenceAnchorIds: evidence === null ? [] : [evidence.anchorId],
        createdAt: closedAt,
      });
    });
    return getProjectedThread(command.workId, command.threadId);
  };

  const list = async (command: ListContinuityThreadsCommand) => {
    assertWork(input.database, command.workId);
    const condition = command.status === "open"
      ? "AND status = 'open'"
      : command.status === "closed"
        ? "AND status IN ('resolved', 'dismissed')"
        : "";
    const ids = input.database.prepare(`
      SELECT id FROM continuity_threads
      WHERE work_id = ? ${condition} ORDER BY updated_at DESC, id DESC
    `).all(command.workId).map((row) => entityId<"ContinuityThread">(
      requiredString(row, "id", "Continuity thread list row"),
    ));
    return parseContinuityOverviewProjection({
      schemaVersion: 1,
      workId: command.workId,
      threads: await Promise.all(ids.map((threadId) =>
        getProjectedThread(command.workId, threadId)
      )),
      projectedSources: readProjectedSources(input.database, command.workId),
    });
  };

  const prepareReview = (
    command: RunContinuityReviewCommand,
  ): PrepareContinuityReviewResult => {
    assertWork(input.database, command.workId);
    const connector = input.connector;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseContinuityReviewResult({ schemaVersion: 1, status: "login-required" }),
      });
    }
    const target = input.getDocument(command.sourceRange.documentId);
    if (target === undefined) {
      return Object.freeze({
        result: parseContinuityReviewResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "source-unavailable",
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const sourceRejection = target.workId !== command.workId
      ? "outside-work" as const
      : target.currentRevisionId !== command.sourceRange.documentRevisionId
        ? "stale-context" as const
        : command.sourceRange.from < 0 ||
            command.sourceRange.to <= command.sourceRange.from ||
            command.sourceRange.to > target.text.length
          ? "invalid-range" as const
          : null;
    if (sourceRejection !== null) {
      return Object.freeze({
        result: parseContinuityReviewResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: sourceRejection,
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const access = input.authorizeContext({
      schemaVersion: 1,
      requestId: entityId<"AssistantContextRequest">(command.requestId),
      workId: command.workId,
      conversationId: command.conversationId,
      capability: "continuity.review",
      destinationId: connector.destinationId,
      requiredLocalScope: "selection",
      requiredExternalScope: "selection",
      readRanges: [command.sourceRange],
      transmittedRanges: [command.sourceRange],
    });
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseContinuityReviewResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseContinuityReviewResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const manuscript = target.text.slice(command.sourceRange.from, command.sourceRange.to);
    const paragraphs = createContinuityReviewParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    const subjectReferences = readConnectorSubjectReferences(
      input.database,
      command.workId,
      manuscript,
    );
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      manuscript,
      paragraphs,
      subjectReferences,
      execute: () => connector.execute(Object.freeze({
        requestedRange: command.sourceRange,
        paragraphs,
        subjectReferences,
      })),
    });
  };

  const recordReview = async (
    prepared: PreparedContinuityReview,
    rawExecution: ContinuityReviewExecution,
  ): Promise<ContinuityReviewResult> => {
    const execution = parseContinuityReviewExecution(rawExecution);
    assertWork(input.database, prepared.command.workId);
    const currentDocument = input.getDocument(prepared.command.sourceRange.documentId);
    const stale = currentDocument === undefined ||
      currentDocument.workId !== prepared.command.workId ||
      currentDocument.currentRevisionId !== prepared.command.sourceRange.documentRevisionId ||
      currentDocument.text.slice(
        prepared.command.sourceRange.from,
        prepared.command.sourceRange.to,
      ) !== prepared.manuscript;
    const pendingItems = readCandidates(input.database, {
      schemaVersion: 1,
      workId: prepared.command.workId,
      status: "actionable",
    }).flatMap((candidate) => candidate.items);
    const items = planContinuityReviewItems({
      proposals: execution.payload.proposals,
      paragraphs: prepared.paragraphs,
      sourceRange: prepared.command.sourceRange,
      allowedSubjectRefs: prepared.subjectReferences.map((entry) => entry.entity),
      activeThreads: readThreadSnapshots(input.database, prepared.command.workId),
      pendingItems,
      itemIdFactory: { create: createId },
      evidenceIdFactory: { create: createId },
    });
    if (items.length === 0) {
      return parseContinuityReviewResult({ schemaVersion: 1, status: "no-change" });
    }
    const createdAt = now();
    const candidate = parseContinuityReviewCandidate({
      schemaVersion: 1,
      candidateId: createId(),
      revision: 1,
      requestId: prepared.command.requestId,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: execution.providerId,
      modelId: execution.modelId,
      promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
      status: stale ? "stale" : "ready",
      items,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    await input.ledger.transaction(async (transaction) => {
      transaction.write(candidateLedgerRecord(candidate));
    });
    return parseContinuityReviewResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  };

  const listCandidates = (command: ListContinuityReviewCandidatesCommand) => {
    assertWork(input.database, command.workId);
    return parseContinuityReviewCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readCandidates(input.database, command),
    });
  };

  const updateItem = async (command: UpdateContinuityReviewItemCommand) => {
    assertWork(input.database, command.workId);
    const candidate = readCandidate(input.database, command.workId, command.candidateId);
    if (candidate === null || candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Continuity review Candidate revision conflict: ${command.candidateId}`);
    }
    if (candidate.status !== "ready") throw new Error("Continuity review Candidate is not actionable");
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(`Continuity review item is not pending: ${command.itemId}`);
    }
    assertOwnedSubjectRefs(input.database, command.workId, command.draft.subjectRefs);
    const duplicateIds = findPotentialContinuityDuplicateThreadIds(
      command.draft,
      readThreadSnapshots(input.database, command.workId),
    );
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityReviewCandidateUpdate",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        itemId: item.itemId,
        threadKind: command.draft.kind,
        title: command.draft.title,
        note: command.draft.note,
        subjectRefs: subjectRefRecords(command.draft.subjectRefs),
        potentialDuplicateThreadIds: duplicateIds,
        updatedAt: now(),
      });
    });
    const updated = readCandidate(input.database, command.workId, command.candidateId);
    if (updated === null) throw new Error("Continuity review Candidate disappeared");
    return updated;
  };

  const markStale = async (candidate: ContinuityReviewCandidate) => {
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityReviewCandidateStatus",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: "stale",
        updatedAt: now(),
      });
    });
    const stale = readCandidate(input.database, candidate.workId, candidate.candidateId);
    if (stale === null) throw new Error("Continuity review Candidate disappeared");
    return stale;
  };

  const createDecisionReceipt = (values: Readonly<{
    candidate: ContinuityReviewCandidate;
    item: ContinuityReviewItem;
    decision: "approve" | "reject";
    outcome: "applied" | "rejected";
    threadId: EntityId<"ContinuityThread"> | null;
    createdAt: string;
  }>): ContinuityReviewDecisionReceipt => parseContinuityReviewDecisionReceipt({
    schemaVersion: 1,
    receiptId: createId(),
    workId: values.candidate.workId,
    candidateId: values.candidate.candidateId,
    itemId: values.item.itemId,
    decision: values.decision,
    outcome: values.outcome,
    threadId: values.threadId,
    threadRevisionAfter: values.threadId === null ? null : 1,
    sourceDocumentRevisionId: values.candidate.sourceRange.documentRevisionId,
    createdAt: values.createdAt,
  });

  const decide = async (
    command: DecideContinuityReviewItemCommand,
  ): Promise<ContinuityReviewDecisionResult> => {
    assertWork(input.database, command.workId);
    const candidate = readCandidate(input.database, command.workId, command.candidateId);
    if (candidate === null) throw new Error(`Unknown Continuity review Candidate: ${command.candidateId}`);
    if (
      candidate.revision !== command.expectedCandidateRevision ||
      candidate.status !== "ready"
    ) {
      return parseContinuityReviewDecisionResult({
        schemaVersion: 1,
        status: "candidate-stale",
        candidate,
        missingDuplicateThreadIds: [],
      });
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      return parseContinuityReviewDecisionResult({
        schemaVersion: 1,
        status: "candidate-stale",
        candidate,
        missingDuplicateThreadIds: [],
      });
    }
    const decidedAt = now();
    if (command.decision === "reject") {
      const receipt = createDecisionReceipt({
        candidate,
        item,
        decision: "reject",
        outcome: "rejected",
        threadId: null,
        createdAt: decidedAt,
      });
      await input.ledger.transaction(async (transaction) => {
        transaction.write({
          kind: "continuityReviewItemDecision",
          id: candidate.candidateId,
          workId: candidate.workId,
          itemId: item.itemId,
          expectedRevision: candidate.revision,
          candidateStatus: nextCandidateStatus(candidate, item.itemId),
          itemStatus: "rejected",
          appliedThreadId: null,
          updatedAt: decidedAt,
          receipt: {
            id: receipt.receiptId,
            schemaVersion: receipt.schemaVersion,
            decision: receipt.decision,
            outcome: receipt.outcome,
            threadId: null,
            threadRevisionAfter: null,
            sourceDocumentRevisionId: receipt.sourceDocumentRevisionId,
            createdAt: receipt.createdAt,
          },
        });
      });
      const updated = readCandidate(input.database, candidate.workId, candidate.candidateId)!;
      return parseContinuityReviewDecisionResult({
        schemaVersion: 1,
        status: "rejected",
        candidate: updated,
        receipt,
      });
    }
    const sourceDocument = input.getDocument(candidate.sourceRange.documentId);
    const sourceStale = sourceDocument === undefined ||
      sourceDocument.workId !== candidate.workId ||
      sourceDocument.currentRevisionId !== candidate.sourceRange.documentRevisionId ||
      sourceDocument.text.slice(candidate.sourceRange.from, candidate.sourceRange.to) === "" ||
      item.evidence.some((evidence) =>
        sourceDocument.text.slice(evidence.from, evidence.to) !== evidence.exactText
      );
    if (sourceStale) {
      const stale = await markStale(candidate);
      return parseContinuityReviewDecisionResult({
        schemaVersion: 1,
        status: "source-stale",
        candidate: stale,
        missingDuplicateThreadIds: [],
      });
    }
    assertOwnedSubjectRefs(input.database, command.workId, item.draft.subjectRefs);
    const duplicateIds = findPotentialContinuityDuplicateThreadIds(
      item.draft,
      readThreadSnapshots(input.database, command.workId),
    );
    const acknowledged = new Set(command.acknowledgedDuplicateThreadIds);
    const missingDuplicateThreadIds = duplicateIds.filter((id) => !acknowledged.has(id));
    if (missingDuplicateThreadIds.length > 0) {
      return parseContinuityReviewDecisionResult({
        schemaVersion: 1,
        status: "duplicate-review-required",
        candidate,
        missingDuplicateThreadIds,
      });
    }
    const threadId = entityId<"ContinuityThread">(createId());
    const anchors = item.evidence.map((evidence) => {
      const current = input.getDocument(evidence.documentId);
      if (
        current === undefined || current.workId !== candidate.workId ||
        current.currentRevisionId !== evidence.documentRevisionId ||
        current.text.slice(evidence.from, evidence.to) !== evidence.exactText
      ) {
        throw new Error("Continuity review evidence changed before approval");
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
        content: current.text,
        startOffset: evidence.from,
        endOffset: evidence.to,
        policy: input.anchorPolicy,
        commandRef: item.itemId,
        actorRef: readActorRef(input.database, candidate.workId),
        describeEvidence: input.describeAnchorEvidence,
      });
      return Object.freeze({ evidence, anchorId, anchor });
    });
    const receipt = createDecisionReceipt({
      candidate,
      item,
      decision: "approve",
      outcome: "applied",
      threadId,
      createdAt: decidedAt,
    });
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "continuityThread",
        id: threadId,
        schemaVersion: 1,
        revision: 1,
        createdAt: decidedAt,
        updatedAt: decidedAt,
        workId: candidate.workId,
        threadKind: item.draft.kind,
        title: item.draft.title,
        note: item.draft.note,
        status: "open",
        openedAt: decidedAt,
        resolvedAt: null,
        subjectRefs: subjectRefRecords(item.draft.subjectRefs),
      });
      for (const [orderIndex, entry] of anchors.entries()) {
        transaction.write(anchorRecord(candidate.workId, entry.anchor));
        transaction.write({
          kind: "continuityEvidence",
          id: createId(),
          schemaVersion: 1,
          workId: candidate.workId,
          threadId,
          phase: "opened",
          sourceDocumentId: entry.evidence.documentId,
          sourceDocumentRevisionId: entry.evidence.documentRevisionId,
          sourceFrom: entry.evidence.from,
          sourceTo: entry.evidence.to,
          exactText: entry.evidence.exactText,
          anchorId: entry.anchorId,
          orderIndex,
          createdAt: decidedAt,
        });
        transaction.write({
          kind: "continuityReviewEvidence",
          id: entry.evidence.evidenceId,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          itemId: item.itemId,
          anchorId: entry.anchorId,
        });
      }
      transaction.write({
        kind: "continuityTransition",
        id: createId(),
        schemaVersion: 1,
        workId: candidate.workId,
        threadId,
        transitionKind: "created",
        revisionBefore: null,
        revisionAfter: 1,
        resolutionMode: null,
        reason: item.reason,
        evidenceAnchorIds: anchors.map((entry) => entry.anchorId),
        createdAt: decidedAt,
      });
      transaction.write({
        kind: "continuityReviewItemDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        itemId: item.itemId,
        expectedRevision: candidate.revision,
        candidateStatus: nextCandidateStatus(candidate, item.itemId),
        itemStatus: "approved",
        appliedThreadId: threadId,
        updatedAt: decidedAt,
        receipt: {
          id: receipt.receiptId,
          schemaVersion: receipt.schemaVersion,
          decision: receipt.decision,
          outcome: receipt.outcome,
          threadId,
          threadRevisionAfter: 1,
          sourceDocumentRevisionId: receipt.sourceDocumentRevisionId,
          createdAt: receipt.createdAt,
        },
      });
    });
    const updated = readCandidate(input.database, candidate.workId, candidate.candidateId);
    if (updated === null) throw new Error("Continuity review Candidate disappeared");
    return parseContinuityReviewDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: updated,
      receipt,
    });
  };

  return Object.freeze({
    create,
    update,
    list,
    resolve: (command) => closeThread(command),
    dismiss: (command) => closeThread(command),
    prepareReview,
    recordReview,
    listCandidates,
    updateItem,
    decide,
  });
}
