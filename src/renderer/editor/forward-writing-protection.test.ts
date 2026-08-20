import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { createForwardWritingProtection } from "./forward-writing-protection";

describe("forward writing protection", () => {
  it("allows new input anywhere while the original characters remain immutable", () => {
    const existing = "기존 원고";
    let state = EditorState.create({
      doc: existing,
      extensions: [createForwardWritingProtection(existing.length)],
    });

    state = state.update({
      changes: { from: 0, insert: "새" },
    }).state;
    expect(state.doc.toString()).toBe(`새${existing}`);

    state = state.update({
      changes: { from: 0, to: 1 },
    }).state;
    expect(state.doc.toString()).toBe(existing);

    state = state.update({
      changes: { from: 2, insert: "새 글" },
    }).state;
    expect(state.doc.toString()).toBe("기존새 글 원고");

    state = state.update({
      changes: {
        from: 2,
        to: 5,
        insert: "다시 쓴 글",
      },
    }).state;
    expect(state.doc.toString()).toBe("기존다시 쓴 글 원고");
  });

  it("blocks deletion and replacement of the original text", () => {
    const existing = "기존 원고";
    let state = EditorState.create({
      doc: existing,
      extensions: [createForwardWritingProtection(existing.length)],
    });

    state = state.update({ changes: { from: 0, to: 1 } }).state;
    expect(state.doc.toString()).toBe(existing);

    state = state.update({
      changes: { from: 2, to: 3, insert: "바꿈" },
    }).state;
    expect(state.doc.toString()).toBe(existing);
  });

  it("rejects one transaction when any changed range crosses the protected boundary", () => {
    const existing = "잠긴 원고";
    const state = EditorState.create({
      doc: `${existing}새 글`,
      extensions: [createForwardWritingProtection(existing.length)],
    });

    const next = state.update({
      changes: [
        { from: 0, to: 1, insert: "바" },
        { from: state.doc.length, insert: " 추가" },
      ],
    }).state;

    expect(next.doc.toString()).toBe(`${existing}새 글`);
  });
});
