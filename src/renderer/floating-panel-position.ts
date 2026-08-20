import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type FloatingPanelPosition = Readonly<{
  x: number;
  y: number;
}>;

export function clampFloatingPanelPosition(input: Readonly<{
  margin: number;
  panelHeight: number;
  panelWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  x: number;
  y: number;
}>): FloatingPanelPosition {
  const maximumX = Math.max(
    input.margin,
    input.viewportWidth - input.panelWidth - input.margin,
  );
  const maximumY = Math.max(
    input.margin,
    input.viewportHeight - input.panelHeight - input.margin,
  );
  return Object.freeze({
    x: Math.min(maximumX, Math.max(input.margin, input.x)),
    y: Math.min(maximumY, Math.max(input.margin, input.y)),
  });
}

function readFloatingPanelPosition(storageKey: string): FloatingPanelPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return null;
    const parsed = JSON.parse(stored) as { x?: unknown; y?: unknown };
    return typeof parsed.x === "number" && Number.isFinite(parsed.x) &&
      typeof parsed.y === "number" && Number.isFinite(parsed.y)
      ? Object.freeze({ x: parsed.x, y: parsed.y })
      : null;
  } catch {
    return null;
  }
}

function saveFloatingPanelPosition(
  storageKey: string,
  position: FloatingPanelPosition,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(position));
}

export function useFloatingPanelPosition<T extends HTMLElement>(
  storageKey: string,
) {
  const panelRef = useRef<T | null>(null);
  const [position, setPosition] = useState<FloatingPanelPosition | null>(() =>
    readFloatingPanelPosition(storageKey)
  );
  const dragRef = useRef<Readonly<{
    lastPosition: FloatingPanelPosition | null;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  }> | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampPosition = (candidate: FloatingPanelPosition) => {
    const panel = panelRef.current;
    if (panel === null) return candidate;
    const rectangle = panel.getBoundingClientRect();
    return clampFloatingPanelPosition({
      margin: 8,
      panelHeight: rectangle.height,
      panelWidth: rectangle.width,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      x: candidate.x,
      y: candidate.y,
    });
  };

  useBrowserLayoutEffect(() => {
    setPosition((current) => current === null ? null : clampPosition(current));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => current === null ? null : clampPosition(current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || panelRef.current === null) return;
    const rectangle = panelRef.current.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = Object.freeze({
      lastPosition: null,
      offsetX: event.clientX - rectangle.left,
      offsetY: event.clientY - rectangle.top,
      pointerId: event.pointerId,
    });
    setDragging(true);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const next = clampPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    });
    dragRef.current = Object.freeze({ ...drag, lastPosition: next });
    setPosition(next);
    event.preventDefault();
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    const current = drag.lastPosition;
    if (current !== null) saveFloatingPanelPosition(storageKey, current);
  };

  const style = useMemo<CSSProperties | undefined>(() =>
    position === null
      ? undefined
      : {
          bottom: "auto",
          left: `${position.x}px`,
          right: "auto",
          top: `${position.y}px`,
          transform: "none",
        },
  [position]);

  return {
    dragHandleProps: {
      onPointerCancel: finishDrag,
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: finishDrag,
    },
    dragging,
    moved: position !== null,
    panelRef,
    position,
    style,
  } as const;
}
