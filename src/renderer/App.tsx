import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import {
  type ManuscriptDocumentSource,
} from "../application/editor/manuscript-document-profile";
import type {
  WritingSessionProjection,
} from "../application/activity/work-activity-contract";
import type {
  YouTubeMusicConnectionStatus,
} from "../application/music/youtube-music-connection";
import type { EntityId } from "../domain/writing";
import {
  type ManuscriptEditorHandle,
} from "./editor/ManuscriptEditor";
import { useWorkspaceStructureKernel } from "./features/structure/useWorkspaceStructureKernel";
import { useManuscriptFocusController } from "./features/activity/useManuscriptFocusController";
import { useResumeCheckpointController } from "./workspace/session/useResumeCheckpointController";
import { useStartupRecoveryController } from "./workspace/session/useStartupRecoveryController";
import { useWorkspaceCloseController } from "./workspace/session/useWorkspaceCloseController";
import { useWorkspaceDocumentController } from "./workspace/lifecycle/useWorkspaceDocumentController";
import {
  useWorkspaceNavigationState,
} from "./workspace/navigation/useWorkspaceNavigationController";
import { useWorkspaceLayoutController } from "./workspace/layout/useWorkspaceLayoutController";
import {
  type StarlightThemeKey,
} from "./theme/starlight-theme";
import type { ManuscriptFocusPreferences } from "../application/settings/ui-preferences";
import { ManuscriptTelemetryStore } from "./editor/manuscript-telemetry-store";
import {
  RuntimeBootstrapController,
} from "./workspace/session/RuntimeBootstrapController";
import {
  persistDocumentRegularly,
} from "./workspace/session/PersistenceCoordinator";
import {
  createDocumentNavigationWorkspaceSnapshot,
  selectWorkspaceSessionSelection,
  type DocumentNavigationWorkspaceSnapshot,
} from "./workspace/session/WorkspaceSessionStore";
import { useWorkspaceSession } from "./workspace/session/useWorkspaceSession";
import { usePersistenceCoordinator } from "./workspace/session/usePersistenceCoordinator";
import { useWorkspaceRuntimeProjectionController } from "./workspace/session/useWorkspaceRuntimeProjectionController";
import type { WorkspaceController } from "./workspace/lifecycle/WorkspaceController";
import { useWorkspaceLifecycle } from "./workspace/lifecycle/useWorkspaceLifecycle";
import { DocumentNavigator } from "./workspace/navigation/DocumentNavigator";
import type {
  DocumentNavigationDocument,
} from "./workspace/navigation/document-target";
import {
  useWorkspaceFeatureNavigationController,
} from "./workspace/navigation/useWorkspaceFeatureNavigationController";
import {
  useWorkspaceDocumentNavigatorController,
  type DocumentNavigationSurfaceWaiter,
} from "./workspace/navigation/useWorkspaceDocumentNavigatorController";
import { WorkspaceView } from "./workspace/WorkspaceView";
import {
  useWorkspaceCoreFeatureKernel,
  type ManuscriptResumePreview,
} from "./workspace/useWorkspaceCoreFeatureKernel";
export type { ManuscriptResumePreview } from "./workspace/useWorkspaceCoreFeatureKernel";
import { useWorkspaceStoryFeatureKernel } from "./workspace/useWorkspaceStoryFeatureKernel";
import {
  type WorkOperationsSection,
} from "./workspace/WorkOperationsWorkspace";

type AppProps = {
  readonly controller: WorkspaceController;
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
  readonly manuscriptFocusPreferences?: ManuscriptFocusPreferences;
  readonly onManuscriptFocusPreferencesChange?: (
    preferences: ManuscriptFocusPreferences,
  ) => void;
  readonly onOpenSettings?: () => void;
  readonly onOpenPublishing?: (
    section: WorkOperationsSection,
    workId: EntityId<"Work">,
  ) => void;
  readonly onReturnToWorks?: () => void;
  readonly onScheduleChange?: () => void;
  readonly scheduleSettingsRevision?: number;
  readonly sceneAnalysisSettingsRevision?: number;
  readonly sceneAnalysisEnabled?: boolean | null;
  readonly onThemeChange?: (theme: StarlightThemeKey) => void;
  readonly theme?: StarlightThemeKey;
  readonly youtubeMusicConnectionStatus?: YouTubeMusicConnectionStatus | null;
};

