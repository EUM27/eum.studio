import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { PlotBoardProjection } from "../plots/plot-board-contract";
import type { PlotEventLinkProjection } from "../plots/plot-event-link-contract";
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "./event-block-contract";
import {
  deriveEventRailProjection,
  parseEventRailProjection,
} from "./event-rail-projection";

const workId = entityId<"Work">("work-1");
const createdAt = "2026-08-16T00:00:00.000Z";

function eventBlock(id: string, title: string): EventBlockProjection {
  return Object.freeze({
    schemaVersion: 1,
    eventBlockId: entityId<"EventBlock">(id),
    revision: 1,
    workId,
    title,
    note: "",
    parentEventId: null,
    outlineOrderKey: id,
    createdAt,
    updatedAt: createdAt,
    retiredAt: null,
  });
}

function eventSource(input: {
  id: string;
  eventBlockId: string;
  documentId: string;
  revisionId: string;
  quote: string;
  from: number;
}): EventSourceProjection {
  return Object.freeze({
    schemaVersion: 1,
    eventSourceId: entityId<"EventSource">(input.id),
    revision: 1,
    workId,
    eventBlockId: entityId<"EventBlock">(input.eventBlockId),
    rangeGroupId: entityId<"RangeGroup">(`range-${input.id}`),
    role: "primary",
    anchors: [Object.freeze({
      anchorId: entityId<"Anchor">(`anchor-${input.id}`),
      documentId: entityId<"Document">(input.documentId),
      documentRevisionId: entityId<"DocumentRevision">(input.revisionId),
      exactQuote: input.quote,
      integrity: "resolved",
      range: Object.freeze({
        from: input.from,
        to: input.from + input.quote.length,
      }),
    })],
    createdAt,
    updatedAt: createdAt,
    retiredAt: null,
  });
}

function plotLink(input: {
  id: string;
  plotId: string;
  eventId: string;
  plotTitle: string;
  eventTitle: string;
}): PlotEventLinkProjection {
  return Object.freeze({
    schemaVersion: 1,
    plotEventLinkId: entityId<"PlotEventLink">(input.id),
    revision: 1,
    workId,
    plotBeatId: entityId<"PlotThread">(input.plotId),
    eventBlockId: entityId<"EventBlock">(input.eventId),
    role: "primary",
    createdFrom: "event-to-plot",
    plotTitle: input.plotTitle,
    eventTitle: input.eventTitle,
    titleMatch: input.plotTitle === input.eventTitle ? "matched" : "mismatched",
    plotRetiredAt: null,
    eventRetiredAt: null,
    createdAt,
    updatedAt: createdAt,
    retiredAt: null,
  });
}

