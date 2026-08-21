import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";

export function DocumentCompletionControl(input: {
  readonly busy: boolean;
  readonly completion: DocumentCompletionProjection;
  readonly onClear: () => void;
  readonly onComplete: () => void;
  readonly onOpenCompletedRevision: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleMenuOpen = menuOpen && !input.busy;

  useEffect(() => {
    if (!visibleMenuOpen) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [visibleMenuOpen]);

  if (input.completion.state === "incomplete") {
    return (
      <button
        className="work-header-completion"
        disabled={input.busy}
        onClick={input.onComplete}
        type="button"
      >
        {input.busy ? "저장 중" : "회차 완료"}
      </button>
    );
  }

  return (
    <div className="work-header-completion-control" ref={rootRef}>
      <span
        className="work-header-completion-status"
        data-completion-state={input.completion.state}
        title={input.completion.completedAt ?? undefined}
      >
        {input.completion.state === "current"
          ? "✓ 완료됨"
          : "△ 완료 후 수정됨"}
      </span>
      {input.completion.state === "edited-after-completion" && (
        <button
          className="work-header-completion work-header-recomplete"
          disabled={input.busy}
          onClick={input.onComplete}
          type="button"
        >
          {input.busy ? "저장 중" : "다시 완료"}
        </button>
      )}
      <button
        aria-expanded={visibleMenuOpen}
        aria-haspopup="menu"
        aria-label="회차 완료 메뉴 열기"
        className="work-header-completion-more"
        disabled={input.busy}
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={15} />
      </button>
      {visibleMenuOpen && (
        <div aria-label="회차 완료 메뉴" className="work-header-completion-menu" role="menu">
          <button
            onClick={() => {
              setMenuOpen(false);
              input.onOpenCompletedRevision();
            }}
            role="menuitem"
            type="button"
          >
            완료 당시 버전 보기
          </button>
          <button
            className="is-destructive"
            onClick={() => {
              setMenuOpen(false);
              input.onClear();
            }}
            role="menuitem"
            type="button"
          >
            완료 취소
          </button>
        </div>
      )}
    </div>
  );
}
