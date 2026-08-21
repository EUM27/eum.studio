import { useId, type ReactNode } from "react";

import type { ReviewTab } from "../navigation/studio-location";

const REVIEW_TAB_LABELS: Readonly<Record<ReviewTab, string>> = Object.freeze({
  records: "집필 기록",
  manuscript: "원고 점검",
  candidates: "후보 검토함",
  versions: "버전",
});

const REVIEW_TABS = Object.freeze(Object.keys(REVIEW_TAB_LABELS) as ReviewTab[]);

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
