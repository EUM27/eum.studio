import type { CSSProperties, ReactNode } from "react";

import {
  starlightThemeCssVariables,
  type StarlightThemeKey,
} from "../theme/starlight-theme";

export function StudioAppShell({
  children,
  compact,
  editor,
  home,
  theme,
}: {
  readonly children: ReactNode;
  readonly compact: boolean;
  readonly editor: boolean;
  readonly home: boolean;
  readonly theme: StarlightThemeKey;
}) {
  const themeStyle = starlightThemeCssVariables(theme) as CSSProperties;

  return (
    <div
      className={[
        "studio-app-shell",
        theme,
        compact ? "is-compact" : null,
        editor ? "is-editor" : null,
        home ? "is-home" : null,
      ]
        .filter((className): className is string => className !== null)
        .join(" ")}
      data-ui-model="eum-studio-desktop"
      data-starlight-theme={theme}
      style={themeStyle}
    >
      {children}
    </div>
  );
}
