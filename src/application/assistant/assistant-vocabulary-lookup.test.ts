import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  findExactVocabularyOccurrences,
  parseAssistantVocabularyCandidate,
} from "./assistant-vocabulary-lookup";

describe("assistant vocabulary lookup", () => {
  it("finds every exact occurrence inside the requested Work without rewriting text", () => {
    const workId = entityId<"Work">("work-a");
    const otherWorkId = entityId<"Work">("work-b");
    const occurrences = findExactVocabularyOccurrences({
      workId,
      query: "aba",
      documents: [
        {
          workId,
          documentId: entityId<"Document">("document-a"),
          documentRevisionId: entityId<"DocumentRevision">("revision-a"),
          text: "ababa",
        },
        {
          workId: otherWorkId,
          documentId: entityId<"Document">("document-b"),
          documentRevisionId: entityId<"DocumentRevision">("revision-b"),
          text: "aba",
        },
      ],
    });

    expect(occurrences).toEqual([
      {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 0,
        to: 3,
      },
      {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 2,
        to: 5,
      },
    ]);
  });

  it("keeps the exact selected query and value-bearing result outside the receipt", () => {
    const candidate = parseAssistantVocabularyCandidate({
      schemaVersion: 1,
      candidateId: "candidate-a",
      workId: "work-a",
      conversationId: "conversation-a",
      destinationId: "runtime-local-search",
      sourceRange: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 1,
        to: 5,
      },
      query: " 어휘 ",
      occurrences: [
        {
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from: 1,
          to: 5,
        },
      ],
      receiptId: "receipt-a",
      createdAt: "2026-08-10T01:00:00.000Z",
    });

    expect(candidate.query).toBe(" 어휘 ");
    expect(candidate.occurrences).toHaveLength(1);
  });
});
