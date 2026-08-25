import { useCallback, useEffect, useMemo, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type { SceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import type {
  PlotBoardProjection,
  PlotPlacementProjection,
} from "../../../application/plots/plot-board-contract";
import type {
  PlotEventLinkMutationProjection,
  PlotEventLinkProjection,
  PlotEventLinkRole,
} from "../../../application/plots/plot-event-link-contract";
import type {
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../../../application/plots/plot-contract";
import type { PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../../application/structure/event-block-contract";
import type { EntityId } from "../../../domain/writing";
import {
  createAnchorlessEventRecord,
  createAnchorlessEventFromPlotRecord,
  createPlotFromEventThroughPorts,
  createPlotThreadThroughPorts,
  createSelectedEventFromPlotThroughPorts,
  createSelectedEventThroughPort,
  linkPlotEventRecord,
  linkPlotThreadSourceThroughPort,
  linkEventSourceThroughPort,
  moveEventBlockRecord,
  movePlotPlacementThroughPorts,
  readEventProjectionWithSceneRefresh,
  readSceneProjection,
  replaceEventSourceThroughPort,
  retireEventSourceRecord,
  retirePlotThreadThroughPorts,
  unlinkPlotEventRecord,
  setPlotPlacementStoryTimeThroughPorts,
  startEventAndSceneProjectionLanes,
  startPlotProjectionLane,
  type PlotControllerClient,
  type PlotMutationRefreshPort,
  type PlotMutationSelectionPort,
  type PlotFromEventTabPort,
  type PlotThreadDraftInput,
  type SceneMusicQueueProjectionPort,
  type StructureControllerClient,
  type StructureEventManuscriptPort,
  type StructureEventMoveTarget,
  type StructureEventSourceInput,
  type StructurePlotSourceInput,
  type StructurePlotSourceManuscriptPort,
  type StructurePlotPlacementMoveTarget,
  type StructurePlotSelectedEventSource,
  type StructurePlotStoryTimeTarget,
  type StructureProjectionLifecyclePort,
  updatePlotThreadThroughPorts,
} from "./structure-client";
import {
  applyPlotEventLinkMutationState,
  failEventLane,
  failPlotLane,
  failSceneLane,
  INITIAL_STRUCTURE_PROJECTION_STATE,
  loadEventLane,
  loadPlotLane,
  loadSceneLane,
  replacePlotBoardState,
  replacePlotSourceState,
  replaceSceneAnnotationsState,
  replaceSceneProjectionState,
  resetEventLane,
  resetPlotLane,
  resetSceneLane,
  retirePlotState,
  updatePlotAndLinkTitlesState,
  upsertPlotState,
  upsertSceneDraftCandidateState,
  upsertSceneExtractionCandidateState,
} from "./structure-state";

export function useStructureController(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  lifecycle: StructureProjectionLifecyclePort;
  music: SceneMusicQueueProjectionPort;
  plotsClient: PlotControllerClient;
  structureClient: StructureControllerClient;
}>) {
  const [projectionState, setProjectionState] = useState(
    INITIAL_STRUCTURE_PROJECTION_STATE,
  );

  useEffect(() => startEventAndSceneProjectionLanes({
    activeWorkId: input.activeWorkId,
    client: input.structureClient,
    music: input.music,
    onEventReset: () => {
      setProjectionState((current) => resetEventLane(current));
    },
    onSceneReset: () => {
      setProjectionState((current) => resetSceneLane(current));
      input.music.clear();
      input.lifecycle.sceneReset();
    },
    onEventLoaded: (projection) => {
      setProjectionState((current) => loadEventLane(current, projection));
      input.lifecycle.eventLoaded();
    },
    onEventFailed: () => {
      setProjectionState((current) => failEventLane(current));
      input.lifecycle.eventLoadFailed();
    },
    onSceneLoaded: (projection) => {
      setProjectionState((current) => loadSceneLane(current, projection));
      input.music.replace(projection.musicQueueCandidates);
      input.lifecycle.sceneLoaded();
    },
    onSceneFailed: () => {
      setProjectionState((current) => failSceneLane(current));
      input.music.clear();
      input.lifecycle.sceneLoadFailed();
    },
  }), [
    input.activeWorkId,
    input.lifecycle,
    input.music,
    input.structureClient,
  ]);

  useEffect(() => startPlotProjectionLane({
    activeWorkId: input.activeWorkId,
    client: input.plotsClient,
    onReset: () => {
      setProjectionState((current) => resetPlotLane(current));
      input.lifecycle.plotReset();
    },
    onLoaded: (projection) => {
      setProjectionState((current) => loadPlotLane(current, projection));
      input.lifecycle.plotLoaded(projection.plots);
    },
    onFailed: () => {
      setProjectionState((current) => failPlotLane(current));
      input.lifecycle.plotLoadFailed();
    },
  }), [input.activeWorkId, input.lifecycle, input.plotsClient]);

  const refreshSceneProjection = useCallback(
    async (workId: EntityId<"Work">) => {
      const projection = await readSceneProjection(
        input.structureClient,
        workId,
      );
      setProjectionState((current) =>
        replaceSceneProjectionState(current, projection)
      );
      return projection;
    },
    [input.structureClient],
  );

  const refreshEventProjection = useCallback(
    async (workId: EntityId<"Work">) => {
      const projection = await readEventProjectionWithSceneRefresh({
        client: input.structureClient,
        refreshSceneProjection,
        workId,
      });
      setProjectionState((current) => loadEventLane(current, projection));
      return projection;
    },
    [input.structureClient, refreshSceneProjection],
  );

  const createSelectedEvent = useCallback((event: Readonly<{
    document: ManuscriptDocumentSource;
    manuscript: StructureEventManuscriptPort;
    note: string;
    source: StructureEventSourceInput;
    title: string;
    workId: EntityId<"Work">;
  }>) => createSelectedEventThroughPort({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const createAnchorlessEvent = useCallback((event: Readonly<{
    note: string;
    title: string;
    workId: EntityId<"Work">;
  }>) => createAnchorlessEventRecord({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const moveEvent = useCallback((event: Readonly<{
    eventBlock: EventBlockProjection;
    target: StructureEventMoveTarget;
  }>) => moveEventBlockRecord({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const linkEventSource = useCallback((event: Readonly<{
    document: ManuscriptDocumentSource;
    eventBlock: EventBlockProjection;
    manuscript: StructureEventManuscriptPort;
    source: StructureEventSourceInput;
  }>) => linkEventSourceThroughPort({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const replaceEventSource = useCallback((event: Readonly<{
    document: ManuscriptDocumentSource;
    eventSource: EventSourceProjection;
    manuscript: StructureEventManuscriptPort;
    source: StructureEventSourceInput;
  }>) => replaceEventSourceThroughPort({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const retireEventSource = useCallback((event: Readonly<{
    eventSource: EventSourceProjection;
  }>) => retireEventSourceRecord({
    client: input.structureClient,
    refreshEventProjection,
    ...event,
  }), [input.structureClient, refreshEventProjection]);

  const eventMutations = useMemo(() => Object.freeze({
    createSelected: createSelectedEvent,
    createAnchorless: createAnchorlessEvent,
    move: moveEvent,
    linkSource: linkEventSource,
    replaceSource: replaceEventSource,
    retireSource: retireEventSource,
  }), [
    createAnchorlessEvent,
    createSelectedEvent,
    linkEventSource,
    moveEvent,
    replaceEventSource,
    retireEventSource,
  ]);

  const replaceSceneProjection = useCallback(
    (projection: SceneProjectionList) => {
      setProjectionState((current) =>
        replaceSceneProjectionState(current, projection)
      );
    },
    [],
  );

  const upsertSceneExtractionCandidate = useCallback(
    (candidate: SceneExtractionCandidate) => {
      setProjectionState((current) =>
        upsertSceneExtractionCandidateState(current, candidate)
      );
    },
    [],
  );

  const replaceSceneAnnotations = useCallback(
    (annotations: readonly SceneAnnotationProjection[]) => {
      setProjectionState((current) =>
        replaceSceneAnnotationsState(current, annotations)
      );
    },
    [],
  );

  const upsertSceneDraftCandidate = useCallback(
    (candidate: SceneDraftCandidate) => {
      setProjectionState((current) =>
        upsertSceneDraftCandidateState(current, candidate)
      );
    },
    [],
  );

  const upsertPlot = useCallback((plot: PlotThreadProjection) => {
    setProjectionState((current) => upsertPlotState(current, plot));
  }, []);

  const updatePlotAndLinkTitles = useCallback((plot: PlotThreadProjection) => {
    setProjectionState((current) =>
      updatePlotAndLinkTitlesState(current, plot)
    );
  }, []);

  const retirePlot = useCallback((retired: PlotThreadProjection) => {
    const remaining = Object.freeze(projectionState.plots.filter(
      (plot) =>
        plot.workId === retired.workId &&
        plot.plotThreadId !== retired.plotThreadId,
    ));
    setProjectionState((current) =>
      retirePlotState(current, retired, remaining)
    );
    return remaining;
  }, [projectionState.plots]);

  const replacePlotSource = useCallback((source: PlotThreadSourceProjection) => {
    setProjectionState((current) => replacePlotSourceState(current, source));
  }, []);

  const replacePlotBoard = useCallback((board: PlotBoardProjection) => {
    setProjectionState((current) => replacePlotBoardState(current, board));
  }, []);

  const applyPlotEventLinkMutation = useCallback(
    (mutation: PlotEventLinkMutationProjection) => {
      setProjectionState((current) =>
        applyPlotEventLinkMutationState(current, mutation)
      );
    },
    [],
  );

  const plotMutationReconcile = useMemo(() => Object.freeze({
    upsertPlot,
    updatePlotAndLinkTitles,
    retirePlot,
  }), [retirePlot, updatePlotAndLinkTitles, upsertPlot]);

  const plotSourceMutationReconcile = useMemo(() => Object.freeze({
    replacePlotSource,
  }), [replacePlotSource]);

  const plotBoardMutationReconcile = useMemo(() => Object.freeze({
    replacePlotBoard,
  }), [replacePlotBoard]);

  const plotEventMutationReconcile = useMemo(() => Object.freeze({
    applyPlotEventLinkMutation,
  }), [applyPlotEventLinkMutation]);

  const createPlotThread = useCallback((mutation: Readonly<{
    draft: PlotThreadDraftInput;
    refresh: PlotMutationRefreshPort;
    workId: EntityId<"Work">;
  }>) => createPlotThreadThroughPorts({
    client: input.plotsClient,
    reconcile: plotMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotMutationReconcile]);

  const updatePlotThread = useCallback((mutation: Readonly<{
    changes: UpdatePlotThreadCommand["changes"];
    plot: PlotThreadProjection;
    refresh: PlotMutationRefreshPort;
  }>) => updatePlotThreadThroughPorts({
    client: input.plotsClient,
    reconcile: plotMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotMutationReconcile]);

  const retirePlotThread = useCallback((mutation: Readonly<{
    plot: PlotThreadProjection;
    refresh: PlotMutationRefreshPort;
  }>) => retirePlotThreadThroughPorts({
    client: input.plotsClient,
    reconcile: plotMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotMutationReconcile]);

  const linkPlotThreadSource = useCallback((mutation: Readonly<{
    document: ManuscriptDocumentSource;
    manuscript: StructurePlotSourceManuscriptPort;
    plot: PlotThreadProjection;
    source: StructurePlotSourceInput;
  }>) => linkPlotThreadSourceThroughPort({
    client: input.plotsClient,
    reconcile: plotSourceMutationReconcile,
    sources: projectionState.plotSources,
    ...mutation,
  }), [
    input.plotsClient,
    plotSourceMutationReconcile,
    projectionState.plotSources,
  ]);

  const movePlotPlacement = useCallback((mutation: Readonly<{
    board: PlotBoardProjection;
    placement: PlotPlacementProjection;
    refresh: PlotMutationRefreshPort;
    selection: PlotMutationSelectionPort;
    target: StructurePlotPlacementMoveTarget;
  }>) => movePlotPlacementThroughPorts({
    client: input.plotsClient,
    reconcile: plotBoardMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotBoardMutationReconcile]);

  const setPlotPlacementStoryTime = useCallback((mutation: Readonly<{
    board: PlotBoardProjection;
    placement: PlotPlacementProjection;
    refresh: PlotMutationRefreshPort;
    selection: PlotMutationSelectionPort;
    target: StructurePlotStoryTimeTarget;
  }>) => setPlotPlacementStoryTimeThroughPorts({
    client: input.plotsClient,
    reconcile: plotBoardMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotBoardMutationReconcile]);

  const createSelectedEventFromPlot = useCallback((mutation: Readonly<{
    document: ManuscriptDocumentSource;
    manuscript: StructureEventManuscriptPort;
    plot: PlotThreadProjection;
    refresh: PlotMutationRefreshPort;
    source: StructurePlotSelectedEventSource;
  }>) => createSelectedEventFromPlotThroughPorts({
    client: input.plotsClient,
    reconcile: plotEventMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotEventMutationReconcile]);

  const createAnchorlessEventFromPlot = useCallback((mutation: Readonly<{
    plot: PlotThreadProjection;
    refresh: PlotMutationRefreshPort;
  }>) => createAnchorlessEventFromPlotRecord({
    client: input.plotsClient,
    reconcile: plotEventMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotEventMutationReconcile]);

  const linkPlotEvent = useCallback((mutation: Readonly<{
    eventBlockId: EventBlockProjection["eventBlockId"];
    plot: PlotThreadProjection;
    refresh: PlotMutationRefreshPort;
    role: PlotEventLinkRole;
  }>) => linkPlotEventRecord({
    client: input.plotsClient,
    reconcile: plotEventMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotEventMutationReconcile]);

  const unlinkPlotEvent = useCallback((mutation: Readonly<{
    link: PlotEventLinkProjection;
    refresh: PlotMutationRefreshPort;
  }>) => unlinkPlotEventRecord({
    client: input.plotsClient,
    reconcile: plotEventMutationReconcile,
    ...mutation,
  }), [input.plotsClient, plotEventMutationReconcile]);

  const createPlotFromEvent = useCallback((mutation: Readonly<{
    eventBlock: EventBlockProjection;
    selection: PlotMutationSelectionPort;
    tab: PlotFromEventTabPort;
  }>) => createPlotFromEventThroughPorts({
    boardReconcile: plotBoardMutationReconcile,
    client: input.plotsClient,
    mutationReconcile: plotEventMutationReconcile,
    refreshEventProjection,
    ...mutation,
  }), [
    input.plotsClient,
    plotBoardMutationReconcile,
    plotEventMutationReconcile,
    refreshEventProjection,
  ]);

  const plotMutations = useMemo(() => Object.freeze({
    create: createPlotThread,
    update: updatePlotThread,
    retire: retirePlotThread,
    linkSource: linkPlotThreadSource,
    movePlacement: movePlotPlacement,
    setStoryTime: setPlotPlacementStoryTime,
    createSelectedEvent: createSelectedEventFromPlot,
    createAnchorlessEvent: createAnchorlessEventFromPlot,
    linkEvent: linkPlotEvent,
    unlinkEvent: unlinkPlotEvent,
    createFromEvent: createPlotFromEvent,
  }), [
    createAnchorlessEventFromPlot,
    createPlotThread,
    createPlotFromEvent,
    createSelectedEventFromPlot,
    linkPlotThreadSource,
    linkPlotEvent,
    movePlotPlacement,
    retirePlotThread,
    setPlotPlacementStoryTime,
    unlinkPlotEvent,
    updatePlotThread,
  ]);

  const reconcile = useMemo(() => Object.freeze({
    replaceSceneProjection,
    upsertSceneExtractionCandidate,
    replaceSceneAnnotations,
    upsertSceneDraftCandidate,
  }), [
    replaceSceneAnnotations,
    replaceSceneProjection,
    upsertSceneDraftCandidate,
    upsertSceneExtractionCandidate,
  ]);

  return {
    ...projectionState,
    refreshSceneProjection,
    refreshEventProjection,
    eventMutations,
    plotMutations,
    reconcile,
  };
}

export type {
  SceneMusicQueueProjectionPort,
  StructureProjectionLifecyclePort,
} from "./structure-client";
