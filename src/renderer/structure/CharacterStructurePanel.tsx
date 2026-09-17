import type { ReactNode } from "react";

export function CharacterStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="인물 구조" className="structure-panel character-structure-panel">{input.children}</section>;
}
