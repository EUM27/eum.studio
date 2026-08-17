import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  CreatePlotThreadCommand,
  PlotThreadProjection,
  UpdatePlotThreadCommand,
} from "../../application/plots/plot-contract";
import type {
  PlotBoardProjection,
  PlotPlacementProjection,
} from "../../application/plots/plot-board-contract";
import type {
  PlotThreadSourceProjection,
} from "../../application/plots/plot-source-contract";
import type {
  PlotEventLinkProjection,
  PlotEventLinkRole,
} from "../../application/plots/plot-event-link-contract";
import type {
  EventBlockProjection,
} from "../../application/structure/event-block-contract";

export type PlotManagerActionState =
  | "idle"
  | "creating"
  | "updating"
  | "retiring"
  | "linking-source"
  | "creating-from-event"
  | "creating-event"
  | "linking-event"
  | "unlinking-event"
  | "moving-placement"
  | "setting-story-time";

export type PlotDraft = Pick<
  CreatePlotThreadCommand,
  "title" | "stage" | "summary" | "note"
>;

export type PlotPlacementMoveTarget = Readonly<{
  targetLaneId: PlotPlacementProjection["plotLaneId"];
  beforePlacementId?: PlotPlacementProjection["plotPlacementId"];
  afterPlacementId?: PlotPlacementProjection["plotPlacementId"];
}>;

export type PlotStoryTimeTarget = Readonly<{
  storyTime: number;
  storyTimeEnd: number | null;
}>;

type PlotDragPreview = Readonly<{
  plotPlacementId: PlotPlacementProjection["plotPlacementId"];
  sourceLaneId: PlotPlacementProjection["plotLaneId"];
  targetLaneId: PlotPlacementProjection["plotLaneId"];
  insertionIndex: number;
}>;

type PlotPointerDrag = Readonly<{
  pointerId: number;
  plotPlacementId: PlotPlacementProjection["plotPlacementId"];
  sourceLaneId: PlotPlacementProjection["plotLaneId"];
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  active: boolean;
  captureElement: HTMLElement;
}>;

type PlotStoryTimeDragPreview = PlotStoryTimeTarget & Readonly<{
  plotPlacementId: PlotPlacementProjection["plotPlacementId"];
  sourceLaneId: PlotPlacementProjection["plotLaneId"];
}>;

type PlotStoryTimePointerDrag = Readonly<{
  pointerId: number;
  plotPlacementId: PlotPlacementProjection["plotPlacementId"];
  sourceLaneId: PlotPlacementProjection["plotLaneId"];
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  active: boolean;
  captureElement: HTMLElement;
}>;

const PLOT_DRAG_START_DISTANCE = 6;
const PLOT_DRAG_AUTO_SCROLL_EDGE = 42;
const PLOT_DRAG_AUTO_SCROLL_STEP = 12;

export function normalizeStoryTimeFromClientX(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
): number {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(trackLeft) ||
    !Number.isFinite(trackWidth) ||
    trackWidth <= 0
  ) {
    throw new Error("Story-time track coordinates must be finite and non-empty");
  }
  return Math.min(100, Math.max(0, ((clientX - trackLeft) / trackWidth) * 100));
}

export function createPlotStoryTimeTarget(
  placement: PlotPlacementProjection,
  storyTime: number,
): PlotStoryTimeTarget {
  if (placement.storyTime === null || placement.storyTimeEnd === null) {
    return Object.freeze({ storyTime, storyTimeEnd: null });
  }
  const duration = placement.storyTimeEnd - placement.storyTime;
  const normalizedStart = Math.min(storyTime, 100 - duration);
  return Object.freeze({
    storyTime: normalizedStart,
    storyTimeEnd: normalizedStart + duration,
  });
}

export type PlotStoryTimeStackItem = Readonly<{
  placement: PlotPlacementProjection;
  stackLevel: number;
}>;

