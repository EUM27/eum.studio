import { useState, type FormEvent } from "react";

import type { PomodoroSettings } from "../../application/activity/pomodoro-contract";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

export type PomodoroDialogSubmitValue = PomodoroSettings & {
  readonly note: string;
};

export function PomodoroDialog(input: {
  readonly settings: PomodoroSettings | null;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (value: PomodoroDialogSubmitValue) => void;
}) {
  const [workMinutes, setWorkMinutes] = useState(
    input.settings === null ? "" : String(input.settings.workDurationMs / 60_000),
  );
  const [breakMinutes, setBreakMinutes] = useState(
    input.settings === null ? "" : String(input.settings.breakDurationMs / 60_000),
  );
  const [workCycleCount, setWorkCycleCount] = useState(
    input.settings === null ? "" : String(input.settings.workCycleCount),
  );
  const [autoAdvance, setAutoAdvance] = useState(
    input.settings?.autoAdvance ?? false,
  );
  const [note, setNote] = useState("");
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.submitting,
    onClose: input.onCancel,
  });
  const parsedWorkMinutes = Number(workMinutes);
  const parsedBreakMinutes = Number(breakMinutes);
  const parsedWorkCycleCount = Number(workCycleCount);
  const workDurationMs = parsedWorkMinutes * 60_000;
  const breakDurationMs = parsedBreakMinutes * 60_000;
  const canSubmit =
    workMinutes.length > 0 &&
    breakMinutes.length > 0 &&
    workCycleCount.length > 0 &&
    Number.isSafeInteger(workDurationMs) &&
    workDurationMs > 0 &&
    Number.isSafeInteger(breakDurationMs) &&
    breakDurationMs > 0 &&
    Number.isSafeInteger(parsedWorkCycleCount) &&
    parsedWorkCycleCount > 0 &&
    !input.submitting;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    input.onSubmit({
      workDurationMs,
      breakDurationMs,
      workCycleCount: parsedWorkCycleCount,
      autoAdvance,
      note,
    });
  };

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="pomodoro-dialog-heading"
        aria-modal="true"
        className="create-work-dialog pomodoro-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">FOCUS</p>
            <h2 id="pomodoro-dialog-heading">집중 타이머 설정</h2>
          </div>
          <button
            aria-label="집중 타이머 설정 닫기"
            className="dialog-close"
            disabled={input.submitting}
            onClick={input.onCancel}
            type="button"
          >
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="pomodoro-dialog-grid">
            <label>
              <span>작업 시간(분)</span>
              <input
                aria-label="작업 시간(분)"
                autoFocus
                disabled={input.submitting}
                inputMode="decimal"
                onChange={(event) => setWorkMinutes(event.target.value)}
                step="any"
                type="number"
                value={workMinutes}
              />
            </label>
            <label>
              <span>휴식 시간(분)</span>
              <input
                aria-label="휴식 시간(분)"
                disabled={input.submitting}
                inputMode="decimal"
                onChange={(event) => setBreakMinutes(event.target.value)}
                step="any"
                type="number"
                value={breakMinutes}
              />
            </label>
            <label>
              <span>작업 주기</span>
              <input
                aria-label="작업 주기"
                disabled={input.submitting}
                inputMode="numeric"
                onChange={(event) => setWorkCycleCount(event.target.value)}
                step="1"
                type="number"
                value={workCycleCount}
              />
            </label>
            <label>
              <span>세션 메모</span>
              <input
                aria-label="세션 메모"
                disabled={input.submitting}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </label>
          </div>
          <label className="pomodoro-auto-advance">
            <input
              checked={autoAdvance}
              disabled={input.submitting}
              onChange={(event) => setAutoAdvance(event.target.checked)}
              type="checkbox"
            />
            단계 자동 전환
          </label>
          <p className="dialog-description">
            입력한 시간과 주기를 현재 작품에 저장하고 작업 단계부터 시작합니다.
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
              {input.submitting ? "시작 중" : "시작"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
