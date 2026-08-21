import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  splitContinuousReadingLines,
  type ContinuousReadingLocation,
  type ContinuousReadingSession,
} from "../../application/editor/continuous-reading-progress";
import { useDialogDismiss } from "../dialog/useDialogDismiss";

function sameLocation(
  left: ContinuousReadingLocation | null,
  right: ContinuousReadingLocation | null,
): boolean {
  return (
    left?.documentId === right?.documentId &&
    left?.documentRevisionId === right?.documentRevisionId &&
    left?.textOffset === right?.textOffset
  );
}

function readVisibleLocation(
  container: HTMLDivElement,
): ContinuousReadingLocation | null {
  const containerTop = container.getBoundingClientRect().top;
  const articles = Array.from(
    container.querySelectorAll<HTMLElement>("[data-reading-document-id]"),
  );
  const article =
    articles.find((candidate) => candidate.getBoundingClientRect().bottom > containerTop) ??
    articles.at(-1);
  if (article === undefined) return null;
  const lines = Array.from(
    article.querySelectorAll<HTMLElement>("[data-reading-text-offset]"),
  );
  const line =
    lines.find((candidate) => candidate.getBoundingClientRect().bottom > containerTop) ??
    lines.at(-1);
  const documentId = article.dataset.readingDocumentId;
  const documentRevisionId = article.dataset.readingDocumentRevisionId;
  const textOffset = line?.dataset.readingTextOffset;
  if (
    documentId === undefined ||
    documentRevisionId === undefined ||
    textOffset === undefined
  ) {
    return null;
  }
  return {
    documentId: documentId as ContinuousReadingLocation["documentId"],
    documentRevisionId:
      documentRevisionId as ContinuousReadingLocation["documentRevisionId"],
    textOffset: Number(textOffset),
  };
}

