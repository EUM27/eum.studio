import { randomUUID } from "node:crypto";
import { CreateAnchor } from "../../../application/anchors/create-anchor";
import { ResolveAnchor } from "../../../application/anchors/resolve-anchor";
import type { RevisionStore } from "../../../application/revisions/revision-store";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { CreateAnchorlessEventCommand,CreateEventBlockCommand,EventBlockListProjection,EventBlockProjection,EventSourceProjection,LinkEventSourceCommand,ListEventBlocksCommand,MoveEventBlockCommand,ReplaceEventSourceCommand,RetireEventSourceCommand } from "../../../application/structure/event-block-contract";
import { parseCreateAnchorlessEventCommand,parseCreateEventBlockCommand,parseEventBlockListProjection,parseEventBlockProjection,parseEventSourceProjection,parseLinkEventSourceCommand,parseListEventBlocksCommand,parseMoveEventBlockCommand,parseReplaceEventSourceCommand,parseRetireEventSourceCommand } from "../../../application/structure/event-block-contract";
import { isFractionalEventOutlineOrderKey } from "../../../application/structure/event-outline-order";
import { createOrderKeyBetween,createRebalancedOrderKeys } from "../../../domain/fractional-order-key";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { createNodeCryptoAnchorEvidenceDescriptor } from "../../../platform/anchors/node-crypto-anchor-evidence";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredEventSourceRow } from "../repositories/events";
import { readStoredEventBlockRows,readStoredEventSourceRows } from "../repositories/events";
import { createAnchorLedgerRecord,createRecordMeta } from "../repositories/record-builders";
import { createCatalogFromStoredRows,readStoredDocumentRows } from "../repositories/workspace";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns events commands and their existing transaction boundaries. */
export class EventsService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #database: NodeSqliteDatabase;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
  readonly #revisionStore: RevisionStore;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly database: NodeSqliteDatabase;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "defaults">;
    readonly revisionStore: RevisionStore;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#ledger = input.ledger;
    this.#database = input.database;
    this.#options = input.options;
    this.#revisionStore = input.revisionStore;
    this.#infrastructure = input.infrastructure;
  }

  createEventBlock(value: unknown): Promise<EventBlockProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateEventBlockCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createEventBlockSerially(command);
    });

    return execution;
  }

  createAnchorlessEvent(value: unknown): Promise<EventBlockProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreateAnchorlessEventCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createAnchorlessEventSerially(command);
    });

    return execution;
  }

  moveEventBlock(value: unknown): Promise<EventBlockListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseMoveEventBlockCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#moveEventBlockSerially(command);
    });

    return execution;
  }

  linkEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#infrastructure.assertOpen();
    const command = parseLinkEventSourceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#linkEventSourceSerially(command);
    });

    return execution;
  }

  replaceEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#infrastructure.assertOpen();
    const command = parseReplaceEventSourceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#replaceEventSourceSerially(command);
    });

    return execution;
  }

  retireEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRetireEventSourceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#retireEventSourceSerially(command);
    });

    return execution;
  }

  listEventBlocks(value: unknown): Promise<EventBlockListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListEventBlocksCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.listEventBlocksSerially(command),
    );
  }

  async #createEventBlockSerially(
    command: CreateEventBlockCommand,
  ): Promise<EventBlockProjection> {
    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.prepareEventSourceRange(
      command,
      eventBlockId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
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
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: command.title,
        ...(command.note.length === 0 ? {} : { note: command.note }),
        outlineOrderKey: this.nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: "primary",
      });
    });
    const projection = await this.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventBlocks.find(
      (eventBlock) => eventBlock.eventBlockId === eventBlockId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventBlock is missing: ${eventBlockId}`);
    }
    return created;
  }

  async #createAnchorlessEventSerially(
    command: CreateAnchorlessEventCommand,
  ): Promise<EventBlockProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: command.title,
        ...(command.note.length === 0 ? {} : { note: command.note }),
        outlineOrderKey: this.nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
    });
    const projection = await this.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventBlocks.find(
      (eventBlock) => eventBlock.eventBlockId === eventBlockId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventBlock is missing: ${eventBlockId}`);
    }
    return created;
  }

  nextEventOutlineOrderKey(
    workId: EntityId<"Work">,
    createdAt: string,
    eventBlockId: EntityId<"EventBlock">,
  ): string {
    const events = readStoredEventBlockRows(this.#database, workId);
    if (events.length === 0) return "0/1";
    if (events.every((event) =>
      isFractionalEventOutlineOrderKey(event.outlineOrderKey)
    )) {
      return createOrderKeyBetween(events.at(-1)?.outlineOrderKey ?? null, null);
    }
    return JSON.stringify([createdAt, eventBlockId]);
  }

  async #moveEventBlockSerially(
    command: MoveEventBlockCommand,
  ): Promise<EventBlockListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const events = [...readStoredEventBlockRows(this.#database, command.workId)];
    const current = events.find(
      (event) => event.eventBlockId === command.eventBlockId,
    );
    if (current === undefined || current.retiredAt !== null) {
      throw new Error(`Unknown active EventBlock: ${command.eventBlockId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`EventBlock revision conflict: ${command.eventBlockId}`);
    }
    if (
      command.beforeEventBlockId === command.eventBlockId ||
      command.afterEventBlockId === command.eventBlockId
    ) {
      throw new Error("EventBlock cannot be its own move neighbor");
    }

    const remaining = events.filter(
      (event) => event.eventBlockId !== command.eventBlockId,
    );
    const beforeIndex = command.beforeEventBlockId === undefined
      ? -1
      : remaining.findIndex(
          (event) => event.eventBlockId === command.beforeEventBlockId,
        );
    const afterIndex = command.afterEventBlockId === undefined
      ? -1
      : remaining.findIndex(
          (event) => event.eventBlockId === command.afterEventBlockId,
        );
    if (command.beforeEventBlockId !== undefined && beforeIndex < 0) {
      throw new Error(
        `Move predecessor is outside the Work: ${command.beforeEventBlockId}`,
      );
    }
    if (command.afterEventBlockId !== undefined && afterIndex < 0) {
      throw new Error(
        `Move successor is outside the Work: ${command.afterEventBlockId}`,
      );
    }
    if (
      command.beforeEventBlockId !== undefined &&
      command.afterEventBlockId !== undefined &&
      beforeIndex + 1 !== afterIndex
    ) {
      throw new Error("Move neighbors are not adjacent in the Event outline");
    }
    if (
      command.beforeEventBlockId !== undefined &&
      command.afterEventBlockId === undefined &&
      beforeIndex !== remaining.length - 1
    ) {
      throw new Error("Move predecessor is not the final EventBlock");
    }
    if (
      command.beforeEventBlockId === undefined &&
      command.afterEventBlockId !== undefined &&
      afterIndex !== 0
    ) {
      throw new Error("Move successor is not the first EventBlock");
    }
    if (
      command.beforeEventBlockId === undefined &&
      command.afterEventBlockId === undefined &&
      remaining.length !== 0
    ) {
      throw new Error("Move without neighbors requires an empty Event outline");
    }

    const insertionIndex = command.beforeEventBlockId === undefined
      ? 0
      : beforeIndex + 1;
    const ordered = [...remaining];
    ordered.splice(insertionIndex, 0, current);
    if (ordered.every((event, index) =>
      event.eventBlockId === events[index]?.eventBlockId
    )) {
      return this.listEventBlocksSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
    }

    const updatedAt = new Date().toISOString();
    const allFractional = events.every((event) =>
      isFractionalEventOutlineOrderKey(event.outlineOrderKey)
    );
    const previous = ordered[insertionIndex - 1] ?? null;
    const next = ordered[insertionIndex + 1] ?? null;
    const orderKey = allFractional
      ? createOrderKeyBetween(
          previous?.outlineOrderKey ?? null,
          next?.outlineOrderKey ?? null,
        )
      : null;
    if (
      orderKey !== null &&
      orderKey.length <= this.#options.defaults.plotBoard.orderKeyLengthLimit
    ) {
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "eventBlockOutlineMove",
          id: current.eventBlockId,
          workId: command.workId,
          expectedRevision: command.expectedRevision,
          outlineOrderKey: orderKey,
          updatedAt,
        });
      });
    } else {
      const rebalancedKeys = createRebalancedOrderKeys(ordered.length);
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "eventBlockOutlineRebalance",
          workId: command.workId,
          updatedAt,
          events: ordered.map((event, index) => ({
            id: event.eventBlockId,
            expectedRevision: event.revision,
            outlineOrderKey: rebalancedKeys[index] as string,
          })),
        });
      });
    }
    return this.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #linkEventSourceSerially(
    command: LinkEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const eventBlock = readStoredEventBlockRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.eventBlockId === command.eventBlockId);
    if (eventBlock === undefined) {
      throw new Error(`Unknown EventBlock: ${command.eventBlockId}`);
    }
    const createdAt = new Date().toISOString();
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.prepareEventSourceRange(
      command,
      eventSourceId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
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
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId: command.eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: command.role,
      });
    });
    const projection = await this.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventSources.find(
      (source) => source.eventSourceId === eventSourceId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventSource is missing: ${eventSourceId}`);
    }
    return created;
  }

  async #replaceEventSourceSerially(
    command: ReplaceEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const current = readStoredEventSourceRows(
      this.#database,
      command.workId,
    ).find((source) => source.eventSourceId === command.eventSourceId);
    if (
      current === undefined ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`EventSource revision conflict: ${command.eventSourceId}`);
    }
    const createdAt = new Date().toISOString();
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.prepareEventSourceRange(
      command,
      eventSourceId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
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
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId: current.eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: current.role,
        replacesEventSourceId: current.eventSourceId,
        expectedReplacedRevision: command.expectedRevision,
      });
    });
    const projection = await this.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventSources.find(
      (source) => source.eventSourceId === eventSourceId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventSource is missing: ${eventSourceId}`);
    }
    return created;
  }

  async #retireEventSourceSerially(
    command: RetireEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const current = readStoredEventSourceRows(
      this.#database,
      command.workId,
    ).find((source) => source.eventSourceId === command.eventSourceId);
    if (
      current === undefined ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`EventSource revision conflict: ${command.eventSourceId}`);
    }
    const currentProjection = await this.projectEventSourceRow(current);
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "eventSourceRetirement",
        id: command.eventSourceId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    return parseEventSourceProjection({
      ...currentProjection,
      revision: currentProjection.revision + 1,
      updatedAt: retiredAt,
      retiredAt,
    });
  }

  async prepareEventSourceRange(
    command: {
      readonly workId: EntityId<"Work">;
      readonly documentId: EntityId<"Document">;
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
      readonly exactQuote: string;
    },
    commandRef: EntityId<"EventBlock"> | EntityId<"EventSource">,
    createdAt: string,
  ) {
    const target = this.#state.documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("EventSource selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "EventSource selected quote does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rangeGroupId = entityId<"RangeGroup">(randomUUID());
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
      commandRef,
      actorRef: work.studioId,
    });
    return Object.freeze({ rangeGroupId, anchorId, anchor });
  }

  async listEventBlocksSerially(
    command: ListEventBlocksCommand,
  ): Promise<EventBlockListProjection> {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredEventBlockRows(this.#database, command.workId);
    const eventBlocks = Object.freeze(
      rows.map((row) => parseEventBlockProjection({
        schemaVersion: 1,
        eventBlockId: row.eventBlockId,
        revision: row.revision,
        workId: row.workId,
        title: row.title,
        note: row.note,
        parentEventId: row.parentEventId,
        outlineOrderKey: row.outlineOrderKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        retiredAt: row.retiredAt,
      })),
    );
    const eventSources = await Promise.all(
      readStoredEventSourceRows(this.#database, command.workId).map((row) =>
        this.projectEventSourceRow(row),
      ),
    );
    return parseEventBlockListProjection({
      schemaVersion: 1,
      workId: command.workId,
      eventBlocks,
      eventSources,
    });
  }

  async projectEventSourceRow(
    row: StoredEventSourceRow,
  ): Promise<EventSourceProjection> {
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
    const anchors = await Promise.all(row.anchors.map(async (anchor) => {
      const target = this.#state.documentTargets.get(anchor.documentId);
      if (target === undefined || target.workId !== row.workId) {
        throw new Error(
          `EventSource document is outside its Work: ${row.eventSourceId}`,
        );
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: anchor.anchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity =
        resolution.status === "resolved"
          ? "resolved"
          : resolution.status === "needsReview"
            ? "needsReview"
            : "broken";
      return {
        anchorId: anchor.anchorId,
        documentId: anchor.documentId,
        documentRevisionId: target.currentRevisionId,
        exactQuote: anchor.exactQuote,
        integrity,
        range:
          resolution.status === "resolved"
            ? {
                from: resolution.range.startOffset,
                to: resolution.range.endOffset,
              }
            : null,
      };
    }));
    return parseEventSourceProjection({
      schemaVersion: 1,
      eventSourceId: row.eventSourceId,
      revision: row.revision,
      workId: row.workId,
      eventBlockId: row.eventBlockId,
      rangeGroupId: row.rangeGroupId,
      role: row.role,
      anchors,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      retiredAt: row.retiredAt,
    });
  }
}

