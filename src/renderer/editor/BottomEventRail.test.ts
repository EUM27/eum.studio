import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EventRailProjection } from "../../application/structure/event-rail-projection";
import { entityId } from "../../domain/writing";
import { BottomEventRail } from "./BottomEventRail";

const documentId = entityId<"Document">("document-a");
const eventBlockId = entityId<"EventBlock">("event-a");
const source = {
  eventSourceId: entityId<"EventSource">("source-a"),
  role: "primary" as const,
  anchorId: entityId<"Anchor">("anchor-a"),
  documentId,
  documentTitle: "1화",
  documentRevisionId: entityId<"DocumentRevision">("revision-a"),
  exactQuote: "문이 닫혔다.",
  integrity: "resolved" as const,
  range: { from: 10, to: 20 },
  coordinate: { documentIndex: 0, offset: 10 },
};
const event = {
  eventBlock: {
    schemaVersion: 1 as const,
    eventBlockId,
    revision: 1,
    workId: entityId<"Work">("work-a"),
    title: "닫힌 문",
    note: "",
    parentEventId: null,
    outlineOrderKey: "0/1",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    retiredAt: null,
  },
  sourceState: "resolved" as const,
  sourceLocations: [source],
  primaryLocation: source,
  manuscriptPosition: 1,
  plots: [],
};
const projection = {
  schemaVersion: 1,
  workId: entityId<"Work">("work-a"),
  documents: [{ documentId, title: "1화", documentIndex: 0 }],
  eventBlocks: [event.eventBlock],
  eventSources: [],
  plotEventLinks: [],
  board: {},
  manuscriptEvents: [event],
  unpositionedEvents: [],
  plotCards: [],
  unplottedEvents: [],
} as unknown as EventRailProjection;

describe("BottomEventRail", () => {
  it("renders the manuscript event below the editor as an equal-width navigation card", () => {
    const markup = renderToStaticMarkup(createElement(BottomEventRail, {
      activeDocumentId: documentId,
      cursorOffset: 12,
      eventBusy: false,
      onMoveEvent: vi.fn(),
      onOpenSource: vi.fn(),
      projection,
    }));

    expect(markup).toContain('aria-label="사건 레일"');
    expect(markup).toContain('aria-label="사건 레일 접기"');
    expect(markup).toContain('aria-current="location"');
    expect(markup).toContain('data-event-block-id="event-a"');
    expect(markup).toContain('draggable="true"');
    expect(markup).toContain("닫힌 문");
    expect(markup).toContain("1화 · 1");
    expect(markup).not.toContain("플롯 순서");
  });

  it("keeps the empty event rail toggle available", () => {
    const markup = renderToStaticMarkup(createElement(BottomEventRail, {
      activeDocumentId: documentId,
      cursorOffset: 12,
      eventBusy: false,
      onMoveEvent: vi.fn(),
      onOpenSource: vi.fn(),
      projection: {
        ...projection,
        eventBlocks: [],
        manuscriptEvents: [],
      },
    }));

    expect(markup).toContain('aria-label="사건 레일 펼치기"');
    expect(markup).not.toContain("disabled");
    expect(markup).not.toContain("bottom-event-rail-content");
  });
});
