import type { FormEvent } from "react";

import type {
  DocumentRevisionProjection,
  WorkSnapshotProjection,
} from "../../application/revisions/work-version-contract";
import type { EntityId } from "../../domain/writing";
import { deriveWorkSnapshotSlots } from "../../application/revisions/work-snapshot-scene-plan";

function formatVersionTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionPanel(input: {
  readonly actionState:
    | "idle"
    | "refreshing"
    | "restoring"
    | "creating-snapshot"
    | "comparing-snapshot";
  readonly documentRevisions: readonly DocumentRevisionProjection[];
  readonly error: string | null;
  readonly highlightedRevisionId: EntityId<"DocumentRevision"> | null;
  readonly onCompareSnapshot: (snapshotId: EntityId<"WorkSnapshot">) => void;
  readonly onCreateSnapshot: (event: FormEvent<HTMLFormElement>) => void;
  readonly onRefresh: () => void;
  readonly onRestoreRevision: (revisionId: EntityId<"DocumentRevision">) => void;
  readonly onSnapshotLabelChange: (label: string) => void;
  readonly snapshotLabel: string;
  readonly workSnapshots: readonly WorkSnapshotProjection[];
}) {
  const snapshotSlots=deriveWorkSnapshotSlots(input.workSnapshots);
  return (
    <section aria-label="버전" className="review-panel version-panel">
      <section aria-label="문서 버전" className="event-block-list version-history-list">
        <header>
          <h3>문서 버전</h3>
          <button
            className="version-refresh-button"
            disabled={input.actionState !== "idle"}
            onClick={input.onRefresh}
            type="button"
          >
            {input.actionState === "refreshing" ? "확인 중" : "새로고침"}
          </button>
        </header>
        {input.documentRevisions.length === 0 ? (
          <p className="empty-event-list">저장된 문서 버전이 없습니다.</p>
        ) : (
          <ul>
            {input.documentRevisions.map((revision) => (
              <li
                data-completed-revision={
                  revision.revisionId === input.highlightedRevisionId
                    ? "true"
                    : undefined
                }
                key={revision.revisionId}
              >
                <div className="version-history-entry">
                  <strong>
                    {revision.isCurrent
                      ? "현재 버전"
                      : formatVersionTimestamp(revision.createdAt)}
                    {revision.revisionId === input.highlightedRevisionId
                      ? " · 완료 당시 버전"
                      : ""}
                  </strong>
                  <span>{revision.length}자</span>
                  {!revision.isCurrent && (
                    <button
                      aria-label={`${formatVersionTimestamp(revision.createdAt)} 버전으로 복원`}
                      disabled={input.actionState !== "idle"}
                      onClick={() => input.onRestoreRevision(revision.revisionId)}
                      type="button"
                    >
                      복원
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="명명된 기준점 슬롯" className="event-block-list work-snapshot-list">
        <header><div><h3>명명된 기준점 슬롯</h3><small>같은 이름으로 다시 만들면 이전 기준점은 이력으로 보존됩니다.</small></div><span>{snapshotSlots.length}</span></header>
        <form className="work-snapshot-form" onSubmit={input.onCreateSnapshot}>
          <label>
            <span className="visually-hidden">기준점 슬롯 이름</span>
            <input
              aria-label="기준점 슬롯 이름"
              disabled={input.actionState !== "idle"}
              onChange={(event) => input.onSnapshotLabelChange(event.currentTarget.value)}
              type="text"
              value={input.snapshotLabel}
            />
          </label>
          <button disabled={input.snapshotLabel.trim().length === 0 || input.actionState !== "idle"} type="submit">
            {input.actionState === "creating-snapshot" ? "생성 중" : "이 슬롯에 기준점 만들기"}
          </button>
        </form>
        {input.workSnapshots.length === 0 ? (
          <p className="empty-event-list">만든 기준점 슬롯이 없습니다.</p>
        ) : (
          <ul>
            {snapshotSlots.map((slot) => (
              <li key={slot.slotName}>
                <div className="work-snapshot-entry" data-testid="work-snapshot-entry">
                  <strong>{slot.slotName}</strong>
                  <span>{`현재 기준점 · ${formatVersionTimestamp(slot.current.createdAt)} · 문서 ${slot.current.documentRevisions.length}개`}</span>
                  {slot.history.length>0&&<small>{`이전 기준점 ${slot.history.length}개 보존`}</small>}
                  <button
                    aria-label={`${slot.slotName} 현재 기준점 비교`}
                    disabled={input.actionState !== "idle"}
                    onClick={() => input.onCompareSnapshot(slot.current.workSnapshotId)}
                    type="button"
                  >
                    비교
                  </button>
                </div>
                {slot.history.length>0&&<details><summary>이전 기준점 이력</summary><ul>{slot.history.map((snapshot)=><li key={snapshot.workSnapshotId}><span>{formatVersionTimestamp(snapshot.createdAt)}</span><button disabled={input.actionState!=="idle"} onClick={()=>input.onCompareSnapshot(snapshot.workSnapshotId)} type="button">이 기준점 비교</button></li>)}</ul></details>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {input.error !== null && <p className="event-action-error" role="alert">{input.error}</p>}
    </section>
  );
}
