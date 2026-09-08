import { randomUUID } from "node:crypto";
import { CreateAnchor,createAnchorForKnownRevisionContent } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { SceneCanonCheckProjection,SceneCanonContextListProjection } from "../../../application/structure/scene-canon-context";
import { parseFinalizeSceneCanonCheckCommand,parseListSceneCanonContextsCommand,parseSceneCanonCheckProjection } from "../../../application/structure/scene-canon-context";
import type { RebindSceneMetadataCommand,SceneMetadataBindingProjection } from "../../../application/structure/scene-metadata-binding-contract";
import { parseRebindSceneMetadataCommand,parseSceneMetadataBindingProjection } from "../../../application/structure/scene-metadata-binding-contract";
import type { CreateSceneOverrideCommand,ListSceneOverridesCommand,RelocateSceneSegmentCommand,SceneOverrideListProjection,SceneOverrideProjection } from "../../../application/structure/scene-override-contract";
import { parseCreateSceneOverrideCommand,parseListSceneOverridesCommand,parseRelocateSceneSegmentCommand,parseSceneOverrideListProjection,parseSceneOverrideProjection } from "../../../application/structure/scene-override-contract";
import type { ListSceneProjectionCommand,SceneEpisodeSegmentProjection,SceneEventOverrideProjection,SceneProjection,SceneProjectionList,SceneRuleSetProjection,SetSceneEventOverrideCommand,UpdateSceneRuleSetCommand } from "../../../application/structure/scene-projection";
import { deriveSceneProjection,parseListSceneProjectionCommand,parseSceneEventOverrideProjection,parseSceneRuleSetProjection,parseSetSceneEventOverrideCommand,parseUpdateSceneRuleSetCommand } from "../../../application/structure/scene-projection";
import type { Poc3LedgerRecord } from "../../../domain/poc-3-storage-ledger";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import { listLocalSceneCanonContexts } from "../../continuity/local-scene-canon-context";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readStoredEventBlockRowById } from "../repositories/events";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { readNullableString,readRequiredInteger,readRequiredString } from "../repositories/scalars";
import type { StoredSceneEpisodeSegmentRow,StoredSceneEventOverrideRow,StoredSceneMetadataBindingRow,StoredSceneMetadataSourceRow,StoredSceneOverrideRow,StoredSceneRuleSetRow } from "../repositories/scene-geometry";
import { readStoredSceneEventOverrideRows,readStoredSceneOverrideRows,readStoredSceneRuleSetRow,SCENE_EPISODE_SEGMENT_ROWS_SQL,SCENE_METADATA_BINDING_ROWS_SQL,SCENE_METADATA_SOURCE_ROWS_SQL,WORK_SCENE_RULE_REVISION_SQL } from "../repositories/scene-geometry";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { EventsService } from "./events";
import type { InfrastructureService } from "./infrastructure";

