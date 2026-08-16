import { describe, expect, it } from "vitest";

import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  parsePlotThreadSourceProjection,
} from "./plot-source-contract";

describe("plot thread source contract", () => {
  it("parses an explicit exact selection link and stale-checked replacement", () => {
    expect(parseLinkPlotThreadSourceCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedSourceId: null,
      documentId: "document-a",
      selection: { anchor: 9, head: 3 },
      exactText: "선택 원문",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedSourceId: null,
      documentId: "document-a",
      selection: { anchor: 9, head: 3 },
      exactText: "선택 원문",
    });

    expect(parseLinkPlotThreadSourceCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedSourceId: "source-a",
      documentId: "document-b",
      selection: { anchor: 0, head: 4 },
      exactText: "교체 원문",
    })).toMatchObject({ expectedSourceId: "source-a" });
  });

  it("requires a non-empty exact selection without accepting plot metadata", () => {
    expect(() => parseLinkPlotThreadSourceCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedSourceId: null,
      documentId: "document-a",
      selection: { anchor: 3, head: 3 },
      exactText: "",
    })).toThrow("selection must not be empty");

    expect(() => parseLinkPlotThreadSourceCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedSourceId: null,
      documentId: "document-a",
      selection: { anchor: 0, head: 2 },
      exactText: "원문",
      stage: "진행",
    })).toThrow("Unsupported LinkPlotThreadSourceCommand field: stage");
  });

  it("parses only resolved ranges and keeps unresolved ranges null", () => {
    expect(parsePlotThreadSourceProjection({
      schemaVersion: 1,
      sourceId: "source-a",
      revision: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      sourceDocumentId: "document-a",
      sourceDocumentRevisionId: "revision-a",
      sourceAnchorId: "anchor-a",
      exactText: "선택 원문",
      integrity: "resolved",
      range: { from: 3, to: 8 },
      createdAt: "2026-08-10T00:00:00.000Z",
    })).toMatchObject({
      sourceId: "source-a",
      integrity: "resolved",
      range: { from: 3, to: 8 },
    });

    expect(() => parsePlotThreadSourceProjection({
      schemaVersion: 1,
      sourceId: "source-a",
      revision: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      sourceDocumentId: "document-a",
      sourceDocumentRevisionId: "revision-a",
      sourceAnchorId: "anchor-a",
      exactText: "선택 원문",
      integrity: "needsReview",
      range: { from: 3, to: 8 },
      createdAt: "2026-08-10T00:00:00.000Z",
    })).toThrow("range must be null when unresolved");
  });

  it("rejects a source list containing another Work", () => {
    expect(parseListPlotThreadSourcesCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });

    expect(() => parsePlotThreadSourceListProjection({
      schemaVersion: 1,
      workId: "work-a",
      sources: [{
        schemaVersion: 1,
        sourceId: "source-b",
        revision: 1,
        workId: "work-b",
        plotThreadId: "plot-b",
        sourceDocumentId: "document-b",
        sourceDocumentRevisionId: "revision-b",
        sourceAnchorId: "anchor-b",
        exactText: "다른 작품 원문",
        integrity: "broken",
        range: null,
        createdAt: "2026-08-10T00:00:00.000Z",
      }],
    })).toThrow("outside Work work-a");
  });
});
