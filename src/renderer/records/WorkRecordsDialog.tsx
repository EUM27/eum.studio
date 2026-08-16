import { useMemo, useState } from "react";

import {
  deriveWorkRecordsOverview,
  type WorkRecordsOverviewProjection,
} from "../../application/activity/work-records-overview";
import type { WorkActivityProjection } from "../../application/activity/work-activity-contract";
import type { WorkRecordsExportFormat } from "../../application/activity/work-records-export";
import {
  deriveWorkRecordsGoalProgress,
  type WorkRecordsGoals,
  type WorkRecordsGoalsProjection,
} from "../../application/activity/work-records-preferences";
import {
  deriveWorkReadthrough,
  type WorkReadthroughEntry,
  type WorkReadthroughProjection,
  type WorkReadthroughRate,
} from "../../application/activity/work-readthrough-calculator";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localWeekStartDateKey(nowMs: number): string {
  const date = new Date(nowMs);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return localDateKey(date.toISOString());
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

function formatCharacterDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}자`;
}

function formatSessionDelta(
  session: WorkRecordsOverviewProjection["sessions"][number],
): string {
  return session.characterDelta === null
    ? "글자 변화 미측정"
    : formatCharacterDelta(session.characterDelta);
}

function readOptionalGoal(
  formData: FormData,
  field: keyof WorkRecordsGoals,
): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (raw.length === 0) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function goalProgressText(input: {
  readonly value: number;
  readonly target: number | null;
  readonly unit: "분" | "자";
}): string {
  if (input.target === null) return "설정 안 함";
  const value =
    input.unit === "자" && input.value >= 0
      ? `+${input.value}`
      : String(input.value);
  return `${value} / ${input.target}${input.unit}`;
}

function readOptionalReaderCount(formData: FormData, documentId: string): number | null {
  const raw = String(formData.get(`readerCount:${documentId}`) ?? "").trim();
  if (raw.length === 0) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function readthroughRateText(rate: WorkReadthroughRate): string {
  if (rate.status === "baseline") return "기준 회차";
  if (rate.status === "missing") return "미입력";
  if (rate.status === "unavailable") return "계산 불가";
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(rate.percent ?? 0)}%`;
}

