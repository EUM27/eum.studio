import {
  useState,
  type FormEvent,
} from "react";

import type { CreateEventBlockCommand } from "../../../application/structure/event-block-contract";
import { useDialogDismiss } from "../../dialog/useDialogDismiss";

export type PendingEventDraft =
  | {
      readonly kind: "selection";
      readonly workId: CreateEventBlockCommand["workId"];
      readonly documentId: CreateEventBlockCommand["documentId"];
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
      readonly exactQuote: string;
    }
  | {
      readonly kind: "anchorless";
      readonly workId: CreateEventBlockCommand["workId"];
    };

export function EventBlockDialog(input: {
  readonly draft: PendingEventDraft;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (value: {
    readonly title: string;
    readonly note: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const canSubmit = title.trim().length > 0 && !input.submitting;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.submitting,
    onClose: input.onCancel,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      input.onSubmit({ title: title.trim(), note });
    }
  };
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="create-event-heading"
        aria-modal="true"
        className="create-work-dialog event-block-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">
              {input.draft.kind === "selection" ? "EXACT RANGE" : "EVENT OUTLINE"}
            </p>
            <h2 id="create-event-heading">
              {input.draft.kind === "selection" ? "사건으로 등록" : "예정 사건 추가"}
            </h2>
          </div>
          <button
            aria-label="사건 등록 닫기"
            className="dialog-close"
            disabled={input.submitting}
            onClick={input.onCancel}
            type="button"
          >
            ×
          </button>
        </header>
        {input.draft.kind === "selection" && (
          <div className="event-quote-preview">
            <span>선택 근거</span>
            <blockquote>{input.draft.exactQuote}</blockquote>
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            <span>사건 제목</span>
            <input
              aria-label="사건 제목"
              autoFocus
              disabled={input.submitting}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            <span>메모</span>
            <textarea
              aria-label="사건 메모"
              disabled={input.submitting}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <p className="dialog-description">
            {input.draft.kind === "selection"
              ? "범위는 원고에서 선택한 위치 그대로 저장됩니다."
              : "원고 범위 없이 사건 개요에 저장합니다. 나중에 정확한 선택을 연결할 수 있습니다."}
          </p>
          {input.error !== null && (
            <p className="dialog-error" role="alert">{input.error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={input.submitting}
              onClick={input.onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={!canSubmit}
              type="submit"
            >
              {input.submitting ? "등록 중" : "등록"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
