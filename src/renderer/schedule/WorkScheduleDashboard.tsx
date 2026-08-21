import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  X,
} from "lucide-react";

import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type {
  WorkScheduleDdayWorkload,
  WorkScheduleItemInput,
  WorkScheduleItemProjection,
  WorkScheduleOccurrence,
} from "../../application/schedule/work-schedule-contract";
import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkEpisodeCharacterProgress } from "../../application/settings/app-settings";
import type { EntityId } from "../../domain/writing";

const DAY_MS = 86_400_000;

export type CalendarDayCell = {
  readonly date: string;
  readonly day: number;
  readonly inMonth: boolean;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function buildCalendarMonth(monthKey: string): {
  readonly range: { readonly from: string; readonly to: string };
  readonly cells: readonly CalendarDayCell[];
} {
  const match = /^(\d{4})-(\d{2})$/u.exec(monthKey);
  if (match === null) throw new Error("Calendar month must use YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  if (first.getUTCFullYear() !== year || first.getUTCMonth() !== monthIndex) {
    throw new Error("Calendar month must be real");
  }
  const gridStart = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = new Date(gridStart.getTime() + index * DAY_MS);
    return Object.freeze({
      date: utcDateKey(value),
      day: value.getUTCDate(),
      inMonth: value.getUTCMonth() === monthIndex,
    });
  });
  return Object.freeze({
    range: Object.freeze({
      from: cells[0]?.date ?? utcDateKey(first),
      to: cells[41]?.date ?? utcDateKey(first),
    }),
    cells: Object.freeze(cells),
  });
}

export function formatDdayDistance(targetDate: string, today: string): string {
  const days = Math.round(
    (parseDateKey(targetDate).getTime() - parseDateKey(today).getTime()) /
      DAY_MS,
  );
  if (days === 0) return "D-DAY";
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

function shiftMonth(monthKey: string, amount: number): string {
  const current = parseDateKey(`${monthKey}-01`);
  const shifted = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1),
  );
  return utcDateKey(shifted).slice(0, 7);
}

export function moveCalendarMonth(
  monthKey: string,
  amount: number,
): Readonly<{ monthKey: string; selectedDate: string }> {
  const nextMonthKey = shiftMonth(monthKey, amount);
  return Object.freeze({
    monthKey: nextMonthKey,
    selectedDate: `${nextMonthKey}-01`,
  });
}

function monthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(parseDateKey(`${monthKey}-01`));
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(parseDateKey(date));
}

function weekdayLabels(): readonly string[] {
  const sunday = Date.UTC(2026, 0, 4);
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  return Object.freeze(
    Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(sunday + index * DAY_MS)),
    ),
  );
}

function workloadSummary(workload: WorkScheduleDdayWorkload): string {
  switch (workload.mode) {
    case "none":
      return "목표값 없음";
    case "totalCharacters":
      return `총 ${workload.targetCharacters.toLocaleString()}자`;
    case "episodeCount":
      return `추가 ${workload.targetEpisodeCount.toLocaleString()}회차 · 기준 ${workload.baselineCompletedCount.toLocaleString()}회차 · 글자 수 기준`;
    case "episodeNumber":
      return `${workload.targetEpisodeNumber.toLocaleString()}화까지 · 글자 수 기준`;
    case "additionalCompletedDocuments":
      return `추가 완료 ${workload.targetCount.toLocaleString()}회차 · 기준 ${workload.baselineCompletedCount.toLocaleString()}회차 · 완료 체크 기준`;
    case "totalCompletedDocuments":
      return `총 완료 ${workload.targetCount.toLocaleString()}회차 · 완료 체크 기준`;
  }
}

