import { useCallback, useMemo, type RefObject } from "react";

import type { StudioBridge } from "../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import { deriveWorkStructureOverview } from "../../application/structure/work-structure-overview";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import type { ManuscriptEditorHandle } from "../editor/ManuscriptEditor";
import { useForeshadowController } from "../features/foreshadow/useForeshadowController";
import { useFragmentsController } from "../features/fragments/useFragmentsController";
import { useLoreForeshadowLinkController } from "../features/lore/useLoreForeshadowLinkController";
import { usePlotWorkspaceController } from "../features/structure/usePlotWorkspaceController";
import { useSceneWorkspaceController } from "../features/structure/useSceneWorkspaceController";
import type { useWorkspaceStructureKernel } from "../features/structure/useWorkspaceStructureKernel";
import { ManuscriptTelemetryStore } from "../editor/manuscript-telemetry-store";
import type { useWorkspaceLayoutController } from "./layout/useWorkspaceLayoutController";
import type { useWorkspaceNavigationState } from "./navigation/useWorkspaceNavigationController";
import type { usePersistenceCoordinator } from "./session/usePersistenceCoordinator";
import type { useWorkspaceCoreFeatureKernel } from "./useWorkspaceCoreFeatureKernel";
import { useWorkspaceManuscriptActionsController } from "./editor/useWorkspaceManuscriptActionsController";
import { useMoveRangeToEpisodeController } from "../features/editor-tools/useMoveRangeToEpisodeController";

