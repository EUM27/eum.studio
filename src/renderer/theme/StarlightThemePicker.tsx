import { Sun } from "lucide-react";

import {
  STARLIGHT_THEMES,
  type StarlightTheme,
  type StarlightThemeKey,
} from "./starlight-theme";

function ThemeGroup({
  currentTheme,
  label,
  onChange,
  themes,
}: {
  readonly currentTheme: StarlightThemeKey;
  readonly label: string;
  readonly onChange: (theme: StarlightThemeKey) => void;
  readonly themes: readonly StarlightTheme[];
}) {
  return (
    <section className="starlight-theme-group" aria-label={label}>
      <p>{label}</p>
      <div className="starlight-theme-grid">
        {themes.map((theme) => {
          const selected = currentTheme === theme.key;
          return (
            <button
              aria-pressed={selected}
              className={selected ? "is-selected" : undefined}
              key={theme.key}
              onClick={() => onChange(theme.key)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="starlight-theme-swatch"
                style={{ backgroundColor: theme.swatch }}
              />
              <span>{theme.name}</span>
              {selected && (
                <span aria-hidden="true" className="starlight-theme-check">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const lightThemes = STARLIGHT_THEMES.filter((theme) => theme.group === "light");
const darkThemes = STARLIGHT_THEMES.filter((theme) => theme.group === "dark");

export function StarlightThemePicker({
  onChange,
  theme,
}: {
  readonly onChange: (theme: StarlightThemeKey) => void;
  readonly theme: StarlightThemeKey;
}) {
  return (
    <div className="starlight-theme-picker">
      <button
        aria-label="테마 변경"
        className="app-topbar-button starlight-theme-trigger"
        title="테마 변경"
        type="button"
      >
        <Sun aria-hidden="true" size={20} strokeWidth={2} />
      </button>
      <div
        aria-label="테마 선택"
        className="starlight-theme-menu"
        role="group"
      >
        <p className="starlight-theme-menu-title">테마 선택</p>
        <ThemeGroup
          currentTheme={theme}
          label="밝은 테마"
          onChange={onChange}
          themes={lightThemes}
        />
        <ThemeGroup
          currentTheme={theme}
          label="어두운 테마"
          onChange={onChange}
          themes={darkThemes}
        />
      </div>
    </div>
  );
}
