import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  authorizeAssistantVocabularySuggestion,
  createAssistantVocabularySuggestionCandidate,
  parseAssistantVocabularySuggestionResult,
} from "./assistant-vocabulary-suggestion";

describe("assistant vocabulary suggestion", () => {
  it("authorizes and preserves only a user query plus the exact selected range", () => {
    const workId = entityId<"Work">(randomUUID());
    const conversationId = entityId<"AssistantConversation">(randomUUID());
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const documentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const grantId = entityId<"AssistantContextPermissionGrant">(randomUUID());
    const authorization = authorizeAssistantVocabularySuggestion({
      command: {
        schemaVersion: 1,
        requestId: randomUUID(),
        workId,
        conversationId,
        connectionId,
        query: "근엄하다의 유의어",
        sourceRange: {
          documentId,
          documentRevisionId,
          from: 3,
          to: 8,
        },
      },
      grants: [{
        schemaVersion: 1,
        grantId,
        revision: 1,
        workId,
        conversationId,
        capability: "vocabulary-lookup",
        destinationId: connectionId,
        localScope: "selection",
        externalScope: "selection",
        duration: "conversation",
        createdAt: "2026-08-10T03:00:00.000Z",
        revokedAt: null,
        consumedAt: null,
      }],
      documents: [{
        workId,
        documentId,
        documentRevisionId,
        length: 20,
      }],
    });

    expect(authorization).toMatchObject({
      allowed: true,
      command: {
        query: "근엄하다의 유의어",
        sourceRange: { documentId, documentRevisionId, from: 3, to: 8 },
      },
      context: {
        request: {
          requiredLocalScope: "selection",
          requiredExternalScope: "selection",
          readRanges: [{ documentId, documentRevisionId, from: 3, to: 8 }],
          transmittedRanges: [{
            documentId,
            documentRevisionId,
            from: 3,
            to: 8,
          }],
        },
        grantIds: [grantId],
      },
    });
  });

  it("creates a read-only Work Candidate without manuscript actions", () => {
    const authorization = authorizeAssistantVocabularySuggestion({
      command: {
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: randomUUID(),
        conversationId: randomUUID(),
        connectionId: randomUUID(),
        query: "차가운의 뉘앙스 차이",
        sourceRange: null,
      },
      grants: [],
      documents: [],
    });
    if (!authorization.allowed) {
      throw new Error("Expected a context-free user query to be authorized");
    }

    const candidate = createAssistantVocabularySuggestionCandidate({
      authorization,
      payload: {
        suggestions: [{
          word: "서늘한",
          nuance: "감각과 분위기를 함께 암시",
          example: "서늘한 기운이 문틈으로 스며들었다.",
        }],
        note: "문맥에 맞는 표현을 사용자가 고릅니다.",
      },
      candidateId: randomUUID(),
      connectorReceiptId: randomUUID(),
      contextReceiptId: null,
      createdAt: "2026-08-10T03:01:00.000Z",
    });

    expect(candidate).toMatchObject({
      query: "차가운의 뉘앙스 차이",
      sourceRange: null,
      suggestions: [{
        word: "서늘한",
        nuance: "감각과 분위기를 함께 암시",
        example: "서늘한 기운이 문틈으로 스며들었다.",
      }],
      note: "문맥에 맞는 표현을 사용자가 고릅니다.",
      contextReceiptId: null,
    });
    expect(candidate).not.toHaveProperty("replacement");
    expect(candidate).not.toHaveProperty("changes");
    expect(candidate).not.toHaveProperty("manuscriptCommand");
    expect(parseAssistantVocabularySuggestionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    })).toEqual({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  });
});
