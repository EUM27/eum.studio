import { describe, expect, it } from "vitest";

import type { DocumentCompletionProjection } from "../../../application/workspace/document-completion";
import type {
  WorkspaceDocumentSummary,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../../domain/writing";
import { orderWorkspaceDocumentItemsByTree } from "./workspace-document-tree-order";

function incompleteCompletion(
  workId: EntityId<"Work">,
  documentId: EntityId<"Document">,
): DocumentCompletionProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId,
    documentId,
    revision: 0,
    completedAt: null,
    completedDate: null,
    completedTimeZone: null,
    completedDocumentRevisionId: null,
    state: "incomplete",
    updatedAt: null,
  });
}

function documentSummary(
  workId: EntityId<"Work">,
  documentId: EntityId<"Document">,
  folderId: EntityId<"DocumentFolder"> | null,
): WorkspaceDocumentSummary {
  return Object.freeze({
    documentId,
    title: documentId,
    currentRevisionId: entityId<"DocumentRevision">(
      `revision-${documentId}`,
    ),
    folderId,
    completion: incompleteCompletion(workId, documentId),
  });
}

describe("workspace document tree order", () => {
  it("orders document items exactly as nested folders and root documents are listed", () => {
    const workId = entityId<"Work">("work-1");
    const rootFolderId = entityId<"DocumentFolder">("folder-root");
    const childFolderId = entityId<"DocumentFolder">("folder-child");
    const firstRootId = entityId<"Document">("document-root-first");
    const rootFolderDocumentId = entityId<"Document">(
      "document-folder-root",
    );
    const childFolderDocumentId = entityId<"Document">(
      "document-folder-child",
    );
    const secondRootId = entityId<"Document">("document-root-second");
    const work: WorkspaceWorkSummary = Object.freeze({
      workId,
      title: "작품",
      updatedAt: "2026-09-04T00:00:00.000Z",
      folders: Object.freeze([
        Object.freeze({
          folderId: rootFolderId,
          title: "1부",
          parentFolderId: null,
        }),
        Object.freeze({
          folderId: childFolderId,
          title: "도입",
          parentFolderId: rootFolderId,
        }),
      ]),
      documents: Object.freeze([
        documentSummary(workId, firstRootId, null),
        documentSummary(workId, rootFolderDocumentId, rootFolderId),
        documentSummary(workId, childFolderDocumentId, childFolderId),
        documentSummary(workId, secondRootId, null),
      ]),
    });
    const items = work.documents.map((document) =>
      Object.freeze({ documentId: document.documentId })
    );

    expect(
      orderWorkspaceDocumentItemsByTree(work, items).map(
        (document) => document.documentId,
      ),
    ).toEqual([
      childFolderDocumentId,
      rootFolderDocumentId,
      firstRootId,
      secondRootId,
    ]);
  });
});
