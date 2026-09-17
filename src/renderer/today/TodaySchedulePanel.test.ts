import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId } from "../../domain/writing";
import { TodaySchedulePanel } from "./TodaySchedulePanel";

describe("TodaySchedulePanel", () => {
  it("shows each occurrence with its owning Work instead of creating a global schedule source", () => {
    const workId = entityId<"Work">("work-1");
    const work = {
      workId,
      title: "작품 A",
      revision: 1,
      updatedAt: "2026-08-21T00:00:00.000Z",
      documents: [],
    } as unknown as WorkspaceWorkSummary;
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const projection = {
      schemaVersion: 1,
      workId,
      range: { from: date, to: date },
      items: [],
      occurrences: [{
        occurrenceId: "today-task",
        itemId: entityId<"WorkScheduleItem">("task-1"),
        workId,
        kind: "task",
        label: "7화 초고",
        date,
        time: null,
        completed: false,
        completedAt: null,
      }, {
        occurrenceId: "document-completion:document-1",
        workId,
        documentId: entityId<"Document">("document-1"),
        documentTitle: "5화",
        kind: "document-completion",
        label: "5화 완료",
        date,
        time: null,
        completed: true,
        completedAt: "2026-08-21T01:00:00.000Z",
        completedDocumentRevisionId: entityId<"DocumentRevision">("revision-1"),
        state: "current",
      }],
      episodeProgress: {
        defaultEpisodeCharacters: 1,
        totalCharacters: 0,
        totalEpisodeCount: 0,
        completedEpisodeCount: 0,
        completedEpisodeNumbers: [],
      },
      completedDocumentCount: 0,
    } satisfies WorkCalendarProjection;

    const markup = renderToStaticMarkup(createElement(TodaySchedulePanel, {
      disabled: false,
      onOpenCalendar: vi.fn(),
      onOpenCompletedRevision: vi.fn(),
      onOpenDocument: vi.fn(),
      onOpenSchedule: vi.fn(),
      schedules: [{ work, projection }],
    }));

    expect(markup).toContain("오늘 일정");
    expect(markup).toContain('aria-label="전체 일정 열기"');
    expect(markup).toContain("작품 A");
    expect(markup).toContain("7화 초고");
    expect(markup).toContain("오늘 완료");
    expect(markup).toContain("1회차");
    expect(markup).toContain("5화");
  });
});
