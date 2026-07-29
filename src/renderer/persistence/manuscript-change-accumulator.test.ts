import { randomInt, randomUUID } from "node:crypto";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { extractManuscriptTransaction } from "../editor/manuscript-transaction";
import {
  ManuscriptChangeAccumulator,
  ManuscriptChangeCompositionError,
} from "./manuscript-change-accumulator";

function applyAccumulatedChanges(
  baseText: string,
  changes: {
    readonly beforeOffsetLength: number;
    readonly changes: readonly {
      readonly fromUtf16: number;
      readonly toUtf16: number;
      readonly insertedText: string;
    }[];
  },
): string {
  const state = EditorState.create({ doc: baseText });
  return state
    .update({
      changes: changes.changes.map((change) => ({
        from: change.fromUtf16,
        to: change.toUtf16,
        insert: change.insertedText,
      })),
    })
    .state.doc.toString();
}

describe("ManuscriptChangeAccumulator", () => {
  it("composes randomized sequential transactions into one original-base change set", () => {
    const baseText = Array.from(
      { length: randomInt(4, 12) },
      () => randomUUID(),
    ).join("\n");
    let state = EditorState.create({ doc: baseText });
    const accumulator = new ManuscriptChangeAccumulator();
    const transactionCount = randomInt(16, 48);

    for (let index = 0; index < transactionCount; index += 1) {
      const from = randomInt(0, state.doc.length + 1);
      const removableLength = Math.min(
        state.doc.length - from,
        randomInt(0, Math.min(state.doc.length - from, 8) + 1),
      );
      const insertedText =
        randomInt(0, 2) === 0 ? randomUUID() : "";
      if (removableLength === 0 && insertedText.length === 0) {
        index -= 1;
        continue;
      }
      const transaction = state.update({
        changes: {
          from,
          to: from + removableLength,
          insert: insertedText,
        },
      });
      accumulator.append(
        extractManuscriptTransaction(transaction),
      );
      state = transaction.state;
    }

    const snapshot = accumulator.snapshot();
    expect(snapshot).not.toBeNull();
    if (snapshot === null) {
      return;
    }
    expect(snapshot.beforeOffsetLength).toBe(baseText.length);
    expect(snapshot.afterOffsetLength).toBe(state.doc.length);
    expect(snapshot.transactionCount).toBe(transactionCount);
    expect(applyAccumulatedChanges(baseText, snapshot)).toBe(
      state.doc.toString(),
    );
  });

  it("keeps the prior composition unchanged when the next transaction length is discontinuous", () => {
    const baseText = randomUUID();
    const firstState = EditorState.create({ doc: baseText });
    const insertedText = randomUUID();
    const first = firstState.update({
      changes: {
        from: firstState.doc.length,
        insert: insertedText,
      },
    });
    const unrelatedState = EditorState.create({
      doc: randomUUID(),
    });
    const unrelated = unrelatedState.update({
      changes: {
        from: unrelatedState.doc.length,
        insert: randomUUID(),
      },
    });
    const accumulator = new ManuscriptChangeAccumulator();
    accumulator.append(extractManuscriptTransaction(first));
    const beforeConflict = accumulator.snapshot();

    expect(() =>
      accumulator.append(
        extractManuscriptTransaction(unrelated),
      ),
    ).toThrow(ManuscriptChangeCompositionError);
    expect(accumulator.snapshot()).toEqual(beforeConflict);
  });

  it("drains an immutable snapshot and can start from the resulting document length", () => {
    const baseText = randomUUID();
    const firstState = EditorState.create({ doc: baseText });
    const first = firstState.update({
      changes: {
        from: firstState.doc.length,
        insert: randomUUID(),
      },
    });
    const accumulator = new ManuscriptChangeAccumulator();
    accumulator.append(extractManuscriptTransaction(first));

    const drained = accumulator.drain();

    expect(drained).not.toBeNull();
    expect(Object.isFrozen(drained)).toBe(true);
    expect(accumulator.snapshot()).toBeNull();
    expect(accumulator.transactionCount).toBe(0);

    const second = first.state.update({
      changes: {
        from: first.state.doc.length,
        insert: randomUUID(),
      },
    });
    accumulator.append(extractManuscriptTransaction(second));
    expect(accumulator.snapshot()).toMatchObject({
      beforeOffsetLength: first.state.doc.length,
      afterOffsetLength: second.state.doc.length,
      transactionCount: 1,
    });
  });
});
