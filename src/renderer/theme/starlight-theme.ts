export const STARLIGHT_THEME_STORAGE_KEY = "starlight_theme";

type StarlightThemeGroup = "light" | "dark";

export type StarlightThemeTokens = {
  readonly base: string;
  readonly primary: string;
  readonly secondary: string;
  readonly hover: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly border: string;
  readonly inputBackground: string;
  readonly inputShadow: string;
  readonly caret: string;
  readonly buttonBackground: string;
  readonly buttonHover: string;
  readonly buttonText: string;
  readonly primaryBackdrop: string;
  readonly secondaryBackdrop: string;
  readonly inputBackdrop: string;
  readonly buttonBackdrop: string;
};

export type StarlightTheme = {
  readonly key:
    | "light-mode"
    | "cream-theme"
    | "sepia-theme"
    | "soft-neutral-theme"
    | "neutral-light-theme"
    | "purple-theme"
    | "focus-light-theme"
    | "dark-mode"
    | "midnight-theme"
    | "ocean-theme"
    | "soft-dark-theme"
    | "warm-dark-theme"
    | "nord-theme"
    | "focus-dark-theme";
  readonly name: string;
  readonly group: StarlightThemeGroup;
  readonly swatch: string;
  readonly tokens: StarlightThemeTokens;
};

const noBackdrop = {
  primaryBackdrop: "none",
  secondaryBackdrop: "none",
  inputBackdrop: "none",
  buttonBackdrop: "none",
} as const;

