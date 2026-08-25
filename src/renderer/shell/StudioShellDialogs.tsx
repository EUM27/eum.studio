import {
  useState,
  type FormEvent,
} from "react";
import {
  Archive,
  Download,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

import type { LegacyLoreImportRehearsalSummary } from "../../application/migration/legacy-lore-import-contract";
import type { LocalWorkspaceBackupStatusProjection } from "../../application/storage/local-workspace-backup-contract";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BackupDialog({
  status,
  actionState,
  error,
  onCancel,
  onCreate,
  onRestore,
}: {
  readonly status: LocalWorkspaceBackupStatusProjection | null;
  readonly actionState: "loading" | "idle" | "creating" | "restoring";
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onCreate: () => void;
  readonly onRestore: () => void;
}) {
  const busy = actionState !== "idle";
  const summary = status?.lastVerified ?? null;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: onCancel,
  });
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="backup-heading"
        aria-modal="true"
        className="create-work-dialog backup-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">LOCAL BACKUP</p>
            <h2 id="backup-heading">백업</h2>
          </div>
          <button
            aria-label="백업 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          현재 작업실을 검증된 백업으로 만들거나, 선택한 백업을 새 작업실 위치에 복원합니다.
        </p>
        {actionState === "loading" ? (
          <p className="backup-empty-state">백업 기록을 확인하는 중입니다.</p>
        ) : summary === null ? (
          <p className="backup-empty-state">아직 검증된 백업이 없습니다.</p>
        ) : (
          <section className="backup-summary" aria-label="마지막 검증된 백업">
            <header>
              <div>
                <span>마지막 검증된 백업</span>
                <strong>
                  {summary.lastAction === "created" ? "백업 생성 완료" : "새 위치 복원 완료"}
                </strong>
              </div>
              <time dateTime={summary.verifiedAt}>
                {formatUpdatedAt(summary.verifiedAt)}
              </time>
            </header>
            <code title={summary.bundlePath}>{summary.bundlePath}</code>
            {summary.targetPath !== null && (
              <p title={summary.targetPath}>복원 위치 · {summary.targetPath}</p>
            )}
            <dl>
              <div><dt>작품</dt><dd>{summary.counts.workCount}</dd></div>
              <div><dt>회차</dt><dd>{summary.counts.documentCount}</dd></div>
              <div><dt>버전</dt><dd>{summary.counts.revisionCount}</dd></div>
              <div><dt>집필 기록</dt><dd>{summary.counts.writingSessionCount}</dd></div>
            </dl>
          </section>
        )}
        {error !== null && (
          <p className="dialog-error" role="alert">{error}</p>
        )}
        <div className="dialog-actions backup-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={onRestore}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
            {actionState === "restoring" ? "복원 중" : "새 위치에 복원"}
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={onCreate}
            type="button"
          >
            <Archive aria-hidden="true" size={15} />
            {actionState === "creating" ? "백업 중" : "새 백업"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ImportRehearsalDialog({
  summary,
  running,
  error,
  onCancel,
  onRun,
}: {
  readonly summary: LegacyLoreImportRehearsalSummary | null;
  readonly running: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onRun: () => void;
}) {
  const onBackdropPointerDown = useDialogDismiss({
    disabled: running,
    onClose: onCancel,
  });
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="import-rehearsal-heading"
        aria-modal="true"
        className="create-work-dialog import-rehearsal-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">READ-ONLY IMPORT</p>
            <h2 id="import-rehearsal-heading">기존 작업 가져오기</h2>
          </div>
          <button
            aria-label="기존 작업 가져오기 닫기"
            className="dialog-close"
            disabled={running}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          기존 이음 에디터 폴더와 직접 내보낸 브라우저 데이터 JSON을 읽기 전용으로 봉인하고, 선택한 새 위치에 별도의 리허설 작업실을 만듭니다. 현재 작업실에는 합치지 않습니다.
        </p>
        {summary === null ? (
          <p className="backup-empty-state">
            실행하면 원본 폴더, 브라우저 내보내기, 원고별 checksum과 receipt 누락 여부를 함께 검증합니다.
          </p>
        ) : (
          <section className="import-rehearsal-summary" aria-label="가져오기 리허설 결과">
            <header>
              <div>
                <span>가져오기 리허설 완료</span>
                <strong>
                  {summary.publication === "published" ? "새 리허설 생성" : "기존 리허설 재검증"}
                </strong>
              </div>
              <span className="source-unchanged-badge">원본 변경 없음</span>
            </header>
            <div className="import-paths">
              <p><span>원본</span><code>{summary.sourceRootPath}</code></p>
              <p><span>리허설</span><code>{summary.rehearsalWorkspacePath}</code></p>
              <p><span>보고서</span><code>{summary.reportPath}</code></p>
            </div>
            <dl>
              <div><dt>작품</dt><dd>{summary.counts.workCount}</dd></div>
              <div><dt>회차</dt><dd>{summary.counts.documentCount}</dd></div>
              <div><dt>원고 버전</dt><dd>{summary.counts.revisionCount}</dd></div>
              <div><dt>미귀속 원고</dt><dd>{summary.counts.orphanManuscriptCount}</dd></div>
              <div><dt>보존 원본</dt><dd>{summary.counts.rawItemCount}</dd></div>
              <div>
                <dt>브라우저 항목</dt>
                <dd>{summary.browserSourceReceipt?.coverage.sourceEntryCount ?? "입력 없음"}</dd>
              </div>
              <div><dt>검토 항목</dt><dd>{summary.issueCount}</dd></div>
            </dl>
            <p className="receipt-coverage">
              {summary.counts.uncoveredItemCount === 0
                ? `receipt ${summary.counts.receiptCount}/${summary.counts.sourceItemCount} · 누락 없음`
                : `receipt 누락 ${summary.counts.uncoveredItemCount}개`}
            </p>
          </section>
        )}
        {error !== null && (
          <p className="dialog-error" role="alert">{error}</p>
        )}
        <div className="dialog-actions import-rehearsal-actions">
          <button
            className="secondary-button"
            disabled={running}
            onClick={onCancel}
            type="button"
          >
            닫기
          </button>
          <button
            className="primary-button"
            disabled={running}
            onClick={onRun}
            type="button"
          >
            <Download aria-hidden="true" size={15} />
            {running ? "검증 중" : "읽기 전용 리허설 실행"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function CreateWorkDialog({
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (input: {
    readonly title: string;
    readonly firstDocumentTitle: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [firstDocumentTitle, setFirstDocumentTitle] = useState("");
  const canSubmit =
    title.trim().length > 0 &&
    !submitting;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: submitting,
    onClose: onCancel,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit({ title, firstDocumentTitle });
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="create-work-heading"
        aria-modal="true"
        className="create-work-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">LOCAL WORK</p>
            <h2 id="create-work-heading">새 작품 만들기</h2>
          </div>
          <button
            aria-label="새 작품 만들기 닫기"
            className="dialog-close"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <p className="dialog-description">
          작품과 첫 회차를 이 컴퓨터의 로컬 작업실에 함께 만듭니다.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>작품 제목</span>
            <input
              autoFocus
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="작품 제목을 입력하세요"
              value={title}
            />
          </label>
          <label>
            <span>첫 회차 제목</span>
            <input
              disabled={submitting}
              onChange={(event) => setFirstDocumentTitle(event.target.value)}
              placeholder="비우면 제목없음"
              value={firstDocumentTitle}
            />
          </label>
          {error !== null && (
            <p aria-live="polite" className="dialog-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={submitting}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={!canSubmit}
              type="submit"
            >
              <Plus aria-hidden="true" size={16} />
              {submitting ? "만드는 중" : "작품 만들기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function RenameWorkDialog({
  work,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  readonly work: WorkspaceWorkSummary;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState(work.title);
  const canSubmit = title.trim().length > 0 && !submitting;
  const onBackdropPointerDown = useDialogDismiss({
    disabled: submitting,
    onClose: onCancel,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit(title);
  };

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby="rename-work-heading"
        aria-modal="true"
        className="create-work-dialog rename-work-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">WORK TITLE</p>
            <h2 id="rename-work-heading">작품 이름 변경</h2>
          </div>
          <button
            aria-label="작품 이름 변경 닫기"
            className="dialog-close"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <label>
            <span>작품 제목</span>
            <input
              autoFocus
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          {error !== null && (
            <p aria-live="polite" className="dialog-error">{error}</p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={submitting}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button className="primary-button" disabled={!canSubmit} type="submit">
              {submitting ? "변경 중" : "변경"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
