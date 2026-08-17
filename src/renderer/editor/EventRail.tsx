import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../application/structure/event-block-contract";
import type {
  EventRailEventProjection,
  EventRailProjection,
  EventRailSourceLocationProjection,
} from "../../application/structure/event-rail-projection";
import type {
  PlotPlacementProjection,
} from "../../application/plots/plot-board-contract";
import {
  createPlotPlacementMoveTarget,
  type PlotPlacementMoveTarget,
} from "./PlotManagerDialog";

export type EventRailMode = "manuscript" | "plot";

export function describeEventRailPositionDifference(
  manuscriptPosition: number | null,
  plotPosition: number,
): string {
  if (manuscriptPosition === null) {
    return `원고 미연결 · 플롯 ${plotPosition}`;
  }
  const difference = plotPosition - manuscriptPosition;
  if (difference === 0) {
    return `원고 ${manuscriptPosition} · 플롯 ${plotPosition} · 순서 일치`;
  }
  return `원고 ${manuscriptPosition} · 플롯 ${plotPosition} · 플롯 ${
    difference > 0 ? `+${difference}` : difference
  }`;
}

function describeIntegrity(
  integrity: EventRailSourceLocationProjection["integrity"],
): string {
  if (integrity === "resolved") return "범위 확인됨";
  if (integrity === "needsReview") return "범위 검토 필요";
  return "범위 연결 손상";
}

function describeLocation(
  location: EventRailSourceLocationProjection | null,
): string {
  if (location === null) return "원고 미연결";
  const range = location.range === null
    ? "위치 없음"
    : `${location.range.from}–${location.range.to}`;
  return `${location.documentTitle} · ${range} · ${describeIntegrity(
    location.integrity,
  )}`;
}

function findSource(
  projection: EventRailProjection,
  event: EventRailEventProjection,
): EventSourceProjection | undefined {
  return event.primaryLocation === null
    ? undefined
    : projection.eventSources.find(
        (source) =>
          source.eventSourceId === event.primaryLocation?.eventSourceId,
      );
}

function SourceActions(input: {
  readonly busy: boolean;
  readonly event: EventRailEventProjection;
  readonly projection: EventRailProjection;
  readonly onLinkSource: (eventBlock: EventBlockProjection) => void;
  readonly onReplaceSource: (source: EventSourceProjection) => void;
  readonly onRetireSource: (source: EventSourceProjection) => void;
}) {
  const source = findSource(input.projection, input.event);
  return source === undefined ? (
    <button
      disabled={input.busy}
      onClick={() => input.onLinkSource(input.event.eventBlock)}
      type="button"
    >
      현재 선택 연결
    </button>
  ) : (
    <>
      <button
        disabled={input.busy}
        onClick={() => input.onReplaceSource(source)}
        type="button"
      >
        현재 선택으로 교체
      </button>
      <button
        disabled={input.busy}
        onClick={() => input.onRetireSource(source)}
        type="button"
      >
        원고 근거 해제
      </button>
    </>
  );
}

function ManuscriptEventRow(input: {
  readonly event: EventRailEventProjection;
  readonly projection: EventRailProjection;
  readonly eventBusy: boolean;
  readonly plotBusy: boolean;
  readonly onOpenSource: (
    location: EventRailSourceLocationProjection,
  ) => void;
  readonly onCreatePlot: (eventBlock: EventBlockProjection) => void;
  readonly onLinkSource: (eventBlock: EventBlockProjection) => void;
  readonly onReplaceSource: (source: EventSourceProjection) => void;
  readonly onRetireSource: (source: EventSourceProjection) => void;
}) {
  const location = input.event.primaryLocation;
  const hasActivePlacement = input.event.plots.some(
    (plot) => plot.plotPlacementId !== null,
  );
  return (
    <li>
      <button
        className="event-rail-source-button"
        disabled={
          location === null ||
          location.integrity !== "resolved" ||
          location.range === null
        }
        onClick={() => {
          if (location !== null) input.onOpenSource(location);
        }}
        type="button"
      >
        <strong>{input.event.eventBlock.title}</strong>
        <span>{describeLocation(location)}</span>
      </button>
      <div className="work-structure-row-actions">
        <button
          disabled={input.plotBusy}
          onClick={() => input.onCreatePlot(input.event.eventBlock)}
          type="button"
        >
          {hasActivePlacement ? "연결 플롯 열기" : "플롯으로 만들기"}
        </button>
        <SourceActions
          busy={input.eventBusy}
          event={input.event}
          onLinkSource={input.onLinkSource}
          onReplaceSource={input.onReplaceSource}
          onRetireSource={input.onRetireSource}
          projection={input.projection}
        />
      </div>
    </li>
  );
}

