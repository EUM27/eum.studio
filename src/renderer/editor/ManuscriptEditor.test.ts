import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createCanonReviewContextSelection } from "./ManuscriptEditor";

describe("ManuscriptEditor canon review selection", () => {
  it("exposes the exact-selection action in the manuscript context menu", () => {
    const source = readFileSync(
      new URL("./ManuscriptContextMenu.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("별빛 변경 점검");
    expect(source).toContain("열린 연속성으로 저장");
    expect(source).toContain("연속성 점검");
    expect(source).toContain("인물 지식으로 저장");
    expect(source).toContain("canonReviewDisabled");
    expect(source).toContain("continuityDisabled");
    expect(source).toContain("characterKnowledgeDisabled");
  });

  it("captures only the exact non-empty CodeMirror selection", () => {
    expect(createCanonReviewContextSelection(
      "첫 문장과 정확한 선택 원문 뒤 문장",
      { from: 6, to: 14 },
      false,
    )).toEqual({
      from: 6,
      to: 14,
      exactText: "정확한 선택 원",
    });
  });

  it("does not create a command from an empty range or during IME composition", () => {
    expect(createCanonReviewContextSelection(
      "선택 원문",
      { from: 2, to: 2 },
      false,
    )).toBeNull();
    expect(createCanonReviewContextSelection(
      "선택 원문",
      { from: 0, to: 5 },
      true,
    )).toBeNull();
  });
});
