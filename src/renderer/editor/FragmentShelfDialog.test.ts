import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  FragmentProjection,
  FragmentShelfProfile,
} from "../../application/fragments/fragment-contract";
import { entityId } from "../../domain/writing";
import { FragmentShelfDialog } from "./FragmentShelfDialog";

const profile: FragmentShelfProfile = Object.freeze({
  schemaVersion: 1,
  defaultKindId: "sentence",
  kinds: Object.freeze([
    Object.freeze({ id: "sentence", label: "문장" }),
    Object.freeze({ id: "dialogue", label: "대사" }),
  ]),
});

const fragment: FragmentProjection = Object.freeze({
  schemaVersion: 1,
  fragmentId: entityId<"Fragment">("fragment-1"),
  revision: 3,
  workId: entityId<"Work">("work-1"),
  sourceDocumentId: entityId<"Document">("document-2"),
  sourceDocumentRevisionId:
    entityId<"DocumentRevision">("revision-2"),
  sourceAnchorId: entityId<"Anchor">("anchor-1"),
  kindId: "dialogue",
  title: "남겨 둘 대사",
  pinned: true,
  useCount: 0,
  exactText: "  줄이지 않은\n정확한 선택  ",
  integrity: "resolved",
  range: Object.freeze({ from: 12, to: 29 }),
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
  retiredAt: null,
});

describe("FragmentShelfDialog", () => {
  it("shows configured kinds and explicit copy, metadata, source, and retirement controls", () => {
    const markup = renderToStaticMarkup(
      createElement(FragmentShelfDialog, {
        actionState: "idle",
        canCapture: true,
        canInsert: true,
        documentLabels: { "document-2": "2화" },
        error: null,
        fragments: [fragment],
        onCapture: () => undefined,
        onClose: () => undefined,
        onInsert: () => undefined,
        onMove: () => undefined,
        onOpenSource: () => undefined,
        onRetire: () => undefined,
        onUpdate: () => undefined,
        profile,
      }),
    );

    expect(markup).toContain("파편 서랍");
    expect(markup).toContain("선택을 복사");
    expect(markup).toContain("선택을 이동");
    expect(markup).toContain("대사");
    expect(markup).toContain("남겨 둘 대사");
    expect(markup).toContain("  줄이지 않은\n정확한 선택  ");
    expect(markup).toContain("2화");
    expect(markup).toContain("원문 열기");
    expect(markup).toContain("커서에 삽입");
    expect(markup).toContain("0회 사용");
    expect(markup).toContain("고정 해제");
    expect(markup).toContain("서랍에서 치우기");
  });

  it("does not offer a guessed source range for an unresolved fragment", () => {
    const markup = renderToStaticMarkup(
      createElement(FragmentShelfDialog, {
        actionState: "idle",
        canCapture: false,
        canInsert: false,
        documentLabels: { "document-2": "2화" },
        error: null,
        fragments: [
          Object.freeze({
            ...fragment,
            integrity: "needsReview" as const,
            range: null,
          }),
        ],
        onCapture: () => undefined,
        onClose: () => undefined,
        onInsert: () => undefined,
        onMove: () => undefined,
        onOpenSource: () => undefined,
        onRetire: () => undefined,
        onUpdate: () => undefined,
        profile,
      }),
    );

    expect(markup).toContain("원문 위치 검토 필요");
    expect(markup).toContain("disabled=\"\"");
  });
});