export function formatDdayProgress(
  workload: WorkScheduleDdayWorkload,
  progress: WorkEpisodeCharacterProgress,
  completedDocumentCount = 0,
): string | null {
  switch (workload.mode) {
    case "none":
      return null;
    case "totalCharacters": {
      const remaining = Math.max(
        0,
        workload.targetCharacters - progress.totalCharacters,
      );
      return remaining === 0
        ? `현재 ${progress.totalCharacters.toLocaleString()}자 · 목표 달성`
        : `현재 ${progress.totalCharacters.toLocaleString()}자 · ${remaining.toLocaleString()}자 남음`;
    }
    case "episodeCount": {
      const completed = Math.min(
        workload.targetEpisodeCount,
        Math.max(
          0,
          progress.completedEpisodeCount - workload.baselineCompletedCount,
        ),
      );
      const remaining = workload.targetEpisodeCount - completed;
      return remaining === 0
        ? `추가 완료 ${completed.toLocaleString()}/${workload.targetEpisodeCount.toLocaleString()}회차 · 목표 달성`
        : `추가 완료 ${completed.toLocaleString()}/${workload.targetEpisodeCount.toLocaleString()}회차 · ${remaining.toLocaleString()}회차 남음`;
    }
    case "episodeNumber": {
      const completed = progress.completedEpisodeNumbers.filter(
        (episodeNumber) => episodeNumber <= workload.targetEpisodeNumber,
      ).length;
      const remaining = Math.max(0, workload.targetEpisodeNumber - completed);
      return remaining === 0
        ? `완료 ${completed.toLocaleString()}/${workload.targetEpisodeNumber.toLocaleString()}회차 · 목표 달성`
        : `완료 ${completed.toLocaleString()}/${workload.targetEpisodeNumber.toLocaleString()}회차 · ${remaining.toLocaleString()}회차 남음`;
    }
    case "additionalCompletedDocuments": {
      const completed = Math.min(
        workload.targetCount,
        Math.max(0, completedDocumentCount - workload.baselineCompletedCount),
      );
      const remaining = workload.targetCount - completed;
      return remaining === 0
        ? `추가 완료 ${completed.toLocaleString()}/${workload.targetCount.toLocaleString()}회차 · 목표 달성`
        : `추가 완료 ${completed.toLocaleString()}/${workload.targetCount.toLocaleString()}회차 · ${remaining.toLocaleString()}회차 남음`;
    }
    case "totalCompletedDocuments": {
      const completed = Math.min(workload.targetCount, completedDocumentCount);
      const remaining = workload.targetCount - completed;
      return remaining === 0
        ? `완료 ${completed.toLocaleString()}/${workload.targetCount.toLocaleString()}회차 · 목표 달성`
        : `완료 ${completed.toLocaleString()}/${workload.targetCount.toLocaleString()}회차 · ${remaining.toLocaleString()}회차 남음`;
    }
  }
}

type EditorState = {
  readonly mode: "create" | "edit";
  readonly kind: WorkScheduleItemInput["kind"];
  readonly item: WorkScheduleItemProjection | null;
};

