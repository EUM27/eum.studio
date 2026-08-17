import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlotThreadProjection } from "../../application/plots/plot-contract";
import type { PlotBoardProjection } from "../../application/plots/plot-board-contract";
import type { PlotEventLinkProjection } from "../../application/plots/plot-event-link-contract";
import type { PlotThreadSourceProjection } from "../../application/plots/plot-source-contract";
import type { EventBlockProjection } from "../../application/structure/event-block-contract";
import { entityId } from "../../domain/writing";
import {
  createPlotStoryTimeStack,
  createPlotPlacementMoveTarget,
  createPlotStoryTimeTarget,
  normalizeStoryTimeFromClientX,
  PlotManagerDialog,
} from "./PlotManagerDialog";

const plot: PlotThreadProjection = Object.freeze({
  schemaVersion: 1,
  plotThreadId: entityId<"PlotThread">("plot-1"),
  revision: 2,
  workId: entityId<"Work">("work-1"),
  title: "사라진 기록",
  stage: "조사 중",
  summary: "기록의 행방을 추적한다.",
  note: "3화 단서 확인",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

const source: PlotThreadSourceProjection = Object.freeze({
  schemaVersion: 1,
  sourceId: entityId<"PlotThreadSource">("source-1"),
  revision: 1,
  workId: plot.workId,
  plotThreadId: plot.plotThreadId,
  sourceDocumentId: entityId<"Document">("document-1"),
  sourceDocumentRevisionId: entityId<"DocumentRevision">("revision-1"),
  sourceAnchorId: entityId<"Anchor">("anchor-1"),
  exactText: "기록 보관함은 텅 비어 있었다.",
  integrity: "resolved",
  range: { from: 4, to: 21 },
  createdAt: "2026-08-10T00:00:00.000Z",
});

const eventBlock: EventBlockProjection = Object.freeze({
  schemaVersion: 1,
  eventBlockId: entityId<"EventBlock">("event-1"),
  revision: 1,
  workId: plot.workId,
  title: "사라진 사건",
  note: "",
  parentEventId: null,
  outlineOrderKey: "event-1",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

const eventLink: PlotEventLinkProjection = Object.freeze({
  schemaVersion: 1,
  plotEventLinkId: entityId<"PlotEventLink">("plot-event-link-1"),
  revision: 1,
  workId: plot.workId,
  plotBeatId: plot.plotThreadId,
  eventBlockId: eventBlock.eventBlockId,
  role: "primary",
  createdFrom: "event-to-plot",
  plotTitle: plot.title,
  eventTitle: eventBlock.title,
  titleMatch: "mismatched",
  plotRetiredAt: null,
  eventRetiredAt: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

const plotBoard: PlotBoardProjection = Object.freeze({
  schemaVersion: 1,
  plotBoardId: entityId<"PlotBoard">("board-1"),
  revision: 2,
  workId: plot.workId,
  title: "기본 플롯 보드",
  mode: "sequence",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  lanes: [Object.freeze({
    schemaVersion: 1,
    plotLaneId: entityId<"PlotLane">("lane-1"),
    revision: 1,
    workId: plot.workId,
    plotBoardId: entityId<"PlotBoard">("board-1"),
    title: "기본 흐름",
    kind: "default",
    orderKey: "0/1",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    placements: [Object.freeze({
      schemaVersion: 1,
      plotPlacementId: entityId<"PlotPlacement">("placement-1"),
      revision: 1,
      workId: plot.workId,
      plotBoardId: entityId<"PlotBoard">("board-1"),
      plotLaneId: entityId<"PlotLane">("lane-1"),
      plotBeatId: plot.plotThreadId,
      orderKey: "0/1",
      storyTime: null,
      storyTimeEnd: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      retiredAt: null,
      plotBeat: plot,
    })],
  })],
});

describe("PlotManagerDialog", () => {
  it("shows a Work plot list and free-text metadata fields", () => {
    const markup = renderToStaticMarkup(
      createElement(PlotManagerDialog, {
        actionState: "idle",
        board: plotBoard,
        canCreateEventFromSelection: true,
        canLinkSource: true,
        documentLabels: { "document-1": "3화" },
        error: null,
        eventBlocks: [eventBlock],
        eventLinks: [eventLink],
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateEvent: () => undefined,
        onLinkEvent: () => undefined,
        onRetire: () => undefined,
        onLinkSource: () => undefined,
        onMovePlacement: () => undefined,
        onSetStoryTime: () => undefined,
        onOpenSource: () => undefined,
        onSelect: () => undefined,
        onUnlinkEvent: () => undefined,
        onUpdate: () => undefined,
        plots: [plot],
        sources: [source],
        selectedPlotThreadId: plot.plotThreadId,
      }),
    );

    expect(markup).toContain("플롯 관리");
    expect(markup).toContain("플롯 보드");
    expect(markup).toContain("순서 보드");
    expect(markup).toContain("시간 지도");
    expect(markup).toContain("기본 흐름");
    expect(markup).toContain("앞으로 이동");
    expect(markup).toContain("뒤로 이동");
    expect(markup).toContain('aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"');
    expect(markup).toContain('data-plot-placement-id="placement-1"');
    expect(markup).toContain("새 플롯");
    expect(markup).toContain("사라진 기록");
    expect(markup).toContain("조사 중");
    expect(markup).toContain("기록의 행방을 추적한다.");
    expect(markup).toContain("3화 단서 확인");
    expect(markup).toContain("플롯 치우기");
    expect(markup).toContain("원문 출처");
    expect(markup).toContain("3화");
    expect(markup).toContain("기록 보관함은 텅 비어 있었다.");
    expect(markup).toContain("현재 선택으로 교체");
    expect(markup).toContain("원문 열기");
    expect(markup).toContain("연결 사건");
    expect(markup).toContain("예정 사건 만들기");
    expect(markup).toContain("현재 선택으로 사건 만들기");
    expect(markup).toContain("사라진 사건");
    expect(markup).toContain("제목이 서로 다름");
    expect(markup).toContain("연결 해제");
    expect(markup).toContain('name="stage"');
    expect(markup).not.toContain('name="stage"><option');
    expect(markup).not.toContain("musicProfile");
  });

  it("offers an explicit empty create form without inventing a plot", () => {
    const markup = renderToStaticMarkup(
      createElement(PlotManagerDialog, {
        actionState: "idle",
        board: null,
        canCreateEventFromSelection: false,
        canLinkSource: false,
        documentLabels: {},
        error: null,
        eventBlocks: [],
        eventLinks: [],
        onClose: () => undefined,
        onCreate: () => undefined,
        onCreateEvent: () => undefined,
        onLinkEvent: () => undefined,
        onRetire: () => undefined,
        onLinkSource: () => undefined,
        onMovePlacement: () => undefined,
        onSetStoryTime: () => undefined,
        onOpenSource: () => undefined,
        onSelect: () => undefined,
        onUnlinkEvent: () => undefined,
        onUpdate: () => undefined,
        plots: [],
        sources: [],
        selectedPlotThreadId: null,
      }),
    );

    expect(markup).toContain("이 작품에 등록한 플롯이 없습니다.");
    expect(markup).toContain("플롯 제목");
    expect(markup).toContain("플롯 만들기");
    expect(markup).not.toContain("기승전결");
    expect(markup).not.toContain("발단");
  });

  it("builds front, middle, and end moves from adjacent placement ids", () => {
    const lane = plotBoard.lanes[0]!;
    const first = lane.placements[0]!;
    const second = Object.freeze({
      ...first,
      plotPlacementId: entityId<"PlotPlacement">("placement-2"),
      plotBeatId: entityId<"PlotThread">("plot-2"),
      orderKey: "1/1",
    });
    const third = Object.freeze({
      ...first,
      plotPlacementId: entityId<"PlotPlacement">("placement-3"),
      plotBeatId: entityId<"PlotThread">("plot-3"),
      orderKey: "2/1",
    });
    const placements = [first, second, third];

    expect(
      createPlotPlacementMoveTarget(
        placements,
        second.plotPlacementId,
        lane.plotLaneId,
        0,
      ),
    ).toEqual({
      targetLaneId: lane.plotLaneId,
      afterPlacementId: first.plotPlacementId,
    });
    expect(
      createPlotPlacementMoveTarget(
        placements,
        third.plotPlacementId,
        lane.plotLaneId,
        1,
      ),
    ).toEqual({
      targetLaneId: lane.plotLaneId,
      beforePlacementId: first.plotPlacementId,
      afterPlacementId: second.plotPlacementId,
    });
    expect(
      createPlotPlacementMoveTarget(
        placements,
        first.plotPlacementId,
        lane.plotLaneId,
        2,
      ),
    ).toEqual({
      targetLaneId: lane.plotLaneId,
      beforePlacementId: third.plotPlacementId,
    });
  });

  it("normalizes free horizontal drag without snapping", () => {
    expect(normalizeStoryTimeFromClientX(459.2, 100, 960)).toBeCloseTo(
      37.416666666666664,
      12,
    );
    expect(normalizeStoryTimeFromClientX(50, 100, 960)).toBe(0);
    expect(normalizeStoryTimeFromClientX(1_100, 100, 960)).toBe(100);
  });

  it("stacks overlapping story-time points and intervals without changing order", () => {
    const first = plotBoard.lanes[0]!.placements[0]!;
    const placements = [
      { ...first, storyTime: 20, storyTimeEnd: 40 },
      {
        ...first,
        plotPlacementId: entityId<"PlotPlacement">("placement-2"),
        orderKey: "1/1",
        storyTime: 30,
        storyTimeEnd: null,
      },
      {
        ...first,
        plotPlacementId: entityId<"PlotPlacement">("placement-3"),
        orderKey: "2/1",
        storyTime: 30,
        storyTimeEnd: null,
      },
      {
        ...first,
        plotPlacementId: entityId<"PlotPlacement">("placement-4"),
        orderKey: "3/1",
        storyTime: 75,
        storyTimeEnd: null,
      },
    ];

    expect(createPlotStoryTimeStack(placements).map((item) => ({
      id: item.placement.plotPlacementId,
      level: item.stackLevel,
    }))).toEqual([
      { id: "placement-1", level: 0 },
      { id: "placement-2", level: 1 },
      { id: "placement-3", level: 2 },
      { id: "placement-4", level: 0 },
    ]);
    expect(placements.map((placement) => placement.orderKey)).toEqual([
      "0/1",
      "1/1",
      "2/1",
      "3/1",
    ]);
  });

  it("moves an existing story-time interval without changing its duration", () => {
    expect(createPlotStoryTimeTarget({
      ...plotBoard.lanes[0]!.placements[0]!,
      storyTime: 20,
      storyTimeEnd: 45,
    }, 37.416666666666664)).toEqual({
      storyTime: 37.416666666666664,
      storyTimeEnd: 62.416666666666664,
    });
    expect(createPlotStoryTimeTarget({
      ...plotBoard.lanes[0]!.placements[0]!,
      storyTime: 70,
      storyTimeEnd: 95,
    }, 90)).toEqual({
      storyTime: 75,
      storyTimeEnd: 100,
    });
  });

  it("stacks story-time points that differ only by floating-point drift", () => {
    const first = {
      ...plotBoard.lanes[0]!.placements[0]!,
      storyTime: 37.416666666666664,
      storyTimeEnd: null,
    };
    const second = {
      ...first,
      plotPlacementId: entityId<"PlotPlacement">("placement-2"),
      orderKey: "1/1",
      storyTime: 37.41666666666667,
    };

    expect(createPlotStoryTimeStack([first, second]).map(
      (item) => item.stackLevel,
    )).toEqual([0, 1]);
  });

  it("stacks points whose rendered card footprints overlap", () => {
    const first = {
      ...plotBoard.lanes[0]!.placements[0]!,
      storyTime: 20,
      storyTimeEnd: null,
    };
    const second = {
      ...first,
      plotPlacementId: entityId<"PlotPlacement">("placement-2"),
      orderKey: "1/1",
      storyTime: 25,
    };

    expect(createPlotStoryTimeStack([first, second], 10).map(
      (item) => item.stackLevel,
    )).toEqual([0, 1]);
    expect(createPlotStoryTimeStack([first, second], 4).map(
      (item) => item.stackLevel,
    )).toEqual([0, 0]);
  });
});
