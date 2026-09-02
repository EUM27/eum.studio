import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  GripVertical,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  Square,
  Sun,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { PomodoroProjection } from "../../application/activity/pomodoro-contract";
import type {
  FocusCycleProjection,
  WorkActivityProjection,
  WritingSessionProjection,
} from "../../application/activity/work-activity-contract";
import type { EntityId } from "../../domain/writing";
import { useFloatingPanelPosition } from "../floating-panel-position";

type DocumentLabel = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
};

export type TodaySessionSummary = {
  readonly sessions: readonly WritingSessionProjection[];
  readonly completedSessionCount: number;
  readonly characterDelta: number;
  readonly characterDeltaKnownCount: number;
  readonly averageCharacterDelta: number | null;
};

function localDateKey(timestamp: string | number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function deriveTodaySessionSummary(
  activity: WorkActivityProjection,
  nowMs: number,
): TodaySessionSummary {
  const today = localDateKey(nowMs);
  const sessions = activity.sessions
    .filter((session) => localDateKey(session.startedAt) === today)
    .sort(
      (left, right) =>
        Date.parse(right.startedAt) - Date.parse(left.startedAt),
    );
  const completed = sessions.filter((session) => session.state === "completed");
  const known = completed.filter((session) => session.characterDelta !== null);
  const characterDelta = known.reduce(
    (total, session) => total + (session.characterDelta ?? 0),
    0,
  );
  return Object.freeze({
    sessions: Object.freeze(sessions),
    completedSessionCount: completed.length,
    characterDelta,
    characterDeltaKnownCount: known.length,
    averageCharacterDelta:
      known.length === 0 ? null : Math.round(characterDelta / known.length),
  });
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, "0"))
        .join(":")
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function elapsedDuration(startedAt: string, nowMs: number): number {
  const startedAtMs = Date.parse(startedAt);
  return Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;
}

function phaseRemainingDuration(
  pomodoro: PomodoroProjection,
  nowMs: number,
): number {
  const phase = pomodoro.activePhase;
  if (phase === null) return pomodoro.settings?.workDurationMs ?? 0;
  if (phase.state === "paused") return phase.remainingDurationMs;
  const deadlineAtMs = phase.deadlineAt === null ? Number.NaN : Date.parse(phase.deadlineAt);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - nowMs) : 0;
}

