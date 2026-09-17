import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { SceneMusicQueueCandidate } from "../../../application/music/scene-music-queue-contract";
import type {
  MovePlotPlacementCommand,
  PlotBoardProjection,
  PlotPlacementProjection,
  SetPlotPlacementStoryTimeCommand,
} from "../../../application/plots/plot-board-contract";
import type {
  CreateEventFromPlotSource,
  PlotEventLinkMutationProjection,
  PlotEventLinkProjection,
  PlotEventLinkRole,
} from "../../../application/plots/plot-event-link-contract";
import type {
  CreatePlotThreadCommand,
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../../../application/plots/plot-contract";
import type {
  LinkPlotThreadSourceCommand,
  PlotThreadSourceProjection,
} from "../../../application/plots/plot-source-contract";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type { SceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type {
  CreateEventBlockCommand,
  EventBlockProjection,
  EventSourceProjection,
  MoveEventBlockCommand,
} from "../../../application/structure/event-block-contract";
import type { EventRailProjection } from "../../../application/structure/event-rail-projection";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import type { EntityId } from "../../../domain/writing";

export type StructureProjectionClient = Pick<
  StudioBridge["structure"],
  | "listEventRail"
  | "listSceneProjection"
  | "listSceneExtractionCandidates"
  | "listSceneAnnotations"
  | "listSceneDraftCandidates"
>;

export type StructureEventMutationClient = Pick<
  StudioBridge["structure"],
  | "createEventBlock"
  | "createAnchorlessEvent"
  | "moveEventBlock"
  | "linkEventSource"
  | "replaceEventSource"
  | "retireEventSource"
>;

export type StructureControllerClient =
  & StructureProjectionClient
  & StructureEventMutationClient;

export type StructureEventSourceInput = Pick<
  CreateEventBlockCommand,
  "documentId" | "selection" | "exactQuote"
>;

export type StructureEventMoveTarget = Pick<
  MoveEventBlockCommand,
  "beforeEventBlockId" | "afterEventBlockId"
>;

export type StructureEventManuscriptPort = Readonly<{
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
}>;

export function createStructureEventManuscriptPort(
  persistDocument: StructureEventManuscriptPort["persistDocument"],
): StructureEventManuscriptPort {
  return Object.freeze({ persistDocument });
}

export type PlotProjectionClient = Pick<
  StudioBridge["plots"],
  "list" | "getDefaultBoard" | "listSources" | "listEventLinks"
>;

export type PlotThreadMutationClient = Pick<
  StudioBridge["plots"],
  "create" | "update" | "retire"
>;

export type PlotSourceMutationClient = Pick<
  StudioBridge["plots"],
  "linkSource"
>;

export type PlotBoardMutationClient = Pick<
  StudioBridge["plots"],
  "movePlacement" | "setStoryTime"
>;

export type PlotEventMutationClient = Pick<
  StudioBridge["plots"],
  "createFromEvent" | "createEvent" | "linkEvent" | "unlinkEvent"
>;

export type PlotControllerClient =
  & PlotProjectionClient
  & PlotThreadMutationClient
  & PlotSourceMutationClient
  & PlotBoardMutationClient
  & PlotEventMutationClient;

export type PlotThreadDraftInput = Pick<
  CreatePlotThreadCommand,
  "title" | "stage" | "summary" | "note"
>;

export type StructurePlotSourceInput = Pick<
  LinkPlotThreadSourceCommand,
  "documentId" | "selection" | "exactText"
>;

export type StructurePlotPlacementMoveTarget = Pick<
  MovePlotPlacementCommand,
  "targetLaneId" | "beforePlacementId" | "afterPlacementId"
>;

export type StructurePlotStoryTimeTarget = Pick<
  SetPlotPlacementStoryTimeCommand,
  "storyTime" | "storyTimeEnd"
>;

export type StructurePlotSelectedEventSource = Extract<
  CreateEventFromPlotSource,
  { readonly kind: "exact-selection" }
>;

export type StructurePlotSourceManuscriptPort = Readonly<{
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
}>;

export function createStructurePlotSourceManuscriptPort(
  persistDocument: StructurePlotSourceManuscriptPort["persistDocument"],
): StructurePlotSourceManuscriptPort {
  return Object.freeze({ persistDocument });
}

export type PlotMutationRefreshPort = Readonly<{
  refreshAfterPlotChange: (workId: EntityId<"Work">) => Promise<void>;
}>;

export function createPlotMutationRefreshPort(
  refreshAfterPlotChange: PlotMutationRefreshPort["refreshAfterPlotChange"],
): PlotMutationRefreshPort {
  return Object.freeze({ refreshAfterPlotChange });
}

export type PlotMutationSelectionPort = Readonly<{
  selectPlot: (plotThreadId: EntityId<"PlotThread">) => void;
}>;

export function createPlotMutationSelectionPort(
  selectPlot: PlotMutationSelectionPort["selectPlot"],
): PlotMutationSelectionPort {
  return Object.freeze({ selectPlot });
}

export type PlotFromEventTabPort = Readonly<{
  openPlotsTab: () => void;
}>;

export function createPlotFromEventTabPort(
  openPlotsTab: PlotFromEventTabPort["openPlotsTab"],
): PlotFromEventTabPort {
  return Object.freeze({ openPlotsTab });
}

export type PlotMutationReconcilePort = Readonly<{
  upsertPlot: (plot: PlotThreadProjection) => void;
  updatePlotAndLinkTitles: (plot: PlotThreadProjection) => void;
  retirePlot: (
    plot: PlotThreadProjection,
  ) => readonly PlotThreadProjection[];
}>;

export type PlotSourceMutationReconcilePort = Readonly<{
  replacePlotSource: (source: PlotThreadSourceProjection) => void;
}>;

export type PlotBoardMutationReconcilePort = Readonly<{
  replacePlotBoard: (board: PlotBoardProjection) => void;
}>;

export type PlotEventMutationReconcilePort = Readonly<{
  applyPlotEventLinkMutation: (
    mutation: PlotEventLinkMutationProjection,
  ) => void;
}>;

export type SceneMusicQueueProjectionPort = Readonly<{
  list: (
    workId: EntityId<"Work">,
  ) => Promise<readonly SceneMusicQueueCandidate[]>;
  replace: (candidates: readonly SceneMusicQueueCandidate[]) => void;
  clear: () => void;
}>;

export type StructureProjectionLifecyclePort = Readonly<{
  eventLoaded: () => void;
  eventLoadFailed: () => void;
  sceneReset: () => void;
  sceneLoaded: () => void;
  sceneLoadFailed: () => void;
  plotReset: () => void;
  plotLoaded: (plots: readonly PlotThreadProjection[]) => void;
  plotLoadFailed: () => void;
}>;

export type StructureTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: StructureTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export type SceneProjectionBundle = Readonly<{
  sceneProjection: SceneProjectionList;
  extractionCandidates: readonly SceneExtractionCandidate[];
  annotations: readonly SceneAnnotationProjection[];
  draftCandidates: readonly SceneDraftCandidate[];
  musicQueueCandidates: readonly SceneMusicQueueCandidate[];
}>;

export function startEventAndSceneProjectionLanes(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: StructureProjectionClient;
  music: SceneMusicQueueProjectionPort;
  onEventFailed: () => void;
  onEventLoaded: (projection: EventRailProjection) => void;
  onEventReset: () => void;
  onSceneFailed: () => void;
  onSceneLoaded: (projection: SceneProjectionBundle) => void;
  onSceneReset: () => void;
  timer?: StructureTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(() => {
      input.onEventReset();
      input.onSceneReset();
    }, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void input.client.listEventRail({
    schemaVersion: 1,
    workId: input.activeWorkId,
  }).then(
    (projection) => {
      if (!disposed) input.onEventLoaded(projection);
    },
    () => {
      if (!disposed) input.onEventFailed();
    },
  );
  void Promise.all([
    input.client.listSceneProjection({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listSceneExtractionCandidates({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listSceneAnnotations({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listSceneDraftCandidates({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.music.list(input.activeWorkId),
  ]).then(
    ([
      sceneProjection,
      candidateProjection,
      annotationProjection,
      draftProjection,
      musicQueueCandidates,
    ]) => {
      if (!disposed) {
        input.onSceneLoaded(Object.freeze({
          sceneProjection,
          extractionCandidates: candidateProjection.candidates,
          annotations: annotationProjection.annotations,
          draftCandidates: draftProjection.candidates,
          musicQueueCandidates,
        }));
      }
    },
    () => {
      if (!disposed) input.onSceneFailed();
    },
  );
  return () => {
    disposed = true;
  };
}

export type PlotProjectionBundle = Readonly<{
  plots: readonly PlotThreadProjection[];
  board: PlotBoardProjection;
  sources: readonly PlotThreadSourceProjection[];
  links: readonly PlotEventLinkProjection[];
}>;

export function startPlotProjectionLane(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: PlotProjectionClient;
  onFailed: () => void;
  onLoaded: (projection: PlotProjectionBundle) => void;
  onReset: () => void;
  timer?: StructureTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(input.onReset, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void Promise.all([
    input.client.list({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.getDefaultBoard({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listSources({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
    input.client.listEventLinks({
      schemaVersion: 1,
      workId: input.activeWorkId,
    }),
  ]).then(
    ([plotProjection, board, sourceProjection, linkProjection]) => {
      if (!disposed) {
        input.onLoaded(Object.freeze({
          plots: plotProjection.plots,
          board,
          sources: sourceProjection.sources,
          links: linkProjection.links,
        }));
      }
    },
    () => {
      if (!disposed) input.onFailed();
    },
  );
  return () => {
    disposed = true;
  };
}

export function readSceneProjection(
  client: StructureProjectionClient,
  workId: EntityId<"Work">,
): Promise<SceneProjectionList> {
  return client.listSceneProjection({ schemaVersion: 1, workId });
}

export async function readEventProjectionWithSceneRefresh(input: Readonly<{
  client: StructureProjectionClient;
  refreshSceneProjection: (
    workId: EntityId<"Work">,
  ) => Promise<SceneProjectionList>;
  workId: EntityId<"Work">;
}>): Promise<EventRailProjection> {
  const [projection] = await Promise.all([
    input.client.listEventRail({
      schemaVersion: 1,
      workId: input.workId,
    }),
    input.refreshSceneProjection(input.workId),
  ]);
  return projection;
}

type RefreshEventProjection = (
  workId: EntityId<"Work">,
) => Promise<EventRailProjection>;

export async function createSelectedEventThroughPort(input: Readonly<{
  client: StructureEventMutationClient;
  document: ManuscriptDocumentSource;
  manuscript: StructureEventManuscriptPort;
  note: string;
  refreshEventProjection: RefreshEventProjection;
  source: StructureEventSourceInput;
  title: string;
  workId: EntityId<"Work">;
}>): Promise<void> {
  await input.manuscript.persistDocument(input.document);
  await input.client.createEventBlock({
    schemaVersion: 1,
    workId: input.workId,
    documentId: input.source.documentId,
    selection: input.source.selection,
    exactQuote: input.source.exactQuote,
    title: input.title,
    note: input.note,
  });
  await input.refreshEventProjection(input.workId);
}

export async function createAnchorlessEventRecord(input: Readonly<{
  client: StructureEventMutationClient;
  note: string;
  refreshEventProjection: RefreshEventProjection;
  title: string;
  workId: EntityId<"Work">;
}>): Promise<void> {
  await input.client.createAnchorlessEvent({
    schemaVersion: 1,
    workId: input.workId,
    title: input.title,
    note: input.note,
  });
  await input.refreshEventProjection(input.workId);
}

export async function moveEventBlockRecord(input: Readonly<{
  client: StructureEventMutationClient;
  eventBlock: EventBlockProjection;
  refreshEventProjection: RefreshEventProjection;
  target: StructureEventMoveTarget;
}>): Promise<void> {
  await input.client.moveEventBlock({
    schemaVersion: 1,
    workId: input.eventBlock.workId,
    eventBlockId: input.eventBlock.eventBlockId,
    expectedRevision: input.eventBlock.revision,
    ...input.target,
  });
  await input.refreshEventProjection(input.eventBlock.workId);
}

export async function linkEventSourceThroughPort(input: Readonly<{
  client: StructureEventMutationClient;
  document: ManuscriptDocumentSource;
  eventBlock: EventBlockProjection;
  manuscript: StructureEventManuscriptPort;
  refreshEventProjection: RefreshEventProjection;
  source: StructureEventSourceInput;
}>): Promise<void> {
  await input.manuscript.persistDocument(input.document);
  await input.client.linkEventSource({
    schemaVersion: 1,
    workId: input.eventBlock.workId,
    eventBlockId: input.eventBlock.eventBlockId,
    role: "primary",
    documentId: input.source.documentId,
    selection: input.source.selection,
    exactQuote: input.source.exactQuote,
  });
  await input.refreshEventProjection(input.eventBlock.workId);
}

export async function replaceEventSourceThroughPort(input: Readonly<{
  client: StructureEventMutationClient;
  document: ManuscriptDocumentSource;
  eventSource: EventSourceProjection;
  manuscript: StructureEventManuscriptPort;
  refreshEventProjection: RefreshEventProjection;
  source: StructureEventSourceInput;
}>): Promise<void> {
  await input.manuscript.persistDocument(input.document);
  await input.client.replaceEventSource({
    schemaVersion: 1,
    workId: input.eventSource.workId,
    eventSourceId: input.eventSource.eventSourceId,
    expectedRevision: input.eventSource.revision,
    documentId: input.source.documentId,
    selection: input.source.selection,
    exactQuote: input.source.exactQuote,
  });
  await input.refreshEventProjection(input.eventSource.workId);
}

export async function retireEventSourceRecord(input: Readonly<{
  client: StructureEventMutationClient;
  eventSource: EventSourceProjection;
  refreshEventProjection: RefreshEventProjection;
}>): Promise<void> {
  await input.client.retireEventSource({
    schemaVersion: 1,
    workId: input.eventSource.workId,
    eventSourceId: input.eventSource.eventSourceId,
    expectedRevision: input.eventSource.revision,
  });
  await input.refreshEventProjection(input.eventSource.workId);
}

export async function createPlotThreadThroughPorts(input: Readonly<{
  client: PlotThreadMutationClient;
  draft: PlotThreadDraftInput;
  reconcile: PlotMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
  workId: EntityId<"Work">;
}>): Promise<PlotThreadProjection> {
  const created = await input.client.create({
    schemaVersion: 1,
    workId: input.workId,
    ...input.draft,
  });
  input.reconcile.upsertPlot(created);
  await input.refresh.refreshAfterPlotChange(input.workId);
  return created;
}

export async function updatePlotThreadThroughPorts(input: Readonly<{
  changes: UpdatePlotThreadCommand["changes"];
  client: PlotThreadMutationClient;
  plot: PlotThreadProjection;
  reconcile: PlotMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
}>): Promise<PlotThreadProjection> {
  const updated = await input.client.update({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotThreadId: input.plot.plotThreadId,
    expectedRevision: input.plot.revision,
    changes: input.changes,
  });
  input.reconcile.updatePlotAndLinkTitles(updated);
  await input.refresh.refreshAfterPlotChange(input.plot.workId);
  return updated;
}

export async function retirePlotThreadThroughPorts(input: Readonly<{
  client: PlotThreadMutationClient;
  plot: PlotThreadProjection;
  reconcile: PlotMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
}>): Promise<Readonly<{
  retired: PlotThreadProjection;
  remaining: readonly PlotThreadProjection[];
}>> {
  const retired = await input.client.retire({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotThreadId: input.plot.plotThreadId,
    expectedRevision: input.plot.revision,
  });
  const remaining = input.reconcile.retirePlot(retired);
  await input.refresh.refreshAfterPlotChange(input.plot.workId);
  return Object.freeze({ retired, remaining });
}

export async function createPlotFromEventThroughPorts(input: Readonly<{
  boardReconcile: PlotBoardMutationReconcilePort;
  client: PlotEventMutationClient & Pick<
    PlotProjectionClient,
    "getDefaultBoard"
  >;
  eventBlock: EventBlockProjection;
  mutationReconcile: PlotEventMutationReconcilePort;
  refreshEventProjection: RefreshEventProjection;
  selection: PlotMutationSelectionPort;
  tab: PlotFromEventTabPort;
}>): Promise<PlotEventLinkMutationProjection> {
  const mutation = await input.client.createFromEvent({
    schemaVersion: 1,
    workId: input.eventBlock.workId,
    eventBlockId: input.eventBlock.eventBlockId,
  });
  input.mutationReconcile.applyPlotEventLinkMutation(mutation);
  const [board] = await Promise.all([
    input.client.getDefaultBoard({
      schemaVersion: 1,
      workId: input.eventBlock.workId,
    }),
    input.refreshEventProjection(input.eventBlock.workId),
  ]);
  input.boardReconcile.replacePlotBoard(board);
  input.selection.selectPlot(mutation.plotBeat.plotThreadId);
  input.tab.openPlotsTab();
  return mutation;
}

export async function createSelectedEventFromPlotThroughPorts(input: Readonly<{
  client: PlotEventMutationClient;
  document: ManuscriptDocumentSource;
  manuscript: StructureEventManuscriptPort;
  plot: PlotThreadProjection;
  reconcile: PlotEventMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
  source: StructurePlotSelectedEventSource;
}>): Promise<PlotEventLinkMutationProjection> {
  await input.manuscript.persistDocument(input.document);
  const mutation = await input.client.createEvent({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotBeatId: input.plot.plotThreadId,
    source: input.source,
  });
  input.reconcile.applyPlotEventLinkMutation(mutation);
  await input.refresh.refreshAfterPlotChange(input.plot.workId);
  return mutation;
}

export async function createAnchorlessEventFromPlotRecord(input: Readonly<{
  client: PlotEventMutationClient;
  plot: PlotThreadProjection;
  reconcile: PlotEventMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
}>): Promise<PlotEventLinkMutationProjection> {
  const mutation = await input.client.createEvent({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotBeatId: input.plot.plotThreadId,
    source: { kind: "anchorless" },
  });
  input.reconcile.applyPlotEventLinkMutation(mutation);
  await input.refresh.refreshAfterPlotChange(input.plot.workId);
  return mutation;
}

export async function linkPlotEventRecord(input: Readonly<{
  client: PlotEventMutationClient;
  eventBlockId: EventBlockProjection["eventBlockId"];
  plot: PlotThreadProjection;
  reconcile: PlotEventMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
  role: PlotEventLinkRole;
}>): Promise<PlotEventLinkMutationProjection> {
  const mutation = await input.client.linkEvent({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotBeatId: input.plot.plotThreadId,
    eventBlockId: input.eventBlockId,
    role: input.role,
  });
  input.reconcile.applyPlotEventLinkMutation(mutation);
  await input.refresh.refreshAfterPlotChange(input.plot.workId);
  return mutation;
}

export async function unlinkPlotEventRecord(input: Readonly<{
  client: PlotEventMutationClient;
  link: PlotEventLinkProjection;
  reconcile: PlotEventMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
}>): Promise<PlotEventLinkMutationProjection> {
  const mutation = await input.client.unlinkEvent({
    schemaVersion: 1,
    workId: input.link.workId,
    plotEventLinkId: input.link.plotEventLinkId,
    expectedRevision: input.link.revision,
  });
  input.reconcile.applyPlotEventLinkMutation(mutation);
  await input.refresh.refreshAfterPlotChange(input.link.workId);
  return mutation;
}

export async function movePlotPlacementThroughPorts(input: Readonly<{
  board: PlotBoardProjection;
  client: PlotBoardMutationClient;
  placement: PlotPlacementProjection;
  reconcile: PlotBoardMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
  selection: PlotMutationSelectionPort;
  target: StructurePlotPlacementMoveTarget;
}>): Promise<PlotBoardProjection> {
  const authoritativeBoard = await input.client.movePlacement({
    schemaVersion: 1,
    workId: input.placement.workId,
    plotPlacementId: input.placement.plotPlacementId,
    targetBoardId: input.board.plotBoardId,
    targetLaneId: input.target.targetLaneId,
    ...(input.target.beforePlacementId === undefined
      ? {}
      : { beforePlacementId: input.target.beforePlacementId }),
    ...(input.target.afterPlacementId === undefined
      ? {}
      : { afterPlacementId: input.target.afterPlacementId }),
    expectedPlacementRevision: input.placement.revision,
    expectedBoardRevision: input.board.revision,
  });
  input.reconcile.replacePlotBoard(authoritativeBoard);
  input.selection.selectPlot(input.placement.plotBeatId);
  await input.refresh.refreshAfterPlotChange(input.placement.workId);
  return authoritativeBoard;
}

export async function setPlotPlacementStoryTimeThroughPorts(input: Readonly<{
  board: PlotBoardProjection;
  client: PlotBoardMutationClient;
  placement: PlotPlacementProjection;
  reconcile: PlotBoardMutationReconcilePort;
  refresh: PlotMutationRefreshPort;
  selection: PlotMutationSelectionPort;
  target: StructurePlotStoryTimeTarget;
}>): Promise<PlotBoardProjection> {
  const authoritativeBoard = await input.client.setStoryTime({
    schemaVersion: 1,
    workId: input.placement.workId,
    plotPlacementId: input.placement.plotPlacementId,
    plotBoardId: input.board.plotBoardId,
    storyTime: input.target.storyTime,
    storyTimeEnd: input.target.storyTimeEnd,
    expectedPlacementRevision: input.placement.revision,
    expectedBoardRevision: input.board.revision,
  });
  input.reconcile.replacePlotBoard(authoritativeBoard);
  input.selection.selectPlot(input.placement.plotBeatId);
  await input.refresh.refreshAfterPlotChange(input.placement.workId);
  return authoritativeBoard;
}

export async function linkPlotThreadSourceThroughPort(input: Readonly<{
  client: PlotSourceMutationClient;
  document: ManuscriptDocumentSource;
  manuscript: StructurePlotSourceManuscriptPort;
  plot: PlotThreadProjection;
  reconcile: PlotSourceMutationReconcilePort;
  source: StructurePlotSourceInput;
  sources: readonly PlotThreadSourceProjection[];
}>): Promise<PlotThreadSourceProjection> {
  const currentSource = input.sources.find(
    (source) =>
      source.workId === input.plot.workId &&
      source.plotThreadId === input.plot.plotThreadId,
  ) ?? null;
  await input.manuscript.persistDocument(input.document);
  const linked = await input.client.linkSource({
    schemaVersion: 1,
    workId: input.plot.workId,
    plotThreadId: input.plot.plotThreadId,
    expectedSourceId: currentSource?.sourceId ?? null,
    documentId: input.source.documentId,
    selection: input.source.selection,
    exactText: input.source.exactText,
  });
  input.reconcile.replacePlotSource(linked);
  return linked;
}
