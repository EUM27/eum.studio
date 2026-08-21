import type { FormEvent } from "react";

import type {
  DocumentRevisionProjection,
  WorkSnapshotProjection,
} from "../../application/revisions/work-version-contract";
import type { EntityId } from "../../domain/writing";

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
      <section aria-label="작품 스냅샷" className="event-block-list work-snapshot-list">
        <header><h3>작품 스냅샷</h3><span>{input.workSnapshots.length}</span></header>
        <form className="work-snapshot-form" onSubmit={input.onCreateSnapshot}>
          <label>
            <span className="visually-hidden">작품 스냅샷 이름</span>
            <input
              aria-label="작품 스냅샷 이름"
              disabled={input.actionState !== "idle"}
              onChange={(event) => input.onSnapshotLabelChange(event.currentTarget.value)}
              type="text"
              value={input.snapshotLabel}
            />
          </label>
          <button disabled={input.snapshotLabel.trim().length === 0 || input.actionState !== "idle"} type="submit">
            {input.actionState === "creating-snapshot" ? "생성 중" : "생성"}
          </button>
        </form>
        {input.workSnapshots.length === 0 ? (
          <p className="empty-event-list">만든 작품 스냅샷이 없습니다.</p>
        ) : (
          <ul>
            {input.workSnapshots.map((snapshot) => (
              <li key={snapshot.workSnapshotId}>
                <div className="work-snapshot-entry" data-testid="work-snapshot-entry">
                  <strong>{snapshot.label}</strong>
                  <span>{formatVersionTimestamp(snapshot.createdAt)} · 문서 {snapshot.documentRevisions.length}개</span>
                  <button
                    aria-label={`${snapshot.label} 스냅샷 비교`}
                    disabled={input.actionState !== "idle"}
                    onClick={() => input.onCompareSnapshot(snapshot.workSnapshotId)}
                    type="button"
                  >
                    비교
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {input.error !== null && <p className="event-action-error" role="alert">{input.error}</p>}
    </section>
  );
}
