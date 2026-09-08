import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { CaptureResumeCheckpointWithAnchors } from "../../../application/checkpoints/capture-resume-checkpoint-with-anchors";
import type { ManuscriptResumeCheckpointProjection } from "../../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { CaptureWorkspaceResumeCommand } from "../../../application/workspace/workspace-contract";
import { parseCaptureWorkspaceResumeCommand,parseWorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns manuscript resume commands and their existing transaction boundaries. */
export class ManuscriptResumeService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #revisionStore: RevisionStore;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly revisionStore: RevisionStore;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#revisionStore = input.revisionStore;
    this.#options = input.options;
    this.#infrastructure = input.infrastructure;
  }

  getManuscriptResumeCheckpoint(): ManuscriptResumeCheckpointProjection {
    this.#infrastructure.assertOpen();
    return this.#state.resumeProjection;
  }

  captureWorkspaceResume(
    value: unknown,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCaptureWorkspaceResumeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#captureWorkspaceResumeSerially(command);
    });

    return execution;
  }

  async #captureWorkspaceResumeSerially(
    command: CaptureWorkspaceResumeCommand,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.selection.anchor > target.text.length ||
      command.selection.head > target.text.length
    ) {
      throw new Error("Resume selection is outside the current manuscript");
    }
    const rows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(rows);
    const transaction =
      this.#ledger.createResumeCheckpointCaptureTransaction({});
    const work = await transaction.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const capturedAt = new Date().toISOString();
    const commandRef = randomUUID();
    const checkpointId = entityId<"ResumeCheckpoint">(randomUUID());
    const cursorAnchorId = entityId<"Anchor">(randomUUID());
    const selectionAnchorId =
      command.selection.anchor === command.selection.head
        ? null
        : entityId<"Anchor">(randomUUID());
    const createAnchor = new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const recordMeta = (id: EntityId<"Anchor">) => ({
      id,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      revision: 1,
      createdAt: capturedAt,
      updatedAt: capturedAt,
    });
    const cursorAnchor = await createAnchor.execute({
      meta: recordMeta(cursorAnchorId),
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: command.selection.head,
      endOffset: command.selection.head,
      policy: this.#options.defaults.anchorPolicy,
      commandRef,
      actorRef: work.studioId,
    });
    const selectionAnchor =
      selectionAnchorId === null
        ? undefined
        : await createAnchor.execute({
            meta: recordMeta(selectionAnchorId),
            workId: command.workId,
            documentId: command.documentId,
            documentRevisionId: target.currentRevisionId,
            startOffset: Math.min(
              command.selection.anchor,
              command.selection.head,
            ),
            endOffset: Math.max(
              command.selection.anchor,
              command.selection.head,
            ),
            policy: this.#options.defaults.anchorPolicy,
            commandRef,
            actorRef: work.studioId,
          });
    await new CaptureResumeCheckpointWithAnchors({
      catalog,
      revisionStore: this.#revisionStore,
      transaction,
    }).execute({
      checkpoint: {
        meta: {
          id: checkpointId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: capturedAt,
          updatedAt: capturedAt,
        },
        workId: command.workId,
        documentId: command.documentId,
        documentRevisionId: target.currentRevisionId,
        cursorAnchorId,
        ...(selectionAnchorId === null
          ? {}
          : { selectionAnchorId }),
        workspaceMode: command.workspaceMode,
        capturedAt,
      },
      cursorAnchor,
      ...(selectionAnchor === undefined ? {} : { selectionAnchor }),
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: work.resumeCheckpointId ?? null,
      expectedDocumentRevisionId: target.currentRevisionId,
    });
    this.#state.replaceResumeProjection(Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: target.currentRevisionId,
      selection: Object.freeze({ ...command.selection }),
    }));
    this.#state.replaceCatalog(parseWorkspaceCatalogProjection({
      ...this.#state.catalog,
      works: this.#state.catalog.works.map((candidate) =>
        candidate.workId === command.workId
          ? { ...candidate, updatedAt: capturedAt }
          : candidate,
      ),
      activeWorkId: command.workId,
      activeDocumentId: command.documentId,
    }));
    return this.#state.resumeProjection;
  }
}

