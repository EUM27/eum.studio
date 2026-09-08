import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { CreateForeshadowLineCommand,ForeshadowLineListProjection,ForeshadowLineProjection,ListForeshadowLinesCommand,RetireForeshadowLineCommand,UpdateForeshadowLineCommand } from "../../../application/foreshadowing/foreshadow-line-contract";
import { parseCreateForeshadowLineCommand,parseForeshadowLineListProjection,parseForeshadowLineProjection,parseListForeshadowLinesCommand,parseRetireForeshadowLineCommand,parseUpdateForeshadowLineCommand } from "../../../application/foreshadowing/foreshadow-line-contract";
import type { CreateForeshadowPointCommand,ForeshadowPointListProjection,ForeshadowPointProfile,ForeshadowPointProjection,ListForeshadowPointsCommand } from "../../../application/foreshadowing/foreshadow-point-contract";
import { parseCreateForeshadowPointCommand,parseForeshadowPointListProjection,parseForeshadowPointProfile,parseForeshadowPointProjection,parseListForeshadowPointsCommand } from "../../../application/foreshadowing/foreshadow-point-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredForeshadowPointRow } from "../repositories/foreshadowing";
import { readStoredForeshadowLineRowById,readStoredForeshadowLineRows,readStoredForeshadowPointRowById,readStoredForeshadowPointRows } from "../repositories/foreshadowing";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns foreshadowing commands and their existing transaction boundaries. */
export class ForeshadowingService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "foreshadowPointProfile" | "defaults">;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #database: NodeSqliteDatabase;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "foreshadowPointProfile" | "defaults">;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly database: NodeSqliteDatabase;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#options = input.options;
    this.#ledger = input.ledger;
    this.#database = input.database;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
  }

  #getForeshadowPointProfile(): ForeshadowPointProfile {
    const profile = this.#options.foreshadowPointProfile;
    if (profile === undefined) {
      throw new Error("Foreshadow point profile is not configured");
    }
    return parseForeshadowPointProfile(profile);
  }

  createForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateForeshadowLineCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createForeshadowLineSerially(command);
    });

    return execution;
  }

  listForeshadowLines(value: unknown): Promise<ForeshadowLineListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListForeshadowLinesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listForeshadowLinesSerially(command),
    );
  }

  updateForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateForeshadowLineCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateForeshadowLineSerially(command);
    });

    return execution;
  }

  retireForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireForeshadowLineCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireForeshadowLineSerially(command);
    });

    return execution;
  }

  createForeshadowPoint(value: unknown): Promise<ForeshadowPointProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateForeshadowPointCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createForeshadowPointSerially(command);
    });

    return execution;
  }

  listForeshadowPoints(value: unknown): Promise<ForeshadowPointListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListForeshadowPointsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listForeshadowPointsSerially(command),
    );
  }

  async #createForeshadowLineSerially(
    command: CreateForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const lineId = entityId<"ForeshadowLine">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "foreshadowLine",
        ...createRecordMeta(createdAt),
        id: lineId,
        workId: command.workId,
        title: command.title,
        note: command.note,
      });
    });
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      lineId,
    );
    if (stored === null) {
      throw new Error(`Stored foreshadow line is missing: ${lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  async listForeshadowLinesSerially(
    command: ListForeshadowLinesCommand,
  ): Promise<ForeshadowLineListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const lines = readStoredForeshadowLineRows(
      this.#database,
      command.workId,
    ).map((line) => parseForeshadowLineProjection({
      schemaVersion: 1,
      ...line,
    }));
    return parseForeshadowLineListProjection({
      schemaVersion: 1,
      workId: command.workId,
      lines,
    });
  }

  async #updateForeshadowLineSerially(
    command: UpdateForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    const current = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (current === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Foreshadow line is retired: ${command.lineId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE foreshadow_lines
      SET
        revision = revision + 1,
        updated_at = ?,
        title = ?,
        note = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.title ?? current.title,
      command.changes.note ?? current.note,
      command.workId,
      command.lineId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (stored === null) {
      throw new Error(`Updated foreshadow line is missing: ${command.lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  async #retireForeshadowLineSerially(
    command: RetireForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    const current = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (current === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Foreshadow line is already retired: ${command.lineId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE foreshadow_lines
        SET
          revision = revision + 1,
          updated_at = ?,
          retired_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.lineId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
      }
      this.#database.prepare(`
        UPDATE lore_foreshadow_links
        SET
          revision = revision + 1,
          updated_at = ?,
          unlinked_at = ?,
          unlink_reason = 'foreshadow-retired'
        WHERE
          work_id = ?
          AND line_id = ?
          AND unlinked_at IS NULL
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.lineId,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (stored === null) {
      throw new Error(`Retired foreshadow line is missing: ${command.lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  #assertConfiguredForeshadowPointRole(roleId: string): void {
    if (
      !this.#getForeshadowPointProfile().roles.some(
        (role) => role.id === roleId,
      )
    ) {
      throw new Error(`Unknown foreshadow point role: ${roleId}`);
    }
  }

  async #projectForeshadowPointRows(
    rows: readonly StoredForeshadowPointRow[],
  ): Promise<readonly ForeshadowPointProjection[]> {
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
        return parseForeshadowPointProjection({
          schemaVersion: 1,
          ...row,
          integrity: "broken",
          range: null,
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
      return parseForeshadowPointProjection({
        schemaVersion: 1,
        ...row,
        integrity,
        range: resolution.status === "resolved"
          ? {
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            }
          : null,
      });
    }));
  }

  async #createForeshadowPointSerially(
    command: CreateForeshadowPointCommand,
  ): Promise<ForeshadowPointProjection> {
    this.#assertConfiguredForeshadowPointRole(command.roleId);
    const line = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (line === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (line.retiredAt !== null) {
      throw new Error(`Foreshadow line is retired: ${command.lineId}`);
    }
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Foreshadow point selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Foreshadow point selected text does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const pointId = entityId<"ForeshadowPoint">(randomUUID());
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
      commandRef: pointId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "foreshadowPoint",
        ...createRecordMeta(createdAt),
        id: pointId,
        workId: command.workId,
        lineId: command.lineId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        roleId: command.roleId,
        note: command.note,
      });
    });
    const stored = readStoredForeshadowPointRowById(
      this.#database,
      command.workId,
      pointId,
    );
    if (stored === null) {
      throw new Error(`Stored foreshadow point is missing: ${pointId}`);
    }
    const [projection] = await this.#projectForeshadowPointRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored foreshadow point could not be projected: ${pointId}`);
    }
    return projection;
  }

  async listForeshadowPointsSerially(
    command: ListForeshadowPointsCommand,
  ): Promise<ForeshadowPointListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const points = await this.#projectForeshadowPointRows(
      readStoredForeshadowPointRows(this.#database, command.workId),
    );
    return parseForeshadowPointListProjection({
      schemaVersion: 1,
      workId: command.workId,
      points,
    });
  }
}

