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
});
