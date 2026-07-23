import type { EntityId } from "../../domain/writing";
import type { ManuscriptDocumentSource } from "./manuscript-document-profile";

export type ManuscriptSearchDocumentResult = {
  readonly documentId: EntityId<"Document">;
  readonly label: string;
  readonly labelMatchCount: number;
  readonly manuscriptMatchCount: number;
  readonly firstManuscriptOffset: number | null;
};

export type ManuscriptSearchResult = {
  readonly workId: EntityId<"Work">;
  readonly query: string;
  readonly matchingDocumentCount: number;
  readonly totalMatchCount: number;
  readonly documents: readonly ManuscriptSearchDocumentResult[];
};

function findMatchOffsets(source: string, query: string): number[] {
  const offsets: number[] = [];
  let fromOffset = 0;
  while (fromOffset <= source.length - query.length) {
    const offset = source.indexOf(query, fromOffset);
    if (offset === -1) {
      break;
    }
    offsets.push(offset);
    fromOffset = offset + query.length;
  }
  return offsets;
}

export function searchManuscriptsForWork(input: {
  readonly workId: EntityId<"Work">;
  readonly documents: readonly ManuscriptDocumentSource[];
  readonly query: string;
  readonly readManuscript: (
    document: ManuscriptDocumentSource,
  ) => string;
}): ManuscriptSearchResult {
  if (input.query.length === 0) {
    throw new Error("Manuscript search query must not be empty");
  }

  const documents: ManuscriptSearchDocumentResult[] = [];
  let totalMatchCount = 0;
  for (const document of input.documents) {
    if (document.workId !== input.workId) {
      continue;
    }
    const labelOffsets = findMatchOffsets(document.label, input.query);
    const manuscriptOffsets = findMatchOffsets(
      input.readManuscript(document),
      input.query,
    );
    const documentMatchCount =
      labelOffsets.length + manuscriptOffsets.length;
    if (documentMatchCount === 0) {
      continue;
    }
    totalMatchCount += documentMatchCount;
    documents.push(
      Object.freeze({
        documentId: document.documentId,
        label: document.label,
        labelMatchCount: labelOffsets.length,
        manuscriptMatchCount: manuscriptOffsets.length,
        firstManuscriptOffset: manuscriptOffsets[0] ?? null,
      }),
    );
  }

  return Object.freeze({
    workId: input.workId,
    query: input.query,
    matchingDocumentCount: documents.length,
    totalMatchCount,
    documents: Object.freeze(documents),
  });
}
