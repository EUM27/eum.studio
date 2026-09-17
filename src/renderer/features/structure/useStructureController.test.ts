import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { SceneMusicQueueCandidate } from "../../../application/music/scene-music-queue-contract";
import type {
  MovePlotPlacementCommand,
  PlotBoardProjection,
  PlotPlacementProjection,
} from "../../../application/plots/plot-board-contract";
import type {
  PlotEventLinkMutationProjection,
  PlotEventLinkProjection,
} from "../../../application/plots/plot-event-link-contract";
import type { PlotThreadProjection } from "../../../application/plots/plot-contract";
import type { PlotThreadSourceProjection } from "../../../application/plots/plot-source-contract";
import type { SceneAnnotationProjection } from "../../../application/structure/scene-annotation-contract";
import type { SceneDraftCandidate } from "../../../application/structure/scene-draft-contract";
import type { SceneExtractionCandidate } from "../../../application/structure/scene-extraction-contract";
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../../application/structure/event-block-contract";
import type { EventRailProjection } from "../../../application/structure/event-rail-projection";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import { entityId } from "../../../domain/writing";
import {
  createAnchorlessEventRecord,
  createAnchorlessEventFromPlotRecord,
  createPlotFromEventThroughPorts,
  createPlotFromEventTabPort,
  createPlotThreadThroughPorts,
  createSelectedEventFromPlotThroughPorts,
  createSelectedEventThroughPort,
  linkPlotEventRecord,
  linkPlotThreadSourceThroughPort,
  linkEventSourceThroughPort,
  moveEventBlockRecord,
  movePlotPlacementThroughPorts,
  readEventProjectionWithSceneRefresh,
  replaceEventSourceThroughPort,
  retireEventSourceRecord,
  retirePlotThreadThroughPorts,
  unlinkPlotEventRecord,
  startEventAndSceneProjectionLanes,
  startPlotProjectionLane,
  setPlotPlacementStoryTimeThroughPorts,
  type PlotBoardMutationClient,
  type PlotBoardMutationReconcilePort,
  type PlotEventMutationClient,
  type PlotEventMutationReconcilePort,
  type PlotFromEventTabPort,
  type PlotMutationSelectionPort,
  type PlotProjectionClient,
  type PlotMutationReconcilePort,
  type PlotMutationRefreshPort,
  type PlotSourceMutationClient,
  type PlotSourceMutationReconcilePort,
  type PlotThreadMutationClient,
  type SceneMusicQueueProjectionPort,
  type StructureEventManuscriptPort,
  type StructureEventMutationClient,
  type StructurePlotSourceManuscriptPort,
  type StructureProjectionClient,
  updatePlotThreadThroughPorts,
} from "./structure-client";
import {
  applyPlotEventLinkMutationState,
  failEventLane,
  failPlotLane,
  INITIAL_STRUCTURE_PROJECTION_STATE,
  loadEventLane,
  loadPlotLane,
  replacePlotBoardState,
  replacePlotSourceState,
  replaceSceneAnnotationsState,
  replaceSceneProjectionState,
  retirePlotState,
  updatePlotAndLinkTitlesState,
  upsertPlotState,
  upsertSceneDraftCandidateState,
  upsertSceneExtractionCandidateState,
  type StructureProjectionState,
} from "./structure-state";

const workId = entityId<"Work">("work-structure");
const document: ManuscriptDocumentSource = Object.freeze({
  workId,
  documentId: entityId<"Document">("document-event"),
  documentRevisionId: entityId<"DocumentRevision">("revision-event"),
  label: "사건 회차",
  initialText: "사건 원문",
});

function eventBlock(suffix: string): EventBlockProjection {
  return Object.freeze({
    schemaVersion: 1,
    eventBlockId: entityId<"EventBlock">(`event-${suffix}`),
    revision: 7,
    workId,
    title: `사건 ${suffix}`,
    note: "메모",
    parentEventId: null,
    outlineOrderKey: `order-${suffix}`,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
  });
}

function eventSource(suffix: string): EventSourceProjection {
  return Object.freeze({
    schemaVersion: 1,
    eventSourceId: entityId<"EventSource">(`event-source-${suffix}`),
    revision: 5,
    workId,
    eventBlockId: entityId<"EventBlock">(`event-${suffix}`),
    rangeGroupId: entityId<"RangeGroup">(`range-group-${suffix}`),
    role: "primary",
    anchors: Object.freeze([]),
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
  });
}

function board(
  suffix: string,
  overrides: Partial<PlotBoardProjection> = {},
): PlotBoardProjection {
  return Object.freeze({
    schemaVersion: 1,
    plotBoardId: entityId<"PlotBoard">(`board-${suffix}`),
    revision: 1,
    workId,
    title: `보드 ${suffix}`,
    mode: "sequence",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    lanes: Object.freeze([]),
    ...overrides,
  });
}

function plot(
  suffix: string,
  overrides: Partial<PlotThreadProjection> = {},
): PlotThreadProjection {
  return Object.freeze({
    schemaVersion: 1,
    plotThreadId: entityId<"PlotThread">(`plot-${suffix}`),
    revision: 2,
    workId,
    title: `플롯 ${suffix}`,
    stage: "단계",
    summary: "요약",
    note: "메모",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    ...overrides,
  });
}

function placement(
  suffix: string,
  overrides: Partial<PlotPlacementProjection> = {},
): PlotPlacementProjection {
  const plotBeat = plot(suffix);
  return Object.freeze({
    schemaVersion: 1,
    plotPlacementId: entityId<"PlotPlacement">(`placement-${suffix}`),
    revision: 5,
    workId,
    plotBoardId: entityId<"PlotBoard">(`board-${suffix}`),
    plotLaneId: entityId<"PlotLane">(`lane-${suffix}`),
    plotBeatId: plotBeat.plotThreadId,
    orderKey: `order-${suffix}`,
    storyTime: null,
    storyTimeEnd: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    plotBeat,
    ...overrides,
  });
}

function link(
  suffix: string,
  overrides: Partial<PlotEventLinkProjection> = {},
): PlotEventLinkProjection {
  return Object.freeze({
    schemaVersion: 1,
    plotEventLinkId: entityId<"PlotEventLink">(`link-${suffix}`),
    revision: 3,
    workId,
    plotBeatId: entityId<"PlotThread">(`plot-${suffix}`),
    eventBlockId: entityId<"EventBlock">(`event-${suffix}`),
    role: "primary",
    createdFrom: "manual-link",
    plotTitle: `플롯 ${suffix}`,
    eventTitle: `사건 ${suffix}`,
    titleMatch: "mismatched",
    plotRetiredAt: null,
    eventRetiredAt: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    retiredAt: null,
    ...overrides,
  });
}

function plotEventMutation(
  suffix: string,
  status: PlotEventLinkMutationProjection["status"] = "created",
): PlotEventLinkMutationProjection {
  const currentEvent = eventBlock(suffix);
  return Object.freeze({
    schemaVersion: 1,
    status,
    plotBeat: plot(suffix),
    eventBlock: currentEvent,
    eventSources: Object.freeze([eventSource(suffix)]),
    link: link(suffix),
  });
}

function source(
  suffix: string,
  overrides: Partial<PlotThreadSourceProjection> = {},
): PlotThreadSourceProjection {
  return Object.freeze({
    schemaVersion: 1,
    sourceId: entityId<"PlotThreadSource">(`source-${suffix}`),
    revision: 1,
    workId,
    plotThreadId: entityId<"PlotThread">(`plot-${suffix}`),
    sourceDocumentId: entityId<"Document">(`document-${suffix}`),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      `revision-${suffix}`,
    ),
    sourceAnchorId: entityId<"Anchor">(`anchor-${suffix}`),
    exactText: `원문 ${suffix}`,
    integrity: "resolved",
    range: Object.freeze({ from: 1, to: 4 }),
    createdAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  });
}

function eventRail(suffix: string): EventRailProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId,
    documents: Object.freeze([]),
    eventBlocks: Object.freeze([
      Object.freeze({
        workId,
        eventBlockId: entityId<"EventBlock">(`event-${suffix}`),
        title: `사건 ${suffix}`,
      }),
    ]),
    eventSources: Object.freeze([
      Object.freeze({
        eventBlockId: entityId<"EventBlock">(`event-${suffix}`),
        sourceId: entityId<"EventSource">(`event-source-${suffix}`),
      }),
    ]),
    plotEventLinks: Object.freeze([link(suffix)]),
    board: board(`event-${suffix}`),
    manuscriptEvents: Object.freeze([]),
    unpositionedEvents: Object.freeze([]),
    plotCards: Object.freeze([]),
    unplottedEvents: Object.freeze([]),
  }) as unknown as EventRailProjection;
}

