import { entityId, type EntityId } from "../../domain/writing";
import {
  parsePlotBoardProjection,
  type PlotBoardProjection,
  type PlotPlacementProjection,
} from "../plots/plot-board-contract";
import {
  parsePlotEventLinkProjection,
  type PlotEventLinkProjection,
  type PlotEventLinkRole,
} from "../plots/plot-event-link-contract";
import {
  deriveEventBlockSourceState,
  parseEventBlockProjection,
  parseEventSourceProjection,
  type EventBlockProjection,
  type EventBlockSourceState,
  type EventSourceIntegrity,
  type EventSourceProjection,
  type EventSourceRole,
} from "./event-block-contract";
import { compareEventOutlineOrderKeys } from "./event-outline-order";

export type ListEventRailCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type EventRailDocumentProjection = Readonly<{
  documentId: EntityId<"Document">;
  title: string;
  documentIndex: number;
}>;

export type EventRailManuscriptCoordinate = Readonly<{
  documentIndex: number;
  offset: number;
}>;

export type EventRailSourceLocationProjection = Readonly<{
  eventSourceId: EntityId<"EventSource">;
  role: EventSourceRole;
  anchorId: EntityId<"Anchor">;
  documentId: EntityId<"Document">;
  documentTitle: string;
  documentRevisionId: EntityId<"DocumentRevision">;
  exactQuote: string;
  integrity: EventSourceIntegrity;
  range: Readonly<{ from: number; to: number }> | null;
  coordinate: EventRailManuscriptCoordinate | null;
}>;

export type EventRailPlotReferenceProjection = Readonly<{
  plotEventLinkId: EntityId<"PlotEventLink">;
  role: PlotEventLinkRole;
  plotBeatId: EntityId<"PlotThread">;
  plotTitle: string;
  plotRetiredAt: string | null;
  plotPlacementId: EntityId<"PlotPlacement"> | null;
  plotLaneId: EntityId<"PlotLane"> | null;
  plotOrderKey: string | null;
  plotPosition: number | null;
}>;

export type EventRailEventProjection = Readonly<{
  eventBlock: EventBlockProjection;
  sourceState: EventBlockSourceState;
  sourceLocations: readonly EventRailSourceLocationProjection[];
  primaryLocation: EventRailSourceLocationProjection | null;
  manuscriptPosition: number | null;
  plots: readonly EventRailPlotReferenceProjection[];
}>;

export type EventRailPlotCardEventProjection = Readonly<{
  eventBlock: EventBlockProjection;
  role: PlotEventLinkRole;
  sourceState: EventBlockSourceState;
  primaryLocation: EventRailSourceLocationProjection | null;
  manuscriptPosition: number | null;
}>;

export type EventRailPlotCardProjection = Readonly<{
  placement: PlotPlacementProjection;
  plotPosition: number;
  events: readonly EventRailPlotCardEventProjection[];
}>;

export type EventRailProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  documents: readonly EventRailDocumentProjection[];
  eventBlocks: readonly EventBlockProjection[];
  eventSources: readonly EventSourceProjection[];
  plotEventLinks: readonly PlotEventLinkProjection[];
  board: PlotBoardProjection;
  manuscriptEvents: readonly EventRailEventProjection[];
  unpositionedEvents: readonly EventRailEventProjection[];
  plotCards: readonly EventRailPlotCardProjection[];
  unplottedEvents: readonly EventRailEventProjection[];
}>;

type EventRailProjectionInput = Readonly<{
  workId: EntityId<"Work">;
  documents: readonly EventRailDocumentProjection[];
  eventBlocks: readonly EventBlockProjection[];
  eventSources: readonly EventSourceProjection[];
  plotEventLinks: readonly PlotEventLinkProjection[];
  board: PlotBoardProjection;
}>;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
}

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readDocumentIndex(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value as number;
}

function compareLocations(
  left: EventRailSourceLocationProjection,
  right: EventRailSourceLocationProjection,
): number {
  if (left.coordinate !== null && right.coordinate === null) return -1;
  if (left.coordinate === null && right.coordinate !== null) return 1;
  if (left.coordinate !== null && right.coordinate !== null) {
    const documentDifference =
      left.coordinate.documentIndex - right.coordinate.documentIndex;
    if (documentDifference !== 0) return documentDifference;
    const offsetDifference = left.coordinate.offset - right.coordinate.offset;
    if (offsetDifference !== 0) return offsetDifference;
  }
  return left.anchorId.localeCompare(right.anchorId);
}

