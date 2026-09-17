import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { CreateManuscriptAnnotationCommand,ListManuscriptAnnotationsCommand,ManuscriptAnnotationListProjection,ManuscriptAnnotationProjection,RetireManuscriptAnnotationCommand,UpdateManuscriptAnnotationCommand } from "../../../application/review/manuscript-annotation-contract";
import { parseCreateManuscriptAnnotationCommand,parseListManuscriptAnnotationsCommand,parseManuscriptAnnotationListProjection,parseManuscriptAnnotationProjection,parseRetireManuscriptAnnotationCommand,parseUpdateManuscriptAnnotationCommand } from "../../../application/review/manuscript-annotation-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredManuscriptAnnotationRow } from "../repositories/manuscript-annotations";
import { readStoredManuscriptAnnotationRowById,readStoredManuscriptAnnotationRows } from "../repositories/manuscript-annotations";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns manuscript annotations commands and their existing transaction boundaries. */
export class ManuscriptAnnotationsService {
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

  createManuscriptAnnotation(
    value: unknown,
  ): Promise<ManuscriptAnnotationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateManuscriptAnnotationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createManuscriptAnnotationSerially(command);
    });

    return execution;
  }

  listManuscriptAnnotations(
    value: unknown,
  ): Promise<ManuscriptAnnotationListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListManuscriptAnnotationsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listManuscriptAnnotationsSerially(command)
    );
  }

  updateManuscriptAnnotation(
    value: unknown,
  ): Promise<ManuscriptAnnotationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateManuscriptAnnotationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateManuscriptAnnotationSerially(command);
    });

    return execution;
  }

  retireManuscriptAnnotation(
    value: unknown,
  ): Promise<ManuscriptAnnotationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireManuscriptAnnotationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireManuscriptAnnotationSerially(command);
    });

    return execution;
  }

  async #projectManuscriptAnnotationRows(
    rows: readonly StoredManuscriptAnnotationRow[],
  ): Promise<readonly ManuscriptAnnotationProjection[]> {
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
        return parseManuscriptAnnotationProjection({
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
      return parseManuscriptAnnotationProjection({
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

  async #createManuscriptAnnotationSerially(
    command: CreateManuscriptAnnotationCommand,
  ): Promise<ManuscriptAnnotationProjection> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Annotation selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Annotation selected text does not match the current durable revision",
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
    const annotationId = entityId<"ManuscriptAnnotation">(randomUUID());
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
      commandRef: annotationId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "manuscriptAnnotation",
        ...createRecordMeta(createdAt),
        id: annotationId,
        workId: command.workId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        body: command.body,
        tags: command.tags,
      });
    });
    const stored = readStoredManuscriptAnnotationRowById(
      this.#database,
      command.workId,
      annotationId,
    );
    if (stored === null) {
      throw new Error(`Stored annotation is missing: ${annotationId}`);
    }
    const [projection] = await this.#projectManuscriptAnnotationRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored annotation could not be projected: ${annotationId}`);
    }
    return projection;
  }

  async #listManuscriptAnnotationsSerially(
    command: ListManuscriptAnnotationsCommand,
  ): Promise<ManuscriptAnnotationListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const annotations = await this.#projectManuscriptAnnotationRows(
      readStoredManuscriptAnnotationRows(this.#database, command.workId),
    );
    return parseManuscriptAnnotationListProjection({
      schemaVersion: 1,
      workId: command.workId,
      annotations,
    });
  }

  async #updateManuscriptAnnotationSerially(
    command: UpdateManuscriptAnnotationCommand,
  ): Promise<ManuscriptAnnotationProjection> {
    const current = readStoredManuscriptAnnotationRowById(
      this.#database,
      command.workId,
      command.annotationId,
    );
    if (current === null) {
      throw new Error(
        `Work/annotation boundary violation: ${command.workId}/${command.annotationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Annotation is retired: ${command.annotationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Annotation revision conflict: ${command.annotationId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE manuscript_annotations
      SET
        revision = revision + 1,
        updated_at = ?,
        body = ?,
        tags_json = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.body ?? current.body,
      JSON.stringify(command.changes.tags ?? current.tags),
      command.workId,
      command.annotationId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Annotation revision conflict: ${command.annotationId}`);
    }
    const stored = readStoredManuscriptAnnotationRowById(
      this.#database,
      command.workId,
      command.annotationId,
    );
    if (stored === null) {
      throw new Error(`Updated annotation is missing: ${command.annotationId}`);
    }
    const [projection] = await this.#projectManuscriptAnnotationRows([stored]);
    if (projection === undefined) {
      throw new Error(`Updated annotation could not be projected: ${command.annotationId}`);
    }
    return projection;
  }

  async #retireManuscriptAnnotationSerially(
    command: RetireManuscriptAnnotationCommand,
  ): Promise<ManuscriptAnnotationProjection> {
    const current = readStoredManuscriptAnnotationRowById(
      this.#database,
      command.workId,
      command.annotationId,
    );
    if (current === null) {
      throw new Error(
        `Work/annotation boundary violation: ${command.workId}/${command.annotationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Annotation is already retired: ${command.annotationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Annotation revision conflict: ${command.annotationId}`);
    }
    const retiredAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE manuscript_annotations
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
      command.annotationId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Annotation revision conflict: ${command.annotationId}`);
    }
    const stored = readStoredManuscriptAnnotationRowById(
      this.#database,
      command.workId,
      command.annotationId,
    );
    if (stored === null) {
      throw new Error(`Retired annotation is missing: ${command.annotationId}`);
    }
    const [projection] = await this.#projectManuscriptAnnotationRows([stored]);
    if (projection === undefined) {
      throw new Error(`Retired annotation could not be projected: ${command.annotationId}`);
    }
    return projection;
  }
}

