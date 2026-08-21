import { X } from "lucide-react";
import { useEffect } from "react";

import type { DocumentRevisionContentProjection } from "../../application/revisions/work-version-contract";

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentRevisionPreviewDialog(input: {
  readonly documentTitle: string;
  readonly onClose: () => void;
  readonly projection: DocumentRevisionContentProjection;
}) {
  const onClose = input.onClose;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop document-revision-preview-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          input.onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-label="완료 당시 버전"
        aria-modal="true"
        className="document-revision-preview-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="panel-kicker">DOCUMENT REVISION</p>
            <h2>완료 당시 버전</h2>
            <p>
              {input.documentTitle} · {formatTimestamp(
                input.projection.revision.durableAt,
              )}
            </p>
          </div>
          <button
            aria-label="완료 당시 버전 닫기"
            className="dialog-close"
            onClick={input.onClose}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>
        <pre>{input.projection.text}</pre>
      </section>
    </div>
  );
}
