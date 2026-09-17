import { useCallback, useMemo } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import { useLoreCueState } from "../lore/useLoreCueController";
import { useLoreForeshadowLinkState } from "../lore/useLoreForeshadowLinkController";
import { useMusicController } from "../music/useMusicController";
import {
  useEventWorkspaceState,
} from "./useEventWorkspaceController";
import {
  usePlotWorkspaceState,
} from "./usePlotWorkspaceController";
import {
  useSceneWorkspaceState,
} from "./useSceneWorkspaceController";
import { useStructureController } from "./useStructureController";
import { useSceneCanonContextController } from "./useSceneCanonContextController";
import { useWorkStructureState } from "../../workspace/structure/useWorkStructureState";
import type { WorkspaceRuntimeState } from "../../workspace/session/workspace-session-state";

export function useWorkspaceStructureKernel(input: Readonly<{
  client: Pick<
    StudioBridge,
    | "loreForeshadowLinks"
    | "musicPlayback"
    | "plots"
    | "settings"
    | "structure"
  >;
  musicSettingsRevision: number;
  runtime: WorkspaceRuntimeState;
}>) {
  const { musicSettingsRevision, runtime } = input;

    const structureWorkLoadId =
      runtime.status === "ready" &&
        runtime.catalog.activeWorkId !== null &&
        runtime.catalog.works.some(
          (work) => work.workId === runtime.catalog.activeWorkId,
        )
        ? runtime.catalog.activeWorkId
        : null;
    const eventWorkspaceState = useEventWorkspaceState();
    const {
      clearEventActionError,
      reportEventActionError,
    } = eventWorkspaceState;
    const plotWorkspaceState = usePlotWorkspaceState();
    const {
      resetPlotWorkspace,
      installLoadedPlots,
      failPlotWorkspaceLoad,
      preparePlotSourceNavigation,
    } = plotWorkspaceState;
    const sceneWorkspaceState = useSceneWorkspaceState();
    const {
      sceneDraftActionState,
      sceneDraftActionError,
      resetSceneWorkspace,
      installLoadedSceneWorkspace,
      failSceneWorkspaceLoad,
      clearSceneActionError,
      reportSceneActionError,
      selectSceneExtraction,
    } = sceneWorkspaceState;
    const loreForeshadowLinkState = useLoreForeshadowLinkState(
      input.client.loreForeshadowLinks,
    );
    const {
      loreCompatibility: loreLinksCompatibility,
      foreshadowCompatibility: foreshadowLoreLinkCompatibility,
    } = loreForeshadowLinkState;
    const loreCueState = useLoreCueState();
    const {
      hoveredLoreCue,
      resetLoreCue,
    } = loreCueState;
    const workStructureState = useWorkStructureState();
    const musicOperations = useMemo(() => Object.freeze({
      playback: input.client.musicPlayback,
      settings: input.client.settings,
    }), [input.client.musicPlayback, input.client.settings]);
    const musicController = useMusicController({
      activeWorkId: structureWorkLoadId,
      musicSettingsRevision,
      operations: musicOperations,
      profileClient: input.client.musicPlayback,
      settingsClient: input.client.settings,
    });
    const {
      workMusicSettings,
      playMusicQueue,
      sceneQueueProjectionPort: sceneMusicQueueProjectionPort,
      listSceneMusicQueueCandidates,
      clearSceneMusicQueueError,
      refreshSceneMusicQueueCandidates,
      reconcile: musicReconcile,
    } = musicController;
    const {
      replaceSceneMusicQueueCandidates,
    } = musicReconcile;
    const handleStructureEventLoaded = useCallback(() => {
      clearEventActionError();
    }, [clearEventActionError]);
    const handleStructureEventLoadFailed = useCallback(() => {
      reportEventActionError("작품 사건 순서를 불러오지 못했습니다.");
    }, [reportEventActionError]);
    const handleStructureSceneReset = useCallback(() => {
      resetSceneWorkspace();
      clearSceneMusicQueueError();
    }, [clearSceneMusicQueueError, resetSceneWorkspace]);
    const handleStructureSceneLoaded = useCallback(() => {
      installLoadedSceneWorkspace();
      clearSceneMusicQueueError();
    }, [clearSceneMusicQueueError, installLoadedSceneWorkspace]);
    const handleStructureSceneLoadFailed = useCallback(() => {
      failSceneWorkspaceLoad();
    }, [failSceneWorkspaceLoad]);
    const handleStructurePlotReset = useCallback(() => {
      resetPlotWorkspace();
    }, [resetPlotWorkspace]);
    const handleStructurePlotLoaded = useCallback(
      (loadedPlots: readonly PlotThreadProjection[]) => {
        installLoadedPlots(loadedPlots);
      },
      [installLoadedPlots],
    );
    const handleStructurePlotLoadFailed = useCallback(() => {
      failPlotWorkspaceLoad();
    }, [failPlotWorkspaceLoad]);
    const structureProjectionLifecycle = useMemo(() => Object.freeze({
      eventLoaded: handleStructureEventLoaded,
      eventLoadFailed: handleStructureEventLoadFailed,
      sceneReset: handleStructureSceneReset,
      sceneLoaded: handleStructureSceneLoaded,
      sceneLoadFailed: handleStructureSceneLoadFailed,
      plotReset: handleStructurePlotReset,
      plotLoaded: handleStructurePlotLoaded,
      plotLoadFailed: handleStructurePlotLoadFailed,
    }), [
      handleStructureEventLoadFailed,
      handleStructureEventLoaded,
      handleStructurePlotLoadFailed,
      handleStructurePlotLoaded,
      handleStructurePlotReset,
      handleStructureSceneLoadFailed,
      handleStructureSceneLoaded,
      handleStructureSceneReset,
    ]);
  
    const structureController = useStructureController({
      activeWorkId: structureWorkLoadId,
      lifecycle: structureProjectionLifecycle,
      music: sceneMusicQueueProjectionPort,
      plotsClient: input.client.plots,
      structureClient: input.client.structure,
    });
    const sceneCanonContextController=useSceneCanonContextController({
      activeWorkId:structureWorkLoadId,
      client:input.client.structure,
    });
    const {
      eventBlocks,
      eventSources,
      eventRail,
      plots,
      plotBoard,
      plotSources,
      plotEventLinks,
      sceneProjection,
      sceneExtractionCandidates,
      sceneDraftCandidates,
      refreshSceneProjection,
      refreshEventProjection,
      eventMutations,
      plotMutations,
      reconcile: structureProjectionReconcile,
    } = structureController;
    const {
      replaceSceneProjection,
    } = structureProjectionReconcile;
  
  
  return {
    eventWorkspaceState,
    plotWorkspaceState,
    sceneWorkspaceState,
    loreForeshadowLinkState,
    loreLinksCompatibility,
    foreshadowLoreLinkCompatibility,
    loreCueState,
    hoveredLoreCue,
    resetLoreCue,
    workStructureState,
    musicController,
    workMusicSettings,
    playMusicQueue,
    listSceneMusicQueueCandidates,
    clearSceneMusicQueueError,
    refreshSceneMusicQueueCandidates,
    replaceSceneMusicQueueCandidates,
    structureController,
    eventBlocks,
    eventSources,
    eventRail,
    plots,
    plotBoard,
    plotSources,
    plotEventLinks,
    sceneProjection,
    sceneExtractionCandidates,
    sceneDraftCandidates,
    refreshSceneProjection,
    refreshEventProjection,
    eventMutations,
    plotMutations,
    structureProjectionReconcile,
    sceneCanonContextController,
    replaceSceneProjection,
    preparePlotSourceNavigation,
    sceneDraftActionState,
    sceneDraftActionError,
    selectSceneExtraction,
    clearSceneActionError,
    reportSceneActionError,
  };
}
