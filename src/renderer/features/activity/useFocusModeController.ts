import { useCallback, useMemo, useState } from "react";

import type { FocusModePreferences } from "../../../application/settings/ui-preferences";
import {
  FOCUS_TYPEWRITER_POSITION_DEFAULT_PERCENT,
  FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
  FOCUS_TYPEWRITER_POSITION_MIN_PERCENT,
} from "../../editor/FocusModeToolbar";

const FOCUS_TYPEWRITER_POSITION_STORAGE_KEY =
  "eum_focus_typewriter_position_percent";

export function useFocusModeController(input: Readonly<{
  initialPreferences?: FocusModePreferences;
  onPreferencesChange?: (preferences: FocusModePreferences) => void;
  storage: Pick<Storage, "getItem" | "setItem">;
}>) {
  const [focusMode, setFocusMode] = useState(false);
  const [focusContentWidthPx, setFocusContentWidthPx] = useState(
    input.initialPreferences?.contentWidthPx ?? 700,
  );
  const [focusZoomPercent, setFocusZoomPercent] = useState(
    input.initialPreferences?.zoomPercent ?? 100,
  );
  const [focusCurrentBlockHighlight, setFocusCurrentBlockHighlight] =
    useState(input.initialPreferences?.currentBlockHighlight ?? false);
  const [focusTypewriterMode, setFocusTypewriterMode] = useState(
    input.initialPreferences?.typewriterMode ?? false,
  );
  const [focusTypewriterPositionPercent, setFocusTypewriterPositionPercent] =
    useState(() => {
      if (input.initialPreferences !== undefined) {
        return input.initialPreferences.typewriterPositionPercent;
      }
      const raw = input.storage.getItem(
        FOCUS_TYPEWRITER_POSITION_STORAGE_KEY,
      );
      const stored = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(stored)
        ? Math.min(
            FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
            Math.max(FOCUS_TYPEWRITER_POSITION_MIN_PERCENT, stored),
          )
        : FOCUS_TYPEWRITER_POSITION_DEFAULT_PERCENT;
    });

  const persistFocusModePreferences = useCallback((
    changes: Partial<FocusModePreferences>,
  ) => {
    const next = Object.freeze({
      contentWidthPx: focusContentWidthPx,
      zoomPercent: focusZoomPercent,
      currentBlockHighlight: focusCurrentBlockHighlight,
      typewriterMode: focusTypewriterMode,
      typewriterPositionPercent: focusTypewriterPositionPercent,
      ...changes,
    });
    input.onPreferencesChange?.(next);
  }, [focusContentWidthPx, focusCurrentBlockHighlight, focusTypewriterMode, focusTypewriterPositionPercent, focusZoomPercent, input]);

  const changeFocusContentWidth = useCallback((value: number) => {
    setFocusContentWidthPx(value);
    persistFocusModePreferences({ contentWidthPx: value });
  }, [persistFocusModePreferences]);
  const changeFocusCurrentBlockHighlight = useCallback((value: boolean) => {
    setFocusCurrentBlockHighlight(value);
    persistFocusModePreferences({ currentBlockHighlight: value });
  }, [persistFocusModePreferences]);
  const changeFocusTypewriterMode = useCallback((value: boolean) => {
    setFocusTypewriterMode(value);
    persistFocusModePreferences({ typewriterMode: value });
  }, [persistFocusModePreferences]);
  const changeFocusTypewriterPosition = useCallback((position: number) => {
    const next = Math.min(
      FOCUS_TYPEWRITER_POSITION_MAX_PERCENT,
      Math.max(FOCUS_TYPEWRITER_POSITION_MIN_PERCENT, position),
    );
    input.storage.setItem(
      FOCUS_TYPEWRITER_POSITION_STORAGE_KEY,
      String(next),
    );
    setFocusTypewriterPositionPercent(next);
    persistFocusModePreferences({ typewriterPositionPercent: next });
  }, [input.storage, persistFocusModePreferences]);
  const changeFocusZoom = useCallback((value: number) => {
    setFocusZoomPercent(value);
    persistFocusModePreferences({ zoomPercent: value });
  }, [persistFocusModePreferences]);
  const changeFocusMode = useCallback((enabled: boolean) => {
    setFocusMode(enabled);
  }, []);
  const toggleFocusMode = useCallback(() => {
    setFocusMode((current) => !current);
  }, []);
  const exitFocusMode = useCallback(() => {
    setFocusMode(false);
  }, []);

  return useMemo(() => ({
    focusMode,
    focusContentWidthPx,
    focusZoomPercent,
    focusCurrentBlockHighlight,
    focusTypewriterMode,
    focusTypewriterPositionPercent,
    changeFocusMode,
    toggleFocusMode,
    exitFocusMode,
    changeFocusContentWidth,
    changeFocusCurrentBlockHighlight,
    changeFocusTypewriterMode,
    changeFocusTypewriterPosition,
    changeFocusZoom,
  }), [
    changeFocusContentWidth,
    changeFocusCurrentBlockHighlight,
    changeFocusMode,
    changeFocusTypewriterMode,
    changeFocusTypewriterPosition,
    changeFocusZoom,
    exitFocusMode,
    focusContentWidthPx,
    focusCurrentBlockHighlight,
    focusMode,
    focusTypewriterMode,
    focusTypewriterPositionPercent,
    focusZoomPercent,
    toggleFocusMode,
  ]);
}
