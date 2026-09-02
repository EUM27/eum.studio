import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  splitContinuousReadingLines,
  type ContinuousReadingLocation,
  type ContinuousReadingSession,
} from "../../application/editor/continuous-reading-progress";
import type {
  ManuscriptAnnotationProjection,
  UpdateManuscriptAnnotationCommand,
} from "../../application/review/manuscript-annotation-contract";
import { useDialogDismiss } from "../dialog/useDialogDismiss";
import { ManuscriptAnnotationsPanel } from "./ManuscriptAnnotationsPanel";
import {
  readContinuousReadingSelection,
  splitAnnotatedContinuousReadingLine,
  type ContinuousReadingSelection,
} from "./continuous-reading-annotations";

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
  readonly annotations: readonly ManuscriptAnnotationProjection[];
  readonly annotationBusy: boolean;
  readonly annotationError: string | null;
  readonly onCreateAnnotation: (source: Readonly<{
    workId: ContinuousReadingSession["workId"];
    documentId: ContinuousReadingSession["documents"][number]["documentId"];
    selection: Readonly<{ anchor: number; head: number }>;
    exactText: string;
    body: string;
    tags: readonly string[];
  }>) => Promise<ManuscriptAnnotationProjection | null>;
  readonly onUpdateAnnotation: (
    annotation: ManuscriptAnnotationProjection,
    changes: UpdateManuscriptAnnotationCommand["changes"],
  ) => Promise<ManuscriptAnnotationProjection | null>;
  readonly onRetireAnnotation: (
    annotation: ManuscriptAnnotationProjection,
  ) => Promise<boolean>;
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
  const [annotationSelection, setAnnotationSelection] =
    useState<ContinuousReadingSelection | null>(null);
  const [annotationSelectionError, setAnnotationSelectionError] =
    useState<string | null>(null);
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
  const annotationDocumentId =
    annotationSelection?.documentId ??
    input.session.initialLocation?.documentId ??
    visibleDocuments[0]?.documentId ??
    null;
  const documentTitles = useMemo(
    () => Object.fromEntries(
      input.session.documents.map((document) => [
        document.documentId,
        document.title,
      ]),
    ),
    [input.session.documents],
  );

  const captureAnnotationSelection = () => {
    const container = scrollRef.current;
    if (container === null) return;
    const browserSelection = window.getSelection();
    const selected = readContinuousReadingSelection(
      browserSelection,
      container,
    );
    setAnnotationSelection(selected);
    setAnnotationSelectionError(
      selected === null && browserSelection !== null && !browserSelection.isCollapsed
        ? "주석 범위는 한 회차 안에서 선택해 주세요."
        : null,
    );
  };

  const openAnnotation = (annotation: ManuscriptAnnotationProjection) => {
    if (annotation.range === null || scrollRef.current === null) return;
    const article = Array.from(
      scrollRef.current.querySelectorAll<HTMLElement>(
        "[data-reading-document-id]",
      ),
    ).find(
      (candidate) =>
        candidate.dataset.readingDocumentId === annotation.sourceDocumentId,
    );
    const line = Array.from(
      article?.querySelectorAll<HTMLElement>("[data-reading-text-offset]") ?? [],
    ).find((candidate) => {
      const from = Number(candidate.dataset.readingTextOffset);
      const length = Number(candidate.dataset.readingLineLength);
      return from <= annotation.range!.from && from + length >= annotation.range!.from;
    });
    line?.scrollIntoView({ block: "center" });
  };

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

        <div className="continuous-reading-annotation-layout">
          <div
            aria-label="연속 읽기 본문"
            className="continuous-reading-scroll"
            onKeyUp={captureAnnotationSelection}
            onPointerUp={captureAnnotationSelection}
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
            {visibleDocuments.map((document, index) => {
              const documentAnnotations = input.annotations.filter(
                (annotation) =>
                  annotation.sourceDocumentId === document.documentId,
              );
              return (
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
                {splitContinuousReadingLines(document.text).map((line) => {
                  const segments = splitAnnotatedContinuousReadingLine({
                    lineOffset: line.textOffset,
                    lineText: line.text,
                    annotations: documentAnnotations,
                  });
                  return (
                    <span
                      data-reading-line-length={line.text.length}
                      data-reading-text-offset={line.textOffset}
                      key={line.textOffset}
                    >
                      {segments.map((segment) => (
                        <span
                          className={segment.annotationIds.length > 0
                            ? "continuous-reading-annotation-highlight"
                            : undefined}
                          data-manuscript-annotation-id={
                            segment.annotationIds.length > 0
                              ? segment.annotationIds.join(" ")
                              : undefined
                          }
                          data-reading-segment-offset={segment.from}
                          key={`${segment.from}:${segment.annotationIds.join(":")}`}
                        >
                          {segment.text.length === 0 ? "\u00a0" : segment.text}
                        </span>
                      ))}
                    </span>
                  );
                })}
              </div>
            </article>
              );
            })}
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
          <aside
            aria-label="연속 읽기 주석"
            className="continuous-reading-annotation-panel"
          >
            <ManuscriptAnnotationsPanel
              activeDocumentId={annotationDocumentId}
              annotations={input.annotations}
              busy={input.annotationBusy}
              documentTitles={documentTitles}
              error={annotationSelectionError ?? input.annotationError}
              hasSelection={annotationSelection !== null}
              onCreate={async (body, tags) => {
                const selected = annotationSelection;
                if (selected === null) return null;
                const document = input.session.documents.find(
                  (candidate) => candidate.documentId === selected.documentId,
                );
                if (
                  document === undefined ||
                  document.documentRevisionId !== selected.documentRevisionId
                ) {
                  setAnnotationSelectionError(
                    "선택한 회차의 현재 원고를 찾지 못했습니다.",
                  );
                  return null;
                }
                return input.onCreateAnnotation({
                  workId: input.session.workId,
                  documentId: selected.documentId,
                  selection: {
                    anchor: selected.anchor,
                    head: selected.head,
                  },
                  exactText: document.text.slice(selected.from, selected.to),
                  body,
                  tags,
                });
              }}
              onOpen={openAnnotation}
              onRetire={input.onRetireAnnotation}
              onUpdate={input.onUpdateAnnotation}
            />
          </aside>
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