const firstEvent = eventBlock("event-first", "첫 원고 사건");
const secondEvent = eventBlock("event-second", "둘째 원고 사건");
const plannedEvent = eventBlock("event-planned", "원고 미연결 사건");
const firstPlotTitle = "플롯상 첫째";
const secondPlotTitle = "플롯상 둘째";
const board: PlotBoardProjection = Object.freeze({
  schemaVersion: 1,
  plotBoardId: entityId<"PlotBoard">("board-1"),
  revision: 3,
  workId,
  title: "기본 플롯 보드",
  mode: "sequence",
  createdAt,
  updatedAt: createdAt,
  lanes: [Object.freeze({
    schemaVersion: 1,
    plotLaneId: entityId<"PlotLane">("lane-1"),
    revision: 1,
    workId,
    plotBoardId: entityId<"PlotBoard">("board-1"),
    title: "기본 흐름",
    kind: "default",
    orderKey: "0/1",
    createdAt,
    updatedAt: createdAt,
    placements: [
      Object.freeze({
        schemaVersion: 1,
        plotPlacementId: entityId<"PlotPlacement">("placement-second"),
        revision: 1,
        workId,
        plotBoardId: entityId<"PlotBoard">("board-1"),
        plotLaneId: entityId<"PlotLane">("lane-1"),
        plotBeatId: entityId<"PlotThread">("plot-second"),
        orderKey: "0/1",
        storyTime: null,
        storyTimeEnd: null,
        createdAt,
        updatedAt: createdAt,
        retiredAt: null,
        plotBeat: Object.freeze({
          schemaVersion: 1,
          plotThreadId: entityId<"PlotThread">("plot-second"),
          revision: 1,
          workId,
          title: secondPlotTitle,
          stage: "",
          summary: "",
          note: "",
          createdAt,
          updatedAt: createdAt,
          retiredAt: null,
        }),
      }),
      Object.freeze({
        schemaVersion: 1,
        plotPlacementId: entityId<"PlotPlacement">("placement-first"),
        revision: 1,
        workId,
        plotBoardId: entityId<"PlotBoard">("board-1"),
        plotLaneId: entityId<"PlotLane">("lane-1"),
        plotBeatId: entityId<"PlotThread">("plot-first"),
        orderKey: "1/1",
        storyTime: null,
        storyTimeEnd: null,
        createdAt,
        updatedAt: createdAt,
        retiredAt: null,
        plotBeat: Object.freeze({
          schemaVersion: 1,
          plotThreadId: entityId<"PlotThread">("plot-first"),
          revision: 1,
          workId,
          title: firstPlotTitle,
          stage: "",
          summary: "",
          note: "",
          createdAt,
          updatedAt: createdAt,
          retiredAt: null,
        }),
      }),
    ],
  })],
});

describe("event rail projection", () => {
  it("keeps manuscript coordinates and plot placement order independent", () => {
    const projection = deriveEventRailProjection({
      workId,
      documents: [
        Object.freeze({
          documentId: entityId<"Document">("document-1"),
          title: "1화",
          documentIndex: 0,
        }),
        Object.freeze({
          documentId: entityId<"Document">("document-2"),
          title: "2화",
          documentIndex: 1,
        }),
      ],
      eventBlocks: [secondEvent, plannedEvent, firstEvent],
      eventSources: [
        eventSource({
          id: "source-first",
          eventBlockId: firstEvent.eventBlockId,
          documentId: "document-1",
          revisionId: "revision-1",
          quote: "첫 근거",
          from: 8,
        }),
        eventSource({
          id: "source-second",
          eventBlockId: secondEvent.eventBlockId,
          documentId: "document-2",
          revisionId: "revision-2",
          quote: "둘째 근거",
          from: 2,
        }),
      ],
      plotEventLinks: [
        plotLink({
          id: "link-second",
          plotId: "plot-second",
          eventId: secondEvent.eventBlockId,
          plotTitle: secondPlotTitle,
          eventTitle: secondEvent.title,
        }),
        plotLink({
          id: "link-first",
          plotId: "plot-first",
          eventId: firstEvent.eventBlockId,
          plotTitle: firstPlotTitle,
          eventTitle: firstEvent.title,
        }),
      ],
      board,
    });

    expect(projection.manuscriptEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([firstEvent.title, secondEvent.title]);
    expect(projection.manuscriptEvents.map(
      (event) => event.primaryLocation?.coordinate,
    )).toEqual([
      { documentIndex: 0, offset: 8 },
      { documentIndex: 1, offset: 2 },
    ]);
    expect(projection.plotCards.map(
      (card) => card.placement.plotBeat.title,
    )).toEqual([secondPlotTitle, firstPlotTitle]);
    expect(projection.plotCards.map(
      (card) => card.events[0]?.manuscriptPosition,
    )).toEqual([2, 1]);
    expect(projection.unplottedEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([plannedEvent.title]);
    expect(projection.unpositionedEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([plannedEvent.title]);
    expect(projection.unplottedEvents[0]?.sourceState).toBe("unlinked");
    expect(parseEventRailProjection(projection)).toEqual(projection);
  });
});
