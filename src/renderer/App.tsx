import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from "lucide-react";

import type { RuntimeInfo } from "../application/contracts/studio-bridge";
import type {
  ActivateWorkspaceLocationCommand,
  CreateWorkCommand,
  WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import type {
  ManuscriptDocumentProfile,
  ManuscriptDocumentSource,
} from "../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import type { ManuscriptPersistenceProfile } from "../application/persistence/manuscript-persistence-profile";
import type {
  CreateEventBlockCommand,
  EventBlockProjection,
} from "../application/structure/event-block-contract";
import type {
  SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import type {
  WorkActivityProjection,
} from "../application/activity/work-activity-contract";
import type {
  DocumentRevisionProjection,
  WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
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
      catalog: WorkspaceCatalogProjection;
      activeDocumentId: ManuscriptDocumentProfile["initialDocumentId"];
    }
  | { status: "error" };

type ManuscriptSearchState = {
  readonly sequence: number;
  readonly result: ManuscriptSearchResult;
};

type VersionProjectionLoadResult = {
  readonly sequence: number;
  readonly revisions: readonly DocumentRevisionProjection[];
  readonly snapshots: readonly WorkSnapshotProjection[];
  readonly error: string | null;
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
  readonly catalog: WorkspaceCatalogProjection;
};

async function queryRuntimeProjection(): Promise<RuntimeProjection> {
  const [
    info,
    inputProfile,
    documentProfile,
    persistenceProfile,
    startupRecovery,
    resumeCheckpoint,
    catalog,
  ] = await Promise.all([
    window.eumStudio.system.getRuntimeInfo(),
    window.eumStudio.editor.getManuscriptInputProfile(),
    window.eumStudio.editor.getManuscriptDocumentProfile(),
    window.eumStudio.editor.getManuscriptPersistenceProfile(),
    window.eumStudio.editor.getManuscriptStartupRecovery(),
    window.eumStudio.editor.getManuscriptResumeCheckpoint(),
    window.eumStudio.workspace.getCatalog(),
  ]);
  return Object.freeze({
    info,
    inputProfile,
    documentProfile,
    persistenceProfile,
    startupRecovery,
    resumeCheckpoint,
    catalog,
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

type PendingEventDraft = {
  readonly workId: CreateEventBlockCommand["workId"];
  readonly documentId: CreateEventBlockCommand["documentId"];
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactQuote: string;
};

function EventBlockDialog(input: {
  readonly draft: PendingEventDraft;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (value: {
    readonly title: string;
    readonly note: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const canSubmit = title.trim().length > 0 && !input.submitting;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      input.onSubmit({ title: title.trim(), note });
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="create-event-heading"
        aria-modal="true"
        className="create-work-dialog event-block-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">EXACT RANGE</p>
            <h2 id="create-event-heading">사건으로 등록</h2>
          </div>
          <button
            aria-label="사건 등록 닫기"
            className="dialog-close"
            disabled={input.submitting}
            onClick={input.onCancel}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="event-quote-preview">
          <span>선택 근거</span>
          <blockquote>{input.draft.exactQuote}</blockquote>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>사건 제목</span>
            <input
              aria-label="사건 제목"
              autoFocus
              disabled={input.submitting}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            <span>메모</span>
            <textarea
              aria-label="사건 메모"
              disabled={input.submitting}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <p className="dialog-description">
            범위는 원고에서 선택한 위치 그대로 저장됩니다.
          </p>
          {input.error !== null && (
            <p className="dialog-error" role="alert">{input.error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={input.submitting}
              onClick={input.onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={!canSubmit}
              type="submit"
            >
              {input.submitting ? "등록 중" : "등록"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreateEventBlockButton(input: {
  readonly telemetryStore: ManuscriptTelemetryStore;
  readonly busy: boolean;
  readonly onClick: () => void;
}) {
  const hasSelection = useSyncExternalStore(
    input.telemetryStore.subscribeSelection,
    input.telemetryStore.getSelectionSnapshot,
  );
  return (
    <button
      className="create-event-button"
      disabled={input.busy || !hasSelection}
      onClick={input.onClick}
      type="button"
    >
      사건으로 등록
    </button>
  );
}

function formatTimerDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatVersionTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedTimerMs(startedAt: string, now: number): number {
  const startedAtMs = Date.parse(startedAt);
  return Number.isFinite(startedAtMs) ? Math.max(0, now - startedAtMs) : 0;
}

function remainingTimerMs(deadlineAt: string, now: number): number {
  const deadlineAtMs = Date.parse(deadlineAt);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - now) : 0;
}

function FocusCycleDialog(input: {
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (value: {
    readonly phaseRef: string;
    readonly targetDurationMs: number;
    readonly note: string;
  }) => void;
}) {
  const [phaseRef, setPhaseRef] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const parsedMinutes = Number(minutes);
  const targetDurationMs = parsedMinutes * 60 * 1_000;
  const canSubmit =
    phaseRef.trim().length > 0 &&
    Number.isFinite(parsedMinutes) &&
    parsedMinutes > 0 &&
    Number.isSafeInteger(targetDurationMs) &&
    !input.submitting;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      input.onSubmit({
        phaseRef: phaseRef.trim(),
        targetDurationMs,
        note,
      });
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="focus-cycle-heading"
        aria-modal="true"
        className="create-work-dialog focus-cycle-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">FOCUS</p>
            <h2 id="focus-cycle-heading">집중 시작</h2>
          </div>
          <button
            aria-label="집중 설정 닫기"
            className="dialog-close"
            disabled={input.submitting}
            onClick={input.onCancel}
            type="button"
          >
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>집중 단계</span>
            <input
              aria-label="집중 단계"
              autoFocus
              disabled={input.submitting}
              onChange={(event) => setPhaseRef(event.target.value)}
              placeholder="예: 초고 집중"
              value={phaseRef}
            />
          </label>
          <label>
            <span>시간(분)</span>
            <input
              aria-label="집중 시간(분)"
              disabled={input.submitting}
              inputMode="decimal"
              onChange={(event) => setMinutes(event.target.value)}
              step="any"
              type="number"
              value={minutes}
            />
          </label>
          <label>
            <span>메모</span>
            <input
              aria-label="집중 메모"
              disabled={input.submitting}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <p className="dialog-description">
            입력한 단계와 시간을 이 작품에 그대로 저장합니다.
          </p>
          {input.error !== null && (
            <p className="dialog-error" role="alert">{input.error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={input.submitting}
              onClick={input.onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={!canSubmit}
              type="submit"
            >
              {input.submitting ? "시작 중" : "시작"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function renderInHost(
  content: ReactNode,
  host: HTMLElement | null | undefined,
): ReactNode {
  return host === null || host === undefined
    ? content
    : createPortal(content, host);
}

type AppProps = {
  readonly documentRailHost?: HTMLElement | null;
  readonly embedded?: boolean;
  readonly onCatalogChange?: (
    catalog: WorkspaceCatalogProjection,
  ) => void;
};

export type ManuscriptWorkspaceHandle = {
  readonly activateLocation: (
    command: ActivateWorkspaceLocationCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  readonly createWork: (
    command: CreateWorkCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  readonly prepareForMain: () => Promise<WorkspaceCatalogProjection>;
};

export const App = forwardRef<
  ManuscriptWorkspaceHandle,
  AppProps
>(function App(
  { documentRailHost, embedded = false, onCatalogChange },
  ref,
) {
  const documentRailId = useId();
  const recoveryHeadingId = useId();
  const reviewRailId = useId();
  const workspaceBodyRef = useRef<HTMLDivElement>(null);
  const manuscriptEditorRef =
    useRef<ManuscriptEditorHandle>(null);
  const durableSaveQueueRef =
    useRef<ManuscriptDurableSaveQueue | null>(null);
  const versionLoadSequenceRef = useRef(0);
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
  const [workspaceActionState, setWorkspaceActionState] =
    useState<"idle" | "switching" | "creating-document" | "creating-work">(
      "idle",
    );
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [workspaceActionError, setWorkspaceActionError] = useState<
    string | null
  >(null);
  const [eventBlocks, setEventBlocks] = useState<
    readonly EventBlockProjection[]
  >([]);
  const [pendingEventDraft, setPendingEventDraft] = useState<
    PendingEventDraft | null
  >(null);
  const [eventActionState, setEventActionState] = useState<
    "idle" | "creating"
  >("idle");
  const [eventActionError, setEventActionError] = useState<string | null>(null);
  const [sceneOverrides, setSceneOverrides] = useState<
    readonly SceneOverrideProjection[]
  >([]);
  const [sceneActionState, setSceneActionState] = useState<
    "idle" | "creating"
  >("idle");
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const [workActivity, setWorkActivity] = useState<
    WorkActivityProjection | null
  >(null);
  const [activityActionState, setActivityActionState] = useState<
    "idle" | "starting-session" | "stopping-session" | "starting-focus" | "stopping-focus"
  >("idle");
  const [activityActionError, setActivityActionError] = useState<
    string | null
  >(null);
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [activityClock, setActivityClock] = useState(() => Date.now());
  const [documentRevisions, setDocumentRevisions] = useState<
    readonly DocumentRevisionProjection[]
  >([]);
  const [workSnapshots, setWorkSnapshots] = useState<
    readonly WorkSnapshotProjection[]
  >([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [versionActionState, setVersionActionState] = useState<
    "idle" | "refreshing" | "restoring" | "creating-snapshot"
  >("idle");
  const [versionActionError, setVersionActionError] = useState<string | null>(
    null,
  );

  const captureResumeForDocument = useCallback(
    async (
      document: ManuscriptDocumentSource,
      summary?: ManuscriptDocumentStateSummary,
    ) => {
      const documentState =
        summary ??
        manuscriptEditorRef.current?.readDocumentState(document);
      if (documentState === null || documentState === undefined) {
        throw new Error(
          `The active editor state is unavailable for ${document.documentId}`,
        );
      }
      const selection =
        documentState.selection.ranges[
          documentState.selection.mainIndex
        ];
      if (selection === undefined) {
        throw new Error(
          `The active editor selection is unavailable for ${document.documentId}`,
        );
      }
      return window.eumStudio.workspace.captureResume({
        schemaVersion: 1,
        workId: document.workId,
        documentId: document.documentId,
        selection: {
          anchor: selection.anchor,
          head: selection.head,
        },
        workspaceMode: "writing",
      });
    },
    [],
  );

  const persistDocument = useCallback(
    async (document: ManuscriptDocumentSource) => {
      await durableSaveQueueRef.current?.flush(document.documentId);
      await captureResumeForDocument(document);
    },
    [captureResumeForDocument],
  );

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
      void persistDocument(document).catch(() => undefined);
    },
    [persistDocument],
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
      void captureResumeForDocument(_document, summary)
        .then(() => window.eumStudio.workspace.getCatalog())
        .then((catalog) => {
          setRuntime((current) =>
            current.status === "ready"
              ? { ...current, catalog }
              : current,
          );
          onCatalogChange?.(catalog);
        })
        .catch(() => undefined);
    },
    [captureResumeForDocument, onCatalogChange, telemetryStore],
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
        catalog,
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
        catalog,
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
          const activeDocumentForClose =
            runtime.status === "ready"
              ? runtime.documentProfile.documents.find(
                  (document) =>
                    document.documentId === runtime.activeDocumentId,
                )
              : undefined;
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
            .then(async () => {
              if (activeDocumentForClose !== undefined) {
                await captureResumeForDocument(activeDocumentForClose);
              }
            })
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
    [captureResumeForDocument, runtime],
  );

  const activeDocument = useMemo(
    () =>
      runtime.status === "ready"
        ? runtime.documentProfile.documents.find(
            (document) => document.documentId === runtime.activeDocumentId,
          )
        : undefined,
    [runtime],
  );
  const activeWork =
    runtime.status === "ready" && activeDocument !== undefined
      ? runtime.catalog.works.find(
          (work) => work.workId === activeDocument.workId,
        )
      : undefined;
  const activeWorkDocuments =
    runtime.status === "ready" && activeDocument !== undefined
      ? runtime.documentProfile.documents.filter(
          (document) => document.workId === activeDocument.workId,
        )
      : [];
  const activeDocumentEventBlocks =
    activeDocument === undefined
      ? []
      : eventBlocks.filter(
          (eventBlock) =>
            eventBlock.documentId === activeDocument.documentId,
        );
  const activeDocumentSceneOverrides =
    activeDocument === undefined
      ? []
      : sceneOverrides.filter(
          (sceneOverride) =>
            sceneOverride.documentId === activeDocument.documentId,
        );
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
  const activeWorkId = activeWork?.workId ?? null;
  const activeWritingSession =
    activeWorkId !== null && workActivity?.workId === activeWorkId
      ? workActivity.sessions.find(
          (session) => session.sessionId === workActivity.activeSessionId,
        )
      : undefined;
  const activeFocusCycle =
    activeWorkId !== null && workActivity?.workId === activeWorkId
      ? workActivity.focusCycles.find(
          (cycle) => cycle.focusCycleId === workActivity.activeFocusCycleId,
        )
      : undefined;
  const loadVersionProjections = useCallback(
    async () => {
      const sequence = versionLoadSequenceRef.current + 1;
      versionLoadSequenceRef.current = sequence;
      if (activeDocument === undefined) {
        return null;
      }
      try {
        const [revisionProjection, snapshotProjection] = await Promise.all([
          window.eumStudio.version.listDocumentRevisions({
            schemaVersion: 1,
            workId: activeDocument.workId,
            documentId: activeDocument.documentId,
          }),
          window.eumStudio.version.listWorkSnapshots({
            schemaVersion: 1,
            workId: activeDocument.workId,
          }),
        ]);
        return {
          sequence,
          revisions: revisionProjection.revisions,
          snapshots: snapshotProjection.snapshots,
          error: null,
        } satisfies VersionProjectionLoadResult;
      } catch {
        return {
          sequence,
          revisions: [],
          snapshots: [],
          error: "버전 기록을 불러오지 못했습니다.",
        } satisfies VersionProjectionLoadResult;
      }
    },
    [activeDocument],
  );

  const applyVersionProjections = useCallback(
    (result: VersionProjectionLoadResult | null) => {
      if (
        result === null ||
        versionLoadSequenceRef.current !== result.sequence
      ) {
        return;
      }
      setDocumentRevisions(result.revisions);
      setWorkSnapshots(result.snapshots);
      setVersionActionError(result.error);
    },
    [],
  );

  const refreshVersionProjections = useCallback(async () => {
    applyVersionProjections(await loadVersionProjections());
  }, [applyVersionProjections, loadVersionProjections]);

  useEffect(() => {
    let disposed = false;
    void loadVersionProjections().then((result) => {
      if (!disposed) {
        applyVersionProjections(result);
      }
    });
    return () => {
      disposed = true;
    };
  }, [applyVersionProjections, loadVersionProjections]);

  useEffect(() => {
    if (activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setEventBlocks([]);
        setSceneOverrides([]);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void window.eumStudio.structure.listEventBlocks({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setEventBlocks(projection.eventBlocks);
          setEventActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setEventBlocks([]);
          setEventActionError("사건 목록을 불러오지 못했습니다.");
        }
      },
    );
    void window.eumStudio.structure.listSceneOverrides({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setSceneOverrides(projection.sceneOverrides);
          setSceneActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setSceneOverrides([]);
          setSceneActionError("장면 경계 목록을 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId]);

  useEffect(() => {
    if (activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setWorkActivity(null);
        setActivityActionError(null);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void window.eumStudio.activity.listWork({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setWorkActivity(projection);
          setActivityActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkActivity(null);
          setActivityActionError("작업 기록을 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId]);

  useEffect(() => {
    if (activeWritingSession === undefined && activeFocusCycle === undefined) {
      return;
    }
    const updateClock = () => {
      setActivityClock(Date.now());
    };
    const initialUpdate = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 1_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [activeFocusCycle, activeWritingSession]);

  const openEventBlockDialog = useCallback(() => {
    if (activeDocument === undefined) {
      return;
    }
    const summary = manuscriptEditorRef.current?.readDocumentState(
      activeDocument,
    );
    const selection =
      summary?.selection.ranges[summary.selection.mainIndex];
    if (selection === undefined || selection.empty) {
      setEventActionError("원고에서 사건 범위를 먼저 선택하세요.");
      return;
    }
    const manuscript =
      manuscriptEditorRef.current?.materializeDocumentText(activeDocument);
    if (manuscript === undefined) {
      setEventActionError("현재 원고 범위를 읽지 못했습니다.");
      return;
    }
    const exactQuote = manuscript.slice(selection.from, selection.to);
    if (exactQuote.length === 0) {
      setEventActionError("빈 선택 범위는 사건으로 등록할 수 없습니다.");
      return;
    }
    setEventActionError(null);
    setPendingEventDraft({
      workId: activeDocument.workId,
      documentId: activeDocument.documentId,
      selection: {
        anchor: selection.anchor,
        head: selection.head,
      },
      exactQuote,
    });
  }, [activeDocument]);

  const createEventBlock = useCallback(
    async (input: { readonly title: string; readonly note: string }) => {
      if (
        activeDocument === undefined ||
        pendingEventDraft === null ||
        eventActionState !== "idle"
      ) {
        return;
      }
      setEventActionState("creating");
      setEventActionError(null);
      try {
        await persistDocument(activeDocument);
        await window.eumStudio.structure.createEventBlock({
          schemaVersion: 1,
          ...pendingEventDraft,
          title: input.title,
          note: input.note,
        });
        const projection = await window.eumStudio.structure.listEventBlocks({
          schemaVersion: 1,
          workId: pendingEventDraft.workId,
        });
        setEventBlocks(projection.eventBlocks);
        setPendingEventDraft(null);
      } catch {
        setEventActionError("선택 범위를 사건으로 등록하지 못했습니다.");
      } finally {
        setEventActionState("idle");
      }
    },
    [activeDocument, eventActionState, pendingEventDraft, persistDocument],
  );

  const focusEventBlock = useCallback(
    (eventBlock: EventBlockProjection) => {
      if (
        activeDocument === undefined ||
        eventBlock.documentId !== activeDocument.documentId ||
        eventBlock.range === null
      ) {
        setEventActionError("이 사건 범위는 현재 원고에서 바로 열 수 없습니다.");
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        activeDocument,
        eventBlock.range,
      );
      if (!selected) {
        setEventActionError("사건의 정확한 원고 범위를 선택하지 못했습니다.");
        return;
      }
      setEventActionError(null);
    },
    [activeDocument],
  );

  const createSceneBoundary = useCallback(async () => {
    if (activeDocument === undefined || sceneActionState !== "idle") {
      return;
    }
    const summary = manuscriptEditorRef.current?.readDocumentState(
      activeDocument,
    );
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
      activeDocument,
    );
    if (selection === undefined || manuscript === undefined) {
      setSceneActionError("현재 원고 위치를 읽지 못했습니다.");
      return;
    }
    setSceneActionState("creating");
    setSceneActionError(null);
    try {
      await persistDocument(activeDocument);
      await window.eumStudio.structure.createSceneOverride({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        selection: {
          anchor: selection.anchor,
          head: selection.head,
        },
        exactQuote: manuscript.slice(selection.from, selection.to),
        operation: "add",
        note: "",
      });
      const projection = await window.eumStudio.structure.listSceneOverrides({
        schemaVersion: 1,
        workId: activeDocument.workId,
      });
      setSceneOverrides(projection.sceneOverrides);
    } catch {
      setSceneActionError("현재 위치에 장면 경계를 저장하지 못했습니다.");
    } finally {
      setSceneActionState("idle");
    }
  }, [activeDocument, persistDocument, sceneActionState]);

  const focusSceneOverride = useCallback(
    (sceneOverride: SceneOverrideProjection) => {
      const boundary = sceneOverride.boundaries[0];
      if (
        activeDocument === undefined ||
        sceneOverride.documentId !== activeDocument.documentId ||
        boundary === undefined ||
        boundary.range === null
      ) {
        setSceneActionError("이 장면 경계는 현재 원고에서 바로 열 수 없습니다.");
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        activeDocument,
        boundary.range,
      );
      if (!selected) {
        setSceneActionError("장면 경계의 정확한 위치로 이동하지 못했습니다.");
        return;
      }
      setSceneActionError(null);
    },
    [activeDocument],
  );
  const startWritingSession = useCallback(async () => {
    if (activeDocument === undefined || activityActionState !== "idle") {
      return;
    }
    setActivityActionState("starting-session");
    setActivityActionError(null);
    try {
      await persistDocument(activeDocument);
      const projection = await window.eumStudio.activity.startSession({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        note: "",
      });
      setWorkActivity(projection);
    } catch {
      setActivityActionError("작업 기록을 시작하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [activeDocument, activityActionState, persistDocument]);

  const stopWritingSession = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activeWritingSession === undefined ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("stopping-session");
    setActivityActionError(null);
    try {
      await persistDocument(activeDocument);
      const projection = await window.eumStudio.activity.stopSession({
        schemaVersion: 1,
        workId: activeDocument.workId,
        sessionId: activeWritingSession.sessionId,
      });
      setWorkActivity(projection);
    } catch {
      setActivityActionError("작업 기록을 종료하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activeWritingSession,
    activityActionState,
    persistDocument,
  ]);

  const startFocusCycle = useCallback(
    async (input: {
      readonly phaseRef: string;
      readonly targetDurationMs: number;
      readonly note: string;
    }) => {
      if (activeDocument === undefined || activityActionState !== "idle") {
        return;
      }
      setActivityActionState("starting-focus");
      setActivityActionError(null);
      try {
        await persistDocument(activeDocument);
        const projection = await window.eumStudio.activity.startFocus({
          schemaVersion: 1,
          workId: activeDocument.workId,
          documentId: activeDocument.documentId,
          ...input,
        });
        setWorkActivity(projection);
        setShowFocusDialog(false);
      } catch {
        setActivityActionError("집중 시간을 시작하지 못했습니다.");
      } finally {
        setActivityActionState("idle");
      }
    },
    [activeDocument, activityActionState, persistDocument],
  );

  const stopFocusCycle = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activeFocusCycle === undefined ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("stopping-focus");
    setActivityActionError(null);
    try {
      await persistDocument(activeDocument);
      const projection = await window.eumStudio.activity.stopFocus({
        schemaVersion: 1,
        workId: activeDocument.workId,
        focusCycleId: activeFocusCycle.focusCycleId,
      });
      setWorkActivity(projection);
    } catch {
      setActivityActionError("집중 시간을 종료하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activeFocusCycle,
    activityActionState,
    persistDocument,
  ]);

  const refreshStoredVersions = useCallback(async () => {
    if (activeDocument === undefined || versionActionState !== "idle") {
      return;
    }
    setVersionActionState("refreshing");
    setVersionActionError(null);
    try {
      await persistDocument(activeDocument);
      await refreshVersionProjections();
    } catch {
      setVersionActionError("현재 저장 상태의 버전 기록을 불러오지 못했습니다.");
    } finally {
      setVersionActionState("idle");
    }
  }, [activeDocument, persistDocument, refreshVersionProjections, versionActionState]);

  const restoreDocumentRevision = useCallback(
    async (targetRevisionId: DocumentRevisionProjection["revisionId"]) => {
      if (activeDocument === undefined || versionActionState !== "idle") {
        return;
      }
      setVersionActionState("restoring");
      setVersionActionError(null);
      try {
        await persistDocument(activeDocument);
        await window.eumStudio.version.restoreDocumentRevision({
          schemaVersion: 1,
          workId: activeDocument.workId,
          documentId: activeDocument.documentId,
          targetRevisionId,
        });
        const projection = await queryRuntimeProjection();
        installRuntimeProjection(projection, activeDocument.documentId);
        onCatalogChange?.(projection.catalog);
      } catch {
        setVersionActionError("선택한 문서 버전으로 복원하지 못했습니다.");
      } finally {
        setVersionActionState("idle");
      }
    },
    [
      activeDocument,
      installRuntimeProjection,
      onCatalogChange,
      persistDocument,
      versionActionState,
    ],
  );

  const createWorkSnapshot = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const label = snapshotLabel.trim();
      if (
        activeDocument === undefined ||
        label.length === 0 ||
        versionActionState !== "idle"
      ) {
        return;
      }
      setVersionActionState("creating-snapshot");
      setVersionActionError(null);
      try {
        await persistDocument(activeDocument);
        await window.eumStudio.version.createWorkSnapshot({
          schemaVersion: 1,
          workId: activeDocument.workId,
          label,
        });
        setSnapshotLabel("");
        await refreshVersionProjections();
      } catch {
        setVersionActionError("작품 스냅샷을 만들지 못했습니다.");
      } finally {
        setVersionActionState("idle");
      }
    },
    [
      activeDocument,
      persistDocument,
      refreshVersionProjections,
      snapshotLabel,
      versionActionState,
    ],
  );
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
  const activateWorkspaceLocation = useCallback(
    async (
      command: ActivateWorkspaceLocationCommand,
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.documentId === runtime.activeDocumentId,
      );
      setWorkspaceActionState("switching");
      setWorkspaceActionError(null);
      try {
        if (currentDocument !== undefined) {
          await persistDocument(currentDocument);
        }
        const catalog =
          await window.eumStudio.workspace.activateLocation(command);
        const selectedDocument = runtime.documentProfile.documents.find(
          (document) =>
            document.workId === catalog.activeWorkId &&
            document.documentId === catalog.activeDocumentId,
        );
        if (selectedDocument === undefined) {
          throw new Error(
            "The activated Work does not own the selected Document",
          );
        }
        const resumeCheckpoint =
          await window.eumStudio.editor.getManuscriptResumeCheckpoint();
        if (currentDocument?.workId !== selectedDocument.workId) {
          setManuscriptSearchQuery("");
          manuscriptSearchRef.current = null;
          setManuscriptSearch(null);
        }
        setRuntime({
          ...runtime,
          catalog,
          resumeCheckpoint,
          activeDocumentId: selectedDocument.documentId,
        });
        onCatalogChange?.(catalog);
        return catalog;
      } catch (error) {
        setWorkspaceActionError("작품이나 회차를 열지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [onCatalogChange, persistDocument, runtime],
  );

  const installCreatedDocument = useCallback(
    async (
      documentId: string,
      catalog: WorkspaceCatalogProjection,
    ): Promise<void> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const [documentProfile, persistenceProfile, resumeCheckpoint] =
        await Promise.all([
          window.eumStudio.editor.getManuscriptDocumentProfile(),
          window.eumStudio.editor.getManuscriptPersistenceProfile(),
          window.eumStudio.editor.getManuscriptResumeCheckpoint(),
        ]);
      const createdDocument = documentProfile.documents.find(
        (document) => document.documentId === documentId,
      );
      if (
        createdDocument === undefined ||
        createdDocument.documentRevisionId === null ||
        persistenceProfile === null
      ) {
        throw new Error(
          "The created Document has no durable manuscript source",
        );
      }
      if (
        runtime.documentProfile.documents.some(
          (document) => document.documentId === documentId,
        )
      ) {
        throw new Error(`Duplicate created Document: ${documentId}`);
      }
      const sequence = persistenceProfile.documentSequences.find(
        (candidate) => candidate.documentId === documentId,
      );
      if (sequence === undefined || durableSaveQueueRef.current === null) {
        throw new Error(
          "The created Document has no durable save sequence",
        );
      }
      durableSaveQueueRef.current.registerDocument({
        workId: createdDocument.workId,
        documentId: createdDocument.documentId,
        baseRevisionId: createdDocument.documentRevisionId,
        nextSequence: sequence.nextSequence,
      });
      setSaveStates((current) =>
        Object.freeze({
          ...current,
          [createdDocument.documentId]: "saved" as const,
        }),
      );
      setRuntime({
        ...runtime,
        documentProfile: {
          ...runtime.documentProfile,
          documents: Object.freeze([
            ...runtime.documentProfile.documents,
            createdDocument,
          ]),
        },
        persistenceProfile,
        resumeCheckpoint,
        catalog,
        activeDocumentId: createdDocument.documentId,
      });
      setManuscriptSearchQuery("");
      manuscriptSearchRef.current = null;
      setManuscriptSearch(null);
      onCatalogChange?.(catalog);
    },
    [onCatalogChange, runtime],
  );

  const createWork = useCallback(
    async (
      command: CreateWorkCommand,
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.documentId === runtime.activeDocumentId,
      );
      setWorkspaceActionState("creating-work");
      setWorkspaceActionError(null);
      try {
        if (currentDocument !== undefined) {
          await persistDocument(currentDocument);
        }
        const created = await window.eumStudio.workspace.createWork(command);
        const catalog = await window.eumStudio.workspace.getCatalog();
        await installCreatedDocument(created.documentId, catalog);
        return catalog;
      } catch (error) {
        setWorkspaceActionError("새 작품을 만들지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [installCreatedDocument, persistDocument, runtime],
  );

  const createDocument = useCallback(
    async (title: string): Promise<void> => {
      if (runtime.status !== "ready" || activeDocument === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      setWorkspaceActionState("creating-document");
      setWorkspaceActionError(null);
      try {
        await persistDocument(activeDocument);
        const created = await window.eumStudio.workspace.createDocument({
          schemaVersion: 1,
          workId: activeDocument.workId,
          title,
        });
        const catalog = await window.eumStudio.workspace.getCatalog();
        await installCreatedDocument(created.documentId, catalog);
        setNewDocumentTitle("");
        setShowCreateDocument(false);
      } catch (error) {
        setWorkspaceActionError("새 회차를 만들지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [activeDocument, installCreatedDocument, persistDocument, runtime],
  );

  const prepareForMain = useCallback(async () => {
    if (runtime.status !== "ready") {
      throw new Error("The manuscript workspace is not ready");
    }
    const currentDocument = runtime.documentProfile.documents.find(
      (document) => document.documentId === runtime.activeDocumentId,
    );
    if (currentDocument !== undefined) {
      await persistDocument(currentDocument);
    }
    const catalog = await window.eumStudio.workspace.getCatalog();
    setRuntime({ ...runtime, catalog });
    onCatalogChange?.(catalog);
    return catalog;
  }, [onCatalogChange, persistDocument, runtime]);

  useImperativeHandle(
    ref,
    () => ({
      activateLocation: activateWorkspaceLocation,
      createWork,
      prepareForMain,
    }),
    [activateWorkspaceLocation, createWork, prepareForMain],
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
      void activateWorkspaceLocation({
        schemaVersion: 1,
        workId: selectedDocument.workId,
        documentId: selectedDocument.documentId,
      }).catch(() => undefined);
    },
    [activateWorkspaceLocation, runtime],
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

  const writingWorkspaceClassName = [
    "writing-workspace",
    embedded ? "writing-workspace-embedded" : null,
    runtime.status === "ready" &&
    runtime.startupRecovery.status !== "clean"
      ? "writing-workspace-recovery"
      : null,
  ]
    .filter((className): className is string => className !== null)
    .join(" ");

  return (
    <section
      aria-label="원고 작업실"
      className={embedded ? "studio-shell studio-shell-embedded" : "studio-shell"}
    >
      {!embedded && (
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
      )}
      <section
        aria-labelledby="manuscript-heading"
        className={writingWorkspaceClassName}
      >
        <header
          className={
            embedded
              ? "manuscript-header manuscript-header-embedded"
              : "manuscript-header"
          }
        >
          <div className="manuscript-title-block">
            <p className="manuscript-context">
              {embedded
                ? (activeWork?.title ?? "쓰기")
                : "로컬 편집 표면"}
            </p>
            <h2
              data-testid={embedded ? "manuscript-title" : undefined}
              id="manuscript-heading"
            >
              {embedded ? (activeDocument?.label ?? "원고") : "원고"}
            </h2>
          </div>
          <div className="manuscript-tools">
            <ManuscriptCount telemetryStore={telemetryStore} />
            {embedded && (
              <p
                aria-live="polite"
                className="runtime-status runtime-status-embedded"
                data-testid="runtime-status"
              >
                <span aria-hidden="true" className="runtime-dot" />
                {runtime.status === "loading" && "연결 확인 중"}
                {runtime.status === "error" && "로컬 연결 실패"}
                {runtime.status === "ready" && "로컬 연결됨"}
              </p>
            )}
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
        <div
          className={
            documentRailHost === null || documentRailHost === undefined
              ? "workspace-body"
              : "workspace-body workspace-body-shared-left-rail"
          }
          ref={workspaceBodyRef}
        >
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.left.visible &&
            renderInHost(
              <aside
                aria-label="문서 레일"
                className="workspace-rail workspace-rail-left"
                id={documentRailId}
              >
                <header className="workspace-rail-header">
                  <h3>문서 탐색</h3>
                  <button
                    aria-label="문서 레일 닫기"
                    aria-controls={documentRailId}
                    className="rail-toggle"
                    onClick={() => toggleRail("left")}
                    type="button"
                  >
                    {embedded ? (
                      <PanelLeftClose aria-hidden="true" size={16} />
                    ) : (
                      "닫기"
                    )}
                  </button>
                </header>
                <label className="document-switch-label">
                  <span>현재 문서</span>
                  <select
                    aria-label="문서 전환"
                    disabled={workspaceActionState !== "idle"}
                    onChange={(event) => {
                      activateDocumentById(event.target.value);
                    }}
                    value={runtime.activeDocumentId}
                  >
                    {activeWorkDocuments.map((document) => (
                      <option
                        key={document.documentId}
                        value={document.documentId}
                      >
                        {document.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!showCreateDocument ? (
                  <button
                    className="create-document-button"
                    disabled={workspaceActionState !== "idle"}
                    onClick={() => {
                      setWorkspaceActionError(null);
                      setShowCreateDocument(true);
                    }}
                    type="button"
                  >
                    새 회차
                  </button>
                ) : (
                  <form
                    className="create-document-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = newDocumentTitle.trim();
                      if (title.length === 0) {
                        return;
                      }
                      void createDocument(title).catch(() => undefined);
                    }}
                  >
                    <label>
                      <span>회차 제목</span>
                      <input
                        aria-label="새 회차 제목"
                        autoFocus
                        disabled={workspaceActionState !== "idle"}
                        onChange={(event) =>
                          setNewDocumentTitle(event.target.value)
                        }
                        placeholder="예: 2화"
                        value={newDocumentTitle}
                      />
                    </label>
                    <div>
                      <button
                        disabled={workspaceActionState !== "idle"}
                        onClick={() => {
                          setNewDocumentTitle("");
                          setShowCreateDocument(false);
                          setWorkspaceActionError(null);
                        }}
                        type="button"
                      >
                        취소
                      </button>
                      <button
                        disabled={
                          workspaceActionState !== "idle" ||
                          newDocumentTitle.trim().length === 0
                        }
                        type="submit"
                      >
                        만들기
                      </button>
                    </div>
                  </form>
                )}
                {workspaceActionError !== null && (
                  <p className="workspace-action-error" role="alert">
                    {workspaceActionError}
                  </p>
                )}
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
                    aria-label="검색"
                    disabled={manuscriptSearchQuery.length === 0}
                    type="submit"
                  >
                    {embedded ? (
                      <Search aria-hidden="true" size={15} />
                    ) : (
                      "검색"
                    )}
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
              </aside>,
              documentRailHost,
            )}
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            railProjection?.left.reentryVisible && (
              <button
                aria-controls={documentRailId}
                aria-label="문서 레일 열기"
                className="rail-reentry rail-reentry-left"
                onClick={() => toggleRail("left")}
                title="문서 탐색"
                type="button"
              >
                {embedded ? (
                  <PanelLeftOpen aria-hidden="true" size={17} />
                ) : (
                  "문서"
                )}
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
                    {embedded ? (
                      <PanelRightClose aria-hidden="true" size={16} />
                    ) : (
                      "닫기"
                    )}
                  </button>
                </header>
                <ManuscriptReviewSummary
                  telemetryStore={telemetryStore}
                />
                <CreateEventBlockButton
                  busy={eventActionState !== "idle"}
                  onClick={openEventBlockDialog}
                  telemetryStore={telemetryStore}
                />
                {eventActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {eventActionError}
                  </p>
                )}
                <button
                  className="create-event-button create-scene-button"
                  disabled={sceneActionState !== "idle"}
                  onClick={() => {
                    void createSceneBoundary();
                  }}
                  type="button"
                >
                  {sceneActionState === "creating"
                    ? "장면 경계 저장 중"
                    : "장면 경계 추가"}
                </button>
                {sceneActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {sceneActionError}
                  </p>
                )}
                <section
                  aria-label="현재 회차 사건"
                  className="event-block-list"
                >
                  <header>
                    <h4>사건</h4>
                    <span>{activeDocumentEventBlocks.length}</span>
                  </header>
                  {activeDocumentEventBlocks.length === 0 ? (
                    <p className="empty-event-list">
                      등록된 사건이 없습니다.
                    </p>
                  ) : (
                    <ul>
                      {activeDocumentEventBlocks.map((eventBlock) => (
                        <li key={eventBlock.eventBlockId}>
                          <button
                            disabled={eventBlock.range === null}
                            onClick={() => focusEventBlock(eventBlock)}
                            type="button"
                          >
                            <strong>{eventBlock.title}</strong>
                            <span>
                              {eventBlock.range === null
                                ? eventBlock.integrity === "needsReview"
                                  ? "범위 검토 필요"
                                  : "범위 연결 손상"
                                : `${eventBlock.range.from}–${eventBlock.range.to}`}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section
                  aria-label="현재 회차 장면 경계"
                  className="event-block-list scene-override-list"
                >
                  <header>
                    <h4>장면 경계</h4>
                    <span>{activeDocumentSceneOverrides.length}</span>
                  </header>
                  {activeDocumentSceneOverrides.length === 0 ? (
                    <p className="empty-event-list">
                      추가한 장면 경계가 없습니다.
                    </p>
                  ) : (
                    <ul>
                      {activeDocumentSceneOverrides.map(
                        (sceneOverride, index) => {
                          const boundary = sceneOverride.boundaries[0];
                          return (
                            <li key={sceneOverride.sceneOverrideId}>
                              <button
                                disabled={
                                  boundary === undefined || boundary.range === null
                                }
                                onClick={() => focusSceneOverride(sceneOverride)}
                                type="button"
                              >
                                <strong>{`장면 경계 ${index + 1}`}</strong>
                                <span>
                                  {boundary === undefined || boundary.range === null
                                    ? "위치 검토 필요"
                                    : boundary.range.from === boundary.range.to
                                      ? `${boundary.range.from} 위치`
                                      : `${boundary.range.from}–${boundary.range.to}`}
                                </span>
                              </button>
                            </li>
                          );
                        },
                      )}
                    </ul>
                    )}
                </section>
                <section
                  aria-label="문서 버전"
                  className="event-block-list version-history-list"
                >
                  <header>
                    <h4>문서 버전</h4>
                    <button
                      className="version-refresh-button"
                      disabled={versionActionState !== "idle"}
                      onClick={() => {
                        void refreshStoredVersions();
                      }}
                      type="button"
                    >
                      {versionActionState === "refreshing" ? "확인 중" : "새로고침"}
                    </button>
                  </header>
                  {documentRevisions.length === 0 ? (
                    <p className="empty-event-list">저장된 문서 버전이 없습니다.</p>
                  ) : (
                    <ul>
                      {documentRevisions.map((revision) => (
                        <li key={revision.revisionId}>
                          <div className="version-history-entry">
                            <strong>
                              {revision.isCurrent
                                ? "현재 버전"
                                : formatVersionTimestamp(revision.createdAt)}
                            </strong>
                            <span>{revision.length}자</span>
                            {!revision.isCurrent && (
                              <button
                                aria-label={`${formatVersionTimestamp(revision.createdAt)} 버전으로 복원`}
                                disabled={versionActionState !== "idle"}
                                onClick={() => {
                                  void restoreDocumentRevision(revision.revisionId);
                                }}
                                type="button"
                              >
                                복원
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section
                  aria-label="작품 스냅샷"
                  className="event-block-list work-snapshot-list"
                >
                  <header>
                    <h4>작품 스냅샷</h4>
                    <span>{workSnapshots.length}</span>
                  </header>
                  <form className="work-snapshot-form" onSubmit={createWorkSnapshot}>
                    <label>
                      <span className="visually-hidden">작품 스냅샷 이름</span>
                      <input
                        aria-label="작품 스냅샷 이름"
                        disabled={versionActionState !== "idle"}
                        onChange={(event) => setSnapshotLabel(event.currentTarget.value)}
                        type="text"
                        value={snapshotLabel}
                      />
                    </label>
                    <button
                      disabled={
                        snapshotLabel.trim().length === 0 ||
                        versionActionState !== "idle"
                      }
                      type="submit"
                    >
                      {versionActionState === "creating-snapshot" ? "생성 중" : "생성"}
                    </button>
                  </form>
                  {workSnapshots.length === 0 ? (
                    <p className="empty-event-list">만든 작품 스냅샷이 없습니다.</p>
                  ) : (
                    <ul>
                      {workSnapshots.map((snapshot) => (
                        <li key={snapshot.workSnapshotId}>
                          <div
                            className="work-snapshot-entry"
                            data-testid="work-snapshot-entry"
                          >
                            <strong>{snapshot.label}</strong>
                            <span>
                              {formatVersionTimestamp(snapshot.createdAt)} · 문서 {snapshot.documentRevisions.length}개
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {versionActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {versionActionError}
                  </p>
                )}
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
                title="검토"
                type="button"
              >
                {embedded ? (
                  <PanelRightOpen aria-hidden="true" size={17} />
                ) : (
                  "검토"
                )}
              </button>
            )}
        </div>
        <footer
          aria-label="작업 상태"
          className={
            embedded
              ? "workspace-statusbar workspace-statusbar-embedded"
              : "workspace-statusbar"
          }
        >
          {activeDocument !== undefined && (
            <>
              <span
                className={
                  embedded ? "status-item visually-hidden" : "status-item"
                }
              >
                <span>작품</span>
                <output
                  data-testid="current-work"
                  title={activeDocument.workId}
                >
                  {activeWork?.title ?? "작품"}
                </output>
              </span>
              <span
                className={
                  embedded ? "status-item visually-hidden" : "status-item"
                }
              >
                <span>문서</span>
                <output data-testid="current-document">
                  {activeDocument.label}
                </output>
              </span>
            </>
          )}
          {activeDocument !== undefined && (
            <div className="activity-status-controls">
              {activeWritingSession === undefined ? (
                <button
                  disabled={workActivity === null || activityActionState !== "idle"}
                  onClick={() => {
                    void startWritingSession();
                  }}
                  type="button"
                >
                  기록 시작
                </button>
              ) : (
                <span className="activity-timer" data-testid="writing-session-timer">
                  <span>기록</span>
                  <output aria-live="polite">
                    {formatTimerDuration(
                      elapsedTimerMs(activeWritingSession.startedAt, activityClock),
                    )}
                  </output>
                  <button
                    disabled={activityActionState !== "idle"}
                    onClick={() => {
                      void stopWritingSession();
                    }}
                    type="button"
                  >
                    종료
                  </button>
                </span>
              )}
              {activeFocusCycle === undefined ? (
                <button
                  disabled={workActivity === null || activityActionState !== "idle"}
                  onClick={() => {
                    setActivityActionError(null);
                    setShowFocusDialog(true);
                  }}
                  type="button"
                >
                  집중 시작
                </button>
              ) : (
                <span
                  className="activity-timer focus-timer"
                  data-testid="focus-cycle-timer"
                  title={`${activeFocusCycle.phaseRef} · ${formatTimerDuration(activeFocusCycle.targetDurationMs)}`}
                >
                  <span>{activeFocusCycle.phaseRef}</span>
                  <output aria-live="polite">
                    {formatTimerDuration(
                      remainingTimerMs(activeFocusCycle.deadlineAt, activityClock),
                    )}
                  </output>
                  <button
                    disabled={activityActionState !== "idle"}
                    onClick={() => {
                      void stopFocusCycle();
                    }}
                    type="button"
                  >
                    종료
                  </button>
                </span>
              )}
              {activityActionError !== null && (
                <span className="activity-status-error" role="alert">
                  {activityActionError}
                </span>
              )}
            </div>
          )}
          <span
            aria-live="polite"
            className="save-status"
            data-save-state={activeSaveState ?? undefined}
            data-testid="save-state"
          >
            {embedded && <span aria-hidden="true" className="save-dot" />}
            {runtime.status === "ready" &&
            runtime.startupRecovery.status ===
              "recovery-pending"
              ? "복구 적용 대기"
              : runtime.status === "ready" &&
                  runtime.startupRecovery.status ===
                    "read-only-error"
                ? "복구 확인 필요"
                : activeSaveState === null
                  ? embedded
                    ? "저장 경로 없음"
                    : "영속 저장 미연결"
                  : SAVE_STATE_LABELS[
                      activeSaveState
                    ]}
          </span>
          {!embedded && (
            <span>
              {runtime.status === "loading" && "런타임 확인 중"}
              {runtime.status === "error" && "런타임 연결 경고"}
              {runtime.status === "ready" && "런타임 정상"}
            </span>
          )}
        </footer>
        {pendingEventDraft !== null && (
          <EventBlockDialog
            draft={pendingEventDraft}
            error={eventActionError}
            onCancel={() => {
              if (eventActionState === "idle") {
                setPendingEventDraft(null);
                setEventActionError(null);
              }
            }}
            onSubmit={(input) => {
              void createEventBlock(input);
            }}
            submitting={eventActionState === "creating"}
          />
        )}
        {showFocusDialog && (
          <FocusCycleDialog
            error={activityActionError}
            onCancel={() => {
              if (activityActionState === "idle") {
                setShowFocusDialog(false);
                setActivityActionError(null);
              }
            }}
            onSubmit={(input) => {
              void startFocusCycle(input);
            }}
            submitting={activityActionState === "starting-focus"}
          />
        )}
      </section>
    </section>
  );
});
