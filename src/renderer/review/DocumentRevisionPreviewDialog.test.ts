import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentRevisionContentProjection } from "../../application/revisions/work-version-contract";
import { entityId } from "../../domain/writing";
import { DocumentRevisionPreviewDialog } from "./DocumentRevisionPreviewDialog";

describe("DocumentRevisionPreviewDialog", () => {
  it("shows immutable revision text without a restore action", () => {
    const timestamp = "2026-08-21T01:00:00.000Z";
    const projection = {
      schemaVersion: 1,
      revision: {
        schemaVersion: 1,
        revisionId: entityId<"DocumentRevision">("revision-1"),
        workId: entityId<"Work">("work-1"),
        documentId: entityId<"Document">("document-1"),
        parentRevisionId: null,
        length: 9,
        cause: "manuscript-edit",
        createdAt: timestamp,
        durableAt: timestamp,
        isCurrent: false,
      },
      text: "완료 당시 원고",
    } satisfies DocumentRevisionContentProjection;
    const markup = renderToStaticMarkup(createElement(
      DocumentRevisionPreviewDialog,
      { documentTitle: "5화", onClose: vi.fn(), projection },
    ));

    expect(markup).toContain("완료 당시 버전");
    expect(markup).toContain("완료 당시 원고");
    expect(markup).not.toContain("복원");
  });
});
