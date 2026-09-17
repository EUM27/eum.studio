import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import { entityId } from "../../domain/writing";
import { ManuscriptBulkExportDialog } from "./ManuscriptBulkExportDialog";

describe("ManuscriptBulkExportDialog", () => {
  it("lists the actual ordered episodes with every episode selected initially", () => {
    const workId = entityId<"Work">("work-1");
    const documents: readonly ManuscriptDocumentSource[] = [
      { workId, documentId: entityId<"Document">("episode-2"), documentRevisionId: null, label: "2화", initialText: "둘" },
      { workId, documentId: entityId<"Document">("episode-10"), documentRevisionId: null, label: "10화", initialText: "열" },
      { workId, documentId: entityId<"Document">("episode-1"), documentRevisionId: null, label: "1화", initialText: "하나" },
    ];
    const markup = renderToStaticMarkup(createElement(ManuscriptBulkExportDialog, {
      workTitle: "작품",
      orderedDocuments: documents,
      onClose: () => undefined,
      onExport: async () => ({ schemaVersion: 1 as const, status: "cancelled" as const }),
    }));

    expect(markup.indexOf("2화")).toBeLessThan(markup.indexOf("10화"));
    expect(markup.indexOf("10화")).toBeLessThan(markup.indexOf("1화"));
    expect(markup.match(/type="checkbox"/gu)).toHaveLength(3);
    expect(markup.match(/checked=""/gu)).toHaveLength(3);
    expect(markup).toContain("선택 3 / 전체 3회차");
    expect(markup).toContain("선택한 회차 다운로드");
  });
});
