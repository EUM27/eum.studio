import { describe, expect, it } from "vitest";

import { entityId } from "../../../domain/writing";
import { parseWorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import { replaceCatalogDocumentRevision } from "./useWorkspaceRuntimeProjectionController";

function createCatalog() {
  return parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works: [
      {
        workId: "work-a",
        title: "A",
        updatedAt: "2026-09-04T00:00:00.000Z",
        folders: [],
        documents: [
          {
            documentId: "document-a",
            title: "A-1",
            currentRevisionId: "revision-before",
            folderId: null,
            completion: {
              schemaVersion: 1,
              workId: "work-a",
              documentId: "document-a",
              revision: 0,
              completedAt: null,
              completedDate: null,
              completedTimeZone: null,
              completedDocumentRevisionId: null,
              state: "incomplete",
              updatedAt: null,
            },
          },
        ],
      },
    ],
    activeWorkId: "work-a",
    activeDocumentId: "document-a",
    canCreateFirstWork: false,
  });
}

describe("replaceCatalogDocumentRevision", () => {
  it("installs the durable receipt revision without reloading the whole catalog", () => {
    const catalog = createCatalog();
    const next = replaceCatalogDocumentRevision(catalog, {
      workId: entityId<"Work">("work-a"),
      documentId: entityId<"Document">("document-a"),
      revisionId: entityId<"DocumentRevision">("revision-after"),
    });

    expect(next.works[0]?.documents[0]?.currentRevisionId)
      .toBe("revision-after");
    expect(next.works[0]?.documents[0]?.completion)
      .toBe(catalog.works[0]?.documents[0]?.completion);
    expect(next.activeWorkId).toBe(catalog.activeWorkId);
    expect(next.activeDocumentId).toBe(catalog.activeDocumentId);
  });

  it("rejects a receipt outside the catalog ownership boundary", () => {
    expect(() => replaceCatalogDocumentRevision(createCatalog(), {
      workId: entityId<"Work">("work-a"),
      documentId: entityId<"Document">("document-outside"),
      revisionId: entityId<"DocumentRevision">("revision-after"),
    })).toThrow("Durable receipt is outside the workspace catalog");
  });
});
