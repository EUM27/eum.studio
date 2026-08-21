import { Target, Timer, Type } from "lucide-react";
import { useMemo, type FormEvent } from "react";

import type { PomodoroProjection } from "../../application/activity/pomodoro-contract";
import type { WorkActivityProjection } from "../../application/activity/work-activity-contract";
import {
  deriveWorkRecordsGoalProgress,
  type WorkRecordsGoals,
  type WorkRecordsGoalProgress,
  type WorkRecordsGoalsProjection,
} from "../../application/activity/work-records-preferences";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localWeekStartDateKey(nowMs: number): string {
  const date = new Date(nowMs);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return localDateKey(date.toISOString());
}

function readGoal(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw.length === 0) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function formatProgress(value: number, target: number | null, unit: string): string {
  return target === null
    ? `${value.toLocaleString()}${unit}`
    : `${value.toLocaleString()} / ${target.toLocaleString()}${unit}`;
}

function deriveDailyGoalProgress(input: {
  readonly activity: WorkActivityProjection;
  readonly nowMs: number;
  readonly settings: WorkRecordsGoalsProjection;
}): WorkRecordsGoalProgress {
  const today = localDateKey(new Date(input.nowMs).toISOString());
  return deriveWorkRecordsGoalProgress({
    workId: input.activity.workId,
    activity: input.activity,
    settings: input.settings,
    nowMs: input.nowMs,
    calendar: {
      today,
      weekStart: localWeekStartDateKey(input.nowMs),
      dateKey: localDateKey,
    },
  });
}

export function DailyGoalStatus(input: {
  readonly activity: WorkActivityProjection;
  readonly nowMs: number;
  readonly onOpen: () => void;
  readonly settings: WorkRecordsGoalsProjection;
}) {
  const { activity, nowMs, settings } = input;
  const progress = useMemo(
    () => deriveDailyGoalProgress({ activity, nowMs, settings }),
    [activity, nowMs, settings],
  );

  return (
    <button
      aria-label="오늘 목표"
      className="daily-goal-status"
      data-testid="daily-goal-status"
      onClick={input.onOpen}
      type="button"
    >
      <Target aria-hidden="true" size={13} />
      <span>
        오늘 {formatProgress(
          progress.dailyActiveMinutes.value,
          progress.dailyActiveMinutes.target,
          "분",
        )}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {formatProgress(
          progress.dailyCharacters.value,
          progress.dailyCharacters.target,
          "자",
        )}
      </span>
    </button>
  );
}

export function DailyGoalDialog(input: {
  readonly activity: WorkActivityProjection;
  readonly error: string | null;
  readonly nowMs: number;
  readonly onClose: () => void;
  readonly onSave: (goals: WorkRecordsGoals) => void;
  readonly pomodoro: PomodoroProjection;
  readonly saving: boolean;
  readonly settings: WorkRecordsGoalsProjection;
}) {
  const { activity, nowMs, settings } = input;
  const progress = useMemo(
    () => deriveDailyGoalProgress({ activity, nowMs, settings }),
    [activity, nowMs, settings],
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    input.onSave({
      ...input.settings.goals,
      dailyActiveMinutes: readGoal(formData, "dailyActiveMinutes"),
      dailyCharacters: readGoal(formData, "dailyCharacters"),
    });
  };
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.saving,
    onClose: input.onClose,
  });

  return (
    <div
      className="dialog-backdrop daily-goal-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="daily-goal-heading"
        aria-modal="true"
        className="daily-goal-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">DAILY FOCUS</p>
            <h2 id="daily-goal-heading">오늘 목표</h2>
          </div>
          <button
            aria-label="오늘 목표 닫기"
            className="dialog-close"
            disabled={input.saving}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <p className="daily-goal-description">
          목표만 정해 두세요. 집중 시간과 글자 수는 집필 기록에서 자동
          집계됩니다.
        </p>

        <div className="daily-goal-summary">
          <article>
            <span className="daily-goal-icon"><Timer aria-hidden="true" size={18} /></span>
            <div>
              <span>오늘 집중</span>
              <strong data-testid="daily-focus-progress">
                {formatProgress(
                  progress.dailyActiveMinutes.value,
                  progress.dailyActiveMinutes.target,
                  "분",
                )}
              </strong>
            </div>
            <progress
              max={progress.dailyActiveMinutes.target ?? 1}
              value={Math.min(
                progress.dailyActiveMinutes.value,
                progress.dailyActiveMinutes.target ?? 0,
              )}
            />
          </article>
          <article>
            <span className="daily-goal-icon"><Type aria-hidden="true" size={18} /></span>
            <div>
              <span>오늘 글자</span>
              <strong data-testid="daily-character-progress">
                {formatProgress(
                  progress.dailyCharacters.value,
                  progress.dailyCharacters.target,
                  "자",
                )}
              </strong>
            </div>
            <progress
              max={progress.dailyCharacters.target ?? 1}
              value={Math.min(
                Math.max(0, progress.dailyCharacters.value),
                progress.dailyCharacters.target ?? 0,
              )}
            />
          </article>
        </div>

        <p className="daily-goal-pomodoro" data-testid="daily-pomodoro-progress">
          <Target aria-hidden="true" size={16} />
          {input.pomodoro.settings === null
            ? "뽀모도로 목표를 아직 설정하지 않았습니다."
            : `현재 집중 주기 ${input.pomodoro.completedWorkCycles}/${input.pomodoro.settings.workCycleCount}`}
        </p>

        <form onSubmit={submit}>
          <label>
            <span>하루 집중 시간</span>
            <span className="daily-goal-input">
              <input
                aria-label="하루 집중 시간"
                defaultValue={input.settings.goals.dailyActiveMinutes ?? ""}
                disabled={input.saving}
                min="1"
                name="dailyActiveMinutes"
                step="1"
                type="number"
              />
              <span>분</span>
            </span>
          </label>
          <label>
            <span>하루 글자 수</span>
            <span className="daily-goal-input">
              <input
                aria-label="하루 글자 수"
                defaultValue={input.settings.goals.dailyCharacters ?? ""}
                disabled={input.saving}
                min="1"
                name="dailyCharacters"
                step="1"
                type="number"
              />
              <span>자</span>
            </span>
          </label>
          {input.error !== null && (
            <p className="dialog-error" role="alert">{input.error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={input.saving}
              onClick={input.onClose}
              type="button"
            >
              취소
            </button>
            <button className="primary-button" disabled={input.saving} type="submit">
              {input.saving ? "저장 중" : "목표 저장"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
