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
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Bot,
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
import { getPreviousEpisodeFlowPreviewText } from "../application/editor/previous-episode-flow";
import {
  serializeManuscriptEditorDocumentState,
  type ManuscriptEditorDocumentState,
  type ManuscriptFormattingProfile,
} from "../application/editor/manuscript-formatting";
import type {
  ManuscriptLayoutSettings,
  WorkManuscriptLayoutSettingsProjection,
} from "../application/editor/work-manuscript-layout-settings";
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
import type { EventBlockMoveTarget } from "../application/structure/event-outline-order";
import type {
  SceneEventOverrideOperation,
  SceneProjection,
  SceneProjectionList,
  UpdateSceneRuleSetCommand,
} from "../application/structure/scene-projection";
import type {
  SceneExtractionBoundary,
  SceneExtractionAnnotationDecision,
  SceneExtractionCandidate,
  SceneExtractionScene,
} from "../application/structure/scene-extraction-contract";
import type {
  SceneAnnotationProjection,
} from "../application/structure/scene-annotation-contract";
import type {
  SceneDraftCandidate,
} from "../application/structure/scene-draft-contract";
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
  CharacterRelationProjection,
  UpdateCharacterRelationCommand,
} from "../application/characters/character-relation-contract";
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
  WorkReadthroughEntry,
  WorkReadthroughProjection,
} from "../application/activity/work-readthrough-calculator";
import type {
  PomodoroProjection,
} from "../application/activity/pomodoro-contract";
import type {
  YouTubeMusicProfile,
  YouTubeVideoProjection,
} from "../application/music/youtube-music";
import {
  isYouTubeMusicTrack,
  musicTrackIdentity,
  type LocalMediaStorageMode,
  type MusicTrackProjection,
} from "../application/music/media-track";
import type {
  YouTubeMusicConnectionStatus,
} from "../application/music/youtube-music-connection";
import type { WorkMusicSettingsProjection } from "../application/music/work-music-settings";
import type { WorkInspirationSettingsProjection } from "../application/inspiration/work-inspiration-settings";
import type {
  CharacterDrawDraft,
  EventDrawDraft,
} from "../application/inspiration/inspiration-draw";
import {
  selectedSceneMusicQueueOption,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueOption,
} from "../application/music/scene-music-queue-contract";
import type {
  WorkRecordsGoals,
  WorkRecordsGoalsProjection,
} from "../application/activity/work-records-preferences";
import type { WorkCalendarProjection } from "../application/schedule/work-calendar-contract";
import type {
  DocumentRevisionContentProjection,
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
import {
  createChatGptOAuthAssistantConnectionId,
  type ChatGptOAuthConnectionStatus,
} from "../application/assistant/chatgpt-oauth";
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
  FOCUS_TYPEWRITER_POSITION_DEFAULT_PERCENT,
  FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
  FOCUS_TYPEWRITER_POSITION_MIN_PERCENT,
  FocusModeToolbar,
  type FocusModeToolbarProps,
} from "./editor/FocusModeToolbar";
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
  ForeshadowLineContent,
  type ForeshadowLineActionState,
} from "./editor/ForeshadowLineDialog";
import {
  CharacterManagerDialog,
  type CharacterDraft,
  type CharacterManagerActionState,
} from "./editor/CharacterManagerDialog";
import {
  CharacterCandidateReviewPanel,
  CharacterWorkspace,
  type CharacterExtractionActionState,
  type CharacterGenerationActionState,
  type CharacterRelationActionState,
  type CharacterRelationDraft,
  type CharacterWorkspaceSelection,
} from "./editor/CharacterWorkspace";
import type {
  CharacterExtractionCandidate,
  CharacterExtractionDecision,
  CharacterExtractionItem,
} from "../application/characters/character-extraction-contract";
import type {
  CharacterGenerationBrief,
  CharacterGenerationCandidate,
  CharacterGenerationItem,
} from "../application/characters/character-generation-contract";
import {
  PlotManagerDialog,
  type PlotDraft,
  type PlotManagerActionState,
  type PlotPlacementMoveTarget,
  type PlotStoryTimeTarget,
} from "./editor/PlotManagerDialog";
import {
  PlotWorkspace,
  type PlotWorkspaceTab,
} from "./editor/PlotWorkspace";
import { EventDrawTool } from "./editor/EventDrawTool";
import {
  BottomEventRail,
} from "./editor/BottomEventRail";
import { EventRail, type EventRailMode } from "./editor/EventRail";
import { SceneList } from "./editor/SceneList";
import {
  SceneDraftPanel,
  type SceneDraftActionState,
} from "./editor/SceneDraftPanel";
import {
  MusicMiniPlayer,
  type MusicPlaybackRequest,
} from "./music/MusicMiniPlayer";
import { MusicLibraryDialog } from "./music/MusicLibraryDialog";
import {
  SceneExtractionPanel,
  type SceneExtractionActionState,
  type SceneExtractionSelection,
} from "./editor/SceneExtractionPanel";
import type {
  ManuscriptSceneBoundaryPreview,
} from "./editor/scene-boundary-preview-extension";
import {
  LoreManagerDialog,
  LoreManagerContent,
  type LoreEntryDraft,
  type LoreManagerActionState,
} from "./editor/LoreManagerDialog";
import {
  LoreCandidateDialog,
  LoreCandidateContent,
  type LoreCandidateActionState,
  type LoreCandidateDraft,
} from "./editor/LoreCandidateDialog";
import {
  LoreCueInspector,
  LoreCueTooltip,
} from "./editor/LoreCueDisclosure";
import type { LoreCueInteraction } from "./editor/lore-cue-extension";
import {
  WorkStructureContent,
  WorkStructureDialog,
} from "./editor/WorkStructureDialog";
import { WorkSnapshotComparisonDialog } from "./editor/WorkSnapshotComparisonDialog";
import {
  AssistantContextDialog,
  type AssistantContextDialogActionState,
  type AssistantPermissionDraft,
} from "./assistant/AssistantContextDialog";
import { AssistantChatDialog } from "./assistant/AssistantChatDialog";
import type { AssistantChatMessage } from "../application/assistant/assistant-chat";
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
import {
  SessionFeedbackPanel,
  type SessionFeedbackPanelProps,
} from "./activity/SessionFeedbackPanel";
import {
  derivePomodoroPhaseAlert,
  playPomodoroPhaseAlertSound,
  PomodoroPhaseAlert,
  preparePomodoroPhaseAlertSound,
  type PomodoroPhaseAlertProjection,
} from "./activity/PomodoroPhaseAlert";
import {
  isDarkStarlightTheme,
  type StarlightThemeKey,
} from "./theme/starlight-theme";
import type { ManuscriptTransaction } from "./editor/manuscript-transaction";
import type { FocusModePreferences } from "../application/settings/ui-preferences";
import type { ManuscriptTextStatistics } from "./editor/manuscript-text-statistics";
import type { ManuscriptTextImportResult } from "../application/editor/manuscript-text-import";
import { ManuscriptTelemetryStore } from "./editor/manuscript-telemetry-store";
import { ForwardWritingGoalDialog } from "./editor/ForwardWritingMode";
import { ManuscriptAnalysisDialog } from "./editor/ManuscriptAnalysisDialog";
import { ManuscriptTextImportDialog } from "./editor/ManuscriptTextImportDialog";
import type { ManuscriptHeatmapMode } from "./editor/manuscript-analysis";
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
import {
  DEFAULT_REVIEW_TAB,
  DEFAULT_STRUCTURE_TAB,
  DEFAULT_WORK_SECTION,
  type ReviewTab,
  type StructureTab,
  type WorkSection,
} from "./navigation/studio-location";
import { WorkHeader } from "./workspace/WorkHeader";
import { DocumentCompletionControl } from "./workspace/DocumentCompletionControl";
import { useDialogDismiss } from "./dialog/useDialogDismiss";
import { StructureWorkspace } from "./workspace/StructureWorkspace";
import { ReviewWorkspace } from "./workspace/ReviewWorkspace";
import {
  WorkOperationsWorkspace,
  type WorkOperationsSection,
} from "./workspace/WorkOperationsWorkspace";
import { StructureOverviewPanel } from "./structure/StructureOverviewPanel";
import { PlotStructurePanel } from "./structure/PlotStructurePanel";
import { EventStructurePanel } from "./structure/EventStructurePanel";
import { SceneStructurePanel } from "./structure/SceneStructurePanel";
import { CharacterStructurePanel } from "./structure/CharacterStructurePanel";
import { ForeshadowStructurePanel } from "./structure/ForeshadowStructurePanel";
import { LoreStructurePanel } from "./structure/LoreStructurePanel";
import { WorkRecordsContent } from "./records/WorkRecordsDialog";
import { WorkRecordsPanel } from "./review/WorkRecordsPanel";
import { ManuscriptReviewPanel } from "./review/ManuscriptReviewPanel";
import { CandidateInboxPanel } from "./review/CandidateInboxPanel";
import { VersionPanel } from "./review/VersionPanel";
import { DocumentRevisionPreviewDialog } from "./review/DocumentRevisionPreviewDialog";
import { WorkScheduleDashboard } from "./schedule/WorkScheduleDashboard";
import {
  deriveWorkScheduleSummary,
  localDateKey,
} from "./schedule/work-schedule-summary";

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

type ReviewInspectorTab = "current" | "assistant" | "work" | "versions";

type WorkReturnLocation = Readonly<{
  section: "structure" | "review";
  tab: StructureTab | ReviewTab;
}>;

type PendingVisibleManuscriptSelection = Readonly<{
  documentId: ManuscriptDocumentSource["documentId"];
  kind:
    | "character"
    | "event"
    | "foreshadow"
    | "lore"
    | "loreCandidate"
    | "plot"
    | "scene"
    | "structure";
  range: Readonly<{ from: number; to: number }>;
  workId: ManuscriptDocumentSource["workId"];
}>;

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

type PendingCharacterEvidence = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly range: { readonly from: number; readonly to: number };
};

type PendingSceneBoundaryPreview = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly offset: number;
};

type PendingSceneDraftCompare = {
  readonly workId: ManuscriptDocumentSource["workId"];
  readonly documentId: ManuscriptDocumentSource["documentId"];
  readonly offset: number;
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
const FOCUS_TYPEWRITER_POSITION_STORAGE_KEY =
  "eum_focus_typewriter_position_percent";

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

function FocusModeToolbarWithTelemetry(
  input: Omit<FocusModeToolbarProps, "currentDocumentCharacterCount"> & {
    readonly telemetryStore: ManuscriptTelemetryStore;
  },
) {
  const { telemetryStore, ...toolbar } = input;
  const statistics = useSyncExternalStore(
    telemetryStore.subscribeStatistics,
    telemetryStore.getStatisticsSnapshot,
  );
  return (
    <FocusModeToolbar
      {...toolbar}
      currentDocumentCharacterCount={statistics.characterCount}
    />
  );
}

function SessionFeedbackWithTelemetry(
  input: Omit<SessionFeedbackPanelProps, "currentCharacterCount"> & {
    readonly telemetryStore: ManuscriptTelemetryStore;
  },
) {
  const { telemetryStore, ...feedback } = input;
  const statistics = useSyncExternalStore(
    telemetryStore.subscribeStatistics,
    telemetryStore.getStatisticsSnapshot,
  );
  return (
    <SessionFeedbackPanel
      {...feedback}
      currentCharacterCount={statistics.characterCount}
    />
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
  const onBackdropPointerDown = useDialogDismiss({
    disabled: input.submitting,
    onClose: input.onCancel,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      input.onSubmit({ title: title.trim(), note });
    }
  };
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
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
  readonly eventRailHost?: HTMLElement | null;
  readonly musicSettingsRevision?: number;
  readonly musicPlayerHost?: HTMLElement | null;
  readonly onCatalogChange?: (
    catalog: WorkspaceCatalogProjection,
  ) => void;
  readonly onResumePreviewChange?: (
    preview: ManuscriptResumePreview | null,
  ) => void;
  readonly focusModePreferences?: FocusModePreferences;
  readonly onFocusModePreferencesChange?: (
    preferences: FocusModePreferences,
  ) => void;
  readonly onOpenSettings?: () => void;
  readonly onOpenPublishing?: (
    section: WorkOperationsSection,
    workId: EntityId<"Work">,
  ) => void;
  readonly onReturnToWorks?: () => void;
  readonly onScheduleChange?: () => void;
  readonly scheduleSettingsRevision?: number;
  readonly onThemeChange?: (theme: StarlightThemeKey) => void;
  readonly theme?: StarlightThemeKey;
  readonly youtubeMusicConnectionStatus?: YouTubeMusicConnectionStatus | null;
};

export type ManuscriptResumePreview = Readonly<{
  workId: ManuscriptDocumentSource["workId"];
  documentId: ManuscriptDocumentSource["documentId"];
  text: string;
  formatting: Readonly<{
    fontFamily: string;
    fontSizePx: number;
    contentWidthPx: number;
    lineHeight: number;
    paragraphSpacingPx: number;
    letterSpacingEm: number;
  }>;
}>;

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
  readonly openSchedule: () => void;
  readonly openCompletedRevision: (
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
  ) => Promise<WorkspaceCatalogProjection>;
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
  disabled,
  onCreate,
}: {
  readonly disabled: boolean;
  readonly onCreate: () => void;
}) {
  return (
    <span className="create-document-control">
      <button
        aria-label="새 회차"
        className="create-document-button"
        disabled={disabled}
        onClick={onCreate}
        title="새 회차"
        type="button"
      >
        <Plus aria-hidden="true" size={16} />
      </button>
    </span>
  );
}

type DocumentDropPreview = Readonly<{
  sourceDocumentId: WorkspaceDocumentSummary["documentId"];
}> & (
  | Readonly<{
      kind: "document";
      targetDocumentId: WorkspaceDocumentSummary["documentId"];
      placement: "before" | "after";
    }>
  | Readonly<{
      kind: "folder";
      folderId: WorkspaceDocumentFolderSummary["folderId"] | null;
    }>
);

type DocumentPointerDrag = Readonly<{
  pointerId: number;
  documentId: WorkspaceDocumentSummary["documentId"];
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  active: boolean;
  captureElement: HTMLElement;
}>;

const DOCUMENT_DRAG_START_DISTANCE = 6;
const DOCUMENT_DRAG_AUTO_SCROLL_EDGE = 42;
const DOCUMENT_DRAG_AUTO_SCROLL_STEP = 12;
const DEFAULT_DOCUMENT_FOLDER_TITLE = "제목없음";

