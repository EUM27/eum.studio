import { useCallback, useEffect, useRef, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  DEFAULT_MANUSCRIPT_FOCUS_PREFERENCES,
  type ManuscriptFocusPreferences,
  type UiPreferencesProjection,
} from "../../../application/settings/ui-preferences";
import {
  parseStarlightThemeKey,
  STARLIGHT_THEMES,
  STARLIGHT_THEME_STORAGE_KEY,
  type StarlightThemeKey,
} from "../../theme/starlight-theme";
import { MANUSCRIPT_FOCUS_CURSOR_VIEWPORT_STORAGE_KEY } from "./manuscript-focus-storage";

export function useUiPreferencesController(input: Readonly<{
  bodyClassList: Pick<DOMTokenList, "add" | "remove">;
  client: Pick<
    StudioBridge["settings"],
    "getUiPreferences" | "saveUiPreferences"
  >;
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">;
}>) {
  const [theme, setTheme] = useState(() =>
    parseStarlightThemeKey(
      input.storage.getItem(STARLIGHT_THEME_STORAGE_KEY),
    )
  );
  const [manuscriptFocusPreferences, setManuscriptFocusPreferences] =
    useState<ManuscriptFocusPreferences>(() => {
      const storedPosition = Number(
        input.storage.getItem(MANUSCRIPT_FOCUS_CURSOR_VIEWPORT_STORAGE_KEY),
      );
      return Number.isFinite(storedPosition) && storedPosition > 0
        ? Object.freeze({
            ...DEFAULT_MANUSCRIPT_FOCUS_PREFERENCES,
            cursorViewportPercent: storedPosition,
          })
        : DEFAULT_MANUSCRIPT_FOCUS_PREFERENCES;
    });
  const themeRef = useRef(theme);
  const manuscriptFocusPreferencesRef = useRef(manuscriptFocusPreferences);
  const uiPreferencesRef = useRef<UiPreferencesProjection>({
    schemaVersion: 2,
    revision: 0,
    themeKey: theme,
    manuscriptFocus: manuscriptFocusPreferences,
  });
  const uiPreferencesSaveChainRef = useRef(Promise.resolve());
  const [uiPreferencesReady, setUiPreferencesReady] = useState(false);

  const persistUiPreferences = useCallback((
    nextTheme: StarlightThemeKey,
    nextManuscriptFocus: ManuscriptFocusPreferences,
  ) => {
    input.storage.setItem(STARLIGHT_THEME_STORAGE_KEY, nextTheme);
    input.storage.setItem(
      "eum_ui_preferences_v2",
      JSON.stringify({ themeKey: nextTheme, manuscriptFocus: nextManuscriptFocus }),
    );
    const execution = uiPreferencesSaveChainRef.current.then(async () => {
      const current = uiPreferencesRef.current;
      const saved = await input.client.saveUiPreferences({
        schemaVersion: 2,
        expectedRevision: current.revision,
        themeKey: nextTheme,
        manuscriptFocus: nextManuscriptFocus,
      });
      uiPreferencesRef.current = saved;
    });
    uiPreferencesSaveChainRef.current = execution.then(
      () => undefined,
      () => undefined,
    );
  }, [input.client, input.storage]);

  const changeTheme = useCallback((nextTheme: StarlightThemeKey) => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    persistUiPreferences(nextTheme, manuscriptFocusPreferencesRef.current);
  }, [persistUiPreferences]);
  const changeManuscriptFocusPreferences = useCallback((
    nextManuscriptFocus: ManuscriptFocusPreferences,
  ) => {
    manuscriptFocusPreferencesRef.current = nextManuscriptFocus;
    setManuscriptFocusPreferences(nextManuscriptFocus);
    persistUiPreferences(themeRef.current, nextManuscriptFocus);
  }, [persistUiPreferences]);

  useEffect(() => {
    let disposed = false;
    void input.client.getUiPreferences().then(
      (projection) => {
        if (disposed) return;
        uiPreferencesRef.current = projection;
        if (projection.revision === 0) {
          persistUiPreferences(
            themeRef.current,
            manuscriptFocusPreferencesRef.current,
          );
          setUiPreferencesReady(true);
          return;
        }
        const restoredTheme = parseStarlightThemeKey(projection.themeKey);
        themeRef.current = restoredTheme;
        manuscriptFocusPreferencesRef.current = projection.manuscriptFocus;
        setTheme(restoredTheme);
        setManuscriptFocusPreferences(projection.manuscriptFocus);
        input.storage.setItem(STARLIGHT_THEME_STORAGE_KEY, restoredTheme);
        setUiPreferencesReady(true);
      },
      () => setUiPreferencesReady(true),
    );
    return () => {
      disposed = true;
    };
  }, [input.client, input.storage, persistUiPreferences]);

  useEffect(() => {
    input.bodyClassList.remove(
      ...STARLIGHT_THEMES.map((candidate) => candidate.key),
    );
    input.bodyClassList.add(theme);
    return () => {
      input.bodyClassList.remove(theme);
    };
  }, [input.bodyClassList, theme]);

  return {
    theme,
    manuscriptFocusPreferences,
    uiPreferencesReady,
    changeTheme,
    changeManuscriptFocusPreferences,
  };
}
