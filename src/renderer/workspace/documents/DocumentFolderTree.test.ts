import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentCompletionProjection } from "../../../application/workspace/document-completion";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { entityId, type EntityId } from "../../../domain/writing";
import { DocumentFolderTree } from "./DocumentFolderTree";

function incompleteCompletion(
  documentId: EntityId<"Document">,
): DocumentCompletionProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">("work-1"),
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

describe("DocumentFolderTree", () => {
  it("keeps the existing folder and document rail markup contract", () => {
    const rootDocumentId = entityId<"Document">("document-root");
    const childDocumentId = entityId<"Document">("document-child");
    const rootFolderId = entityId<"DocumentFolder">("folder-root");
    const childFolderId = entityId<"DocumentFolder">("folder-child");
    const work: WorkspaceWorkSummary = Object.freeze({
      workId: entityId<"Work">("work-1"),
      title: "작품",
      updatedAt: "2026-08-23T00:00:00.000Z",
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
        Object.freeze({
          documentId: rootDocumentId,
          title: "프롤로그",
          currentRevisionId: entityId<"DocumentRevision">("revision-root"),
          folderId: null,
          completion: incompleteCompletion(rootDocumentId),
        }),
        Object.freeze({
          documentId: childDocumentId,
          title: "1회차",
          currentRevisionId: entityId<"DocumentRevision">("revision-child"),
          folderId: childFolderId,
          completion: incompleteCompletion(childDocumentId),
        }),
      ]),
    });

    const markup = renderToStaticMarkup(createElement(DocumentFolderTree, {
      work,
      documentCreateControl: createElement("button", null, "새 회차"),
      activeDocumentId: childDocumentId,
      disabled: false,
      onActivateDocument: vi.fn(),
      onRenameDocument: vi.fn(async () => undefined),
      onCreateFolder: vi.fn(async () => undefined),
      onMoveDocument: vi.fn(async () => undefined),
      onRenameFolder: vi.fn(async () => undefined),
      onPlaceDocument: vi.fn(async () => undefined),
      onRetireDocument: vi.fn(async () => undefined),
      onRetireAllDocuments: vi.fn(async () => undefined),
      onRetireFolder: vi.fn(async () => undefined),
    }));

    expect(markup).toContain('aria-label="회차 폴더"');
    expect(markup).toContain('aria-label="회차 폴더 트리"');
    expect(markup).toContain('data-document-folder-id="folder-root"');
    expect(markup).toContain('data-document-folder-id="folder-child"');
    expect(markup).toContain('data-document-id="document-root"');
    expect(markup).toContain('data-document-id="document-child"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("프롤로그");
    expect(markup).toContain("1회차");
    expect(markup).toContain("폴더 추가");
  });
});
