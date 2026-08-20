import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import { DailyGoalDialog, DailyGoalStatus } from "./DailyGoalDialog";

describe("DailyGoalDialog", () => {
  it("explains automatic writing-record aggregation", () => {
    const workId = entityId<"Work">("work-a");
    const markup = renderToStaticMarkup(
      createElement(DailyGoalDialog, {
        activity: {
          schemaVersion: 1,
          workId,
          activeSessionId: null,
          activeFocusCycleId: null,
          sessions: [],
          focusCycles: [],
        },
        error: null,
        nowMs: Date.parse("2026-08-11T12:00:00+09:00"),
        onClose: vi.fn(),
        onSave: vi.fn(),
        pomodoro: {
          schemaVersion: 1,
          workId,
          settings: {
            workDurationMs: 1_500_000,
            breakDurationMs: 300_000,
            workCycleCount: 4,
            autoAdvance: false,
          },
          status: "idle",
          completedWorkCycles: 2,
          activePhase: null,
        },
        saving: false,
        settings: {
          schemaVersion: 1,
          workId,
          revision: 0,
          goals: {
            dailyActiveMinutes: 50,
            dailyCharacters: 2_000,
            weeklyActiveMinutes: null,
            weeklyCharacters: null,
          },
        },
      }),
    );

    expect(markup).toContain("오늘 목표");
    expect(markup).toContain("집중 시간과 글자 수는 집필 기록에서 자동");
    expect(markup).toContain("현재 집중 주기 2/4");
  });

  it("shows the automatically aggregated daily progress in the editor status bar", () => {
    const workId = entityId<"Work">("work-a");
    const markup = renderToStaticMarkup(
      createElement(DailyGoalStatus, {
        activity: {
          schemaVersion: 1,
          workId,
          activeSessionId: null,
          activeFocusCycleId: null,
          sessions: [
            {
              schemaVersion: 1,
              sessionId: entityId<"WritingSession">("session-a"),
              workId,
              documentId: entityId<"Document">("document-a"),
              state: "completed",
              startedAt: "2026-08-11T10:00:00+09:00",
              endedAt: "2026-08-11T10:30:00+09:00",
              activeDurationMs: 1_800_000,
              startRevisionId: null,
              endRevisionId: null,
              characterDelta: 640,
              note: "",
            },
          ],
          focusCycles: [
            {
              schemaVersion: 1,
              focusCycleId: entityId<"FocusCycle">("focus-a"),
              workId,
              sessionId: null,
              phaseRef: "work",
              startedAt: "2026-08-11T10:00:00+09:00",
              targetDurationMs: 1_500_000,
              remainingDurationMs: 0,
              deadlineAt: "2026-08-11T10:25:00+09:00",
              completedAt: "2026-08-11T10:25:00+09:00",
              state: "completed",
              pauseReason: null,
              note: "",
            },
          ],
        },
        nowMs: Date.parse("2026-08-11T12:00:00+09:00"),
        onOpen: vi.fn(),
        settings: {
          schemaVersion: 1,
          workId,
          revision: 0,
          goals: {
            dailyActiveMinutes: 50,
            dailyCharacters: 2_000,
            weeklyActiveMinutes: null,
            weeklyCharacters: null,
          },
        },
      }),
    );

    expect(markup).toContain("오늘 30 / 50분");
    expect(markup).toContain("640 / 2,000자");
  });
});
