import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  Archive,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  Home,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";

import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../application/workspace/workspace-contract";
import type {
  WorkCoverProjection,
} from "../application/workspace/work-covers";
import type {
  LocalWorkspaceBackupStatusProjection,
} from "../application/storage/local-workspace-backup-contract";
import type {
  LegacyLoreImportRehearsalSummary,
} from "../application/migration/legacy-lore-import-contract";
import {
  App as ManuscriptWorkspace,
  type ManuscriptWorkspaceHandle,
  type ManuscriptResumePreview,
} from "./App";
import {
  QUICK_TOOL_CREATE_WORK_COMMAND_ID,
  QUICK_TOOL_MAIN_COMMAND_ID,
  QuickToolsDialog,
} from "./quick-tools/QuickToolsDialog";
import type { QuickToolTarget } from "../application/quick-tools/quick-tool-search";
import type {
  AppSettingsProfile,
  AppSettingsProjection,
} from "../application/settings/app-settings";
import type {
  MusicSettingsProfile,
  WorkMusicSettingsProjection,
} from "../application/music/work-music-settings";
import type { YouTubeMusicConnectionStatus } from "../application/music/youtube-music-connection";
import type { ChatGptOAuthConnectionStatus } from "../application/assistant/chatgpt-oauth";
import {
  DEFAULT_FOCUS_MODE_PREFERENCES,
  type FocusModePreferences,
  type UiPreferencesProjection,
} from "../application/settings/ui-preferences";
import {
  AppSettingsDialog,
  type AppSettingsSaveValue,
} from "./settings/AppSettingsDialog";
import { StudioAppShell } from "./shell/StudioAppShell";
import { StarlightThemePicker } from "./theme/StarlightThemePicker";
import {
  parseStarlightThemeKey,
  STARLIGHT_THEMES,
  STARLIGHT_THEME_STORAGE_KEY,
  type StarlightThemeKey,
} from "./theme/starlight-theme";
import type {
  PublishingPartnerProjection,
  UpdatePublishingPartnerCommand,
} from "../application/publishing/publishing-partner-contract";
import type {
  PublishingSubmissionProjection,
  UpdatePublishingSubmissionCommand,
} from "../application/publishing/publishing-submission-contract";
import type {
  PublishingContractProjection,
  UpdatePublishingContractCommand,
} from "../application/publishing/publishing-contract-contract";
import type {
  PublishingPublicationProjection,
  UpdatePublishingPublicationCommand,
} from "../application/publishing/publishing-publication-contract";
import type {
  PublishingSettlementProjection,
  UpdatePublishingSettlementCommand,
} from "../application/publishing/publishing-settlement-contract";
import type {
  PublishingPaymentProjection,
  UpdatePublishingPaymentCommand,
} from "../application/publishing/publishing-payment-contract";
import type { PublishingSourceProjection } from "../application/publishing/publishing-source-contract";
import type { PublishingEvidenceTargetKind } from "../application/publishing/publishing-evidence-link-contract";
import type {
  ApplyPublishingPartnerCsvImportCommand,
  PublishingPartnerCsvSelectionProjection,
} from "../application/publishing/publishing-partner-csv-import";
import type {
  ApplyPublishingSubmissionCsvImportCommand,
  PublishingSubmissionCsvSelectionProjection,
} from "../application/publishing/publishing-submission-csv-import";
import type {
  PublishingMailCandidateProjection,
  UpdatePublishingMailCandidateCommand,
} from "../application/publishing/publishing-mail-candidate-contract";
import type {
  PublishingMailConnectionProjection,
  PublishingMailSyncResult,
} from "../application/publishing/publishing-mail-connection-contract";
import type { PublishingMailScheduleProjection } from "../application/publishing/publishing-mail-schedule-contract";
import type {
  ApprovePublishingResearchCommand,
  PreviewPublishingResearchCommand,
  PublishingResearchCandidateProjection,
} from "../application/publishing/publishing-research-contract";
import type { PublishingAssistantResult } from "../application/publishing/publishing-assistant-contract";
import type { AssistantConnectionProjection } from "../application/assistant/assistant-connection";
import { entityId, type EntityId } from "../domain/writing";
import {
  PublishingPartnerDialog,
  type PublishingPartnerDialogActionState,
  type PublishingPartnerDraft,
  type PublishingContractDraft,
  type PublishingPublicationDraft,
  type PublishingSettlementDraft,
  type PublishingPaymentDraft,
  type PublishingSourceDraft,
  type PublishingSubmissionDraft,
} from "./publishing/PublishingPartnerDialog";
import type { WorkCalendarProjection } from "../application/schedule/work-calendar-contract";
import {
  deriveWorkScheduleSummary,
  localDateKey,
} from "./schedule/work-schedule-summary";
import type { WorkHeaderScheduleSummary } from "./workspace/WorkHeader";
import type { WorkOperationsSection } from "./workspace/WorkOperationsWorkspace";
import { TodaySchedulePanel } from "./today/TodaySchedulePanel";
import { useDialogDismiss } from "./dialog/useDialogDismiss";

type CatalogState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly catalog: WorkspaceCatalogProjection;
    }
  | { readonly status: "error" };

