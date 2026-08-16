import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { WorkActivityProjection } from "./work-activity-contract";
import { deriveWorkRecordsOverview } from "./work-records-overview";

const workId = entityId<"Work">("work-a");
const documentA = entityId<"Document">("document-a");
const documentB = entityId<"Document">("document-b");

function activity(): WorkActivityProjection {
  return {
    schemaVersion: 1,
    workId,
    activeSessionId: null,
    activeFocusCycleId: null,
    sessions: [
      {
        schemaVersion: 1,
        sessionId: entityId<"WritingSession">("session-outside"),
        workId,
        documentId: documentA,
        state: "completed",
        startedAt: "2026-08-01T01:00:00.000Z",
        endedAt: "2026-08-01T01:10:00.000Z",
        activeDurationMs: 600_000,
        startRevisionId: null,
        endRevisionId: null,
        characterDelta: 5,
        note: "",
      },
      {
        schemaVersion: 1,
        sessionId: entityId<"WritingSession">("session-a"),
        workId,
        documentId: documentA,
        state: "completed",
        startedAt: "2026-08-08T01:00:00.000Z",
        endedAt: "2026-08-08T02:00:00.000Z",
        activeDurationMs: 3_600_000,
        startRevisionId: null,
        endRevisionId: null,
        characterDelta: 100,
        note: "첫 기록",
      },
      {
        schemaVersion: 1,
        sessionId: entityId<"WritingSession">("session-b"),
        workId,
        documentId: documentA,
        state: "completed",
        startedAt: "2026-08-09T01:00:00.000Z",
        endedAt: "2026-08-09T01:30:00.000Z",
        activeDurationMs: 1_800_000,
        startRevisionId: null,
        endRevisionId: null,
        characterDelta: -20,
        note: "둘째 기록",
      },
      {
        schemaVersion: 1,
        sessionId: entityId<"WritingSession">("session-c"),
        workId,
        documentId: documentB,
        state: "completed",
        startedAt: "2026-08-10T01:00:00.000Z",
        endedAt: "2026-08-10T01:20:00.000Z",
        activeDurationMs: 1_200_000,
        startRevisionId: null,
        endRevisionId: null,
        characterDelta: null,
        note: "셋째 기록",
      },
    ],
    focusCycles: [
      {
        schemaVersion: 1,
        focusCycleId: entityId<"FocusCycle">("focus-a"),
        workId,
        sessionId: entityId<"WritingSession">("session-c"),
        state: "stopped",
        phaseRef: "초고 집중",
        targetDurationMs: 1_200_000,
        startedAt: "2026-08-10T01:00:00.000Z",
        deadlineAt: "2026-08-10T01:20:00.000Z",
        remainingDurationMs: null,
        pauseReason: null,
        completedAt: "2026-08-10T01:20:00.000Z",
        note: "",
      },
    ],
  };
}

const baseInput = {
  workId,
  workTitle: "기록의 집",
  documents: [
    { documentId: documentA, title: "1화" },
    { documentId: documentB, title: "2화" },
  ],
  activity: activity(),
  filter: { fromDate: "2026-08-08", toDate: "2026-08-10" },
  calendar: {
    today: "2026-08-10",
    dateKey: (timestamp: string) => timestamp.slice(0, 10),
  },
} as const;

describe("Work records overview", () => {
  it("derives filtered totals, daily flow, streak, and per-document rows from the ledger projection", () => {
    const projection = deriveWorkRecordsOverview(baseInput);

    expect(projection.totals).toEqual({
      sessionCount: 3,
      activeDurationMs: 6_600_000,
      characterDelta: 80,
      characterDeltaKnownCount: 2,
      focusCycleCount: 1,
    });
    expect(projection.streak).toEqual({ currentDays: 3, longestDays: 3 });
    expect(projection.days).toEqual([
      {
        date: "2026-08-08",
        sessionCount: 1,
        activeDurationMs: 3_600_000,
        characterDelta: 100,
      },
      {
        date: "2026-08-09",
        sessionCount: 1,
        activeDurationMs: 1_800_000,
        characterDelta: -20,
      },
      {
        date: "2026-08-10",
        sessionCount: 1,
        activeDurationMs: 1_200_000,
        characterDelta: 0,
      },
    ]);
    expect(projection.documents).toEqual([
      {
        documentId: documentA,
        title: "1화",
        sessionCount: 2,
        activeDurationMs: 5_400_000,
        characterDelta: 80,
        characterDeltaKnownCount: 2,
      },
      {
        documentId: documentB,
        title: "2화",
        sessionCount: 1,
        activeDurationMs: 1_200_000,
        characterDelta: 0,
        characterDeltaKnownCount: 0,
      },
    ]);
    expect(projection.sessions.map((session) => session.sessionId)).toEqual([
      entityId<"WritingSession">("session-c"),
      entityId<"WritingSession">("session-b"),
      entityId<"WritingSession">("session-a"),
    ]);
  });

  it("rejects cross-Work and unknown Document activity instead of falling back", () => {
    expect(() => deriveWorkRecordsOverview({
      ...baseInput,
      activity: { ...activity(), workId: entityId<"Work">("work-b") },
    })).toThrow("Work activity is outside Work work-a");

    const current = activity();
    expect(() => deriveWorkRecordsOverview({
      ...baseInput,
      activity: {
        ...current,
        sessions: [
          { ...current.sessions[0]!, documentId: entityId<"Document">("missing") },
        ],
        focusCycles: [],
      },
    })).toThrow("references unknown Document missing");
  });
});
