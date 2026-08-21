import type { ReactNode } from "react";

export function StructureOverviewPanel(input: { readonly children: ReactNode }) {
  return <section aria-label="작품 구조 개요" className="structure-panel structure-overview-panel">{input.children}</section>;
}
