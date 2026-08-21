import type { ReactNode } from "react";

export function EventStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="사건 구조" className="structure-panel event-structure-panel">{input.children}</section>;
}