export function ContinuousReadingDialog(input: {
  readonly session: ContinuousReadingSession;
  readonly onClose: (
    location: ContinuousReadingLocation | null,
  ) => Promise<void>;
  readonly onProgress: (location: ContinuousReadingLocation) => Promise<void>;
}) {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const idleHandleRef = useRef<number | null>(null);
  const submittedLocationRef = useRef<ContinuousReadingLocation | null>(
    input.session.initialLocation,
  );
  const [loadedCount, setLoadedCount] = useState(
    input.session.initialLoadedCount,
  );
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "saved" | "closing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const closeDialog = () => {
    const container = scrollRef.current;
    const location = container === null ? null : readVisibleLocation(container);
    setError(null);
    setActionState("closing");
    void input.onClose(location).catch((closeError: unknown) => {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "읽기 위치를 저장하지 못했습니다.",
      );
      setActionState("idle");
    });
  };
  const onBackdropPointerDown = useDialogDismiss({
    disabled: actionState === "closing",
    onClose: closeDialog,
  });
  const visibleDocuments = useMemo(
    () => input.session.documents.slice(0, loadedCount),
    [input.session.documents, loadedCount],
  );

  const submitVisibleProgress = () => {
    const container = scrollRef.current;
    if (container === null) return;
    const location = readVisibleLocation(container);
    if (location === null || sameLocation(location, submittedLocationRef.current)) {
      return;
    }
    submittedLocationRef.current = location;
    setError(null);
    setActionState("saving");
    void input.onProgress(location).then(
      () => setActionState("saved"),
      (saveError: unknown) => {
        submittedLocationRef.current = null;
        setError(
          saveError instanceof Error
            ? saveError.message
            : "읽기 위치를 저장하지 못했습니다.",
        );
        setActionState("idle");
      },
    );
  };

  const scheduleVisibleProgress = () => {
    if (idleHandleRef.current !== null) {
      window.cancelIdleCallback(idleHandleRef.current);
    }
    idleHandleRef.current = window.requestIdleCallback(() => {
      idleHandleRef.current = null;
      submitVisibleProgress();
    });
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (
      container !== null &&
      loadedCount < input.session.documents.length &&
      container.scrollHeight <= container.clientHeight
    ) {
      setLoadedCount((current) => current + 1);
    }
  }, [input.session.documents.length, loadedCount]);

  useEffect(() => {
    if (
      restoredRef.current ||
      input.session.initialLocation === null ||
      scrollRef.current === null
    ) {
      return;
    }
    const container = scrollRef.current;
    const location = input.session.initialLocation;
    const article = Array.from(
      container.querySelectorAll<HTMLElement>("[data-reading-document-id]"),
    ).find(
      (candidate) =>
        candidate.dataset.readingDocumentId === location.documentId,
    );
    const line = Array.from(
      article?.querySelectorAll<HTMLElement>("[data-reading-text-offset]") ?? [],
    ).find(
      (candidate) =>
        Number(candidate.dataset.readingTextOffset) === location.textOffset,
    );
    if (line !== undefined) {
      container.scrollTop +=
        line.getBoundingClientRect().top - container.getBoundingClientRect().top;
      restoredRef.current = true;
    }
  }, [input.session.initialLocation, loadedCount]);

  useEffect(
    () => () => {
      if (idleHandleRef.current !== null) {
        window.cancelIdleCallback(idleHandleRef.current);
      }
    },
  );

  return (
    <div
      className="dialog-backdrop continuous-reading-backdrop"
      onPointerDown={onBackdropPointerDown}
      role="presentation"
    >
      <section
        aria-labelledby={headingId}
        aria-modal="true"
        className="continuous-reading-dialog"
        role="dialog"
      >
        <header className="continuous-reading-header">
          <div>
            <p className="panel-kicker">CONTINUOUS READING</p>
            <h2 id={headingId}>연속 읽기</h2>
            <p>
              {loadedCount} / {input.session.documents.length}회차
            </p>
          </div>
          <div className="continuous-reading-header-actions">
            <output
              aria-live="polite"
              data-testid="continuous-reading-save-state"
            >
              {actionState === "saving"
                ? "위치 저장 중"
                : actionState === "saved"
                  ? "위치 저장됨"
                  : ""}
            </output>
            <button
              aria-label="연속 읽기 닫기"
              disabled={actionState === "closing"}
              onClick={closeDialog}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        {input.session.status === "stale" && (
          <p className="continuous-reading-notice" role="status">
            원고 revision이 바뀌어 이전 읽기 위치를 복원하지 않았습니다.
          </p>
        )}

        <div
          aria-label="연속 읽기 본문"
          className="continuous-reading-scroll"
          onScroll={(event) => {
            const container = event.currentTarget;
            if (
              loadedCount < input.session.documents.length &&
              container.scrollHeight - container.scrollTop - container.clientHeight <=
                container.clientHeight
            ) {
              setLoadedCount((current) =>
                Math.min(current + 1, input.session.documents.length),
              );
            }
            scheduleVisibleProgress();
          }}
          ref={scrollRef}
          role="region"
        >
          {visibleDocuments.map((document, index) => (
            <article
              className="continuous-reading-document"
              data-reading-document-id={document.documentId}
              data-reading-document-revision-id={document.documentRevisionId}
              key={document.documentId}
            >
              <header>
                <span>{index + 1}회차</span>
                <h3>{document.title}</h3>
              </header>
              <div className="continuous-reading-text">
                {splitContinuousReadingLines(document.text).map((line) => (
                  <span
                    data-reading-text-offset={line.textOffset}
                    key={line.textOffset}
                  >
                    {line.text.length === 0 ? "\u00a0" : line.text}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {loadedCount < input.session.documents.length ? (
            <p className="continuous-reading-load-hint">
              스크롤하면 다음 회차를 이어서 불러옵니다.
            </p>
          ) : (
            <p className="continuous-reading-load-hint">
              마지막 회차까지 불러왔습니다.
            </p>
          )}
        </div>

        {error !== null && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
