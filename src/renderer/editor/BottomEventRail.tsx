import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";

import type {
  EventRailEventProjection,
  EventRailProjection,
  EventRailSourceLocationProjection,
} from "../../application/structure/event-rail-projection";
import {
  compareEventOutlineOrderKeys,
  createEventBlockMoveTarget,
  type EventBlockMoveTarget,
} from "../../application/structure/event-outline-order";
import type { EventBlockProjection } from "../../application/structure/event-block-contract";
import type { EntityId } from "../../domain/writing";

export function BottomEventRail(input: {
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly cursorOffset: number | null;
  readonly eventBusy: boolean;
  readonly onMoveEvent: (
    eventBlock: EventBlockProjection,
    target: EventBlockMoveTarget,
  ) => void;
  readonly onOpenSource: (location: EventRailSourceLocationProjection) => void;
  readonly projection: EventRailProjection | null;
}) {
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const [draggedEventId, setDraggedEventId] = useState<
    EntityId<"EventBlock"> | null
  >(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const suppressClickRef = useRef(false);
  const events = useMemo(() => {
    if (input.projection === null) return [];
    return [...[
      ...input.projection.manuscriptEvents,
      ...input.projection.unpositionedEvents,
    ]].sort((left, right) =>
      compareEventOutlineOrderKeys(
        left.eventBlock.outlineOrderKey,
        right.eventBlock.outlineOrderKey,
      ) || left.eventBlock.eventBlockId.localeCompare(
        right.eventBlock.eventBlockId,
      ));
  }, [input.projection]);
  const remainingDuringDrag = useMemo(
    () => draggedEventId === null
      ? events
      : events.filter(
          (event) => event.eventBlock.eventBlockId !== draggedEventId,
        ),
    [draggedEventId, events],
  );
  const dropBeforeEventId = dropIndex === null
    ? null
    : remainingDuringDrag[dropIndex]?.eventBlock.eventBlockId ?? null;
  const dropAtEnd =
    draggedEventId !== null &&
    dropIndex === remainingDuringDrag.length;
  const expanded = expandedOverride ?? events.length > 0;
  const currentEventId = useMemo(() => {
    if (input.activeDocumentId === null || input.cursorOffset === null) {
      return null;
    }
    return input.projection?.manuscriptEvents.find((event) =>
      event.primaryLocation?.documentId === input.activeDocumentId &&
      event.primaryLocation.integrity === "resolved" &&
      event.primaryLocation.range !== null &&
      event.primaryLocation.range.from <= input.cursorOffset! &&
      input.cursorOffset! < event.primaryLocation.range.to
    )?.eventBlock.eventBlockId ?? null;
  }, [input.activeDocumentId, input.cursorOffset, input.projection]);

  function clearDrag(): void {
    setDraggedEventId(null);
    setDropIndex(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function readDropIndex(event: DragEvent<HTMLDivElement>): number {
    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        ".bottom-event-card[data-event-block-id]",
      ),
    ).filter(
      (card) => card.dataset.eventBlockId !== draggedEventId,
    );
    const firstAfterPointer = cards.findIndex((card) => {
      const bounds = card.getBoundingClientRect();
      return event.clientX < bounds.left + bounds.width / 2;
    });
    return firstAfterPointer < 0 ? cards.length : firstAfterPointer;
  }

  function startDrag(
    event: DragEvent<HTMLButtonElement>,
    railEvent: EventRailEventProjection,
  ): void {
    if (input.eventBusy) {
      event.preventDefault();
      return;
    }
    suppressClickRef.current = true;
    const eventBlockId = railEvent.eventBlock.eventBlockId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", eventBlockId);
    setDraggedEventId(eventBlockId);
    const currentIndex = events.findIndex(
      (candidate) => candidate.eventBlock.eventBlockId === eventBlockId,
    );
    setDropIndex(Math.max(0, currentIndex));
  }

  function completeDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (draggedEventId === null || dropIndex === null || input.eventBusy) {
      clearDrag();
      return;
    }
    const moved = events.find(
      (candidate) => candidate.eventBlock.eventBlockId === draggedEventId,
    );
    if (moved !== undefined) {
      input.onMoveEvent(
        moved.eventBlock,
        createEventBlockMoveTarget(
          events.map((candidate) => candidate.eventBlock),
          draggedEventId,
          dropIndex,
        ),
      );
    }
    clearDrag();
  }

  return (
    <section
      aria-label="사건 레일"
      className={expanded ? "bottom-event-rail is-expanded" : "bottom-event-rail"}
    >
      <header className="bottom-event-rail-header">
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "사건 레일 접기" : "사건 레일 펼치기"}
          className="bottom-event-rail-toggle"
          onClick={() => setExpandedOverride(!expanded)}
          type="button"
        >
          <span>
            <strong>사건</strong>
            <span>{events.length}</span>
          </span>
          {expanded
            ? <ChevronDown aria-hidden="true" size={15} />
            : <ChevronUp aria-hidden="true" size={15} />}
        </button>
      </header>
      {expanded && (
        <div className="bottom-event-rail-content">
          {input.projection !== null && input.projection.documents.length > 0 && (
            <div aria-label="회차 구간" className="bottom-event-rail-documents">
              {input.projection.documents.map((document) => {
                const count = input.projection!.manuscriptEvents.filter(
                  (event) => event.primaryLocation?.documentId === document.documentId,
                ).length;
                return (
                  <span
                    className={
                      document.documentId === input.activeDocumentId
                        ? "is-active"
                        : undefined
                    }
                    key={document.documentId}
                  >
                    {document.title} · {count}
                  </span>
                );
              })}
            </div>
          )}
          {events.length === 0 ? (
            <p className="bottom-event-rail-empty">저장된 사건이 없습니다.</p>
          ) : (
            <div
              className={[
                "bottom-event-rail-track",
                draggedEventId === null ? null : "is-dragging",
                dropAtEnd ? "is-drop-at-end" : null,
              ].filter((value): value is string => value !== null).join(" ")}
              onDragOver={(event) => {
                if (draggedEventId === null || input.eventBusy) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(readDropIndex(event));
              }}
              onDrop={completeDrop}
            >
              {events.map((event) => {
                const source = event.primaryLocation;
                const navigable =
                  source !== null &&
                  source.integrity === "resolved" &&
                  source.range !== null;
                return (
                  <button
                    aria-label={
                      navigable
                        ? undefined
                        : `${event.eventBlock.title}, 원고 위치 없음, 드래그하여 사건 순서 이동`
                    }
                    aria-current={
                      event.eventBlock.eventBlockId === currentEventId
                        ? "location"
                        : undefined
                    }
                    className={[
                      "bottom-event-card",
                      event.eventBlock.eventBlockId === currentEventId
                        ? "is-current"
                        : null,
                      !navigable ? "is-unpositioned" : null,
                      event.eventBlock.eventBlockId === draggedEventId
                        ? "is-dragging"
                        : null,
                      event.eventBlock.eventBlockId === dropBeforeEventId
                        ? "is-drop-before"
                        : null,
                    ].filter((value): value is string => value !== null).join(" ")}
                    data-event-block-id={event.eventBlock.eventBlockId}
                    data-source-navigable={String(navigable)}
                    draggable={!input.eventBusy}
                    key={event.eventBlock.eventBlockId}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      if (navigable) input.onOpenSource(source);
                    }}
                    onDragEnd={clearDrag}
                    onDragStart={(dragEvent) => startDrag(dragEvent, event)}
                    type="button"
                  >
                    <span>
                      {source === null ? "미배치" : source.documentTitle}
                    </span>
                    <strong title={event.eventBlock.title}>
                      {event.eventBlock.title}
                    </strong>
                    <small>
                      {event.eventBlock.note.trim().length > 0
                        ? event.eventBlock.note
                        : source === null
                          ? "원고 위치 없음"
                          : "원고에서 열기"}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
