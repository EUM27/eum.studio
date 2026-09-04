import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { prepareManuscriptBulkTextExport } from "./manuscript-bulk-export";

describe("prepareManuscriptBulkTextExport", () => {
  it("joins selected manuscripts in the supplied episode order instead of title or selection order", () => {
    const workId = entityId<"Work">("work-1");
    const episode2 = entityId<"Document">("episode-2");
    const episode10 = entityId<"Document">("episode-10");
    const episode1 = entityId<"Document">("episode-1");

    expect(prepareManuscriptBulkTextExport({
      workId,
      orderedDocuments: [
        { workId, documentId: episode2, text: "둘째 원고" },
        { workId, documentId: episode10, text: "열째 원고" },
        { workId, documentId: episode1, text: "첫째 원고" },
      ],
      selectedDocumentIds: [episode1, episode2],
    })).toEqual({
      documentId: episode2,
      text: "둘째 원고\n\n첫째 원고",
    });
  });

  it("rejects an empty or unknown episode selection", () => {
    const workId = entityId<"Work">("work-1");
    const documentId = entityId<"Document">("episode-1");
    const orderedDocuments = [{ workId, documentId, text: "원고" }];

    expect(() => prepareManuscriptBulkTextExport({
      workId,
      orderedDocuments,
      selectedDocumentIds: [],
    })).toThrow("At least one manuscript export Document must be selected");
    expect(() => prepareManuscriptBulkTextExport({
      workId,
      orderedDocuments,
      selectedDocumentIds: [entityId<"Document">("missing")],
    })).toThrow("Unknown manuscript export Document: missing");
  });
});
