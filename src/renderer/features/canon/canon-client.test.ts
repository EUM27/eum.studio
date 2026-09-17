import { describe, expect, it, vi } from "vitest";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  CanonFieldChange,
  CanonReviewCandidate,
} from "../../../application/canon/canon-review-contract";
import { entityId } from "../../../domain/writing";
import {
  decideCanonReviewItemRecord,
  exportCanonicalMarkdownRecord,
  grantCanonReviewPermissionRecord,
  listCanonReviewCandidates,
  resolveCanonReviewItemTargetRecord,
  runCanonReviewRecord,
  startCanonReviewWorkLoad,
  updateCanonReviewItemRecord,
} from "./canon-client";

const workId = entityId<"Work">("work-canon-client");
const conversationId = entityId<"AssistantConversation">("conversation-canon");
const sourceRange = Object.freeze({
  documentId: entityId<"Document">("document-canon"),
  documentRevisionId: entityId<"DocumentRevision">("revision-canon"),
  from: 4,
  to: 12,
});

const fieldChanges: readonly CanonFieldChange[] = Object.freeze([Object.freeze({
  field: "summary",
  before: "이전",
  after: "이후",
  selected: true,
})]);

function candidate(): CanonReviewCandidate {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"CanonReviewCandidate">("candidate-canon"),
    revision: 2,
    requestId: entityId<"CanonReviewRequest">("request-canon"),
    workId,
    sourceRange,
    providerId: "provider-runtime",
    modelId: "model-runtime",
    promptVersion: "eum-canon-review-v1",
    status: "ready",
    items: Object.freeze([Object.freeze({
      itemId: entityId<"CanonReviewItem">("item-canon"),
      targetHint: "인물",
      target: Object.freeze({
        kind: "character" as const,
        operation: "create" as const,
      }),
      assertionBasis: "explicit-evidence" as const,
      reason: "근거",
      evidence: Object.freeze([]),
      fieldChanges,
      status: "pending" as const,
      appliedTargetId: null,
    })]),
    contextReceiptId: entityId<"AssistantContextReceipt">("receipt-canon"),
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  });
}

describe("canon renderer client", () => {
  it("cancels a late Candidate load before it can cross a Work boundary", async () => {
    const current = candidate();
    let resolveList!: (value: Readonly<{
      schemaVersion: 1;
      workId: typeof workId;
      candidates: readonly CanonReviewCandidate[];
    }>) => void;
    const pendingList = new Promise<Readonly<{
      schemaVersion: 1;
      workId: typeof workId;
      candidates: readonly CanonReviewCandidate[];
    }>>((resolve) => {
      resolveList = resolve;
    });
    let scheduled: (() => void) | null = null;
    const cancel = vi.fn();
    const onLoaded = vi.fn();
    const dispose = startCanonReviewWorkLoad({
      client: {
        listCandidates: vi.fn(() => pendingList),
      } as unknown as StudioBridge["canon"],
      workLoadId: workId,
      onStarted: vi.fn(),
      onReset: vi.fn(),
      onLoaded,
      onFailed: vi.fn(),
      timer: {
        schedule: (callback, delayMs) => {
          expect(delayMs).toBe(0);
          scheduled = callback;
          return "canon-load";
        },
        cancel,
      },
    });
    (scheduled as unknown as () => void)();
    dispose();
    resolveList({ schemaVersion: 1, workId, candidates: [current] });
    await pendingList;
    await Promise.resolve();

    expect(cancel).toHaveBeenCalledWith("canon-load");
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("builds every Work-scoped canon command from authoritative revisions", async () => {
    const current = candidate();
    const runReview = vi.fn(async () => ({
      schemaVersion: 1 as const,
      status: "candidate" as const,
      candidate: current,
    }));
    const listCandidates = vi.fn(async () => ({
      schemaVersion: 1 as const,
      workId,
      candidates: Object.freeze([current]),
    }));
    const updateItem = vi.fn(async () => current);
    const resolveTarget = vi.fn(async () => current);
    const decideItem = vi.fn(async () => ({
      schemaVersion: 1 as const,
      status: "target-unresolved" as const,
      candidate: current,
    }));
    const client = {
      runReview,
      listCandidates,
      updateItem,
      resolveTarget,
      decideItem,
      exportMarkdown: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: "cancelled" as const,
      })),
    } as StudioBridge["canon"];

    await listCanonReviewCandidates({ activeWorkId: workId, client });
    await expect(exportCanonicalMarkdownRecord({ activeWorkId: workId, client }))
      .resolves.toEqual({ schemaVersion: 1, status: "cancelled" });
    await runCanonReviewRecord({
      activeWorkId: workId,
      client,
      conversationId,
      requestId: current.requestId,
      requestedTargetKinds: Object.freeze(["character", "lore-entry"]),
      sourceRange,
    });
    await updateCanonReviewItemRecord({
      activeWorkId: workId,
      candidate: current,
      client,
      fieldChanges,
      item: current.items[0]!,
    });
    await resolveCanonReviewItemTargetRecord({
      activeWorkId: workId,
      candidate: current,
      client,
      item: current.items[0]!,
      target: Object.freeze({ kind: "create" }),
    });
    await decideCanonReviewItemRecord({
      activeWorkId: workId,
      candidate: current,
      client,
      decision: "approve",
      item: current.items[0]!,
    });

    expect(listCandidates).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      status: "all",
    });
    expect(runReview).toHaveBeenCalledWith({
      schemaVersion: 1,
      requestId: current.requestId,
      workId,
      conversationId,
      sourceRange,
      requestedTargetKinds: ["character", "lore-entry"],
    });
    expect(updateItem).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      candidateId: current.candidateId,
      expectedCandidateRevision: current.revision,
      itemId: current.items[0]!.itemId,
      fieldChanges,
    });
    expect(resolveTarget).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      candidateId: current.candidateId,
      expectedCandidateRevision: current.revision,
      itemId: current.items[0]!.itemId,
      target: { kind: "create" },
    });
    expect(decideItem).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      candidateId: current.candidateId,
      expectedCandidateRevision: current.revision,
      itemId: current.items[0]!.itemId,
      decision: { kind: "approve" },
    });
  });

  it("grants only a one-use exact-selection permission for canon.review", async () => {
    const grantContextPermission = vi.fn(async () => ({
      schemaVersion: 1 as const,
      grantId: entityId<"AssistantContextPermissionGrant">("grant-canon"),
      revision: 1,
      workId,
      conversationId,
      capability: "canon.review" as const,
      destinationId: "connector-destination",
      localScope: "selection" as const,
      externalScope: "selection" as const,
      duration: "once" as const,
      createdAt: "2026-08-29T00:00:00.000Z",
      revokedAt: null,
      consumedAt: null,
    }));

    await grantCanonReviewPermissionRecord({
      activeWorkId: workId,
      assistantClient: { grantContextPermission },
      conversationId,
      destinationId: "connector-destination",
    });

    expect(grantContextPermission).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      conversationId,
      capability: "canon.review",
      destinationId: "connector-destination",
      localScope: "selection",
      externalScope: "selection",
      duration: "once",
    });
  });
});
