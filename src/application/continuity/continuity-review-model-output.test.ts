import { describe, expect, it } from "vitest";

import {
  createContinuityReviewParagraphs,
  parseContinuityReviewExecution,
  parseContinuityReviewModelPayload,
} from "./continuity-review-model-output";

describe("Continuity review model output", () => {
  it("strictly parses editable continuity proposals with typed refs and exact quotes", () => {
    expect(parseContinuityReviewModelPayload({
      proposals: [{
        assertionBasis: "explicit-evidence",
        kind: "promise",
        title: "북문에서 다시 만나기",
        note: "다음 회차에서 확인",
        subjectRefs: [{ kind: "character", id: "character-1" }],
        reason: "약속이 직접 서술됨",
        evidence: [{ paragraphId: "p1", quote: "북문에서 만나자" }],
      }],
    })).toMatchObject({
      proposals: [{ kind: "promise", assertionBasis: "explicit-evidence" }],
    });
  });

  it("rejects extra fields, unsupported kinds, duplicate refs, and empty evidence", () => {
    const valid = {
      assertionBasis: "model-inference",
      kind: "open-question",
      title: "문을 연 사람",
      note: "답이 남음",
      subjectRefs: [],
      reason: "질문이 남아 있음",
      evidence: [{ paragraphId: "p1", quote: "누가 열었지" }],
    };
    expect(() => parseContinuityReviewModelPayload({
      proposals: [{ ...valid, score: 3 }],
    })).toThrow(/fields/u);
    expect(() => parseContinuityReviewModelPayload({
      proposals: [{ ...valid, kind: "plot" }],
    })).toThrow(/kind/u);
    expect(() => parseContinuityReviewModelPayload({
      proposals: [{
        ...valid,
        subjectRefs: [
          { kind: "character", id: "character-1" },
          { kind: "character", id: "character-1" },
        ],
      }],
    })).toThrow(/duplicate/u);
    expect(() => parseContinuityReviewModelPayload({
      proposals: [{ ...valid, evidence: [] }],
    })).toThrow(/evidence/u);
  });

  it("parses connector provenance and derives paragraph IDs from only the exact selection", () => {
    const execution = parseContinuityReviewExecution({
      providerId: "provider-runtime",
      modelId: "model-runtime",
      promptVersion: "eum-continuity-review-v1",
      payload: { proposals: [] },
    });
    expect(execution.payload.proposals).toEqual([]);
    expect(createContinuityReviewParagraphs({
      sourceRange: {
        documentId: "document-1" as never,
        documentRevisionId: "revision-1" as never,
        from: 5,
        to: 14,
      },
      manuscript: "첫 줄\n둘째 줄",
    })).toEqual([
      { paragraphId: "p1", text: "첫 줄", from: 5, to: 8 },
      { paragraphId: "p2", text: "둘째 줄", from: 9, to: 13 },
    ]);
  });
});