export function WorkspaceRoot({
    controller,
    documentRailHost,
    embedded = false,
    eventRailHost,
    manuscriptFocusPreferences,
    musicSettingsRevision = 0,
    musicPlayerHost,
    onCatalogChange,
    onManuscriptFocusPreferencesChange,
    onOpenPublishing,
    onOpenSettings,
    onReturnToWorks,
    onResumePreviewChange,
    onScheduleChange,
    onThemeChange,
    scheduleSettingsRevision = 0,
    sceneAnalysisSettingsRevision = 0,
    sceneAnalysisEnabled = null,
    theme = "light-mode",
    youtubeMusicConnectionStatus = null,
  }: AppProps) {
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
  const {
    durableSaveQueueRef,
    saveStateStore,
    installDurableSaveQueue,
    registerCreatedDocumentPersistence,
    continuousReadingProgressRef,
    continuousReadingLocationRef,
    continuousReadingPersistenceLane,
    workManuscriptLayoutByWorkRef,
    workManuscriptLayoutPersistenceLane,
    workManuscriptLayoutLoadSequenceRef,
    workManuscriptLayoutChangeSequenceRef,
  } = usePersistenceCoordinator();
  const activeWritingSessionRef =
    useRef<WritingSessionProjection | undefined>(undefined);
  const manuscriptFocusOwnedWritingSessionIdRef =
    useRef<EntityId<"WritingSession"> | null>(null);
  const manuscriptFocusSessionPendingRef = useRef<Promise<void>>(Promise.resolve());
  const [documentNavigator] = useState(() => new DocumentNavigator());
  const documentNavigationWorkspaceRef =
    useRef<DocumentNavigationWorkspaceSnapshot>(
      createDocumentNavigationWorkspaceSnapshot({
        source: null,
        activeDocument: undefined,
      }),
    );
  const installedEditorDocumentRef =
    useRef<DocumentNavigationDocument | null>(null);
  const documentNavigationSurfaceWaitersRef =
    useRef<DocumentNavigationSurfaceWaiter[]>([]);
  const documentNavigationSelectionResumeSuppressionRef =
    useRef<DocumentNavigationDocument | null>(null);
  const [telemetryStore] = useState(
    () => new ManuscriptTelemetryStore(),
  );
  const hasManuscriptSelection = useSyncExternalStore(
    telemetryStore.subscribeSelection,
    telemetryStore.getSelectionSnapshot,
  );
  const [runtimeBootstrapController] = useState(() =>
    new RuntimeBootstrapController(window.eumStudio)
  );
  const workspaceSession = useWorkspaceSession();
  const {
    runtime,
    setRuntime,
    recoveryApplyState,
    setRecoveryApplyState,
    setDocumentTabSession,
  } = workspaceSession;
  const workspaceLayoutController = useWorkspaceLayoutController();
  const workspaceLifecycle = useWorkspaceLifecycle();
  const {
    toggleRail: toggleWorkspaceLayoutRail,
    changeRailLayout,
    installActiveManuscriptPosition,
  } = workspaceLayoutController;
  const workspaceNavigationState = useWorkspaceNavigationState();
  const {
    workspaceSurface,
  } = workspaceNavigationState;
  const manuscriptFocusStorage = useMemo(() => Object.freeze({
    getItem: (key: string) => window.localStorage.getItem(key),
    removeItem: (key: string) => {
      window.localStorage.removeItem(key);
    },
    setItem: (key: string, value: string) => {
      window.localStorage.setItem(key, value);
    },
  }), []);
  const manuscriptFocusControllerInput = useMemo(() => Object.freeze({
    ...(manuscriptFocusPreferences === undefined
      ? {}
      : { initialPreferences: manuscriptFocusPreferences }),
    ...(onManuscriptFocusPreferencesChange === undefined
      ? {}
      : { onPreferencesChange: onManuscriptFocusPreferencesChange }),
    storage: manuscriptFocusStorage,
  }), [
    manuscriptFocusPreferences,
    manuscriptFocusStorage,
    onManuscriptFocusPreferencesChange,
  ]);
  const manuscriptFocusController = useManuscriptFocusController(
    manuscriptFocusControllerInput,
  );
  const {
    manuscriptFocusActive,
    toggleManuscriptFocus,
    exitManuscriptFocus,
  } = manuscriptFocusController;

  const structureKernel = useWorkspaceStructureKernel({
    client: {
      loreForeshadowLinks: window.eumStudio.loreForeshadowLinks,
      musicPlayback: window.eumStudio.musicPlayback,
      plots: window.eumStudio.plots,
      settings: window.eumStudio.settings,
      structure: window.eumStudio.structure,
    },
    musicSettingsRevision,
    runtime,
  });
  const {
    eventWorkspaceState,
    plotWorkspaceState,
    sceneWorkspaceState,
    resetLoreCue,
    workStructureState,
    structureController,
  } = structureKernel;
  const readDocumentStateForResume = useCallback((
    document: ManuscriptDocumentSource,
  ) => manuscriptEditorRef.current?.readDocumentState(document), []);
  const getCurrentRevisionIdForResume = useCallback(
    (documentId: EntityId<"Document">) =>
      durableSaveQueueRef.current?.getCurrentRevisionId(documentId) ?? null,
    [durableSaveQueueRef],
  );
  const resumeCheckpointControllerInput = useMemo(() => ({
    client: window.eumStudio.workspace,
    getCurrentRevisionId: getCurrentRevisionIdForResume,
    readDocumentState: readDocumentStateForResume,
    resumeCheckpoint: runtime.status === "ready"
      ? runtime.resumeCheckpoint
      : null,
  }), [getCurrentRevisionIdForResume, readDocumentStateForResume, runtime]);
  const {
    captureResume: captureResumeForDocument,
    captureResumeAndLoadCatalog,
  } = useResumeCheckpointController(resumeCheckpointControllerInput);

  const persistDocument = useCallback(
    (document: ManuscriptDocumentSource): Promise<void> =>
      persistDocumentRegularly({
        queue: durableSaveQueueRef.current,
        document,
        waitForCompositionEnd: (currentDocument) =>
          manuscriptEditorRef.current?.waitForDocumentCompositionEnd(
            currentDocument,
          ) ?? Promise.reject(new Error(
            `The active editor state is unavailable for ${currentDocument.documentId}`,
          )),
        captureResume: captureResumeForDocument,
      }),
    [captureResumeForDocument, durableSaveQueueRef],
  );

  const runtimeProjectionController =
    useWorkspaceRuntimeProjectionController({
    captureResumeAndLoadCatalog,
    client: window.eumStudio,
    documentNavigationSelectionResumeSuppressionRef,
    documentNavigator,
    installedEditorDocumentRef,
    layout: {
      installActiveManuscriptPosition,
    },
    loreCueState: {
      resetLoreCue,
    },
    onCatalogChange,
    persistence: {
      durableSaveQueueRef,
      installDurableSaveQueue,
    },
    runtimeBootstrapController,
    session: {
      setRuntime,
    },
    telemetryStore,
  });
  const {
    installRuntimeProjection,
  } = runtimeProjectionController;
  const loadRuntimeProjection = useCallback(
    () => runtimeBootstrapController.load(),
    [runtimeBootstrapController],
  );
  const reloadRuntimeAfterEpisodeMove = useCallback(async (
    preferredDocumentId: EntityId<"Document">,
  ): Promise<void> => {
    const projection = await loadRuntimeProjection();
    installRuntimeProjection(projection, preferredDocumentId);
    onCatalogChange?.(projection.catalog);
  }, [installRuntimeProjection, loadRuntimeProjection, onCatalogChange]);
  const getCloseQueue = useCallback(
    () => durableSaveQueueRef.current,
    [durableSaveQueueRef],
  );
  const waitForCloseContinuousReading = useCallback(
    () => continuousReadingPersistenceLane.waitForPending(),
    [continuousReadingPersistenceLane],
  );
  const waitForCloseWorkLayout = useCallback(
    () => workManuscriptLayoutPersistenceLane.waitForPending(),
    [workManuscriptLayoutPersistenceLane],
  );
  const workspaceCloseControllerInput = useMemo(() => ({
    activityClient: window.eumStudio.activity,
    activeWritingSessionRef,
    captureResume: captureResumeForDocument,
    editorClient: window.eumStudio.editor,
    manuscriptFocusOwnedWritingSessionIdRef,
    manuscriptFocusSessionPendingRef,
    getQueue: getCloseQueue,
    runtime: runtime.status === "ready"
      ? Object.freeze({
          activeDocumentId: runtime.activeDocumentId,
          documents: runtime.documentProfile.documents,
        })
      : null,
    waitForContinuousReading: waitForCloseContinuousReading,
    waitForWorkLayout: waitForCloseWorkLayout,
  }), [
    captureResumeForDocument,
    getCloseQueue,
    runtime,
    waitForCloseContinuousReading,
    waitForCloseWorkLayout,
  ]);
  useWorkspaceCloseController(workspaceCloseControllerInput);

  const {
    activeWork,
    activeDocument,
    activeWorkId,
  } = useMemo(
    () => selectWorkspaceSessionSelection(
      runtime.status === "ready"
        ? {
            catalog: runtime.catalog,
            documentProfile: runtime.documentProfile,
            activeDocumentId: runtime.activeDocumentId,
          }
        : null,
    ),
    [runtime],
  );
  const coreFeatureKernel = useWorkspaceCoreFeatureKernel({
    activeDocument,
    activeWork,
    activeWorkId,
    activityRefs: {
      activeWritingSessionRef,
      manuscriptFocusOwnedWritingSessionIdRef,
      manuscriptFocusSessionPendingRef,
    },
    captureResumeForDocument,
    client: window.eumStudio,
    controllers: {
      manuscriptFocus: manuscriptFocusController,
      layout: workspaceLayoutController,
      lifecycle: workspaceLifecycle,
      navigation: workspaceNavigationState,
    },
    documentNavigationSurfaceWaitersRef,
    documentNavigationWorkspaceRef,
    documentRailHost,
    installRuntimeProjection,
    manuscriptEditorRef,
    onCatalogChange,
    onResumePreviewChange,
    onScheduleChange,
    persistence: {
      continuousReadingLocationRef,
      continuousReadingPersistenceLane,
      continuousReadingProgressRef,
      durableSaveQueueRef,
      saveStateStore,
      workManuscriptLayoutByWorkRef,
      workManuscriptLayoutChangeSequenceRef,
      workManuscriptLayoutLoadSequenceRef,
      workManuscriptLayoutPersistenceLane,
    },
    persistDocument,
    runtimeBootstrapController,
    scheduleSettingsRevision,
    session: workspaceSession,
    structureKernel,
  });
  const {
    manuscriptSearchController,
    assistantController,
    versionController,
    scheduleController,
    activeForwardWriting,
    activeWorkDocuments,
    publishResumePreview,
    activeWorkDocumentIds,
    charactersController,
    canonReviewController,
    continuityController,
    characterKnowledgeController,
    loreController,
  } = coreFeatureKernel;
  const storyFeatureKernel = useWorkspaceStoryFeatureKernel({
    activeDocument,
    activeWork,
    activeWorkId,
    client: window.eumStudio,
    coreKernel: coreFeatureKernel,
    layout: workspaceLayoutController,
    manuscriptEditorRef,
    navigation: workspaceNavigationState,
    persistence: {
      durableSaveQueueRef,
    },
    persistDocument,
    reloadRuntimeAfterEpisodeMove,
    sceneAnalysisEnabled,
    sceneAnalysisSettingsRevision,
    structureKernel,
    telemetryStore,
  });
  const {
    activeWorkCharacters,
    activeWorkPlots,
    sceneWorkspaceController,
    activeWorkPlotSources,
    foreshadowController,
    foreshadowLines,
    fragmentsController,
    captureCharacterWorkspaceSelection,
  } = storyFeatureKernel;
  useEffect(() => {
    if (workspaceSurface !== "manuscript" || activeForwardWriting !== null) return;
    const handleManuscriptFocusShortcut = (event: KeyboardEvent) => {
      const toggleShortcut =
        event.key === "Enter" &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey;
      const exitShortcut = event.key === "Escape" && manuscriptFocusActive;
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
        exitManuscriptFocus();
      } else {
        toggleManuscriptFocus();
      }
    };
    window.addEventListener("keydown", handleManuscriptFocusShortcut);
    return () => {
      window.removeEventListener("keydown", handleManuscriptFocusShortcut);
    };
  }, [
    activeForwardWriting,
    exitManuscriptFocus,
    manuscriptFocusActive,
    toggleManuscriptFocus,
    workspaceSurface,
  ]);

  const startupRecoveryControllerInput = useMemo(() => Object.freeze({
    applyClient: window.eumStudio.editor,
    applyState: recoveryApplyState,
    installRuntime: installRuntimeProjection,
    loadRuntime: loadRuntimeProjection,
    runtime: runtime.status === "ready"
      ? Object.freeze({
          activeDocumentId: runtime.activeDocumentId,
          startupRecovery: runtime.startupRecovery,
        })
      : null,
    setApplyState: setRecoveryApplyState,
  }), [
    installRuntimeProjection,
    loadRuntimeProjection,
    recoveryApplyState,
    runtime,
    setRecoveryApplyState,
  ]);
  const handleApplyStartupRecovery = useStartupRecoveryController(
    startupRecoveryControllerInput,
  );
  const toggleRail = useCallback(
    (rail: "left" | "right") => {
      toggleWorkspaceLayoutRail(activeDocument?.workId ?? null, rail);
    },
    [activeDocument?.workId, toggleWorkspaceLayoutRail],
  );
  const {
    activateWorkspaceLocation,
    createDocumentNavigationPorts,
  } = useWorkspaceDocumentNavigatorController({
    activeDocument,
    activeWorkId,
    client: window.eumStudio,
    controllers: {
      lifecycle: workspaceLifecycle,
      navigation: workspaceNavigationState,
      search: manuscriptSearchController,
    },
    documentNavigationSurfaceWaitersRef,
    documentNavigationWorkspaceRef,
    installedEditorDocumentRef,
    manuscriptEditorRef,
    onCatalogChange,
    persistence: {
      durableSaveQueueRef,
    },
    persistDocument,
    session: workspaceSession,
  });
  const workspaceDocumentController = useWorkspaceDocumentController({
    activateWorkspaceLocation,
    activeDocument,
    activeWork,
    activeWorkDocumentIds,
    activeWorkDocuments,
    activeWorkId,
    client: window.eumStudio,
    controllers: {
      schedule: scheduleController,
      structure: structureController,
      version: versionController,
      workspaceLifecycle,
      workspaceNavigation: workspaceNavigationState,
    },
    installRuntimeProjection,
    onCatalogChange,
    persistence: {
      registerCreatedDocumentPersistence,
    },
    persistDocument,
    publishResumePreview,
    runtimeBootstrapController,
    search: manuscriptSearchController,
    session: workspaceSession,
    workspaceController: controller,
  });
  const featureNavigationController =
    useWorkspaceFeatureNavigationController({
    activeDocument,
    activeWork,
    activeWorkCharacters,
    activeWorkDocumentIds,
    activeWorkDocuments,
    activeWorkId,
    activeWorkPlotSources,
    activeWorkPlots,
    captureCharacterWorkspaceSelection,
    captureResumeForDocument,
    controllers: {
      assistant: assistantController,
      canon: canonReviewController,
      continuity: continuityController,
      characterKnowledge: characterKnowledgeController,
      characters: charactersController,
      eventState: eventWorkspaceState,
      foreshadow: foreshadowController,
      manuscriptFocus: manuscriptFocusController,
      fragments: fragmentsController,
      lore: loreController,
      plotState: plotWorkspaceState,
      scene: sceneWorkspaceController,
      sceneState: sceneWorkspaceState,
      structure: structureController,
      workStructure: workStructureState,
      workspaceNavigation: workspaceNavigationState,
    },
    createDocumentNavigationPorts,
    documentNavigationSelectionResumeSuppressionRef,
    documentNavigator,
    foreshadowLines,
    manuscriptEditorRef,
    persistDocument,
    runtime,
    session: {
      setDocumentTabSession,
    },
  });
  useEffect(() => {
    const workspaceBody = workspaceBodyRef.current;
    if (workspaceBody === null) {
      return;
    }
    const synchronizeLayout = () => {
      const configuredLayout = getComputedStyle(workspaceBody)
        .getPropertyValue("--workspace-layout-mode")
        .trim();
      const layout = configuredLayout === "narrow" ? "narrow" : "wide";
      changeRailLayout(layout);
    };
    const observer = new ResizeObserver(synchronizeLayout);
    observer.observe(workspaceBody);
    synchronizeLayout();
    return () => {
      observer.disconnect();
    };
  }, [changeRailLayout]);

  return (
    <WorkspaceView
      activeDocument={activeDocument}
      activeWork={activeWork}
      activeWorkId={activeWorkId}
      controllers={{
        manuscriptFocus: manuscriptFocusController,
        layout: workspaceLayoutController,
        lifecycle: workspaceLifecycle,
        navigationState: workspaceNavigationState,
      }}
      coreKernel={coreFeatureKernel}
      documentController={workspaceDocumentController}
      documentRailHost={documentRailHost}
      documentRailId={documentRailId}
      embedded={embedded}
      eventRailHost={eventRailHost}
      featureNavigation={featureNavigationController}
      handleApplyStartupRecovery={handleApplyStartupRecovery}
      hasManuscriptSelection={hasManuscriptSelection}
      manuscriptEditorRef={manuscriptEditorRef}
      musicPlayerHost={musicPlayerHost}
      onOpenPublishing={onOpenPublishing}
      onOpenSettings={onOpenSettings}
      onReturnToWorks={onReturnToWorks}
      onThemeChange={onThemeChange}
      recoveryHeadingId={recoveryHeadingId}
      reviewIds={{
        assistant: reviewAssistantTabId,
        current: reviewCurrentTabId,
        rail: reviewRailId,
        versions: reviewVersionsTabId,
        work: reviewWorkTabId,
      }}
      runtimeProjection={runtimeProjectionController}
      scheduleClient={window.eumStudio.schedule}
      scheduleSettingsRevision={scheduleSettingsRevision}
      session={workspaceSession}
      storyKernel={storyFeatureKernel}
      structureKernel={structureKernel}
      telemetryStore={telemetryStore}
      theme={theme}
      toggleRail={toggleRail}
      workspaceBodyRef={workspaceBodyRef}
      youtubeMusicConnectionStatus={youtubeMusicConnectionStatus}
    />
  );
}

export const App = WorkspaceRoot;
