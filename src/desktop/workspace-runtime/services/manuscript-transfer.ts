import { randomUUID } from "node:crypto";
import { createAnchorForKnownRevisionContent } from "../../../application/anchors/create-anchor";
import { serializeManuscriptEditorDocumentState } from "../../../application/editor/manuscript-formatting";
import type { EpisodeRangeMoveStore,MoveRangeToEpisodeCommand,MoveRangeToEpisodeReceipt,SceneEpisodeSegmentRange,UndoMoveRangeToEpisodeCommand } from "../../../application/editor/move-range-to-episode";
import { moveManuscriptEditorStateRange,moveRangeToEpisodeText,parseMoveRangeToEpisodeCommand,parseMoveRangeToEpisodeReceipt,parseUndoMoveRangeToEpisodeCommand,planEpisodeSceneIdentityChanges } from "../../../application/editor/move-range-to-episode";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readRequiredString } from "../repositories/scalars";
import { readStoredSceneAnnotationRows } from "../repositories/scene-annotations";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";
import type { ManuscriptCoreService } from "./manuscript-core";
import type { SceneGeometryService } from "./scene-geometry";
import type { WorkspaceService } from "./workspace";

/** Owns manuscript transfer commands and their existing transaction boundaries. */
export class ManuscriptTransferService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #episodeRangeMoveStore: EpisodeRangeMoveStore;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
  readonly #manuscript_core: Pick<ManuscriptCoreService, "readEditorStateForRevision" | "installMovedDocumentTarget">;
  readonly #workspace: Pick<WorkspaceService, "reload">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly episodeRangeMoveStore: EpisodeRangeMoveStore;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
    readonly manuscript_core: Pick<ManuscriptCoreService, "readEditorStateForRevision" | "installMovedDocumentTarget">;
    readonly workspace: Pick<WorkspaceService, "reload">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#options = input.options;
    this.#episodeRangeMoveStore = input.episodeRangeMoveStore;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
    this.#scene_geometry = input.scene_geometry;
    this.#manuscript_core = input.manuscript_core;
    this.#workspace = input.workspace;
  }

  moveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseMoveRangeToEpisodeCommand(value);
    const execution = this.#operations.enqueueTransfer(() => this.#moveRangeToEpisodeSerially(command));

    

    return execution;
  }

  undoMoveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseUndoMoveRangeToEpisodeCommand(value);
    const execution = this.#operations.enqueueTransfer(() => this.#undoMoveRangeToEpisodeSerially(command));

    

    return execution;
  }

  async #moveRangeToEpisodeSerially(
    command: MoveRangeToEpisodeCommand,
  ): Promise<MoveRangeToEpisodeReceipt> {
    const source = this.#state.documentTargets.get(command.sourceEpisodeId);
    const target = this.#state.documentTargets.get(command.targetEpisodeId);
    if (
      source === undefined ||
      target === undefined ||
      source.workId !== command.workId ||
      target.workId !== command.workId
    ) {
      throw new Error("Episode move must stay inside one Work");
    }
    if (
      source.currentRevisionId !== command.expectedSourceRevisionId ||
      target.currentRevisionId !== command.expectedTargetRevisionId
    ) {
      throw new Error("Episode move revision conflict");
    }
    const movedText = moveRangeToEpisodeText({
      sourceText: source.text,
      targetText: target.text,
      from: command.from,
      to: command.to,
      placement: command.placement,
    });
    const projection = await this.#scene_geometry.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const annotatedSceneKeys = new Set(
      readStoredSceneAnnotationRows(this.#database, command.workId)
        .map((annotation) => annotation.sceneKey),
    );
    const scenePlan = planEpisodeSceneIdentityChanges({
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      from: command.from,
      to: command.to,
      targetInsertOffset: movedText.targetInsertOffset,
      scenes: projection.scenes
        .filter(
          (scene) =>
            scene.documentId === command.sourceEpisodeId &&
            scene.range !== null,
        )
        .map((scene) => ({
          sceneKey: scene.sceneKey,
          sceneId: scene.sceneIdentity?.sceneId ?? null,
          range: scene.range as { readonly start: number; readonly end: number },
          explicitlyStructured:
            scene.sceneIdentity !== undefined ||
            scene.source === "override" ||
            (scene.range?.start ?? 0) > 0 ||
            (scene.range?.end ?? source.text.length) < source.text.length ||
            annotatedSceneKeys.has(scene.sceneKey),
          existingSegments: (scene.sceneIdentity?.segments ?? [])
            .flatMap((segment): readonly SceneEpisodeSegmentRange[] =>
              segment.range === null
                ? []
                : [Object.freeze({
                    segmentId: segment.segmentId,
                    sceneId: segment.sceneId,
                    documentId: segment.documentId,
                    range: segment.range,
                  })]),
        })),
      createSceneId: () => entityId<"Scene">(randomUUID()),
      createSegmentId: () =>
        entityId<"EpisodeSceneSegment">(randomUUID()),
    });
    const sourceState = this.#manuscript_core.readEditorStateForRevision(
      command.workId,
      command.sourceEpisodeId,
      source.currentRevisionId,
      source.text.length,
    );
    const targetState = this.#manuscript_core.readEditorStateForRevision(
      command.workId,
      command.targetEpisodeId,
      target.currentRevisionId,
      target.text.length,
    );
    const movedEditorState = moveManuscriptEditorStateRange({
      sourceText: source.text,
      targetText: target.text,
      sourceState,
      targetState,
      from: command.from,
      to: command.to,
      placement: command.placement,
    });
    const moveId = entityId<"EpisodeRangeMove">(randomUUID());
    const sourceRevisionId = entityId<"DocumentRevision">(randomUUID());
    const targetRevisionId = entityId<"DocumentRevision">(randomUUID());
    const changedAt = new Date().toISOString();
    const sourceRevision = Object.freeze({
      revisionId: sourceRevisionId,
      workId: command.workId,
      documentId: command.sourceEpisodeId,
      expectedCurrentRevisionId: source.currentRevisionId,
      content: movedText.sourceText,
      editorStateJson: serializeManuscriptEditorDocumentState(
        movedEditorState.sourceState,
      ),
      cause: JSON.stringify({
        kind: "move-range-to-episode",
        moveId,
        role: "source",
      }),
      createdAt: changedAt,
      durableAt: changedAt,
    });
    const targetRevision = Object.freeze({
      revisionId: targetRevisionId,
      workId: command.workId,
      documentId: command.targetEpisodeId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: movedText.targetText,
      editorStateJson: serializeManuscriptEditorDocumentState(
        movedEditorState.targetState,
      ),
      cause: JSON.stringify({
        kind: "move-range-to-episode",
        moveId,
        role: "target",
      }),
      createdAt: changedAt,
      durableAt: changedAt,
    });
    const work = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    ).getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const describeEvidence = createNodeCryptoAnchorEvidenceDescriptor(
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    const preparedSegments = scenePlan.createdSegments.map((segment) => {
      const isSource = segment.documentId === command.sourceEpisodeId;
      const documentRevisionId = isSource
        ? sourceRevisionId
        : targetRevisionId;
      const content = isSource ? movedText.sourceText : movedText.targetText;
      const anchorId = entityId<"Anchor">(randomUUID());
      return Object.freeze({
        segmentId: segment.segmentId,
        sceneId: segment.sceneId,
        anchor: createAnchorForKnownRevisionContent({
          meta: {
            id: anchorId,
            schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
            revision: 1,
            createdAt: changedAt,
            updatedAt: changedAt,
          },
          documentId: segment.documentId,
          documentRevisionId,
          content,
          startOffset: segment.range.start,
          endOffset: segment.range.end,
          policy: this.#options.defaults.anchorPolicy,
          commandRef: moveId,
          actorRef: work.studioId,
          describeEvidence,
        }),
      });
    });
    const committed = await this.#episodeRangeMoveStore.commit({
      moveId,
      workId: command.workId,
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      from: command.from,
      to: command.to,
      placement: command.placement,
      sourceRevision,
      targetRevision,
      createdSceneIds: scenePlan.createdSceneIds,
      retiredSegmentIds: scenePlan.retiredSegmentIds,
      createdSegments: preparedSegments,
    });
    this.#manuscript_core.installMovedDocumentTarget(
      source,
      committed.sourceRevision.id,
      movedText.sourceText,
    );
    this.#manuscript_core.installMovedDocumentTarget(
      target,
      committed.targetRevision.id,
      movedText.targetText,
    );
    await this.#workspace.reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.sourceEpisodeId,
    });
    return parseMoveRangeToEpisodeReceipt({
      schemaVersion: 1,
      status: "moved",
      moveId,
      workId: command.workId,
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      sourceRevisionId: committed.sourceRevision.id,
      targetRevisionId: committed.targetRevision.id,
      sceneIds: committed.sceneIds,
    });
  }

  async #undoMoveRangeToEpisodeSerially(
    command: UndoMoveRangeToEpisodeCommand,
  ): Promise<MoveRangeToEpisodeReceipt> {
    const rows = this.#database.prepare(`
      SELECT
        source_document_id AS "sourceEpisodeId",
        target_document_id AS "targetEpisodeId",
        source_before_revision_id AS "sourceBeforeRevisionId",
        target_before_revision_id AS "targetBeforeRevisionId",
        source_after_revision_id AS "sourceAfterRevisionId",
        target_after_revision_id AS "targetAfterRevisionId",
        status
      FROM episode_range_moves
      WHERE id = ? AND work_id = ?
    `).all(command.moveId, command.workId);
    if (rows.length !== 1) {
      throw new Error(`Unknown Episode range move: ${command.moveId}`);
    }
    const row = rows[0] ?? {};
    const label = "Episode range move undo row";
    const sourceEpisodeId = entityId<"Document">(
      readRequiredString(row, "sourceEpisodeId", label),
    );
    const targetEpisodeId = entityId<"Document">(
      readRequiredString(row, "targetEpisodeId", label),
    );
    const sourceAfterRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "sourceAfterRevisionId", label),
    );
    const targetAfterRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "targetAfterRevisionId", label),
    );
    const source = this.#state.documentTargets.get(sourceEpisodeId);
    const target = this.#state.documentTargets.get(targetEpisodeId);
    if (
      readRequiredString(row, "status", label) !== "active" ||
      source === undefined ||
      target === undefined ||
      source.workId !== command.workId ||
      target.workId !== command.workId ||
      source.currentRevisionId !== command.expectedSourceRevisionId ||
      target.currentRevisionId !== command.expectedTargetRevisionId ||
      source.currentRevisionId !== sourceAfterRevisionId ||
      target.currentRevisionId !== targetAfterRevisionId
    ) {
      throw new Error(`Episode range move is not undoable: ${command.moveId}`);
    }
    const sourceBeforeRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "sourceBeforeRevisionId", label),
    );
    const targetBeforeRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "targetBeforeRevisionId", label),
    );
    const [sourceBeforeText, targetBeforeText] = await Promise.all([
      this.#revisionStore.materialize(sourceBeforeRevisionId),
      this.#revisionStore.materialize(targetBeforeRevisionId),
    ]);
    const changedAt = new Date().toISOString();
    const sourceRevisionId = entityId<"DocumentRevision">(randomUUID());
    const targetRevisionId = entityId<"DocumentRevision">(randomUUID());
    const sourceBeforeState = this.#manuscript_core.readEditorStateForRevision(
      command.workId,
      sourceEpisodeId,
      sourceBeforeRevisionId,
      sourceBeforeText.length,
    );
    const targetBeforeState = this.#manuscript_core.readEditorStateForRevision(
      command.workId,
      targetEpisodeId,
      targetBeforeRevisionId,
      targetBeforeText.length,
    );
    const committed = await this.#episodeRangeMoveStore.undo({
      moveId: command.moveId,
      workId: command.workId,
      sourceRevision: {
        revisionId: sourceRevisionId,
        workId: command.workId,
        documentId: sourceEpisodeId,
        expectedCurrentRevisionId: source.currentRevisionId,
        content: sourceBeforeText,
        editorStateJson: serializeManuscriptEditorDocumentState(
          sourceBeforeState,
        ),
        cause: JSON.stringify({
          kind: "undo-move-range-to-episode",
          moveId: command.moveId,
          role: "source",
        }),
        createdAt: changedAt,
        durableAt: changedAt,
      },
      targetRevision: {
        revisionId: targetRevisionId,
        workId: command.workId,
        documentId: targetEpisodeId,
        expectedCurrentRevisionId: target.currentRevisionId,
        content: targetBeforeText,
        editorStateJson: serializeManuscriptEditorDocumentState(
          targetBeforeState,
        ),
        cause: JSON.stringify({
          kind: "undo-move-range-to-episode",
          moveId: command.moveId,
          role: "target",
        }),
        createdAt: changedAt,
        durableAt: changedAt,
      },
    });
    this.#manuscript_core.installMovedDocumentTarget(
      source,
      committed.sourceRevision.id,
      sourceBeforeText,
    );
    this.#manuscript_core.installMovedDocumentTarget(
      target,
      committed.targetRevision.id,
      targetBeforeText,
    );
    await this.#workspace.reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: sourceEpisodeId,
    });
    return parseMoveRangeToEpisodeReceipt({
      schemaVersion: 1,
      status: "undone",
      moveId: command.moveId,
      workId: command.workId,
      sourceEpisodeId,
      targetEpisodeId,
      sourceRevisionId: committed.sourceRevision.id,
      targetRevisionId: committed.targetRevision.id,
      sceneIds: committed.sceneIds,
    });
  }
}

