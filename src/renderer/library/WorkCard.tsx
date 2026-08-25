import {
  CalendarDays,
  ChevronRight,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";

import type { WorkCoverProjection } from "../../application/workspace/work-covers";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type { WorkHeaderScheduleSummary } from "../workspace/WorkHeader";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WorkCard({
  work,
  activeDocumentId,
  favorite,
  cover,
  disabled,
  onOpen,
  onOpenSchedule,
  onRename,
  onRetire,
  onToggleFavorite,
  onSelectCover,
  schedule,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly activeDocumentId:
    WorkspaceWorkSummary["documents"][number]["documentId"] | null;
  readonly favorite: boolean;
  readonly cover: WorkCoverProjection | null;
  readonly disabled: boolean;
  readonly schedule: WorkHeaderScheduleSummary | null;
  readonly onOpen: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"] | null,
  ) => void;
  readonly onOpenSchedule: (work: WorkspaceWorkSummary) => void;
  readonly onRetire: (work: WorkspaceWorkSummary) => void;
  readonly onRename: (work: WorkspaceWorkSummary) => void;
  readonly onToggleFavorite: (work: WorkspaceWorkSummary) => void;
  readonly onSelectCover: (work: WorkspaceWorkSummary) => void;
}) {
  return (
    <article className="library-work-card">
      <header>
        <div className="work-cover-column">
          <button
            aria-label={`${work.title} 표지 이미지 등록`}
            className="work-cover"
            disabled={disabled}
            onClick={() => onSelectCover(work)}
            title="표지 이미지 등록"
            type="button"
          >
            {cover === null ? (
              <span className="work-cover-placeholder" aria-hidden="true">
                {work.title.slice(0, 1)}
              </span>
            ) : (
              <img
                alt=""
                className="work-cover-image"
                src={`data:${cover.mediaType};base64,${cover.contentBase64}`}
              />
            )}
          </button>
          <button
            aria-label={`${work.title} ${favorite ? "즐겨찾기 해제" : "즐겨찾기"}`}
            aria-pressed={favorite}
            className={
              favorite
                ? "work-favorite-button is-active"
                : "work-favorite-button"
            }
            disabled={disabled}
            onClick={() => onToggleFavorite(work)}
            title={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
            type="button"
          >
            <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} size={15} />
          </button>
          <div className="work-cover-actions">
            <button
              aria-label={`${work.title} 작품 이름 변경`}
              className="work-rename-button"
              disabled={disabled}
              onClick={() => onRename(work)}
              title="작품 이름 변경"
              type="button"
            >
              <Pencil aria-hidden="true" size={14} />
            </button>
            <button
              aria-label={`${work.title} 작품 삭제`}
              className="work-retire-button"
              disabled={disabled}
              onClick={() => onRetire(work)}
              title="작품 삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
        <button
          aria-label={`${work.title} 작품 열기`}
          className="work-card-heading"
          disabled={disabled}
          onClick={() =>
            onOpen(
              work.workId,
              activeDocumentId ?? work.documents[0]?.documentId ?? null,
            )
          }
          type="button"
        >
          <span>
            <strong className="work-card-title">{work.title}</strong>
            <p className="continue-description">
              {formatUpdatedAt(work.updatedAt)}
            </p>
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        <div className="work-card-actions">
          <button
            aria-label={`${work.title} 일정 열기`}
            className="work-schedule-summary"
            disabled={disabled}
            onClick={() => onOpenSchedule(work)}
            type="button"
          >
            <CalendarDays aria-hidden="true" size={14} />
            <span>{`오늘 ${schedule?.todayCount ?? 0}`}</span>
            {schedule?.nearestDday !== null &&
              schedule?.nearestDday !== undefined && (
                <span title={schedule.nearestDday.label}>
                  {schedule.nearestDday.days === 0
                    ? "D-DAY"
                    : `D-${schedule.nearestDday.days}`}
                </span>
              )}
          </button>
          <select
            aria-label={`${work.title} 회차 선택`}
            className="work-document-select"
            disabled={disabled || work.documents.length === 0}
            onChange={(event) => {
              const document = work.documents.find(
                (candidate) => candidate.documentId === event.currentTarget.value,
              );
              if (document !== undefined) {
                onOpen(work.workId, document.documentId);
              }
            }}
            value={activeDocumentId ?? ""}
          >
            <option disabled value="">
              {work.documents.length === 0
                ? "회차 없음"
                : `${work.documents.length}개 회차`}
            </option>
            {work.documents.map((document) => (
              <option key={document.documentId} value={document.documentId}>
                {document.title}
              </option>
            ))}
          </select>
        </div>
      </header>
    </article>
  );
}
