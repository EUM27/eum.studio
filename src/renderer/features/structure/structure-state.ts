import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../../application/structure/event-block-contract";
import type { EventRailProjection } from "../../../application/structure/event-rail-projection";
import type {
  SceneProjectionList,
} from "../../../application/structure/scene-projection";
import type { SceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import type { PlotBoardProjection } from "../../../application/plots/plot-board-contract";
import type {
  PlotEventLinkMutationProjection,
  PlotEventLinkProjection,
} from "../../../application/plots/plot-event-link-contract";
import type { PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";

export type StructureProjectionState = Readonly<{
  eventBlocks: readonly EventBlockProjection[];
  eventSources: readonly EventSourceProjection[];
  eventRail: EventRailProjection | null;
  plots: readonly PlotThreadProjection[];
  plotBoard: PlotBoardProjection | null;
  plotSources: readonly PlotThreadSourceProjection[];
  plotEventLinks: readonly PlotEventLinkProjection[];
  sceneProjection: SceneProjectionList | null;
  sceneExtractionCandidates: readonly SceneExtractionCandidate[];
  sceneAnnotations: readonly SceneAnnotationProjection[];
  sceneDraftCandidates: readonly SceneDraftCandidate[];
}>;

export const INITIAL_STRUCTURE_PROJECTION_STATE: StructureProjectionState =
  Object.freeze({
    eventBlocks: Object.freeze([]),
    eventSources: Object.freeze([]),
    eventRail: null,
    plots: Object.freeze([]),
    plotBoard: null,
    plotSources: Object.freeze([]),
    plotEventLinks: Object.freeze([]),
    sceneProjection: null,
    sceneExtractionCandidates: Object.freeze([]),
    sceneAnnotations: Object.freeze([]),
    sceneDraftCandidates: Object.freeze([]),
  });

export function resetEventLane(
  current: StructureProjectionState,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    eventBlocks: Object.freeze([]),
    eventSources: Object.freeze([]),
    eventRail: null,
  });
}

export function loadEventLane(
  current: StructureProjectionState,
  projection: EventRailProjection,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    eventBlocks: projection.eventBlocks,
    eventSources: projection.eventSources,
    eventRail: projection,
    plotBoard: projection.board,
    plotEventLinks: projection.plotEventLinks,
  });
}

export const failEventLane = resetEventLane;

export function resetSceneLane(
  current: StructureProjectionState,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    sceneProjection: null,
    sceneExtractionCandidates: Object.freeze([]),
    sceneAnnotations: Object.freeze([]),
    sceneDraftCandidates: Object.freeze([]),
  });
}

export function loadSceneLane(
  current: StructureProjectionState,
  projection: Readonly<{
    sceneProjection: SceneProjectionList;
    extractionCandidates: readonly SceneExtractionCandidate[];
    annotations: readonly SceneAnnotationProjection[];
    draftCandidates: readonly SceneDraftCandidate[];
  }>,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    sceneProjection: projection.sceneProjection,
    sceneExtractionCandidates: projection.extractionCandidates,
    sceneAnnotations: projection.annotations,
    sceneDraftCandidates: projection.draftCandidates,
  });
}

export const failSceneLane = resetSceneLane;

export function resetPlotLane(
  current: StructureProjectionState,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: Object.freeze([]),
    plotBoard: null,
    plotSources: Object.freeze([]),
    plotEventLinks: Object.freeze([]),
  });
}

export function loadPlotLane(
  current: StructureProjectionState,
  projection: Readonly<{
    plots: readonly PlotThreadProjection[];
    board: PlotBoardProjection;
    sources: readonly PlotThreadSourceProjection[];
    links: readonly PlotEventLinkProjection[];
  }>,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: projection.plots,
    plotBoard: projection.board,
    plotSources: projection.sources,
    plotEventLinks: projection.links,
  });
}

export const failPlotLane = resetPlotLane;

export function replaceSceneProjectionState(
  current: StructureProjectionState,
  projection: SceneProjectionList,
): StructureProjectionState {
  return Object.freeze({ ...current, sceneProjection: projection });
}

