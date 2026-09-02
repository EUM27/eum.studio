import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuPosition = Readonly<{ x: number; y: number }>;

export function ManuscriptContextMenu(input: {
  readonly clientX: number;
  readonly clientY: number;
  readonly copyDisabled: boolean;
  readonly canonReviewDisabled: boolean;
  readonly continuityDisabled: boolean;
  readonly characterKnowledgeDisabled: boolean;
  readonly cutDisabled: boolean;
  readonly mergeSceneDisabled: boolean;
  readonly pasteDisabled: boolean;
  readonly onAddEvent: () => void;
  readonly onAddScene: () => void;
  readonly onCanonReview: () => void;
  readonly onContinuityManual: () => void;
  readonly onContinuityReview: () => void;
  readonly onCharacterKnowledge: () => void;
  readonly onSplitScene: () => void;
  readonly onCopy: () => void;
  readonly onCut: () => void;
  readonly onMoveToNextEpisode: () => void;
  readonly onMergeScene: () => void;
  readonly onPaste: () => void;
  readonly moveToNextEpisodeDisabled: boolean;
  readonly onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>(() => ({
    x: input.clientX,
    y: input.clientY,
  }));

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const rectangle = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(0, Math.min(input.clientX, window.innerWidth - rectangle.width)),
      y: Math.max(0, Math.min(input.clientY, window.innerHeight - rectangle.height)),
    });
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [input.clientX, input.clientY]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      input.onClose();
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") input.onClose();
    };
    const closeOnResize = () => input.onClose();
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeWithEscape, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeWithEscape, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [input]);

  return createPortal(
    <div
      aria-label="원고 우클릭 메뉴"
      className="manuscript-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      <button
        disabled={input.cutDisabled}
        onClick={() => {
          input.onClose();
          input.onCut();
        }}
        role="menuitem"
        type="button"
      >
        잘라내기
      </button>
      <button
        disabled={input.copyDisabled}
        onClick={() => {
          input.onClose();
          input.onCopy();
        }}
        role="menuitem"
        type="button"
      >
        복사
      </button>
      <button
        disabled={input.pasteDisabled}
        onClick={() => {
          input.onClose();
          input.onPaste();
        }}
        role="menuitem"
        type="button"
      >
        붙여넣기
      </button>
      <div className="manuscript-context-menu-separator" role="separator" />
      <button
        disabled={input.canonReviewDisabled}
        onClick={() => {
          input.onClose();
          input.onCanonReview();
        }}
        role="menuitem"
        type="button"
      >
        별빛 변경 점검
      </button>
      <button
        disabled={input.continuityDisabled}
        onClick={() => {
          input.onClose();
          input.onContinuityManual();
        }}
        role="menuitem"
        type="button"
      >
        열린 연속성으로 저장
      </button>
      <button
        disabled={input.continuityDisabled}
        onClick={() => {
          input.onClose();
          input.onContinuityReview();
        }}
        role="menuitem"
        type="button"
      >
        연속성 점검
      </button>
      <button
        disabled={input.characterKnowledgeDisabled}
        onClick={() => {
          input.onClose();
          input.onCharacterKnowledge();
        }}
        role="menuitem"
        type="button"
      >
        인물 지식으로 저장
      </button>
      <div className="manuscript-context-menu-separator" role="separator" />
      <button
        onClick={() => {
          input.onClose();
          input.onAddScene();
        }}
        role="menuitem"
        type="button"
      >
        장면 추가
      </button>
      <button
        onClick={() => {
          input.onClose();
          input.onSplitScene();
        }}
        role="menuitem"
        type="button"
      >
        장면 나누기
      </button>
      <button
        disabled={input.mergeSceneDisabled}
        onClick={() => {
          input.onClose();
          input.onMergeScene();
        }}
        role="menuitem"
        type="button"
      >
        앞 장면과 합치기
      </button>
      <button
        onClick={() => {
          input.onClose();
          input.onAddEvent();
        }}
        role="menuitem"
        type="button"
      >
        사건 추가
      </button>
      <button
        disabled={input.moveToNextEpisodeDisabled}
        onClick={() => {
          input.onClose();
          input.onMoveToNextEpisode();
        }}
        role="menuitem"
        type="button"
      >
        여기부터 다음 화로 보내기
      </button>
    </div>,
    document.body,
  );
}
