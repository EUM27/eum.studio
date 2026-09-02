import { describe, expect, it } from "vitest";

import type { ContinuityReviewCandidate } from "../../application/continuity/continuity-review-contract";
import type { ContinuityOverviewProjection } from "../../application/continuity/continuity-thread-contract";
import { entityId } from "../../domain/writing";
import { buildContinuityRadarProjection } from "./continuity-radar";

const workId = entityId<"Work">("work-continuity-radar");

function thread(input: Readonly<{
  id: string;
  integrity?: "resolved" | "needsReview" | "broken";
  status?: "open" | "resolved" | "dismissed";
  withEvidence?: boolean;
}>) {
  const status = input.status ?? "open";
  const withEvidence = input.withEvidence ?? true;
  return Object.freeze({
    schemaVersion: 1 as const,
    threadId: entityId<"ContinuityThread">(input.id),
    revision: 1,
    workId,
    kind: "promise" as const,
    title: input.id,
    note: "",
    subjectRefs: Object.freeze([]),
    status,
    openedEvidence: Object.freeze(withEvidence ? [Object.freeze({
      anchorId: entityId<"Anchor">(`anchor-${input.id}`),
      documentId: entityId<"Document">("document-1"),
      documentRevisionId: entityId<"DocumentRevision">("revision-1"),
      exactText: input.id,
      integrity: input.integrity ?? "resolved",
      range: input.integrity === "broken" ? null : Object.freeze({ from: 1, to: 3 }),
    })] : []),
    resolutionEvidence: Object.freeze([]),
    history: Object.freeze([]),
    openedAt: "2026-08-30T00:00:00.000Z",
    resolvedAt: status === "open" ? null : "2026-08-30T01:00:00.000Z",
    updatedAt: "2026-08-30T01:00:00.000Z",
  });
}

describe("continuity radar projection", () => {
  it("derives structural attention, document lanes, and pending AI counts without changing source records", () => {
    const overview: ContinuityOverviewProjection = Object.freeze({
      schemaVersion: 1,
      workId,
      threads: Object.freeze([
        thread({ id: "connected" }),
        thread({ id: "needs-review", integrity: "needsReview" }),
        thread({ id: "broken", integrity: "broken" }),
        thread({ id: "missing", withEvidence: false }),
        thread({ id: "resolved", status: "resolved" }),
      ]),
      projectedSources: Object.freeze([Object.freeze({
        sourceKind: "plot-thread" as const,
        entity: Object.freeze({
          kind: "plot-thread" as const,
          id: entityId<"PlotThread">("plot-1"),
        }),
        revision: 1,
        title: "열린 플롯",
        note: "",
        active: true,
      })]),
    });
    const candidate = Object.freeze({
      schemaVersion: 1 as const,
      candidateId: entityId<"ContinuityReviewCandidate">("candidate-radar"),
      revision: 1,
      requestId: entityId<"ContinuityReviewRequest">("request-radar"),
      workId,
      sourceRange: Object.freeze({
        documentId: entityId<"Document">("document-1"),
        documentRevisionId: entityId<"DocumentRevision">("revision-1"),
        from: 0,
        to: 4,
      }),
      providerId: "provider",
      modelId: "model",
      promptVersion: "eum-continuity-review-v1" as const,
      status: "ready" as const,
      items: Object.freeze([
        Object.freeze({
          itemId: entityId<"ContinuityReviewItem">("item-pending"),
          assertionBasis: "explicit-evidence" as const,
          draft: Object.freeze({ kind: "promise" as const, title: "후보", note: "", subjectRefs: [] }),
          reason: "",
          evidence: Object.freeze([]),
          potentialDuplicateThreadIds: Object.freeze([]),
          status: "pending" as const,
          appliedThreadId: null,
        }),
        Object.freeze({
          itemId: entityId<"ContinuityReviewItem">("item-approved"),
          assertionBasis: "explicit-evidence" as const,
          draft: Object.freeze({ kind: "promise" as const, title: "완료", note: "", subjectRefs: [] }),
          reason: "",
          evidence: Object.freeze([]),
          potentialDuplicateThreadIds: Object.freeze([]),
          status: "approved" as const,
          appliedThreadId: entityId<"ContinuityThread">("connected"),
        }),
      ]),
      contextReceiptId: entityId<"AssistantContextReceipt">("receipt-radar"),
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    }) satisfies ContinuityReviewCandidate;

    const projection = buildContinuityRadarProjection(overview, [candidate]);

    expect(projection.counts).toEqual({
      activeSources: 1,
      connected: 1,
      needsAttention: 3,
      open: 4,
      pendingAi: 1,
      resolved: 1,
    });
    expect(projection.threadSignals.map((entry) => [entry.threadId, entry.state]))
      .toEqual([
        ["broken", "broken-evidence"],
        ["missing", "missing-evidence"],
        ["needs-review", "needs-review-evidence"],
        ["connected", "connected"],
      ]);
    expect(projection.documentLanes).toEqual([{
      documentId: "document-1",
      connectedCount: 1,
      needsAttentionCount: 2,
      threadCount: 3,
    }]);
    expect(overview.threads[0]?.title).toBe("connected");
  });
});
