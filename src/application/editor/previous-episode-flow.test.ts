import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseManuscriptDocumentProfile } from "./manuscript-document-profile";
import {
  derivePreviousEpisodeFlowPreview,
  getPreviousEpisodeFlowPreviewText,
} from "./previous-episode-flow";

function createDocuments(initialTexts: readonly string[]) {
  const workId = randomUUID();
  const documents = initialTexts.map((initialText) => ({
    workId,
    documentId: randomUUID(),
    documentRevisionId: randomUUID(),
    label: randomUUID(),
    initialText,
  }));
  return parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: documents[0]?.documentId,
    documents,
  }).documents;
}

describe("previous episode flow", () => {
  it("keeps the trailing sentence and paragraph boundaries", () => {
    const text = [
      "Discarded opening.",
      "Earlier detail. Turning point!",
      "Closing image?",
    ].join("\r\n\r\n");

    expect(getPreviousEpisodeFlowPreviewText(text, 25)).toBe(
      "Turning point!\n\nClosing image?",
    );
  });

  it("derives only the immediate previous document from its latest materialized text", () => {
    const documents = createDocuments([
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ]);
    const firstDocument = documents[0]!;
    const secondDocument = documents[1]!;
    const thirdDocument = documents[2]!;
    const latestSecondText = randomUUID();

    const preview = derivePreviousEpisodeFlowPreview(
      thirdDocument,
      documents,
      (document) =>
        document.documentId === secondDocument.documentId
          ? latestSecondText
          : firstDocument.initialText,
    );

    expect(preview).toEqual({
      sourceDocumentId: secondDocument.documentId,
      title: secondDocument.label,
      text: latestSecondText,
    });
    expect(Object.isFrozen(preview)).toBe(true);
  });

  it("returns no preview without a non-empty previous document in the same work", () => {
    const documents = createDocuments(["", randomUUID()]);
    const firstDocument = documents[0]!;
    const secondDocument = documents[1]!;
    const otherWorkDocument = createDocuments([randomUUID()])[0]!;

    expect(
      derivePreviousEpisodeFlowPreview(
        firstDocument,
        documents,
        (document) => document.initialText,
      ),
    ).toBeNull();
    expect(
      derivePreviousEpisodeFlowPreview(
        secondDocument,
        documents,
        (document) => document.initialText,
      ),
    ).toBeNull();
    expect(
      derivePreviousEpisodeFlowPreview(
        secondDocument,
        [otherWorkDocument, secondDocument],
        (document) => document.initialText,
      ),
    ).toBeNull();
  });
});
