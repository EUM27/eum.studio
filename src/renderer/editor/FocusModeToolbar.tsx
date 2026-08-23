import { GripVertical, Minus, Plus, X } from "lucide-react";

import type { PomodoroPhase } from "../../application/activity/pomodoro-contract";
import { useFloatingPanelPosition } from "../floating-panel-position";

export const FOCUS_CONTENT_WIDTH_MIN_PX = 345;
export const FOCUS_CONTENT_WIDTH_MAX_PX = 1_100;
export const FOCUS_ZOOM_MIN_PERCENT = 50;
export const FOCUS_ZOOM_MAX_PERCENT = 200;
export const FOCUS_ZOOM_STEP_PERCENT = 10;
export const FOCUS_TYPEWRITER_POSITION_MIN_PERCENT = 10;
export const FOCUS_TYPEWRITER_POSITION_MAX_PERCENT = 90;
export const FOCUS_TYPEWRITER_POSITION_DEFAULT_PERCENT = 40;
export const FOCUS_TYPEWRITER_POSITION_STEP_PERCENT = 5;

export type FocusModeToolbarProps = {
  readonly contentWidthPx: number;
  readonly currentBlockHighlight: boolean;
  readonly currentDocumentCharacterCount: number;
  readonly exitLabel?: string;
  readonly modeLabel?: string | null;
  readonly modeStatus?: string | null;
  readonly pomodoroPhase: PomodoroPhase | null;
  readonly pomodoroStatus: string | null;
  readonly saveStatus: string;
  readonly timerStatus: string | null;
  readonly typewriterMode: boolean;
  readonly typewriterPositionPercent: number;
  readonly zoomPercent: number;
  readonly onContentWidthChange: (contentWidthPx: number) => void;
  readonly onCurrentBlockHighlightChange: (enabled: boolean) => void;
  readonly onExit: () => void;
  readonly onTypewriterModeChange: (enabled: boolean) => void;
  readonly onTypewriterPositionChange: (positionPercent: number) => void;
  readonly onZoomChange: (zoomPercent: number) => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function FocusModeToolbar(input: FocusModeToolbarProps) {
  const {
    dragHandleProps,
    dragging,
    moved,
    panelRef,
    style,
  } = useFloatingPanelPosition<HTMLDivElement>(
    "eum_focus_toolbar_position",
  );
  const pomodoroModeLabel = input.pomodoroPhase === "work"
    ? "작업 모드"
    : input.pomodoroPhase === "break"
      ? "휴식 모드"
      : null;
  const toolbarModeLabel = input.modeLabel ?? pomodoroModeLabel ?? "집중";
  const documentCharacterStatus =
    `현재 회차 ${input.currentDocumentCharacterCount}자`;
  const toolbarTimerStatus = [
    input.modeStatus,
    input.pomodoroStatus,
    input.timerStatus,
    documentCharacterStatus,
  ].filter((value): value is string => value !== null && value !== undefined)
    .join(" · ") || "원고에 집중 중";
  const persistentModeLabel = input.modeLabel ?? pomodoroModeLabel;
  const exitLabel = input.exitLabel ?? "집중 화면 종료";
  const changeZoom = (delta: number) => {
    input.onZoomChange(
      clamp(
        input.zoomPercent + delta,
        FOCUS_ZOOM_MIN_PERCENT,
        FOCUS_ZOOM_MAX_PERCENT,
      ),
    );
  };

  return (
    <div
      className="focus-mode-toolbar-host"
      data-pomodoro-phase={input.pomodoroPhase ?? undefined}
    >
      <div
        className={`focus-mode-floating-surface${moved ? " is-moved" : ""}${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={style}
      >
        <div
          aria-label="현재 집중 상태"
          className="focus-mode-pomodoro-status"
          data-pomodoro-phase={input.pomodoroPhase ?? undefined}
          data-testid="focus-pomodoro-status"
          role="status"
        >
          {persistentModeLabel !== null && (
            <strong>{persistentModeLabel}</strong>
          )}
          {input.modeStatus !== null && input.modeStatus !== undefined && (
            <span>{input.modeStatus}</span>
          )}
          {pomodoroModeLabel !== null && input.pomodoroStatus !== null && (
            <span>{`${pomodoroModeLabel} · ${input.pomodoroStatus}`}</span>
          )}
          {input.timerStatus !== null && <output>{input.timerStatus}</output>}
          <span
            aria-label="현재 문서 글자 수"
            className="focus-mode-document-character-count"
            data-testid="focus-document-character-count"
          >
            {documentCharacterStatus}
          </span>
        </div>
        <section
          aria-label="집중 화면 도구"
          className="focus-mode-toolbar"
          data-pomodoro-phase={input.pomodoroPhase ?? undefined}
        >
        <div className="focus-mode-toolbar-title">
          <button
            aria-label="집중 화면 도구 위치 이동"
            className="focus-mode-drag-handle"
            title="드래그하여 위치 이동"
            type="button"
            {...dragHandleProps}
          >
            <GripVertical aria-hidden="true" size={13} />
          </button>
          <strong>{toolbarModeLabel}</strong>
          <span>{toolbarTimerStatus}</span>
        </div>

        <label className="focus-mode-width-control">
          <span>원고 폭</span>
          <input
            aria-label="집중 화면 원고 폭"
            max={FOCUS_CONTENT_WIDTH_MAX_PX}
            min={FOCUS_CONTENT_WIDTH_MIN_PX}
            onChange={(event) =>
              input.onContentWidthChange(Number(event.currentTarget.value))
            }
            step={5}
            type="range"
            value={input.contentWidthPx}
          />
          <output>{input.contentWidthPx}px</output>
        </label>

        <div
          aria-label="집중 화면 확대"
          className="focus-mode-zoom-control"
          role="group"
        >
          <button
            aria-label="집중 화면 축소"
            disabled={input.zoomPercent <= FOCUS_ZOOM_MIN_PERCENT}
            onClick={() => changeZoom(-FOCUS_ZOOM_STEP_PERCENT)}
            type="button"
          >
            <Minus aria-hidden="true" size={13} />
          </button>
          <output aria-live="polite">{input.zoomPercent}%</output>
          <button
            aria-label="집중 화면 확대"
            disabled={input.zoomPercent >= FOCUS_ZOOM_MAX_PERCENT}
            onClick={() => changeZoom(FOCUS_ZOOM_STEP_PERCENT)}
            type="button"
          >
            <Plus aria-hidden="true" size={13} />
          </button>
        </div>

        <button
          aria-pressed={input.currentBlockHighlight}
          className="focus-mode-option"
          onClick={() =>
            input.onCurrentBlockHighlightChange(!input.currentBlockHighlight)
          }
          type="button"
        >
          현재 문단
        </button>
        <button
          aria-pressed={input.typewriterMode}
          className="focus-mode-option"
          onClick={() => input.onTypewriterModeChange(!input.typewriterMode)}
          type="button"
        >
          타자기
        </button>
        {input.typewriterMode && (
          <label className="focus-mode-typewriter-position">
            <span>타자기 위치</span>
            <input
              aria-label="타자기 위치"
              max={FOCUS_TYPEWRITER_POSITION_MAX_PERCENT}
              min={FOCUS_TYPEWRITER_POSITION_MIN_PERCENT}
              onChange={(event) =>
                input.onTypewriterPositionChange(Number(event.currentTarget.value))
              }
              step={FOCUS_TYPEWRITER_POSITION_STEP_PERCENT}
              type="range"
              value={input.typewriterPositionPercent}
            />
            <output>{input.typewriterPositionPercent}%</output>
          </label>
        )}

        <span className="focus-mode-save-status">{input.saveStatus}</span>
        <button
          aria-label={exitLabel}
          className="focus-mode-exit"
          onClick={input.onExit}
          title={`${exitLabel} (Esc)`}
          type="button"
        >
          <X aria-hidden="true" size={14} />
          <span>{exitLabel}</span>
        </button>
        </section>
      </div>
    </div>
  );
}
