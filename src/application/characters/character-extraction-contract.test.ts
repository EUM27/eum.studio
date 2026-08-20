import { describe, expect, it } from "vitest";
import { entityId } from "../../domain/writing";

import {
  CHARACTER_EXTRACTION_PROMPT_VERSION,
  createCharacterExtractionParagraphs,
  parseCharacterExtractionCandidate,
  parseCharacterExtractionModelPayload,
  parseDecideCharacterExtractionItemCommand,
  parseRunCharacterExtractionCommand,
  resolveCharacterExtractionEvidences,
} from "./character-extraction-contract";

describe("character extraction contract", () => {
  it("maps a model paragraph quote back to the exact selected revision range", () => {
    const sourceRange = {
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
      from: 20,
      to: 44,
    } as const;
    const paragraphs = createCharacterExtractionParagraphs({
      sourceRange,
      manuscript: "윤서는 문을 열었다.\n문밖에 윤서가 섰다.",
    });
    const payload = parseCharacterExtractionModelPayload({
      characters: [{
        name: "윤서",
        aliases: [],
        role: "",
        summary: "",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "",
        evidences: [{ paragraphId: "p1", quote: "윤서" }],
      }],
    });

    expect(resolveCharacterExtractionEvidences({
      sourceRange,
      paragraphs,
      proposal: payload.characters[0]!,
    })).toEqual([{
      documentId: "document-a",
      documentRevisionId: "revision-a",
      from: 20,
      to: 22,
      exactText: "윤서",
    }]);
  });

  it("parses a Work-owned review Candidate and an explicit merge decision", () => {
    const candidate = parseCharacterExtractionCandidate({
      schemaVersion: 1,
      candidateId: "candidate-a",
      revision: 2,
      workId: "work-a",
      sourceRange: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 4,
        to: 12,
      },
      providerId: "provider-a",
      modelId: "model-a",
      promptVersion: CHARACTER_EXTRACTION_PROMPT_VERSION,
      status: "ready",
      items: [{
        itemId: "item-a",
        name: "윤서",
        aliases: ["서린"],
        role: "기록자",
        summary: "",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "",
        evidences: [{
          documentId: "document-a",
          documentRevisionId: "revision-a",
          from: 4,
          to: 6,
          exactText: "윤서",
        }],
        matchingCharacterIds: ["character-a"],
        status: "pending",
        approvedCharacterId: null,
      }],
      contextReceiptId: "receipt-a",
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:01.000Z",
    });
    expect(candidate.items[0]?.matchingCharacterIds).toEqual(["character-a"]);

    expect(parseDecideCharacterExtractionItemCommand({
      schemaVersion: 1,
      workId: "work-a",
      candidateId: "candidate-a",
      expectedCandidateRevision: 2,
      itemId: "item-a",
      decision: {
        kind: "merge",
        targetCharacterId: "character-a",
        expectedCharacterRevision: 3,
        fields: ["aliases", "role"],
      },
    })).toMatchObject({
      decision: {
        kind: "merge",
        targetCharacterId: "character-a",
        expectedCharacterRevision: 3,
        fields: ["aliases", "role"],
      },
    });
  });

  it("keeps the exact Work, conversation, revision, and selection in the run command", () => {
    expect(parseRunCharacterExtractionCommand({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      conversationId: "conversation-a",
      sourceRange: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 3,
        to: 9,
      },
    })).toEqual({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      conversationId: "conversation-a",
      sourceRange: {
        documentId: "document-a",
        documentRevisionId: "revision-a",
        from: 3,
        to: 9,
      },
    });
  });
});
