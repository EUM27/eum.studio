import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorkActivityProjection } from "../../application/activity/work-activity-contract";
import type { WorkRecordsGoalsProjection } from "../../application/activity/work-records-preferences";
import type { WorkReadthroughProjection } from "../../application/activity/work-readthrough-calculator";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId } from "../../domain/writing";
import { WorkRecordsDialog } from "./WorkRecordsDialog";

const work: WorkspaceWorkSummary = Object.freeze({
  workId: entityId<"Work">("work-a"),
  title: "기록의 집",
  updatedAt: "2026-08-10T12:00:00.000Z",
  folders: Object.freeze([]),
  documents: Object.freeze([
    Object.freeze({
      documentId: entityId<"Document">("document-a"),
      title: "1화",
      currentRevisionId: entityId<"DocumentRevision">("revision-a"),
      folderId: null,
    }),
    Object.freeze({
      documentId: entityId<"Document">("document-b"),
      title: "2화",
      currentRevisionId: entityId<"DocumentRevision">("revision-b"),
      folderId: null,
    }),
  ]),
});

const activity: WorkActivityProjection = Object.freeze({
  schemaVersion: 1,
  workId: work.workId,
  activeSessionId: null,
  activeFocusCycleId: null,
  sessions: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-a"),
      workId: work.workId,
      documentId: work.documents[0]!.documentId,
      state: "completed",
      startedAt: "2026-08-09T12:00:00.000Z",
      endedAt: "2026-08-09T13:00:00.000Z",
      activeDurationMs: 3_600_000,
      startRevisionId: entityId<"DocumentRevision">("revision-a"),
      endRevisionId: entityId<"DocumentRevision">("revision-a2"),
      characterDelta: 120,
      note: "첫 장면",
    }),
    Object.freeze({
      schemaVersion: 1,
      sessionId: entityId<"WritingSession">("session-b"),
      workId: work.workId,
      documentId: work.documents[1]!.documentId,
      state: "completed",
      startedAt: "2026-08-10T12:00:00.000Z",
      endedAt: "2026-08-10T12:30:00.000Z",
      activeDurationMs: 1_800_000,
      startRevisionId: entityId<"DocumentRevision">("revision-b"),
      endRevisionId: entityId<"DocumentRevision">("revision-b2"),
      characterDelta: -20,
      note: "퇴고",
    }),
  ]),
  focusCycles: Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      focusCycleId: entityId<"FocusCycle">("focus-a"),
      workId: work.workId,
      sessionId: entityId<"WritingSession">("session-b"),
      state: "completed",
      phaseRef: "work",
      targetDurationMs: 1_500_000,
      startedAt: "2026-08-10T12:00:00.000Z",
      deadlineAt: "2026-08-10T12:25:00.000Z",
      remainingDurationMs: null,
      pauseReason: null,
      completedAt: "2026-08-10T12:25:00.000Z",
      note: "",
    }),
  ]),
});

const goalSettings: WorkRecordsGoalsProjection = Object.freeze({
  schemaVersion: 1,
  workId: work.workId,
  revision: 2,
  goals: Object.freeze({
    dailyActiveMinutes: 60,
    dailyCharacters: 500,
    weeklyActiveMinutes: 300,
    weeklyCharacters: 2_000,
  }),
});

const readthroughSettings: WorkReadthroughProjection = Object.freeze({
  schemaVersion: 1,
  workId: work.workId,
  revision: 1,
  entries: Object.freeze([
    Object.freeze({ documentId: work.documents[0]!.documentId, readerCount: 1_000 }),
    Object.freeze({ documentId: work.documents[1]!.documentId, readerCount: 800 }),
  ]),
});

describe("WorkRecordsDialog", () => {
  it("shows Work ledger totals, daily flow, streaks, and exact Document entries together", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkRecordsDialog, {
        activity,
        busy: false,
        error: null,
        exportActionState: "idle",
        exportError: null,
        exportMessage: null,
        goalActionState: "idle",
        goalError: null,
        goalSettings,
        nowMs: Date.parse("2026-08-10T12:00:00.000Z"),
        onClose: () => undefined,
        onExport: () => undefined,
        onOpenDocument: () => undefined,
        onSaveGoals: () => undefined,
        onSaveReadthrough: () => undefined,
        readthroughActionState: "idle",
        readthroughError: null,
        readthroughSettings,
        work,
      }),
    );

    expect(markup).toContain("집필 기록 상세");
    expect(markup).toContain("기록의 집");
    expect(markup).toContain('data-testid="records-total-sessions"');
    expect(markup).toContain('data-testid="records-total-duration"');
    expect(markup).toContain('data-testid="records-total-delta"');
    expect(markup).toContain('data-testid="records-total-focus"');
    expect(markup).toContain("2회");
    expect(markup).toContain("1시간 30분");
    expect(markup).toContain("+100자");
    expect(markup).toContain("현재 2일");
    expect(markup).toContain("최장 2일");
    expect(markup).toContain("일별 흐름");
    expect(markup).toContain("회차별 기록");
    expect(markup).toContain("최근 세션");
    expect(markup).toContain("1화");
    expect(markup).toContain("2화");
    expect(markup).toContain('aria-label="1화 기록 회차 열기"');
    expect(markup).toContain("기록 시작일");
    expect(markup).toContain("기록 종료일");
    expect(markup).toContain("집필 목표");
    expect(markup).toContain("오늘 집중");
    expect(markup).toContain("오늘 글자");
    expect(markup).toContain("이번 주 집중");
    expect(markup).toContain("이번 주 글자");
    expect(markup).toContain('name="dailyActiveMinutes"');
    expect(markup).toContain("25 / 60분");
    expect(markup).toContain("-20 / 500자");
    expect(markup).toContain("25 / 300분");
    expect(markup).toContain("-20 / 2000자");
    expect(markup).toContain("JSON 내보내기");
    expect(markup).toContain("CSV 내보내기");
    expect(markup).toContain("연독률 계산기");
    expect(markup).toContain('aria-label="1화 조회수"');
    expect(markup).toContain('aria-label="2화 조회수"');
    expect(markup).toContain("직전 화 대비");
    expect(markup).toContain("1화 대비");
    expect(markup).toContain("80%");
    expect(markup).toContain("연독률 저장");
    expect(markup).not.toContain("음악");
  });
});
