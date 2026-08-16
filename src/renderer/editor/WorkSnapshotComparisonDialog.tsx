import type {
  WorkSnapshotComparisonProjection,
  WorkSnapshotDocumentComparisonStatus,
} from "../../application/revisions/work-snapshot-comparison";

const STATUS_LABELS: Readonly<
  Record<WorkSnapshotDocumentComparisonStatus, string>
> = Object.freeze({
  unchanged: "같음",
  changed: "변경됨",
  "added-after-snapshot": "스냅샷 뒤 추가",
  "removed-after-snapshot": "스냅샷 뒤 제외",
});

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDelta(value: number): string {
  if (value === 0) return "변화 없음";
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}자`;
}

export function WorkSnapshotComparisonDialog(input: {
  readonly projection: WorkSnapshotComparisonProjection;
  readonly onClose: () => void;
}) {
  const { projection } = input;
  return (
    <div className="dialog-backdrop snapshot-comparison-backdrop" role="presentation">
      <section
        aria-labelledby="snapshot-comparison-heading"
        aria-modal="true"
        className="snapshot-comparison-dialog"
        role="dialog"
      >
        <header className="snapshot-comparison-header">
          <div>
            <p className="panel-kicker">WORK SNAPSHOT</p>
            <h2 id="snapshot-comparison-heading">작품 스냅샷 비교</h2>
            <p>
              <strong>{projection.label}</strong>
              <span>{formatTimestamp(projection.createdAt)}</span>
            </p>
          </div>
          <button
            aria-label="작품 스냅샷 비교 닫기"
            className="dialog-close"
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <p className="snapshot-comparison-notice">
          읽기 전용 비교입니다. 스냅샷과 현재 원고는 변경하지 않습니다.
        </p>

        <section aria-label="스냅샷 비교 합계" className="snapshot-comparison-summary">
          <div>
            <span>선택 시점</span>
            <strong>스냅샷 {projection.totals.snapshotCharacters.toLocaleString()}자</strong>
            <small>{projection.totals.snapshotDocumentCount}개 회차</small>
          </div>
          <div>
            <span>현재</span>
            <strong>현재 {projection.totals.currentCharacters.toLocaleString()}자</strong>
            <small>{projection.totals.currentDocumentCount}개 회차</small>
          </div>
          <div>
            <span>현재 변화</span>
            <strong>{formatDelta(projection.totals.characterDelta)}</strong>
            <small>스냅샷 기준</small>
          </div>
        </section>

        <div className="snapshot-comparison-counts" aria-label="회차 상태 합계">
          <span>같음 {projection.totals.unchangedCount}</span>
          <span>변경 {projection.totals.changedCount}</span>
          <span>추가 {projection.totals.addedCount}</span>
          <span>제외 {projection.totals.removedCount}</span>
        </div>

        <div
          aria-label="회차별 스냅샷 비교"
          className="snapshot-comparison-table"
          role="table"
        >
          <div className="snapshot-comparison-row snapshot-comparison-table-head" role="row">
            <span role="columnheader">회차</span>
            <span role="columnheader">스냅샷</span>
            <span role="columnheader">현재</span>
            <span role="columnheader">차이</span>
            <span role="columnheader">상태</span>
          </div>
          {projection.documents.map((document) => (
            <div className="snapshot-comparison-row" key={document.documentId} role="row">
              <strong role="cell">{document.title}</strong>
              <span role="cell">{document.snapshotLength.toLocaleString()}자</span>
              <span role="cell">{document.currentLength.toLocaleString()}자</span>
              <span role="cell">{formatDelta(document.characterDelta)}</span>
              <small data-status={document.status} role="cell">
                {STATUS_LABELS[document.status]}
              </small>
            </div>
          ))}
          {projection.documents.length === 0 && (
            <p className="snapshot-comparison-empty">비교할 회차가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