export function createPlotStoryTimeStack(
  placements: readonly PlotPlacementProjection[],
  renderedPointFootprint = 0,
): readonly PlotStoryTimeStackItem[] {
  if (
    !Number.isFinite(renderedPointFootprint) ||
    renderedPointFootprint < 0
  ) {
    throw new Error("Rendered story-time footprint must be non-negative");
  }
  const pointRadius = renderedPointFootprint / 2;
  const placed = placements
    .filter(
      (placement): placement is PlotPlacementProjection & { storyTime: number } =>
        placement.storyTime !== null,
    )
    .map((placement) => ({
      placement,
      start: Math.max(0, placement.storyTime - pointRadius),
      end: Math.min(
        100,
        Math.max(
          placement.storyTime + pointRadius,
          placement.storyTimeEnd ?? placement.storyTime,
        ),
      ),
    }))
    .sort((left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.placement.orderKey.localeCompare(right.placement.orderKey) ||
      left.placement.plotPlacementId.localeCompare(
        right.placement.plotPlacementId,
      ));
  const occupiedThrough: number[] = [];
  return Object.freeze(placed.map(({ placement, start, end }) => {
    let stackLevel = occupiedThrough.findIndex(
      (occupiedEnd) => {
        const floatingPointTolerance =
          Number.EPSILON * Math.max(1, Math.abs(start), Math.abs(occupiedEnd)) * 16;
        return start - occupiedEnd > floatingPointTolerance;
      },
    );
    if (stackLevel < 0) stackLevel = occupiedThrough.length;
    occupiedThrough[stackLevel] = end;
    return Object.freeze({ placement, stackLevel });
  }));
}

export function createPlotPlacementMoveTarget(
  placements: readonly PlotPlacementProjection[],
  plotPlacementId: PlotPlacementProjection["plotPlacementId"],
  targetLaneId: PlotPlacementProjection["plotLaneId"],
  insertionIndex: number,
): PlotPlacementMoveTarget {
  const remaining = placements.filter(
    (placement) => placement.plotPlacementId !== plotPlacementId,
  );
  if (
    !Number.isSafeInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > remaining.length
  ) {
    throw new Error("Plot placement insertion index is outside the target lane");
  }
  const beforePlacementId = remaining[insertionIndex - 1]?.plotPlacementId;
  const afterPlacementId = remaining[insertionIndex]?.plotPlacementId;
  return Object.freeze({
    targetLaneId,
    ...(beforePlacementId === undefined ? {} : { beforePlacementId }),
    ...(afterPlacementId === undefined ? {} : { afterPlacementId }),
  });
}

function PlotFields(input: {
  readonly actionState: PlotManagerActionState;
  readonly onCreate: (draft: PlotDraft) => void;
  readonly onRetire: (plot: PlotThreadProjection) => void;
  readonly onUpdate: (
    plot: PlotThreadProjection,
    changes: UpdatePlotThreadCommand["changes"],
  ) => void;
  readonly plot: PlotThreadProjection | null;
}) {
  const [title, setTitle] = useState(input.plot?.title ?? "");
  const [stage, setStage] = useState(input.plot?.stage ?? "");
  const [summary, setSummary] = useState(input.plot?.summary ?? "");
  const [note, setNote] = useState(input.plot?.note ?? "");
  const plot = input.plot;
  const busy = input.actionState !== "idle";
  const creating = plot === null;

  return (
    <form
      className="character-manager-fields plot-manager-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (plot === null) {
          input.onCreate({ title, stage, summary, note });
          return;
        }
        input.onUpdate(plot, { title, stage, summary, note });
      }}
    >
      <label>
        <span>플롯 제목</span>
        <input
          aria-label="플롯 제목"
          autoFocus
          disabled={busy}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="플롯 제목을 입력하세요"
          value={title}
        />
      </label>
      <label>
        <span>단계</span>
        <input
          aria-label="플롯 단계"
          disabled={busy}
          name="stage"
          onChange={(event) => setStage(event.target.value)}
          placeholder="현재 단계를 자유롭게 적습니다"
          value={stage}
        />
      </label>
      <label>
        <span>플롯 요약</span>
        <textarea
          aria-label="플롯 요약"
          disabled={busy}
          name="summary"
          onChange={(event) => setSummary(event.target.value)}
          placeholder="갈등, 진행 상황, 회수 방향처럼 집필에 필요한 내용을 적습니다."
          rows={5}
          value={summary}
        />
      </label>
      <label>
        <span>작가 메모</span>
        <textarea
          aria-label="플롯 작가 메모"
          disabled={busy}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="확인할 점이나 작업 메모를 적습니다."
          rows={3}
          value={note}
        />
      </label>
      <div className="character-manager-field-actions plot-manager-field-actions">
        {plot !== null && (
          <button
            className="danger-action"
            disabled={busy}
            onClick={() => input.onRetire(plot)}
            type="button"
          >
            {input.actionState === "retiring" ? "치우는 중" : "플롯 치우기"}
          </button>
        )}
        <button
          className="primary-action"
          disabled={busy || title.trim().length === 0}
          type="submit"
        >
          {creating
            ? input.actionState === "creating" ? "만드는 중" : "플롯 만들기"
            : input.actionState === "updating" ? "저장 중" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

export function PlotManagerDialog(input: {
  readonly actionState: PlotManagerActionState;
  readonly board: PlotBoardProjection | null;
  readonly canCreateEventFromSelection: boolean;
  readonly canLinkSource: boolean;
  readonly documentLabels: Readonly<Record<string, string>>;
  readonly error: string | null;
  readonly eventBlocks: readonly EventBlockProjection[];
  readonly eventLinks: readonly PlotEventLinkProjection[];
  readonly onClose: () => void;
  readonly onCreate: (draft: PlotDraft) => void;
  readonly onCreateEvent: (
    plot: PlotThreadProjection,
    exactSelection: boolean,
  ) => void;
  readonly onLinkEvent: (
    plot: PlotThreadProjection,
    eventBlockId: EventBlockProjection["eventBlockId"],
    role: PlotEventLinkRole,
  ) => void;
  readonly onRetire: (plot: PlotThreadProjection) => void;
  readonly onLinkSource: (plot: PlotThreadProjection) => void;
  readonly onMovePlacement: (
    placement: PlotPlacementProjection,
    target: PlotPlacementMoveTarget,
  ) => void | Promise<void>;
  readonly onSetStoryTime: (
    placement: PlotPlacementProjection,
    target: PlotStoryTimeTarget,
  ) => void | Promise<void>;
  readonly onOpenSource: (source: PlotThreadSourceProjection) => void;
  readonly onSelect: (plotThreadId: string | null) => void;
  readonly onUpdate: (
    plot: PlotThreadProjection,
    changes: UpdatePlotThreadCommand["changes"],
  ) => void;
  readonly onUnlinkEvent: (link: PlotEventLinkProjection) => void;
  readonly plots: readonly PlotThreadProjection[];
  readonly sources: readonly PlotThreadSourceProjection[];
  readonly selectedPlotThreadId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [eventBlockId, setEventBlockId] = useState("");
  const [eventRole, setEventRole] = useState<PlotEventLinkRole>("primary");
  const [boardView, setBoardView] = useState<"sequence" | "time-map">(
    "sequence",
  );
  const [dragPreview, setDragPreview] = useState<PlotDragPreview | null>(null);
  const [storyTimePreview, setStoryTimePreview] =
    useState<PlotStoryTimeDragPreview | null>(null);
  const [dropPending, setDropPending] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const plotListRef = useRef<HTMLElement | null>(null);
  const pointerDragRef = useRef<PlotPointerDrag | null>(null);
  const dragPreviewRef = useRef<PlotDragPreview | null>(null);
  const storyTimePointerDragRef = useRef<PlotStoryTimePointerDrag | null>(null);
  const storyTimePreviewRef = useRef<PlotStoryTimeDragPreview | null>(null);
  const storyTimeTrackRefs = useRef(new Map<string, HTMLElement>());
  const [storyTimePointFootprints, setStoryTimePointFootprints] =
    useState<ReadonlyMap<string, number>>(() => new Map());
  const autoScrollFrameRef = useRef<number | null>(null);
  const dropPendingRef = useRef(false);
  const suppressClickRef = useRef<
    PlotPlacementProjection["plotPlacementId"] | null
  >(null);
  const actionState = input.actionState;
  const onMovePlacement = input.onMovePlacement;
  const onSetStoryTime = input.onSetStoryTime;
  const busy = actionState !== "idle" || dropPending;
  const selectedPlot = input.plots.find(
    (plot) => plot.plotThreadId === input.selectedPlotThreadId,
  ) ?? null;
  const selectedSource = selectedPlot === null
    ? null
    : input.sources.find(
        (source) => source.plotThreadId === selectedPlot.plotThreadId,
      ) ?? null;
  const selectedEventLinks = selectedPlot === null
    ? []
    : input.eventLinks.filter(
        (link) => link.plotBeatId === selectedPlot.plotThreadId,
      );
  const linkedEventBlockIds = new Set(
    selectedEventLinks.map((link) => link.eventBlockId),
  );
  const availableEventBlocks = input.eventBlocks.filter(
    (eventBlock) => !linkedEventBlockIds.has(eventBlock.eventBlockId),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlots = normalizedQuery.length === 0
    ? input.plots
    : input.plots.filter((plot) =>
        `${plot.title}\n${plot.stage}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      );

  const setCurrentDragPreview = useCallback(
    (preview: PlotDragPreview | null) => {
      dragPreviewRef.current = preview;
      setDragPreview(preview);
    },
    [],
  );
  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);
  const clearPointerDrag = useCallback(() => {
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    setCurrentDragPreview(null);
    stopAutoScroll();
    if (
      drag !== null &&
      drag.captureElement.hasPointerCapture(drag.pointerId)
    ) {
      drag.captureElement.releasePointerCapture(drag.pointerId);
    }
  }, [setCurrentDragPreview, stopAutoScroll]);
  const setCurrentStoryTimePreview = useCallback(
    (preview: PlotStoryTimeDragPreview | null) => {
      storyTimePreviewRef.current = preview;
      setStoryTimePreview(preview);
    },
    [],
  );
  const clearStoryTimePointerDrag = useCallback(() => {
    const drag = storyTimePointerDragRef.current;
    storyTimePointerDragRef.current = null;
    setCurrentStoryTimePreview(null);
    if (
      drag !== null &&
      drag.captureElement.hasPointerCapture(drag.pointerId)
    ) {
      drag.captureElement.releasePointerCapture(drag.pointerId);
    }
  }, [setCurrentStoryTimePreview]);
  const registerStoryTimeTrack = useCallback(
    (plotLaneId: string, element: HTMLElement | null) => {
      if (element === null) {
        storyTimeTrackRefs.current.delete(plotLaneId);
        return;
      }
      storyTimeTrackRefs.current.set(plotLaneId, element);
      window.requestAnimationFrame(() => {
        if (storyTimeTrackRefs.current.get(plotLaneId) !== element) return;
        const measure = element.querySelector<HTMLElement>(
          ".plot-story-time-card-measure",
        );
        const trackWidth = element.getBoundingClientRect().width;
        const measuredWidth = measure?.getBoundingClientRect().width ?? 0;
        if (trackWidth <= 0 || measuredWidth <= 0) return;
        const footprint = Math.min(100, (measuredWidth / trackWidth) * 100);
        setStoryTimePointFootprints((current) => {
          if (current.get(plotLaneId) === footprint) return current;
          const next = new Map(current);
          next.set(plotLaneId, footprint);
          return next;
        });
      });
    },
    [],
  );
  const resolveStoryTimePreview = useCallback(
    (
      drag: PlotStoryTimePointerDrag,
      clientX: number,
      clientY: number,
    ): PlotStoryTimeDragPreview | null => {
      if (input.board === null) return null;
      const track = storyTimeTrackRefs.current.get(drag.sourceLaneId);
      if (track === undefined) return null;
      const bounds = track.getBoundingClientRect();
      if (
        clientY < bounds.top ||
        clientY > bounds.bottom ||
        bounds.width <= 0
      ) {
        return null;
      }
      const placement = input.board.lanes
        .flatMap((lane) => lane.placements)
        .find(
          (candidate) =>
            candidate.plotPlacementId === drag.plotPlacementId,
        );
      if (placement === undefined) return null;
      return Object.freeze({
        plotPlacementId: placement.plotPlacementId,
        sourceLaneId: placement.plotLaneId,
        ...createPlotStoryTimeTarget(
          placement,
          normalizeStoryTimeFromClientX(clientX, bounds.left, bounds.width),
        ),
      });
    },
    [input.board],
  );
  const resolveDragPreview = useCallback(
    (
      drag: PlotPointerDrag,
      clientX: number,
      clientY: number,
    ): PlotDragPreview | null => {
      if (input.board === null || dialogRef.current === null) return null;
      const laneElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("[data-plot-lane-id]"),
      );
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const pointedLane = pointedElement?.closest<HTMLElement>(
        "[data-plot-lane-id]",
      ) ?? null;
      const targetElement = pointedLane !== null && laneElements.includes(pointedLane)
        ? pointedLane
        : laneElements.find((element) => {
            const bounds = element.getBoundingClientRect();
            return clientX >= bounds.left && clientX <= bounds.right &&
              clientY >= bounds.top && clientY <= bounds.bottom;
          }) ?? null;
      if (targetElement === null) return null;
      const targetLane = input.board.lanes.find(
        (lane) => lane.plotLaneId === targetElement.dataset.plotLaneId,
      );
      if (targetLane === undefined) return null;
      const targetCards = Array.from(
        targetElement.querySelectorAll<HTMLElement>("[data-plot-placement-id]"),
      ).filter(
        (element) =>
          element.dataset.plotPlacementId !== drag.plotPlacementId,
      );
      const insertionIndex = targetCards.findIndex((element) => {
        const bounds = element.getBoundingClientRect();
        return clientY < bounds.top + bounds.height / 2;
      });
      return Object.freeze({
        plotPlacementId: drag.plotPlacementId,
        sourceLaneId: drag.sourceLaneId,
        targetLaneId: targetLane.plotLaneId,
        insertionIndex:
          insertionIndex === -1 ? targetCards.length : insertionIndex,
      });
    },
    [input.board],
  );
  const startAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) return;
    const step = () => {
      const drag = pointerDragRef.current;
      const list = plotListRef.current;
      if (drag === null || !drag.active || list === null) {
        autoScrollFrameRef.current = null;
        return;
      }
      const bounds = list.getBoundingClientRect();
      const scrollDelta = drag.clientY < bounds.top + PLOT_DRAG_AUTO_SCROLL_EDGE
        ? -PLOT_DRAG_AUTO_SCROLL_STEP
        : drag.clientY > bounds.bottom - PLOT_DRAG_AUTO_SCROLL_EDGE
          ? PLOT_DRAG_AUTO_SCROLL_STEP
          : 0;
      if (scrollDelta !== 0) {
        list.scrollTop += scrollDelta;
        const nextPreview = resolveDragPreview(
          drag,
          drag.clientX,
          drag.clientY,
        );
        if (nextPreview !== null) setCurrentDragPreview(nextPreview);
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(step);
    };
    autoScrollFrameRef.current = window.requestAnimationFrame(step);
  }, [resolveDragPreview, setCurrentDragPreview]);
  const requestMove = useCallback(
    async (
      placement: PlotPlacementProjection,
      target: PlotPlacementMoveTarget,
    ) => {
      if (actionState !== "idle" || dropPendingRef.current) return;
      dropPendingRef.current = true;
      setDropPending(true);
      try {
        await onMovePlacement(placement, target);
      } finally {
        dropPendingRef.current = false;
        setDropPending(false);
      }
    },
    [actionState, onMovePlacement],
  );
  const requestSetStoryTime = useCallback(
    async (
      placement: PlotPlacementProjection,
      target: PlotStoryTimeTarget,
    ) => {
      if (actionState !== "idle" || dropPendingRef.current) return;
      dropPendingRef.current = true;
      setDropPending(true);
      try {
        await onSetStoryTime(placement, target);
      } finally {
        dropPendingRef.current = false;
        setDropPending(false);
      }
    },
    [actionState, onSetStoryTime],
  );
  const requestRelativeMove = useCallback(
    (
      placement: PlotPlacementProjection,
      direction: "forward" | "backward",
    ) => {
      const lane = input.board?.lanes.find(
        (candidate) => candidate.plotLaneId === placement.plotLaneId,
      );
      if (lane === undefined) return;
      const currentIndex = lane.placements.findIndex(
        (candidate) =>
          candidate.plotPlacementId === placement.plotPlacementId,
      );
      const insertionIndex = direction === "forward"
        ? currentIndex - 1
        : currentIndex + 1;
      if (
        currentIndex < 0 ||
        insertionIndex < 0 ||
        insertionIndex >= lane.placements.length
      ) {
        return;
      }
      void requestMove(
        placement,
        createPlotPlacementMoveTarget(
          lane.placements,
          placement.plotPlacementId,
          lane.plotLaneId,
          insertionIndex,
        ),
      );
    },
    [input.board, requestMove],
  );
  const handlePlacementKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLButtonElement>,
      placement: PlotPlacementProjection,
    ) => {
      if (!event.altKey) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        requestRelativeMove(placement, "forward");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        requestRelativeMove(placement, "backward");
      }
    },
    [requestRelativeMove],
  );
  const handlePlacementPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      placement: PlotPlacementProjection,
    ) => {
      if (
        event.button !== 0 ||
        busy ||
        pointerDragRef.current !== null ||
        storyTimePointerDragRef.current !== null ||
        placement.plotBeat.retiredAt !== null
      ) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerDragRef.current = Object.freeze({
        pointerId: event.pointerId,
        plotPlacementId: placement.plotPlacementId,
        sourceLaneId: placement.plotLaneId,
        originX: event.clientX,
        originY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        captureElement: event.currentTarget,
      });
    },
    [busy],
  );
  const handlePlacementPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const active = drag.active || Math.hypot(
        event.clientX - drag.originX,
        event.clientY - drag.originY,
      ) >= PLOT_DRAG_START_DISTANCE;
      const currentDrag = Object.freeze({
        ...drag,
        clientX: event.clientX,
        clientY: event.clientY,
        active,
      });
      pointerDragRef.current = currentDrag;
      if (!active) return;
      event.preventDefault();
      const nextPreview = resolveDragPreview(
        currentDrag,
        event.clientX,
        event.clientY,
      );
      if (nextPreview !== null) setCurrentDragPreview(nextPreview);
      startAutoScroll();
    },
    [resolveDragPreview, setCurrentDragPreview, startAutoScroll],
  );
  const handlePlacementPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const preview = dragPreviewRef.current;
      const wasActive = drag.active;
      clearPointerDrag();
      if (!wasActive || preview === null || input.board === null) return;
      event.preventDefault();
      suppressClickRef.current = drag.plotPlacementId;
      window.setTimeout(() => {
        if (suppressClickRef.current === drag.plotPlacementId) {
          suppressClickRef.current = null;
        }
      }, 0);
      const placement = input.board.lanes
        .flatMap((lane) => lane.placements)
        .find(
          (candidate) =>
            candidate.plotPlacementId === drag.plotPlacementId,
        );
      const targetLane = input.board.lanes.find(
        (lane) => lane.plotLaneId === preview.targetLaneId,
      );
      if (placement === undefined || targetLane === undefined) return;
      void requestMove(
        placement,
        createPlotPlacementMoveTarget(
          targetLane.placements,
          placement.plotPlacementId,
          targetLane.plotLaneId,
          preview.insertionIndex,
        ),
      );
    },
    [clearPointerDrag, input.board, requestMove],
  );

  const handleStoryTimePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      placement: PlotPlacementProjection,
    ) => {
      if (
        event.button !== 0 ||
        busy ||
        pointerDragRef.current !== null ||
        storyTimePointerDragRef.current !== null ||
        placement.plotBeat.retiredAt !== null
      ) {
        return;
      }
      storyTimePointerDragRef.current = Object.freeze({
        pointerId: event.pointerId,
        plotPlacementId: placement.plotPlacementId,
        sourceLaneId: placement.plotLaneId,
        originX: event.clientX,
        originY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        captureElement: event.currentTarget,
      });
    },
    [busy],
  );
  const handleStoryTimePointerMove = useCallback(
    (event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY" | "preventDefault">) => {
      const drag = storyTimePointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const active = drag.active || Math.hypot(
        event.clientX - drag.originX,
        event.clientY - drag.originY,
      ) >= PLOT_DRAG_START_DISTANCE;
      const currentDrag = Object.freeze({
        ...drag,
        clientX: event.clientX,
        clientY: event.clientY,
        active,
      });
      storyTimePointerDragRef.current = currentDrag;
      if (!active) return;
      event.preventDefault();
      setCurrentStoryTimePreview(
        resolveStoryTimePreview(currentDrag, event.clientX, event.clientY),
      );
    },
    [resolveStoryTimePreview, setCurrentStoryTimePreview],
  );
  const handleStoryTimePointerUp = useCallback(
    (event: Pick<PointerEvent, "pointerId" | "preventDefault">) => {
      const drag = storyTimePointerDragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const preview = storyTimePreviewRef.current;
      const wasActive = drag.active;
      clearStoryTimePointerDrag();
      if (!wasActive || preview === null || input.board === null) return;
      event.preventDefault();
      suppressClickRef.current = drag.plotPlacementId;
      window.setTimeout(() => {
        if (suppressClickRef.current === drag.plotPlacementId) {
          suppressClickRef.current = null;
        }
      }, 0);
      const placement = input.board.lanes
        .flatMap((lane) => lane.placements)
        .find(
          (candidate) =>
            candidate.plotPlacementId === drag.plotPlacementId,
        );
      if (placement === undefined) return;
      void requestSetStoryTime(placement, preview);
    },
    [clearStoryTimePointerDrag, input.board, requestSetStoryTime],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      handleStoryTimePointerMove(event);
    };
    const handlePointerUp = (event: PointerEvent) => {
      handleStoryTimePointerUp(event);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (storyTimePointerDragRef.current?.pointerId === event.pointerId) {
        clearStoryTimePointerDrag();
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    clearStoryTimePointerDrag,
    handleStoryTimePointerMove,
    handleStoryTimePointerUp,
  ]);

  useEffect(() => {
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        (pointerDragRef.current === null &&
          storyTimePointerDragRef.current === null)
      ) {
        return;
      }
      event.preventDefault();
      clearPointerDrag();
      clearStoryTimePointerDrag();
    };
    document.addEventListener("keydown", cancelWithEscape);
    return () => document.removeEventListener("keydown", cancelWithEscape);
  }, [clearPointerDrag, clearStoryTimePointerDrag]);
  useEffect(
    () => () => {
      pointerDragRef.current = null;
      dragPreviewRef.current = null;
      storyTimePointerDragRef.current = null;
      storyTimePreviewRef.current = null;
      storyTimeTrackRefs.current.clear();
      stopAutoScroll();
    },
    [stopAutoScroll],
  );

  return (
    <div
      className="dialog-backdrop character-manager-backdrop plot-manager-backdrop"
      role="presentation"
    >
      <section
        aria-labelledby="plot-manager-heading"
        aria-modal="true"
        className="character-manager-dialog plot-manager-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header className="character-manager-header plot-manager-header">
          <div>
            <p className="panel-kicker">PLOTS</p>
            <h2 id="plot-manager-heading">플롯 관리</h2>
            <p>현재 작품의 플롯 진행과 작가 메모를 관리합니다.</p>
          </div>
          <button
            aria-label="플롯 관리 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="character-manager-body plot-manager-body">
          <section
            aria-label="플롯 목록"
            className="character-manager-list plot-manager-list"
            ref={plotListRef}
          >
            <div className="character-manager-list-tools plot-manager-list-tools">
              <input
                aria-label="플롯 검색"
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목·단계 검색"
                value={query}
              />
              <button
                disabled={busy}
                onClick={() => input.onSelect(null)}
                type="button"
              >
                새 플롯
              </button>
            </div>
            {input.board !== null && (
              <section
                aria-label="플롯 보드"
                className="plot-board-panel"
                data-board-view={boardView}
                data-drag-active={
                  dragPreview === null && storyTimePreview === null
                    ? "false"
                    : "true"
                }
              >
                <header className="plot-board-header">
                  <div>
                    <span>플롯 보드</span>
                    <strong>{input.board.title}</strong>
                  </div>
                  <div
                    aria-label="플롯 보드 보기"
                    className="plot-board-view-switch"
                    role="group"
                  >
                    <button
                      aria-pressed={boardView === "sequence"}
                      disabled={busy}
                      onClick={() => {
                        clearPointerDrag();
                        clearStoryTimePointerDrag();
                        setBoardView("sequence");
                      }}
                      type="button"
                    >
                      순서 보드
                    </button>
                    <button
                      aria-pressed={boardView === "time-map"}
                      disabled={busy}
                      onClick={() => {
                        clearPointerDrag();
                        clearStoryTimePointerDrag();
                        setBoardView("time-map");
                      }}
                      type="button"
                    >
                      시간 지도
                    </button>
                  </div>
                </header>
                {boardView === "sequence"
                  ? input.board.lanes.map((lane) => (
                      <section
                        aria-label={lane.title}
                        className="plot-board-lane"
                        data-plot-lane-id={lane.plotLaneId}
                        key={lane.plotLaneId}
                      >
                        <h3>{lane.title}</h3>
                        {lane.placements.length === 0 &&
                        dragPreview?.targetLaneId !== lane.plotLaneId ? (
                          <p>배치된 플롯이 없습니다.</p>
                        ) : (
                          <ol data-plot-lane-list="true">
                            {lane.placements.map((placement, index) => {
                              const targetPlacements = lane.placements.filter(
                                (candidate) =>
                                  candidate.plotPlacementId !==
                                    dragPreview?.plotPlacementId,
                              );
                              const insertionBeforeId =
                                dragPreview?.targetLaneId === lane.plotLaneId
                                  ? targetPlacements[dragPreview.insertionIndex]
                                      ?.plotPlacementId
                                  : undefined;
                              return (
                                <Fragment key={placement.plotPlacementId}>
                                  {insertionBeforeId ===
                                    placement.plotPlacementId && (
                                    <li
                                      aria-hidden="true"
                                      className="plot-board-insertion-line"
                                      data-plot-insertion-line="true"
                                    />
                                  )}
                                  <li
                                    className={
                                      dragPreview?.plotPlacementId ===
                                        placement.plotPlacementId
                                        ? "is-drag-preview-source"
                                        : undefined
                                    }
                                    data-plot-placement-id={
                                      placement.plotPlacementId
                                    }
                                  >
                                    <button
                                      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                                      aria-pressed={
                                        placement.plotBeatId ===
                                          selectedPlot?.plotThreadId
                                      }
                                      className="plot-board-card-select"
                                      disabled={
                                        busy ||
                                        placement.plotBeat.retiredAt !== null
                                      }
                                      onClick={() => {
                                        if (
                                          suppressClickRef.current ===
                                            placement.plotPlacementId
                                        ) {
                                          suppressClickRef.current = null;
                                          return;
                                        }
                                        input.onSelect(placement.plotBeatId);
                                      }}
                                      onKeyDown={(event) =>
                                        handlePlacementKeyDown(event, placement)
                                      }
                                      onLostPointerCapture={() => {
                                        if (
                                          pointerDragRef.current
                                            ?.plotPlacementId ===
                                            placement.plotPlacementId
                                        ) {
                                          clearPointerDrag();
                                        }
                                      }}
                                      onPointerCancel={clearPointerDrag}
                                      onPointerDown={(event) =>
                                        handlePlacementPointerDown(
                                          event,
                                          placement,
                                        )
                                      }
                                      onPointerMove={handlePlacementPointerMove}
                                      onPointerUp={handlePlacementPointerUp}
                                      type="button"
                                    >
                                      <strong>{placement.plotBeat.title}</strong>
                                      <span>
                                        {placement.plotBeat.retiredAt === null
                                          ? (placement.plotBeat.stage ||
                                            "단계 미입력")
                                          : "치운 플롯"}
                                      </span>
                                    </button>
                                    <div className="plot-board-card-actions">
                                      <button
                                        disabled={busy || index === 0}
                                        onClick={() =>
                                          requestRelativeMove(
                                            placement,
                                            "forward",
                                          )
                                        }
                                        type="button"
                                      >
                                        앞으로 이동
                                      </button>
                                      <button
                                        disabled={
                                          busy ||
                                          index === lane.placements.length - 1
                                        }
                                        onClick={() =>
                                          requestRelativeMove(
                                            placement,
                                            "backward",
                                          )
                                        }
                                        type="button"
                                      >
                                        뒤로 이동
                                      </button>
                                    </div>
                                  </li>
                                </Fragment>
                              );
                            })}
                            {dragPreview?.targetLaneId === lane.plotLaneId &&
                              dragPreview.insertionIndex ===
                                lane.placements.filter(
                                  (candidate) =>
                                    candidate.plotPlacementId !==
                                      dragPreview.plotPlacementId,
                                ).length && (
                                <li
                                  aria-hidden="true"
                                  className="plot-board-insertion-line"
                                  data-plot-insertion-line="true"
                                />
                              )}
                          </ol>
                        )}
                      </section>
                    ))
                  : input.board.lanes.map((lane) => {
                      const previewedPlacements = lane.placements.map(
                        (placement) =>
                          storyTimePreview?.plotPlacementId ===
                            placement.plotPlacementId
                            ? {
                                ...placement,
                                storyTime: storyTimePreview.storyTime,
                                storyTimeEnd: storyTimePreview.storyTimeEnd,
                              }
                            : placement,
                      );
                      const stacked = createPlotStoryTimeStack(
                        previewedPlacements,
                        storyTimePointFootprints.get(lane.plotLaneId) ?? 0,
                      );
                      const maxStackLevel = stacked.reduce(
                        (maximum, item) =>
                          Math.max(maximum, item.stackLevel),
                        0,
                      );
                      const unassigned = lane.placements.filter(
                        (placement) => placement.storyTime === null,
                      );
                      return (
                        <section
                          aria-label={`${lane.title} 시간 지도`}
                          className="plot-story-time-lane"
                          key={lane.plotLaneId}
                        >
                          <h3>{lane.title}</h3>
                          <div
                            className="plot-story-time-track"
                            data-story-time-point-footprint={
                              storyTimePointFootprints.get(lane.plotLaneId) ?? 0
                            }
                            data-story-time-lane-id={lane.plotLaneId}
                            data-story-time-track="true"
                            ref={(element) => {
                              registerStoryTimeTrack(
                                lane.plotLaneId,
                                element,
                              );
                            }}
                            style={{
                              minHeight: `${5.8 + maxStackLevel * 3.6}rem`,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="plot-story-time-card-measure"
                            />
                            <span className="plot-story-time-axis" />
                            <span className="plot-story-time-axis-start">0</span>
                            <span className="plot-story-time-axis-end">100</span>
                            {stacked.map(({ placement, stackLevel }) => {
                              const original = lane.placements.find(
                                (candidate) =>
                                  candidate.plotPlacementId ===
                                    placement.plotPlacementId,
                              );
                              if (
                                original === undefined ||
                                placement.storyTime === null
                              ) {
                                return null;
                              }
                              const endpointClass = placement.storyTime === 0
                                ? " is-start"
                                : placement.storyTime === 100
                                  ? " is-end"
                                  : "";
                              const top = 2.1 + stackLevel * 3.6;
                              return (
                                <Fragment key={placement.plotPlacementId}>
                                  {placement.storyTimeEnd !== null &&
                                    placement.storyTimeEnd >
                                      placement.storyTime && (
                                      <span
                                        aria-hidden="true"
                                        className="plot-story-time-range"
                                        style={{
                                          left: `${placement.storyTime}%`,
                                          top: `${top + 1.05}rem`,
                                          width: `${
                                            placement.storyTimeEnd -
                                            placement.storyTime
                                          }%`,
                                        }}
                                      />
                                    )}
                                  <button
                                    aria-label={`${placement.plotBeat.title}, 이야기 시간 ${placement.storyTime}${
                                      placement.storyTimeEnd === null
                                        ? ""
                                        : `에서 ${placement.storyTimeEnd}`
                                    }`}
                                    aria-pressed={
                                      placement.plotBeatId ===
                                        selectedPlot?.plotThreadId
                                    }
                                    className={`plot-story-time-card${endpointClass}`}
                                    data-plot-placement-id={
                                      placement.plotPlacementId
                                    }
                                    data-story-time={placement.storyTime}
                                    data-story-time-end={
                                      placement.storyTimeEnd ?? ""
                                    }
                                    data-story-time-preview={
                                      storyTimePreview?.plotPlacementId ===
                                        placement.plotPlacementId
                                        ? "true"
                                        : "false"
                                    }
                                    data-story-time-stack-level={stackLevel}
                                    disabled={
                                      busy ||
                                      placement.plotBeat.retiredAt !== null
                                    }
                                    onClick={() => {
                                      if (
                                        suppressClickRef.current ===
                                          placement.plotPlacementId
                                      ) {
                                        suppressClickRef.current = null;
                                        return;
                                      }
                                      input.onSelect(placement.plotBeatId);
                                    }}
                                    onPointerDown={(event) =>
                                      handleStoryTimePointerDown(event, original)
                                    }
                                    style={{
                                      left: `${placement.storyTime}%`,
                                      top: `${top}rem`,
                                    }}
                                    type="button"
                                  >
                                    <strong>{placement.plotBeat.title}</strong>
                                    <span>
                                      {placement.storyTimeEnd === null
                                        ? `${placement.storyTime}`
                                        : `${placement.storyTime}–${
                                            placement.storyTimeEnd
                                          }`}
                                    </span>
                                  </button>
                                </Fragment>
                              );
                            })}
                          </div>
                          {unassigned.length > 0 && (
                            <div className="plot-story-time-unassigned">
                              <p>시간 미배정 · 시간 축으로 끌어 배치</p>
                              <ul>
                                {unassigned.map((placement) => (
                                  <li key={placement.plotPlacementId}>
                                    <button
                                      data-plot-placement-id={
                                        placement.plotPlacementId
                                      }
                                      data-story-time-unassigned="true"
                                      data-story-time-drag-source={
                                        storyTimePreview?.plotPlacementId ===
                                          placement.plotPlacementId
                                          ? "true"
                                          : "false"
                                      }
                                      disabled={
                                        busy ||
                                        placement.plotBeat.retiredAt !== null
                                      }
                                      onClick={() => {
                                        if (
                                          suppressClickRef.current ===
                                            placement.plotPlacementId
                                        ) {
                                          suppressClickRef.current = null;
                                          return;
                                        }
                                        input.onSelect(placement.plotBeatId);
                                      }}
                                      onPointerDown={(event) =>
                                        handleStoryTimePointerDown(
                                          event,
                                          placement,
                                        )
                                      }
                                      type="button"
                                    >
                                      {placement.plotBeat.title}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </section>
                      );
                    })}
              </section>
            )}
            {input.plots.length === 0 && (
              <p className="character-manager-empty plot-manager-empty">
                이 작품에 등록한 플롯이 없습니다.
              </p>
            )}
            {input.plots.length > 0 && visiblePlots.length === 0 && (
              <p className="character-manager-empty plot-manager-empty">
                검색 결과가 없습니다.
              </p>
            )}
            <ul>
              {visiblePlots.map((plot) => (
                <li key={plot.plotThreadId}>
                  <button
                    aria-pressed={plot.plotThreadId === selectedPlot?.plotThreadId}
                    disabled={busy}
                    onClick={() => input.onSelect(plot.plotThreadId)}
                    type="button"
                  >
                    <strong>{plot.title}</strong>
                    <span>{plot.stage || "단계 미입력"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-label="플롯 상세 편집"
            className="character-manager-detail plot-manager-detail"
          >
            <PlotFields
              actionState={input.actionState}
              key={selectedPlot?.plotThreadId ?? "new-plot"}
              onCreate={input.onCreate}
              onRetire={input.onRetire}
              onUpdate={input.onUpdate}
              plot={selectedPlot}
            />
            {selectedPlot !== null && (
              <section
                aria-label="플롯 연결 사건"
                className="plot-source-panel plot-event-panel"
              >
                <header>
                  <div>
                    <span>연결 사건</span>
                    <strong>{selectedEventLinks.length}</strong>
                  </div>
                  <div className="plot-event-create-actions">
                    <button
                      disabled={busy}
                      onClick={() => input.onCreateEvent(selectedPlot, false)}
                      type="button"
                    >
                      {input.actionState === "creating-event"
                        ? "만드는 중"
                        : "예정 사건 만들기"}
                    </button>
                    <button
                      disabled={busy || !input.canCreateEventFromSelection}
                      onClick={() => input.onCreateEvent(selectedPlot, true)}
                      type="button"
                    >
                      현재 선택으로 사건 만들기
                    </button>
                  </div>
                </header>
                <div className="plot-event-link-controls">
                  <select
                    aria-label="연결할 사건"
                    disabled={busy || availableEventBlocks.length === 0}
                    onChange={(event) => setEventBlockId(event.target.value)}
                    value={eventBlockId}
                  >
                    <option value="">사건 선택</option>
                    {availableEventBlocks.map((eventBlock) => (
                      <option
                        key={eventBlock.eventBlockId}
                        value={eventBlock.eventBlockId}
                      >
                        {eventBlock.title}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="사건 연결 역할"
                    disabled={busy}
                    onChange={(event) =>
                      setEventRole(event.target.value as PlotEventLinkRole)
                    }
                    value={eventRole}
                  >
                    <option value="primary">주 사건</option>
                    <option value="supporting">보조 사건</option>
                  </select>
                  <button
                    disabled={busy || eventBlockId.length === 0}
                    onClick={() => {
                      const eventBlock = availableEventBlocks.find(
                        (candidate) => candidate.eventBlockId === eventBlockId,
                      );
                      if (eventBlock !== undefined) {
                        input.onLinkEvent(
                          selectedPlot,
                          eventBlock.eventBlockId,
                          eventRole,
                        );
                        setEventBlockId("");
                      }
                    }}
                    type="button"
                  >
                    {input.actionState === "linking-event" ? "연결 중" : "사건 연결"}
                  </button>
                </div>
                {selectedEventLinks.length === 0 ? (
                  <p>이 플롯에 연결된 사건이 없습니다.</p>
                ) : (
                  <ul className="plot-event-link-list">
                    {selectedEventLinks.map((link) => (
                      <li key={link.plotEventLinkId}>
                        <div>
                          <strong>{link.eventTitle}</strong>
                          <span>
                            {link.role === "primary" ? "주 사건" : "보조 사건"}
                          </span>
                          {link.titleMatch === "mismatched" && (
                            <span className="plot-event-title-mismatch">
                              제목이 서로 다름
                            </span>
                          )}
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => input.onUnlinkEvent(link)}
                          type="button"
                        >
                          {input.actionState === "unlinking-event"
                            ? "해제 중"
                            : "연결 해제"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {selectedPlot !== null && (
              <section
                aria-label="플롯 원문 출처"
                className="plot-source-panel"
              >
                <header>
                  <div>
                    <span>원문 출처</span>
                    <strong>
                      {selectedSource === null
                        ? "연결 안 됨"
                        : input.documentLabels[selectedSource.sourceDocumentId] ??
                          "원본 회차"}
                    </strong>
                  </div>
                  <button
                    disabled={busy || !input.canLinkSource}
                    onClick={() => input.onLinkSource(selectedPlot)}
                    type="button"
                  >
                    {input.actionState === "linking-source"
                      ? "연결 중"
                      : selectedSource === null
                        ? "현재 선택 연결"
                        : "현재 선택으로 교체"}
                  </button>
                </header>
                {selectedSource === null ? (
                  <p>원고에서 정확한 범위를 선택해 이 플롯의 출처로 연결합니다.</p>
                ) : (
                  <>
                    <blockquote>{selectedSource.exactText}</blockquote>
                    <div className="plot-source-actions">
                      <span>
                        {selectedSource.integrity === "resolved"
                          ? "정확한 위치 확인됨"
                          : "원문 위치 검토 필요"}
                      </span>
                      <button
                        disabled={
                          busy ||
                          selectedSource.integrity !== "resolved" ||
                          selectedSource.range === null
                        }
                        onClick={() => input.onOpenSource(selectedSource)}
                        type="button"
                      >
                        원문 열기
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </section>
        </div>

        {input.error !== null && (
          <p className="character-manager-error plot-manager-error" role="alert">
            {input.error}
          </p>
        )}
      </section>
    </div>
  );
}
