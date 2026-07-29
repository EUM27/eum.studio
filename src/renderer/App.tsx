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
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import type {
  ManuscriptDocumentProfile,
  ManuscriptDocumentSource,
} from "../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import type { ManuscriptPersistenceProfile } from "../application/persistence/manuscript-persistence-profile";
import {
  createApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import { entityId } from "../domain/writing";
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
  ManuscriptDurableSaveQueue,
  type ManuscriptSaveState,
} from "./persistence/manuscript-durable-save-queue";
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
      persistenceProfile: ManuscriptPersistenceProfile | null;
      startupRecovery: StartupRecoveryProjection;
      resumeCheckpoint:
        ManuscriptResumeCheckpointProjection;
      activeDocumentId: ManuscriptDocumentProfile["initialDocumentId"];
    }
  | { status: "error" };

type ManuscriptSearchState = {
  readonly sequence: number;
  readonly result: ManuscriptSearchResult;
};

type RuntimeProjection = {
  readonly info: RuntimeInfo;
  readonly inputProfile: ManuscriptInputProfile;
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly persistenceProfile:
    ManuscriptPersistenceProfile | null;
  readonly startupRecovery:
    StartupRecoveryProjection;
  readonly resumeCheckpoint:
    ManuscriptResumeCheckpointProjection;
};

async function queryRuntimeProjection(): Promise<RuntimeProjection> {
  const [
    info,
    inputProfile,
    documentProfile,
    persistenceProfile,
    startupRecovery,
    resumeCheckpoint,
  ] = await Promise.all([
    window.eumStudio.system.getRuntimeInfo(),
    window.eumStudio.editor.getManuscriptInputProfile(),
    window.eumStudio.editor.getManuscriptDocumentProfile(),
    window.eumStudio.editor.getManuscriptPersistenceProfile(),
    window.eumStudio.editor.getManuscriptStartupRecovery(),
    window.eumStudio.editor.getManuscriptResumeCheckpoint(),
  ]);
  return Object.freeze({
    info,
    inputProfile,
    documentProfile,
    persistenceProfile,
    startupRecovery,
    resumeCheckpoint,
  });
}

const SAVE_STATE_LABELS: Readonly<
  Record<ManuscriptSaveState, string>
