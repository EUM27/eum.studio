import { describe, expect, it } from "vitest";

import {
  CONTINUITY_REVIEW_PROMPT_VERSION,
  parseContinuityReviewCandidateList,
  parseContinuityReviewDecisionResult,
  parseContinuityReviewResult,
  parseContinuityReviewCandidate,
  parseDecideContinuityReviewItemCommand,
  parseListContinuityReviewCandidatesCommand,
  parseRunContinuityReviewCommand,
  parseUpdateContinuityReviewItemCommand,
} from "./continuity-review-contract";

const candidate = Object.freeze({
  schemaVersion: 1,
  candidateId: "continuity-candidate-1",
  revision: 1,
  requestId: "continuity-request-1",
  workId: "work-1",
  sourceRange: {
    documentId: "document-1",
    documentRevisionId: "revision-1",
    from: 0,
    to: 12,
  },
  providerId: "provider-runtime",
  modelId: "model-runtime",
  promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
  status: "ready",
  items: [{
    itemId: "continuity-item-1",
    assertionBasis: "model-inference",
    draft: {
      kind: "open-question",
      title: "누가 문을 열었는가",
      note: "다음 장면에서 확인",
      subjectRefs: [{ kind: "character", id: "character-1" }],
    },
    reason: "답이 남아 있다.",
    evidence: [{
      evidenceId: "continuity-evidence-1",
      documentId: "document-1",
      documentRevisionId: "revision-1",
      from: 2,
      to: 8,
      exactText: "누가 열었지",
      anchorId: null,
    }],
    potentialDuplicateThreadIds: ["thread-existing"],
    status: "pending",
    appliedThreadId: null,
  }],
  contextReceiptId: "context-receipt-1",
  createdAt: "2026-08-29T01:00:00.000Z",
  updatedAt: "2026-08-29T01:00:00.000Z",
});

describe("Continuity review contract", () => {
  it("parses a strict Candidate whose inference still requires an explicit decision", () => {
    expect(parseContinuityReviewCandidate(candidate)).toEqual(candidate);
    expect(parseDecideContinuityReviewItemCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: candidate.candidateId,
      expectedCandidateRevision: 1,
      itemId: "continuity-item-1",
      decision: "approve",
      acknowledgedDuplicateThreadIds: ["thread-existing"],
    })).toMatchObject({
      decision: "approve",
      acknowledgedDuplicateThreadIds: ["thread-existing"],
    });
  });

  it("parses run, list, and editable draft commands without exposing model payloads", () => {
    expect(parseRunContinuityReviewCommand({
      schemaVersion: 1,
      requestId: "continuity-request-1",
      workId: "work-1",
      conversationId: "conversation-1",
      sourceRange: candidate.sourceRange,
    }).sourceRange).toEqual(candidate.sourceRange);
    expect(parseListContinuityReviewCandidatesCommand({
      schemaVersion: 1,
      workId: "work-1",
      status: "actionable",
    }).status).toBe("actionable");
    expect(parseUpdateContinuityReviewItemCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: candidate.candidateId,
      expectedCandidateRevision: 1,
      itemId: "continuity-item-1",
      draft: {
        ...candidate.items[0]!.draft,
        note: "사용자가 수정한 메모",
      },
    }).draft.note).toBe("사용자가 수정한 메모");
  });

  it("rejects blank evidence, duplicate refs, unsupported fields, and duplicate acknowledgements", () => {
    expect(() => parseContinuityReviewCandidate({
      ...candidate,
      items: [{ ...candidate.items[0], evidence: [] }],
    })).toThrow(/evidence/u);
    expect(() => parseContinuityReviewCandidate({
      ...candidate,
      items: [{
        ...candidate.items[0],
        draft: {
          ...candidate.items[0]!.draft,
          subjectRefs: [
            { kind: "character", id: "character-1" },
            { kind: "character", id: "character-1" },
          ],
        },
      }],
    })).toThrow(/duplicate/u);
    expect(() => parseRunContinuityReviewCommand({
      schemaVersion: 1,
      requestId: "continuity-request-1",
      workId: "work-1",
      conversationId: "conversation-1",
      sourceRange: candidate.sourceRange,
      prompt: "not allowed",
    })).toThrow(/fields/u);
    expect(() => parseDecideContinuityReviewItemCommand({
      schemaVersion: 1,
      workId: "work-1",
      candidateId: candidate.candidateId,
      expectedCandidateRevision: 1,
      itemId: "continuity-item-1",
      decision: "approve",
      acknowledgedDuplicateThreadIds: ["thread-existing", "thread-existing"],
    })).toThrow(/duplicate/u);
  });

  it("parses Work-owned lists, run results, and explicit decision receipts", () => {
    expect(parseContinuityReviewCandidateList({
      schemaVersion: 1,
      workId: "work-1",
      candidates: [candidate],
    }).candidates).toHaveLength(1);
    expect(parseContinuityReviewResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    })).toMatchObject({ status: "candidate" });
    expect(parseContinuityReviewDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: {
        ...candidate,
        revision: 2,
        status: "completed",
        items: [{
          ...candidate.items[0],
          status: "approved",
          appliedThreadId: "thread-new",
          evidence: [{ ...candidate.items[0]!.evidence[0]!, anchorId: "anchor-new" }],
        }],
      },
      receipt: {
        schemaVersion: 1,
        receiptId: "continuity-decision-1",
        workId: "work-1",
        candidateId: candidate.candidateId,
        itemId: "continuity-item-1",
        decision: "approve",
        outcome: "applied",
        threadId: "thread-new",
        threadRevisionAfter: 1,
        sourceDocumentRevisionId: "revision-1",
        createdAt: "2026-08-29T02:00:00.000Z",
      },
    })).toMatchObject({ status: "applied", receipt: { threadRevisionAfter: 1 } });
  });
});
