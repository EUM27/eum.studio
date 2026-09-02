import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { ContinuousReadingSession } from "../../application/editor/continuous-reading-progress";
import { ContinuousReadingDialog } from "./ContinuousReadingDialog";

const workId = entityId<"Work">("work-a");
const documents = Object.freeze(
  ["1화", "2화", "3화"].map((title, index) =>
    Object.freeze({
      workId,
      documentId: entityId<"Document">(`document-${index + 1}`),
      documentRevisionId: entityId<"DocumentRevision">(`revision-${index + 1}`),
      title,
      text: `${title} 첫 줄\n${title} 둘째 줄`,
    }),
  ),
);

function render(session: ContinuousReadingSession): string {
  return renderToStaticMarkup(
    createElement(ContinuousReadingDialog, {
      session,
      annotations: [],
      annotationBusy: false,
      annotationError: null,
      onCreateAnnotation: async () => null,
      onClose: async () => undefined,
      onProgress: async () => undefined,
      onRetireAnnotation: async () => false,
      onUpdateAnnotation: async () => null,
    }),
  );
}

describe("ContinuousReadingDialog", () => {
  it("starts with only the first Work document and exposes scroll loading", () => {
    const markup = render({
      schemaVersion: 1,
      workId,
      status: "fresh",
      initialLoadedCount: 1,
      initialLocation: null,
      documents,
    });

    expect(markup).toContain("연속 읽기");
    expect(markup).toContain("1 / 3회차");
    expect(markup).toContain("1화 첫 줄");
    expect(markup).not.toContain("2화 첫 줄");
    expect(markup).toContain("스크롤하면 다음 회차를 이어서 불러옵니다.");
  });

  it("renders through an exact restored Document and reports stale progress", () => {
    const restoredMarkup = render({
      schemaVersion: 1,
      workId,
      status: "restored",
      initialLoadedCount: 2,
      initialLocation: {
        documentId: documents[1]!.documentId,
        documentRevisionId: documents[1]!.documentRevisionId,
        textOffset: 0,
      },
      documents,
    });
    expect(restoredMarkup).toContain("1화 첫 줄");
    expect(restoredMarkup).toContain("2화 첫 줄");
    expect(restoredMarkup).not.toContain("3화 첫 줄");

    const staleMarkup = render({
      schemaVersion: 1,
      workId,
      status: "stale",
      initialLoadedCount: 1,
      initialLocation: null,
      documents,
    });
    expect(staleMarkup).toContain("이전 읽기 위치를 복원하지 않았습니다.");
  });
});
