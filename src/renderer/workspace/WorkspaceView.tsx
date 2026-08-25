import {
  useCallback,
  useMemo,
  type ComponentProps,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { YouTubeMusicConnectionStatus } from "../../application/music/youtube-music-connection";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { ManuscriptEditorHandle } from "../editor/ManuscriptEditor";
import { LoreCueTooltip } from "../editor/LoreCueDisclosure";
import { ManuscriptTelemetryStore } from "../editor/manuscript-telemetry-store";
import { SceneDraftPanel } from "../editor/SceneDraftPanel";
import { AssistantDialogHost } from "../features/assistant/AssistantDialogHost";
import type { useFocusModeController } from "../features/activity/useFocusModeController";
import {
  SceneStructureContent,
  StructureWorkspaceHost,
} from "../features/structure/StructureWorkspaceHost";
import type { useWorkspaceStructureKernel } from "../features/structure/useWorkspaceStructureKernel";
import { deriveWorkScheduleSummary } from "../schedule/work-schedule-summary";
import {
  isDarkStarlightTheme,
  type StarlightThemeKey,
} from "../theme/starlight-theme";
import { DocumentRailHost } from "./documents/DocumentRailHost";
import { WorkspaceFeatureDialogHost } from "./dialogs/WorkspaceFeatureDialogHost";
import { ManuscriptWorkspaceSurface } from "./editor/ManuscriptWorkspaceSurface";
import { WorkspaceHeaderRecoveryHost } from "./header/WorkspaceHeaderRecoveryHost";
import type { useWorkspaceDocumentController } from "./lifecycle/useWorkspaceDocumentController";
import type { useWorkspaceLifecycle } from "./lifecycle/useWorkspaceLifecycle";
import type { useWorkspaceLayoutController } from "./layout/useWorkspaceLayoutController";
import type { useWorkspaceFeatureNavigationController } from "./navigation/useWorkspaceFeatureNavigationController";
import {
  useWorkspaceNavigationController,
  type useWorkspaceNavigationState,
} from "./navigation/useWorkspaceNavigationController";
import { ReviewInspectorRail } from "./review/ReviewInspectorRail";
import { ReviewWorkspaceHost } from "./review/ReviewWorkspaceHost";
import type { useWorkspaceRuntimeProjectionController } from "./session/useWorkspaceRuntimeProjectionController";
import type { useWorkspaceSession } from "./session/useWorkspaceSession";
import type { useWorkspaceCoreFeatureKernel } from "./useWorkspaceCoreFeatureKernel";
import type { useWorkspaceStoryFeatureKernel } from "./useWorkspaceStoryFeatureKernel";
import { WorkOperationsWorkspace, type WorkOperationsSection } from "./WorkOperationsWorkspace";
import { WorkspaceFeatureSurfaceHost } from "./WorkspaceFeatureSurfaceHost";
import {
  SAVE_STATE_LABELS,
  WorkspaceStatusToolsHost,
} from "./WorkspaceStatusToolsHost";

function formatTimerDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function remainingTimerMs(deadlineAt: string | null, now: number): number {
  if (deadlineAt === null) return 0;
  const deadlineAtMs = Date.parse(deadlineAt);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - now) : 0;
}

