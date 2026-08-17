import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { deriveEventRailProjection } from "../../application/structure/event-rail-projection";
import type { EventBlockProjection } from "../../application/structure/event-block-contract";
import type { PlotBoardProjection } from "../../application/plots/plot-board-contract";
import {
  describeEventRailPositionDifference,
  EventRail,
} from "./EventRail";

const workId = entityId<"Work">("work-event-rail");
const createdAt = "2026-08-16T00:00:00.000Z";
const plannedEvent: EventBlockProjection = Object.freeze({
  schemaVersion: 1,
  eventBlockId: entityId<"EventBlock">("event-planned"),
  revision: 1,
  workId,
  title: "원고 미연결 예정 사건",
  note: "",
  parentEventId: null,
  outlineOrderKey: "0/1",
  createdAt,
  updatedAt: createdAt,
  retiredAt: null,
});
const board: PlotBoardProjection = Object.freeze({
  schemaVersion: 1,
  plotBoardId: entityId<"PlotBoard">("board-event-rail"),
  revision: 1,
  workId,
  title: "기본 플롯 보드",
  mode: "sequence",
  createdAt,
  updatedAt: createdAt,
  lanes: [],
});
const projection = deriveEventRailProjection({
  workId,
  documents: [],
  eventBlocks: [plannedEvent],
  eventSources: [],
  plotEventLinks: [],
  board,
});

function render(mode: "manuscript" | "plot") {
  return renderToStaticMarkup(createElement(EventRail, {
    projection,
    mode,
    eventBusy: false,
    plotBusy: false,
    onModeChange: vi.fn(),
    onOpenSource: vi.fn(),
    onCreatePlot: vi.fn(),
    onLinkSource: vi.fn(),
    onReplaceSource: vi.fn(),
    onRetireSource: vi.fn(),
    onMovePlacement: vi.fn(),
  }));
}

describe("EventRail", () => {
  it("exposes explicit manuscript and plot modes and planned-event plotification", () => {
    const manuscriptMarkup = render("manuscript");
    const plotMarkup = render("plot");

    expect(manuscriptMarkup).toContain("원고 순서");
    expect(manuscriptMarkup).toContain("플롯 순서");
    expect(manuscriptMarkup).toContain("작품 전체");
    expect(plotMarkup).toContain("원고 미연결 예정 사건");
    expect(plotMarkup).toContain("원고 미연결");
    expect(plotMarkup).toContain("보드에 놓기");
  });

  it("describes manuscript and plot positions without merging the orders", () => {
    expect(describeEventRailPositionDifference(2, 1)).toBe(
      "원고 2 · 플롯 1 · 플롯 -1",
    );
    expect(describeEventRailPositionDifference(1, 1)).toBe(
      "원고 1 · 플롯 1 · 순서 일치",
    );
    expect(describeEventRailPositionDifference(null, 3)).toBe(
      "원고 미연결 · 플롯 3",
    );
  });
});