function DocumentFolderTree({
  work,
  documentCreateControl,
  activeDocumentId,
  disabled,
  onActivateDocument,
  onRenameDocument,
  onCreateFolder,
  onMoveDocument,
  onRenameFolder,
  onPlaceDocument,
  onRetireFolder,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly documentCreateControl: ReactNode;
  readonly activeDocumentId: string | null;
  readonly disabled: boolean;
  readonly onActivateDocument: (documentId: string) => void;
  readonly onRenameDocument: (
    document: WorkspaceDocumentSummary,
    title: string,
  ) => Promise<void>;
  readonly onCreateFolder: (
    title: string,
    parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ) => Promise<void>;
  readonly onMoveDocument: (
    documentId: WorkspaceDocumentSummary["documentId"],
    direction: MoveDocumentCommand["direction"],
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
  const [renameDocumentId, setRenameDocumentId] = useState<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const [renameDocumentTitle, setRenameDocumentTitle] = useState("");
  const renameDocumentPendingRef = useRef<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const documentPointerDragRef = useRef<DocumentPointerDrag | null>(null);
  const documentDropPreviewRef = useRef<DocumentDropPreview | null>(null);
  const documentDropPendingRef = useRef(false);
  const documentDragSuppressClickRef = useRef<
    WorkspaceDocumentSummary["documentId"] | null
  >(null);
  const documentTreeRef = useRef<HTMLDivElement | null>(null);
  const documentAutoScrollFrameRef = useRef<number | null>(null);
  const [documentDropPreview, setDocumentDropPreview] =
    useState<DocumentDropPreview | null>(null);
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
  const beginDocumentRename = (document: WorkspaceDocumentSummary) => {
    if (disabled) return;
    setRenameDocumentId(document.documentId);
    setRenameDocumentTitle("");
  };
  const cancelDocumentRename = () => {
    setRenameDocumentId(null);
    setRenameDocumentTitle("");
  };
  const commitDocumentRename = async (
    document: WorkspaceDocumentSummary,
  ): Promise<void> => {
    const title = renameDocumentTitle.trim();
    if (
      title.length === 0 ||
      renameDocumentPendingRef.current === document.documentId
    ) {
      return;
    }
    if (title === document.title) {
      setRenameDocumentId(null);
      setRenameDocumentTitle("");
      return;
    }
    renameDocumentPendingRef.current = document.documentId;
    try {
      await onRenameDocument(document, title);
      setRenameDocumentId(null);
      setRenameDocumentTitle("");
    } finally {
      renameDocumentPendingRef.current = null;
    }
  };
  const setCurrentDocumentDropPreview = useCallback(
    (preview: DocumentDropPreview | null) => {
      documentDropPreviewRef.current = preview;
      setDocumentDropPreview(preview);
    },
    [],
  );
  const stopDocumentAutoScroll = useCallback(() => {
    if (documentAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(documentAutoScrollFrameRef.current);
      documentAutoScrollFrameRef.current = null;
    }
  }, []);
  const clearDocumentPointerDrag = useCallback(() => {
    const drag = documentPointerDragRef.current;
    documentPointerDragRef.current = null;
    setCurrentDocumentDropPreview(null);
    stopDocumentAutoScroll();
    if (
      drag !== null &&
      drag.captureElement.hasPointerCapture(drag.pointerId)
    ) {
      drag.captureElement.releasePointerCapture(drag.pointerId);
    }
  }, [setCurrentDocumentDropPreview, stopDocumentAutoScroll]);
  const resolveDocumentDropPreview = useCallback(
    (
      drag: DocumentPointerDrag,
      clientX: number,
      clientY: number,
    ): DocumentDropPreview | null => {
      const source = work.documents.find(
        (document) => document.documentId === drag.documentId,
      );
      if (source === undefined) return null;
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const targetDocumentElement = pointedElement?.closest<HTMLElement>(
        "[data-document-id]",
      ) ?? null;
      if (
        targetDocumentElement !== null &&
        targetDocumentElement.dataset.documentId !== drag.documentId
      ) {
        const target = work.documents.find(
          (document) =>
            document.documentId === targetDocumentElement.dataset.documentId,
        );
        if (target !== undefined && target.folderId === source.folderId) {
          const bounds = targetDocumentElement.getBoundingClientRect();
          return Object.freeze({
            kind: "document" as const,
            sourceDocumentId: drag.documentId,
            targetDocumentId: target.documentId,
            placement:
              clientY < bounds.top + bounds.height / 2 ? "before" : "after",
          });
        }
      }
      const targetFolderElement = pointedElement?.closest<HTMLElement>(
        "[data-document-folder-id]",
      ) ?? null;
      if (targetFolderElement !== null) {
        const folderId = targetFolderElement.dataset.documentFolderId;
        if (
          folderId !== undefined &&
          work.folders.some((folder) => folder.folderId === folderId)
        ) {
          return Object.freeze({
            kind: "folder" as const,
            sourceDocumentId: drag.documentId,
            folderId: folderId as WorkspaceDocumentFolderSummary["folderId"],
          });
        }
      }
      const rootTarget = pointedElement?.closest<HTMLElement>(
        "[data-document-root-drop-target]",
      );
      return rootTarget === null || rootTarget === undefined
        ? null
        : Object.freeze({
            kind: "folder" as const,
            sourceDocumentId: drag.documentId,
            folderId: null,
          });
    },
    [work.documents, work.folders],
  );
  const startDocumentAutoScroll = useCallback(() => {
    if (documentAutoScrollFrameRef.current !== null) return;
    const step = () => {
      const drag = documentPointerDragRef.current;
      const tree = documentTreeRef.current;
      if (drag === null || !drag.active || tree === null) {
        documentAutoScrollFrameRef.current = null;
        return;
      }
      const bounds = tree.getBoundingClientRect();
      const scrollDelta = drag.clientY < bounds.top + DOCUMENT_DRAG_AUTO_SCROLL_EDGE
        ? -DOCUMENT_DRAG_AUTO_SCROLL_STEP
        : drag.clientY > bounds.bottom - DOCUMENT_DRAG_AUTO_SCROLL_EDGE
          ? DOCUMENT_DRAG_AUTO_SCROLL_STEP
          : 0;
      if (scrollDelta !== 0) {
        tree.scrollTop += scrollDelta;
        setCurrentDocumentDropPreview(
          resolveDocumentDropPreview(drag, drag.clientX, drag.clientY),
        );
      }
      documentAutoScrollFrameRef.current = window.requestAnimationFrame(step);
    };
    documentAutoScrollFrameRef.current = window.requestAnimationFrame(step);
  }, [resolveDocumentDropPreview, setCurrentDocumentDropPreview]);
  const requestDocumentDrop = useCallback(
    async (preview: DocumentDropPreview): Promise<void> => {
      if (disabled || documentDropPendingRef.current) return;
      const source = work.documents.find(
        (document) => document.documentId === preview.sourceDocumentId,
      );
      if (source === undefined) return;
      documentDropPendingRef.current = true;
      try {
        if (preview.kind === "folder") {
          if (source.folderId !== preview.folderId) {
            await onPlaceDocument(source.documentId, preview.folderId);
          }
          return;
        }
        const sourceIndex = work.documents.findIndex(
          (document) => document.documentId === source.documentId,
        );
        const targetIndex = work.documents.findIndex(
          (document) => document.documentId === preview.targetDocumentId,
        );
        if (sourceIndex < 0 || targetIndex < 0) return;
        let destinationIndex =
          targetIndex + (preview.placement === "after" ? 1 : 0);
        if (sourceIndex < destinationIndex) destinationIndex -= 1;
        const direction: MoveDocumentCommand["direction"] =
          destinationIndex < sourceIndex ? "earlier" : "later";
        const moveCount = Math.abs(destinationIndex - sourceIndex);
        for (let index = 0; index < moveCount; index += 1) {
          await onMoveDocument(source.documentId, direction);
        }
      } finally {
        documentDropPendingRef.current = false;
      }
    },
    [disabled, onMoveDocument, onPlaceDocument, work.documents],
  );
  const handleDocumentPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      document: WorkspaceDocumentSummary,
    ) => {
      if (
        event.button !== 0 ||
        disabled ||
        documentDropPendingRef.current ||
        documentPointerDragRef.current !== null
      ) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      documentPointerDragRef.current = Object.freeze({
        pointerId: event.pointerId,
        documentId: document.documentId,
        originX: event.clientX,
        originY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        captureElement: event.currentTarget,
      });
    },
    [disabled],
  );
  const handleDocumentPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = documentPointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const active = drag.active || Math.hypot(
        event.clientX - drag.originX,
        event.clientY - drag.originY,
      ) >= DOCUMENT_DRAG_START_DISTANCE;
      const currentDrag = Object.freeze({
        ...drag,
        clientX: event.clientX,
        clientY: event.clientY,
        active,
      });
      documentPointerDragRef.current = currentDrag;
      if (!active) return;
      event.preventDefault();
      setCurrentDocumentDropPreview(
        resolveDocumentDropPreview(currentDrag, event.clientX, event.clientY),
      );
      startDocumentAutoScroll();
    }, [
      resolveDocumentDropPreview,
      setCurrentDocumentDropPreview,
      startDocumentAutoScroll,
    ],
  );
  const handleDocumentPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = documentPointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const preview = documentDropPreviewRef.current;
      const wasActive = drag.active;
      clearDocumentPointerDrag();
      if (!wasActive || preview === null) return;
      event.preventDefault();
      documentDragSuppressClickRef.current = drag.documentId;
      window.setTimeout(() => {
        if (documentDragSuppressClickRef.current === drag.documentId) {
          documentDragSuppressClickRef.current = null;
        }
      }, 0);
      void requestDocumentDrop(preview).catch(() => undefined);
    }, [clearDocumentPointerDrag, requestDocumentDrop]);

  useEffect(() => () => {
    stopDocumentAutoScroll();
  }, [stopDocumentAutoScroll]);
  const renderDocument = (
    document: WorkspaceDocumentSummary,
    depth: number,
  ) => {
    const editing = renameDocumentId === document.documentId;
    const documentTarget =
      documentDropPreview?.kind === "document" &&
      documentDropPreview.targetDocumentId === document.documentId
        ? documentDropPreview.placement
        : null;
    const rowClassName = [
      "document-tree-row",
      "document-tree-document",
      documentDropPreview?.sourceDocumentId === document.documentId
        ? "is-document-drag-source"
        : "",
      documentTarget === "before" ? "is-document-drop-before" : "",
      documentTarget === "after" ? "is-document-drop-after" : "",
    ].filter(Boolean).join(" ");
    return (
      <div
        className={rowClassName}
        data-document-id={document.documentId}
        key={document.documentId}
        style={{ "--document-tree-depth": depth } as CSSProperties}
      >
      {editing ? (
        <form
          aria-label={`${document.title} 회차 제목 편집`}
          className="document-title-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void commitDocumentRename(document).catch(() => undefined);
          }}
        >
          <FileText aria-hidden="true" size={14} />
          <input
            aria-label="회차 제목"
            autoFocus
            disabled={disabled}
            onBlur={cancelDocumentRename}
            onChange={(event) => setRenameDocumentTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelDocumentRename();
              }
            }}
            value={renameDocumentTitle}
          />
        </form>
      ) : (
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
          onClick={() => {
            if (
              documentDragSuppressClickRef.current === document.documentId
            ) {
              documentDragSuppressClickRef.current = null;
              return;
            }
            onActivateDocument(document.documentId);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            beginDocumentRename(document);
          }}
          onLostPointerCapture={() => {
            if (
              documentPointerDragRef.current?.documentId === document.documentId
            ) {
              clearDocumentPointerDrag();
            }
          }}
          onPointerCancel={clearDocumentPointerDrag}
          onPointerDown={(event) =>
            handleDocumentPointerDown(event, document)
          }
          onPointerMove={handleDocumentPointerMove}
          onPointerUp={handleDocumentPointerUp}
          type="button"
        >
          <span
            aria-label={
              document.completion.state === "current"
                ? "완료"
                : document.completion.state === "edited-after-completion"
                  ? "완료 후 수정됨"
                  : "미완료"
            }
            className={`document-completion-mark is-${document.completion.state}`}
          >
            {document.completion.state === "current"
              ? "✓"
              : document.completion.state === "edited-after-completion"
                ? "△"
                : "○"}
          </span>
          <span className="document-tree-title">{document.title}</span>
        </button>
      )}
      </div>
    );
  };
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
          className={[
            "document-tree-row",
            "document-tree-folder",
            documentDropPreview?.kind === "folder" &&
              documentDropPreview.folderId === folder.folderId
              ? "is-document-folder-drop-target"
              : "",
          ].filter(Boolean).join(" ")}
          data-document-folder-id={folder.folderId}
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
                void onCreateFolder(
                  DEFAULT_DOCUMENT_FOLDER_TITLE,
                  folder.folderId,
                ).catch(() => undefined);
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

  return (
    <section
      aria-label="회차 폴더"
      className="document-folder-tree"
      data-document-drag-active={documentDropPreview !== null ? "true" : "false"}
    >
      <header
        className={
          documentDropPreview?.kind === "folder" &&
          documentDropPreview.folderId === null
            ? "is-document-root-drop-target"
            : undefined
        }
        data-document-root-drop-target="true"
      >
        <strong>문서</strong>
        <span className="document-folder-header-actions">
          {documentCreateControl}
          <button
            aria-label="폴더 추가"
            disabled={disabled}
            onClick={() => {
              void onCreateFolder(
                DEFAULT_DOCUMENT_FOLDER_TITLE,
                null,
              ).catch(() => undefined);
            }}
            title="폴더 추가"
            type="button"
          >
            <FolderPlus aria-hidden="true" size={14} />
          </button>
        </span>
      </header>
      <div
        className="document-tree"
        aria-label="회차 폴더 트리"
        ref={documentTreeRef}
      >
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
  {
    documentRailHost,
    embedded = false,
    eventRailHost,
    focusModePreferences,
    musicSettingsRevision = 0,
    musicPlayerHost,
    onCatalogChange,
    onFocusModePreferencesChange,
    onOpenPublishing,
    onOpenSettings,
    onReturnToWorks,
    onResumePreviewChange,
    onScheduleChange,
    onThemeChange,
    scheduleSettingsRevision = 0,
    theme = "light-mode",
    youtubeMusicConnectionStatus = null,
  },
  ref,
) {
  const documentRailId = useId();
  const recoveryHeadingId = useId();
  const reviewRailId = useId();
  const reviewCurrentTabId = useId();
  const reviewAssistantTabId = useId();
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
  const workManuscriptLayoutByWorkRef = useRef(
    new Map<string, WorkManuscriptLayoutSettingsProjection>(),
  );
  const workManuscriptLayoutSaveChainRef = useRef<Promise<void>>(
    Promise.resolve(),
  );
  const workManuscriptLayoutPendingSaveRef = useRef<Promise<void>>(
    Promise.resolve(),
  );
  const workManuscriptLayoutLoadSequenceRef = useRef(0);
  const workManuscriptLayoutChangeSequenceRef = useRef(0);
  const activeWorkIdRef = useRef<EntityId<"Work"> | null>(null);
  const versionLoadSequenceRef = useRef(0);
  const preflightLoadSequenceRef = useRef(0);
  const assistantContextLoadSequenceRef = useRef(0);
  const editingDocumentKeyRef = useRef<string | null>(null);
  const writingSessionTransitionPendingRef = useRef(false);
  const activeWritingSessionRef =
    useRef<WritingSessionProjection | undefined>(undefined);
  const focusModeOwnedWritingSessionIdRef =
    useRef<EntityId<"WritingSession"> | null>(null);
  const focusModeSessionTransitionPendingRef = useRef(false);
  const focusModeSessionPendingRef = useRef<Promise<void>>(Promise.resolve());
  const focusModeSessionAttemptedRef = useRef(false);
  const pomodoroReconcilePendingRef = useRef(false);
  const pomodoroResumePendingRef = useRef(false);
  const resumePausedPomodoroOnInputRef = useRef<() => void>(() => undefined);
  const pendingFragmentSourceRef = useRef<PendingFragmentSource | null>(null);
  const pendingForeshadowPointSourceRef =
    useRef<PendingForeshadowPointSource | null>(null);
  const pendingVisibleManuscriptSelectionRef =
    useRef<PendingVisibleManuscriptSelection | null>(null);
  const pendingPlotThreadSourceRef =
    useRef<PendingPlotThreadSource | null>(null);
  const pendingWorkStructureRangeRef =
    useRef<PendingWorkStructureRange | null>(null);
  const pendingCharacterEvidenceRef =
    useRef<PendingCharacterEvidence | null>(null);
  const pendingSceneBoundaryPreviewRef =
    useRef<PendingSceneBoundaryPreview | null>(null);
  const pendingSceneDraftCompareRef =
    useRef<PendingSceneDraftCompare | null>(null);
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
    useState<ReviewInspectorTab>("current");
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
      | "setting-document-completion"
    >("idle");
  const [titleEditTarget, setTitleEditTarget] = useState<
    "work" | null
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
  const [activeManuscriptPosition, setActiveManuscriptPosition] = useState<{
    readonly documentId: EntityId<"Document">;
    readonly offset: number;
  } | null>(null);
  const [pendingEventDraft, setPendingEventDraft] = useState<
    PendingEventDraft | null
  >(null);
  const [eventActionState, setEventActionState] = useState<
    | "idle"
    | "creating"
    | "linking"
    | "moving"
    | "replacing"
    | "retiring"
    | "opening"
  >("idle");
  const [eventActionError, setEventActionError] = useState<string | null>(null);
  const [sceneProjection, setSceneProjection] =
    useState<SceneProjectionList | null>(null);
  const [sceneActionState, setSceneActionState] = useState<
    "idle" | "creating" | "updating-rule" | "updating-event"
  >("idle");
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const [sceneExtractionCandidates, setSceneExtractionCandidates] = useState<
    readonly SceneExtractionCandidate[]
  >([]);
  const [sceneAnnotations, setSceneAnnotations] = useState<
    readonly SceneAnnotationProjection[]
  >([]);
  const [sceneDraftCandidates, setSceneDraftCandidates] = useState<
    readonly SceneDraftCandidate[]
  >([]);
  const [sceneDraftActionState, setSceneDraftActionState] =
    useState<SceneDraftActionState>("idle");
  const [sceneDraftActionError, setSceneDraftActionError] = useState<
    string | null
  >(null);
  const [sceneMusicQueueCandidates, setSceneMusicQueueCandidates] = useState<
    readonly SceneMusicQueueCandidate[]
  >([]);
  const [sceneMusicQueueActionState, setSceneMusicQueueActionState] = useState<
    "idle" | "searching" | "selecting" | "playing" | "saving-favorite"
  >("idle");
  const [sceneMusicQueueError, setSceneMusicQueueError] = useState<
    string | null
  >(null);
  const [musicLibraryOpen, setMusicLibraryOpen] = useState(false);
  const [musicLibraryResults, setMusicLibraryResults] = useState<
    readonly YouTubeVideoProjection[]
  >([]);
  const [musicLibraryQueue, setMusicLibraryQueue] = useState<
    readonly MusicTrackProjection[]
  >([]);
  const [musicLibraryActionState, setMusicLibraryActionState] =
    useState<"idle" | "searching" | "saving-playlist" | "registering-media">(
      "idle",
    );
  const [localMediaRegistrationMode, setLocalMediaRegistrationMode] =
    useState<LocalMediaStorageMode | null>(null);
  const [musicLibraryError, setMusicLibraryError] = useState<string | null>(null);
  const [sceneExtractionSelection, setSceneExtractionSelection] =
    useState<SceneExtractionSelection | null>(null);
  const [sceneExtractionActionState, setSceneExtractionActionState] =
    useState<SceneExtractionActionState>("idle");
  const [sceneExtractionActionError, setSceneExtractionActionError] =
    useState<string | null>(null);
  const [sceneExtractionPermissionRequired, setSceneExtractionPermissionRequired] =
    useState(false);
  const [sceneExtractionDestinationId, setSceneExtractionDestinationId] =
    useState<string | null>(null);
  const [workActivity, setWorkActivity] = useState<
    WorkActivityProjection | null
  >(null);
  const [pomodoro, setPomodoro] = useState<PomodoroProjection | null>(null);
  const [pomodoroPhaseAlert, setPomodoroPhaseAlert] =
    useState<PomodoroPhaseAlertProjection | null>(null);
  const [workMusicSettings, setWorkMusicSettings] =
    useState<WorkMusicSettingsProjection | null>(null);
  const [workManuscriptLayout, setWorkManuscriptLayout] =
    useState<WorkManuscriptLayoutSettingsProjection | null>(null);
  const [workInspirationSettings, setWorkInspirationSettings] =
    useState<WorkInspirationSettingsProjection | null>(null);
  const [inspirationActionState, setInspirationActionState] =
    useState<"idle" | "saving">("idle");
  const [inspirationActionError, setInspirationActionError] =
    useState<string | null>(null);
  const [youtubeMusicProfile, setYoutubeMusicProfile] =
    useState<YouTubeMusicProfile | null>(null);
  const [musicPlaybackRequest, setMusicPlaybackRequest] =
    useState<MusicPlaybackRequest | null>(null);
  const musicPlaybackNonceRef = useRef(0);
  const [dailyGoals, setDailyGoals] =
    useState<WorkRecordsGoalsProjection | null>(null);
  const [readthroughSettings, setReadthroughSettings] =
    useState<WorkReadthroughProjection | null>(null);
  const [readthroughActionState, setReadthroughActionState] = useState<
    "loading" | "idle" | "saving"
  >("loading");
  const [readthroughError, setReadthroughError] = useState<string | null>(null);
  const [recordsExportActionState, setRecordsExportActionState] = useState<
    "idle" | "exporting-json" | "exporting-csv"
  >("idle");
  const [recordsExportError, setRecordsExportError] = useState<string | null>(
    null,
  );
  const [recordsExportMessage, setRecordsExportMessage] = useState<
    string | null
  >(null);
  const [recordsNowMs, setRecordsNowMs] = useState(() => Date.now());
  const [showSchedule, setShowSchedule] = useState(false);
  const [workSchedule, setWorkSchedule] =
    useState<WorkCalendarProjection | null>(null);
  const [scheduleRefreshRevision, setScheduleRefreshRevision] = useState(0);
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
    | "saving-focus-note"
    | "stopping-focus"
  >("idle");
  const [activityActionError, setActivityActionError] = useState<
    string | null
  >(null);
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const focusModeRef = useRef(focusMode);
  useEffect(() => {
    focusModeRef.current = focusMode;
  }, [focusMode]);
  const [focusContentWidthPx, setFocusContentWidthPx] = useState(
    focusModePreferences?.contentWidthPx ?? 700,
  );
  const [focusZoomPercent, setFocusZoomPercent] = useState(
    focusModePreferences?.zoomPercent ?? 100,
  );
  const [focusCurrentBlockHighlight, setFocusCurrentBlockHighlight] =
    useState(focusModePreferences?.currentBlockHighlight ?? false);
  const [focusTypewriterMode, setFocusTypewriterMode] = useState(
    focusModePreferences?.typewriterMode ?? false,
  );
  const [focusTypewriterPositionPercent, setFocusTypewriterPositionPercent] =
    useState(() => {
      if (focusModePreferences !== undefined) {
        return focusModePreferences.typewriterPositionPercent;
      }
      const raw = window.localStorage.getItem(
        FOCUS_TYPEWRITER_POSITION_STORAGE_KEY,
      );
      const stored = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(stored)
        ? Math.min(
            FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
            Math.max(FOCUS_TYPEWRITER_POSITION_MIN_PERCENT, stored),
          )
        : FOCUS_TYPEWRITER_POSITION_DEFAULT_PERCENT;
    });
  const persistFocusModePreferences = useCallback((
    changes: Partial<FocusModePreferences>,
  ) => {
    const next = Object.freeze({
      contentWidthPx: focusContentWidthPx,
      zoomPercent: focusZoomPercent,
      currentBlockHighlight: focusCurrentBlockHighlight,
      typewriterMode: focusTypewriterMode,
      typewriterPositionPercent: focusTypewriterPositionPercent,
      ...changes,
    });
    onFocusModePreferencesChange?.(next);
  }, [
    focusContentWidthPx,
    focusCurrentBlockHighlight,
    focusTypewriterMode,
    focusTypewriterPositionPercent,
    focusZoomPercent,
    onFocusModePreferencesChange,
  ]);
  const changeFocusTypewriterPosition = useCallback((position: number) => {
    const next = Math.min(
      FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
      Math.max(FOCUS_TYPEWRITER_POSITION_MIN_PERCENT, position),
    );
    window.localStorage.setItem(
      FOCUS_TYPEWRITER_POSITION_STORAGE_KEY,
      String(next),
    );
    setFocusTypewriterPositionPercent(next);
    persistFocusModePreferences({ typewriterPositionPercent: next });
  }, [persistFocusModePreferences]);
  const darkMode = isDarkStarlightTheme(theme);
  const [showForwardWritingDialog, setShowForwardWritingDialog] = useState(false);
  const [forwardWriting, setForwardWriting] = useState<{
    readonly workId: EntityId<"Work">;
    readonly documentId: EntityId<"Document">;
    readonly goalCharacters: number;
    readonly protectedLength: number;
    readonly baselineCharacterCount: number;
    readonly writtenCharacters: number;
  } | null>(null);
  const [heatmapMode, setHeatmapMode] =
    useState<ManuscriptHeatmapMode>("off");
  const [manuscriptAnalysis, setManuscriptAnalysis] = useState<{
    readonly documentTitle: string;
    readonly manuscript: string;
  } | null>(null);
  const [manuscriptTextImport, setManuscriptTextImport] = useState<{
    readonly candidate: Extract<
      ManuscriptTextImportResult,
      { readonly status: "selected" }
    >;
    readonly sourceText: string;
  } | null>(null);
  const [manuscriptTextImportAction, setManuscriptTextImportAction] = useState<
    "idle" | "selecting" | "applying"
  >("idle");
  const [manuscriptTextImportError, setManuscriptTextImportError] = useState<
    string | null
  >(null);
  const [activityClock, setActivityClock] = useState(() => Date.now());
  const [documentRevisions, setDocumentRevisions] = useState<
    readonly DocumentRevisionProjection[]
  >([]);
  const [highlightedDocumentRevisionId, setHighlightedDocumentRevisionId] =
    useState<EntityId<"DocumentRevision"> | null>(null);
  const [documentRevisionPreview, setDocumentRevisionPreview] = useState<
    Readonly<{
      documentTitle: string;
      projection: DocumentRevisionContentProjection;
    }> | null
  >(null);
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
  const [characterRelations, setCharacterRelations] = useState<
    readonly CharacterRelationProjection[]
  >([]);
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [characterActionState, setCharacterActionState] =
    useState<CharacterManagerActionState>("idle");
  const [characterRelationActionState, setCharacterRelationActionState] =
    useState<CharacterRelationActionState>("idle");
  const [characterActionError, setCharacterActionError] = useState<
    string | null
  >(null);
  const [workSection, setWorkSection] = useState<WorkSection>(
    DEFAULT_WORK_SECTION,
  );
  const [structureTab, setStructureTab] = useState<StructureTab>(
    DEFAULT_STRUCTURE_TAB,
  );
  const [reviewTab, setReviewTab] = useState<ReviewTab>(DEFAULT_REVIEW_TAB);
  const [workReturnLocation, setWorkReturnLocation] =
    useState<WorkReturnLocation | null>(null);
  const navigationWorkIdRef = useRef<string | null>(null);
  const workspaceSurface = workSection === "write"
    ? "manuscript"
    : workSection === "structure" && structureTab === "characters"
      ? "characters"
      : workSection === "structure" &&
          (structureTab === "plots" || structureTab === "scenes")
        ? "plots"
        : "planning";
  const [plotWorkspaceInitialTab, setPlotWorkspaceInitialTab] =
    useState<PlotWorkspaceTab>("board");
  const [characterWorkspaceSelection, setCharacterWorkspaceSelection] =
    useState<CharacterWorkspaceSelection | null>(null);
  const [characterExtractionCandidates, setCharacterExtractionCandidates] =
    useState<readonly CharacterExtractionCandidate[]>([]);
  const [characterExtractionActionState, setCharacterExtractionActionState] =
    useState<CharacterExtractionActionState>("idle");
  const [characterExtractionActionError, setCharacterExtractionActionError] =
    useState<string | null>(null);
  const [characterExtractionPermissionRequired, setCharacterExtractionPermissionRequired] =
    useState(false);
  const [characterExtractionDestinationId, setCharacterExtractionDestinationId] =
    useState<string | null>(null);
  const [characterGenerationCandidates, setCharacterGenerationCandidates] =
    useState<readonly CharacterGenerationCandidate[]>([]);
  const [characterGenerationActionState, setCharacterGenerationActionState] =
    useState<CharacterGenerationActionState>("idle");
  const [characterGenerationActionError, setCharacterGenerationActionError] =
    useState<string | null>(null);
  const [chatGptOAuthStatus, setChatGptOAuthStatus] =
    useState<ChatGptOAuthConnectionStatus | null>(null);
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
  const [assistantChatDialogOpen, setAssistantChatDialogOpen] = useState(false);
  const [assistantChatMessages, setAssistantChatMessages] = useState<
    readonly AssistantChatMessage[]
  >([]);
  const [assistantChatActionState, setAssistantChatActionState] =
    useState<"idle" | "sending">("idle");
  const [assistantChatError, setAssistantChatError] = useState<string | null>(null);
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
      const selection = summary.selection.ranges[summary.selection.mainIndex];
      if (selection !== undefined) {
        setActiveManuscriptPosition({
          documentId: _document.documentId,
          offset: selection.head,
        });
      }
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
      const pendingCharacterEvidence = pendingCharacterEvidenceRef.current;
      if (
        pendingCharacterEvidence !== null &&
        pendingCharacterEvidence.workId === _document.workId &&
        pendingCharacterEvidence.documentId === _document.documentId
      ) {
        pendingCharacterEvidenceRef.current = null;
        const selected = manuscriptEditorRef.current?.selectDocumentRange(
          _document,
          pendingCharacterEvidence.range,
        );
        setCharacterExtractionActionState("idle");
        if (!selected) {
          setCharacterExtractionActionError(
            "캐릭터 근거의 정확한 원고 범위를 선택하지 못했습니다.",
          );
        } else {
          setCharacterExtractionActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingSceneBoundaryPreview = pendingSceneBoundaryPreviewRef.current;
      if (
        pendingSceneBoundaryPreview !== null &&
        pendingSceneBoundaryPreview.workId === _document.workId &&
        pendingSceneBoundaryPreview.documentId === _document.documentId
      ) {
        pendingSceneBoundaryPreviewRef.current = null;
        const revealed = manuscriptEditorRef.current?.revealDocumentOffset(
          _document,
          pendingSceneBoundaryPreview.offset,
        );
        setSceneExtractionActionState("idle");
        if (!revealed) {
          setSceneExtractionActionError(
            "장면 경계 미리보기 위치를 원고에서 열지 못했습니다.",
          );
        } else {
          setSceneExtractionActionError(null);
          resumeSummary = undefined;
        }
      }
      const pendingSceneDraftCompare = pendingSceneDraftCompareRef.current;
      if (
        pendingSceneDraftCompare !== null &&
        pendingSceneDraftCompare.workId === _document.workId &&
        pendingSceneDraftCompare.documentId === _document.documentId
      ) {
        pendingSceneDraftCompareRef.current = null;
        const revealed = manuscriptEditorRef.current?.revealDocumentOffset(
          _document,
          Math.min(pendingSceneDraftCompare.offset, _document.initialText.length),
        );
        setSceneDraftActionState("idle");
        if (!revealed) {
          setSceneDraftActionError("장면 초안의 현재 원고 위치를 열지 못했습니다.");
        } else {
          setSceneDraftActionError(null);
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
              const catalog = await window.eumStudio.workspace.getCatalog();
              setRuntime((current) =>
                current.status === "ready" ? { ...current, catalog } : current
              );
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
            saveFormatting: async (command) => {
              const receipt = await window.eumStudio.editor.saveFormatting(command);
              const catalog = await window.eumStudio.workspace.getCatalog();
              setRuntime((current) =>
                current.status === "ready" ? { ...current, catalog } : current
              );
              return receipt;
            },
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
              await workManuscriptLayoutPendingSaveRef.current;
              await focusModeSessionPendingRef.current;
              const focusSession = activeWritingSessionRef.current;
              const focusSessionId = focusModeOwnedWritingSessionIdRef.current;
              if (
                activeDocumentForClose !== undefined &&
                focusSession !== undefined &&
                focusSession.sessionId === focusSessionId
              ) {
                const projection = await window.eumStudio.activity.stopSession({
                  schemaVersion: 1,
                  workId: activeDocumentForClose.workId,
                  sessionId: focusSession.sessionId,
                });
                activeWritingSessionRef.current = projection.sessions.find(
                  (session) => session.sessionId === projection.activeSessionId,
                );
                focusModeOwnedWritingSessionIdRef.current = null;
              }
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
  useEffect(() => {
    const pending = pendingVisibleManuscriptSelectionRef.current;
    if (
      workSection !== "write" ||
      activeDocument === undefined ||
      pending === null ||
      pending.workId !== activeDocument.workId ||
      pending.documentId !== activeDocument.documentId
    ) {
      return;
    }
    pendingVisibleManuscriptSelectionRef.current = null;
    const selected = manuscriptEditorRef.current?.selectDocumentRange(
      activeDocument,
      pending.range,
    );
    if (pending.kind === "event") {
      setEventActionState("idle");
      setEventActionError(
        selected ? null : "사건의 정확한 원고 범위를 선택하지 못했습니다.",
      );
    } else if (pending.kind === "plot") {
      setPlotActionError(
        selected ? null : "플롯 출처의 정확한 원문 범위를 선택하지 못했습니다.",
      );
    } else if (pending.kind === "structure") {
      setWorkStructureActionState("idle");
      setWorkStructureActionError(
        selected
          ? null
          : "작품 구조에 기록된 정확한 원문 범위를 선택하지 못했습니다.",
      );
    } else if (pending.kind === "character") {
      setCharacterExtractionActionError(
        selected ? null : "캐릭터 근거의 정확한 원고 범위를 선택하지 못했습니다.",
      );
    } else if (pending.kind === "scene") {
      setSceneActionError(
        selected ? null : "장면의 정확한 범위로 이동하지 못했습니다.",
      );
    } else if (pending.kind === "foreshadow") {
      setForeshadowLineActionError(
        selected ? null : "복선 지점의 정확한 원고 범위를 선택하지 못했습니다.",
      );
    } else if (pending.kind === "lore") {
      setLoreActionError(
        selected ? null : "별빛 근거의 정확한 원고 범위를 선택하지 못했습니다.",
      );
    } else {
      setLoreCandidateActionError(
        selected ? null : "후보 근거의 정확한 원문 범위를 선택하지 못했습니다.",
      );
    }
    if (selected) {
      void captureResumeForDocument(activeDocument).catch(() => undefined);
    }
  }, [activeDocument, captureResumeForDocument, workSection]);
  const activeForwardWriting =
    activeDocument !== undefined &&
    forwardWriting?.workId === activeDocument.workId &&
    forwardWriting.documentId === activeDocument.documentId
      ? forwardWriting
      : null;
  const publishResumePreview = useCallback(
    (document: ManuscriptDocumentSource | undefined) => {
      if (document === undefined || runtime.status !== "ready") {
        onResumePreviewChange?.(null);
        return;
      }
      const editor = manuscriptEditorRef.current;
      const manuscript = editor?.materializeDocumentText(document) ?? document.initialText;
      const text = getPreviousEpisodeFlowPreviewText(manuscript);
      const workLayout =
        workManuscriptLayout?.workId === document.workId
          ? workManuscriptLayout.settings
          : null;
      const defaults = runtime.formattingProfile.defaults;
      const fontFamilyId = workLayout?.fontFamilyId ?? defaults.fontFamilyId;
      const fontFamily = runtime.formattingProfile.fontFamilies.find(
        (candidate) => candidate.id === fontFamilyId,
      );
      if (fontFamily === undefined) {
        throw new Error(`Unknown manuscript font family: ${fontFamilyId}`);
      }
      onResumePreviewChange?.(
        text.length === 0
          ? null
          : Object.freeze({
              workId: document.workId,
              documentId: document.documentId,
              text,
              formatting: Object.freeze({
                fontFamily: fontFamily.cssFamily,
                fontSizePx: workLayout?.fontSizePx ?? defaults.fontSizePx,
                contentWidthPx:
                  workLayout?.contentWidthPx ??
                  defaults.contentWidthPx,
                lineHeight:
                  workLayout?.lineHeight ??
                  defaults.lineHeight,
                paragraphSpacingPx:
                  workLayout?.paragraphSpacingPx ??
                  defaults.paragraphSpacingPx,
                letterSpacingEm:
                  workLayout?.letterSpacingEm ??
                  defaults.letterSpacingEm,
              }),
            }),
      );
    },
    [onResumePreviewChange, runtime, workManuscriptLayout],
  );
  useEffect(() => {
    publishResumePreview(activeDocument);
  }, [activeDocument, publishResumePreview]);
  const sharesDocumentRailWithSidebar =
    documentRailHost !== null && documentRailHost !== undefined;
  const activeWork =
    runtime.status === "ready" && runtime.catalog.activeWorkId !== null
      ? runtime.catalog.works.find(
          (work) => work.workId === runtime.catalog.activeWorkId,
        )
      : undefined;
  const activeDocumentSummary = activeWork?.documents.find(
    (document) => document.documentId === activeDocument?.documentId,
  );
  const refreshCatalogAfterDocumentCompletion = useCallback(
    async (): Promise<void> => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      setRuntime((current) =>
        current.status === "ready" ? { ...current, catalog } : current
      );
      onCatalogChange?.(catalog);
      onScheduleChange?.();
    },
    [onCatalogChange, onScheduleChange],
  );
  const completeActiveDocument = useCallback(async (): Promise<void> => {
    if (
      runtime.status !== "ready" ||
      activeDocument === undefined ||
      activeDocumentSummary === undefined ||
      workspaceActionState !== "idle"
    ) {
      return;
    }
    setWorkspaceActionState("setting-document-completion");
    setWorkspaceActionError(null);
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      const queue = durableSaveQueueRef.current;
      if (queue === null) {
        throw new Error("원고 저장 대기열을 찾지 못했습니다.");
      }
      await queue.flushForClose(activeDocument.documentId);
      const durableRevisionId = queue.getCurrentRevisionId(
        activeDocument.documentId,
      );
      await window.eumStudio.workspace.completeDocument({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        expectedCompletionRevision: activeDocumentSummary.completion.revision,
        expectedDocumentRevisionId: durableRevisionId,
      });
      await refreshCatalogAfterDocumentCompletion();
    } catch {
      setWorkspaceActionError("원고를 저장한 뒤 회차 완료를 기록하지 못했습니다.");
    } finally {
      setWorkspaceActionState("idle");
    }
  }, [
    activeDocument,
    activeDocumentSummary,
    refreshCatalogAfterDocumentCompletion,
    runtime.status,
    workspaceActionState,
  ]);
  const clearActiveDocumentCompletion = useCallback(async (): Promise<void> => {
    if (
      runtime.status !== "ready" ||
      activeDocument === undefined ||
      activeDocumentSummary === undefined ||
      activeDocumentSummary.completion.state === "incomplete" ||
      workspaceActionState !== "idle"
    ) {
      return;
    }
    setWorkspaceActionState("setting-document-completion");
    setWorkspaceActionError(null);
    try {
      await window.eumStudio.workspace.clearDocumentCompletion({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        expectedCompletionRevision: activeDocumentSummary.completion.revision,
      });
      await refreshCatalogAfterDocumentCompletion();
    } catch {
      setWorkspaceActionError("회차 완료를 취소하지 못했습니다.");
    } finally {
      setWorkspaceActionState("idle");
    }
  }, [
    activeDocument,
    activeDocumentSummary,
    refreshCatalogAfterDocumentCompletion,
    runtime.status,
    workspaceActionState,
  ]);
  const loadDocumentRevisionPreview = useCallback(async (
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
    documentTitle: string,
  ): Promise<void> => {
    setVersionActionError(null);
    try {
      const projection = await window.eumStudio.version.readDocumentRevision({
        schemaVersion: 1,
        workId,
        documentId,
        revisionId,
      });
      setHighlightedDocumentRevisionId(revisionId);
      setDocumentRevisionPreview({ documentTitle, projection });
    } catch {
      setVersionActionError("완료 당시 원고 버전을 불러오지 못했습니다.");
    }
  }, []);
  const openActiveDocumentCompletedRevision = useCallback(() => {
    const revisionId = activeDocumentSummary?.completion
      .completedDocumentRevisionId;
    if (
      revisionId === null ||
      revisionId === undefined ||
      activeDocument === undefined ||
      activeDocumentSummary === undefined
    ) {
      return;
    }
    void loadDocumentRevisionPreview(
      activeDocument.workId,
      activeDocument.documentId,
      revisionId,
      activeDocumentSummary.title,
    );
  }, [activeDocument, activeDocumentSummary, loadDocumentRevisionPreview]);
  const preserveCurrentWorkLocation = useCallback(() => {
    if (workSection === "structure") {
      setWorkReturnLocation({ section: "structure", tab: structureTab });
    } else if (workSection === "review") {
      setWorkReturnLocation({ section: "review", tab: reviewTab });
    }
  }, [reviewTab, structureTab, workSection]);
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
  useEffect(() => {
    if (navigationWorkIdRef.current === activeWorkId) return;
    navigationWorkIdRef.current = activeWorkId;
    const reset = window.setTimeout(() => {
      setWorkSection(DEFAULT_WORK_SECTION);
      setStructureTab(DEFAULT_STRUCTURE_TAB);
      setReviewTab(DEFAULT_REVIEW_TAB);
      setWorkReturnLocation(null);
    }, 0);
    return () => window.clearTimeout(reset);
  }, [activeWorkId]);
  useEffect(() => {
    activeWorkIdRef.current = activeWorkId;
  }, [activeWorkId]);

  useEffect(() => {
    const loadSequence = workManuscriptLayoutLoadSequenceRef.current + 1;
    workManuscriptLayoutLoadSequenceRef.current = loadSequence;
    const changeSequence = workManuscriptLayoutChangeSequenceRef.current + 1;
    workManuscriptLayoutChangeSequenceRef.current = changeSequence;
    if (activeWorkId === null) {
      return;
    }
    const cached = workManuscriptLayoutByWorkRef.current.get(activeWorkId);
    let disposed = false;
    const load = workManuscriptLayoutSaveChainRef.current.then(() =>
      window.eumStudio.editor.getWorkManuscriptLayoutSettings({
        schemaVersion: 1,
        workId: activeWorkId,
      })
    );
    void load.then(
      (projection) => {
        workManuscriptLayoutByWorkRef.current.set(activeWorkId, projection);
        if (
          !disposed &&
          workManuscriptLayoutLoadSequenceRef.current === loadSequence &&
          workManuscriptLayoutChangeSequenceRef.current === changeSequence
        ) {
          setWorkManuscriptLayout(projection);
        }
      },
      () => {
        if (
          !disposed &&
          workManuscriptLayoutLoadSequenceRef.current === loadSequence
        ) {
          setWorkManuscriptLayout(cached ?? null);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId]);

  const handleWorkManuscriptLayoutChange = useCallback(
    (settings: ManuscriptLayoutSettings) => {
      const workId = activeWorkIdRef.current;
      if (workId === null) {
        return;
      }
      const changeSequence =
        workManuscriptLayoutChangeSequenceRef.current + 1;
      workManuscriptLayoutChangeSequenceRef.current = changeSequence;
      setWorkManuscriptLayout((current) => {
        if (current?.workId !== workId) {
          return current;
        }
        return Object.freeze({ ...current, settings });
      });
      const execution = workManuscriptLayoutSaveChainRef.current.then(
        async () => {
          const current =
            workManuscriptLayoutByWorkRef.current.get(workId) ??
            await window.eumStudio.editor.getWorkManuscriptLayoutSettings({
              schemaVersion: 1,
              workId,
            });
          const saved =
            await window.eumStudio.editor.saveWorkManuscriptLayoutSettings({
              schemaVersion: 1,
              workId,
              expectedRevision: current.revision,
              settings,
            });
          workManuscriptLayoutByWorkRef.current.set(workId, saved);
          if (
            activeWorkIdRef.current === workId &&
            workManuscriptLayoutChangeSequenceRef.current === changeSequence
          ) {
            setWorkManuscriptLayout(saved);
          }
        },
      );
      workManuscriptLayoutSaveChainRef.current = execution.then(
        () => undefined,
        () => undefined,
      );
      workManuscriptLayoutPendingSaveRef.current = execution;
      void execution.catch(() => {
        if (
          activeWorkIdRef.current === workId &&
          workManuscriptLayoutChangeSequenceRef.current === changeSequence
        ) {
          setWorkManuscriptLayout(
            workManuscriptLayoutByWorkRef.current.get(workId) ?? null,
          );
        }
      });
    },
    [],
  );
  const sceneBoundaryPreviews = useMemo<
    readonly ManuscriptSceneBoundaryPreview[]
  >(() => {
    if (activeDocument === undefined) return Object.freeze([]);
    const currentRevisionId =
      sceneExtractionSelection?.documentId === activeDocument.documentId
        ? sceneExtractionSelection.documentRevisionId
        : activeDocument.documentRevisionId;
    return Object.freeze(sceneExtractionCandidates.flatMap((candidate) => {
      if (
        candidate.status !== "ready" ||
        candidate.workId !== activeDocument.workId ||
        candidate.sourceRange.documentId !== activeDocument.documentId ||
        candidate.sourceRange.documentRevisionId !== currentRevisionId
      ) {
        return [];
      }
      return candidate.boundaries.flatMap((boundary) => {
        if (boundary.status !== "pending") return [];
        const before = candidate.scenes.find(
          (scene) => scene.sceneItemId === boundary.fromSceneItemId,
        );
        const after = candidate.scenes.find(
          (scene) => scene.sceneItemId === boundary.toSceneItemId,
        );
        if (before === undefined || after === undefined) return [];
        return [Object.freeze({
          boundaryId: boundary.boundaryId,
          offset: boundary.offset,
          beforeTitle: before.title,
          afterTitle: after.title,
        })];
      });
    }));
  }, [activeDocument, sceneExtractionCandidates, sceneExtractionSelection]);
  const assistantContextConnections = useMemo(() => {
    if (chatGptOAuthStatus?.connected !== true) {
      return assistantConnections;
    }
    const connectionId = createChatGptOAuthAssistantConnectionId(
      chatGptOAuthStatus.providerId,
    );
    return Object.freeze([
      Object.freeze({
        connectionId,
        label: chatGptOAuthStatus.displayName,
        model: chatGptOAuthStatus.modelId,
      }),
      ...assistantConnections.filter(
        (connection) => connection.connectionId !== connectionId,
      ),
    ]);
  }, [assistantConnections, chatGptOAuthStatus]);
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
  const activeWorkCharacterRelations = useMemo(
    () =>
      activeWorkId === null
        ? []
        : characterRelations.filter(
            (relation) => relation.workId === activeWorkId,
          ),
    [activeWorkId, characterRelations],
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
  const activeSelectedPlot = activeSelectedPlotThreadId === null
    ? null
    : activeWorkPlots.find(
        (plot) => plot.plotThreadId === activeSelectedPlotThreadId,
      ) ?? null;
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
  const openAssistantChatDialog = useCallback(() => {
    setAssistantChatError(null);
    setAssistantChatDialogOpen(true);
  }, []);
  const runAssistantChat = useCallback(async (message: string) => {
    if (assistantChatActionState !== "idle") return;
    const userMessage = Object.freeze({
      role: "user" as const,
      text: message,
    });
    const nextMessages = Object.freeze([...assistantChatMessages, userMessage]);
    setAssistantChatMessages(nextMessages);
    setAssistantChatActionState("sending");
    setAssistantChatError(null);
    try {
      const result = await window.eumStudio.assistant.runChat({
        schemaVersion: 1,
        messages: nextMessages,
      });
      setAssistantChatMessages((current) => Object.freeze([
        ...current,
        result.message,
      ]));
    } catch (reason) {
      setAssistantChatError(
        reason instanceof Error ? reason.message : "GPT 응답을 받지 못했습니다.",
      );
    } finally {
      setAssistantChatActionState("idle");
    }
  }, [assistantChatActionState, assistantChatMessages]);
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
        setCharacterDialogOpen(false);
        setStructureTab("characters");
        setWorkSection("structure");
        setFocusMode(false);
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
        setPlotDialogOpen(false);
        setPlotWorkspaceInitialTab("board");
        setStructureTab("plots");
        setWorkSection("structure");
        setFocusMode(false);
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
      setForeshadowLineDialogOpen(false);
      setStructureTab("foreshadow");
      setWorkSection("structure");
      setFocusMode(false);
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
        setSceneExtractionCandidates([]);
        setSceneAnnotations([]);
        setSceneDraftCandidates([]);
        setSceneDraftActionError(null);
        setSceneMusicQueueCandidates([]);
        setSceneMusicQueueError(null);
        setSceneExtractionSelection(null);
        setSceneExtractionActionError(null);
        setSceneExtractionPermissionRequired(false);
        setSceneExtractionDestinationId(null);
        pendingSceneBoundaryPreviewRef.current = null;
        pendingSceneDraftCompareRef.current = null;
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
    void Promise.all([
      window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.structure.listSceneExtractionCandidates({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.structure.listSceneAnnotations({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.structure.listSceneDraftCandidates({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.musicPlayback.listSceneQueueCandidates({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([
        projection,
        candidateProjection,
        annotationProjection,
        draftProjection,
        musicQueueProjection,
      ]) => {
        if (!disposed) {
          setSceneProjection(projection);
          setSceneExtractionCandidates(candidateProjection.candidates);
          setSceneAnnotations(annotationProjection.annotations);
          setSceneDraftCandidates(draftProjection.candidates);
          setSceneMusicQueueCandidates(musicQueueProjection.candidates);
          setSceneExtractionSelection(null);
          setSceneExtractionPermissionRequired(false);
          setSceneExtractionDestinationId(null);
          setSceneActionError(null);
          setSceneExtractionActionError(null);
          setSceneDraftActionError(null);
          setSceneMusicQueueError(null);
        }
      },
      () => {
        if (!disposed) {
          setSceneProjection(null);
          setSceneExtractionCandidates([]);
          setSceneAnnotations([]);
          setSceneDraftCandidates([]);
          setSceneMusicQueueCandidates([]);
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
        setWorkMusicSettings(null);
        setMusicLibraryQueue([]);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let disposed = false;
    void window.eumStudio.settings.getWorkMusic({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setWorkMusicSettings(projection);
          setMusicLibraryQueue(projection.settings.playlistTracks);
        }
      },
      () => {
        if (!disposed) {
          setWorkMusicSettings(null);
          setMusicLibraryQueue([]);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId, musicSettingsRevision]);

  useEffect(() => {
    if (activeWorkId === null) {
      const reset = window.setTimeout(() => {
        setWorkInspirationSettings(null);
        setInspirationActionError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let disposed = false;
    void window.eumStudio.settings.getWorkInspiration({
      schemaVersion: 1,
      workId: activeWorkId,
    }).then(
      (projection) => {
        if (!disposed) {
          setWorkInspirationSettings(projection);
          setInspirationActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkInspirationSettings(null);
          setInspirationActionError("뽑기 키워드를 불러오지 못했습니다.");
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId]);

  const saveWorkInspirationSettings = useCallback(async (
    settings: WorkInspirationSettingsProjection["settings"],
  ) => {
    const current = workInspirationSettings;
    if (
      activeWorkId === null ||
      current === null ||
      current.workId !== activeWorkId ||
      inspirationActionState !== "idle"
    ) {
      return null;
    }
    setInspirationActionState("saving");
    setInspirationActionError(null);
    try {
      const saved = await window.eumStudio.settings.saveWorkInspiration({
        schemaVersion: 1,
        workId: activeWorkId,
        expectedRevision: current.revision,
        settings,
      });
      setWorkInspirationSettings((latest) =>
        latest?.workId === saved.workId ? saved : latest
      );
      return saved;
    } catch {
      setInspirationActionError("뽑기 키워드를 저장하지 못했습니다.");
      return null;
    } finally {
      setInspirationActionState("idle");
    }
  }, [activeWorkId, inspirationActionState, workInspirationSettings]);

  const addCharacterInspirationKeywords = useCallback((
    keywords: readonly string[],
  ) => {
    const current = workInspirationSettings;
    if (current === null) return;
    const characterKeywords = Object.freeze([
      ...new Set([...current.settings.characterKeywords, ...keywords]),
    ]);
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      characterKeywords,
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const deleteCharacterInspirationKeyword = useCallback((keyword: string) => {
    const current = workInspirationSettings;
    if (current === null) return;
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      characterKeywords: Object.freeze(
        current.settings.characterKeywords.filter((entry) => entry !== keyword),
      ),
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const addEventInspirationKeywords = useCallback((
    keywords: readonly string[],
  ) => {
    const current = workInspirationSettings;
    if (current === null) return;
    const eventKeywords = Object.freeze([
      ...new Set([...current.settings.eventKeywords, ...keywords]),
    ]);
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      eventKeywords,
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  const deleteEventInspirationKeyword = useCallback((keyword: string) => {
    const current = workInspirationSettings;
    if (current === null) return;
    void saveWorkInspirationSettings(Object.freeze({
      ...current.settings,
      eventKeywords: Object.freeze(
        current.settings.eventKeywords.filter((entry) => entry !== keyword),
      ),
    }));
  }, [saveWorkInspirationSettings, workInspirationSettings]);

  useEffect(() => {
    let disposed = false;
    void window.eumStudio.musicPlayback.getProfile().then(
      (profile) => {
        if (!disposed) setYoutubeMusicProfile(profile);
      },
      () => {
        if (!disposed) setYoutubeMusicProfile(null);
      },
    );
    return () => {
      disposed = true;
    };
  }, []);

  const playMusicQueue = useCallback((
    tracks: readonly MusicTrackProjection[],
  ): boolean => {
    if (tracks.length === 0) return false;
    musicPlaybackNonceRef.current += 1;
    setMusicPlaybackRequest(Object.freeze({
      nonce: musicPlaybackNonceRef.current,
      tracks: Object.freeze([...tracks]),
    }));
    return true;
  }, []);

  const searchMusicLibrary = useCallback(async (query: string) => {
    if (musicLibraryActionState !== "idle") return;
    setMusicLibraryActionState("searching");
    setMusicLibraryError(null);
    try {
      const result = await window.eumStudio.musicPlayback.searchVideos({
        schemaVersion: 1,
        query,
      });
      setMusicLibraryResults(result.videos);
      if (result.videos.length === 0) {
        setMusicLibraryError("검색 결과가 없습니다.");
      }
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error ? reason.message : "음악을 검색하지 못했습니다.",
      );
    } finally {
      setMusicLibraryActionState("idle");
    }
  }, [musicLibraryActionState]);

  const saveMusicLibraryQueue = useCallback(async (
    nextQueue: readonly MusicTrackProjection[],
  ) => {
    if (
      activeWork === undefined ||
      workMusicSettings?.workId !== activeWork.workId ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) {
      return;
    }
    const previousQueue = workMusicSettings.settings.playlistTracks;
    setMusicLibraryQueue(nextQueue);
    setMusicLibraryActionState("saving-playlist");
    setMusicLibraryError(null);
    try {
      const saved = await window.eumStudio.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: activeWork.workId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          playlistTracks: nextQueue,
        },
      });
      setWorkMusicSettings(saved);
      setMusicLibraryQueue(saved.settings.playlistTracks);
    } catch (reason) {
      setMusicLibraryQueue(previousQueue);
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "재생목록을 저장하지 못했습니다.",
      );
    } finally {
      setMusicLibraryActionState("idle");
    }
  }, [
    activeWork,
    musicLibraryActionState,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const registerLocalMedia = useCallback(async (
    storageMode: LocalMediaStorageMode,
  ) => {
    if (
      activeWork === undefined ||
      workMusicSettings?.workId !== activeWork.workId ||
      musicLibraryActionState !== "idle" ||
      sceneMusicQueueActionState !== "idle"
    ) {
      return;
    }
    setMusicLibraryActionState("registering-media");
    setLocalMediaRegistrationMode(storageMode);
    setMusicLibraryError(null);
    try {
      const result = await window.eumStudio.musicPlayback.selectLocalMedia({
        schemaVersion: 1,
        workId: activeWork.workId,
        storageMode,
      });
      if (result.status === "cancelled") return;
      const saved = await window.eumStudio.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: activeWork.workId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          localMedia: Object.freeze([
            ...workMusicSettings.settings.localMedia,
            ...result.tracks,
          ]),
        },
      });
      setWorkMusicSettings(saved);
    } catch (reason) {
      setMusicLibraryError(
        reason instanceof Error
          ? reason.message
          : "미디어 파일을 등록하지 못했습니다.",
      );
    } finally {
      setLocalMediaRegistrationMode(null);
      setMusicLibraryActionState("idle");
    }
  }, [
    activeWork,
    musicLibraryActionState,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

  const refreshSceneMusicQueueCandidates = useCallback(async (
    workId: EntityId<"Work">,
  ) => {
    const projection =
      await window.eumStudio.musicPlayback.listSceneQueueCandidates({
        schemaVersion: 1,
        workId,
      });
    setSceneMusicQueueCandidates(projection.candidates);
    return projection.candidates;
  }, []);

  const searchSceneMusicQueues = useCallback(async (
    annotation: SceneAnnotationProjection,
    query: string,
  ) => {
    const normalizedQuery = query.trim();
    if (
      activeWork === undefined ||
      annotation.workId !== activeWork.workId ||
      sceneMusicQueueActionState !== "idle" ||
      normalizedQuery.length === 0
    ) {
      if (normalizedQuery.length === 0) {
        setSceneMusicQueueError("음악 검색어를 입력해 주세요.");
      }
      return;
    }
    setSceneMusicQueueActionState("searching");
    setSceneMusicQueueError(null);
    try {
      const result = await window.eumStudio.musicPlayback.searchSceneQueues({
        schemaVersion: 1,
        requestId: entityId<"SceneMusicQueueRequest">(crypto.randomUUID()),
        workId: annotation.workId,
        sceneKey: annotation.sceneKey,
        expectedAnnotationRevision: annotation.revision,
        query: normalizedQuery,
      });
      if (result.status === "connection-required") {
        setSceneMusicQueueError("YouTube Data API 연결 후 장면 음악을 찾을 수 있습니다.");
        return;
      }
      setSceneMusicQueueCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) => candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "장면 음악 큐를 찾지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [activeWork, sceneMusicQueueActionState]);

  const selectSceneMusicQueue = useCallback(async (
    candidate: SceneMusicQueueCandidate,
    option: SceneMusicQueueOption,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneMusicQueueActionState !== "idle"
    ) {
      return;
    }
    setSceneMusicQueueActionState("selecting");
    setSceneMusicQueueError(null);
    try {
      await window.eumStudio.musicPlayback.selectSceneQueue({
        schemaVersion: 1,
        workId: candidate.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        optionId: option.optionId,
      });
      await refreshSceneMusicQueueCandidates(candidate.workId);
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "장면 음악 큐를 선택하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    activeWork,
    refreshSceneMusicQueueCandidates,
    sceneMusicQueueActionState,
  ]);

  const playSelectedSceneMusicQueue = useCallback(async (
    candidate: SceneMusicQueueCandidate,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneMusicQueueActionState !== "idle"
    ) {
      return;
    }
    setSceneMusicQueueActionState("playing");
    setSceneMusicQueueError(null);
    try {
      const candidates = await refreshSceneMusicQueueCandidates(
        candidate.workId,
      );
      const currentCandidate = candidates.find(
        (entry) => entry.candidateId === candidate.candidateId,
      );
      const option = currentCandidate === undefined
        ? null
        : selectedSceneMusicQueueOption(currentCandidate);
      if (option === null) {
        throw new Error("현재 장면에 선택된 최신 큐가 없습니다.");
      }
      const played = playMusicQueue(option.tracks);
      if (!played) {
        setSceneMusicQueueError("선택한 장면 음악 큐를 재생하지 못했습니다.");
      }
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "선택한 장면 음악 큐를 재생하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    activeWork,
    playMusicQueue,
    refreshSceneMusicQueueCandidates,
    sceneMusicQueueActionState,
  ]);

  const toggleFavoriteMusicTrack = useCallback(async (
    track: MusicTrackProjection,
  ) => {
    if (
      activeWork === undefined ||
      workMusicSettings?.workId !== activeWork.workId ||
      sceneMusicQueueActionState !== "idle" ||
      musicLibraryActionState !== "idle"
    ) {
      return;
    }
    const currentFavorites = workMusicSettings.settings.favoriteTracks;
    const identity = musicTrackIdentity(track);
    const alreadyFavorite = currentFavorites.some(
      (favorite) => musicTrackIdentity(favorite) === identity,
    );
    setSceneMusicQueueActionState("saving-favorite");
    setSceneMusicQueueError(null);
    try {
      const saved = await window.eumStudio.settings.saveWorkMusic({
        schemaVersion: 1,
        workId: activeWork.workId,
        expectedRevision: workMusicSettings.revision,
        settings: {
          ...workMusicSettings.settings,
          favoriteTracks: alreadyFavorite
            ? currentFavorites.filter(
                (favorite) => musicTrackIdentity(favorite) !== identity,
              )
            : Object.freeze([...currentFavorites, track]),
        },
      });
      setWorkMusicSettings(saved);
    } catch (reason) {
      setSceneMusicQueueError(
        reason instanceof Error
          ? reason.message
          : "선호 영상을 저장하지 못했습니다.",
      );
    } finally {
      setSceneMusicQueueActionState("idle");
    }
  }, [
    activeWork,
    musicLibraryActionState,
    sceneMusicQueueActionState,
    workMusicSettings,
  ]);

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
        setCharacterRelations([]);
        setSelectedCharacterId(null);
        setCharacterActionError(null);
        setCharacterRelationActionState("idle");
        setCharacterDialogOpen(false);
        setWorkSection("write");
        setCharacterWorkspaceSelection(null);
        setCharacterExtractionCandidates([]);
        setCharacterExtractionActionError(null);
        setCharacterExtractionPermissionRequired(false);
        setCharacterExtractionDestinationId(null);
        setCharacterGenerationCandidates([]);
        setCharacterGenerationActionState("idle");
        setCharacterGenerationActionError(null);
      }, 0);
      return () => {
        window.clearTimeout(reset);
      };
    }
    let disposed = false;
    void Promise.all([
      window.eumStudio.characters.list({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.characters.listRelations({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.characters.listExtractionCandidates({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.characters.listGenerationCandidates({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
      window.eumStudio.assistant.getChatGptOAuthStatus(),
    ]).then(
      ([
        projection,
        relationProjection,
        extractionProjection,
        generationProjection,
        oauthStatus,
      ]) => {
        if (!disposed) {
          setCharacters(projection.characters);
          setCharacterRelations(relationProjection.relations);
          setCharacterExtractionCandidates(extractionProjection.candidates);
          setCharacterGenerationCandidates(generationProjection.candidates);
          setChatGptOAuthStatus(oauthStatus);
          setSelectedCharacterId((current) =>
            current !== null && projection.characters.some(
              (character) => character.characterId === current,
            )
              ? current
              : (projection.characters[0]?.characterId ?? null)
          );
          setCharacterActionError(null);
          setCharacterExtractionActionError(null);
          setCharacterGenerationActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setCharacters([]);
          setCharacterRelations([]);
          setCharacterExtractionCandidates([]);
          setCharacterGenerationCandidates([]);
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
        setReadthroughSettings(null);
        setReadthroughActionState("loading");
        setReadthroughError(null);
        setRecordsExportActionState("idle");
        setRecordsExportError(null);
        setRecordsExportMessage(null);
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
      window.eumStudio.activity.getReadthrough({
        schemaVersion: 1,
        workId: activeWorkId,
      }),
    ]).then(
      ([
        activityProjection,
        pomodoroProjection,
        goalsProjection,
        readthroughProjection,
      ]) => {
        if (!disposed) {
          setWorkActivity(activityProjection);
          setPomodoro(pomodoroProjection);
          setDailyGoals(goalsProjection);
          setReadthroughSettings(readthroughProjection);
          setReadthroughActionState("idle");
          setReadthroughError(null);
          setDailyGoalError(null);
          setActivityActionError(null);
        }
      },
      () => {
        if (!disposed) {
          setWorkActivity(null);
          setPomodoro(null);
          setDailyGoals(null);
          setReadthroughSettings(null);
          setReadthroughActionState("idle");
          setReadthroughError("집필 기록 설정을 불러오지 못했습니다.");
          setActivityActionError("작업 기록과 집중 타이머를 불러오지 못했습니다.");
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
        setWorkSchedule(null);
        setShowSchedule(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let disposed = false;
    const today = localDateKey();
    void window.eumStudio.schedule.listCalendar({
      schemaVersion: 1,
      workId: activeWorkId,
      range: { from: today, to: today },
    }).then(
      (projection) => {
        if (!disposed) setWorkSchedule(projection);
      },
      () => {
        if (!disposed) setWorkSchedule(null);
      },
    );
    return () => {
      disposed = true;
    };
  }, [activeWorkId, scheduleRefreshRevision, scheduleSettingsRevision]);

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
    if (workspaceSurface !== "manuscript" || activeForwardWriting !== null) return;
    const handleFocusModeShortcut = (event: KeyboardEvent) => {
      const toggleShortcut =
        event.key === "Enter" &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey;
      const exitShortcut = event.key === "Escape" && focusMode;
      if (
        (!toggleShortcut && !exitShortcut) ||
        event.defaultPrevented ||
        event.repeat ||
        document.querySelector('[role="dialog"][aria-modal="true"]') !== null ||
        document.querySelector('[role="menu"]') !== null
      ) {
        return;
      }
      event.preventDefault();
      if (exitShortcut) {
        setFocusMode(false);
      } else {
        setFocusMode((current) => !current);
      }
    };
    window.addEventListener("keydown", handleFocusModeShortcut);
    return () => {
      window.removeEventListener("keydown", handleFocusModeShortcut);
    };
  }, [activeForwardWriting, focusMode, workspaceSurface]);

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
          const phaseAlert = derivePomodoroPhaseAlert(
            pomodoro,
            nextPomodoro,
          );
          setPomodoro(nextPomodoro);
          setWorkActivity(nextActivity);
          if (phaseAlert !== null) {
            setPomodoroPhaseAlert(phaseAlert);
            playPomodoroPhaseAlertSound();
          }
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

  const openContextEventDialog = useCallback(() => {
    if (activeDocument === undefined) return;
    const summary = manuscriptEditorRef.current?.readDocumentState(
      activeDocument,
    );
    const selection = summary?.selection.ranges[summary.selection.mainIndex];
    if (selection !== undefined && !selection.empty) {
      openEventBlockDialog();
      return;
    }
    openAnchorlessEventDialog();
  }, [activeDocument, openAnchorlessEventDialog, openEventBlockDialog]);

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

  const moveEventBlock = useCallback(async (
    eventBlock: EventBlockProjection,
    target: EventBlockMoveTarget,
  ) => {
    if (
      activeWork === undefined ||
      eventBlock.workId !== activeWork.workId ||
      eventActionState !== "idle"
    ) {
      return;
    }
    setEventActionState("moving");
    setEventActionError(null);
    try {
      await window.eumStudio.structure.moveEventBlock({
        schemaVersion: 1,
        workId: activeWork.workId,
        eventBlockId: eventBlock.eventBlockId,
        expectedRevision: eventBlock.revision,
        ...target,
      });
      await refreshEventProjection(activeWork.workId);
    } catch {
      setEventActionError("사건 순서를 이동하지 못했습니다.");
    } finally {
      setEventActionState("idle");
    }
  }, [activeWork, eventActionState, refreshEventProjection]);

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

  const linkEventSource = useCallback(async (
    eventBlock: EventBlockProjection,
  ) => {
    if (
      activeDocument === undefined ||
      activeWork === undefined ||
      eventBlock.workId !== activeWork.workId ||
      eventActionState !== "idle"
    ) {
      return;
    }
    const source = readCurrentEventSourceSelection();
    if (source === null) return;
    setEventActionState("linking");
    try {
      await persistDocument(activeDocument);
      await window.eumStudio.structure.linkEventSource({
        schemaVersion: 1,
        workId: activeWork.workId,
        eventBlockId: eventBlock.eventBlockId,
        role: "primary",
        documentId: source.documentId,
        selection: source.selection,
        exactQuote: source.exactQuote,
      });
      await refreshEventProjection(activeWork.workId);
    } catch {
      setEventActionError("현재 선택을 사건의 원고 출처로 연결하지 못했습니다.");
    } finally {
      setEventActionState("idle");
    }
  }, [
    activeDocument,
    activeWork,
    eventActionState,
    persistDocument,
    readCurrentEventSourceSelection,
    refreshEventProjection,
  ]);

  const replaceEventSource = useCallback(async (
    eventSource: EventSourceProjection,
  ) => {
    if (
      activeDocument === undefined ||
      activeWork === undefined ||
      eventSource.workId !== activeWork.workId ||
      eventActionState !== "idle"
    ) {
      return;
    }
    const source = readCurrentEventSourceSelection();
    if (source === null) return;
    setEventActionState("replacing");
    try {
      await persistDocument(activeDocument);
      await window.eumStudio.structure.replaceEventSource({
        schemaVersion: 1,
        workId: activeWork.workId,
        eventSourceId: eventSource.eventSourceId,
        expectedRevision: eventSource.revision,
        documentId: source.documentId,
        selection: source.selection,
        exactQuote: source.exactQuote,
      });
      await refreshEventProjection(activeWork.workId);
    } catch {
      setEventActionError("사건의 원고 출처를 현재 선택으로 교체하지 못했습니다.");
    } finally {
      setEventActionState("idle");
    }
  }, [
    activeDocument,
    activeWork,
    eventActionState,
    persistDocument,
    readCurrentEventSourceSelection,
    refreshEventProjection,
  ]);

  const retireEventSource = useCallback(async (
    eventSource: EventSourceProjection,
  ) => {
    if (
      activeWork === undefined ||
      eventSource.workId !== activeWork.workId ||
      eventActionState !== "idle"
    ) {
      return;
    }
    setEventActionState("retiring");
    setEventActionError(null);
    try {
      await window.eumStudio.structure.retireEventSource({
        schemaVersion: 1,
        workId: activeWork.workId,
        eventSourceId: eventSource.eventSourceId,
        expectedRevision: eventSource.revision,
      });
      await refreshEventProjection(activeWork.workId);
    } catch {
      setEventActionError("사건의 원고 출처를 해제하지 못했습니다.");
    } finally {
      setEventActionState("idle");
    }
  }, [activeWork, eventActionState, refreshEventProjection]);

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
      const range = { from: scene.range.start, to: scene.range.end };
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      if (needsVisibleTransition) {
        pendingVisibleManuscriptSelectionRef.current = {
          kind: "scene",
          workId: activeDocument.workId,
          documentId: activeDocument.documentId,
          range,
        };
        setSceneActionError(null);
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        activeDocument,
        range,
      );
      if (!selected) {
        setSceneActionError("장면의 정확한 범위로 이동하지 못했습니다.");
        return;
      }
      setSceneActionError(null);
    },
    [activeDocument, preserveCurrentWorkLocation, workSection],
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

  useEffect(() => {
    if (
      activeDocument === undefined ||
      activityActionState !== "idle" ||
      focusModeSessionTransitionPendingRef.current
    ) {
      return;
    }
    if (focusMode) {
      if (
        activeWritingSession !== undefined ||
        focusModeSessionAttemptedRef.current
      ) {
        return;
      }
      focusModeSessionAttemptedRef.current = true;
      focusModeSessionTransitionPendingRef.current = true;
      const transition = startWritingSession(activeDocument).then(async (projection) => {
        const started = projection?.sessions.find(
          (session) => session.sessionId === projection.activeSessionId,
        );
        if (started === undefined) {
          return;
        }
        if (!focusModeRef.current) {
          await stopWritingSession(started, activeDocument);
          return;
        }
        focusModeOwnedWritingSessionIdRef.current = started.sessionId;
      }).finally(() => {
        focusModeSessionTransitionPendingRef.current = false;
      });
      focusModeSessionPendingRef.current = transition;
      void transition;
      return;
    }
    focusModeSessionAttemptedRef.current = false;
    const ownedSessionId = focusModeOwnedWritingSessionIdRef.current;
    if (ownedSessionId === null) {
      return;
    }
    focusModeOwnedWritingSessionIdRef.current = null;
    if (activeWritingSession?.sessionId !== ownedSessionId) {
      return;
    }
    focusModeSessionTransitionPendingRef.current = true;
    const transition = stopWritingSession(
      activeWritingSession,
      activeDocument,
    ).then(() => undefined).finally(() => {
      focusModeSessionTransitionPendingRef.current = false;
    });
    focusModeSessionPendingRef.current = transition;
    void transition;
  }, [
    activeDocument,
    activeWritingSession,
    activityActionState,
    focusMode,
    startWritingSession,
    stopWritingSession,
  ]);

  const handleManuscriptTransaction = useCallback(
    (
      document: ManuscriptDocumentSource,
      transaction: ManuscriptTransaction,
      statistics: ManuscriptTextStatistics,
      composing: boolean,
      editorStateJson: string,
    ) => {
      const selection = transaction.selection.ranges[
        transaction.selection.mainIndex
      ];
      if (selection !== undefined) {
        setActiveManuscriptPosition((current) =>
          current?.documentId === document.documentId &&
          current.offset === selection.head
            ? current
            : {
                documentId: document.documentId,
                offset: selection.head,
              }
        );
      }
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
      resumePausedPomodoroOnInputRef.current();
      setForwardWriting((current) => {
        if (
          current === null ||
          current.workId !== document.workId ||
          current.documentId !== document.documentId
        ) {
          return current;
        }
        const writtenCharacters = Math.max(
          0,
          statistics.characterCount - current.baselineCharacterCount,
        );
        return writtenCharacters === current.writtenCharacters
          ? current
          : { ...current, writtenCharacters };
      });
      setHoveredLoreCue(null);
      setPinnedLoreCue(null);
      setLoreCueActionError(null);
      setSceneExtractionSelection((current) =>
        current?.documentId === document.documentId ? null : current
      );
      pendingSceneBoundaryPreviewRef.current = null;
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
      if (focusMode) {
        if (!writingSessionTransitionPendingRef.current) {
          void persistDocument(document).catch(() => undefined);
        }
        return;
      }
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
    [focusMode, persistDocument, stopWritingSession],
  );

  const configureAndStartPomodoro = useCallback(
    async (input: PomodoroDialogSubmitValue) => {
      if (activeDocument === undefined || activityActionState !== "idle") {
        return;
      }
      preparePomodoroPhaseAlertSound();
      setActivityActionState("starting-focus");
      setActivityActionError(null);
      setPomodoroPhaseAlert(null);
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
        if (
          workMusicSettings?.workId === activeDocument.workId &&
          workMusicSettings.settings.autoPlayOnPomodoroStart
        ) {
          const editorState =
            manuscriptEditorRef.current?.readDocumentState(activeDocument);
          const selection = editorState?.selection.ranges[
            editorState.selection.mainIndex
          ];
          if (selection !== undefined) {
            const [currentScenes, currentQueues] = await Promise.all([
              window.eumStudio.structure.listSceneProjection({
                schemaVersion: 1,
                workId: activeDocument.workId,
              }),
              window.eumStudio.musicPlayback.listSceneQueueCandidates({
                schemaVersion: 1,
                workId: activeDocument.workId,
              }),
            ]);
            setSceneProjection(currentScenes);
            setSceneMusicQueueCandidates(currentQueues.candidates);
            const cursor = selection.head;
            const documentScenes = currentScenes.scenes.filter((scene) =>
              scene.documentId === activeDocument.documentId &&
              scene.integrity === "resolved" &&
              scene.range !== null &&
              scene.range.start <= cursor
            );
            const currentScene = documentScenes.find((scene) =>
              scene.range !== null && cursor < scene.range.end
            ) ?? documentScenes.at(-1);
            const selectedCandidate = currentScene === undefined
              ? undefined
              : currentQueues.candidates.find((candidate) =>
                  candidate.sceneKey === currentScene.sceneKey &&
                  candidate.status === "selected" &&
                  candidate.integrity === "current"
                );
            const selectedOption = selectedCandidate === undefined
              ? null
              : selectedSceneMusicQueueOption(selectedCandidate);
            if (selectedOption !== null) {
              playMusicQueue(selectedOption.tracks);
            }
          }
        }
      } catch {
        setActivityActionError("집중 타이머를 시작하지 못했습니다.");
      } finally {
        setActivityActionState("idle");
      }
    },
    [
      activeDocument,
      activityActionState,
      playMusicQueue,
      persistDocument,
      workMusicSettings,
    ],
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
      activityActionState !== "idle" ||
      pomodoroResumePendingRef.current
    ) {
      return;
    }
    pomodoroResumePendingRef.current = true;
    preparePomodoroPhaseAlertSound();
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
      pomodoroResumePendingRef.current = false;
      setActivityActionState("idle");
    }
  }, [
    activeDocument,
    activePomodoroPhase,
    activityActionState,
  ]);
  useEffect(() => {
    resumePausedPomodoroOnInputRef.current = () => {
      if (
        activePomodoroPhase?.state === "paused" &&
        activePomodoroPhase.phase === "work"
      ) {
        void resumePomodoro();
      }
    };
    return () => {
      resumePausedPomodoroOnInputRef.current = () => undefined;
    };
  }, [activePomodoroPhase, resumePomodoro]);

  const savePomodoroNote = useCallback(async (note: string) => {
    if (
      activeDocument === undefined ||
      activePomodoroPhase === null ||
      activityActionState !== "idle"
    ) {
      return;
    }
    setActivityActionState("saving-focus-note");
    setActivityActionError(null);
    try {
      const nextPomodoro = await window.eumStudio.activity.updatePomodoroNote({
        schemaVersion: 1,
        workId: activeDocument.workId,
        focusCycleId: activePomodoroPhase.focusCycleId,
        note,
      });
      setPomodoro(nextPomodoro);
      const nextActivity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: activeDocument.workId,
      });
      setWorkActivity(nextActivity);
    } catch {
      setActivityActionError("세션 메모를 저장하지 못했습니다.");
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

  const startForwardWriting = useCallback((goalCharacters: number) => {
    if (activeDocument === undefined) return;
    const editor = manuscriptEditorRef.current;
    const summary = editor?.readDocumentState(activeDocument);
    const manuscript = editor?.materializeDocumentText(activeDocument);
    if (summary === null || summary === undefined || manuscript === undefined) {
      return;
    }
    setForwardWriting({
      workId: activeDocument.workId,
      documentId: activeDocument.documentId,
      goalCharacters,
      protectedLength: manuscript.length,
      baselineCharacterCount: summary.statistics.characterCount,
      writtenCharacters: 0,
    });
    setFocusMode(true);
    setShowForwardWritingDialog(false);
    queueMicrotask(() => {
      manuscriptEditorRef.current?.selectDocumentRange(activeDocument, {
        from: manuscript.length,
        to: manuscript.length,
      });
    });
  }, [activeDocument]);

  const stopForwardWriting = useCallback(() => {
    setForwardWriting(null);
    setFocusMode(false);
    setShowForwardWritingDialog(false);
  }, []);

  const openManuscriptAnalysis = useCallback(() => {
    if (activeDocument === undefined) return;
    const manuscript =
      manuscriptEditorRef.current?.materializeDocumentText(activeDocument);
    if (manuscript === undefined) return;
    setManuscriptAnalysis({
      documentTitle: activeDocument.label,
      manuscript,
    });
  }, [activeDocument]);

  const selectManuscriptTextImport = useCallback(async () => {
    if (
      activeDocument === undefined ||
      activeForwardWriting !== null ||
      manuscriptTextImportAction !== "idle"
    ) {
      return;
    }
    const sourceText =
      manuscriptEditorRef.current?.materializeDocumentText(activeDocument);
    if (sourceText === undefined) return;
    setManuscriptTextImportAction("selecting");
    setManuscriptTextImportError(null);
    try {
      const result = await window.eumStudio.editor.selectManuscriptTextImport({
        schemaVersion: 1,
        workId: activeDocument.workId,
        documentId: activeDocument.documentId,
        documentRevisionId: activeDocument.documentRevisionId,
      });
      if (result.status === "selected") {
        setManuscriptTextImport({ candidate: result, sourceText });
      }
    } catch {
      setManuscriptTextImportError("원고 TXT 파일을 불러오지 못했습니다.");
    } finally {
      setManuscriptTextImportAction("idle");
    }
  }, [activeDocument, activeForwardWriting, manuscriptTextImportAction]);

  const applyManuscriptTextImport = useCallback(() => {
    if (
      activeDocument === undefined ||
      manuscriptTextImport === null ||
      manuscriptTextImportAction !== "idle"
    ) {
      return;
    }
    const { candidate, sourceText } = manuscriptTextImport;
    const editor = manuscriptEditorRef.current;
    if (
      editor === null ||
      candidate.workId !== activeDocument.workId ||
      candidate.documentId !== activeDocument.documentId ||
      candidate.documentRevisionId !== activeDocument.documentRevisionId
    ) {
      setManuscriptTextImportError("가져오기를 연 뒤 대상 회차가 바뀌었습니다.");
      return;
    }
    const currentText = editor.materializeDocumentText(activeDocument);
    if (currentText !== sourceText) {
      setManuscriptTextImportError("가져오기를 연 뒤 현재 원고가 바뀌었습니다.");
      return;
    }
    setManuscriptTextImportAction("applying");
    const applied = editor.replaceDocumentRange(
      activeDocument,
      { from: 0, to: currentText.length },
      currentText,
      candidate.text,
    );
    const confirmed =
      applied &&
      editor.materializeDocumentText(activeDocument) === candidate.text;
    if (confirmed) {
      setManuscriptTextImport(null);
      setManuscriptTextImportError(null);
    } else {
      setManuscriptTextImportError("가져온 원고를 현재 회차에 적용하지 못했습니다.");
    }
    setManuscriptTextImportAction("idle");
  }, [activeDocument, manuscriptTextImport, manuscriptTextImportAction]);

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

  const renameDocument = useCallback(async (
    document: WorkspaceDocumentSummary,
    title: string,
  ): Promise<void> => {
    if (runtime.status !== "ready" || activeWork === undefined) {
      throw new Error("The manuscript workspace is not ready");
    }
    setWorkspaceActionState("renaming-document");
    setWorkspaceActionError(null);
    try {
      if (activeDocument !== undefined) {
        await persistDocument(activeDocument);
      }
      const catalog = await window.eumStudio.workspace.renameDocument({
        schemaVersion: 1,
        workId: activeWork.workId,
        documentId: document.documentId,
        title,
      });
      installRenamedCatalog(catalog);
    } catch (error) {
      setWorkspaceActionError("회차 이름을 변경하지 못했습니다.");
      throw error;
    } finally {
      setWorkspaceActionState("idle");
    }
  }, [
    activeDocument,
    activeWork,
    installRenamedCatalog,
    persistDocument,
    runtime.status,
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
      publishResumePreview(currentDocument);
    }
    const catalog = await window.eumStudio.workspace.getCatalog();
    setRuntime({ ...runtime, catalog });
    onCatalogChange?.(catalog);
    return catalog;
  }, [onCatalogChange, persistDocument, publishResumePreview, runtime]);

  const openSchedule = useCallback(() => {
    if (activeWorkId !== null) setShowSchedule(true);
  }, [activeWorkId]);

  const openCompletedRevision = useCallback(
    async (
      workId: EntityId<"Work">,
      documentId: EntityId<"Document">,
      revisionId: EntityId<"DocumentRevision">,
    ): Promise<WorkspaceCatalogProjection> => {
      const catalog = await activateWorkspaceLocation({
        schemaVersion: 1,
        workId,
        documentId,
      });
      setHighlightedDocumentRevisionId(revisionId);
      setReviewTab("versions");
      setWorkSection("review");
      const documentTitle = catalog.works
        .find((work) => work.workId === workId)
        ?.documents.find((document) => document.documentId === documentId)
        ?.title ?? "회차";
      await loadDocumentRevisionPreview(
        workId,
        documentId,
        revisionId,
        documentTitle,
      );
      return catalog;
    },
    [activateWorkspaceLocation, loadDocumentRevisionPreview],
  );

  const closeSchedule = useCallback(() => {
    setShowSchedule(false);
    setScheduleRefreshRevision((current) => current + 1);
    onScheduleChange?.();
  }, [onScheduleChange]);

  useEffect(() => {
    if (!showSchedule) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        document.querySelector(".schedule-item-dialog") !== null
      ) {
        return;
      }
      event.preventDefault();
      closeSchedule();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [closeSchedule, showSchedule]);

  useImperativeHandle(
    ref,
    () => ({
      activateLocation: activateWorkspaceLocation,
      createWork,
      moveDocument,
      openCompletedRevision,
      openSchedule,
      renameWork,
      retireDocument,
      retireWork,
      prepareForMain,
    }),
    [
      activateWorkspaceLocation,
      createWork,
      moveDocument,
      openCompletedRevision,
      openSchedule,
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
  const openDocumentFromSchedule = useCallback(
    (documentId: EntityId<"Document">) => {
      closeSchedule();
      setWorkSection("write");
      activateDocumentById(documentId);
    },
    [activateDocumentById, closeSchedule],
  );
  const openCompletedRevisionFromSchedule = useCallback(
    async (
      documentId: EntityId<"Document">,
      revisionId: EntityId<"DocumentRevision">,
    ): Promise<void> => {
      if (runtime.status !== "ready" || runtime.catalog.activeWorkId === null) {
        return;
      }
      const documentTitle = runtime.catalog.works
        .find((work) => work.workId === runtime.catalog.activeWorkId)
        ?.documents.find((document) => document.documentId === documentId)
        ?.title ?? "회차";
      await loadDocumentRevisionPreview(
        runtime.catalog.activeWorkId,
        documentId,
        revisionId,
        documentTitle,
      );
    },
    [loadDocumentRevisionPreview, runtime],
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
        characterActionState !== "idle" ||
        characterRelationActionState !== "idle"
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
    [activeWork, characterActionState, characterRelationActionState],
  );
  const updateCharacter = useCallback(
    async (
      character: CharacterProjection,
      changes: UpdateCharacterCommand["changes"],
    ) => {
      if (
        activeWork === undefined ||
        character.workId !== activeWork.workId ||
        characterActionState !== "idle" ||
        characterRelationActionState !== "idle"
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
    [activeWork, characterActionState, characterRelationActionState],
  );
  const retireCharacter = useCallback(
    async (character: CharacterProjection) => {
      if (
        activeWork === undefined ||
        character.workId !== activeWork.workId ||
        characterActionState !== "idle" ||
        characterRelationActionState !== "idle"
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
        setCharacterRelations((current) => Object.freeze(
          current.filter((relation) =>
            relation.workId === retired.workId &&
            relation.fromCharacterId !== retired.characterId &&
            relation.toCharacterId !== retired.characterId
          ),
        ));
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
    [
      activeWork,
      characterActionState,
      characterRelationActionState,
      characters,
    ],
  );
  const createCharacterRelation = useCallback(async (
    character: CharacterProjection,
    draft: CharacterRelationDraft,
  ) => {
    if (
      activeWork === undefined ||
      character.workId !== activeWork.workId ||
      characterRelationActionState !== "idle"
    ) {
      return;
    }
    setCharacterRelationActionState("creating");
    setCharacterActionError(null);
    try {
      const created = await window.eumStudio.characters.createRelation({
        schemaVersion: 1,
        workId: activeWork.workId,
        fromCharacterId: character.characterId,
        toCharacterId: entityId<"Character">(draft.toCharacterId),
        kind: draft.kind,
        description: draft.description,
      });
      setCharacterRelations((current) => Object.freeze([
        created,
        ...current.filter((relation) =>
          relation.workId === created.workId &&
          relation.relationId !== created.relationId
        ),
      ]));
    } catch {
      setCharacterActionError(
        "캐릭터 관계를 만들지 못했습니다. 현재 작품과 대상을 확인하세요.",
      );
    } finally {
      setCharacterRelationActionState("idle");
    }
  }, [activeWork, characterRelationActionState]);
  const updateCharacterRelation = useCallback(async (
    relation: CharacterRelationProjection,
    changes: UpdateCharacterRelationCommand["changes"],
  ) => {
    if (
      activeWork === undefined ||
      relation.workId !== activeWork.workId ||
      characterRelationActionState !== "idle"
    ) {
      return;
    }
    setCharacterRelationActionState("updating");
    setCharacterActionError(null);
    try {
      const updated = await window.eumStudio.characters.updateRelation({
        schemaVersion: 1,
        workId: activeWork.workId,
        relationId: relation.relationId,
        expectedRevision: relation.revision,
        changes,
      });
      setCharacterRelations((current) => Object.freeze(
        current
          .filter((entry) => entry.workId === updated.workId)
          .map((entry) =>
            entry.relationId === updated.relationId ? updated : entry,
          ),
      ));
    } catch {
      setCharacterActionError(
        "캐릭터 관계가 달라졌습니다. 다시 열어 확인하세요.",
      );
    } finally {
      setCharacterRelationActionState("idle");
    }
  }, [activeWork, characterRelationActionState]);
  const retireCharacterRelation = useCallback(async (
    relation: CharacterRelationProjection,
  ) => {
    if (
      activeWork === undefined ||
      relation.workId !== activeWork.workId ||
      characterRelationActionState !== "idle"
    ) {
      return;
    }
    setCharacterRelationActionState("retiring");
    setCharacterActionError(null);
    try {
      const retired = await window.eumStudio.characters.retireRelation({
        schemaVersion: 1,
        workId: activeWork.workId,
        relationId: relation.relationId,
        expectedRevision: relation.revision,
      });
      setCharacterRelations((current) => Object.freeze(
        current
          .filter((entry) => entry.workId === retired.workId)
          .map((entry) =>
            entry.relationId === retired.relationId ? retired : entry,
          ),
      ));
    } catch {
      setCharacterActionError("캐릭터 관계를 삭제하지 못했습니다.");
    } finally {
      setCharacterRelationActionState("idle");
    }
  }, [activeWork, characterRelationActionState]);
  const captureCharacterWorkspaceSelection = useCallback(async () => {
    setCharacterActionError(null);
    setCharacterExtractionActionError(null);
    setCharacterExtractionPermissionRequired(false);
    let selection: CharacterWorkspaceSelection | null = null;
    if (activeDocument !== undefined) {
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const range = summary?.selection.ranges[summary.selection.mainIndex];
      if (range !== undefined && !range.empty) {
        try {
          await persistDocument(activeDocument);
          const documentRevisionId =
            durableSaveQueueRef.current?.getCurrentRevisionId(
              activeDocument.documentId,
            ) ?? activeDocument.documentRevisionId;
          if (documentRevisionId !== null) {
            selection = Object.freeze({
              documentId: activeDocument.documentId,
              documentTitle: activeDocument.label,
              documentRevisionId,
              from: range.from,
              to: range.to,
            });
          }
        } catch {
          setCharacterExtractionActionError(
            "현재 선택 범위의 저장 revision을 확정하지 못했습니다.",
          );
        }
      }
    }
    setCharacterWorkspaceSelection(selection);
    return selection;
  }, [activeDocument, persistDocument]);

  const openCharacterWorkspace = useCallback(async () => {
    setCharacterDialogOpen(false);
    const selection = await captureCharacterWorkspaceSelection();
    setStructureTab("characters");
    setWorkSection("structure");
    return selection;
  }, [captureCharacterWorkspaceSelection]);

  const performCharacterExtraction = useCallback(async (
    selectionOverride?: CharacterWorkspaceSelection,
  ) => {
    const extractionSelection =
      selectionOverride ?? characterWorkspaceSelection;
    if (
      activeWork === undefined ||
      extractionSelection === null
    ) {
      setCharacterExtractionActionError(
        "원고에서 정확한 범위를 선택한 뒤 캐릭터 추출을 실행하세요.",
      );
      return;
    }
    setCharacterExtractionActionState("extracting");
    setCharacterExtractionActionError(null);
    try {
      const result = await window.eumStudio.characters.runExtraction({
        schemaVersion: 1,
        requestId: entityId<"CharacterExtractionRequest">(
          crypto.randomUUID(),
        ),
        workId: activeWork.workId,
        conversationId: assistantConversationId,
        sourceRange: {
          documentId: entityId<"Document">(
            extractionSelection.documentId,
          ),
          documentRevisionId: entityId<"DocumentRevision">(
            extractionSelection.documentRevisionId,
          ),
          from: extractionSelection.from,
          to: extractionSelection.to,
        },
      });
      if (result.status === "login-required") {
        setCharacterExtractionActionError(
          "GPT 연결이 필요합니다. 앱 설정에서 GPT로 로그인하세요.",
        );
        return;
      }
      if (result.status === "permission-required") {
        setCharacterExtractionPermissionRequired(true);
        setCharacterExtractionDestinationId(result.destinationId);
        return;
      }
      if (result.status === "context-rejected") {
        setCharacterExtractionActionError(
          result.reason === "stale-context"
            ? "선택 뒤 원고가 변경되었습니다. 원고에서 범위를 다시 선택하세요."
            : "현재 선택 범위를 캐릭터 추출에 사용할 수 없습니다.",
        );
        return;
      }
      setCharacterExtractionPermissionRequired(false);
      setCharacterExtractionDestinationId(null);
      setCharacterExtractionCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) => candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setCharacterExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "캐릭터 후보를 만들지 못했습니다.",
      );
    } finally {
      setCharacterExtractionActionState("idle");
    }
  }, [
    activeWork,
    assistantConversationId,
    characterWorkspaceSelection,
  ]);

  const grantCharacterExtractionPermission = useCallback(async () => {
    if (
      activeWork === undefined ||
      characterExtractionDestinationId === null ||
      characterWorkspaceSelection === null ||
      characterExtractionActionState !== "idle"
    ) {
      return;
    }
    setCharacterExtractionActionState("granting");
    setCharacterExtractionActionError(null);
    try {
      await window.eumStudio.assistant.grantContextPermission({
        schemaVersion: 1,
        workId: activeWork.workId,
        conversationId: assistantConversationId,
        capability: "character.extract",
        destinationId: characterExtractionDestinationId,
        localScope: "selection",
        externalScope: "selection",
        duration: "once",
      });
      setCharacterExtractionPermissionRequired(false);
      setCharacterExtractionActionState("idle");
      await performCharacterExtraction();
    } catch (reason) {
      setCharacterExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "캐릭터 추출 권한을 승인하지 못했습니다.",
      );
      setCharacterExtractionActionState("idle");
    }
  }, [
    activeWork,
    assistantConversationId,
    characterExtractionActionState,
    characterExtractionDestinationId,
    characterWorkspaceSelection,
    performCharacterExtraction,
  ]);

  const decideCharacterExtractionItem = useCallback(async (
    candidate: CharacterExtractionCandidate,
    item: CharacterExtractionItem,
    decision: CharacterExtractionDecision,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      characterExtractionActionState !== "idle"
    ) {
      return;
    }
    setCharacterExtractionActionState("deciding");
    setCharacterExtractionActionError(null);
    try {
      const result = await window.eumStudio.characters.decideExtractionItem({
        schemaVersion: 1,
        workId: activeWork.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        itemId: item.itemId,
        decision,
      });
      setCharacterExtractionCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (entry) => entry.candidateId !== result.candidate.candidateId,
        ),
      ]));
      if (result.status === "stale") {
        setCharacterExtractionActionError(
          "후보 생성 뒤 원고가 변경되어 이 후보를 적용할 수 없습니다.",
        );
        return;
      }
      setCharacters(result.characters);
      const decidedItem = result.candidate.items.find(
        (entry) => entry.itemId === item.itemId,
      );
      if (decidedItem?.approvedCharacterId != null) {
        setSelectedCharacterId(decidedItem.approvedCharacterId);
      }
    } catch (reason) {
      setCharacterExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "캐릭터 후보 결정을 저장하지 못했습니다.",
      );
    } finally {
      setCharacterExtractionActionState("idle");
    }
  }, [activeWork, characterExtractionActionState]);

  const performCharacterGeneration = useCallback(async (
    brief: CharacterGenerationBrief,
  ) => {
    if (
      activeWork === undefined ||
      characterGenerationActionState !== "idle"
    ) {
      return;
    }
    setCharacterGenerationActionState("generating");
    setCharacterGenerationActionError(null);
    try {
      const result = await window.eumStudio.characters.runGeneration({
        schemaVersion: 1,
        requestId: entityId<"CharacterGenerationRequest">(
          crypto.randomUUID(),
        ),
        workId: activeWork.workId,
        brief,
      });
      if (result.status === "login-required") {
        setCharacterGenerationActionError(
          "GPT 연결이 필요합니다. 앱 설정에서 GPT로 로그인하세요.",
        );
        return;
      }
      setCharacterGenerationCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) => candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setCharacterGenerationActionError(
        reason instanceof Error
          ? reason.message
          : "캐릭터 설정 초안을 만들지 못했습니다.",
      );
    } finally {
      setCharacterGenerationActionState("idle");
    }
  }, [activeWork, characterGenerationActionState]);

  const decideCharacterGenerationItem = useCallback(async (
    candidate: CharacterGenerationCandidate,
    item: CharacterGenerationItem,
    decision: CharacterExtractionDecision,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      characterGenerationActionState !== "idle"
    ) {
      return;
    }
    setCharacterGenerationActionState("deciding");
    setCharacterGenerationActionError(null);
    try {
      const result = await window.eumStudio.characters.decideGenerationItem({
        schemaVersion: 1,
        workId: activeWork.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        itemId: item.itemId,
        decision,
      });
      setCharacterGenerationCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (entry) => entry.candidateId !== result.candidate.candidateId,
        ),
      ]));
      setCharacters(result.characters);
      const decidedItem = result.candidate.items.find(
        (entry) => entry.itemId === item.itemId,
      );
      if (decidedItem?.approvedCharacterId != null) {
        setSelectedCharacterId(decidedItem.approvedCharacterId);
      }
    } catch (reason) {
      setCharacterGenerationActionError(
        reason instanceof Error
          ? reason.message
          : "캐릭터 설정 후보 결정을 저장하지 못했습니다.",
      );
    } finally {
      setCharacterGenerationActionState("idle");
    }
  }, [activeWork, characterGenerationActionState]);

  const addCharacterEvidence = useCallback(async (
    character: CharacterProjection,
  ) => {
    if (
      activeWork === undefined ||
      character.workId !== activeWork.workId ||
      characterWorkspaceSelection === null ||
      characterExtractionActionState !== "idle"
    ) {
      return;
    }
    setCharacterExtractionActionState("adding-evidence");
    setCharacterExtractionActionError(null);
    try {
      const updated = await window.eumStudio.characters.addEvidence({
        schemaVersion: 1,
        workId: activeWork.workId,
        characterId: character.characterId,
        expectedRevision: character.revision,
        documentId: entityId<"Document">(
          characterWorkspaceSelection.documentId,
        ),
        documentRevisionId: entityId<"DocumentRevision">(
          characterWorkspaceSelection.documentRevisionId,
        ),
        selection: {
          anchor: characterWorkspaceSelection.from,
          head: characterWorkspaceSelection.to,
        },
      });
      setCharacters((current) => Object.freeze([
        updated,
        ...current.filter(
          (entry) => entry.characterId !== updated.characterId,
        ),
      ]));
    } catch (reason) {
      setCharacterExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "현재 선택을 캐릭터 근거로 연결하지 못했습니다.",
      );
    } finally {
      setCharacterExtractionActionState("idle");
    }
  }, [
    activeWork,
    characterExtractionActionState,
    characterWorkspaceSelection,
  ]);

  const openCharacterEvidence = useCallback(async (
    character: CharacterProjection,
    evidence: CharacterProjection["evidences"][number],
  ) => {
    if (
      runtime.status !== "ready" ||
      activeWork === undefined ||
      character.workId !== activeWork.workId ||
      evidence.integrity !== "resolved" ||
      evidence.range === null
    ) {
      setCharacterExtractionActionError(
        "이 캐릭터 근거의 원고 위치를 바로 열 수 없습니다.",
      );
      return;
    }
    const targetDocument = runtime.documentProfile.documents.find(
      (document) =>
        document.workId === activeWork.workId &&
        document.documentId === evidence.documentId,
    );
    if (targetDocument === undefined) {
      setCharacterExtractionActionError(
        "캐릭터 근거의 원본 회차를 현재 작품에서 찾지 못했습니다.",
      );
      return;
    }
    const needsVisibleTransition = workSection !== "write";
    preserveCurrentWorkLocation();
    setWorkSection("write");
    if (activeDocument?.documentId === targetDocument.documentId) {
      if (needsVisibleTransition) {
        pendingVisibleManuscriptSelectionRef.current = {
          kind: "character",
          workId: targetDocument.workId,
          documentId: targetDocument.documentId,
          range: evidence.range,
        };
        setCharacterExtractionActionError(null);
        return;
      }
      const selected = manuscriptEditorRef.current?.selectDocumentRange(
        targetDocument,
        evidence.range,
      );
      if (!selected) {
        setCharacterExtractionActionError(
          "캐릭터 근거의 정확한 원고 범위를 선택하지 못했습니다.",
        );
      }
      return;
    }
    pendingCharacterEvidenceRef.current = {
      workId: activeWork.workId,
      documentId: targetDocument.documentId,
      range: evidence.range,
    };
    setCharacterExtractionActionState("adding-evidence");
    try {
      await activateWorkspaceLocation({
        schemaVersion: 1,
        workId: activeWork.workId,
        documentId: targetDocument.documentId,
      });
    } catch {
      pendingCharacterEvidenceRef.current = null;
      setCharacterExtractionActionState("idle");
      setCharacterExtractionActionError(
        "캐릭터 근거의 원본 회차를 열지 못했습니다.",
      );
    }
  }, [
    activeDocument,
    activeWork,
    activateWorkspaceLocation,
    preserveCurrentWorkLocation,
    runtime,
    workSection,
  ]);
  const captureSceneExtractionSelection = useCallback(async () => {
    setPlotDialogOpen(false);
    setPlotActionError(null);
    setSceneExtractionActionError(null);
    setSceneExtractionPermissionRequired(false);
    let selection: SceneExtractionSelection | null = null;
    if (activeDocument !== undefined) {
      const summary = manuscriptEditorRef.current?.readDocumentState(
        activeDocument,
      );
      const range = summary?.selection.ranges[summary.selection.mainIndex];
      if (range !== undefined && !range.empty) {
        try {
          await persistDocument(activeDocument);
          const documentRevisionId =
            durableSaveQueueRef.current?.getCurrentRevisionId(
              activeDocument.documentId,
            ) ?? activeDocument.documentRevisionId;
          if (documentRevisionId !== null) {
            selection = Object.freeze({
              documentId: activeDocument.documentId,
              documentTitle: activeDocument.label,
              documentRevisionId,
              from: range.from,
              to: range.to,
            });
          }
        } catch {
          setSceneExtractionActionError(
            "현재 선택 범위의 저장 revision을 확정하지 못했습니다.",
          );
        }
      }
    }
    setSceneExtractionSelection(selection);
    return selection;
  }, [activeDocument, persistDocument]);

  const openPlotWorkspace = useCallback(async (
    initialTab: PlotWorkspaceTab = "board",
  ) => {
    const selection = await captureSceneExtractionSelection();
    setPlotWorkspaceInitialTab(initialTab);
    setStructureTab(initialTab === "scenes" ? "scenes" : "plots");
    setWorkSection("structure");
    return selection;
  }, [captureSceneExtractionSelection]);

  const performSceneExtraction = useCallback(async (
    selectionOverride?: SceneExtractionSelection,
  ) => {
    const extractionSelection = selectionOverride ?? sceneExtractionSelection;
    if (activeWork === undefined || extractionSelection === null) {
      setSceneExtractionActionError(
        "원고에서 정확한 범위를 선택한 뒤 장면 구분을 실행하세요.",
      );
      return;
    }
    setSceneExtractionActionState("extracting");
    setSceneExtractionActionError(null);
    try {
      const result = await window.eumStudio.structure.runSceneExtraction({
        schemaVersion: 1,
        requestId: entityId<"SceneExtractionRequest">(crypto.randomUUID()),
        workId: activeWork.workId,
        conversationId: assistantConversationId,
        sourceRange: {
          documentId: entityId<"Document">(extractionSelection.documentId),
          documentRevisionId: entityId<"DocumentRevision">(
            extractionSelection.documentRevisionId,
          ),
          from: extractionSelection.from,
          to: extractionSelection.to,
        },
      });
      if (result.status === "login-required") {
        setSceneExtractionActionError(
          "GPT 연결이 필요합니다. 앱 설정에서 GPT로 로그인하세요.",
        );
        return;
      }
      if (result.status === "permission-required") {
        setSceneExtractionPermissionRequired(true);
        setSceneExtractionDestinationId(result.destinationId);
        return;
      }
      if (result.status === "context-rejected") {
        setSceneExtractionActionError(
          result.reason === "stale-context"
            ? "선택 뒤 원고가 변경되었습니다. 범위를 다시 선택하세요."
            : "현재 선택 범위를 장면 구분에 사용할 수 없습니다.",
        );
        return;
      }
      setSceneExtractionPermissionRequired(false);
      setSceneExtractionDestinationId(null);
      setSceneExtractionCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) => candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setSceneExtractionActionError(
        reason instanceof Error ? reason.message : "장면 후보를 만들지 못했습니다.",
      );
    } finally {
      setSceneExtractionActionState("idle");
    }
  }, [
    activeWork,
    assistantConversationId,
    sceneExtractionSelection,
  ]);

  const grantSceneExtractionPermission = useCallback(async () => {
    if (
      activeWork === undefined ||
      sceneExtractionDestinationId === null ||
      sceneExtractionSelection === null ||
      sceneExtractionActionState !== "idle"
    ) {
      return;
    }
    setSceneExtractionActionState("granting");
    setSceneExtractionActionError(null);
    try {
      await window.eumStudio.assistant.grantContextPermission({
        schemaVersion: 1,
        workId: activeWork.workId,
        conversationId: assistantConversationId,
        capability: "scene.extract",
        destinationId: sceneExtractionDestinationId,
        localScope: "selection",
        externalScope: "selection",
        duration: "once",
      });
      setSceneExtractionPermissionRequired(false);
      setSceneExtractionActionState("idle");
      await performSceneExtraction();
    } catch (reason) {
      setSceneExtractionActionError(
        reason instanceof Error ? reason.message : "장면 구분 권한을 승인하지 못했습니다.",
      );
      setSceneExtractionActionState("idle");
    }
  }, [
    activeWork,
    assistantConversationId,
    performSceneExtraction,
    sceneExtractionActionState,
    sceneExtractionDestinationId,
    sceneExtractionSelection,
  ]);

  const decideSceneExtractionBoundary = useCallback(async (
    candidate: SceneExtractionCandidate,
    boundary: SceneExtractionBoundary,
    decision: "accept" | "exclude",
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneExtractionActionState !== "idle"
    ) {
      return;
    }
    setSceneExtractionActionState("deciding");
    setSceneExtractionActionError(null);
    try {
      const result = await window.eumStudio.structure.decideSceneExtractionBoundary({
        schemaVersion: 1,
        workId: activeWork.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        boundaryId: boundary.boundaryId,
        decision,
      });
      setSceneExtractionCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (entry) => entry.candidateId !== result.candidate.candidateId,
        ),
      ]));
      if (result.status === "stale") {
        setSceneExtractionActionError(
          "후보 생성 뒤 원고가 변경되어 이 경계를 적용할 수 없습니다.",
        );
        return;
      }
      setSceneProjection(result.sceneProjection);
      setSceneActionError(null);
    } catch (reason) {
      setSceneExtractionActionError(
        reason instanceof Error ? reason.message : "장면 경계 결정을 저장하지 못했습니다.",
      );
    } finally {
      setSceneExtractionActionState("idle");
    }
  }, [activeWork, sceneExtractionActionState]);

  const decideSceneExtractionAnnotation = useCallback(async (
    candidate: SceneExtractionCandidate,
    scene: SceneExtractionScene,
    decision: SceneExtractionAnnotationDecision,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneExtractionActionState !== "idle"
    ) {
      return;
    }
    setSceneExtractionActionState("deciding");
    setSceneExtractionActionError(null);
    try {
      const result = await window.eumStudio.structure
        .decideSceneExtractionAnnotation({
          schemaVersion: 1,
          workId: activeWork.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          sceneItemId: scene.sceneItemId,
          decision,
        });
      setSceneExtractionCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (entry) => entry.candidateId !== result.candidate.candidateId,
        ),
      ]));
      if (result.status === "stale") {
        setSceneExtractionActionError(
          "후보 생성 뒤 원고가 변경되어 이 장면 정보를 적용할 수 없습니다.",
        );
        return;
      }
      setSceneAnnotations(result.annotations.annotations);
      setSceneProjection(result.sceneProjection);
      const musicQueues =
        await window.eumStudio.musicPlayback.listSceneQueueCandidates({
          schemaVersion: 1,
          workId: activeWork.workId,
        });
      setSceneMusicQueueCandidates(musicQueues.candidates);
      setSceneActionError(null);
    } catch (reason) {
      setSceneExtractionActionError(
        reason instanceof Error
          ? reason.message
          : "장면 정보 결정을 저장하지 못했습니다.",
      );
    } finally {
      setSceneExtractionActionState("idle");
    }
  }, [activeWork, sceneExtractionActionState]);

  const previewSceneExtractionCandidate = useCallback(async (
    candidate: SceneExtractionCandidate,
  ) => {
    if (
      runtime.status !== "ready" ||
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneExtractionActionState !== "idle"
    ) {
      return;
    }
    const targetDocument = runtime.documentProfile.documents.find(
      (document) =>
        document.workId === candidate.workId &&
        document.documentId === candidate.sourceRange.documentId,
    );
    if (targetDocument === undefined) {
      setSceneExtractionActionError(
        "장면 후보의 원본 회차를 현재 작품에서 찾지 못했습니다.",
      );
      return;
    }
    const offset = candidate.boundaries.find(
      (boundary) => boundary.status === "pending",
    )?.offset ?? candidate.sourceRange.from;
    preserveCurrentWorkLocation();
    setWorkSection("write");
    setSceneExtractionActionError(null);
    if (activeDocument?.documentId === targetDocument.documentId) {
      if (!manuscriptEditorRef.current?.revealDocumentOffset(targetDocument, offset)) {
        setSceneExtractionActionError(
          "장면 경계 미리보기 위치를 원고에서 열지 못했습니다.",
        );
      }
      return;
    }
    pendingSceneBoundaryPreviewRef.current = {
      workId: candidate.workId,
      documentId: candidate.sourceRange.documentId,
      offset,
    };
    setSceneExtractionActionState("previewing");
    try {
      await activateWorkspaceLocation({
        schemaVersion: 1,
        workId: candidate.workId,
        documentId: candidate.sourceRange.documentId,
      });
    } catch {
      pendingSceneBoundaryPreviewRef.current = null;
      setSceneExtractionActionState("idle");
      setSceneExtractionActionError(
        "장면 후보의 원본 회차를 열지 못했습니다.",
      );
    }
  }, [
    activeDocument,
    activeWork,
    activateWorkspaceLocation,
    runtime,
    preserveCurrentWorkLocation,
    sceneExtractionActionState,
  ]);

  const performSceneDraft = useCallback(async (
    plot: PlotThreadProjection,
    characterIds: readonly EntityId<"Character">[],
    settingIds: readonly EntityId<"LoreEntry">[],
  ) => {
    if (
      activeDocument === undefined ||
      activeWork === undefined ||
      plot.workId !== activeWork.workId ||
      sceneDraftActionState !== "idle"
    ) {
      return;
    }
    const state = manuscriptEditorRef.current?.readDocumentState(activeDocument);
    const selection = state?.selection.ranges[state.selection.mainIndex];
    if (selection === undefined || !selection.empty) {
      setSceneDraftActionError(
        "원고에 초안을 넣을 한 곳에 커서를 둔 뒤 플롯 작업면으로 돌아오세요.",
      );
      return;
    }
    setSceneDraftActionState("generating");
    setSceneDraftActionError(null);
    try {
      await persistDocument(activeDocument);
      const documentRevisionId =
        durableSaveQueueRef.current?.getCurrentRevisionId(
          activeDocument.documentId,
        ) ?? activeDocument.documentRevisionId;
      if (documentRevisionId === null) {
        throw new Error("장면 초안 대상 원고 revision을 확정하지 못했습니다.");
      }
      const result = await window.eumStudio.structure.runSceneDraft({
        schemaVersion: 1,
        requestId: entityId<"SceneDraftRequest">(crypto.randomUUID()),
        workId: activeWork.workId,
        plotThreadId: plot.plotThreadId,
        expectedPlotRevision: plot.revision,
        target: {
          documentId: activeDocument.documentId,
          documentRevisionId,
          insertionOffset: selection.from,
        },
        characterIds,
        settingIds,
      });
      if (result.status === "login-required") {
        setSceneDraftActionError("GPT 연결 후 장면 초안을 만들 수 있습니다.");
        return;
      }
      setSceneDraftCandidates((current) => Object.freeze([
        result.candidate,
        ...current.filter(
          (candidate) => candidate.candidateId !== result.candidate.candidateId,
        ),
      ]));
    } catch (reason) {
      setSceneDraftActionError(
        reason instanceof Error ? reason.message : "장면 초안을 만들지 못했습니다.",
      );
    } finally {
      setSceneDraftActionState("idle");
    }
  }, [
    activeDocument,
    activeWork,
    persistDocument,
    sceneDraftActionState,
  ]);

  const updateSceneDraftCandidate = useCallback(async (
    candidate: SceneDraftCandidate,
    draftText: string,
  ) => {
    if (
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneDraftActionState !== "idle"
    ) {
      return;
    }
    setSceneDraftActionState("updating");
    setSceneDraftActionError(null);
    try {
      const updated = await window.eumStudio.structure.updateSceneDraftCandidate({
        schemaVersion: 1,
        workId: candidate.workId,
        candidateId: candidate.candidateId,
        expectedCandidateRevision: candidate.revision,
        draftText,
      });
      setSceneDraftCandidates((current) => Object.freeze([
        updated,
        ...current.filter((entry) => entry.candidateId !== updated.candidateId),
      ]));
    } catch (reason) {
      setSceneDraftActionError(
        reason instanceof Error ? reason.message : "장면 초안 변경을 저장하지 못했습니다.",
      );
    } finally {
      setSceneDraftActionState("idle");
    }
  }, [activeWork, sceneDraftActionState]);

  const applySceneDraftCandidate = useCallback(async (
    candidate: SceneDraftCandidate,
  ) => {
    if (
      activeDocument === undefined ||
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneDraftActionState !== "idle"
    ) {
      return;
    }
    if (activeDocument.documentId !== candidate.target.documentId) {
      setSceneDraftActionError(
        "장면 초안의 대상 회차를 연 뒤 다시 삽입해 주세요.",
      );
      return;
    }
    setSceneDraftActionState("applying");
    setSceneDraftActionError(null);
    try {
      await persistDocument(activeDocument);
      const preparation =
        await window.eumStudio.structure.prepareSceneDraftInsertion({
          schemaVersion: 1,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
        });
      setSceneDraftCandidates((current) => Object.freeze([
        preparation.candidate,
        ...current.filter(
          (entry) => entry.candidateId !== preparation.candidate.candidateId,
        ),
      ]));
      if (preparation.status === "stale") {
        setSceneDraftActionError(
          "플롯 연결 정보나 대상 원고가 생성 이후 변경되어 자동 삽입하지 않았습니다.",
        );
        return;
      }
      let resultDocumentRevisionId: EntityId<"DocumentRevision">;
      if (preparation.status === "already-inserted") {
        resultDocumentRevisionId = preparation.resultDocumentRevisionId;
      } else {
        const inserted = manuscriptEditorRef.current?.insertTextAtExactOffset(
          activeDocument,
          candidate.target.insertionOffset,
          preparation.baseDocumentLength,
          candidate.draftText,
        ) ?? false;
        if (!inserted) {
          throw new Error("현재 원고가 달라 장면 초안을 삽입하지 않았습니다.");
        }
        await persistDocument(activeDocument);
        const currentRevisionId =
          durableSaveQueueRef.current?.getCurrentRevisionId(
            activeDocument.documentId,
          );
        if (currentRevisionId === null || currentRevisionId === undefined) {
          throw new Error("삽입한 장면 초안의 저장 revision을 확인하지 못했습니다.");
        }
        resultDocumentRevisionId = currentRevisionId;
      }
      const completed =
        await window.eumStudio.structure.completeSceneDraftInsertion({
          schemaVersion: 1,
          workId: candidate.workId,
          candidateId: candidate.candidateId,
          expectedCandidateRevision: candidate.revision,
          resultDocumentRevisionId,
        });
      setSceneDraftCandidates((current) => Object.freeze([
        completed,
        ...current.filter(
          (entry) => entry.candidateId !== completed.candidateId,
        ),
      ]));
      preserveCurrentWorkLocation();
      setWorkSection("write");
    } catch (reason) {
      setSceneDraftActionError(
        reason instanceof Error ? reason.message : "장면 초안을 원고에 삽입하지 못했습니다.",
      );
    } finally {
      setSceneDraftActionState("idle");
    }
  }, [
    activeDocument,
    activeWork,
    persistDocument,
    preserveCurrentWorkLocation,
    sceneDraftActionState,
  ]);

  const compareSceneDraftCandidate = useCallback(async (
    candidate: SceneDraftCandidate,
  ) => {
    if (
      runtime.status !== "ready" ||
      activeWork === undefined ||
      candidate.workId !== activeWork.workId ||
      sceneDraftActionState !== "idle"
    ) {
      return;
    }
    const targetDocument = runtime.documentProfile.documents.find(
      (document) =>
        document.workId === candidate.workId &&
        document.documentId === candidate.target.documentId,
    );
    if (targetDocument === undefined) {
      setSceneDraftActionError("장면 초안의 대상 회차를 찾지 못했습니다.");
      return;
    }
    preserveCurrentWorkLocation();
    setWorkSection("write");
    if (activeDocument?.documentId === targetDocument.documentId) {
      const revealed = manuscriptEditorRef.current?.revealDocumentOffset(
        targetDocument,
        Math.min(candidate.target.insertionOffset, targetDocument.initialText.length),
      );
      if (!revealed) setSceneDraftActionError("현재 원고 위치를 열지 못했습니다.");
      return;
    }
    pendingSceneDraftCompareRef.current = {
      workId: candidate.workId,
      documentId: candidate.target.documentId,
      offset: candidate.target.insertionOffset,
    };
    setSceneDraftActionState("applying");
    try {
      await activateWorkspaceLocation({
        schemaVersion: 1,
        workId: candidate.workId,
        documentId: candidate.target.documentId,
      });
    } catch {
      pendingSceneDraftCompareRef.current = null;
      setSceneDraftActionState("idle");
      setSceneDraftActionError("장면 초안의 대상 회차를 열지 못했습니다.");
    }
  }, [
    activeDocument,
    activeWork,
    activateWorkspaceLocation,
    preserveCurrentWorkLocation,
    runtime,
    sceneDraftActionState,
  ]);

  const regenerateSceneDraftCandidate = useCallback((
    candidate: SceneDraftCandidate,
  ) => {
    const plot = activeWorkPlots.find(
      (entry) => entry.plotThreadId === candidate.context.plot.plotThreadId,
    );
    if (plot === undefined) {
      setSceneDraftActionError("다시 생성할 현재 플롯을 찾지 못했습니다.");
      return;
    }
    void performSceneDraft(
      plot,
      candidate.context.characters.map((character) => character.characterId),
      candidate.context.settings.map((setting) => setting.loreEntryId),
    );
  }, [activeWorkPlots, performSceneDraft]);

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
  const createPlotFromEvent = useCallback(async (
    eventBlock: EventBlockProjection,
  ) => {
    if (
      activeWork === undefined ||
      eventBlock.workId !== activeWork.workId ||
      plotActionState !== "idle"
    ) {
      return;
    }
    setPlotActionState("creating-event");
    setPlotActionError(null);
    try {
      const mutation = await window.eumStudio.plots.createFromEvent({
        schemaVersion: 1,
        workId: activeWork.workId,
        eventBlockId: eventBlock.eventBlockId,
      });
      applyPlotEventLinkMutation(mutation);
      const [board] = await Promise.all([
        window.eumStudio.plots.getDefaultBoard({
          schemaVersion: 1,
          workId: activeWork.workId,
        }),
        refreshEventProjection(activeWork.workId),
      ]);
      setPlotBoard(board);
      setSelectedPlotThreadId(mutation.plotBeat.plotThreadId);
      setStructureTab("plots");
    } catch {
      setPlotActionError("사건에서 플롯을 만들거나 열지 못했습니다.");
    } finally {
      setPlotActionState("idle");
    }
  }, [
    activeWork,
    applyPlotEventLinkMutation,
    plotActionState,
    refreshEventProjection,
  ]);
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      if (activeDocument?.documentId === sourceDocument.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "lore",
            workId: sourceDocument.workId,
            documentId: sourceDocument.documentId,
            range: evidence.range,
          };
          setLoreActionError(null);
          setLoreDialogOpen(false);
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
    ],
  );
  const refreshLoreCandidates = useCallback(async (): Promise<boolean> => {
    if (activeWork === undefined || loreCandidateActionState !== "idle") {
      return false;
    }
    setLoreCandidateActionError(null);
    try {
      const projection = await window.eumStudio.loreCandidates.list({
        schemaVersion: 1,
        workId: activeWork.workId,
      });
      setLoreCandidates(projection.candidates);
      return true;
    } catch {
      setLoreCandidateActionError("별빛 검토 기록을 불러오지 못했습니다.");
      return false;
    }
  }, [activeWork, loreCandidateActionState]);
  const openLoreCandidateDialog = useCallback(async () => {
    if (await refreshLoreCandidates()) {
      setLoreCandidateDialogOpen(true);
    }
  }, [refreshLoreCandidates]);
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      if (activeDocument?.documentId === sourceDocument.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "loreCandidate",
            workId: sourceDocument.workId,
            documentId: sourceDocument.documentId,
            range: evidence.range,
          };
          setLoreCandidateActionError(null);
          setLoreCandidateDialogOpen(false);
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      if (activeDocument?.documentId === sourceDocument.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "plot",
            workId: sourceDocument.workId,
            documentId: sourceDocument.documentId,
            range: source.range,
          };
          setPlotActionError(null);
          setPlotDialogOpen(false);
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
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
      preserveCurrentWorkLocation();
      setWorkSection("write");
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
      preserveCurrentWorkLocation,
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      setEventActionState("opening");
      setEventActionError(null);
      if (targetDocument.documentId === activeDocument?.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "event",
            workId: targetDocument.workId,
            documentId: targetDocument.documentId,
            range: location.range,
          };
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      setWorkStructureActionState("opening");
      setWorkStructureActionError(null);
      if (targetDocument.documentId === activeDocument?.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "structure",
            workId: targetDocument.workId,
            documentId: targetDocument.documentId,
            range: input.range,
          };
          setWorkStructureDialogOpen(false);
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
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
        setCharacterDialogOpen(false);
        setStructureTab("characters");
        setWorkSection("structure");
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
    setLoreDialogOpen(false);
    setStructureTab("lore");
    setWorkSection("structure");
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
        setPlotDialogOpen(false);
        setStructureTab("plots");
        setWorkSection("structure");
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
      const needsVisibleTransition = workSection !== "write";
      preserveCurrentWorkLocation();
      setWorkSection("write");
      if (activeDocument?.documentId === sourceDocument.documentId) {
        if (needsVisibleTransition) {
          pendingVisibleManuscriptSelectionRef.current = {
            kind: "foreshadow",
            workId: sourceDocument.workId,
            documentId: sourceDocument.documentId,
            range: point.range,
          };
          setForeshadowLineActionError(null);
          setForeshadowLineDialogOpen(false);
          return;
        }
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
      preserveCurrentWorkLocation,
      runtime,
      workSection,
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
      preserveCurrentWorkLocation();
      setWorkSection("write");
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
      preserveCurrentWorkLocation,
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
    focusMode && workspaceSurface === "manuscript"
      ? "writing-workspace-focus-mode"
      : null,
    activeForwardWriting !== null && workspaceSurface === "manuscript"
      ? "writing-workspace-forward-writing"
      : null,
    theme,
  ]
    .filter((className): className is string => className !== null)
    .join(" ");
  const workScheduleSummary = workSchedule?.workId === activeWorkId
    ? deriveWorkScheduleSummary(workSchedule)
    : null;
  const changeWorkSection = (section: WorkSection) => {
    if (versionActionState !== "idle") return;
    if (section !== "write") setFocusMode(false);
    setWorkReturnLocation(null);
    setWorkSection(section);
    if (section === "review" && reviewTab === "records") {
      setRecordsNowMs(Date.now());
    } else if (section === "review" && reviewTab === "candidates") {
      void refreshLoreCandidates();
      void captureCharacterWorkspaceSelection().then((selection) => {
        setSceneExtractionSelection(selection);
      });
    }
  };
  const changeStructureTab = (tab: StructureTab) => {
    setFocusMode(false);
    setWorkReturnLocation(null);
    if (tab === "characters") {
      void openCharacterWorkspace();
      return;
    }
    if (tab === "plots" || tab === "scenes") {
      void openPlotWorkspace(tab === "scenes" ? "scenes" : "board");
      return;
    }
    setStructureTab(tab);
    setWorkSection("structure");
  };
  const changeReviewTab = (tab: ReviewTab) => {
    setReviewTab(tab);
    setWorkReturnLocation(null);
    if (tab === "records") setRecordsNowMs(Date.now());
    if (tab === "candidates") {
      void refreshLoreCandidates();
      void captureCharacterWorkspaceSelection().then((selection) => {
        setSceneExtractionSelection(selection);
      });
    }
  };
  const returnToPreviousWorkLocation = () => {
    const target = workReturnLocation;
    if (target === null) return;
    setWorkReturnLocation(null);
    if (target.section === "structure") {
      setStructureTab(target.tab as StructureTab);
    } else {
      setReviewTab(target.tab as ReviewTab);
    }
    setWorkSection(target.section);
  };
  const sceneDraftPanel = activeSelectedPlot === null ? null : (
    <SceneDraftPanel
      actionState={sceneDraftActionState}
      candidates={sceneDraftCandidates}
      characters={activeWorkCharacters}
      documentLabels={activeWorkDocumentLabels}
      error={sceneDraftActionError}
      linkedEventCount={activeWorkPlotEventLinks.filter(
        (link) => link.plotBeatId === activeSelectedPlot.plotThreadId,
      ).length}
      oauthStatus={chatGptOAuthStatus}
      onApply={(candidate) => {
        void applySceneDraftCandidate(candidate);
      }}
      onCompare={(candidate) => {
        void compareSceneDraftCandidate(candidate);
      }}
      onGenerate={(plot, characterIds, settingIds) => {
        void performSceneDraft(plot, characterIds, settingIds);
      }}
      onOpenSettings={() => onOpenSettings?.()}
      onRegenerate={regenerateSceneDraftCandidate}
      onUpdate={(candidate, draftText) => {
        void updateSceneDraftCandidate(candidate, draftText);
      }}
      plot={activeSelectedPlot}
      settings={activeWorkLoreEntries.filter(
        (entry) => entry.enabled && entry.retiredAt === null,
      )}
    />
  );
  const characterStructureContent = (
    <CharacterWorkspace
      actionState={characterActionState}
      candidates={characterExtractionCandidates}
      characters={activeWorkCharacters}
      error={characterActionError ?? inspirationActionError}
      extractionActionState={characterExtractionActionState}
      extractionError={characterExtractionActionError}
      generationActionState={characterGenerationActionState}
      generationCandidates={characterGenerationCandidates}
      generationError={characterGenerationActionError}
      inspirationBusy={
        inspirationActionState !== "idle" || workInspirationSettings === null
      }
      inspirationKeywords={
        workInspirationSettings?.settings.characterKeywords ?? []
      }
      oauthStatus={chatGptOAuthStatus}
      relationActionState={characterRelationActionState}
      relations={activeWorkCharacterRelations}
      onAddEvidence={(character) => {
        void addCharacterEvidence(character);
      }}
      onAddInspirationKeywords={addCharacterInspirationKeywords}
      onCreate={(draft) => {
        void createCharacter(draft);
      }}
      onCreateRelation={(character, draft) => {
        void createCharacterRelation(character, draft);
      }}
      onDecideCandidate={(candidate, item, decision) => {
        void decideCharacterExtractionItem(candidate, item, decision);
      }}
      onDecideGenerationCandidate={(candidate, item, decision) => {
        void decideCharacterGenerationItem(candidate, item, decision);
      }}
      onDeleteInspirationKeyword={deleteCharacterInspirationKeyword}
      onOpenEvidence={(character, evidence) => {
        void openCharacterEvidence(character, evidence);
      }}
      onOpenSettings={() => onOpenSettings?.()}
      onRequestExtractionPermission={() => {
        void grantCharacterExtractionPermission();
      }}
      onRetire={(character) => {
        void retireCharacter(character);
      }}
      onRetireRelation={(relation) => {
        void retireCharacterRelation(relation);
      }}
      onRunExtraction={() => {
        void performCharacterExtraction();
      }}
      onRunGeneration={(brief) => {
        void performCharacterGeneration(brief);
      }}
      onSaveDraw={(draft: CharacterDrawDraft) => {
        const valuesFor = (...categories: readonly string[]) =>
          draft.traits
            .filter((trait) => categories.includes(trait.category))
            .map((trait) => trait.value)
            .join("\n");
        void createCharacter({
          name: draft.name.trim(),
          aliases: Object.freeze([]),
          role: valuesFor("역할"),
          summary: draft.traits
            .map((trait) => `${trait.category}: ${trait.value}`)
            .join("\n"),
          appearance: valuesFor("의상"),
          personality: valuesFor("성격", "버릇", "비밀"),
          speech: valuesFor("말투"),
          goal: "",
          conflict: "",
          note: "",
        });
      }}
      onSelect={setSelectedCharacterId}
      onUpdate={(character, changes) => {
        void updateCharacter(character, changes);
      }}
      onUpdateRelation={(relation, changes) => {
        void updateCharacterRelation(relation, changes);
      }}
      permissionRequired={characterExtractionPermissionRequired}
      selectedCharacterId={activeSelectedCharacterId}
      selection={characterWorkspaceSelection}
    />
  );
  const plotStructureContent = (
    <PlotManagerDialog
      actionState={plotActionState}
      board={plotBoard}
      canCreateEventFromSelection={
        activeDocument !== undefined && hasManuscriptSelection
      }
      canLinkSource={activeDocument !== undefined && hasManuscriptSelection}
      documentLabels={activeWorkDocumentLabels}
      embedded
      error={plotActionError ?? inspirationActionError}
      eventBlocks={activeWorkEventBlocks}
      eventLinks={activeWorkPlotEventLinks}
      onCreate={(draft) => {
        void createPlotThread(draft);
      }}
      onCreateEvent={(plot, exactSelection) => {
        void createEventFromPlot(plot, exactSelection);
      }}
      onLinkEvent={(plot, eventBlockId, role) => {
        void linkPlotEvent(plot, eventBlockId, role);
      }}
      onLinkSource={(plot) => {
        void linkPlotThreadSource(plot);
      }}
      onMovePlacement={movePlotPlacement}
      onOpenSource={(source) => {
        void openPlotThreadSource(source);
      }}
      onRetire={(plot) => {
        void retirePlotThread(plot);
      }}
      onSelect={setSelectedPlotThreadId}
      onSetStoryTime={setPlotPlacementStoryTime}
      onUnlinkEvent={(link) => {
        void unlinkPlotEvent(link);
      }}
      onUpdate={(plot, changes) => {
        void updatePlotThread(plot, changes);
      }}
      plots={activeWorkPlots}
      sceneDraft={sceneDraftPanel}
      selectedPlotThreadId={activeSelectedPlotThreadId}
      sources={activeWorkPlotSources}
      utility={(
        <EventDrawTool
          busy={
            plotActionState !== "idle" ||
            inspirationActionState !== "idle" ||
            workInspirationSettings === null
          }
          keywords={workInspirationSettings?.settings.eventKeywords ?? []}
          onAddKeywords={addEventInspirationKeywords}
          onDeleteKeyword={deleteEventInspirationKeyword}
          onSave={(draft: EventDrawDraft) => {
            void createPlotThread({
              title: draft.cards.map((card) => card.title).join(" · "),
              stage: "",
              summary: draft.cards
                .map((card) => `${card.title}: ${card.description}`)
                .join("\n"),
              note: "",
            });
          }}
        />
      )}
    />
  );
  const sceneStructureContent = (
    <div className="plot-workspace-structure-pane">
      <SceneExtractionPanel
        actionState={sceneExtractionActionState}
        annotations={sceneAnnotations.filter(
          (annotation) => annotation.workId === activeWorkId,
        )}
        candidates={sceneExtractionCandidates}
        characters={activeWorkCharacters}
        error={sceneExtractionActionError}
        oauthStatus={chatGptOAuthStatus}
        onDecide={(candidate, boundary, decision) => {
          void decideSceneExtractionBoundary(candidate, boundary, decision);
        }}
        onDecideAnnotation={(candidate, scene, decision) => {
          void decideSceneExtractionAnnotation(candidate, scene, decision);
        }}
        onOpenSettings={() => onOpenSettings?.()}
        onPreviewCandidate={(candidate) => {
          void previewSceneExtractionCandidate(candidate);
        }}
        onRequestPermission={() => {
          void grantSceneExtractionPermission();
        }}
        onRun={() => {
          void performSceneExtraction();
        }}
        permissionRequired={sceneExtractionPermissionRequired}
        projection={
          sceneProjection?.workId === activeWorkId ? sceneProjection : null
        }
        selection={sceneExtractionSelection}
      />
      {sceneActionError !== null && (
        <p className="event-action-error" role="alert">{sceneActionError}</p>
      )}
      {sceneMusicQueueError !== null && (
        <p className="event-action-error" role="alert">{sceneMusicQueueError}</p>
      )}
      <SceneList
        activeDocumentId={activeDocument?.documentId ?? null}
        annotations={sceneAnnotations.filter(
          (annotation) => annotation.workId === activeWorkId,
        )}
        busy={
          sceneActionState !== "idle" || sceneExtractionActionState !== "idle"
        }
        favoriteMusicVideos={
          (workMusicSettings?.settings.favoriteTracks ?? []).filter(
            isYouTubeMusicTrack,
          )
        }
        musicConnected={youtubeMusicConnectionStatus?.apiKeyConfigured === true}
        musicPlaybackAvailable={youtubeMusicProfile !== null}
        musicQueueBusy={sceneMusicQueueActionState !== "idle"}
        musicQueueCandidates={sceneMusicQueueCandidates}
        onMergeWithPrevious={(scene, previousScene) => {
          void mergeSceneWithPrevious(scene, previousScene);
        }}
        onOpenMusicSettings={() => onOpenSettings?.()}
        onOpenScene={focusScene}
        onPlayFavoriteMusicVideo={(video) => playMusicQueue([video])}
        onPlaySceneMusicQueue={(candidate) => {
          void playSelectedSceneMusicQueue(candidate);
        }}
        onSearchSceneMusic={(annotation, query) => {
          void searchSceneMusicQueues(annotation, query);
        }}
        onSelectSceneMusicQueue={(candidate, option) => {
          void selectSceneMusicQueue(candidate, option);
        }}
        onSetEventOverride={(scene, eventBlockId, operation, expectedRevision) => {
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
        onToggleFavoriteMusicVideo={(video) => {
          void toggleFavoriteMusicTrack(video);
        }}
        onUpdateRuleSet={(draft) => {
          void updateSceneRuleSet(draft);
        }}
        projection={
          sceneProjection?.workId === activeWorkId ? sceneProjection : null
        }
      />
    </div>
  );
  const structureWorkspaceContent =
    activeWork === undefined || runtime.status !== "ready" ? null : (
    <StructureWorkspace
      activeTab={structureTab}
      onTabChange={changeStructureTab}
      panels={{
        overview: (
          <StructureOverviewPanel>
            {workStructureOverview === null ? (
              <p className="work-structure-empty">작품 구조를 불러오는 중입니다.</p>
            ) : (
              <WorkStructureContent
                busy={workStructureActionState !== "idle"}
                error={workStructureActionError}
                loreEntryCount={activeWorkLoreEntries.length}
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
          </StructureOverviewPanel>
        ),
        plots: <PlotStructurePanel>{plotStructureContent}</PlotStructurePanel>,
        events: (
          <EventStructurePanel>
            <EventRail
              eventBusy={eventActionState !== "idle"}
              mode={eventRailMode}
              onCreatePlot={(eventBlock) => {
                void createPlotFromEvent(eventBlock);
              }}
              onLinkSource={(eventBlock) => {
                void linkEventSource(eventBlock);
              }}
              onModeChange={setEventRailMode}
              onMovePlacement={movePlotPlacement}
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
              projection={eventRail?.workId === activeWorkId ? eventRail : null}
            />
          </EventStructurePanel>
        ),
        scenes: <SceneStructurePanel>{sceneStructureContent}</SceneStructurePanel>,
        characters: (
          <CharacterStructurePanel>{characterStructureContent}</CharacterStructurePanel>
        ),
        foreshadow: (
          <ForeshadowStructurePanel>
            <ForeshadowLineContent
              actionState={foreshadowLineActionState}
              canCapture={activeDocument !== undefined && hasManuscriptSelection}
              documentLabels={activeWorkDocumentLabels}
              error={foreshadowLineActionError}
              lines={foreshadowLines}
              loreEntries={activeWorkLoreEntries}
              loreForeshadowLinks={activeWorkLoreForeshadowLinks}
              onCapture={(lineId, roleId, note) => {
                void captureForeshadowPoint(lineId, roleId, note);
              }}
              onCreate={(title, note) => {
                void createForeshadowLine(title, note);
              }}
              onLinkLore={(line, loreEntryId) => {
                const entry = activeWorkLoreEntries.find(
                  (candidate) => candidate.loreEntryId === loreEntryId,
                );
                if (entry !== undefined) {
                  void linkLoreForeshadow(entry, line, "foreshadow");
                }
              }}
              onOpenPoint={(point) => {
                void openForeshadowPointSource(point);
              }}
              onRetire={(line) => {
                void retireForeshadowLine(line);
              }}
              onUnlinkLore={(link) => {
                void unlinkLoreForeshadow(link, "foreshadow");
              }}
              onUpdate={(line, changes) => {
                void updateForeshadowLine(line, changes);
              }}
              points={foreshadowPoints}
              profile={runtime.foreshadowPointProfile}
              selectedLineId={selectedForeshadowLineId}
            />
          </ForeshadowStructurePanel>
        ),
        lore: (
          <LoreStructurePanel>
            <LoreManagerContent
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
              onCreate={(draft) => {
                void createLoreEntry(draft);
              }}
              onLinkForeshadow={(entry, lineId) => {
                const line = foreshadowLines.find(
                  (candidate) => candidate.lineId === lineId,
                );
                if (line !== undefined) {
                  void linkLoreForeshadow(entry, line, "lore");
                }
              }}
              onOpenEvidence={(evidence) => {
                void openLoreEntryEvidence(evidence);
              }}
              onRetire={(entry) => {
                void retireLoreEntry(entry);
              }}
              onSelect={setSelectedLoreEntryId}
              onUnlinkForeshadow={(link) => {
                void unlinkLoreForeshadow(link, "lore");
              }}
              onUpdate={(entry, changes) => {
                void updateLoreEntry(entry, changes);
              }}
              selectedLoreEntryId={activeSelectedLoreEntryId}
            />
          </LoreStructurePanel>
        ),
      }}
    />
  );
  const pendingCharacterCandidateCount = [
    ...characterExtractionCandidates,
    ...characterGenerationCandidates,
  ].reduce(
    (count, candidate) =>
      count + candidate.items.filter((item) => item.status === "pending").length,
    0,
  );
  const pendingSceneCandidateCount = sceneExtractionCandidates.reduce(
    (count, candidate) =>
      count +
      candidate.boundaries.filter((boundary) => boundary.status === "pending").length +
      candidate.scenes.filter((scene) => scene.annotationStatus === "pending").length,
    0,
  );
  const pendingLoreCandidateCount = activeWorkLoreCandidates.filter(
    (candidate) => candidate.status === "pending",
  ).length;
  const reviewWorkspaceContent =
    activeWork === undefined || workActivity === null ? null : (
      <ReviewWorkspace
        activeTab={reviewTab}
        onTabChange={changeReviewTab}
        panels={{
          records: (
            <WorkRecordsPanel>
              <WorkRecordsContent
                activity={workActivity}
                busy={
                  activityActionState !== "idle" ||
                  recordsExportActionState !== "idle"
                }
                error={activityActionError}
                exportActionState={recordsExportActionState}
                exportError={recordsExportError}
                exportMessage={recordsExportMessage}
                goalActionState={
                  dailyGoals === null ? "loading" : dailyGoalActionState
                }
                goalError={dailyGoalError}
                goalSettings={dailyGoals}
                nowMs={recordsNowMs}
                onExport={({ format, fromDate, toDate }) => {
                  setRecordsExportError(null);
                  setRecordsExportMessage(null);
                  setRecordsExportActionState(`exporting-${format}`);
                  void window.eumStudio.activity.exportRecords({
                    schemaVersion: 1,
                    workId: activeWork.workId,
                    format,
                    fromDate,
                    toDate,
                  }).then(
                    (result) => {
                      setRecordsExportMessage(
                        result.status === "cancelled"
                          ? "기록 내보내기를 취소했습니다."
                          : `${result.sessionCount}개 세션을 내보냈습니다.`,
                      );
                      setRecordsExportActionState("idle");
                    },
                    (reason: unknown) => {
                      setRecordsExportError(
                        reason instanceof Error
                          ? reason.message
                          : "집필 기록을 내보내지 못했습니다.",
                      );
                      setRecordsExportActionState("idle");
                    },
                  );
                }}
                onOpenDocument={(documentId) => {
                  setWorkReturnLocation({ section: "review", tab: "records" });
                  setWorkSection("write");
                  activateDocumentById(documentId);
                }}
                onSaveGoals={(goals) => {
                  if (dailyGoals === null) return;
                  setDailyGoalActionState("saving");
                  setDailyGoalError(null);
                  void window.eumStudio.activity.saveRecordsGoals({
                    schemaVersion: 1,
                    workId: dailyGoals.workId,
                    expectedRevision: dailyGoals.revision,
                    goals,
                  }).then(
                    (projection) => {
                      setDailyGoals(projection);
                      setDailyGoalActionState("idle");
                    },
                    () => {
                      setDailyGoalError("집필 목표를 저장하지 못했습니다.");
                      setDailyGoalActionState("idle");
                    },
                  );
                }}
                onSaveReadthrough={(entries: readonly WorkReadthroughEntry[]) => {
                  if (readthroughSettings === null) return;
                  setReadthroughActionState("saving");
                  setReadthroughError(null);
                  void window.eumStudio.activity.saveReadthrough({
                    schemaVersion: 1,
                    workId: readthroughSettings.workId,
                    expectedRevision: readthroughSettings.revision,
                    entries,
                  }).then(
                    (projection) => {
                      setReadthroughSettings(projection);
                      setReadthroughActionState("idle");
                    },
                    () => {
                      setReadthroughError("연독률 기록을 저장하지 못했습니다.");
                      setReadthroughActionState("idle");
                    },
                  );
                }}
                readthroughActionState={readthroughActionState}
                readthroughError={readthroughError}
                readthroughSettings={readthroughSettings}
                work={activeWork}
              />
            </WorkRecordsPanel>
          ),
          manuscript: (
            <ManuscriptReviewPanel
              disabled={activeDocument === undefined}
              error={
                preflightActionError ??
                continuousReadingOpenError ??
                manuscriptTextImportError
              }
              onOpenAnalysis={openManuscriptAnalysis}
              onOpenContinuousReading={() => {
                void openContinuousReading();
              }}
              onOpenPreflight={openManuscriptPreflight}
            />
          ),
          candidates: (
            <CandidateInboxPanel
              counts={{
                characters: pendingCharacterCandidateCount,
                scenes: pendingSceneCandidateCount,
                lore: pendingLoreCandidateCount,
              }}
              panels={{
                characters: (
                  <CharacterCandidateReviewPanel
                    busy={
                      characterExtractionActionState !== "idle" ||
                      characterGenerationActionState !== "idle"
                    }
                    candidates={characterExtractionCandidates}
                    characters={activeWorkCharacters}
                    generationCandidates={characterGenerationCandidates}
                    onDecideCandidate={(candidate, item, decision) => {
                      void decideCharacterExtractionItem(candidate, item, decision);
                    }}
                    onDecideGenerationCandidate={(candidate, item, decision) => {
                      void decideCharacterGenerationItem(candidate, item, decision);
                    }}
                  />
                ),
                scenes: sceneStructureContent,
                lore: (
                  <LoreCandidateContent
                    actionState={loreCandidateActionState}
                    canCapture={activeDocument !== undefined && hasManuscriptSelection}
                    candidates={activeWorkLoreCandidates}
                    documentLabels={activeWorkDocumentLabels}
                    entries={activeWorkLoreEntries}
                    error={loreCandidateActionError}
                    onApprove={(candidate) => {
                      void approveLoreCandidate(candidate);
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
                ),
              }}
            />
          ),
          versions: (
            <VersionPanel
              actionState={versionActionState}
              documentRevisions={documentRevisions}
              error={versionActionError}
              highlightedRevisionId={highlightedDocumentRevisionId}
              onCompareSnapshot={(snapshotId) => {
                void compareWorkSnapshot(snapshotId);
              }}
              onCreateSnapshot={createWorkSnapshot}
              onRefresh={() => {
                void refreshStoredVersions();
              }}
              onRestoreRevision={(revisionId) => {
                void restoreDocumentRevision(revisionId);
              }}
              onSnapshotLabelChange={setSnapshotLabel}
              snapshotLabel={snapshotLabel}
              workSnapshots={workSnapshots}
            />
          ),
        }}
      />
    );
  const workOperationsContent = activeWork === undefined ? null : (
    <WorkOperationsWorkspace
      onOpen={(section) => onOpenPublishing?.(section, activeWork.workId)}
      workTitle={activeWork.title}
    />
  );
  const musicFocusText = activePomodoroPhase !== null
    ? `${activePomodoroPhase.phase === "work" ? "집중" : "휴식"} ${formatTimerDuration(
        activePomodoroPhase.state === "running"
          ? remainingTimerMs(activePomodoroPhase.deadlineAt, activityClock)
          : activePomodoroPhase.remainingDurationMs,
      )}`
    : activeFocusCycle !== undefined
      ? `${activeFocusCycle.phaseRef} ${formatTimerDuration(
          remainingTimerMs(activeFocusCycle.deadlineAt, activityClock),
      )}`
      : null;
  const focusPomodoroStatus = activePomodoroPhase === null
    ? null
    : `${activePomodoroPhase.phase === "work" ? "작업" : "휴식"} ${
        activePomodoroPhase.cycleNumber
      }/${pomodoro?.settings?.workCycleCount ?? activePomodoroPhase.cycleNumber} · 완료 ${
        pomodoro?.completedWorkCycles ?? 0
      }회`;
  const focusPomodoroTimerText = activePomodoroPhase === null
    ? musicFocusText
    : formatTimerDuration(
        activePomodoroPhase.state === "running"
          ? remainingTimerMs(activePomodoroPhase.deadlineAt, activityClock)
          : activePomodoroPhase.remainingDurationMs,
      );
  const focusSaveStatus =
    runtime.status === "ready" &&
    runtime.startupRecovery.status === "recovery-pending"
      ? "복구 적용 대기"
      : runtime.status === "ready" &&
          runtime.startupRecovery.status === "read-only-error"
        ? "복구 확인 필요"
        : activeSaveState === null
          ? "저장 경로 없음"
          : SAVE_STATE_LABELS[activeSaveState];
  const focusForwardWritingStatus = activeForwardWriting === null
    ? null
    : activeForwardWriting.writtenCharacters >= activeForwardWriting.goalCharacters
      ? `목표 달성 · ${activeForwardWriting.writtenCharacters.toLocaleString()}자`
      : `목표까지 ${(
          activeForwardWriting.goalCharacters -
          activeForwardWriting.writtenCharacters
        ).toLocaleString()}자`;

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
        data-structure-tab={workSection === "structure" ? structureTab : undefined}
        data-work-section={workSection}
        data-workspace-surface={workspaceSurface}
        data-ui-model="eum-studio-editor"
      >
        {pomodoroPhaseAlert !== null &&
          pomodoroPhaseAlert.workId === activeWorkId && (
          <PomodoroPhaseAlert
            alert={pomodoroPhaseAlert}
            key={pomodoroPhaseAlert.alertId}
            onDismiss={() => setPomodoroPhaseAlert(null)}
          />
        )}
        {embedded ? (
          <WorkHeader
            actions={(
              <>
                {workSection === "write" && (
                  <>
                    {activeDocumentSummary !== undefined && (
                      <DocumentCompletionControl
                        busy={workspaceActionState !== "idle"}
                        completion={activeDocumentSummary.completion}
                        onClear={() => {
                          void clearActiveDocumentCompletion();
                        }}
                        onComplete={() => {
                          void completeActiveDocument();
                        }}
                        onOpenCompletedRevision={
                          openActiveDocumentCompletedRevision
                        }
                      />
                    )}
                    <ManuscriptCount telemetryStore={telemetryStore} />
                  </>
                )}
                <p
                  aria-label="작업공간 상태"
                  className="runtime-status runtime-status-embedded"
                  data-runtime-status={runtime.status}
                  data-testid="runtime-status"
                >
                  <span aria-hidden="true" className="runtime-dot" />
                </p>
              </>
            )}
            activeSection={workSection}
            heading={
              workSection === "write"
                ? (activeDocument?.label ?? "원고")
                : workSection === "structure"
                  ? "구조"
                  : workSection === "review"
                    ? "검토"
                    : "운영"
            }
            headingTestId={workSection === "write" ? "manuscript-title" : undefined}
            navigationDisabled={
              versionActionState !== "idle" || workspaceActionState !== "idle"
            }
            onBack={() => onReturnToWorks?.()}
            onOpenSchedule={openSchedule}
            onSectionChange={changeWorkSection}
            returnAction={
              workSection === "write" && workReturnLocation !== null
                ? {
                    label: workReturnLocation.section === "review"
                      ? "검토로 돌아가기"
                      : "구조로 돌아가기",
                    onClick: returnToPreviousWorkLocation,
                  }
                : undefined
            }
            schedule={workScheduleSummary}
            titleEditor={
              titleEditTarget === "work" ? (
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
              ) : undefined
            }
            workTitle={activeWork?.title ?? "쓰기"}
          />
        ) : (
          <header className="manuscript-header">
            <div className="manuscript-title-block">
              <p className="manuscript-context">로컬 편집 표면</p>
              <h2 id="manuscript-heading">원고</h2>
            </div>
            <div className="manuscript-tools">
              <ManuscriptCount telemetryStore={telemetryStore} />
            </div>
          </header>
        )}
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
                        titleEditTarget !== null
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
                      onCreate={() => {
                        setWorkspaceActionError(null);
                        void createDocument("").catch(
                          () => undefined,
                        );
                      }}
                    />
                  }
                  onActivateDocument={activateDocumentById}
                  onRenameDocument={renameDocument}
                  onCreateFolder={createDocumentFolder}
                  onMoveDocument={async (documentId, direction) => {
                    await moveDocument(activeWork.workId, documentId, direction);
                  }}
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
                        titleEditTarget !== null
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
                      onCreate={() => {
                        setWorkspaceActionError(null);
                        void createDocument("").catch(
                          () => undefined,
                        );
                      }}
                    />
                  }
                  onActivateDocument={activateDocumentById}
                  onRenameDocument={renameDocument}
                  onCreateFolder={createDocumentFolder}
                  onMoveDocument={async (documentId, direction) => {
                    await moveDocument(activeWork.workId, documentId, direction);
                  }}
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
                      placeholder="원고 검색"
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
            <div
              className="manuscript-workspace-surface"
              hidden={workspaceSurface !== "manuscript"}
            >
            {focusMode &&
              runtime.status === "ready" &&
              activeDocument !== undefined && (
                <FocusModeToolbarWithTelemetry
                  contentWidthPx={focusContentWidthPx}
                  currentBlockHighlight={focusCurrentBlockHighlight}
                  exitLabel={
                    activeForwardWriting === null
                      ? "집중 화면 종료"
                      : "수정금지 종료"
                  }
                  modeLabel={
                    activeForwardWriting === null ? null : "수정금지 집필"
                  }
                  modeStatus={focusForwardWritingStatus}
                  onContentWidthChange={(value) => {
                    setFocusContentWidthPx(value);
                    persistFocusModePreferences({ contentWidthPx: value });
                  }}
                  onCurrentBlockHighlightChange={(value) => {
                    setFocusCurrentBlockHighlight(value);
                    persistFocusModePreferences({
                      currentBlockHighlight: value,
                    });
                  }}
                  onExit={() => {
                    if (activeForwardWriting === null) {
                      setFocusMode(false);
                    } else {
                      stopForwardWriting();
                    }
                  }}
                  onTypewriterModeChange={(value) => {
                    setFocusTypewriterMode(value);
                    persistFocusModePreferences({ typewriterMode: value });
                  }}
                  onTypewriterPositionChange={changeFocusTypewriterPosition}
                  onZoomChange={(value) => {
                    setFocusZoomPercent(value);
                    persistFocusModePreferences({ zoomPercent: value });
                  }}
                  pomodoroPhase={activePomodoroPhase?.phase ?? null}
                  pomodoroStatus={focusPomodoroStatus}
                  saveStatus={focusSaveStatus}
                  timerStatus={focusPomodoroTimerText}
                  telemetryStore={telemetryStore}
                  typewriterMode={focusTypewriterMode}
                  typewriterPositionPercent={focusTypewriterPositionPercent}
                  zoomPercent={focusZoomPercent}
                />
              )}
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
                {...(focusMode && workspaceSurface === "manuscript"
                  ? {
                      focusPresentation: {
                        active: true,
                        contentWidthPx: focusContentWidthPx,
                        currentBlockHighlight: focusCurrentBlockHighlight,
                        typewriterMode: focusTypewriterMode,
                        typewriterPositionPercent:
                          focusTypewriterPositionPercent,
                        zoomPercent: focusZoomPercent,
                      },
                    }
                  : {})}
                forwardWriteProtectedLength={
                  activeForwardWriting?.protectedLength ?? null
                }
                heatmapMode={heatmapMode}
                inputProfile={runtime.inputProfile}
                {...(workManuscriptLayout?.workId === activeDocument.workId
                  ? { layoutSettings: workManuscriptLayout.settings }
                  : {})}
                loreEntries={activeWorkLoreEntries}
                orderedDocuments={activeWorkDocuments}
                onBlur={handleEditorBlur}
                onAddEvent={openContextEventDialog}
                onAddScene={() => {
                  void createSceneBoundary();
                }}
                onCompositionEnd={handleCompositionEnd}
                onDocumentActivated={handleDocumentActivated}
                onFormattingChange={handleFormattingChange}
                onHeatmapModeChange={setHeatmapMode}
                onLayoutSettingsChange={handleWorkManuscriptLayoutChange}
                onImportText={() => {
                  void selectManuscriptTextImport();
                }}
                onLoreCueHover={handleLoreCueHover}
                onOpenLoreCue={openLoreCueInspector}
                onOpenContinuousReading={() => {
                  void openContinuousReading();
                }}
                onOpenAnalysis={openManuscriptAnalysis}
                onOpenPreflight={openManuscriptPreflight}
                onTransaction={handleManuscriptTransaction}
                  readOnly={
                    runtime.startupRecovery.status !== "clean" ||
                    workspaceActionState === "setting-document-completion"
                  }
                  resumeLocation={
                    runtime.resumeCheckpoint
                      .status ===
                    "resolved"
                      ? runtime.resumeCheckpoint
                      : null
                  }
                  sceneBoundaryPreviews={sceneBoundaryPreviews}
                ref={manuscriptEditorRef}
              />
            )}
            {preflightActionError !== null && (
              <p className="preflight-open-error" role="alert">
                {preflightActionError}
              </p>
            )}
            {manuscriptTextImportError !== null &&
              manuscriptTextImport === null && (
                <p className="preflight-open-error" role="alert">
                  {manuscriptTextImportError}
                </p>
              )}
            {continuousReadingOpenError !== null && (
              <p className="preflight-open-error" role="alert">
                {continuousReadingOpenError}
              </p>
            )}
            </div>
            {runtime.status === "ready" &&
              activeWork !== undefined &&
              workSection === "structure" &&
              structureWorkspaceContent}
            {runtime.status === "ready" &&
              activeWork !== undefined &&
              workSection === "review" &&
              reviewWorkspaceContent}
            {runtime.status === "ready" &&
              activeWork !== undefined &&
              workSection === "operations" &&
              workOperationsContent}
            {runtime.status === "ready" &&
              activeWork !== undefined &&
              workspaceSurface === "characters" &&
              workSection !== "structure" && (
                <CharacterWorkspace
                  actionState={characterActionState}
                  candidates={characterExtractionCandidates}
                  characters={activeWorkCharacters}
                  error={characterActionError ?? inspirationActionError}
                  extractionActionState={characterExtractionActionState}
                  extractionError={characterExtractionActionError}
                  generationActionState={characterGenerationActionState}
                  generationCandidates={characterGenerationCandidates}
                  generationError={characterGenerationActionError}
                  inspirationBusy={
                    inspirationActionState !== "idle" ||
                    workInspirationSettings === null
                  }
                  inspirationKeywords={
                    workInspirationSettings?.settings.characterKeywords ?? []
                  }
                  oauthStatus={chatGptOAuthStatus}
                  relationActionState={characterRelationActionState}
                  relations={activeWorkCharacterRelations}
                  onAddEvidence={(character) => {
                    void addCharacterEvidence(character);
                  }}
                  onAddInspirationKeywords={addCharacterInspirationKeywords}
                  onCreate={(draft) => {
                    void createCharacter(draft);
                  }}
                  onCreateRelation={(character, draft) => {
                    void createCharacterRelation(character, draft);
                  }}
                  onDecideCandidate={(candidate, item, decision) => {
                    void decideCharacterExtractionItem(
                      candidate,
                      item,
                      decision,
                    );
                  }}
                  onDecideGenerationCandidate={(candidate, item, decision) => {
                    void decideCharacterGenerationItem(
                      candidate,
                      item,
                      decision,
                    );
                  }}
                  onOpenEvidence={(character, evidence) => {
                    void openCharacterEvidence(character, evidence);
                  }}
                  onOpenSettings={() => onOpenSettings?.()}
                  onDeleteInspirationKeyword={
                    deleteCharacterInspirationKeyword
                  }
                  onRequestExtractionPermission={() => {
                    void grantCharacterExtractionPermission();
                  }}
                  onRetire={(character) => {
                    void retireCharacter(character);
                  }}
                  onRetireRelation={(relation) => {
                    void retireCharacterRelation(relation);
                  }}
                  onRunGeneration={(brief) => {
                    void performCharacterGeneration(brief);
                  }}
                  onRunExtraction={() => {
                    void performCharacterExtraction();
                  }}
                  onSaveDraw={(draft: CharacterDrawDraft) => {
                    const valuesFor = (...categories: readonly string[]) =>
                      draft.traits
                        .filter((trait) => categories.includes(trait.category))
                        .map((trait) => trait.value)
                        .join("\n");
                    void createCharacter({
                      name: draft.name.trim(),
                      aliases: Object.freeze([]),
                      role: valuesFor("역할"),
                      summary: draft.traits
                        .map((trait) => `${trait.category}: ${trait.value}`)
                        .join("\n"),
                      appearance: valuesFor("의상"),
                      personality: valuesFor("성격", "버릇", "비밀"),
                      speech: valuesFor("말투"),
                      goal: "",
                      conflict: "",
                      note: "",
                    });
                  }}
                  onSelect={setSelectedCharacterId}
                  onUpdate={(character, changes) => {
                    void updateCharacter(character, changes);
                  }}
                  onUpdateRelation={(relation, changes) => {
                    void updateCharacterRelation(relation, changes);
                  }}
                  permissionRequired={characterExtractionPermissionRequired}
                  selectedCharacterId={activeSelectedCharacterId}
                  selection={characterWorkspaceSelection}
                />
              )}
            {runtime.status === "ready" &&
              activeWork !== undefined &&
              workspaceSurface === "plots" &&
              workSection !== "structure" && (
                <PlotWorkspace
                  board={(
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
                      embedded
                      error={plotActionError ?? inspirationActionError}
                      eventBlocks={activeWorkEventBlocks}
                      eventLinks={activeWorkPlotEventLinks}
                      onCreate={(draft) => {
                        void createPlotThread(draft);
                      }}
                      onCreateEvent={(plot, exactSelection) => {
                        void createEventFromPlot(plot, exactSelection);
                      }}
                      onLinkEvent={(plot, eventBlockId, role) => {
                        void linkPlotEvent(plot, eventBlockId, role);
                      }}
                      onLinkSource={(plot) => {
                        void linkPlotThreadSource(plot);
                      }}
                      onMovePlacement={movePlotPlacement}
                      onOpenSource={(source) => {
                        void openPlotThreadSource(source);
                      }}
                      onRetire={(plot) => {
                        void retirePlotThread(plot);
                      }}
                      onSelect={setSelectedPlotThreadId}
                      onSetStoryTime={setPlotPlacementStoryTime}
                      onUnlinkEvent={(link) => {
                        void unlinkPlotEvent(link);
                      }}
                      onUpdate={(plot, changes) => {
                        void updatePlotThread(plot, changes);
                      }}
                      plots={activeWorkPlots}
                      sceneDraft={sceneDraftPanel}
                      selectedPlotThreadId={activeSelectedPlotThreadId}
                      sources={activeWorkPlotSources}
                      utility={(
                        <EventDrawTool
                          busy={
                            plotActionState !== "idle" ||
                            inspirationActionState !== "idle" ||
                            workInspirationSettings === null
                          }
                          keywords={
                            workInspirationSettings?.settings.eventKeywords ?? []
                          }
                          onAddKeywords={addEventInspirationKeywords}
                          onDeleteKeyword={deleteEventInspirationKeyword}
                          onSave={(draft: EventDrawDraft) => {
                            void createPlotThread({
                              title: draft.cards
                                .map((card) => card.title)
                                .join(" · "),
                              stage: "",
                              summary: draft.cards
                                .map((card) => `${card.title}: ${card.description}`)
                                .join("\n"),
                              note: "",
                            });
                          }}
                        />
                      )}
                    />
                  )}
                  initialTab={plotWorkspaceInitialTab}
                  scenes={(
                    <div className="plot-workspace-structure-pane">
                      <SceneExtractionPanel
                        actionState={sceneExtractionActionState}
                        annotations={sceneAnnotations.filter(
                          (annotation) => annotation.workId === activeWorkId,
                        )}
                        candidates={sceneExtractionCandidates}
                        characters={activeWorkCharacters}
                        error={sceneExtractionActionError}
                        oauthStatus={chatGptOAuthStatus}
                        onDecide={(candidate, boundary, decision) => {
                          void decideSceneExtractionBoundary(
                            candidate,
                            boundary,
                            decision,
                          );
                        }}
                        onDecideAnnotation={(candidate, scene, decision) => {
                          void decideSceneExtractionAnnotation(
                            candidate,
                            scene,
                            decision,
                          );
                        }}
                        onOpenSettings={() => onOpenSettings?.()}
                        onPreviewCandidate={(candidate) => {
                          void previewSceneExtractionCandidate(candidate);
                        }}
                        onRequestPermission={() => {
                          void grantSceneExtractionPermission();
                        }}
                        onRun={() => {
                          void performSceneExtraction();
                        }}
                        permissionRequired={sceneExtractionPermissionRequired}
                        projection={
                          sceneProjection?.workId === activeWorkId
                            ? sceneProjection
                            : null
                        }
                        selection={sceneExtractionSelection}
                      />
                      {sceneActionError !== null && (
                        <p className="event-action-error" role="alert">
                          {sceneActionError}
                        </p>
                      )}
                      {sceneMusicQueueError !== null && (
                        <p className="event-action-error" role="alert">
                          {sceneMusicQueueError}
                        </p>
                      )}
                      <SceneList
                        activeDocumentId={activeDocument?.documentId ?? null}
                        annotations={sceneAnnotations.filter(
                          (annotation) => annotation.workId === activeWorkId,
                        )}
                        busy={
                          sceneActionState !== "idle" ||
                          sceneExtractionActionState !== "idle"
                        }
                        musicConnected={youtubeMusicConnectionStatus?.apiKeyConfigured === true}
                        favoriteMusicVideos={
                          (workMusicSettings?.settings.favoriteTracks ?? [])
                            .filter(isYouTubeMusicTrack)
                        }
                        musicPlaybackAvailable={youtubeMusicProfile !== null}
                        musicQueueBusy={sceneMusicQueueActionState !== "idle"}
                        musicQueueCandidates={sceneMusicQueueCandidates}
                        onMergeWithPrevious={(scene, previousScene) => {
                          void mergeSceneWithPrevious(scene, previousScene);
                        }}
                        onOpenScene={focusScene}
                        onOpenMusicSettings={() => onOpenSettings?.()}
                        onPlaySceneMusicQueue={(candidate) => {
                          void playSelectedSceneMusicQueue(candidate);
                        }}
                        onPlayFavoriteMusicVideo={(video) => {
                          playMusicQueue([video]);
                        }}
                        onSearchSceneMusic={(annotation, query) => {
                          void searchSceneMusicQueues(annotation, query);
                        }}
                        onSelectSceneMusicQueue={(candidate, option) => {
                          void selectSceneMusicQueue(candidate, option);
                        }}
                        onToggleFavoriteMusicVideo={(video) => {
                          void toggleFavoriteMusicTrack(video);
                        }}
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
                  )}
                />
              )}
          </div>
          {runtime.status === "ready" &&
            activeDocument !== undefined &&
            workspaceSurface === "manuscript" &&
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
                    aria-selected={reviewInspectorTab === "current"}
                    id={reviewCurrentTabId}
                    onClick={() => setReviewInspectorTab("current")}
                    role="tab"
                    type="button"
                  >
                    현재
                  </button>
                  <button
                    aria-controls={reviewRailId}
                    aria-selected={reviewInspectorTab === "assistant"}
                    id={reviewAssistantTabId}
                    onClick={() => setReviewInspectorTab("assistant")}
                    role="tab"
                    type="button"
                  >
                    조수
                  </button>
                </div>
                <div
                  aria-labelledby={
                    reviewInspectorTab === "current"
                      ? reviewCurrentTabId
                      : reviewInspectorTab === "assistant"
                        ? reviewAssistantTabId
                      : reviewInspectorTab === "work"
                        ? reviewWorkTabId
                        : reviewVersionsTabId
                  }
                  className="review-inspector-panel"
                  role="tabpanel"
                >
                  <div
                    className="review-inspector-section-stack"
                    hidden={reviewInspectorTab !== "current"}
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
                    hidden={reviewInspectorTab !== "assistant"}
                  >
                    <section
                      aria-label="조수 실행"
                      className="character-manager-rail assistant-candidate-actions"
                    >
                      <header>
                        <h4>현재 선택으로 실행</h4>
                        <Bot aria-hidden="true" size={15} />
                      </header>
                      <div className="document-quick-actions">
                        <button
                          className="create-event-button"
                          onClick={() => {
                            void openAssistantContextDialog();
                          }}
                          type="button"
                        >
                          어휘·표기·설정 도구
                        </button>
                        <button
                          className="create-event-button"
                          onClick={openAssistantChatDialog}
                          type="button"
                        >
                          조수 대화 열기
                        </button>
                      </div>
                    </section>
                    <section
                      aria-label="인물 후보 만들기"
                      className="character-manager-rail assistant-candidate-actions"
                    >
                      <header>
                        <h4>원고에서 인물 후보</h4>
                        <span>
                          {characterExtractionCandidates.reduce(
                            (count, candidate) => count + candidate.items.filter(
                              (item) => item.status === "pending",
                            ).length,
                            0,
                          )}
                        </span>
                      </header>
                      <button
                        className="create-event-button"
                        disabled={
                          !hasManuscriptSelection ||
                          characterExtractionActionState !== "idle"
                        }
                        onClick={() => {
                          void captureCharacterWorkspaceSelection().then(
                            (selection) => {
                              if (selection !== null) {
                                void performCharacterExtraction(selection);
                              }
                            },
                          );
                        }}
                        type="button"
                      >
                        선택에서 인물 후보 추출
                      </button>
                      {characterWorkspaceSelection !== null && (
                        <p>
                          {characterWorkspaceSelection.documentTitle} ·{
                            " "
                          }{characterWorkspaceSelection.from.toLocaleString()}–
                          {characterWorkspaceSelection.to.toLocaleString()}
                        </p>
                      )}
                      {characterExtractionPermissionRequired && (
                        <button
                          className="create-event-button"
                          disabled={characterExtractionActionState !== "idle"}
                          onClick={() => {
                            void grantCharacterExtractionPermission();
                          }}
                          type="button"
                        >
                          이번 선택 전송 허용
                        </button>
                      )}
                    </section>
                    <section
                      aria-label="별빛 후보 만들기"
                      className="character-manager-rail lore-candidate-rail"
                    >
                      <header>
                        <h4>별빛 후보</h4>
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
                        현재 선택으로 후보 만들기
                      </button>
                      <p>
                        {hasManuscriptSelection
                          ? "선택 범위를 근거로 승인 전 후보를 만듭니다."
                          : "먼저 원고에서 근거 범위를 선택하세요."}
                      </p>
                    </section>
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
                    </section>
                    <button
                      className="create-event-button"
                      onClick={() => {
                        setReviewTab("candidates");
                        setWorkSection("review");
                        setFocusMode(false);
                      }}
                      type="button"
                    >
                      후보 검토함 열기
                    </button>
                    {(characterExtractionActionError ??
                      characterGenerationActionError) !== null && (
                      <p className="event-action-error" role="alert">
                        {characterExtractionActionError ??
                          characterGenerationActionError}
                      </p>
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
                    hidden={reviewInspectorTab !== "current"}
                  >
                    <div className="document-quick-actions">
                      <CreateEventBlockButton
                        busy={eventActionState !== "idle"}
                        onClick={openEventBlockDialog}
                        telemetryStore={telemetryStore}
                      />
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
                      <button
                        className="create-event-button scene-extraction-open-button"
                        disabled={
                          !hasManuscriptSelection ||
                          sceneExtractionActionState !== "idle"
                        }
                        onClick={() => {
                          void openPlotWorkspace("scenes").then((selection) => {
                            if (selection !== null) {
                              void performSceneExtraction(selection);
                            }
                          });
                        }}
                        type="button"
                      >
                        선택에서 장면 분석
                      </button>
                      <button
                        className="create-event-button"
                        disabled={
                          eventActionState !== "idle" || activeWork === undefined
                        }
                        onClick={openAnchorlessEventDialog}
                        type="button"
                      >
                        예정 사건 추가
                      </button>
                      <button
                        className="create-event-button create-scene-button"
                        disabled={sceneActionState !== "idle"}
                        onClick={() => {
                          void createSceneBoundary();
                        }}
                        type="button"
                      >
                        {sceneActionState === "creating"
                          ? "장면 저장 중"
                          : "장면 추가"}
                      </button>
                    </div>
                {eventActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {eventActionError}
                  </p>
                )}
                {sceneActionError !== null && (
                  <p className="event-action-error" role="alert">
                    {sceneActionError}
                  </p>
                )}
                {sceneMusicQueueError !== null && (
                  <p className="event-action-error" role="alert">
                    {sceneMusicQueueError}
                  </p>
                )}
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
            workspaceSurface === "manuscript" &&
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
        {runtime.status === "ready" &&
          activeWork !== undefined &&
          workspaceSurface === "manuscript" &&
          renderInHost(
            <BottomEventRail
              activeDocumentId={activeDocument?.documentId ?? null}
              cursorOffset={
                activeManuscriptPosition !== null &&
                activeManuscriptPosition.documentId === activeDocument?.documentId
                  ? activeManuscriptPosition.offset
                  : null
              }
              eventBusy={eventActionState !== "idle"}
              onMoveEvent={moveEventBlock}
              onOpenSource={(location) => {
                void openEventRailSource(location);
              }}
              projection={
                eventRail?.workId === activeWorkId ? eventRail : null
              }
            />,
            eventRailHost,
          )}
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
          {renderInHost(
            <MusicMiniPlayer
              connection={youtubeMusicConnectionStatus}
              focusText={musicFocusText}
              onOpenLibrary={() => {
                setMusicLibraryError(null);
                setMusicLibraryOpen(true);
              }}
              playRequest={musicPlaybackRequest}
              profile={youtubeMusicProfile}
            />,
            musicPlayerHost,
          )}
          {activeDocument !== undefined &&
            activeWork !== undefined &&
            workActivity !== null &&
            pomodoro !== null && (
              <SessionFeedbackWithTelemetry
                activity={workActivity}
                busy={activityActionState !== "idle"}
                documents={activeWork.documents.map((document) => ({
                  documentId: document.documentId,
                  title: document.title,
                }))}
                darkMode={darkMode}
                focusCycle={
                  activePomodoroPhase === null ? activeFocusCycle : undefined
                }
                focusMode={focusMode}
                focusModeAvailable={
                  workspaceSurface === "manuscript" &&
                  activeForwardWriting === null
                }
                forwardWritingActive={activeForwardWriting !== null}
                forwardWritingAvailable={
                  workspaceSurface === "manuscript" &&
                  runtime.status === "ready" &&
                  runtime.startupRecovery.status === "clean"
                }
                key={`${activeWork.workId}:${workActivity.activeSessionId ?? "no-session"}:${activePomodoroPhase?.focusCycleId ?? activeFocusCycle?.focusCycleId ?? "no-focus"}`}
                nowMs={activityClock}
                onConfigure={() => {
                  setActivityActionError(null);
                  setShowFocusDialog(true);
                }}
                onPause={() => {
                  void pausePomodoro();
                }}
                onResume={() => {
                  void resumePomodoro();
                }}
                onSaveNote={(note) => {
                  void savePomodoroNote(note);
                }}
                onStartWritingSession={() => {
                  void startWritingSession();
                }}
                onStopFocusCycle={() => {
                  void stopFocusCycle();
                }}
                onStopPomodoro={() => {
                  void stopPomodoro();
                }}
                onStopWritingSession={() => {
                  void stopWritingSession();
                }}
                onToggleDarkMode={() => {
                  onThemeChange?.(darkMode ? "light-mode" : "dark-mode");
                }}
                onToggleForwardWriting={() => {
                  if (activeForwardWriting !== null) {
                    stopForwardWriting();
                  } else {
                    setShowForwardWritingDialog(true);
                  }
                }}
                onToggleFocusMode={() => {
                  setFocusMode((current) => !current);
                }}
                pomodoro={pomodoro}
                telemetryStore={telemetryStore}
              />
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
        {showSchedule && activeWork !== undefined && (
          <div
            className="dialog-backdrop"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeSchedule();
            }}
            role="presentation"
          >
            <section
              aria-label="작업 일정"
              aria-modal="true"
              className="workspace-tool-dialog"
              role="dialog"
            >
              <button
                aria-label="작업 일정 닫기"
                className="dialog-close workspace-tool-dialog-close"
                onClick={closeSchedule}
                type="button"
              >
                <X aria-hidden="true" size={17} />
              </button>
              <WorkScheduleDashboard
                key={`${activeWork.workId}:${scheduleSettingsRevision}`}
                onOpenCompletedRevision={(documentId, revisionId) => {
                  void openCompletedRevisionFromSchedule(
                    documentId,
                    revisionId,
                  );
                }}
                onOpenDocument={openDocumentFromSchedule}
                settingsRevision={scheduleSettingsRevision}
                work={activeWork}
              />
            </section>
          </div>
        )}
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
        {documentRevisionPreview !== null && (
          <DocumentRevisionPreviewDialog
            documentTitle={documentRevisionPreview.documentTitle}
            onClose={() => setDocumentRevisionPreview(null)}
            projection={documentRevisionPreview.projection}
          />
        )}
        {showForwardWritingDialog && activeDocument !== undefined && (
          <ForwardWritingGoalDialog
            onCancel={() => {
              setShowForwardWritingDialog(false);
            }}
            onStart={startForwardWriting}
          />
        )}
        {manuscriptAnalysis !== null && (
          <ManuscriptAnalysisDialog
            documentTitle={manuscriptAnalysis.documentTitle}
            manuscript={manuscriptAnalysis.manuscript}
            onClose={() => setManuscriptAnalysis(null)}
          />
        )}
        {manuscriptTextImport !== null && (
          <ManuscriptTextImportDialog
            applying={manuscriptTextImportAction === "applying"}
            candidate={manuscriptTextImport.candidate}
            currentText={manuscriptTextImport.sourceText}
            error={manuscriptTextImportError}
            onApply={applyManuscriptTextImport}
            onClose={() => {
              if (manuscriptTextImportAction === "idle") {
                setManuscriptTextImport(null);
                setManuscriptTextImportError(null);
              }
            }}
            stale={
              activeDocument === undefined ||
              manuscriptTextImport.candidate.workId !== activeDocument.workId ||
              manuscriptTextImport.candidate.documentId !==
                activeDocument.documentId ||
              manuscriptTextImport.candidate.documentRevisionId !==
                activeDocument.documentRevisionId
            }
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
        {musicLibraryOpen && (
          renderInHost(
            <MusicLibraryDialog
              connected={youtubeMusicConnectionStatus?.apiKeyConfigured === true}
              error={musicLibraryError ?? sceneMusicQueueError}
              favorites={workMusicSettings?.settings.favoriteTracks ?? []}
              localMedia={workMusicSettings?.settings.localMedia ?? []}
              onAddToQueue={(track) => {
                if (!musicLibraryQueue.some(
                  (entry) =>
                    musicTrackIdentity(entry) === musicTrackIdentity(track),
                )) {
                  void saveMusicLibraryQueue(Object.freeze([
                    ...musicLibraryQueue,
                    track,
                  ]));
                }
              }}
              onClose={() => setMusicLibraryOpen(false)}
              onOpenConnectionSettings={() => {
                setMusicLibraryOpen(false);
                onOpenSettings?.();
              }}
              onPlayQueue={() => {
                playMusicQueue(musicLibraryQueue);
              }}
              onPlayTrack={(track) => {
                playMusicQueue([track]);
              }}
              onRegisterLocalMedia={(storageMode) => {
                void registerLocalMedia(storageMode);
              }}
              onRemoveFromQueue={(track) => {
                void saveMusicLibraryQueue(Object.freeze(
                  musicLibraryQueue.filter(
                    (entry) =>
                      musicTrackIdentity(entry) !== musicTrackIdentity(track),
                  ),
                ));
              }}
              onSearch={(query) => {
                void searchMusicLibrary(query);
              }}
              onToggleFavorite={(track) => {
                void toggleFavoriteMusicTrack(track);
              }}
              queue={musicLibraryQueue}
              queueSaving={musicLibraryActionState === "saving-playlist"}
              registeringMode={localMediaRegistrationMode}
              results={musicLibraryResults}
              searching={musicLibraryActionState === "searching"}
            />,
            musicPlayerHost?.closest<HTMLElement>(".studio-app-shell"),
          )
        )}
        {assistantChatDialogOpen && (
          <AssistantChatDialog
            actionState={assistantChatActionState}
            error={assistantChatError}
            messages={assistantChatMessages}
            oauthStatus={chatGptOAuthStatus}
            onClose={() => {
              if (assistantChatActionState === "idle") {
                setAssistantChatDialogOpen(false);
                setAssistantChatError(null);
              }
            }}
            onOpenSettings={() => {
              setAssistantChatDialogOpen(false);
              onOpenSettings?.();
            }}
            onOpenTools={() => {
              setAssistantChatDialogOpen(false);
              void openAssistantContextDialog();
            }}
            onSend={(message) => {
              void runAssistantChat(message);
            }}
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
              connections={assistantContextConnections}
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
              sceneDraft={sceneDraftPanel}
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
