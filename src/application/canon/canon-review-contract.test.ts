import { describe, expect, it } from "vitest";

import {
  CANON_REVIEW_PROMPT_VERSION,
  parseCanonReviewCandidate,
  parseCanonReviewDecisionReceipt,
  parseDecideCanonReviewItemCommand,
  parseResolveCanonReviewItemTargetCommand,
  parseRunCanonReviewCommand,
  parseUpdateCanonReviewItemCommand,
} from "./canon-review-contract";

const candidate = {
  schemaVersion: 1,
  candidateId: "candidate-1",
  revision: 1,
  requestId: "request-1",
  workId: "work-1",
  sourceRange: {
    documentId: "document-1",
    documentRevisionId: "revision-1",
    from: 2,
    to: 12,
  },
  providerId: "provider-from-runtime",
  modelId: "model-from-runtime",
  promptVersion: CANON_REVIEW_PROMPT_VERSION,
  status: "ready",
  items: [{
    itemId: "item-1",
    targetHint: "윤서",
    target: {
      kind: "character",
      operation: "update",
      characterId: "character-1",
      expectedRevision: 3,
    },
    assertionBasis: "explicit-evidence",
    reason: "선택 원문에 역할 변화가 직접 적혀 있다.",
    evidence: [{
      evidenceId: "evidence-1",
      documentId: "document-1",
      documentRevisionId: "revision-1",
      from: 2,
      to: 4,
      exactText: "윤서",
      anchorId: null,
    }],
    fieldChanges: [{
      field: "role",
      before: "수습",
      after: "정식 기록관",
      selected: true,
    }],
    status: "pending",
    appliedTargetId: null,
  }],
  contextReceiptId: "receipt-1",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
} as const;

describe("canon review contract", () => {
  it("parses a Work-owned field-level Candidate without widening evidence", () => {
    const parsed = parseCanonReviewCandidate(candidate);

    expect(parsed.items[0]?.fieldChanges).toEqual([{
      field: "role",
      before: "수습",
      after: "정식 기록관",
      selected: true,
    }]);
    expect(parsed.items[0]?.evidence[0]).toMatchObject({
      from: 2,
      to: 4,
      exactText: "윤서",
      anchorId: null,
    });
  });

  it("rejects a field that is outside the selected target kind", () => {
    expect(() => parseCanonReviewCandidate({
      ...candidate,
      items: [{
        ...candidate.items[0],
        fieldChanges: [{
          field: "enabled",
          before: false,
          after: true,
          selected: true,
        }],
      }],
    })).toThrow(/unsupported/i);
  });

  it("rejects duplicate field changes and mismatched before/after types", () => {
    expect(() => parseCanonReviewCandidate({
      ...candidate,
      items: [{
        ...candidate.items[0],
        fieldChanges: [
          candidate.items[0].fieldChanges[0],
          candidate.items[0].fieldChanges[0],
        ],
      }],
    })).toThrow(/duplicate/i);
    expect(() => parseCanonReviewCandidate({
      ...candidate,
      items: [{
        ...candidate.items[0],
        fieldChanges: [{
          field: "role",
          before: "수습",
          after: ["정식 기록관"],
          selected: true,
        }],
      }],
    })).toThrow(/string/i);
  });

  it("parses strict run, edit, target resolution, and decision commands", () => {
    expect(parseRunCanonReviewCommand({
      schemaVersion: 1,
      requestId: "request-2",
      workId: "work-1",
      conversationId: "conversation-1",
      sourceRange: candidate.sourceRange,
      requestedTargetKinds: ["character", "character-relation", "lore-entry"],
    }).requestedTargetKinds).toHaveLength(3);
    expect(parseUpdateCanonReviewItemCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: "candidate-1",
      expectedCandidateRevision: 1,
      itemId: "item-1",
      fieldChanges: [{
        field: "role",
        before: "수습",
        after: "정식 기록관",
        selected: false,
      }],
    }).fieldChanges[0]?.selected).toBe(false);
    expect(parseResolveCanonReviewItemTargetCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: "candidate-1",
      expectedCandidateRevision: 1,
      itemId: "item-1",
      target: {
        kind: "update",
        targetId: "character-1",
        expectedRevision: 3,
      },
    }).target).toEqual({
      kind: "update",
      targetId: "character-1",
      expectedRevision: 3,
    });
    expect(parseDecideCanonReviewItemCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: "candidate-1",
      expectedCandidateRevision: 1,
      itemId: "item-1",
      decision: { kind: "approve" },
    }).decision.kind).toBe("approve");
  });

  it("rejects duplicate requested target kinds and empty exact evidence", () => {
    expect(() => parseRunCanonReviewCommand({
      schemaVersion: 1,
      requestId: "request-2",
      workId: "work-1",
      conversationId: "conversation-1",
      sourceRange: candidate.sourceRange,
      requestedTargetKinds: ["character", "character"],
    })).toThrow(/duplicate/i);
    expect(() => parseCanonReviewCandidate({
      ...candidate,
      items: [{ ...candidate.items[0], evidence: [] }],
    })).toThrow(/non-empty/i);
  });

  it("keeps Gate 1 decision targets restricted to its original three wire kinds", () => {
    expect(() => parseCanonReviewDecisionReceipt({
      schemaVersion: 1,
      receiptId: "decision-continuity",
      workId: "work-1",
      candidateId: "candidate-1",
      itemId: "item-1",
      decision: "approve",
      outcome: "applied",
      target: { kind: "continuity-thread", id: "thread-1" },
      targetRevisionBefore: null,
      targetRevisionAfter: 1,
      selectedFields: ["summary"],
      sourceDocumentRevisionId: "revision-1",
      createdAt: "2026-08-29T00:00:00.000Z",
    })).toThrow(/kind/u);
  });

  it("parses CharacterKnowledge as a field-level review target", () => {
    const parsed = parseCanonReviewCandidate({
      ...candidate,
      items: [{
        ...candidate.items[0],
        targetHint: "윤서는 북문이 열린다고 안다.",
        target: {
          kind: "character-knowledge",
          operation: "update",
          knowledgeId: "knowledge-1",
          expectedRevision: 2,
        },
        fieldChanges: [{
          field: "stance",
          before: "suspects",
          after: "knows",
          selected: true,
        }],
      }],
    });

    expect(parsed.items[0]?.target).toEqual({
      kind: "character-knowledge",
      operation: "update",
      knowledgeId: "knowledge-1",
      expectedRevision: 2,
    });
    expect(parseRunCanonReviewCommand({
      schemaVersion: 1,
      requestId: "request-knowledge",
      workId: "work-1",
      conversationId: "conversation-1",
      sourceRange: candidate.sourceRange,
      requestedTargetKinds: ["character-knowledge"],
    }).requestedTargetKinds).toEqual(["character-knowledge"]);
  });
});
