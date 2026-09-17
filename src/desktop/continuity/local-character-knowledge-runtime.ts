import { randomUUID } from "node:crypto";

import {
  createAnchorForKnownRevisionContent,
  type AnchorPolicy,
  type DescribeAnchorEvidence,
} from "../../application/anchors/create-anchor";
import type { AssistantContextRange } from "../../application/assistant/assistant-context-permission";
import {
  parseCanonEntityRefList,
  type CanonEntityRef,
} from "../../application/canon/canon-entity-ref";
import {
  parseCharacterKnowledgeListProjection,
  parseCharacterKnowledgeProjection,
  parsePovKnowledgeContextProjection,
  type CharacterKnowledgeListProjection,
  type CharacterKnowledgeProjection,
  type CreateCharacterKnowledgeCommand,
  type ListCharacterKnowledgeCommand,
  type PovKnowledgeContextProjection,
  type ProjectPovKnowledgeCommand,
  type RetireCharacterKnowledgeCommand,
  type SupersedeCharacterKnowledgeCommand,
  type UpdateCharacterKnowledgeCommand,
} from "../../application/continuity/character-knowledge-contract";
import type { StorageService } from "../../application/storage/storage-service";
import type {
  Poc3AnchorRecord,
  Poc3CharacterKnowledgeRefData,
} from "../../domain/poc-3-storage-ledger";
import { entityId, type Anchor, type EntityId } from "../../domain/writing";

type SqliteStatement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
}>;

export type CharacterKnowledgeSqliteDatabase = Readonly<{
  prepare(sql: string): SqliteStatement;
}>;

export type CharacterKnowledgeDocumentTarget = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  currentRevisionId: EntityId<"DocumentRevision">;
  text: string;
}>;

export type CharacterKnowledgeEvidenceAnchorResolution = Readonly<{
  documentRevisionId: EntityId<"DocumentRevision">;
  integrity: "resolved" | "needsReview" | "broken";
  range: Readonly<{ from: number; to: number }> | null;
}>;

