import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  WorkStructureOverviewProjection,
} from "../../application/structure/work-structure-overview";
import { entityId } from "../../domain/writing";
import { WorkStructureDialog } from "./WorkStructureDialog";

const projection: WorkStructureOverviewProjection = Object.freeze({
  schemaVersion: 1,
  workId: entityId<"Work">("work-a"),
  workTitle: "기록의 집",
  totals: Object.freeze({
    documents: 2,
    characters: 1,
    plots: 1,
    plotSources: 1,
    events: 1,
    scenes: 1,
  }),
  documents: Object.freeze([
    Object.freeze({
      documentId: entityId<"Document">("document-a"),
      label: "1화",
      eventCount: 1,
      sceneCount: 0,
      plotSourceCount: 0,
    }),
    Object.freeze({
      documentId: entityId<"Document">("document-b"),
      label: "2화",
      eventCount: 0,
      sceneCount: 1,
      plotSourceCount: 1,
    }),
  ]),
  characters: Object.freeze([
    Object.freeze({
      characterId: entityId<"Character">("character-a"),
      name: "윤서",
      role: "기록자",
    }),
  ]),
  plots: Object.freeze([
    Object.freeze({
      plotThreadId: entityId<"PlotThread">("plot-a"),
      title: "사라진 기록",
      stage: "조사",
      source: Object.freeze({
        sourceId: entityId<"PlotThreadSource">("source-a"),
        sourceDocumentId: entityId<"Document">("document-b"),
        exactText: "기록 보관함은 비어 있었다.",
        integrity: "resolved",
        range: { from: 2, to: 17 },
      }),
    }),
  ]),
  events: Object.freeze([
    Object.freeze({
      eventBlockId: entityId<"EventBlock">("event-a"),
      title: "기록 발견",
      sourceState: "resolved",
      source: Object.freeze({
        eventSourceId: entityId<"EventSource">("event-source-a"),
        documentId: entityId<"Document">("document-a"),
        exactQuote: "낡은 기록을 발견했다.",
        integrity: "resolved",
        range: { from: 4, to: 17 },
      }),
    }),
  ]),
  scenes: Object.freeze([
    Object.freeze({
      sceneKey: "scene-a",
      documentId: entityId<"Document">("document-b"),
      documentRevisionId: entityId<"DocumentRevision">("revision-b"),
      sceneIndex: 1,
      integrity: "resolved",
      source: "override",
      range: { start: 0, end: 8 },
      events: [],
    }),
  ]),
});

describe("WorkStructureDialog", () => {
  it("shows all derived Work counts and navigation surfaces in one dialog", () => {
    const markup = renderToStaticMarkup(createElement(WorkStructureDialog, {
      busy: false,
      error: null,
      loreEntryCount: 3,
      onClose: () => undefined,
      onOpenCharacter: () => undefined,
      onOpenDocument: () => undefined,
      onOpenEvent: () => undefined,
      onOpenLore: () => undefined,
      onOpenPlot: () => undefined,
      onOpenPlotSource: () => undefined,
      onOpenScene: () => undefined,
      projection,
    }));

    expect(markup).toContain("작품 구조");
    expect(markup).toContain("기록의 집");
    expect(markup).toContain('data-testid="structure-total-documents"');
    expect(markup).toContain('data-testid="structure-total-characters"');
    expect(markup).toContain('data-testid="structure-total-plots"');
    expect(markup).toContain('data-testid="structure-total-plot-sources"');
    expect(markup).toContain('data-testid="structure-total-events"');
    expect(markup).toContain('data-testid="structure-total-scenes"');
    expect(markup).toContain('data-testid="structure-total-lore-entries"');
    expect(markup).toContain("1화");
    expect(markup).toContain("윤서");
    expect(markup).toContain("사라진 기록");
    expect(markup).toContain("기록 보관함은 비어 있었다.");
    expect(markup).toContain("기록 발견");
    expect(markup).toContain("장면 1");
    expect(markup).toContain("별빛 관리 열기");
    expect(markup).not.toContain("음악");
  });
});