export function useWorkspaceStoryFeatureKernel(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWork: WorkspaceWorkSummary | undefined;
  activeWorkId: WorkspaceWorkSummary["workId"] | null;
  client: StudioBridge;
  coreKernel: ReturnType<typeof useWorkspaceCoreFeatureKernel>;
  layout: ReturnType<typeof useWorkspaceLayoutController>;
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  navigation: ReturnType<typeof useWorkspaceNavigationState>;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    "durableSaveQueueRef"
  >;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  reloadRuntimeAfterEpisodeMove: (
    preferredDocumentId: EntityId<"Document">,
  ) => Promise<void>;
  structureKernel: ReturnType<typeof useWorkspaceStructureKernel>;
  telemetryStore: ManuscriptTelemetryStore;
}>) {
  const {
    activeDocument,
    activeWork,
    activeWorkId,
    manuscriptEditorRef,
    persistDocument,
    telemetryStore,
  } = input;
  const {
    activeWorkDocuments,
    activityController,
    assistantConversationId,
    characterRelations,
    characters,
    charactersController,
    editorToolsController,
    eventWorkspaceEditorPort,
    loreActionState,
    loreCandidates,
    loreController,
    loreEntries,
    loreSharedLinkAction,
    manuscriptSearchController,
    refreshEventRailAfterPlotChange,
    selectedCharacterId,
    selectedLoreEntryId,
  } = input.coreKernel;
  const {
    eventBlocks,
    eventSources,
    foreshadowLoreLinkCompatibility,
    loreCueState,
    loreForeshadowLinkState,
    plotBoard,
    plotEventLinks,
    plotMutations,
    plotSources,
    plots,
    plotWorkspaceState,
    preparePlotSourceNavigation,
    refreshSceneMusicQueueCandidates,
    refreshSceneProjection,
    sceneExtractionCandidates,
    sceneProjection,
    sceneWorkspaceState,
    structureProjectionReconcile,
  } = input.structureKernel;
  const {
    preserveCurrentWorkLocation,
    selectStructureTab,
    showWorkSection,
  } = input.navigation;
  const {
    durableSaveQueueRef,
  } = input.persistence;
  const workspaceLayoutController = input.layout;

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
    const openPlotsStructureTab = useCallback(() => {
      selectStructureTab("plots");
    }, [selectStructureTab]);
    const plotWorkspaceControllerInput = useMemo(() => Object.freeze({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      activeWorkPlots,
      editor: eventWorkspaceEditorPort,
      openPlotsStructureTab,
      persistDocument,
      plotBoard,
      plotMutations,
      refreshEventRailAfterPlotChange,
      state: plotWorkspaceState,
    }), [
      activeDocument,
      activeWork,
      activeWorkPlots,
      eventWorkspaceEditorPort,
      openPlotsStructureTab,
      persistDocument,
      plotBoard,
      plotMutations,
      plotWorkspaceState,
      refreshEventRailAfterPlotChange,
    ]);
    const plotWorkspaceController = usePlotWorkspaceController(
      plotWorkspaceControllerInput,
    );
    const {
      activeSelectedPlotThreadId,
      activeSelectedPlot,
    } = plotWorkspaceController;
    const sceneWorkspaceEditorPort = useMemo(() => ({
      getCurrentRevisionId: (documentId: EntityId<"Document">) =>
        durableSaveQueueRef.current?.getCurrentRevisionId(documentId),
      insertTextAtExactOffset: (
        document: ManuscriptDocumentSource,
        offset: number,
        expectedLength: number,
        text: string,
      ) => manuscriptEditorRef.current?.insertTextAtExactOffset(
        document,
        offset,
        expectedLength,
        text,
      ) ?? false,
      materializeDocumentText: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.materializeDocumentText(document),
      readDocumentState: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.readDocumentState(document),
    }), []); // eslint-disable-line react-hooks/exhaustive-deps -- ref objects are stable editor ports
    const openWritingSurfaceForSceneDraft = useCallback(() => {
      preserveCurrentWorkLocation();
      showWorkSection("write");
    }, [preserveCurrentWorkLocation, showWorkSection]);
    const createSceneExtractionRequestId = useCallback(() =>
      entityId<"SceneExtractionRequest">(crypto.randomUUID()), []);
    const createSceneDraftRequestId = useCallback(() =>
      entityId<"SceneDraftRequest">(crypto.randomUUID()), []);
    const sceneWorkspaceControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      activeWorkPlots,
      assistantConversationId,
      assistantPermissionClient: input.client.assistant,
      createSceneDraftRequestId,
      createSceneExtractionRequestId,
      editor: sceneWorkspaceEditorPort,
      openWritingSurface: openWritingSurfaceForSceneDraft,
      persistDocument,
      prepareSceneExtractionCapture: preparePlotSourceNavigation,
      reconcile: structureProjectionReconcile,
      refreshSceneMusicQueueCandidates,
      refreshSceneProjection,
      sceneExtractionCandidates,
      sceneProjection,
      state: sceneWorkspaceState,
      structureClient: input.client.structure,
    }), [
      activeDocument,
      activeWork,
      activeWorkPlots,
      assistantConversationId,
      createSceneDraftRequestId,
      createSceneExtractionRequestId,
      input.client.assistant,
      input.client.structure,
      openWritingSurfaceForSceneDraft,
      persistDocument,
      preparePlotSourceNavigation,
      refreshSceneMusicQueueCandidates,
      refreshSceneProjection,
      sceneExtractionCandidates,
      sceneProjection,
      sceneWorkspaceEditorPort,
      sceneWorkspaceState,
      structureProjectionReconcile,
    ]);
    const sceneWorkspaceController = useSceneWorkspaceController(
      sceneWorkspaceControllerInput,
    );
    const {
      performSceneDraft,
      updateSceneDraftCandidate,
      applySceneDraftCandidate,
      regenerateSceneDraftCandidate,
    } = sceneWorkspaceController;
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
    const activeSelectedLoreEntryId = activeWorkLoreEntries.some(
      (entry) => entry.loreEntryId === selectedLoreEntryId,
    )
      ? selectedLoreEntryId
      : null;
    const foreshadowController = useForeshadowController({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      client: input.client.foreshadowing,
      links: foreshadowLoreLinkCompatibility,
      workLoadId: activeWorkId,
    });
    const {
      foreshadowLines,
      foreshadowLineActionState,
      sharedLinkAction: foreshadowSharedLinkAction,
    } = foreshadowController;
    const loreForeshadowLinkControllerInput = useMemo(() => Object.freeze({
      activeWorkId: activeWork?.workId ?? null,
      client: input.client.loreForeshadowLinks,
      foreshadowActionState: foreshadowLineActionState,
      foreshadowSharedLinkAction,
      loreActionState,
      loreSharedLinkAction,
      state: loreForeshadowLinkState,
    }), [activeWork?.workId, foreshadowLineActionState, foreshadowSharedLinkAction, input.client.loreForeshadowLinks, loreActionState, loreForeshadowLinkState, loreSharedLinkAction]);
    const loreForeshadowLinkController = useLoreForeshadowLinkController(
      loreForeshadowLinkControllerInput,
    );
    const {
      activeLinks: activeWorkLoreForeshadowLinks,
      linkLoreForeshadow,
      unlinkLoreForeshadow,
    } = loreForeshadowLinkController;
  
    const fragmentsController = useFragmentsController({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      client: input.client.fragments,
      workLoadId: activeWorkId,
    });
    const {
      fragments,
    } = fragmentsController;
    const {
      captureCharacterWorkspaceSelection,
      createLoreEntry,
      addLoreEntryEvidence,
      createLoreCandidate,
      captureFragment,
      moveSelectionToFragment,
      insertFragmentAtCursor,
      handleManuscriptTransaction,
    } = useWorkspaceManuscriptActionsController({
      controllers: {
        activity: activityController,
        characters: charactersController,
        editorTools: editorToolsController,
        fragments: fragmentsController,
        lore: loreController,
        loreCueState,
        manuscriptSearch: manuscriptSearchController,
        sceneState: sceneWorkspaceState,
        workspaceLayout: workspaceLayoutController,
      },
      manuscriptEditorRef,
      persistence: {
        durableSaveQueueRef,
      },
      persistDocument,
      telemetryStore,
    });
  const moveRangeToEpisodeController = useMoveRangeToEpisodeController({
    activeDocument: activeDocument ?? null,
    documents: activeWorkDocuments,
    editorClient: input.client.editor,
    editorRef: manuscriptEditorRef,
    durableSaveQueueRef,
    reloadRuntime: input.reloadRuntimeAfterEpisodeMove,
    refreshSceneProjection,
  });
  
  return {
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
    fragments,
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
  };
}