type ShellPage = "main" | "workspace";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkCard({
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
  onRetireDocument,
  onMoveDocument,
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
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={expanded ? "library-work-card is-expanded" : "library-work-card"}>
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
          <button
            aria-expanded={expanded}
            aria-label={`${work.title} 회차 목록 ${expanded ? "닫기" : "열기"}`}
            className="work-expand-button"
            disabled={disabled}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <FileText aria-hidden="true" size={14} />
            <span>{work.documents.length}개 회차</span>
            {expanded ? (
              <ChevronUp aria-hidden="true" size={14} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} />
            )}
          </button>
        </div>
      </header>
      {expanded && <div className="document-list" aria-label={`${work.title} 회차 목록`}>
        {work.documents.map((document, index) => (
          <div className="document-list-entry" key={document.documentId}>
            <button
              className={
                document.documentId === activeDocumentId
                  ? "document-list-item is-active"
                  : "document-list-item"
              }
              disabled={disabled}
              onClick={() => onOpen(work.workId, document.documentId)}
              type="button"
            >
              <FileText aria-hidden="true" size={15} />
              <span>{document.title}</span>
              <ChevronRight aria-hidden="true" size={14} />
            </button>
            <div className="document-move-actions">
              <button
                aria-label={`${work.title} ${document.title} 앞으로 이동`}
                className="document-move-button"
                disabled={disabled || index === 0}
                onClick={() => onMoveDocument(work, document, "earlier")}
                title="앞으로 이동"
                type="button"
              >
                <ChevronUp aria-hidden="true" size={14} />
              </button>
              <button
                aria-label={`${work.title} ${document.title} 뒤로 이동`}
                className="document-move-button"
                disabled={disabled || index === work.documents.length - 1}
                onClick={() => onMoveDocument(work, document, "later")}
                title="뒤로 이동"
                type="button"
              >
                <ChevronDown aria-hidden="true" size={14} />
              </button>
            </div>
            <button
              aria-label={`${work.title} ${document.title} 회차 삭제`}
              className="document-retire-button"
              disabled={disabled}
              onClick={() => onRetireDocument(work, document)}
              title="회차 삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        ))}
      </div>}
    </article>
  );
}

function MainDashboard({
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
  onOpenImport,
  onOpenPublishing,
  onOpenSchedule,
  onOpen,
  onRename,
  onRetire,
  onToggleFavorite,
  onSelectCover,
  onRetireDocument,
  onMoveDocument,
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
  readonly onOpenImport: () => void;
  readonly onOpenPublishing: () => void;
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
            <button
              aria-expanded={showLibraryTools}
              aria-label="작품 도구 열기"
              className="secondary-button library-more-button"
              disabled={busy}
              onClick={() => setShowLibraryTools((current) => !current)}
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={18} />
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
                onMoveDocument={onMoveDocument}
                onRename={onRename}
                onRetire={onRetire}
                onRetireDocument={onRetireDocument}
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

function BackupDialog({
  status,
  actionState,
  error,
  onCancel,
  onCreate,
  onRestore,
}: {
  readonly status: LocalWorkspaceBackupStatusProjection | null;
  readonly actionState: "loading" | "idle" | "creating" | "restoring";
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onCreate: () => void;
  readonly onRestore: () => void;
}) {
  const busy = actionState !== "idle";
  const summary = status?.lastVerified ?? null;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: onCancel,
  });
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="backup-heading"
        aria-modal="true"
        className="create-work-dialog backup-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">LOCAL BACKUP</p>
            <h2 id="backup-heading">백업</h2>
          </div>
          <button
            aria-label="백업 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          현재 작업실을 검증된 백업으로 만들거나, 선택한 백업을 새 작업실 위치에 복원합니다.
        </p>
        {actionState === "loading" ? (
          <p className="backup-empty-state">백업 기록을 확인하는 중입니다.</p>
        ) : summary === null ? (
          <p className="backup-empty-state">아직 검증된 백업이 없습니다.</p>
        ) : (
          <section className="backup-summary" aria-label="마지막 검증된 백업">
            <header>
              <div>
                <span>마지막 검증된 백업</span>
                <strong>
                  {summary.lastAction === "created" ? "백업 생성 완료" : "새 위치 복원 완료"}
                </strong>
              </div>
              <time dateTime={summary.verifiedAt}>
                {formatUpdatedAt(summary.verifiedAt)}
              </time>
            </header>
            <code title={summary.bundlePath}>{summary.bundlePath}</code>
            {summary.targetPath !== null && (
              <p title={summary.targetPath}>복원 위치 · {summary.targetPath}</p>
            )}
            <dl>
              <div><dt>작품</dt><dd>{summary.counts.workCount}</dd></div>
              <div><dt>회차</dt><dd>{summary.counts.documentCount}</dd></div>
              <div><dt>버전</dt><dd>{summary.counts.revisionCount}</dd></div>
              <div><dt>집필 기록</dt><dd>{summary.counts.writingSessionCount}</dd></div>
            </dl>
          </section>
        )}
        {error !== null && (
          <p className="dialog-error" role="alert">{error}</p>
        )}
        <div className="dialog-actions backup-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={onRestore}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
            {actionState === "restoring" ? "복원 중" : "새 위치에 복원"}
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={onCreate}
            type="button"
          >
            <Archive aria-hidden="true" size={15} />
            {actionState === "creating" ? "백업 중" : "새 백업"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ImportRehearsalDialog({
  summary,
  running,
  error,
  onCancel,
  onRun,
}: {
  readonly summary: LegacyLoreImportRehearsalSummary | null;
  readonly running: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onRun: () => void;
}) {
  const onBackdropPointerDown = useDialogDismiss({
    disabled: running,
    onClose: onCancel,
  });
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="import-rehearsal-heading"
        aria-modal="true"
        className="create-work-dialog import-rehearsal-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">READ-ONLY IMPORT</p>
            <h2 id="import-rehearsal-heading">기존 작업 가져오기</h2>
          </div>
          <button
            aria-label="기존 작업 가져오기 닫기"
            className="dialog-close"
            disabled={running}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          기존 이음 에디터 폴더와 직접 내보낸 브라우저 데이터 JSON을 읽기 전용으로 봉인하고, 선택한 새 위치에 별도의 리허설 작업실을 만듭니다. 현재 작업실에는 합치지 않습니다.
        </p>
        {summary === null ? (
          <p className="backup-empty-state">
            실행하면 원본 폴더, 브라우저 내보내기, 원고별 checksum과 receipt 누락 여부를 함께 검증합니다.
          </p>
        ) : (
          <section className="import-rehearsal-summary" aria-label="가져오기 리허설 결과">
            <header>
              <div>
                <span>가져오기 리허설 완료</span>
                <strong>
                  {summary.publication === "published" ? "새 리허설 생성" : "기존 리허설 재검증"}
                </strong>
              </div>
              <span className="source-unchanged-badge">원본 변경 없음</span>
            </header>
            <div className="import-paths">
              <p><span>원본</span><code>{summary.sourceRootPath}</code></p>
              <p><span>리허설</span><code>{summary.rehearsalWorkspacePath}</code></p>
              <p><span>보고서</span><code>{summary.reportPath}</code></p>
            </div>
            <dl>
              <div><dt>작품</dt><dd>{summary.counts.workCount}</dd></div>
              <div><dt>회차</dt><dd>{summary.counts.documentCount}</dd></div>
              <div><dt>원고 버전</dt><dd>{summary.counts.revisionCount}</dd></div>
              <div><dt>미귀속 원고</dt><dd>{summary.counts.orphanManuscriptCount}</dd></div>
              <div><dt>보존 원본</dt><dd>{summary.counts.rawItemCount}</dd></div>
              <div>
                <dt>브라우저 항목</dt>
                <dd>{summary.browserSourceReceipt?.coverage.sourceEntryCount ?? "입력 없음"}</dd>
              </div>
              <div><dt>검토 항목</dt><dd>{summary.issueCount}</dd></div>
            </dl>
            <p className="receipt-coverage">
              {summary.counts.uncoveredItemCount === 0
                ? `receipt ${summary.counts.receiptCount}/${summary.counts.sourceItemCount} · 누락 없음`
                : `receipt 누락 ${summary.counts.uncoveredItemCount}개`}
            </p>
          </section>
        )}
        {error !== null && (
          <p className="dialog-error" role="alert">{error}</p>
        )}
        <div className="dialog-actions import-rehearsal-actions">
          <button
            className="secondary-button"
            disabled={running}
            onClick={onCancel}
            type="button"
          >
            닫기
          </button>
          <button
            className="primary-button"
            disabled={running}
            onClick={onRun}
            type="button"
          >
            <Download aria-hidden="true" size={15} />
            {running ? "검증 중" : "읽기 전용 리허설 실행"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CreateWorkDialog({
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (input: {
    readonly title: string;
    readonly firstDocumentTitle: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [firstDocumentTitle, setFirstDocumentTitle] = useState("");
  const canSubmit =
    title.trim().length > 0 &&
    !submitting;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: submitting,
    onClose: onCancel,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit({ title, firstDocumentTitle });
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="create-work-heading"
        aria-modal="true"
        className="create-work-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">LOCAL WORK</p>
            <h2 id="create-work-heading">새 작품 만들기</h2>
          </div>
          <button
            aria-label="새 작품 만들기 닫기"
            className="dialog-close"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          작품과 첫 회차를 이 컴퓨터의 로컬 작업실에 함께 만듭니다.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>작품 제목</span>
            <input
              autoFocus
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="작품 제목을 입력하세요"
              value={title}
            />
          </label>
          <label>
            <span>첫 회차 제목</span>
            <input
              disabled={submitting}
              onChange={(event) => setFirstDocumentTitle(event.target.value)}
              placeholder="비우면 제목없음"
              value={firstDocumentTitle}
            />
          </label>
          {error !== null && (
            <p aria-live="polite" className="dialog-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={submitting}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={!canSubmit}
              type="submit"
            >
              <Plus aria-hidden="true" size={16} />
              {submitting ? "만드는 중" : "작품 만들기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RenameWorkDialog({
  work,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState(work.title);
  const canSubmit = title.trim().length > 0 && !submitting;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: submitting,
    onClose: onCancel,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit(title);
  };

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="rename-work-heading"
        aria-modal="true"
        className="create-work-dialog rename-work-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">WORK TITLE</p>
            <h2 id="rename-work-heading">작품 이름 변경</h2>
          </div>
          <button
            aria-label="작품 이름 변경 닫기"
            className="dialog-close"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <label>
            <span>작품 제목</span>
            <input
              autoFocus
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          {error !== null && (
            <p aria-live="polite" className="dialog-error">{error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={submitting}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button className="primary-button" disabled={!canSubmit} type="submit">
              {submitting ? "변경 중" : "변경"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function StudioShell() {
  const workspaceRef = useRef<ManuscriptWorkspaceHandle>(null);
  const [documentRailHost, setDocumentRailHost] =
    useState<HTMLDivElement | null>(null);
  const [eventRailHost, setEventRailHost] =
    useState<HTMLDivElement | null>(null);
  const [musicPlayerHost, setMusicPlayerHost] =
    useState<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState(() =>
    parseStarlightThemeKey(
      window.localStorage.getItem(STARLIGHT_THEME_STORAGE_KEY),
    ),
  );
  const [focusModePreferences, setFocusModePreferences] =
    useState<FocusModePreferences>(() => {
      const storedPosition = Number(
        window.localStorage.getItem("eum_focus_typewriter_position_percent"),
      );
      return Number.isFinite(storedPosition) && storedPosition > 0
        ? Object.freeze({
            ...DEFAULT_FOCUS_MODE_PREFERENCES,
            typewriterPositionPercent: storedPosition,
          })
        : DEFAULT_FOCUS_MODE_PREFERENCES;
    });
  const themeRef = useRef(theme);
  const focusModePreferencesRef = useRef(focusModePreferences);
  const uiPreferencesRef = useRef<UiPreferencesProjection>({
    schemaVersion: 1,
    revision: 0,
    themeKey: theme,
    focusMode: focusModePreferences,
  });
  const uiPreferencesSaveChainRef = useRef(Promise.resolve());
  const [uiPreferencesReady, setUiPreferencesReady] = useState(false);
  const persistUiPreferences = useCallback((
    nextTheme: StarlightThemeKey,
    nextFocusMode: FocusModePreferences,
  ) => {
    window.localStorage.setItem(STARLIGHT_THEME_STORAGE_KEY, nextTheme);
    window.localStorage.setItem(
      "eum_ui_preferences_v1",
      JSON.stringify({ themeKey: nextTheme, focusMode: nextFocusMode }),
    );
    const execution = uiPreferencesSaveChainRef.current.then(async () => {
      const current = uiPreferencesRef.current;
      const saved = await window.eumStudio.settings.saveUiPreferences({
        schemaVersion: 1,
        expectedRevision: current.revision,
        themeKey: nextTheme,
        focusMode: nextFocusMode,
      });
      uiPreferencesRef.current = saved;
    });
    uiPreferencesSaveChainRef.current = execution.then(
      () => undefined,
      () => undefined,
    );
  }, []);
  const changeTheme = useCallback((nextTheme: StarlightThemeKey) => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    persistUiPreferences(nextTheme, focusModePreferencesRef.current);
  }, [persistUiPreferences]);
  const changeFocusModePreferences = useCallback((
    nextFocusMode: FocusModePreferences,
  ) => {
    focusModePreferencesRef.current = nextFocusMode;
    setFocusModePreferences(nextFocusMode);
    persistUiPreferences(themeRef.current, nextFocusMode);
  }, [persistUiPreferences]);
  useEffect(() => {
    let disposed = false;
    void window.eumStudio.settings.getUiPreferences().then(
      (projection) => {
        if (disposed) return;
        uiPreferencesRef.current = projection;
        if (projection.revision === 0) {
          persistUiPreferences(themeRef.current, focusModePreferencesRef.current);
          setUiPreferencesReady(true);
          return;
        }
        const restoredTheme = parseStarlightThemeKey(projection.themeKey);
        themeRef.current = restoredTheme;
        focusModePreferencesRef.current = projection.focusMode;
        setTheme(restoredTheme);
        setFocusModePreferences(projection.focusMode);
        window.localStorage.setItem(STARLIGHT_THEME_STORAGE_KEY, restoredTheme);
        setUiPreferencesReady(true);
      },
      () => setUiPreferencesReady(true),
    );
    return () => {
      disposed = true;
    };
  }, [persistUiPreferences]);
  const [activePage, setActivePage] = useState<ShellPage>("main");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [favoriteWorkIds, setFavoriteWorkIds] = useState<
    readonly EntityId<"Work">[]
  >([]);
  const [workCovers, setWorkCovers] = useState<readonly WorkCoverProjection[]>([]);
  const [resumePreview, setResumePreview] = useState<
    ManuscriptResumePreview | null
  >(null);
  const [showCreateWork, setShowCreateWork] = useState(false);
  const [renameWorkTarget, setRenameWorkTarget] =
    useState<WorkspaceWorkSummary | null>(null);
  const [showQuickTools, setShowQuickTools] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showImportRehearsal, setShowImportRehearsal] = useState(false);
  const [showPublishingPartners, setShowPublishingPartners] = useState(false);
  const [publishingInitialSection, setPublishingInitialSection] = useState<
    "submissions" | "contracts" | "settlements"
  >("submissions");
  const [publishingWorkScopeId, setPublishingWorkScopeId] = useState<
    EntityId<"Work"> | null
  >(null);
  const [actionState, setActionState] = useState<
    | "idle"
    | "opening"
    | "creating"
    | "leaving"
    | "retiring"
    | "retiring-document"
    | "moving-document"
    | "renaming-work"
    | "favoriting-work"
    | "selecting-cover"
  >("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scheduleByWork, setScheduleByWork] = useState<
    Readonly<Record<string, WorkCalendarProjection>>
  >({});
  const [scheduleRefreshRevision, setScheduleRefreshRevision] = useState(0);
  const [backupStatus, setBackupStatus] = useState<
    LocalWorkspaceBackupStatusProjection | null
  >(null);
  const [backupActionState, setBackupActionState] = useState<
    "loading" | "idle" | "creating" | "restoring"
  >("loading");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [importRehearsalRunning, setImportRehearsalRunning] = useState(false);
  const [importRehearsalSummary, setImportRehearsalSummary] = useState<
    LegacyLoreImportRehearsalSummary | null
  >(null);
  const [importRehearsalError, setImportRehearsalError] = useState<
    string | null
  >(null);
  const [appSettingsProfile, setAppSettingsProfile] =
    useState<AppSettingsProfile | null>(null);
  const [appSettingsProjection, setAppSettingsProjection] =
    useState<AppSettingsProjection | null>(null);
  const [musicSettingsProfile, setMusicSettingsProfile] =
    useState<MusicSettingsProfile | null>(null);
  const [workMusicSettingsProjection, setWorkMusicSettingsProjection] =
    useState<WorkMusicSettingsProjection | null>(null);
  const [youtubeMusicConnectionStatus, setYoutubeMusicConnectionStatus] =
    useState<YouTubeMusicConnectionStatus | null>(null);
  const [chatGptOAuthStatus, setChatGptOAuthStatus] =
    useState<ChatGptOAuthConnectionStatus | null>(null);
  const [chatGptOAuthLoginState, setChatGptOAuthLoginState] = useState<
    "idle" | "waiting"
  >("idle");
  const [appSettingsActionState, setAppSettingsActionState] = useState<
    "loading" | "idle" | "saving"
  >("idle");
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);
  const [appSettingsScheduleRevision, setAppSettingsScheduleRevision] =
    useState(0);

  useEffect(() => {
    document.body.classList.remove(
      ...STARLIGHT_THEMES.map((candidate) => candidate.key),
    );
    document.body.classList.add(theme);
    return () => {
      document.body.classList.remove(theme);
    };
  }, [theme]);

  useEffect(() => {
    let active = true;
    void window.eumStudio.settings.getYouTubeMusicConnectionStatus().then(
      (status) => {
        if (active) setYoutubeMusicConnectionStatus(status);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);

  const [publishingPartners, setPublishingPartners] = useState<
    readonly PublishingPartnerProjection[]
  >([]);
  const [selectedPublishingPartnerId, setSelectedPublishingPartnerId] =
    useState<string | null>(null);
  const [publishingSubmissions, setPublishingSubmissions] = useState<
    readonly PublishingSubmissionProjection[]
  >([]);
  const [selectedPublishingSubmissionId, setSelectedPublishingSubmissionId] =
    useState<string | null>(null);
  const [publishingContracts, setPublishingContracts] = useState<
    readonly PublishingContractProjection[]
  >([]);
  const [selectedPublishingContractId, setSelectedPublishingContractId] =
    useState<string | null>(null);
  const [publishingPublications, setPublishingPublications] = useState<
    readonly PublishingPublicationProjection[]
  >([]);
  const [selectedPublishingPublicationId, setSelectedPublishingPublicationId] =
    useState<string | null>(null);
  const [publishingSettlements, setPublishingSettlements] = useState<
    readonly PublishingSettlementProjection[]
  >([]);
  const [selectedPublishingSettlementId, setSelectedPublishingSettlementId] =
    useState<string | null>(null);
  const [publishingPayments, setPublishingPayments] = useState<
    readonly PublishingPaymentProjection[]
  >([]);
  const [selectedPublishingPaymentId, setSelectedPublishingPaymentId] =
    useState<string | null>(null);
  const [publishingSources, setPublishingSources] = useState<
    readonly PublishingSourceProjection[]
  >([]);
  const [publishingAssistantConnections, setPublishingAssistantConnections] =
    useState<readonly AssistantConnectionProjection[]>([]);
  const [publishingMailCandidates, setPublishingMailCandidates] = useState<
    readonly PublishingMailCandidateProjection[]
  >([]);
  const [publishingMailConnection, setPublishingMailConnection] = useState<
    PublishingMailConnectionProjection | null
  >(null);
  const [publishingMailSyncResult, setPublishingMailSyncResult] = useState<
    PublishingMailSyncResult | null
  >(null);
  const [publishingMailSchedule, setPublishingMailSchedule] = useState<
    PublishingMailScheduleProjection | null
  >(null);
  const [selectedPublishingSourceId, setSelectedPublishingSourceId] =
    useState<string | null>(null);
  const [publishingPartnerActionState, setPublishingPartnerActionState] =
    useState<PublishingPartnerDialogActionState>("idle");
  const [publishingPartnerError, setPublishingPartnerError] = useState<
    string | null
  >(null);

  const catalog =
    catalogState.status === "ready" ? catalogState.catalog : null;

  const loadCatalog = useCallback(async () => {
    setCatalogState({ status: "loading" });
    try {
      const [loadedCatalog, loadedFavorites, loadedCovers] = await Promise.all([
        window.eumStudio.workspace.getCatalog(),
        window.eumStudio.workspace.getFavorites(),
        window.eumStudio.workspace.getCovers(),
      ]);
      setCatalogState({ status: "ready", catalog: loadedCatalog });
      setFavoriteWorkIds(loadedFavorites.workIds);
      setWorkCovers(loadedCovers.covers);
    } catch {
      setCatalogState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      window.eumStudio.workspace.getCatalog(),
      window.eumStudio.workspace.getFavorites(),
      window.eumStudio.workspace.getCovers(),
    ]).then(
      ([loadedCatalog, loadedFavorites, loadedCovers]) => {
        if (!disposed) {
          setCatalogState({ status: "ready", catalog: loadedCatalog });
          setFavoriteWorkIds(loadedFavorites.workIds);
          setWorkCovers(loadedCovers.covers);
        }
      },
      () => {
        if (!disposed) {
          setCatalogState({ status: "error" });
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, []);

  const loadBackupStatus = useCallback(async () => {
    setBackupActionState("loading");
    setBackupError(null);
    try {
      setBackupStatus(await window.eumStudio.backup.getStatus());
    } catch {
      setBackupStatus(null);
      setBackupError("백업 기록을 불러오지 못했습니다.");
    } finally {
      setBackupActionState("idle");
    }
  }, []);

  const openPublishingPartners = useCallback((
    section: WorkOperationsSection = "submissions",
    workId: EntityId<"Work"> | null = null,
  ) => {
    setPublishingInitialSection(section);
    setPublishingWorkScopeId(workId);
    setShowPublishingPartners(true);
    setPublishingPartnerActionState("loading");
    setPublishingPartnerError(null);
    void Promise.all([
      window.eumStudio.publishingPartners.list({ schemaVersion: 1 }),
      window.eumStudio.publishingSubmissions.list({
        schemaVersion: 1,
        workId,
      }),
      window.eumStudio.publishingContracts.list({
        schemaVersion: 1,
        workId,
      }),
      window.eumStudio.publishingPublications.list({
        schemaVersion: 1,
        workId,
      }),
      window.eumStudio.publishingSettlements.list({
        schemaVersion: 1,
        workId,
      }),
      window.eumStudio.publishingPayments.list({
        schemaVersion: 1,
        workId,
      }),
      window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      window.eumStudio.publishingMailCandidates.list({ schemaVersion: 1 }),
      window.eumStudio.publishingMailConnection.status({ schemaVersion: 1 }),
      window.eumStudio.publishingMailSchedule.status({ schemaVersion: 1 }),
      window.eumStudio.assistant.listConnections(),
    ]).then(
      ([
        partnerProjection,
        submissionProjection,
        contractProjection,
        publicationProjection,
        settlementProjection,
        paymentProjection,
        sourceProjection,
        mailCandidateProjection,
        mailConnectionProjection,
        mailScheduleProjection,
        assistantConnectionProjection,
      ]) => {
        setPublishingPartners(partnerProjection.partners);
        setPublishingSubmissions(submissionProjection.submissions);
        setPublishingContracts(contractProjection.contracts);
        setPublishingPublications(publicationProjection.publications);
        setPublishingSettlements(settlementProjection.settlements);
        setPublishingPayments(paymentProjection.payments);
        setPublishingSources(sourceProjection.sources);
        setPublishingMailCandidates(mailCandidateProjection.candidates);
        setPublishingMailConnection(mailConnectionProjection);
        setPublishingMailSchedule(mailScheduleProjection);
        setPublishingAssistantConnections(assistantConnectionProjection.connections);
        setPublishingMailSyncResult(null);
        setSelectedPublishingPartnerId(
          (current) => partnerProjection.partners.some(
            (partner) => partner.partnerId === current,
          )
            ? current
            : partnerProjection.partners[0]?.partnerId ?? null,
        );
        setSelectedPublishingSubmissionId(
          (current) => submissionProjection.submissions.some(
            (submission) => submission.submissionId === current,
          )
            ? current
            : submissionProjection.submissions[0]?.submissionId ?? null,
        );
        setSelectedPublishingContractId(
          (current) => contractProjection.contracts.some(
            (contract) => contract.contractId === current,
          )
            ? current
            : contractProjection.contracts[0]?.contractId ?? null,
        );
        setSelectedPublishingPublicationId(
          (current) => publicationProjection.publications.some(
            (publication) => publication.publicationId === current,
          )
            ? current
            : publicationProjection.publications[0]?.publicationId ?? null,
        );
        setSelectedPublishingSettlementId(
          (current) => settlementProjection.settlements.some(
            (settlement) => settlement.settlementId === current,
          )
            ? current
            : settlementProjection.settlements[0]?.settlementId ?? null,
        );
        setSelectedPublishingPaymentId(
          (current) => paymentProjection.payments.some(
            (payment) => payment.paymentId === current,
          )
            ? current
            : paymentProjection.payments[0]?.paymentId ?? null,
        );
        setSelectedPublishingSourceId(
          (current) => sourceProjection.sources.some(
            (source) => source.sourceId === current,
          )
            ? current
            : sourceProjection.sources[0]?.sourceId ?? null,
        );
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("투고 운영 원장을 불러오지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, []);

  const createPublishingPartner = useCallback(
    (draft: PublishingPartnerDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPartners.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPartners((current) => Object.freeze([
            created,
            ...current.filter(
              (partner) => partner.partnerId !== created.partnerId,
            ),
          ]));
          setSelectedPublishingPartnerId(created.partnerId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고처를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingPartner = useCallback(
    (
      partner: PublishingPartnerProjection,
      changes: UpdatePublishingPartnerCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPartners.update({
        schemaVersion: 1,
        partnerId: partner.partnerId,
        expectedRevision: partner.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPartners((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.partnerId !== updated.partnerId,
            ),
          ]));
          setSelectedPublishingPartnerId(updated.partnerId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고처 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingSubmission = useCallback(
    (draft: PublishingSubmissionDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-submission");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingSubmissions.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSubmissions((current) => Object.freeze([
            created,
            ...current.filter(
              (submission) => submission.submissionId !== created.submissionId,
            ),
          ]));
          setSelectedPublishingSubmissionId(created.submissionId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고 이력을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingSubmission = useCallback(
    (
      submission: PublishingSubmissionProjection,
      changes: UpdatePublishingSubmissionCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating-submission");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingSubmissions.update({
        schemaVersion: 1,
        submissionId: submission.submissionId,
        expectedRevision: submission.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingSubmissions((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.submissionId !== updated.submissionId,
            ),
          ]));
          setSelectedPublishingSubmissionId(updated.submissionId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고 이력 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingContract = useCallback(
    (draft: PublishingContractDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-contract");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingContracts.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingContracts((current) => Object.freeze([
            created,
            ...current.filter((contract) => contract.contractId !== created.contractId),
          ]));
          setSelectedPublishingContractId(created.contractId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("계약을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingContract = useCallback(
    (
      contract: PublishingContractProjection,
      changes: UpdatePublishingContractCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating-contract");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingContracts.update({
        schemaVersion: 1,
        contractId: contract.contractId,
        expectedRevision: contract.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingContracts((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.contractId !== updated.contractId,
            ),
          ]));
          setSelectedPublishingContractId(updated.contractId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("계약 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingPublication = useCallback(
    (draft: PublishingPublicationDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-publication");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPublications.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPublications((current) => Object.freeze([
            created,
            ...current.filter(
              (publication) => publication.publicationId !== created.publicationId,
            ),
          ]));
          setSelectedPublishingPublicationId(created.publicationId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("발행·연재 항목을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingPublication = useCallback(
    (
      publication: PublishingPublicationProjection,
      changes: UpdatePublishingPublicationCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating-publication");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPublications.update({
        schemaVersion: 1,
        publicationId: publication.publicationId,
        expectedRevision: publication.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPublications((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.publicationId !== updated.publicationId,
            ),
          ]));
          setSelectedPublishingPublicationId(updated.publicationId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("발행·연재 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingSettlement = useCallback(
    (draft: PublishingSettlementDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-settlement");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingSettlements.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSettlements((current) => Object.freeze([
            created,
            ...current.filter(
              (settlement) => settlement.settlementId !== created.settlementId,
            ),
          ]));
          setSelectedPublishingSettlementId(created.settlementId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("정산서를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingSettlement = useCallback(
    (
      settlement: PublishingSettlementProjection,
      changes: UpdatePublishingSettlementCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating-settlement");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingSettlements.update({
        schemaVersion: 1,
        settlementId: settlement.settlementId,
        expectedRevision: settlement.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingSettlements((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.settlementId !== updated.settlementId,
            ),
          ]));
          setSelectedPublishingSettlementId(updated.settlementId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("정산서 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingPayment = useCallback(
    (draft: PublishingPaymentDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-payment");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPayments.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPayments((current) => Object.freeze([
            created,
            ...current.filter(
              (payment) => payment.paymentId !== created.paymentId,
            ),
          ]));
          setSelectedPublishingPaymentId(created.paymentId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("입금을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const updatePublishingPayment = useCallback(
    (
      payment: PublishingPaymentProjection,
      changes: UpdatePublishingPaymentCommand["changes"],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("updating-payment");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingPayments.update({
        schemaVersion: 1,
        paymentId: payment.paymentId,
        expectedRevision: payment.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPayments((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.paymentId !== updated.paymentId,
            ),
          ]));
          setSelectedPublishingPaymentId(updated.paymentId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("입금 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const createPublishingSource = useCallback(
    (draft: PublishingSourceDraft) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("creating-source");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingSources.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSources((current) => Object.freeze([
            created,
            ...current.filter((source) => source.sourceId !== created.sourceId),
          ]));
          setSelectedPublishingSourceId(created.sourceId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("근거를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const setPublishingEvidenceLinks = useCallback(
    (
      targetKind: PublishingEvidenceTargetKind,
      targetId: string,
      expectedRevision: number,
      sourceIds: readonly string[],
    ) => {
      if (publishingPartnerActionState !== "idle") return;
      setPublishingPartnerActionState("saving-evidence-links");
      setPublishingPartnerError(null);
      void window.eumStudio.publishingEvidence.setLinks({
        schemaVersion: 1,
        targetKind,
        targetId,
        expectedRevision,
        sourceIds: sourceIds.map((sourceId) =>
          entityId<"PublishingSource">(sourceId)),
      }).then(
        (updated) => {
          const apply = <T extends {
            readonly revision: number;
            readonly sourceIds: readonly string[];
            readonly updatedAt: string;
          }>(record: T): T => ({
            ...record,
            revision: updated.revision,
            sourceIds: updated.sourceIds,
            updatedAt: updated.updatedAt,
          });
          switch (updated.targetKind) {
            case "partner":
              setPublishingPartners((current) => Object.freeze(current.map(
                (record) => record.partnerId === updated.targetId ? apply(record) : record,
              )));
              break;
            case "submission":
              setPublishingSubmissions((current) => Object.freeze(current.map(
                (record) => record.submissionId === updated.targetId ? apply(record) : record,
              )));
              break;
            case "contract":
              setPublishingContracts((current) => Object.freeze(current.map(
                (record) => record.contractId === updated.targetId ? apply(record) : record,
              )));
              break;
            case "publication":
              setPublishingPublications((current) => Object.freeze(current.map(
                (record) => record.publicationId === updated.targetId ? apply(record) : record,
              )));
              break;
            case "settlement":
              setPublishingSettlements((current) => Object.freeze(current.map(
                (record) => record.settlementId === updated.targetId ? apply(record) : record,
              )));
              break;
            case "payment":
              setPublishingPayments((current) => Object.freeze(current.map(
                (record) => record.paymentId === updated.targetId ? apply(record) : record,
              )));
              break;
          }
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("근거 연결을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [publishingPartnerActionState],
  );

  const previewPublishingResearch = useCallback(async (
    command: Omit<PreviewPublishingResearchCommand, "schemaVersion">,
  ): Promise<PublishingResearchCandidateProjection | null> => {
    if (publishingPartnerActionState !== "idle") return null;
    setPublishingPartnerActionState("previewing-research");
    setPublishingPartnerError(null);
    try {
      const candidate = await window.eumStudio.publishingResearch.preview({
        schemaVersion: 1,
        ...command,
      });
      setPublishingPartnerActionState("idle");
      return candidate;
    } catch {
      setPublishingPartnerError("웹 자료를 현재 투고처 값과 비교하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [publishingPartnerActionState]);

  const approvePublishingResearch = useCallback(async (
    command: Omit<ApprovePublishingResearchCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (publishingPartnerActionState !== "idle") return false;
    setPublishingPartnerActionState("approving-research");
    setPublishingPartnerError(null);
    try {
      const result = await window.eumStudio.publishingResearch.approve({
        schemaVersion: 1,
        ...command,
      });
      setPublishingPartners((current) => Object.freeze(current.map((partner) =>
        partner.partnerId === result.partner.partnerId ? result.partner : partner)));
      setPublishingSources((current) => Object.freeze([result.source, ...current]));
      setSelectedPublishingPartnerId(result.partner.partnerId);
      setSelectedPublishingSourceId(result.source.sourceId);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("선택한 웹 자료 필드를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [publishingPartnerActionState]);

  const runPublishingAssistant = useCallback(async (
    connectionId: EntityId<"AssistantConnection">,
    statement: string,
  ): Promise<PublishingAssistantResult | null> => {
    if (publishingPartnerActionState !== "idle") return null;
    setPublishingPartnerActionState("running-assistant");
    setPublishingPartnerError(null);
    try {
      const result = await window.eumStudio.publishingAssistant.run({
        schemaVersion: 1,
        requestId: entityId<"AssistantConnectorRequest">(crypto.randomUUID()),
        connectionId,
        statement,
      });
      setPublishingPartnerActionState("idle");
      return result;
    } catch {
      setPublishingPartnerError("작업실 조수 요청을 해석하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [publishingPartnerActionState]);

  const approvePublishingAssistant = useCallback(async (
    candidateId: string,
  ): Promise<boolean> => {
    if (publishingPartnerActionState !== "idle") return false;
    setPublishingPartnerActionState("approving-assistant");
    setPublishingPartnerError(null);
    try {
      const result = await window.eumStudio.publishingAssistant.approve({
        schemaVersion: 1,
        candidateId,
      });
      setPublishingSources((current) => Object.freeze([
        result.source,
        ...current.filter((source) => source.sourceId !== result.source.sourceId),
      ]));
      setPublishingSubmissions((current) => Object.freeze([
        ...result.submissions,
        ...current.filter((submission) => !result.submissions.some(
          (created) => created.submissionId === submission.submissionId,
        )),
      ]));
      setSelectedPublishingSourceId(result.source.sourceId);
      setSelectedPublishingSubmissionId(result.submissions[0]?.submissionId ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("작업실 조수의 투고 기록을 저장하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [publishingPartnerActionState]);

  const selectPublishingPartnerCsv = useCallback(async (): Promise<
    PublishingPartnerCsvSelectionProjection | null
  > => {
    if (publishingPartnerActionState !== "idle") return null;
    setPublishingPartnerActionState("selecting-partner-csv");
    setPublishingPartnerError(null);
    try {
      const selection = await window.eumStudio.publishingImports.selectPartnerCsv({
        schemaVersion: 1,
      });
      setPublishingPartnerActionState("idle");
      return selection;
    } catch {
      setPublishingPartnerError("투고처 CSV 파일을 읽지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [publishingPartnerActionState]);

  const applyPublishingPartnerCsv = useCallback(async (
    command: Omit<ApplyPublishingPartnerCsvImportCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (publishingPartnerActionState !== "idle") return false;
    setPublishingPartnerActionState("applying-partner-csv");
    setPublishingPartnerError(null);
    try {
      const result = await window.eumStudio.publishingImports.applyPartnerCsv({
        schemaVersion: 1,
        ...command,
      });
      const [partnerProjection, sourceProjection] = await Promise.all([
        window.eumStudio.publishingPartners.list({ schemaVersion: 1 }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      setPublishingPartners(partnerProjection.partners);
      setPublishingSources(sourceProjection.sources);
      setSelectedPublishingPartnerId(result.partnerIds[0] ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("투고처 CSV를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [publishingPartnerActionState]);

  const selectPublishingSubmissionCsv = useCallback(async (): Promise<
    PublishingSubmissionCsvSelectionProjection | null
  > => {
    if (publishingPartnerActionState !== "idle") return null;
    setPublishingPartnerActionState("selecting-submission-csv");
    setPublishingPartnerError(null);
    try {
      const selection = await window.eumStudio.publishingImports.selectSubmissionCsv({
        schemaVersion: 1,
      });
      setPublishingPartnerActionState("idle");
      return selection;
    } catch {
      setPublishingPartnerError("투고 이력 CSV 파일을 읽지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [publishingPartnerActionState]);

  const applyPublishingSubmissionCsv = useCallback(async (
    command: Omit<ApplyPublishingSubmissionCsvImportCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (publishingPartnerActionState !== "idle") return false;
    setPublishingPartnerActionState("applying-submission-csv");
    setPublishingPartnerError(null);
    try {
      const result = await window.eumStudio.publishingImports.applySubmissionCsv({
        schemaVersion: 1,
        ...command,
      });
      const [submissionProjection, sourceProjection] = await Promise.all([
        window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      setPublishingSubmissions(submissionProjection.submissions);
      setPublishingSources(sourceProjection.sources);
      setSelectedPublishingSubmissionId(result.submissionIds[0] ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("투고 이력 CSV를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [publishingPartnerActionState]);

  const linkPublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    submissionId: PublishingSubmissionProjection["submissionId"],
  ) => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("linking-mail-candidate");
    setPublishingPartnerError(null);
    void window.eumStudio.publishingMailCandidates.link({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      submissionId,
    }).then(
      (updated) => {
        setPublishingMailCandidates((current) => Object.freeze(current.map(
          (item) => item.candidateId === updated.candidateId ? updated : item,
        )));
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 후보를 투고에 연결하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [publishingPartnerActionState]);

  const connectPublishingMail = useCallback((
    connectorKind: string,
    clientId: string,
  ) => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("connecting-mail");
    setPublishingPartnerError(null);
    void window.eumStudio.publishingMailConnection.connect({
      schemaVersion: 1,
      connectorKind,
      clientId,
    }).then(
      (connection) => {
        setPublishingMailConnection(connection);
        setPublishingMailSyncResult(null);
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 계정을 연결하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [publishingPartnerActionState]);

  const syncPublishingMail = useCallback(() => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("syncing-mail");
    setPublishingPartnerError(null);
    void (async () => {
      try {
        const result = await window.eumStudio.publishingMailConnection.sync({
          schemaVersion: 1,
        });
        const [connection, candidates, schedule] = await Promise.all([
          window.eumStudio.publishingMailConnection.status({ schemaVersion: 1 }),
          window.eumStudio.publishingMailCandidates.list({ schemaVersion: 1 }),
          window.eumStudio.publishingMailSchedule.status({ schemaVersion: 1 }),
        ]);
        setPublishingMailConnection(connection);
        setPublishingMailCandidates(candidates.candidates);
        setPublishingMailSchedule(schedule);
        setPublishingMailSyncResult(result);
      } catch {
        setPublishingPartnerError("메일 회신을 동기화하지 못했습니다.");
        void window.eumStudio.publishingMailSchedule.status({ schemaVersion: 1 }).then(
          setPublishingMailSchedule,
          () => undefined,
        );
      } finally {
        setPublishingPartnerActionState("idle");
      }
    })();
  }, [publishingPartnerActionState]);

  const savePublishingMailSchedule = useCallback((
    enabled: boolean,
    localTime: string | null,
  ) => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("saving-mail-schedule");
    setPublishingPartnerError(null);
    void (async () => {
      try {
        const schedule = await window.eumStudio.publishingMailSchedule.save({
          schemaVersion: 1,
          enabled,
          localTime,
        });
        const [connection, candidates] = await Promise.all([
          window.eumStudio.publishingMailConnection.status({ schemaVersion: 1 }),
          window.eumStudio.publishingMailCandidates.list({ schemaVersion: 1 }),
        ]);
        setPublishingMailSchedule(schedule);
        setPublishingMailConnection(connection);
        setPublishingMailCandidates(candidates.candidates);
      } catch {
        setPublishingPartnerError("메일 자동 확인 일정을 저장하지 못했습니다.");
      } finally {
        setPublishingPartnerActionState("idle");
      }
    })();
  }, [publishingPartnerActionState]);

  const disconnectPublishingMail = useCallback(() => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("disconnecting-mail");
    setPublishingPartnerError(null);
    void window.eumStudio.publishingMailConnection.disconnect({
      schemaVersion: 1,
    }).then(
      (connection) => {
        setPublishingMailConnection(connection);
        setPublishingMailSyncResult(null);
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 계정 연결을 해제하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [publishingPartnerActionState]);

  const updatePublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    changes: UpdatePublishingMailCandidateCommand["changes"],
  ) => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("updating-mail-candidate");
    setPublishingPartnerError(null);
    void window.eumStudio.publishingMailCandidates.update({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      changes,
    }).then(
      (updated) => {
        setPublishingMailCandidates((current) => Object.freeze(current.map(
          (item) => item.candidateId === updated.candidateId ? updated : item,
        )));
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 후보 제안을 저장하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [publishingPartnerActionState]);

  const reviewPublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    decision: "approve" | "ignore",
  ) => {
    if (publishingPartnerActionState !== "idle") return;
    setPublishingPartnerActionState("reviewing-mail-candidate");
    setPublishingPartnerError(null);
    void window.eumStudio.publishingMailCandidates.review({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      decision,
    }).then(
      (result) => {
        setPublishingMailCandidates((current) => Object.freeze(current.map(
          (item) => item.candidateId === result.candidate.candidateId
            ? result.candidate
            : item,
        )));
        if (result.submission !== null) {
          setPublishingSubmissions((current) => Object.freeze(current.map(
            (submission) => submission.submissionId === result.submission?.submissionId
              ? result.submission
              : submission,
          )));
        }
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError(
          decision === "approve"
            ? "메일 후보를 투고 이력에 반영하지 못했습니다."
            : "메일 후보를 무시 처리하지 못했습니다.",
        );
        setPublishingPartnerActionState("idle");
      },
    );
  }, [publishingPartnerActionState]);

  useEffect(() => {
    let disposed = false;
    void window.eumStudio.backup.getStatus().then(
      (status) => {
        if (!disposed) {
          setBackupStatus(status);
          setBackupActionState("idle");
        }
      },
      () => {
        if (!disposed) {
          setBackupStatus(null);
          setBackupError("백업 기록을 불러오지 못했습니다.");
          setBackupActionState("idle");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (catalog === null || catalog.works.length === 0) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) {
          setScheduleByWork({});
        }
      });
      return () => {
        disposed = true;
      };
    }
    let disposed = false;
    const today = localDateKey();
    void window.eumStudio.schedule.listToday({
      schemaVersion: 1,
      date: today,
    }).then(
      (projection) => {
        if (!disposed) {
          setScheduleByWork(
            Object.freeze(
              Object.fromEntries(
                projection.works.map((work) => [
                  work.workId,
                  work.calendar,
                ] as const),
              ),
            ),
          );
        }
      },
      () => {
        if (!disposed) {
          setScheduleByWork({});
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [catalog, scheduleRefreshRevision]);

  const acceptCatalog = useCallback(
    (nextCatalog: WorkspaceCatalogProjection) => {
      setCatalogState({ status: "ready", catalog: nextCatalog });
    },
    [],
  );

  const toggleWorkFavorite = useCallback(
    (work: WorkspaceWorkSummary) => {
      if (catalogState.status !== "ready" || actionState !== "idle") return;
      const favorite = !favoriteWorkIds.includes(work.workId);
      setActionState("favoriting-work");
      setActionError(null);
      void window.eumStudio.workspace.setFavorite({
        schemaVersion: 1,
        workId: work.workId,
        favorite,
      }).then(
        (projection) => {
          setFavoriteWorkIds(projection.workIds);
          setActionState("idle");
        },
        () => {
          setActionError("즐겨찾기를 변경하지 못했습니다.");
          setActionState("idle");
        },
      );
    },
    [actionState, catalogState.status, favoriteWorkIds],
  );

  const selectWorkCover = useCallback(
    (work: WorkspaceWorkSummary) => {
      if (catalogState.status !== "ready" || actionState !== "idle") return;
      setActionState("selecting-cover");
      setActionError(null);
      void window.eumStudio.workspace.selectCover({
        schemaVersion: 1,
        workId: work.workId,
      }).then(
        (cover) => {
          if (cover !== null) {
            setWorkCovers((current) => [
              ...current.filter((candidate) => candidate.workId !== cover.workId),
              cover,
            ]);
          }
          setActionState("idle");
        },
        () => {
          setActionError("표지 이미지를 등록하지 못했습니다.");
          setActionState("idle");
        },
      );
    },
    [actionState, catalogState.status],
  );

  const openLocation = useCallback(
    async (
      workId: WorkspaceWorkSummary["workId"],
      documentId:
        | WorkspaceWorkSummary["documents"][number]["documentId"]
        | null,
    ) => {
      if (
        catalogState.status !== "ready" ||
        workspaceRef.current === null ||
        actionState !== "idle"
      ) {
        return;
      }
      setActionState("opening");
      setActionError(null);
      try {
        const nextCatalog = await workspaceRef.current.activateLocation({
          schemaVersion: 1,
          workId,
          documentId,
        });
        acceptCatalog(nextCatalog);
        setActivePage("workspace");
      } catch {
        setActionError("선택한 작품을 열지 못했습니다.");
      } finally {
        setActionState("idle");
      }
    },
    [acceptCatalog, actionState, catalogState.status],
  );

  const openWorkSchedule = useCallback(async (work: WorkspaceWorkSummary) => {
    await openLocation(
      work.workId,
      work.workId === catalog?.activeWorkId
        ? catalog.activeDocumentId
        : (work.documents[0]?.documentId ?? null),
    );
    workspaceRef.current?.openSchedule();
  }, [catalog, openLocation]);

  const returnToMain = useCallback(() => {
    if (actionState !== "idle") {
      return;
    }
    if (workspaceRef.current === null) {
      setActivePage("main");
      return;
    }
    setActionState("leaving");
    setActionError(null);
    void workspaceRef.current.prepareForMain().then(
      (nextCatalog) => {
        acceptCatalog(nextCatalog);
        setActivePage("main");
        setActionState("idle");
      },
      () => {
        setActionError("원고 저장을 마치지 못해 메인으로 이동하지 않았습니다.");
        setActionState("idle");
      },
    );
  }, [acceptCatalog, actionState]);

  const createWork = useCallback(
    (input: {
      readonly title: string;
      readonly firstDocumentTitle: string;
    }) => {
      if (catalogState.status !== "ready" || actionState !== "idle") {
        return;
      }
      setActionState("creating");
      setActionError(null);
      void (async () => {
        try {
          let nextCatalog: WorkspaceCatalogProjection;
          if (catalogState.catalog.canCreateFirstWork) {
            await window.eumStudio.workspace.createFirstWork({
              schemaVersion: 1,
              title: input.title,
              firstDocumentTitle: input.firstDocumentTitle,
            });
            nextCatalog = await window.eumStudio.workspace.getCatalog();
          } else {
            if (workspaceRef.current === null) {
              throw new Error("The manuscript workspace is unavailable");
            }
            nextCatalog = await workspaceRef.current.createWork({
              schemaVersion: 1,
              title: input.title,
              firstDocumentTitle: input.firstDocumentTitle,
            });
          }
          acceptCatalog(nextCatalog);
          setShowCreateWork(false);
          setActivePage("workspace");
        } catch {
          setActionError("작품을 만들지 못했습니다.");
        } finally {
          setActionState("idle");
        }
      })();
    },
    [acceptCatalog, actionState, catalogState],
  );

  const renameWork = useCallback(
    (work: WorkspaceWorkSummary, title: string) => {
      if (
        catalogState.status !== "ready" ||
        workspaceRef.current === null ||
        actionState !== "idle"
      ) {
        return;
      }
      setActionState("renaming-work");
      setActionError(null);
      void workspaceRef.current.renameWork(work.workId, title).then(
        (nextCatalog) => {
          acceptCatalog(nextCatalog);
          setRenameWorkTarget(null);
          setActionState("idle");
        },
        () => {
          setActionError("작품 이름을 변경하지 못했습니다.");
          setActionState("idle");
        },
      );
    },
    [acceptCatalog, actionState, catalogState.status],
  );

  const retireWork = useCallback(
    (work: WorkspaceWorkSummary) => {
      if (
        catalogState.status !== "ready" ||
        workspaceRef.current === null ||
        actionState !== "idle"
      ) {
        return;
      }
      if (
        !window.confirm(
          `‘${work.title}’ 작품을 작업실에서 삭제할까요?\n원고와 기록은 복구를 위해 보존됩니다.`,
        )
      ) {
        return;
      }
      setActionState("retiring");
      setActionError(null);
      void workspaceRef.current.retireWork(work.workId).then(
        (nextCatalog) => {
          acceptCatalog(nextCatalog);
          setActivePage("main");
          setActionState("idle");
        },
        () => {
          setActionError("작품을 삭제하지 못했습니다.");
          setActionState("idle");
        },
      );
    },
    [acceptCatalog, actionState, catalogState.status],
  );

  const retireDocument = useCallback(
    (
      work: WorkspaceWorkSummary,
      document: WorkspaceWorkSummary["documents"][number],
    ) => {
      if (
        catalogState.status !== "ready" ||
        workspaceRef.current === null ||
        actionState !== "idle"
      ) {
        return;
      }
      if (
        !window.confirm(
          `‘${document.title}’ 회차를 삭제할까요?\n원고와 기록은 복구를 위해 보존됩니다.`,
        )
      ) {
        return;
      }
      setActionState("retiring-document");
      setActionError(null);
      void workspaceRef.current
        .retireDocument(work.workId, document.documentId)
        .then(
          (nextCatalog) => {
            acceptCatalog(nextCatalog);
            setActivePage("main");
            setActionState("idle");
          },
          () => {
            setActionError("회차를 삭제하지 못했습니다.");
            setActionState("idle");
          },
        );
    },
    [acceptCatalog, actionState, catalogState.status],
  );

  const moveDocument = useCallback(
    (
      work: WorkspaceWorkSummary,
      document: WorkspaceWorkSummary["documents"][number],
      direction: "earlier" | "later",
    ) => {
      if (
        catalogState.status !== "ready" ||
        workspaceRef.current === null ||
        actionState !== "idle"
      ) {
        return;
      }
      setActionState("moving-document");
      setActionError(null);
      void workspaceRef.current
        .moveDocument(work.workId, document.documentId, direction)
        .then(
          (nextCatalog) => {
            acceptCatalog(nextCatalog);
            setActionState("idle");
          },
          () => {
            setActionError("회차 순서를 변경하지 못했습니다.");
            setActionState("idle");
          },
        );
    },
    [acceptCatalog, actionState, catalogState.status],
  );

  const runBackupAction = useCallback(
    (action: "create" | "restore") => {
      if (backupActionState !== "idle" || actionState !== "idle") {
        return;
      }
      setBackupActionState(action === "create" ? "creating" : "restoring");
      setBackupError(null);
      void (async () => {
        try {
          if (action === "create" && workspaceRef.current !== null) {
            acceptCatalog(await workspaceRef.current.prepareForMain());
          }
          const result =
            action === "create"
              ? await window.eumStudio.backup.create()
              : await window.eumStudio.backup.restore();
          if (result.status === "completed") {
            setBackupStatus({
              schemaVersion: 1,
              lastVerified: result.summary,
            });
          }
        } catch {
          setBackupError(
            action === "create"
              ? "백업을 만들지 못했습니다."
              : "백업을 새 위치에 복원하지 못했습니다.",
          );
        } finally {
          setBackupActionState("idle");
        }
      })();
    },
    [acceptCatalog, actionState, backupActionState],
  );

  const runImportRehearsal = useCallback(() => {
    if (
      importRehearsalRunning ||
      actionState !== "idle" ||
      backupActionState !== "idle"
    ) {
      return;
    }
    setImportRehearsalRunning(true);
    setImportRehearsalError(null);
    void (async () => {
      try {
        if (workspaceRef.current !== null) {
          acceptCatalog(await workspaceRef.current.prepareForMain());
        }
        const result = await window.eumStudio.migration.runLegacyLoreRehearsal();
        if (result.status === "completed") {
          setImportRehearsalSummary(result.summary);
        }
      } catch {
        setImportRehearsalError("기존 작업 가져오기 리허설을 완료하지 못했습니다.");
      } finally {
        setImportRehearsalRunning(false);
      }
    })();
  }, [acceptCatalog, actionState, backupActionState, importRehearsalRunning]);

  const busy = actionState !== "idle";

  const openQuickTools = useCallback(() => {
    if (catalogState.status === "ready" && actionState === "idle") {
      setShowAppSettings(false);
      setAppSettingsError(null);
      setShowQuickTools(true);
    }
  }, [actionState, catalogState.status]);

  const openAppSettings = useCallback(() => {
    if (actionState !== "idle") return;
    setShowQuickTools(false);
    setShowAppSettings(true);
    setAppSettingsProfile(null);
    setAppSettingsProjection(null);
    setMusicSettingsProfile(null);
    setWorkMusicSettingsProjection(null);
    setChatGptOAuthStatus(null);
    setChatGptOAuthLoginState("idle");
    setAppSettingsError(null);
    setAppSettingsActionState("loading");
    const activeWorkId = catalog?.activeWorkId ?? null;
    void Promise.all([
      window.eumStudio.settings.getProfile(),
      window.eumStudio.settings.get(),
      window.eumStudio.settings.getMusicProfile(),
      window.eumStudio.settings.getYouTubeMusicConnectionStatus(),
      window.eumStudio.assistant.getChatGptOAuthStatus(),
      activeWorkId === null
        ? Promise.resolve(null)
        : window.eumStudio.settings.getWorkMusic({
            schemaVersion: 1,
            workId: activeWorkId,
          }),
    ]).then(
      ([
        profile,
        projection,
        musicProfile,
        youtubeStatus,
        chatGptStatus,
        workMusicProjection,
      ]) => {
        setAppSettingsProfile(profile);
        setAppSettingsProjection(projection);
        setMusicSettingsProfile(musicProfile);
        setYoutubeMusicConnectionStatus(youtubeStatus);
        setChatGptOAuthStatus(chatGptStatus);
        setWorkMusicSettingsProjection(workMusicProjection);
        setAppSettingsActionState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error ? reason.message : "설정을 불러오지 못했습니다.",
        );
        setAppSettingsActionState("idle");
      },
    );
  }, [actionState, catalog]);

  const closeAppSettings = useCallback(() => {
    if (appSettingsActionState === "saving") return;
    setShowAppSettings(false);
    setAppSettingsError(null);
  }, [appSettingsActionState]);

  const saveAppSettings = useCallback(
    (value: AppSettingsSaveValue) => {
      if (appSettingsProjection === null) return;
      setAppSettingsActionState("saving");
      setAppSettingsError(null);
      const saveWorkMusic =
        value.workMusicSettings === null || workMusicSettingsProjection === null
          ? Promise.resolve(workMusicSettingsProjection)
          : window.eumStudio.settings.saveWorkMusic({
              schemaVersion: 1,
              workId: workMusicSettingsProjection.workId,
              expectedRevision: workMusicSettingsProjection.revision,
              settings: value.workMusicSettings,
            });
      const saveYouTubeConnection = value.youtubeApiKey === null
        ? Promise.resolve(youtubeMusicConnectionStatus)
        : window.eumStudio.settings.saveYouTubeMusicConnection({
            schemaVersion: 1,
            expectedRevision: youtubeMusicConnectionStatus?.revision ?? 0,
            apiKey: { mode: "replace", value: value.youtubeApiKey },
          });
      void Promise.all([
        window.eumStudio.settings.save({
          schemaVersion: 1,
          expectedRevision: appSettingsProjection.revision,
          settings: {
            defaultEpisodeCharacters: value.defaultEpisodeCharacters,
          },
        }),
        saveWorkMusic,
        saveYouTubeConnection,
      ]).then(
          ([saved, savedWorkMusic, savedYouTubeStatus]) => {
            setAppSettingsProjection(saved);
            setWorkMusicSettingsProjection(savedWorkMusic);
            setYoutubeMusicConnectionStatus(savedYouTubeStatus);
            setAppSettingsScheduleRevision(saved.revision);
            setAppSettingsActionState("idle");
            setShowAppSettings(false);
          },
          (reason: unknown) => {
            setAppSettingsError(
              reason instanceof Error ? reason.message : "설정을 저장하지 못했습니다.",
            );
            setAppSettingsActionState("idle");
          },
        );
    },
    [
      appSettingsProjection,
      workMusicSettingsProjection,
      youtubeMusicConnectionStatus,
    ],
  );

  const removeYouTubeMusicConnection = useCallback(() => {
    if (youtubeMusicConnectionStatus === null) return;
    setAppSettingsActionState("saving");
    setAppSettingsError(null);
    void window.eumStudio.settings.saveYouTubeMusicConnection({
      schemaVersion: 1,
      expectedRevision: youtubeMusicConnectionStatus.revision,
      apiKey: { mode: "remove" },
    }).then(
      (saved) => {
        setYoutubeMusicConnectionStatus(saved);
        setAppSettingsActionState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error ? reason.message : "YouTube 연결을 해제하지 못했습니다.",
        );
        setAppSettingsActionState("idle");
      },
    );
  }, [youtubeMusicConnectionStatus]);

  const startChatGptOAuthLogin = useCallback(() => {
    if (chatGptOAuthLoginState === "waiting") return;
    setChatGptOAuthLoginState("waiting");
    setAppSettingsError(null);
    void window.eumStudio.assistant.startChatGptOAuthLogin().then(
      (status) => {
        setChatGptOAuthStatus(status);
        setChatGptOAuthLoginState("idle");
      },
      (reason: unknown) => {
        setAppSettingsError(
          reason instanceof Error ? reason.message : "GPT 로그인에 실패했습니다.",
        );
        setChatGptOAuthLoginState("idle");
      },
    );
  }, [chatGptOAuthLoginState]);

  useEffect(() => {
    const handleQuickToolsShortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        openQuickTools();
      }
    };
    window.addEventListener("keydown", handleQuickToolsShortcut);
    return () => {
      window.removeEventListener("keydown", handleQuickToolsShortcut);
    };
  }, [openQuickTools]);

  const selectQuickToolTarget = useCallback(
    (target: QuickToolTarget) => {
      setShowQuickTools(false);
      if (target.id === QUICK_TOOL_MAIN_COMMAND_ID) {
        returnToMain();
        return;
      }
      if (target.id === QUICK_TOOL_CREATE_WORK_COMMAND_ID) {
        setActionError(null);
        setShowCreateWork(true);
        return;
      }
      if (target.workId !== null && catalog !== null) {
        const ownedWork = catalog.works.find(
          (work) => work.workId === target.workId,
        );
        if (ownedWork === undefined) return;
        const ownedDocument =
          target.documentId === null
            ? null
            : ownedWork.documents.find(
                (document) => document.documentId === target.documentId,
              ) ?? null;
        if (target.documentId !== null && ownedDocument === null) return;
        void openLocation(ownedWork.workId, ownedDocument?.documentId ?? null);
      }
    },
    [catalog, openLocation, returnToMain],
  );

  return (
    <StudioAppShell
      compact={sidebarCompact}
      editor={activePage === "workspace"}
      home={activePage === "main"}
      theme={theme}
    >
      <header className="app-topbar">
        <span aria-hidden="true" className="app-topbar-mark">이</span>
        <span className="app-topbar-product">이음 스튜디오</span>
        <button
          aria-label={sidebarCompact ? "사이드바 펼치기" : "사이드바 접기"}
          className="app-topbar-button"
          onClick={() => setSidebarCompact((current) => !current)}
          type="button"
        >
          {sidebarCompact ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
        <StarlightThemePicker onChange={changeTheme} theme={theme} />
        <button
          aria-label="홈 열기"
          className="app-topbar-button"
          disabled={busy}
          onClick={returnToMain}
          type="button"
        >
          <Home aria-hidden="true" size={15} />
        </button>
        <div className="app-topbar-music" ref={setMusicPlayerHost} />
        <button
          aria-label={showAppSettings ? "앱 설정 닫기" : "앱 설정 열기"}
          aria-pressed={showAppSettings}
          className={
            showAppSettings
              ? "app-topbar-button app-topbar-settings is-active"
              : "app-topbar-button app-topbar-settings"
          }
          disabled={busy || appSettingsActionState === "saving"}
          onClick={showAppSettings ? closeAppSettings : openAppSettings}
          title="설정"
          type="button"
        >
          <Settings aria-hidden="true" size={15} />
        </button>
      </header>
      <aside className="sidebar studio-sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">이</div>
          <div className="brand-copy">
            <strong>이음</strong>
          </div>
          <ChevronDown aria-hidden="true" className="brand-chevron" size={15} />
        </div>

        <nav aria-label="주요 화면" className="sidebar-navigation single-navigation">
          <button
            aria-label="빠른 도구 열기"
            className="sidebar-search"
            disabled={busy || catalogState.status !== "ready"}
            onClick={openQuickTools}
            title="빠른 도구 (Ctrl+K)"
            type="button"
          >
            <Search aria-hidden="true" size={16} />
            <span>빠른 전환</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            aria-label="메인"
            aria-current={activePage === "main" ? "page" : undefined}
            className={activePage === "main" ? "nav-item is-active" : "nav-item"}
            disabled={busy}
            onClick={returnToMain}
            type="button"
          >
            <Home aria-hidden="true" size={17} />
            <span>메인</span>
          </button>
        </nav>

        {activePage === "workspace" && (
          <div
            className="editor-page-body sidebar-document-rail"
            ref={setDocumentRailHost}
          />
        )}

      </aside>

      <main
        className={
          activePage === "workspace"
            ? "workspace is-editor-page"
            : "workspace"
        }
      >
        {activePage === "main" && (
          <header className="page-header main-page-header">
            <h1>홈</h1>
            <button
              aria-label="작품 만들기"
              className="header-create-work"
              disabled={busy || catalogState.status !== "ready"}
              onClick={() => {
                setActionError(null);
                setShowCreateWork(true);
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              <span>새 작품</span>
            </button>
          </header>
        )}

        <div
          className={
            activePage === "workspace"
              ? "page-body editor-page-body"
              : "page-body main-page-body"
          }
        >
          {activePage === "main" && catalogState.status === "loading" && (
            <p className="catalog-state" aria-live="polite">작업실을 불러오는 중입니다.</p>
          )}
          {activePage === "main" && catalogState.status === "error" && (
            <section className="catalog-state catalog-error" role="alert">
              <p>로컬 작업실을 불러오지 못했습니다.</p>
              <button onClick={() => void loadCatalog()} type="button">다시 불러오기</button>
            </section>
          )}
          {activePage === "main" && catalog !== null && (
            <MainDashboard
              backupBusy={backupActionState !== "idle"}
              busy={busy}
              catalog={catalog}
              error={actionError}
              favoriteWorkIds={favoriteWorkIds}
              workCovers={workCovers}
              importBusy={importRehearsalRunning}
              resumePreview={resumePreview}
              scheduleByWork={scheduleByWork}
              onOpenBackup={() => {
                setShowBackup(true);
                void loadBackupStatus();
              }}
              onOpenImport={() => {
                setImportRehearsalError(null);
                setShowImportRehearsal(true);
              }}
              onOpenPublishing={openPublishingPartners}
              onOpenSchedule={(work) => {
                void openWorkSchedule(work);
              }}
              onOpen={(workId, documentId) => {
                void openLocation(workId, documentId);
              }}
              onMoveDocument={moveDocument}
              onRename={(work) => {
                setActionError(null);
                setRenameWorkTarget(work);
              }}
              onRetire={retireWork}
              onRetireDocument={retireDocument}
              onToggleFavorite={toggleWorkFavorite}
              onSelectCover={selectWorkCover}
            />
          )}
          {catalog !== null && !catalog.canCreateFirstWork && uiPreferencesReady && (
            <div
              className="persistent-workspace"
              hidden={activePage !== "workspace"}
            >
              <ManuscriptWorkspace
                documentRailHost={documentRailHost}
                embedded
                eventRailHost={eventRailHost}
                musicPlayerHost={musicPlayerHost}
                onCatalogChange={acceptCatalog}
                onOpenPublishing={openPublishingPartners}
                onOpenSettings={openAppSettings}
                onReturnToWorks={returnToMain}
                onResumePreviewChange={setResumePreview}
                onScheduleChange={() => {
                  setScheduleRefreshRevision((current) => current + 1);
                }}
                focusModePreferences={focusModePreferences}
                onFocusModePreferencesChange={changeFocusModePreferences}
                onThemeChange={changeTheme}
                ref={workspaceRef}
                scheduleSettingsRevision={appSettingsScheduleRevision}
                theme={theme}
                youtubeMusicConnectionStatus={youtubeMusicConnectionStatus}
              />
            </div>
          )}
        </div>
      </main>

      {activePage === "workspace" && (
        <div className="studio-event-rail-host" ref={setEventRailHost} />
      )}

      {showCreateWork && (
        <CreateWorkDialog
          error={actionError}
          onCancel={() => {
            if (!busy) {
              setShowCreateWork(false);
              setActionError(null);
            }
          }}
          onSubmit={createWork}
          submitting={actionState === "creating"}
        />
      )}
      {renameWorkTarget !== null && (
        <RenameWorkDialog
          error={actionError}
          key={renameWorkTarget.workId}
          onCancel={() => {
            if (!busy) {
              setRenameWorkTarget(null);
              setActionError(null);
            }
          }}
          onSubmit={(title) => renameWork(renameWorkTarget, title)}
          submitting={actionState === "renaming-work"}
          work={renameWorkTarget}
        />
      )}
      {showQuickTools && catalog !== null && (
        <QuickToolsDialog
          catalog={catalog}
          disabled={busy}
          onClose={() => {
            if (!busy) setShowQuickTools(false);
          }}
          onSelect={selectQuickToolTarget}
        />
      )}
      {showAppSettings && (
        <AppSettingsDialog
          actionState={appSettingsActionState}
          chatGptOAuthLoginState={chatGptOAuthLoginState}
          chatGptOAuthStatus={chatGptOAuthStatus}
          error={appSettingsError}
          key={[
            appSettingsProjection?.revision ?? "loading",
            workMusicSettingsProjection?.revision ?? "no-work",
            youtubeMusicConnectionStatus?.revision ?? "no-youtube",
            chatGptOAuthStatus?.revision ?? "no-chatgpt",
          ].join(":")}
          musicProfile={musicSettingsProfile}
          musicProjection={workMusicSettingsProjection}
          onClose={closeAppSettings}
          onSave={saveAppSettings}
          onRemoveYouTubeApiKey={removeYouTubeMusicConnection}
          onStartChatGptOAuthLogin={startChatGptOAuthLogin}
          profile={appSettingsProfile}
          projection={appSettingsProjection}
          youtubeConnectionStatus={youtubeMusicConnectionStatus}
        />
      )}
      {showPublishingPartners && catalog !== null && (
        <PublishingPartnerDialog
          actionState={publishingPartnerActionState}
          assistantConnections={publishingAssistantConnections}
          contracts={publishingContracts}
          error={publishingPartnerError}
          initialSection={publishingInitialSection}
          workScopeId={publishingWorkScopeId}
          onClose={() => {
            if (publishingPartnerActionState === "idle") {
              setShowPublishingPartners(false);
              setPublishingPartnerError(null);
            }
          }}
          onCreate={createPublishingPartner}
          onCreateContract={createPublishingContract}
          onCreatePublication={createPublishingPublication}
          onCreateSettlement={createPublishingSettlement}
          onCreatePayment={createPublishingPayment}
          onCreateSource={createPublishingSource}
          onPreviewResearch={previewPublishingResearch}
          onApproveResearch={approvePublishingResearch}
          onRunAssistant={runPublishingAssistant}
          onApproveAssistant={approvePublishingAssistant}
          onSetEvidenceLinks={setPublishingEvidenceLinks}
          onSelectPartnerCsv={selectPublishingPartnerCsv}
          onApplyPartnerCsv={applyPublishingPartnerCsv}
          onSelectSubmissionCsv={selectPublishingSubmissionCsv}
          onApplySubmissionCsv={applyPublishingSubmissionCsv}
          onLinkMailCandidate={linkPublishingMailCandidate}
          onUpdateMailCandidate={updatePublishingMailCandidate}
          onReviewMailCandidate={reviewPublishingMailCandidate}
          onConnectMail={connectPublishingMail}
          onSyncMail={syncPublishingMail}
          onDisconnectMail={disconnectPublishingMail}
          onSaveMailSchedule={savePublishingMailSchedule}
          onCreateSubmission={createPublishingSubmission}
          onSelect={setSelectedPublishingPartnerId}
          onSelectContract={setSelectedPublishingContractId}
          onSelectPublication={setSelectedPublishingPublicationId}
          onSelectSettlement={setSelectedPublishingSettlementId}
          onSelectPayment={setSelectedPublishingPaymentId}
          onSelectSource={setSelectedPublishingSourceId}
          onSelectSubmission={setSelectedPublishingSubmissionId}
          onUpdate={updatePublishingPartner}
          onUpdateContract={updatePublishingContract}
          onUpdatePublication={updatePublishingPublication}
          onUpdateSettlement={updatePublishingSettlement}
          onUpdatePayment={updatePublishingPayment}
          onUpdateSubmission={updatePublishingSubmission}
          partners={publishingPartners}
          mailCandidates={publishingMailCandidates}
          mailConnection={publishingMailConnection}
          mailSchedule={publishingMailSchedule}
          mailSyncResult={publishingMailSyncResult}
          payments={publishingPayments}
          sources={publishingSources}
          publications={publishingPublications}
          settlements={publishingSettlements}
          selectedContractId={selectedPublishingContractId}
          selectedPartnerId={selectedPublishingPartnerId}
          selectedPublicationId={selectedPublishingPublicationId}
          selectedSettlementId={selectedPublishingSettlementId}
          selectedPaymentId={selectedPublishingPaymentId}
          selectedSourceId={selectedPublishingSourceId}
          selectedSubmissionId={selectedPublishingSubmissionId}
          submissions={publishingSubmissions}
          works={
            publishingWorkScopeId === null
              ? catalog.works
              : catalog.works.filter(
                  (work) => work.workId === publishingWorkScopeId,
                )
          }
        />
      )}
      {showBackup && (
        <BackupDialog
          actionState={backupActionState}
          error={backupError}
          onCancel={() => {
            if (backupActionState === "idle") {
              setShowBackup(false);
              setBackupError(null);
            }
          }}
          onCreate={() => runBackupAction("create")}
          onRestore={() => runBackupAction("restore")}
          status={backupStatus}
        />
      )}
      {showImportRehearsal && (
        <ImportRehearsalDialog
          error={importRehearsalError}
          onCancel={() => {
            if (!importRehearsalRunning) {
              setShowImportRehearsal(false);
              setImportRehearsalError(null);
            }
          }}
          onRun={runImportRehearsal}
          running={importRehearsalRunning}
          summary={importRehearsalSummary}
        />
      )}
    </StudioAppShell>
  );
}
