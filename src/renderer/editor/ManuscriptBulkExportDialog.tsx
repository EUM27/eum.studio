import { useId, useState, type FormEvent } from "react";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { ExportManuscriptTextResult } from "../../application/editor/manuscript-preflight";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

export function ManuscriptBulkExportDialog(input: Readonly<{
  workTitle: string;
  orderedDocuments: readonly ManuscriptDocumentSource[];
  onClose: () => void;
  onExport: (
    selectedDocumentIds: readonly ManuscriptDocumentSource["documentId"][],
  ) => Promise<ExportManuscriptTextResult>;
}>) {
  const headingId = useId();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(
    () => new Set(input.orderedDocuments.map((document) => document.documentId)),
  );
  const [action, setAction] = useState<"idle" | "exporting">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const busy = action !== "idle";
  const onBackdropPointerDown = useDialogDismiss({
    disabled: busy,
    onClose: input.onClose,
  });

  const toggleDocument = (documentId: ManuscriptDocumentSource["documentId"]) => {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
    setMessage(null);
  };

  const exportSelected = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const orderedSelection = input.orderedDocuments
      .filter((document) => selectedDocumentIds.has(document.documentId))
      .map((document) => document.documentId);
    if (orderedSelection.length === 0) return;
    setAction("exporting");
    setMessage(null);
    try {
      const result = await input.onExport(orderedSelection);
      setMessage(
        result.status === "completed"
          ? `${orderedSelection.length}개 회차를 하나의 TXT로 다운로드했습니다. ${result.byteLength}바이트`
          : "전체 다운로드를 취소했습니다.",
      );
    } catch {
      setMessage("선택한 회차를 다운로드하지 못했습니다.");
    } finally {
      setAction("idle");
    }
  };

  return (
    <div
      className="dialog-backdrop manuscript-bulk-export-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby={headingId}
        aria-modal="true"
        className="create-work-dialog manuscript-bulk-export-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">TXT EXPORT</p>
            <h2 id={headingId}>전체 다운로드</h2>
            <p className="dialog-description">{input.workTitle}</p>
          </div>
          <button
            aria-label="전체 다운로드 닫기"
            className="dialog-close"
            disabled={busy}
            onClick={input.onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form onSubmit={(event) => void exportSelected(event)}>
          <fieldset className="manuscript-bulk-export-selection">
            <legend>다운로드할 회차</legend>
            {input.orderedDocuments.map((document) => (
              <label key={document.documentId}>
                <input
                  checked={selectedDocumentIds.has(document.documentId)}
                  disabled={busy}
                  onChange={() => toggleDocument(document.documentId)}
                  type="checkbox"
                />
                <span>{document.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="manuscript-bulk-export-summary">
            선택 {selectedDocumentIds.size} / 전체 {input.orderedDocuments.length}회차
          </p>
          {message !== null && (
            <p aria-live="polite" className="manuscript-bulk-export-message">
              {message}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={input.onClose}
              type="button"
            >
              닫기
            </button>
            <button
              className="primary-button"
              disabled={busy || selectedDocumentIds.size === 0}
              type="submit"
            >
              {action === "exporting" ? "다운로드 중" : "선택한 회차 다운로드"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
