import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { RuntimeInfo } from "../application/contracts/studio-bridge";
import type {
  ManuscriptDocumentProfile,
  ManuscriptDocumentSource,
} from "../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import {
  searchManuscriptsForWork,
  type ManuscriptSearchResult,
} from "../application/editor/search-manuscripts";
import {
  ManuscriptEditor,
  type ManuscriptDocumentStateSummary,
  type ManuscriptEditorHandle,
} from "./editor/ManuscriptEditor";
import type { ManuscriptTransaction } from "./editor/manuscript-transaction";
import type { ManuscriptTextStatistics } from "./editor/manuscript-text-statistics";
import { ManuscriptTelemetryStore } from "./editor/manuscript-telemetry-store";
import {
  createWorkspaceRailState,
  projectWorkspaceRails,
  setWorkspaceRailLayout,
  toggleWorkspaceRail,
  type WorkspaceRail,
  type WorkspaceRailLayout,
} from "./workspace-rail-state";

type RuntimeState =
  | { status: "loading" }
  | {
      status: "ready";
      info: RuntimeInfo;
      inputProfile: ManuscriptInputProfile;
      documentProfile: ManuscriptDocumentProfile;
      activeDocumentId: ManuscriptDocumentProfile["initialDocumentId"];
    }
  | { status: "error" };

type ManuscriptSearchState = {
  readonly sequence: number;
  readonly result: ManuscriptSearchResult;
};

function ManuscriptCount(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
}) {
  const statistics = useSyncExternalStore(
    input.telemetryStore.subscribeStatistics,
    input.telemetryStore.getStatisticsSnapshot,
  );
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <p aria-live="polite" className="manuscript-count">
      <span className="character-count">
        <span>공백 포함 </span>
        <output data-testid="manuscript-character-count">
          {statistics.characterCount}
        </output>
        <span>자</span>
      </span>
      <span aria-hidden="true">·</span>
      <span className="character-count">
        <span>공백 제외 </span>
        <output data-testid="manuscript-character-count-without-whitespace">
          {statistics.characterCountWithoutWhitespace}
        </output>
        <span>자</span>
      </span>
      {hasSelection && (
        <span
          className="selection-count"
          data-testid="manuscript-selection-active"
        >
          <span aria-hidden="true">·</span>
          <span>선택됨</span>
        </span>
      )}
    </p>
  );
}

function ManuscriptReviewSummary(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
}) {
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <p className="review-rail-summary" aria-live="polite">
      {hasSelection
        ? "선택 범위를 검토할 수 있습니다."
        : "선택 범위가 없습니다."}
    </p>
  );
}

