import type { ReactNode } from "react";

export function LoreStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="별빛 구조" className="structure-panel lore-structure-panel">{input.children}</section>;
}
