import { createHash,randomUUID } from "node:crypto";
import { createAnchorForKnownRevisionContent } from "../../../application/anchors/create-anchor";
import { serializeManuscriptEditorDocumentState } from "../../../application/editor/manuscript-formatting";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import { deleteManuscriptEditorStateRange,planSceneDeletion } from "../../../application/structure/scene-deletion-plan";
import type { DeleteSceneCommand,ListSceneTrashCommand,PrepareSceneDeletionCommand,RestoreSceneTrashCommand,SceneDeletionMetadataPreview,SceneDeletionPreview,SceneDeletionReceipt,SceneTrashEntryProjection,SceneTrashListProjection,SceneTrashStore,UndoSceneDeletionCommand } from "../../../application/structure/scene-trash-contract";
import { parseDeleteSceneCommand,parseListSceneTrashCommand,parsePrepareSceneDeletionCommand,parseRestoreSceneTrashCommand,parseSceneDeletionPreview,parseSceneDeletionReceipt,parseSceneTrashEntryProjection,parseSceneTrashListProjection,parseUndoSceneDeletionCommand } from "../../../application/structure/scene-trash-contract";
import type { Anchor,EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readRevisionEditorStateJson } from "../repositories/revisions";
import { readNullableIdentity,readNullableString,readRequiredInteger,readRequiredString } from "../repositories/scalars";
import { readStoredSceneRuleSetRow } from "../repositories/scene-geometry";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";
import type { ManuscriptCoreService } from "./manuscript-core";
import type { MusicService } from "./music";
import type { SceneAnnotationsService } from "./scene-annotations";
import type { SceneGeometryService } from "./scene-geometry";
import type { WorkspaceService } from "./workspace";

