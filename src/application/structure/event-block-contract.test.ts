import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
} from "./event-block-contract";

describe("event block contract", () => {
  it("preserves the exact directional selection and selected quote", () => {
    const command = parseCreateEventBlockCommand({
      schemaVersion: 1,
      workId: randomUUID(),
      documentId: randomUUID(),
      selection: { anchor: 13, head: 4 },
      exactQuote: "선택 원문",
      title: "  첫 사건  ",
      note: "메모",
    });

    expect(command).toMatchObject({
      selection: { anchor: 13, head: 4 },
      exactQuote: "선택 원문",
      title: "첫 사건",
      note: "메모",
    });
  });

  it("parses a Work-owned resolved event list", () => {
    const workId = randomUUID();
    const projection = parseEventBlockListProjection({
      schemaVersion: 1,
      workId,
      eventBlocks: [
        {
          schemaVersion: 1,
          eventBlockId: randomUUID(),
          anchorId: randomUUID(),
          workId,
          documentId: randomUUID(),
          documentRevisionId: randomUUID(),
          title: "첫 사건",
          note: "",
          exactQuote: "정확한 선택",
          integrity: "resolved",
          range: { from: 2, to: 8 },
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(projection.eventBlocks).toHaveLength(1);
    expect(projection.eventBlocks[0]).toMatchObject({
      workId,
      integrity: "resolved",
      range: { from: 2, to: 8 },
    });
  });
});