function signedCharacters(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}자`;
}

export type SessionFeedbackPanelProps = {
  readonly activity: WorkActivityProjection;
  readonly busy: boolean;
  readonly currentCharacterCount: number;
  readonly documents: readonly DocumentLabel[];
  readonly darkMode: boolean;
  readonly focusCycle: FocusCycleProjection | undefined;
  readonly manuscriptFocusActive: boolean;
  readonly manuscriptFocusAvailable: boolean;
  readonly forwardWritingActive: boolean;
  readonly forwardWritingAvailable: boolean;
  readonly nowMs: number;
  readonly onConfigure: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onSaveNote: (note: string) => void;
  readonly onStartWritingSession: () => void;
  readonly onStopFocusCycle: () => void;
  readonly onStopPomodoro: () => void;
  readonly onStopWritingSession: () => void;
  readonly onToggleDarkMode: () => void;
  readonly onToggleForwardWriting: () => void;
  readonly onToggleManuscriptFocus: () => void;
  readonly pomodoro: PomodoroProjection;
};

export function SessionFeedbackPanel(input: SessionFeedbackPanelProps) {
  const {
    dragHandleProps,
    dragging,
    moved,
    panelRef,
    style,
  } = useFloatingPanelPosition<HTMLElement>(
    "eum_session_feedback_position",
  );
  const [collapsed, setCollapsed] = useState(true);
  const [memo, setMemo] = useState(input.pomodoro.activePhase?.note ?? "");
  const activePhase = input.pomodoro.activePhase;
  const activeSession = input.activity.sessions.find(
    (session) => session.sessionId === input.activity.activeSessionId,
  );
  const [sessionStartCharacterCount] = useState(
    () => input.currentCharacterCount - (activeSession?.characterDelta ?? 0),
  );
  const currentSessionDelta =
    activeSession === undefined
      ? 0
      : input.currentCharacterCount - sessionStartCharacterCount;
  const today = useMemo(
    () => deriveTodaySessionSummary(input.activity, input.nowMs),
    [input.activity, input.nowMs],
  );
  const documentTitleById = useMemo(
    () => new Map(input.documents.map((document) => [document.documentId, document.title])),
    [input.documents],
  );
  const remainingDurationMs = activePhase !== null
    ? phaseRemainingDuration(input.pomodoro, input.nowMs)
    : input.focusCycle === undefined
      ? phaseRemainingDuration(input.pomodoro, input.nowMs)
      : input.focusCycle.deadlineAt === null
        ? (input.focusCycle.remainingDurationMs ?? 0)
        : Math.max(0, Date.parse(input.focusCycle.deadlineAt) - input.nowMs);
  const activeTargetDurationMs =
    activePhase?.targetDurationMs ?? input.focusCycle?.targetDurationMs ?? null;
  const progress = activeTargetDurationMs === null
    ? 0
    : Math.min(
        100,
        Math.max(
          0,
          ((activeTargetDurationMs - remainingDurationMs) /
            activeTargetDurationMs) *
            100,
        ),
      );

  const phaseLabel = activePhase === null
    ? input.focusCycle !== undefined
      ? input.focusCycle.phaseRef
      : input.pomodoro.status === "completed"
        ? "집중 완료"
        : "집중 준비"
    : `${activePhase.phase === "work" ? "작업" : "휴식"} ${activePhase.cycleNumber}/${input.pomodoro.settings?.workCycleCount ?? activePhase.cycleNumber}`;
  const phaseLabelWithCompletedCount = activePhase === null
    ? phaseLabel
    : `${phaseLabel} · 완료 ${input.pomodoro.completedWorkCycles}회`;
  const phaseTitle = activePhase === null
    ? input.focusCycle === undefined
      ? undefined
      : `${input.focusCycle.phaseRef} · ${formatDuration(input.focusCycle.targetDurationMs)}`
    : activePhase.pauseReason === "restore"
      ? "이전 실행에서 안전하게 일시정지되었습니다."
      : activePhase.pauseReason === "phase-complete"
        ? "다음 단계를 시작할 때까지 일시정지되었습니다."
        : `${activePhase.phase === "work" ? "작업" : "휴식"} · ${formatDuration(activePhase.targetDurationMs)}`;

  return (
    <aside
      aria-label="집중 세션"
      className={`session-feedback-panel${collapsed ? " is-collapsed" : ""}${moved ? " is-moved" : ""}${dragging ? " is-dragging" : ""}`}
      data-completed-work-cycles={input.pomodoro.completedWorkCycles}
      data-pomodoro-phase={activePhase?.phase}
      data-testid="session-feedback"
      ref={panelRef}
      style={style}
    >
      <div
        className="session-feedback-heading"
        data-testid={
          activePhase !== null
            ? "pomodoro-timer"
            : input.focusCycle === undefined
              ? undefined
              : "focus-cycle-timer"
        }
        title={phaseTitle}
      >
        <button
          aria-label="집중 세션 위치 이동"
          className="session-feedback-drag-handle"
          title="드래그하여 위치 이동"
          type="button"
          {...dragHandleProps}
        >
          <GripVertical aria-hidden="true" size={14} />
        </button>
        <div className="session-feedback-phase">
          <span>{phaseLabelWithCompletedCount}</span>
          <output aria-live="polite">{formatDuration(remainingDurationMs)}</output>
        </div>
        <div className="session-feedback-controls">
          {activePhase === null && input.focusCycle === undefined ? (
            <button
              disabled={input.busy}
              onClick={input.onConfigure}
              type="button"
            >
              집중 시작
            </button>
          ) : activePhase !== null ? (
            <>
              <button
                aria-label={activePhase.state === "running" ? "일시정지" : "재개"}
                disabled={input.busy}
                onClick={
                  activePhase.state === "running" ? input.onPause : input.onResume
                }
                type="button"
              >
                {activePhase.state === "running" ? (
                  <Pause aria-hidden="true" size={14} />
                ) : (
                  <Play aria-hidden="true" size={14} />
                )}
                <span>{activePhase.state === "running" ? "일시정지" : "재개"}</span>
              </button>
              <button
                aria-label="종료"
                disabled={input.busy}
                onClick={input.onStopPomodoro}
                type="button"
              >
                <Square aria-hidden="true" size={13} />
                <span>종료</span>
              </button>
            </>
          ) : (
            <button
              aria-label="종료"
              disabled={input.busy}
              onClick={input.onStopFocusCycle}
              type="button"
            >
              <Square aria-hidden="true" size={13} />
              <span>종료</span>
            </button>
          )}
          {input.manuscriptFocusAvailable && (
            <button
              aria-label={input.manuscriptFocusActive ? "집중 화면 종료" : "집중 화면 시작"}
              className="session-feedback-focus"
              onClick={input.onToggleManuscriptFocus}
              title={
                input.manuscriptFocusActive
                  ? "집중 화면 종료 (Esc)"
                  : "집중 화면 시작 (Ctrl+Shift+Enter)"
              }
              type="button"
            >
              {input.manuscriptFocusActive ? (
                <Minimize2 aria-hidden="true" size={15} />
              ) : (
                <Maximize2 aria-hidden="true" size={15} />
              )}
            </button>
          )}
          {activeSession === undefined && (
            <button
              aria-label="기록 시작"
              className="session-feedback-record"
              disabled={input.busy}
              onClick={input.onStartWritingSession}
              title="집필 기록 시작"
              type="button"
            >
              <CircleDot aria-hidden="true" size={15} />
            </button>
          )}
          {input.forwardWritingAvailable && (
            <button
              aria-label={
                input.forwardWritingActive
                  ? "수정금지 집필 종료"
                  : "수정금지 집필 시작"
              }
              className="session-feedback-forward-writing"
              onClick={input.onToggleForwardWriting}
              title={
                input.forwardWritingActive
                  ? "수정금지 집필 종료"
                  : "수정금지 집필 시작"
              }
              type="button"
            >
              <LockKeyhole aria-hidden="true" size={15} />
            </button>
          )}
          <button
            aria-label={input.darkMode ? "밝은 화면 켜기" : "어두운 화면 켜기"}
            className="session-feedback-theme"
            onClick={input.onToggleDarkMode}
            title={input.darkMode ? "밝은 화면 켜기" : "어두운 화면 켜기"}
            type="button"
          >
            {input.darkMode ? (
              <Sun aria-hidden="true" size={15} />
            ) : (
              <Moon aria-hidden="true" size={15} />
            )}
          </button>
          <button
            aria-label={collapsed ? "세션 피드백 펼치기" : "세션 피드백 접기"}
            className="session-feedback-collapse"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? (
              <ChevronDown aria-hidden="true" size={16} />
            ) : (
              <ChevronUp aria-hidden="true" size={16} />
            )}
          </button>
        </div>
      </div>

      {activeSession !== undefined && (
        <div className="session-feedback-writing" data-testid="writing-session-timer">
          <span>집필 기록 {formatDuration(elapsedDuration(activeSession.startedAt, input.nowMs))}</span>
          <button
            disabled={input.busy}
            onClick={input.onStopWritingSession}
            type="button"
          >
            종료
          </button>
        </div>
      )}

      {activeTargetDurationMs !== null && (
        <div className="session-feedback-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}

      {!collapsed && (
        <div className="session-feedback-body">
          <section className="session-feedback-metrics" aria-label="현재 세션 요약">
            <div>
              <span>이번 집필</span>
              <strong>{signedCharacters(currentSessionDelta)}</strong>
              <small>
                {activeSession === undefined
                  ? "기록 전"
                  : `${formatDuration(elapsedDuration(activeSession.startedAt, input.nowMs))} 경과`}
              </small>
            </div>
            <div>
              <span>오늘 세션</span>
              <strong>
                {today.characterDeltaKnownCount === 0
                  ? "측정 전"
                  : signedCharacters(today.characterDelta)}
              </strong>
              <small>{today.completedSessionCount}회 완료</small>
            </div>
            <div>
              <span>세션 평균</span>
              <strong>
                {today.averageCharacterDelta === null
                  ? "측정 전"
                  : signedCharacters(today.averageCharacterDelta)}
              </strong>
              <small>완료 기록 기준</small>
            </div>
          </section>

          {activePhase?.phase === "work" && (
            <form
              className="session-feedback-memo"
              onSubmit={(event) => {
                event.preventDefault();
                input.onSaveNote(memo);
              }}
            >
              <label>
                <span>세션 메모</span>
                <input
                  aria-label="세션 메모"
                  disabled={input.busy}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="이번 집중에서 남길 메모"
                  value={memo}
                />
              </label>
              <button
                disabled={input.busy || memo === activePhase.note}
                type="submit"
              >
                메모 저장
              </button>
            </form>
          )}

          <section className="session-feedback-history" aria-label="오늘의 세션 기록">
            <header>
              <span>오늘의 기록</span>
              <span>{today.sessions.length}회</span>
            </header>
            {today.sessions.length === 0 ? (
              <p>아직 완료된 세션이 없습니다.</p>
            ) : (
              <ol>
                {today.sessions.slice(0, 4).map((session) => (
                  <li key={session.sessionId}>
                    <span>
                      <strong>
                        {session.documentId === null
                          ? "연결된 회차 없음"
                          : documentTitleById.get(session.documentId) ?? "회차"}
                      </strong>
                      <time dateTime={session.startedAt}>
                        {new Date(session.startedAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </span>
                    <span>{formatDuration(session.activeDurationMs)}</span>
                    <strong>
                      {session.state === "active"
                        ? signedCharacters(currentSessionDelta)
                        : session.characterDelta === null
                          ? "측정 전"
                          : signedCharacters(session.characterDelta)}
                    </strong>
                    {session.note.length > 0 && <small>{session.note}</small>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
