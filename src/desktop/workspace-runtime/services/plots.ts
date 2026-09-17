import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { GetDefaultPlotBoardCommand,MovePlotPlacementCommand,PlotBoardProjection,SetPlotPlacementStoryTimeCommand } from "../../../application/plots/plot-board-contract";
import { parseGetDefaultPlotBoardCommand,parseMovePlotPlacementCommand,parsePlotBoardProjection,parseSetPlotPlacementStoryTimeCommand } from "../../../application/plots/plot-board-contract";
import type { CreatePlotThreadCommand,ListPlotThreadsCommand,PlotThreadListProjection,PlotThreadProjection,RetirePlotThreadCommand,UpdatePlotThreadCommand } from "../../../application/plots/plot-contract";
import { parseCreatePlotThreadCommand,parseListPlotThreadsCommand,parsePlotThreadListProjection,parsePlotThreadProjection,parseRetirePlotThreadCommand,parseUpdatePlotThreadCommand } from "../../../application/plots/plot-contract";
import type { CreateEventFromPlotCommand,CreatePlotFromEventCommand,LinkPlotEventCommand,ListPlotEventLinksCommand,PlotEventLinkListProjection,PlotEventLinkMutationProjection,PlotEventLinkProjection,UnlinkPlotEventCommand } from "../../../application/plots/plot-event-link-contract";
import { parseCreateEventFromPlotCommand,parseCreatePlotFromEventCommand,parseLinkPlotEventCommand,parseListPlotEventLinksCommand,parsePlotEventLinkListProjection,parsePlotEventLinkMutationProjection,parsePlotEventLinkProjection,parseUnlinkPlotEventCommand } from "../../../application/plots/plot-event-link-contract";
import type { LinkPlotThreadSourceCommand,ListPlotThreadSourcesCommand,PlotThreadSourceListProjection,PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import { parseLinkPlotThreadSourceCommand,parseListPlotThreadSourcesCommand,parsePlotThreadSourceListProjection,parsePlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import { parseEventBlockProjection } from "../../../application/structure/event-block-contract";
import { compareFractionalOrderKeys,createOrderKeyBetween,createRebalancedOrderKeys } from "../../../domain/fractional-order-key";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import { readStoredEventBlockRowById,readStoredEventSourceRows } from "../repositories/events";
import type { StoredPlotBoardRow,StoredPlotEventLinkRow,StoredPlotLaneRow,StoredPlotPlacementRow,StoredPlotThreadSourceRow } from "../repositories/plots";
import { readStoredActivePlotPlacementRows,readStoredActivePlotThreadSourceByPlot,readStoredDefaultPlotBoardRow,readStoredPlotEventLinkRowById,readStoredPlotEventLinkRows,readStoredPlotLaneRows,readStoredPlotPlacementRowById,readStoredPlotThreadRowById,readStoredPlotThreadRows,readStoredPlotThreadSourceRows } from "../repositories/plots";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { EventsService } from "./events";
import type { InfrastructureService } from "./infrastructure";

/** Owns plots commands and their existing transaction boundaries. */
export class PlotsService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #events: Pick<EventsService, "projectEventSourceRow" | "prepareEventSourceRange" | "nextEventOutlineOrderKey">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly events: Pick<EventsService, "projectEventSourceRow" | "prepareEventSourceRange" | "nextEventOutlineOrderKey">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#options = input.options;
    this.#ledger = input.ledger;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
    this.#events = input.events;
  }

  createPlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePlotThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPlotThreadSerially(command);
    });

    return execution;
  }

  listPlotThreads(value: unknown): Promise<PlotThreadListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPlotThreadsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listPlotThreadsSerially(command),
    );
  }

  getDefaultPlotBoard(value: unknown): Promise<PlotBoardProjection> {
    this.#infrastructure.assertOpen();
    const command = parseGetDefaultPlotBoardCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.getDefaultPlotBoardSerially(command),
    );
  }

  movePlotPlacement(value: unknown): Promise<PlotBoardProjection> {
    this.#infrastructure.assertOpen();
    const command = parseMovePlotPlacementCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#movePlotPlacementSerially(command);
    });

    return execution;
  }

  setPlotPlacementStoryTime(value: unknown): Promise<PlotBoardProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSetPlotPlacementStoryTimeCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#setPlotPlacementStoryTimeSerially(command);
    });

    return execution;
  }

  updatePlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePlotThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePlotThreadSerially(command);
    });

    return execution;
  }

  retirePlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetirePlotThreadCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retirePlotThreadSerially(command);
    });

    return execution;
  }

  createPlotFromEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePlotFromEventCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPlotFromEventSerially(command);
    });

    return execution;
  }

  createEventFromPlot(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateEventFromPlotCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createEventFromPlotSerially(command);
    });

    return execution;
  }

  linkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseLinkPlotEventCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#linkPlotEventSerially(command);
    });

    return execution;
  }

  unlinkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUnlinkPlotEventCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#unlinkPlotEventSerially(command);
    });

    return execution;
  }

  listPlotEventLinks(value: unknown): Promise<PlotEventLinkListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPlotEventLinksCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listPlotEventLinksSerially(command),
    );
  }

  linkPlotThreadSource(value: unknown): Promise<PlotThreadSourceProjection> {
    this.#infrastructure.assertOpen();
    const command = parseLinkPlotThreadSourceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#linkPlotThreadSourceSerially(command);
    });

    return execution;
  }

  listPlotThreadSources(
    value: unknown,
  ): Promise<PlotThreadSourceListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPlotThreadSourcesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPlotThreadSourcesSerially(command),
    );
  }

  #readDefaultPlotBoardContext(workId: EntityId<"Work">): Readonly<{
    board: StoredPlotBoardRow;
    lanes: readonly StoredPlotLaneRow[];
    defaultLane: StoredPlotLaneRow;
    placements: readonly StoredPlotPlacementRow[];
  }> {
    const board = readStoredDefaultPlotBoardRow(this.#database, workId);
    const lanes = readStoredPlotLaneRows(
      this.#database,
      workId,
      board.plotBoardId,
    );
    const defaultLanes = lanes.filter((lane) => lane.kind === "default");
    if (defaultLanes.length !== 1) {
      throw new Error(
        `Default PlotBoard must have exactly one default PlotLane: ${board.plotBoardId}`,
      );
    }
    return Object.freeze({
      board,
      lanes,
      defaultLane: defaultLanes[0] as StoredPlotLaneRow,
      placements: readStoredActivePlotPlacementRows(
        this.#database,
        workId,
        board.plotBoardId,
      ),
    });
  }

  #projectDefaultPlotBoard(workId: EntityId<"Work">): PlotBoardProjection {
    const context = this.#readDefaultPlotBoardContext(workId);
    return parsePlotBoardProjection({
      schemaVersion: 1,
      ...context.board,
      lanes: context.lanes.map((lane) => ({
        schemaVersion: 1,
        ...lane,
        placements: context.placements
          .filter((placement) => placement.plotLaneId === lane.plotLaneId)
          .sort((left, right) =>
            compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
            left.plotPlacementId.localeCompare(right.plotPlacementId))
          .map((placement) => ({
            schemaVersion: 1,
            plotPlacementId: placement.plotPlacementId,
            revision: placement.revision,
            workId: placement.workId,
            plotBoardId: placement.plotBoardId,
            plotLaneId: placement.plotLaneId,
            plotBeatId: placement.plotBeatId,
            orderKey: placement.orderKey,
            storyTime: placement.storyTime,
            storyTimeEnd: placement.storyTimeEnd,
            createdAt: placement.createdAt,
            updatedAt: placement.updatedAt,
            retiredAt: placement.retiredAt,
            plotBeat: {
              schemaVersion: 1,
              plotThreadId: placement.plotBeatId,
              revision: placement.plotRevision,
              workId: placement.workId,
              title: placement.plotTitle,
              stage: placement.plotStage,
              summary: placement.plotSummary,
              note: placement.plotNote,
              createdAt: placement.plotCreatedAt,
              updatedAt: placement.plotUpdatedAt,
              retiredAt: placement.plotRetiredAt,
            },
          })),
      })),
    });
  }

  getDefaultPlotBoardSerially(
    command: GetDefaultPlotBoardCommand,
  ): PlotBoardProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return this.#projectDefaultPlotBoard(command.workId);
  }

  #prepareDefaultPlotPlacement(workId: EntityId<"Work">): Readonly<{
    plotPlacementId: EntityId<"PlotPlacement">;
    plotBoardId: EntityId<"PlotBoard">;
    plotLaneId: EntityId<"PlotLane">;
    orderKey: string;
    expectedBoardRevision: number;
  }> {
    const context = this.#readDefaultPlotBoardContext(workId);
    const lanePlacements = context.placements
      .filter((placement) => placement.plotLaneId === context.defaultLane.plotLaneId)
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotPlacementId.localeCompare(right.plotPlacementId));
    const last = lanePlacements.at(-1) ?? null;
    return Object.freeze({
      plotPlacementId: entityId<"PlotPlacement">(randomUUID()),
      plotBoardId: context.board.plotBoardId,
      plotLaneId: context.defaultLane.plotLaneId,
      orderKey: createOrderKeyBetween(last?.orderKey ?? null, null),
      expectedBoardRevision: context.board.revision,
    });
  }

  async #movePlotPlacementSerially(
    command: MovePlotPlacementCommand,
  ): Promise<PlotBoardProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const current = readStoredPlotPlacementRowById(
      this.#database,
      command.workId,
      command.plotPlacementId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown active PlotPlacement: ${command.plotPlacementId}`);
    }
    if (current.revision !== command.expectedPlacementRevision) {
      throw new Error(`PlotPlacement revision conflict: ${command.plotPlacementId}`);
    }
    if (
      command.beforePlacementId === command.plotPlacementId ||
      command.afterPlacementId === command.plotPlacementId
    ) {
      throw new Error("PlotPlacement cannot be its own move neighbor");
    }

    const context = this.#readDefaultPlotBoardContext(command.workId);
    if (context.board.plotBoardId !== command.targetBoardId) {
      throw new Error(
        `Work/PlotBoard boundary violation: ${command.workId}/${command.targetBoardId}`,
      );
    }
    if (context.board.revision !== command.expectedBoardRevision) {
      throw new Error(`PlotBoard revision conflict: ${command.targetBoardId}`);
    }
    if (!context.lanes.some((lane) => lane.plotLaneId === command.targetLaneId)) {
      throw new Error(
        `PlotBoard/PlotLane boundary violation: ${command.targetBoardId}/${command.targetLaneId}`,
      );
    }

    const targetPlacements = context.placements
      .filter((placement) =>
        placement.plotLaneId === command.targetLaneId &&
        placement.plotPlacementId !== command.plotPlacementId)
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotPlacementId.localeCompare(right.plotPlacementId));
    const beforeIndex = command.beforePlacementId === undefined
      ? -1
      : targetPlacements.findIndex(
          (placement) => placement.plotPlacementId === command.beforePlacementId,
        );
    const afterIndex = command.afterPlacementId === undefined
      ? -1
      : targetPlacements.findIndex(
          (placement) => placement.plotPlacementId === command.afterPlacementId,
        );
    if (command.beforePlacementId !== undefined && beforeIndex < 0) {
      throw new Error(`Move predecessor is outside the target lane: ${command.beforePlacementId}`);
    }
    if (command.afterPlacementId !== undefined && afterIndex < 0) {
      throw new Error(`Move successor is outside the target lane: ${command.afterPlacementId}`);
    }
    if (
      command.beforePlacementId !== undefined &&
      command.afterPlacementId !== undefined &&
      beforeIndex + 1 !== afterIndex
    ) {
      throw new Error("Move neighbors are not adjacent in the target lane");
    }
    if (
      command.beforePlacementId !== undefined &&
      command.afterPlacementId === undefined &&
      beforeIndex !== targetPlacements.length - 1
    ) {
      throw new Error("Move predecessor is not the final target-lane placement");
    }
    if (
      command.beforePlacementId === undefined &&
      command.afterPlacementId !== undefined &&
      afterIndex !== 0
    ) {
      throw new Error("Move successor is not the first target-lane placement");
    }
    if (
      command.beforePlacementId === undefined &&
      command.afterPlacementId === undefined &&
      targetPlacements.length !== 0
    ) {
      throw new Error("Move without neighbors requires an empty target lane");
    }

    const previous = beforeIndex < 0 ? null : targetPlacements[beforeIndex] ?? null;
    const next = afterIndex < 0 ? null : targetPlacements[afterIndex] ?? null;
    const orderKey = createOrderKeyBetween(
      previous?.orderKey ?? null,
      next?.orderKey ?? null,
    );
    const updatedAt = new Date().toISOString();
    if (orderKey.length <= this.#options.defaults.plotBoard.orderKeyLengthLimit) {
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "plotPlacementMove",
          id: current.plotPlacementId,
          workId: command.workId,
          expectedRevision: command.expectedPlacementRevision,
          plotBoardId: command.targetBoardId,
          plotLaneId: command.targetLaneId,
          orderKey,
          expectedBoardRevision: command.expectedBoardRevision,
          updatedAt,
        });
      });
    } else {
      const insertIndex = command.beforePlacementId === undefined
        ? 0
        : beforeIndex + 1;
      const ordered = [...targetPlacements];
      ordered.splice(insertIndex, 0, current);
      const rebalancedKeys = createRebalancedOrderKeys(ordered.length);
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "plotPlacementRebalance",
          workId: command.workId,
          plotBoardId: command.targetBoardId,
          expectedBoardRevision: command.expectedBoardRevision,
          updatedAt,
          placements: ordered.map((placement, index) => ({
            id: placement.plotPlacementId,
            expectedRevision: placement.revision,
            plotLaneId: command.targetLaneId,
            orderKey: rebalancedKeys[index] as string,
          })),
        });
      });
    }
    return this.#projectDefaultPlotBoard(command.workId);
  }

  async #setPlotPlacementStoryTimeSerially(
    command: SetPlotPlacementStoryTimeCommand,
  ): Promise<PlotBoardProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const current = readStoredPlotPlacementRowById(
      this.#database,
      command.workId,
      command.plotPlacementId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown active PlotPlacement: ${command.plotPlacementId}`);
    }
    if (current.plotBoardId !== command.plotBoardId) {
      throw new Error(
        `PlotPlacement/PlotBoard boundary violation: ${command.plotPlacementId}/${command.plotBoardId}`,
      );
    }
    if (current.revision !== command.expectedPlacementRevision) {
      throw new Error(`PlotPlacement revision conflict: ${command.plotPlacementId}`);
    }
    const context = this.#readDefaultPlotBoardContext(command.workId);
    if (context.board.plotBoardId !== command.plotBoardId) {
      throw new Error(
        `Work/PlotBoard boundary violation: ${command.workId}/${command.plotBoardId}`,
      );
    }
    if (context.board.revision !== command.expectedBoardRevision) {
      throw new Error(`PlotBoard revision conflict: ${command.plotBoardId}`);
    }

    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotPlacementStoryTime",
        id: current.plotPlacementId,
        workId: command.workId,
        expectedRevision: command.expectedPlacementRevision,
        plotBoardId: command.plotBoardId,
        storyTime: command.storyTime,
        storyTimeEnd: command.storyTimeEnd,
        expectedBoardRevision: command.expectedBoardRevision,
        updatedAt,
      });
    });
    return this.#projectDefaultPlotBoard(command.workId);
  }

  async #createPlotThreadSerially(
    command: CreatePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const plotThreadId = entityId<"PlotThread">(randomUUID());
    const placement = this.#prepareDefaultPlotPlacement(command.workId);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotThread",
        ...createRecordMeta(createdAt),
        id: plotThreadId,
        workId: command.workId,
        title: command.title,
        stage: command.stage,
        summary: command.summary,
        note: command.note,
      });
      transaction.write({
        kind: "plotPlacement",
        ...createRecordMeta(createdAt),
        id: placement.plotPlacementId,
        workId: command.workId,
        plotBoardId: placement.plotBoardId,
        plotLaneId: placement.plotLaneId,
        plotThreadId,
        orderKey: placement.orderKey,
      });
      transaction.write({
        kind: "plotBoardTouch",
        id: placement.plotBoardId,
        workId: command.workId,
        expectedRevision: placement.expectedBoardRevision,
        updatedAt: createdAt,
      });
    });
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Stored plot is missing: ${plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  async listPlotThreadsSerially(
    command: ListPlotThreadsCommand,
  ): Promise<PlotThreadListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const plots = readStoredPlotThreadRows(
      this.#database,
      command.workId,
    ).map((plot) => parsePlotThreadProjection({
      schemaVersion: 1,
      ...plot,
    }));
    return parsePlotThreadListProjection({
      schemaVersion: 1,
      workId: command.workId,
      plots,
    });
  }

  async #updatePlotThreadSerially(
    command: UpdatePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    const current = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (current === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotThreadId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE plot_threads
      SET
        revision = revision + 1,
        updated_at = ?,
        title = ?,
        stage = ?,
        summary = ?,
        note = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.title ?? current.title,
      command.changes.stage ?? current.stage,
      command.changes.summary ?? current.summary,
      command.changes.note ?? current.note,
      command.workId,
      command.plotThreadId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Updated plot is missing: ${command.plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  async #retirePlotThreadSerially(
    command: RetirePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    const current = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (current === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Plot is already retired: ${command.plotThreadId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const retiredAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE plot_threads
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
      command.plotThreadId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Retired plot is missing: ${command.plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  #projectPlotEventLinkRow(
    row: StoredPlotEventLinkRow,
  ): PlotEventLinkProjection {
    return parsePlotEventLinkProjection({
      schemaVersion: 1,
      ...row,
      titleMatch: row.plotTitle === row.eventTitle ? "matched" : "mismatched",
    });
  }

  async #projectPlotEventLinkMutation(
    row: StoredPlotEventLinkRow,
    status: "created" | "existing" | "retired",
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      row.workId,
      row.plotBeatId,
    );
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      row.workId,
      row.eventBlockId,
    );
    if (plotBeat === null || eventBlock === null) {
      throw new Error(`PlotEventLink counterpart is missing: ${row.plotEventLinkId}`);
    }
    const eventSources = await Promise.all(
      readStoredEventSourceRows(this.#database, row.workId)
        .filter((source) => source.eventBlockId === row.eventBlockId)
        .map((source) => this.#events.projectEventSourceRow(source)),
    );
    return parsePlotEventLinkMutationProjection({
      schemaVersion: 1,
      status,
      plotBeat: parsePlotThreadProjection({ schemaVersion: 1, ...plotBeat }),
      eventBlock: parseEventBlockProjection({
        schemaVersion: 1,
        eventBlockId: eventBlock.eventBlockId,
        revision: eventBlock.revision,
        workId: eventBlock.workId,
        title: eventBlock.title,
        note: eventBlock.note,
        parentEventId: eventBlock.parentEventId,
        outlineOrderKey: eventBlock.outlineOrderKey,
        createdAt: eventBlock.createdAt,
        updatedAt: eventBlock.updatedAt,
        retiredAt: eventBlock.retiredAt,
      }),
      eventSources,
      link: this.#projectPlotEventLinkRow(row),
    });
  }

  listPlotEventLinksSerially(
    command: ListPlotEventLinksCommand,
  ): PlotEventLinkListProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePlotEventLinkListProjection({
      schemaVersion: 1,
      workId: command.workId,
      links: readStoredPlotEventLinkRows(this.#database, command.workId).map(
        (row) => this.#projectPlotEventLinkRow(row),
      ),
    });
  }

  async #createPlotFromEventSerially(
    command: CreatePlotFromEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    if (eventBlock.retiredAt !== null) {
      throw new Error(`EventBlock is retired: ${command.eventBlockId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.eventBlockId === command.eventBlockId &&
        link.role === "primary" &&
        link.plotRetiredAt === null,
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }

    const createdAt = new Date().toISOString();
    const plotBeatId = entityId<"PlotThread">(randomUUID());
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    const placement = this.#prepareDefaultPlotPlacement(command.workId);
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotThread",
        ...meta,
        id: plotBeatId,
        workId: command.workId,
        title: eventBlock.title,
        stage: "",
        summary: eventBlock.note,
        note: "",
      });
      transaction.write({
        kind: "plotEventLink",
        ...meta,
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: plotBeatId,
        eventBlockId: command.eventBlockId,
        role: "primary",
        createdFrom: "event-to-plot",
      });
      transaction.write({
        kind: "plotPlacement",
        ...meta,
        id: placement.plotPlacementId,
        workId: command.workId,
        plotBoardId: placement.plotBoardId,
        plotLaneId: placement.plotLaneId,
        plotThreadId: plotBeatId,
        orderKey: placement.orderKey,
      });
      transaction.write({
        kind: "plotBoardTouch",
        id: placement.plotBoardId,
        workId: command.workId,
        expectedRevision: placement.expectedBoardRevision,
        updatedAt: createdAt,
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #createEventFromPlotSerially(
    command: CreateEventFromPlotCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotBeatId,
    );
    if (plotBeat === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotBeatId}`,
      );
    }
    if (plotBeat.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotBeatId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.plotBeatId === command.plotBeatId && link.role === "primary",
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }

    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    const eventSourceId = command.source.kind === "exact-selection"
      ? entityId<"EventSource">(randomUUID())
      : null;
    const sourceRange = command.source.kind === "exact-selection"
      ? await this.#events.prepareEventSourceRange(
          {
            workId: command.workId,
            documentId: command.source.documentId,
            selection: command.source.selection,
            exactQuote: command.source.exactQuote,
          },
          eventBlockId,
          createdAt,
        )
      : null;
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (sourceRange !== null && eventSourceId !== null) {
        transaction.write(
          createAnchorLedgerRecord(command.workId, sourceRange.anchor),
        );
        transaction.write({
          kind: "rangeGroup",
          ...meta,
          id: sourceRange.rangeGroupId,
          workId: command.workId,
          orderedAnchorIds: [sourceRange.anchorId],
        });
      }
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: plotBeat.title,
        ...(plotBeat.summary.length === 0 ? {} : { note: plotBeat.summary }),
        outlineOrderKey: this.#events.nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
      if (sourceRange !== null && eventSourceId !== null) {
        transaction.write({
          kind: "eventSource",
          ...meta,
          id: eventSourceId,
          workId: command.workId,
          eventBlockId,
          rangeGroupId: sourceRange.rangeGroupId,
          role: "primary",
        });
      }
      transaction.write({
        kind: "plotEventLink",
        ...meta,
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: command.plotBeatId,
        eventBlockId,
        role: "primary",
        createdFrom: "plot-to-event",
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #linkPlotEventSerially(
    command: LinkPlotEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotBeatId,
    );
    if (plotBeat === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotBeatId}`,
      );
    }
    if (plotBeat.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotBeatId}`);
    }
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    if (eventBlock.retiredAt !== null) {
      throw new Error(`EventBlock is retired: ${command.eventBlockId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.plotBeatId === command.plotBeatId &&
        link.eventBlockId === command.eventBlockId,
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }
    if (
      command.role === "primary" &&
      activeLinks.some(
        (link) => link.plotBeatId === command.plotBeatId && link.role === "primary",
      )
    ) {
      throw new Error(`Plot already has a primary EventBlock: ${command.plotBeatId}`);
    }

    const createdAt = new Date().toISOString();
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotEventLink",
        ...createRecordMeta(createdAt),
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: command.plotBeatId,
        eventBlockId: command.eventBlockId,
        role: command.role,
        createdFrom: "manual-link",
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #unlinkPlotEventSerially(
    command: UnlinkPlotEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const current = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      command.plotEventLinkId,
    );
    if (
      current === null ||
      current.retiredAt !== null ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`PlotEventLink revision conflict: ${command.plotEventLinkId}`);
    }
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotEventLinkRetirement",
        id: command.plotEventLinkId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    const retired = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      command.plotEventLinkId,
    );
    if (retired === null) {
      throw new Error(`Retired PlotEventLink is missing: ${command.plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(retired, "retired");
  }

  async #projectPlotThreadSourceRows(
    rows: readonly StoredPlotThreadSourceRow[],
  ): Promise<readonly PlotThreadSourceProjection[]> {
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
        return parsePlotThreadSourceProjection({
          schemaVersion: 1,
          sourceId: row.sourceId,
          revision: row.revision,
          workId: row.workId,
          plotThreadId: row.plotThreadId,
          sourceDocumentId: row.sourceDocumentId,
          sourceDocumentRevisionId: row.sourceDocumentRevisionId,
          sourceAnchorId: row.sourceAnchorId,
          exactText: row.exactText,
          createdAt: row.createdAt,
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
      return parsePlotThreadSourceProjection({
        schemaVersion: 1,
        sourceId: row.sourceId,
        revision: row.revision,
        workId: row.workId,
        plotThreadId: row.plotThreadId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        sourceAnchorId: row.sourceAnchorId,
        exactText: row.exactText,
        createdAt: row.createdAt,
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

  async #linkPlotThreadSourceSerially(
    command: LinkPlotThreadSourceCommand,
  ): Promise<PlotThreadSourceProjection> {
    const plot = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (plot === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (plot.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotThreadId}`);
    }
    const current = readStoredActivePlotThreadSourceByPlot(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if ((current?.sourceId ?? null) !== command.expectedSourceId) {
      throw new Error(`Plot source revision conflict: ${command.plotThreadId}`);
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
      throw new Error("Plot source selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Plot source selected text does not match the current durable revision",
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
    const sourceId = entityId<"PlotThreadSource">(randomUUID());
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
      commandRef: sourceId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "plotThreadSource",
        ...createRecordMeta(createdAt),
        id: sourceId,
        workId: command.workId,
        plotThreadId: command.plotThreadId,
        expectedSourceId: command.expectedSourceId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
      });
    });
    const stored = readStoredActivePlotThreadSourceByPlot(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null || stored.sourceId !== sourceId) {
      throw new Error(`Stored plot source is missing: ${sourceId}`);
    }
    const [projection] = await this.#projectPlotThreadSourceRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored plot source could not be projected: ${sourceId}`);
    }
    return projection;
  }

  async #listPlotThreadSourcesSerially(
    command: ListPlotThreadSourcesCommand,
  ): Promise<PlotThreadSourceListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const sources = await this.#projectPlotThreadSourceRows(
      readStoredPlotThreadSourceRows(this.#database, command.workId),
    );
    return parsePlotThreadSourceListProjection({
      schemaVersion: 1,
      workId: command.workId,
      sources,
    });
  }
}

