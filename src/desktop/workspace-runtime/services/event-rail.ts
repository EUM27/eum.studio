import type { EventRailProjection,ListEventRailCommand } from "../../../application/structure/event-rail-projection";
import { deriveEventRailProjection,parseListEventRailCommand } from "../../../application/structure/event-rail-projection";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { EventsService } from "./events";
import type { InfrastructureService } from "./infrastructure";
import type { PlotsService } from "./plots";

/** Owns event rail commands and their existing transaction boundaries. */
export class EventRailService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;
  readonly #events: Pick<EventsService, "listEventBlocksSerially">;
  readonly #plots: Pick<PlotsService, "listPlotEventLinksSerially" | "getDefaultPlotBoardSerially">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
    readonly events: Pick<EventsService, "listEventBlocksSerially">;
    readonly plots: Pick<PlotsService, "listPlotEventLinksSerially" | "getDefaultPlotBoardSerially">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#infrastructure = input.infrastructure;
    this.#events = input.events;
    this.#plots = input.plots;
  }

  listEventRail(value: unknown): Promise<EventRailProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListEventRailCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listEventRailSerially(command),
    );
  }

  async #listEventRailSerially(
    command: ListEventRailCommand,
  ): Promise<EventRailProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const events = await this.#events.listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const links = this.#plots.listPlotEventLinksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    return deriveEventRailProjection({
      workId: command.workId,
      documents: work.documents.map((document, documentIndex) =>
        Object.freeze({
          documentId: document.documentId,
          title: document.title,
          documentIndex,
        }),
      ),
      eventBlocks: events.eventBlocks,
      eventSources: events.eventSources,
      plotEventLinks: links.links,
      board: this.#plots.getDefaultPlotBoardSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }
}

