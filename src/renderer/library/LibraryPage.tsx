import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  Archive,
  Building2,
  ChevronRight,
  Download,
  MoreHorizontal,
  Search,
} from "lucide-react";

import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkCoverProjection } from "../../application/workspace/work-covers";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { ManuscriptResumePreview } from "../App";
import { deriveWorkScheduleSummary } from "../schedule/work-schedule-summary";
import { TodaySchedulePanel } from "../today/TodaySchedulePanel";
import { WorkCard } from "./WorkCard";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LibraryPage({
  catalog,
  favoriteWorkIds,
  workCovers,
  resumePreview,
  scheduleByWork,
  busy,
  backupBusy,
  importBusy,
  error,
  onOpenBackup,
  onCreate,
  onOpenImport,
  onOpenPublishing,
  onOpenCompletedRevision,
  onOpenSchedule,
  onOpen,
  onRename,
  onRetire,
  onToggleFavorite,
  onSelectCover,
}: {
  readonly catalog: WorkspaceCatalogProjection;
  readonly favoriteWorkIds: readonly EntityId<"Work">[];
  readonly workCovers: readonly WorkCoverProjection[];
  readonly resumePreview: ManuscriptResumePreview | null;
  readonly scheduleByWork: Readonly<Record<string, WorkCalendarProjection>>;
  readonly busy: boolean;
  readonly error: string | null;
  readonly backupBusy: boolean;
  readonly importBusy: boolean;
  readonly onOpenBackup: () => void;
  readonly onCreate?: () => void;
  readonly onOpenImport: () => void;
  readonly onOpenPublishing: () => void;
  readonly onOpenCompletedRevision: (
    work: WorkspaceWorkSummary,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ) => void;
  readonly onOpenSchedule: (work: WorkspaceWorkSummary) => void;
  readonly onOpen: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"] | null,
  ) => void;
  readonly onRetire: (work: WorkspaceWorkSummary) => void;
  readonly onRename: (work: WorkspaceWorkSummary) => void;
  readonly onToggleFavorite: (work: WorkspaceWorkSummary) => void;
  readonly onSelectCover: (work: WorkspaceWorkSummary) => void;
  readonly onRetireDocument: (
    work: WorkspaceWorkSummary,
    document: WorkspaceWorkSummary["documents"][number],
  ) => void;
  readonly onMoveDocument: (
    work: WorkspaceWorkSummary,
    document: WorkspaceWorkSummary["documents"][number],
    direction: "earlier" | "later",
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [workView, setWorkView] = useState<"all" | "favorites">("all");
  const [showLibraryTools, setShowLibraryTools] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const favoriteWorkIdSet = useMemo(
    () => new Set(favoriteWorkIds),
    [favoriteWorkIds],
  );
  const workCoverById = useMemo(
    () => new Map(workCovers.map((cover) => [cover.workId, cover] as const)),
    [workCovers],
  );
  const filteredWorks = useMemo(
    () => {
      const works =
        workView === "favorites"
          ? catalog.works.filter((work) => favoriteWorkIdSet.has(work.workId))
          : catalog.works;
      return normalizedQuery.length === 0
        ? works
        : works.filter(
            (work) =>
              work.title.toLocaleLowerCase().includes(normalizedQuery) ||
              work.documents.some((document) =>
                document.title.toLocaleLowerCase().includes(normalizedQuery),
              ),
          );
    },
    [catalog.works, favoriteWorkIdSet, normalizedQuery, workView],
  );
  const activeWork = catalog.works.find(
    (work) => work.workId === catalog.activeWorkId,
  );
  const activeDocument = activeWork?.documents.find(
    (document) => document.documentId === catalog.activeDocumentId,
  );
  const activeResumePreview =
    activeWork !== undefined &&
    activeDocument !== undefined &&
    resumePreview?.workId === activeWork.workId &&
    resumePreview.documentId === activeDocument.documentId
      ? resumePreview
      : null;
  const schedules = catalog.works.flatMap((work) => {
    const projection = scheduleByWork[work.workId];
    return projection === undefined ? [] : [{ work, projection }];
  });

  return (
    <div
      data-layout="eum-studio-library"
      className="library-home"
    >
      {activeWork !== undefined && (
        <section className="resume-strip" aria-labelledby="resume-strip-heading">
          <div className="resume-strip-copy">
            <p className="resume-strip-label" id="resume-strip-heading">마지막 작업</p>
            <div className="resume-strip-location">
              <strong>{activeWork.title}</strong>
              {activeDocument !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activeDocument.title}</span>
                </>
              )}
            </div>
            <time dateTime={activeWork.updatedAt}>
              {formatUpdatedAt(activeWork.updatedAt)}
            </time>
            {activeResumePreview !== null && (
              <div
                aria-label="마지막 원고 미리보기"
                className="resume-strip-preview"
                data-content-width={
                  activeResumePreview.formatting.contentWidthPx
                }
                data-font-size={activeResumePreview.formatting.fontSizePx}
                data-letter-spacing={
                  activeResumePreview.formatting.letterSpacingEm
                }
                data-line-height={activeResumePreview.formatting.lineHeight}
                data-paragraph-spacing={
                  activeResumePreview.formatting.paragraphSpacingPx
                }
                style={{
                  "--resume-paragraph-spacing": `${activeResumePreview.formatting.paragraphSpacingPx}px`,
                  fontFamily: activeResumePreview.formatting.fontFamily,
                  fontSize: `${activeResumePreview.formatting.fontSizePx}px`,
                  letterSpacing: `${activeResumePreview.formatting.letterSpacingEm}em`,
                  lineHeight: activeResumePreview.formatting.lineHeight,
                  maxWidth: `${activeResumePreview.formatting.contentWidthPx}px`,
                } as CSSProperties}
              >
                {activeResumePreview.text.split("\n").map((line, index) => (
                  <span className="resume-strip-preview-line" key={index}>
                    {line.length === 0 ? <br aria-hidden="true" /> : line}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            className="resume-strip-action"
            disabled={busy}
            onClick={() =>
              onOpen(
                activeWork.workId,
                activeDocument?.documentId ??
                  activeWork.documents[0]?.documentId ??
                  null,
              )
            }
            type="button"
          >
            이어쓰기
            <ChevronRight aria-hidden="true" size={15} />
          </button>
        </section>
      )}

      <TodaySchedulePanel
        disabled={busy}
        onOpenCalendar={
          activeWork === undefined
            ? null
            : () => onOpenSchedule(activeWork)
        }
        onOpenDocument={(work, documentId) =>
          onOpen(work.workId, documentId)
        }
        onOpenCompletedRevision={onOpenCompletedRevision}
        onOpenSchedule={onOpenSchedule}
        schedules={schedules}
      />

      <section className="library-section" aria-labelledby="library-heading">
        <header className="library-heading-row">
          <div className="library-title-group">
            <h2 id="library-heading">작품</h2>
            <div className="library-tabs" aria-label="작품 보기">
              <button
                aria-pressed={workView === "all"}
                className={workView === "all" ? "is-active" : undefined}
                onClick={() => setWorkView("all")}
                type="button"
              >
                전체 {catalog.works.length}
              </button>
              <button
                aria-pressed={workView === "favorites"}
                className={workView === "favorites" ? "is-active" : undefined}
                onClick={() => setWorkView("favorites")}
                type="button"
              >
                즐겨찾기 {favoriteWorkIds.length}
              </button>
            </div>
          </div>
          <div className="library-actions">
            {catalog.works.length > 0 && (
              <label className="work-search">
                <Search aria-hidden="true" size={16} />
                <span className="visually-hidden">작품과 회차 검색</span>
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="작품·회차 검색"
                  type="search"
                  value={query}
                />
              </label>
            )}
            <span className="library-sort-label">최근 편집순</span>
            <button className="secondary-button library-backup-shortcut" disabled={busy || backupBusy} onClick={onOpenBackup} type="button">
              <Archive aria-hidden="true" size={15} /> 백업·복원
            </button>
            <button
              aria-expanded={showLibraryTools}
              aria-label="작품 도구 열기"
              className="secondary-button library-more-button"
              disabled={busy}
              onClick={() => setShowLibraryTools((current) => !current)}
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={18} />
              <span>작품 관리</span>
            </button>
            {showLibraryTools && (
              <div aria-label="작품 도구" className="library-tools-menu" role="menu">
                <button
                  className="backup-button"
                  disabled={busy || backupBusy}
                  onClick={() => {
                    setShowLibraryTools(false);
                    onOpenBackup();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Archive aria-hidden="true" size={15} />
                  백업
                </button>
                <button
                  className="publishing-button"
                  disabled={busy}
                  onClick={() => {
                    setShowLibraryTools(false);
                    onOpenPublishing();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Building2 aria-hidden="true" size={15} />
                  투고 운영
                </button>
                <button
                  className="import-button"
                  disabled={busy || importBusy}
                  onClick={() => {
                    setShowLibraryTools(false);
                    onOpenImport();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Download aria-hidden="true" size={15} />
                  가져오기
                </button>
              </div>
            )}
          </div>
        </header>

        {error !== null && (
          <p className="shell-action-error" role="alert">
            {error}
          </p>
        )}

        {filteredWorks.length === 0 ? (
          catalog.works.length === 0 ? (
            <section className="library-first-work" aria-label="작업실 시작하기">
              <h3>첫 작품을 시작해 보세요.</h3>
              <p>작품을 만들면 회차를 나누어 쓰고, 인물과 설정을 함께 정리할 수 있습니다.</p>
              <div>
                {onCreate !== undefined && <button className="primary-button" disabled={busy} onClick={onCreate} type="button">첫 작품 만들기</button>}
                <button className="secondary-button" disabled={busy || importBusy} onClick={onOpenImport} type="button">기존 데이터 가져오기</button>
              </div>
            </section>
          ) :
          <p className="empty-search-result">
            {normalizedQuery.length > 0
              ? "검색 결과가 없습니다."
              : workView === "favorites"
                ? "즐겨찾기한 작품이 없습니다."
                : "작품이 없습니다."}
          </p>
        ) : (
          <div className="library-work-list">
            {filteredWorks.map((work) => {
              const scheduleProjection = scheduleByWork[work.workId];
              return (
                <WorkCard
                activeDocumentId={
                  work.workId === catalog.activeWorkId
                    ? catalog.activeDocumentId
                    : null
                }
                disabled={busy}
                favorite={favoriteWorkIdSet.has(work.workId)}
                cover={workCoverById.get(work.workId) ?? null}
                key={work.workId}
                onOpen={onOpen}
                onOpenSchedule={onOpenSchedule}
                onRename={onRename}
                onRetire={onRetire}
                onToggleFavorite={onToggleFavorite}
                onSelectCover={onSelectCover}
                schedule={scheduleProjection === undefined
                  ? null
                  : deriveWorkScheduleSummary(scheduleProjection)}
                work={work}
                />
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
