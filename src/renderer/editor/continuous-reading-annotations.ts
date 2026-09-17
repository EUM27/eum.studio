import type { ManuscriptAnnotationProjection } from "../../application/review/manuscript-annotation-contract";
import type { EntityId } from "../../domain/writing";

export type ContinuousReadingTextSegment = Readonly<{
  from: number;
  text: string;
  annotationIds: readonly string[];
}>;

export type ContinuousReadingSelection = Readonly<{
  documentId: EntityId<"Document">;
  documentRevisionId: EntityId<"DocumentRevision">;
  anchor: number;
  head: number;
  from: number;
  to: number;
}>;

export function splitAnnotatedContinuousReadingLine(input: Readonly<{
  lineOffset: number;
  lineText: string;
  annotations: readonly ManuscriptAnnotationProjection[];
}>): readonly ContinuousReadingTextSegment[] {
  if (input.lineText.length === 0) {
    return Object.freeze([
      Object.freeze({ from: input.lineOffset, text: "", annotationIds: [] }),
    ]);
  }
  const lineEnd = input.lineOffset + input.lineText.length;
  const intersections = input.annotations.flatMap((annotation) => {
    if (
      annotation.integrity !== "resolved" ||
      annotation.range === null
    ) {
      return [];
    }
    const from = Math.max(input.lineOffset, annotation.range.from);
    const to = Math.min(lineEnd, annotation.range.to);
    return to <= from
      ? []
      : [{ annotationId: annotation.annotationId, from, to }];
  });
  const boundaries = new Set<number>([input.lineOffset, lineEnd]);
  intersections.forEach((intersection) => {
    boundaries.add(intersection.from);
    boundaries.add(intersection.to);
  });
  const ordered = [...boundaries].sort((left, right) => left - right);
  return Object.freeze(
    ordered.slice(0, -1).map((from, index) => {
      const to = ordered[index + 1] ?? from;
      return Object.freeze({
        from,
        text: input.lineText.slice(
          from - input.lineOffset,
          to - input.lineOffset,
        ),
        annotationIds: Object.freeze(
          intersections
            .filter((intersection) =>
              intersection.from <= from && intersection.to >= to
            )
            .map((intersection) => intersection.annotationId),
        ),
      });
    }),
  );
}

function boundaryOffset(
  container: Node,
  offset: number,
): Readonly<{
  article: HTMLElement;
  offset: number;
}> | null {
  const element = container instanceof Element
    ? container
    : container.parentElement;
  if (element === null) return null;
  const article = element.closest<HTMLElement>("[data-reading-document-id]");
  if (article === null) return null;
  const segment = element.closest<HTMLElement>("[data-reading-segment-offset]");
  if (segment !== null) {
    const segmentOffset = Number(segment.dataset.readingSegmentOffset);
    if (!Number.isSafeInteger(segmentOffset) || segmentOffset < 0) return null;
    if (container.nodeType === Node.TEXT_NODE) {
      return Object.freeze({ article, offset: segmentOffset + offset });
    }
    const childOffset = Array.from(container.childNodes)
      .slice(0, offset)
      .reduce((length, child) => length + (child.textContent?.length ?? 0), 0);
    return Object.freeze({ article, offset: segmentOffset + childOffset });
  }
  const line = element.closest<HTMLElement>("[data-reading-text-offset]");
  if (line === null) return null;
  const lineOffset = Number(line.dataset.readingTextOffset);
  const lineLength = Number(line.dataset.readingLineLength);
  if (
    !Number.isSafeInteger(lineOffset) ||
    !Number.isSafeInteger(lineLength) ||
    lineOffset < 0 ||
    lineLength < 0
  ) {
    return null;
  }
  if (container === line) {
    const child = line.childNodes[offset];
    if (child instanceof HTMLElement) {
      const childOffset = Number(child.dataset.readingSegmentOffset);
      if (Number.isSafeInteger(childOffset)) {
        return Object.freeze({ article, offset: childOffset });
      }
    }
  }
  return Object.freeze({ article, offset: lineOffset + lineLength });
}

export function readContinuousReadingSelection(
  selection: Selection | null,
  readingContainer: HTMLElement,
): ContinuousReadingSelection | null {
  if (
    selection === null ||
    selection.rangeCount === 0 ||
    selection.isCollapsed ||
    selection.anchorNode === null ||
    selection.focusNode === null ||
    !readingContainer.contains(selection.anchorNode) ||
    !readingContainer.contains(selection.focusNode)
  ) {
    return null;
  }
  const anchorBoundary = boundaryOffset(
    selection.anchorNode,
    selection.anchorOffset,
  );
  const headBoundary = boundaryOffset(
    selection.focusNode,
    selection.focusOffset,
  );
  if (
    anchorBoundary === null ||
    headBoundary === null ||
    anchorBoundary.article !== headBoundary.article
  ) {
    return null;
  }
  const documentId = anchorBoundary.article.dataset.readingDocumentId;
  const documentRevisionId =
    anchorBoundary.article.dataset.readingDocumentRevisionId;
  if (documentId === undefined || documentRevisionId === undefined) return null;
  const from = Math.min(anchorBoundary.offset, headBoundary.offset);
  const to = Math.max(anchorBoundary.offset, headBoundary.offset);
  if (from === to) return null;
  return Object.freeze({
    documentId: documentId as EntityId<"Document">,
    documentRevisionId: documentRevisionId as EntityId<"DocumentRevision">,
    anchor: anchorBoundary.offset,
    head: headBoundary.offset,
    from,
    to,
  });
}
