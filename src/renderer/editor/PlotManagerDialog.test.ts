import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlotThreadProjection } from "../../application/plots/plot-contract";
import type { PlotThreadSourceProjection } from "../../application/plots/plot-source-contract";
import { entityId } from "../../domain/writing";
import { PlotManagerDialog } from "./PlotManagerDialog";

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

describe("PlotManagerDialog", () => {
  it("shows a Work plot list and free-text metadata fields", () => {
    const markup = renderToStaticMarkup(
      createElement(PlotManagerDialog, {
        actionState: "idle",
        canLinkSource: true,
        documentLabels: { "document-1": "3화" },
        error: null,
        onClose: () => undefined,
        onCreate: () => undefined,
        onRetire: () => undefined,
        onLinkSource: () => undefined,
        onOpenSource: () => undefined,
        onSelect: () => undefined,
        onUpdate: () => undefined,
        plots: [plot],
        sources: [source],
        selectedPlotThreadId: plot.plotThreadId,
      }),
    );

    expect(markup).toContain("플롯 관리");
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
    expect(markup).toContain('name="stage"');
    expect(markup).not.toContain('name="stage"><option');
    expect(markup).not.toContain("musicProfile");
  });

  it("offers an explicit empty create form without inventing a plot", () => {
    const markup = renderToStaticMarkup(
      createElement(PlotManagerDialog, {
        actionState: "idle",
        canLinkSource: false,
        documentLabels: {},
        error: null,
        onClose: () => undefined,
        onCreate: () => undefined,
        onRetire: () => undefined,
        onLinkSource: () => undefined,
        onOpenSource: () => undefined,
        onSelect: () => undefined,
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
});
