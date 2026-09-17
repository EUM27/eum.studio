import type { ReactNode } from "react";

export function SceneStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="장면 구조" className="structure-panel scene-structure-panel">{input.children}</section>;
}
