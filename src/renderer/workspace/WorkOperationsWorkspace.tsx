export type WorkOperationsSection =
  | "submissions"
  | "contracts"
  | "settlements";

const OPERATIONS: ReadonlyArray<Readonly<{
  section: WorkOperationsSection;
  label: string;
}>> = Object.freeze([
  { section: "submissions", label: "투고" },
  { section: "contracts", label: "계약·발행" },
  { section: "settlements", label: "정산·입금" },
]);

export function WorkOperationsWorkspace(input: {
  readonly onOpen: (section: WorkOperationsSection) => void;
  readonly workTitle: string;
}) {
  return (
    <section aria-label="작품 운영 작업면" className="work-operations-workspace work-section-surface">
      <header>
        <p className="panel-kicker">WORK OPERATIONS</p>
        <h3>{input.workTitle}</h3>
      </header>
      <div className="work-operations-grid">
        {OPERATIONS.map((operation) => (
          <button
            key={operation.section}
            onClick={() => input.onOpen(operation.section)}
            type="button"
          >
            <strong>{operation.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
