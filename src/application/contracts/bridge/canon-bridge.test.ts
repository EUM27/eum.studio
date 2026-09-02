import { describe, expect, it, vi } from "vitest";

import {
  CANON_REVIEW_DECIDE_CHANNEL,
  CANON_REVIEW_LIST_CHANNEL,
  CANON_REVIEW_RESOLVE_TARGET_CHANNEL,
  CANON_REVIEW_RUN_CHANNEL,
  CANON_REVIEW_UPDATE_ITEM_CHANNEL,
  CANON_MARKDOWN_EXPORT_CHANNEL,
  createCanonBridge,
} from "./canon-bridge";
import { CANON_REVIEW_PROMPT_VERSION } from "../../canon/canon-review-contract";

const sourceRange = {
  documentId: "document-1",
  documentRevisionId: "revision-1",
  from: 0,
  to: 2,
};

const candidate = {
  schemaVersion: 1,
  candidateId: "candidate-1",
  revision: 1,
  requestId: "request-1",
  workId: "work-1",
  sourceRange,
  providerId: "provider-1",
  modelId: "model-1",
  promptVersion: CANON_REVIEW_PROMPT_VERSION,
  status: "ready",
  items: [{
    itemId: "item-1",
    targetHint: "윤서",
    target: {
      kind: "character",
      operation: "update",
      characterId: "character-1",
      expectedRevision: 1,
    },
    assertionBasis: "explicit-evidence",
    reason: "직접 서술",
    evidence: [{
      evidenceId: "evidence-1",
      documentId: "document-1",
      documentRevisionId: "revision-1",
      from: 0,
      to: 2,
      exactText: "윤서",
      anchorId: null,
    }],
    fieldChanges: [{
      field: "role",
      before: "수습",
      after: "기록관",
      selected: true,
    }],
    status: "pending",
    appliedTargetId: null,
  }],
  contextReceiptId: "context-receipt-1",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
} as const;

describe("canon bridge", () => {
  it("uses only the six typed canon channels and parses every result", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === CANON_REVIEW_RUN_CHANNEL) {
        return { schemaVersion: 1, status: "candidate", candidate };
      }
      if (channel === CANON_REVIEW_LIST_CHANNEL) {
        return { schemaVersion: 1, workId: "work-1", candidates: [candidate] };
      }
      if (
        channel === CANON_REVIEW_UPDATE_ITEM_CHANNEL ||
        channel === CANON_REVIEW_RESOLVE_TARGET_CHANNEL
      ) {
        return candidate;
      }
      if (channel === CANON_MARKDOWN_EXPORT_CHANNEL) {
        return {
          schemaVersion: 1,
          status: "cancelled",
        };
      }
      return {
        schemaVersion: 1,
        status: "inference-requires-user-authorship",
        candidate,
      };
    });
    const bridge = createCanonBridge(invoke);

    await expect(bridge.runReview({
      schemaVersion: 1,
      requestId: "request-1" as never,
      workId: "work-1" as never,
      conversationId: "conversation-1" as never,
      sourceRange: sourceRange as never,
      requestedTargetKinds: ["character"],
    })).resolves.toMatchObject({ status: "candidate" });
    await expect(bridge.listCandidates({
      schemaVersion: 1,
      workId: "work-1" as never,
      status: "all",
    })).resolves.toMatchObject({ candidates: [candidate] });
    await expect(bridge.updateItem({
      schemaVersion: 1,
      workId: "work-1" as never,
      candidateId: "candidate-1" as never,
      expectedCandidateRevision: 1,
      itemId: "item-1" as never,
      fieldChanges: candidate.items[0].fieldChanges,
    })).resolves.toMatchObject({ candidateId: "candidate-1" });
    await expect(bridge.resolveTarget({
      schemaVersion: 1,
      workId: "work-1" as never,
      candidateId: "candidate-1" as never,
      expectedCandidateRevision: 1,
      itemId: "item-1" as never,
      target: { kind: "update", targetId: "character-1", expectedRevision: 1 },
    })).resolves.toMatchObject({ candidateId: "candidate-1" });
    await expect(bridge.decideItem({
      schemaVersion: 1,
      workId: "work-1" as never,
      candidateId: "candidate-1" as never,
      expectedCandidateRevision: 1,
      itemId: "item-1" as never,
      decision: { kind: "approve" },
    })).resolves.toMatchObject({
      status: "inference-requires-user-authorship",
    });
    await expect(bridge.exportMarkdown({
      schemaVersion: 1,
      workId: "work-1" as never,
    })).resolves.toEqual({ schemaVersion: 1, status: "cancelled" });
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      CANON_REVIEW_RUN_CHANNEL,
      CANON_REVIEW_LIST_CHANNEL,
      CANON_REVIEW_UPDATE_ITEM_CHANNEL,
      CANON_REVIEW_RESOLVE_TARGET_CHANNEL,
      CANON_REVIEW_DECIDE_CHANNEL,
      CANON_MARKDOWN_EXPORT_CHANNEL,
    ]);
  });

  it("rejects an invalid main-process result", async () => {
    const bridge = createCanonBridge(async () => ({ status: "candidate" }));

    await expect(bridge.listCandidates({
      schemaVersion: 1,
      workId: "work-1" as never,
      status: "all",
    })).rejects.toThrow("Invalid canon review Candidate list");
  });
});
