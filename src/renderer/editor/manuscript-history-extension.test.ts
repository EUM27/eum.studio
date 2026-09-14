import { randomUUID } from "node:crypto";

import { isolateHistory, redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import historyFixture from "../../../tests/fixtures/editor/manuscript-history.manifest.json";
import { manuscriptHistoryExtension } from "./manuscript-history-extension";

function createHistory() {
  const initialText = randomUUID();
  let state = EditorState.create({
    doc: initialText,
    selection: EditorSelection.cursor(initialText.length),
    extensions: [manuscriptHistoryExtension],
  });
  const target = {
    get state() { return state; },
    dispatch(transaction: Transaction) { state = transaction.state; },
  };
  const edits = Array.from(
    { length: historyFixture.editCount },
    () => randomUUID().slice(0, 1),
  );
  for (const edit of edits) {
    target.dispatch(state.update({
      changes: { from: state.doc.length, insert: edit },
      selection: EditorSelection.cursor(state.doc.length + edit.length),
      annotations: [
        Transaction.userEvent.of("input.type"),
        isolateHistory.of("full"),
      ],
    }));
  }
  return { initialText, edits, target };
}

describe("manuscript history retention", () => {
  it("preserves every edit and cursor through repeated complete undo and redo", () => {
    const { initialText, edits, target } = createHistory();
    for (let round = 0; round < historyFixture.roundTrips; round += 1) {
      expect(undoDepth(target.state)).toBe(edits.length);
      for (let remaining = edits.length - 1; remaining >= 0; remaining -= 1) {
        expect(undo(target)).toBe(true);
        const expectedText = initialText + edits.slice(0, remaining).join("");
        expect(target.state.doc.toString()).toBe(expectedText);
        expect(target.state.selection.main.head).toBe(expectedText.length);
        expect(undoDepth(target.state)).toBe(remaining);
        expect(redoDepth(target.state)).toBe(edits.length - remaining);
      }
      expect(undo(target)).toBe(false);
      for (let restored = 1; restored <= edits.length; restored += 1) {
        expect(redo(target)).toBe(true);
        const expectedText = initialText + edits.slice(0, restored).join("");
        expect(target.state.doc.toString()).toBe(expectedText);
        expect(target.state.selection.main.head).toBe(expectedText.length);
        expect(redoDepth(target.state)).toBe(edits.length - restored);
        expect(undoDepth(target.state)).toBe(restored);
      }
      expect(redo(target)).toBe(false);
    }
  });

  it("preserves redo during cursor movement and replaces it only after a new edit", () => {
    const { initialText, edits, target } = createHistory();
    for (let index = 0; index < edits.length; index += 1) {
      expect(undo(target)).toBe(true);
    }
    target.dispatch(target.state.update({ selection: EditorSelection.cursor(0) }));
    expect(redoDepth(target.state)).toBe(edits.length);
    const newEdit = randomUUID();
    target.dispatch(target.state.update({
      changes: { from: 0, insert: newEdit },
      annotations: Transaction.userEvent.of("input.type"),
    }));
    expect(redoDepth(target.state)).toBe(0);
    expect(redo(target)).toBe(false);
    expect(target.state.doc.toString()).toBe(newEdit + initialText);
    expect(undo(target)).toBe(true);
    expect(target.state.doc.toString()).toBe(initialText);
    expect(redo(target)).toBe(true);
    expect(target.state.doc.toString()).toBe(newEdit + initialText);
  });
});
