import { describe, expect, it, vi } from "vitest";

import { CONTINUITY_REVIEW_PROMPT_VERSION } from "../../continuity/continuity-review-contract";
import {
  CONTINUITY_CREATE_CHANNEL,
  CONTINUITY_DISMISS_CHANNEL,
  CONTINUITY_LIST_CHANNEL,
  CONTINUITY_RESOLVE_CHANNEL,
  CONTINUITY_REVIEW_DECIDE_CHANNEL,
  CONTINUITY_REVIEW_LIST_CHANNEL,
  CONTINUITY_REVIEW_RUN_CHANNEL,
  CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL,
  CONTINUITY_UPDATE_CHANNEL,
  createContinuityBridge,
} from "./continuity-bridge";

const sourceRange = {
  documentId: "document-1",
  documentRevisionId: "revision-1",
  from: 0,
  to: 2,
};
const thread = {
  schemaVersion: 1,
  threadId: "thread-1",
  revision: 1,
  workId: "work-1",
  kind: "promise",
  title: "북문 약속",
  note: "",
  subjectRefs: [],
  status: "open",
  openedEvidence: [],
  resolutionEvidence: [],
  history: [{
    transitionId: "transition-1",
    threadId: "thread-1",
    kind: "created",
    revisionBefore: null,
    revisionAfter: 1,
    resolutionMode: null,
    reason: "",
    evidenceAnchorIds: [],
    createdAt: "2026-08-29T00:00:00.000Z",
  }],
  openedAt: "2026-08-29T00:00:00.000Z",
  resolvedAt: null,
  updatedAt: "2026-08-29T00:00:00.000Z",
} as const;
const candidate = {
  schemaVersion: 1,
  candidateId: "candidate-1",
  revision: 1,
  requestId: "request-1",
  workId: "work-1",
  sourceRange,
  providerId: "provider-1",
  modelId: "model-1",
  promptVersion: CONTINUITY_REVIEW_PROMPT_VERSION,
  status: "ready",
  items: [{
    itemId: "item-1",
    assertionBasis: "explicit-evidence",
    draft: { kind: "promise", title: "북문 약속", note: "", subjectRefs: [] },
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
    potentialDuplicateThreadIds: [],
    status: "pending",
    appliedThreadId: null,
  }],
  contextReceiptId: "context-receipt-1",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
} as const;

describe("continuity bridge", () => {
  it("uses only the nine typed Continuity channels and parses every result", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === CONTINUITY_LIST_CHANNEL) {
        return { schemaVersion: 1, workId: "work-1", threads: [thread], projectedSources: [] };
      }
      if (channel === CONTINUITY_REVIEW_RUN_CHANNEL) {
        return { schemaVersion: 1, status: "candidate", candidate };
      }
      if (channel === CONTINUITY_REVIEW_LIST_CHANNEL) {
        return { schemaVersion: 1, workId: "work-1", candidates: [candidate] };
      }
      if (channel === CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL) return candidate;
      if (channel === CONTINUITY_REVIEW_DECIDE_CHANNEL) {
        return {
          schemaVersion: 1,
          status: "candidate-stale",
          candidate,
          missingDuplicateThreadIds: [],
        };
      }
      return thread;
    });
    const bridge = createContinuityBridge(invoke);

    await expect(bridge.create({
      schemaVersion: 1,
      workId: "work-1" as never,
      kind: "promise",
      title: "북문 약속",
      note: "",
      subjectRefs: [],
      openedEvidenceRange: null,
    })).resolves.toMatchObject({ threadId: "thread-1" });
    await expect(bridge.update({
      schemaVersion: 1,
      workId: "work-1" as never,
      threadId: "thread-1" as never,
      expectedRevision: 1,
      kind: "promise",
      title: "북문 약속",
      note: "수정",
      subjectRefs: [],
    })).resolves.toMatchObject({ threadId: "thread-1" });
    await expect(bridge.list({
      schemaVersion: 1,
      workId: "work-1" as never,
      status: "all",
    })).resolves.toMatchObject({ threads: [thread] });
    await expect(bridge.resolve({
      schemaVersion: 1,
      workId: "work-1" as never,
      threadId: "thread-1" as never,
      expectedRevision: 1,
      resolutionMode: "manual",
      resolutionEvidenceRange: null,
      reason: "확인",
    })).resolves.toMatchObject({ threadId: "thread-1" });
    await expect(bridge.dismiss({
      schemaVersion: 1,
      workId: "work-1" as never,
      threadId: "thread-1" as never,
      expectedRevision: 1,
      reason: "제외",
    })).resolves.toMatchObject({ threadId: "thread-1" });
    await expect(bridge.runReview({
      schemaVersion: 1,
      requestId: "request-1" as never,
      workId: "work-1" as never,
      conversationId: "conversation-1" as never,
      sourceRange: sourceRange as never,
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
      draft: candidate.items[0].draft,
    })).resolves.toMatchObject({ candidateId: "candidate-1" });
    await expect(bridge.decideItem({
      schemaVersion: 1,
      workId: "work-1" as never,
      candidateId: "candidate-1" as never,
      expectedCandidateRevision: 1,
      itemId: "item-1" as never,
      decision: "approve",
      acknowledgedDuplicateThreadIds: [],
    })).resolves.toMatchObject({ status: "candidate-stale" });
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      CONTINUITY_CREATE_CHANNEL,
      CONTINUITY_UPDATE_CHANNEL,
      CONTINUITY_LIST_CHANNEL,
      CONTINUITY_RESOLVE_CHANNEL,
      CONTINUITY_DISMISS_CHANNEL,
      CONTINUITY_REVIEW_RUN_CHANNEL,
      CONTINUITY_REVIEW_LIST_CHANNEL,
      CONTINUITY_REVIEW_UPDATE_ITEM_CHANNEL,
      CONTINUITY_REVIEW_DECIDE_CHANNEL,
    ]);
  });

  it("rejects invalid main-process output", async () => {
    const bridge = createContinuityBridge(async () => ({ status: "open" }));
    await expect(bridge.list({
      schemaVersion: 1,
      workId: "work-1" as never,
      status: "all",
    })).rejects.toThrow("Invalid Continuity overview");
  });
});
