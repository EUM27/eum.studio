export type WorkOperationsSection =
  | "submissions"
  | "contracts"
  | "settlements";

const OPERATIONS: ReadonlyArray<Readonly<{
  section: WorkOperationsSection;
  label: string;
  description: string;
}>> = Object.freeze([
  { section: "submissions", label: "투고", description: "현재 작품의 투고와 회신 이력을 엽니다." },
  { section: "contracts", label: "계약·발행", description: "현재 작품의 계약과 발행·연재 항목을 엽니다." },
  { section: "settlements", label: "정산·입금", description: "현재 작품의 정산서와 실제 입금을 엽니다." },
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
        <p>현재 작품으로 범위가 고정된 운영 진입점입니다.</p>
      </header>
      <div className="work-operations-grid">
        {OPERATIONS.map((operation) => (
          <button
            key={operation.section}
            onClick={() => input.onOpen(operation.section)}
            type="button"
          >
            <strong>{operation.label}</strong>
            <span>{operation.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
