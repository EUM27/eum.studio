import { describe, expect, it } from "vitest";

import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  parseUnlinkPlotEventCommand,
} from "./plot-event-link-contract";

describe("plot event link contract", () => {
  it("parses both counterpart creation paths and manual link lifecycle commands", () => {
    expect(parseCreatePlotFromEventCommand({
      schemaVersion: 1,
      workId: "work-a",
      eventBlockId: "event-a",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      eventBlockId: "event-a",
    });
    expect(parseCreateEventFromPlotCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotBeatId: "plot-a",
      source: { kind: "anchorless" },
    })).toMatchObject({ source: { kind: "anchorless" } });
    expect(parseCreateEventFromPlotCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotBeatId: "plot-a",
      source: {
        kind: "exact-selection",
        documentId: "document-a",
        selection: { anchor: 8, head: 2 },
        exactQuote: "정확한 범위",
      },
    })).toMatchObject({
      source: {
        kind: "exact-selection",
        documentId: "document-a",
        selection: { anchor: 8, head: 2 },
        exactQuote: "정확한 범위",
      },
    });
    expect(parseLinkPlotEventCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotBeatId: "plot-a",
      eventBlockId: "event-a",
      role: "supporting",
    })).toMatchObject({ role: "supporting" });
    expect(parseUnlinkPlotEventCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotEventLinkId: "link-a",
      expectedRevision: 2,
    })).toMatchObject({ expectedRevision: 2 });
    expect(parseListPlotEventLinksCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
  });

  it("derives title mismatch from independent current titles", () => {
    expect(parsePlotEventLinkListProjection({
      schemaVersion: 1,
      workId: "work-a",
      links: [{
        schemaVersion: 1,
        plotEventLinkId: "link-a",
        revision: 1,
        workId: "work-a",
        plotBeatId: "plot-a",
        eventBlockId: "event-a",
        role: "primary",
        createdFrom: "event-to-plot",
        plotTitle: "독립 플롯 제목",
        eventTitle: "독립 사건 제목",
        titleMatch: "mismatched",
        plotRetiredAt: null,
        eventRetiredAt: null,
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        retiredAt: null,
      }],
    }).links[0]).toMatchObject({
      titleMatch: "mismatched",
      plotTitle: "독립 플롯 제목",
      eventTitle: "독립 사건 제목",
    });
  });
});
