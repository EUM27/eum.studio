import { ChevronDown, ChevronUp, X } from "lucide-react";
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
import type {
  EventBlockProjection,
  EventSourceProjection,
} from "../../application/structure/event-block-contract";
import type {
  SceneProjection,
  SceneProjectionList,
} from "../../application/structure/scene-projection";
import type { EntityId } from "../../domain/writing";

function bottomSceneDefaultGroupKey(scene: SceneProjection): string {
  return `scene:${scene.sceneKey}`;
}

export function BottomEventRail(input: {
  readonly activeDocumentId: EntityId<"Document"> | null;
  readonly cursorOffset: number | null;
  readonly documentTitles?: Readonly<Record<string, string>>;
  readonly eventBusy: boolean;
  readonly sceneBusy?: boolean;
  readonly onDetachEventRange?: (source: EventSourceProjection) => void;
  readonly onDeleteSceneGroup?: (scenes: readonly SceneProjection[]) => void;
  readonly onMoveEvent: (
    eventBlock: EventBlockProjection,
    target: EventBlockMoveTarget,
  ) => void;
  readonly onOpenSource: (location: EventRailSourceLocationProjection) => void;
  readonly onOpenScene?: (scene: SceneProjection) => void;
  readonly projection: EventRailProjection | null;
  readonly sceneProjection?: SceneProjectionList | null;
}) {
  const currentDocumentTitle = (documentId: string, fallback: string): string =>
    input.documentTitles?.[documentId] ?? fallback;
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
  const scenes = useMemo(
    () => [...(input.sceneProjection?.scenes ?? [])].sort(
      (left, right) =>
        left.documentIndex - right.documentIndex ||
        left.sceneIndex - right.sceneIndex ||
        left.sceneKey.localeCompare(right.sceneKey),
    ),
    [input.sceneProjection],
  );
  const sceneGroups = useMemo(() => {
    const groupKeyBySceneKey = new Map<string, string>();
    const identities = new Map<
      string,
      NonNullable<SceneProjection["sceneIdentity"]>
    >();
    for (const scene of scenes) {
      if (scene.sceneIdentity !== undefined) {
        identities.set(scene.sceneIdentity.sceneId, scene.sceneIdentity);
      }
    }
    for (const [sceneId, identity] of identities) {
      const continuations = new Map<string, SceneProjection>();
      for (const segment of identity.segments) {
        const candidates = scenes
          .filter(
            (scene) =>
              scene.documentId === segment.documentId &&
              scene.range !== null,
          )
          .sort(
            (left, right) =>
              left.range!.start - right.range!.start ||
              left.sceneIndex - right.sceneIndex,
          );
        const continuation = segment.range === null
          ? candidates[0]
          : candidates.find(
              (candidate) =>
                candidate.range!.start <= segment.range!.start &&
                segment.range!.start < candidate.range!.end,
            ) ?? candidates[0];
        if (continuation !== undefined) {
          continuations.set(continuation.sceneKey, continuation);
        }
      }
      const continuationScenes = [...continuations.values()];
      const ruleContinuation = continuationScenes.find(
        (scene) => scene.source === "rule",
      );
      const identityGroupKey = ruleContinuation === undefined
        ? `identity:${sceneId}`
        : bottomSceneDefaultGroupKey(ruleContinuation);
      for (const scene of continuationScenes) {
        groupKeyBySceneKey.set(scene.sceneKey, identityGroupKey);
      }
    }
    const groups = new Map<string, SceneProjection[]>();
    for (const scene of scenes) {
      const key = groupKeyBySceneKey.get(scene.sceneKey) ??
        bottomSceneDefaultGroupKey(scene);
      const group = groups.get(key);
      if (group === undefined) groups.set(key, [scene]);
      else group.push(scene);
    }
    return [...groups.entries()].map(([groupKey, groupedScenes]) => ({
      groupKey,
      scenes: groupedScenes,
    }));
  }, [scenes]);
  const dropBeforeEventId = dropIndex === null
    ? null
    : remainingDuringDrag[dropIndex]?.eventBlock.eventBlockId ?? null;
  const dropAtEnd =
    draggedEventId !== null &&
    dropIndex === remainingDuringDrag.length;
  const activeDocumentHasStructure =
    input.activeDocumentId !== null &&
    (
      events.some(
        (event) =>
          event.primaryLocation?.documentId === input.activeDocumentId,
      ) ||
      scenes.some(
        (scene) =>
          scene.documentId === input.activeDocumentId &&
          scene.range !== null &&
          scene.range.end > scene.range.start,
      )
    );
  const expanded = expandedOverride ?? activeDocumentHasStructure;
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
  const currentSceneGroupKey = useMemo(() => {
    if (input.activeDocumentId === null || input.cursorOffset === null) {
      return null;
    }
    const currentScene = scenes.find((scene) =>
      scene.documentId === input.activeDocumentId &&
      scene.integrity === "resolved" &&
      scene.range !== null &&
      scene.range.start <= input.cursorOffset! &&
      input.cursorOffset! < scene.range.end
    );
    return currentScene === undefined
      ? null
      : sceneGroups.find((group) =>
          group.scenes.some((scene) => scene.sceneKey === currentScene.sceneKey)
        )?.groupKey ?? null;
  }, [input.activeDocumentId, input.cursorOffset, sceneGroups, scenes]);

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
    event: DragEvent<HTMLDivElement>,
    railEvent: EventRailEventProjection,
  ): void {
    if (
      input.eventBusy ||
      (event.target instanceof Element &&
        event.target.closest(".bottom-range-detach") !== null)
    ) {
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
            <strong>장면</strong>
            <span>{sceneGroups.length}</span>
            <span aria-hidden="true">·</span>
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
                const eventCount = input.projection!.manuscriptEvents.filter(
                  (event) => event.primaryLocation?.documentId === document.documentId,
                ).length;
                const sceneCount = sceneGroups.filter(
                  (group) => group.scenes.some(
                    (scene) => scene.documentId === document.documentId,
                  ),
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
                    {currentDocumentTitle(document.documentId, document.title)} · 장면 {sceneCount} · 사건 {eventCount}
                  </span>
                );
              })}
            </div>
          )}
          {events.length === 0 && sceneGroups.length === 0 ? (
            <p className="bottom-event-rail-empty">저장된 장면과 사건이 없습니다.</p>
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
              {sceneGroups.length > 0 && (
                <span className="bottom-event-rail-track-label is-scene">
                  장면
                </span>
              )}
              {sceneGroups.map((group, groupIndex) => {
                const displaySceneNumber = groupIndex + 1;
                const scene =
                  group.scenes.find(
                    (candidate) =>
                      candidate.documentId === input.activeDocumentId,
                  ) ?? group.scenes[0]!;
                const groupedDocuments = group.scenes.filter(
                  (candidate, index, candidates) =>
                    candidates.findIndex(
                      (entry) => entry.documentId === candidate.documentId,
                    ) === index,
                );
                const navigable =
                  scene.integrity === "resolved" && scene.range !== null;
                const episodeSpan = groupedDocuments
                  .map((candidate) =>
                    currentDocumentTitle(
                      candidate.documentId,
                      candidate.documentTitle,
                    )
                  )
                  .join(" → ");
                const canDelete =
                  group.scenes.some((candidate) => candidate.range !== null) &&
                  input.onDeleteSceneGroup !== undefined &&
                  input.sceneBusy !== true;
                return (
                  <div
                    className="bottom-scene-card-shell"
                    data-scene-key={group.groupKey}
                    key={group.groupKey}
                  >
                    <button
                      aria-current={
                        group.groupKey === currentSceneGroupKey
                          ? "location"
                          : undefined
                      }
                      className={[
                        "bottom-scene-card",
                        group.groupKey === currentSceneGroupKey
                          ? "is-current"
                          : null,
                        !navigable ? "is-unresolved" : null,
                      ].filter((value): value is string => value !== null).join(" ")}
                      disabled={!navigable || input.onOpenScene === undefined}
                      onClick={() => input.onOpenScene?.(scene)}
                      type="button"
                    >
                      <span>{episodeSpan}</span>
                      <strong>장면 {displaySceneNumber}</strong>
                      <small>
                        {groupedDocuments.length > 1
                          ? `${groupedDocuments.length}개 회차 연결`
                          : scene.range === null
                          ? "범위 확인 필요"
                          : `${scene.range.start}–${scene.range.end}`}
                      </small>
                    </button>
                    <button
                      aria-label={`장면 ${displaySceneNumber} 삭제`}
                      className="bottom-range-detach is-scene"
                      disabled={!canDelete}
                      onClick={() => {
                        input.onDeleteSceneGroup?.(group.scenes);
                      }}
                      title="장면 삭제"
                      type="button"
                    >
                      <X aria-hidden="true" size={12} />
                    </button>
                  </div>
                );
              })}
              {events.length > 0 && (
                <span className="bottom-event-rail-track-label is-event">
                  사건
                </span>
              )}
              {events.map((event) => {
                const source = event.primaryLocation;
                const eventSource = source === null
                  ? undefined
                  : input.projection?.eventSources.find(
                      (candidate) =>
                        candidate.eventSourceId === source.eventSourceId,
                    );
                const navigable =
                  source !== null &&
                  source.integrity === "resolved" &&
                  source.range !== null;
                return (
                  <div
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
                    onDragEnd={clearDrag}
                    onDragStart={(dragEvent) => startDrag(dragEvent, event)}
                  >
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
                      className="bottom-event-card-open"
                      disabled={!navigable}
                      onClick={() => {
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        if (navigable) input.onOpenSource(source);
                      }}
                      type="button"
                    >
                      <span>
                        {source === null
                          ? "미배치"
                          : currentDocumentTitle(
                              source.documentId,
                              source.documentTitle,
                            )}
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
                    {eventSource !== undefined && (
                      <button
                        aria-label={`${event.eventBlock.title} 사건 범위 해제`}
                        className="bottom-range-detach is-event"
                        disabled={
                          input.eventBusy ||
                          input.onDetachEventRange === undefined
                        }
                        onClick={() => input.onDetachEventRange?.(eventSource)}
                        title="사건 범위 해제"
                        type="button"
                      >
                        <X aria-hidden="true" size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