export function EventRail(input: {
  readonly projection: EventRailProjection | null;
  readonly mode: EventRailMode;
  readonly eventBusy: boolean;
  readonly plotBusy: boolean;
  readonly onModeChange: (mode: EventRailMode) => void;
  readonly onOpenSource: (
    location: EventRailSourceLocationProjection,
  ) => void;
  readonly onCreatePlot: (eventBlock: EventBlockProjection) => void;
  readonly onLinkSource: (eventBlock: EventBlockProjection) => void;
  readonly onReplaceSource: (source: EventSourceProjection) => void;
  readonly onRetireSource: (source: EventSourceProjection) => void;
  readonly onMovePlacement: (
    placement: PlotPlacementProjection,
    target: PlotPlacementMoveTarget,
  ) => void;
}) {
  const projection = input.projection;
  const count = projection === null
    ? 0
    : input.mode === "manuscript"
      ? projection.manuscriptEvents.length
        + projection.unpositionedEvents.length
      : projection.plotCards.length + projection.unplottedEvents.length;

  return (
    <section
      aria-label="현재 회차 사건"
      className="event-block-list event-rail"
    >
      <header>
        <div>
          <h4>작품 사건</h4>
          <small>작품 전체</small>
        </div>
        <span>{count}</span>
      </header>
      <div aria-label="사건 순서" className="event-rail-mode-switch">
        <button
          aria-pressed={input.mode === "manuscript"}
          onClick={() => input.onModeChange("manuscript")}
          type="button"
        >
          원고 순서
        </button>
        <button
          aria-pressed={input.mode === "plot"}
          onClick={() => input.onModeChange("plot")}
          type="button"
        >
          플롯 순서
        </button>
      </div>
      {projection === null ? (
        <p className="empty-event-list">사건 순서를 불러오는 중입니다.</p>
      ) : input.mode === "manuscript" ? (
        <>
          {projection.manuscriptEvents.length === 0 ? (
            <p className="empty-event-list">원고에 연결된 사건이 없습니다.</p>
          ) : (
            <ol className="event-rail-list event-rail-manuscript-list">
              {projection.manuscriptEvents.map((event) => (
                <ManuscriptEventRow
                  event={event}
                  eventBusy={input.eventBusy}
                  key={event.eventBlock.eventBlockId}
                  onCreatePlot={input.onCreatePlot}
                  onLinkSource={input.onLinkSource}
                  onOpenSource={input.onOpenSource}
                  onReplaceSource={input.onReplaceSource}
                  onRetireSource={input.onRetireSource}
                  plotBusy={input.plotBusy}
                  projection={projection}
                />
              ))}
            </ol>
          )}
          {projection.unpositionedEvents.length > 0 && (
            <div className="event-rail-unplotted event-rail-unpositioned">
              <h5>원고 위치 없는 사건</h5>
              <ul className="event-rail-list">
                {projection.unpositionedEvents.map((event) => (
                  <ManuscriptEventRow
                    event={event}
                    eventBusy={input.eventBusy}
                    key={event.eventBlock.eventBlockId}
                    onCreatePlot={input.onCreatePlot}
                    onLinkSource={input.onLinkSource}
                    onOpenSource={input.onOpenSource}
                    onReplaceSource={input.onReplaceSource}
                    onRetireSource={input.onRetireSource}
                    plotBusy={input.plotBusy}
                    projection={projection}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          {projection.plotCards.length === 0 ? (
            <p className="empty-event-list">플롯 보드에 놓인 카드가 없습니다.</p>
          ) : (
            <ol className="event-rail-list event-rail-plot-list">
              {projection.plotCards.map((card) => {
                const lane = projection.board.lanes.find(
                  (candidate) =>
                    candidate.plotLaneId === card.placement.plotLaneId,
                );
                const lanePlacements = lane?.placements ?? [];
                const laneIndex = lanePlacements.findIndex(
                  (placement) =>
                    placement.plotPlacementId ===
                    card.placement.plotPlacementId,
                );
                const move = (insertionIndex: number) => {
                  if (lane === undefined) return;
                  input.onMovePlacement(
                    card.placement,
                    createPlotPlacementMoveTarget(
                      lanePlacements,
                      card.placement.plotPlacementId,
                      lane.plotLaneId,
                      insertionIndex,
                    ),
                  );
                };
                return (
                  <li key={card.placement.plotPlacementId}>
                    <div className="event-rail-plot-heading">
                      <strong>{card.placement.plotBeat.title}</strong>
                      <span>플롯 {card.plotPosition}</span>
                    </div>
                    <div className="event-rail-move-actions">
                      <button
                        aria-label={`${card.placement.plotBeat.title} 앞쪽으로 이동`}
                        disabled={input.plotBusy || laneIndex <= 0}
                        onClick={() => move(laneIndex - 1)}
                        type="button"
                      >
                        앞
                      </button>
                      <button
                        aria-label={`${card.placement.plotBeat.title} 뒤쪽으로 이동`}
                        disabled={
                          input.plotBusy ||
                          laneIndex < 0 ||
                          laneIndex >= lanePlacements.length - 1
                        }
                        onClick={() => move(laneIndex + 1)}
                        type="button"
                      >
                        뒤
                      </button>
                    </div>
                    {card.events.length === 0 ? (
                      <p>연결된 사건이 없습니다.</p>
                    ) : (
                      <ul className="event-rail-card-events">
                        {card.events.map((event) => (
                          <li key={event.eventBlock.eventBlockId}>
                            <button
                              className="event-rail-source-button"
                              disabled={
                                event.primaryLocation === null ||
                                event.primaryLocation.integrity !== "resolved" ||
                                event.primaryLocation.range === null
                              }
                              onClick={() => {
                                if (event.primaryLocation !== null) {
                                  input.onOpenSource(event.primaryLocation);
                                }
                              }}
                              type="button"
                            >
                              <strong>{event.eventBlock.title}</strong>
                              <span>
                                {describeEventRailPositionDifference(
                                  event.manuscriptPosition,
                                  card.plotPosition,
                                )}
                              </span>
                              <span>{describeLocation(event.primaryLocation)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="event-rail-unplotted">
            <h5>보드에 없는 사건</h5>
            {projection.unplottedEvents.length === 0 ? (
              <p className="empty-event-list">모든 사건이 보드에 놓였습니다.</p>
            ) : (
              <ul className="event-rail-list">
                {projection.unplottedEvents.map((event) => (
                  <li key={event.eventBlock.eventBlockId}>
                    <button
                      className="event-rail-source-button"
                      disabled={
                        event.primaryLocation === null ||
                        event.primaryLocation.integrity !== "resolved" ||
                        event.primaryLocation.range === null
                      }
                      onClick={() => {
                        if (event.primaryLocation !== null) {
                          input.onOpenSource(event.primaryLocation);
                        }
                      }}
                      type="button"
                    >
                      <strong>{event.eventBlock.title}</strong>
                      <span>{describeLocation(event.primaryLocation)}</span>
                    </button>
                    <div className="work-structure-row-actions">
                      <button
                        disabled={input.plotBusy}
                        onClick={() => input.onCreatePlot(event.eventBlock)}
                        type="button"
                      >
                        보드에 놓기
                      </button>
                      <SourceActions
                        busy={input.eventBusy}
                        event={event}
                        onLinkSource={input.onLinkSource}
                        onReplaceSource={input.onReplaceSource}
                        onRetireSource={input.onRetireSource}
                        projection={projection}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
