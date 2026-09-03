import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ManuscriptTransaction } from "../../editor/manuscript-transaction";
import { shouldPublishWorkspaceCursorPosition } from "./useWorkspaceManuscriptActionsController";

const selection = Object.freeze({
  mainIndex: 0,
  ranges: Object.freeze([Object.freeze({
    anchor: 1,
    head: 1,
    from: 1,
    to: 1,
    empty: true,
  })]),
});

describe("manuscript input hot path", () => {
  it("starts writing activity before the durable save enters the main-process lane", () => {
    const source = readFileSync(
      new URL("./useWorkspaceManuscriptActionsController.ts", import.meta.url),
      "utf8",
    );
    const handlerStart = source.indexOf(
      "const handleManuscriptTransaction = useCallback(",
    );
    const activityStart = source.indexOf(
      "handleDocumentEdited(document);",
      handlerStart,
    );
    const durableSaveStart = source.indexOf(
      "durableSaveQueueRef.current?.record(",
      handlerStart,
    );

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(activityStart).toBeGreaterThan(handlerStart);
    expect(durableSaveStart).toBeGreaterThan(activityStart);
  });

  it("keeps text input from publishing App-level cursor state", () => {
    const transaction = Object.freeze({
      beforeOffsetLength: 0,
      afterOffsetLength: 1,
      changes: Object.freeze([Object.freeze({
        from: 0,
        to: 0,
        insertedText: "ㅎ",
      })]),
      selection,
    }) satisfies ManuscriptTransaction;

    expect(shouldPublishWorkspaceCursorPosition(transaction)).toBe(false);
  });

  it("still publishes explicit cursor-only movement", () => {
    const transaction = Object.freeze({
      beforeOffsetLength: 1,
      afterOffsetLength: 1,
      changes: Object.freeze([]),
      selection,
    }) satisfies ManuscriptTransaction;

    expect(shouldPublishWorkspaceCursorPosition(transaction)).toBe(true);
  });
});
