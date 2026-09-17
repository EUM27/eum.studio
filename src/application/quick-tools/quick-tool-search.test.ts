import { describe, expect, it } from "vitest";

import {
  searchQuickToolTargets,
  type QuickToolTarget,
} from "./quick-tool-search";

describe("quick tool search", () => {
  const targets: readonly QuickToolTarget[] = [
    {
      id: "work:a",
      kind: "work",
      label: "첫 작품",
      detail: "작품",
      workId: "work-a",
      documentId: null,
    },
    {
      id: "document:b",
      kind: "document",
      label: "２화 재회",
      detail: "둘째 작품",
      workId: "work-b",
      documentId: "document-b",
    },
    {
      id: "command:main",
      kind: "command",
      label: "메인으로",
      detail: "명령",
      workId: null,
      documentId: null,
    },
  ];

  it("matches NFKC labels without breaking the supplied hierarchy", () => {
    expect(
      searchQuickToolTargets({
        targets,
        query: "2화",
        activeWorkId: "work-b",
        activeDocumentId: "document-b",
      }).map((target) => target.id),
    ).toEqual(["document:b"]);
    expect(
      searchQuickToolTargets({
        targets,
        query: "",
        activeWorkId: "work-b",
        activeDocumentId: "document-b",
      }).map((target) => target.id),
    ).toEqual(["work:a", "document:b", "command:main"]);
  });

  it("finds feature aliases and matches multiple words across the label and explanation", () => {
    const feature: QuickToolTarget = {
      id: "command:fragments", kind: "command", label: "파편 서랍",
      detail: "남겨 둔 문장과 아이디어", keywords: ["보관", "메모"], workId: null, documentId: null,
    };
    const search = (query: string) => searchQuickToolTargets({
      targets: [...targets, feature], query, activeWorkId: null, activeDocumentId: null,
    });
    expect(search("메모")).toEqual([feature]);
    expect(search("보관 문장")).toEqual([feature]);
    expect(search("보관 없는항목")).toEqual([]);
    expect(feature.label).toBe("파편 서랍");
  });
});
