import { CalendarDays } from "lucide-react";

import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import { localDateKey } from "../schedule/work-schedule-summary";

export function TodaySchedulePanel(input: {
  readonly disabled: boolean;
  readonly onOpenCalendar: (() => void) | null;
  readonly onOpenDocument: (
    work: WorkspaceWorkSummary,
    documentId: EntityId<"Document">,
  ) => void;
  readonly onOpenSchedule: (work: WorkspaceWorkSummary) => void;
  readonly schedules: ReadonlyArray<Readonly<{
    work: WorkspaceWorkSummary;
    projection: WorkCalendarProjection;
  }>>;
}) {
  const today = localDateKey();
  const rows = input.schedules.flatMap(({ work, projection }) =>
    projection.occurrences
      .filter((occurrence) => occurrence.date === today)
      .map((occurrence) => ({ work, occurrence })),
  );
  const scheduleRows = rows.filter(
    ({ occurrence }) => occurrence.kind !== "document-completion",
  );
  const completionRows = rows.filter(
    ({ occurrence }) => occurrence.kind === "document-completion",
  );

  return (
    <section aria-labelledby="today-schedule-heading" className="today-schedule-panel">
      <header>
        <div>
          <p className="resume-strip-label">오늘 일정</p>
          <h2 id="today-schedule-heading">오늘 할 일</h2>
        </div>
        <button
          aria-label="전체 일정 열기"
          className="today-schedule-open"
          disabled={input.disabled || input.onOpenCalendar === null}
          onClick={() => input.onOpenCalendar?.()}
          type="button"
        >
          <CalendarDays aria-hidden="true" size={18} />
        </button>
      </header>
      {scheduleRows.length === 0 ? (
        <p className="today-schedule-empty">오늘 등록된 일정이 없습니다.</p>
      ) : (
        <ul>
          {scheduleRows.map(({ work, occurrence }) => (
            <li key={`${work.workId}:${occurrence.occurrenceId}`}>
              <button
                disabled={input.disabled}
                onClick={() => input.onOpenSchedule(work)}
                type="button"
              >
                <span>{work.title}</span>
                <strong>{occurrence.label}</strong>
                <small>
                  {occurrence.completed
                    ? "완료"
                    : occurrence.time ?? "시간 미지정"}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="today-completion-heading">
        <strong>오늘 완료</strong>
        <span>{completionRows.length}회차</span>
      </div>
      {completionRows.length === 0 ? (
        <p className="today-schedule-empty">오늘 완료한 회차가 없습니다.</p>
      ) : (
        <ul className="today-completion-list">
          {completionRows.map(({ work, occurrence }) => {
            if (occurrence.kind !== "document-completion") return null;
            return (
              <li key={`${work.workId}:${occurrence.occurrenceId}`}>
                <button
                  disabled={input.disabled}
                  onClick={() =>
                    input.onOpenDocument(work, occurrence.documentId)
                  }
                  type="button"
                >
                  <span>{work.title}</span>
                  <strong>✓ {occurrence.documentTitle}</strong>
                  <small>완료</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
