import { useId, type ReactNode } from "react";

import type { ReviewTab } from "../navigation/studio-location";

const REVIEW_TAB_LABELS: Readonly<Record<ReviewTab, string>> = Object.freeze({
  records: "집필 기록",
  manuscript: "원고 점검",
  candidates: "후보 검토함",
  versions: "버전",
});

const REVIEW_TABS = Object.freeze(Object.keys(REVIEW_TAB_LABELS) as ReviewTab[]);

const REVIEW_DESCRIPTIONS: Readonly<Record<ReviewTab, string>> = {
  records: "집필 시간과 글자 수를 돌아보고 목표와 연독률을 기록합니다. 기간을 고르면 그 기간의 기록만 확인할 수 있습니다.",
  manuscript: "원고를 이어 읽거나 문장과 반복 어휘를 점검합니다. 필요한 도구를 선택하세요.",
  candidates: "조수가 제안한 인물·장면·별빛을 살펴봅니다. 승인한 항목만 작품에 반영됩니다.",
  versions: "저장된 원고 버전과 이름 붙인 기준점을 확인합니다. 비교할 내용을 고른 뒤 복원 여부를 결정하세요.",
};

export function ReviewWorkspace(input: {
  readonly activeTab: ReviewTab;
  readonly onTabChange: (tab: ReviewTab) => void;
  readonly panels: Readonly<Record<ReviewTab, ReactNode>>;
}) {
  const identity = useId();
  return (
    <section aria-label="검토 작업면" className="review-workspace work-section-surface">
      <div aria-label="검토 항목" className="work-subsection-tabs" role="tablist">
        {REVIEW_TABS.map((tab) => (
          <button
            aria-controls={`${identity}-${tab}`}
            aria-selected={input.activeTab === tab}
            id={`${identity}-${tab}-tab`}
            key={tab}
            onClick={() => input.onTabChange(tab)}
            role="tab"
            type="button"
          >
            {REVIEW_TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      <p className="work-section-description">{REVIEW_DESCRIPTIONS[input.activeTab]}</p>
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
