import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { ManuscriptDocumentSource } from "./manuscript-document-profile";
import { searchManuscriptsForWork } from "./search-manuscripts";

function createDocument(input: {
  readonly workId: string;
  readonly label: string;
  readonly manuscript: string;
}): ManuscriptDocumentSource {
  return {
    workId: entityId<"Work">(input.workId),
    documentId: entityId<"Document">(randomUUID()),
    documentRevisionId: null,
    label: input.label,
    initialText: input.manuscript,
  };
}

describe("searchManuscriptsForWork", () => {
  it("searches document labels and manuscripts only inside the requested Work", () => {
    const ownerWorkId = randomUUID();
    const otherWorkId = randomUUID();
    const query = randomUUID().slice(0, 8);
    const ownerTitleMatch = createDocument({
      workId: ownerWorkId,
      label: `${randomUUID()}${query}${randomUUID()}`,
      manuscript: randomUUID(),
    });
    const ownerManuscriptMatch = createDocument({
      workId: ownerWorkId,
      label: randomUUID(),
      manuscript: `${query}${randomUUID()}${query}`,
    });
    const ownerMiss = createDocument({
      workId: ownerWorkId,
      label: randomUUID(),
      manuscript: randomUUID(),
    });
    const foreignMatch = createDocument({
      workId: otherWorkId,
      label: query,
      manuscript: `${query}${query}`,
    });
    const documents = [
      ownerTitleMatch,
      ownerManuscriptMatch,
      ownerMiss,
      foreignMatch,
    ];

    const result = searchManuscriptsForWork({
      workId: entityId<"Work">(ownerWorkId),
      documents,
      query,
      readManuscript: (document) => document.initialText,
    });

    expect(result).toEqual({
      workId: ownerWorkId,
      query,
      matchingDocumentCount: 2,
      totalMatchCount: 3,
      documents: [
        {
          documentId: ownerTitleMatch.documentId,
          label: ownerTitleMatch.label,
          labelMatchCount: 1,
          manuscriptMatchCount: 0,
          firstManuscriptOffset: null,
        },
        {
          documentId: ownerManuscriptMatch.documentId,
          label: ownerManuscriptMatch.label,
          labelMatchCount: 0,
          manuscriptMatchCount: 2,
          firstManuscriptOffset: 0,
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.documents)).toBe(true);
    expect(Object.isFrozen(result.documents[0])).toBe(true);
    expect(documents).toEqual([
      ownerTitleMatch,
      ownerManuscriptMatch,
      ownerMiss,
      foreignMatch,
    ]);
  });

  it("reads the current manuscript supplied at command time instead of the initial profile text", () => {
    const workId = entityId<"Work">(randomUUID());
    const query = randomUUID();
    const document = createDocument({
      workId,
      label: randomUUID(),
      manuscript: randomUUID(),
    });
    const currentManuscript = `${document.initialText}${query}`;

    const result = searchManuscriptsForWork({
      workId,
      documents: [document],
      query,
      readManuscript: (candidate) =>
        candidate.documentId === document.documentId
          ? currentManuscript
          : candidate.initialText,
    });

    expect(result.matchingDocumentCount).toBe(1);
    expect(result.totalMatchCount).toBe(1);
    expect(result.documents[0]?.manuscriptMatchCount).toBe(1);
    expect(result.documents[0]?.firstManuscriptOffset).toBe(
      document.initialText.length,
    );
  });

  it("rejects an empty query instead of treating every offset as a match", () => {
    expect(() =>
      searchManuscriptsForWork({
        workId: entityId<"Work">(randomUUID()),
        documents: [],
        query: "",
        readManuscript: (document) => document.initialText,
      }),
    ).toThrow(/query/i);
  });
});