function ScheduleItemDialog({
  state,
  initialDate,
  completedDocumentCount,
  busy,
  error,
  onClose,
  onSave,
  onRetire,
}: {
  readonly state: EditorState;
  readonly initialDate: string;
  readonly completedDocumentCount: number;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: (item: WorkScheduleItemInput) => void;
  readonly onRetire: (() => void) | null;
}) {
  const source = state.item;
  const [label, setLabel] = useState(source?.label ?? "");
  const [date, setDate] = useState(
    source === null
      ? initialDate
      : source.kind === "routine"
        ? source.startDate
        : source.date,
  );
  const [time, setTime] = useState(source?.time ?? "");
  const initialWorkload =
    source?.kind === "dday" ? source.workload : ({ mode: "none" } as const);
  const [workloadMode, setWorkloadMode] = useState(initialWorkload.mode);
  const [target, setTarget] = useState(
    initialWorkload.mode === "totalCharacters"
      ? String(initialWorkload.targetCharacters)
      : initialWorkload.mode === "episodeCount"
        ? String(initialWorkload.targetEpisodeCount)
        : initialWorkload.mode === "episodeNumber"
          ? String(initialWorkload.targetEpisodeNumber)
          : initialWorkload.mode === "additionalCompletedDocuments" ||
              initialWorkload.mode === "totalCompletedDocuments"
            ? String(initialWorkload.targetCount)
            : "",
  );
  const [baseline, setBaseline] = useState(
    initialWorkload.mode === "episodeCount"
      ? String(initialWorkload.baselineCompletedCount)
      : initialWorkload.mode === "additionalCompletedDocuments"
        ? String(initialWorkload.baselineCompletedCount)
        : String(completedDocumentCount),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const title =
    state.mode === "edit"
      ? `${state.kind === "task" ? "일정" : state.kind === "routine" ? "루틴" : "D-DAY"} 수정`
      : `${state.kind === "task" ? "일정" : state.kind === "routine" ? "루틴" : "D-DAY"} 추가`;

  useEffect(() => {
    if (busy) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [busy, onClose]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedLabel = label.trim();
    if (normalizedLabel.length === 0) {
      setValidationError("이름을 입력하세요.");
      return;
    }
    if (state.kind === "task") {
      onSave({
        kind: "task",
        label: normalizedLabel,
        date,
        time: time || null,
      });
      return;
    }
    if (state.kind === "routine") {
      onSave({
        kind: "routine",
        label: normalizedLabel,
        startDate: date,
        time: time || null,
      });
      return;
    }
    const numericTarget = Number(target);
    const numericBaseline = Number(baseline);
    let workload: WorkScheduleDdayWorkload;
    if (workloadMode === "none") {
      workload = { mode: "none" };
    } else if (!Number.isSafeInteger(numericTarget) || numericTarget <= 0) {
      setValidationError("목표값은 1 이상의 정수여야 합니다.");
      return;
    } else if (workloadMode === "totalCharacters") {
      workload = { mode: "totalCharacters", targetCharacters: numericTarget };
    } else if (workloadMode === "episodeNumber") {
      workload = { mode: "episodeNumber", targetEpisodeNumber: numericTarget };
    } else if (workloadMode === "totalCompletedDocuments") {
      workload = { mode: "totalCompletedDocuments", targetCount: numericTarget };
    } else if (workloadMode === "additionalCompletedDocuments") {
      if (!Number.isSafeInteger(numericBaseline) || numericBaseline < 0) {
        setValidationError("기준 완료 회차는 0 이상의 정수여야 합니다.");
        return;
      }
      workload = {
        mode: "additionalCompletedDocuments",
        targetCount: numericTarget,
        baselineCompletedCount: numericBaseline,
      };
    } else {
      if (!Number.isSafeInteger(numericBaseline) || numericBaseline < 0) {
        setValidationError("기준 완료 회차는 0 이상의 정수여야 합니다.");
        return;
      }
      workload = {
        mode: "episodeCount",
        targetEpisodeCount: numericTarget,
        baselineCompletedCount: numericBaseline,
      };
    }
    onSave({
      kind: "dday",
      label: normalizedLabel,
      date,
      time: time || null,
      workload,
    });
  }

  return (
    <div
      className="dialog-backdrop schedule-dialog-backdrop"
      onPointerDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="schedule-item-dialog-title"
        aria-modal="true"
        className="schedule-item-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">WORK SCHEDULE</p>
            <h2 id="schedule-item-dialog-title">{title}</h2>
          </div>
          <button aria-label={`${title} 닫기`} disabled={busy} onClick={onClose} type="button">
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>{state.kind === "dday" ? "마감 이름" : "이름"}</span>
            <input
              autoFocus
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
              value={label}
            />
          </label>
          <div className="schedule-dialog-split">
            <label>
              <span>{state.kind === "routine" ? "시작 날짜" : "날짜"}</span>
              <input
                disabled={busy}
                onChange={(event) => setDate(event.target.value)}
                required
                type="date"
                value={date}
              />
            </label>
            <label>
              <span>시간</span>
              <input
                disabled={busy}
                onChange={(event) => setTime(event.target.value)}
                type="time"
                value={time}
              />
            </label>
          </div>
          {state.kind === "dday" && (
            <div className="schedule-dialog-split schedule-workload-fields">
              <label>
                <span>목표 기준</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    setWorkloadMode(
                      event.target.value as WorkScheduleDdayWorkload["mode"],
                    )
                  }
                  value={workloadMode}
                >
                  <option value="none">목표값 없음</option>
                  <option value="totalCharacters">총 글자 수</option>
                  <option value="additionalCompletedDocuments">추가 완료 회차 수</option>
                  <option value="totalCompletedDocuments">총 완료 회차 수</option>
                  <option value="episodeCount">글자 수 기준 · 추가 회차 수</option>
                  <option value="episodeNumber">글자 수 기준 · 목표 화수</option>
                </select>
              </label>
              {workloadMode !== "none" && (
                <label>
                  <span>
                    {workloadMode === "totalCharacters"
                      ? "목표 글자 수"
                      : workloadMode === "episodeNumber"
                        ? "목표 화수"
                        : workloadMode === "totalCompletedDocuments"
                          ? "목표 완료 회차"
                          : "추가할 회차 수"}
                  </span>
                  <input
                    disabled={busy}
                    min={1}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                    type="number"
                    value={target}
                  />
                </label>
              )}
              {workloadMode === "episodeCount" && (
                <label>
                  <span>현재 완료 회차</span>
                  <input
                    disabled={busy}
                    min={0}
                    onChange={(event) => setBaseline(event.target.value)}
                    required
                    type="number"
                    value={baseline}
                  />
                </label>
              )}
              {workloadMode === "additionalCompletedDocuments" && (
                <p className="schedule-explicit-baseline">
                  기준 완료 회차 {baseline || "0"}개
                </p>
              )}
            </div>
          )}
          {(validationError ?? error) !== null && (
            <p className="dialog-error" role="alert">
              {validationError ?? error}
            </p>
          )}
          <footer>
            {onRetire !== null && (
              <button
                className="schedule-retire-action"
                disabled={busy}
                onClick={onRetire}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                삭제
              </button>
            )}
            <span />
            <button disabled={busy} onClick={onClose} type="button">
              취소
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "저장 중…" : "저장"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function WorkScheduleDashboard({
  onOpenCompletedRevision,
  onOpenDocument,
  work,
  settingsRevision,
}: {
  readonly onOpenCompletedRevision?: (
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ) => void;
  readonly onOpenDocument?: (documentId: EntityId<"Document">) => void;
  readonly work: WorkspaceWorkSummary;
  readonly settingsRevision: number;
}) {
  const today = localDateKey();
  const [monthKey, setMonthKey] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [projection, setProjection] = useState<WorkCalendarProjection | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const requestIdRef = useRef(0);
  const calendar = useMemo(() => buildCalendarMonth(monthKey), [monthKey]);
  const weekdays = useMemo(() => weekdayLabels(), []);

  const load = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    void window.eumStudio.schedule
      .listCalendar({
        schemaVersion: 1,
        workId: work.workId,
        range: calendar.range,
      })
      .then(
        (value) => {
          if (requestIdRef.current !== requestId) return;
          setError(null);
          setProjection(value);
          setLoading(false);
        },
        (reason: unknown) => {
          if (requestIdRef.current !== requestId) return;
          setProjection(null);
          setError(
            reason instanceof Error ? reason.message : "일정을 불러오지 못했습니다.",
          );
          setLoading(false);
        },
      );
  }, [calendar.range, work.workId]);

  useEffect(() => {
    void settingsRevision;
    load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load, settingsRevision]);

  const items = projection?.items ?? [];
  const selectedOccurrences = (projection?.occurrences ?? []).filter(
    (occurrence) => occurrence.date === selectedDate,
  );
  const selectedDdays = items.filter(
    (
      item,
    ): item is Extract<WorkScheduleItemProjection, { kind: "dday" }> =>
      item.kind === "dday" && item.date === selectedDate,
  );
  const ddays = items
    .filter((item): item is Extract<WorkScheduleItemProjection, { kind: "dday" }> =>
      item.kind === "dday",
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const occurrenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const occurrence of projection?.occurrences ?? []) {
      counts.set(occurrence.date, (counts.get(occurrence.date) ?? 0) + 1);
    }
    for (const item of projection?.items ?? []) {
      if (item.kind === "dday" && item.date >= calendar.range.from && item.date <= calendar.range.to) {
        counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
      }
    }
    return counts;
  }, [calendar.range.from, calendar.range.to, projection]);

  function openCreate(kind: WorkScheduleItemInput["kind"]): void {
    setError(null);
    setEditor({ mode: "create", kind, item: null });
  }

  function openEdit(item: WorkScheduleItemProjection): void {
    setError(null);
    setEditor({ mode: "edit", kind: item.kind, item });
  }

  function saveItem(item: WorkScheduleItemInput): void {
    if (editor === null) return;
    setActionBusy(true);
    setError(null);
    const action =
      editor.mode === "create" || editor.item === null
        ? window.eumStudio.schedule.createItem({
            schemaVersion: 1,
            workId: work.workId,
            item,
          })
        : window.eumStudio.schedule.updateItem({
            schemaVersion: 1,
            workId: work.workId,
            itemId: editor.item.itemId,
            expectedRevision: editor.item.revision,
            item,
          });
    void action.then(
      () => {
        setActionBusy(false);
        setEditor(null);
        setLoading(true);
        load();
      },
      (reason: unknown) => {
        setActionBusy(false);
        setError(reason instanceof Error ? reason.message : "일정을 저장하지 못했습니다.");
      },
    );
  }

  function retireItem(): void {
    if (editor?.item === null || editor?.item === undefined) return;
    setActionBusy(true);
    setError(null);
    void window.eumStudio.schedule
      .retireItem({
        schemaVersion: 1,
        workId: work.workId,
        itemId: editor.item.itemId,
        expectedRevision: editor.item.revision,
      })
      .then(
        () => {
          setActionBusy(false);
          setEditor(null);
          setLoading(true);
          load();
        },
        (reason: unknown) => {
          setActionBusy(false);
          setError(reason instanceof Error ? reason.message : "일정을 삭제하지 못했습니다.");
        },
      );
  }

  function toggleCompletion(occurrence: WorkScheduleOccurrence): void {
    const item = items.find((candidate) => candidate.itemId === occurrence.itemId);
    if (item === undefined) return;
    setActionBusy(true);
    setError(null);
    void window.eumStudio.schedule
      .setCompletion({
        schemaVersion: 1,
        workId: work.workId,
        itemId: occurrence.itemId,
        expectedRevision: item.revision,
        date: occurrence.date,
        completed: !occurrence.completed,
      })
      .then(
        () => {
          setActionBusy(false);
          setLoading(true);
          load();
        },
        (reason: unknown) => {
          setActionBusy(false);
          setError(reason instanceof Error ? reason.message : "완료 상태를 저장하지 못했습니다.");
        },
      );
  }

  return (
    <section className="schedule-dashboard" aria-labelledby="schedule-dashboard-title">
      <header className="schedule-dashboard-header">
        <div>
          <p className="panel-kicker">WORK SCHEDULE</p>
          <h2 id="schedule-dashboard-title">일정</h2>
          <p>{work.title}의 일정만 표시합니다.</p>
          {projection !== null && (
            <p className="schedule-episode-basis">
              글자 수 환산 1회차 기준 {projection.episodeProgress.defaultEpisodeCharacters.toLocaleString()}자
            </p>
          )}
        </div>
        <div className="schedule-quick-actions">
          <button disabled={actionBusy} onClick={() => openCreate("task")} type="button">
            <Plus aria-hidden="true" size={14} /> 일정
          </button>
          <button disabled={actionBusy} onClick={() => openCreate("routine")} type="button">
            <Repeat2 aria-hidden="true" size={14} /> 루틴
          </button>
          <button disabled={actionBusy} onClick={() => openCreate("dday")} type="button">
            <CalendarDays aria-hidden="true" size={14} /> D-DAY
          </button>
        </div>
      </header>

      <div className="schedule-dashboard-grid">
        <div className="schedule-calendar-panel">
          <header>
            <button
              aria-label="이전 달"
              onClick={() => {
                const next = moveCalendarMonth(monthKey, -1);
                setProjection(null);
                setLoading(true);
                setError(null);
                setMonthKey(next.monthKey);
                setSelectedDate(next.selectedDate);
              }}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <strong>{monthLabel(monthKey)}</strong>
            <button
              aria-label="다음 달"
              onClick={() => {
                const next = moveCalendarMonth(monthKey, 1);
                setProjection(null);
                setLoading(true);
                setError(null);
                setMonthKey(next.monthKey);
                setSelectedDate(next.selectedDate);
              }}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </header>
          <div className="schedule-weekdays" aria-hidden="true">
            {weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`}>{weekday}</span>
            ))}
          </div>
          <div className="schedule-calendar-grid" role="grid">
            {calendar.cells.map((cell) => {
              const count = occurrenceCounts.get(cell.date) ?? 0;
              return (
                <button
                  aria-label={`${dateLabel(cell.date)}${count > 0 ? ` 일정 ${count}개` : ""}`}
                  className={[
                    cell.inMonth ? "" : "is-outside",
                    cell.date === today ? "is-today" : "",
                    cell.date === selectedDate ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={cell.date}
                  onClick={() => {
                    setSelectedDate(cell.date);
                    if (!cell.inMonth) {
                      setProjection(null);
                      setLoading(true);
                      setError(null);
                      setMonthKey(cell.date.slice(0, 7));
                    }
                  }}
                  role="gridcell"
                  type="button"
                >
                  <span>{cell.day}</span>
                  {count > 0 && <i>{count}</i>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="schedule-agenda-panel">
          <header>
            <div>
              <span>{selectedDate === today ? "오늘" : "선택한 날"}</span>
              <strong>{dateLabel(selectedDate)}</strong>
            </div>
            <button aria-label="선택한 날짜에 일정 추가" onClick={() => openCreate("task")} type="button">
              <Plus aria-hidden="true" size={15} />
            </button>
          </header>
          {loading ? (
            <p className="schedule-empty">일정을 불러오는 중입니다.</p>
          ) : selectedOccurrences.length === 0 && selectedDdays.length === 0 ? (
            <p className="schedule-empty">이 날짜에는 일정이 없습니다.</p>
          ) : (
            <div className="schedule-agenda-list">
              {selectedOccurrences.map((occurrence) =>
                occurrence.kind === "document-completion" ? (
                  <div
                    className="is-completed schedule-document-completion"
                    key={occurrence.occurrenceId}
                  >
                    <span
                      aria-hidden="true"
                      className="schedule-completion-button schedule-completion-fact-mark"
                    >
                      <Check size={13} />
                    </span>
                    <div className="schedule-agenda-content">
                      <strong>{occurrence.label}</strong>
                      <span>
                        {occurrence.state === "current"
                          ? "완료 당시 원고와 같음"
                          : "완료 후 수정됨"}
                      </span>
                      <div className="schedule-document-completion-actions">
                        <button
                          disabled={actionBusy || onOpenDocument === undefined}
                          onClick={() => onOpenDocument?.(occurrence.documentId)}
                          type="button"
                        >
                          현재 {occurrence.documentTitle} 열기
                        </button>
                        <button
                          disabled={
                            actionBusy || onOpenCompletedRevision === undefined
                          }
                          onClick={() => onOpenCompletedRevision?.(
                            occurrence.documentId,
                            occurrence.completedDocumentRevisionId,
                          )}
                          type="button"
                        >
                          완료 당시 버전 보기
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={occurrence.completed ? "is-completed" : ""}
                    key={occurrence.occurrenceId}
                  >
                    <button
                      aria-label={`${occurrence.label} ${occurrence.completed ? "완료 취소" : "완료"}`}
                      className="schedule-completion-button"
                      disabled={actionBusy}
                      onClick={() => toggleCompletion(occurrence)}
                      type="button"
                    >
                      {occurrence.completed && <Check aria-hidden="true" size={13} />}
                    </button>
                    <button
                      className="schedule-agenda-content"
                      onClick={() => {
                        const item = items.find(
                          (candidate) => candidate.itemId === occurrence.itemId,
                        );
                        if (item !== undefined) openEdit(item);
                      }}
                      type="button"
                    >
                      <strong>{occurrence.label}</strong>
                      <span>
                        {occurrence.kind === "routine" ? "루틴" : "일정"}
                        {occurrence.time === null ? "" : ` · ${occurrence.time}`}
                      </span>
                    </button>
                  </div>
                ),
              )}
              {selectedDdays.map((item) => (
                <button className="schedule-day-dday" key={item.itemId} onClick={() => openEdit(item)} type="button">
                  <strong>{item.label}</strong>
                  <span>{formatDdayDistance(item.date, today)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="schedule-dday-panel">
          <header>
            <span>D-DAY</span>
            <strong>{ddays.length}개</strong>
          </header>
          {ddays.length === 0 ? (
            <button className="schedule-empty-action" onClick={() => openCreate("dday")} type="button">
              마감을 추가하세요
            </button>
          ) : (
            <div className="schedule-dday-list">
              {ddays.map((item) => (
                <button key={item.itemId} onClick={() => openEdit(item)} type="button">
                  <span>{formatDdayDistance(item.date, today)}</span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.date}
                    {item.time === null ? "" : ` ${item.time}`} · {workloadSummary(item.workload)}
                  </small>
                  {projection !== null &&
                    formatDdayProgress(
                      item.workload,
                      projection.episodeProgress,
                      projection.completedDocumentCount,
                    ) !== null && (
                      <small className="schedule-dday-progress">
                        {formatDdayProgress(
                          item.workload,
                          projection.episodeProgress,
                          projection.completedDocumentCount,
                        )}
                      </small>
                    )}
                  <Pencil aria-hidden="true" size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error !== null && editor === null && (
        <p className="schedule-error" role="alert">{error}</p>
      )}
      {editor !== null && (
        <ScheduleItemDialog
          busy={actionBusy}
          completedDocumentCount={projection?.completedDocumentCount ?? 0}
          error={error}
          initialDate={selectedDate}
          onClose={() => {
            if (!actionBusy) {
              setEditor(null);
              setError(null);
            }
          }}
          onRetire={editor.mode === "edit" ? retireItem : null}
          onSave={saveItem}
          state={editor}
        />
      )}
    </section>
  );
}
