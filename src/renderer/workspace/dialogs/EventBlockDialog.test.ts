import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../../domain/writing";
import {
  EventBlockDialog,
  type PendingEventDraft,
} from "./EventBlockDialog";

describe("EventBlockDialog", () => {
  it("keeps the exact-selection dialog contract", () => {
    const draft: PendingEventDraft = Object.freeze({
      kind: "selection",
      workId: entityId<"Work">("work-1"),
      documentId: entityId<"Document">("document-1"),
      selection: Object.freeze({ anchor: 12, head: 3 }),
      exactQuote: "선택한 원문 근거",
    });
    const markup = renderToStaticMarkup(createElement(EventBlockDialog, {
      draft,
      error: "사건 등록 오류",
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      submitting: false,
    }));

    expect(markup).toContain('class="dialog-backdrop"');
    expect(markup).toContain('aria-labelledby="create-event-heading"');
    expect(markup).toContain(
      'class="create-work-dialog event-block-dialog"',
    );
    expect(markup).toContain("EXACT RANGE");
    expect(markup).toContain("사건으로 등록");
    expect(markup).toContain('aria-label="사건 등록 닫기"');
    expect(markup).toContain('class="event-quote-preview"');
    expect(markup).toContain("선택 근거");
    expect(markup).toContain("선택한 원문 근거");
    expect(markup).toContain('aria-label="사건 제목"');
    expect(markup).toContain('aria-label="사건 메모"');
    expect(markup).toContain(
      "범위는 원고에서 선택한 위치 그대로 저장됩니다.",
    );
    expect(markup).toContain('class="dialog-error" role="alert"');
    expect(markup).toContain("사건 등록 오류");
    expect(markup).toContain("취소");
    expect(markup).toContain('class="primary-button" disabled=""');
    expect(markup).toContain(">등록</button>");
  });

  it("keeps the anchorless dialog contract", () => {
    const draft: PendingEventDraft = Object.freeze({
      kind: "anchorless",
      workId: entityId<"Work">("work-1"),
    });
    const markup = renderToStaticMarkup(createElement(EventBlockDialog, {
      draft,
      error: null,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      submitting: true,
    }));

    expect(markup).toContain("EVENT OUTLINE");
    expect(markup).toContain("예정 사건 추가");
    expect(markup).toContain(
      'aria-label="사건 등록 닫기" class="dialog-close" disabled=""',
    );
    expect(markup).not.toContain('class="event-quote-preview"');
    expect(markup).not.toContain("선택 근거");
    expect(markup).toContain(
      "원고 범위 없이 사건 개요에 저장합니다. 나중에 정확한 선택을 연결할 수 있습니다.",
    );
    expect(markup).toContain("취소");
    expect(markup).toContain("등록 중");
  });
});
