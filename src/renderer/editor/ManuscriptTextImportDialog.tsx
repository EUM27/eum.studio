import type { ManuscriptTextImportResult } from "../../application/editor/manuscript-text-import";

type SelectedImport = Extract<
  ManuscriptTextImportResult,
  { readonly status: "selected" }
>;

export function ManuscriptTextImportDialog(input: {
  readonly applying: boolean;
  readonly candidate: SelectedImport;
  readonly currentText: string;
  readonly error: string | null;
  readonly onApply: () => void;
  readonly onClose: () => void;
  readonly stale: boolean;
}) {
  return (
    <div className="dialog-backdrop manuscript-import-backdrop" role="presentation">
      <section
        aria-labelledby="manuscript-import-heading"
        aria-modal="true"
        className="manuscript-import-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">TXT IMPORT</p>
            <h2 id="manuscript-import-heading">원고 TXT 가져오기</h2>
            <p>{input.candidate.fileName}</p>
          </div>
          <button
            aria-label="원고 TXT 가져오기 닫기"
            className="dialog-close"
            disabled={input.applying}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="manuscript-import-summary">
          <div><span>현재 원고</span><strong>{input.currentText.length.toLocaleString()}자</strong></div>
          <div><span>가져올 원고</span><strong>{input.candidate.text.length.toLocaleString()}자</strong></div>
          <div><span>파일 크기</span><strong>{input.candidate.byteLength.toLocaleString()}바이트</strong></div>
        </div>

        <section className="manuscript-import-preview" aria-label="가져올 원고 미리보기">
          <header>
            <h3>미리보기</h3>
            <span>현재 회차 원고 전체를 교체합니다.</span>
          </header>
          <pre>{input.candidate.text}</pre>
        </section>

        {input.stale && (
          <p className="dialog-error" role="alert">
            가져오기를 연 뒤 대상 회차나 revision이 바뀌었습니다.
          </p>
        )}
        {input.error !== null && (
          <p className="dialog-error" role="alert">{input.error}</p>
        )}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={input.applying}
            onClick={input.onClose}
            type="button"
          >
            취소
          </button>
          <button
            className="primary-button"
            disabled={input.applying || input.stale}
            onClick={input.onApply}
            type="button"
          >
            {input.applying ? "적용 중" : "현재 원고 교체"}
          </button>
        </div>
      </section>
    </div>
  );
}
