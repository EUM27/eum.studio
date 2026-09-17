import { ArrowUpRight, FileCheck2, Send, Wallet } from "lucide-react";

export type WorkOperationsSection =
  | "submissions"
  | "contracts"
  | "settlements";

const OPERATIONS: ReadonlyArray<Readonly<{
  section: WorkOperationsSection;
  label: string;
  detail: string;
  icon: typeof Send;
}>> = Object.freeze([
  { section: "submissions", label: "투고", detail: "출판사별 투고 이력과 제출 자료, 답변을 함께 관리합니다.", icon: Send },
  { section: "contracts", label: "계약·발행", detail: "계약 조건과 발행 일정, 연결된 자료를 기록합니다.", icon: FileCheck2 },
  { section: "settlements", label: "정산·입금", detail: "정산서와 실제 입금 내역을 확인합니다.", icon: Wallet },
]);

export function WorkOperationsWorkspace(input: {
  readonly onOpen: (section: WorkOperationsSection) => void;
  readonly workTitle: string;
}) {
  return (
    <section aria-label="작품 운영 작업면" className="work-operations-workspace work-section-surface">
      <header>
        <div><p className="panel-kicker">작품 운영</p><h3>{input.workTitle}</h3></div>
        <p>투고부터 발행 이후까지, 이 작품의 기록을 이어 관리하세요.</p>
      </header>
      <div className="work-operations-grid">
        {OPERATIONS.map((operation) => (
          <button
            aria-label={operation.label}
            key={operation.section}
            onClick={() => input.onOpen(operation.section)}
            type="button"
          >
            <span className="work-operation-icon"><operation.icon aria-hidden="true" size={23} /></span>
            <strong>{operation.label}</strong>
            <span className="work-operation-description">{operation.detail}</span>
            <span className="work-operation-link">열기 <ArrowUpRight aria-hidden="true" size={16} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}
