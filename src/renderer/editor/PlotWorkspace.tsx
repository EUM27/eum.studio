import { useId, useState, type ReactNode } from "react";

export type PlotWorkspaceTab = "board" | "scenes";

const TAB_LABELS: Readonly<Record<PlotWorkspaceTab, string>> = Object.freeze({
  board: "플롯",
  scenes: "장면",
});

export function PlotWorkspace(input: {
  readonly board: ReactNode;
  readonly initialTab?: PlotWorkspaceTab;
  readonly scenes: ReactNode;
}) {
  const [tab, setTab] = useState<PlotWorkspaceTab>(input.initialTab ?? "board");
  const identity = useId();
  const content = tab === "board" ? input.board : input.scenes;

  return (
    <section aria-label="플롯 작업면" className="plot-workspace">
      <div aria-label="플롯 작업" className="plot-workspace-tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as PlotWorkspaceTab[]).map((candidate) => (
          <button
            aria-controls={`${identity}-${candidate}`}
            aria-selected={tab === candidate}
            id={`${identity}-${candidate}-tab`}
            key={candidate}
            onClick={() => setTab(candidate)}
            role="tab"
            type="button"
          >
            {TAB_LABELS[candidate]}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`${identity}-${tab}-tab`}
        className={`plot-workspace-panel is-${tab}`}
        id={`${identity}-${tab}`}
        role="tabpanel"
      >
        {content}
      </div>
    </section>
  );
}
