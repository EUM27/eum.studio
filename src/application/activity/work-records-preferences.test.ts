import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { WorkActivityProjection } from "./work-activity-contract";
import {
  createUnsetWorkRecordsGoals,
  deriveWorkRecordsGoalProgress,
  parseSaveWorkRecordsGoalsCommand,
  parseWorkRecordsGoalsProjection,
} from "./work-records-preferences";

const workId = entityId<"Work">("work-a");

const activity: WorkActivityProjection = Object.freeze({
  schemaVersion: 1,
  workId,
  activeSessionId: null,
  activeFocusCycleId: null,
  sessions: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-week"),
      workId,
      documentId: entityId<"Document">("document-a"),
      state: "completed",
      startedAt: "2026-08-04T10:00:00.000Z",
      endedAt: "2026-08-04T11:00:00.000Z",
      activeDurationMs: 3_600_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: 200,
      note: "",
    }),
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-today-a"),
      workId,
      documentId: entityId<"Document">("document-a"),
      state: "completed",
      startedAt: "2026-08-10T09:00:00.000Z",
      endedAt: "2026-08-10T10:00:00.000Z",
      activeDurationMs: 3_600_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: 120,
      note: "",
    }),
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-today-b"),
      workId,
      documentId: entityId<"Document">("document-b"),
      state: "completed",
      startedAt: "2026-08-10T10:00:00.000Z",
      endedAt: "2026-08-10T10:30:00.000Z",
      activeDurationMs: 1_800_000,
      startRevisionId: null,
      endRevisionId: null,
      characterDelta: -20,
      note: "",
    }),
  ]),
  focusCycles: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      focusCycleId: entityId<"FocusCycle">("focus-week"),
      workId,
      sessionId: null,
      state: "completed",
      phaseRef: "work",
      targetDurationMs: 3_000_000,
      startedAt: "2026-08-04T12:00:00.000Z",
      deadlineAt: null,
      remainingDurationMs: null,
      pauseReason: null,
      completedAt: "2026-08-04T12:50:00.000Z",
      note: "",
    }),
    Object.freeze({
      schemaVersion: 1,
      focusCycleId: entityId<"FocusCycle">("focus-today-completed"),
      workId,
      sessionId: entityId<"WritingSession">("session-today-a"),
      state: "completed",
      phaseRef: "work",
      targetDurationMs: 1_500_000,
      startedAt: "2026-08-10T09:00:00.000Z",
      deadlineAt: null,
      remainingDurationMs: null,
      pauseReason: null,
      completedAt: "2026-08-10T09:25:00.000Z",
      note: "",
    }),
    Object.freeze({
      schemaVersion: 1,
      focusCycleId: entityId<"FocusCycle">("focus-today-stopped"),
      workId,
      sessionId: null,
      state: "stopped",
      phaseRef: "work",
      targetDurationMs: 1_500_000,
      startedAt: "2026-08-10T10:00:00.000Z",
      deadlineAt: null,
      remainingDurationMs: 900_000,
      pauseReason: null,
      completedAt: "2026-08-10T10:10:00.000Z",
      note: "",
    }),
    Object.freeze({
      schemaVersion: 1,
      focusCycleId: entityId<"FocusCycle">("break-today"),
      workId,
      sessionId: null,
      state: "completed",
      phaseRef: "break",
      targetDurationMs: 900_000,
      startedAt: "2026-08-10T10:10:00.000Z",
      deadlineAt: null,
      remainingDurationMs: null,
      pauseReason: null,
      completedAt: "2026-08-10T10:25:00.000Z",
      note: "",
    }),
  ]),
});

describe("Work records goals", () => {
  it("uses nullable goals instead of inventing product target values", () => {
    expect(createUnsetWorkRecordsGoals()).toEqual({
      dailyActiveMinutes: null,
      dailyCharacters: null,
      weeklyActiveMinutes: null,
      weeklyCharacters: null,
    });

    const command = parseSaveWorkRecordsGoalsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 2,
      goals: {
        dailyActiveMinutes: 90,
        dailyCharacters: null,
        weeklyActiveMinutes: 300,
        weeklyCharacters: 2_000,
      },
    });
    expect(command.goals.dailyCharacters).toBeNull();
    expect(() =>
      parseSaveWorkRecordsGoalsCommand({
        ...command,
        goals: { ...command.goals, dailyCharacters: 0 },
      }),
    ).toThrow(/dailyCharacters/u);
  });

  it("derives characters from WritingSession and focus minutes from Pomodoro work phases", () => {
    const settings = parseWorkRecordsGoalsProjection({
      schemaVersion: 1,
      workId,
      revision: 3,
      goals: {
        dailyActiveMinutes: 120,
        dailyCharacters: 500,
        weeklyActiveMinutes: 600,
        weeklyCharacters: 2_000,
      },
    });
    const progress = deriveWorkRecordsGoalProgress({
      workId,
      activity,
      settings,
      calendar: {
        today: "2026-08-10",
        weekStart: "2026-08-04",
        dateKey: (timestamp) => timestamp.slice(0, 10),
      },
    });

    expect(progress.dailyActiveMinutes).toEqual({
      value: 35,
      target: 120,
      ratio: 35 / 120,
    });
    expect(progress.dailyCharacters).toEqual({
      value: 100,
      target: 500,
      ratio: 0.2,
    });
    expect(progress.weeklyActiveMinutes).toEqual({
      value: 85,
      target: 600,
      ratio: 85 / 600,
    });
    expect(progress.weeklyCharacters).toEqual({
      value: 300,
      target: 2_000,
      ratio: 0.15,
    });

    expect(() =>
      deriveWorkRecordsGoalProgress({
        workId: entityId<"Work">("work-b"),
        activity,
        settings,
        calendar: {
          today: "2026-08-10",
          weekStart: "2026-08-04",
          dateKey: (timestamp) => timestamp.slice(0, 10),
        },
      }),
    ).toThrow(/outside Work/u);
  });
});
