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
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import type { RuntimeInfo } from "../application/contracts/studio-bridge";
import type {
  ActivateWorkspaceLocationCommand,
  CreateWorkCommand,
  MoveDocumentCommand,
  WorkspaceCatalogProjection,
  WorkspaceDocumentFolderSummary,
  WorkspaceDocumentSummary,
  WorkspaceWorkSummary,
} from "../application/workspace/workspace-contract";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
  type ManuscriptDocumentSource,
} from "../application/editor/manuscript-document-profile";
import type { ManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import {
  serializeManuscriptEditorDocumentState,
  type ManuscriptEditorDocumentState,
  type ManuscriptFormattingProfile,
} from "../application/editor/manuscript-formatting";
import {
  sanitizeManuscriptTextFileNamePart,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightRange,
  type ManuscriptPreflightSettings,
  type ManuscriptPreflightSettingsProjection,
} from "../application/editor/manuscript-preflight";
import {
  deriveContinuousReadingSession,
  type ContinuousReadingLocation,
  type ContinuousReadingSession,
  type WorkContinuousReadingProgressProjection,
} from "../application/editor/continuous-reading-progress";
import type { ManuscriptPersistenceProfile } from "../application/persistence/manuscript-persistence-profile";
import {
  CreateEventBlockCommand,
  type EventBlockProjection,
  type EventSourceProjection,
} from "../application/structure/event-block-contract";
import type {
  EventRailProjection,
  EventRailSourceLocationProjection,
} from "../application/structure/event-rail-projection";
import type {
  SceneEventOverrideOperation,
  SceneProjection,
  SceneProjectionList,
  UpdateSceneRuleSetCommand,
} from "../application/structure/scene-projection";
import {
  deriveWorkStructureOverview,
  type WorkStructureOverviewCharacter,
  type WorkStructureOverviewDocument,
  type WorkStructureOverviewEvent,
  type WorkStructureOverviewPlot,
  type WorkStructureOverviewPlotSource,
  type WorkStructureOverviewScene,
} from "../application/structure/work-structure-overview";
import type {
  FragmentProjection,
  FragmentShelfProfile,
  UpdateFragmentCommand,
} from "../application/fragments/fragment-contract";
import type {
  CharacterProjection,
  UpdateCharacterCommand,
} from "../application/characters/character-contract";
import type {
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../application/plots/plot-contract";
import type {
  PlotBoardProjection,
  PlotPlacementProjection,
} from "../application/plots/plot-board-contract";
import type {
  PlotThreadSourceProjection,
} from "../application/plots/plot-source-contract";
import type {
  CreateEventFromPlotSource,
  PlotEventLinkProjection,
  PlotEventLinkRole,
  PlotEventLinkMutationProjection,
} from "../application/plots/plot-event-link-contract";
import type {
  LoreEntryEvidenceProjection,
  LoreEntryProjection,
  UpdateLoreEntryCommand,
} from "../application/lore/lore-entry-contract";
import type {
  LoreForeshadowLinkProjection,
} from "../application/lore/lore-foreshadow-link-contract";
import type {
  LoreCandidateProjection,
} from "../application/lore/lore-candidate-contract";
import type { LoreCue } from "../application/lore/lore-cue-projection";
import type {
  ForeshadowLineProjection,
  UpdateForeshadowLineCommand,
} from "../application/foreshadowing/foreshadow-line-contract";
import type {
  ForeshadowPointProfile,
  ForeshadowPointProjection,
} from "../application/foreshadowing/foreshadow-point-contract";
import type {
  WritingSessionProjection,
  WorkActivityProjection,
} from "../application/activity/work-activity-contract";
import type {
  PomodoroProjection,
} from "../application/activity/pomodoro-contract";
import type {
  WorkRecordsGoals,
  WorkRecordsGoalsProjection,
} from "../application/activity/work-records-preferences";
import type {
  DocumentRevisionProjection,
  WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
import type {
  WorkSnapshotComparisonProjection,
} from "../application/revisions/work-snapshot-comparison";
import type {
  AssistantContextPermissionGrant,
} from "../application/assistant/assistant-context-permission";
import type {
  AssistantContextStateProjection,
} from "../application/assistant/assistant-context-state";
import type {
  AssistantDestinationProfile,
} from "../application/assistant/assistant-destination-profile";
import type {
  AssistantConnectorManifestProfile,
} from "../application/assistant/assistant-connector-manifest";
import type {
  AssistantVocabularyOccurrence,
} from "../application/assistant/assistant-vocabulary-lookup";
import type {
  AssistantConnectionProjection,
} from "../application/assistant/assistant-connection";
import type {
  AssistantSettingReference,
} from "../application/assistant/assistant-setting-review";
import {
  createApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import { entityId, type EntityId } from "../domain/writing";
import {
  searchManuscriptsForWork,
  type ManuscriptSearchResult,
} from "../application/editor/search-manuscripts";
import {
  ManuscriptEditor,
  type ManuscriptDocumentStateSummary,
  type ManuscriptEditorHandle,
} from "./editor/ManuscriptEditor";
import {
  ManuscriptPreflightDialog,
  type ManuscriptPreflightApplyInput,
} from "./editor/ManuscriptPreflightDialog";
import { ContinuousReadingDialog } from "./editor/ContinuousReadingDialog";
import {
  FragmentShelfDialog,
  type FragmentShelfActionState,
} from "./editor/FragmentShelfDialog";
import {
  ForeshadowLineDialog,
  type ForeshadowLineActionState,
} from "./editor/ForeshadowLineDialog";
import {
  CharacterManagerDialog,
  type CharacterDraft,
  type CharacterManagerActionState,
} from "./editor/CharacterManagerDialog";
import {
  PlotManagerDialog,
  type PlotDraft,
  type PlotManagerActionState,
  type PlotPlacementMoveTarget,
  type PlotStoryTimeTarget,
} from "./editor/PlotManagerDialog";
import {
  EventRail,
  type EventRailMode,
} from "./editor/EventRail";
import { SceneList } from "./editor/SceneList";
import {
  LoreManagerDialog,
  type LoreEntryDraft,
  type LoreManagerActionState,
} from "./editor/LoreManagerDialog";
import {
  LoreCandidateDialog,
  type LoreCandidateActionState,
  type LoreCandidateDraft,
} from "./editor/LoreCandidateDialog";
import {
  LoreCueInspector,
  LoreCueTooltip,
} from "./editor/LoreCueDisclosure";
import type { LoreCueInteraction } from "./editor/lore-cue-extension";
import { WorkStructureDialog } from "./editor/WorkStructureDialog";
import { WorkSnapshotComparisonDialog } from "./editor/WorkSnapshotComparisonDialog";
import {
  AssistantContextDialog,
  type AssistantContextDialogActionState,
  type AssistantPermissionDraft,
} from "./assistant/AssistantContextDialog";
import {
  AssistantConnectionsDialog,
  type AssistantConnectionEditorInput,
  type AssistantConnectionsDialogActionState,
} from "./assistant/AssistantConnectionsDialog";
import {
  PomodoroDialog,
  type PomodoroDialogSubmitValue,
} from "./activity/PomodoroDialog";
import {
  DailyGoalDialog,
  DailyGoalStatus,
} from "./activity/DailyGoalDialog";
import type { ManuscriptTransaction } from "./editor/manuscript-transaction";
import type { ManuscriptTextStatistics } from "./editor/manuscript-text-statistics";
import { ManuscriptTelemetryStore } from "./editor/manuscript-telemetry-store";
import {
  ManuscriptDurableSaveQueue,
  type ManuscriptSaveState,
} from "./persistence/manuscript-durable-save-queue";
import {
  createWorkspaceRailState,
  openWorkspaceRail,
  projectWorkspaceRails,
  setWorkspaceRailLayout,
  toggleWorkspaceRail,
  type WorkspaceRail,
  type WorkspaceRailLayout,
} from "./workspace-rail-state";
import {
  closeDocumentTab,
  createDocumentTabSession,
  openDocumentTab,
  projectDocumentTabs,
} from "./document-tab-state";

type RuntimeState =
  | { status: "loading" }
  | {
      status: "ready";
      info: RuntimeInfo;
      inputProfile: ManuscriptInputProfile;
      formattingProfile: ManuscriptFormattingProfile;
      preflightProfile: ManuscriptPreflightProfile;
      fragmentProfile: FragmentShelfProfile;
      foreshadowPointProfile: ForeshadowPointProfile;
      documentProfile: ManuscriptDocumentProfile;
      persistenceProfile: ManuscriptPersistenceProfile | null;
      startupRecovery: StartupRecoveryProjection;
      resumeCheckpoint:
        ManuscriptResumeCheckpointProjection;
      catalog: WorkspaceCatalogProjection;
      activeDocumentId: ManuscriptDocumentProfile["initialDocumentId"] | null;
    }
  | { status: "error" };

type ManuscriptSearchState = {
  readonly sequence: number;
  readonly result: ManuscriptSearchResult;
};

type ReviewInspectorTab = "document" | "work" | "versions";

type VersionProjectionLoadResult = {
  readonly sequence: number;
  readonly revisions: readonly DocumentRevisionProjection[];
  readonly snapshots: readonly WorkSnapshotProjection[];
  readonly error: string | null;
};

type PendingManuscriptPreflight = {
  readonly document: ManuscriptDocumentSource;
  readonly manuscript: string;
  readonly selection: ManuscriptPreflightRange | null;
  readonly settingsProjection: ManuscriptPreflightSettingsProjection;
};

type ContinuousReadingDialogState =
  | { readonly status: "closed" }
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly session: ContinuousReadingSession;
    };

function sameContinuousReadingLocation(
  left: ContinuousReadingLocation | null,
  right: ContinuousReadingLocation | null,
): boolean {
  return (
    left?.documentId === right?.documentId &&
    left?.documentRevisionId === right?.documentRevisionId &&
    left?.textOffset === right?.textOffset
  );
}

type PendingFragmentSource = {
  readonly fragmentId: FragmentProjection["fragmentId"];
  readonly workId: FragmentProjection["workId"];
  readonly documentId: FragmentProjection["sourceDocumentId"];
  readonly range: NonNullable<FragmentProjection["range"]>;
};

type PendingForeshadowPointSource = {
  readonly pointId: ForeshadowPointProjection["pointId"];
  readonly workId: ForeshadowPointProjection["workId"];
  readonly documentId: ForeshadowPointProjection["sourceDocumentId"];
  readonly range: NonNullable<ForeshadowPointProjection["range"]>;
};

type PendingPlotThreadSource = {
  readonly sourceId: PlotThreadSourceProjection["sourceId"];
  readonly workId: PlotThreadSourceProjection["workId"];
  readonly documentId: PlotThreadSourceProjection["sourceDocumentId"];
  readonly range: NonNullable<PlotThreadSourceProjection["range"]>;
};

type PendingWorkStructureRange = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly range: { readonly from: number; readonly to: number };
};

type PendingEventRailRange = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly range: { readonly from: number; readonly to: number };
};

type PendingLoreEvidence = {
  readonly anchorId: LoreEntryEvidenceProjection["anchorId"];
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: LoreEntryEvidenceProjection["sourceDocumentId"];
  readonly range: NonNullable<LoreEntryEvidenceProjection["range"]>;
};

type PendingLoreCandidateEvidence = {
  readonly candidateId: LoreCandidateProjection["candidateId"];
  readonly workId: LoreCandidateProjection["workId"];
  readonly documentId: LoreCandidateProjection["evidence"]["sourceDocumentId"];
  readonly range: NonNullable<LoreCandidateProjection["evidence"]["range"]>;
};

type PendingAssistantVocabularyOccurrence = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly documentRevisionId: NonNullable<
    ManuscriptDocumentSource["documentRevisionId"]
  >;
  readonly range: { readonly from: number; readonly to: number };
};

type RuntimeProjection = {
  readonly info: RuntimeInfo;
  readonly inputProfile: ManuscriptInputProfile;
  readonly formattingProfile: ManuscriptFormattingProfile;
  readonly preflightProfile: ManuscriptPreflightProfile;
  readonly fragmentProfile: FragmentShelfProfile;
  readonly foreshadowPointProfile: ForeshadowPointProfile;
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
    formattingProfile,
    preflightProfile,
    fragmentProfile,
    foreshadowPointProfile,
    documentProfile,
    persistenceProfile,
    startupRecovery,
    resumeCheckpoint,
    catalog,
  ] = await Promise.all([
    window.eumStudio.system.getRuntimeInfo(),
    window.eumStudio.editor.getManuscriptInputProfile(),
    window.eumStudio.editor.getManuscriptFormattingProfile(),
    window.eumStudio.editor.getManuscriptPreflightProfile(),
    window.eumStudio.fragments.getProfile(),
    window.eumStudio.foreshadowing.getPointProfile(),
    window.eumStudio.editor.getManuscriptDocumentProfile(),
    window.eumStudio.editor.getManuscriptPersistenceProfile(),
    window.eumStudio.editor.getManuscriptStartupRecovery(),
    window.eumStudio.editor.getManuscriptResumeCheckpoint(),
    window.eumStudio.workspace.getCatalog(),
  ]);
  return Object.freeze({
    info,
    inputProfile,
    formattingProfile,
    preflightProfile,
    fragmentProfile,
    foreshadowPointProfile,
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

type PendingEventDraft =
  | {
      readonly kind: "selection";
      readonly workId: CreateEventBlockCommand["workId"];
      readonly documentId: CreateEventBlockCommand["documentId"];
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
      readonly exactQuote: string;
    }
  | {
      readonly kind: "anchorless";
      readonly workId: CreateEventBlockCommand["workId"];
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
            <p className="panel-kicker">
              {input.draft.kind === "selection" ? "EXACT RANGE" : "EVENT OUTLINE"}
            </p>
            <h2 id="create-event-heading">
              {input.draft.kind === "selection" ? "사건으로 등록" : "예정 사건 추가"}
            </h2>
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
        {input.draft.kind === "selection" && (
          <div className="event-quote-preview">
            <span>선택 근거</span>
            <blockquote>{input.draft.exactQuote}</blockquote>
          </div>
        )}
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
            {input.draft.kind === "selection"
              ? "범위는 원고에서 선택한 위치 그대로 저장됩니다."
              : "원고 범위 없이 사건 개요에 저장합니다. 나중에 정확한 선택을 연결할 수 있습니다."}
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

function remainingTimerMs(deadlineAt: string | null, now: number): number {
  if (deadlineAt === null) return 0;
  const deadlineAtMs = Date.parse(deadlineAt);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - now) : 0;
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
  readonly renameWork: (
    workId: WorkspaceWorkSummary["workId"],
    title: string,
  ) => Promise<WorkspaceCatalogProjection>;
  readonly retireWork: (
    workId: WorkspaceWorkSummary["workId"],
  ) => Promise<WorkspaceCatalogProjection>;
  readonly retireDocument: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
  ) => Promise<WorkspaceCatalogProjection>;
  readonly moveDocument: (
    workId: WorkspaceWorkSummary["workId"],
    documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
    direction: MoveDocumentCommand["direction"],
  ) => Promise<WorkspaceCatalogProjection>;
  readonly prepareForMain: () => Promise<WorkspaceCatalogProjection>;
};

function RenameTitleForm({
  itemLabel,
  value,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  readonly itemLabel: "작품" | "회차";
  readonly value: string;
  readonly submitting: boolean;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting && value.trim().length > 0) {
      onSubmit();
    }
  };

  return (
    <form
      aria-label={`${itemLabel} 이름 변경`}
      className="title-rename-form"
      onSubmit={handleSubmit}
    >
      <input
        aria-label={`${itemLabel} 새 이름`}
        autoFocus
        disabled={submitting}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <button disabled={submitting} onClick={onCancel} type="button">
        취소
      </button>
      <button
        disabled={submitting || value.trim().length === 0}
        type="submit"
      >
        {submitting ? "저장 중" : "저장"}
      </button>
    </form>
  );
}