export function App() {
  const documentRailId = useId();
  const reviewRailId = useId();
  const workspaceBodyRef = useRef<HTMLDivElement>(null);
  const manuscriptEditorRef =
    useRef<ManuscriptEditorHandle>(null);
  const [telemetryStore] = useState(
    () => new ManuscriptTelemetryStore(),
  );
  const manuscriptSearchRef =
    useRef<ManuscriptSearchState | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>({ status: "loading" });
  const [railState, setRailState] = useState(() =>
    createWorkspaceRailState({
      layout: "wide",
      initialVisibility: {
        left: "open",
        right: "open",
      },
    }),
  );
  const [manuscriptSearchQuery, setManuscriptSearchQuery] =
    useState("");
  const [manuscriptSearch, setManuscriptSearch] =
    useState<ManuscriptSearchState | null>(null);

  const handleManuscriptTransaction = useCallback(
    (
      _document: ManuscriptDocumentSource,
      transaction: ManuscriptTransaction,
      statistics: ManuscriptTextStatistics,
    ) => {
      telemetryStore.publish(
        statistics,
        transaction.selection.ranges.some((range) => !range.empty),
      );
      if (
        transaction.changes.length > 0 &&
        manuscriptSearchRef.current !== null
      ) {
        manuscriptSearchRef.current = null;
        setManuscriptSearch(null);
      }
    },
    [telemetryStore],
  );
  const handleDocumentActivated = useCallback(
    (
      _document: ManuscriptDocumentSource,
      summary: ManuscriptDocumentStateSummary,
    ) => {
      telemetryStore.publish(
        summary.statistics,
        summary.selection.ranges.some((range) => !range.empty),
      );
    },
    [telemetryStore],
  );

  useEffect(() => {
    let disposed = false;

    Promise.all([
      window.eumStudio.system.getRuntimeInfo(),
      window.eumStudio.editor.getManuscriptInputProfile(),
      window.eumStudio.editor.getManuscriptDocumentProfile(),
    ]).then(
      ([info, inputProfile, documentProfile]) => {
        if (!disposed) {
          setRuntime({
            status: "ready",
            info,
            inputProfile,
            documentProfile,
            activeDocumentId: documentProfile.initialDocumentId,
          });
        }
      },
      () => {
        if (!disposed) {
          setRuntime({ status: "error" });
        }
      },
    );

    return () => {
      disposed = true;
    };
  }, []);

  const activeDocument =
    runtime.status === "ready"
      ? runtime.documentProfile.documents.find(
          (document) => document.documentId === runtime.activeDocumentId,
        )
      : undefined;
  const railProjection =
    activeDocument === undefined
      ? null
      : projectWorkspaceRails(railState, activeDocument.workId);
  const toggleRail = useCallback(
    (rail: WorkspaceRail) => {
      if (activeDocument === undefined) {
        return;
      }
      setRailState((current) =>
        toggleWorkspaceRail(current, activeDocument.workId, rail),
      );
    },
    [activeDocument],
  );
  const activateDocumentById = useCallback(
    (documentId: string) => {
      if (runtime.status !== "ready") {
        return;
      }
      const selectedDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === documentId,
      );
      if (selectedDocument === undefined) {
        return;
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.documentId === runtime.activeDocumentId,
      );
      if (currentDocument?.workId !== selectedDocument.workId) {
        setManuscriptSearchQuery("");
        manuscriptSearchRef.current = null;
        setManuscriptSearch(null);
      }
      setRuntime({
        ...runtime,
        activeDocumentId: selectedDocument.documentId,
      });
    },
    [runtime],
  );
  const executeSearch = useCallback(() => {
    if (
      runtime.status !== "ready" ||
      activeDocument === undefined ||
      manuscriptSearchQuery.length === 0
    ) {
      return;
    }
    const result = searchManuscriptsForWork({
      workId: activeDocument.workId,
      documents: runtime.documentProfile.documents,
      query: manuscriptSearchQuery,
      readManuscript: (document) =>
        manuscriptEditorRef.current?.materializeDocumentText(
          document,
        ) ?? document.initialText,
    });
    const nextSearch = {
      sequence: (manuscriptSearchRef.current?.sequence ?? 0) + 1,
      result,
    };
    manuscriptSearchRef.current = nextSearch;
    setManuscriptSearch(nextSearch);
  }, [activeDocument, manuscriptSearchQuery, runtime]);

  useEffect(() => {
    const workspaceBody = workspaceBodyRef.current;
    if (workspaceBody === null) {
      return;
    }
    const synchronizeLayout = () => {
      const configuredLayout = getComputedStyle(workspaceBody)
        .getPropertyValue("--workspace-layout-mode")
        .trim();
      const layout: WorkspaceRailLayout =
        configuredLayout === "narrow" ? "narrow" : "wide";
      setRailState((current) =>
        setWorkspaceRailLayout(current, layout),
      );
    };
    const observer = new ResizeObserver(synchronizeLayout);
    observer.observe(workspaceBody);
    synchronizeLayout();
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="studio-kicker">장편 편집기 POC</p>
          <h1>이음 스튜디오</h1>
        </div>
        <p
          aria-live="polite"
          className="runtime-status"
          data-testid="runtime-status"
        >
          {runtime.status === "loading" && "런타임 확인 중"}
          {runtime.status === "error" && "런타임 연결 실패"}
          {runtime.status === "ready" &&
            `연결됨 · ${runtime.info.platform} · ${runtime.info.architecture}`}
        </p>
      </header>
      <section
        aria-labelledby="manuscript-heading"
        className="writing-workspace"
      >
        <header className="manuscript-header">
          <div>
            <p className="manuscript-context">로컬 편집 표면</p>
            <h2 id="manuscript-heading">원고</h2>
          </div>
          <div className="manuscript-tools">
            <ManuscriptCount telemetryStore={telemetryStore} />
          </div>
        </header>
        <div className="workspace-body" ref={workspaceBodyRef}>
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.left.visible && (
              <aside
                aria-label="문서 레일"
                className="workspace-rail workspace-rail-left"
                id={documentRailId}
              >
                <header className="workspace-rail-header">
                  <h3>문서</h3>
                  <button
                    aria-label="문서 레일 닫기"
                    aria-controls={documentRailId}
                    className="rail-toggle"
                    onClick={() => toggleRail("left")}
                    type="button"
                  >
                    닫기
                  </button>
                </header>
                <label className="document-switch-label">
                  <span>현재 문서</span>
                  <select
                    aria-label="문서 전환"
                    onChange={(event) => {
                      activateDocumentById(event.target.value);
                    }}
                    value={runtime.activeDocumentId}
                  >
                    {runtime.documentProfile.documents.map((document) => (
                      <option
                        key={document.documentId}
                        value={document.documentId}
                      >
                        {document.label}
                      </option>
                    ))}
                  </select>
                </label>
                <form
                  className="manuscript-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    executeSearch();
                  }}
                  role="search"
                >
                  <label>
                    <span>작품 원고 검색</span>
                    <input
                      aria-label="원고 검색"
                      onChange={(event) => {
                        setManuscriptSearchQuery(event.target.value);
                      }}
                      type="search"
                      value={manuscriptSearchQuery}
                    />
                  </label>
                  <button
                    disabled={manuscriptSearchQuery.length === 0}
                    type="submit"
                  >
                    검색
                  </button>
                </form>
                {manuscriptSearch !== null &&
                  manuscriptSearch.result.workId ===
                    activeDocument.workId && (
                    <section
                      aria-label="원고 검색 결과"
                      className="manuscript-search-results"
                    >
                      <output
                        className="visually-hidden"
                        data-testid="search-run-sequence"
                      >
                        {manuscriptSearch.sequence}
                      </output>
                      <p data-testid="search-result-summary">
                        {
                          manuscriptSearch.result
                            .matchingDocumentCount
                        }
                        개 문서 ·{" "}
                        {manuscriptSearch.result.totalMatchCount}
                        개 일치
                      </p>
                      <ul>
                        {manuscriptSearch.result.documents.map(
                          (document) => (
                            <li key={document.documentId}>
                              <button
                                onClick={() =>
                                  activateDocumentById(
                                    document.documentId,
                                  )
                                }
                                type="button"
                              >
                                {document.label}
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    </section>
                  )}
              </aside>
            )}
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.left.reentryVisible && (
              <button
                aria-controls={documentRailId}
                aria-label="문서 레일 열기"
                className="rail-reentry rail-reentry-left"
                onClick={() => toggleRail("left")}
                type="button"
              >
                문서
              </button>
            )}
          <div
            className="workspace-center"
            data-active-document-id={activeDocument?.documentId}
          >
            {runtime.status === "ready" && activeDocument !== undefined && (
              <ManuscriptEditor
                accessibleName="원고"
                activeDocument={activeDocument}
                inputProfile={runtime.inputProfile}
                onDocumentActivated={handleDocumentActivated}
                onTransaction={handleManuscriptTransaction}
                ref={manuscriptEditorRef}
              />
            )}
          </div>
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.right.visible && (
              <aside
                aria-label="검토 레일"
                className="workspace-rail workspace-rail-right"
                id={reviewRailId}
              >
                <header className="workspace-rail-header">
                  <h3>검토</h3>
                  <button
                    aria-label="검토 레일 닫기"
                    aria-controls={reviewRailId}
                    className="rail-toggle"
                    onClick={() => toggleRail("right")}
                    type="button"
                  >
                    닫기
                  </button>
                </header>
                <ManuscriptReviewSummary
                  telemetryStore={telemetryStore}
                />
              </aside>
            )}
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.right.reentryVisible && (
              <button
                aria-controls={reviewRailId}
                aria-label="검토 레일 열기"
                className="rail-reentry rail-reentry-right"
                onClick={() => toggleRail("right")}
                type="button"
              >
                검토
              </button>
            )}
        </div>
        <footer aria-label="작업 상태" className="workspace-statusbar">
          {activeDocument !== undefined && (
            <>
              <span className="status-item">
                <span>작품</span>
                <output
                  data-testid="current-work"
                  title={activeDocument.workId}
                >
                  {activeDocument.workId}
                </output>
              </span>
              <span className="status-item">
                <span>문서</span>
                <output data-testid="current-document">
                  {activeDocument.label}
                </output>
              </span>
            </>
          )}
          <span data-testid="save-state">영속 저장 미연결</span>
          <span data-testid="focus-summary">집중 기록 미연결</span>
          <span>
            {runtime.status === "loading" && "런타임 확인 중"}
            {runtime.status === "error" && "런타임 연결 경고"}
            {runtime.status === "ready" && "런타임 정상"}
          </span>
        </footer>
      </section>
    </main>
  );
}