export function WorkRecordsDialog(input: {
  readonly activity: WorkActivityProjection;
  readonly busy: boolean;
  readonly error: string | null;
  readonly exportActionState: "idle" | "exporting-json" | "exporting-csv";
  readonly exportError: string | null;
  readonly exportMessage: string | null;
  readonly goalActionState: "loading" | "idle" | "saving";
  readonly goalError: string | null;
  readonly goalSettings: WorkRecordsGoalsProjection | null;
  readonly nowMs: number;
  readonly onClose: () => void;
  readonly onExport: (input: {
    readonly format: WorkRecordsExportFormat;
    readonly fromDate: string;
    readonly toDate: string;
  }) => void;
  readonly onOpenDocument: (documentId: EntityId<"Document">) => void;
  readonly onSaveGoals: (goals: WorkRecordsGoals) => void;
  readonly onSaveReadthrough: (entries: readonly WorkReadthroughEntry[]) => void;
  readonly readthroughActionState: "loading" | "idle" | "saving";
  readonly readthroughError: string | null;
  readonly readthroughSettings: WorkReadthroughProjection | null;
  readonly work: WorkspaceWorkSummary;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const today = localDateKey(new Date(input.nowMs).toISOString());
  const weekStart = localWeekStartDateKey(input.nowMs);
  const projection = useMemo(
    () =>
      deriveWorkRecordsOverview({
        workId: input.work.workId,
        workTitle: input.work.title,
        documents: input.work.documents.map((document) => ({
          documentId: document.documentId,
          title: document.title,
        })),
        activity: input.activity,
        filter: { fromDate, toDate },
        calendar: { today, dateKey: localDateKey },
      }),
    [fromDate, input.activity, input.work, toDate, today],
  );
  const goalProgress = useMemo(
    () =>
      input.goalSettings === null
        ? null
        : deriveWorkRecordsGoalProgress({
            workId: input.work.workId,
            activity: input.activity,
            settings: input.goalSettings,
            calendar: { today, weekStart, dateKey: localDateKey },
          }),
    [
      input.activity,
      input.goalSettings,
      input.work.workId,
      today,
      weekStart,
    ],
  );
  const readthrough = useMemo(
    () =>
      input.readthroughSettings === null
        ? null
        : deriveWorkReadthrough({
            workId: input.work.workId,
            documents: input.work.documents.map((document) => ({
              documentId: document.documentId,
              title: document.title,
            })),
            settings: input.readthroughSettings,
          }),
    [input.readthroughSettings, input.work],
  );

  return (
    <div className="dialog-backdrop records-dialog-backdrop" role="presentation">
      <section
        aria-labelledby="work-records-heading"
        aria-modal="true"
        className="records-dialog"
        role="dialog"
      >
        <header className="records-dialog-header">
          <div>
            <p className="panel-kicker">WRITING RECORDS</p>
            <h2 id="work-records-heading">집필 기록 상세</h2>
            <p>{projection.workTitle}</p>
          </div>
          <button
            aria-label="집필 기록 상세 닫기"
            className="dialog-close"
            disabled={input.busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="records-date-filter" aria-label="집필 기록 기간">
          <label>
            <span>기록 시작일</span>
            <input
              disabled={input.busy}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              type="date"
              value={fromDate}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            <span>기록 종료일</span>
            <input
              disabled={input.busy}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              type="date"
              value={toDate}
            />
          </label>
          <button
            disabled={input.busy || (fromDate.length === 0 && toDate.length === 0)}
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            type="button"
          >
            전체 기간
          </button>
        </div>

        <section aria-label="집필 기록 내보내기" className="records-export">
          <div>
            <strong>기록 내보내기</strong>
            <span>현재 작품과 선택한 기간의 세션만 포함합니다.</span>
          </div>
          <div className="records-export-actions">
            {(["json", "csv"] as const).map((format) => (
              <button
                disabled={input.busy || input.exportActionState !== "idle"}
                key={format}
                onClick={() => input.onExport({ format, fromDate, toDate })}
                type="button"
              >
                {input.exportActionState === `exporting-${format}`
                  ? "내보내는 중"
                  : `${format.toUpperCase()} 내보내기`}
              </button>
            ))}
          </div>
          {input.exportMessage !== null && (
            <p aria-live="polite" className="records-export-message">
              {input.exportMessage}
            </p>
          )}
          {input.exportError !== null && (
            <p className="dialog-error" role="alert">
              {input.exportError}
            </p>
          )}
        </section>

        <section aria-label="집필 기록 합계" className="records-metrics">
          <div data-testid="records-total-sessions">
            <span>세션</span>
            <strong>{projection.totals.sessionCount}회</strong>
          </div>
          <div data-testid="records-total-duration">
            <span>작업 시간</span>
            <strong>{formatDuration(projection.totals.activeDurationMs)}</strong>
          </div>
          <div data-testid="records-total-delta">
            <span>글자 변화</span>
            <strong>
              {projection.totals.characterDeltaKnownCount === 0
                ? "측정 전"
                : formatCharacterDelta(projection.totals.characterDelta)}
            </strong>
          </div>
          <div data-testid="records-total-focus">
            <span>집중 기록</span>
            <strong>{projection.totals.focusCycleCount}회</strong>
          </div>
        </section>

        <section aria-label="연속 집필 기록" className="records-streak">
          <div>
            <span>연속 집필</span>
            <strong>현재 {projection.streak.currentDays}일</strong>
          </div>
          <div>
            <span>작품 최장</span>
            <strong>최장 {projection.streak.longestDays}일</strong>
          </div>
        </section>

        <section aria-label="집필 목표" className="records-goals">
          <header>
            <div>
              <h3>집필 목표</h3>
              <span>집중은 뽀모도로 작업 단계, 글자는 집필 기록에서 자동 집계합니다.</span>
            </div>
            {input.goalActionState === "loading" && <span>불러오는 중</span>}
          </header>
          {input.goalSettings !== null && goalProgress !== null && (
            <form
              key={input.goalSettings.revision}
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                input.onSaveGoals({
                  dailyActiveMinutes: readOptionalGoal(
                    formData,
                    "dailyActiveMinutes",
                  ),
                  dailyCharacters: readOptionalGoal(formData, "dailyCharacters"),
                  weeklyActiveMinutes: readOptionalGoal(
                    formData,
                    "weeklyActiveMinutes",
                  ),
                  weeklyCharacters: readOptionalGoal(
                    formData,
                    "weeklyCharacters",
                  ),
                });
              }}
            >
              {([
                [
                  "오늘 집중",
                  "dailyActiveMinutes",
                  goalProgress.dailyActiveMinutes,
                  "분",
                ],
                [
                  "오늘 글자",
                  "dailyCharacters",
                  goalProgress.dailyCharacters,
                  "자",
                ],
                [
                  "이번 주 집중",
                  "weeklyActiveMinutes",
                  goalProgress.weeklyActiveMinutes,
                  "분",
                ],
                [
                  "이번 주 글자",
                  "weeklyCharacters",
                  goalProgress.weeklyCharacters,
                  "자",
                ],
              ] as const).map(([label, field, progress, unit]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    defaultValue={input.goalSettings?.goals[field] ?? ""}
                    disabled={input.busy || input.goalActionState !== "idle"}
                    min="1"
                    name={field}
                    step="1"
                    type="number"
                  />
                  <strong>{goalProgressText({ ...progress, unit })}</strong>
                  <progress
                    max={progress.target ?? 1}
                    value={
                      progress.target === null
                        ? 0
                        : Math.min(Math.max(0, progress.value), progress.target)
                    }
                  />
                </label>
              ))}
              <button
                disabled={input.busy || input.goalActionState !== "idle"}
                type="submit"
              >
                {input.goalActionState === "saving" ? "저장 중" : "목표 저장"}
              </button>
            </form>
          )}
          {input.goalError !== null && (
            <p className="dialog-error" role="alert">{input.goalError}</p>
          )}
        </section>

        <div className="records-dialog-body">
        <section aria-label="연독률 계산기" className="records-readthrough">
          <header>
            <div>
              <h3>연독률 계산기</h3>
              <span>회차별 조회수를 이 작품에 로컬 저장합니다.</span>
            </div>
            {input.readthroughActionState === "loading" && <span>불러오는 중</span>}
          </header>
          {input.readthroughSettings !== null && readthrough !== null && (
            <form
              key={input.readthroughSettings.revision}
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                input.onSaveReadthrough(
                  readthrough.rows.map((row) => ({
                    documentId: row.documentId,
                    readerCount: readOptionalReaderCount(
                      formData,
                      row.documentId,
                    ),
                  })),
                );
              }}
            >
              <div className="records-readthrough-table" role="table">
                <div className="records-readthrough-row is-heading" role="row">
                  <span role="columnheader">회차</span>
                  <span role="columnheader">조회수</span>
                  <span role="columnheader">직전 화 대비</span>
                  <span role="columnheader">1화 대비</span>
                </div>
                {readthrough.rows.map((row) => (
                  <label
                    className="records-readthrough-row"
                    key={row.documentId}
                    role="row"
                  >
                    <strong role="cell">{row.title}</strong>
                    <input
                      aria-label={`${row.title} 조회수`}
                      defaultValue={row.readerCount ?? ""}
                      disabled={
                        input.busy || input.readthroughActionState !== "idle"
                      }
                      min="0"
                      name={`readerCount:${row.documentId}`}
                      step="1"
                      type="number"
                    />
                    <span role="cell">
                      {readthroughRateText(row.adjacentRate)}
                    </span>
                    <span role="cell">
                      {readthroughRateText(row.firstEpisodeRate)}
                    </span>
                  </label>
                ))}
              </div>
              <button
                disabled={
                  input.busy || input.readthroughActionState !== "idle"
                }
                type="submit"
              >
                {input.readthroughActionState === "saving"
                  ? "저장 중"
                  : "연독률 저장"}
              </button>
            </form>
          )}
          {input.readthroughError !== null && (
            <p className="dialog-error" role="alert">
              {input.readthroughError}
            </p>
          )}
        </section>

          <section className="records-detail-panel records-daily-panel">
            <header>
              <h3>일별 흐름</h3>
              <span>{projection.days.length}일</span>
            </header>
            {projection.days.length === 0 ? (
              <p className="records-empty">선택한 기간의 집필 기록이 없습니다.</p>
            ) : (
              <ol>
                {projection.days.map((day) => (
                  <li key={day.date}>
                    <time dateTime={day.date}>{day.date}</time>
                    <span>{day.sessionCount}회</span>
                    <span>{formatDuration(day.activeDurationMs)}</span>
                    <strong>{formatCharacterDelta(day.characterDelta)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="records-detail-panel records-document-panel">
            <header>
              <h3>회차별 기록</h3>
              <span>{projection.documents.length}개 회차</span>
            </header>
            {projection.documents.length === 0 ? (
              <p className="records-empty">이 작품에 회차가 없습니다.</p>
            ) : (
              <ul>
                {projection.documents.map((document) => (
                  <li key={document.documentId}>
                    <button
                      aria-label={`${document.title} 기록 회차 열기`}
                      disabled={input.busy}
                      onClick={() => input.onOpenDocument(document.documentId)}
                      type="button"
                    >
                      <strong>{document.title}</strong>
                      <span>{document.sessionCount}회</span>
                      <span>{formatDuration(document.activeDurationMs)}</span>
                      <span>
                        {document.characterDeltaKnownCount === 0
                          ? "변화 미측정"
                          : formatCharacterDelta(document.characterDelta)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="records-detail-panel records-session-panel">
            <header>
              <h3>최근 세션</h3>
              <span>{projection.sessions.length}회</span>
            </header>
            {projection.sessions.length === 0 ? (
              <p className="records-empty">선택한 기간의 세션이 없습니다.</p>
            ) : (
              <ul>
                {projection.sessions.map((session) => (
                  <li key={session.sessionId}>
                    <button
                      disabled={input.busy || session.documentId === null}
                      onClick={() => {
                        if (session.documentId !== null) {
                          input.onOpenDocument(session.documentId);
                        }
                      }}
                      type="button"
                    >
                      <span>
                        <strong>{session.documentTitle ?? "연결된 회차 없음"}</strong>
                        <time dateTime={session.startedAt}>{session.date}</time>
                      </span>
                      <span>{formatDuration(session.activeDurationMs)}</span>
                      <span>{formatSessionDelta(session)}</span>
                      {session.note.length > 0 && <small>{session.note}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {input.error !== null && (
          <p className="dialog-error" role="alert">{input.error}</p>
        )}
      </section>
    </div>
  );
}
