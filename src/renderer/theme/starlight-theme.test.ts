import { describe, expect, it } from "vitest";

import {
  DEFAULT_STARLIGHT_THEME,
  getStarlightTheme,
  isDarkStarlightTheme,
  parseStarlightThemeKey,
  STARLIGHT_THEMES,
  starlightThemeCssVariables,
} from "./starlight-theme";

describe("starlight theme source port", () => {
  it("preserves the source theme order, labels, and swatches", () => {
    expect(
      STARLIGHT_THEMES.map(({ key, name, swatch }) => ({ key, name, swatch })),
    ).toEqual([
      { key: "light-mode", name: "라이트", swatch: "#fdfcfa" },
      { key: "cream-theme", name: "크림", swatch: "#fafaf8" },
      { key: "sepia-theme", name: "세피아", swatch: "#f5f3ef" },
      { key: "soft-neutral-theme", name: "소프트", swatch: "#f7f7f8" },
      { key: "neutral-light-theme", name: "뉴트럴", swatch: "#f4f4f5" },
      { key: "purple-theme", name: "베이지", swatch: "#f5f3f0" },
      { key: "focus-light-theme", name: "포커스L", swatch: "#f3f4f5" },
      { key: "dark-mode", name: "다크", swatch: "#1c1c1e" },
      { key: "midnight-theme", name: "미드나잇", swatch: "#111111" },
      { key: "ocean-theme", name: "그레이", swatch: "#2a2d32" },
      { key: "soft-dark-theme", name: "소프트D", swatch: "#1a1b1e" },
      { key: "warm-dark-theme", name: "웜다크", swatch: "#1c1917" },
      { key: "nord-theme", name: "노르딕", swatch: "#2e3440" },
      { key: "focus-dark-theme", name: "포커스D", swatch: "#1a1b1e" },
    ]);
  });

  it("keeps the source light, dark, and focus token values exact", () => {
    expect(getStarlightTheme("light-mode").tokens).toMatchObject({
      primary: "#fdfcfa",
      secondary: "#ffffff",
      textPrimary: "#1a1a1a",
      accent: "#d97706",
      border: "#e5e7eb",
      inputBackground: "#ffffff",
      buttonBackground: "#d97706",
    });
    expect(getStarlightTheme("dark-mode").tokens).toMatchObject({
      primary: "#1c1c1e",
      secondary: "#2c2c2e",
      textPrimary: "#f5f5f7",
      accent: "#a1a1a6",
      border: "#38383a",
      inputBackground: "#2c2c2e",
      buttonBackground: "#6b7280",
    });
    expect(getStarlightTheme("focus-dark-theme").tokens).toMatchObject({
      primary: "rgba(26, 27, 30, 0.85)",
      secondary: "rgba(37, 38, 43, 0.75)",
      inputBackground: "rgba(37, 38, 43, 0.65)",
      primaryBackdrop: "blur(20px)",
      inputBackdrop: "blur(16px)",
    });
  });

  it("restores only a registered source theme and projects its CSS variables", () => {
    expect(parseStarlightThemeKey("nord-theme")).toBe("nord-theme");
    expect(parseStarlightThemeKey("unknown-theme")).toBe(
      DEFAULT_STARLIGHT_THEME,
    );
    expect(parseStarlightThemeKey(null)).toBe(DEFAULT_STARLIGHT_THEME);
    expect(isDarkStarlightTheme("nord-theme")).toBe(true);
    expect(isDarkStarlightTheme("purple-theme")).toBe(false);
    expect(starlightThemeCssVariables("nord-theme")).toMatchObject({
      "--starlight-primary": "#2e3440",
      "--starlight-secondary": "#3b4252",
      "--starlight-text-primary": "#eceff4",
      "--starlight-accent": "#88c0d0",
      "--starlight-border": "#4c566a",
    });
  });
});