function sceneProjection(suffix: string): SceneProjectionList {
  return Object.freeze({
    schemaVersion: 1,
    workId,
    status: "clean",
    ruleSet: Object.freeze({ sceneRuleSetId: `rules-${suffix}` }),
    scenes: Object.freeze([]),
    unassignedEvents: Object.freeze([]),
    sceneEventOverrides: Object.freeze([]),
  }) as unknown as SceneProjectionList;
}

function extractionCandidate(suffix: string): SceneExtractionCandidate {
  return Object.freeze({
    candidateId: entityId<"SceneExtractionCandidate">(
      `scene-candidate-${suffix}`,
    ),
    workId,
  }) as unknown as SceneExtractionCandidate;
}

function draftCandidate(suffix: string): SceneDraftCandidate {
  return Object.freeze({
    candidateId: entityId<"SceneDraftCandidate">(`draft-${suffix}`),
    workId,
  }) as unknown as SceneDraftCandidate;
}

function annotation(suffix: string): SceneAnnotationProjection {
  return Object.freeze({
    annotationId: entityId<"SceneAnnotation">(`annotation-${suffix}`),
    workId,
  }) as unknown as SceneAnnotationProjection;
}

function musicCandidate(suffix: string): SceneMusicQueueCandidate {
  return Object.freeze({
    candidateId: entityId<"SceneMusicQueueCandidate">(`music-${suffix}`),
    workId,
  }) as unknown as SceneMusicQueueCandidate;
}

function structureClient(
  input: Partial<StructureProjectionClient> = {},
): StructureProjectionClient {
  return {
    listEventRail: vi.fn(async () => eventRail("default")),
    listSceneProjection: vi.fn(async () => sceneProjection("default")),
    listSceneExtractionCandidates: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      candidates: Object.freeze([extractionCandidate("default")]),
    })),
    listSceneAnnotations: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      annotations: Object.freeze([annotation("default")]),
    })),
    listSceneDraftCandidates: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      candidates: Object.freeze([draftCandidate("default")]),
    })),
    ...input,
  } as StructureProjectionClient;
}

function plotsClient(
  input: Partial<PlotProjectionClient> = {},
): PlotProjectionClient {
  return {
    list: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      plots: Object.freeze([plot("default")]),
    })),
    getDefaultBoard: vi.fn(async () => board("plot-default")),
    listSources: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      sources: Object.freeze([source("default")]),
    })),
    listEventLinks: vi.fn(async () => Object.freeze({
      schemaVersion: 1 as const,
      workId,
      links: Object.freeze([link("default")]),
    })),
    ...input,
  } as PlotProjectionClient;
}

function plotMutationClient(
  input: Partial<PlotThreadMutationClient> = {},
): PlotThreadMutationClient {
  return {
    create: vi.fn(async () => undefined as never),
    update: vi.fn(async () => undefined as never),
    retire: vi.fn(async () => undefined as never),
    ...input,
  } as PlotThreadMutationClient;
}

function plotBoardMutationClient(
  input: Partial<PlotBoardMutationClient> = {},
): PlotBoardMutationClient {
  return {
    movePlacement: vi.fn(async () => undefined as never),
    setStoryTime: vi.fn(async () => undefined as never),
    ...input,
  } as PlotBoardMutationClient;
}

function plotSourceMutationClient(
  input: Partial<PlotSourceMutationClient> = {},
): PlotSourceMutationClient {
  return {
    linkSource: vi.fn(async () => undefined as never),
    ...input,
  } as PlotSourceMutationClient;
}

function plotEventMutationClient(
  input: Partial<PlotEventMutationClient> = {},
): PlotEventMutationClient {
  return {
    createFromEvent: vi.fn(async () => undefined as never),
    createEvent: vi.fn(async () => undefined as never),
    linkEvent: vi.fn(async () => undefined as never),
    unlinkEvent: vi.fn(async () => undefined as never),
    ...input,
  } as PlotEventMutationClient;
}

function eventMutationClient(
  input: Partial<StructureEventMutationClient> = {},
): StructureEventMutationClient {
  return {
    createEventBlock: vi.fn(async () => undefined as never),
    createAnchorlessEvent: vi.fn(async () => undefined as never),
    moveEventBlock: vi.fn(async () => undefined as never),
    linkEventSource: vi.fn(async () => undefined as never),
    replaceEventSource: vi.fn(async () => undefined as never),
    retireEventSource: vi.fn(async () => undefined as never),
    ...input,
  } as StructureEventMutationClient;
}

