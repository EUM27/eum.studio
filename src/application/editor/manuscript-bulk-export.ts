import type { EntityId } from "../../domain/writing";

export type OrderedManuscriptBulkExportDocument = Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  text: string;
}>;

export type PreparedManuscriptBulkTextExport = Readonly<{
  documentId: EntityId<"Document">;
  text: string;
}>;

const EPISODE_SEPARATOR = "\n\n";

export function selectManuscriptBulkExportDocuments<T extends Readonly<{
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
}>>(input: Readonly<{
  workId: EntityId<"Work">;
  orderedDocuments: readonly T[];
  selectedDocumentIds: readonly EntityId<"Document">[];
}>): readonly T[] {
  const selectedDocumentIds = new Set(input.selectedDocumentIds);
  if (selectedDocumentIds.size !== input.selectedDocumentIds.length) {
    throw new Error("Selected manuscript export Documents must be unique");
  }
  if (selectedDocumentIds.size === 0) {
    throw new Error("At least one manuscript export Document must be selected");
  }

  const orderedDocumentIds = new Set<EntityId<"Document">>();
  for (const document of input.orderedDocuments) {
    if (document.workId !== input.workId) {
      throw new Error(
        `Work/document boundary violation: ${input.workId}/${document.documentId}`,
      );
    }
    if (orderedDocumentIds.has(document.documentId)) {
      throw new Error(`Duplicate manuscript export Document: ${document.documentId}`);
    }
    orderedDocumentIds.add(document.documentId);
  }
  for (const documentId of selectedDocumentIds) {
    if (!orderedDocumentIds.has(documentId)) {
      throw new Error(`Unknown manuscript export Document: ${documentId}`);
    }
  }

  return Object.freeze(input.orderedDocuments.filter((document) =>
    selectedDocumentIds.has(document.documentId)
  ));
}

export function prepareManuscriptBulkTextExport(input: Readonly<{
  workId: EntityId<"Work">;
  orderedDocuments: readonly OrderedManuscriptBulkExportDocument[];
  selectedDocumentIds: readonly EntityId<"Document">[];
}>): PreparedManuscriptBulkTextExport {
  const selectedDocuments = selectManuscriptBulkExportDocuments(input);
  const firstDocument = selectedDocuments[0];
  if (firstDocument === undefined) {
    throw new Error("At least one manuscript export Document must be selected");
  }

  return Object.freeze({
    documentId: firstDocument.documentId,
    text: selectedDocuments.map((document) => document.text).join(EPISODE_SEPARATOR),
  });
}