export function upsertSceneExtractionCandidateState(
  current: StructureProjectionState,
  candidate: SceneExtractionCandidate,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    sceneExtractionCandidates: Object.freeze([
      candidate,
      ...current.sceneExtractionCandidates.filter(
        (entry) => entry.candidateId !== candidate.candidateId,
      ),
    ]),
  });
}

export function replaceSceneAnnotationsState(
  current: StructureProjectionState,
  annotations: readonly SceneAnnotationProjection[],
): StructureProjectionState {
  return Object.freeze({ ...current, sceneAnnotations: annotations });
}

export function upsertSceneDraftCandidateState(
  current: StructureProjectionState,
  candidate: SceneDraftCandidate,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    sceneDraftCandidates: Object.freeze([
      candidate,
      ...current.sceneDraftCandidates.filter(
        (entry) => entry.candidateId !== candidate.candidateId,
      ),
    ]),
  });
}

export function upsertPlotState(
  current: StructureProjectionState,
  plot: PlotThreadProjection,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: Object.freeze([
      plot,
      ...current.plots.filter(
        (entry) =>
          entry.workId === plot.workId &&
          entry.plotThreadId !== plot.plotThreadId,
      ),
    ]),
  });
}

export function updatePlotAndLinkTitlesState(
  current: StructureProjectionState,
  plot: PlotThreadProjection,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: Object.freeze(
      current.plots
        .filter((entry) => entry.workId === plot.workId)
        .map((entry) =>
          entry.plotThreadId === plot.plotThreadId ? plot : entry
        ),
    ),
    plotEventLinks: Object.freeze(
      current.plotEventLinks.map((link) =>
        link.workId === plot.workId &&
          link.plotBeatId === plot.plotThreadId
          ? {
              ...link,
              plotTitle: plot.title,
              titleMatch: plot.title === link.eventTitle
                ? ("matched" as const)
                : ("mismatched" as const),
            }
          : link
      ),
    ),
  });
}

export function retirePlotState(
  current: StructureProjectionState,
  retired: PlotThreadProjection,
  remaining: readonly PlotThreadProjection[],
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: remaining,
    plotSources: Object.freeze(
      current.plotSources.filter(
        (source) => source.plotThreadId !== retired.plotThreadId,
      ),
    ),
    plotEventLinks: Object.freeze(
      current.plotEventLinks.map((link) =>
        link.workId === retired.workId &&
          link.plotBeatId === retired.plotThreadId
          ? { ...link, plotRetiredAt: retired.retiredAt }
          : link
      ),
    ),
  });
}

export function replacePlotBoardState(
  current: StructureProjectionState,
  board: PlotBoardProjection,
): StructureProjectionState {
  return Object.freeze({ ...current, plotBoard: board });
}

export function replacePlotSourceState(
  current: StructureProjectionState,
  source: PlotThreadSourceProjection,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plotSources: Object.freeze([
      ...current.plotSources.filter(
        (entry) =>
          entry.workId !== source.workId ||
          entry.plotThreadId !== source.plotThreadId,
      ),
      source,
    ]),
  });
}

export function applyPlotEventLinkMutationState(
  current: StructureProjectionState,
  mutation: PlotEventLinkMutationProjection,
): StructureProjectionState {
  return Object.freeze({
    ...current,
    plots: Object.freeze([
      mutation.plotBeat,
      ...current.plots.filter(
        (plot) => plot.plotThreadId !== mutation.plotBeat.plotThreadId,
      ),
    ]),
    eventBlocks: Object.freeze([
      mutation.eventBlock,
      ...current.eventBlocks.filter(
        (eventBlock) =>
          eventBlock.eventBlockId !== mutation.eventBlock.eventBlockId,
      ),
    ]),
    eventSources: Object.freeze([
      ...mutation.eventSources,
      ...current.eventSources.filter(
        (source) => source.eventBlockId !== mutation.eventBlock.eventBlockId,
      ),
    ]),
    plotEventLinks: Object.freeze(
      mutation.link.retiredAt === null
        ? [
            mutation.link,
            ...current.plotEventLinks.filter(
              (link) =>
                link.plotEventLinkId !== mutation.link.plotEventLinkId,
            ),
          ]
        : current.plotEventLinks.filter(
            (link) => link.plotEventLinkId !== mutation.link.plotEventLinkId,
          ),
    ),
  });
}
