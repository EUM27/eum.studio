import { useId, type ReactNode } from "react";

import type { StructureTab } from "../navigation/studio-location";

const STRUCTURE_TAB_LABELS: Readonly<Record<StructureTab, string>> = Object.freeze({
  overview: "개요",
  plots: "플롯",
  events: "사건",
  scenes: "장면",
  characters: "인물",
  foreshadow: "복선",
  lore: "별빛",
});

const STRUCTURE_TABS = Object.freeze(
  Object.keys(STRUCTURE_TAB_LABELS) as StructureTab[],
);

export function StructureWorkspace(input: {
  readonly activeTab: StructureTab;
  readonly onTabChange: (tab: StructureTab) => void;
  readonly panels: Readonly<Record<StructureTab, ReactNode>>;
}) {
  const identity = useId();
  return (
    <section aria-label="구조 작업면" className="structure-workspace work-section-surface">
      <div aria-label="구조 항목" className="work-subsection-tabs" role="tablist">
        {STRUCTURE_TABS.map((tab) => (
          <button
            aria-controls={`${identity}-${tab}`}
            aria-selected={input.activeTab === tab}
            id={`${identity}-${tab}-tab`}
            key={tab}
            onClick={() => input.onTabChange(tab)}
            role="tab"
            type="button"
          >
            {STRUCTURE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`${identity}-${input.activeTab}-tab`}
        className={`work-subsection-panel is-${input.activeTab}`}
        id={`${identity}-${input.activeTab}`}
        role="tabpanel"
      >
        {input.panels[input.activeTab]}
      </div>
    </section>
  );
}