/** Owns scene geometry commands and their existing transaction boundaries. */
export class SceneGeometryService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #events: Pick<EventsService, "listEventBlocksSerially">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly events: Pick<EventsService, "listEventBlocksSerially">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#options = input.options;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
    this.#events = input.events;
  }

  async initializeSceneMetadataBindings(): Promise<void> {
    this.#infrastructure.assertOpen();
    for (const work of this.#state.catalog.works) {
      await this.#reconcileSceneMetadataBindingsSerially(work.workId);
    }
  }

  createSceneOverride(value: unknown): Promise<SceneOverrideProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateSceneOverrideCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createSceneOverrideSerially(command);
    });

    return execution;
  }

  relocateSceneSegment(value: unknown): Promise<SceneProjectionList> {
    this.#infrastructure.assertOpen();
    const command = parseRelocateSceneSegmentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#relocateSceneSegmentSerially(command);
    });

    return execution;
  }

  listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneOverridesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listSceneOverridesSerially(command),
    );
  }

  listSceneProjection(value: unknown): Promise<SceneProjectionList> {
    this.#infrastructure.assertOpen();
    const command = parseListSceneProjectionCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listSceneProjectionSerially(command),
    );
  }

  listSceneCanonContexts(value: unknown): Promise<SceneCanonContextListProjection> {
    this.#infrastructure.assertOpen();
    const command=parseListSceneCanonContextsCommand(value);
    return this.#operations.readBarrier().then(() =>
      listLocalSceneCanonContexts(this.#database,command)
    );
  }

  finalizeSceneCanonCheck(value:unknown):Promise<SceneCanonCheckProjection>{
    this.#infrastructure.assertOpen();const command=parseFinalizeSceneCanonCheckCommand(value);
    const execution=this.#operations.enqueueMutation(async(priorSaves)=>{
      await priorSaves;
      let projection=await this.listSceneProjectionSerially({schemaVersion:1,workId:command.workId});
      let scene=projection.scenes.find((candidate)=>candidate.sceneKey===command.sceneKey&&candidate.documentId===command.documentId);
      if(scene===undefined||scene.range===null||scene.integrity!=="resolved"||scene.documentRevisionId!==command.documentRevisionId||scene.range.start!==command.from||scene.range.end!==command.to)throw new Error("Scene Canon check source changed");
      if(scene.sceneIdentity===undefined){
        const prepared=this.prepareSceneIdentityRecords(scene,`scene-canon-check:${randomUUID()}`,new Date().toISOString());
        await this.#ledger.transaction(async(transaction)=>{for(const record of prepared.records)transaction.write(record);});
        projection=await this.listSceneProjectionSerially({schemaVersion:1,workId:command.workId});
        scene=projection.scenes.find((candidate)=>candidate.sceneKey===command.sceneKey&&candidate.documentId===command.documentId);
      }
      const sceneId=scene?.sceneIdentity?.sceneId;
      if(scene===undefined||sceneId===undefined)throw new Error("Stable Scene identity was not finalized");
      return parseSceneCanonCheckProjection({schemaVersion:1,workId:command.workId,sceneId,sceneKey:scene.sceneKey,sourceRange:{documentId:scene.documentId,documentRevisionId:scene.documentRevisionId,from:command.from,to:command.to}});
    });
    return execution;
  }

  updateSceneRuleSet(value: unknown): Promise<SceneProjectionList> {
    this.#infrastructure.assertOpen();
    const command = parseUpdateSceneRuleSetCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updateSceneRuleSetSerially(command);
    });

    return execution;
  }

  setSceneEventOverride(value: unknown): Promise<SceneProjectionList> {
    this.#infrastructure.assertOpen();
    const command = parseSetSceneEventOverrideCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#setSceneEventOverrideSerially(command);
    });

    return execution;
  }

  rebindSceneMetadata(value: unknown): Promise<SceneMetadataBindingProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRebindSceneMetadataCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#rebindSceneMetadataSerially(command);
    });

    return execution;
  }

  async #createSceneOverrideSerially(
    command: CreateSceneOverrideCommand,
  ): Promise<SceneOverrideProjection> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (target.currentRevisionId !== command.expectedDocumentRevisionId) {
      throw new Error(
        `SceneOverride document revision conflict: ${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("SceneOverride boundary is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "SceneOverride boundary quote does not match the current durable revision",
      );
    }
    const storedRows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(storedRows);
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const settingsRows = this.#database
      .prepare(WORK_SCENE_RULE_REVISION_SQL)
      .all(command.workId);
    const settingsRow = settingsRows[0];
    if (settingsRows.length !== 1 || settingsRow === undefined) {
      throw new Error(`Work scene settings are missing: ${command.workId}`);
    }
    const baseRuleSetRevision = readRequiredInteger(
      settingsRow,
      "baseRuleSetRevision",
      "Work scene settings",
    );
    const createdAt = new Date().toISOString();
    const sceneOverrideId = entityId<"SceneOverride">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const describeEvidence = createNodeCryptoAnchorEvidenceDescriptor(
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence,
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
      commandRef: sceneOverrideId,
      actorRef: work.studioId,
    });
    const sceneIdentityRecords: Poc3LedgerRecord[] = [];
    const createSceneLineage = (
      operation: "split" | "merge",
      parentSceneIds: readonly EntityId<"Scene">[],
      childSceneIds: readonly EntityId<"Scene">[],
    ): string => {
      const lineageOperationId = randomUUID();
      const uniqueParents = [...new Set(parentSceneIds)];
      const uniqueChildren = [...new Set(childSceneIds)];
      sceneIdentityRecords.push({
        kind: "sceneLineageOperation",
        id: lineageOperationId,
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        workId: command.workId,
        operation,
        commandRef: sceneOverrideId,
      });
      for (const [ordinal, sceneId] of uniqueParents.entries()) {
        sceneIdentityRecords.push({
          kind: "sceneLineageMember",
          id: randomUUID(),
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          workId: command.workId,
          lineageOperationId,
          sceneId,
          role: "parent",
          ordinal,
        });
      }
      for (const [ordinal, sceneId] of uniqueChildren.entries()) {
        sceneIdentityRecords.push({
          kind: "sceneLineageMember",
          id: randomUUID(),
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          workId: command.workId,
          lineageOperationId,
          sceneId,
          role: "child",
          ordinal,
        });
      }
      return lineageOperationId;
    };
    const markSceneMetadataForReview = (
      parentSceneIds: readonly EntityId<"Scene">[],
      proposedSceneId: EntityId<"Scene">,
      lineageOperationId: string,
    ): void => {
      const sceneIds = [...new Set(parentSceneIds)];
      if (sceneIds.length === 0) return;
      const placeholders = sceneIds.map(() => "?").join(", ");
      const rows = this.#database.prepare(`
        SELECT
          id AS "bindingId",
          revision,
          scene_id AS "sceneId"
        FROM scene_metadata_bindings
        WHERE
          work_id = ?
          AND retired_at IS NULL
          AND status <> 'detached'
          AND scene_id IN (${placeholders})
        ORDER BY created_at, id
      `).all(command.workId, ...sceneIds);
      for (const [index, row] of rows.entries()) {
        const label = `Scene metadata review rows[${index}]`;
        const sceneId = readRequiredString(row, "sceneId", label);
        sceneIdentityRecords.push({
          kind: "sceneMetadataBindingUpdate",
          id: readRequiredString(row, "bindingId", label),
          workId: command.workId,
          expectedRevision: readRequiredInteger(row, "revision", label),
          updatedAt: createdAt,
          sceneId,
          status: "needs-review",
          proposedSceneId,
          lineageOperationId,
        });
      }
    };
    if (command.operation === "split") {
      const sceneProjection = await this.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const sourceScene = sceneProjection.scenes.find(
        (scene) =>
          scene.documentId === command.documentId &&
          scene.range !== null &&
          scene.range.start < from &&
          to < scene.range.end,
      );
      if (sourceScene === undefined || sourceScene.range === null) {
        throw new Error("Scene split must stay inside one current Scene");
      }
      const leftSceneId = sourceScene.sceneIdentity?.sceneId ??
        entityId<"Scene">(randomUUID());
      const rightSceneId = entityId<"Scene">(randomUUID());
      if (sourceScene.sceneIdentity === undefined) {
        sceneIdentityRecords.push({
          kind: "sceneIdentity",
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          id: leftSceneId,
          workId: command.workId,
        });
      }
      sceneIdentityRecords.push({
        kind: "sceneIdentity",
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        id: rightSceneId,
        workId: command.workId,
      });

      const segmentsToReplace = (sourceScene.sceneIdentity?.segments ?? [])
        .filter(
          (segment) =>
            segment.range !== null &&
            (segment.documentIndex > sourceScene.documentIndex ||
              (segment.documentId === command.documentId &&
                segment.range.start < sourceScene.range!.end &&
                segment.range.end > sourceScene.range!.start)),
        );
      for (const segment of segmentsToReplace) {
        sceneIdentityRecords.push({
          kind: "sceneEpisodeSegmentRetirement",
          id: segment.segmentId,
          workId: command.workId,
          retiredAt: createdAt,
        });
      }

      const segmentRanges: Array<Readonly<{
        sceneId: EntityId<"Scene">;
        documentId: EntityId<"Document">;
        start: number;
        end: number;
      }>> = [
        Object.freeze({
          sceneId: leftSceneId,
          documentId: command.documentId,
          start: sourceScene.range.start,
          end: from,
        }),
        Object.freeze({
          sceneId: rightSceneId,
          documentId: command.documentId,
          start: to,
          end: sourceScene.range.end,
        }),
        ...segmentsToReplace.flatMap((segment) => {
          if (
            segment.range === null ||
            segment.documentId === command.documentId
          ) return [];
          return [Object.freeze({
            sceneId: rightSceneId,
            documentId: segment.documentId,
            start: segment.range.start,
            end: segment.range.end,
          })];
        }),
      ];
      for (const segmentRange of segmentRanges) {
        if (segmentRange.start >= segmentRange.end) continue;
        const segmentTarget = this.#state.documentTargets.get(segmentRange.documentId);
        if (
          segmentTarget === undefined ||
          segmentTarget.workId !== command.workId ||
          segmentRange.end > segmentTarget.text.length
        ) {
          throw new Error("Scene split segment is outside the current Work");
        }
        const segmentId = entityId<"EpisodeSceneSegment">(randomUUID());
        const segmentAnchor = createAnchorForKnownRevisionContent({
          meta: {
            id: entityId<"Anchor">(randomUUID()),
            schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
            revision: 1,
            createdAt,
            updatedAt: createdAt,
          },
          documentId: segmentRange.documentId,
          documentRevisionId: segmentTarget.currentRevisionId,
          content: segmentTarget.text,
          startOffset: segmentRange.start,
          endOffset: segmentRange.end,
          policy: this.#options.defaults.anchorPolicy,
          commandRef: sceneOverrideId,
          actorRef: work.studioId,
          describeEvidence,
        });
        sceneIdentityRecords.push(
          createAnchorLedgerRecord(command.workId, segmentAnchor),
          {
            kind: "sceneEpisodeSegment",
            schemaVersion: 1,
            revision: 1,
            createdAt,
            updatedAt: createdAt,
            id: segmentId,
            workId: command.workId,
            sceneId: segmentRange.sceneId,
            documentId: segmentRange.documentId,
            anchorId: segmentAnchor.meta.id,
          },
        );
      }
      const lineageOperationId = createSceneLineage(
        "split",
        [leftSceneId],
        [leftSceneId, rightSceneId],
      );
      markSceneMetadataForReview(
        [leftSceneId],
        leftSceneId,
        lineageOperationId,
      );
    } else if (command.operation === "merge") {
      const sceneProjection = await this.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      let leftScene = [...sceneProjection.scenes]
        .reverse()
        .find(
          (scene) =>
            scene.documentId === command.documentId &&
            scene.range !== null &&
            scene.range.end === from,
        );
      const rightScene = sceneProjection.scenes.find(
        (scene) =>
          scene.documentId === command.documentId &&
          scene.range !== null &&
          scene.range.start === to,
      );
      if (
        leftScene === undefined &&
        from === 0 &&
        to === 0 &&
        rightScene !== undefined
      ) {
        leftScene = [...sceneProjection.scenes]
          .filter(
            (scene) =>
              scene.range !== null &&
              scene.documentIndex < rightScene!.documentIndex,
          )
          .sort(
            (left, right) =>
              right.documentIndex - left.documentIndex ||
              right.sceneIndex - left.sceneIndex,
          )[0];
      }
      if (
        leftScene !== undefined &&
        leftScene.range !== null &&
        rightScene !== undefined &&
        rightScene.range !== null &&
        (leftScene.documentId === rightScene.documentId ||
          leftScene.documentIndex + 1 === rightScene.documentIndex)
      ) {
        const leftSceneId = leftScene.sceneIdentity?.sceneId ??
          entityId<"Scene">(randomUUID());
        const rightSceneId = rightScene.sceneIdentity?.sceneId ??
          entityId<"Scene">(randomUUID());
        const mergedSceneId = leftSceneId;
        if (leftScene.sceneIdentity === undefined) {
          sceneIdentityRecords.push({
            kind: "sceneIdentity",
            schemaVersion: 1,
            revision: 1,
            createdAt,
            updatedAt: createdAt,
            id: leftSceneId,
            workId: command.workId,
          });
        }
        if (
          rightScene.sceneIdentity === undefined &&
          rightSceneId !== leftSceneId
        ) {
          sceneIdentityRecords.push({
            kind: "sceneIdentity",
            schemaVersion: 1,
            revision: 1,
            createdAt,
            updatedAt: createdAt,
            id: rightSceneId,
            workId: command.workId,
          });
        }
        const segmentsById = new Map(
          [
            ...(leftScene.sceneIdentity?.segments ?? []),
            ...(rightScene.sceneIdentity?.segments ?? []),
          ].map((segment) => [segment.segmentId, segment] as const),
        );
        for (const segment of segmentsById.values()) {
          sceneIdentityRecords.push({
            kind: "sceneEpisodeSegmentRetirement",
            id: segment.segmentId,
            workId: command.workId,
            retiredAt: createdAt,
          });
        }
        const rangesByDocument = new Map<
          EntityId<"Document">,
          Array<{ start: number; end: number }>
        >();
        for (const segment of segmentsById.values()) {
          if (segment.range === null) continue;
          const ranges = rangesByDocument.get(segment.documentId) ?? [];
          ranges.push({
            start: segment.range.start,
            end: segment.range.end,
          });
          rangesByDocument.set(segment.documentId, ranges);
        }
        if (leftScene.documentId === rightScene.documentId) {
          rangesByDocument.set(command.documentId, [{
            start: leftScene.range.start,
            end: rightScene.range.end,
          }]);
        } else {
          const leftRanges = rangesByDocument.get(leftScene.documentId) ?? [];
          leftRanges.push({
            start: leftScene.range.start,
            end: leftScene.range.end,
          });
          rangesByDocument.set(leftScene.documentId, leftRanges);
          const rightRanges = rangesByDocument.get(rightScene.documentId) ?? [];
          rightRanges.push({
            start: rightScene.range.start,
            end: rightScene.range.end,
          });
          rangesByDocument.set(rightScene.documentId, rightRanges);
        }
        for (const [documentId, ranges] of rangesByDocument) {
          const orderedRanges = [...ranges].sort(
            (left, right) => left.start - right.start || left.end - right.end,
          );
          const mergedRanges: Array<{ start: number; end: number }> = [];
          for (const range of orderedRanges) {
            const previous = mergedRanges.at(-1);
            if (previous !== undefined && range.start <= previous.end) {
              previous.end = Math.max(previous.end, range.end);
            } else {
              mergedRanges.push({ ...range });
            }
          }
          const segmentTarget = this.#state.documentTargets.get(documentId);
          if (segmentTarget === undefined || segmentTarget.workId !== command.workId) {
            throw new Error("Scene merge segment is outside the current Work");
          }
          for (const range of mergedRanges) {
            if (range.start >= range.end || range.end > segmentTarget.text.length) {
              throw new Error("Scene merge segment range is invalid");
            }
            const segmentAnchor = createAnchorForKnownRevisionContent({
              meta: {
                id: entityId<"Anchor">(randomUUID()),
                schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
                revision: 1,
                createdAt,
                updatedAt: createdAt,
              },
              documentId,
              documentRevisionId: segmentTarget.currentRevisionId,
              content: segmentTarget.text,
              startOffset: range.start,
              endOffset: range.end,
              policy: this.#options.defaults.anchorPolicy,
              commandRef: sceneOverrideId,
              actorRef: work.studioId,
              describeEvidence,
            });
            sceneIdentityRecords.push(
              createAnchorLedgerRecord(command.workId, segmentAnchor),
              {
                kind: "sceneEpisodeSegment",
                schemaVersion: 1,
                revision: 1,
                createdAt,
                updatedAt: createdAt,
                id: entityId<"EpisodeSceneSegment">(randomUUID()),
                workId: command.workId,
                sceneId: mergedSceneId,
                documentId,
                anchorId: segmentAnchor.meta.id,
              },
            );
          }
        }
        if (rightSceneId !== mergedSceneId) {
          sceneIdentityRecords.push({
            kind: "sceneIdentityRetirement",
            id: rightSceneId,
            workId: command.workId,
            retiredAt: createdAt,
          });
        }
        const parentSceneIds = rightSceneId === leftSceneId
          ? [leftSceneId]
          : [leftSceneId, rightSceneId];
        const lineageOperationId = createSceneLineage(
          "merge",
          parentSceneIds,
          [mergedSceneId],
        );
        markSceneMetadataForReview(
          parentSceneIds,
          mergedSceneId,
          lineageOperationId,
        );
      }
    } else if (command.operation === "delete") {
      const sceneProjection = await this.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const sourceScene = sceneProjection.scenes.find(
        (scene) =>
          scene.documentId === command.documentId &&
          scene.range?.start === from &&
          scene.range.end === to,
      );
      if (sourceScene?.sceneIdentity !== undefined) {
        const activeSegmentRows = this.#database.prepare(`
          SELECT id AS "segmentId"
          FROM scene_episode_segments
          WHERE
            work_id = ?
            AND scene_id = ?
            AND retired_at IS NULL
          ORDER BY created_at, id
        `).all(
          command.workId,
          sourceScene.sceneIdentity.sceneId,
        );
        for (const [index, row] of activeSegmentRows.entries()) {
          sceneIdentityRecords.push({
            kind: "sceneEpisodeSegmentRetirement",
            id: entityId<"EpisodeSceneSegment">(
              readRequiredString(
                row,
                "segmentId",
                `Scene deletion segment rows[${index}]`,
              ),
            ),
            workId: command.workId,
            retiredAt: createdAt,
          });
        }
        sceneIdentityRecords.push({
          kind: "sceneIdentityRetirement",
          id: sourceScene.sceneIdentity.sceneId,
          workId: command.workId,
          retiredAt: createdAt,
        });
      }
    }
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "sceneOverride",
        ...createRecordMeta(createdAt),
        id: sceneOverrideId,
        workId: command.workId,
        documentId: command.documentId,
        operation: command.operation,
        anchorIds: [anchorId],
        baseRuleSetRevision,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
      for (const record of sceneIdentityRecords) {
        transaction.write(record);
      }
    });
    const projection = await this.#listSceneOverridesSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.sceneOverrides.find(
      (sceneOverride) => sceneOverride.sceneOverrideId === sceneOverrideId,
    );
    if (created === undefined) {
      throw new Error(`Stored SceneOverride is missing: ${sceneOverrideId}`);
    }
    return created;
  }

  async #relocateSceneSegmentSerially(
    command: RelocateSceneSegmentCommand,
  ): Promise<SceneProjectionList> {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.to > target.text.length ||
      target.text.slice(command.from, command.to) !== command.exactQuote
    ) {
      throw new Error("Relocated Scene range does not match the current manuscript");
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const settingsRows = this.#database
      .prepare(WORK_SCENE_RULE_REVISION_SQL)
      .all(command.workId);
    const settingsRow = settingsRows[0];
    if (settingsRows.length !== 1 || settingsRow === undefined) {
      throw new Error(`Work scene settings are missing: ${command.workId}`);
    }
    const baseRuleSetRevision = readRequiredInteger(
      settingsRow,
      "baseRuleSetRevision",
      "Work scene settings",
    );
    const retiredOverrideRows = new Map<
      EntityId<"SceneOverride">,
      number
    >();
    const previousBoundaryAnchorIds = [
      ...(command.previousFrom > 0 ? [command.startAnchorId] : []),
      ...(command.previousTo < target.text.length && command.endAnchorId !== null
        ? [command.endAnchorId]
        : []),
    ];
    for (const anchorId of previousBoundaryAnchorIds) {
      const rows = this.#database.prepare(`
        SELECT
          scene_override.id AS "sceneOverrideId",
          scene_override.revision AS "revision"
        FROM scene_overrides AS scene_override
        JOIN scene_override_anchors AS boundary
          ON boundary.work_id = scene_override.work_id
          AND boundary.document_id = scene_override.document_id
          AND boundary.scene_override_id = scene_override.id
        WHERE
          scene_override.work_id = ?
          AND scene_override.document_id = ?
          AND boundary.anchor_id = ?
          AND scene_override.retired_at IS NULL
      `).all(command.workId, command.documentId, anchorId);
      for (const [index, row] of rows.entries()) {
        const label = `Relocated Scene override rows[${index}]`;
        retiredOverrideRows.set(
          entityId<"SceneOverride">(
            readRequiredString(row, "sceneOverrideId", label),
          ),
          readRequiredInteger(row, "revision", label),
        );
      }
    }
    const createdAt = new Date().toISOString();
    const boundaryRecords: Poc3LedgerRecord[] = [];
    const boundaryOffsets = [...new Set([command.from, command.to])]
      .filter((offset) => offset > 0 && offset < target.text.length)
      .sort((left, right) => left - right);
    for (const offset of boundaryOffsets) {
      const sceneOverrideId = entityId<"SceneOverride">(randomUUID());
      const boundaryAnchor = createAnchorForKnownRevisionContent({
        meta: {
          id: entityId<"Anchor">(randomUUID()),
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
        },
        documentId: command.documentId,
        documentRevisionId: target.currentRevisionId,
        content: target.text,
        startOffset: offset,
        endOffset: offset,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: sceneOverrideId,
        actorRef: work.studioId,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      });
      boundaryRecords.push(
        createAnchorLedgerRecord(command.workId, boundaryAnchor),
        {
          kind: "sceneOverride",
          ...createRecordMeta(createdAt),
          id: sceneOverrideId,
          workId: command.workId,
          documentId: command.documentId,
          operation: "add",
          anchorIds: [boundaryAnchor.meta.id],
          baseRuleSetRevision,
        },
      );
    }
    const sceneId = command.sceneId ?? entityId<"Scene">(randomUUID());
    if (command.sceneId !== null) {
      const identityRows = this.#database.prepare(`
        SELECT id
        FROM scene_identities
        WHERE work_id = ? AND id = ? AND retired_at IS NULL
      `).all(command.workId, command.sceneId);
      if (identityRows.length !== 1) {
        throw new Error(`Active Scene identity is missing: ${command.sceneId}`);
      }
    }
    const retiredSegmentIds = this.#database
      .prepare(SCENE_EPISODE_SEGMENT_ROWS_SQL)
      .all(command.workId)
      .flatMap((row, index) => {
        const label = `Relocated Scene segment rows[${index}]`;
        const rowSceneId = readRequiredString(row, "sceneId", label);
        const rowDocumentId = readRequiredString(row, "documentId", label);
        if (rowSceneId !== sceneId || rowDocumentId !== command.documentId) {
          return [];
        }
        return [entityId<"EpisodeSceneSegment">(
          readRequiredString(row, "segmentId", label),
        )];
      });
    const segmentId = entityId<"EpisodeSceneSegment">(randomUUID());
    const segmentAnchor = createAnchorForKnownRevisionContent({
      meta: {
        id: entityId<"Anchor">(randomUUID()),
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      content: target.text,
      startOffset: command.from,
      endOffset: command.to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: segmentId,
      actorRef: work.studioId,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const [sceneOverrideId, expectedRevision] of retiredOverrideRows) {
        transaction.write({
          kind: "sceneOverrideRetirement",
          id: sceneOverrideId,
          workId: command.workId,
          expectedRevision,
          retiredAt: createdAt,
        });
      }
      for (const boundaryRecord of boundaryRecords) {
        transaction.write(boundaryRecord);
      }
      if (command.sceneId === null) {
        transaction.write({
          kind: "sceneIdentity",
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          id: sceneId,
          workId: command.workId,
        });
      }
      for (const retiredSegmentId of retiredSegmentIds) {
        transaction.write({
          kind: "sceneEpisodeSegmentRetirement",
          id: retiredSegmentId,
          workId: command.workId,
          retiredAt: createdAt,
        });
      }
      transaction.write(createAnchorLedgerRecord(command.workId, segmentAnchor));
      transaction.write({
        kind: "sceneEpisodeSegment",
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
        id: segmentId,
        workId: command.workId,
        sceneId,
        documentId: command.documentId,
        anchorId: segmentAnchor.meta.id,
      });
    });
    return this.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #listSceneOverridesSerially(
    command: ListSceneOverridesCommand,
  ): Promise<SceneOverrideListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredSceneOverrideRows(this.#database, command.workId);
    const grouped = new Map<
      EntityId<"SceneOverride">,
      StoredSceneOverrideRow[]
    >();
    for (const row of rows) {
      const existing = grouped.get(row.sceneOverrideId);
      if (existing === undefined) {
        grouped.set(row.sceneOverrideId, [row]);
      } else {
        existing.push(row);
      }
    }
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
    const projectedSceneOverrides = await Promise.all(
      [...grouped.values()].map(async (groupRows) => {
        const first = groupRows[0];
        if (first === undefined) {
          throw new Error("SceneOverride must contain at least one Anchor");
        }
        const target = this.#state.documentTargets.get(first.documentId);
        if (target === undefined) {
          return null;
        }
        if (target.workId !== first.workId) {
          throw new Error(
            `SceneOverride document is outside its Work: ${first.sceneOverrideId}`,
          );
        }
        const boundaries = await Promise.all(
          groupRows.map(async (row) => {
            const resolution = await resolver.execute({
              workId: row.workId,
              anchorId: row.anchorId,
              targetRevisionId: target.currentRevisionId,
            });
            const integrity =
              resolution.status === "resolved"
                ? "resolved"
                : resolution.status === "needsReview"
                  ? "needsReview"
                  : "broken";
            return {
              anchorId: row.anchorId,
              documentRevisionId: target.currentRevisionId,
              exactQuote: row.exactQuote,
              integrity,
              range:
                resolution.status === "resolved"
                  ? {
                      from: resolution.range.startOffset,
                      to: resolution.range.endOffset,
                    }
                  : null,
            } as const;
          }),
        );
        return parseSceneOverrideProjection({
          schemaVersion: 1,
          sceneOverrideId: first.sceneOverrideId,
          workId: first.workId,
          documentId: first.documentId,
          operation: first.operation,
          baseRuleSetRevision: first.baseRuleSetRevision,
          note: first.note,
          boundaries,
          createdAt: first.createdAt,
        });
      }),
    );
    const sceneOverrides = projectedSceneOverrides.filter(
      (projection): projection is SceneOverrideProjection => projection !== null,
    );
    return parseSceneOverrideListProjection({
      schemaVersion: 1,
      workId: command.workId,
      sceneOverrides,
    });
  }

  #projectSceneRuleSetRow(
    row: StoredSceneRuleSetRow,
  ): SceneRuleSetProjection {
    let boundaryRules: unknown;
    try {
      boundaryRules = JSON.parse(row.boundaryRulesJson);
    } catch {
      throw new Error(`SceneRuleSet rules are not valid JSON: ${row.sceneRuleSetId}`);
    }
    return parseSceneRuleSetProjection({
      schemaVersion: 1,
      sceneRuleSetId: row.sceneRuleSetId,
      revision: row.revision,
      workId: row.workId,
      displayName: row.displayName,
      boundaryRules,
      normalizationPolicy: row.normalizationPolicy,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  #projectSceneEventOverrideRows(
    rows: readonly StoredSceneEventOverrideRow[],
  ): readonly SceneEventOverrideProjection[] {
    return Object.freeze(rows.map((row) =>
      parseSceneEventOverrideProjection({
        schemaVersion: 1,
        ...row,
        binding: this.#projectSceneMetadataBinding(row.binding),
      })));
  }

  readActiveSceneMetadataBinding(
    workId: EntityId<"Work">,
    metadataKind: StoredSceneMetadataSourceRow["metadataKind"],
    metadataId: string,
  ): StoredSceneMetadataBindingRow | null {
    const rows = this.#database.prepare(`
      SELECT
        id AS "bindingId",
        revision,
        work_id AS "workId",
        metadata_kind AS "metadataKind",
        metadata_id AS "metadataId",
        source_scene_key AS "sourceSceneKey",
        scene_id AS "sceneId",
        status,
        proposed_scene_id AS "proposedSceneId",
        lineage_operation_id AS "lineageOperationId",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        retired_at AS "retiredAt"
      FROM scene_metadata_bindings
      WHERE
        work_id = ?
        AND metadata_kind = ?
        AND metadata_id = ?
        AND retired_at IS NULL
    `).all(workId, metadataKind, metadataId);
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`Scene metadata binding lookup is ambiguous: ${metadataId}`);
    }
    const row = rows[0] ?? {};
    const label = "Scene metadata binding lookup";
    const status = readRequiredString(row, "status", label);
    if (
      status !== "current" &&
      status !== "needs-review" &&
      status !== "detached"
    ) {
      throw new Error(`${label}.status is invalid`);
    }
    const sceneId = readNullableString(row, "sceneId", label);
    const proposedSceneId = readNullableString(row, "proposedSceneId", label);
    return Object.freeze({
      bindingId: readRequiredString(row, "bindingId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: entityId<"Work">(readRequiredString(row, "workId", label)),
      metadataKind,
      metadataId: readRequiredString(row, "metadataId", label),
      sourceSceneKey: readRequiredString(row, "sourceSceneKey", label),
      sceneId: sceneId === null ? null : entityId<"Scene">(sceneId),
      status,
      proposedSceneId: proposedSceneId === null
        ? null
        : entityId<"Scene">(proposedSceneId),
      lineageOperationId: readNullableString(row, "lineageOperationId", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
      retiredAt: null,
    });
  }

  #projectSceneMetadataBinding(
    binding: StoredSceneMetadataBindingRow,
  ): SceneMetadataBindingProjection {
    return parseSceneMetadataBindingProjection({
      schemaVersion: 1,
      sceneMetadataBindingId: binding.bindingId,
      revision: binding.revision,
      workId: binding.workId,
      metadataKind: binding.metadataKind,
      metadataId: binding.metadataId,
      sourceSceneKey: binding.sourceSceneKey,
      sceneId: binding.sceneId,
      status: binding.status === "needs-review" ? "needsReview" : binding.status,
      proposedSceneId: binding.proposedSceneId,
      lineageOperationId: binding.lineageOperationId,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
    });
  }

  prepareSceneIdentityRecords(
    scene: SceneProjection,
    commandRef: string,
    createdAt: string,
  ): Readonly<{
    sceneId: EntityId<"Scene">;
    records: readonly Poc3LedgerRecord[];
  }> {
    if (scene.sceneIdentity !== undefined) {
      return Object.freeze({
        sceneId: scene.sceneIdentity.sceneId,
        records: Object.freeze([]),
      });
    }
    if (scene.integrity !== "resolved" || scene.range === null) {
      throw new Error(`Scene identity target is unresolved: ${scene.sceneKey}`);
    }
    const target = this.#state.documentTargets.get(scene.documentId);
    if (
      target === undefined ||
      target.workId !== scene.workId ||
      target.currentRevisionId !== scene.documentRevisionId ||
      scene.range.end > target.text.length
    ) {
      throw new Error(`Scene identity target changed: ${scene.sceneKey}`);
    }
    const writingWork = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    ).getWork(scene.workId);
    if (writingWork === null) {
      throw new Error(`Unknown Work: ${scene.workId}`);
    }
    const sceneId = entityId<"Scene">(randomUUID());
    const anchor = createAnchorForKnownRevisionContent({
      meta: {
        id: entityId<"Anchor">(randomUUID()),
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      documentId: scene.documentId,
      documentRevisionId: target.currentRevisionId,
      content: target.text,
      startOffset: scene.range.start,
      endOffset: scene.range.end,
      policy: this.#options.defaults.anchorPolicy,
      commandRef,
      actorRef: writingWork.studioId,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Object.freeze({
      sceneId,
      records: Object.freeze([
        Object.freeze({
          kind: "sceneIdentity" as const,
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          id: sceneId,
          workId: scene.workId,
        }),
        createAnchorLedgerRecord(scene.workId, anchor),
        Object.freeze({
          kind: "sceneEpisodeSegment" as const,
          schemaVersion: 1,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
          id: entityId<"EpisodeSceneSegment">(randomUUID()),
          workId: scene.workId,
          sceneId,
          documentId: scene.documentId,
          anchorId: anchor.meta.id,
        }),
      ]),
    });
  }

  async #reconcileSceneMetadataBindingsSerially(
    workId: EntityId<"Work">,
  ): Promise<void> {
    const sourceRows = this.#database.prepare(SCENE_METADATA_SOURCE_ROWS_SQL)
      .all(workId, workId, workId)
      .map((row, index): StoredSceneMetadataSourceRow => {
        const label = `Scene metadata source rows[${index}]`;
        const metadataKind = readRequiredString(row, "metadataKind", label);
        if (
          metadataKind !== "annotation" &&
          metadataKind !== "event-override" &&
          metadataKind !== "music-queue"
        ) {
          throw new Error(`${label}.metadataKind is invalid`);
        }
        return Object.freeze({
          metadataKind,
          metadataId: readRequiredString(row, "metadataId", label),
          workId: entityId<"Work">(readRequiredString(row, "workId", label)),
          sourceSceneKey: readRequiredString(row, "sourceSceneKey", label),
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          retiredAt: readNullableString(row, "retiredAt", label),
        });
      });
    if (sourceRows.length === 0) return;

    const bindingRows = this.#database.prepare(SCENE_METADATA_BINDING_ROWS_SQL)
      .all(workId)
      .map((row, index): StoredSceneMetadataBindingRow => {
        const label = `Scene metadata binding rows[${index}]`;
        const metadataKind = readRequiredString(row, "metadataKind", label);
        if (
          metadataKind !== "annotation" &&
          metadataKind !== "event-override" &&
          metadataKind !== "music-queue"
        ) {
          throw new Error(`${label}.metadataKind is invalid`);
        }
        const status = readRequiredString(row, "status", label);
        if (
          status !== "current" &&
          status !== "needs-review" &&
          status !== "detached"
        ) {
          throw new Error(`${label}.status is invalid`);
        }
        const sceneId = readNullableString(row, "sceneId", label);
        const proposedSceneId = readNullableString(row, "proposedSceneId", label);
        return Object.freeze({
          bindingId: readRequiredString(row, "bindingId", label),
          revision: readRequiredInteger(row, "revision", label),
          workId: entityId<"Work">(readRequiredString(row, "workId", label)),
          metadataKind,
          metadataId: readRequiredString(row, "metadataId", label),
          sourceSceneKey: readRequiredString(row, "sourceSceneKey", label),
          sceneId: sceneId === null ? null : entityId<"Scene">(sceneId),
          status,
          proposedSceneId: proposedSceneId === null
            ? null
            : entityId<"Scene">(proposedSceneId),
          lineageOperationId: readNullableString(
            row,
            "lineageOperationId",
            label,
          ),
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          retiredAt: readNullableString(row, "retiredAt", label),
        });
      });
    const sourceKey = (
      metadataKind: StoredSceneMetadataSourceRow["metadataKind"],
      metadataId: string,
    ) => `${metadataKind}\u0000${metadataId}`;
    const bindingBySource = new Map(
      bindingRows.map((binding) => [
        sourceKey(binding.metadataKind, binding.metadataId),
        binding,
      ] as const),
    );
    const projection = await this.listSceneProjectionSerially({
      schemaVersion: 1,
      workId,
    });
    const scenesByKey = new Map<string, SceneProjection[]>();
    for (const scene of projection.scenes) {
      if (scene.integrity !== "resolved" || scene.range === null) continue;
      const matching = scenesByKey.get(scene.sceneKey) ?? [];
      matching.push(scene);
      scenesByKey.set(scene.sceneKey, matching);
    }

    const now = new Date().toISOString();
    const records: Poc3LedgerRecord[] = [];
    const preparedSceneIds = new Map<string, EntityId<"Scene">>();
    const ensureSceneId = (
      scene: SceneProjection,
      commandRef: string,
    ): EntityId<"Scene"> => {
      const prepared = preparedSceneIds.get(scene.sceneKey);
      if (prepared !== undefined) return prepared;
      const preparedIdentity = this.prepareSceneIdentityRecords(
        scene,
        commandRef,
        now,
      );
      records.push(...preparedIdentity.records);
      preparedSceneIds.set(scene.sceneKey, preparedIdentity.sceneId);
      return preparedIdentity.sceneId;
    };

    for (const source of sourceRows) {
      const key = sourceKey(source.metadataKind, source.metadataId);
      const existing = bindingBySource.get(key);
      if (existing !== undefined && existing.sourceSceneKey !== source.sourceSceneKey) {
        continue;
      }
      if (source.retiredAt !== null) {
        if (existing === undefined) {
          records.push({
            kind: "sceneMetadataBinding",
            id: `scene-binding:${source.metadataKind}:${workId}:${source.metadataId}`,
            schemaVersion: 1,
            revision: 1,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            retiredAt: source.retiredAt,
            workId,
            metadataKind: source.metadataKind,
            metadataId: source.metadataId,
            sourceSceneKey: source.sourceSceneKey,
            status: "detached",
          });
        }
        continue;
      }
      if (
        (existing !== undefined && existing.retiredAt !== null) ||
        existing?.status === "current" ||
        existing?.status === "detached" ||
        (existing?.status === "needs-review" &&
          (existing.sceneId !== null || existing.proposedSceneId !== null))
      ) {
        continue;
      }
      const matchingScenes = scenesByKey.get(source.sourceSceneKey) ?? [];
      const matchingScene = matchingScenes.length === 1
        ? matchingScenes[0]
        : undefined;
      if (matchingScene === undefined) {
        if (existing === undefined) {
          records.push({
            kind: "sceneMetadataBinding",
            id: `scene-binding:${source.metadataKind}:${workId}:${source.metadataId}`,
            schemaVersion: 1,
            revision: 1,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            workId,
            metadataKind: source.metadataKind,
            metadataId: source.metadataId,
            sourceSceneKey: source.sourceSceneKey,
            status: "needs-review",
          });
        }
        continue;
      }
      const bindingId = existing?.bindingId ??
        `scene-binding:${source.metadataKind}:${workId}:${source.metadataId}`;
      const sceneId = ensureSceneId(matchingScene, bindingId);
      if (existing === undefined) {
        records.push({
          kind: "sceneMetadataBinding",
          id: bindingId,
          schemaVersion: 1,
          revision: 1,
          createdAt: source.createdAt,
          updatedAt: now,
          workId,
          metadataKind: source.metadataKind,
          metadataId: source.metadataId,
          sourceSceneKey: source.sourceSceneKey,
          sceneId,
          status: "current",
        });
      } else {
        records.push({
          kind: "sceneMetadataBindingUpdate",
          id: existing.bindingId,
          workId,
          expectedRevision: existing.revision,
          updatedAt: now,
          sceneId,
          status: "current",
          proposedSceneId: null,
          lineageOperationId: null,
        });
      }
    }
    if (records.length === 0) return;
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) transaction.write(record);
    });
  }

  async listSceneProjectionSerially(
    command: ListSceneProjectionCommand,
  ): Promise<SceneProjectionList> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const documents = work.documents.map((document, documentIndex) => {
      const target = this.#state.documentTargets.get(document.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Scene projection document is unavailable: ${document.documentId}`,
        );
      }
      return Object.freeze({
        workId: command.workId,
        documentId: document.documentId,
        documentRevisionId: target.currentRevisionId,
        title: document.title,
        documentIndex,
        text: target.text,
      });
    });
    const storedSceneSegments: readonly StoredSceneEpisodeSegmentRow[] =
      Object.freeze(this.#database.prepare(SCENE_EPISODE_SEGMENT_ROWS_SQL)
        .all(command.workId)
        .map((row, index) => {
          const label = `Scene episode segment rows[${index}]`;
          return Object.freeze({
            segmentId: entityId<"EpisodeSceneSegment">(
              readRequiredString(row, "segmentId", label),
            ),
            sceneId: entityId<"Scene">(
              readRequiredString(row, "sceneId", label),
            ),
            workId: entityId<"Work">(
              readRequiredString(row, "workId", label),
            ),
            documentId: entityId<"Document">(
              readRequiredString(row, "documentId", label),
            ),
            anchorId: entityId<"Anchor">(
              readRequiredString(row, "anchorId", label),
            ),
          });
        }));
    const resolver = new ResolveAnchor({
      catalog: createCatalogFromStoredRows(readStoredDocumentRows(this.#database)),
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const sceneSegments: readonly SceneEpisodeSegmentProjection[] =
      Object.freeze(await Promise.all(storedSceneSegments.map(async (segment) => {
        const documentIndex = work.documents.findIndex(
          (document) => document.documentId === segment.documentId,
        );
        const document = work.documents[documentIndex];
        const target = this.#state.documentTargets.get(segment.documentId);
        if (
          documentIndex < 0 ||
          document === undefined ||
          target === undefined ||
          target.workId !== command.workId
        ) {
          throw new Error(
            `Scene episode segment is outside its Work: ${segment.segmentId}`,
          );
        }
        const resolution = await resolver.execute({
          workId: command.workId,
          anchorId: segment.anchorId,
          targetRevisionId: target.currentRevisionId,
        });
        const integrity = resolution.status === "resolved"
          ? "resolved"
          : resolution.status === "needsReview"
            ? "needsReview"
            : "broken";
        return Object.freeze({
          segmentId: segment.segmentId,
          sceneId: segment.sceneId,
          documentId: segment.documentId,
          documentRevisionId: target.currentRevisionId,
          documentTitle: document.title,
          documentIndex,
          range: resolution.status === "resolved"
            ? Object.freeze({
                start: resolution.range.startOffset,
                end: resolution.range.endOffset,
              })
            : null,
          integrity,
        });
      })));
    const [events, overrides] = await Promise.all([
      this.#events.listEventBlocksSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
      this.#listSceneOverridesSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    ]);
    return deriveSceneProjection({
      workId: command.workId,
      ruleSet: this.#projectSceneRuleSetRow(
        readStoredSceneRuleSetRow(this.#database, command.workId),
      ),
      documents,
      sceneOverrides: overrides.sceneOverrides,
      eventBlocks: events.eventBlocks,
      eventSources: events.eventSources,
      sceneEventOverrides: this.#projectSceneEventOverrideRows(
        readStoredSceneEventOverrideRows(this.#database, command.workId),
      ),
      sceneSegments,
    });
  }

  async #updateSceneRuleSetSerially(
    command: UpdateSceneRuleSetCommand,
  ): Promise<SceneProjectionList> {
    const current = readStoredSceneRuleSetRow(this.#database, command.workId);
    if (
      current.sceneRuleSetId !== command.sceneRuleSetId ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`SceneRuleSet revision conflict: ${command.sceneRuleSetId}`);
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "sceneRuleSetUpdate",
        id: command.sceneRuleSetId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        displayName: command.displayName,
        boundaryRulesJson: JSON.stringify(command.boundaryRules),
        normalizationPolicy: command.normalizationPolicy,
        enabled: command.enabled,
        updatedAt,
      });
    });
    return this.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #setSceneEventOverrideSerially(
    command: SetSceneEventOverrideCommand,
  ): Promise<SceneProjectionList> {
    const projection = await this.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const targetScene = projection.scenes.find(
      (scene) =>
        scene.sceneKey === command.sceneKey &&
        scene.integrity === "resolved" &&
        scene.range !== null,
    );
    if (targetScene === undefined) {
      throw new Error(`Unknown SceneProjection: ${command.sceneKey}`);
    }
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null || eventBlock.retiredAt !== null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    const current = readStoredSceneEventOverrideRows(
      this.#database,
      command.workId,
    ).find(
      (candidate) =>
        candidate.sceneKey === command.sceneKey &&
        candidate.eventBlockId === command.eventBlockId,
    );
    if ((current?.revision ?? null) !== command.expectedRevision) {
      throw new Error(
        `SceneEventOverride revision conflict: ${command.sceneKey}/${command.eventBlockId}`,
      );
    }
    if (current?.operation === command.operation) return projection;
    if (current === undefined && command.operation === null) return projection;

    const changedAt = new Date().toISOString();
    const currentBinding = current === undefined
      ? null
      : this.readActiveSceneMetadataBinding(
          command.workId,
          "event-override",
          current.sceneEventOverrideId,
        );
    const nextOverrideId = command.operation === null
      ? null
      : entityId<"SceneEventOverride">(randomUUID());
    const preparedIdentity = nextOverrideId === null
      ? null
      : this.prepareSceneIdentityRecords(
          targetScene,
          nextOverrideId,
          changedAt,
        );
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of preparedIdentity?.records ?? []) {
        transaction.write(record);
      }
      if (current !== undefined) {
        transaction.write({
          kind: "sceneEventOverrideRetirement",
          id: current.sceneEventOverrideId,
          workId: command.workId,
          expectedRevision: current.revision,
          retiredAt: changedAt,
        });
        if (currentBinding !== null) {
          transaction.write({
            kind: "sceneMetadataBindingRetirement",
            id: currentBinding.bindingId,
            workId: command.workId,
            expectedRevision: currentBinding.revision,
            retiredAt: changedAt,
          });
        }
      }
      if (
        command.operation !== null &&
        nextOverrideId !== null &&
        preparedIdentity !== null
      ) {
        transaction.write({
          kind: "sceneEventOverride",
          ...createRecordMeta(changedAt),
          id: nextOverrideId,
          workId: command.workId,
          sceneKey: command.sceneKey,
          eventBlockId: command.eventBlockId,
          operation: command.operation,
        });
        transaction.write({
          kind: "sceneMetadataBinding",
          id: `scene-binding:event-override:${command.workId}:${nextOverrideId}`,
          schemaVersion: 1,
          revision: 1,
          createdAt: changedAt,
          updatedAt: changedAt,
          workId: command.workId,
          metadataKind: "event-override",
          metadataId: nextOverrideId,
          sourceSceneKey: command.sceneKey,
          sceneId: preparedIdentity.sceneId,
          status: "current",
        });
      }
    });
    return this.listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #rebindSceneMetadataSerially(
    command: RebindSceneMetadataCommand,
  ): Promise<SceneMetadataBindingProjection> {
    const rows = this.#database.prepare(`
      SELECT
        id AS "bindingId", revision, work_id AS "workId",
        metadata_kind AS "metadataKind", metadata_id AS "metadataId",
        source_scene_key AS "sourceSceneKey", scene_id AS "sceneId", status,
        proposed_scene_id AS "proposedSceneId",
        lineage_operation_id AS "lineageOperationId",
        created_at AS "createdAt", updated_at AS "updatedAt",
        retired_at AS "retiredAt"
      FROM scene_metadata_bindings
      WHERE work_id = ? AND id = ? AND retired_at IS NULL
    `).all(command.workId, command.sceneMetadataBindingId);
    if (rows.length !== 1) {
      throw new Error(
        `Unknown Scene metadata binding: ${command.sceneMetadataBindingId}`,
      );
    }
    const row = rows[0] ?? {};
    const label = "Scene metadata rebind target";
    const metadataKind = readRequiredString(row, "metadataKind", label);
    if (
      metadataKind !== "annotation" &&
      metadataKind !== "event-override" &&
      metadataKind !== "music-queue"
    ) {
      throw new Error(`${label}.metadataKind is invalid`);
    }
    const status = readRequiredString(row, "status", label);
    if (
      status !== "current" &&
      status !== "needs-review" &&
      status !== "detached"
    ) {
      throw new Error(`${label}.status is invalid`);
    }
    const revision = readRequiredInteger(row, "revision", label);
    if (revision !== command.expectedBindingRevision) {
      throw new Error(
        `Scene metadata binding revision conflict: ${command.sceneMetadataBindingId}`,
      );
    }
    let targetSceneId: EntityId<"Scene"> | null = null;
    if (command.targetSceneId !== null) {
      const projection = await this.listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const matches = projection.scenes.filter(
        (scene) =>
          scene.integrity === "resolved" &&
          scene.range !== null &&
          scene.sceneIdentity?.sceneId === command.targetSceneId,
      );
      if (matches.length !== 1) {
        throw new Error(`Scene metadata target is unavailable: ${command.targetSceneId}`);
      }
      targetSceneId = command.targetSceneId;
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "sceneMetadataBindingUpdate",
        id: command.sceneMetadataBindingId,
        workId: command.workId,
        expectedRevision: revision,
        updatedAt,
        sceneId: targetSceneId,
        status: targetSceneId === null ? "detached" : "current",
        proposedSceneId: null,
        lineageOperationId: null,
      });
    });
    const updated = this.readActiveSceneMetadataBinding(
      command.workId,
      metadataKind,
      readRequiredString(row, "metadataId", label),
    );
    if (updated === null) {
      throw new Error(`Updated Scene metadata binding is missing: ${command.sceneMetadataBindingId}`);
    }
    return this.#projectSceneMetadataBinding(updated);
  }
}
