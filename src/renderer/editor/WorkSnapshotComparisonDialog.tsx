import type {
  WorkSnapshotComparisonProjection,
  WorkSnapshotDocumentComparisonStatus,
} from "../../application/revisions/work-snapshot-comparison";
import type { WorkSnapshotSceneSelectionPlan } from "../../application/revisions/work-snapshot-scene-plan";
import type { EntityId } from "../../domain/writing";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

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
  readonly scenePlan: WorkSnapshotSceneSelectionPlan | null;
  readonly onToggleScene: (sceneId:EntityId<"Scene">,selected:boolean)=>void;
  readonly onClose: () => void;
}) {
  const { projection } = input;
  const onBackdropPointerDown = useDialogDismiss({ onClose: input.onClose });
  return (
    <div
      className="dialog-backdrop snapshot-comparison-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
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
        <section aria-label="장면 단위 선택 plan" className="snapshot-scene-plan">
          <header><div><p className="panel-kicker">SCENE SELECTION PLAN</p><h3>장면 단위 선택 plan</h3></div><strong>읽기 전용</strong></header>
          <p className="snapshot-comparison-notice">선택은 대체 전개 검토 의도만 기록합니다. 자동 전체 병합과 부분 적용은 비활성화되어 있으며 원고·별빛을 바꾸지 않습니다.</p>
          {input.scenePlan===null?<p>장면 비교 plan을 불러오는 중입니다.</p>:!input.scenePlan.snapshotSceneMetadataAvailable?<p>이전 형식 기준점에는 장면 manifest가 없습니다. 문서 비교만 사용할 수 있습니다.</p>:input.scenePlan.scenes.length===0?<p>비교할 stable Scene이 없습니다.</p>:<ul>{input.scenePlan.scenes.map((scene)=><li key={scene.sceneId}><label><input checked={scene.selected} disabled={scene.status==="unchanged"||scene.status==="snapshot-structure-unavailable"} onChange={(event)=>input.onToggleScene(scene.sceneId,event.currentTarget.checked)} type="checkbox"/><span><strong>{scene.sceneId}</strong><small>{scene.status}</small></span></label><div className="snapshot-scene-columns"><section><h4>기준점</h4>{scene.snapshotSegments.length===0?<p>없음</p>:scene.snapshotSegments.map((segment)=><article key={`${segment.documentId}:${segment.range.from}`}><strong>{segment.documentTitle} · {segment.range.from}–{segment.range.to}</strong><p>{segment.excerpt}</p></article>)}</section><section><h4>현재</h4>{scene.currentSegments.length===0?<p>없음</p>:scene.currentSegments.map((segment)=><article key={`${segment.documentId}:${segment.range.from}`}><strong>{segment.documentTitle} · {segment.range.from}–{segment.range.to}</strong><p>{segment.excerpt}</p></article>)}</section></div></li>)}</ul>}
          {input.scenePlan!==null&&<footer><strong>{`선택 ${input.scenePlan.scenes.filter((scene)=>scene.selected).length}개`}</strong><span>적용 명령 없음 · 자동 병합 금지</span></footer>}
        </section>
      </section>
    </div>
  );
}