> = Object.freeze({
  editing: "편집 중",
  saving: "저장 중",
  saved: "저장됨",
  failed: "실패",
});

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
  const recoveryHeadingId = useId();
  const reviewRailId = useId();
  const workspaceBodyRef = useRef<HTMLDivElement>(null);
  const manuscriptEditorRef =
    useRef<ManuscriptEditorHandle>(null);
  const durableSaveQueueRef =
    useRef<ManuscriptDurableSaveQueue | null>(null);
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
  const [saveStates, setSaveStates] = useState<
    Readonly<Record<string, ManuscriptSaveState>>
  >({});
  const [recoveryApplyState, setRecoveryApplyState] =
    useState<"idle" | "applying" | "failed">("idle");

  const handleManuscriptTransaction = useCallback(
    (
      _document: ManuscriptDocumentSource,
      transaction: ManuscriptTransaction,
      statistics: ManuscriptTextStatistics,
      composing: boolean,
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
      if (transaction.changes.length > 0) {
        const pending = durableSaveQueueRef.current?.record(
          _document.documentId,
          transaction,
          { composing },
        );
        void pending?.catch(() => undefined);
      }
    },
    [telemetryStore],
  );
  const handleCompositionEnd = useCallback(
    (document: ManuscriptDocumentSource) => {
      const pending =
        durableSaveQueueRef.current?.compositionEnd(
          document.documentId,
        );
      void pending?.catch(() => undefined);
    },
    [],
  );
  const handleEditorBlur = useCallback(
    (document: ManuscriptDocumentSource) => {
      const pending = durableSaveQueueRef.current?.flush(
        document.documentId,
      );
      void pending?.catch(() => undefined);
    },
    [],
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

  const installRuntimeProjection = useCallback(
    (
      projection: RuntimeProjection,
      preferredDocumentId:
        ManuscriptDocumentProfile["initialDocumentId"] | null,
    ) => {
      const {
        info,
        inputProfile,
        documentProfile,
        persistenceProfile,
        startupRecovery,
        resumeCheckpoint,
      } = projection;
      if (
        startupRecovery.status !== "clean" &&
        persistenceProfile !== null
      ) {
        throw new Error(
          "Recovery-blocked runtime exposed a persistence projection",
        );
      }
      const resumeDocument =
        resumeCheckpoint.status ===
          "resolved" ||
        resumeCheckpoint.status ===
          "needsReview" ||
        resumeCheckpoint.status ===
          "broken"
          ? documentProfile.documents.find(
              (document) =>
                document.documentId ===
                  resumeCheckpoint.documentId &&
                document.workId ===
                  resumeCheckpoint.workId &&
                document.documentRevisionId ===
                  resumeCheckpoint.targetRevisionId,
            )
          : undefined;
      if (
        (resumeCheckpoint.status ===
          "resolved" ||
          resumeCheckpoint.status ===
            "needsReview" ||
          resumeCheckpoint.status ===
            "broken") &&
        resumeDocument === undefined
      ) {
        throw new Error(
          "Resume checkpoint does not match the confirmed document source",
        );
      }
      if (
        resumeCheckpoint.status ===
          "resolved" &&
        resumeDocument !== undefined &&
        (resumeCheckpoint.selection.anchor >
          resumeDocument.initialText.length ||
          resumeCheckpoint.selection.head >
            resumeDocument.initialText.length)
      ) {
        throw new Error(
          "Resume checkpoint selection is outside the confirmed document source",
        );
      }
      if (persistenceProfile === null) {
        durableSaveQueueRef.current = null;
        setSaveStates({});
      } else {
        const sequencesByDocument = new Map(
          persistenceProfile.documentSequences.map(
            (sequence) => [
              sequence.documentId,
              sequence.nextSequence,
            ],
          ),
        );
        if (
          sequencesByDocument.size !==
          documentProfile.documents.length
        ) {
          throw new Error(
            "Persistence projection does not match the document profile",
          );
        }
        const queueDocuments =
          documentProfile.documents.map((document) => {
            if (document.documentRevisionId === null) {
              throw new Error(
                `Persistence document has no durable base revision: ${document.documentId}`,
              );
            }
            const nextSequence =
              sequencesByDocument.get(
                document.documentId,
              );
            if (nextSequence === undefined) {
              throw new Error(
                `Persistence projection has no sequence for document: ${document.documentId}`,
              );
            }
            return {
              workId: document.workId,
              documentId: document.documentId,
              baseRevisionId:
                document.documentRevisionId,
              nextSequence,
            };
          });
        durableSaveQueueRef.current =
          new ManuscriptDurableSaveQueue({
            documents: queueDocuments,
            policy: {
              maxTransactionsPerBatch:
                persistenceProfile.batching
                  .maxTransactionsPerBatch,
              maxDelayMs:
                persistenceProfile.batching
                  .maxDelayMs,
            },
            saveChangeBatch: (batch) =>
              window.eumStudio.editor.saveChangeBatch(
                batch,
              ),
            createBatchId: () =>
              entityId<"ChangeBatch">(
                crypto.randomUUID(),
              ),
            now: () => new Date().toISOString(),
            scheduler: {
              schedule: (delayMs, callback) =>
                window.setTimeout(
                  callback,
                  delayMs,
                ),
              cancel: (handle) => {
                if (typeof handle === "number") {
                  window.clearTimeout(handle);
                }
              },
            },
            onStateChange: (
              documentId,
              state,
            ) => {
              setSaveStates((current) =>
                Object.freeze({
                  ...current,
                  [documentId]: state,
                }),
              );
            },
          });
        setSaveStates(
          Object.freeze(
            Object.fromEntries(
              queueDocuments.map((document) => [
                document.documentId,
                "saved" as const,
              ]),
            ),
          ),
        );
      }
      const activeDocumentId =
        preferredDocumentId !== null &&
        documentProfile.documents.some(
          (document) =>
            document.documentId ===
            preferredDocumentId,
        )
          ? preferredDocumentId
          : resumeDocument?.documentId ??
            documentProfile.initialDocumentId;
      setRuntime({
        status: "ready",
        info,
        inputProfile,
        documentProfile,
        persistenceProfile,
        startupRecovery,
        resumeCheckpoint,
        activeDocumentId,
      });
    },
    [],
  );

  useEffect(() => {
    let disposed = false;

    void queryRuntimeProjection().then(
      (projection) => {
        if (!disposed) {
          try {
            installRuntimeProjection(
              projection,
              null,
            );
          } catch {
            durableSaveQueueRef.current = null;
            setRuntime({ status: "error" });
          }
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
      durableSaveQueueRef.current = null;
    };
  }, [installRuntimeProjection]);

  useEffect(
    () =>
      window.eumStudio.editor.onManuscriptCloseRequest(
        (request) => {
          const queue =
            durableSaveQueueRef.current;
          const documents =
            runtime.status === "ready"
              ? runtime.documentProfile
                  .documents
              : [];
          const flush =
            queue === null
              ? Promise.resolve()
              : Promise.all(
                  documents.map(
                    (document) =>
                      queue.flushForClose(
                        document.documentId,
                      ),
                  ),
                ).then(() => undefined);
          void flush
            .then(
              () =>
                window.eumStudio.editor.completeManuscriptCloseRequest(
                  {
                    schemaVersion: 1,
                    requestId:
                      request.requestId,
                    status: "saved",
                  },
                ),
              () =>
                window.eumStudio.editor.completeManuscriptCloseRequest(
                  {
                    schemaVersion: 1,
                    requestId:
                      request.requestId,
                    status: "failed",
                  },
                ),
            )
            .catch(() => undefined);
        },
      ),
    [runtime],
  );

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
  const activeSaveState =
    runtime.status === "ready" &&
    runtime.persistenceProfile !== null &&
    activeDocument !== undefined
      ? (saveStates[activeDocument.documentId] ?? null)
      : null;
  const handleApplyStartupRecovery =
    useCallback(async () => {
      if (
        runtime.status !== "ready" ||
        runtime.startupRecovery.status !==
          "recovery-pending" ||
        !runtime.startupRecovery.applyAvailable ||
        recoveryApplyState === "applying"
      ) {
        return;
      }
      const activeDocumentId =
        runtime.activeDocumentId;
      setRecoveryApplyState("applying");
      try {
        const command =
          createApplyStartupRecoveryCommand(
            runtime.startupRecovery.candidate,
          );
        await window.eumStudio.editor.applyManuscriptStartupRecovery(
          command,
        );
        const projection =
          await queryRuntimeProjection();
        installRuntimeProjection(
          projection,
          activeDocumentId,
        );
        setRecoveryApplyState("idle");
      } catch {
        setRecoveryApplyState("failed");
      }
    }, [
      installRuntimeProjection,
      recoveryApplyState,
      runtime,
    ]);
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
      if (currentDocument !== undefined) {
        const pending = durableSaveQueueRef.current?.flush(
          currentDocument.documentId,
        );
        void pending?.catch(() => undefined);
      }
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
        className={
          runtime.status === "ready" &&
          runtime.startupRecovery.status !==
            "clean"
            ? "writing-workspace writing-workspace-recovery"
            : "writing-workspace"
        }
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
        {runtime.status === "ready" &&
          runtime.startupRecovery.status !==
            "clean" && (
            <section
              aria-labelledby={recoveryHeadingId}
              className="startup-recovery"
              data-recovery-status={
                runtime.startupRecovery.status
              }
            >
              <header>
                <h3 id={recoveryHeadingId}>
                  {runtime.startupRecovery.status ===
                  "recovery-pending"
                    ? "복구 미리보기"
                    : "복구 확인 필요"}
                </h3>
              </header>
              {runtime.startupRecovery.status ===
                "recovery-pending" && (
                <div className="startup-recovery-documents">
                  {runtime.startupRecovery.candidate.affectedDocuments.map(
                    (document) => {
                      const source =
                        runtime.documentProfile.documents.find(
                          (candidate) =>
                            candidate.documentId ===
                            document.documentId,
                        );
                      return (
                        <label
                          key={document.documentId}
                        >
                          <span>
                            {source?.label}
                            <code>
                              {document.documentId}
                            </code>
                          </span>
                          <textarea
                            data-testid="recovery-preview"
                            readOnly
                            value={
                              document.recoveredText
                            }
                          />
                        </label>
                      );
                    },
                  )}
                </div>
              )}
              {runtime.startupRecovery.issues.length >
                0 && (
                <ul className="startup-recovery-issues">
                  {runtime.startupRecovery.issues.map(
                    (issue, index) => (
                      <li
                        key={`${issue.source}:${index}`}
                      >
                        <code>{issue.source}</code>
                        <span>{issue.reason}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
              {runtime.startupRecovery.status ===
                "recovery-pending" &&
                runtime.startupRecovery
                  .applyAvailable && (
                  <button
                    disabled={
                      recoveryApplyState ===
                      "applying"
                    }
                    onClick={() => {
                      void handleApplyStartupRecovery();
                    }}
                    type="button"
                  >
                    {recoveryApplyState ===
                    "applying"
                      ? "복구 적용 중"
                      : "복구 적용"}
                  </button>
                )}
              {recoveryApplyState ===
                "failed" && (
                <p role="alert">
                  복구 적용 실패
                </p>
              )}
            </section>
          )}
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
                onBlur={handleEditorBlur}
                onCompositionEnd={handleCompositionEnd}
                onDocumentActivated={handleDocumentActivated}
                onTransaction={handleManuscriptTransaction}
                  readOnly={
                  runtime.startupRecovery.status !==
                  "clean"
                  }
                  resumeLocation={
                    runtime.resumeCheckpoint
                      .status ===
                    "resolved"
                      ? runtime.resumeCheckpoint
                      : null
                  }
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
          <span
            aria-live="polite"
            data-save-state={activeSaveState ?? undefined}
            data-testid="save-state"
          >
            {runtime.status === "ready" &&
            runtime.startupRecovery.status ===
              "recovery-pending"
              ? "복구 적용 대기"
              : runtime.status === "ready" &&
                  runtime.startupRecovery.status ===
                    "read-only-error"
                ? "복구 확인 필요"
                : activeSaveState === null
                  ? "영속 저장 미연결"
                  : SAVE_STATE_LABELS[
                      activeSaveState
                    ]}
          </span>
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
