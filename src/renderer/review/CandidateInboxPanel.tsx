import { useId, useState, type ReactNode } from "react";

type CandidateTab = "all" | "characters" | "scenes" | "lore";

const LABELS: Readonly<Record<CandidateTab, string>> = Object.freeze({
  all: "전체",
  characters: "인물",
  scenes: "장면",
  lore: "별빛",
});

export function CandidateInboxPanel(input: {
  readonly counts: Readonly<Record<Exclude<CandidateTab, "all">, number>>;
  readonly panels: Readonly<Record<Exclude<CandidateTab, "all">, ReactNode>>;
}) {
  const [tab, setTab] = useState<CandidateTab>("all");
  const identity = useId();
  const candidateTabs = Object.keys(LABELS) as CandidateTab[];
  const visibleTabs: Array<Exclude<CandidateTab, "all">> =
    tab === "all" ? ["characters", "scenes", "lore"] : [tab];

  return (
    <section aria-label="후보 검토함" className="review-panel candidate-inbox-panel">
      <header>
        <div>
          <p className="panel-kicker">CANDIDATE INBOX</p>
          <h3>후보 검토함</h3>
        </div>
        <strong>{Object.values(input.counts).reduce((sum, count) => sum + count, 0)}</strong>
      </header>
      <div aria-label="후보 종류" className="candidate-inbox-tabs" role="tablist">
        {candidateTabs.map((candidate) => (
          <button
            aria-controls={`${identity}-${candidate}`}
            aria-selected={tab === candidate}
            id={`${identity}-${candidate}-tab`}
            key={candidate}
            onClick={() => setTab(candidate)}
            role="tab"
            type="button"
          >
            {LABELS[candidate]}
            {candidate !== "all" && <span>{input.counts[candidate]}</span>}
          </button>
        ))}
      </div>
      <div className="candidate-inbox-content">
        {visibleTabs.map((candidate) => (
          <section
            aria-label={`${LABELS[candidate]} 후보`}
            className={`candidate-inbox-group is-${candidate}`}
            id={`${identity}-${candidate}`}
            key={candidate}
          >
            <h4>{LABELS[candidate]}</h4>
            {input.panels[candidate]}
          </section>
        ))}
      </div>
    </section>
  );
}
