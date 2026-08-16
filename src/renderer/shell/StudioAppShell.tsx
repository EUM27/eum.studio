import type { ReactNode } from "react";

export function StudioAppShell({
  children,
  compact,
  editor,
  home,
}: {
  readonly children: ReactNode;
  readonly compact: boolean;
  readonly editor: boolean;
  readonly home: boolean;
}) {
  return (
    <div
      className={[
        "studio-app-shell",
        compact ? "is-compact" : null,
        editor ? "is-editor" : null,
        home ? "is-home" : null,
      ]
        .filter((className): className is string => className !== null)
        .join(" ")}
      data-ui-model="eum-studio-desktop"
      data-visual-model="novela"
    >
      {children}
    </div>
  );
}