export type LocalCharacterKnowledgeService = Readonly<{
  create(command: CreateCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  update(command: UpdateCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  supersede(command: SupersedeCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  retire(command: RetireCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  list(command: ListCharacterKnowledgeCommand): Promise<CharacterKnowledgeListProjection>;
  projectPov(command: ProjectPovKnowledgeCommand): Promise<PovKnowledgeContextProjection>;
}>;

type StoredEvidence = Readonly<{
  anchorId: EntityId<"Anchor">;
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  from: number;
  to: number;
  exactText: string;
}>;

type KnowledgeHeader = Readonly<{
  knowledgeId: EntityId<"CharacterKnowledge">;
  revision: number;
  status: "active" | "superseded" | "retired";
}>;

function requiredString(row: Record<string, unknown>, field: string, label: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function nullableString(row: Record<string, unknown>, field: string, label: string): string | null {
  return row[field] === null ? null : requiredString(row, field, label);
}

function integerValue(row: Record<string, unknown>, field: string, label: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
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

function aboutRefRecords(
  refs: readonly CanonEntityRef[],
): readonly Poc3CharacterKnowledgeRefData[] {
  return Object.freeze(refs.map((ref, orderIndex) => Object.freeze({
    entityKind: ref.kind,
    entityId: ref.id,
    orderIndex,
  })));
}

function readActorRef(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
): string {
  const rows = database.prepare(`
    SELECT studio_id AS "studioId" FROM works
    WHERE id = ? AND retired_at IS NULL
  `).all(workId);
  if (rows.length !== 1) throw new Error(`Unknown Work: ${workId}`);
  return requiredString(rows[0]!, "studioId", "CharacterKnowledge Work row");
}

function assertOwnedCharacter(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: EntityId<"Character">,
): void {
  const rows = database.prepare(`
    SELECT id FROM characters
    WHERE work_id = ? AND id = ? AND retired_at IS NULL
  `).all(workId, characterId);
  if (rows.length !== 1) {
    throw new Error(`CharacterKnowledge Character is outside Work: ${characterId}`);
  }
}

function isOwnedRef(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  ref: CanonEntityRef,
): boolean {
  const standardTables = {
    "character": "characters",
    "character-relation": "character_relations",
    "lore-entry": "lore_entries",
    "event-block": "event_blocks",
    "plot-thread": "plot_threads",
    "foreshadow-line": "foreshadow_lines",
    "scene": "scene_identities",
  } as const;
  if (ref.kind in standardTables) {
    const table = standardTables[ref.kind as keyof typeof standardTables];
    return database.prepare(`
      SELECT id FROM ${table}
      WHERE work_id = ? AND id = ? AND retired_at IS NULL
    `).all(workId, ref.id).length === 1;
  }
  if (ref.kind === "continuity-thread") {
    return database.prepare(`
      SELECT id FROM continuity_threads WHERE work_id = ? AND id = ?
    `).all(workId, ref.id).length === 1;
  }
  if (ref.kind === "character-knowledge") {
    return database.prepare(`
      SELECT id FROM character_knowledge
      WHERE work_id = ? AND id = ? AND status <> 'retired'
    `).all(workId, ref.id).length === 1;
  }
  return false;
}

function assertOwnedRefs(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  refs: readonly CanonEntityRef[],
): void {
  for (const ref of refs) {
    if (!isOwnedRef(database, workId, ref)) {
      throw new Error(`CharacterKnowledge reference is outside Work: ${ref.kind}/${ref.id}`);
    }
  }
}

function readHeader(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  knowledgeId: EntityId<"CharacterKnowledge">,
): KnowledgeHeader | null {
  const rows = database.prepare(`
    SELECT id AS "knowledgeId", revision, status
    FROM character_knowledge WHERE work_id = ? AND id = ?
  `).all(workId, knowledgeId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error(`CharacterKnowledge identity is ambiguous: ${knowledgeId}`);
  const row = rows[0]!;
  const status = requiredString(row, "status", "CharacterKnowledge header");
  if (status !== "active" && status !== "superseded" && status !== "retired") {
    throw new Error(`CharacterKnowledge status is unsupported: ${status}`);
  }
  return Object.freeze({
    knowledgeId: entityId<"CharacterKnowledge">(
      requiredString(row, "knowledgeId", "CharacterKnowledge header"),
    ),
    revision: integerValue(row, "revision", "CharacterKnowledge header"),
    status,
  });
}

function assertActiveRevision(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  knowledgeId: EntityId<"CharacterKnowledge">,
  expectedRevision: number,
): KnowledgeHeader {
  const current = readHeader(database, workId, knowledgeId);
  if (current === null || current.revision !== expectedRevision) {
    throw new Error(`CharacterKnowledge revision conflict: ${knowledgeId}`);
  }
  if (current.status !== "active") {
    throw new Error(`CharacterKnowledge is not active: ${knowledgeId}`);
  }
  return current;
}

function readStoredEvidence(
  database: CharacterKnowledgeSqliteDatabase,
  workId: EntityId<"Work">,
  knowledgeId: EntityId<"CharacterKnowledge">,
): readonly StoredEvidence[] {
  return Object.freeze(database.prepare(`
    SELECT
      evidence.anchor_id AS "anchorId",
      evidence.source_document_id AS "documentId",
      evidence.source_document_revision_id AS "documentRevisionId",
      evidence.source_from AS "sourceFrom", evidence.source_to AS "sourceTo",
      evidence.exact_text AS "exactText", anchor.exact_quote AS "anchorExactText"
    FROM character_knowledge_evidence AS evidence
    JOIN anchors AS anchor
      ON anchor.work_id = evidence.work_id AND
        anchor.document_id = evidence.source_document_id AND
        anchor.id = evidence.anchor_id
    WHERE evidence.work_id = ? AND evidence.knowledge_id = ?
    ORDER BY evidence.order_index
  `).all(workId, knowledgeId).map((row) => {
    const label = "CharacterKnowledge evidence row";
    const exactText = requiredString(row, "exactText", label);
    if (exactText !== requiredString(row, "anchorExactText", label)) {
      throw new Error("CharacterKnowledge evidence snapshot does not match its Anchor");
    }
    return Object.freeze({
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

function defaultResolveEvidence(
  getDocument: (documentId: EntityId<"Document">) => CharacterKnowledgeDocumentTarget | undefined,
  workId: EntityId<"Work">,
  evidence: StoredEvidence,
): CharacterKnowledgeEvidenceAnchorResolution {
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

async function projectKnowledge(input: Readonly<{
  database: CharacterKnowledgeSqliteDatabase;
  getDocument(documentId: EntityId<"Document">): CharacterKnowledgeDocumentTarget | undefined;
  resolveEvidenceAnchor?: (input: Readonly<{
    workId: EntityId<"Work">;
    anchorId: EntityId<"Anchor">;
    documentId: EntityId<"Document">;
    sourceDocumentRevisionId: EntityId<"DocumentRevision">;
    exactText: string;
    sourceRange: Readonly<{ from: number; to: number }>;
  }>) => Promise<CharacterKnowledgeEvidenceAnchorResolution>;
  workId: EntityId<"Work">;
  knowledgeId: EntityId<"CharacterKnowledge">;
}>): Promise<CharacterKnowledgeProjection> {
  const rows = input.database.prepare(`
    SELECT
      id AS "knowledgeId", revision, work_id AS "workId",
      character_id AS "characterId", statement, stance,
      truth_status AS "truthStatus", status,
      supersedes_knowledge_id AS "supersedesKnowledgeId",
      superseded_by_knowledge_id AS "supersededByKnowledgeId",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM character_knowledge WHERE work_id = ? AND id = ?
  `).all(input.workId, input.knowledgeId);
  if (rows.length !== 1) throw new Error(`Unknown CharacterKnowledge: ${input.knowledgeId}`);
  const row = rows[0]!;
  const aboutRefs = parseCanonEntityRefList(input.database.prepare(`
    SELECT entity_kind AS kind, entity_id AS id
    FROM character_knowledge_entity_refs
    WHERE work_id = ? AND knowledge_id = ? ORDER BY order_index
  `).all(input.workId, input.knowledgeId), "CharacterKnowledge about refs");
  const evidence = await Promise.all(readStoredEvidence(
    input.database,
    input.workId,
    input.knowledgeId,
  ).map(async (stored) => {
    const resolution = input.resolveEvidenceAnchor === undefined
      ? defaultResolveEvidence(input.getDocument, input.workId, stored)
      : await input.resolveEvidenceAnchor({
          workId: input.workId,
          anchorId: stored.anchorId,
          documentId: stored.documentId,
          sourceDocumentRevisionId: stored.documentRevisionId,
          exactText: stored.exactText,
          sourceRange: Object.freeze({ from: stored.from, to: stored.to }),
        });
    return Object.freeze({
      anchorId: stored.anchorId,
      documentId: stored.documentId,
      documentRevisionId: resolution.documentRevisionId,
      exactText: stored.exactText,
      integrity: resolution.integrity,
      range: resolution.range,
    });
  }));
  return parseCharacterKnowledgeProjection({
    schemaVersion: 1,
    knowledgeId: requiredString(row, "knowledgeId", "CharacterKnowledge row"),
    revision: integerValue(row, "revision", "CharacterKnowledge row"),
    workId: requiredString(row, "workId", "CharacterKnowledge row"),
    characterId: requiredString(row, "characterId", "CharacterKnowledge row"),
    statement: requiredString(row, "statement", "CharacterKnowledge row"),
    stance: requiredString(row, "stance", "CharacterKnowledge row"),
    truthStatus: requiredString(row, "truthStatus", "CharacterKnowledge row"),
    aboutRefs,
    evidence,
    status: requiredString(row, "status", "CharacterKnowledge row"),
    supersedesKnowledgeId: nullableString(
      row,
      "supersedesKnowledgeId",
      "CharacterKnowledge row",
    ),
    supersededByKnowledgeId: nullableString(
      row,
      "supersededByKnowledgeId",
      "CharacterKnowledge row",
    ),
    createdAt: requiredString(row, "createdAt", "CharacterKnowledge row"),
    updatedAt: requiredString(row, "updatedAt", "CharacterKnowledge row"),
  });
}

export function createLocalCharacterKnowledgeService(input: Readonly<{
  database: CharacterKnowledgeSqliteDatabase;
  ledger: Pick<StorageService, "transaction">;
  schemaVersion: number;
  anchorPolicy: AnchorPolicy;
  describeAnchorEvidence: DescribeAnchorEvidence;
  getDocument(documentId: EntityId<"Document">): CharacterKnowledgeDocumentTarget | undefined;
  resolveEvidenceAnchor?: (input: Readonly<{
    workId: EntityId<"Work">;
    anchorId: EntityId<"Anchor">;
    documentId: EntityId<"Document">;
    sourceDocumentRevisionId: EntityId<"DocumentRevision">;
    exactText: string;
    sourceRange: Readonly<{ from: number; to: number }>;
  }>) => Promise<CharacterKnowledgeEvidenceAnchorResolution>;
  now?: () => string;
  createId?: () => string;
}>): LocalCharacterKnowledgeService {
  const now = input.now ?? (() => new Date().toISOString());
  const createId = input.createId ?? randomUUID;

  const createEvidence = (
    workId: EntityId<"Work">,
    range: AssistantContextRange,
    commandRef: string,
    createdAt: string,
  ) => {
    const document = input.getDocument(range.documentId);
    if (document === undefined) {
      throw new Error(`CharacterKnowledge source is unavailable: ${range.documentId}`);
    }
    if (document.workId !== workId) {
      throw new Error(`CharacterKnowledge source is outside Work: ${range.documentId}`);
    }
    if (document.currentRevisionId !== range.documentRevisionId) {
      throw new Error(`CharacterKnowledge source revision is stale: ${range.documentRevisionId}`);
    }
    if (range.from < 0 || range.to <= range.from || range.to > document.text.length) {
      throw new Error(`CharacterKnowledge source range is invalid: ${range.documentId}`);
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
    return Object.freeze({ anchorId, anchor });
  };

  const project = (
    workId: EntityId<"Work">,
    knowledgeId: EntityId<"CharacterKnowledge">,
  ) => projectKnowledge({
    database: input.database,
    getDocument: input.getDocument,
    ...(input.resolveEvidenceAnchor === undefined
      ? {}
      : { resolveEvidenceAnchor: input.resolveEvidenceAnchor }),
    workId,
    knowledgeId,
  });

  const create = async (command: CreateCharacterKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    assertOwnedCharacter(input.database, command.workId, command.characterId);
    assertOwnedRefs(input.database, command.workId, command.aboutRefs);
    if (input.database.prepare(`
      SELECT id FROM character_knowledge
      WHERE work_id = ? AND character_id = ? AND statement = ? AND status = 'active'
    `).all(command.workId, command.characterId, command.statement).length > 0) {
      throw new Error(
        "CharacterKnowledge state for the same statement requires explicit supersession",
      );
    }
    const createdAt = now();
    const knowledgeId = entityId<"CharacterKnowledge">(createId());
    const evidence = command.evidenceRange === null
      ? null
      : createEvidence(command.workId, command.evidenceRange, knowledgeId, createdAt);
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "characterKnowledge",
        id: knowledgeId,
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        workId: command.workId,
        characterId: command.characterId,
        statement: command.statement,
        stance: command.stance,
        truthStatus: command.truthStatus,
        status: "active",
        supersedesKnowledgeId: null,
        supersededByKnowledgeId: null,
        retiredReason: null,
        aboutRefs: aboutRefRecords(command.aboutRefs),
      });
      if (evidence !== null) {
        transaction.write(anchorRecord(command.workId, evidence.anchor));
        transaction.write({
          kind: "characterKnowledgeEvidence",
          id: createId(),
          schemaVersion: 1,
          workId: command.workId,
          knowledgeId,
          sourceDocumentId: command.evidenceRange!.documentId,
          sourceDocumentRevisionId: command.evidenceRange!.documentRevisionId,
          sourceFrom: command.evidenceRange!.from,
          sourceTo: command.evidenceRange!.to,
          exactText: evidence.anchor.exactQuote,
          anchorId: evidence.anchorId,
          orderIndex: 0,
          createdAt,
        });
      }
      transaction.write({
        kind: "characterKnowledgeTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        knowledgeId,
        transitionKind: "created",
        revisionBefore: null,
        revisionAfter: 1,
        successorKnowledgeId: null,
        reason: "사용자 생성",
        evidenceAnchorIds: evidence === null ? [] : [evidence.anchorId],
        createdAt,
      });
    });
    return project(command.workId, knowledgeId);
  };

  const update = async (command: UpdateCharacterKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    assertOwnedRefs(input.database, command.workId, command.aboutRefs);
    assertActiveRevision(
      input.database,
      command.workId,
      command.knowledgeId,
      command.expectedRevision,
    );
    const updatedAt = now();
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "characterKnowledgeUpdate",
        id: command.knowledgeId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        statement: command.statement,
        aboutRefs: aboutRefRecords(command.aboutRefs),
        updatedAt,
      });
      transaction.write({
        kind: "characterKnowledgeTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        knowledgeId: command.knowledgeId,
        transitionKind: "updated",
        revisionBefore: command.expectedRevision,
        revisionAfter: command.expectedRevision + 1,
        successorKnowledgeId: null,
        reason: "사용자 수정",
        evidenceAnchorIds: [],
        createdAt: updatedAt,
      });
    });
    return project(command.workId, command.knowledgeId);
  };

  const supersede = async (command: SupersedeCharacterKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    assertOwnedRefs(input.database, command.workId, command.aboutRefs);
    const current = assertActiveRevision(
      input.database,
      command.workId,
      command.knowledgeId,
      command.expectedRevision,
    );
    const currentProjection = await project(command.workId, command.knowledgeId);
    const createdAt = now();
    const successorId = entityId<"CharacterKnowledge">(createId());
    if (successorId === command.knowledgeId) {
      throw new Error("CharacterKnowledge successor must have a new identity");
    }
    const evidence = command.evidenceRange === null
      ? null
      : createEvidence(command.workId, command.evidenceRange, successorId, createdAt);
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "characterKnowledgeStatus",
        id: command.knowledgeId,
        workId: command.workId,
        expectedRevision: current.revision,
        status: "superseded",
        supersededByKnowledgeId: successorId,
        retiredReason: null,
        updatedAt: createdAt,
      });
      transaction.write({
        kind: "characterKnowledge",
        id: successorId,
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        workId: command.workId,
        characterId: currentProjection.characterId,
        statement: command.statement,
        stance: command.stance,
        truthStatus: command.truthStatus,
        status: "active",
        supersedesKnowledgeId: command.knowledgeId,
        supersededByKnowledgeId: null,
        retiredReason: null,
        aboutRefs: aboutRefRecords(command.aboutRefs),
      });
      if (evidence !== null) {
        transaction.write(anchorRecord(command.workId, evidence.anchor));
        transaction.write({
          kind: "characterKnowledgeEvidence",
          id: createId(),
          schemaVersion: 1,
          workId: command.workId,
          knowledgeId: successorId,
          sourceDocumentId: command.evidenceRange!.documentId,
          sourceDocumentRevisionId: command.evidenceRange!.documentRevisionId,
          sourceFrom: command.evidenceRange!.from,
          sourceTo: command.evidenceRange!.to,
          exactText: evidence.anchor.exactQuote,
          anchorId: evidence.anchorId,
          orderIndex: 0,
          createdAt,
        });
      }
      transaction.write({
        kind: "characterKnowledgeTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        knowledgeId: command.knowledgeId,
        transitionKind: "superseded",
        revisionBefore: current.revision,
        revisionAfter: current.revision + 1,
        successorKnowledgeId: successorId,
        reason: "새 인식 상태",
        evidenceAnchorIds: evidence === null ? [] : [evidence.anchorId],
        createdAt,
      });
      transaction.write({
        kind: "characterKnowledgeTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        knowledgeId: successorId,
        transitionKind: "created",
        revisionBefore: null,
        revisionAfter: 1,
        successorKnowledgeId: null,
        reason: `${command.knowledgeId} 대체`,
        evidenceAnchorIds: evidence === null ? [] : [evidence.anchorId],
        createdAt,
      });
    });
    return project(command.workId, successorId);
  };

  const retire = async (command: RetireCharacterKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    const current = assertActiveRevision(
      input.database,
      command.workId,
      command.knowledgeId,
      command.expectedRevision,
    );
    const retiredAt = now();
    await input.ledger.transaction(async (transaction) => {
      transaction.write({
        kind: "characterKnowledgeStatus",
        id: command.knowledgeId,
        workId: command.workId,
        expectedRevision: current.revision,
        status: "retired",
        supersededByKnowledgeId: null,
        retiredReason: command.reason,
        updatedAt: retiredAt,
      });
      transaction.write({
        kind: "characterKnowledgeTransition",
        id: createId(),
        schemaVersion: 1,
        workId: command.workId,
        knowledgeId: command.knowledgeId,
        transitionKind: "retired",
        revisionBefore: current.revision,
        revisionAfter: current.revision + 1,
        successorKnowledgeId: null,
        reason: command.reason,
        evidenceAnchorIds: [],
        createdAt: retiredAt,
      });
    });
    return project(command.workId, command.knowledgeId);
  };

  const list = async (command: ListCharacterKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    if (command.characterId !== null) {
      assertOwnedCharacter(input.database, command.workId, command.characterId);
    }
    const statusCondition = command.status === "current"
      ? "AND status = 'active'"
      : command.status === "history"
        ? "AND status IN ('superseded', 'retired')"
        : "";
    const characterCondition = command.characterId === null ? "" : "AND character_id = ?";
    const parameters = command.characterId === null
      ? [command.workId]
      : [command.workId, command.characterId];
    const knowledgeIds = input.database.prepare(`
      SELECT id FROM character_knowledge
      WHERE work_id = ? ${characterCondition} ${statusCondition}
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'superseded' THEN 1 ELSE 2 END,
        updated_at DESC,
        id DESC
    `).all(...parameters).map((row) => entityId<"CharacterKnowledge">(
      requiredString(row, "id", "CharacterKnowledge list row"),
    ));
    return parseCharacterKnowledgeListProjection({
      schemaVersion: 1,
      workId: command.workId,
      entries: await Promise.all(knowledgeIds.map((knowledgeId) =>
        project(command.workId, knowledgeId)
      )),
    });
  };

  const projectPov = async (command: ProjectPovKnowledgeCommand) => {
    readActorRef(input.database, command.workId);
    assertOwnedCharacter(input.database, command.workId, command.characterId);
    const current = await list({
      schemaVersion: 1,
      workId: command.workId,
      characterId: null,
      status: "current",
    });
    const objectiveFacts = current.entries.filter((entry) => entry.truthStatus === "true");
    const characterEntries = current.entries.filter(
      (entry) => entry.characterId === command.characterId,
    );
    const povKnown = characterEntries.filter((entry) => entry.stance === "knows");
    const povFalseBeliefs = characterEntries.filter((entry) =>
      (entry.truthStatus === "false" &&
        (entry.stance === "believes" || entry.stance === "suspects")) ||
      (entry.truthStatus === "true" && entry.stance === "denies")
    );
    const povUnavailable = characterEntries.filter((entry) => entry.stance === "unaware");
    return parsePovKnowledgeContextProjection({
      schemaVersion: 1,
      workId: command.workId,
      characterId: command.characterId,
      objectiveFacts,
      povKnown,
      povFalseBeliefs,
      povUnavailable,
    });
  };

  return Object.freeze({ create, update, supersede, retire, list, projectPov });
}
