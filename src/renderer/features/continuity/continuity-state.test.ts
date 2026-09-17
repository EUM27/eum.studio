import { describe, expect, it } from "vitest";

import type { ContinuityReviewCandidate } from "../../../application/continuity/continuity-review-contract";
import { entityId } from "../../../domain/writing";
import {
  prependContinuityCandidate,
  reconcileContinuityReviewSelection,
  replaceContinuityCandidate,
  resolveContinuityReviewRunResult,
} from "./continuity-state";

function candidate(suffix: string, revision = 1): ContinuityReviewCandidate {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"ContinuityReviewCandidate">(`candidate-${suffix}`),
    revision,
    requestId: entityId<"ContinuityReviewRequest">(`request-${suffix}`),
    workId: entityId<"Work">("work-continuity"),
    sourceRange: Object.freeze({
      documentId: entityId<"Document">("document-continuity"),
      documentRevisionId: entityId<"DocumentRevision">("revision-continuity"),
      from: 0,
      to: 2,
    }),
    providerId: "provider",
    modelId: "model",
    promptVersion: "eum-continuity-review-v1",
    status: "ready",
    items: Object.freeze([Object.freeze({
      itemId: entityId<"ContinuityReviewItem">(`item-${suffix}`),
      assertionBasis: "explicit-evidence" as const,
      draft: Object.freeze({ kind: "promise" as const, title: suffix, note: "", subjectRefs: [] }),
      reason: "근거",
      evidence: Object.freeze([]),
      potentialDuplicateThreadIds: Object.freeze([]),
      status: "pending" as const,
      appliedThreadId: null,
    })]),
    contextReceiptId: entityId<"AssistantContextReceipt">(`receipt-${suffix}`),
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  });
}

describe("continuity renderer state", () => {
  it("upserts Candidate revisions and keeps only valid selection", () => {
    const first = candidate("first");
    const second = candidate("second");
    expect(prependContinuityCandidate([first, second], candidate("first", 2)))
      .toEqual([candidate("first", 2), second]);
    expect(replaceContinuityCandidate([first, second], candidate("second", 2)))
      .toEqual([first, candidate("second", 2)]);
    expect(reconcileContinuityReviewSelection({
      candidateId: first.candidateId,
      itemId: first.items[0]!.itemId,
    }, [first])).toEqual({
      candidateId: first.candidateId,
      itemId: first.items[0]!.itemId,
    });
    expect(reconcileContinuityReviewSelection({
      candidateId: "missing",
      itemId: null,
    }, [first])).toEqual({
      candidateId: first.candidateId,
      itemId: first.items[0]!.itemId,
    });
  });

  it("maps permission, no-change, and stale source results without fabricating a Candidate", () => {
    expect(resolveContinuityReviewRunResult({
      schemaVersion: 1,
      status: "permission-required",
      destinationId: "destination",
      missing: ["external-transmit"],
    })).toMatchObject({ status: "permission-required", permissionRequired: true });
    expect(resolveContinuityReviewRunResult({ schemaVersion: 1, status: "no-change" }))
      .toEqual({ status: "no-change", message: "선택한 원문에서 새 연속성 항목을 찾지 못했습니다." });
    expect(resolveContinuityReviewRunResult({
      schemaVersion: 1,
      status: "context-rejected",
      reason: "stale-context",
      documentId: entityId<"Document">("document-continuity"),
    })).toEqual({
      status: "context-rejected",
      error: "선택 원문의 저장 버전이 달라졌습니다. 현재 선택으로 다시 실행해 주세요.",
    });
  });
});
