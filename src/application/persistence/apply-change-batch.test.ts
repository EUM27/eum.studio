import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "./change-batch";
import { applyChangeBatch } from "./apply-change-batch";

describe("applyChangeBatch", () => {
  it("applies every ordered change atomically in base UTF-16 coordinates", () => {
    const prefix = `${randomUUID()}\n`;
    const removedText = randomUUID();
    const suffix = randomUUID();
    const replacement = randomUUID();
    const appendedText = randomUUID();
    const baseText = `${prefix}${removedText}${suffix}`;
    const expectedText = `${prefix}${replacement}${suffix}${appendedText}`;
    const batch = parseChangeBatch({
      schemaVersion: 1,
      textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
      batchId: randomUUID(),
      workId: randomUUID(),
      documentId: randomUUID(),
      baseRevisionId: randomUUID(),
      sequence: randomInt(0, 32),
      createdAt: new Date().toISOString(),
      beforeTextLengthUtf16: baseText.length,
      afterTextLengthUtf16: expectedText.length,
      changes: [
        {
          fromUtf16: prefix.length,
          toUtf16: prefix.length + removedText.length,
          insertedText: replacement,
        },
        {
          fromUtf16: baseText.length,
          toUtf16: baseText.length,
          insertedText: appendedText,
        },
      ],
    });

    expect(applyChangeBatch(baseText, batch)).toBe(expectedText);
    expect(baseText).toBe(`${prefix}${removedText}${suffix}`);
  });
});
