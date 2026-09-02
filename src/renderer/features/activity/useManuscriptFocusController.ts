import { useCallback, useMemo, useState } from "react";

import type { ManuscriptFocusPreferences } from "../../../application/settings/ui-preferences";
import {
  CURSOR_VIEWPORT_POSITION_DEFAULT_PERCENT,
  CURSOR_VIEWPORT_POSITION_MAX_PERCENT,
  CURSOR_VIEWPORT_POSITION_MIN_PERCENT,
} from "../../editor/ManuscriptFocusToolbar";
import {
  MANUSCRIPT_FOCUS_CURSOR_VIEWPORT_STORAGE_KEY,
} from "../settings/manuscript-focus-storage";

export function useManuscriptFocusController(input: Readonly<{
  initialPreferences?: ManuscriptFocusPreferences;
  onPreferencesChange?: (preferences: ManuscriptFocusPreferences) => void;
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">;
}>) {
  const [manuscriptFocusActive, setManuscriptFocusActiveState] = useState(false);
  const [manuscriptFocusWidthPx, setManuscriptFocusWidthPx] = useState(
    input.initialPreferences?.manuscriptWidthPx ?? 700,
  );
  const [manuscriptFocusTextScalePercent, setManuscriptFocusTextScalePercent] =
    useState(
      input.initialPreferences?.textScalePercent ?? 100,
    );
  const [highlightCurrentParagraph, setHighlightCurrentParagraph] = useState(
    input.initialPreferences?.highlightCurrentParagraph ?? false,
  );
  const [cursorFollowEnabled, setCursorFollowEnabled] = useState(
    input.initialPreferences?.cursorFollowEnabled ?? false,
  );
  const [cursorViewportPercent, setCursorViewportPercent] =
    useState(() => {
      if (input.initialPreferences !== undefined) {
        return input.initialPreferences.cursorViewportPercent;
      }
      const raw = input.storage.getItem(
        MANUSCRIPT_FOCUS_CURSOR_VIEWPORT_STORAGE_KEY,
      );
      const stored = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(stored)
        ? Math.min(
            CURSOR_VIEWPORT_POSITION_MAX_PERCENT,
            Math.max(CURSOR_VIEWPORT_POSITION_MIN_PERCENT, stored),
          )
        : CURSOR_VIEWPORT_POSITION_DEFAULT_PERCENT;
    });

  const persistManuscriptFocusPreferences = useCallback((
    changes: Partial<ManuscriptFocusPreferences>,
  ) => {
    const next = Object.freeze({
      manuscriptWidthPx: manuscriptFocusWidthPx,
      textScalePercent: manuscriptFocusTextScalePercent,
      highlightCurrentParagraph,
      cursorFollowEnabled,
      cursorViewportPercent,
      ...changes,
    });
    input.onPreferencesChange?.(next);
  }, [manuscriptFocusWidthPx, highlightCurrentParagraph, cursorFollowEnabled, cursorViewportPercent, manuscriptFocusTextScalePercent, input]);

  const changeManuscriptFocusWidth = useCallback((value: number) => {
    setManuscriptFocusWidthPx(value);
    persistManuscriptFocusPreferences({ manuscriptWidthPx: value });
  }, [persistManuscriptFocusPreferences]);
  const changeCurrentParagraphHighlight = useCallback((value: boolean) => {
    setHighlightCurrentParagraph(value);
    persistManuscriptFocusPreferences({ highlightCurrentParagraph: value });
  }, [persistManuscriptFocusPreferences]);
  const changeCursorFollow = useCallback((value: boolean) => {
    setCursorFollowEnabled(value);
    persistManuscriptFocusPreferences({ cursorFollowEnabled: value });
  }, [persistManuscriptFocusPreferences]);
  const changeCursorViewport = useCallback((position: number) => {
    const next = Math.min(
      CURSOR_VIEWPORT_POSITION_MAX_PERCENT,
      Math.max(CURSOR_VIEWPORT_POSITION_MIN_PERCENT, position),
    );
    input.storage.setItem(
      MANUSCRIPT_FOCUS_CURSOR_VIEWPORT_STORAGE_KEY,
      String(next),
    );
    setCursorViewportPercent(next);
    persistManuscriptFocusPreferences({ cursorViewportPercent: next });
  }, [input.storage, persistManuscriptFocusPreferences]);
  const changeManuscriptTextScale = useCallback((value: number) => {
    setManuscriptFocusTextScalePercent(value);
    persistManuscriptFocusPreferences({ textScalePercent: value });
  }, [persistManuscriptFocusPreferences]);
  const setManuscriptFocusActive = useCallback((enabled: boolean) => {
    setManuscriptFocusActiveState(enabled);
  }, []);
  const toggleManuscriptFocus = useCallback(() => {
    setManuscriptFocusActiveState((current) => !current);
  }, []);
  const exitManuscriptFocus = useCallback(() => {
    setManuscriptFocusActiveState(false);
  }, []);

  return useMemo(() => ({
    manuscriptFocusActive,
    manuscriptFocusWidthPx,
    manuscriptFocusTextScalePercent,
    highlightCurrentParagraph,
    cursorFollowEnabled,
    cursorViewportPercent,
    setManuscriptFocusActive,
    toggleManuscriptFocus,
    exitManuscriptFocus,
    changeManuscriptFocusWidth,
    changeCurrentParagraphHighlight,
    changeCursorFollow,
    changeCursorViewport,
    changeManuscriptTextScale,
  }), [
    changeManuscriptFocusWidth,
    changeCurrentParagraphHighlight,
    setManuscriptFocusActive,
    changeCursorFollow,
    changeCursorViewport,
    changeManuscriptTextScale,
    exitManuscriptFocus,
    manuscriptFocusWidthPx,
    highlightCurrentParagraph,
    manuscriptFocusActive,
    cursorFollowEnabled,
    cursorViewportPercent,
    manuscriptFocusTextScalePercent,
    toggleManuscriptFocus,
  ]);
}