function CreateDocumentControl({
  visible,
  value,
  disabled,
  onStart,
  onCancel,
  onChange,
  onSubmit,
}: {
  readonly visible: boolean;
  readonly value: string;
  readonly disabled: boolean;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  if (!visible) {
    return (
      <span className="create-document-control">
        <button
          aria-label="새 회차"
          className="create-document-button"
          disabled={disabled}
          onClick={onStart}
          title="새 회차"
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </span>
    );
  }
  return (
    <span className="create-document-control">
      <form
        className="create-document-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          <span>회차 제목</span>
          <input
            aria-label="새 회차 제목"
            autoFocus
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="비우면 제목없음"
            value={value}
          />
        </label>
        <div>
          <button disabled={disabled} onClick={onCancel} type="button">
            취소
          </button>
          <button disabled={disabled} type="submit">
            만들기
          </button>
        </div>
      </form>
    </span>
  );
}

function DocumentFolderTree({
  work,
  documentCreateControl,
  activeDocumentId,
  disabled,
  onActivateDocument,
  onRenameDocument,
  onCreateFolder,
  onRenameFolder,
  onPlaceDocument,
  onRetireFolder,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly documentCreateControl: ReactNode;
  readonly activeDocumentId: string | null;
  readonly disabled: boolean;
  readonly onActivateDocument: (documentId: string) => void;
  readonly onRenameDocument: (document: WorkspaceDocumentSummary) => void;
  readonly onCreateFolder: (
    title: string,
    parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onRenameFolder: (
    folderId: WorkspaceDocumentFolderSummary["folderId"],
    title: string,
  ) => Promise<void>;
  readonly onPlaceDocument: (
    documentId: WorkspaceDocumentSummary["documentId"],
    folderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onRetireFolder: (
    folder: WorkspaceDocumentFolderSummary,
  ) => Promise<void>;
}) {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [createParentFolderId, setCreateParentFolderId] = useState<
    WorkspaceDocumentFolderSummary["folderId"] | null | undefined
  >(undefined);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [renameFolderId, setRenameFolderId] = useState<
    WorkspaceDocumentFolderSummary["folderId"] | null
  >(null);
  const [renameFolderTitle, setRenameFolderTitle] = useState("");
  const foldersByParentId = useMemo(() => {
    const groups = new Map<
      WorkspaceDocumentFolderSummary["folderId"] | null,
      WorkspaceDocumentFolderSummary[]
    >();
    for (const folder of work.folders) {
      const siblings = groups.get(folder.parentFolderId) ?? [];
      siblings.push(folder);
      groups.set(folder.parentFolderId, siblings);
    }
    return groups;
  }, [work.folders]);
  const documentsByFolderId = useMemo(() => {
    const groups = new Map<
      WorkspaceDocumentFolderSummary["folderId"] | null,
      WorkspaceDocumentSummary[]
    >();
    for (const document of work.documents) {
      const siblings = groups.get(document.folderId) ?? [];
      siblings.push(document);
      groups.set(document.folderId, siblings);
    }
    return groups;
  }, [work.documents]);
  const folderDepths = useMemo(() => {
    const byId = new Map(work.folders.map((folder) => [folder.folderId, folder]));
    return new Map(
      work.folders.map((folder) => {
        let depth = 0;
        let parentFolderId = folder.parentFolderId;
        while (parentFolderId !== null) {
          depth += 1;
          parentFolderId = byId.get(parentFolderId)?.parentFolderId ?? null;
        }
        return [folder.folderId, depth] as const;
      }),
    );
  }, [work.folders]);

  const closeCreateFolder = () => {
    setCreateParentFolderId(undefined);
    setNewFolderTitle("");
  };
  const renderDocument = (
    document: WorkspaceDocumentSummary,
    depth: number,
  ) => (
    <div
      className="document-tree-row document-tree-document"
      key={document.documentId}
      style={{ "--document-tree-depth": depth } as CSSProperties}
    >
      <button
        aria-current={
          document.documentId === activeDocumentId ? "page" : undefined
        }
        className={
          document.documentId === activeDocumentId
            ? "document-tree-open is-active"
            : "document-tree-open"
        }
        disabled={disabled}
        onClick={() => onActivateDocument(document.documentId)}
        type="button"
      >
        <FileText aria-hidden="true" size={14} />
        <span>{document.title}</span>
      </button>
      <span className="document-tree-title-edit-slot">
        {document.documentId === activeDocumentId && (
          <button
            aria-label="회차 이름 변경"
            className="title-edit-button document-tree-title-edit-button"
            disabled={disabled}
            onClick={() => onRenameDocument(document)}
            type="button"
          >
            <Pencil aria-hidden="true" size={13} />
          </button>
        )}
      </span>
      <select
        aria-label={`${document.title} 폴더 위치`}
        disabled={disabled}
        onChange={(event) => {
          const folderId = event.target.value;
          void onPlaceDocument(
            document.documentId,
            folderId.length === 0
              ? null
              : (folderId as WorkspaceDocumentFolderSummary["folderId"]),
          );
        }}
        value={document.folderId ?? ""}
      >
        <option value="">작품 루트</option>
        {work.folders.map((folder) => (
          <option key={folder.folderId} value={folder.folderId}>
            {`${"　".repeat(folderDepths.get(folder.folderId) ?? 0)}${folder.title}`}
          </option>
        ))}
      </select>
    </div>
  );
  const renderFolder = (
    folder: WorkspaceDocumentFolderSummary,
    depth: number,
  ): ReactNode => {
    const collapsed = collapsedFolderIds.has(folder.folderId);
    const childFolders = foldersByParentId.get(folder.folderId) ?? [];
    const childDocuments = documentsByFolderId.get(folder.folderId) ?? [];
    return (
      <div className="document-tree-folder-group" key={folder.folderId}>
        <div
          className="document-tree-row document-tree-folder"
          style={{ "--document-tree-depth": depth } as CSSProperties}
        >
          <button
            aria-label={`${folder.title} 폴더 ${collapsed ? "펼치기" : "접기"}`}
            className="document-folder-toggle"
            onClick={() => {
              setCollapsedFolderIds((current) => {
                const next = new Set(current);
                if (next.has(folder.folderId)) {
                  next.delete(folder.folderId);
                } else {
                  next.add(folder.folderId);
                }
                return next;
              });
            }}
            type="button"
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" size={14} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} />
            )}
          </button>
          <Folder aria-hidden="true" size={14} />
          {renameFolderId === folder.folderId ? (
            <form
              aria-label={`${folder.title} 폴더 이름 변경`}
              className="document-folder-rename"
              onSubmit={(event) => {
                event.preventDefault();
                void onRenameFolder(folder.folderId, renameFolderTitle).then(
                  () => {
                    setRenameFolderId(null);
                    setRenameFolderTitle("");
                  },
                  () => undefined,
                );
              }}
            >
              <input
                aria-label="폴더 새 이름"
                autoFocus
                disabled={disabled}
                onChange={(event) => setRenameFolderTitle(event.target.value)}
                value={renameFolderTitle}
              />
              <button
                disabled={disabled || renameFolderTitle.trim().length === 0}
                type="submit"
              >
                저장
              </button>
            </form>
          ) : (
            <strong>{folder.title}</strong>
          )}
          <div className="document-folder-actions">
            <button
              aria-label={`${folder.title} 하위 폴더 추가`}
              disabled={disabled}
              onClick={() => {
                setCreateParentFolderId(folder.folderId);
                setNewFolderTitle("");
              }}
              title="하위 폴더 추가"
              type="button"
            >
              <FolderPlus aria-hidden="true" size={13} />
            </button>
            <button
              aria-label={`${folder.title} 폴더 이름 변경`}
              disabled={disabled}
              onClick={() => {
                setRenameFolderId(folder.folderId);
                setRenameFolderTitle(folder.title);
              }}
              title="폴더 이름 변경"
              type="button"
            >
              <Pencil aria-hidden="true" size={13} />
            </button>
            <button
              aria-label={`${folder.title} 폴더 삭제`}
              disabled={disabled}
              onClick={() => void onRetireFolder(folder)}
              title="폴더 삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={13} />
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="document-tree-children">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childDocuments.map((document) =>
              renderDocument(document, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };
  const parentFolder =
    createParentFolderId === null || createParentFolderId === undefined
      ? undefined
      : work.folders.find(
          (folder) => folder.folderId === createParentFolderId,
        );

  return (
    <section aria-label="회차 폴더" className="document-folder-tree">
      <header>
        <strong>문서</strong>
        <span className="document-folder-header-actions">
          {documentCreateControl}
          <button
            aria-label="폴더 추가"
            disabled={disabled}
            onClick={() => {
              setCreateParentFolderId(null);
              setNewFolderTitle("");
            }}
            title="폴더 추가"
            type="button"
          >
            <FolderPlus aria-hidden="true" size={14} />
          </button>
        </span>
      </header>
      {createParentFolderId !== undefined && (
        <form
          aria-label="새 폴더 만들기"
          className="document-folder-create"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateFolder(newFolderTitle, createParentFolderId).then(
              closeCreateFolder,
              () => undefined,
            );
          }}
        >
          <span>
            {parentFolder === undefined
              ? "작품 루트"
              : `${parentFolder.title} 아래`}
          </span>
          <input
            aria-label="새 폴더 이름"
            autoFocus
            disabled={disabled}
            onChange={(event) => setNewFolderTitle(event.target.value)}
            value={newFolderTitle}
          />
          <button disabled={disabled} onClick={closeCreateFolder} type="button">
            취소
          </button>
          <button
            disabled={disabled || newFolderTitle.trim().length === 0}
            type="submit"
          >
            만들기
          </button>
        </form>
      )}
      <div className="document-tree" aria-label="회차 폴더 트리">
        {(foldersByParentId.get(null) ?? []).map((folder) =>
          renderFolder(folder, 0),
        )}
        {(documentsByFolderId.get(null) ?? []).map((document) =>
          renderDocument(document, 0),
        )}
      </div>
    </section>
  );
}

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
  const reviewDocumentTabId = useId();
  const reviewWorkTabId = useId();
  const reviewVersionsTabId = useId();
  const workspaceBodyRef = useRef<HTMLDivElement>(null);
  const manuscriptEditorRef =
    useRef<ManuscriptEditorHandle>(null);
  const durableSaveQueueRef =
    useRef<ManuscriptDurableSaveQueue | null>(null);
  const continuousReadingProgressRef =
    useRef<WorkContinuousReadingProgressProjection | null>(null);
  const continuousReadingLocationRef =
    useRef<ContinuousReadingLocation | null>(null);
  const continuousReadingSaveChainRef = useRef<Promise<void>>(
    Promise.resolve(),
  );
  const continuousReadingPendingSaveRef = useRef<Promise<void>>(
    Promise.resolve(),
  );
  const versionLoadSequenceRef = useRef(0);
  const preflightLoadSequenceRef = useRef(0);
  const assistantContextLoadSequenceRef = useRef(0);
  const editingDocumentKeyRef = useRef<string | null>(null);
  const writingSessionTransitionPendingRef = useRef(false);
  const activeWritingSessionRef =
    useRef<WritingSessionProjection | undefined>(undefined);
  const pomodoroReconcilePendingRef = useRef(false);
  const pendingFragmentSourceRef = useRef<PendingFragmentSource | null>(null);
  const pendingForeshadowPointSourceRef =
    useRef<PendingForeshadowPointSource | null>(null);
  const pendingPlotThreadSourceRef =
    useRef<PendingPlotThreadSource | null>(null);
  const pendingWorkStructureRangeRef =
    useRef<PendingWorkStructureRange | null>(null);
  const pendingEventRailRangeRef =
    useRef<PendingEventRailRange | null>(null);
  const pendingLoreEvidenceRef = useRef<PendingLoreEvidence | null>(null);
  const pendingLoreCandidateEvidenceRef =
    useRef<PendingLoreCandidateEvidence | null>(null);
  const pendingAssistantVocabularyOccurrenceRef =
    useRef<PendingAssistantVocabularyOccurrence | null>(null);
  const [telemetryStore] = useState(
    () => new ManuscriptTelemetryStore(),
  );
  const [assistantConversationId] = useState(() =>
    entityId<"AssistantConversation">(crypto.randomUUID()),
  );
  const hasManuscriptSelection = useSyncExternalStore(
    telemetryStore.subscribeSelection,
    telemetryStore.getSelectionSnapshot,
  );
  const manuscriptSearchRef =
    useRef<ManuscriptSearchState | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>({ status: "loading" });
  const [railState, setRailState] = useState(() =>
    createWorkspaceRailState({
      layout: "wide",
      initialVisibility: {
        left: "open",
        right: "closed",
      },
    }),
  );
  const [reviewInspectorTab, setReviewInspectorTab] =
    useState<ReviewInspectorTab>("document");
  const [documentTabSession, setDocumentTabSession] = useState(
    createDocumentTabSession,
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
    useState<
      | "idle"
      | "switching"
      | "creating-document"
      | "creating-work"
      | "renaming-work"
      | "renaming-document"
      | "retiring-work"
      | "retiring-document"
      | "moving-document"
      | "managing-document-folders"
    >("idle");
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [titleEditTarget, setTitleEditTarget] = useState<
    "work" | "document" | null
  >(null);
  const [titleEditValue, setTitleEditValue] = useState("");
  const [workspaceActionError, setWorkspaceActionError] = useState<
    string | null
  >(null);
  const [eventBlocks, setEventBlocks] = useState<
    readonly EventBlockProjection[]
  >([]);
  const [eventSources, setEventSources] = useState<
    readonly EventSourceProjection[]
  >([]);
  const [eventRail, setEventRail] = useState<EventRailProjection | null>(null);
  const [eventRailMode, setEventRailMode] =
    useState<EventRailMode>("manuscript");
  const [pendingEventDraft, setPendingEventDraft] = useState<
    PendingEventDraft | null
  >(null);
  const [eventActionState, setEventActionState] = useState<
    "idle" | "creating" | "linking" | "replacing" | "retiring" | "opening"
  >("idle");
  const [eventActionError, setEventActionError] = useState<string | null>(null);
  const [sceneProjection, setSceneProjection] =
    useState<SceneProjectionList | null>(null);
  const [sceneActionState, setSceneActionState] = useState<
    "idle" | "creating" | "updating-rule" | "updating-event"
  >("idle");
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const [workActivity, setWorkActivity] = useState<
    WorkActivityProjection | null
  >(null);
  const [pomodoro, setPomodoro] = useState<PomodoroProjection | null>(null);
  const [dailyGoals, setDailyGoals] =
    useState<WorkRecordsGoalsProjection | null>(null);
  const [showDailyGoalDialog, setShowDailyGoalDialog] = useState(false);
  const [dailyGoalActionState, setDailyGoalActionState] = useState<
    "idle" | "saving"
  >("idle");
  const [dailyGoalError, setDailyGoalError] = useState<string | null>(null);
  const [activityActionState, setActivityActionState] = useState<
    | "idle"
    | "starting-session"
    | "stopping-session"
    | "starting-focus"
    | "pausing-focus"
    | "resuming-focus"
    | "stopping-focus"
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
  const [workSnapshotComparison, setWorkSnapshotComparison] = useState<
    WorkSnapshotComparisonProjection | null
  >(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [versionActionState, setVersionActionState] = useState<
    | "idle"
    | "refreshing"
    | "restoring"
    | "creating-snapshot"
    | "comparing-snapshot"
  >("idle");
  const [versionActionError, setVersionActionError] = useState<string | null>(
    null,
  );
  const [pendingManuscriptPreflight, setPendingManuscriptPreflight] =
    useState<PendingManuscriptPreflight | null>(null);
  const [preflightActionError, setPreflightActionError] = useState<
    string | null
  >(null);
  const [continuousReadingDialogState, setContinuousReadingDialogState] =
    useState<ContinuousReadingDialogState>({ status: "closed" });
  const [continuousReadingOpenError, setContinuousReadingOpenError] = useState<
    string | null
  >(null);
  const [fragments, setFragments] = useState<
    readonly FragmentProjection[]
  >([]);
  const [fragmentDialogOpen, setFragmentDialogOpen] = useState(false);
  const [fragmentActionState, setFragmentActionState] =
    useState<FragmentShelfActionState>("idle");
  const [fragmentActionError, setFragmentActionError] = useState<
    string | null
  >(null);
  const [foreshadowLines, setForeshadowLines] = useState<
    readonly ForeshadowLineProjection[]
  >([]);
  const [foreshadowPoints, setForeshadowPoints] = useState<
    readonly ForeshadowPointProjection[]
  >([]);
  const [foreshadowLineDialogOpen, setForeshadowLineDialogOpen] =
    useState(false);
  const [selectedForeshadowLineId, setSelectedForeshadowLineId] = useState<
    string | null
  >(null);
  const [foreshadowLineActionState, setForeshadowLineActionState] =
    useState<ForeshadowLineActionState>("idle");
  const [foreshadowLineActionError, setForeshadowLineActionError] = useState<
    string | null
  >(null);
  const [characters, setCharacters] = useState<
    readonly CharacterProjection[]
  >([]);
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [characterActionState, setCharacterActionState] =
    useState<CharacterManagerActionState>("idle");
  const [characterActionError, setCharacterActionError] = useState<
    string | null
  >(null);
  const [plots, setPlots] = useState<readonly PlotThreadProjection[]>([]);
  const [plotBoard, setPlotBoard] = useState<PlotBoardProjection | null>(null);
  const [plotSources, setPlotSources] = useState<
    readonly PlotThreadSourceProjection[]
  >([]);
  const [plotEventLinks, setPlotEventLinks] = useState<
    readonly PlotEventLinkProjection[]
  >([]);
  const [plotDialogOpen, setPlotDialogOpen] = useState(false);
  const [selectedPlotThreadId, setSelectedPlotThreadId] = useState<
    string | null
  >(null);
  const [plotActionState, setPlotActionState] =
    useState<PlotManagerActionState>("idle");
  const [plotActionError, setPlotActionError] = useState<string | null>(null);
  const [loreEntries, setLoreEntries] = useState<
    readonly LoreEntryProjection[]
  >([]);
  const [loreCandidates, setLoreCandidates] = useState<
    readonly LoreCandidateProjection[]
  >([]);
  const [loreForeshadowLinks, setLoreForeshadowLinks] = useState<
    readonly LoreForeshadowLinkProjection[]
  >([]);
  const [loreDialogOpen, setLoreDialogOpen] = useState(false);
  const [selectedLoreEntryId, setSelectedLoreEntryId] = useState<
    string | null
  >(null);
  const [loreActionState, setLoreActionState] =
    useState<LoreManagerActionState>("idle");
  const [loreActionError, setLoreActionError] = useState<string | null>(null);
  const [loreCandidateDialogOpen, setLoreCandidateDialogOpen] = useState(false);
  const [loreCandidateActionState, setLoreCandidateActionState] =
    useState<LoreCandidateActionState>("idle");
  const [loreCandidateActionError, setLoreCandidateActionError] = useState<
    string | null
  >(null);
  const [hoveredLoreCue, setHoveredLoreCue] =
    useState<LoreCueInteraction | null>(null);
  const [pinnedLoreCue, setPinnedLoreCue] = useState<LoreCue | null>(null);
  const [loreCueActionError, setLoreCueActionError] = useState<string | null>(
    null,
  );
  const [workStructureDialogOpen, setWorkStructureDialogOpen] =
    useState(false);
  const [workStructureActionState, setWorkStructureActionState] =
    useState<"idle" | "opening">("idle");
  const [workStructureActionError, setWorkStructureActionError] = useState<
    string | null
  >(null);
  const [assistantContextDialogOpen, setAssistantContextDialogOpen] =
    useState(false);
  const [assistantContextProjection, setAssistantContextProjection] =
    useState<AssistantContextStateProjection | null>(null);
  const [assistantDestinationProfile, setAssistantDestinationProfile] =
    useState<AssistantDestinationProfile | null>(null);
  const [assistantContextActionState, setAssistantContextActionState] =
    useState<AssistantContextDialogActionState>("idle");
  const [assistantContextActionError, setAssistantContextActionError] =
    useState<string | null>(null);
  const [assistantConnectionsDialogOpen, setAssistantConnectionsDialogOpen] =
    useState(false);
  const [assistantConnections, setAssistantConnections] = useState<
    readonly AssistantConnectionProjection[]
  >([]);
  const [assistantConnectorProfile, setAssistantConnectorProfile] =
    useState<AssistantConnectorManifestProfile | null>(null);
  const [assistantConnectionsActionState, setAssistantConnectionsActionState] =
    useState<AssistantConnectionsDialogActionState>("idle");
  const [assistantConnectionsActionError, setAssistantConnectionsActionError] =
    useState<string | null>(null);

  const captureResumeForDocument = useCallback(
    async (
      document: ManuscriptDocumentSource,
      summary?: ManuscriptDocumentStateSummary,
    ) => {
      if (
        runtime.status === "ready" &&
        runtime.resumeCheckpoint.status === "unavailable"
      ) {
        return runtime.resumeCheckpoint;
      }
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
      if (
        runtime.status === "ready" &&
        runtime.resumeCheckpoint.status === "resolved" &&
        runtime.resumeCheckpoint.workId === document.workId &&
        runtime.resumeCheckpoint.documentId === document.documentId &&
        runtime.resumeCheckpoint.targetRevisionId ===
          document.documentRevisionId &&
        runtime.resumeCheckpoint.selection.anchor === selection.anchor &&
        runtime.resumeCheckpoint.selection.head === selection.head
      ) {
        return runtime.resumeCheckpoint;
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
    [runtime],
  );

  const persistDocument = useCallback(
    async (document: ManuscriptDocumentSource) => {
      await durableSaveQueueRef.current?.flush(document.documentId);
      await captureResumeForDocument(document);
    },
    [captureResumeForDocument],
  );

  const handleFormattingChange = useCallback(
    (
      document: ManuscriptDocumentSource,
      state: ManuscriptEditorDocumentState,
    ) => {
      const pending = durableSaveQueueRef.current?.recordFormatting(
        document.documentId,
        serializeManuscriptEditorDocumentState(state),
      );
      void pending?.catch(() => undefined);
    },
    [],
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
  const handleDocumentActivated = useCallback(
    (
      _document: ManuscriptDocumentSource,
      summary: ManuscriptDocumentStateSummary,
    ) => {
      setHoveredLoreCue(null);
      setPinnedLoreCue(null);
      setLoreCueActionError(null);
      telemetryStore.publish(
        summary.statistics,
        summary.selection.ranges.some((range) => !range.empty),
      );
      let resumeSummary: ManuscriptDocumentStateSummary | undefined = summary;
      const pendingFragmentSource = pendingFragmentSourceRef.current;
      if (
        pendingFragmentSource !== null &&
        pendingFragmentSource.workId === _document.workId &&
        pendingFragmentSource.documentId === _document.documentId
      ) {
        pendingFragmentSourceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingFragmentSource.range,
        );
        if (!selected) {
          setFragmentActionError(
            "파편의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setFragmentDialogOpen(true);
        } else {
          setFragmentActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingForeshadowPointSource =
        pendingForeshadowPointSourceRef.current;
      if (
        pendingForeshadowPointSource !== null &&
        pendingForeshadowPointSource.workId === _document.workId &&
        pendingForeshadowPointSource.documentId === _document.documentId
      ) {
        pendingForeshadowPointSourceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingForeshadowPointSource.range,
        );
        if (!selected) {
          setForeshadowLineActionError(
            "복선 지점의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setForeshadowLineDialogOpen(true);
        } else {
          setForeshadowLineActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingPlotThreadSource = pendingPlotThreadSourceRef.current;
      if (
        pendingPlotThreadSource !== null &&
        pendingPlotThreadSource.workId === _document.workId &&
        pendingPlotThreadSource.documentId === _document.documentId
      ) {
        pendingPlotThreadSourceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingPlotThreadSource.range,
        );
        if (!selected) {
          setPlotActionError(
            "플롯 출처의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setPlotDialogOpen(true);
        } else {
          setPlotActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingWorkStructureRange = pendingWorkStructureRangeRef.current;
      if (
        pendingWorkStructureRange !== null &&
        pendingWorkStructureRange.workId === _document.workId &&
        pendingWorkStructureRange.documentId === _document.documentId
      ) {
        pendingWorkStructureRangeRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingWorkStructureRange.range,
        );
        setWorkStructureActionState("idle");
        if (!selected) {
          setWorkStructureActionError(
            "작품 구조에 기록된 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setWorkStructureDialogOpen(true);
        } else {
          setWorkStructureActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingEventRailRange = pendingEventRailRangeRef.current;
      if (
        pendingEventRailRange !== null &&
        pendingEventRailRange.workId === _document.workId &&
        pendingEventRailRange.documentId === _document.documentId
      ) {
        pendingEventRailRangeRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingEventRailRange.range,
        );
        setEventActionState("idle");
        if (!selected) {
          setEventActionError(
            "사건의 정확한 원고 범위를 선택하지 못했습니다.",
          );
        } else {
          setEventActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingLoreEvidence = pendingLoreEvidenceRef.current;
      if (
        pendingLoreEvidence !== null &&
        pendingLoreEvidence.workId === _document.workId &&
        pendingLoreEvidence.documentId === _document.documentId
      ) {
        pendingLoreEvidenceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingLoreEvidence.range,
        );
        if (!selected) {
          setLoreActionError(
            "별빛 근거의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setLoreDialogOpen(true);
        } else {
          setLoreActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingLoreCandidateEvidence =
        pendingLoreCandidateEvidenceRef.current;
      if (
        pendingLoreCandidateEvidence !== null &&
        pendingLoreCandidateEvidence.workId === _document.workId &&
        pendingLoreCandidateEvidence.documentId === _document.documentId
      ) {
        pendingLoreCandidateEvidenceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingLoreCandidateEvidence.range,
        );
        if (!selected) {
          setLoreCandidateActionError(
            "별빛 후보의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          setLoreCandidateDialogOpen(true);
        } else {
          setLoreCandidateActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingAssistantVocabularyOccurrence =
        pendingAssistantVocabularyOccurrenceRef.current;
      if (
        pendingAssistantVocabularyOccurrence !== null &&
        pendingAssistantVocabularyOccurrence.workId === _document.workId &&
        pendingAssistantVocabularyOccurrence.documentId === _document.documentId
      ) {
        pendingAssistantVocabularyOccurrenceRef.current = null;
        const currentRevisionId =
          durableSaveQueueRef.current?.getCurrentRevisionId(
            _document.documentId,
          ) ?? _document.documentRevisionId;
        if (
          currentRevisionId !==
          pendingAssistantVocabularyOccurrence.documentRevisionId
        ) {
          setAssistantContextActionError(
            "저장된 어휘 위치의 원고 revision이 변경되었습니다.",
          );
          setAssistantContextDialogOpen(true);
        } else {
          const selected = manuscriptEditorRef.current?.selectDocumentRange(
            _document,
            pendingAssistantVocabularyOccurrence.range,
          );
          if (!selected) {
            setAssistantContextActionError(
              "저장된 어휘의 정확한 원문 범위를 선택하지 못했습니다.",
            );
            setAssistantContextDialogOpen(true);
          } else {
            setAssistantContextActionError(null);
            resumeSummary = undefined;
          }
        }
      }
      void captureResumeForDocument(_document, resumeSummary)
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
        formattingProfile,
        preflightProfile,
        fragmentProfile,
        foreshadowPointProfile,
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
            saveChangeBatch: async (batch, editorStateJson) => {
              if (editorStateJson === null) {
                throw new Error(
                  `The editor state is unavailable for ${batch.documentId}`,
                );
              }
              const receipt = await window.eumStudio.editor.saveDocumentChange({
                schemaVersion: 1,
                batch,
                editorStateJson,
              });
              void window.eumStudio.structure.listSceneProjection({
                schemaVersion: 1,
                workId: batch.workId,
              }).then(
                (projection) => {
                  setSceneProjection(projection);
                  setSceneActionError(null);
                },
                () => {
                  setSceneActionError(
                    "저장된 원고 기준 장면 목록을 갱신하지 못했습니다.",
                  );
                },
              );
              return receipt;
            },
            saveFormatting: (command) =>
              window.eumStudio.editor.saveFormatting(command),
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
      const catalogActiveDocument =
        catalog.activeDocumentId === null
          ? undefined
          : documentProfile.documents.find(
              (document) =>
                document.documentId === catalog.activeDocumentId,
            );
      if (
        catalog.activeDocumentId !== null &&
        catalogActiveDocument === undefined
      ) {
        throw new Error(
          "The catalog active Document is missing from the document profile",
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
            catalogActiveDocument?.documentId ??
            null;
      setRuntime({
        status: "ready",
        info,
        inputProfile,
        formattingProfile,
        preflightProfile,
        fragmentProfile,
        foreshadowPointProfile,
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
              await continuousReadingPendingSaveRef.current;
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
  const sharesDocumentRailWithSidebar =
    documentRailHost !== null && documentRailHost !== undefined;
  const activeWork =
    runtime.status === "ready" && runtime.catalog.activeWorkId !== null
      ? runtime.catalog.works.find(
          (work) => work.workId === runtime.catalog.activeWorkId,
        )
      : undefined;
  const activeWorkDocuments = useMemo(
    () =>
      runtime.status === "ready" && activeWork !== undefined
        ? runtime.documentProfile.documents.filter(
            (document) => document.workId === activeWork.workId,
          )
        : [],
    [activeWork, runtime],
  );
  const persistContinuousReadingLocation = useCallback(
    (location: ContinuousReadingLocation): Promise<void> => {
      const execution = continuousReadingSaveChainRef.current.then(
        async () => {
          const progress = continuousReadingProgressRef.current;
          if (progress === null) {
            throw new Error("연속 읽기 저장 상태를 찾지 못했습니다.");
          }
          if (
            sameContinuousReadingLocation(
              continuousReadingLocationRef.current,
              location,
            )
          ) {
            return;
          }
          const saved =
            await window.eumStudio.editor.saveContinuousReadingProgress({
              schemaVersion: 1,
              workId: progress.workId,
              expectedRevision: progress.revision,
              location,
            });
          continuousReadingProgressRef.current = saved;
          continuousReadingLocationRef.current = saved.location;
        },
      );
      continuousReadingPendingSaveRef.current = execution;
      continuousReadingSaveChainRef.current = execution.catch(() => undefined);
      return execution;
    },
    [],
  );
  const openContinuousReading = useCallback(async () => {
    if (
      runtime.status !== "ready" ||
      activeWork === undefined ||
      activeDocument === undefined ||
      continuousReadingDialogState.status !== "closed"
    ) {
      return;
    }
    setContinuousReadingOpenError(null);
    setContinuousReadingDialogState({ status: "loading" });
    try {
      await continuousReadingPendingSaveRef.current;
      await persistDocument(activeDocument);
      const queue = durableSaveQueueRef.current;
      if (queue !== null) {
        await Promise.all(
          activeWorkDocuments
            .filter(
              (document) => document.documentId !== activeDocument.documentId,
            )
            .map((document) => queue.flush(document.documentId)),
        );
      }
      const editor = manuscriptEditorRef.current;
      if (editor === null) {
        throw new Error("원고 편집기를 찾지 못했습니다.");
      }
      const documents = Object.freeze(
        activeWorkDocuments.map((document) => {
          const documentRevisionId =
            queue?.getCurrentRevisionId(document.documentId) ??
            document.documentRevisionId;
          if (documentRevisionId === null) {
            throw new Error(
              `${document.label} 회차의 저장 revision을 찾지 못했습니다.`,
            );
          }
          return Object.freeze({
            workId: document.workId,
            documentId: document.documentId,
            documentRevisionId,
            title: document.label,
            text: editor.materializeDocumentText(document),
          });
        }),
      );
      const progress =
        await window.eumStudio.editor.getContinuousReadingProgress({
          schemaVersion: 1,
          workId: activeWork.workId,
        });
      continuousReadingProgressRef.current = progress;
      continuousReadingLocationRef.current = progress.location;
      setContinuousReadingDialogState({
        status: "ready",
        session: deriveContinuousReadingSession({
          workId: activeWork.workId,
          documents,
          progress,
        }),
      });
    } catch (error: unknown) {
      continuousReadingProgressRef.current = null;
      continuousReadingLocationRef.current = null;
      setContinuousReadingDialogState({ status: "closed" });
      setContinuousReadingOpenError(
        error instanceof Error
          ? error.message
          : "연속 읽기를 열지 못했습니다.",
      );
    }
  }, [
    activeDocument,
    activeWork,
    activeWorkDocuments,
    continuousReadingDialogState.status,
    persistDocument,
    runtime,
  ]);
  const closeContinuousReading = useCallback(
    async (location: ContinuousReadingLocation | null): Promise<void> => {
      if (location !== null) {
        await persistContinuousReadingLocation(location);
      }
      await continuousReadingPendingSaveRef.current;
      setContinuousReadingDialogState({ status: "closed" });
      continuousReadingProgressRef.current = null;
      continuousReadingLocationRef.current = null;
    },
    [persistContinuousReadingLocation],
  );
  const activeWorkDocumentIds = useMemo(
    () =>
      activeWorkDocuments.map((document) => document.documentId),
    [activeWorkDocuments],
  );
  const activeWorkDocumentLabels = useMemo(
    () =>
      Object.freeze(
        Object.fromEntries(
          activeWorkDocuments.map((document) => [
            document.documentId,
            document.label,
          ]),
        ),
      ),
    [activeWorkDocuments],
  );
  const openDocumentTabIds = useMemo(
    () =>
      projectDocumentTabs({
        session: documentTabSession,
        workId: activeWork?.workId ?? null,
        orderedDocumentIds: activeWorkDocumentIds,
        activeDocumentId:
          runtime.status === "ready"
            ? runtime.activeDocumentId
            : null,
      }),
    [
      activeWork?.workId,
      activeWorkDocumentIds,
      documentTabSession,
      runtime,
    ],
  );
  const openDocuments = useMemo(() => {
    const openDocumentIds = new Set(openDocumentTabIds);
    return activeWorkDocuments.filter((document) =>
      openDocumentIds.has(document.documentId),
    );
  }, [activeWorkDocuments, openDocumentTabIds]);
  const activeWorkEventBlocks =
    activeWork === undefined
      ? []
      : eventBlocks.filter(
          (eventBlock) => eventBlock.workId === activeWork.workId,
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
  const activeAssistantGrantCount =
    assistantContextProjection !== null &&
    assistantContextProjection.workId === activeWorkId
      ? assistantContextProjection.grants.filter(
          (grant) => grant.revokedAt === null && grant.consumedAt === null,
        ).length
      : 0;
  const activeWorkCharacters = useMemo(
    () =>
      activeWorkId === null
        ? []
        : characters.filter((character) => character.workId === activeWorkId),
    [activeWorkId, characters],
  );
  const activeSelectedCharacterId =
    selectedCharacterId !== null && activeWorkCharacters.some(
      (character) => character.characterId === selectedCharacterId,
    )
      ? selectedCharacterId
      : null;
  const activeWorkPlots = useMemo(
    () =>
      activeWorkId === null
        ? []
        : plots.filter((plot) => plot.workId === activeWorkId),
    [activeWorkId, plots],
  );
  const activeWorkPlotSources = useMemo(
    () =>
      activeWorkId === null
        ? []
        : plotSources.filter((source) => source.workId === activeWorkId),
    [activeWorkId, plotSources],
  );
  const activeWorkPlotEventLinks = useMemo(
    () =>
      activeWorkId === null
        ? []
        : plotEventLinks.filter((link) => link.workId === activeWorkId),
    [activeWorkId, plotEventLinks],
  );
  const activeWorkLoreEntries = useMemo(
    () =>
      activeWorkId === null
        ? []
        : loreEntries.filter((entry) => entry.workId === activeWorkId),
    [activeWorkId, loreEntries],
  );
  const activeWorkLoreCandidates = useMemo(
    () =>
      activeWorkId === null
        ? []
        : loreCandidates.filter((candidate) => candidate.workId === activeWorkId),
    [activeWorkId, loreCandidates],
  );
  const activeWorkLoreForeshadowLinks = useMemo(
    () =>
      activeWorkId === null
        ? []
        : loreForeshadowLinks.filter((link) => link.workId === activeWorkId),
    [activeWorkId, loreForeshadowLinks],
  );
  const workStructureOverview = useMemo(
    () =>
      activeWork === undefined
        ? null
        : deriveWorkStructureOverview({
            workId: activeWork.workId,
            workTitle: activeWork.title,
            documents: activeWorkDocuments,
            characters: activeWorkCharacters,
            plots: activeWorkPlots,
            plotSources: activeWorkPlotSources,
            eventBlocks: eventBlocks.filter(
              (eventBlock) => eventBlock.workId === activeWork.workId,
            ),
            eventSources: eventSources.filter(
              (eventSource) => eventSource.workId === activeWork.workId,
            ),
            scenes:
              sceneProjection?.workId === activeWork.workId
                ? sceneProjection.scenes
                : [],
          }),
    [
      activeWork,
      activeWorkCharacters,
      activeWorkDocuments,
      activeWorkPlotSources,
      activeWorkPlots,
      eventBlocks,
      eventSources,
      sceneProjection,
    ],
  );
  const activeSelectedPlotThreadId = activeWorkPlots.some(
    (plot) => plot.plotThreadId === selectedPlotThreadId,
  )
    ? selectedPlotThreadId
    : null;
  const activeSelectedLoreEntryId = activeWorkLoreEntries.some(
    (entry) => entry.loreEntryId === selectedLoreEntryId,
  )
    ? selectedLoreEntryId
    : null;
  const activeWritingSession =
    activeWorkId !== null && workActivity?.workId === activeWorkId
      ? workActivity.sessions.find(
          (session) => session.sessionId === workActivity.activeSessionId,
        )
      : undefined;
  useEffect(() => {
    activeWritingSessionRef.current = activeWritingSession;
  }, [activeWritingSession]);
  const activeFocusCycle =
    activeWorkId !== null && workActivity?.workId === activeWorkId
      ? workActivity.focusCycles.find(
          (cycle) => cycle.focusCycleId === workActivity.activeFocusCycleId,
        )
      : undefined;
  const activePomodoroPhase =
    activeWorkId !== null && pomodoro?.workId === activeWorkId
      ? pomodoro.activePhase
      : null;
  const openAssistantContextDialog = useCallback(async () => {
    if (activeWork === undefined) return;
    const sequence = assistantContextLoadSequenceRef.current + 1;
    assistantContextLoadSequenceRef.current = sequence;
    setAssistantContextDialogOpen(true);
    setAssistantContextActionState("loading");
    setAssistantContextActionError(null);
    try {
      const [destinationProfile, projection, connectionsProjection] =
        await Promise.all([
        window.eumStudio.assistant.getDestinationProfile(),
        window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        }),
        window.eumStudio.assistant.listConnections(),
      ]);
      if (assistantContextLoadSequenceRef.current !== sequence) return;
      setAssistantDestinationProfile(destinationProfile);
      setAssistantContextProjection(projection);
      setAssistantConnections(connectionsProjection.connections);
      setAssistantContextActionState("idle");
    } catch (reason) {
      if (assistantContextLoadSequenceRef.current !== sequence) return;
      setAssistantContextActionError(
        reason instanceof Error
          ? reason.message
          : "조수 접근 권한을 불러오지 못했습니다.",
      );
      setAssistantContextActionState("idle");
    }
  }, [activeWork, assistantConversationId]);
  const openAssistantConnectionsDialog = useCallback(async () => {
    setAssistantConnectionsDialogOpen(true);
    setAssistantConnectionsActionState("loading");
    setAssistantConnectionsActionError(null);
    try {
      const [projection, connectorProfile] = await Promise.all([
        window.eumStudio.assistant.listConnections(),
        window.eumStudio.assistant.getConnectorProfile(),
      ]);
      setAssistantConnections(projection.connections);
      setAssistantConnectorProfile(connectorProfile);
    } catch (reason) {
      setAssistantConnectionsActionError(
        reason instanceof Error
          ? reason.message
          : "조수 연결을 불러오지 못했습니다.",
      );
    } finally {
      setAssistantConnectionsActionState("idle");
    }
  }, []);
  const saveAssistantConnection = useCallback(
    async (draft: AssistantConnectionEditorInput) => {
      if (assistantConnectionsActionState !== "idle") return;
      setAssistantConnectionsActionState("saving");
      setAssistantConnectionsActionError(null);
      try {
        await window.eumStudio.assistant.saveConnection({
          schemaVersion: 1,
          connectionId:
            draft.connection?.connectionId ??
            entityId<"AssistantConnection">(crypto.randomUUID()),
          expectedRevision: draft.connection?.revision ?? 0,
          connectorKind: draft.connectorKind,
          label: draft.label,
          endpoint: draft.endpoint,
          model: draft.model,
          credential: draft.credential,
        });
        const projection = await window.eumStudio.assistant.listConnections();
        setAssistantConnections(projection.connections);
      } catch (reason) {
        setAssistantConnectionsActionError(
          reason instanceof Error
            ? reason.message
            : "조수 연결을 저장하지 못했습니다.",
        );
      } finally {
        setAssistantConnectionsActionState("idle");
      }
    },
    [assistantConnectionsActionState],
  );
  const deleteAssistantConnection = useCallback(
    async (connection: AssistantConnectionProjection) => {
      if (assistantConnectionsActionState !== "idle") return;
      setAssistantConnectionsActionState("deleting");
      setAssistantConnectionsActionError(null);
      try {
        await window.eumStudio.assistant.deleteConnection({
          schemaVersion: 1,
          connectionId: connection.connectionId,
          expectedRevision: connection.revision,
        });
        const projection = await window.eumStudio.assistant.listConnections();
        setAssistantConnections(projection.connections);
      } catch (reason) {
        setAssistantConnectionsActionError(
          reason instanceof Error
            ? reason.message
            : "조수 연결을 삭제하지 못했습니다.",
        );
      } finally {
        setAssistantConnectionsActionState("idle");
      }
    },
    [assistantConnectionsActionState],
  );
  const grantAssistantContextPermission = useCallback(
    async (draft: AssistantPermissionDraft) => {
      if (
        activeWork === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("granting");
      setAssistantContextActionError(null);
      try {
        await window.eumStudio.assistant.grantContextPermission({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId:
            draft.duration === "work" ? null : assistantConversationId,
          ...draft,
        });
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "조수 접근 권한을 승인하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [activeWork, assistantContextActionState, assistantConversationId],
  );
  const revokeAssistantContextPermission = useCallback(
    async (grant: AssistantContextPermissionGrant) => {
      if (
        activeWork === undefined ||
        grant.workId !== activeWork.workId ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("revoking");
      setAssistantContextActionError(null);
      try {
        await window.eumStudio.assistant.revokeContextPermission({
          schemaVersion: 1,
          workId: activeWork.workId,
          grantId: grant.grantId,
          expectedRevision: grant.revision,
        });
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "조수 접근 권한을 철회하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [activeWork, assistantContextActionState, assistantConversationId],
  );
  const runAssistantVocabularyLookup = useCallback(
    async (destinationId: string) => {
      if (
        activeWork === undefined ||
        activeDocument === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (selection === undefined || selection.empty) {
        setAssistantContextActionError(
          "원고에서 검색할 어휘를 정확히 선택하세요.",
        );
        return;
      }
      setAssistantContextActionState("running-vocabulary");
      setAssistantContextActionError(null);
      try {
        await persistDocument(activeDocument);
        const documentRevisionId =
          durableSaveQueueRef.current?.getCurrentRevisionId(
            activeDocument.documentId,
          ) ?? activeDocument.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        const result = await window.eumStudio.assistant.runVocabularyLookup({
          schemaVersion: 1,
          requestId: entityId<"AssistantContextRequest">(crypto.randomUUID()),
          workId: activeWork.workId,
          conversationId: assistantConversationId,
          destinationId,
          sourceRange: {
            documentId: activeDocument.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          },
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "이 기능에 필요한 작품 전체 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "작품 내 어휘를 검색하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      assistantContextActionState,
      assistantConversationId,
      persistDocument,
    ],
  );
  const runAssistantVocabularySuggestion = useCallback(
    async (input: Readonly<{
      connectionId: string;
      query: string;
      includeSelection: boolean;
    }>) => {
      if (
        activeWork === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("running-vocabulary-suggestion");
      setAssistantContextActionError(null);
      try {
        let sourceRange: {
          documentId: EntityId<"Document">;
          documentRevisionId: EntityId<"DocumentRevision">;
          from: number;
          to: number;
        } | null = null;
        if (input.includeSelection) {
          if (activeDocument === undefined) {
            throw new Error("현재 원고를 확인하지 못했습니다.");
          }
          const summary = manuscriptEditorRef.current?.readDocumentState(
            activeDocument,
          );
          const selection = summary?.selection.ranges[summary.selection.mainIndex];
          if (selection === undefined || selection.empty) {
            throw new Error("함께 보낼 원고 범위를 정확히 선택하세요.");
          }
          await persistDocument(activeDocument);
          const documentRevisionId =
            durableSaveQueueRef.current?.getCurrentRevisionId(
              activeDocument.documentId,
            ) ?? activeDocument.documentRevisionId;
          if (documentRevisionId === null) {
            throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
          }
          sourceRange = {
            documentId: activeDocument.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          };
        }
        const result = await window.eumStudio.assistant.runVocabularySuggestion({
          schemaVersion: 1,
          requestId: entityId<"AssistantVocabularySuggestionRequest">(
            crypto.randomUUID(),
          ),
          workId: activeWork.workId,
          conversationId: assistantConversationId,
          connectionId: entityId<"AssistantConnection">(input.connectionId),
          query: input.query,
          sourceRange,
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "정확한 선택 범위를 함께 보내려면 해당 연결의 로컬 읽기·외부 전송 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "어휘·유의어 제안을 받지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      assistantContextActionState,
      assistantConversationId,
      persistDocument,
    ],
  );
  const runAssistantExternalSettingReview = useCallback(
    async (input: Readonly<{ connectionId: string; query: string }>) => {
      if (
        activeWork === undefined ||
        activeDocument === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("running-external-setting-review");
      setAssistantContextActionError(null);
      try {
        await persistDocument(activeDocument);
        const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
          activeDocument,
        ) ?? activeDocument.initialText;
        if (manuscript.length === 0) {
          throw new Error("외부 설정 검토에 보낼 현재 회차 원고가 비어 있습니다.");
        }
        const documentRevisionId =
          durableSaveQueueRef.current?.getCurrentRevisionId(
            activeDocument.documentId,
          ) ?? activeDocument.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        const result = await window.eumStudio.assistant.runExternalSettingReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantExternalSettingReviewRequest">(
            crypto.randomUUID(),
          ),
          workId: activeWork.workId,
          conversationId: assistantConversationId,
          connectionId: entityId<"AssistantConnection">(input.connectionId),
          query: input.query,
          sourceRange: {
            documentId: activeDocument.documentId,
            documentRevisionId,
            from: 0,
            to: manuscript.length,
          },
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "현재 회차와 작품 설정을 보내려면 해당 연결의 작품 로컬 읽기·외부 전송 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "현재 회차 범위가 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "외부 설정 검토 결과를 받지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      assistantContextActionState,
      assistantConversationId,
      persistDocument,
    ],
  );
  const runAssistantNotationReview = useCallback(
    async (destinationId: string) => {
      if (
        activeWork === undefined ||
        activeDocument === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (selection === undefined || selection.empty) {
        setAssistantContextActionError(
          "원고에서 점검할 범위를 정확히 선택하세요.",
        );
        return;
      }
      setAssistantContextActionState("running-notation-review");
      setAssistantContextActionError(null);
      try {
        await persistDocument(activeDocument);
        const documentRevisionId =
          durableSaveQueueRef.current?.getCurrentRevisionId(
            activeDocument.documentId,
          ) ?? activeDocument.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error("현재 원고의 저장 revision을 확인하지 못했습니다.");
        }
        const result = await window.eumStudio.assistant.runNotationReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantContextRequest">(crypto.randomUUID()),
          workId: activeWork.workId,
          conversationId: assistantConversationId,
          destinationId,
          sourceRange: {
            documentId: activeDocument.documentId,
            documentRevisionId,
            from: selection.from,
            to: selection.to,
          },
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "표기 점검에 필요한 정확한 선택 범위 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        if (result.status === "context-rejected") {
          setAssistantContextActionError(
            "선택 범위가 현재 저장된 원고 revision과 일치하지 않습니다.",
          );
          return;
        }
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "선택 범위의 표기를 점검하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      assistantContextActionState,
      assistantConversationId,
      persistDocument,
    ],
  );
  const runAssistantSettingReview = useCallback(
    async (destinationId: string) => {
      if (
        activeWork === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      setAssistantContextActionState("running-setting-review");
      setAssistantContextActionError(null);
      try {
        const result = await window.eumStudio.assistant.runSettingReview({
          schemaVersion: 1,
          requestId: entityId<"AssistantSettingReviewRequest">(
            crypto.randomUUID(),
          ),
          workId: activeWork.workId,
          conversationId: assistantConversationId,
          destinationId,
        });
        if (result.status === "permission-required") {
          setAssistantContextActionError(
            "설정 검토에 필요한 작품 전체 로컬 읽기 권한을 먼저 승인하세요.",
          );
          return;
        }
        const projection = await window.eumStudio.assistant.listContextState({
          schemaVersion: 1,
          workId: activeWork.workId,
          conversationId: assistantConversationId,
        });
        setAssistantContextProjection(projection);
      } catch (reason) {
        setAssistantContextActionError(
          reason instanceof Error
            ? reason.message
            : "작품 설정을 검토하지 못했습니다.",
        );
      } finally {
        setAssistantContextActionState("idle");
      }
    },
    [activeWork, assistantContextActionState, assistantConversationId],
  );
  const openAssistantSettingReference = useCallback(
    (reference: AssistantSettingReference) => {
      if (activeWork === undefined || assistantContextActionState !== "idle") {
        return;
      }
      if (reference.kind === "character") {
        const character = activeWorkCharacters.find(
          (candidate) => candidate.characterId === reference.entityId,
        );
        if (character === undefined || character.revision !== reference.revision) {
          setAssistantContextActionError(
            "검토 당시 인물 revision과 현재 인물이 다릅니다. 설정 검토를 다시 실행하세요.",
          );
          return;
        }
        assistantContextLoadSequenceRef.current += 1;
        setAssistantContextDialogOpen(false);
        setAssistantContextActionError(null);
        setSelectedCharacterId(character.characterId);
        setCharacterActionError(null);
        setCharacterDialogOpen(true);
        return;
      }
      if (reference.kind === "plot") {
        const plot = activeWorkPlots.find(
          (candidate) => candidate.plotThreadId === reference.entityId,
        );
        if (plot === undefined || plot.revision !== reference.revision) {
          setAssistantContextActionError(
            "검토 당시 플롯 revision과 현재 플롯이 다릅니다. 설정 검토를 다시 실행하세요.",
          );
          return;
        }
        assistantContextLoadSequenceRef.current += 1;
        setAssistantContextDialogOpen(false);
        setAssistantContextActionError(null);
        setSelectedPlotThreadId(plot.plotThreadId);
        setPlotActionError(null);
        setPlotDialogOpen(true);
        return;
      }
      const line = foreshadowLines.find(
        (candidate) =>
          candidate.workId === activeWork.workId &&
          candidate.lineId === reference.entityId,
      );
      if (line === undefined || line.revision !== reference.revision) {
        setAssistantContextActionError(
          "검토 당시 복선 revision과 현재 복선이 다릅니다. 설정 검토를 다시 실행하세요.",
        );
        return;
      }
      assistantContextLoadSequenceRef.current += 1;
      setAssistantContextDialogOpen(false);
      setAssistantContextActionError(null);
      setSelectedForeshadowLineId(line.lineId);
      setForeshadowLineActionError(null);
      setForeshadowLineDialogOpen(true);
    },
    [
      activeWork,
      activeWorkCharacters,
      activeWorkPlots,
      assistantContextActionState,
      foreshadowLines,
    ],
  );
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
        setEventSources([]);
        setEventRail(null);
        setSceneProjection(null);
        pendingEventRailRangeRef.current = null;
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void window.eumStudio.structure.listEventRail({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setEventRail(projection);
          setEventBlocks(projection.eventBlocks);
          setEventSources(projection.eventSources);
          setPlotEventLinks(projection.plotEventLinks);
          setPlotBoard(projection.board);
          setEventActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setEventRail(null);
          setEventBlocks([]);
          setEventSources([]);
          setEventActionError("작품 사건 순서를 불러오지 못했습니다.");
        }
      },
    );
    void window.eumStudio.structure.listSceneProjection({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setSceneProjection(projection);
          setSceneActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setSceneProjection(null);
          setSceneActionError("장면 목록을 불러오지 못했습니다.");
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
        setPlots([]);
        setPlotBoard(null);
        setPlotSources([]);
        setPlotEventLinks([]);
        setSelectedPlotThreadId(null);
        setPlotActionError(null);
        setPlotDialogOpen(false);
        pendingPlotThreadSourceRef.current = null;
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void Promise.all([
      window.eumStudio.plots.list({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.plots.getDefaultBoard({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.plots.listSources({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.plots.listEventLinks({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([plotProjection, boardProjection, sourceProjection, eventLinkProjection]) => {
        if (!disposed) {
          setPlots(plotProjection.plots);
          setPlotBoard(boardProjection);
          setPlotSources(sourceProjection.sources);
          setPlotEventLinks(eventLinkProjection.links);
          setSelectedPlotThreadId((current) =>
            current !== null && plotProjection.plots.some(
              (plot) => plot.plotThreadId === current,
            )
              ? current
              : (plotProjection.plots[0]?.plotThreadId ?? null)
          );
          setPlotActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setPlots([]);
          setPlotBoard(null);
          setPlotSources([]);
          setPlotEventLinks([]);
          setPlotActionError("플롯 목록을 불러오지 못했습니다.");
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
        setCharacters([]);
        setSelectedCharacterId(null);
        setCharacterActionError(null);
        setCharacterDialogOpen(false);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void window.eumStudio.characters.list({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setCharacters(projection.characters);
          setSelectedCharacterId((current) =>
            current !== null && projection.characters.some(
              (character) => character.characterId === current,
            )
              ? current
              : (projection.characters[0]?.characterId ?? null)
          );
          setCharacterActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setCharacters([]);
          setCharacterActionError("인물 목록을 불러오지 못했습니다.");
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
        setLoreEntries([]);
        setLoreCandidates([]);
        setLoreForeshadowLinks([]);
        setSelectedLoreEntryId(null);
        setLoreActionError(null);
        setLoreDialogOpen(false);
        setLoreCandidateActionError(null);
        setLoreCandidateDialogOpen(false);
        pendingLoreEvidenceRef.current = null;
        pendingLoreCandidateEvidenceRef.current = null;
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void Promise.all([
      window.eumStudio.loreEntries.list({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.loreCandidates.list({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.loreForeshadowLinks.list({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([projection, candidateProjection, linkProjection]) => {
        if (!disposed) {
          setLoreEntries(projection.entries);
          setLoreCandidates(candidateProjection.candidates);
          setLoreForeshadowLinks(linkProjection.links);
          setSelectedLoreEntryId((current) =>
            current !== null && projection.entries.some(
              (entry) => entry.loreEntryId === current,
            )
              ? current
              : (projection.entries[0]?.loreEntryId ?? null),
          );
          setLoreActionError(null);
          setLoreCandidateActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setLoreEntries([]);
          setLoreCandidates([]);
          setLoreForeshadowLinks([]);
          setLoreActionError("별빛과 검토 기록, 복선 연결 목록을 불러오지 못했습니다.");
          setLoreCandidateActionError("별빛 검토 기록을 불러오지 못했습니다.");
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
        setForeshadowLines([]);
        setForeshadowPoints([]);
        setSelectedForeshadowLineId(null);
        setForeshadowLineActionError(null);
        setForeshadowLineDialogOpen(false);
        pendingForeshadowPointSourceRef.current = null;
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void Promise.all([
      window.eumStudio.foreshadowing.listLines({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.foreshadowing.listPoints({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([lineProjection, pointProjection]) => {
        if (!disposed) {
          setForeshadowLines(lineProjection.lines);
          setForeshadowPoints(pointProjection.points);
          setSelectedForeshadowLineId((current) =>
            current !== null && lineProjection.lines.some(
              (line) => line.lineId === current,
            )
              ? current
              : null
          );
          setForeshadowLineActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setForeshadowLines([]);
          setForeshadowPoints([]);
          setForeshadowLineActionError(
            "복선 라인을 불러오지 못했습니다.",
          );
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
        setFragments([]);
        setFragmentActionError(null);
        setFragmentDialogOpen(false);
        pendingFragmentSourceRef.current = null;
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void window.eumStudio.fragments.list({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setFragments(projection.fragments);
          setFragmentActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setFragments([]);
          setFragmentActionError("파편 서랍을 불러오지 못했습니다.");
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
        setPomodoro(null);
        setDailyGoals(null);
        setShowDailyGoalDialog(false);
        setDailyGoalError(null);
        setActivityActionError(null);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void Promise.all([
      window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.activity.getPomodoro({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.activity.getRecordsGoals({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([activityProjection, pomodoroProjection, goalsProjection]) => {
        if (!disposed) {
          setWorkActivity(activityProjection);
          setPomodoro(pomodoroProjection);
          setDailyGoals(goalsProjection);
          setDailyGoalError(null);
          setActivityActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkActivity(null);
          setPomodoro(null);
          setDailyGoals(null);
          setActivityActionError("작업 기록과 집중 타이머를 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId]);

  useEffect(() => {
    if (
      activeWritingSession === undefined &&
      activeFocusCycle?.state !== "running" &&
      activePomodoroPhase?.state !== "running"
    ) {
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
  }, [activeFocusCycle, activePomodoroPhase, activeWritingSession]);

  useEffect(() => {
    if (
      pomodoro === null ||
      activePomodoroPhase?.state !== "running" ||
      activePomodoroPhase.deadlineAt === null ||
      remainingTimerMs(activePomodoroPhase.deadlineAt, activityClock) > 0 ||
      pomodoroReconcilePendingRef.current
    ) {
      return;
    }
    const workId = pomodoro.workId;
    const focusCycleId = activePomodoroPhase.focusCycleId;
    let disposed = false;
    pomodoroReconcilePendingRef.current = true;
    void (async () => {
      try {
        const nextPomodoro =
          await window.eumStudio.activity.reconcilePomodoro({
            schemaVersion: 1,
            workId,
            focusCycleId,
          });
        const nextActivity = await window.eumStudio.activity.listWork({
          schemaVersion: 1,
          workId,
        });
        if (!disposed) {
          setPomodoro(nextPomodoro);
          setWorkActivity(nextActivity);
          setActivityActionError(null);
        }
      } catch {
        if (!disposed) {
          setActivityActionError("집중 타이머의 다음 단계를 불러오지 못했습니다.");
        }
      } finally {
        pomodoroReconcilePendingRef.current = false;
      }
    })();
    return () => {
      disposed = true;
    };
  }, [activePomodoroPhase, activityClock, pomodoro]);

  const openManuscriptPreflight = useCallback(() => {
    if (runtime.status !== "ready" || activeDocument === undefined) {
      return;
    }
    const editor = manuscriptEditorRef.current;
    const summary = editor?.readDocumentState(activeDocument);
    const manuscript = editor?.materializeDocumentText(activeDocument);
    const selectedRange =
      summary?.selection.ranges[summary.selection.mainIndex];
    if (summary === null || summary === undefined || manuscript === undefined) {
      setPreflightActionError("현재 원고를 점검할 수 없습니다.");
      return;
    }
    const selection =
      selectedRange === undefined || selectedRange.empty
        ? null
        : Object.freeze({
            from: selectedRange.from,
            to: selectedRange.to,
          });
    const sequence = preflightLoadSequenceRef.current + 1;
    preflightLoadSequenceRef.current = sequence;
    setPreflightActionError(null);
    void window.eumStudio.editor
      .getManuscriptPreflightSettings({
        schemaVersion: 1,
        workId: activeDocument.workId,
      })
      .then(
        (settingsProjection) => {
          if (sequence !== preflightLoadSequenceRef.current) {
            return;
          }
          if (settingsProjection.workId !== activeDocument.workId) {
            throw new Error(
              "Preflight settings do not belong to the active Work",
            );
          }
          setPendingManuscriptPreflight({
            document: activeDocument,
            manuscript,
            selection,
            settingsProjection,
          });
        },
      )
      .catch(() => {
          if (sequence === preflightLoadSequenceRef.current) {
            setPreflightActionError("원고 점검 설정을 불러오지 못했습니다.");
          }
      });
  }, [activeDocument, runtime]);

  const closeManuscriptPreflight = useCallback(() => {
    preflightLoadSequenceRef.current += 1;
    setPendingManuscriptPreflight(null);
    setPreflightActionError(null);
  }, []);

  const saveManuscriptPreflightSettings = useCallback(
    async (settings: ManuscriptPreflightSettings) => {
      const pending = pendingManuscriptPreflight;
      if (pending === null) {
        throw new Error("No manuscript preflight is open");
      }
      const saved =
        await window.eumStudio.editor.saveManuscriptPreflightSettings({
          schemaVersion: 1,
          workId: pending.document.workId,
          settings,
        });
      if (saved.workId !== pending.document.workId) {
        throw new Error("Saved preflight settings belong to another Work");
      }
      setPendingManuscriptPreflight((current) =>
        current === null ||
        current.document.workId !== saved.workId
          ? current
          : { ...current, settingsProjection: saved },
      );
      return saved;
    },
    [pendingManuscriptPreflight],
  );

  const applyManuscriptPreflight = useCallback(
    (value: ManuscriptPreflightApplyInput): boolean => {
      const pending = pendingManuscriptPreflight;
      if (pending === null) {
        return false;
      }
      const applied =
        manuscriptEditorRef.current?.replaceDocumentRange(
          pending.document,
          value.range,
          value.expectedSource,
          value.result,
        ) ?? false;
      if (applied) {
        setPendingManuscriptPreflight(null);
        setPreflightActionError(null);
      }
      return applied;
    },
    [pendingManuscriptPreflight],
  );

  const exportManuscriptPreflight = useCallback(
    (text: string) => {
      const pending = pendingManuscriptPreflight;
      if (pending === null) {
        throw new Error("No manuscript preflight is open");
      }
      const fileNamePart = sanitizeManuscriptTextFileNamePart(
        pending.document.label,
      );
      return window.eumStudio.editor.exportManuscriptText({
        schemaVersion: 1,
        workId: pending.document.workId,
        documentId: pending.document.documentId,
        suggestedFileName: `${fileNamePart}.txt`,
        text,
      });
    },
    [pendingManuscriptPreflight],
  );

  const readCurrentEventSourceSelection = useCallback(() => {
    if (activeDocument === undefined) {
      return null;
    }
    const summary = manuscriptEditorRef.current?.readDocumentState(
      activeDocument,
    );
    const selection =
      summary?.selection.ranges[summary.selection.mainIndex];
    if (selection === undefined || selection.empty) {
      setEventActionError("원고에서 사건 범위를 먼저 선택하세요.");
      return null;
    }
    const manuscript =
      manuscriptEditorRef.current?.materializeDocumentText(activeDocument);
    if (manuscript === undefined) {
      setEventActionError("현재 원고 범위를 읽지 못했습니다.");
      return null;
    }
    const exactQuote = manuscript.slice(selection.from, selection.to);
    if (exactQuote.length === 0) {
      setEventActionError("빈 선택 범위는 사건으로 등록할 수 없습니다.");
      return null;
    }
    setEventActionError(null);
    return Object.freeze({
      workId: activeDocument.workId,
      documentId: activeDocument.documentId,
      selection: {
        anchor: selection.anchor,
        head: selection.head,
      },
      exactQuote,
    });
  }, [activeDocument]);

  const openEventBlockDialog = useCallback(() => {
    const selection = readCurrentEventSourceSelection();
    if (selection === null) {
      return;
    }
    setPendingEventDraft({
      kind: "selection",
      ...selection,
    });
  }, [readCurrentEventSourceSelection]);

  const openAnchorlessEventDialog = useCallback(() => {
    if (activeWork === undefined) {
      return;
    }
    setEventActionError(null);
    setPendingEventDraft({
      kind: "anchorless",
      workId: activeWork.workId,
    });
  }, [activeWork]);

  const refreshSceneProjection = useCallback(
    async (workId: CreateEventBlockCommand["workId"]) => {
      const projection = await window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId,
      });
      setSceneProjection(projection);
      return projection;
    },
    [],
  );

  const refreshEventProjection = useCallback(
    async (workId: CreateEventBlockCommand["workId"]) => {
      const [projection] = await Promise.all([
        window.eumStudio.structure.listEventRail({
          schemaVersion: 1,
          workId,
        }),
        refreshSceneProjection(workId),
      ]);
      setEventRail(projection);
      setEventBlocks(projection.eventBlocks);
      setEventSources(projection.eventSources);
      setPlotEventLinks(projection.plotEventLinks);
      setPlotBoard(projection.board);
      return projection;
    },
    [refreshSceneProjection],
  );
  const refreshEventRailAfterPlotChange = useCallback(
    async (workId: CreateEventBlockCommand["workId"]) => {
      try {
        await refreshEventProjection(workId);
        setEventActionError(null);
      } catch {
        setEventActionError("작품 사건 순서를 새로고침하지 못했습니다.");
      }
    },
    [refreshEventProjection],
  );

  const createEventBlock = useCallback(
    async (input: { readonly title: string; readonly note: string }) => {
      if (
        pendingEventDraft === null ||
        eventActionState !== "idle"
      ) {
        return;
      }
      setEventActionState("creating");
      setEventActionError(null);
      try {
        if (pendingEventDraft.kind === "selection") {
          if (
            activeDocument === undefined ||
            activeDocument.documentId !== pendingEventDraft.documentId
          ) {
            throw new Error("The selected manuscript is no longer active");
          }
          await persistDocument(activeDocument);
          await window.eumStudio.structure.createEventBlock({
            schemaVersion: 1,
            workId: pendingEventDraft.workId,
            documentId: pendingEventDraft.documentId,
            selection: pendingEventDraft.selection,
            exactQuote: pendingEventDraft.exactQuote,
            title: input.title,
            note: input.note,
          });
        } else {
          await window.eumStudio.structure.createAnchorlessEvent({
            schemaVersion: 1,
            workId: pendingEventDraft.workId,
            title: input.title,
            note: input.note,
          });
        }
        await refreshEventProjection(pendingEventDraft.workId);
        setPendingEventDraft(null);
      } catch {
        setEventActionError(
          pendingEventDraft.kind === "selection"
            ? "선택 범위를 사건으로 등록하지 못했습니다."
            : "예정 사건을 추가하지 못했습니다.",
        );
      } finally {
        setEventActionState("idle");
      }
    },
    [
      activeDocument,
      eventActionState,
      pendingEventDraft,
      persistDocument,
      refreshEventProjection,
    ],
  );

  const linkEventSource = useCallback(
    async (eventBlock: EventBlockProjection) => {
      if (eventActionState !== "idle" || activeDocument === undefined) {
        return;
      }
      const selection = readCurrentEventSourceSelection();
      if (selection === null) {
        return;
      }
      setEventActionState("linking");
      setEventActionError(null);
      try {
        await persistDocument(activeDocument);
        await window.eumStudio.structure.linkEventSource({
          schemaVersion: 1,
          workId: eventBlock.workId,
          eventBlockId: eventBlock.eventBlockId,
          role: "primary",
          documentId: selection.documentId,
          selection: selection.selection,
          exactQuote: selection.exactQuote,
        });
        await refreshEventProjection(eventBlock.workId);
      } catch {
        setEventActionError("현재 선택을 사건 근거로 연결하지 못했습니다.");
      } finally {
        setEventActionState("idle");
      }
    },
    [
      activeDocument,
      eventActionState,
      persistDocument,
      readCurrentEventSourceSelection,
      refreshEventProjection,
    ],
  );

  const replaceEventSource = useCallback(
    async (source: EventSourceProjection) => {
      if (eventActionState !== "idle" || activeDocument === undefined) {
        return;
      }
      const selection = readCurrentEventSourceSelection();
      if (selection === null) {
        return;
      }
      setEventActionState("replacing");
      setEventActionError(null);
      try {
        await persistDocument(activeDocument);
        await window.eumStudio.structure.replaceEventSource({
          schemaVersion: 1,
          workId: source.workId,
          eventSourceId: source.eventSourceId,
          expectedRevision: source.revision,
          documentId: selection.documentId,
          selection: selection.selection,
          exactQuote: selection.exactQuote,
        });
        await refreshEventProjection(source.workId);
      } catch {
        setEventActionError("현재 선택으로 사건 근거를 교체하지 못했습니다.");
      } finally {
        setEventActionState("idle");
      }
    },
    [
      activeDocument,
      eventActionState,
      persistDocument,
      readCurrentEventSourceSelection,
      refreshEventProjection,
    ],
  );

  const retireEventSource = useCallback(
    async (source: EventSourceProjection) => {
      if (eventActionState !== "idle") {
        return;
      }
      setEventActionState("retiring");
      setEventActionError(null);
      try {
        await window.eumStudio.structure.retireEventSource({
          schemaVersion: 1,
          workId: source.workId,
          eventSourceId: source.eventSourceId,
          expectedRevision: source.revision,
        });
        await refreshEventProjection(source.workId);
      } catch {
        setEventActionError("사건의 원고 근거를 해제하지 못했습니다.");
      } finally {
        setEventActionState("idle");
      }
    },
    [eventActionState, refreshEventProjection],
  );

  const createSceneBoundary = useCallback(async (
    operation: "add" | "split" = "add",
  ) => {
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
        operation,
        note: "",
      });
      await refreshSceneProjection(activeDocument.workId);
    } catch {
      setSceneActionError(
        operation === "split"
          ? "현재 위치에서 장면을 분할하지 못했습니다."
          : "현재 위치에 장면 경계를 저장하지 못했습니다.",
      );
    } finally {
      setSceneActionState("idle");
    }
  }, [
    activeDocument,
    persistDocument,
    refreshSceneProjection,
    sceneActionState,
  ]);

  const focusScene = useCallback(
    (scene: SceneProjection) => {
      if (
        activeDocument === undefined ||
        scene.documentId !== activeDocument.documentId ||
        scene.integrity !== "resolved" ||
        scene.range === null
      ) {
        setSceneActionError("이 장면은 현재 원고에서 바로 열 수 없습니다.");
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        activeDocument,
        { from: scene.range.start, to: scene.range.end },
      );
      if (!selected) {
        setSceneActionError("장면의 정확한 범위로 이동하지 못했습니다.");
        return;
      }
      setSceneActionError(null);
    },
    [activeDocument],
  );

  const mergeSceneWithPrevious = useCallback(async (
    scene: SceneProjection,
    previousScene: SceneProjection,
  ) => {
    if (
      activeDocument === undefined ||
      sceneActionState !== "idle" ||
      scene.documentId !== activeDocument.documentId ||
      previousScene.documentId !== activeDocument.documentId ||
      scene.range === null ||
      previousScene.range === null
    ) {
      return;
    }
    const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
      activeDocument,
    );
    if (manuscript === undefined) {
      setSceneActionError("현재 원고의 장면 경계를 읽지 못했습니다.");
      return;
    }
    const from = previousScene.range.end;
    const to = scene.range.start;
    setSceneActionState("creating");
    setSceneActionError(null);
    try {
      await persistDocument(activeDocument);
      await window.eumStudio.structure.createSceneOverride({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        selection: { anchor: from, head: to },
        exactQuote: manuscript.slice(from, to),
        operation: "merge",
        note: "",
      });
      await refreshSceneProjection(activeDocument.workId);
    } catch {
      setSceneActionError("앞 장면과 병합하지 못했습니다.");
    } finally {
      setSceneActionState("idle");
    }
  }, [
    activeDocument,
    persistDocument,
    refreshSceneProjection,
    sceneActionState,
  ]);

  const updateSceneRuleSet = useCallback(async (
    draft: Pick<
      UpdateSceneRuleSetCommand,
      "displayName" | "boundaryRules" | "normalizationPolicy" | "enabled"
    >,
  ) => {
    if (
      sceneProjection === null ||
      sceneActionState !== "idle"
    ) {
      return;
    }
    setSceneActionState("updating-rule");
    setSceneActionError(null);
    try {
      const projection = await window.eumStudio.structure.updateSceneRuleSet({
        schemaVersion: 1,
        workId: sceneProjection.workId,
        sceneRuleSetId: sceneProjection.ruleSet.sceneRuleSetId,
        expectedRevision: sceneProjection.ruleSet.revision,
        ...draft,
      });
      setSceneProjection(projection);
    } catch {
      setSceneActionError("장면 규칙을 저장하지 못했습니다.");
    } finally {
      setSceneActionState("idle");
    }
  }, [sceneActionState, sceneProjection]);

  const setSceneEventOverride = useCallback(async (
    scene: SceneProjection,
    eventBlockId: EntityId<"EventBlock">,
    operation: SceneEventOverrideOperation | null,
    expectedRevision: number | null,
  ) => {
    if (
      sceneProjection === null ||
      sceneActionState !== "idle" ||
      scene.workId !== sceneProjection.workId
    ) {
      return;
    }
    setSceneActionState("updating-event");
    setSceneActionError(null);
    try {
      const projection = await window.eumStudio.structure.setSceneEventOverride({
        schemaVersion: 1,
        workId: scene.workId,
        sceneKey: scene.sceneKey,
        eventBlockId,
        operation,
        expectedRevision,
      });
      setSceneProjection(projection);
    } catch {
      setSceneActionError("장면의 사건 소속을 변경하지 못했습니다.");
    } finally {
      setSceneActionState("idle");
    }
  }, [sceneActionState, sceneProjection]);
  const startWritingSession = useCallback(
    async (
      document: ManuscriptDocumentSource | undefined = activeDocument,
    ): Promise<WorkActivityProjection | null> => {
      if (document === undefined || activityActionState !== "idle") {
        return null;
      }
      setActivityActionState("starting-session");
      setActivityActionError(null);
      try {
        await persistDocument(document);
        const projection = await window.eumStudio.activity.startSession({
          schemaVersion: 1,
          workId: document.workId,
          documentId: document.documentId,
          note: "",
        });
        activeWritingSessionRef.current = projection.sessions.find(
          (session) => session.sessionId === projection.activeSessionId,
        );
        setWorkActivity(projection);
        return projection;
      } catch {
        setActivityActionError("작업 기록을 시작하지 못했습니다.");
        return null;
      } finally {
        setActivityActionState("idle");
      }
    },
    [activeDocument, activityActionState, persistDocument],
  );

  const stopWritingSession = useCallback(
    async (
      session: WritingSessionProjection | undefined = activeWritingSession,
      document: ManuscriptDocumentSource | undefined = activeDocument,
    ): Promise<WorkActivityProjection | null> => {
      if (
        document === undefined ||
        session === undefined ||
        activityActionState !== "idle"
      ) {
        return null;
      }
      setActivityActionState("stopping-session");
      setActivityActionError(null);
      try {
        await persistDocument(document);
        const projection = await window.eumStudio.activity.stopSession({
          schemaVersion: 1,
          workId: document.workId,
          sessionId: session.sessionId,
        });
        activeWritingSessionRef.current = projection.sessions.find(
          (entry) => entry.sessionId === projection.activeSessionId,
        );
        setWorkActivity(projection);
        return projection;
      } catch {
        setActivityActionError("작업 기록을 종료하지 못했습니다.");
        return null;
      } finally {
        setActivityActionState("idle");
      }
    },
    [
      activeDocument,
      activeWritingSession,
      activityActionState,
      persistDocument,
    ],
  );

  const handleManuscriptTransaction = useCallback(
    (
      document: ManuscriptDocumentSource,
      transaction: ManuscriptTransaction,
      statistics: ManuscriptTextStatistics,
      composing: boolean,
      editorStateJson: string,
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
      if (transaction.changes.length === 0) {
        return;
      }
      setHoveredLoreCue(null);
      setPinnedLoreCue(null);
      setLoreCueActionError(null);
      const pending = durableSaveQueueRef.current?.record(
        document.documentId,
        transaction,
        { composing, editorStateJson },
      );
      void pending?.catch(() => undefined);

      const documentKey = `${document.workId}:${document.documentId}`;
      editingDocumentKeyRef.current = documentKey;
      const currentWritingSession = activeWritingSessionRef.current;
      if (
        currentWritingSession?.documentId === document.documentId ||
        writingSessionTransitionPendingRef.current
      ) {
        return;
      }
      writingSessionTransitionPendingRef.current = true;
      void (async () => {
        if (currentWritingSession !== undefined) {
          await stopWritingSession(currentWritingSession, document);
        }
        if (editingDocumentKeyRef.current !== documentKey) {
          return;
        }
        const projection = await startWritingSession(document);
        if (
          projection === null ||
          editingDocumentKeyRef.current === documentKey ||
          projection.activeSessionId === null
        ) {
          return;
        }
        const startedSession = projection.sessions.find(
          (session) => session.sessionId === projection.activeSessionId,
        );
        await stopWritingSession(startedSession, document);
      })().finally(() => {
        writingSessionTransitionPendingRef.current = false;
      });
    },
    [
      startWritingSession,
      stopWritingSession,
      telemetryStore,
    ],
  );

  const handleEditorBlur = useCallback(
    (document: ManuscriptDocumentSource) => {
      const documentKey = `${document.workId}:${document.documentId}`;
      if (editingDocumentKeyRef.current === documentKey) {
        editingDocumentKeyRef.current = null;
      }
      const currentWritingSession = activeWritingSessionRef.current;
      if (
        currentWritingSession?.documentId === document.documentId &&
        !writingSessionTransitionPendingRef.current
      ) {
        void stopWritingSession(currentWritingSession, document);
        return;
      }
      if (!writingSessionTransitionPendingRef.current) {
        void persistDocument(document).catch(() => undefined);
      }
    },
    [persistDocument, stopWritingSession],
  );

  const configureAndStartPomodoro = useCallback(
    async (input: PomodoroDialogSubmitValue) => {
      if (activeDocument === undefined || activityActionState !== "idle") {
        return;
      }
      setActivityActionState("starting-focus");
      setActivityActionError(null);
      try {
        await persistDocument(activeDocument);
        const nextPomodoro =
          await window.eumStudio.activity.configureAndStartPomodoro({
            schemaVersion: 1,
            workId: activeDocument.workId,
            documentId: activeDocument.documentId,
            ...input,
          });
        setPomodoro(nextPomodoro);
        setShowFocusDialog(false);
        const nextActivity = await window.eumStudio.activity.listWork({
          schemaVersion: 1,
          workId: activeDocument.workId,
        });
        setWorkActivity(nextActivity);
      } catch {
        setActivityActionError("집중 타이머를 시작하지 못했습니다.");
      } finally {
        setActivityActionState("idle");
      }
    },
    [activeDocument, activityActionState, persistDocument],
  );

  const pausePomodoro = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activePomodoroPhase?.state !== "running" ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("pausing-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await window.eumStudio.activity.pausePomodoro({
        schemaVersion: 1,
        workId: activeDocument.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      const nextActivity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: activeDocument.workId,
      });
      setWorkActivity(nextActivity);
    } catch {
      setActivityActionError("집중 타이머를 일시정지하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activePomodoroPhase,
    activityActionState,
  ]);

  const resumePomodoro = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activePomodoroPhase?.state !== "paused" ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("resuming-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await window.eumStudio.activity.resumePomodoro({
        schemaVersion: 1,
        workId: activeDocument.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      const nextActivity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: activeDocument.workId,
      });
      setWorkActivity(nextActivity);
    } catch {
      setActivityActionError("집중 타이머를 재개하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activePomodoroPhase,
    activityActionState,
  ]);

  const stopPomodoro = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activePomodoroPhase === null ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("stopping-focus");
    setActivityActionError(null);
    try {
      const nextPomodoro = await window.eumStudio.activity.stopPomodoro({
        schemaVersion: 1,
        workId: activeDocument.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
      });
      setPomodoro(nextPomodoro);
      const nextActivity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: activeDocument.workId,
      });
      setWorkActivity(nextActivity);
    } catch {
      setActivityActionError("집중 타이머를 종료하지 못했습니다.");
    } finally {
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activePomodoroPhase,
    activityActionState,
  ]);

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
  const compareWorkSnapshot = useCallback(
    async (workSnapshotId: WorkSnapshotProjection["workSnapshotId"]) => {
      if (activeDocument === undefined || versionActionState !== "idle") {
        return;
      }
      const sequence = versionLoadSequenceRef.current + 1;
      versionLoadSequenceRef.current = sequence;
      setVersionActionState("comparing-snapshot");
      setVersionActionError(null);
      setWorkSnapshotComparison(null);
      try {
        await persistDocument(activeDocument);
        const projection = await window.eumStudio.version.compareWorkSnapshot({
          schemaVersion: 1,
          workId: activeDocument.workId,
          workSnapshotId,
        });
        if (versionLoadSequenceRef.current !== sequence) return;
        setWorkSnapshotComparison(projection);
      } catch {
        if (versionLoadSequenceRef.current === sequence) {
          setVersionActionError("작품 스냅샷을 비교하지 못했습니다.");
        }
      } finally {
        setVersionActionState((current) =>
          current === "comparing-snapshot" ? "idle" : current,
        );
      }
    },
    [activeDocument, persistDocument, versionActionState],
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
      if (
        currentDocument !== undefined &&
        command.workId === currentDocument.workId &&
        command.documentId === currentDocument.documentId
      ) {
        onCatalogChange?.(runtime.catalog);
        return runtime.catalog;
      }
      setWorkspaceActionState("switching");
      setWorkspaceActionError(null);
      try {
        if (
          currentDocument !== undefined &&
          (command.workId !== currentDocument.workId ||
            command.documentId !== currentDocument.documentId)
        ) {
          await persistDocument(currentDocument);
        }
        const catalog =
          await window.eumStudio.workspace.activateLocation(command);
        const selectedWork = catalog.works.find(
          (work) => work.workId === catalog.activeWorkId,
        );
        if (selectedWork === undefined) {
          throw new Error(
            "The activated Work is missing from the catalog",
          );
        }
        const selectedDocument =
          catalog.activeDocumentId === null
            ? undefined
            : runtime.documentProfile.documents.find(
                (document) =>
                  document.workId === catalog.activeWorkId &&
                  document.documentId === catalog.activeDocumentId,
              );
        if (
          (catalog.activeDocumentId === null &&
            selectedWork.documents.length !== 0) ||
          (catalog.activeDocumentId !== null &&
            selectedDocument === undefined)
        ) {
          throw new Error(
            "The activated Work does not own the selected Document",
          );
        }
        if (
          (currentDocument?.workId ?? runtime.catalog.activeWorkId) !==
          selectedWork.workId
        ) {
          setManuscriptSearchQuery("");
          manuscriptSearchRef.current = null;
          setManuscriptSearch(null);
        }
        setRuntime((current) =>
          current.status === "ready"
            ? {
                ...current,
                catalog,
                activeDocumentId: selectedDocument?.documentId ?? null,
              }
            : current,
        );
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
  const handleLoreCueHover = useCallback(
    (interaction: LoreCueInteraction | null) => {
      if (
        interaction !== null &&
        (activeDocument === undefined ||
          interaction.cue.workId !== activeDocument.workId ||
          interaction.cue.documentId !== activeDocument.documentId)
      ) {
        return;
      }
      setHoveredLoreCue(interaction);
    },
    [activeDocument],
  );
  const openLoreCueInspector = useCallback(
    (cue: LoreCue) => {
      if (
        activeDocument === undefined ||
        cue.workId !== activeDocument.workId ||
        cue.documentId !== activeDocument.documentId
      ) {
        return;
      }
      setHoveredLoreCue(null);
      setPinnedLoreCue(cue);
      setLoreCueActionError(null);
      setRailState((current) =>
        openWorkspaceRail(current, cue.workId, "right"),
      );
    },
    [activeDocument],
  );
  const selectLoreCueOccurrence = useCallback(
    (occurrence: LoreCue["occurrences"][number]) => {
      if (
        activeDocument === undefined ||
        pinnedLoreCue === null ||
        pinnedLoreCue.workId !== activeDocument.workId ||
        pinnedLoreCue.documentId !== activeDocument.documentId
      ) {
        setLoreCueActionError("현재 원고에서 별빛 위치를 열 수 없습니다.");
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        activeDocument,
        { from: occurrence.from, to: occurrence.to },
      );
      if (!selected) {
        setLoreCueActionError("별빛의 정확한 원고 범위를 선택하지 못했습니다.");
        return;
      }
      setLoreCueActionError(null);
      void captureResumeForDocument(activeDocument).catch(() => undefined);
    },
    [activeDocument, captureResumeForDocument, pinnedLoreCue],
  );

  const openAssistantVocabularyOccurrence = useCallback(
    async (occurrence: AssistantVocabularyOccurrence) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        assistantContextActionState !== "idle"
      ) {
        return;
      }
      const targetDocument = activeWorkDocuments.find(
        (document) => document.documentId === occurrence.documentId,
      );
      if (targetDocument === undefined) {
        setAssistantContextActionError(
          "저장된 어휘 위치의 원본 회차를 찾지 못했습니다.",
        );
        return;
      }
      const currentRevisionId =
        durableSaveQueueRef.current?.getCurrentRevisionId(
          targetDocument.documentId,
        ) ?? targetDocument.documentRevisionId;
      if (currentRevisionId !== occurrence.documentRevisionId) {
        setAssistantContextActionError(
          "저장된 어휘 위치의 원고 revision이 변경되었습니다.",
        );
        return;
      }
      const range = { from: occurrence.from, to: occurrence.to };
      setAssistantContextActionError(null);
      if (activeDocument?.documentId === targetDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          targetDocument,
          range,
        );
        if (!selected) {
          setAssistantContextActionError(
            "저장된 어휘의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setAssistantContextDialogOpen(false);
        void captureResumeForDocument(targetDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = activeWorkDocuments.map(
        (document) => document.documentId,
      );
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? targetDocument.documentId;
      pendingAssistantVocabularyOccurrenceRef.current = {
        workId: targetDocument.workId,
        documentId: targetDocument.documentId,
        documentRevisionId: occurrence.documentRevisionId,
        range,
      };
      setAssistantContextDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: targetDocument.workId,
          documentId: targetDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: targetDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: targetDocument.documentId,
          }),
        );
      } catch {
        pendingAssistantVocabularyOccurrenceRef.current = null;
        setAssistantContextActionError(
          "저장된 어휘 위치의 원본 회차를 열지 못했습니다.",
        );
        setAssistantContextDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activeWorkDocuments,
      activateWorkspaceLocation,
      assistantContextActionState,
      captureResumeForDocument,
      runtime,
    ],
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
      const orderedDocumentIds = documentProfile.documents
        .filter(
          (document) => document.workId === createdDocument.workId,
        )
        .map((document) => document.documentId);
      const previousActiveDocument =
        runtime.documentProfile.documents.find(
          (document) =>
            document.documentId === runtime.activeDocumentId &&
            document.workId === createdDocument.workId,
        );
      setDocumentTabSession((current) =>
        openDocumentTab({
          session: current,
          workId: createdDocument.workId,
          orderedDocumentIds,
          activeDocumentId:
            previousActiveDocument?.documentId ??
            createdDocument.documentId,
          documentId: createdDocument.documentId,
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
      if (runtime.status !== "ready" || activeWork === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      setWorkspaceActionState("creating-document");
      setWorkspaceActionError(null);
      try {
        if (activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const created = await window.eumStudio.workspace.createDocument({
          schemaVersion: 1,
          workId: activeWork.workId,
          title,
        });
        const catalog = await window.eumStudio.workspace.getCatalog();
        if (activeDocument === undefined) {
          const projection = await queryRuntimeProjection();
          installRuntimeProjection(projection, created.documentId);
          onCatalogChange?.(projection.catalog);
        } else {
          await installCreatedDocument(created.documentId, catalog);
        }
        await refreshSceneProjection(activeWork.workId);
        setNewDocumentTitle("");
        setShowCreateDocument(false);
      } catch (error) {
        setWorkspaceActionError("새 회차를 만들지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      installCreatedDocument,
      installRuntimeProjection,
      onCatalogChange,
      persistDocument,
      refreshSceneProjection,
      runtime,
    ],
  );

  const installRenamedCatalog = useCallback(
    (catalog: WorkspaceCatalogProjection) => {
      const documentTitles = new Map(
        catalog.works.flatMap((work) =>
          work.documents.map((document) => [
            `${work.workId}:${document.documentId}`,
            document.title,
          ] as const),
        ),
      );
      setRuntime((current) => {
        if (current.status !== "ready") {
          return current;
        }
        return {
          ...current,
          catalog,
          documentProfile: parseManuscriptDocumentProfile({
            ...current.documentProfile,
            documents: current.documentProfile.documents.map((document) => ({
              ...document,
              label:
                documentTitles.get(
                  `${document.workId}:${document.documentId}`,
                ) ?? document.label,
            })),
          }),
        };
      });
      onCatalogChange?.(catalog);
    },
    [onCatalogChange],
  );

  const installReorderedCatalog = useCallback(
    (catalog: WorkspaceCatalogProjection) => {
      const orderedDocumentKeys = catalog.works.flatMap((work) =>
        work.documents.map(
          (document) => `${work.workId}:${document.documentId}`,
        ),
      );
      const orderByDocument = new Map(
        orderedDocumentKeys.map((key, index) => [key, index] as const),
      );
      setRuntime((current) => {
        if (current.status !== "ready") {
          return current;
        }
        return {
          ...current,
          catalog,
          documentProfile: parseManuscriptDocumentProfile({
            ...current.documentProfile,
            documents: [...current.documentProfile.documents].sort(
              (left, right) =>
                (orderByDocument.get(
                  `${left.workId}:${left.documentId}`,
                ) ?? Number.MAX_SAFE_INTEGER) -
                (orderByDocument.get(
                  `${right.workId}:${right.documentId}`,
                ) ?? Number.MAX_SAFE_INTEGER),
            ),
          }),
        };
      });
      onCatalogChange?.(catalog);
    },
    [onCatalogChange],
  );

  const renameWork = useCallback(
    async (
      workId: WorkspaceWorkSummary["workId"],
      title: string,
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === runtime.activeDocumentId,
      );
      if (currentDocument !== undefined) {
        await persistDocument(currentDocument);
      }
      const catalog = await window.eumStudio.workspace.renameWork({
        schemaVersion: 1,
        workId,
        title,
      });
      installRenamedCatalog(catalog);
      return catalog;
    },
    [installRenamedCatalog, persistDocument, runtime],
  );

  const renameActiveWork = useCallback(async (): Promise<void> => {
    if (
      runtime.status !== "ready" ||
      activeWork === undefined
    ) {
      throw new Error("The manuscript workspace is not ready");
    }
    setWorkspaceActionState("renaming-work");
    setWorkspaceActionError(null);
    try {
      await renameWork(activeWork.workId, titleEditValue);
      setTitleEditTarget(null);
      setTitleEditValue("");
    } catch (error) {
      setWorkspaceActionError("작품 이름을 변경하지 못했습니다.");
      throw error;
    } finally {
      setWorkspaceActionState("idle");
    }
  }, [
    activeWork,
    renameWork,
    runtime.status,
    titleEditValue,
  ]);

  const renameActiveDocument = useCallback(async (): Promise<void> => {
    if (runtime.status !== "ready" || activeDocument === undefined) {
      throw new Error("The manuscript workspace is not ready");
    }
    setWorkspaceActionState("renaming-document");
    setWorkspaceActionError(null);
    try {
      await persistDocument(activeDocument);
      const catalog = await window.eumStudio.workspace.renameDocument({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        title: titleEditValue,
      });
      installRenamedCatalog(catalog);
      setTitleEditTarget(null);
      setTitleEditValue("");
    } catch (error) {
      setWorkspaceActionError("회차 이름을 변경하지 못했습니다.");
      throw error;
    } finally {
      setWorkspaceActionState("idle");
    }
  }, [
    activeDocument,
    installRenamedCatalog,
    persistDocument,
    runtime.status,
    titleEditValue,
  ]);

  const retireWork = useCallback(
    async (
      workId: WorkspaceWorkSummary["workId"],
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === runtime.activeDocumentId,
      );
      setWorkspaceActionState("retiring-work");
      setWorkspaceActionError(null);
      try {
        if (currentDocument !== undefined) {
          await persistDocument(currentDocument);
        }
        const catalog = await window.eumStudio.workspace.retireWork({
          schemaVersion: 1,
          workId,
        });
        if (!catalog.canCreateFirstWork) {
          const projection = await queryRuntimeProjection();
          installRuntimeProjection(
            projection,
            catalog.activeDocumentId,
          );
        }
        setManuscriptSearchQuery("");
        manuscriptSearchRef.current = null;
        setManuscriptSearch(null);
        onCatalogChange?.(catalog);
        return catalog;
      } catch (error) {
        setWorkspaceActionError("작품을 삭제하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [installRuntimeProjection, onCatalogChange, persistDocument, runtime],
  );

  const retireDocument = useCallback(
    async (
      workId: WorkspaceWorkSummary["workId"],
      documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === runtime.activeDocumentId,
      );
      setWorkspaceActionState("retiring-document");
      setWorkspaceActionError(null);
      try {
        if (currentDocument !== undefined) {
          await persistDocument(currentDocument);
        }
        const catalog = await window.eumStudio.workspace.retireDocument({
          schemaVersion: 1,
          workId,
          documentId,
        });
        const projection = await queryRuntimeProjection();
        installRuntimeProjection(projection, catalog.activeDocumentId);
        setManuscriptSearchQuery("");
        manuscriptSearchRef.current = null;
        setManuscriptSearch(null);
        onCatalogChange?.(catalog);
        return catalog;
      } catch (error) {
        setWorkspaceActionError("회차를 삭제하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [installRuntimeProjection, onCatalogChange, persistDocument, runtime],
  );

  const moveDocument = useCallback(
    async (
      workId: WorkspaceWorkSummary["workId"],
      documentId: WorkspaceWorkSummary["documents"][number]["documentId"],
      direction: MoveDocumentCommand["direction"],
    ): Promise<WorkspaceCatalogProjection> => {
      if (runtime.status !== "ready") {
        throw new Error("The manuscript workspace is not ready");
      }
      const currentDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === runtime.activeDocumentId,
      );
      setWorkspaceActionState("moving-document");
      setWorkspaceActionError(null);
      try {
        if (currentDocument !== undefined) {
          await persistDocument(currentDocument);
        }
        const catalog = await window.eumStudio.workspace.moveDocument({
          schemaVersion: 1,
          workId,
          documentId,
          direction,
        });
        installReorderedCatalog(catalog);
        return catalog;
      } catch (error) {
        setWorkspaceActionError("회차 순서를 변경하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [installReorderedCatalog, persistDocument, runtime],
  );

  const createDocumentFolder = useCallback(
    async (
      title: string,
      parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
    ): Promise<void> => {
      if (runtime.status !== "ready" || activeWork === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      setWorkspaceActionState("managing-document-folders");
      setWorkspaceActionError(null);
      try {
        if (activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const catalog = await window.eumStudio.workspace.createDocumentFolder({
          schemaVersion: 1,
          workId: activeWork.workId,
          title,
          parentFolderId,
        });
        installReorderedCatalog(catalog);
      } catch (error) {
        setWorkspaceActionError("폴더를 만들지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [activeDocument, activeWork, installReorderedCatalog, persistDocument, runtime],
  );

  const renameDocumentFolder = useCallback(
    async (
      folderId: WorkspaceDocumentFolderSummary["folderId"],
      title: string,
    ): Promise<void> => {
      if (runtime.status !== "ready" || activeWork === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      setWorkspaceActionState("managing-document-folders");
      setWorkspaceActionError(null);
      try {
        if (activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const catalog = await window.eumStudio.workspace.renameDocumentFolder({
          schemaVersion: 1,
          workId: activeWork.workId,
          folderId,
          title,
        });
        installReorderedCatalog(catalog);
      } catch (error) {
        setWorkspaceActionError("폴더 이름을 변경하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [activeDocument, activeWork, installReorderedCatalog, persistDocument, runtime],
  );

  const placeDocumentInFolder = useCallback(
    async (
      documentId: WorkspaceDocumentSummary["documentId"],
      folderId: WorkspaceDocumentFolderSummary["folderId"] | null,
    ): Promise<void> => {
      if (runtime.status !== "ready" || activeWork === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      setWorkspaceActionState("managing-document-folders");
      setWorkspaceActionError(null);
      try {
        if (activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const catalog = await window.eumStudio.workspace.placeDocumentInFolder({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId,
          folderId,
        });
        installReorderedCatalog(catalog);
      } catch (error) {
        setWorkspaceActionError("회차의 폴더 위치를 변경하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [activeDocument, activeWork, installReorderedCatalog, persistDocument, runtime],
  );

  const retireDocumentFolder = useCallback(
    async (folder: WorkspaceDocumentFolderSummary): Promise<void> => {
      if (runtime.status !== "ready" || activeWork === undefined) {
        throw new Error("The manuscript workspace is not ready");
      }
      if (
        !window.confirm(
          `‘${folder.title}’ 폴더를 삭제할까요?\n하위 폴더와 회차는 한 단계 위로 이동하고 원고는 보존됩니다.`,
        )
      ) {
        return;
      }
      setWorkspaceActionState("managing-document-folders");
      setWorkspaceActionError(null);
      try {
        if (activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const catalog = await window.eumStudio.workspace.retireDocumentFolder({
          schemaVersion: 1,
          workId: activeWork.workId,
          folderId: folder.folderId,
        });
        installReorderedCatalog(catalog);
      } catch (error) {
        setWorkspaceActionError("폴더를 삭제하지 못했습니다.");
        throw error;
      } finally {
        setWorkspaceActionState("idle");
      }
    },
    [activeDocument, activeWork, installReorderedCatalog, persistDocument, runtime],
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
      moveDocument,
      renameWork,
      retireDocument,
      retireWork,
      prepareForMain,
    }),
    [
      activateWorkspaceLocation,
      createWork,
      moveDocument,
      prepareForMain,
      renameWork,
      retireDocument,
      retireWork,
    ],
  );

  const activateDocumentById = useCallback(
    (documentId: string) => {
      if (runtime.status !== "ready") {
        return;
      }
      const selectedDocument = runtime.documentProfile.documents.find(
        (document) => document.documentId === documentId,
      );
      if (
        selectedDocument === undefined ||
        runtime.catalog.activeWorkId === null ||
        selectedDocument.workId !== runtime.catalog.activeWorkId
      ) {
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter(
          (document) => document.workId === selectedDocument.workId,
        )
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? selectedDocument.documentId;
      void activateWorkspaceLocation({
        schemaVersion: 1,
        workId: selectedDocument.workId,
        documentId: selectedDocument.documentId,
      })
        .then(() => {
          setDocumentTabSession((current) =>
            openDocumentTab({
              session: current,
              workId: selectedDocument.workId,
              orderedDocumentIds,
              activeDocumentId: currentActiveDocumentId,
              documentId: selectedDocument.documentId,
            }),
          );
        })
        .catch(() => undefined);
    },
    [activateWorkspaceLocation, runtime],
  );
  const captureFragment = useCallback(
    async (kindId: string) => {
      if (
        activeDocument === undefined ||
        fragmentActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (selection === undefined || selection.empty) {
        setFragmentActionError("복사할 원고 범위를 먼저 선택하세요.");
        return;
      }
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (manuscript === undefined) {
        setFragmentActionError("현재 원고를 읽지 못했습니다.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setFragmentActionError("복사할 원고 범위를 먼저 선택하세요.");
        return;
      }
      setFragmentActionState("capturing");
      setFragmentActionError(null);
      try {
        await persistDocument(activeDocument);
        const created = await window.eumStudio.fragments.capture({
          schemaVersion: 1,
          workId: activeDocument.workId,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
          kindId,
          title: "",
        });
        setFragments((current) =>
          Object.freeze([
            created,
            ...current.filter(
              (fragment) => fragment.fragmentId !== created.fragmentId,
            ),
          ]),
        );
      } catch {
        setFragmentActionError(
          "선택 범위를 파편으로 복사하지 못했습니다. 현재 원고에서 다시 선택하세요.",
        );
      } finally {
        setFragmentActionState("idle");
      }
    },
    [activeDocument, fragmentActionState, persistDocument],
  );
  const moveSelectionToFragment = useCallback(
    async (kindId: string) => {
      if (
        activeDocument === undefined ||
        fragmentActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (
        selection === undefined ||
        selection.empty ||
        manuscript === undefined
      ) {
        setFragmentActionError("이동할 원고 범위를 먼저 선택하세요.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setFragmentActionError("이동할 원고 범위를 먼저 선택하세요.");
        return;
      }
      let captured: FragmentProjection | null = null;
      setFragmentActionState("moving");
      setFragmentActionError(null);
      try {
        await persistDocument(activeDocument);
        captured = await window.eumStudio.fragments.capture({
          schemaVersion: 1,
          workId: activeDocument.workId,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
          kindId,
          title: "",
        });
        const deleted =
          manuscriptEditorRef.current?.deleteExactDocumentRange(
            activeDocument,
            { from: selection.from, to: selection.to },
            exactText,
          ) ?? false;
        if (!deleted) {
          setFragments((current) =>
            Object.freeze([
              captured as FragmentProjection,
              ...current.filter(
                (fragment) => fragment.fragmentId !== captured?.fragmentId,
              ),
            ]),
          );
          setFragmentActionError(
            "원고가 달라져 이동을 완료하지 못했습니다. 안전하게 복사된 파편은 서랍에 남겼습니다.",
          );
          return;
        }
        await persistDocument(activeDocument);
        const projection = await window.eumStudio.fragments.list({
          schemaVersion: 1,
          workId: activeDocument.workId,
        });
        setFragments(projection.fragments);
        setFragmentActionError(null);
      } catch {
        if (captured !== null) {
          setFragments((current) =>
            Object.freeze([
              captured as FragmentProjection,
              ...current.filter(
                (fragment) => fragment.fragmentId !== captured?.fragmentId,
              ),
            ]),
          );
          setFragmentActionError(
            "파편은 안전하게 복사했지만 원문 이동을 영속 저장하지 못했습니다. 현재 원고 상태를 확인하세요.",
          );
        } else {
          setFragmentActionError(
            "선택 범위를 파편으로 이동하지 못했습니다. 현재 원고에서 다시 선택하세요.",
          );
        }
      } finally {
        setFragmentActionState("idle");
      }
    },
    [activeDocument, fragmentActionState, persistDocument],
  );
  const insertFragmentAtCursor = useCallback(
    async (fragment: FragmentProjection) => {
      if (
        activeDocument === undefined ||
        fragment.workId !== activeDocument.workId ||
        fragment.retiredAt !== null ||
        fragmentActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (selection === undefined || !selection.empty) {
        setFragmentActionError(
          "파편을 넣을 한 곳에 커서를 두세요. 선택 범위를 덮어쓰지 않습니다.",
        );
        return;
      }
      setFragmentActionState("inserting");
      setFragmentActionError(null);
      try {
        const inserted =
          manuscriptEditorRef.current?.insertFragmentAtCursor(
            activeDocument,
            selection.from,
            fragment.exactText,
          ) ?? false;
        if (!inserted) {
          setFragmentActionError(
            "현재 커서가 달라져 파편을 넣지 못했습니다.",
          );
          return;
        }
        await persistDocument(activeDocument);
        const used = await window.eumStudio.fragments.recordUse({
          schemaVersion: 1,
          workId: activeDocument.workId,
          fragmentId: fragment.fragmentId,
          expectedRevision: fragment.revision,
        });
        setFragments((current) =>
          Object.freeze(
            current.map((entry) =>
              entry.fragmentId === used.fragmentId ? used : entry,
            ),
          ),
        );
        setFragmentDialogOpen(false);
      } catch {
        setFragmentActionError(
          "파편 삽입을 영속 저장하지 못했습니다. 사용 횟수는 올리지 않았습니다.",
        );
      } finally {
        setFragmentActionState("idle");
      }
    },
    [activeDocument, fragmentActionState, persistDocument],
  );
  const updateFragment = useCallback(
    async (
      fragment: FragmentProjection,
      changes: UpdateFragmentCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        fragment.workId !== activeWork.workId ||
        fragmentActionState !== "idle"
      ) {
        return;
      }
      setFragmentActionState("updating");
      setFragmentActionError(null);
      try {
        const updated = await window.eumStudio.fragments.update({
          schemaVersion: 1,
          workId: activeWork.workId,
          fragmentId: fragment.fragmentId,
          expectedRevision: fragment.revision,
          changes,
        });
        setFragments((current) =>
          Object.freeze(
            current.map((entry) =>
              entry.fragmentId === updated.fragmentId ? updated : entry,
            ),
          ),
        );
      } catch {
        setFragmentActionError(
          "파편 정보가 달라졌습니다. 서랍을 다시 열어 확인하세요.",
        );
      } finally {
        setFragmentActionState("idle");
      }
    },
    [activeWork, fragmentActionState],
  );
  const retireFragment = useCallback(
    async (fragment: FragmentProjection) => {
      if (
        activeWork === undefined ||
        fragment.workId !== activeWork.workId ||
        fragmentActionState !== "idle"
      ) {
        return;
      }
      setFragmentActionState("retiring");
      setFragmentActionError(null);
      try {
        const retired = await window.eumStudio.fragments.retire({
          schemaVersion: 1,
          workId: activeWork.workId,
          fragmentId: fragment.fragmentId,
          expectedRevision: fragment.revision,
        });
        setFragments((current) =>
          Object.freeze(
            current.filter(
              (entry) => entry.fragmentId !== retired.fragmentId,
            ),
          ),
        );
      } catch {
        setFragmentActionError("파편을 서랍에서 치우지 못했습니다.");
      } finally {
        setFragmentActionState("idle");
      }
    },
    [activeWork, fragmentActionState],
  );
  const createForeshadowLine = useCallback(
    async (title: string, note: string) => {
      if (
        activeWork === undefined ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      setForeshadowLineActionState("creating");
      setForeshadowLineActionError(null);
      try {
        const created = await window.eumStudio.foreshadowing.createLine({
          schemaVersion: 1,
          workId: activeWork.workId,
          title,
          note,
        });
        setForeshadowLines((current) => Object.freeze([
          created,
          ...current.filter((line) => line.lineId !== created.lineId),
        ]));
      } catch {
        setForeshadowLineActionError(
          "복선 라인을 만들지 못했습니다. 이름과 현재 작품을 확인하세요.",
        );
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [activeWork, foreshadowLineActionState],
  );
  const updateForeshadowLine = useCallback(
    async (
      line: ForeshadowLineProjection,
      changes: UpdateForeshadowLineCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        line.workId !== activeWork.workId ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      setForeshadowLineActionState("updating");
      setForeshadowLineActionError(null);
      try {
        const updated = await window.eumStudio.foreshadowing.updateLine({
          schemaVersion: 1,
          workId: activeWork.workId,
          lineId: line.lineId,
          expectedRevision: line.revision,
          changes,
        });
        setForeshadowLines((current) => Object.freeze(
          current.map((entry) =>
            entry.lineId === updated.lineId ? updated : entry,
          ),
        ));
      } catch {
        setForeshadowLineActionError(
          "복선 라인 정보가 달라졌습니다. 다시 열어 확인하세요.",
        );
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [activeWork, foreshadowLineActionState],
  );
  const retireForeshadowLine = useCallback(
    async (line: ForeshadowLineProjection) => {
      if (
        activeWork === undefined ||
        line.workId !== activeWork.workId ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      setForeshadowLineActionState("retiring");
      setForeshadowLineActionError(null);
      try {
        const retired = await window.eumStudio.foreshadowing.retireLine({
          schemaVersion: 1,
          workId: activeWork.workId,
          lineId: line.lineId,
          expectedRevision: line.revision,
        });
        setForeshadowLines((current) => Object.freeze(
          current.filter((entry) => entry.lineId !== retired.lineId),
        ));
        setForeshadowPoints((current) => Object.freeze(
          current.filter((point) => point.lineId !== retired.lineId),
        ));
        try {
          const projection = await window.eumStudio.loreForeshadowLinks.list({
            schemaVersion: 1,
            workId: activeWork.workId,
          });
          setLoreForeshadowLinks(projection.links);
        } catch {
          setLoreForeshadowLinks((current) => Object.freeze(
            current.filter((link) => link.lineId !== retired.lineId),
          ));
          setForeshadowLineActionError(
            "복선 라인은 치웠지만 별빛 연결 목록을 새로 읽지 못했습니다.",
          );
        }
      } catch {
        setForeshadowLineActionError(
          "복선 라인을 목록에서 치우지 못했습니다.",
        );
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [activeWork, foreshadowLineActionState],
  );
  const linkLoreForeshadow = useCallback(
    async (
      entry: LoreEntryProjection,
      line: ForeshadowLineProjection,
      surface: "lore" | "foreshadow",
    ) => {
      if (
        activeWork === undefined ||
        entry.workId !== activeWork.workId ||
        line.workId !== activeWork.workId ||
        loreActionState !== "idle" ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      if (surface === "lore") {
        setLoreActionState("linking-foreshadow");
        setLoreActionError(null);
      } else {
        setForeshadowLineActionState("linking-lore");
        setForeshadowLineActionError(null);
      }
      try {
        const linked = await window.eumStudio.loreForeshadowLinks.link({
          schemaVersion: 1,
          workId: activeWork.workId,
          loreEntryId: entry.loreEntryId,
          lineId: line.lineId,
        });
        setLoreForeshadowLinks((current) => Object.freeze([
          linked,
          ...current.filter((link) => link.linkId !== linked.linkId),
        ]));
      } catch {
        if (surface === "lore") {
          setLoreActionError("이 별빛과 복선을 연결하지 못했습니다.");
        } else {
          setForeshadowLineActionError("이 복선과 별빛을 연결하지 못했습니다.");
        }
      } finally {
        if (surface === "lore") {
          setLoreActionState("idle");
        } else {
          setForeshadowLineActionState("idle");
        }
      }
    },
    [
      activeWork,
      foreshadowLineActionState,
      loreActionState,
    ],
  );
  const unlinkLoreForeshadow = useCallback(
    async (
      link: LoreForeshadowLinkProjection,
      surface: "lore" | "foreshadow",
    ) => {
      if (
        activeWork === undefined ||
        link.workId !== activeWork.workId ||
        link.unlinkedAt !== null ||
        loreActionState !== "idle" ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      if (surface === "lore") {
        setLoreActionState("unlinking-foreshadow");
        setLoreActionError(null);
      } else {
        setForeshadowLineActionState("unlinking-lore");
        setForeshadowLineActionError(null);
      }
      try {
        const unlinked = await window.eumStudio.loreForeshadowLinks.unlink({
          schemaVersion: 1,
          workId: activeWork.workId,
          linkId: link.linkId,
          expectedRevision: link.revision,
        });
        setLoreForeshadowLinks((current) => Object.freeze(
          current.map((candidate) =>
            candidate.linkId === unlinked.linkId ? unlinked : candidate,
          ),
        ));
      } catch {
        if (surface === "lore") {
          setLoreActionError("이 별빛과 복선의 연결을 해제하지 못했습니다.");
        } else {
          setForeshadowLineActionError("이 복선과 별빛의 연결을 해제하지 못했습니다.");
        }
      } finally {
        if (surface === "lore") {
          setLoreActionState("idle");
        } else {
          setForeshadowLineActionState("idle");
        }
      }
    },
    [
      activeWork,
      foreshadowLineActionState,
      loreActionState,
    ],
  );
  const createCharacter = useCallback(
    async (draft: CharacterDraft) => {
      if (
        activeWork === undefined ||
        characterActionState !== "idle"
      ) {
        return;
      }
      setCharacterActionState("creating");
      setCharacterActionError(null);
      try {
        const created = await window.eumStudio.characters.create({
          schemaVersion: 1,
          workId: activeWork.workId,
          ...draft,
        });
        setCharacters((current) => Object.freeze([
          created,
          ...current.filter(
            (character) =>
              character.workId === created.workId &&
              character.characterId !== created.characterId,
          ),
        ]));
        setSelectedCharacterId(created.characterId);
      } catch {
        setCharacterActionError(
          "인물을 만들지 못했습니다. 이름과 현재 작품을 확인하세요.",
        );
      } finally {
        setCharacterActionState("idle");
      }
    },
    [activeWork, characterActionState],
  );
  const updateCharacter = useCallback(
    async (
      character: CharacterProjection,
      changes: UpdateCharacterCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        character.workId !== activeWork.workId ||
        characterActionState !== "idle"
      ) {
        return;
      }
      setCharacterActionState("updating");
      setCharacterActionError(null);
      try {
        const updated = await window.eumStudio.characters.update({
          schemaVersion: 1,
          workId: activeWork.workId,
          characterId: character.characterId,
          expectedRevision: character.revision,
          changes,
        });
        setCharacters((current) => Object.freeze(
          current
            .filter((entry) => entry.workId === updated.workId)
            .map((entry) =>
              entry.characterId === updated.characterId ? updated : entry,
            ),
        ));
      } catch {
        setCharacterActionError(
          "인물 정보가 달라졌습니다. 다시 열어 확인하세요.",
        );
      } finally {
        setCharacterActionState("idle");
      }
    },
    [activeWork, characterActionState],
  );
  const retireCharacter = useCallback(
    async (character: CharacterProjection) => {
      if (
        activeWork === undefined ||
        character.workId !== activeWork.workId ||
        characterActionState !== "idle"
      ) {
        return;
      }
      setCharacterActionState("retiring");
      setCharacterActionError(null);
      try {
        const retired = await window.eumStudio.characters.retire({
          schemaVersion: 1,
          workId: activeWork.workId,
          characterId: character.characterId,
          expectedRevision: character.revision,
        });
        const remaining = characters.filter(
          (entry) =>
            entry.workId === retired.workId &&
            entry.characterId !== retired.characterId,
        );
        setCharacters(Object.freeze(remaining));
        setSelectedCharacterId((current) =>
          current === retired.characterId
            ? (remaining[0]?.characterId ?? null)
            : current,
        );
      } catch {
        setCharacterActionError("인물을 목록에서 치우지 못했습니다.");
      } finally {
        setCharacterActionState("idle");
      }
    },
    [activeWork, characterActionState, characters],
  );
  const applyPlotEventLinkMutation = useCallback(
    (mutation: PlotEventLinkMutationProjection) => {
      setPlots((current) => Object.freeze([
        mutation.plotBeat,
        ...current.filter(
          (plot) => plot.plotThreadId !== mutation.plotBeat.plotThreadId,
        ),
      ]));
      setEventBlocks((current) => Object.freeze([
        mutation.eventBlock,
        ...current.filter(
          (eventBlock) =>
            eventBlock.eventBlockId !== mutation.eventBlock.eventBlockId,
        ),
      ]));
      setEventSources((current) => Object.freeze([
        ...mutation.eventSources,
        ...current.filter(
          (source) => source.eventBlockId !== mutation.eventBlock.eventBlockId,
        ),
      ]));
      setPlotEventLinks((current) => Object.freeze(
        mutation.link.retiredAt === null
          ? [
              mutation.link,
              ...current.filter(
                (link) =>
                  link.plotEventLinkId !== mutation.link.plotEventLinkId,
              ),
            ]
          : current.filter(
              (link) => link.plotEventLinkId !== mutation.link.plotEventLinkId,
            ),
      ));
    },
    [],
  );
  const createPlotFromEventBlock = useCallback(
    async (eventBlock: EventBlockProjection) => {
      if (
        activeWork === undefined ||
        eventBlock.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      setPlotActionState("creating-from-event");
      setPlotActionError(null);
      try {
        const mutation = await window.eumStudio.plots.createFromEvent({
          schemaVersion: 1,
          workId: activeWork.workId,
          eventBlockId: eventBlock.eventBlockId,
        });
        applyPlotEventLinkMutation(mutation);
        await refreshEventRailAfterPlotChange(activeWork.workId);
        setSelectedPlotThreadId(mutation.plotBeat.plotThreadId);
        setPlotDialogOpen(true);
      } catch {
        setPlotActionError("사건에서 플롯을 만들거나 연결 플롯을 열지 못했습니다.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeWork,
      applyPlotEventLinkMutation,
      plotActionState,
      refreshEventRailAfterPlotChange,
    ],
  );
  const createEventFromPlot = useCallback(
    async (plot: PlotThreadProjection, exactSelection: boolean) => {
      if (
        activeWork === undefined ||
        plot.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      let source: CreateEventFromPlotSource = { kind: "anchorless" };
      if (exactSelection) {
        if (
          activeDocument === undefined ||
          activeDocument.workId !== activeWork.workId
        ) {
          setPlotActionError("현재 작품 원고에서 사건 범위를 먼저 선택하세요.");
          return;
        }
        const summary = manuscriptEditorRef.current?.readDocumentState(
          activeDocument,
        );
        const selection = summary?.selection.ranges[summary.selection.mainIndex];
        const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
          activeDocument,
        );
        if (
          selection === undefined ||
          selection.empty ||
          manuscript === undefined
        ) {
          setPlotActionError("현재 작품 원고에서 사건 범위를 먼저 선택하세요.");
          return;
        }
        const exactQuote = manuscript.slice(selection.from, selection.to);
        if (exactQuote.length === 0) {
          setPlotActionError("빈 원고 범위로는 사건을 만들 수 없습니다.");
          return;
        }
        source = {
          kind: "exact-selection",
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactQuote,
        };
      }
      setPlotActionState("creating-event");
      setPlotActionError(null);
      try {
        if (exactSelection && activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const mutation = await window.eumStudio.plots.createEvent({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotBeatId: plot.plotThreadId,
          source,
        });
        applyPlotEventLinkMutation(mutation);
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError("플롯에서 사건을 만들지 못했습니다.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      applyPlotEventLinkMutation,
      persistDocument,
      plotActionState,
      refreshEventRailAfterPlotChange,
    ],
  );
  const linkPlotEvent = useCallback(
    async (
      plot: PlotThreadProjection,
      eventBlockId: EventBlockProjection["eventBlockId"],
      role: PlotEventLinkRole,
    ) => {
      if (
        activeWork === undefined ||
        plot.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      setPlotActionState("linking-event");
      setPlotActionError(null);
      try {
        const mutation = await window.eumStudio.plots.linkEvent({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotBeatId: plot.plotThreadId,
          eventBlockId,
          role,
        });
        applyPlotEventLinkMutation(mutation);
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError("플롯과 사건을 연결하지 못했습니다.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeWork,
      applyPlotEventLinkMutation,
      plotActionState,
      refreshEventRailAfterPlotChange,
    ],
  );
  const unlinkPlotEvent = useCallback(
    async (link: PlotEventLinkProjection) => {
      if (
        activeWork === undefined ||
        link.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      setPlotActionState("unlinking-event");
      setPlotActionError(null);
      try {
        const mutation = await window.eumStudio.plots.unlinkEvent({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotEventLinkId: link.plotEventLinkId,
          expectedRevision: link.revision,
        });
        applyPlotEventLinkMutation(mutation);
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError("플롯과 사건의 연결을 해제하지 못했습니다.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeWork,
      applyPlotEventLinkMutation,
      plotActionState,
      refreshEventRailAfterPlotChange,
    ],
  );
  const createPlotThread = useCallback(
    async (draft: PlotDraft) => {
      if (activeWork === undefined || plotActionState !== "idle") {
        return;
      }
      setPlotActionState("creating");
      setPlotActionError(null);
      try {
        const created = await window.eumStudio.plots.create({
          schemaVersion: 1,
          workId: activeWork.workId,
          ...draft,
        });
        setPlots((current) => Object.freeze([
          created,
          ...current.filter(
            (plot) =>
              plot.workId === created.workId &&
              plot.plotThreadId !== created.plotThreadId,
            ),
        ]));
        await refreshEventRailAfterPlotChange(activeWork.workId);
        setSelectedPlotThreadId(created.plotThreadId);
      } catch {
        setPlotActionError(
          "플롯을 만들지 못했습니다. 제목과 현재 작품을 확인하세요.",
        );
      } finally {
        setPlotActionState("idle");
      }
    },
    [activeWork, plotActionState, refreshEventRailAfterPlotChange],
  );
  const updatePlotThread = useCallback(
    async (
      plot: PlotThreadProjection,
      changes: UpdatePlotThreadCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        plot.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      setPlotActionState("updating");
      setPlotActionError(null);
      try {
        const updated = await window.eumStudio.plots.update({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotThreadId: plot.plotThreadId,
          expectedRevision: plot.revision,
          changes,
        });
        setPlots((current) => Object.freeze(
          current
            .filter((entry) => entry.workId === updated.workId)
            .map((entry) =>
              entry.plotThreadId === updated.plotThreadId ? updated : entry,
            ),
        ));
        setPlotEventLinks((current) => Object.freeze(
          current.map((link) =>
            link.workId === updated.workId &&
            link.plotBeatId === updated.plotThreadId
              ? {
                  ...link,
                  plotTitle: updated.title,
                  titleMatch:
                    updated.title === link.eventTitle
                      ? ("matched" as const)
                      : ("mismatched" as const),
                }
              : link,
          ),
        ));
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError(
          "플롯 정보가 달라졌습니다. 다시 열어 확인하세요.",
        );
      } finally {
        setPlotActionState("idle");
      }
    },
    [activeWork, plotActionState, refreshEventRailAfterPlotChange],
  );
  const retirePlotThread = useCallback(
    async (plot: PlotThreadProjection) => {
      if (
        activeWork === undefined ||
        plot.workId !== activeWork.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      setPlotActionState("retiring");
      setPlotActionError(null);
      try {
        const retired = await window.eumStudio.plots.retire({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotThreadId: plot.plotThreadId,
          expectedRevision: plot.revision,
        });
        const remaining = plots.filter(
          (entry) =>
            entry.workId === retired.workId &&
            entry.plotThreadId !== retired.plotThreadId,
        );
        setPlots(Object.freeze(remaining));
        setPlotSources((current) => Object.freeze(
          current.filter(
            (source) => source.plotThreadId !== retired.plotThreadId,
          ),
        ));
        setPlotEventLinks((current) => Object.freeze(
          current.map((link) =>
            link.workId === retired.workId &&
            link.plotBeatId === retired.plotThreadId
              ? { ...link, plotRetiredAt: retired.retiredAt }
              : link,
          ),
        ));
        await refreshEventRailAfterPlotChange(activeWork.workId);
        setSelectedPlotThreadId((current) =>
          current === retired.plotThreadId
            ? (remaining[0]?.plotThreadId ?? null)
            : current,
        );
      } catch {
        setPlotActionError("플롯을 목록에서 치우지 못했습니다.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [activeWork, plotActionState, plots, refreshEventRailAfterPlotChange],
  );
  const movePlotPlacement = useCallback(
    async (
      placement: PlotPlacementProjection,
      target: PlotPlacementMoveTarget,
    ) => {
      if (
        activeWork === undefined ||
        plotBoard === null ||
        placement.workId !== activeWork.workId ||
        placement.plotBoardId !== plotBoard.plotBoardId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      const placementOnBoard = plotBoard.lanes
        .flatMap((candidate) => candidate.placements)
        .find(
          (candidate) =>
            candidate.plotPlacementId === placement.plotPlacementId,
        );
      const targetLane = plotBoard.lanes.find(
        (candidate) => candidate.plotLaneId === target.targetLaneId,
      );
      if (placementOnBoard === undefined || targetLane === undefined) return;
      setPlotActionState("moving-placement");
      setPlotActionError(null);
      try {
        const authoritativeBoard = await window.eumStudio.plots.movePlacement({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotPlacementId: placement.plotPlacementId,
          targetBoardId: plotBoard.plotBoardId,
          targetLaneId: targetLane.plotLaneId,
          ...(target.beforePlacementId === undefined
            ? {}
            : { beforePlacementId: target.beforePlacementId }),
          ...(target.afterPlacementId === undefined
            ? {}
            : { afterPlacementId: target.afterPlacementId }),
          expectedPlacementRevision: placement.revision,
          expectedBoardRevision: plotBoard.revision,
        });
        setPlotBoard(authoritativeBoard);
        setSelectedPlotThreadId(placement.plotBeatId);
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError("플롯 배치 순서가 달라졌습니다. 다시 열어 확인하세요.");
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeWork,
      plotActionState,
      plotBoard,
      refreshEventRailAfterPlotChange,
    ],
  );
  const setPlotPlacementStoryTime = useCallback(
    async (
      placement: PlotPlacementProjection,
      target: PlotStoryTimeTarget,
    ) => {
      if (
        activeWork === undefined ||
        plotBoard === null ||
        placement.workId !== activeWork.workId ||
        placement.plotBoardId !== plotBoard.plotBoardId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      const placementOnBoard = plotBoard.lanes
        .flatMap((candidate) => candidate.placements)
        .find(
          (candidate) =>
            candidate.plotPlacementId === placement.plotPlacementId,
        );
      if (placementOnBoard === undefined) return;
      setPlotActionState("setting-story-time");
      setPlotActionError(null);
      try {
        const authoritativeBoard = await window.eumStudio.plots.setStoryTime({
          schemaVersion: 1,
          workId: activeWork.workId,
          plotPlacementId: placement.plotPlacementId,
          plotBoardId: plotBoard.plotBoardId,
          storyTime: target.storyTime,
          storyTimeEnd: target.storyTimeEnd,
          expectedPlacementRevision: placement.revision,
          expectedBoardRevision: plotBoard.revision,
        });
        setPlotBoard(authoritativeBoard);
        setSelectedPlotThreadId(placement.plotBeatId);
        await refreshEventRailAfterPlotChange(activeWork.workId);
      } catch {
        setPlotActionError(
          "플롯 이야기 시간이 달라졌습니다. 다시 열어 확인하세요.",
        );
      } finally {
        setPlotActionState("idle");
      }
    },
    [
      activeWork,
      plotActionState,
      plotBoard,
      refreshEventRailAfterPlotChange,
    ],
  );
  const createLoreEntry = useCallback(
    async (draft: LoreEntryDraft) => {
      if (activeWork === undefined || loreActionState !== "idle") {
        return;
      }
      let evidence: {
        readonly documentId: ManuscriptDocumentSource["documentId"];
        readonly selection: { readonly anchor: number; readonly head: number };
        readonly exactText: string;
      } | null = null;
      if (draft.includeCurrentSelection) {
        if (
          activeDocument === undefined ||
          activeDocument.workId !== activeWork.workId
        ) {
          setLoreActionError("별빛 근거로 연결할 원고 범위를 먼저 선택하세요.");
          return;
        }
        const summary = manuscriptEditorRef.current?.readDocumentState(
          activeDocument,
        );
        const selection = summary?.selection.ranges[summary.selection.mainIndex];
        const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
          activeDocument,
        );
        if (
          selection === undefined ||
          selection.empty ||
          manuscript === undefined
        ) {
          setLoreActionError("별빛 근거로 연결할 원고 범위를 먼저 선택하세요.");
          return;
        }
        const exactText = manuscript.slice(selection.from, selection.to);
        if (exactText.length === 0) {
          setLoreActionError("빈 원고 범위는 별빛 근거로 연결할 수 없습니다.");
          return;
        }
        evidence = Object.freeze({
          documentId: activeDocument.documentId,
          selection: Object.freeze({
            anchor: selection.anchor,
            head: selection.head,
          }),
          exactText,
        });
      }
      setLoreActionState("creating");
      setLoreActionError(null);
      try {
        if (evidence !== null && activeDocument !== undefined) {
          await persistDocument(activeDocument);
        }
        const created = await window.eumStudio.loreEntries.create({
          schemaVersion: 1,
          workId: activeWork.workId,
          title: draft.title,
          content: draft.content,
          category: draft.category,
          aliases: draft.aliases,
          enabled: draft.enabled,
          evidence,
        });
        setLoreEntries((current) => Object.freeze([
          created,
          ...current.filter(
            (entry) =>
              entry.workId === created.workId &&
              entry.loreEntryId !== created.loreEntryId,
          ),
        ]));
        setSelectedLoreEntryId(created.loreEntryId);
      } catch {
        setLoreActionError(
          "별빛을 만들지 못했습니다. 이름과 현재 원고 근거를 확인하세요.",
        );
      } finally {
        setLoreActionState("idle");
      }
    },
    [activeDocument, activeWork, loreActionState, persistDocument],
  );
  const updateLoreEntry = useCallback(
    async (
      entry: LoreEntryProjection,
      changes: UpdateLoreEntryCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        entry.workId !== activeWork.workId ||
        loreActionState !== "idle"
      ) {
        return;
      }
      setLoreActionState("updating");
      setLoreActionError(null);
      try {
        const updated = await window.eumStudio.loreEntries.update({
          schemaVersion: 1,
          workId: activeWork.workId,
          loreEntryId: entry.loreEntryId,
          expectedRevision: entry.revision,
          changes,
        });
        setLoreEntries((current) => Object.freeze(
          current
            .filter((candidate) => candidate.workId === updated.workId)
            .map((candidate) =>
              candidate.loreEntryId === updated.loreEntryId
                ? updated
                : candidate,
            ),
        ));
      } catch {
        setLoreActionError(
          "별빛 정보가 달라졌습니다. 다시 열어 확인하세요.",
        );
      } finally {
        setLoreActionState("idle");
      }
    },
    [activeWork, loreActionState],
  );
  const retireLoreEntry = useCallback(
    async (entry: LoreEntryProjection) => {
      if (
        activeWork === undefined ||
        entry.workId !== activeWork.workId ||
        loreActionState !== "idle"
      ) {
        return;
      }
      setLoreActionState("retiring");
      setLoreActionError(null);
      try {
        const retired = await window.eumStudio.loreEntries.retire({
          schemaVersion: 1,
          workId: activeWork.workId,
          loreEntryId: entry.loreEntryId,
          expectedRevision: entry.revision,
        });
        const remaining = loreEntries.filter(
          (candidate) =>
            candidate.workId === retired.workId &&
            candidate.loreEntryId !== retired.loreEntryId,
        );
        setLoreEntries(Object.freeze(remaining));
        setSelectedLoreEntryId((current) =>
          current === retired.loreEntryId
            ? (remaining[0]?.loreEntryId ?? null)
            : current,
        );
        try {
          const projection = await window.eumStudio.loreForeshadowLinks.list({
            schemaVersion: 1,
            workId: activeWork.workId,
          });
          setLoreForeshadowLinks(projection.links);
        } catch {
          setLoreForeshadowLinks((current) => Object.freeze(
            current.filter(
              (link) => link.loreEntryId !== retired.loreEntryId,
            ),
          ));
          setLoreActionError(
            "별빛은 치웠지만 복선 연결 목록을 새로 읽지 못했습니다.",
          );
        }
      } catch {
        setLoreActionError("별빛을 목록에서 치우지 못했습니다.");
      } finally {
        setLoreActionState("idle");
      }
    },
    [activeWork, loreActionState, loreEntries],
  );
  const addLoreEntryEvidence = useCallback(
    async (entry: LoreEntryProjection) => {
      if (
        activeDocument === undefined ||
        entry.workId !== activeDocument.workId ||
        loreActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (
        selection === undefined ||
        selection.empty ||
        manuscript === undefined
      ) {
        setLoreActionError("별빛 근거로 추가할 원고 범위를 먼저 선택하세요.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setLoreActionError("빈 원고 범위는 별빛 근거로 추가할 수 없습니다.");
        return;
      }
      setLoreActionState("adding-evidence");
      setLoreActionError(null);
      try {
        await persistDocument(activeDocument);
        const updated = await window.eumStudio.loreEntries.addEvidence({
          schemaVersion: 1,
          workId: activeDocument.workId,
          loreEntryId: entry.loreEntryId,
          expectedRevision: entry.revision,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
        });
        setLoreEntries((current) => Object.freeze(
          current
            .filter((candidate) => candidate.workId === updated.workId)
            .map((candidate) =>
              candidate.loreEntryId === updated.loreEntryId
                ? updated
                : candidate,
            ),
        ));
      } catch {
        setLoreActionError(
          "현재 원고 선택을 별빛 근거로 추가하지 못했습니다.",
        );
      } finally {
        setLoreActionState("idle");
      }
    },
    [activeDocument, loreActionState, persistDocument],
  );
  const openLoreEntryEvidence = useCallback(
    async (evidence: LoreEntryEvidenceProjection) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        evidence.integrity !== "resolved" ||
        evidence.range === null
      ) {
        setLoreActionError(
          "검토가 필요한 별빛 근거는 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const sourceDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === activeWork.workId &&
          document.documentId === evidence.sourceDocumentId,
      );
      if (sourceDocument === undefined) {
        setLoreActionError("별빛 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.");
        return;
      }
      if (activeDocument?.documentId === sourceDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          sourceDocument,
          evidence.range,
        );
        if (!selected) {
          setLoreActionError(
            "별빛 근거의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setLoreActionError(null);
        setLoreDialogOpen(false);
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter((document) => document.workId === sourceDocument.workId)
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? sourceDocument.documentId;
      pendingLoreEvidenceRef.current = {
        anchorId: evidence.anchorId,
        workId: sourceDocument.workId,
        documentId: sourceDocument.documentId,
        range: evidence.range,
      };
      setLoreActionError(null);
      setLoreDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: sourceDocument.workId,
          documentId: sourceDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: sourceDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: sourceDocument.documentId,
          }),
        );
      } catch {
        pendingLoreEvidenceRef.current = null;
        setLoreActionError("별빛 근거의 원본 회차를 열지 못했습니다.");
        setLoreDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
    ],
  );
  const openLoreCandidateDialog = useCallback(async () => {
    if (activeWork === undefined || loreCandidateActionState !== "idle") {
      return;
    }
    setLoreCandidateActionError(null);
    try {
      const projection = await window.eumStudio.loreCandidates.list({
        schemaVersion: 1,
        workId: activeWork.workId,
      });
      setLoreCandidates(projection.candidates);
      setLoreCandidateDialogOpen(true);
    } catch {
      setLoreCandidateActionError("별빛 검토 기록을 불러오지 못했습니다.");
    }
  }, [activeWork, loreCandidateActionState]);
  const createLoreCandidate = useCallback(
    async (draft: LoreCandidateDraft) => {
      if (
        activeDocument === undefined ||
        activeWork === undefined ||
        activeDocument.workId !== activeWork.workId ||
        loreCandidateActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (
        selection === undefined ||
        selection.empty ||
        manuscript === undefined
      ) {
        setLoreCandidateActionError("별빛 후보의 근거가 될 원고 범위를 선택하세요.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setLoreCandidateActionError("빈 원고 범위는 별빛 후보로 담을 수 없습니다.");
        return;
      }
      setLoreCandidateActionState("creating");
      setLoreCandidateActionError(null);
      try {
        await persistDocument(activeDocument);
        const created = await window.eumStudio.loreCandidates.create({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
          source: "user",
          certainty: "explicit",
          proposal: draft.proposal,
          reason: draft.reason,
        });
        setLoreCandidates((current) => Object.freeze([
          created,
          ...current.filter(
            (candidate) => candidate.candidateId !== created.candidateId,
          ),
        ]));
      } catch {
        setLoreCandidateActionError(
          "현재 선택을 별빛 후보로 담지 못했습니다. 원고와 제안 내용을 확인하세요.",
        );
      } finally {
        setLoreCandidateActionState("idle");
      }
    },
    [
      activeDocument,
      activeWork,
      loreCandidateActionState,
      persistDocument,
    ],
  );
  const approveLoreCandidate = useCallback(
    async (candidate: LoreCandidateProjection) => {
      if (
        activeWork === undefined ||
        candidate.workId !== activeWork.workId ||
        candidate.status !== "pending" ||
        candidate.approvalBlockReason !== null ||
        loreCandidateActionState !== "idle"
      ) {
        return;
      }
      setLoreCandidateActionState("approving");
      setLoreCandidateActionError(null);
      try {
        const result = await window.eumStudio.loreCandidates.approve({
          schemaVersion: 1,
          workId: activeWork.workId,
          candidateId: candidate.candidateId,
          expectedRevision: candidate.revision,
        });
        setLoreCandidates((current) => Object.freeze(
          current.map((entry) =>
            entry.candidateId === result.candidate.candidateId
              ? result.candidate
              : entry,
          ),
        ));
        setLoreEntries((current) => Object.freeze([
          result.loreEntry,
          ...current.filter(
            (entry) => entry.loreEntryId !== result.loreEntry.loreEntryId,
          ),
        ]));
        setSelectedLoreEntryId(result.loreEntry.loreEntryId);
      } catch {
        try {
          const projection = await window.eumStudio.loreCandidates.list({
            schemaVersion: 1,
            workId: activeWork.workId,
          });
          setLoreCandidates(projection.candidates);
        } catch {
          // The original approval error remains the user-visible result.
        }
        setLoreCandidateActionError(
          "후보를 승인하지 못했습니다. 현재 원문과 별빛 상태를 다시 확인하세요.",
        );
      } finally {
        setLoreCandidateActionState("idle");
      }
    },
    [activeWork, loreCandidateActionState],
  );
  const rejectLoreCandidate = useCallback(
    async (candidate: LoreCandidateProjection) => {
      if (
        activeWork === undefined ||
        candidate.workId !== activeWork.workId ||
        candidate.status !== "pending" ||
        loreCandidateActionState !== "idle"
      ) {
        return;
      }
      setLoreCandidateActionState("rejecting");
      setLoreCandidateActionError(null);
      try {
        const rejected = await window.eumStudio.loreCandidates.reject({
          schemaVersion: 1,
          workId: activeWork.workId,
          candidateId: candidate.candidateId,
          expectedRevision: candidate.revision,
        });
        setLoreCandidates((current) => Object.freeze(
          current.map((entry) =>
            entry.candidateId === rejected.candidateId ? rejected : entry,
          ),
        ));
      } catch {
        setLoreCandidateActionError(
          "후보를 거절하지 못했습니다. 검토 기록을 다시 확인하세요.",
        );
      } finally {
        setLoreCandidateActionState("idle");
      }
    },
    [activeWork, loreCandidateActionState],
  );
  const openLoreCandidateEvidence = useCallback(
    async (candidate: LoreCandidateProjection) => {
      const evidence = candidate.evidence;
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        candidate.workId !== activeWork.workId ||
        evidence.integrity !== "resolved" ||
        evidence.range === null
      ) {
        setLoreCandidateActionError(
          "검토가 필요한 후보 근거는 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const sourceDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === candidate.workId &&
          document.documentId === evidence.sourceDocumentId,
      );
      if (sourceDocument === undefined) {
        setLoreCandidateActionError("후보 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.");
        return;
      }
      if (activeDocument?.documentId === sourceDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          sourceDocument,
          evidence.range,
        );
        if (!selected) {
          setLoreCandidateActionError(
            "후보 근거의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setLoreCandidateActionError(null);
        setLoreCandidateDialogOpen(false);
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter((document) => document.workId === sourceDocument.workId)
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? sourceDocument.documentId;
      pendingLoreCandidateEvidenceRef.current = {
        candidateId: candidate.candidateId,
        workId: candidate.workId,
        documentId: evidence.sourceDocumentId,
        range: evidence.range,
      };
      setLoreCandidateActionError(null);
      setLoreCandidateDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: candidate.workId,
          documentId: evidence.sourceDocumentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: sourceDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: sourceDocument.documentId,
          }),
        );
      } catch {
        pendingLoreCandidateEvidenceRef.current = null;
        setLoreCandidateActionError("후보 근거의 원본 회차를 열지 못했습니다.");
        setLoreCandidateDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
    ],
  );
  const linkPlotThreadSource = useCallback(
    async (plot: PlotThreadProjection) => {
      if (
        activeDocument === undefined ||
        plot.workId !== activeDocument.workId ||
        plotActionState !== "idle"
      ) {
        return;
      }
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (selection === undefined || selection.empty) {
        setPlotActionError("플롯 출처로 연결할 원고 범위를 먼저 선택하세요.");
        return;
      }
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (manuscript === undefined) {
        setPlotActionError("현재 원고 선택을 읽지 못했습니다.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setPlotActionError("플롯 출처로 연결할 원고 범위를 먼저 선택하세요.");
        return;
      }
      const currentSource = plotSources.find(
        (source) =>
          source.workId === plot.workId &&
          source.plotThreadId === plot.plotThreadId,
      ) ?? null;
      setPlotActionState("linking-source");
      setPlotActionError(null);
      try {
        await persistDocument(activeDocument);
        const linked = await window.eumStudio.plots.linkSource({
          schemaVersion: 1,
          workId: activeDocument.workId,
          plotThreadId: plot.plotThreadId,
          expectedSourceId: currentSource?.sourceId ?? null,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
        });
        setPlotSources((current) => Object.freeze([
          ...current.filter(
            (source) =>
              source.workId !== linked.workId ||
              source.plotThreadId !== linked.plotThreadId,
          ),
          linked,
        ]));
      } catch {
        setPlotActionError(
          "플롯 출처를 연결하지 못했습니다. 현재 원고 선택과 플롯을 확인하세요.",
        );
      } finally {
        setPlotActionState("idle");
      }
    },
    [activeDocument, persistDocument, plotActionState, plotSources],
  );
  const openPlotThreadSource = useCallback(
    async (source: PlotThreadSourceProjection) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        source.workId !== activeWork.workId ||
        source.integrity !== "resolved" ||
        source.range === null
      ) {
        setPlotActionError(
          "검토가 필요한 플롯 출처는 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const sourceDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === source.workId &&
          document.documentId === source.sourceDocumentId,
      );
      if (sourceDocument === undefined) {
        setPlotActionError("플롯 출처의 원본 회차를 찾지 못했습니다.");
        return;
      }
      if (activeDocument?.documentId === sourceDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          sourceDocument,
          source.range,
        );
        if (!selected) {
          setPlotActionError(
            "플롯 출처의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setPlotActionError(null);
        setPlotDialogOpen(false);
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter((document) => document.workId === sourceDocument.workId)
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? sourceDocument.documentId;
      pendingPlotThreadSourceRef.current = {
        sourceId: source.sourceId,
        workId: source.workId,
        documentId: source.sourceDocumentId,
        range: source.range,
      };
      setPlotActionError(null);
      setPlotDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: sourceDocument.workId,
          documentId: sourceDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: sourceDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: sourceDocument.documentId,
          }),
        );
      } catch {
        pendingPlotThreadSourceRef.current = null;
        setPlotActionError("플롯 출처의 원본 회차를 열지 못했습니다.");
        setPlotDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
    ],
  );
  const openWorkStructureDocument = useCallback(
    async (document: WorkStructureOverviewDocument) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        workStructureActionState !== "idle"
      ) {
        return;
      }
      const targetDocument = activeWorkDocuments.find(
        (candidate) =>
          candidate.workId === activeWork.workId &&
          candidate.documentId === document.documentId,
      );
      if (targetDocument === undefined) {
        setWorkStructureActionError(
          "작품 구조에 기록된 회차를 현재 작품에서 찾지 못했습니다.",
        );
        return;
      }
      setWorkStructureActionState("opening");
      setWorkStructureActionError(null);
      setWorkStructureDialogOpen(false);
      if (targetDocument.documentId === activeDocument?.documentId) {
        setWorkStructureActionState("idle");
        return;
      }
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? targetDocument.documentId;
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId: targetDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: activeWork.workId,
            orderedDocumentIds: activeWorkDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: targetDocument.documentId,
          }),
        );
        setWorkStructureActionState("idle");
      } catch {
        setWorkStructureActionState("idle");
        setWorkStructureActionError(
          "작품 구조에 기록된 회차를 열지 못했습니다.",
        );
        setWorkStructureDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activeWorkDocumentIds,
      activeWorkDocuments,
      activateWorkspaceLocation,
      runtime,
      workStructureActionState,
    ],
  );
  const openEventRailSource = useCallback(
    async (location: EventRailSourceLocationProjection) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        eventActionState !== "idle"
      ) {
        return;
      }
      if (location.integrity !== "resolved" || location.range === null) {
        setEventActionError(
          "검토가 필요한 사건은 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const targetDocument = activeWorkDocuments.find(
        (document) =>
          document.workId === activeWork.workId &&
          document.documentId === location.documentId,
      );
      if (targetDocument === undefined) {
        setEventActionError("사건의 원문 회차를 현재 작품에서 찾지 못했습니다.");
        return;
      }
      setEventActionState("opening");
      setEventActionError(null);
      if (targetDocument.documentId === activeDocument?.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          targetDocument,
          location.range,
        );
        setEventActionState("idle");
        if (!selected) {
          setEventActionError(
            "사건의 정확한 원고 범위를 선택하지 못했습니다.",
          );
        }
        return;
      }
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? targetDocument.documentId;
      pendingEventRailRangeRef.current = {
        workId: activeWork.workId,
        documentId: targetDocument.documentId,
        range: location.range,
      };
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId: targetDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: activeWork.workId,
            orderedDocumentIds: activeWorkDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: targetDocument.documentId,
          }),
        );
      } catch {
        pendingEventRailRangeRef.current = null;
        setEventActionState("idle");
        setEventActionError("사건의 정확한 원문 회차를 열지 못했습니다.");
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activeWorkDocumentIds,
      activeWorkDocuments,
      activateWorkspaceLocation,
      eventActionState,
      runtime,
    ],
  );
  const openWorkStructureRange = useCallback(
    async (input: {
      readonly documentId: ManuscriptDocumentSource["documentId"];
      readonly range: { readonly from: number; readonly to: number };
    }) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        workStructureActionState !== "idle"
      ) {
        return;
      }
      const targetDocument = activeWorkDocuments.find(
        (document) =>
          document.workId === activeWork.workId &&
          document.documentId === input.documentId,
      );
      if (targetDocument === undefined) {
        setWorkStructureActionError(
          "작품 구조의 원문 회차를 현재 작품에서 찾지 못했습니다.",
        );
        return;
      }
      setWorkStructureActionState("opening");
      setWorkStructureActionError(null);
      if (targetDocument.documentId === activeDocument?.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          targetDocument,
          input.range,
        );
        setWorkStructureActionState("idle");
        if (!selected) {
          setWorkStructureActionError(
            "작품 구조에 기록된 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setWorkStructureDialogOpen(false);
        void captureResumeForDocument(targetDocument).catch(() => undefined);
        return;
      }
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? targetDocument.documentId;
      pendingWorkStructureRangeRef.current = {
        workId: activeWork.workId,
        documentId: targetDocument.documentId,
        range: input.range,
      };
      setWorkStructureDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId: targetDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: activeWork.workId,
            orderedDocumentIds: activeWorkDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: targetDocument.documentId,
          }),
        );
      } catch {
        pendingWorkStructureRangeRef.current = null;
        setWorkStructureActionState("idle");
        setWorkStructureActionError(
          "작품 구조의 정확한 원문 회차를 열지 못했습니다.",
        );
        setWorkStructureDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activeWorkDocumentIds,
      activeWorkDocuments,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
      workStructureActionState,
    ],
  );
  const openWorkStructureCharacter = useCallback(
    (character: WorkStructureOverviewCharacter) => {
      if (
        activeWorkCharacters.some(
          (candidate) => candidate.characterId === character.characterId,
        )
      ) {
        setSelectedCharacterId(character.characterId);
        setWorkStructureDialogOpen(false);
        setCharacterActionError(null);
        setCharacterDialogOpen(true);
      } else {
        setWorkStructureActionError(
          "작품 구조에 기록된 인물을 현재 작품에서 찾지 못했습니다.",
        );
      }
    },
    [activeWorkCharacters],
  );
  const openWorkStructureLore = useCallback(() => {
    setWorkStructureDialogOpen(false);
    setLoreActionError(null);
    setLoreDialogOpen(true);
  }, []);
  const openWorkStructurePlot = useCallback(
    (plot: WorkStructureOverviewPlot) => {
      if (
        activeWorkPlots.some(
          (candidate) => candidate.plotThreadId === plot.plotThreadId,
        )
      ) {
        setSelectedPlotThreadId(plot.plotThreadId);
        setWorkStructureDialogOpen(false);
        setPlotActionError(null);
        setPlotDialogOpen(true);
      } else {
        setWorkStructureActionError(
          "작품 구조에 기록된 플롯을 현재 작품에서 찾지 못했습니다.",
        );
      }
    },
    [activeWorkPlots],
  );
  const openWorkStructurePlotSource = useCallback(
    (source: WorkStructureOverviewPlotSource) => {
      const currentSource = activeWorkPlotSources.find(
        (candidate) => candidate.sourceId === source.sourceId,
      );
      if (
        currentSource === undefined ||
        currentSource.integrity !== "resolved" ||
        currentSource.range === null
      ) {
        setWorkStructureActionError(
          "검토가 필요한 플롯 출처는 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      void openWorkStructureRange({
        documentId: currentSource.sourceDocumentId,
        range: currentSource.range,
      });
    },
    [activeWorkPlotSources, openWorkStructureRange],
  );
  const openWorkStructureEvent = useCallback(
    (event: WorkStructureOverviewEvent) => {
      const currentSource = event.source === null
        ? undefined
        : eventSources.find(
            (candidate) =>
              candidate.workId === activeWorkId &&
              candidate.eventSourceId === event.source?.eventSourceId,
          );
      const currentAnchor = currentSource?.anchors.find(
        (anchor) => anchor.documentId === event.source?.documentId,
      );
      if (
        currentAnchor === undefined ||
        currentAnchor.integrity !== "resolved" ||
        currentAnchor.range === null
      ) {
        setWorkStructureActionError(
          "검토가 필요한 사건은 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      void openWorkStructureRange({
        documentId: currentAnchor.documentId,
        range: currentAnchor.range,
      });
    },
    [activeWorkId, eventSources, openWorkStructureRange],
  );
  const openWorkStructureScene = useCallback(
    (scene: WorkStructureOverviewScene) => {
      if (
        scene.integrity !== "resolved" ||
        scene.range === null
      ) {
        setWorkStructureActionError(
          "검토가 필요한 장면은 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      void openWorkStructureRange({
        documentId: scene.documentId,
        range: { from: scene.range.start, to: scene.range.end },
      });
    },
    [openWorkStructureRange],
  );
  const captureForeshadowPoint = useCallback(
    async (lineId: string, roleId: string, note: string) => {
      if (
        activeDocument === undefined ||
        foreshadowLineActionState !== "idle"
      ) {
        return;
      }
      const line = foreshadowLines.find(
        (candidate) =>
          candidate.lineId === lineId &&
          candidate.workId === activeDocument.workId,
      );
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const selection = summary?.selection.ranges[summary.selection.mainIndex];
      if (line === undefined || selection === undefined || selection.empty) {
        setForeshadowLineActionError(
          "연결할 복선 라인과 정확한 원고 범위를 선택하세요.",
        );
        return;
      }
      const manuscript = manuscriptEditorRef.current?.materializeDocumentText(
        activeDocument,
      );
      if (manuscript === undefined) {
        setForeshadowLineActionError("현재 원고를 읽지 못했습니다.");
        return;
      }
      const exactText = manuscript.slice(selection.from, selection.to);
      if (exactText.length === 0) {
        setForeshadowLineActionError("연결할 원고 범위를 선택하세요.");
        return;
      }
      setForeshadowLineActionState("capturing");
      setForeshadowLineActionError(null);
      try {
        await persistDocument(activeDocument);
        const created = await window.eumStudio.foreshadowing.createPoint({
          schemaVersion: 1,
          workId: activeDocument.workId,
          lineId: line.lineId,
          documentId: activeDocument.documentId,
          selection: {
            anchor: selection.anchor,
            head: selection.head,
          },
          exactText,
          roleId,
          note,
        });
        setForeshadowPoints((current) => Object.freeze([
          ...current.filter((point) => point.pointId !== created.pointId),
          created,
        ]));
      } catch {
        setForeshadowLineActionError(
          "복선 지점을 연결하지 못했습니다. 현재 원고 선택과 라인을 확인하세요.",
        );
      } finally {
        setForeshadowLineActionState("idle");
      }
    },
    [
      activeDocument,
      foreshadowLineActionState,
      foreshadowLines,
      persistDocument,
    ],
  );
  const openForeshadowPointSource = useCallback(
    async (point: ForeshadowPointProjection) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        point.workId !== activeWork.workId ||
        point.integrity !== "resolved" ||
        point.range === null
      ) {
        setForeshadowLineActionError(
          "검토가 필요한 복선 지점은 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const sourceDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === point.workId &&
          document.documentId === point.sourceDocumentId,
      );
      if (sourceDocument === undefined) {
        setForeshadowLineActionError(
          "복선 지점의 원본 회차를 찾지 못했습니다.",
        );
        return;
      }
      if (activeDocument?.documentId === sourceDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          sourceDocument,
          point.range,
        );
        if (!selected) {
          setForeshadowLineActionError(
            "복선 지점의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setForeshadowLineActionError(null);
        setForeshadowLineDialogOpen(false);
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter((document) => document.workId === sourceDocument.workId)
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? sourceDocument.documentId;
      pendingForeshadowPointSourceRef.current = {
        pointId: point.pointId,
        workId: point.workId,
        documentId: point.sourceDocumentId,
        range: point.range,
      };
      setForeshadowLineActionError(null);
      setForeshadowLineDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: sourceDocument.workId,
          documentId: sourceDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: sourceDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: sourceDocument.documentId,
          }),
        );
      } catch {
        pendingForeshadowPointSourceRef.current = null;
        setForeshadowLineActionError(
          "복선 지점의 원본 회차를 열지 못했습니다.",
        );
        setForeshadowLineDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
    ],
  );
  const openFragmentSource = useCallback(
    async (fragment: FragmentProjection) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        fragment.workId !== activeWork.workId ||
        fragment.integrity !== "resolved" ||
        fragment.range === null
      ) {
        setFragmentActionError(
          "검토가 필요한 파편은 원문 위치를 추정해서 열지 않습니다.",
        );
        return;
      }
      const sourceDocument = runtime.documentProfile.documents.find(
        (document) =>
          document.workId === fragment.workId &&
          document.documentId === fragment.sourceDocumentId,
      );
      if (sourceDocument === undefined) {
        setFragmentActionError("파편의 원본 회차를 찾지 못했습니다.");
        return;
      }
      if (activeDocument?.documentId === sourceDocument.documentId) {
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          sourceDocument,
          fragment.range,
        );
        if (!selected) {
          setFragmentActionError(
            "파편의 정확한 원문 범위를 선택하지 못했습니다.",
          );
          return;
        }
        setFragmentActionError(null);
        setFragmentDialogOpen(false);
        void captureResumeForDocument(sourceDocument).catch(() => undefined);
        return;
      }
      const orderedDocumentIds = runtime.documentProfile.documents
        .filter((document) => document.workId === sourceDocument.workId)
        .map((document) => document.documentId);
      const currentActiveDocumentId =
        runtime.activeDocumentId ?? sourceDocument.documentId;
      pendingFragmentSourceRef.current = {
        fragmentId: fragment.fragmentId,
        workId: fragment.workId,
        documentId: fragment.sourceDocumentId,
        range: fragment.range,
      };
      setFragmentActionError(null);
      setFragmentDialogOpen(false);
      try {
        await activateWorkspaceLocation({
          schemaVersion: 1,
          workId: sourceDocument.workId,
          documentId: sourceDocument.documentId,
        });
        setDocumentTabSession((current) =>
          openDocumentTab({
            session: current,
            workId: sourceDocument.workId,
            orderedDocumentIds,
            activeDocumentId: currentActiveDocumentId,
            documentId: sourceDocument.documentId,
          }),
        );
      } catch {
        pendingFragmentSourceRef.current = null;
        setFragmentActionError("파편의 원본 회차를 열지 못했습니다.");
        setFragmentDialogOpen(true);
      }
    },
    [
      activeDocument?.documentId,
      activeWork,
      activateWorkspaceLocation,
      captureResumeForDocument,
      runtime,
    ],
  );
  const closeDocumentTabById = useCallback(
    (documentId: string) => {
      if (
        runtime.status !== "ready" ||
        activeWork === undefined ||
        runtime.activeDocumentId === null
      ) {
        return;
      }
      const result = closeDocumentTab({
        session: documentTabSession,
        workId: activeWork.workId,
        orderedDocumentIds: activeWorkDocumentIds,
        activeDocumentId: runtime.activeDocumentId,
        documentId,
      });
      if (!result.closed) {
        return;
      }
      if (
        result.nextActiveDocumentId === runtime.activeDocumentId
      ) {
        setDocumentTabSession(result.session);
        return;
      }
      const nextActiveDocument = activeWorkDocuments.find(
        (document) =>
          document.documentId === result.nextActiveDocumentId,
      );
      if (nextActiveDocument === undefined) {
        return;
      }

      void activateWorkspaceLocation({
        schemaVersion: 1,
        workId: activeWork.workId,
        documentId: nextActiveDocument.documentId,
      })
        .then(() => {
          setDocumentTabSession(result.session);
        })
        .catch(() => undefined);
    },
    [
      activeWork,
      activeWorkDocumentIds,
      activeWorkDocuments,
      activateWorkspaceLocation,
      documentTabSession,
      runtime,
    ],
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
        data-ui-model="eum-studio-editor"
      >
        <header
          className={
            embedded
              ? "manuscript-header manuscript-header-embedded eum-editor-breadcrumb"
              : "manuscript-header"
          }
        >
          <div className="manuscript-title-block">
            <div className="manuscript-title-line manuscript-work-title-line">
              <p className="manuscript-context">
                {embedded
                  ? (activeWork?.title ?? "쓰기")
                  : "로컬 편집 표면"}
              </p>
            </div>
            {titleEditTarget === "work" && (
              <RenameTitleForm
                itemLabel="작품"
                onCancel={() => {
                  setTitleEditTarget(null);
                  setTitleEditValue("");
                  setWorkspaceActionError(null);
                }}
                onChange={setTitleEditValue}
                onSubmit={() => {
                  void renameActiveWork().catch(() => undefined);
                }}
                submitting={workspaceActionState === "renaming-work"}
                value={titleEditValue}
              />
            )}
            <div className="manuscript-title-line">
              <h2
                data-testid={embedded ? "manuscript-title" : undefined}
                id="manuscript-heading"
              >
                {embedded ? (activeDocument?.label ?? "원고") : "원고"}
              </h2>
            </div>
            {titleEditTarget === "document" && (
              <RenameTitleForm
                itemLabel="회차"
                onCancel={() => {
                  setTitleEditTarget(null);
                  setTitleEditValue("");
                  setWorkspaceActionError(null);
                }}
                onChange={setTitleEditValue}
                onSubmit={() => {
                  void renameActiveDocument().catch(() => undefined);
                }}
                submitting={workspaceActionState === "renaming-document"}
                value={titleEditValue}
              />
            )}
          </div>
          <div className="manuscript-tools">
            <ManuscriptCount telemetryStore={telemetryStore} />
            {embedded && (
              <p
                aria-label="작업공간 상태"
                className="runtime-status runtime-status-embedded"
                data-runtime-status={runtime.status}
                data-testid="runtime-status"
              >
                <span aria-hidden="true" className="runtime-dot" />
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
            sharesDocumentRailWithSidebar
              ? "workspace-body workspace-body-shared-left-rail"
              : "workspace-body"
          }
          ref={workspaceBodyRef}
        >
          {runtime.status === "ready" &&
            activeWork !== undefined &&
            activeDocument === undefined &&
            sharesDocumentRailWithSidebar &&
            renderInHost(
              <aside
                aria-label="문서 레일"
                className="workspace-rail workspace-rail-left"
                id={documentRailId}
              >
                <header className="workspace-rail-header">
                  <div className="workspace-rail-title">
                    <h3>{activeWork.title}</h3>
                    <button
                      aria-label="작품 이름 변경"
                      className="title-edit-button"
                      disabled={
                        workspaceActionState !== "idle" ||
                        titleEditTarget !== null ||
                        showCreateDocument
                      }
                      onClick={() => {
                        setTitleEditTarget("work");
                        setTitleEditValue(activeWork.title);
                        setWorkspaceActionError(null);
                      }}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={13} />
                    </button>
                  </div>
                </header>
                <p className="empty-document-rail-state">
                  이 작품에는 회차가 없습니다.
                </p>
                <DocumentFolderTree
                  activeDocumentId={runtime.activeDocumentId}
                  disabled={workspaceActionState !== "idle"}
                  documentCreateControl={
                    <CreateDocumentControl
                      disabled={
                        workspaceActionState !== "idle" ||
                        titleEditTarget !== null
                      }
                      onCancel={() => {
                        setNewDocumentTitle("");
                        setShowCreateDocument(false);
                        setWorkspaceActionError(null);
                      }}
                      onChange={setNewDocumentTitle}
                      onStart={() => {
                        setWorkspaceActionError(null);
                        setShowCreateDocument(true);
                      }}
                      onSubmit={() => {
                        void createDocument(newDocumentTitle).catch(
                          () => undefined,
                        );
                      }}
                      value={newDocumentTitle}
                      visible={showCreateDocument}
                    />
                  }
                  onActivateDocument={activateDocumentById}
                  onRenameDocument={(document) => {
                    setTitleEditTarget("document");
                    setTitleEditValue(document.title);
                    setWorkspaceActionError(null);
                  }}
                  onCreateFolder={createDocumentFolder}
                  onPlaceDocument={placeDocumentInFolder}
                  onRenameFolder={renameDocumentFolder}
                  onRetireFolder={retireDocumentFolder}
                  work={activeWork}
                />
                {workspaceActionError !== null && (
                  <p className="workspace-action-error" role="alert">
                    {workspaceActionError}
                  </p>
                )}
              </aside>,
              documentRailHost,
            )}
          {runtime.status === "ready" &&
            activeWork !== undefined &&
            activeDocument !== undefined &&
            (sharesDocumentRailWithSidebar || railProjection?.left.visible) &&
            renderInHost(
              <aside
                aria-label="문서 레일"
                className="workspace-rail workspace-rail-left"
                id={documentRailId}
              >
                <header className="workspace-rail-header">
                  <div className="workspace-rail-title">
                    <h3>{activeWork.title}</h3>
                    <button
                      aria-label="작품 이름 변경"
                      className="title-edit-button"
                      disabled={
                        workspaceActionState !== "idle" ||
                        titleEditTarget !== null ||
                        showCreateDocument
                      }
                      onClick={() => {
                        setTitleEditTarget("work");
                        setTitleEditValue(activeWork.title);
                        setWorkspaceActionError(null);
                      }}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={13} />
                    </button>
                  </div>
                  {!sharesDocumentRailWithSidebar && (
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
                  )}
                </header>
                <DocumentFolderTree
                  activeDocumentId={runtime.activeDocumentId}
                  disabled={
                    workspaceActionState !== "idle" ||
                    titleEditTarget !== null
                  }
                  documentCreateControl={
                    <CreateDocumentControl
                      disabled={
                        workspaceActionState !== "idle" ||
                        titleEditTarget !== null
                      }
                      onCancel={() => {
                        setNewDocumentTitle("");
                        setShowCreateDocument(false);
                        setWorkspaceActionError(null);
                      }}
                      onChange={setNewDocumentTitle}
                      onStart={() => {
                        setWorkspaceActionError(null);
                        setShowCreateDocument(true);
                      }}
                      onSubmit={() => {
                        void createDocument(newDocumentTitle).catch(
                          () => undefined,
                        );
                      }}
                      value={newDocumentTitle}
                      visible={showCreateDocument}
                    />
                  }
                  onActivateDocument={activateDocumentById}
                  onRenameDocument={(document) => {
                    setTitleEditTarget("document");
                    setTitleEditValue(document.title);
                    setWorkspaceActionError(null);
                  }}
                  onCreateFolder={createDocumentFolder}
                  onPlaceDocument={placeDocumentInFolder}
                  onRenameFolder={renameDocumentFolder}
                  onRetireFolder={retireDocumentFolder}
                  work={activeWork}
                />
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
            !sharesDocumentRailWithSidebar &&
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
              <nav
                aria-label="열린 회차 탭"
                className="document-tab-strip"
              >
                <div className="document-tab-list" role="tablist">
                  {openDocuments.map((document) => {
                    const isActive =
                      document.documentId === runtime.activeDocumentId;
                    return (
                      <div
                        className={
                          isActive
                            ? "document-tab-item document-tab-item-active"
                            : "document-tab-item"
                        }
                        key={document.documentId}
                      >
                        <button
                          aria-selected={isActive}
                          className="document-tab-activate"
                          disabled={
                            workspaceActionState !== "idle" ||
                            titleEditTarget !== null
                          }
                          onClick={() =>
                            activateDocumentById(document.documentId)
                          }
                          role="tab"
                          tabIndex={isActive ? 0 : -1}
                          type="button"
                        >
                          {document.label}
                        </button>
                        <button
                          aria-label={`${document.label} 탭 닫기`}
                          className="document-tab-close"
                          disabled={
                            openDocuments.length === 1 ||
                            workspaceActionState !== "idle" ||
                            titleEditTarget !== null
                          }
                          onClick={() =>
                            closeDocumentTabById(document.documentId)
                          }
                          title="탭 닫기"
                          type="button"
                        >
                          <X aria-hidden="true" size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </nav>
            )}
            {runtime.status === "ready" && activeDocument !== undefined && (
                <ManuscriptEditor
                accessibleName="원고"
                activeDocument={activeDocument}
                formattingProfile={runtime.formattingProfile}
                inputProfile={runtime.inputProfile}
                loreEntries={activeWorkLoreEntries}
                orderedDocuments={activeWorkDocuments}
                onBlur={handleEditorBlur}
                onCompositionEnd={handleCompositionEnd}
                onDocumentActivated={handleDocumentActivated}
                onFormattingChange={handleFormattingChange}
                onLoreCueHover={handleLoreCueHover}
                onOpenLoreCue={openLoreCueInspector}
                onOpenContinuousReading={() => {
                  void openContinuousReading();
                }}
                onOpenPreflight={openManuscriptPreflight}
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
            {preflightActionError !== null && (
              <p className="preflight-open-error" role="alert">
                {preflightActionError}
              </p>
            )}
            {continuousReadingOpenError !== null && (
              <p className="preflight-open-error" role="alert">
                {continuousReadingOpenError}
              </p>
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
                  <div>
                    <p className="review-inspector-kicker">원고 도구</p>
                    <h3>검토</h3>
                  </div>
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
                <div
                  aria-label="검토 범위"
                  className="review-inspector-tabs"
                  role="tablist"
                >
                  <button
                    aria-controls={reviewRailId}
                    aria-selected={reviewInspectorTab === "document"}
                    id={reviewDocumentTabId}
                    onClick={() => setReviewInspectorTab("document")}
                    role="tab"
                    type="button"
                  >
                    회차
                  </button>
                  <button
                    aria-controls={reviewRailId}
                    aria-selected={reviewInspectorTab === "work"}
                    id={reviewWorkTabId}
                    onClick={() => setReviewInspectorTab("work")}
                    role="tab"
                    type="button"
                  >
                    작품
                  </button>
                  <button
                    aria-controls={reviewRailId}
                    aria-selected={reviewInspectorTab === "versions"}
                    id={reviewVersionsTabId}
                    onClick={() => setReviewInspectorTab("versions")}
                    role="tab"
                    type="button"
                  >
                    버전
                  </button>
                </div>
                <div
                  aria-labelledby={
                    reviewInspectorTab === "document"
                      ? reviewDocumentTabId
                      : reviewInspectorTab === "work"
                        ? reviewWorkTabId
                        : reviewVersionsTabId
                  }
                  className="review-inspector-panel"
                  role="tabpanel"
                >
                  <div
                    className="review-inspector-section-stack"
                    hidden={reviewInspectorTab !== "document"}
                  >
                    <ManuscriptReviewSummary
                      telemetryStore={telemetryStore}
                    />
                    {pinnedLoreCue !== null &&
                      pinnedLoreCue.workId === activeDocument.workId &&
                      pinnedLoreCue.documentId === activeDocument.documentId && (
                        <LoreCueInspector
                          cue={pinnedLoreCue}
                          entries={activeWorkLoreEntries}
                          error={loreCueActionError}
                          onClose={() => {
                            setPinnedLoreCue(null);
                            setLoreCueActionError(null);
                          }}
                          onSelectOccurrence={selectLoreCueOccurrence}
                        />
                      )}
                  </div>
                  <div
                    className="review-inspector-section-stack"
                    hidden={reviewInspectorTab !== "work"}
                  >
                <section
                  aria-label="별빛 검토함"
                  className="character-manager-rail lore-candidate-rail"
                >
                  <header>
                    <h4>별빛 검토함</h4>
                    <span>
                      {activeWorkLoreCandidates.filter(
                        (candidate) => candidate.status === "pending",
                      ).length}
                    </span>
                  </header>
                  <button
                    className="create-event-button lore-candidate-open-button"
                    disabled={loreCandidateActionState !== "idle"}
                    onClick={() => {
                      void openLoreCandidateDialog();
                    }}
                    type="button"
                  >
                    별빛 후보 검토하기
                  </button>
                  <p>
                    {hasManuscriptSelection
                      ? "현재 선택으로 승인 전 후보를 만들 수 있습니다."
                      : "원문 근거와 승인·거절 기록을 확인합니다."}
                  </p>
                </section>
                {loreCandidateActionError !== null &&
                  !loreCandidateDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {loreCandidateActionError}
                    </p>
                  )}
                <section
                  aria-label="조수 접근 권한"
                  className="character-manager-rail assistant-context-rail"
                >
                  <header>
                    <h4>조수 권한</h4>
                    <span>{activeAssistantGrantCount}</span>
                  </header>
                  <button
                    className="create-event-button assistant-context-open-button"
                    onClick={() => {
                      void openAssistantContextDialog();
                    }}
                    type="button"
                  >
                    권한·접근 기록 열기
                  </button>
                  <p>기능별 읽기·전송 범위와 기간을 승인하고 철회합니다.</p>
                </section>
                <section
                  aria-label="작품 파편"
                  className="fragment-shelf-rail"
                >
                  <header>
                    <h4>파편</h4>
                    <span>{fragments.length}</span>
                  </header>
                  <button
                    className="create-event-button fragment-shelf-open-button"
                    onClick={() => {
                      setFragmentActionError(null);
                      setFragmentDialogOpen(true);
                    }}
                    type="button"
                  >
                    파편 서랍 열기
                  </button>
                  <p>
                    {hasManuscriptSelection
                      ? "현재 선택을 그대로 복사할 수 있습니다."
                      : "원고를 선택하면 새 파편으로 복사할 수 있습니다."}
                  </p>
                </section>
                {fragmentActionError !== null && !fragmentDialogOpen && (
                  <p className="event-action-error" role="alert">
                    {fragmentActionError}
                  </p>
                )}
                <section
                  aria-label="작품 복선"
                  className="foreshadow-line-rail"
                >
                  <header>
                    <h4>복선</h4>
                    <span>{foreshadowLines.length}</span>
                  </header>
                  <button
                    className="create-event-button foreshadow-line-open-button"
                    onClick={() => {
                      setSelectedForeshadowLineId(null);
                      setForeshadowLineActionError(null);
                      setForeshadowLineDialogOpen(true);
                    }}
                    type="button"
                  >
                    복선 라인 열기
                  </button>
                  <p>
                    {hasManuscriptSelection
                      ? "현재 선택을 복선 지점으로 연결할 수 있습니다."
                      : "복선 이름·메모와 연결된 원고 지점을 관리합니다."}
                  </p>
                </section>
                {foreshadowLineActionError !== null &&
                  !foreshadowLineDialogOpen && (
                    <p className="event-action-error" role="alert">
                      {foreshadowLineActionError}
                    </p>
                  )}
                <section
                  aria-label="작품 인물"
                  className="character-manager-rail"
                >
                  <header>
                    <h4>인물</h4>
                    <span>{activeWorkCharacters.length}</span>
                  </header>
                  <button
                    className="create-event-button character-manager-open-button"
                    onClick={() => {
                      setCharacterActionError(null);
                      setCharacterDialogOpen(true);
                    }}
                    type="button"
                  >
                    인물 관리 열기
                  </button>
                  <p>이름·역할·요약·작가 메모를 관리합니다.</p>
                </section>
                {characterActionError !== null && !characterDialogOpen && (
                  <p className="event-action-error" role="alert">
                    {characterActionError}
                  </p>
                )}
                <section
                  aria-label="작품 플롯"
                  className="character-manager-rail plot-manager-rail"
                >
                  <header>
                    <h4>플롯</h4>
                    <span>{activeWorkPlots.length}</span>
                  </header>
                  <button
                    className="create-event-button plot-manager-open-button"
                    onClick={() => {
                      setPlotActionError(null);
                      setPlotDialogOpen(true);
                    }}
                    type="button"
                  >
                    플롯 관리 열기
                  </button>
                  <p>제목·단계·요약·작가 메모를 관리합니다.</p>
                </section>
                {plotActionError !== null && !plotDialogOpen && (
                  <p className="event-action-error" role="alert">
                    {plotActionError}
                  </p>
                )}
                <section
                  aria-label="작품 구조"
                  className="character-manager-rail work-structure-rail"
                >
                  <header>
                    <h4>작품 구조</h4>
                    <span>{workStructureOverview?.totals.documents ?? 0}</span>
                  </header>
                  <button
                    className="create-event-button work-structure-open-button"
                    disabled={
                      workStructureOverview === null ||
                      workStructureActionState !== "idle"
                    }
                    onClick={() => {
                      setWorkStructureActionError(null);
                      setWorkStructureDialogOpen(true);
                    }}
                    type="button"
                  >
                    작품 구조 열기
                  </button>
                  <p>
                    회차·인물·플롯·사건·장면을 한 화면에서 봅니다.
                  </p>
                </section>
                  </div>
                  <div
                    className="review-inspector-section-stack"
                    hidden={reviewInspectorTab !== "document"}
                  >
                <CreateEventBlockButton
                  busy={eventActionState !== "idle"}
                  onClick={openEventBlockDialog}
                  telemetryStore={telemetryStore}
                />
                <button
                  className="create-event-button"
                  disabled={eventActionState !== "idle" || activeWork === undefined}
                  onClick={openAnchorlessEventDialog}
                  type="button"
                >
                  예정 사건 추가
                </button>
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
                <EventRail
                  eventBusy={eventActionState !== "idle"}
                  mode={eventRailMode}
                  onCreatePlot={(eventBlock) => {
                    void createPlotFromEventBlock(eventBlock);
                  }}
                  onLinkSource={(eventBlock) => {
                    void linkEventSource(eventBlock);
                  }}
                  onModeChange={setEventRailMode}
                  onMovePlacement={(placement, target) => {
                    void movePlotPlacement(placement, target);
                  }}
                  onOpenSource={(location) => {
                    void openEventRailSource(location);
                  }}
                  onReplaceSource={(source) => {
                    void replaceEventSource(source);
                  }}
                  onRetireSource={(source) => {
                    void retireEventSource(source);
                  }}
                  plotBusy={plotActionState !== "idle"}
                  projection={
                    eventRail?.workId === activeWorkId ? eventRail : null
                  }
                />
                <SceneList
                  activeDocumentId={activeDocument?.documentId ?? null}
                  busy={sceneActionState !== "idle"}
                  onMergeWithPrevious={(scene, previousScene) => {
                    void mergeSceneWithPrevious(scene, previousScene);
                  }}
                  onOpenScene={focusScene}
                  onSetEventOverride={(
                    scene,
                    eventBlockId,
                    operation,
                    expectedRevision,
                  ) => {
                    void setSceneEventOverride(
                      scene,
                      eventBlockId,
                      operation,
                      expectedRevision,
                    );
                  }}
                  onSplitScene={() => {
                    void createSceneBoundary("split");
                  }}
                  onUpdateRuleSet={(draft) => {
                    void updateSceneRuleSet(draft);
                  }}
                  projection={
                    sceneProjection?.workId === activeWorkId
                      ? sceneProjection
                      : null
                  }
                />
                  </div>
                  <div
                    className="review-inspector-section-stack"
                    hidden={reviewInspectorTab !== "versions"}
                  >
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
                            <button
                              aria-label={`${snapshot.label} 스냅샷 비교`}
                              disabled={versionActionState !== "idle"}
                              onClick={() => {
                                void compareWorkSnapshot(snapshot.workSnapshotId);
                              }}
                              type="button"
                            >
                              비교
                            </button>
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
                  </div>
                </div>
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
              {activeWritingSession !== undefined && (
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
              {activePomodoroPhase !== null &&
              pomodoro?.settings !== null &&
              pomodoro?.settings !== undefined ? (
                <span
                  className="activity-timer focus-timer pomodoro-timer"
                  data-testid="pomodoro-timer"
                  title={
                    activePomodoroPhase.pauseReason === "restore"
                      ? "이전 실행에서 안전하게 일시정지되었습니다."
                      : activePomodoroPhase.pauseReason === "phase-complete"
                        ? "다음 단계를 시작할 때까지 일시정지되었습니다."
                        : `${activePomodoroPhase.phase === "work" ? "작업" : "휴식"} · ${formatTimerDuration(activePomodoroPhase.targetDurationMs)}`
                  }
                >
                  <span>
                    {activePomodoroPhase.phase === "work" ? "작업" : "휴식"}{" "}
                    {activePomodoroPhase.cycleNumber}/
                    {pomodoro.settings.workCycleCount}
                  </span>
                  <output aria-live="polite">
                    {formatTimerDuration(
                      activePomodoroPhase.state === "running"
                        ? remainingTimerMs(
                            activePomodoroPhase.deadlineAt,
                            activityClock,
                          )
                        : activePomodoroPhase.remainingDurationMs,
                    )}
                  </output>
                  <button
                    disabled={activityActionState !== "idle"}
                    onClick={() => {
                      if (activePomodoroPhase.state === "running") {
                        void pausePomodoro();
                      } else {
                        void resumePomodoro();
                      }
                    }}
                    type="button"
                  >
                    {activePomodoroPhase.state === "running"
                      ? "일시정지"
                      : "재개"}
                  </button>
                  <button
                    disabled={activityActionState !== "idle"}
                    onClick={() => {
                      void stopPomodoro();
                    }}
                    type="button"
                  >
                    종료
                  </button>
                </span>
              ) : activeFocusCycle === undefined ? (
                <button
                  disabled={
                    workActivity === null ||
                    pomodoro === null ||
                    activityActionState !== "idle"
                  }
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
              {pomodoro?.status === "completed" &&
                pomodoro.settings !== null && (
                  <span
                    className="activity-completion"
                    data-testid="pomodoro-completed"
                  >
                    집중 주기 완료 {pomodoro.completedWorkCycles}/
                    {pomodoro.settings.workCycleCount}
                  </span>
                )}
              {activityActionError !== null && (
                <span className="activity-status-error" role="alert">
                  {activityActionError}
                </span>
              )}
            </div>
          )}
          {embedded &&
            activeDocument !== undefined &&
            workActivity !== null &&
            dailyGoals !== null && (
              <DailyGoalStatus
                activity={workActivity}
                nowMs={activityClock}
                onOpen={() => {
                  setDailyGoalError(null);
                  setShowDailyGoalDialog(true);
                }}
                settings={dailyGoals}
              />
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
        {workSnapshotComparison !== null && (
          <WorkSnapshotComparisonDialog
            onClose={() => {
              versionLoadSequenceRef.current += 1;
              setWorkSnapshotComparison(null);
            }}
            projection={workSnapshotComparison}
          />
        )}
        {showFocusDialog && (
          <PomodoroDialog
            error={activityActionError}
            onCancel={() => {
              if (activityActionState === "idle") {
                setShowFocusDialog(false);
                setActivityActionError(null);
              }
            }}
            onSubmit={(input) => {
              void configureAndStartPomodoro(input);
            }}
            settings={
              activeWorkId !== null && pomodoro?.workId === activeWorkId
                ? pomodoro.settings
                : null
            }
            submitting={activityActionState === "starting-focus"}
          />
        )}
        {showDailyGoalDialog &&
          workActivity !== null &&
          pomodoro !== null &&
          dailyGoals !== null && (
            <DailyGoalDialog
              activity={workActivity}
              error={dailyGoalError}
              nowMs={activityClock}
              onClose={() => {
                if (dailyGoalActionState === "idle") {
                  setShowDailyGoalDialog(false);
                  setDailyGoalError(null);
                }
              }}
              onSave={(goals: WorkRecordsGoals) => {
                setDailyGoalActionState("saving");
                setDailyGoalError(null);
                void window.eumStudio.activity
                  .saveRecordsGoals({
                    schemaVersion: 1,
                    workId: dailyGoals.workId,
                    expectedRevision: dailyGoals.revision,
                    goals,
                  })
                  .then(
                    (projection) => {
                      setDailyGoals(projection);
                      setDailyGoalActionState("idle");
                      setShowDailyGoalDialog(false);
                    },
                    () => {
                      setDailyGoalError("오늘 목표를 저장하지 못했습니다.");
                      setDailyGoalActionState("idle");
                    },
                  );
              }}
              pomodoro={pomodoro}
              saving={dailyGoalActionState === "saving"}
              settings={dailyGoals}
            />
          )}
        {runtime.status === "ready" &&
          pendingManuscriptPreflight !== null && (
            <ManuscriptPreflightDialog
              documentLabel={pendingManuscriptPreflight.document.label}
              manuscript={pendingManuscriptPreflight.manuscript}
              onApply={applyManuscriptPreflight}
              onClose={closeManuscriptPreflight}
              onExport={exportManuscriptPreflight}
              onSaveSettings={saveManuscriptPreflightSettings}
              profile={runtime.preflightProfile}
              selection={pendingManuscriptPreflight.selection}
              settingsProjection={
                pendingManuscriptPreflight.settingsProjection
              }
            />
          )}
        {continuousReadingDialogState.status === "ready" && (
          <ContinuousReadingDialog
            onClose={closeContinuousReading}
            onProgress={persistContinuousReadingLocation}
            session={continuousReadingDialogState.session}
          />
        )}
        {runtime.status === "ready" &&
          assistantConnectionsDialogOpen && (
            <AssistantConnectionsDialog
              actionState={assistantConnectionsActionState}
              connections={assistantConnections}
              connectorProfile={assistantConnectorProfile}
              error={assistantConnectionsActionError}
              key={assistantConnections
                .map((connection) =>
                  `${connection.connectionId}:${connection.revision}`
                )
                .join("|")}
              onClose={() => {
                if (assistantConnectionsActionState === "idle") {
                  setAssistantConnectionsDialogOpen(false);
                  setAssistantConnectionsActionError(null);
                  void openAssistantContextDialog();
                }
              }}
              onDelete={(connection) => {
                void deleteAssistantConnection(connection);
              }}
              onSave={(draft) => {
                void saveAssistantConnection(draft);
              }}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          assistantContextDialogOpen && (
            <AssistantContextDialog
              actionState={assistantContextActionState}
              canRunExternalSettingReview={activeDocument !== undefined}
              canRunNotationReview={hasManuscriptSelection}
              canRunVocabularyLookup={hasManuscriptSelection}
              connections={assistantConnections}
              destinationProfile={assistantDestinationProfile}
              documentLabels={activeWorkDocumentLabels}
              error={assistantContextActionError}
              onClose={() => {
                if (assistantContextActionState === "idle") {
                  assistantContextLoadSequenceRef.current += 1;
                  setAssistantContextDialogOpen(false);
                  setAssistantContextActionError(null);
                }
              }}
              onGrant={(draft) => {
                void grantAssistantContextPermission(draft);
              }}
              onOpenConnections={() => {
                if (assistantContextActionState === "idle") {
                  assistantContextLoadSequenceRef.current += 1;
                  setAssistantContextDialogOpen(false);
                  setAssistantContextActionError(null);
                  void openAssistantConnectionsDialog();
                }
              }}
              onOpenNotationFinding={(finding) => {
                void openAssistantVocabularyOccurrence(finding.range);
              }}
              onOpenSettingReference={openAssistantSettingReference}
              onOpenVocabularyOccurrence={(occurrence) => {
                void openAssistantVocabularyOccurrence(occurrence);
              }}
              onRevoke={(grant) => {
                void revokeAssistantContextPermission(grant);
              }}
              onRunSettingReview={(destinationId) => {
                void runAssistantSettingReview(destinationId);
              }}
              onRunNotationReview={(destinationId) => {
                void runAssistantNotationReview(destinationId);
              }}
              onRunVocabularyLookup={(destinationId) => {
                void runAssistantVocabularyLookup(destinationId);
              }}
              onRunVocabularySuggestion={(input) => {
                void runAssistantVocabularySuggestion(input);
              }}
              onRunExternalSettingReview={(input) => {
                void runAssistantExternalSettingReview(input);
              }}
              projection={
                assistantContextProjection?.workId === activeWork.workId
                  ? assistantContextProjection
                  : null
              }
              workTitle={activeWork.title}
            />
          )}
        {runtime.status === "ready" &&
          workStructureOverview !== null &&
          workStructureDialogOpen && (
            <WorkStructureDialog
              busy={workStructureActionState !== "idle"}
              error={workStructureActionError}
              loreEntryCount={activeWorkLoreEntries.length}
              onClose={() => {
                if (workStructureActionState === "idle") {
                  setWorkStructureDialogOpen(false);
                  setWorkStructureActionError(null);
                }
              }}
              onOpenCharacter={openWorkStructureCharacter}
              onOpenDocument={(document) => {
                void openWorkStructureDocument(document);
              }}
              onOpenEvent={openWorkStructureEvent}
              onOpenLore={openWorkStructureLore}
              onOpenPlot={openWorkStructurePlot}
              onOpenPlotSource={openWorkStructurePlotSource}
              onOpenScene={openWorkStructureScene}
              projection={workStructureOverview}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          loreCandidateDialogOpen && (
            <LoreCandidateDialog
              actionState={loreCandidateActionState}
              canCapture={
                activeDocument !== undefined && hasManuscriptSelection
              }
              candidates={activeWorkLoreCandidates}
              documentLabels={activeWorkDocumentLabels}
              entries={activeWorkLoreEntries}
              error={loreCandidateActionError}
              onApprove={(candidate) => {
                void approveLoreCandidate(candidate);
              }}
              onClose={() => {
                if (loreCandidateActionState === "idle") {
                  setLoreCandidateDialogOpen(false);
                  setLoreCandidateActionError(null);
                }
              }}
              onCreate={(draft) => {
                void createLoreCandidate(draft);
              }}
              onOpenEvidence={(candidate) => {
                void openLoreCandidateEvidence(candidate);
              }}
              onReject={(candidate) => {
                void rejectLoreCandidate(candidate);
              }}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          loreDialogOpen && (
            <LoreManagerDialog
              actionState={loreActionState}
              canCaptureEvidence={
                activeDocument !== undefined && hasManuscriptSelection
              }
              documentLabels={activeWorkDocumentLabels}
              entries={activeWorkLoreEntries}
              error={loreActionError}
              foreshadowLines={foreshadowLines}
              loreForeshadowLinks={activeWorkLoreForeshadowLinks}
              onAddEvidence={(entry) => {
                void addLoreEntryEvidence(entry);
              }}
              onClose={() => {
                if (loreActionState === "idle") {
                  setLoreDialogOpen(false);
                  setLoreActionError(null);
                }
              }}
              onCreate={(draft) => {
                void createLoreEntry(draft);
              }}
              onOpenEvidence={(evidence) => {
                void openLoreEntryEvidence(evidence);
              }}
              onLinkForeshadow={(entry, lineId) => {
                const line = foreshadowLines.find(
                  (candidate) => candidate.lineId === lineId,
                );
                if (line !== undefined) {
                  void linkLoreForeshadow(entry, line, "lore");
                }
              }}
              onRetire={(entry) => {
                void retireLoreEntry(entry);
              }}
              onSelect={setSelectedLoreEntryId}
              onUpdate={(entry, changes) => {
                void updateLoreEntry(entry, changes);
              }}
              onUnlinkForeshadow={(link) => {
                void unlinkLoreForeshadow(link, "lore");
              }}
              selectedLoreEntryId={activeSelectedLoreEntryId}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          characterDialogOpen && (
            <CharacterManagerDialog
              actionState={characterActionState}
              characters={activeWorkCharacters}
              error={characterActionError}
              onClose={() => {
                if (characterActionState === "idle") {
                  setCharacterDialogOpen(false);
                  setCharacterActionError(null);
                }
              }}
              onCreate={(draft) => {
                void createCharacter(draft);
              }}
              onRetire={(character) => {
                void retireCharacter(character);
              }}
              onSelect={setSelectedCharacterId}
              onUpdate={(character, changes) => {
                void updateCharacter(character, changes);
              }}
              selectedCharacterId={activeSelectedCharacterId}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          plotDialogOpen && (
            <PlotManagerDialog
              actionState={plotActionState}
              board={plotBoard}
              canCreateEventFromSelection={
                activeDocument !== undefined && hasManuscriptSelection
              }
              canLinkSource={
                activeDocument !== undefined && hasManuscriptSelection
              }
              documentLabels={activeWorkDocumentLabels}
              error={plotActionError}
              eventBlocks={activeWorkEventBlocks}
              eventLinks={activeWorkPlotEventLinks}
              onClose={() => {
                if (plotActionState === "idle") {
                  setPlotDialogOpen(false);
                  setPlotActionError(null);
                }
              }}
              onCreate={(draft) => {
                void createPlotThread(draft);
              }}
              onCreateEvent={(plot, exactSelection) => {
                void createEventFromPlot(plot, exactSelection);
              }}
              onLinkEvent={(plot, eventBlockId, role) => {
                void linkPlotEvent(plot, eventBlockId, role);
              }}
              onRetire={(plot) => {
                void retirePlotThread(plot);
              }}
              onLinkSource={(plot) => {
                void linkPlotThreadSource(plot);
              }}
              onMovePlacement={movePlotPlacement}
              onSetStoryTime={setPlotPlacementStoryTime}
              onOpenSource={(source) => {
                void openPlotThreadSource(source);
              }}
              onSelect={setSelectedPlotThreadId}
              onUpdate={(plot, changes) => {
                void updatePlotThread(plot, changes);
              }}
              onUnlinkEvent={(link) => {
                void unlinkPlotEvent(link);
              }}
              plots={activeWorkPlots}
              sources={activeWorkPlotSources}
              selectedPlotThreadId={activeSelectedPlotThreadId}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          fragmentDialogOpen && (
            <FragmentShelfDialog
              actionState={fragmentActionState}
              canCapture={
                activeDocument !== undefined && hasManuscriptSelection
              }
              canInsert={
                activeDocument !== undefined && !hasManuscriptSelection
              }
              documentLabels={activeWorkDocumentLabels}
              error={fragmentActionError}
              fragments={fragments}
              onCapture={(kindId) => {
                void captureFragment(kindId);
              }}
              onClose={() => {
                if (fragmentActionState === "idle") {
                  setFragmentDialogOpen(false);
                  setFragmentActionError(null);
                }
              }}
              onInsert={(fragment) => {
                void insertFragmentAtCursor(fragment);
              }}
              onMove={(kindId) => {
                void moveSelectionToFragment(kindId);
              }}
              onOpenSource={(fragment) => {
                void openFragmentSource(fragment);
              }}
              onRetire={(fragment) => {
                void retireFragment(fragment);
              }}
              onUpdate={(fragment, changes) => {
                void updateFragment(fragment, changes);
              }}
              profile={runtime.fragmentProfile}
            />
          )}
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          foreshadowLineDialogOpen && (
            <ForeshadowLineDialog
              actionState={foreshadowLineActionState}
              canCapture={
                activeDocument !== undefined && hasManuscriptSelection
              }
              documentLabels={activeWorkDocumentLabels}
              error={foreshadowLineActionError}
              lines={foreshadowLines}
              loreEntries={activeWorkLoreEntries}
              loreForeshadowLinks={activeWorkLoreForeshadowLinks}
              onClose={() => {
                if (foreshadowLineActionState === "idle") {
                  setForeshadowLineDialogOpen(false);
                  setForeshadowLineActionError(null);
                }
              }}
              onCreate={(title, note) => {
                void createForeshadowLine(title, note);
              }}
              onCapture={(lineId, roleId, note) => {
                void captureForeshadowPoint(lineId, roleId, note);
              }}
              onOpenPoint={(point) => {
                void openForeshadowPointSource(point);
              }}
              onLinkLore={(line, loreEntryId) => {
                const entry = activeWorkLoreEntries.find(
                  (candidate) => candidate.loreEntryId === loreEntryId,
                );
                if (entry !== undefined) {
                  void linkLoreForeshadow(entry, line, "foreshadow");
                }
              }}
              onRetire={(line) => {
                void retireForeshadowLine(line);
              }}
              onUpdate={(line, changes) => {
                void updateForeshadowLine(line, changes);
              }}
              onUnlinkLore={(link) => {
                void unlinkLoreForeshadow(link, "foreshadow");
              }}
              points={foreshadowPoints}
              profile={runtime.foreshadowPointProfile}
              selectedLineId={selectedForeshadowLineId}
            />
          )}
        {hoveredLoreCue !== null &&
          createPortal(
            <LoreCueTooltip
              entries={activeWorkLoreEntries}
              interaction={hoveredLoreCue}
            />,
            document.body,
          )}
      </section>
    </section>
  );
});
