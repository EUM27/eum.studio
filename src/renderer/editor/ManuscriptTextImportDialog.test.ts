import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { ManuscriptTextImportDialog } from "./ManuscriptTextImportDialog";

describe("ManuscriptTextImportDialog", () => {
  it("previews the selected text without exposing a path and requires explicit apply", () => {
    const markup = renderToStaticMarkup(
      createElement(ManuscriptTextImportDialog, {
        applying: false,
        candidate: {
          schemaVersion: 1,
          status: "selected",
          workId: entityId<"Work">(randomUUID()),
          documentId: entityId<"Document">(randomUUID()),
          documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
          fileName: "가져올 원고.txt",
          text: "첫 줄\n둘째 줄",
          byteLength: 21,
        },
        currentText: "기존 원고",
        error: null,
        onApply: () => undefined,
        onClose: () => undefined,
        stale: false,
      }),
    );

    expect(markup).toContain("가져올 원고.txt");
    expect(markup).toContain("첫 줄\n둘째 줄");
    expect(markup).toContain("현재 회차 원고 전체를 교체");
    expect(markup).toContain("현재 원고 교체");
    expect(markup).not.toContain("filePath");
  });
});
