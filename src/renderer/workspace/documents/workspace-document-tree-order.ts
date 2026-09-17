import type {
  WorkspaceDocumentFolderSummary,
  WorkspaceDocumentSummary,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";

type WorkspaceDocumentItem = Readonly<{
  documentId: WorkspaceDocumentSummary["documentId"];
}>;

type WorkspaceDocumentTree = Pick<
  WorkspaceWorkSummary,
  "documents" | "folders"
>;

export function orderWorkspaceDocumentItemsByTree<
  TItem extends WorkspaceDocumentItem,
>(
  work: WorkspaceDocumentTree,
  items: readonly TItem[],
): readonly TItem[] {
  const itemByDocumentId = new Map(
    items.map((item) => [item.documentId, item] as const),
  );
  if (itemByDocumentId.size !== items.length) {
    throw new Error("Workspace document tree items must have unique identities");
  }

  const foldersByParentId = new Map<
    WorkspaceDocumentFolderSummary["folderId"] | null,
    WorkspaceDocumentFolderSummary[]
  >();
  for (const folder of work.folders) {
    const siblings = foldersByParentId.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    foldersByParentId.set(folder.parentFolderId, siblings);
  }

  const documentsByFolderId = new Map<
    WorkspaceDocumentFolderSummary["folderId"] | null,
    WorkspaceDocumentSummary[]
  >();
  for (const document of work.documents) {
    const siblings = documentsByFolderId.get(document.folderId) ?? [];
    siblings.push(document);
    documentsByFolderId.set(document.folderId, siblings);
  }

  const orderedItems: TItem[] = [];
  const visitedFolderIds = new Set<
    WorkspaceDocumentFolderSummary["folderId"]
  >();
  const appendChildren = (
    parentFolderId: WorkspaceDocumentFolderSummary["folderId"] | null,
  ): void => {
    for (const folder of foldersByParentId.get(parentFolderId) ?? []) {
      if (visitedFolderIds.has(folder.folderId)) {
        throw new Error(`Workspace document folder cycle: ${folder.folderId}`);
      }
      visitedFolderIds.add(folder.folderId);
      appendChildren(folder.folderId);
    }
    for (const document of documentsByFolderId.get(parentFolderId) ?? []) {
      const item = itemByDocumentId.get(document.documentId);
      if (item === undefined) {
        throw new Error(
          `Workspace document tree item is unavailable: ${document.documentId}`,
        );
      }
      orderedItems.push(item);
    }
  };

  appendChildren(null);
  if (
    visitedFolderIds.size !== work.folders.length ||
    orderedItems.length !== work.documents.length ||
    items.length !== work.documents.length
  ) {
    throw new Error("Workspace document tree does not match its document items");
  }
  return Object.freeze(orderedItems);
}
