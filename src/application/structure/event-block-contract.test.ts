import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  deriveEventBlockSourceState,
  parseCreateAnchorlessEventCommand,
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseLinkEventSourceCommand,
  parseReplaceEventSourceCommand,
  parseRetireEventSourceCommand,
} from "./event-block-contract";

describe("event block contract", () => {
  it("preserves exact selections while allowing a separate anchorless event command", () => {
    const workId = randomUUID();
    const documentId = randomUUID();
    const exact = parseCreateEventBlockCommand({
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 13, head: 4 },
      exactQuote: "선택 원문",
      title: "  첫 사건  ",
      note: "메모",
    });
    const anchorless = parseCreateAnchorlessEventCommand({
      schemaVersion: 1,
      workId,
      title: "  예정 사건  ",
      note: "나중에 연결",
    });
    const eventBlockId = randomUUID();
    const eventSourceId = randomUUID();
    const link = parseLinkEventSourceCommand({
      schemaVersion: 1,
      workId,
      eventBlockId,
      role: "primary",
      documentId,
      selection: { anchor: 4, head: 13 },
      exactQuote: "선택 원문",
    });
    const replace = parseReplaceEventSourceCommand({
      schemaVersion: 1,
      workId,
      eventSourceId,
      expectedRevision: 1,
      documentId,
      selection: { anchor: 8, head: 2 },
      exactQuote: "새 선택",
    });
    const retire = parseRetireEventSourceCommand({
      schemaVersion: 1,
      workId,
      eventSourceId,
      expectedRevision: 2,
    });

    expect(exact).toMatchObject({
      selection: { anchor: 13, head: 4 },
      exactQuote: "선택 원문",
      title: "첫 사건",
    });
    expect(anchorless).toMatchObject({ title: "예정 사건" });
    expect(link).toMatchObject({ eventBlockId, role: "primary" });
    expect(replace).toMatchObject({ eventSourceId, expectedRevision: 1 });
    expect(retire).toMatchObject({ eventSourceId, expectedRevision: 2 });
  });

  it("parses independent EventBlock content and active EventSource evidence", () => {
    const workId = randomUUID();
    const eventBlockId = randomUUID();
    const now = new Date().toISOString();
    const projection = parseEventBlockListProjection({
      schemaVersion: 1,
      workId,
      eventBlocks: [
        {
          schemaVersion: 1,
          eventBlockId,
          revision: 1,
          workId,
          title: "첫 사건",
          note: "",
          parentEventId: null,
          outlineOrderKey: "outline-a",
          createdAt: now,
          updatedAt: now,
          retiredAt: null,
        },
      ],
      eventSources: [
        {
          schemaVersion: 1,
          eventSourceId: randomUUID(),
          revision: 1,
          workId,
          eventBlockId,
          rangeGroupId: randomUUID(),
          role: "primary",
          anchors: [{
            anchorId: randomUUID(),
            documentId: randomUUID(),
            documentRevisionId: randomUUID(),
            exactQuote: "정확한 선택",
            integrity: "resolved",
            range: { from: 2, to: 8 },
          }],
          createdAt: now,
          updatedAt: now,
          retiredAt: null,
        },
      ],
    });

    expect(projection.eventBlocks[0]).toMatchObject({
      workId,
      eventBlockId,
      outlineOrderKey: "outline-a",
    });
    expect(projection.eventSources[0]).toMatchObject({
      eventBlockId,
      role: "primary",
      anchors: [{ integrity: "resolved", range: { from: 2, to: 8 } }],
    });
    expect(
      deriveEventBlockSourceState(
        projection.eventBlocks[0]!.eventBlockId,
        projection.eventSources,
      ),
    ).toBe("resolved");
  });
});
