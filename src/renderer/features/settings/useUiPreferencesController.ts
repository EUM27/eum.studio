import { useCallback, useEffect, useRef, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  DEFAULT_FOCUS_MODE_PREFERENCES,
  type FocusModePreferences,
  type UiPreferencesProjection,
} from "../../../application/settings/ui-preferences";
import {
  parseStarlightThemeKey,
  STARLIGHT_THEMES,
  STARLIGHT_THEME_STORAGE_KEY,
  type StarlightThemeKey,
} from "../../theme/starlight-theme";

export function useUiPreferencesController(input: Readonly<{
  bodyClassList: Pick<DOMTokenList, "add" | "remove">;
  client: Pick<
    StudioBridge["settings"],
    "getUiPreferences" | "saveUiPreferences"
  >;
  storage: Pick<Storage, "getItem" | "setItem">;
}>) {
  const [theme, setTheme] = useState(() =>
    parseStarlightThemeKey(
      input.storage.getItem(STARLIGHT_THEME_STORAGE_KEY),
    )
  );
  const [focusModePreferences, setFocusModePreferences] =
    useState<FocusModePreferences>(() => {
      const storedPosition = Number(
        input.storage.getItem("eum_focus_typewriter_position_percent"),
      );
      return Number.isFinite(storedPosition) && storedPosition > 0
        ? Object.freeze({
            ...DEFAULT_FOCUS_MODE_PREFERENCES,
            typewriterPositionPercent: storedPosition,
          })
        : DEFAULT_FOCUS_MODE_PREFERENCES;
    });
  const themeRef = useRef(theme);
  const focusModePreferencesRef = useRef(focusModePreferences);
  const uiPreferencesRef = useRef<UiPreferencesProjection>({
    schemaVersion: 1,
    revision: 0,
    themeKey: theme,
    focusMode: focusModePreferences,
  });
  const uiPreferencesSaveChainRef = useRef(Promise.resolve());
  const [uiPreferencesReady, setUiPreferencesReady] = useState(false);

  const persistUiPreferences = useCallback((
    nextTheme: StarlightThemeKey,
    nextFocusMode: FocusModePreferences,
  ) => {
    input.storage.setItem(STARLIGHT_THEME_STORAGE_KEY, nextTheme);
    input.storage.setItem(
      "eum_ui_preferences_v1",
      JSON.stringify({ themeKey: nextTheme, focusMode: nextFocusMode }),
    );
    const execution = uiPreferencesSaveChainRef.current.then(async () => {
      const current = uiPreferencesRef.current;
      const saved = await input.client.saveUiPreferences({
        schemaVersion: 1,
        expectedRevision: current.revision,
        themeKey: nextTheme,
        focusMode: nextFocusMode,
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
    persistUiPreferences(nextTheme, focusModePreferencesRef.current);
  }, [persistUiPreferences]);
  const changeFocusModePreferences = useCallback((
    nextFocusMode: FocusModePreferences,
  ) => {
    focusModePreferencesRef.current = nextFocusMode;
    setFocusModePreferences(nextFocusMode);
    persistUiPreferences(themeRef.current, nextFocusMode);
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
            focusModePreferencesRef.current,
          );
          setUiPreferencesReady(true);
          return;
        }
        const restoredTheme = parseStarlightThemeKey(projection.themeKey);
        themeRef.current = restoredTheme;
        focusModePreferencesRef.current = projection.focusMode;
        setTheme(restoredTheme);
        setFocusModePreferences(projection.focusMode);
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
    focusModePreferences,
    uiPreferencesReady,
    changeTheme,
    changeFocusModePreferences,
  };
}