function compareEvents(
  left: EventRailEventProjection,
  right: EventRailEventProjection,
): number {
  if (left.primaryLocation !== null && right.primaryLocation === null) return -1;
  if (left.primaryLocation === null && right.primaryLocation !== null) return 1;
  if (left.primaryLocation !== null && right.primaryLocation !== null) {
    const locationDifference = compareLocations(
      left.primaryLocation,
      right.primaryLocation,
    );
    if (locationDifference !== 0) return locationDifference;
  }
  const outlineDifference = compareEventOutlineOrderKeys(
    left.eventBlock.outlineOrderKey,
    right.eventBlock.outlineOrderKey,
  );
  return outlineDifference !== 0
    ? outlineDifference
    : left.eventBlock.eventBlockId.localeCompare(
        right.eventBlock.eventBlockId,
      );
}

function freezeEvent(
  event: EventRailEventProjection,
  manuscriptPosition: number | null,
): EventRailEventProjection {
  return Object.freeze({ ...event, manuscriptPosition });
}

export function deriveEventRailProjection(
  input: EventRailProjectionInput,
): EventRailProjection {
  if (input.board.workId !== input.workId) {
    throw new Error("Event rail board is outside the requested Work");
  }
  const documents = Object.freeze(input.documents.map((document, index) => {
    if (document.documentIndex !== index) {
      throw new Error("Event rail document indexes must be contiguous");
    }
    return Object.freeze({ ...document });
  }));
  const documentsById = new Map(
    documents.map((document) => [document.documentId, document] as const),
  );
  const eventBlocks = Object.freeze(input.eventBlocks.map((eventBlock) => {
    if (eventBlock.workId !== input.workId) {
      throw new Error("Event rail EventBlock is outside the requested Work");
    }
    return eventBlock;
  }));
  const eventBlocksById = new Map(
    eventBlocks.map((eventBlock) => [eventBlock.eventBlockId, eventBlock] as const),
  );
  const eventSources = Object.freeze(input.eventSources.map((source) => {
    if (
      source.workId !== input.workId ||
      !eventBlocksById.has(source.eventBlockId)
    ) {
      throw new Error("Event rail EventSource is outside the requested Work");
    }
    return source;
  }));
  const plotEventLinks = Object.freeze(input.plotEventLinks.map((link) => {
    if (link.workId !== input.workId) {
      throw new Error("Event rail PlotEventLink is outside the requested Work");
    }
    return link;
  }));
  const orderedPlacements = input.board.lanes.flatMap((lane) => lane.placements);
  const placementByPlotBeatId = new Map(
    orderedPlacements.map((placement, index) => [
      placement.plotBeatId,
      Object.freeze({ placement, plotPosition: index + 1 }),
    ] as const),
  );

  const baseEvents = eventBlocks.map((eventBlock): EventRailEventProjection => {
    const sources = eventSources.filter(
      (source) => source.eventBlockId === eventBlock.eventBlockId,
    );
    const sourceLocations = Object.freeze(
      sources.flatMap((source) => source.anchors.map((anchor) => {
        const document = documentsById.get(anchor.documentId);
        if (document === undefined) {
          throw new Error(
            `EventSource anchor belongs to an unavailable document: ${anchor.documentId}`,
          );
        }
        return Object.freeze({
          eventSourceId: source.eventSourceId,
          role: source.role,
          anchorId: anchor.anchorId,
          documentId: anchor.documentId,
          documentTitle: document.title,
          documentRevisionId: anchor.documentRevisionId,
          exactQuote: anchor.exactQuote,
          integrity: anchor.integrity,
          range: anchor.range,
          coordinate: anchor.range === null
            ? null
            : Object.freeze({
                documentIndex: document.documentIndex,
                offset: anchor.range.from,
              }),
        });
      })).sort(compareLocations),
    );
    const primaryLocation =
      sourceLocations.find((location) => location.role === "primary") ??
      sourceLocations[0] ??
      null;
    const plots = Object.freeze(
      plotEventLinks
        .filter((link) => link.eventBlockId === eventBlock.eventBlockId)
        .map((link): EventRailPlotReferenceProjection => {
          const placed = placementByPlotBeatId.get(link.plotBeatId);
          return Object.freeze({
            plotEventLinkId: link.plotEventLinkId,
            role: link.role,
            plotBeatId: link.plotBeatId,
            plotTitle: link.plotTitle,
            plotRetiredAt: link.plotRetiredAt,
            plotPlacementId: placed?.placement.plotPlacementId ?? null,
            plotLaneId: placed?.placement.plotLaneId ?? null,
            plotOrderKey: placed?.placement.orderKey ?? null,
            plotPosition: placed?.plotPosition ?? null,
          });
        })
        .sort((left, right) => {
          if (left.plotPosition !== null && right.plotPosition === null) return -1;
          if (left.plotPosition === null && right.plotPosition !== null) return 1;
          if (left.plotPosition !== null && right.plotPosition !== null) {
            const difference = left.plotPosition - right.plotPosition;
            if (difference !== 0) return difference;
          }
          return left.plotEventLinkId.localeCompare(right.plotEventLinkId);
        }),
    );
    return Object.freeze({
      eventBlock,
      sourceState: deriveEventBlockSourceState(
        eventBlock.eventBlockId,
        eventSources,
      ),
      sourceLocations,
      primaryLocation,
      manuscriptPosition: null,
      plots,
    });
  });
  const orderedManuscriptEvents = baseEvents
    .filter((event) => event.sourceLocations.length > 0)
    .sort(compareEvents)
    .map((event, index) => freezeEvent(event, index + 1));
  const manuscriptPositionByEventId = new Map(
    orderedManuscriptEvents.map((event) => [
      event.eventBlock.eventBlockId,
      event.manuscriptPosition,
    ] as const),
  );
  const events = baseEvents.map((event) => freezeEvent(
    event,
    manuscriptPositionByEventId.get(event.eventBlock.eventBlockId) ?? null,
  ));
  const eventsById = new Map(
    events.map((event) => [event.eventBlock.eventBlockId, event] as const),
  );
  const manuscriptEvents = Object.freeze(
    orderedManuscriptEvents.map((ordered) => eventsById.get(
      ordered.eventBlock.eventBlockId,
    )!),
  );
  const unpositionedEvents = Object.freeze(events.filter(
    (event) => event.sourceLocations.length === 0,
  ));
  const plotCards = Object.freeze(
    orderedPlacements.map((placement, index): EventRailPlotCardProjection => {
      const cardEvents = Object.freeze(
        plotEventLinks
          .filter((link) => link.plotBeatId === placement.plotBeatId)
          .flatMap((link) => {
            const event = eventsById.get(link.eventBlockId);
            return event === undefined
              ? []
              : [Object.freeze({
                  eventBlock: event.eventBlock,
                  role: link.role,
                  sourceState: event.sourceState,
                  primaryLocation: event.primaryLocation,
                  manuscriptPosition: event.manuscriptPosition,
                })];
          }),
      );
      return Object.freeze({
        placement,
        plotPosition: index + 1,
        events: cardEvents,
      });
    }),
  );
  const unplottedEvents = Object.freeze(events.filter((event) =>
    !event.plots.some((plot) => plot.plotPlacementId !== null),
  ));
  return Object.freeze({
    schemaVersion: 1,
    workId: input.workId,
    documents,
    eventBlocks,
    eventSources,
    plotEventLinks,
    board: input.board,
    manuscriptEvents,
    unpositionedEvents,
    plotCards,
    unplottedEvents,
  });
}

