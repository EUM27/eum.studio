import { useCallback, useMemo, type RefObject } from "react";

import type { StudioBridge } from "../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import { deriveWorkStructureOverview } from "../../application/structure/work-structure-overview";
import type { SceneProjection } from "../../application/structure/scene-projection";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../domain/writing";
import type { ManuscriptEditorHandle } from "../editor/ManuscriptEditor";
import type { SceneBoundaryHistoryEntry } from "../editor/scene-boundary-history-extension";
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
import { useAutomaticSceneAnalysisController } from "../features/analysis/useAutomaticSceneAnalysisController";

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
  sceneAnalysisSettingsRevision: number;
  sceneAnalysisEnabled: boolean | null;
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
    canonReviewController,
    continuityController,
    characterKnowledgeController,
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
    narrativeDigestController,
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
    selectCanonTab,
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
      isDocumentComposing: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.isDocumentComposing(document) ?? false,
      readDocumentState: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.readDocumentState(document),
      recordSceneBoundaryHistory: (
        document: ManuscriptDocumentSource,
        entry: SceneBoundaryHistoryEntry,
      ) =>
        manuscriptEditorRef.current?.recordSceneBoundaryHistory(
          document,
          entry,
        ) ?? false,
    }), []); // eslint-disable-line react-hooks/exhaustive-deps -- ref objects are stable editor ports
    const openWritingSurfaceForSceneDraft = useCallback(() => {
      preserveCurrentWorkLocation();
      showWorkSection("write");
    }, [preserveCurrentWorkLocation, showWorkSection]);
    const createSceneExtractionRequestId = useCallback(() =>
      entityId<"SceneExtractionRequest">(crypto.randomUUID()), []);
    const createSceneDraftRequestId = useCallback(() =>
      entityId<"SceneDraftRequest">(crypto.randomUUID()), []);
    const automaticSceneAnalysisController = useAutomaticSceneAnalysisController({
      activeWorkId,
      assistantClient: input.client.assistant,
      canonReviewController,
      conversationId: assistantConversationId,
      digestClient: input.client.narrativeDigest,
      documents: activeWorkDocuments,
      persistDocument,
      refreshDigests: narrativeDigestController.refresh,
      refreshContinuityCandidates: continuityController.refresh,
      refreshSceneProjection,
      sceneProjection,
      settingsClient: input.client.settings,
      settingsEnabled: input.sceneAnalysisEnabled,
      settingsRevision: input.sceneAnalysisSettingsRevision,
      structureClient: input.client.structure,
    });
    const sceneWorkspaceControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      activeWorkPlots,
      assistantConversationId,
      assistantPermissionClient: input.client.assistant,
      createSceneDraftRequestId,
      createSceneExtractionRequestId,
      documents: activeWorkDocuments,
      editor: sceneWorkspaceEditorPort,
      openWritingSurface: openWritingSurfaceForSceneDraft,
      onSceneSplit: automaticSceneAnalysisController.analyzeSplit,
      persistDocument,
      prepareSceneExtractionCapture: preparePlotSourceNavigation,
      reconcile: structureProjectionReconcile,
      refreshSceneMusicQueueCandidates,
      refreshSceneProjection,
      reloadRuntimeAfterSceneMutation: input.reloadRuntimeAfterEpisodeMove,
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
      activeWorkDocuments,
      input.client.assistant,
      input.client.structure,
      openWritingSurfaceForSceneDraft,
      automaticSceneAnalysisController.analyzeSplit,
      persistDocument,
      preparePlotSourceNavigation,
      refreshSceneMusicQueueCandidates,
      refreshSceneProjection,
      input.reloadRuntimeAfterEpisodeMove,
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
    const openCanonReview = useCallback(() => {
      selectCanonTab("review");
      showWorkSection("canon");
    }, [selectCanonTab, showWorkSection]);
    const openContinuity = useCallback(() => {
      selectCanonTab("continuity");
      showWorkSection("canon");
    }, [selectCanonTab, showWorkSection]);
    const openCharacterKnowledge = useCallback(() => {
      selectCanonTab("knowledge");
      showWorkSection("canon");
    }, [selectCanonTab, showWorkSection]);
    const reviewSceneCanon=useCallback(async(scene:SceneProjection)=>{
      if(scene.range===null||scene.integrity!=="resolved")return null;
      const document=activeWorkDocuments.find((candidate)=>candidate.documentId===scene.documentId);
      if(document===undefined)return null;
      await persistDocument(document);
      const currentRevisionId=durableSaveQueueRef.current?.getCurrentRevisionId(scene.documentId)??scene.documentRevisionId;
      if(currentRevisionId!==scene.documentRevisionId){
        canonReviewController.reportError("장면 원고가 바뀌었습니다. 장면 목록을 새로 읽은 뒤 다시 점검하세요.");
        await refreshSceneProjection(scene.workId);
        return null;
      }
      const finalized=await input.client.structure.finalizeSceneCanonCheck({
        schemaVersion:1,workId:scene.workId,sceneKey:scene.sceneKey,
        documentId:scene.documentId,documentRevisionId:scene.documentRevisionId,
        from:scene.range.start,to:scene.range.end,
      });
      await refreshSceneProjection(scene.workId);
      openCanonReview();
      return canonReviewController.runReview(finalized.sourceRange,["character","character-relation","lore-entry"]);
    },[activeWorkDocuments,canonReviewController,durableSaveQueueRef,input.client.structure,openCanonReview,persistDocument,refreshSceneProjection]);
    const openSceneContinuity=useCallback(()=>{
      openContinuity();void continuityController.refresh();
    },[continuityController,openContinuity]);
    const openSceneKnowledge=useCallback(()=>{
      openCharacterKnowledge();void characterKnowledgeController.refresh();
    },[characterKnowledgeController,openCharacterKnowledge]);
    const {
      captureCharacterWorkspaceSelection,
      createLoreEntry,
      addLoreEntryEvidence,
      createLoreCandidate,
      captureFragment,
      moveSelectionToFragment,
      insertFragmentAtCursor,
      runCanonReviewSelection,
      stageContinuitySelection,
      runContinuityReviewSelection,
      stageCharacterKnowledgeSelection,
      handleManuscriptTransaction,
    } = useWorkspaceManuscriptActionsController({
      controllers: {
        activity: activityController,
        canon: canonReviewController,
        continuity: continuityController,
        characterKnowledge: characterKnowledgeController,
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
      navigation: {
        openCanonReview,
        openContinuity,
        openCharacterKnowledge,
      },
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
    workspaceClient: input.client.workspace,
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
    automaticSceneAnalysisController,
    fragments,
    captureCharacterWorkspaceSelection,
    createLoreEntry,
    addLoreEntryEvidence,
    createLoreCandidate,
    captureFragment,
    moveSelectionToFragment,
    insertFragmentAtCursor,
    runCanonReviewSelection,
    stageContinuitySelection,
    runContinuityReviewSelection,
    stageCharacterKnowledgeSelection,
    handleManuscriptTransaction,
    moveRangeToEpisodeController,
    performSceneDraft,
    updateSceneDraftCandidate,
    applySceneDraftCandidate,
    regenerateSceneDraftCandidate,
    reviewSceneCanon,
    openSceneContinuity,
    openSceneKnowledge,
  };
}