/** Owns scene trash commands and their existing transaction boundaries. */
export class SceneTrashService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #sceneTrashStore: SceneTrashStore;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
  readonly #scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;
  readonly #music: Pick<MusicService, "listSceneMusicQueueCandidatesSerially">;
  readonly #manuscript_core: Pick<ManuscriptCoreService, "readEditorStateForRevision" | "installMovedDocumentTarget">;
  readonly #workspace: Pick<WorkspaceService, "reload">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly sceneTrashStore: SceneTrashStore;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly scene_geometry: Pick<SceneGeometryService, "listSceneProjectionSerially">;
    readonly scene_annotations: Pick<SceneAnnotationsService, "listSceneAnnotationsSerially">;
    readonly music: Pick<MusicService, "listSceneMusicQueueCandidatesSerially">;
    readonly manuscript_core: Pick<ManuscriptCoreService, "readEditorStateForRevision" | "installMovedDocumentTarget">;
    readonly workspace: Pick<WorkspaceService, "reload">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#options = input.options;
    this.#sceneTrashStore = input.sceneTrashStore;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
    this.#scene_geometry = input.scene_geometry;
    this.#scene_annotations = input.scene_annotations;
    this.#music = input.music;
    this.#manuscript_core = input.manuscript_core;
    this.#workspace = input.workspace;
  }

  prepareSceneDeletion(value: unknown): Promise<SceneDeletionPreview> {
    this.#infrastructure.assertOpen();
    const command = parsePrepareSceneDeletionCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#prepareSceneDeletionSerially(command),
    );
  }

  deleteScene(value: unknown): Promise<SceneDeletionReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseDeleteSceneCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#deleteSceneSerially(command);
    });

    return execution;
  }

  listSceneTrash(value: unknown): Promise<SceneTrashListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneTrashCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listSceneTrashSerially(command),
    );
  }

  restoreSceneTrash(value: unknown): Promise<SceneDeletionReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseRestoreSceneTrashCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#restoreSceneTrashSerially(command, "restored");
    });

    return execution;
  }

  undoSceneDeletion(value: unknown): Promise<SceneDeletionReceipt> {
    this.#infrastructure.assertOpen();
    const command = parseUndoSceneDeletionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#restoreSceneTrashSerially(command, "undone");
    });

    return execution;
  }

  async #prepareSceneDeletionState(
    command: PrepareSceneDeletionCommand,
  ) {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    const projection = await this.#scene_geometry.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const plan = planSceneDeletion({
      target: command.target,
      scenes: projection.scenes,
      documents: work.documents.map((document) => {
        const target = this.#state.documentTargets.get(document.documentId);
        if (target === undefined || target.workId !== command.workId) {
          throw new Error(`Scene deletion Document is unavailable: ${document.documentId}`);
        }
        return Object.freeze({
          documentId: document.documentId,
          documentTitle: document.title,
          documentRevisionId: target.currentRevisionId,
          text: target.text,
        });
      }),
    });
    const targetSceneIds = new Set(
      plan.targetScenes.flatMap((scene) =>
        scene.sceneIdentity === undefined ? [] : [scene.sceneIdentity.sceneId]
      ),
    );
    const targetSceneKeys = new Set(plan.targetScenes.map((scene) => scene.sceneKey));
    const annotations = this.#scene_annotations.listSceneAnnotationsSerially({
      schemaVersion: 1,
      workId: command.workId,
    }).annotations.filter((annotation) =>
      annotation.binding.status === "current" &&
      (
        (annotation.binding.sceneId !== null &&
          targetSceneIds.has(annotation.binding.sceneId)) ||
        (command.target.sceneId === null && targetSceneKeys.has(annotation.sceneKey))
      )
    );
    const music = (await this.#music.listSceneMusicQueueCandidatesSerially({
      schemaVersion: 1,
      workId: command.workId,
    })).candidates.filter((candidate) =>
      candidate.binding.status === "current" &&
      (
        (candidate.binding.sceneId !== null &&
          targetSceneIds.has(candidate.binding.sceneId)) ||
        (command.target.sceneId === null && targetSceneKeys.has(candidate.sceneKey))
      )
    );
    const eventMetadata = plan.targetScenes.flatMap((scene) => [
      ...scene.events.map((event) => Object.freeze({
        kind: "event" as const,
        metadataId: event.eventBlockId,
        label: event.title,
      })),
      ...scene.excludedEvents.map((event) => Object.freeze({
        kind: "event" as const,
        metadataId: event.eventBlockId,
        label: event.title,
      })),
    ]);
    const metadataById = new Map<string, SceneDeletionMetadataPreview>();
    for (const item of [
      ...eventMetadata,
      ...annotations.map((annotation) => Object.freeze({
        kind: "annotation" as const,
        metadataId: annotation.sceneAnnotationId,
        label: annotation.title,
      })),
      ...music.map((candidate) => Object.freeze({
        kind: "music-queue" as const,
        metadataId: candidate.candidateId,
        label: candidate.query,
      })),
    ]) {
      metadataById.set(`${item.kind}:${item.metadataId}`, item);
    }
    const metadata = Object.freeze([...metadataById.values()].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.metadataId.localeCompare(right.metadataId),
    ));
    const identityRows = command.target.sceneId === null
      ? []
      : this.#database.prepare(`
          SELECT revision FROM scene_identities
          WHERE id = ? AND work_id = ? AND retired_at IS NULL
        `).all(command.target.sceneId, command.workId);
    if (command.target.sceneId !== null && identityRows.length !== 1) {
      throw new Error(`Scene deletion identity is unavailable: ${command.target.sceneId}`);
    }
    const segmentRows = command.target.sceneId === null
      ? []
      : this.#database.prepare(`
          SELECT id AS "segmentId", revision, document_id AS "documentId"
          FROM scene_episode_segments
          WHERE work_id = ? AND scene_id = ? AND retired_at IS NULL
          ORDER BY created_at, id
        `).all(command.workId, command.target.sceneId);
    const overrideById = new Map<string, Record<string, unknown>>();
    for (const document of plan.documents) {
      if (document.removedBoundaryAnchorId === null) continue;
      for (const row of this.#database.prepare(`
        SELECT scene_override.id, scene_override.revision,
          (SELECT COUNT(*) FROM scene_override_anchors AS all_boundary
            WHERE all_boundary.work_id = scene_override.work_id
              AND all_boundary.document_id = scene_override.document_id
              AND all_boundary.scene_override_id = scene_override.id)
            AS "boundaryCount"
        FROM scene_overrides AS scene_override
        JOIN scene_override_anchors AS boundary
          ON boundary.work_id = scene_override.work_id
          AND boundary.document_id = scene_override.document_id
          AND boundary.scene_override_id = scene_override.id
        WHERE scene_override.work_id = ?
          AND scene_override.document_id = ?
          AND boundary.anchor_id = ?
          AND scene_override.retired_at IS NULL
      `).all(
        command.workId,
        document.documentId,
        document.removedBoundaryAnchorId,
      )) {
        const overrideId = readRequiredString(row, "id", "Scene deletion override");
        if (readRequiredInteger(row, "boundaryCount", "Scene deletion override") !== 1) {
          throw new Error(`Scene deletion boundary override is shared: ${overrideId}`);
        }
        overrideById.set(overrideId, row);
      }
    }
    const overrideRows = [...overrideById.values()].sort((left, right) =>
      readRequiredString(left, "id", "Scene deletion override").localeCompare(
        readRequiredString(right, "id", "Scene deletion override"),
      )
    );
    const bindingRows = command.target.sceneId === null
      ? []
      : this.#database.prepare(`
          SELECT id, revision, scene_id AS "sceneId", status,
            proposed_scene_id AS "proposedSceneId",
            lineage_operation_id AS "lineageOperationId"
          FROM scene_metadata_bindings
          WHERE work_id = ? AND retired_at IS NULL
            AND (scene_id = ? OR proposed_scene_id = ?)
          ORDER BY created_at, id
        `).all(
          command.workId,
          command.target.sceneId,
          command.target.sceneId,
        );
    const previewDocuments = plan.documents.map((document) => ({
      documentId: document.documentId,
      documentTitle: document.documentTitle,
      expectedDocumentRevisionId: document.expectedDocumentRevisionId,
      sceneKey: document.sceneKey,
      sceneRange: document.sceneRange,
      deletionRange: document.deletionRange,
      removedBoundaryAnchorId: document.removedBoundaryAnchorId,
      sceneContentUtf16Length:
        document.sceneRange.end - document.sceneRange.start,
      deletedUtf16Length:
        document.deletionRange.end - document.deletionRange.start,
      firstExcerpt: document.firstExcerpt,
      lastExcerpt: document.lastExcerpt,
    }));
    const fingerprintInput = JSON.stringify({
      workId: command.workId,
      target: command.target,
      sceneRuleSetRevision: projection.ruleSet.revision,
      documents: plan.documents.map((document) => ({
        ...previewDocuments.find(
          (candidate) => candidate.documentId === document.documentId,
        ),
        deletedTextHash: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(document.deletedText, "utf8")
          .digest("hex"),
      })),
      metadata,
      identity: identityRows.map((row) => ({
        revision: readRequiredInteger(row, "revision", "Scene deletion identity"),
      })),
      segments: segmentRows.map((row, index) => ({
        id: readRequiredString(row, "segmentId", `Scene deletion segment[${index}]`),
        revision: readRequiredInteger(row, "revision", `Scene deletion segment[${index}]`),
        documentId: readRequiredString(
          row,
          "documentId",
          `Scene deletion segment[${index}]`,
        ),
      })),
      overrides: overrideRows.map((row, index) => ({
        id: readRequiredString(row, "id", `Scene deletion override[${index}]`),
        revision: readRequiredInteger(
          row,
          "revision",
          `Scene deletion override[${index}]`,
        ),
      })),
      bindings: bindingRows.map((row, index) => ({
        id: readRequiredString(row, "id", `Scene deletion binding[${index}]`),
        revision: readRequiredInteger(
          row,
          "revision",
          `Scene deletion binding[${index}]`,
        ),
      })),
    });
    const preview = parseSceneDeletionPreview({
      schemaVersion: 1,
      previewFingerprint:
        `sha256:${createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(fingerprintInput, "utf8")
          .digest("hex")}`,
      workId: command.workId,
      target: command.target,
      sceneRuleSetRevision: projection.ruleSet.revision,
      documents: previewDocuments,
      metadata,
    });
    return Object.freeze({
      preview,
      plan,
      identityRows,
      segmentRows,
      overrideRows,
      bindingRows,
    });
  }

  async #prepareSceneDeletionSerially(
    command: PrepareSceneDeletionCommand,
  ): Promise<SceneDeletionPreview> {
    return (await this.#prepareSceneDeletionState(command)).preview;
  }

  async #deleteSceneSerially(
    command: DeleteSceneCommand,
  ): Promise<SceneDeletionReceipt> {
    const prepared = await this.#prepareSceneDeletionState({
      schemaVersion: 1,
      workId: command.preview.workId,
      target: command.preview.target,
    });
    if (JSON.stringify(prepared.preview) !== JSON.stringify(command.preview)) {
      throw new Error("Scene deletion preview changed before confirmation");
    }
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.preview.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.preview.workId}`);
    const writingWork = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    ).getWork(command.preview.workId);
    if (writingWork === null) {
      throw new Error(`Unknown writing Work: ${command.preview.workId}`);
    }
    const createdAt = new Date().toISOString();
    const sceneTrashEntryId = entityId<"SceneTrashEntry">(randomUUID());
    const sceneId = command.preview.target.sceneId ?? entityId<"Scene">(randomUUID());
    const identityRows = prepared.identityRows;
    const createsIdentity = command.preview.target.sceneId === null;
    let createdAnchor: Anchor | null = null;
    let createdSegmentId: EntityId<"EpisodeSceneSegment"> | null = null;
    let createdSegmentDocumentId: EntityId<"Document"> | null = null;
    if (createsIdentity) {
      const first = prepared.plan.documents[0]!;
      const target = this.#state.documentTargets.get(first.documentId)!;
      createdSegmentId = entityId<"EpisodeSceneSegment">(randomUUID());
      createdSegmentDocumentId = first.documentId;
      createdAnchor = createAnchorForKnownRevisionContent({
        meta: {
          id: entityId<"Anchor">(randomUUID()),
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
        },
        documentId: first.documentId,
        documentRevisionId: target.currentRevisionId,
        content: target.text,
        startOffset: first.sceneRange.start,
        endOffset: first.sceneRange.end,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: sceneTrashEntryId,
        actorRef: writingWork.studioId,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      });
    }
    const segmentRows = createsIdentity
      ? [{
          segmentId: createdSegmentId,
          revision: 1,
          documentId: createdSegmentDocumentId,
        }]
      : prepared.segmentRows;
    const segmentDocumentIds = new Set(segmentRows.map((row, index) =>
      readRequiredString(row, "documentId", `Scene deletion segment[${index}]`)
    ));
    if (
      segmentDocumentIds.size !== segmentRows.length ||
      prepared.plan.documents.some(
        (document) => !segmentDocumentIds.has(document.documentId),
      )
    ) {
      throw new Error("Scene deletion segment set is ambiguous");
    }
    const orderedSegmentRows = [...segmentRows].sort((left, right) => {
      const leftDocumentId = readRequiredString(
        left,
        "documentId",
        "Scene deletion segment",
      );
      const rightDocumentId = readRequiredString(
        right,
        "documentId",
        "Scene deletion segment",
      );
      const leftDocumentIndex = prepared.plan.documents.findIndex(
        (document) => document.documentId === leftDocumentId,
      );
      const rightDocumentIndex = prepared.plan.documents.findIndex(
        (document) => document.documentId === rightDocumentId,
      );
      return (
        (leftDocumentIndex < 0 ? Number.MAX_SAFE_INTEGER : leftDocumentIndex) -
          (rightDocumentIndex < 0 ? Number.MAX_SAFE_INTEGER : rightDocumentIndex) ||
        leftDocumentId.localeCompare(rightDocumentId)
      );
    });
    const documentRecords = prepared.plan.documents.map((document, ordinal) => {
      const target = this.#state.documentTargets.get(document.documentId);
      if (
        target === undefined ||
        target.workId !== command.preview.workId ||
        target.currentRevisionId !== document.expectedDocumentRevisionId
      ) {
        throw new Error(`Scene deletion revision conflict: ${document.documentId}`);
      }
      const editorState = this.#manuscript_core.readEditorStateForRevision(
        command.preview.workId,
        document.documentId,
        target.currentRevisionId,
        target.text.length,
      );
      const nextEditorState = deleteManuscriptEditorStateRange({
        text: target.text,
        state: editorState,
        range: document.deletionRange,
      });
      return Object.freeze({
        sceneTrashDocumentId: entityId<"SceneTrashDocument">(randomUUID()),
        documentId: document.documentId,
        ordinal,
        beforeRevisionId: target.currentRevisionId,
        deletedRevision: Object.freeze({
          revisionId: entityId<"DocumentRevision">(randomUUID()),
          workId: command.preview.workId,
          documentId: document.documentId,
          expectedCurrentRevisionId: target.currentRevisionId,
          content: document.nextText,
          editorStateJson: serializeManuscriptEditorDocumentState(nextEditorState),
          cause: JSON.stringify({
            kind: "delete-scene",
            sceneTrashEntryId,
            sceneId,
          }),
          createdAt,
          durableAt: createdAt,
        }),
        sceneKey: document.sceneKey,
        sceneRange: document.sceneRange,
        deletionRange: document.deletionRange,
        deletedTextHash: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(document.deletedText, "utf8")
          .digest("hex"),
        deletedUtf16Length:
          document.deletionRange.end - document.deletionRange.start,
        firstExcerpt: document.firstExcerpt,
        lastExcerpt: document.lastExcerpt,
      });
    });
    const committed = await this.#sceneTrashStore.commit({
      sceneTrashEntryId,
      workId: command.preview.workId,
      identity: Object.freeze({
        sceneId,
        expectedRevision: createsIdentity
          ? null
          : readRequiredInteger(identityRows[0] ?? {}, "revision", "Scene identity"),
        createdAnchor,
        createdSegmentId,
        createdSegmentDocumentId,
      }),
      sourceSceneKey: command.preview.target.sceneKey,
      sceneRuleSetRevision: command.preview.sceneRuleSetRevision,
      previewFingerprint: command.preview.previewFingerprint,
      metadataJson: JSON.stringify(command.preview.metadata),
      deleteLineageOperationId:
        entityId<"SceneLineageOperation">(randomUUID()),
      deleteLineageParentMemberId:
        entityId<"SceneLineageMember">(randomUUID()),
      documents: documentRecords,
      segments: orderedSegmentRows.map((row, ordinal) => Object.freeze({
        sceneTrashSegmentId: entityId<"SceneTrashSegment">(randomUUID()),
        segmentId: entityId<"EpisodeSceneSegment">(
          readRequiredString(row, "segmentId", `Scene deletion segment[${ordinal}]`),
        ),
        expectedRevision: readRequiredInteger(
          row,
          "revision",
          `Scene deletion segment[${ordinal}]`,
        ),
        documentId: entityId<"Document">(
          readRequiredString(row, "documentId", `Scene deletion segment[${ordinal}]`),
        ),
        ordinal,
      })),
      overrides: prepared.overrideRows.map((row, ordinal) => Object.freeze({
        sceneTrashOverrideId: entityId<"SceneTrashOverride">(randomUUID()),
        sceneOverrideId: entityId<"SceneOverride">(
          readRequiredString(row, "id", `Scene deletion override[${ordinal}]`),
        ),
        expectedRevision: readRequiredInteger(
          row,
          "revision",
          `Scene deletion override[${ordinal}]`,
        ),
        ordinal,
      })),
      bindings: prepared.bindingRows.map((row, ordinal) => {
        const status = readRequiredString(row, "status", `Scene deletion binding[${ordinal}]`);
        if (
          status !== "current" &&
          status !== "needs-review" &&
          status !== "detached"
        ) throw new Error(`Scene deletion binding[${ordinal}].status is invalid`);
        return Object.freeze({
          sceneTrashBindingId: entityId<"SceneTrashBinding">(randomUUID()),
          sceneMetadataBindingId: entityId<"SceneMetadataBinding">(
            readRequiredString(row, "id", `Scene deletion binding[${ordinal}]`),
          ),
          expectedRevision: readRequiredInteger(
            row,
            "revision",
            `Scene deletion binding[${ordinal}]`,
          ),
          ordinal,
          sceneId: readNullableIdentity<"Scene">(
            row,
            "sceneId",
            `Scene deletion binding[${ordinal}]`,
          ),
          status,
          proposedSceneId: readNullableIdentity<"Scene">(
            row,
            "proposedSceneId",
            `Scene deletion binding[${ordinal}]`,
          ),
          lineageOperationId: readNullableIdentity<"SceneLineageOperation">(
            row,
            "lineageOperationId",
            `Scene deletion binding[${ordinal}]`,
          ),
        });
      }),
      createdAt,
    });
    for (const document of documentRecords) {
      const target = this.#state.documentTargets.get(document.documentId)!;
      this.#manuscript_core.installMovedDocumentTarget(
        target,
        document.deletedRevision.revisionId,
        document.deletedRevision.content,
      );
    }
    await this.#workspace.reload({
      schemaVersion: 1,
      workId: command.preview.workId,
      documentId: documentRecords[0]!.documentId,
    });
    const entries = await this.#listSceneTrashSerially({
      schemaVersion: 1,
      workId: command.preview.workId,
    });
    const entry = entries.entries.find(
      (candidate) => candidate.sceneTrashEntryId === sceneTrashEntryId,
    );
    if (entry === undefined) throw new Error(`Stored Scene trash is missing: ${sceneTrashEntryId}`);
    return parseSceneDeletionReceipt({
      schemaVersion: 1,
      status: "deleted",
      entry,
      documentRevisions: committed.documentRevisions,
    });
  }

  async #listSceneTrashSerially(
    command: ListSceneTrashCommand,
  ): Promise<SceneTrashListProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    const ruleRevision = readStoredSceneRuleSetRow(
      this.#database,
      command.workId,
    ).revision;
    const entryRows = this.#database.prepare(`
      SELECT id, revision, scene_id AS "sceneId", source_scene_key AS "sourceSceneKey",
        source_rule_set_revision AS "sceneRuleSetRevision", metadata_json AS "metadataJson",
        status, created_at AS "deletedAt", restored_at AS "restoredAt",
        scene_identity_post_delete_revision AS "identityRevision"
      FROM scene_trash_entries
      WHERE work_id = ?
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at DESC, id
    `).all(command.workId);
    const entries: SceneTrashEntryProjection[] = [];
    for (const [entryIndex, row] of entryRows.entries()) {
      const label = `Scene trash entry[${entryIndex}]`;
      const entryId = entityId<"SceneTrashEntry">(
        readRequiredString(row, "id", label),
      );
      const sceneId = entityId<"Scene">(readRequiredString(row, "sceneId", label));
      const status = readRequiredString(row, "status", label);
      if (status !== "active" && status !== "restored" && status !== "undone") {
        throw new Error(`${label}.status is invalid`);
      }
      const documentRows = this.#database.prepare(`
        SELECT trash.id AS "sceneTrashDocumentId", trash.document_id AS "documentId",
          document.title AS "documentTitle", trash.ordinal,
          trash.before_revision_id AS "beforeRevisionId",
          trash.deleted_revision_id AS "deletedRevisionId",
          trash.restored_revision_id AS "restoredRevisionId",
          trash.scene_from AS "sceneFrom", trash.scene_to AS "sceneTo",
          trash.deletion_from AS "deletionFrom", trash.deletion_to AS "deletionTo",
          trash.deleted_utf16_length AS "deletedUtf16Length",
          trash.first_excerpt AS "firstExcerpt", trash.last_excerpt AS "lastExcerpt"
        FROM scene_trash_documents AS trash
        JOIN documents AS document
          ON document.work_id = trash.work_id AND document.id = trash.document_id
        WHERE trash.work_id = ? AND trash.trash_entry_id = ?
        ORDER BY trash.ordinal
      `).all(command.workId, entryId);
      let conflictReason: string | null = status === "active"
        ? null
        : "이미 복원된 장면입니다.";
      const sourceRuleRevision = readRequiredInteger(
        row,
        "sceneRuleSetRevision",
        label,
      );
      if (conflictReason === null && sourceRuleRevision !== ruleRevision) {
        conflictReason = "장면 규칙이 삭제 후 변경되었습니다.";
      }
      if (conflictReason === null) {
        for (const [index, documentRow] of documentRows.entries()) {
          const documentId = entityId<"Document">(
            readRequiredString(documentRow, "documentId", `${label}.documents[${index}]`),
          );
          if (
            this.#state.documentTargets.get(documentId)?.currentRevisionId !==
              readRequiredString(
                documentRow,
                "deletedRevisionId",
                `${label}.documents[${index}]`,
              )
          ) {
            conflictReason = "삭제 후 회차 원고가 변경되었습니다.";
            break;
          }
        }
      }
      if (conflictReason === null) {
        const identityRows = this.#database.prepare(`
          SELECT COUNT(*) AS count FROM scene_identities
          WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NOT NULL
        `).all(
          command.workId,
          sceneId,
          readRequiredInteger(row, "identityRevision", label),
        );
        if (readRequiredInteger(identityRows[0] ?? {}, "count", label) !== 1) {
          conflictReason = "삭제된 장면 identity가 변경되었습니다.";
        }
      }
      if (conflictReason === null) {
        const mismatchRows = this.#database.prepare(`
          SELECT
            (SELECT COUNT(*) FROM scene_trash_bindings AS snapshot
              LEFT JOIN scene_metadata_bindings AS binding
                ON binding.work_id = snapshot.work_id
                AND binding.id = snapshot.scene_metadata_binding_id
              WHERE snapshot.work_id = ? AND snapshot.trash_entry_id = ?
                AND (binding.id IS NULL OR binding.revision <> snapshot.post_delete_revision
                  OR binding.retired_at IS NOT NULL)) AS bindingMismatch,
            (SELECT COUNT(*) FROM scene_trash_segments AS snapshot
              LEFT JOIN scene_episode_segments AS segment
                ON segment.work_id = snapshot.work_id AND segment.id = snapshot.segment_id
              WHERE snapshot.work_id = ? AND snapshot.trash_entry_id = ?
                AND (segment.id IS NULL OR segment.revision <> snapshot.post_delete_revision
                  OR segment.retired_at IS NULL)) AS segmentMismatch,
            (SELECT COUNT(*) FROM scene_trash_overrides AS snapshot
              LEFT JOIN scene_overrides AS override
                ON override.work_id = snapshot.work_id
                AND override.id = snapshot.scene_override_id
              WHERE snapshot.work_id = ? AND snapshot.trash_entry_id = ?
                AND (override.id IS NULL OR override.revision <> snapshot.post_delete_revision
                  OR override.retired_at IS NULL)) AS overrideMismatch
        `).all(
          command.workId,
          entryId,
          command.workId,
          entryId,
          command.workId,
          entryId,
        );
        const mismatch = mismatchRows[0] ?? {};
        if (
          readRequiredInteger(mismatch, "bindingMismatch", label) > 0 ||
          readRequiredInteger(mismatch, "segmentMismatch", label) > 0 ||
          readRequiredInteger(mismatch, "overrideMismatch", label) > 0
        ) {
          conflictReason = "삭제된 장면 연결 정보가 변경되었습니다.";
        }
      }
      entries.push(parseSceneTrashEntryProjection({
        schemaVersion: 1,
        sceneTrashEntryId: entryId,
        revision: readRequiredInteger(row, "revision", label),
        workId: command.workId,
        sceneId,
        sourceSceneKey: readRequiredString(row, "sourceSceneKey", label),
        sceneRuleSetRevision: sourceRuleRevision,
        status,
        documents: documentRows.map((documentRow, index) => {
          const documentLabel = `${label}.documents[${index}]`;
          return {
            sceneTrashDocumentId: readRequiredString(
              documentRow,
              "sceneTrashDocumentId",
              documentLabel,
            ),
            documentId: readRequiredString(documentRow, "documentId", documentLabel),
            documentTitle: readRequiredString(
              documentRow,
              "documentTitle",
              documentLabel,
            ),
            ordinal: readRequiredInteger(documentRow, "ordinal", documentLabel),
            beforeRevisionId: readRequiredString(
              documentRow,
              "beforeRevisionId",
              documentLabel,
            ),
            deletedRevisionId: readRequiredString(
              documentRow,
              "deletedRevisionId",
              documentLabel,
            ),
            restoredRevisionId: readNullableString(
              documentRow,
              "restoredRevisionId",
              documentLabel,
            ),
            sceneRange: {
              start: readRequiredInteger(documentRow, "sceneFrom", documentLabel),
              end: readRequiredInteger(documentRow, "sceneTo", documentLabel),
            },
            deletionRange: {
              start: readRequiredInteger(documentRow, "deletionFrom", documentLabel),
              end: readRequiredInteger(documentRow, "deletionTo", documentLabel),
            },
            deletedUtf16Length: readRequiredInteger(
              documentRow,
              "deletedUtf16Length",
              documentLabel,
            ),
            firstExcerpt: readRequiredString(documentRow, "firstExcerpt", documentLabel),
            lastExcerpt: readRequiredString(documentRow, "lastExcerpt", documentLabel),
          };
        }),
        metadata: JSON.parse(readRequiredString(row, "metadataJson", label)),
        canRestore: conflictReason === null,
        conflictReason,
        deletedAt: readRequiredString(row, "deletedAt", label),
        restoredAt: readNullableString(row, "restoredAt", label),
      }));
    }
    return parseSceneTrashListProjection({
      schemaVersion: 1,
      workId: command.workId,
      entries,
    });
  }

  async #restoreSceneTrashSerially(
    command: RestoreSceneTrashCommand | UndoSceneDeletionCommand,
    status: "restored" | "undone",
  ): Promise<SceneDeletionReceipt> {
    const currentList = await this.#listSceneTrashSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const entry = currentList.entries.find(
      (candidate) => candidate.sceneTrashEntryId === command.sceneTrashEntryId,
    );
    if (
      entry === undefined ||
      entry.revision !== command.expectedRevision ||
      !entry.canRestore
    ) {
      throw new Error(
        entry?.conflictReason ?? `Scene trash entry is not restorable: ${command.sceneTrashEntryId}`,
      );
    }
    const restoredAt = new Date().toISOString();
    const contents = await Promise.all(entry.documents.map(async (document) => ({
      document,
      text: await this.#revisionStore.materialize(document.beforeRevisionId),
      editorStateJson: readRevisionEditorStateJson(this.#database, {
        revisionId: document.beforeRevisionId,
        workId: command.workId,
        documentId: document.documentId,
      }),
    })));
    const revisions = contents.map(({ document, text, editorStateJson }) => ({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: command.workId,
      documentId: document.documentId,
      expectedCurrentRevisionId: document.deletedRevisionId,
      content: text,
      ...(editorStateJson === undefined ? {} : { editorStateJson }),
      cause: JSON.stringify({
        kind: status === "undone" ? "undo-delete-scene" : "restore-scene-trash",
        sceneTrashEntryId: command.sceneTrashEntryId,
      }),
      createdAt: restoredAt,
      durableAt: restoredAt,
    }));
    const committed = await this.#sceneTrashStore.restore({
      sceneTrashEntryId: command.sceneTrashEntryId,
      workId: command.workId,
      expectedRevision: command.expectedRevision,
      status,
      restoreLineageOperationId:
        entityId<"SceneLineageOperation">(randomUUID()),
      restoreLineageParentMemberId:
        entityId<"SceneLineageMember">(randomUUID()),
      restoreLineageChildMemberId:
        entityId<"SceneLineageMember">(randomUUID()),
      documentRevisions: revisions,
      restoredAt,
    });
    for (const { document, text } of contents) {
      const target = this.#state.documentTargets.get(document.documentId);
      const revision = committed.documentRevisions.find(
        (candidate) => candidate.documentId === document.documentId,
      );
      if (target === undefined || revision === undefined) {
        throw new Error(`Restored Scene Document is unavailable: ${document.documentId}`);
      }
      this.#manuscript_core.installMovedDocumentTarget(target, revision.revisionId, text);
    }
    await this.#workspace.reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: entry.documents[0]!.documentId,
    });
    const restoredList = await this.#listSceneTrashSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const restoredEntry = restoredList.entries.find(
      (candidate) => candidate.sceneTrashEntryId === command.sceneTrashEntryId,
    );
    if (restoredEntry === undefined) {
      throw new Error(`Restored Scene trash entry is missing: ${command.sceneTrashEntryId}`);
    }
    return parseSceneDeletionReceipt({
      schemaVersion: 1,
      status,
      entry: restoredEntry,
      documentRevisions: committed.documentRevisions,
    });
  }
}

