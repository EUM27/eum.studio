import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parsePomodoroProjection } from "../../application/activity/pomodoro-contract";
import { parseWorkActivityProjection } from "../../application/activity/work-activity-contract";
import { entityId } from "../../domain/writing";
import {
  deriveTodaySessionSummary,
  SessionFeedbackPanel,
} from "./SessionFeedbackPanel";

function fixture() {
  const nowMs = new Date(2026, 7, 18, 15, 30).getTime();
  const workId = entityId<"Work">(randomUUID());
  const documentId = entityId<"Document">(randomUUID());
  const activeSessionId = entityId<"WritingSession">(randomUUID());
  const completedSessionId = entityId<"WritingSession">(randomUUID());
  const focusCycleId = entityId<"FocusCycle">(randomUUID());
  const startedAt = new Date(nowMs - 12 * 60_000).toISOString();
  const activity = parseWorkActivityProjection({
    schemaVersion: 1,
    workId,
    activeSessionId,
    activeFocusCycleId: focusCycleId,
    sessions: [
      {
        schemaVersion: 1,
        sessionId: activeSessionId,
        workId,
        documentId,
        state: "active",
        startedAt,
        endedAt: null,
        activeDurationMs: 12 * 60_000,
        startRevisionId: randomUUID(),
        endRevisionId: null,
        characterDelta: null,
        note: "",
      },
      {
        schemaVersion: 1,
        sessionId: completedSessionId,
        workId,
        documentId,
        state: "completed",
        startedAt: new Date(nowMs - 60 * 60_000).toISOString(),
        endedAt: new Date(nowMs - 45 * 60_000).toISOString(),
        activeDurationMs: 15 * 60_000,
        startRevisionId: randomUUID(),
        endRevisionId: randomUUID(),
        characterDelta: 320,
        note: "도입부 정리",
      },
    ],
    focusCycles: [
      {
        schemaVersion: 1,
        focusCycleId,
        workId,
        sessionId: activeSessionId,
        state: "running",
        phaseRef: "work",
        targetDurationMs: 25 * 60_000,
        startedAt,
        deadlineAt: new Date(nowMs + 13 * 60_000).toISOString(),
        remainingDurationMs: null,
        pauseReason: null,
        completedAt: null,
        note: "감정선 확인",
      },
    ],
  });
  const pomodoro = parsePomodoroProjection({
    schemaVersion: 1,
    workId,
    settings: {
      workDurationMs: 25 * 60_000,
      breakDurationMs: 5 * 60_000,
      workCycleCount: 4,
      autoAdvance: false,
    },
    status: "running",
    completedWorkCycles: 0,
    activePhase: {
      focusCycleId,
      state: "running",
      phase: "work",
      cycleNumber: 1,
      targetDurationMs: 25 * 60_000,
      remainingDurationMs: 13 * 60_000,
      startedAt,
      deadlineAt: new Date(nowMs + 13 * 60_000).toISOString(),
      pauseReason: null,
      note: "감정선 확인",
    },
  });
  return { activity, documentId, nowMs, pomodoro };
}

describe("SessionFeedbackPanel", () => {
  it("derives today's completed session count, character total, and average", () => {
    const { activity, nowMs } = fixture();

    expect(deriveTodaySessionSummary(activity, nowMs)).toMatchObject({
      completedSessionCount: 1,
      characterDelta: 320,
      characterDeltaKnownCount: 1,
      averageCharacterDelta: 320,
    });
  });

  it("shows the persistent collapsed Pomodoro state without covering the manuscript", () => {
    const { activity, documentId, nowMs, pomodoro } = fixture();
    const markup = renderToStaticMarkup(
      createElement(SessionFeedbackPanel, {
        activity,
        busy: false,
        currentCharacterCount: 1_240,
        darkMode: false,
        documents: [{ documentId, title: "2화" }],
        focusCycle: undefined,
        focusMode: false,
        focusModeAvailable: true,
        forwardWritingActive: false,
        forwardWritingAvailable: true,
        nowMs,
        onConfigure: () => undefined,
        onPause: () => undefined,
        onResume: () => undefined,
        onSaveNote: () => undefined,
        onStartWritingSession: () => undefined,
        onStopFocusCycle: () => undefined,
        onStopPomodoro: () => undefined,
        onStopWritingSession: () => undefined,
        onToggleDarkMode: () => undefined,
        onToggleForwardWriting: () => undefined,
        onToggleFocusMode: () => undefined,
        pomodoro,
      }),
    );

    expect(markup).toContain('aria-label="집중 세션"');
    expect(markup).toContain('aria-label="집중 세션 위치 이동"');
    expect(markup).toContain('data-testid="pomodoro-timer"');
    expect(markup).toContain('data-pomodoro-phase="work"');
    expect(markup).toContain('data-completed-work-cycles="0"');
    expect(markup).toContain("작업 1/4 · 완료 0회");
    expect(markup).toContain('aria-label="세션 피드백 펼치기"');
    expect(markup).toContain('aria-label="집중 화면 시작"');
    expect(markup).toContain('aria-label="수정금지 집필 시작"');
    expect(markup).toContain('aria-label="어두운 화면 켜기"');
    expect(markup).not.toContain('aria-label="기록 시작"');
    expect(markup).toContain('data-testid="writing-session-timer"');
    expect(markup).not.toContain('aria-label="세션 메모"');
  });
});