export const STARLIGHT_THEMES = Object.freeze([
  {
    key: "light-mode",
    name: "라이트",
    group: "light",
    swatch: "#fdfcfa",
    tokens: {
      base: "#fdfcfa",
      primary: "#fdfcfa",
      secondary: "#ffffff",
      hover: "#fafafa",
      textPrimary: "#1a1a1a",
      textSecondary: "#6b7280",
      textTertiary: "#9ca3af",
      accent: "#d97706",
      accentHover: "#b45309",
      border: "#e5e7eb",
      inputBackground: "#ffffff",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      caret: "#d97706",
      buttonBackground: "#d97706",
      buttonHover: "#b45309",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "cream-theme",
    name: "크림",
    group: "light",
    swatch: "#fafaf8",
    tokens: {
      base: "#fafaf8",
      primary: "#fafaf8",
      secondary: "#f2f2f0",
      hover: "#eaeae6",
      textPrimary: "#2c2c2c",
      textSecondary: "#5c5c5c",
      textTertiary: "#8c8c8c",
      accent: "#7c7c7c",
      accentHover: "#6c6c6c",
      border: "#dcdcd8",
      inputBackground: "#f2f2f0",
      inputShadow: "0 2px 8px rgba(44, 44, 44, 0.08)",
      caret: "#7c7c7c",
      buttonBackground: "#7c7c7c",
      buttonHover: "#6c6c6c",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "sepia-theme",
    name: "세피아",
    group: "light",
    swatch: "#f5f3ef",
    tokens: {
      base: "#f5f3ef",
      primary: "#f5f3ef",
      secondary: "#ebe9e3",
      hover: "#e1dfd7",
      textPrimary: "#3a3a3a",
      textSecondary: "#6a6a6a",
      textTertiary: "#9a9a9a",
      accent: "#7a7a7a",
      accentHover: "#6a6a6a",
      border: "#d7d5cb",
      inputBackground: "#ebe9e3",
      inputShadow: "0 2px 8px rgba(58, 58, 58, 0.1)",
      caret: "#7a7a7a",
      buttonBackground: "#7a7a7a",
      buttonHover: "#6a6a6a",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "soft-neutral-theme",
    name: "소프트",
    group: "light",
    swatch: "#f7f7f8",
    tokens: {
      base: "#f7f7f8",
      primary: "#f7f7f8",
      secondary: "#ffffff",
      hover: "#efeff0",
      textPrimary: "#202124",
      textSecondary: "#3c4043",
      textTertiary: "#6f7378",
      accent: "#5f6368",
      accentHover: "#4a4e52",
      border: "#d2d5d9",
      inputBackground: "#ffffff",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      caret: "#5f6368",
      buttonBackground: "#5f6368",
      buttonHover: "#4a4e52",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "neutral-light-theme",
    name: "뉴트럴",
    group: "light",
    swatch: "#f4f4f5",
    tokens: {
      base: "#f4f4f5",
      primary: "#f4f4f5",
      secondary: "#e4e4e7",
      hover: "#d4d4d8",
      textPrimary: "#27272a",
      textSecondary: "#52525b",
      textTertiary: "#71717a",
      accent: "#71717a",
      accentHover: "#52525b",
      border: "#d4d4d8",
      inputBackground: "#e4e4e7",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      caret: "#71717a",
      buttonBackground: "#71717a",
      buttonHover: "#52525b",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "purple-theme",
    name: "베이지",
    group: "light",
    swatch: "#f5f3f0",
    tokens: {
      base: "#f5f3f0",
      primary: "#f5f3f0",
      secondary: "#ffffff",
      hover: "#eae7e2",
      textPrimary: "#2d2a26",
      textSecondary: "#5a5550",
      textTertiary: "#87827a",
      accent: "#6b6560",
      accentHover: "#57534e",
      border: "#d6d2cc",
      inputBackground: "#faf9f7",
      inputShadow: "0 2px 8px rgba(45, 42, 38, 0.06)",
      caret: "#6b6560",
      buttonBackground: "#78716c",
      buttonHover: "#57534e",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "focus-light-theme",
    name: "포커스L",
    group: "light",
    swatch: "#f3f4f5",
    tokens: {
      base: "#f3f4f5",
      primary: "rgba(243, 244, 245, 0.85)",
      secondary: "rgba(238, 240, 242, 0.75)",
      hover: "rgba(233, 235, 237, 0.85)",
      textPrimary: "#1f1f1f",
      textSecondary: "#3a3a3a",
      textTertiary: "#9aa0a6",
      accent: "#9aa0a6",
      accentHover: "#7d8388",
      border: "rgba(225, 227, 230, 0.6)",
      inputBackground: "rgba(255, 255, 255, 0.65)",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      caret: "#9aa0a6",
      buttonBackground: "rgba(154, 160, 166, 0.9)",
      buttonHover: "rgba(125, 131, 136, 0.95)",
      buttonText: "#ffffff",
      primaryBackdrop: "blur(20px)",
      secondaryBackdrop: "blur(12px)",
      inputBackdrop: "blur(16px)",
      buttonBackdrop: "blur(8px)",
    },
  },
  {
    key: "dark-mode",
    name: "다크",
    group: "dark",
    swatch: "#1c1c1e",
    tokens: {
      base: "#1c1c1e",
      primary: "#1c1c1e",
      secondary: "#2c2c2e",
      hover: "#3a3a3c",
      textPrimary: "#f5f5f7",
      textSecondary: "#aeaeb2",
      textTertiary: "#8e8e93",
      accent: "#a1a1a6",
      accentHover: "#b5b5ba",
      border: "#38383a",
      inputBackground: "#2c2c2e",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      caret: "#a1a1a6",
      buttonBackground: "#6b7280",
      buttonHover: "#4b5563",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "midnight-theme",
    name: "미드나잇",
    group: "dark",
    swatch: "#111111",
    tokens: {
      base: "#111111",
      primary: "#111111",
      secondary: "#1a1a1a",
      hover: "#242424",
      textPrimary: "#d4d4d4",
      textSecondary: "#a0a0a0",
      textTertiary: "#707070",
      accent: "#909090",
      accentHover: "#707070",
      border: "#2e2e2e",
      inputBackground: "#1a1a1a",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
      caret: "#909090",
      buttonBackground: "#606060",
      buttonHover: "#707070",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "ocean-theme",
    name: "그레이",
    group: "dark",
    swatch: "#2a2d32",
    tokens: {
      base: "#2a2d32",
      primary: "#2a2d32",
      secondary: "#35383e",
      hover: "#3d4147",
      textPrimary: "#e4e6eb",
      textSecondary: "#b8bcc4",
      textTertiary: "#8a8f98",
      accent: "#9ca3af",
      accentHover: "#4b5563",
      border: "#494d54",
      inputBackground: "#32353b",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      caret: "#9ca3af",
      buttonBackground: "#6b7280",
      buttonHover: "#4b5563",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "soft-dark-theme",
    name: "소프트D",
    group: "dark",
    swatch: "#1a1b1e",
    tokens: {
      base: "#1a1b1e",
      primary: "#1a1b1e",
      secondary: "#25262b",
      hover: "#2c2e33",
      textPrimary: "#e0e0e3",
      textSecondary: "#a6a7ab",
      textTertiary: "#7f8186",
      accent: "#9ca3af",
      accentHover: "#4b5563",
      border: "#373a40",
      inputBackground: "#25262b",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      caret: "#9ca3af",
      buttonBackground: "#6b7280",
      buttonHover: "#4b5563",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "warm-dark-theme",
    name: "웜다크",
    group: "dark",
    swatch: "#1c1917",
    tokens: {
      base: "#1c1917",
      primary: "#1c1917",
      secondary: "#292524",
      hover: "#44403c",
      textPrimary: "#e7e5e4",
      textSecondary: "#a8a29e",
      textTertiary: "#78716c",
      accent: "#a8a29e",
      accentHover: "#57534e",
      border: "#44403c",
      inputBackground: "#292524",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      caret: "#a8a29e",
      buttonBackground: "#78716c",
      buttonHover: "#57534e",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "nord-theme",
    name: "노르딕",
    group: "dark",
    swatch: "#2e3440",
    tokens: {
      base: "#2e3440",
      primary: "#2e3440",
      secondary: "#3b4252",
      hover: "#434c5e",
      textPrimary: "#eceff4",
      textSecondary: "#d8dee9",
      textTertiary: "#8fbcbb",
      accent: "#88c0d0",
      accentHover: "#81a1c1",
      border: "#4c566a",
      inputBackground: "#3b4252",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      caret: "#88c0d0",
      buttonBackground: "#5e81ac",
      buttonHover: "#81a1c1",
      buttonText: "#ffffff",
      ...noBackdrop,
    },
  },
  {
    key: "focus-dark-theme",
    name: "포커스D",
    group: "dark",
    swatch: "#1a1b1e",
    tokens: {
      base: "#1a1b1e",
      primary: "rgba(26, 27, 30, 0.85)",
      secondary: "rgba(37, 38, 43, 0.75)",
      hover: "rgba(44, 46, 51, 0.85)",
      textPrimary: "#e0e0e3",
      textSecondary: "#a6a7ab",
      textTertiary: "#7f8186",
      accent: "#9ca3af",
      accentHover: "#4b5563",
      border: "rgba(55, 58, 64, 0.6)",
      inputBackground: "rgba(37, 38, 43, 0.65)",
      inputShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
      caret: "#9ca3af",
      buttonBackground: "rgba(107, 114, 128, 0.9)",
      buttonHover: "rgba(75, 85, 99, 0.95)",
      buttonText: "#ffffff",
      primaryBackdrop: "blur(20px)",
      secondaryBackdrop: "blur(12px)",
      inputBackdrop: "blur(16px)",
      buttonBackdrop: "blur(8px)",
    },
  },
] satisfies readonly StarlightTheme[]);

export type StarlightThemeKey = (typeof STARLIGHT_THEMES)[number]["key"];

export const DEFAULT_STARLIGHT_THEME: StarlightThemeKey = "light-mode";

const themeByKey = new Map(
  STARLIGHT_THEMES.map((theme) => [theme.key, theme] as const),
);

export function parseStarlightThemeKey(value: string | null): StarlightThemeKey {
  return themeByKey.has(value as StarlightThemeKey)
    ? (value as StarlightThemeKey)
    : DEFAULT_STARLIGHT_THEME;
}

export function getStarlightTheme(key: StarlightThemeKey): StarlightTheme {
  const theme = themeByKey.get(key);
  if (theme === undefined) {
    throw new Error(`등록되지 않은 별빛 서재 테마입니다: ${key}`);
  }
  return theme;
}

export function isDarkStarlightTheme(key: StarlightThemeKey): boolean {
  return getStarlightTheme(key).group === "dark";
}

export function starlightThemeCssVariables(
  key: StarlightThemeKey,
): Readonly<Record<`--starlight-${string}`, string>> {
  const { tokens } = getStarlightTheme(key);
  return Object.freeze({
    "--starlight-base": tokens.base,
    "--starlight-primary": tokens.primary,
    "--starlight-secondary": tokens.secondary,
    "--starlight-hover": tokens.hover,
    "--starlight-text-primary": tokens.textPrimary,
    "--starlight-text-secondary": tokens.textSecondary,
    "--starlight-text-tertiary": tokens.textTertiary,
    "--starlight-accent": tokens.accent,
    "--starlight-accent-hover": tokens.accentHover,
    "--starlight-border": tokens.border,
    "--starlight-input": tokens.inputBackground,
    "--starlight-input-shadow": tokens.inputShadow,
    "--starlight-caret": tokens.caret,
    "--starlight-button": tokens.buttonBackground,
    "--starlight-button-hover": tokens.buttonHover,
    "--starlight-button-text": tokens.buttonText,
    "--starlight-primary-backdrop": tokens.primaryBackdrop,
    "--starlight-secondary-backdrop": tokens.secondaryBackdrop,
    "--starlight-input-backdrop": tokens.inputBackdrop,
    "--starlight-button-backdrop": tokens.buttonBackdrop,
  });
}
