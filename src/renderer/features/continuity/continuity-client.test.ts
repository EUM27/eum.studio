import { describe, expect, it, vi } from "vitest";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  ContinuityReviewCandidate,
  ContinuityReviewItem,
} from "../../../application/continuity/continuity-review-contract";
import type { ContinuityThreadProjection } from "../../../application/continuity/continuity-thread-contract";
import { entityId } from "../../../domain/writing";
import {
  createContinuityThreadRecord,
  decideContinuityReviewItemRecord,
  dismissContinuityThreadRecord,
  grantContinuityReviewPermissionRecord,
  listContinuityRecord,
  resolveContinuityThreadRecord,
  runContinuityReviewRecord,
  startContinuityWorkLoad,
  updateContinuityReviewItemRecord,
  updateContinuityThreadRecord,
} from "./continuity-client";

const workId = entityId<"Work">("work-continuity-client");
const conversationId = entityId<"AssistantConversation">("conversation-continuity");
const sourceRange = Object.freeze({
  documentId: entityId<"Document">("document-continuity"),
  documentRevisionId: entityId<"DocumentRevision">("revision-continuity"),
  from: 4,
  to: 12,
});
const thread: ContinuityThreadProjection = Object.freeze({
  schemaVersion: 1,
  threadId: entityId<"ContinuityThread">("thread-continuity"),
  revision: 2,
  workId,
  kind: "promise",
  title: "북문 약속",
  note: "",
  subjectRefs: Object.freeze([]),
  status: "open",
  openedEvidence: Object.freeze([]),
  resolutionEvidence: Object.freeze([]),
  history: Object.freeze([]),
  openedAt: "2026-08-29T00:00:00.000Z",
  resolvedAt: null,
  updatedAt: "2026-08-29T00:00:00.000Z",
});
const item: ContinuityReviewItem = Object.freeze({
  itemId: entityId<"ContinuityReviewItem">("item-continuity"),
  assertionBasis: "explicit-evidence",
  draft: Object.freeze({
    kind: "open-question",
    title: "누가 문을 열었는가",
    note: "",
    subjectRefs: Object.freeze([]),
  }),
  reason: "직접 질문",
  evidence: Object.freeze([]),
  potentialDuplicateThreadIds: Object.freeze([thread.threadId]),
  status: "pending",
  appliedThreadId: null,
});
const candidate: ContinuityReviewCandidate = Object.freeze({
  schemaVersion: 1,
  candidateId: entityId<"ContinuityReviewCandidate">("candidate-continuity"),
  revision: 3,
  requestId: entityId<"ContinuityReviewRequest">("request-continuity"),
  workId,
  sourceRange,
  providerId: "provider-runtime",
  modelId: "model-runtime",
  promptVersion: "eum-continuity-review-v1",
  status: "ready",
  items: Object.freeze([item]),
  contextReceiptId: entityId<"AssistantContextReceipt">("receipt-continuity"),
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

describe("continuity renderer client", () => {
  it("cancels a late Work load before it can cross the active Work boundary", async () => {
    type Overview = Awaited<ReturnType<StudioBridge["continuity"]["list"]>>;
    let resolveOverview!: (value: Overview) => void;
    const overview = new Promise<Overview>(
      (resolve) => { resolveOverview = resolve; },
    );
    let scheduled: (() => void) | null = null;
    const onLoaded = vi.fn();
    const dispose = startContinuityWorkLoad({
      client: {
        list: vi.fn(() => overview),
        listCandidates: vi.fn(async () => ({
          schemaVersion: 1,
          workId,
          candidates: [],
        })),
      } as unknown as StudioBridge["continuity"],
      workLoadId: workId,
      onStarted: vi.fn(),
      onReset: vi.fn(),
      onLoaded,
      onFailed: vi.fn(),
      timer: {
        schedule: (callback) => { scheduled = callback; return "load"; },
        cancel: vi.fn(),
      },
    });
    (scheduled as unknown as () => void)();
    dispose();
    resolveOverview({ schemaVersion: 1, workId, threads: [thread], projectedSources: [] });
    await overview;
    await Promise.resolve();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("builds all manual and Candidate commands from authoritative revisions", async () => {
    const client = {
      create: vi.fn(async () => thread),
      update: vi.fn(async () => thread),
      list: vi.fn(async () => ({
        schemaVersion: 1 as const,
        workId,
        threads: [thread],
        projectedSources: [],
      })),
      resolve: vi.fn(async () => thread),
      dismiss: vi.fn(async () => thread),
      runReview: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: "candidate" as const,
        candidate,
      })),
      listCandidates: vi.fn(async () => ({
        schemaVersion: 1 as const,
        workId,
        candidates: [candidate],
      })),
      updateItem: vi.fn(async () => candidate),
      decideItem: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: "duplicate-review-required" as const,
        candidate,
        missingDuplicateThreadIds: [thread.threadId],
      })),
    } as StudioBridge["continuity"];

    await listContinuityRecord({ activeWorkId: workId, client });
    await createContinuityThreadRecord({
      activeWorkId: workId,
      client,
      draft: item.draft,
      openedEvidenceRange: sourceRange,
    });
    await updateContinuityThreadRecord({
      activeWorkId: workId,
      client,
      thread,
      draft: item.draft,
    });
    await resolveContinuityThreadRecord({
      activeWorkId: workId,
      client,
      thread,
      mode: "evidence",
      reason: "해결",
      sourceRange,
    });
    await dismissContinuityThreadRecord({
      activeWorkId: workId,
      client,
      thread,
      reason: "제외",
    });
    await runContinuityReviewRecord({
      activeWorkId: workId,
      client,
      conversationId,
      requestId: candidate.requestId,
      sourceRange,
    });
    await updateContinuityReviewItemRecord({
      activeWorkId: workId,
      candidate,
      client,
      draft: { ...item.draft, note: "사용자 수정" },
      item,
    });
    await decideContinuityReviewItemRecord({
      acknowledgedDuplicateThreadIds: [thread.threadId],
      activeWorkId: workId,
      candidate,
      client,
      decision: "approve",
      item,
    });

    expect(client.create).toHaveBeenCalledWith(expect.objectContaining({
      workId,
      openedEvidenceRange: sourceRange,
    }));
    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({
      threadId: thread.threadId,
      expectedRevision: 2,
    }));
    expect(client.resolve).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 2,
      resolutionMode: "evidence",
      resolutionEvidenceRange: sourceRange,
    }));
    expect(client.dismiss).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 2,
    }));
    expect(client.runReview).toHaveBeenCalledWith(expect.objectContaining({
      requestId: candidate.requestId,
      sourceRange,
    }));
    expect(client.updateItem).toHaveBeenCalledWith(expect.objectContaining({
      expectedCandidateRevision: 3,
      draft: expect.objectContaining({ note: "사용자 수정" }),
    }));
    expect(client.decideItem).toHaveBeenCalledWith(expect.objectContaining({
      expectedCandidateRevision: 3,
      acknowledgedDuplicateThreadIds: [thread.threadId],
    }));
  });

  it("grants only one exact-selection use for continuity.review", async () => {
    const grantContextPermission = vi.fn(async () => ({
      schemaVersion: 1 as const,
      grantId: entityId<"AssistantContextPermissionGrant">("grant-continuity"),
      revision: 1,
      workId,
      conversationId,
      capability: "continuity.review" as const,
      destinationId: "connector-destination",
      localScope: "selection" as const,
      externalScope: "selection" as const,
      duration: "once" as const,
      createdAt: "2026-08-29T00:00:00.000Z",
      revokedAt: null,
      consumedAt: null,
    }));
    await grantContinuityReviewPermissionRecord({
      activeWorkId: workId,
      assistantClient: { grantContextPermission },
      conversationId,
      destinationId: "connector-destination",
    });
    expect(grantContextPermission).toHaveBeenCalledWith({
      schemaVersion: 1,
      workId,
      conversationId,
      capability: "continuity.review",
      destinationId: "connector-destination",
      localScope: "selection",
      externalScope: "selection",
      duration: "once",
    });
  });
});
