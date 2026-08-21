import type { ReactNode } from "react";

export function ForeshadowStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="복선 구조" className="structure-panel foreshadow-structure-panel">{input.children}</section>;
}
