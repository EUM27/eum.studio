import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { AddCharacterEvidenceCommand,CharacterEvidenceProjection,CharacterListProjection,CharacterProjection,CreateCharacterCommand,ListCharactersCommand,RetireCharacterCommand,UpdateCharacterCommand } from "../../../application/characters/character-contract";
import { parseAddCharacterEvidenceCommand,parseCharacterListProjection,parseCharacterProjection,parseCreateCharacterCommand,parseListCharactersCommand,parseRetireCharacterCommand,parseUpdateCharacterCommand } from "../../../application/characters/character-contract";
import type { CharacterRelationListProjection,CharacterRelationProjection,CreateCharacterRelationCommand,ListCharacterRelationsCommand,RetireCharacterRelationCommand,UpdateCharacterRelationCommand } from "../../../application/characters/character-relation-contract";
import { parseCharacterRelationListProjection,parseCreateCharacterRelationCommand,parseListCharacterRelationsCommand,parseRetireCharacterRelationCommand,parseUpdateCharacterRelationCommand } from "../../../application/characters/character-relation-contract";
import type { CreateLoreCandidateCommand,ListLoreCandidatesCommand,LoreCandidateApprovalBlockReason,LoreCandidateApprovalResult,LoreCandidateListProjection,LoreCandidateProjection,ReviewLoreCandidateCommand } from "../../../application/lore/lore-candidate-contract";
import { parseCreateLoreCandidateCommand,parseListLoreCandidatesCommand,parseLoreCandidateApprovalResult,parseLoreCandidateListProjection,parseLoreCandidateProjection,parseReviewLoreCandidateCommand } from "../../../application/lore/lore-candidate-contract";
import type { AddLoreEntryEvidenceCommand,CreateLoreEntryCommand,ListLoreEntriesCommand,LoreEntryEvidenceProjection,LoreEntryListProjection,LoreEntryProjection,RetireLoreEntryCommand,UpdateLoreEntryCommand } from "../../../application/lore/lore-entry-contract";
import { parseAddLoreEntryEvidenceCommand,parseCreateLoreEntryCommand,parseListLoreEntriesCommand,parseLoreEntryListProjection,parseLoreEntryProjection,parseRetireLoreEntryCommand,parseUpdateLoreEntryCommand } from "../../../application/lore/lore-entry-contract";
import type { LinkLoreForeshadowCommand,ListLoreForeshadowLinksCommand,LoreForeshadowLinkListProjection,LoreForeshadowLinkProjection,UnlinkLoreForeshadowCommand } from "../../../application/lore/lore-foreshadow-link-contract";
import { parseLinkLoreForeshadowCommand,parseListLoreForeshadowLinksCommand,parseLoreForeshadowLinkListProjection,parseUnlinkLoreForeshadowCommand } from "../../../application/lore/lore-foreshadow-link-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredCharacterEvidenceRow,StoredCharacterRow,StoredLoreCandidateRow,StoredLoreEntryEvidenceRow,StoredLoreEntryRow } from "../repositories/character-lore";
import { projectStoredCharacterRelationRow,projectStoredLoreForeshadowLinkRow,readActiveLoreForeshadowLinkByPair,readStoredCharacterEvidenceRows,readStoredCharacterRelationRowById,readStoredCharacterRelationRows,readStoredCharacterRowById,readStoredCharacterRows,readStoredLoreCandidateRowById,readStoredLoreCandidateRows,readStoredLoreEntryEvidenceRows,readStoredLoreEntryHistoryRows,readStoredLoreEntryRowById,readStoredLoreEntryRows,readStoredLoreForeshadowLinkRowById,readStoredLoreForeshadowLinkRows } from "../repositories/character-lore";
import { readStoredForeshadowLineRowById } from "../repositories/foreshadowing";
import { createAnchorLedgerRecord,createRecordMeta,insertAnchorLedgerRecord } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns character lore commands and their existing transaction boundaries. */
export class CharacterLoreService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #revisionStore: RevisionStore;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly revisionStore: RevisionStore;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#revisionStore = input.revisionStore;
    this.#ledger = input.ledger;
    this.#options = input.options;
    this.#infrastructure = input.infrastructure;
  }

  createCharacter(value: unknown): Promise<CharacterProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateCharacterCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createCharacterSerially(command);
    });

    return execution;
  }

  listCharacters(value: unknown): Promise<CharacterListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListCharactersCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listCharactersSerially(command),
    );
  }

  updateCharacter(value: unknown): Promise<CharacterProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateCharacterCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateCharacterSerially(command);
    });

    return execution;
  }

  addCharacterEvidence(value: unknown): Promise<CharacterProjection> {
    this.#infrastructure.assertOpen();
    const command = parseAddCharacterEvidenceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#addCharacterEvidenceSerially(command);
    });

    return execution;
  }

  retireCharacter(value: unknown): Promise<CharacterProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireCharacterCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireCharacterSerially(command);
    });

    return execution;
  }

  createCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateCharacterRelationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createCharacterRelationSerially(command);
    });

    return execution;
  }

  listCharacterRelations(value: unknown): Promise<CharacterRelationListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListCharacterRelationsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listCharacterRelationsSerially(command),
    );
  }

  updateCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateCharacterRelationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateCharacterRelationSerially(command);
    });

    return execution;
  }

  retireCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireCharacterRelationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireCharacterRelationSerially(command);
    });

    return execution;
  }

  createLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateLoreEntryCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createLoreEntrySerially(command);
    });

    return execution;
  }

  listLoreEntries(value: unknown): Promise<LoreEntryListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListLoreEntriesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listLoreEntriesSerially(command),
    );
  }

  updateLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateLoreEntryCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateLoreEntrySerially(command);
    });

    return execution;
  }

  addLoreEntryEvidence(value: unknown): Promise<LoreEntryProjection> {
    this.#infrastructure.assertOpen();
    const command = parseAddLoreEntryEvidenceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#addLoreEntryEvidenceSerially(command);
    });

    return execution;
  }

  retireLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireLoreEntryCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireLoreEntrySerially(command);
    });

    return execution;
  }

  linkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection> {
    this.#infrastructure.assertOpen();
    const command = parseLinkLoreForeshadowCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#linkLoreForeshadowSerially(command);
    });

    return execution;
  }

  listLoreForeshadowLinks(
    value: unknown,
  ): Promise<LoreForeshadowLinkListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListLoreForeshadowLinksCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listLoreForeshadowLinksSerially(command),
    );
  }

  unlinkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUnlinkLoreForeshadowCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#unlinkLoreForeshadowSerially(command);
    });

    return execution;
  }

  createLoreCandidate(value: unknown): Promise<LoreCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateLoreCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createLoreCandidateSerially(command);
    });

    return execution;
  }

  listLoreCandidates(value: unknown): Promise<LoreCandidateListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListLoreCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listLoreCandidatesSerially(command),
    );
  }

  approveLoreCandidate(value: unknown): Promise<LoreCandidateApprovalResult> {
    this.#infrastructure.assertOpen();
    const command = parseReviewLoreCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#approveLoreCandidateSerially(command);
    });

    return execution;
  }

  rejectLoreCandidate(value: unknown): Promise<LoreCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseReviewLoreCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#rejectLoreCandidateSerially(command);
    });

    return execution;
  }

  async #projectCharacterEvidenceRows(
    rows: readonly StoredCharacterEvidenceRow[],
  ): Promise<readonly CharacterEvidenceProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#state.documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return Object.freeze({
          anchorId: row.sourceAnchorId,
          documentId: row.sourceDocumentId,
          documentRevisionId: row.sourceDocumentRevisionId,
          exactText: row.exactText,
          integrity: "broken" as const,
          range: null,
          createdAt: row.createdAt,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      return Object.freeze({
        anchorId: row.sourceAnchorId,
        documentId: row.sourceDocumentId,
        documentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity: resolution.status === "resolved"
          ? "resolved" as const
          : resolution.status === "needsReview"
            ? "needsReview" as const
            : "broken" as const,
        range: resolution.status === "resolved"
          ? Object.freeze({
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            })
          : null,
        createdAt: row.createdAt,
      });
    }));
  }

  async projectCharacterRow(
    row: StoredCharacterRow,
  ): Promise<CharacterProjection> {
    const evidences = await this.#projectCharacterEvidenceRows(
      readStoredCharacterEvidenceRows(
        this.#database,
        row.workId,
        row.characterId,
      ),
    );
    return parseCharacterProjection({
      schemaVersion: 1,
      ...row,
      evidences,
    });
  }

  async #createCharacterSerially(
    command: CreateCharacterCommand,
  ): Promise<CharacterProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const characterId = entityId<"Character">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "character",
        ...createRecordMeta(createdAt),
        id: characterId,
        workId: command.workId,
        name: command.name,
        aliases: command.aliases,
        role: command.role,
        summary: command.summary,
        appearance: command.appearance,
        personality: command.personality,
        speech: command.speech,
        goal: command.goal,
        conflict: command.conflict,
        note: command.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      characterId,
    );
    if (stored === null) {
      throw new Error(`Stored character is missing: ${characterId}`);
    }
    return this.projectCharacterRow(stored);
  }

  async listCharactersSerially(
    command: ListCharactersCommand,
  ): Promise<CharacterListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, command.workId)
        .map((character) => this.projectCharacterRow(character)),
    );
    return parseCharacterListProjection({
      schemaVersion: 1,
      workId: command.workId,
      characters,
    });
  }

  async #updateCharacterSerially(
    command: UpdateCharacterCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character is retired: ${command.characterId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterUpdate",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        updatedAt,
        name: command.changes.name ?? current.name,
        aliases: command.changes.aliases ?? current.aliases,
        role: command.changes.role ?? current.role,
        summary: command.changes.summary ?? current.summary,
        appearance: command.changes.appearance ?? current.appearance,
        personality: command.changes.personality ?? current.personality,
        speech: command.changes.speech ?? current.speech,
        goal: command.changes.goal ?? current.goal,
        conflict: command.changes.conflict ?? current.conflict,
        note: command.changes.note ?? current.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Updated character is missing: ${command.characterId}`);
    }
    return this.projectCharacterRow(stored);
  }

  async #addCharacterEvidenceSerially(
    command: AddCharacterEvidenceCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (target.currentRevisionId !== command.documentRevisionId) {
      throw new Error("Character evidence revision is stale");
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to <= from || to > target.text.length) {
      throw new Error("Character evidence selection must be non-empty and current");
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: command.documentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: command.characterId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "characterEvidence",
        id: entityId<"CharacterEvidence">(randomUUID()),
        workId: command.workId,
        characterId: command.characterId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        createdAt,
      });
      transaction.write({
        kind: "characterUpdate",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        updatedAt: createdAt,
        name: current.name,
        aliases: current.aliases,
        role: current.role,
        summary: current.summary,
        appearance: current.appearance,
        personality: current.personality,
        speech: current.speech,
        goal: current.goal,
        conflict: current.conflict,
        note: current.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Updated character is missing: ${command.characterId}`);
    }
    return this.projectCharacterRow(stored);
  }

  async #retireCharacterSerially(
    command: RetireCharacterCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character is already retired: ${command.characterId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const retiredAt = new Date().toISOString();
    const related = readStoredCharacterRelationRows(
      this.#database,
      command.workId,
    ).filter((relation) =>
      relation.retiredAt === null &&
      (
        relation.fromCharacterId === command.characterId ||
        relation.toCharacterId === command.characterId
      )
    );
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const relation of related) {
        transaction.write({
          kind: "characterRelationRetirement",
          id: relation.relationId,
          workId: command.workId,
          expectedRevision: relation.revision,
          retiredAt,
          retirementReason: "character-retired",
        });
      }
      transaction.write({
        kind: "characterRetirement",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Retired character is missing: ${command.characterId}`);
    }
    return this.projectCharacterRow(stored);
  }

  async #createCharacterRelationSerially(
    command: CreateCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const fromCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.fromCharacterId,
    );
    const toCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.toCharacterId,
    );
    if (
      fromCharacter === null ||
      fromCharacter.retiredAt !== null ||
      toCharacter === null ||
      toCharacter.retiredAt !== null
    ) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}`,
      );
    }
    const createdAt = new Date().toISOString();
    const relationId = entityId<"CharacterRelation">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelation",
        ...createRecordMeta(createdAt),
        id: relationId,
        workId: command.workId,
        fromCharacterId: command.fromCharacterId,
        toCharacterId: command.toCharacterId,
        relationKind: command.kind,
        description: command.description,
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      relationId,
    );
    if (stored === null) {
      throw new Error(`Stored character relation is missing: ${relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  listCharacterRelationsSerially(
    command: ListCharacterRelationsCommand,
  ): CharacterRelationListProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parseCharacterRelationListProjection({
      schemaVersion: 1,
      workId: command.workId,
      relations: readStoredCharacterRelationRows(
        this.#database,
        command.workId,
      ).map(projectStoredCharacterRelationRow),
    });
  }

  async #updateCharacterRelationSerially(
    command: UpdateCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    const current = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (current === null) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}/${command.relationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character relation is retired: ${command.relationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character relation revision conflict: ${command.relationId}`);
    }
    const fromCharacterId = command.changes.fromCharacterId ??
      current.fromCharacterId;
    const toCharacterId = command.changes.toCharacterId ?? current.toCharacterId;
    const fromCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      fromCharacterId,
    );
    const toCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      toCharacterId,
    );
    if (
      fromCharacter === null || fromCharacter.retiredAt !== null ||
      toCharacter === null || toCharacter.retiredAt !== null
    ) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}`,
      );
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelationUpdate",
        id: command.relationId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        updatedAt,
        fromCharacterId,
        toCharacterId,
        relationKind: command.changes.kind ?? current.kind,
        description: command.changes.description ?? current.description,
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (stored === null) {
      throw new Error(`Updated character relation is missing: ${command.relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  async #retireCharacterRelationSerially(
    command: RetireCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    const current = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (current === null) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}/${command.relationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character relation is retired: ${command.relationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character relation revision conflict: ${command.relationId}`);
    }
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelationRetirement",
        id: command.relationId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
        retirementReason: "user",
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (stored === null) {
      throw new Error(`Retired character relation is missing: ${command.relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  async #projectLoreEntryEvidenceRows(
    rows: readonly StoredLoreEntryEvidenceRow[],
  ): Promise<readonly LoreEntryEvidenceProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#state.documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return Object.freeze({
          anchorId: row.sourceAnchorId,
          sourceDocumentId: row.sourceDocumentId,
          sourceDocumentRevisionId: row.sourceDocumentRevisionId,
          exactText: row.exactText,
          integrity: "broken" as const,
          range: null,
          createdAt: row.createdAt,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return Object.freeze({
        anchorId: row.sourceAnchorId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity,
        range: resolution.status === "resolved"
          ? Object.freeze({
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            })
          : null,
        createdAt: row.createdAt,
      });
    }));
  }

  async #projectLoreEntryRow(
    row: StoredLoreEntryRow,
  ): Promise<LoreEntryProjection> {
    const evidences = await this.#projectLoreEntryEvidenceRows(
      readStoredLoreEntryEvidenceRows(
        this.#database,
        row.workId,
        row.loreEntryId,
      ),
    );
    const history = readStoredLoreEntryHistoryRows(
      this.#database,
      row.workId,
      row.loreEntryId,
    ).map((entry) => Object.freeze({
      historyId: entry.historyId,
      entryRevision: entry.entryRevision,
      changeKind: entry.changeKind,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      aliases: entry.aliases,
      enabled: entry.enabled,
      evidenceAnchorIds: entry.evidenceAnchorIds,
      changedAt: entry.changedAt,
    }));
    return parseLoreEntryProjection({
      schemaVersion: 1,
      ...row,
      evidences,
      history,
    });
  }

  async #createLoreEntrySerially(
    command: CreateLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const loreEntryId = entityId<"LoreEntry">(randomUUID());
    const historyId = entityId<"LoreEntryHistory">(randomUUID());
    let evidenceAnchorId: EntityId<"Anchor"> | null = null;
    let evidenceAnchor: Awaited<ReturnType<CreateAnchor["execute"]>> | null = null;
    if (command.evidence !== null) {
      const target = this.#state.documentTargets.get(command.evidence.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Work/document boundary violation: ${command.workId}/${command.evidence.documentId}`,
        );
      }
      const from = Math.min(
        command.evidence.selection.anchor,
        command.evidence.selection.head,
      );
      const to = Math.max(
        command.evidence.selection.anchor,
        command.evidence.selection.head,
      );
      if (
        to > target.text.length ||
        target.text.slice(from, to) !== command.evidence.exactText
      ) {
        throw new Error(
          "Lore evidence does not match the current durable revision",
        );
      }
      evidenceAnchorId = entityId<"Anchor">(randomUUID());
      evidenceAnchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: evidenceAnchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
        },
        workId: command.workId,
        documentId: command.evidence.documentId,
        documentRevisionId: target.currentRevisionId,
        startOffset: from,
        endOffset: to,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: loreEntryId,
        actorRef: work.studioId,
      });
    }
    const evidenceAnchorIds = evidenceAnchorId === null
      ? Object.freeze([])
      : Object.freeze([evidenceAnchorId]);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (evidenceAnchor !== null && evidenceAnchorId !== null && command.evidence !== null) {
        transaction.write(createAnchorLedgerRecord(command.workId, evidenceAnchor));
      }
      transaction.write({
        kind: "loreEntry",
        ...createRecordMeta(createdAt),
        id: loreEntryId,
        workId: command.workId,
        title: command.title,
        content: command.content,
        category: command.category,
        aliases: command.aliases,
        enabled: command.enabled,
      });
      if (evidenceAnchorId !== null && command.evidence !== null) {
        transaction.write({
          kind: "loreEntryEvidence",
          id: evidenceAnchorId,
          workId: command.workId,
          loreEntryId,
          sourceDocumentId: command.evidence.documentId,
          sourceAnchorId: evidenceAnchorId,
          createdAt,
        });
      }
      transaction.write({
        kind: "loreEntryHistory",
        id: historyId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        workId: command.workId,
        loreEntryId,
        entryRevision: 1,
        changeKind: "created",
        title: command.title,
        content: command.content,
        category: command.category,
        aliases: command.aliases,
        enabled: command.enabled,
        evidenceAnchorIds,
        changedAt: createdAt,
      });
    });
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      loreEntryId,
    );
    if (stored === null) throw new Error(`Stored lore entry is missing: ${loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async listLoreEntriesSerially(
    command: ListLoreEntriesCommand,
  ): Promise<LoreEntryListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const entries = await Promise.all(
      readStoredLoreEntryRows(this.#database, command.workId)
        .map((entry) => this.#projectLoreEntryRow(entry)),
    );
    return parseLoreEntryListProjection({
      schemaVersion: 1,
      workId: command.workId,
      entries,
    });
  }

  async #updateLoreEntrySerially(
    command: UpdateLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const next = Object.freeze({
      title: command.changes.title ?? current.title,
      content: command.changes.content ?? current.content,
      category: command.changes.category ?? current.category,
      aliases: command.changes.aliases ?? current.aliases,
      enabled: command.changes.enabled ?? current.enabled,
    });
    const evidenceAnchorIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET
          revision = ?,
          updated_at = ?,
          title = ?,
          content = ?,
          category = ?,
          aliases_json = ?,
          enabled = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        updatedAt,
        next.title,
        next.content,
        next.category,
        JSON.stringify(next.aliases),
        next.enabled ? 1 : 0,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "updated",
        next.title,
        next.content,
        next.category,
        JSON.stringify(next.aliases),
        next.enabled ? 1 : 0,
        JSON.stringify(evidenceAnchorIds),
        updatedAt,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Updated lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #addLoreEntryEvidenceSerially(
    command: AddLoreEntryEvidenceCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(`Work/document boundary violation: ${command.workId}/${command.documentId}`);
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length || target.text.slice(from, to) !== command.exactText) {
      throw new Error("Lore evidence does not match the current durable revision");
    }
    const catalog = createCatalogFromStoredRows(readStoredDocumentRows(this.#database));
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const changedAt = new Date().toISOString();
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt: changedAt,
        updatedAt: changedAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: command.loreEntryId,
      actorRef: work.studioId,
    });
    const previousEvidenceIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    const nextRevision = current.revision + 1;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      insertAnchorLedgerRecord(
        this.#database,
        createAnchorLedgerRecord(command.workId, anchor),
      );
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET revision = ?, updated_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        changedAt,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_evidence (
          work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        command.workId,
        command.loreEntryId,
        command.documentId,
        anchorId,
        changedAt,
      );
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "evidence-added",
        current.title,
        current.content,
        current.category,
        JSON.stringify(current.aliases),
        current.enabled ? 1 : 0,
        JSON.stringify([...previousEvidenceIds, anchorId]),
        changedAt,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Updated lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #retireLoreEntrySerially(
    command: RetireLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is already retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const retiredAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const evidenceAnchorIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET revision = ?, updated_at = ?, retired_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        retiredAt,
        retiredAt,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "retired",
        current.title,
        current.content,
        current.category,
        JSON.stringify(current.aliases),
        current.enabled ? 1 : 0,
        JSON.stringify(evidenceAnchorIds),
        retiredAt,
      );
      this.#database.prepare(`
        UPDATE lore_foreshadow_links
        SET
          revision = revision + 1,
          updated_at = ?,
          unlinked_at = ?,
          unlink_reason = 'lore-retired'
        WHERE
          work_id = ?
          AND lore_entry_id = ?
          AND unlinked_at IS NULL
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.loreEntryId,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Retired lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #linkLoreForeshadowSerially(
    command: LinkLoreForeshadowCommand,
  ): Promise<LoreForeshadowLinkProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const loreEntry = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (loreEntry === null || loreEntry.retiredAt !== null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    const line = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (line === null || line.retiredAt !== null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    const existing = readActiveLoreForeshadowLinkByPair(
      this.#database,
      command.workId,
      command.loreEntryId,
      command.lineId,
    );
    if (existing !== null) {
      return projectStoredLoreForeshadowLinkRow(existing);
    }
    const linkedAt = new Date().toISOString();
    const linkId = entityId<"LoreForeshadowLink">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "loreForeshadowLink",
        ...createRecordMeta(linkedAt),
        id: linkId,
        workId: command.workId,
        loreEntryId: command.loreEntryId,
        lineId: command.lineId,
        linkedAt,
        unlinkedAt: null,
        unlinkReason: null,
      });
    });
    const stored = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      linkId,
    );
    if (stored === null) {
      throw new Error(`Stored lore/foreshadow link is missing: ${linkId}`);
    }
    return projectStoredLoreForeshadowLinkRow(stored);
  }

  listLoreForeshadowLinksSerially(
    command: ListLoreForeshadowLinksCommand,
  ): LoreForeshadowLinkListProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parseLoreForeshadowLinkListProjection({
      schemaVersion: 1,
      workId: command.workId,
      links: readStoredLoreForeshadowLinkRows(
        this.#database,
        command.workId,
      ).map(projectStoredLoreForeshadowLinkRow),
    });
  }

  #unlinkLoreForeshadowSerially(
    command: UnlinkLoreForeshadowCommand,
  ): LoreForeshadowLinkProjection {
    const current = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      command.linkId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore foreshadow link boundary violation: ${command.workId}/${command.linkId}`,
      );
    }
    if (current.unlinkedAt !== null) {
      throw new Error(`Lore/foreshadow link is already unlinked: ${command.linkId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore/foreshadow link revision conflict: ${command.linkId}`);
    }
    const unlinkedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE lore_foreshadow_links
      SET
        revision = revision + 1,
        updated_at = ?,
        unlinked_at = ?,
        unlink_reason = 'user'
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND unlinked_at IS NULL
        AND retired_at IS NULL
    `).run(
      unlinkedAt,
      unlinkedAt,
      command.workId,
      command.linkId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Lore/foreshadow link revision conflict: ${command.linkId}`);
    }
    const stored = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      command.linkId,
    );
    if (stored === null) {
      throw new Error(`Unlinked lore/foreshadow link is missing: ${command.linkId}`);
    }
    return projectStoredLoreForeshadowLinkRow(stored);
  }

  async #projectLoreCandidateRow(
    row: StoredLoreCandidateRow,
  ): Promise<LoreCandidateProjection> {
    const target = this.#state.documentTargets.get(row.sourceDocumentId);
    let integrity: LoreCandidateProjection["evidence"]["integrity"] = "broken";
    let range: LoreCandidateProjection["evidence"]["range"] = null;
    if (target !== undefined && target.workId === row.workId) {
      const resolver = new ResolveAnchor({
        catalog: createCatalogFromStoredRows(
          readStoredDocumentRows(this.#database),
        ),
        revisionStore: this.#revisionStore,
        reader: this.#ledger,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      });
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      range = resolution.status === "resolved"
        ? Object.freeze({
            from: resolution.range.startOffset,
            to: resolution.range.endOffset,
          })
        : null;
    }
    let approvalBlockReason: LoreCandidateApprovalBlockReason | null = null;
    if (row.status !== "pending") {
      approvalBlockReason = "already-reviewed";
    } else if (row.certainty !== "explicit") {
      approvalBlockReason = "inferred";
    } else if (
      target === undefined ||
      target.workId !== row.workId ||
      target.currentRevisionId !== row.sourceDocumentRevisionId
    ) {
      approvalBlockReason = "evidence-stale";
    } else if (integrity !== "resolved" || range === null) {
      approvalBlockReason = "evidence-unresolved";
    } else if (row.proposal.kind === "update") {
      const loreEntry = readStoredLoreEntryRowById(
        this.#database,
        row.workId,
        row.proposal.loreEntryId,
      );
      approvalBlockReason = loreEntry === null || loreEntry.retiredAt !== null
        ? "target-missing"
        : loreEntry.revision !== row.proposal.expectedLoreEntryRevision
          ? "target-stale"
          : null;
    }
    return parseLoreCandidateProjection({
      schemaVersion: 1,
      candidateId: row.candidateId,
      revision: row.revision,
      workId: row.workId,
      source: row.source,
      certainty: row.certainty,
      proposal: row.proposal,
      evidence: {
        anchorId: row.sourceAnchorId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity,
        range,
      },
      reason: row.reason,
      status: row.status,
      approvedLoreEntryId: row.approvedLoreEntryId,
      approvalBlockReason,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    });
  }

  async #createLoreCandidateSerially(
    command: CreateLoreCandidateCommand,
  ): Promise<LoreCandidateProjection> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (
      to > target.text.length ||
      target.text.slice(from, to) !== command.exactText
    ) {
      throw new Error("Lore Candidate evidence does not match the current durable revision");
    }
    if (command.proposal.kind === "update") {
      const loreEntry = readStoredLoreEntryRowById(
        this.#database,
        command.workId,
        command.proposal.loreEntryId,
      );
      if (loreEntry === null || loreEntry.retiredAt !== null) {
        throw new Error(
          `Work/lore entry boundary violation: ${command.workId}/${command.proposal.loreEntryId}`,
        );
      }
      if (loreEntry.revision !== command.proposal.expectedLoreEntryRevision) {
        throw new Error(
          `Lore entry revision conflict: ${command.proposal.loreEntryId}`,
        );
      }
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const candidateId = entityId<"LoreCandidate">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: candidateId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "loreCandidate",
        ...createRecordMeta(createdAt),
        id: candidateId,
        workId: command.workId,
        sourceDocumentId: command.documentId,
        sourceDocumentRevisionId: target.currentRevisionId,
        sourceAnchorId: anchorId,
        exactText: command.exactText,
        source: command.source,
        certainty: command.certainty,
        proposalJson: JSON.stringify(command.proposal),
        reason: command.reason,
        status: "pending",
        approvedLoreEntryId: null,
        reviewedAt: null,
      });
    });
    const stored = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      candidateId,
    );
    if (stored === null) {
      throw new Error(`Stored Lore Candidate is missing: ${candidateId}`);
    }
    return this.#projectLoreCandidateRow(stored);
  }

  async #listLoreCandidatesSerially(
    command: ListLoreCandidatesCommand,
  ): Promise<LoreCandidateListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const candidates = await Promise.all(
      readStoredLoreCandidateRows(this.#database, command.workId)
        .map((candidate) => this.#projectLoreCandidateRow(candidate)),
    );
    return parseLoreCandidateListProjection({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #approveLoreCandidateSerially(
    command: ReviewLoreCandidateCommand,
  ): Promise<LoreCandidateApprovalResult> {
    const currentCandidate = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (currentCandidate === null) {
      throw new Error(
        `Work/Lore Candidate boundary violation: ${command.workId}/${command.candidateId}`,
      );
    }
    if (currentCandidate.revision !== command.expectedRevision) {
      throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
    }
    const candidateProjection = await this.#projectLoreCandidateRow(
      currentCandidate,
    );
    if (candidateProjection.approvalBlockReason !== null) {
      throw new Error(
        `Lore Candidate approval blocked: ${candidateProjection.approvalBlockReason}`,
      );
    }
    const reviewedAt = new Date().toISOString();
    const nextCandidateRevision = currentCandidate.revision + 1;
    let loreEntryId: EntityId<"LoreEntry">;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (currentCandidate.proposal.kind === "create") {
        loreEntryId = entityId<"LoreEntry">(randomUUID());
        this.#database.prepare(`
          INSERT INTO lore_entries (
            id, schema_version, revision, created_at, updated_at, retired_at,
            work_id, title, content, category, aliases_json, enabled
          ) VALUES (?, ?, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        `).run(
          loreEntryId,
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          reviewedAt,
          reviewedAt,
          command.workId,
          currentCandidate.proposal.title,
          currentCandidate.proposal.content,
          currentCandidate.proposal.category,
          JSON.stringify(currentCandidate.proposal.aliases),
          currentCandidate.proposal.enabled ? 1 : 0,
        );
        this.#database.prepare(`
          INSERT INTO lore_entry_evidence (
            work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          command.workId,
          loreEntryId,
          currentCandidate.sourceDocumentId,
          currentCandidate.sourceAnchorId,
          reviewedAt,
        );
        this.#database.prepare(`
          INSERT INTO lore_entry_history (
            id, schema_version, work_id, lore_entry_id, entry_revision,
            change_kind, title, content, category, aliases_json, enabled,
            evidence_anchor_ids_json, changed_at
          ) VALUES (?, ?, ?, ?, 1, 'created', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          command.workId,
          loreEntryId,
          currentCandidate.proposal.title,
          currentCandidate.proposal.content,
          currentCandidate.proposal.category,
          JSON.stringify(currentCandidate.proposal.aliases),
          currentCandidate.proposal.enabled ? 1 : 0,
          JSON.stringify([currentCandidate.sourceAnchorId]),
          reviewedAt,
        );
      } else {
        loreEntryId = currentCandidate.proposal.loreEntryId;
        const loreEntry = readStoredLoreEntryRowById(
          this.#database,
          command.workId,
          loreEntryId,
        );
        if (
          loreEntry === null ||
          loreEntry.retiredAt !== null ||
          loreEntry.revision !== currentCandidate.proposal.expectedLoreEntryRevision
        ) {
          throw new Error(`Lore Candidate target changed: ${loreEntryId}`);
        }
        const nextLoreRevision = loreEntry.revision + 1;
        const nextLore = {
          title: currentCandidate.proposal.changes.title ?? loreEntry.title,
          content: currentCandidate.proposal.changes.content ?? loreEntry.content,
          category: currentCandidate.proposal.changes.category ?? loreEntry.category,
          aliases: currentCandidate.proposal.changes.aliases ?? loreEntry.aliases,
          enabled: currentCandidate.proposal.changes.enabled ?? loreEntry.enabled,
        };
        const update = this.#database.prepare(`
          UPDATE lore_entries
          SET revision = ?, updated_at = ?, title = ?, content = ?, category = ?,
              aliases_json = ?, enabled = ?
          WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
        `).run(
          nextLoreRevision,
          reviewedAt,
          nextLore.title,
          nextLore.content,
          nextLore.category,
          JSON.stringify(nextLore.aliases),
          nextLore.enabled ? 1 : 0,
          command.workId,
          loreEntryId,
          currentCandidate.proposal.expectedLoreEntryRevision,
        );
        if (Number(update.changes) !== 1) {
          throw new Error(`Lore Candidate target revision conflict: ${loreEntryId}`);
        }
        this.#database.prepare(`
          INSERT INTO lore_entry_evidence (
            work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          command.workId,
          loreEntryId,
          currentCandidate.sourceDocumentId,
          currentCandidate.sourceAnchorId,
          reviewedAt,
        );
        const evidenceAnchorIds = [
          ...readStoredLoreEntryEvidenceRows(
            this.#database,
            command.workId,
            loreEntryId,
          ).map((evidence) => evidence.sourceAnchorId),
        ];
        this.#database.prepare(`
          INSERT INTO lore_entry_history (
            id, schema_version, work_id, lore_entry_id, entry_revision,
            change_kind, title, content, category, aliases_json, enabled,
            evidence_anchor_ids_json, changed_at
          ) VALUES (?, ?, ?, ?, ?, 'updated', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          command.workId,
          loreEntryId,
          nextLoreRevision,
          nextLore.title,
          nextLore.content,
          nextLore.category,
          JSON.stringify(nextLore.aliases),
          nextLore.enabled ? 1 : 0,
          JSON.stringify(evidenceAnchorIds),
          reviewedAt,
        );
      }
      const review = this.#database.prepare(`
        UPDATE lore_candidates
        SET revision = ?, updated_at = ?, status = 'approved',
            approved_lore_entry_id = ?, reviewed_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND status = 'pending'
      `).run(
        nextCandidateRevision,
        reviewedAt,
        loreEntryId,
        reviewedAt,
        command.workId,
        command.candidateId,
        command.expectedRevision,
      );
      if (Number(review.changes) !== 1) {
        throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const reviewedCandidate = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    const loreEntry = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      loreEntryId,
    );
    if (reviewedCandidate === null || loreEntry === null) {
      throw new Error(`Approved Lore Candidate result is missing: ${command.candidateId}`);
    }
    return parseLoreCandidateApprovalResult({
      schemaVersion: 1,
      candidate: await this.#projectLoreCandidateRow(reviewedCandidate),
      loreEntry: await this.#projectLoreEntryRow(loreEntry),
    });
  }

  async #rejectLoreCandidateSerially(
    command: ReviewLoreCandidateCommand,
  ): Promise<LoreCandidateProjection> {
    const current = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (current === null) {
      throw new Error(
        `Work/Lore Candidate boundary violation: ${command.workId}/${command.candidateId}`,
      );
    }
    if (current.status !== "pending") {
      throw new Error(`Lore Candidate is already reviewed: ${command.candidateId}`);
    }
    const reviewedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE lore_candidates
      SET revision = revision + 1, updated_at = ?, status = 'rejected', reviewed_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'pending'
    `).run(
      reviewedAt,
      reviewedAt,
      command.workId,
      command.candidateId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
    }
    const rejected = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (rejected === null) {
      throw new Error(`Rejected Lore Candidate is missing: ${command.candidateId}`);
    }
    return this.#projectLoreCandidateRow(rejected);
  }
}

