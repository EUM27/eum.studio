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

const STRUCTURE_DESCRIPTIONS: Readonly<Record<StructureTab, string>> = {
  overview: "작품의 회차·인물·플롯·장면을 한눈에 살펴봅니다. 항목을 누르면 연결된 원고나 상세 화면으로 이동합니다.",
  plots: "플롯을 구성하고 사건 아이디어를 뽑습니다. 확정한 플롯을 원고의 사건과 연결할 수 있습니다.",
  events: "원고에 연결된 사건과 앞으로 쓸 예정 사건을 정리합니다.",
  scenes: "회차 안의 장면을 나누고, 장면별 정보와 원고 위치를 확인합니다.",
  characters: "인물의 설정과 관계를 정리합니다. 인물 뽑기에서 새로운 아이디어를 얻을 수 있습니다.",
  foreshadow: "원고에 심은 복선과 회수 지점을 연결하고 진행 상태를 확인합니다.",
  lore: "작품의 설정·별칭·원고 근거를 직접 추가하고 편집합니다. 확정한 내용은 별빛 작업면에서도 볼 수 있습니다.",
};

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
      <p className="work-section-description">{STRUCTURE_DESCRIPTIONS[input.activeTab]}</p>
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
