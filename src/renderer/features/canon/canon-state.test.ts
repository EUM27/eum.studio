import { describe, expect, it } from "vitest";

import type { CanonReviewCandidate } from "../../../application/canon/canon-review-contract";
import { entityId } from "../../../domain/writing";
import {
  prependCanonReviewCandidate,
  reconcileCanonReviewSelection,
  replaceCanonReviewCandidate,
  resolveCanonReviewRunResult,
} from "./canon-state";

const workId = entityId<"Work">("work-canon-state");

function candidate(suffix: string, revision = 1): CanonReviewCandidate {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"CanonReviewCandidate">(`candidate-${suffix}`),
    revision,
    requestId: entityId<"CanonReviewRequest">(`request-${suffix}`),
    workId,
    sourceRange: Object.freeze({
      documentId: entityId<"Document">(`document-${suffix}`),
      documentRevisionId: entityId<"DocumentRevision">(`revision-${suffix}`),
      from: 1,
      to: 3,
    }),
    providerId: "provider-runtime",
    modelId: "model-runtime",
    promptVersion: "eum-canon-review-v1",
    status: "ready",
    items: Object.freeze([Object.freeze({
      itemId: entityId<"CanonReviewItem">(`item-${suffix}`),
      targetHint: suffix,
      target: Object.freeze({
        kind: "lore-entry" as const,
        operation: "create" as const,
      }),
      assertionBasis: "explicit-evidence" as const,
      reason: "근거",
      evidence: Object.freeze([]),
      fieldChanges: Object.freeze([]),
      status: "pending" as const,
      appliedTargetId: null,
    })]),
    contextReceiptId: entityId<"AssistantContextReceipt">(`receipt-${suffix}`),
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  });
}

describe("canon renderer state", () => {
  it("upserts Candidate revisions without duplicating rows or losing order", () => {
    const first = candidate("first");
    const second = candidate("second");
    const updatedFirst = candidate("first", 2);

    expect(prependCanonReviewCandidate([first, second], updatedFirst)).toEqual([
      updatedFirst,
      second,
    ]);
    expect(replaceCanonReviewCandidate([first, second], candidate("second", 2)))
      .toEqual([first, candidate("second", 2)]);
  });

  it("keeps only a Candidate and item selection that still exists", () => {
    const first = candidate("first");
    expect(reconcileCanonReviewSelection(
      { candidateId: first.candidateId, itemId: first.items[0]!.itemId },
      [first],
    )).toEqual({
      candidateId: first.candidateId,
      itemId: first.items[0]!.itemId,
    });
    expect(reconcileCanonReviewSelection(
      { candidateId: first.candidateId, itemId: "missing" },
      [first],
    )).toEqual({ candidateId: first.candidateId, itemId: null });
    expect(reconcileCanonReviewSelection(
      { candidateId: "missing", itemId: null },
      [first],
    )).toEqual({ candidateId: first.candidateId, itemId: first.items[0]!.itemId });
  });

  it("maps run results without fabricating a Candidate", () => {
    const current = candidate("result");
    expect(resolveCanonReviewRunResult({
      schemaVersion: 1,
      status: "candidate",
      candidate: current,
    })).toEqual({ status: "candidate", candidate: current });
    expect(resolveCanonReviewRunResult({
      schemaVersion: 1,
      status: "permission-required",
      destinationId: "destination",
      missing: ["external-transmit"],
    })).toEqual({
      status: "permission-required",
      destinationId: "destination",
      permissionRequired: true,
      error: null,
    });
    expect(resolveCanonReviewRunResult({
      schemaVersion: 1,
      status: "no-change",
    })).toEqual({
      status: "no-change",
      message: "선택한 원문에서 별빛 변경 사항을 찾지 못했습니다.",
    });
    expect(resolveCanonReviewRunResult({
      schemaVersion: 1,
      status: "context-rejected",
      reason: "stale-context",
      documentId: entityId<"Document">("document-result"),
    })).toEqual({
      status: "context-rejected",
      error: "선택 원문의 저장 버전이 달라졌습니다. 현재 선택으로 다시 실행해 주세요.",
    });
  });
});
