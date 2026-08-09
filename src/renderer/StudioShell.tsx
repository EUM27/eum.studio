import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Archive,
  BookOpen,
  ChevronRight,
  Download,
  Feather,
  FileText,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../application/workspace/workspace-contract";
import type {
  WorkActivityProjection,
} from "../application/activity/work-activity-contract";
import type {
  LocalWorkspaceBackupStatusProjection,
} from "../application/storage/local-workspace-backup-contract";
import type {
  LegacyLoreImportRehearsalSummary,
} from "../application/migration/legacy-lore-import-contract";
import {
  App as ManuscriptWorkspace,
  type ManuscriptWorkspaceHandle,
} from "./App";

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

function formatActivityDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

function WorkCard({
  work,
  activeDocumentId,
  disabled,
  onOpen,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly activeDocumentId: string | null;
  readonly disabled: boolean;
  readonly onOpen: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"] | null,
  ) => void;
}) {
  return (
    <article className="library-work-card">
      <header>
        <span className="work-cover" aria-hidden="true">
          {work.title.slice(0, 1)}
        </span>
        <div>
          <h3>{work.title}</h3>
          <p className="continue-description">
            {work.documents.length}개 회차 · {formatUpdatedAt(work.updatedAt)}
          </p>
        </div>
        <button
          aria-label={`${work.title} 이어쓰기`}
          className="work-open-button"
          disabled={disabled}
          onClick={() => onOpen(work.workId, null)}
          type="button"
        >
          이어쓰기
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </header>
      <div className="document-list" aria-label={`${work.title} 회차 목록`}>
        {work.documents.map((document) => (
          <button
            className={
              document.documentId === activeDocumentId
                ? "document-list-item is-active"
                : "document-list-item"
            }
            disabled={disabled}
            key={document.documentId}
            onClick={() => onOpen(work.workId, document.documentId)}
            type="button"
          >
            <FileText aria-hidden="true" size={15} />
            <span>{document.title}</span>
            <ChevronRight aria-hidden="true" size={14} />
          </button>
        ))}
      </div>
    </article>
  );
}