function musicPort(
  input: Partial<SceneMusicQueueProjectionPort> = {},
): SceneMusicQueueProjectionPort {
  return {
    list: vi.fn(async () => Object.freeze([musicCandidate("default")])),
    replace: vi.fn(),
    clear: vi.fn(),
    ...input,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("structure controller kernel", () => {
  it("keeps event and plot lanes independent with last-resolution-wins board and links", async () => {
    const run = async (order: "event-then-plot" | "plot-then-event") => {
      const eventDeferred = deferred<EventRailProjection>();
      const plotDeferred = deferred<Awaited<
        ReturnType<PlotProjectionClient["list"]>
      >>();
      let state: StructureProjectionState = INITIAL_STRUCTURE_PROJECTION_STATE;
      const eventDispose = startEventAndSceneProjectionLanes({
        activeWorkId: workId,
        client: structureClient({
          listEventRail: vi.fn(() => eventDeferred.promise),
        }),
        music: musicPort(),
        onEventFailed: vi.fn(),
        onEventLoaded: (projection) => {
          state = loadEventLane(state, projection);
        },
        onEventReset: vi.fn(),
        onSceneFailed: vi.fn(),
        onSceneLoaded: vi.fn(),
        onSceneReset: vi.fn(),
      });
      const plotDispose = startPlotProjectionLane({
        activeWorkId: workId,
        client: plotsClient({ list: vi.fn(() => plotDeferred.promise) }),
        onFailed: vi.fn(),
        onLoaded: (projection) => {
          state = loadPlotLane(state, projection);
        },
        onReset: vi.fn(),
      });
      const eventProjection = eventRail("race");
      const plotProjection = Object.freeze({
        schemaVersion: 1 as const,
        workId,
        plots: Object.freeze([plot("race")]),
      });
      if (order === "event-then-plot") {
        eventDeferred.resolve(eventProjection);
        await eventDeferred.promise;
        await Promise.resolve();
        plotDeferred.resolve(plotProjection);
        await plotDeferred.promise;
        await Promise.resolve();
      } else {
        plotDeferred.resolve(plotProjection);
        await plotDeferred.promise;
        await Promise.resolve();
        eventDeferred.resolve(eventProjection);
        await eventDeferred.promise;
        await Promise.resolve();
      }
      eventDispose();
      plotDispose();
      return state;
    };

    const plotLast = await run("event-then-plot");
    expect(plotLast.plotBoard?.plotBoardId).toBe(
      entityId<"PlotBoard">("board-plot-default"),
    );
    expect(plotLast.plotEventLinks[0]?.plotEventLinkId).toBe(
      entityId<"PlotEventLink">("link-default"),
    );
    const eventLast = await run("plot-then-event");
    expect(eventLast.plotBoard?.plotBoardId).toBe(
      entityId<"PlotBoard">("board-event-race"),
    );
    expect(eventLast.plotEventLinks[0]?.plotEventLinkId).toBe(
      entityId<"PlotEventLink">("link-race"),
    );
  });

  it("preserves board and links on event failure but clears them on plot failure", () => {
    const loaded = loadPlotLane(INITIAL_STRUCTURE_PROJECTION_STATE, {
      plots: [plot("loaded")],
      board: board("loaded"),
      sources: [source("loaded")],
      links: [link("loaded")],
    });
    const eventFailed = failEventLane(loaded);
    expect(eventFailed.plotBoard).toBe(loaded.plotBoard);
    expect(eventFailed.plotEventLinks).toBe(loaded.plotEventLinks);
    expect(failPlotLane(loaded)).toMatchObject({
      plots: [],
      plotBoard: null,
      plotSources: [],
      plotEventLinks: [],
    });
  });

  it("keeps separate delayed resets and scene five-way all-or-error including music", async () => {
    const scheduled: Array<() => void> = [];
    const cancel = vi.fn();
    const eventReset = vi.fn();
    const sceneReset = vi.fn();
    const plotReset = vi.fn();
    const eventDispose = startEventAndSceneProjectionLanes({
      activeWorkId: null,
      client: structureClient(),
      music: musicPort(),
      onEventFailed: vi.fn(),
      onEventLoaded: vi.fn(),
      onEventReset: eventReset,
      onSceneFailed: vi.fn(),
      onSceneLoaded: vi.fn(),
      onSceneReset: sceneReset,
      timer: {
        schedule: (callback, delayMs) => {
          expect(delayMs).toBe(0);
          scheduled.push(callback);
          return `timer-${scheduled.length}`;
        },
        cancel,
      },
    });
    const plotDispose = startPlotProjectionLane({
      activeWorkId: null,
      client: plotsClient(),
      onFailed: vi.fn(),
      onLoaded: vi.fn(),
      onReset: plotReset,
      timer: {
        schedule: (callback, delayMs) => {
          expect(delayMs).toBe(0);
          scheduled.push(callback);
          return `timer-${scheduled.length}`;
        },
        cancel,
      },
    });
    expect(scheduled).toHaveLength(2);
    scheduled[0]!();
    expect(eventReset).toHaveBeenCalledOnce();
    expect(sceneReset).toHaveBeenCalledOnce();
    expect(plotReset).not.toHaveBeenCalled();
    scheduled[1]!();
    expect(plotReset).toHaveBeenCalledOnce();
    eventDispose();
    plotDispose();
    expect(cancel).toHaveBeenCalledTimes(2);

    const onSceneFailed = vi.fn();
    const onSceneLoaded = vi.fn();
    const rejectedMusic = Promise.reject(new Error("music failed"));
    rejectedMusic.catch(() => undefined);
    startEventAndSceneProjectionLanes({
      activeWorkId: workId,
      client: structureClient(),
      music: musicPort({ list: vi.fn(() => rejectedMusic) }),
      onEventFailed: vi.fn(),
      onEventLoaded: vi.fn(),
      onEventReset: vi.fn(),
      onSceneFailed,
      onSceneLoaded,
      onSceneReset: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onSceneFailed).toHaveBeenCalledOnce();
    expect(onSceneLoaded).not.toHaveBeenCalled();
  });

  it("suppresses disposed scene completions without adding a request sequence", async () => {
    const sceneDeferred = deferred<SceneProjectionList>();
    const onSceneLoaded = vi.fn();
    const dispose = startEventAndSceneProjectionLanes({
      activeWorkId: workId,
      client: structureClient({
        listSceneProjection: vi.fn(() => sceneDeferred.promise),
      }),
      music: musicPort(),
      onEventFailed: vi.fn(),
      onEventLoaded: vi.fn(),
      onEventReset: vi.fn(),
      onSceneFailed: vi.fn(),
      onSceneLoaded,
      onSceneReset: vi.fn(),
    });
    dispose();
    sceneDeferred.resolve(sceneProjection("disposed"));
    await sceneDeferred.promise;
    await Promise.resolve();
    expect(onSceneLoaded).not.toHaveBeenCalled();
  });

  it("keeps a successful scene refresh installed when the event refresh fails", async () => {
    const installed: SceneProjectionList[] = [];
    const eventFailure = Promise.reject(new Error("event failed"));
    eventFailure.catch(() => undefined);
    await expect(readEventProjectionWithSceneRefresh({
      client: structureClient({
        listEventRail: vi.fn(() => eventFailure),
      }),
      refreshSceneProjection: async () => {
        const projection = sceneProjection("refreshed");
        installed.push(projection);
        return projection;
      },
      workId,
    })).rejects.toThrow("event failed");
    expect(installed).toEqual([sceneProjection("refreshed")]);
  });

  it("preserves Candidate ordering and direct scene reconciliation", () => {
    const olderExtraction = extractionCandidate("older");
    const newerExtraction = extractionCandidate("newer");
    const olderDraft = draftCandidate("older");
    const newerDraft = draftCandidate("newer");
    let state: StructureProjectionState = {
      ...INITIAL_STRUCTURE_PROJECTION_STATE,
      sceneExtractionCandidates: Object.freeze([olderExtraction]),
      sceneDraftCandidates: Object.freeze([olderDraft]),
    };
    state = upsertSceneExtractionCandidateState(state, newerExtraction);
    state = upsertSceneDraftCandidateState(state, newerDraft);
    state = replaceSceneAnnotationsState(state, [annotation("new")]);
    state = replaceSceneProjectionState(state, sceneProjection("new"));
    expect(state.sceneExtractionCandidates).toEqual([
      newerExtraction,
      olderExtraction,
    ]);
    expect(state.sceneDraftCandidates).toEqual([newerDraft, olderDraft]);
    expect(state.sceneAnnotations).toEqual([annotation("new")]);
    expect(state.sceneProjection).toEqual(sceneProjection("new"));
  });

  it("preserves plot create, title, retirement, board, and source reconciliation", () => {
    const currentPlot = plot("current");
    const otherPlot = plot("other");
    const currentLink = link("current", {
      plotBeatId: currentPlot.plotThreadId,
      eventTitle: "새 제목",
    });
    let state: StructureProjectionState = {
      ...INITIAL_STRUCTURE_PROJECTION_STATE,
      plots: [currentPlot, otherPlot],
      plotSources: [source("current"), source("other")],
      plotEventLinks: [currentLink],
    };
    const created = plot("created");
    state = upsertPlotState(state, created);
    expect(state.plots[0]).toBe(created);
    const updated = plot("current", { revision: 3, title: "새 제목" });
    state = updatePlotAndLinkTitlesState(state, updated);
    expect(state.plots.find(
      (entry) => entry.plotThreadId === updated.plotThreadId,
    )).toBe(updated);
    expect(state.plotEventLinks[0]).toMatchObject({
      plotTitle: "새 제목",
      titleMatch: "matched",
    });
    const retired = plot("current", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    });
    const remaining = state.plots.filter(
      (entry) => entry.plotThreadId !== retired.plotThreadId,
    );
    state = retirePlotState(state, retired, remaining);
    expect(state.plots).toEqual(remaining);
    expect(state.plotSources.every(
      (entry) => entry.plotThreadId !== retired.plotThreadId,
    )).toBe(true);
    expect(state.plotEventLinks[0]?.plotRetiredAt).toBe(retired.retiredAt);
    state = replacePlotBoardState(state, board("authoritative"));
    expect(state.plotBoard).toEqual(board("authoritative"));
    const replacementSource = source("other");
    state = replacePlotSourceState(state, replacementSource);
    expect(state.plotSources.at(-1)).toBe(replacementSource);
  });

  it("applies exact plot-event mutation ordering and retired-link removal", () => {
    const existingPlot = plot("existing");
    const existingLink = link("existing");
    const mutationPlot = plot("mutation");
    const mutationLink = link("mutation");
    const mutation = Object.freeze({
      schemaVersion: 1,
      status: "created",
      plotBeat: mutationPlot,
      eventBlock: Object.freeze({
        workId,
        eventBlockId: entityId<"EventBlock">("event-mutation"),
      }),
      eventSources: Object.freeze([
        Object.freeze({
          eventBlockId: entityId<"EventBlock">("event-mutation"),
          sourceId: entityId<"EventSource">("source-mutation"),
        }),
      ]),
      link: mutationLink,
    }) as unknown as PlotEventLinkMutationProjection;
    const current: StructureProjectionState = {
      ...INITIAL_STRUCTURE_PROJECTION_STATE,
      plots: [existingPlot],
      eventBlocks: Object.freeze([]),
      eventSources: Object.freeze([]),
      plotEventLinks: [existingLink],
    };
    const linked = applyPlotEventLinkMutationState(current, mutation);
    expect(linked.plots).toEqual([mutationPlot, existingPlot]);
    expect(linked.eventBlocks[0]).toBe(mutation.eventBlock);
    expect(linked.eventSources).toEqual(mutation.eventSources);
    expect(linked.plotEventLinks).toEqual([mutationLink, existingLink]);
    const retiredMutation = Object.freeze({
      ...mutation,
      status: "retired" as const,
      link: Object.freeze({
        ...mutationLink,
        retiredAt: "2026-08-24T01:00:00.000Z",
      }),
    });
    expect(
      applyPlotEventLinkMutationState(linked, retiredMutation)
        .plotEventLinks,
    ).toEqual([existingLink]);
  });

  it("builds all six event payloads with exact persistence and refresh ordering", async () => {
    const order: string[] = [];
    const createEventBlock = vi.fn(async () => {
      order.push("create-selected");
      return undefined as never;
    });
    const createAnchorlessEvent = vi.fn(async () => {
      order.push("create-anchorless");
      return undefined as never;
    });
    const moveEventBlock = vi.fn(async () => {
      order.push("move");
      return undefined as never;
    });
    const linkEventSource = vi.fn(async () => {
      order.push("link");
      return undefined as never;
    });
    const replaceEventSource = vi.fn(async () => {
      order.push("replace");
      return undefined as never;
    });
    const retireEventSource = vi.fn(async () => {
      order.push("retire");
      return undefined as never;
    });
    const client = eventMutationClient({
      createEventBlock,
      createAnchorlessEvent,
      moveEventBlock,
      linkEventSource,
      replaceEventSource,
      retireEventSource,
    });
    const manuscript: StructureEventManuscriptPort = {
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    };
    const refreshEventProjection = vi.fn(async () => {
      order.push("refresh");
      return eventRail("refresh");
    });
    const exactSource = Object.freeze({
      documentId: document.documentId,
      selection: Object.freeze({ anchor: 6, head: 2 }),
      exactQuote: "사건 원문",
    });

    await createSelectedEventThroughPort({
      client,
      document,
      manuscript,
      note: "선택 메모",
      refreshEventProjection,
      source: exactSource,
      title: "선택 사건",
      workId,
    });
    expect(order).toEqual(["persist", "create-selected", "refresh"]);
    expect(createEventBlock).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      documentId: document.documentId,
      selection: { anchor: 6, head: 2 },
      exactQuote: "사건 원문",
      title: "선택 사건",
      note: "선택 메모",
    });

    order.length = 0;
    await createAnchorlessEventRecord({
      client,
      note: "예정 메모",
      refreshEventProjection,
      title: "예정 사건",
      workId,
    });
    expect(order).toEqual(["create-anchorless", "refresh"]);
    expect(createAnchorlessEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      title: "예정 사건",
      note: "예정 메모",
    });

    const currentEvent = eventBlock("command");
    order.length = 0;
    await moveEventBlockRecord({
      client,
      eventBlock: currentEvent,
      refreshEventProjection,
      target: {
        beforeEventBlockId: entityId<"EventBlock">("event-before"),
      },
    });
    expect(order).toEqual(["move", "refresh"]);
    expect(moveEventBlock).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      eventBlockId: currentEvent.eventBlockId,
      expectedRevision: 7,
      beforeEventBlockId: entityId<"EventBlock">("event-before"),
    });

    order.length = 0;
    await linkEventSourceThroughPort({
      client,
      document,
      eventBlock: currentEvent,
      manuscript,
      refreshEventProjection,
      source: exactSource,
    });
    expect(order).toEqual(["persist", "link", "refresh"]);
    expect(linkEventSource).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      eventBlockId: currentEvent.eventBlockId,
      role: "primary",
      documentId: document.documentId,
      selection: { anchor: 6, head: 2 },
      exactQuote: "사건 원문",
    });

    const currentSource = eventSource("command");
    order.length = 0;
    await replaceEventSourceThroughPort({
      client,
      document,
      eventSource: currentSource,
      manuscript,
      refreshEventProjection,
      source: exactSource,
    });
    expect(order).toEqual(["persist", "replace", "refresh"]);
    expect(replaceEventSource).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      eventSourceId: currentSource.eventSourceId,
      expectedRevision: 5,
      documentId: document.documentId,
      selection: { anchor: 6, head: 2 },
      exactQuote: "사건 원문",
    });

    order.length = 0;
    await retireEventSourceRecord({
      client,
      eventSource: currentSource,
      refreshEventProjection,
    });
    expect(order).toEqual(["retire", "refresh"]);
    expect(retireEventSource).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      eventSourceId: currentSource.eventSourceId,
      expectedRevision: 5,
    });
    expect(manuscript.persistDocument).toHaveBeenCalledTimes(3);
    expect(refreshEventProjection).toHaveBeenCalledTimes(6);
  });

  it("short-circuits command and refresh after persistence or command rejection", async () => {
    const createEventBlock = vi.fn(async () => undefined as never);
    const refreshEventProjection = vi.fn(async () => eventRail("refresh"));
    await expect(createSelectedEventThroughPort({
      client: eventMutationClient({ createEventBlock }),
      document,
      manuscript: {
        persistDocument: vi.fn(() => Promise.reject(new Error("persist failed"))),
      },
      note: "메모",
      refreshEventProjection,
      source: {
        documentId: document.documentId,
        selection: { anchor: 1, head: 4 },
        exactQuote: "원문",
      },
      title: "사건",
      workId,
    })).rejects.toThrow("persist failed");
    expect(createEventBlock).not.toHaveBeenCalled();
    expect(refreshEventProjection).not.toHaveBeenCalled();

    const rejectedCommand = vi.fn(() =>
      Promise.reject(new Error("command failed"))
    );
    await expect(createSelectedEventThroughPort({
      client: eventMutationClient({ createEventBlock: rejectedCommand }),
      document,
      manuscript: { persistDocument: vi.fn(async () => undefined) },
      note: "메모",
      refreshEventProjection,
      source: {
        documentId: document.documentId,
        selection: { anchor: 1, head: 4 },
        exactQuote: "원문",
      },
      title: "사건",
      workId,
    })).rejects.toThrow("command failed");
    expect(rejectedCommand).toHaveBeenCalledOnce();
    expect(refreshEventProjection).not.toHaveBeenCalled();
  });

  it("propagates refresh rejection after command success without retry or rollback", async () => {
    const createAnchorlessEvent = vi.fn(async () => undefined as never);
    const refreshEventProjection = vi.fn(() =>
      Promise.reject(new Error("refresh failed"))
    );
    await expect(createAnchorlessEventRecord({
      client: eventMutationClient({ createAnchorlessEvent }),
      note: "메모",
      refreshEventProjection,
      title: "예정 사건",
      workId,
    })).rejects.toThrow("refresh failed");
    expect(createAnchorlessEvent).toHaveBeenCalledOnce();
    expect(refreshEventProjection).toHaveBeenCalledOnce();
  });

  it("builds exact PlotThread CRUD payloads in command-reconcile-refresh order", async () => {
    const order: string[] = [];
    const created = plot("created");
    const updated = plot("current", { revision: 3, title: "변경 플롯" });
    const retired = plot("current", {
      revision: 4,
      retiredAt: "2026-08-24T01:00:00.000Z",
    });
    const create = vi.fn(async () => {
      order.push("create-command");
      return created;
    });
    const update = vi.fn(async () => {
      order.push("update-command");
      return updated;
    });
    const retire = vi.fn(async () => {
      order.push("retire-command");
      return retired;
    });
    const remaining = Object.freeze([plot("other")]);
    const reconcile: PlotMutationReconcilePort = {
      upsertPlot: vi.fn(() => order.push("create-reconcile")),
      updatePlotAndLinkTitles: vi.fn(() => order.push("update-reconcile")),
      retirePlot: vi.fn(() => {
        order.push("retire-reconcile");
        return remaining;
      }),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => {
        order.push("refresh");
      }),
    };
    const client = plotMutationClient({ create, update, retire });
    const draft = Object.freeze({
      title: "새 플롯",
      stage: "단계",
      summary: "요약",
      note: "메모",
    });

    await expect(createPlotThreadThroughPorts({
      client,
      draft,
      reconcile,
      refresh,
      workId,
    })).resolves.toBe(created);
    expect(order).toEqual(["create-command", "create-reconcile", "refresh"]);
    expect(create).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      ...draft,
    });

    const current = plot("current");
    order.length = 0;
    await expect(updatePlotThreadThroughPorts({
      changes: { title: "변경 플롯" },
      client,
      plot: current,
      reconcile,
      refresh,
    })).resolves.toBe(updated);
    expect(order).toEqual(["update-command", "update-reconcile", "refresh"]);
    expect(update).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotThreadId: current.plotThreadId,
      expectedRevision: 2,
      changes: { title: "변경 플롯" },
    });

    order.length = 0;
    await expect(retirePlotThreadThroughPorts({
      client,
      plot: current,
      reconcile,
      refresh,
    })).resolves.toEqual({ retired, remaining });
    expect(order).toEqual(["retire-command", "retire-reconcile", "refresh"]);
    expect(retire).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotThreadId: current.plotThreadId,
      expectedRevision: 2,
    });
  });

  it("links an initial exact plot source with null identity in persist-command-reconcile order", async () => {
    const order: string[] = [];
    const currentPlot = plot("source-target");
    const linked = source("linked", {
      plotThreadId: currentPlot.plotThreadId,
      sourceDocumentId: document.documentId,
      exactText: "선택 원문",
      range: Object.freeze({ from: 2, to: 7 }),
    });
    const linkSource = vi.fn(async () => {
      order.push("command");
      return linked;
    });
    const manuscript: StructurePlotSourceManuscriptPort = {
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    };
    const replacePlotSource = vi.fn(() => {
      order.push("reconcile");
    });
    const sourceInput = Object.freeze({
      documentId: document.documentId,
      selection: Object.freeze({ anchor: 7, head: 2 }),
      exactText: "선택 원문",
    });

    await expect(linkPlotThreadSourceThroughPort({
      client: plotSourceMutationClient({ linkSource }),
      document,
      manuscript,
      plot: currentPlot,
      reconcile: { replacePlotSource },
      source: sourceInput,
      sources: Object.freeze([source("unrelated")]),
    })).resolves.toBe(linked);
    expect(order).toEqual(["persist", "command", "reconcile"]);
    expect(manuscript.persistDocument).toHaveBeenCalledWith(document);
    expect(linkSource).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotThreadId: currentPlot.plotThreadId,
      expectedSourceId: null,
      documentId: document.documentId,
      selection: { anchor: 7, head: 2 },
      exactText: "선택 원문",
    });
    expect(replacePlotSource).toHaveBeenCalledWith(linked);
  });

  it("replaces the first same-Work plot source with its exact previous identity", async () => {
    const order: string[] = [];
    const currentPlot = plot("replacement");
    const currentSource = source("current", {
      plotThreadId: currentPlot.plotThreadId,
    });
    const laterMatchingSource = source("later", {
      plotThreadId: currentPlot.plotThreadId,
    });
    const linked = source("replacement", {
      plotThreadId: currentPlot.plotThreadId,
      sourceDocumentId: document.documentId,
      exactText: "역방향 원문",
    });
    const linkSource = vi.fn(async () => {
      order.push("command");
      return linked;
    });
    const reconcile: PlotSourceMutationReconcilePort = {
      replacePlotSource: vi.fn(() => order.push("reconcile")),
    };

    await expect(linkPlotThreadSourceThroughPort({
      client: plotSourceMutationClient({ linkSource }),
      document,
      manuscript: {
        persistDocument: vi.fn(async () => {
          order.push("persist");
        }),
      },
      plot: currentPlot,
      reconcile,
      source: {
        documentId: document.documentId,
        selection: { anchor: 9, head: 3 },
        exactText: "역방향 원문",
      },
      sources: Object.freeze([
        source("other-plot"),
        currentSource,
        laterMatchingSource,
      ]),
    })).resolves.toBe(linked);
    expect(order).toEqual(["persist", "command", "reconcile"]);
    expect(linkSource).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotThreadId: currentPlot.plotThreadId,
      expectedSourceId: currentSource.sourceId,
      documentId: document.documentId,
      selection: { anchor: 9, head: 3 },
      exactText: "역방향 원문",
    });
    expect(reconcile.replacePlotSource).toHaveBeenCalledWith(linked);
  });

  it("preserves the prior plot source when persistence or source command rejects", async () => {
    const currentPlot = plot("rejection");
    const currentSource = source("rejection", {
      plotThreadId: currentPlot.plotThreadId,
    });
    const sources = Object.freeze([currentSource]);
    const replacePlotSource = vi.fn();
    const linkAfterPersistFailure = vi.fn(async () => source("unexpected"));
    const baseInput = Object.freeze({
      document,
      plot: currentPlot,
      reconcile: Object.freeze({ replacePlotSource }),
      source: Object.freeze({
        documentId: document.documentId,
        selection: Object.freeze({ anchor: 6, head: 1 }),
        exactText: "기존 원문",
      }),
      sources,
    });

    await expect(linkPlotThreadSourceThroughPort({
      ...baseInput,
      client: plotSourceMutationClient({
        linkSource: linkAfterPersistFailure,
      }),
      manuscript: {
        persistDocument: vi.fn(() => Promise.reject(new Error("persist failed"))),
      },
    })).rejects.toThrow("persist failed");
    expect(linkAfterPersistFailure).not.toHaveBeenCalled();
    expect(replacePlotSource).not.toHaveBeenCalled();

    const rejectedCommand = vi.fn(() =>
      Promise.reject(new Error("source command failed"))
    );
    await expect(linkPlotThreadSourceThroughPort({
      ...baseInput,
      client: plotSourceMutationClient({ linkSource: rejectedCommand }),
      manuscript: { persistDocument: vi.fn(async () => undefined) },
    })).rejects.toThrow("source command failed");
    expect(rejectedCommand).toHaveBeenCalledOnce();
    expect(replacePlotSource).not.toHaveBeenCalled();
    expect(sources).toEqual([currentSource]);
  });

  it("moves a placement with exact revisions and neighbor identities in board-selection-refresh order", async () => {
    const order: string[] = [];
    const currentBoard = board("move", { revision: 9 });
    const currentPlacement = placement("move", {
      revision: 7,
      plotBoardId: currentBoard.plotBoardId,
    });
    const authoritativeBoard = board("move", { revision: 10 });
    const targetLaneId = entityId<"PlotLane">("lane-target");
    const beforePlacementId = entityId<"PlotPlacement">("placement-before");
    const afterPlacementId = entityId<"PlotPlacement">("placement-after");
    const movePlacement = vi.fn(async () => {
      order.push("command");
      return authoritativeBoard;
    });
    const reconcile: PlotBoardMutationReconcilePort = {
      replacePlotBoard: vi.fn(() => order.push("board")),
    };
    const selection: PlotMutationSelectionPort = {
      selectPlot: vi.fn(() => order.push("selection")),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => {
        order.push("refresh");
      }),
    };

    await expect(movePlotPlacementThroughPorts({
      board: currentBoard,
      client: plotBoardMutationClient({ movePlacement }),
      placement: currentPlacement,
      reconcile,
      refresh,
      selection,
      target: { targetLaneId, beforePlacementId, afterPlacementId },
    })).resolves.toBe(authoritativeBoard);
    expect(order).toEqual(["command", "board", "selection", "refresh"]);
    expect(movePlacement).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotPlacementId: currentPlacement.plotPlacementId,
      targetBoardId: currentBoard.plotBoardId,
      targetLaneId,
      beforePlacementId,
      afterPlacementId,
      expectedPlacementRevision: 7,
      expectedBoardRevision: 9,
    });
    expect(reconcile.replacePlotBoard).toHaveBeenCalledWith(authoritativeBoard);
    expect(selection.selectPlot).toHaveBeenCalledWith(
      currentPlacement.plotBeatId,
    );
    expect(refresh.refreshAfterPlotChange).toHaveBeenCalledWith(workId);
  });

  it("omits absent placement neighbors and returns only after refresh resolves", async () => {
    const currentBoard = board("move-tail", { revision: 3 });
    const currentPlacement = placement("move-tail", {
      plotBoardId: currentBoard.plotBoardId,
    });
    const authoritativeBoard = board("move-tail", { revision: 4 });
    const refresh = deferred<void>();
    const movePlacement = vi.fn<
      (command: MovePlotPlacementCommand) => Promise<PlotBoardProjection>
    >(async () => authoritativeBoard);
    const promise = movePlotPlacementThroughPorts({
      board: currentBoard,
      client: plotBoardMutationClient({ movePlacement }),
      placement: currentPlacement,
      reconcile: { replacePlotBoard: vi.fn() },
      refresh: { refreshAfterPlotChange: () => refresh.promise },
      selection: { selectPlot: vi.fn() },
      target: { targetLaneId: entityId<"PlotLane">("lane-empty") },
    });
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    const payload = movePlacement.mock.calls[0]?.[0];
    expect(payload).toEqual({
      schemaVersion: 1,
      workId,
      plotPlacementId: currentPlacement.plotPlacementId,
      targetBoardId: currentBoard.plotBoardId,
      targetLaneId: entityId<"PlotLane">("lane-empty"),
      expectedPlacementRevision: 5,
      expectedBoardRevision: 3,
    });
    expect(payload).not.toHaveProperty("beforePlacementId");
    expect(payload).not.toHaveProperty("afterPlacementId");
    refresh.resolve();
    await expect(promise).resolves.toBe(authoritativeBoard);
  });

  it("sets exact unsnapped story time and nullable interval in board-selection-refresh order", async () => {
    const order: string[] = [];
    const currentBoard = board("story", { revision: 12 });
    const currentPlacement = placement("story", {
      revision: 8,
      plotBoardId: currentBoard.plotBoardId,
    });
    const authoritativeBoard = board("story", { revision: 13 });
    const setStoryTime = vi.fn(async () => {
      order.push("command");
      return authoritativeBoard;
    });
    const reconcile: PlotBoardMutationReconcilePort = {
      replacePlotBoard: vi.fn(() => order.push("board")),
    };
    const selection: PlotMutationSelectionPort = {
      selectPlot: vi.fn(() => order.push("selection")),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => {
        order.push("refresh");
      }),
    };

    await expect(setPlotPlacementStoryTimeThroughPorts({
      board: currentBoard,
      client: plotBoardMutationClient({ setStoryTime }),
      placement: currentPlacement,
      reconcile,
      refresh,
      selection,
      target: { storyTime: 47.123456789, storyTimeEnd: null },
    })).resolves.toBe(authoritativeBoard);
    expect(order).toEqual(["command", "board", "selection", "refresh"]);
    expect(setStoryTime).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotPlacementId: currentPlacement.plotPlacementId,
      plotBoardId: currentBoard.plotBoardId,
      storyTime: 47.123456789,
      storyTimeEnd: null,
      expectedPlacementRevision: 8,
      expectedBoardRevision: 12,
    });
  });

  it("short-circuits rejected board commands and retains board selection after translated refresh failure", async () => {
    const currentBoard = board("board-failure");
    const currentPlacement = placement("board-failure", {
      plotBoardId: currentBoard.plotBoardId,
    });
    const replacePlotBoard = vi.fn();
    const selectPlot = vi.fn();
    const refreshAfterPlotChange = vi.fn(async () => undefined);
    const rejectedCommand = vi.fn(() =>
      Promise.reject(new Error("board command failed"))
    );
    await expect(setPlotPlacementStoryTimeThroughPorts({
      board: currentBoard,
      client: plotBoardMutationClient({ setStoryTime: rejectedCommand }),
      placement: currentPlacement,
      reconcile: { replacePlotBoard },
      refresh: { refreshAfterPlotChange },
      selection: { selectPlot },
      target: { storyTime: 13.75, storyTimeEnd: 22.5 },
    })).rejects.toThrow("board command failed");
    expect(rejectedCommand).toHaveBeenCalledOnce();
    expect(replacePlotBoard).not.toHaveBeenCalled();
    expect(selectPlot).not.toHaveBeenCalled();
    expect(refreshAfterPlotChange).not.toHaveBeenCalled();

    const authoritativeBoard = board("board-failure", { revision: 2 });
    const eventError = vi.fn();
    const translatedRefresh = vi.fn(async () => {
      try {
        await Promise.reject(new Error("rail failed"));
      } catch {
        eventError("작품 사건 순서를 새로고침하지 못했습니다.");
      }
    });
    await expect(movePlotPlacementThroughPorts({
      board: currentBoard,
      client: plotBoardMutationClient({
        movePlacement: vi.fn(async () => authoritativeBoard),
      }),
      placement: currentPlacement,
      reconcile: { replacePlotBoard },
      refresh: { refreshAfterPlotChange: translatedRefresh },
      selection: { selectPlot },
      target: { targetLaneId: entityId<"PlotLane">("lane-retained") },
    })).resolves.toBe(authoritativeBoard);
    expect(replacePlotBoard).toHaveBeenCalledWith(authoritativeBoard);
    expect(selectPlot).toHaveBeenCalledWith(currentPlacement.plotBeatId);
    expect(translatedRefresh).toHaveBeenCalledWith(workId);
    expect(eventError).toHaveBeenCalledWith(
      "작품 사건 순서를 새로고침하지 못했습니다.",
    );
  });

  it("creates selected and anchorless plot events with exact payload and selected-only persistence", async () => {
    const order: string[] = [];
    const currentPlot = plot("event-create");
    const selectedMutation = plotEventMutation("event-selected");
    const anchorlessMutation = plotEventMutation("event-anchorless");
    const createSelectedEvent = vi.fn(async () => {
      order.push("selected-command");
      return selectedMutation;
    });
    const createAnchorlessEvent = vi.fn(async () => {
      order.push("anchorless-command");
      return anchorlessMutation;
    });
    const manuscript: StructureEventManuscriptPort = {
      persistDocument: vi.fn(async () => {
        order.push("persist");
      }),
    };
    const reconcile: PlotEventMutationReconcilePort = {
      applyPlotEventLinkMutation: vi.fn(() => order.push("reconcile")),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => {
        order.push("refresh");
      }),
    };
    const exactSource = Object.freeze({
      kind: "exact-selection" as const,
      documentId: document.documentId,
      selection: Object.freeze({ anchor: 8, head: 2 }),
      exactQuote: "정확한 사건 원문",
    });

    await expect(createSelectedEventFromPlotThroughPorts({
      client: plotEventMutationClient({ createEvent: createSelectedEvent }),
      document,
      manuscript,
      plot: currentPlot,
      reconcile,
      refresh,
      source: exactSource,
    })).resolves.toBe(selectedMutation);
    expect(order).toEqual([
      "persist",
      "selected-command",
      "reconcile",
      "refresh",
    ]);
    expect(manuscript.persistDocument).toHaveBeenCalledWith(document);
    expect(createSelectedEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotBeatId: currentPlot.plotThreadId,
      source: exactSource,
    });

    order.length = 0;
    await expect(createAnchorlessEventFromPlotRecord({
      client: plotEventMutationClient({ createEvent: createAnchorlessEvent }),
      plot: currentPlot,
      reconcile,
      refresh,
    })).resolves.toBe(anchorlessMutation);
    expect(order).toEqual(["anchorless-command", "reconcile", "refresh"]);
    expect(createAnchorlessEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotBeatId: currentPlot.plotThreadId,
      source: { kind: "anchorless" },
    });
    expect(manuscript.persistDocument).toHaveBeenCalledOnce();
  });

  it("links and unlinks exact plot-event identities before translated refresh", async () => {
    const order: string[] = [];
    const currentPlot = plot("manual-link");
    const currentEvent = eventBlock("manual-link");
    const currentLink = link("manual-link");
    const linkedMutation = plotEventMutation("manual-linked");
    const unlinkedMutation = plotEventMutation("manual-unlinked", "retired");
    const linkEvent = vi.fn(async () => {
      order.push("link-command");
      return linkedMutation;
    });
    const unlinkEvent = vi.fn(async () => {
      order.push("unlink-command");
      return unlinkedMutation;
    });
    const reconcile: PlotEventMutationReconcilePort = {
      applyPlotEventLinkMutation: vi.fn(() => order.push("reconcile")),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => {
        order.push("refresh");
      }),
    };

    await expect(linkPlotEventRecord({
      client: plotEventMutationClient({ linkEvent }),
      eventBlockId: currentEvent.eventBlockId,
      plot: currentPlot,
      reconcile,
      refresh,
      role: "supporting",
    })).resolves.toBe(linkedMutation);
    expect(order).toEqual(["link-command", "reconcile", "refresh"]);
    expect(linkEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotBeatId: currentPlot.plotThreadId,
      eventBlockId: currentEvent.eventBlockId,
      role: "supporting",
    });

    order.length = 0;
    await expect(unlinkPlotEventRecord({
      client: plotEventMutationClient({ unlinkEvent }),
      link: currentLink,
      reconcile,
      refresh,
    })).resolves.toBe(unlinkedMutation);
    expect(order).toEqual(["unlink-command", "reconcile", "refresh"]);
    expect(unlinkEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      plotEventLinkId: currentLink.plotEventLinkId,
      expectedRevision: currentLink.revision,
    });
  });

  it("short-circuits plot-event commands and reconciliation after persistence or command rejection", async () => {
    const currentPlot = plot("event-rejection");
    const source = Object.freeze({
      kind: "exact-selection" as const,
      documentId: document.documentId,
      selection: Object.freeze({ anchor: 5, head: 1 }),
      exactQuote: "실패 원문",
    });
    const reconcile: PlotEventMutationReconcilePort = {
      applyPlotEventLinkMutation: vi.fn(),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => undefined),
    };
    const afterPersistFailure = vi.fn(async () =>
      plotEventMutation("unexpected")
    );
    await expect(createSelectedEventFromPlotThroughPorts({
      client: plotEventMutationClient({ createEvent: afterPersistFailure }),
      document,
      manuscript: {
        persistDocument: vi.fn(() => Promise.reject(new Error("persist failed"))),
      },
      plot: currentPlot,
      reconcile,
      refresh,
      source,
    })).rejects.toThrow("persist failed");
    expect(afterPersistFailure).not.toHaveBeenCalled();
    expect(reconcile.applyPlotEventLinkMutation).not.toHaveBeenCalled();
    expect(refresh.refreshAfterPlotChange).not.toHaveBeenCalled();

    const rejectedCommand = vi.fn(() =>
      Promise.reject(new Error("plot-event command failed"))
    );
    await expect(createSelectedEventFromPlotThroughPorts({
      client: plotEventMutationClient({ createEvent: rejectedCommand }),
      document,
      manuscript: { persistDocument: vi.fn(async () => undefined) },
      plot: currentPlot,
      reconcile,
      refresh,
      source,
    })).rejects.toThrow("plot-event command failed");
    expect(rejectedCommand).toHaveBeenCalledOnce();
    expect(reconcile.applyPlotEventLinkMutation).not.toHaveBeenCalled();
    expect(refresh.refreshAfterPlotChange).not.toHaveBeenCalled();
  });

  it("retains a reconciled plot-event mutation when the App refresh port translates failure", async () => {
    const mutation = plotEventMutation("translated-refresh");
    const applyPlotEventLinkMutation = vi.fn();
    const eventError = vi.fn();
    const refreshAfterPlotChange = vi.fn(async () => {
      try {
        await Promise.reject(new Error("rail failed"));
      } catch {
        eventError("작품 사건 순서를 새로고침하지 못했습니다.");
      }
    });
    await expect(linkPlotEventRecord({
      client: plotEventMutationClient({
        linkEvent: vi.fn(async () => mutation),
      }),
      eventBlockId: mutation.eventBlock.eventBlockId,
      plot: mutation.plotBeat,
      reconcile: { applyPlotEventLinkMutation },
      refresh: { refreshAfterPlotChange },
      role: mutation.link.role,
    })).resolves.toBe(mutation);
    expect(applyPlotEventLinkMutation).toHaveBeenCalledWith(mutation);
    expect(refreshAfterPlotChange).toHaveBeenCalledWith(workId);
    expect(eventError).toHaveBeenCalledWith(
      "작품 사건 순서를 새로고침하지 못했습니다.",
    );
  });

  it("creates a plot from an event before parallel raw reads and applies board-selection-tab last", async () => {
    const order: string[] = [];
    const currentEvent = eventBlock("from-event");
    const mutation = plotEventMutation("from-event");
    const authoritativeBoard = board("from-event");
    const boardRead = deferred<PlotBoardProjection>();
    const rawRefresh = deferred<EventRailProjection>();
    const createFromEvent = vi.fn(async () => {
      order.push("command");
      return mutation;
    });
    const getDefaultBoard = vi.fn(() => {
      order.push("board-start");
      return boardRead.promise;
    });
    const refreshEventProjection = vi.fn(() => {
      order.push("refresh-start");
      return rawRefresh.promise;
    });
    const applyPlotEventLinkMutation = vi.fn(() => order.push("mutation"));
    const replacePlotBoard = vi.fn(() => order.push("board"));
    const selectPlot = vi.fn(() => order.push("selection"));
    const tab: PlotFromEventTabPort = createPlotFromEventTabPort(
      () => order.push("tab"),
    );
    const promise = createPlotFromEventThroughPorts({
      boardReconcile: { replacePlotBoard },
      client: {
        ...plotEventMutationClient({ createFromEvent }),
        getDefaultBoard,
      },
      eventBlock: currentEvent,
      mutationReconcile: { applyPlotEventLinkMutation },
      refreshEventProjection,
      selection: { selectPlot },
      tab,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([
      "command",
      "mutation",
      "board-start",
      "refresh-start",
    ]);
    expect(createFromEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      eventBlockId: currentEvent.eventBlockId,
    });
    expect(getDefaultBoard).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
    });
    boardRead.resolve(authoritativeBoard);
    await Promise.resolve();
    expect(replacePlotBoard).not.toHaveBeenCalled();
    rawRefresh.resolve(eventRail("from-event"));
    await expect(promise).resolves.toBe(mutation);
    expect(order).toEqual([
      "command",
      "mutation",
      "board-start",
      "refresh-start",
      "board",
      "selection",
      "tab",
    ]);
    expect(replacePlotBoard).toHaveBeenCalledWith(authoritativeBoard);
    expect(selectPlot).toHaveBeenCalledWith(mutation.plotBeat.plotThreadId);
  });

  it("keeps the mutation but suppresses board and UI when raw event refresh rejects", async () => {
    const currentEvent = eventBlock("raw-failure");
    const mutation = plotEventMutation("raw-failure");
    const applyPlotEventLinkMutation = vi.fn();
    const replacePlotBoard = vi.fn();
    const selectPlot = vi.fn();
    const openPlotsTab = vi.fn();
    const getDefaultBoard = vi.fn(async () => board("raw-failure"));
    const refreshEventProjection = vi.fn(() =>
      Promise.reject(new Error("raw refresh failed"))
    );
    await expect(createPlotFromEventThroughPorts({
      boardReconcile: { replacePlotBoard },
      client: {
        ...plotEventMutationClient({
          createFromEvent: vi.fn(async () => mutation),
        }),
        getDefaultBoard,
      },
      eventBlock: currentEvent,
      mutationReconcile: { applyPlotEventLinkMutation },
      refreshEventProjection,
      selection: { selectPlot },
      tab: { openPlotsTab },
    })).rejects.toThrow("raw refresh failed");
    expect(applyPlotEventLinkMutation).toHaveBeenCalledWith(mutation);
    expect(getDefaultBoard).toHaveBeenCalledOnce();
    expect(refreshEventProjection).toHaveBeenCalledOnce();
    expect(replacePlotBoard).not.toHaveBeenCalled();
    expect(selectPlot).not.toHaveBeenCalled();
    expect(openPlotsTab).not.toHaveBeenCalled();
  });

  it("starts and does not cancel raw refresh when the parallel board query rejects", async () => {
    const currentEvent = eventBlock("board-failure");
    const mutation = plotEventMutation("board-failure");
    const boardRead = deferred<PlotBoardProjection>();
    const rawRefresh = deferred<EventRailProjection>();
    const rawRefreshCompleted = vi.fn();
    const refreshEventProjection = vi.fn(() =>
      rawRefresh.promise.then((projection) => {
        rawRefreshCompleted();
        return projection;
      })
    );
    const replacePlotBoard = vi.fn();
    const selectPlot = vi.fn();
    const openPlotsTab = vi.fn();
    const promise = createPlotFromEventThroughPorts({
      boardReconcile: { replacePlotBoard },
      client: {
        ...plotEventMutationClient({
          createFromEvent: vi.fn(async () => mutation),
        }),
        getDefaultBoard: vi.fn(() => boardRead.promise),
      },
      eventBlock: currentEvent,
      mutationReconcile: { applyPlotEventLinkMutation: vi.fn() },
      refreshEventProjection,
      selection: { selectPlot },
      tab: { openPlotsTab },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshEventProjection).toHaveBeenCalledOnce();
    boardRead.reject(new Error("board query failed"));
    await expect(promise).rejects.toThrow("board query failed");
    rawRefresh.resolve(eventRail("board-failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(rawRefreshCompleted).toHaveBeenCalledOnce();
    expect(replacePlotBoard).not.toHaveBeenCalled();
    expect(selectPlot).not.toHaveBeenCalled();
    expect(openPlotsTab).not.toHaveBeenCalled();
  });

  it("launches no reconcile, raw read, board query, or UI after create-from-event rejection", async () => {
    const getDefaultBoard = vi.fn(async () => board("not-read"));
    const refreshEventProjection = vi.fn(async () => eventRail("not-read"));
    const applyPlotEventLinkMutation = vi.fn();
    const replacePlotBoard = vi.fn();
    const selectPlot = vi.fn();
    const openPlotsTab = vi.fn();
    await expect(createPlotFromEventThroughPorts({
      boardReconcile: { replacePlotBoard },
      client: {
        ...plotEventMutationClient({
          createFromEvent: vi.fn(() =>
            Promise.reject(new Error("create-from-event failed"))
          ),
        }),
        getDefaultBoard,
      },
      eventBlock: eventBlock("command-failure"),
      mutationReconcile: { applyPlotEventLinkMutation },
      refreshEventProjection,
      selection: { selectPlot },
      tab: { openPlotsTab },
    })).rejects.toThrow("create-from-event failed");
    expect(applyPlotEventLinkMutation).not.toHaveBeenCalled();
    expect(getDefaultBoard).not.toHaveBeenCalled();
    expect(refreshEventProjection).not.toHaveBeenCalled();
    expect(replacePlotBoard).not.toHaveBeenCalled();
    expect(selectPlot).not.toHaveBeenCalled();
    expect(openPlotsTab).not.toHaveBeenCalled();
  });

  it("returns create and retire results only after the injected refresh resolves", async () => {
    const createRefresh = deferred<void>();
    const createPromise = createPlotThreadThroughPorts({
      client: plotMutationClient({ create: vi.fn(async () => plot("created")) }),
      draft: {
        title: "새 플롯",
        stage: "단계",
        summary: "요약",
        note: "메모",
      },
      reconcile: {
        upsertPlot: vi.fn(),
        updatePlotAndLinkTitles: vi.fn(),
        retirePlot: vi.fn(() => Object.freeze([])),
      },
      refresh: { refreshAfterPlotChange: () => createRefresh.promise },
      workId,
    });
    let createResolved = false;
    void createPromise.then(() => {
      createResolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(createResolved).toBe(false);
    createRefresh.resolve();
    await expect(createPromise).resolves.toEqual(plot("created"));

    const retireRefresh = deferred<void>();
    const remaining = Object.freeze([plot("remaining")]);
    const retirePromise = retirePlotThreadThroughPorts({
      client: plotMutationClient({
        retire: vi.fn(async () => plot("retired", {
          retiredAt: "2026-08-24T01:00:00.000Z",
        })),
      }),
      plot: plot("retired"),
      reconcile: {
        upsertPlot: vi.fn(),
        updatePlotAndLinkTitles: vi.fn(),
        retirePlot: vi.fn(() => remaining),
      },
      refresh: { refreshAfterPlotChange: () => retireRefresh.promise },
    });
    let retireResolved = false;
    void retirePromise.then(() => {
      retireResolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(retireResolved).toBe(false);
    retireRefresh.resolve();
    await expect(retirePromise).resolves.toMatchObject({ remaining });
  });

  it("short-circuits plot reconciliation and refresh after command rejection", async () => {
    const reconcile: PlotMutationReconcilePort = {
      upsertPlot: vi.fn(),
      updatePlotAndLinkTitles: vi.fn(),
      retirePlot: vi.fn(() => Object.freeze([])),
    };
    const refresh: PlotMutationRefreshPort = {
      refreshAfterPlotChange: vi.fn(async () => undefined),
    };
    await expect(createPlotThreadThroughPorts({
      client: plotMutationClient({
        create: vi.fn(() => Promise.reject(new Error("plot command failed"))),
      }),
      draft: {
        title: "새 플롯",
        stage: "단계",
        summary: "요약",
        note: "메모",
      },
      reconcile,
      refresh,
      workId,
    })).rejects.toThrow("plot command failed");
    expect(reconcile.upsertPlot).not.toHaveBeenCalled();
    expect(refresh.refreshAfterPlotChange).not.toHaveBeenCalled();
  });

  it("keeps a canonical plot mutation published when the App refresh port translates rail failure", async () => {
    const created = plot("created");
    const upsertPlot = vi.fn();
    const eventError = vi.fn();
    const refreshAfterPlotChange = vi.fn(async () => {
      try {
        await Promise.reject(new Error("rail failed"));
      } catch {
        eventError("작품 사건 순서를 새로고침하지 못했습니다.");
      }
    });
    await expect(createPlotThreadThroughPorts({
      client: plotMutationClient({ create: vi.fn(async () => created) }),
      draft: {
        title: created.title,
        stage: created.stage,
        summary: created.summary,
        note: created.note,
      },
      reconcile: {
        upsertPlot,
        updatePlotAndLinkTitles: vi.fn(),
        retirePlot: vi.fn(() => Object.freeze([])),
      },
      refresh: { refreshAfterPlotChange },
      workId,
    })).resolves.toBe(created);
    expect(upsertPlot).toHaveBeenCalledWith(created);
    expect(refreshAfterPlotChange).toHaveBeenCalledOnce();
    expect(eventError).toHaveBeenCalledWith(
      "작품 사건 순서를 새로고침하지 못했습니다.",
    );
  });

  it("keeps mutation helpers pure while structure slices own state, navigation, and UI", () => {
    const clientSource = readFileSync(
      new URL("./structure-client.ts", import.meta.url),
      "utf8",
    );
    const controllerSource = readFileSync(
      new URL("./useStructureController.ts", import.meta.url),
      "utf8",
    );
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const kernelSource = readFileSync(
      new URL("./useWorkspaceStructureKernel.ts", import.meta.url),
      "utf8",
    );
    const eventSource = readFileSync(
      new URL("./useEventWorkspaceController.ts", import.meta.url),
      "utf8",
    );
    const plotSource = readFileSync(
      new URL("./usePlotWorkspaceController.ts", import.meta.url),
      "utf8",
    );
    const sceneSource = readFileSync(
      new URL("./useSceneWorkspaceController.ts", import.meta.url),
      "utf8",
    );
    const navigationSource = readFileSync(
      new URL("../../workspace/navigation/useWorkspaceFeatureNavigationController.ts", import.meta.url),
      "utf8",
    );
    const dialogHostSource = readFileSync(
      new URL("../../workspace/dialogs/WorkspaceDialogHost.tsx", import.meta.url),
      "utf8",
    );
    const structureHostSource = readFileSync(
      new URL("./StructureWorkspaceHost.tsx", import.meta.url),
      "utf8",
    );

    expect(controllerSource).not.toContain("window.");
    expect(controllerSource.match(/useEffect\(/gu)).toHaveLength(2);
    expect(controllerSource).not.toContain("requestSequence");
    expect(controllerSource).toContain("eventMutations");
    expect(controllerSource).toContain("plotMutations");
    expect(kernelSource.match(/useStructureController\(/gu)).toHaveLength(1);

    expect(eventSource).toContain(
      'const [eventActionState, setEventActionState] = useState<',
    );
    expect(eventSource).toContain(
      "const [pendingEventDraft, setPendingEventDraft]",
    );
    expect(plotSource).toContain(
      "const [plotActionState, setPlotActionState]",
    );
    expect(plotSource).toContain(
      "const linkPlotThreadSource = useCallback(async (",
    );
    expect(sceneSource).toContain(
      "const [sceneActionState, setSceneActionState]",
    );
    expect(sceneSource).toContain("input.structureClient.runSceneDraft({");

    expect(navigationSource).toContain(
      "const openPlotThreadSource = useCallback(",
    );
    expect(navigationSource).toContain(
      "const openWorkStructurePlotSource = useCallback(",
    );
    expect(navigationSource).toContain(
      "const previewSceneExtractionCandidate = useCallback(",
    );
    expect(dialogHostSource).toContain("eventState.pendingEventDraft");
    expect(structureHostSource).toContain(
      "void plot.linkPlotThreadSource(plotThread)",
    );
    expect(structureHostSource).toContain(
      "void input.navigation.openPlotThreadSource(source)",
    );

    expect(appSource).not.toMatch(
      /window\.eumStudio\.(?:plots|structure)\.[A-Za-z]+\(/u,
    );
    expect(appSource).not.toContain("setSceneProjection");
    expect(appSource).not.toContain("setSceneExtractionCandidates");
    expect(appSource).not.toContain("setSceneDraftCandidates");
    expect(appSource).not.toContain("setPlots");
    expect(appSource).not.toContain("setPlotBoard");
    expect(appSource).not.toContain("setPlotEventLinks");

    const sourceMutationBlock = clientSource.slice(
      clientSource.indexOf(
        "export async function linkPlotThreadSourceThroughPort",
      ),
    );
    expect(sourceMutationBlock).not.toContain("window.");
    expect(sourceMutationBlock).not.toContain("navigation");
    expect(sourceMutationBlock).not.toContain("retry");

    const plotEventMutationBlock = clientSource.slice(
      clientSource.indexOf(
        "export async function createSelectedEventFromPlotThroughPorts",
      ),
      clientSource.indexOf(
        "export async function movePlotPlacementThroughPorts",
      ),
    );
    expect(plotEventMutationBlock).not.toContain("window.");
    expect(plotEventMutationBlock).not.toContain("retry");
    expect(plotEventMutationBlock).not.toContain("rollback");
  });
});
