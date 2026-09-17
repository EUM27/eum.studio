import { GripVertical, Minus, Plus, X } from "lucide-react";

import type { PomodoroPhase } from "../../application/activity/pomodoro-contract";
import {
  MANUSCRIPT_FOCUS_TOOLBAR_POSITION_STORAGE_KEY,
} from "../features/settings/manuscript-focus-storage";
import { useFloatingPanelPosition } from "../floating-panel-position";

export const MANUSCRIPT_FOCUS_WIDTH_MIN_PX = 345;
export const MANUSCRIPT_FOCUS_WIDTH_MAX_PX = 1_100;
export const MANUSCRIPT_FOCUS_TEXT_SCALE_MIN_PERCENT = 50;
export const MANUSCRIPT_FOCUS_TEXT_SCALE_MAX_PERCENT = 200;
export const MANUSCRIPT_FOCUS_TEXT_SCALE_STEP_PERCENT = 10;
export const CURSOR_VIEWPORT_POSITION_MIN_PERCENT = 10;
export const CURSOR_VIEWPORT_POSITION_MAX_PERCENT = 90;
export const CURSOR_VIEWPORT_POSITION_DEFAULT_PERCENT = 40;
export const CURSOR_VIEWPORT_POSITION_STEP_PERCENT = 5;

export type ManuscriptFocusToolbarProps = {
  readonly manuscriptWidthPx: number;
  readonly highlightCurrentParagraph: boolean;
  readonly currentDocumentCharacterCount: number;
  readonly exitLabel?: string;
  readonly modeLabel?: string | null;
  readonly modeStatus?: string | null;
  readonly pomodoroPhase: PomodoroPhase | null;
  readonly pomodoroStatus: string | null;
  readonly saveStatus: string;
  readonly timerStatus: string | null;
  readonly cursorFollowEnabled: boolean;
  readonly cursorViewportPercent: number;
  readonly textScalePercent: number;
  readonly onManuscriptWidthChange: (manuscriptWidthPx: number) => void;
  readonly onHighlightCurrentParagraphChange: (enabled: boolean) => void;
  readonly onExit: () => void;
  readonly onCursorFollowChange: (enabled: boolean) => void;
  readonly onCursorViewportChange: (positionPercent: number) => void;
  readonly onTextScaleChange: (textScalePercent: number) => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ManuscriptFocusToolbar(input: ManuscriptFocusToolbarProps) {
  const {
    dragHandleProps,
    dragging,
    moved,
    panelRef,
    style,
  } = useFloatingPanelPosition<HTMLDivElement>(
    MANUSCRIPT_FOCUS_TOOLBAR_POSITION_STORAGE_KEY,
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
  const changeTextScale = (delta: number) => {
    input.onTextScaleChange(
      clamp(
        input.textScalePercent + delta,
        MANUSCRIPT_FOCUS_TEXT_SCALE_MIN_PERCENT,
        MANUSCRIPT_FOCUS_TEXT_SCALE_MAX_PERCENT,
      ),
    );
  };

  return (
    <div
      className="manuscript-focus-toolbar-host"
      data-pomodoro-phase={input.pomodoroPhase ?? undefined}
    >
      <div
        className={`manuscript-focus-floating-surface${moved ? " is-moved" : ""}${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={style}
      >
        <div
          aria-label="현재 집중 상태"
          className="manuscript-focus-pomodoro-status"
          data-pomodoro-phase={input.pomodoroPhase ?? undefined}
          data-testid="manuscript-focus-pomodoro-status"
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
            className="manuscript-focus-document-character-count"
            data-testid="manuscript-focus-document-character-count"
          >
            {documentCharacterStatus}
          </span>
        </div>
        <section
          aria-label="집중 화면 도구"
          className="manuscript-focus-toolbar"
          data-pomodoro-phase={input.pomodoroPhase ?? undefined}
        >
        <div className="manuscript-focus-toolbar-title">
          <button
            aria-label="집중 화면 도구 위치 이동"
            className="manuscript-focus-drag-handle"
            title="드래그하여 위치 이동"
            type="button"
            {...dragHandleProps}
          >
            <GripVertical aria-hidden="true" size={13} />
          </button>
          <strong>{toolbarModeLabel}</strong>
          <span>{toolbarTimerStatus}</span>
        </div>

        <label className="manuscript-focus-width-control">
          <span>원고 폭</span>
          <input
            aria-label="집중 화면 원고 폭"
            max={MANUSCRIPT_FOCUS_WIDTH_MAX_PX}
            min={MANUSCRIPT_FOCUS_WIDTH_MIN_PX}
            onChange={(event) =>
              input.onManuscriptWidthChange(Number(event.currentTarget.value))
            }
            step={5}
            type="range"
            value={input.manuscriptWidthPx}
          />
          <output>{input.manuscriptWidthPx}px</output>
        </label>

        <div
          aria-label="집중 화면 확대"
          className="manuscript-focus-text-scale-control"
          role="group"
        >
          <button
            aria-label="집중 화면 축소"
            disabled={input.textScalePercent <= MANUSCRIPT_FOCUS_TEXT_SCALE_MIN_PERCENT}
            onClick={() => changeTextScale(-MANUSCRIPT_FOCUS_TEXT_SCALE_STEP_PERCENT)}
            type="button"
          >
            <Minus aria-hidden="true" size={13} />
          </button>
          <output aria-live="polite">{input.textScalePercent}%</output>
          <button
            aria-label="집중 화면 확대"
            disabled={input.textScalePercent >= MANUSCRIPT_FOCUS_TEXT_SCALE_MAX_PERCENT}
            onClick={() => changeTextScale(MANUSCRIPT_FOCUS_TEXT_SCALE_STEP_PERCENT)}
            type="button"
          >
            <Plus aria-hidden="true" size={13} />
          </button>
        </div>

        <button
          aria-pressed={input.highlightCurrentParagraph}
          className="manuscript-focus-option"
          onClick={() =>
            input.onHighlightCurrentParagraphChange(!input.highlightCurrentParagraph)
          }
          type="button"
        >
          현재 문단
        </button>
        <button
          aria-pressed={input.cursorFollowEnabled}
          className="manuscript-focus-option"
          onClick={() => input.onCursorFollowChange(!input.cursorFollowEnabled)}
          type="button"
        >
          커서 따라가기
        </button>
        {input.cursorFollowEnabled && (
          <label className="manuscript-focus-cursor-position">
            <span>커서 위치</span>
            <input
              aria-label="커서 위치"
              max={CURSOR_VIEWPORT_POSITION_MAX_PERCENT}
              min={CURSOR_VIEWPORT_POSITION_MIN_PERCENT}
              onChange={(event) =>
                input.onCursorViewportChange(Number(event.currentTarget.value))
              }
              step={CURSOR_VIEWPORT_POSITION_STEP_PERCENT}
              type="range"
              value={input.cursorViewportPercent}
            />
            <output>{input.cursorViewportPercent}%</output>
          </label>
        )}

        <span className="manuscript-focus-save-status">{input.saveStatus}</span>
        <button
          aria-label={exitLabel}
          className="manuscript-focus-exit"
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
