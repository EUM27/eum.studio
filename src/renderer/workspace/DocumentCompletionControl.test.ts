import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import { entityId } from "../../domain/writing";
import { DocumentCompletionControl } from "./DocumentCompletionControl";

function completion(
  state: DocumentCompletionProjection["state"],
): DocumentCompletionProjection {
  const incomplete = state === "incomplete";
  return {
    schemaVersion: 1,
    workId: entityId<"Work">("work-1"),
    documentId: entityId<"Document">("document-1"),
    revision: incomplete ? 0 : 1,
    completedAt: incomplete ? null : "2026-08-21T01:00:00.000Z",
    completedDate: incomplete ? null : "2026-08-21",
    completedTimeZone: incomplete ? null : "Asia/Seoul",
    completedDocumentRevisionId: incomplete
      ? null
      : entityId<"DocumentRevision">("revision-1"),
    state,
    updatedAt: incomplete ? null : "2026-08-21T01:00:00.000Z",
  };
}

describe("DocumentCompletionControl", () => {
  it("offers a single completion action while incomplete", () => {
    const markup = renderToStaticMarkup(createElement(DocumentCompletionControl, {
      busy: false,
      completion: completion("incomplete"),
      onClear: vi.fn(),
      onComplete: vi.fn(),
      onOpenCompletedRevision: vi.fn(),
    }));

    expect(markup).toContain("회차 완료");
    expect(markup).not.toContain("완료 취소");
  });

  it("shows completion as status instead of a destructive toggle", () => {
    const markup = renderToStaticMarkup(createElement(DocumentCompletionControl, {
      busy: false,
      completion: completion("current"),
      onClear: vi.fn(),
      onComplete: vi.fn(),
      onOpenCompletedRevision: vi.fn(),
    }));

    expect(markup).toContain("✓ 완료됨");
    expect(markup).toContain('aria-label="회차 완료 메뉴 열기"');
    expect(markup).not.toContain(">회차 완료 취소<");
  });

  it("keeps re-completion explicit after the manuscript changes", () => {
    const markup = renderToStaticMarkup(createElement(DocumentCompletionControl, {
      busy: false,
      completion: completion("edited-after-completion"),
      onClear: vi.fn(),
      onComplete: vi.fn(),
      onOpenCompletedRevision: vi.fn(),
    }));

    expect(markup).toContain("△ 완료 후 수정됨");
    expect(markup).toContain("다시 완료");
  });
});
