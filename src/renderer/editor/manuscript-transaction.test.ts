import { randomInt, randomUUID } from "node:crypto";

import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { extractManuscriptTransaction } from "./manuscript-transaction";

describe("manuscript transaction extraction", () => {
  it("preserves the exact changed span and resulting selection", () => {
    const originalText = `${randomUUID()}\n${randomUUID()}`;
    const from = randomInt(0, originalText.length);
    const to = randomInt(from, originalText.length + 1);
    const insertedText = randomUUID();
    const state = EditorState.create({ doc: originalText });
    const cursor = from + insertedText.length;
    const transaction = state.update({
      changes: {
        from,
        to,
        insert: insertedText,
      },
      selection: {
        anchor: cursor,
        head: cursor,
      },
    });

    const extracted = extractManuscriptTransaction(transaction);

    expect(extracted).toEqual({
      beforeOffsetLength: originalText.length,
      afterOffsetLength:
        originalText.length - (to - from) + insertedText.length,
      changes: [
        {
          from,
          to,
          insertedText,
        },
      ],
      selection: {
        mainIndex: 0,
        ranges: [
          {
            anchor: cursor,
            head: cursor,
            from: cursor,
            to: cursor,
            empty: true,
          },
        ],
      },
    });
    expect(Object.isFrozen(extracted)).toBe(true);
    expect(Object.isFrozen(extracted.changes)).toBe(true);
    expect(Object.isFrozen(extracted.changes[0])).toBe(true);
    expect(Object.isFrozen(extracted.selection)).toBe(true);
    expect(Object.isFrozen(extracted.selection.ranges)).toBe(true);
    expect(Object.isFrozen(extracted.selection.ranges[0])).toBe(true);
    expect(extracted).not.toHaveProperty("beforeLength");
    expect(extracted).not.toHaveProperty("afterLength");
  });

  it("preserves a backward selection without materializing its text", () => {
    const firstLine = randomUUID();
    const secondLine = randomUUID();
    const originalText = `${firstLine}\n${secondLine}`;
    const from = randomInt(1, firstLine.length - 1);
    const to = randomInt(from + 1, firstLine.length);
    const anchor = to;
    const head = from;
    const state = EditorState.create({ doc: originalText });
    const transaction = state.update({
      selection: {
        anchor,
        head,
      },
    });

    const extracted = extractManuscriptTransaction(transaction);

    expect(extracted.changes).toEqual([]);
    expect(extracted.selection).toEqual({
      mainIndex: 0,
      ranges: [
        {
          anchor,
          head,
          from,
          to,
          empty: false,
        },
      ],
    });
    expect(extracted.selection.ranges[0]).not.toHaveProperty(
      "selectedText",
    );
    expect(state.sliceDoc(from, to)).toBe(originalText.slice(from, to));
  });
});