export function WorkspaceView(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWork: WorkspaceWorkSummary | undefined;
  activeWorkId: EntityId<"Work"> | null;
  controllers: Readonly<{
    focus: ReturnType<typeof useFocusModeController>;
    layout: ReturnType<typeof useWorkspaceLayoutController>;
    lifecycle: ReturnType<typeof useWorkspaceLifecycle>;
    navigationState: ReturnType<typeof useWorkspaceNavigationState>;
  }>;
  coreKernel: ReturnType<typeof useWorkspaceCoreFeatureKernel>;
  documentController: ReturnType<typeof useWorkspaceDocumentController>;
  documentRailHost: HTMLElement | null | undefined;
  documentRailId: string;
  embedded: boolean;
  eventRailHost: HTMLElement | null | undefined;
  featureNavigation: ReturnType<typeof useWorkspaceFeatureNavigationController>;
  handleApplyStartupRecovery: () => unknown;
  hasManuscriptSelection: boolean;
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  musicPlayerHost: HTMLElement | null | undefined;
  onOpenPublishing:
    | ((section: WorkOperationsSection, workId: EntityId<"Work">) => void)
    | undefined;
  onOpenSettings: (() => void) | undefined;
  onReturnToWorks: (() => void) | undefined;
  onThemeChange: ((theme: StarlightThemeKey) => void) | undefined;
  recoveryHeadingId: string;
  reviewIds: Readonly<{
    assistant: string;
    current: string;
    rail: string;
    versions: string;
    work: string;
  }>;
  runtimeProjection: ReturnType<typeof useWorkspaceRuntimeProjectionController>;
  scheduleClient: ComponentProps<
    typeof WorkspaceStatusToolsHost
  >["scheduleClient"];
  scheduleSettingsRevision: number;
  session: ReturnType<typeof useWorkspaceSession>;
  storyKernel: ReturnType<typeof useWorkspaceStoryFeatureKernel>;
  structureKernel: ReturnType<typeof useWorkspaceStructureKernel>;
  telemetryStore: ManuscriptTelemetryStore;
  theme: StarlightThemeKey;
  toggleRail: (rail: "left" | "right") => void;
  workspaceBodyRef: RefObject<HTMLDivElement | null>;
  youtubeMusicConnectionStatus: YouTubeMusicConnectionStatus | null;
}>) {
  const {
    activeDocument,
    activeWork,
    activeWorkId,
    documentRailHost,
    documentRailId,
    embedded,
    eventRailHost,
    handleApplyStartupRecovery,
    hasManuscriptSelection,
    manuscriptEditorRef,
    musicPlayerHost,
    onOpenPublishing,
    onOpenSettings,
    onReturnToWorks,
    onThemeChange,
    recoveryHeadingId,
    reviewIds,
    scheduleClient,
    scheduleSettingsRevision,
    telemetryStore,
    theme,
    toggleRail,
    workspaceBodyRef,
    youtubeMusicConnectionStatus,
  } = input;
  const darkMode = isDarkStarlightTheme(theme);
  const reviewAssistantTabId = reviewIds.assistant;
  const reviewCurrentTabId = reviewIds.current;
  const reviewRailId = reviewIds.rail;
  const reviewVersionsTabId = reviewIds.versions;
  const reviewWorkTabId = reviewIds.work;
  const focusModeController = input.controllers.focus;
  const {
    exitFocusMode,
    focusMode,
  } = focusModeController;
  const workspaceLayoutController = input.controllers.layout;
  const {
    activeManuscriptPosition,
    changeEventRailMode,
    eventRailMode,
  } = workspaceLayoutController;
  const {
    setWorkspaceActionError,
    workspaceActionError,
    workspaceActionState,
  } = input.controllers.lifecycle;
  const workspaceNavigationState = input.controllers.navigationState;
  const {
    openRecordsDocument,
    recordsNowMs,
    returnToPreviousWorkLocation,
    reviewTab,
    selectReviewTab,
    showWorkSection,
    structureTab,
    workReturnLocation,
    workSection,
    workspaceSurface,
  } = workspaceNavigationState;
  const {
    eventWorkspaceController,
    loreCueController,
    manuscriptSearchController,
    assistantController,
    chatGptOAuthStatus,
    versionController,
    versionActionState,
    inspirationController,
    scheduleController,
    workSchedule,
    editorToolsController,
    activeForwardWriting,
    activeWorkDocuments,
    readingLayoutController,
    sharesDocumentRailWithSidebar,
    activeDocumentSummary,
    documentCompletionController,
    activeWorkDocumentLabels,
    openDocuments,
    activeWorkEventBlocks,
    railProjection,
    activeSaveState,
    activityController,
    pomodoro,
    activityClock,
    activeFocusCycle,
    activePomodoroPhase,
    charactersController,
    loreController,
    refreshLoreCandidates,
  } = input.coreKernel;
  const {
    activateDocumentById,
    cancelWorkTitleEdit,
    changeTitleEditValue,
    closeDocumentTabById,
    createDocument,
    createDocumentFolder,
    moveDocument,
    openCompletedRevisionFromSchedule,
    openDocumentFromSchedule,
    placeDocumentInFolder,
    renameActiveWork,
    renameDocument,
    renameDocumentFolder,
    retireDocument,
    retireAllDocuments,
    retireDocumentFolder,
    retireWork,
    startWorkTitleEdit,
    titleEditTarget,
    titleEditValue,
  } = input.documentController;
  const {
    openAssistantSettingReference,
    focusScene,
    openAssistantVocabularyOccurrence,
    prepareCharacterWorkspace,
    openCharacterEvidence,
    preparePlotWorkspace,
    previewSceneExtractionCandidate,
    compareSceneDraftCandidate,
    openLoreEntryEvidence,
    openLoreCandidateEvidence,
    openPlotThreadSource,
    openWorkStructureDocument,
    openEventRailSource,
    openWorkStructureCharacter,
    openWorkStructureLore,
    openWorkStructurePlot,
    openWorkStructurePlotSource,
    openWorkStructureEvent,
    openWorkStructureScene,
    captureForeshadowPoint,
    openForeshadowPointSource,
    openFragmentSource,
  } = input.featureNavigation;
  const {
    handleFormattingChange,
    handleCompositionEnd,
    handleDocumentActivated,
  } = input.runtimeProjection;
  const {
    activeWorkCharacters,
    activeWorkCharacterRelations,
    activeSelectedCharacterId,
    activeWorkPlots,
    plotWorkspaceController,
    activeSelectedPlotThreadId,
    activeSelectedPlot,
    sceneWorkspaceController,
    activeWorkPlotSources,
    activeWorkPlotEventLinks,
    activeWorkLoreEntries,
    activeWorkLoreCandidates,
    workStructureOverview,
    activeSelectedLoreEntryId,
    foreshadowController,
    foreshadowLines,
    loreForeshadowLinkController,
    activeWorkLoreForeshadowLinks,
    linkLoreForeshadow,
    unlinkLoreForeshadow,
    fragmentsController,
    captureCharacterWorkspaceSelection,
    createLoreEntry,
    addLoreEntryEvidence,
    createLoreCandidate,
    captureFragment,
    moveSelectionToFragment,
    insertFragmentAtCursor,
    handleManuscriptTransaction,
    moveRangeToEpisodeController,
    performSceneDraft,
    updateSceneDraftCandidate,
    applySceneDraftCandidate,
    regenerateSceneDraftCandidate,
  } = input.storyKernel;
  const {
    eventRail,
    eventWorkspaceState,
    hoveredLoreCue,
    loreCueState,
    musicController,
    plotBoard,
    plotWorkspaceState,
    sceneDraftActionError,
    sceneDraftActionState,
    sceneDraftCandidates,
    sceneWorkspaceState,
    selectSceneExtraction,
    structureController,
    workStructureState,
  } = input.structureKernel;
  const {
    recoveryApplyState,
    runtime,
  } = input.session;

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
    const refreshCandidatesForNavigation = useCallback(() => {
      void refreshLoreCandidates();
    }, [refreshLoreCandidates]);
    const workspaceNavigationControllerInput = useMemo(() => Object.freeze({
      captureCandidateSelection: captureCharacterWorkspaceSelection,
      exitFocusMode,
      navigation: workspaceNavigationState,
      openCharacterWorkspace: prepareCharacterWorkspace,
      openPlotWorkspace: preparePlotWorkspace,
      refreshCandidates: refreshCandidatesForNavigation,
      selectCandidateSceneExtraction: selectSceneExtraction,
      versionActionState,
    }), [
      captureCharacterWorkspaceSelection,
      exitFocusMode,
      prepareCharacterWorkspace,
      preparePlotWorkspace,
      refreshCandidatesForNavigation,
      selectSceneExtraction,
      versionActionState,
      workspaceNavigationState,
    ]);
    const {
      changeWorkSection,
      changeStructureTab,
      changeReviewTab,
      openPlotWorkspace,
    } = useWorkspaceNavigationController(workspaceNavigationControllerInput);
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
    const sceneStructureContent = (
      <SceneStructureContent
        activeDocument={activeDocument ?? null}
        activeWork={activeWork ?? null}
        controllers={{
          music: musicController,
          scene: sceneWorkspaceController,
          sceneState: sceneWorkspaceState,
          structure: structureController,
        }}
        musicConnected={youtubeMusicConnectionStatus?.apiKeyConfigured === true}
        navigation={{
          focusScene,
          previewSceneExtractionCandidate,
        }}
        oauthStatus={chatGptOAuthStatus}
        onOpenSettings={onOpenSettings}
        projections={{
          activeCharacters: activeWorkCharacters,
        }}
      />
    );
    const structureWorkspaceContent = (
      <StructureWorkspaceHost
        activeDocument={activeDocument ?? null}
        activeTab={structureTab}
        activeWork={activeWork ?? null}
        commands={{
          addLoreEntryEvidence,
          captureForeshadowPoint,
          createLoreEntry,
        }}
        controllers={{
          characters: charactersController,
          event: eventWorkspaceController,
          eventState: eventWorkspaceState,
          foreshadow: foreshadowController,
          inspiration: inspirationController,
          lore: loreController,
          loreForeshadowLinks: loreForeshadowLinkController,
          plot: plotWorkspaceController,
          plotState: plotWorkspaceState,
          structure: structureController,
          workStructure: workStructureState,
        }}
        documentLabels={activeWorkDocumentLabels}
        eventRail={{
          mode: eventRailMode,
          onModeChange: changeEventRailMode,
        }}
        hasManuscriptSelection={hasManuscriptSelection}
        navigation={{
          openCharacterEvidence,
          openEventRailSource,
          openForeshadowPointSource,
          openLoreEntryEvidence,
          openPlotThreadSource,
          workStructure: {
            onOpenCharacter: openWorkStructureCharacter,
            onOpenDocument: (document) => {
              void openWorkStructureDocument(document);
            },
            onOpenEvent: openWorkStructureEvent,
            onOpenLore: openWorkStructureLore,
            onOpenPlot: openWorkStructurePlot,
            onOpenPlotSource: openWorkStructurePlotSource,
            onOpenScene: openWorkStructureScene,
          },
        }}
        oauthStatus={chatGptOAuthStatus}
        onOpenSettings={onOpenSettings}
        onTabChange={changeStructureTab}
        projections={{
          activeCharacters: activeWorkCharacters,
          activeCharacterRelations: activeWorkCharacterRelations,
          activeEventBlocks: activeWorkEventBlocks,
          activeLoreEntries: activeWorkLoreEntries,
          activePlotEventLinks: activeWorkPlotEventLinks,
          activePlots: activeWorkPlots,
          activePlotSources: activeWorkPlotSources,
          activeSelectedCharacterId,
          activeSelectedLoreEntryId,
          activeSelectedPlotThreadId,
          workStructureOverview,
        }}
        runtime={
          runtime.status === "ready"
            ? {
                ready: true,
                foreshadowPointProfile: runtime.foreshadowPointProfile,
              }
            : { ready: false }
        }
        sceneContent={sceneStructureContent}
        sceneDraft={sceneDraftPanel}
      />
    );
    const reviewWorkspaceContent = (
      <ReviewWorkspaceHost
        activeDocument={activeDocument ?? null}
        activeTab={reviewTab}
        activeWork={activeWork ?? null}
        commands={{
          createLoreCandidate,
        }}
        controllers={{
          activity: activityController,
          characters: charactersController,
          editorTools: editorToolsController,
          lore: loreController,
          readingLayout: readingLayoutController,
          structure: structureController,
          version: versionController,
        }}
        documentLabels={activeWorkDocumentLabels}
        hasManuscriptSelection={hasManuscriptSelection}
        navigation={{
          activateDocumentById,
          openLoreCandidateEvidence,
          openRecordsDocument,
        }}
        onTabChange={changeReviewTab}
        projections={{
          activeCharacters: activeWorkCharacters,
          activeLoreCandidates: activeWorkLoreCandidates,
          activeLoreEntries: activeWorkLoreEntries,
        }}
        recordsNowMs={recordsNowMs}
        sceneContent={sceneStructureContent}
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
          <WorkspaceHeaderRecoveryHost
            activeDocumentLabel={activeDocument?.label ?? null}
            activeDocumentSummary={activeDocumentSummary ?? null}
            activeWork={activeWork ?? null}
            activeWorkId={activeWorkId}
            commands={{
              cancelWorkTitleEdit,
              changeSection: changeWorkSection,
              changeTitleEditValue,
              onReturnToWorks,
              renameActiveWork,
              returnToPreviousWorkLocation,
            }}
            controllers={{
              activity: activityController,
              completion: documentCompletionController,
              schedule: scheduleController,
            }}
            embedded={embedded}
            navigationDisabled={
              versionActionState !== "idle" || workspaceActionState !== "idle"
            }
            recovery={{
              apply: handleApplyStartupRecovery,
              applyState: recoveryApplyState,
              headingId: recoveryHeadingId,
            }}
            runtime={runtime}
            schedule={workScheduleSummary}
            telemetryStore={telemetryStore}
            titleEdit={{
              target: titleEditTarget,
              value: titleEditValue,
            }}
            workReturnLocation={workReturnLocation}
            workSection={workSection}
            workspaceActionState={workspaceActionState}
          />
          <div
            className={
              sharesDocumentRailWithSidebar
                ? "workspace-body workspace-body-shared-left-rail"
                : "workspace-body"
            }
            ref={workspaceBodyRef}
          >
            <DocumentRailHost
              activeDocument={activeDocument ?? null}
              activeDocumentId={
                runtime.status === "ready" ? runtime.activeDocumentId : null
              }
              activeWork={activeWork ?? null}
              commands={{
                clearWorkspaceError: () => setWorkspaceActionError(null),
                createDocument: () => createDocument(""),
                moveDocument,
                retireWork,
                startWorkTitleEdit,
                toggleLeftRail: () => toggleRail("left"),
                tree: {
                  onActivateDocument: activateDocumentById,
                  onCreateFolder: createDocumentFolder,
                  onPlaceDocument: placeDocumentInFolder,
                  onRenameDocument: renameDocument,
                  onRenameFolder: renameDocumentFolder,
                  onRetireDocument: async (document) => {
                    if (activeWork === undefined) {
                      throw new Error("The active Work is unavailable");
                    }
                    await retireDocument(
                      activeWork.workId,
                      document.documentId,
                    );
                  },
                  onRetireAllDocuments: async () => {
                    if (activeWork === undefined) {
                      throw new Error("The active Work is unavailable");
                    }
                    await retireAllDocuments(activeWork.workId);
                  },
                  onRetireFolder: retireDocumentFolder,
                },
              }}
              documentRailHost={documentRailHost}
              embedded={embedded}
              leftRail={railProjection?.left ?? null}
              railId={documentRailId}
              ready={runtime.status === "ready"}
              search={manuscriptSearchController}
              sharesDocumentRailWithSidebar={sharesDocumentRailWithSidebar}
              titleEditTarget={titleEditTarget}
              workspaceActionError={workspaceActionError}
              workspaceActionState={workspaceActionState}
            />
            <div
              className="workspace-center"
              data-active-document-id={activeDocument?.documentId}
            >
              <ManuscriptWorkspaceSurface
                activeDocument={activeDocument ?? null}
                activeWorkDocuments={activeWorkDocuments}
                callbacks={{
                  onCompositionEnd: handleCompositionEnd,
                  onDocumentActivated: handleDocumentActivated,
                  onFormattingChange: handleFormattingChange,
                  onTransaction: handleManuscriptTransaction,
                }}
                controllers={{
                  activity: activityController,
                  editorTools: editorToolsController,
                  event: eventWorkspaceController,
                  episodeMove: moveRangeToEpisodeController,
                  focus: focusModeController,
                  loreCue: loreCueController,
                  readingLayout: readingLayoutController,
                  scene: sceneWorkspaceController,
                }}
                editorRef={manuscriptEditorRef}
                focusStatus={{
                  forwardWriting: focusForwardWritingStatus,
                  pomodoro: focusPomodoroStatus,
                  save: focusSaveStatus,
                  timer: focusPomodoroTimerText,
                }}
                loreEntries={activeWorkLoreEntries}
                navigation={{
                  activateDocument: activateDocumentById,
                  closeDocumentTab: closeDocumentTabById,
                }}
                openDocuments={openDocuments}
                runtime={runtime.status === "ready" ? runtime : null}
                sceneProjection={
                  input.structureKernel.sceneProjection?.workId === activeWorkId
                    ? input.structureKernel.sceneProjection
                    : null
                }
                telemetryStore={telemetryStore}
                titleEditTarget={titleEditTarget}
                workspaceActionState={workspaceActionState}
                workspaceSurface={workspaceSurface}
              />
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
              <WorkspaceFeatureSurfaceHost
                activeDocument={activeDocument ?? null}
                activeWork={activeWork ?? null}
                controllers={{
                  characters: charactersController,
                  inspiration: inspirationController,
                  music: musicController,
                  plot: plotWorkspaceController,
                  plotState: plotWorkspaceState,
                  scene: sceneWorkspaceController,
                  sceneState: sceneWorkspaceState,
                  structure: structureController,
                }}
                documentLabels={activeWorkDocumentLabels}
                hasManuscriptSelection={hasManuscriptSelection}
                musicConnected={
                  youtubeMusicConnectionStatus?.apiKeyConfigured === true
                }
                navigation={{
                  focusScene,
                  openCharacterEvidence,
                  openPlotThreadSource,
                  previewSceneExtractionCandidate,
                }}
                oauthStatus={chatGptOAuthStatus}
                onOpenSettings={onOpenSettings}
                projections={{
                  activeCharacterRelations: activeWorkCharacterRelations,
                  activeCharacters: activeWorkCharacters,
                  activeEventBlocks: activeWorkEventBlocks,
                  activePlotEventLinks: activeWorkPlotEventLinks,
                  activePlots: activeWorkPlots,
                  activePlotSources: activeWorkPlotSources,
                  activeSelectedCharacterId,
                  activeSelectedPlotThreadId,
                }}
                ready={runtime.status === "ready"}
                sceneDraft={sceneDraftPanel}
                workSection={workSection}
                workspaceSurface={workspaceSurface}
              />
            </div>
            <ReviewInspectorRail
              activeDocument={activeDocument ?? null}
              activeWork={activeWork ?? null}
              commands={{
                captureCharacterWorkspaceSelection,
                openCandidateInbox: () => {
                  selectReviewTab("candidates");
                  showWorkSection("review");
                  exitFocusMode();
                },
                openPlotWorkspace,
                toggleRightRail: () => toggleRail("right"),
              }}
              controllers={{
                assistant: assistantController,
                characters: charactersController,
                event: eventWorkspaceController,
                eventState: eventWorkspaceState,
                foreshadow: foreshadowController,
                fragments: fragmentsController,
                lore: loreController,
                loreCue: loreCueController,
                loreCueState,
                music: musicController,
                plotState: plotWorkspaceState,
                scene: sceneWorkspaceController,
                sceneState: sceneWorkspaceState,
                version: versionController,
                workStructure: workStructureState,
                workspaceLayout: workspaceLayoutController,
              }}
              embedded={embedded}
              hasManuscriptSelection={hasManuscriptSelection}
              ids={{
                assistantTab: reviewAssistantTabId,
                currentTab: reviewCurrentTabId,
                rail: reviewRailId,
                versionsTab: reviewVersionsTabId,
                workTab: reviewWorkTabId,
              }}
              projections={{
                activeCharacters: activeWorkCharacters,
                activeLoreCandidates: activeWorkLoreCandidates,
                activeLoreEntries: activeWorkLoreEntries,
                activePlots: activeWorkPlots,
                workStructureOverview,
              }}
              ready={runtime.status === "ready"}
              rightRail={railProjection?.right ?? null}
              telemetryStore={telemetryStore}
              workspaceSurface={workspaceSurface}
            />
          </div>
          <WorkspaceStatusToolsHost
            activeDocument={activeDocument ?? null}
            activeManuscriptPosition={activeManuscriptPosition}
            activeSaveState={activeSaveState}
            activeWork={activeWork ?? null}
            activeWorkId={activeWorkId}
            controllers={{
              activity: activityController,
              editorTools: editorToolsController,
              event: eventWorkspaceController,
              eventState: eventWorkspaceState,
              focus: focusModeController,
              music: musicController,
              readingLayout: readingLayoutController,
              schedule: scheduleController,
              version: versionController,
            }}
            darkMode={darkMode}
            embedded={embedded}
            eventRail={eventRail}
            eventRailHost={eventRailHost}
            focusText={musicFocusText}
            musicPlayerHost={musicPlayerHost}
            navigation={{
              openCompletedRevisionFromSchedule,
              openDocumentFromSchedule,
              openEventRailSource,
            }}
            onOpenSettings={onOpenSettings}
            onThemeChange={onThemeChange}
            preflightProfile={
              runtime.status === "ready" ? runtime.preflightProfile : null
            }
            runtime={runtime}
            scheduleClient={scheduleClient}
            scheduleSettingsRevision={scheduleSettingsRevision}
            telemetryStore={telemetryStore}
            workspaceSurface={workspaceSurface}
            youtubeMusicConnectionStatus={youtubeMusicConnectionStatus}
          />
          <AssistantDialogHost
            activeDocument={activeDocument ?? null}
            activeWork={activeWork ?? null}
            controller={assistantController}
            documentLabels={activeWorkDocumentLabels}
            hasManuscriptSelection={hasManuscriptSelection}
            onOpenSettingReference={openAssistantSettingReference}
            {...(onOpenSettings === undefined ? {} : { onOpenSettings })}
            openVocabularyOccurrence={openAssistantVocabularyOccurrence}
            ready={runtime.status === "ready"}
          />
          <WorkspaceFeatureDialogHost
            activeWork={activeWork ?? null}
            characters={{
              activeCharacters: activeWorkCharacters,
              controller: charactersController,
              selectedCharacterId: activeSelectedCharacterId,
            }}
            documentLabels={activeWorkDocumentLabels}
            foreshadow={{
              capturePoint: captureForeshadowPoint,
              controller: foreshadowController,
              linkLore: (line, loreEntryId) => {
                const entry = activeWorkLoreEntries.find(
                  (candidate) => candidate.loreEntryId === loreEntryId,
                );
                if (entry !== undefined) {
                  void linkLoreForeshadow(entry, line, "foreshadow");
                }
              },
              loreEntries: activeWorkLoreEntries,
              loreLinks: activeWorkLoreForeshadowLinks,
              openPoint: openForeshadowPointSource,
              unlinkLore: (link) => {
                void unlinkLoreForeshadow(link, "foreshadow");
              },
            }}
            fragments={{
              capture: captureFragment,
              controller: fragmentsController,
              insert: insertFragmentAtCursor,
              move: moveSelectionToFragment,
              openSource: openFragmentSource,
            }}
            lore={{
              activeCandidates: activeWorkLoreCandidates,
              activeEntries: activeWorkLoreEntries,
              activeLinks: activeWorkLoreForeshadowLinks,
              addEvidence: addLoreEntryEvidence,
              controller: loreController,
              createCandidate: createLoreCandidate,
              createEntry: createLoreEntry,
              foreshadowLines,
              linkForeshadow: (entry, line) => {
                void linkLoreForeshadow(entry, line, "lore");
              },
              openCandidateEvidence: openLoreCandidateEvidence,
              openEvidence: openLoreEntryEvidence,
              selectedLoreEntryId: activeSelectedLoreEntryId,
              unlinkForeshadow: (link) => {
                void unlinkLoreForeshadow(link, "lore");
              },
            }}
            plot={{
              activeEventBlocks: activeWorkEventBlocks,
              activeEventLinks: activeWorkPlotEventLinks,
              activePlots: activeWorkPlots,
              activeSources: activeWorkPlotSources,
              controller: plotWorkspaceController,
              openSource: openPlotThreadSource,
              plotBoard,
              sceneDraft: sceneDraftPanel,
              state: plotWorkspaceState,
            }}
            runtime={
              runtime.status === "ready"
                ? {
                    ready: true,
                    foreshadowPointProfile: runtime.foreshadowPointProfile,
                    fragmentProfile: runtime.fragmentProfile,
                  }
                : { ready: false }
            }
            source={{
              activeDocument: activeDocument ?? null,
              hasManuscriptSelection,
            }}
            workStructure={{
              loreEntryCount: activeWorkLoreEntries.length,
              navigation: {
                onOpenCharacter: openWorkStructureCharacter,
                onOpenDocument: (document) => {
                  void openWorkStructureDocument(document);
                },
                onOpenEvent: openWorkStructureEvent,
                onOpenLore: openWorkStructureLore,
                onOpenPlot: openWorkStructurePlot,
                onOpenPlotSource: openWorkStructurePlotSource,
                onOpenScene: openWorkStructureScene,
              },
              projection: workStructureOverview,
              state: workStructureState,
            }}
          />
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
  
}