function MainDashboard({
  catalog,
  activityByWork,
  busy,
  backupBusy,
  importBusy,
  error,
  onCreateWork,
  onOpenBackup,
  onOpenImport,
  onOpen,
}: {
  readonly catalog: WorkspaceCatalogProjection;
  readonly activityByWork: Readonly<Record<string, WorkActivityProjection>>;
  readonly busy: boolean;
  readonly error: string | null;
  readonly backupBusy: boolean;
  readonly importBusy: boolean;
  readonly onCreateWork: () => void;
  readonly onOpenBackup: () => void;
  readonly onOpenImport: () => void;
  readonly onOpen: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"] | null,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredWorks = useMemo(
    () =>
      normalizedQuery.length === 0
        ? catalog.works
        : catalog.works.filter(
            (work) =>
              work.title.toLocaleLowerCase().includes(normalizedQuery) ||
              work.documents.some((document) =>
                document.title.toLocaleLowerCase().includes(normalizedQuery),
              ),
          ),
    [catalog.works, normalizedQuery],
  );
  const activeWork = catalog.works.find(
    (work) => work.workId === catalog.activeWorkId,
  );
  const activeDocument = activeWork?.documents.find(
    (document) => document.documentId === catalog.activeDocumentId,
  );
  const activeActivity =
    activeWork === undefined ? undefined : activityByWork[activeWork.workId];
  const sessionRecords = useMemo(
    () =>
      catalog.works
        .flatMap((work) => {
          const activity = activityByWork[work.workId];
          if (activity === undefined) {
            return [];
          }
          return activity.sessions.map((session) => ({
            work,
            session,
            document: work.documents.find(
              (document) => document.documentId === session.documentId,
            ),
          }));
        })
        .sort(
          (left, right) =>
            Date.parse(right.session.startedAt) -
            Date.parse(left.session.startedAt),
        ),
    [activityByWork, catalog.works],
  );

  return (
    <div className="main-dashboard-real">
      <section className="continue-panel">
        <div>
          <p className="panel-kicker">CONTINUE WRITING</p>
          <h2>
            {activeWork === undefined ? "첫 작품을 시작하세요" : activeWork.title}
          </h2>
          <p>
            {activeDocument === undefined
              ? "작품과 첫 회차를 만들면 바로 원고를 쓸 수 있습니다."
              : `${activeDocument.title}에서 정확히 이어 씁니다.`}
          </p>
          {activeActivity !== undefined &&
            (activeActivity.activeSessionId !== null ||
              activeActivity.activeFocusCycleId !== null) && (
              <div className="dashboard-live-activity" aria-label="진행 중인 작업">
                {activeActivity.activeSessionId !== null && (
                  <span>집필 기록 중</span>
                )}
                {activeActivity.focusCycles
                  .filter(
                    (cycle) =>
                      cycle.focusCycleId === activeActivity.activeFocusCycleId,
                  )
                  .map((cycle) => (
                    <span key={cycle.focusCycleId}>{cycle.phaseRef}</span>
                  ))}
              </div>
            )}
        </div>
        <button
          className="continue-button"
          disabled={busy}
          onClick={() => {
            if (activeWork === undefined) {
              onCreateWork();
              return;
            }
            onOpen(activeWork.workId, activeDocument?.documentId ?? null);
          }}
          type="button"
        >
          <Feather aria-hidden="true" size={18} />
          {activeWork === undefined ? "작품 만들기" : "이어쓰기"}
        </button>
      </section>

      {sessionRecords.length > 0 && (
        <section className="records-overview" aria-labelledby="records-heading">
          <header>
            <div>
              <p className="panel-kicker">WRITING RECORDS</p>
              <h2 id="records-heading">집필 기록</h2>
            </div>
            <span>{sessionRecords.length}회</span>
          </header>
          <div className="records-strip">
            {sessionRecords.map(({ work, session, document }) => (
              <button
                disabled={busy || document === undefined}
                key={session.sessionId}
                onClick={() => {
                  if (document !== undefined) {
                    onOpen(work.workId, document.documentId);
                  }
                }}
                type="button"
              >
                <span className="record-state">
                  {session.state === "active" ? "진행 중" : "완료"}
                </span>
                <strong>{work.title}</strong>
                <span>{document?.title ?? "연결된 회차 없음"}</span>
                <span>
                  {formatActivityDuration(session.activeDurationMs)}
                  {session.characterDelta === null
                    ? ""
                    : ` · ${session.characterDelta >= 0 ? "+" : ""}${session.characterDelta}자`}
                </span>
                <time dateTime={session.startedAt}>
                  {formatUpdatedAt(session.startedAt)}
                </time>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="library-section" aria-labelledby="library-heading">
        <header className="library-heading-row">
          <div>
            <p className="panel-kicker">MY WORKS</p>
            <h2 id="library-heading">내 작품</h2>
            <p>
              {catalog.works.length}개 작품 · {catalog.works.reduce(
                (count, work) => count + work.documents.length,
                0,
              )}개 회차
            </p>
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
            <button
              className="secondary-button backup-button"
              disabled={busy || backupBusy}
              onClick={onOpenBackup}
              type="button"
            >
              <Archive aria-hidden="true" size={16} />
              백업
            </button>
            <button
              className="secondary-button import-button"
              disabled={busy || importBusy}
              onClick={onOpenImport}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              기존 작업 가져오기
            </button>
            <button
              className="primary-button new-work-button"
              disabled={busy}
              onClick={onCreateWork}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              새 작품
            </button>
          </div>
        </header>

        {error !== null && (
          <p className="shell-action-error" role="alert">
            {error}
          </p>
        )}

        {catalog.works.length === 0 ? (
          <button
            className="empty-library"
            disabled={busy}
            onClick={onCreateWork}
            type="button"
          >
            <BookOpen aria-hidden="true" size={28} />
            <strong>아직 작품이 없습니다</strong>
            <span>작품과 첫 회차를 로컬에 만듭니다.</span>
          </button>
        ) : filteredWorks.length === 0 ? (
          <p className="empty-search-result">검색 결과가 없습니다.</p>
        ) : (
          <div className="library-work-list">
            {filteredWorks.map((work) => (
              <WorkCard
                activeDocumentId={
                  work.workId === catalog.activeWorkId
                    ? catalog.activeDocumentId
                    : null
                }
                disabled={busy}
                key={work.workId}
                onOpen={onOpen}
                work={work}
              />
            ))}
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
  return (
    <div className="dialog-backdrop" role="presentation">
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
  return (
    <div className="dialog-backdrop" role="presentation">
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
          기존 이음 에디터 폴더를 읽기 전용으로 봉인하고, 선택한 새 위치에 별도의 리허설 작업실을 만듭니다. 현재 작업실에는 합치지 않습니다.
        </p>
        {summary === null ? (
          <p className="backup-empty-state">
            실행하면 원본 checksum, 원고별 checksum, receipt 누락 여부를 함께 검증합니다.
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
    firstDocumentTitle.trim().length > 0 &&
    !submitting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit({ title, firstDocumentTitle });
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
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
              placeholder="예: 1화"
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

export function StudioShell() {
  const workspaceRef = useRef<ManuscriptWorkspaceHandle>(null);
  const [documentRailHost, setDocumentRailHost] =
    useState<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState<ShellPage>("main");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [showCreateWork, setShowCreateWork] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showImportRehearsal, setShowImportRehearsal] = useState(false);
  const [actionState, setActionState] = useState<
    "idle" | "opening" | "creating" | "leaving"
  >("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [activityByWork, setActivityByWork] = useState<
    Readonly<Record<string, WorkActivityProjection>>
  >({});
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

  const catalog =
    catalogState.status === "ready" ? catalogState.catalog : null;

  const loadCatalog = useCallback(async () => {
    setCatalogState({ status: "loading" });
    try {
      const loaded = await window.eumStudio.workspace.getCatalog();
      setCatalogState({ status: "ready", catalog: loaded });
    } catch {
      setCatalogState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void window.eumStudio.workspace.getCatalog().then(
      (loaded) => {
        if (!disposed) {
          setCatalogState({ status: "ready", catalog: loaded });
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
          setActivityByWork({});
        }
      });
      return () => {
        disposed = true;
      };
    }
    let disposed = false;
    void Promise.all(
      catalog.works.map((work) =>
        window.eumStudio.activity.listWork({
          schemaVersion: 1,
          workId: work.workId,
        }),
      ),
    ).then(
      (projections) => {
        if (!disposed) {
          setActivityByWork(
            Object.freeze(
              Object.fromEntries(
                projections.map((projection) => [
                  projection.workId,
                  projection,
                ]),
              ),
            ),
          );
        }
      },
      () => {
        if (!disposed) {
          setActivityByWork({});
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [catalog]);

  const acceptCatalog = useCallback(
    (nextCatalog: WorkspaceCatalogProjection) => {
      setCatalogState({ status: "ready", catalog: nextCatalog });
    },
    [],
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

  return (
    <div className={sidebarCompact ? "app-shell sidebar-compact" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">이</div>
          <div className="brand-copy">
            <strong>이음 스튜디오</strong>
            <span>로컬 집필 작업실</span>
          </div>
          <button
            aria-label={sidebarCompact ? "사이드바 펼치기" : "사이드바 접기"}
            className="sidebar-toggle"
            onClick={() => setSidebarCompact((current) => !current)}
            type="button"
          >
            {sidebarCompact ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
        </div>

        <nav aria-label="주요 화면" className="sidebar-navigation single-navigation">
          <button
            aria-current={activePage === "main" ? "page" : undefined}
            className={activePage === "main" ? "nav-item is-active" : "nav-item"}
            disabled={busy}
            onClick={returnToMain}
            type="button"
          >
            <Home aria-hidden="true" size={17} />
            <span>메인</span>
          </button>
          <button
            className="sidebar-create-work"
            disabled={busy || catalogState.status !== "ready"}
            onClick={() => {
              setActionError(null);
              setShowCreateWork(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            <span>새 작품</span>
          </button>
        </nav>

        {activePage === "workspace" && (
          <div
            className="editor-page-body sidebar-document-rail"
            ref={setDocumentRailHost}
          />
        )}

        <div className="sidebar-footer">
          <div className="profile-avatar">작</div>
          <div>
            <strong>나의 작업실</strong>
            <span>이 컴퓨터에 저장됩니다</span>
          </div>
        </div>
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
            <div>
              <p className="eyebrow">이음 스튜디오</p>
              <h1>메인</h1>
              <p className="page-description">
                작품과 회차를 한 화면에서 열고 바로 이어 씁니다.
              </p>
            </div>
            <span className="local-badge">
              <span className="status-dot" />
              로컬 작업실
            </span>
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
              activityByWork={activityByWork}
              backupBusy={backupActionState !== "idle"}
              busy={busy}
              catalog={catalog}
              error={actionError}
              importBusy={importRehearsalRunning}
              onCreateWork={() => {
                setActionError(null);
                setShowCreateWork(true);
              }}
              onOpenBackup={() => {
                setShowBackup(true);
                void loadBackupStatus();
              }}
              onOpenImport={() => {
                setImportRehearsalError(null);
                setShowImportRehearsal(true);
              }}
              onOpen={(workId, documentId) => {
                void openLocation(workId, documentId);
              }}
            />
          )}
          {catalog !== null && !catalog.canCreateFirstWork && (
            <div
              className="persistent-workspace"
              hidden={activePage !== "workspace"}
            >
              <ManuscriptWorkspace
                documentRailHost={documentRailHost}
                embedded
                onCatalogChange={acceptCatalog}
                ref={workspaceRef}
              />
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}
