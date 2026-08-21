import type { ReactNode } from "react";

export function PlotStructurePanel(input: { readonly children: ReactNode }) {
  return <section aria-label="플롯 작업면" className="structure-panel plot-structure-panel">{input.children}</section>;
}
