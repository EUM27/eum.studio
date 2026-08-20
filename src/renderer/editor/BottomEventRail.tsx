import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  EventRailProjection,
  EventRailSourceLocationProjection,
} from "../../application/structure/event-rail-projection";
import type { EntityId } from "../../domain/writing";

export function BottomEventRail(input: {
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly cursorOffset: number | null;
  readonly onOpenSource: (location: EventRailSourceLocationProjection) => void;
  readonly projection: EventRailProjection | null;
}) {
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const events = useMemo(() => {
    if (input.projection === null) return [];
    return [
      ...input.projection.manuscriptEvents,
      ...input.projection.unpositionedEvents,
    ];
  }, [input.projection]);
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
            <div className="bottom-event-rail-track">
              {events.map((event) => {
                const source = event.primaryLocation;
                const navigable =
                  source !== null &&
                  source.integrity === "resolved" &&
                  source.range !== null;
                return (
                  <button
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
                    ].filter((value): value is string => value !== null).join(" ")}
                    disabled={!navigable}
                    key={event.eventBlock.eventBlockId}
                    onClick={() => {
                      if (navigable) input.onOpenSource(source);
                    }}
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