export function parseListEventRailCommand(
  value: unknown,
): ListEventRailCommand {
  const label = "ListEventRailCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">(readNonEmptyString(input, "workId", label)),
  });
}

function parseEventRailDocumentProjection(
  value: unknown,
  index: number,
): EventRailDocumentProjection {
  const label = `EventRailProjection.documents[${index}]`;
  const input = readRecord(value, label);
  assertExactFields(input, ["documentId", "title", "documentIndex"], label);
  return Object.freeze({
    documentId: entityId<"Document">(
      readNonEmptyString(input, "documentId", label),
    ),
    title: readNonEmptyString(input, "title", label),
    documentIndex: readDocumentIndex(input, "documentIndex", label),
  });
}

export function parseEventRailProjection(value: unknown): EventRailProjection {
  const label = "EventRailProjection";
  const input = readRecord(value, label);
  assertExactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documents",
      "eventBlocks",
      "eventSources",
      "plotEventLinks",
      "board",
      "manuscriptEvents",
      "unpositionedEvents",
      "plotCards",
      "unplottedEvents",
    ],
    label,
  );
  readSchemaVersion(input, label);
  if (
    !Array.isArray(input.documents) ||
    !Array.isArray(input.eventBlocks) ||
    !Array.isArray(input.eventSources) ||
    !Array.isArray(input.plotEventLinks) ||
    !Array.isArray(input.manuscriptEvents) ||
    !Array.isArray(input.unpositionedEvents) ||
    !Array.isArray(input.plotCards) ||
    !Array.isArray(input.unplottedEvents)
  ) {
    throw new Error(`${label} list fields must be arrays`);
  }
  return deriveEventRailProjection({
    workId: entityId<"Work">(readNonEmptyString(input, "workId", label)),
    documents: input.documents.map(parseEventRailDocumentProjection),
    eventBlocks: input.eventBlocks.map(parseEventBlockProjection),
    eventSources: input.eventSources.map(parseEventSourceProjection),
    plotEventLinks: input.plotEventLinks.map(parsePlotEventLinkProjection),
    board: parsePlotBoardProjection(input.board),
  });
}
