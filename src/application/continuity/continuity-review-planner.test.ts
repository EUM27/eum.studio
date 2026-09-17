import { describe, expect, it } from "vitest";

import type { ContinuityReviewItem } from "./continuity-review-contract";
import {
  findPotentialContinuityDuplicateThreadIds,
  planContinuityReviewItems,
  type ContinuityThreadSourceSnapshot,
} from "./continuity-review-planner";

const sourceRange = Object.freeze({
  documentId: "document-1" as never,
  documentRevisionId: "revision-1" as never,
  from: 0,
  to: 30,
});
const paragraphs = Object.freeze([Object.freeze({
  paragraphId: "p1",
  text: "윤서는 북문에서 다시 만나자고 약속했다.",
  from: 0,
  to: 24,
})]);
const proposal = Object.freeze({
  assertionBasis: "explicit-evidence" as const,
  kind: "promise" as const,
  title: "북문에서 다시 만나기",
  note: "다음 회차에서 확인",
  subjectRefs: Object.freeze([{ kind: "character" as const, id: "character-1" as never }]),
  reason: "약속이 직접 서술됨",
  evidence: Object.freeze([{ paragraphId: "p1", quote: "다시 만나자" }]),
});

function plan(input: Partial<Parameters<typeof planContinuityReviewItems>[0]> = {}) {
  let itemIndex = 0;
  let evidenceIndex = 0;
  return planContinuityReviewItems({
    proposals: [proposal],
    paragraphs,
    sourceRange,
    allowedSubjectRefs: [{ kind: "character", id: "character-1" }],
    activeThreads: [],
    pendingItems: [],
    itemIdFactory: { create: () => `item-${++itemIndex}` },
    evidenceIdFactory: { create: () => `evidence-${++evidenceIndex}` },
    ...input,
  });
}

describe("Continuity review planner", () => {
  it("resolves exact evidence and preserves explicit or inferred proposals for user review", () => {
    const items = plan({
      proposals: [proposal, { ...proposal, assertionBasis: "model-inference", title: "추론 메모" }],
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      assertionBasis: "explicit-evidence",
      draft: { kind: "promise" },
      evidence: [{ exactText: "다시 만나자" }],
    });
    expect(items[1]?.assertionBasis).toBe("model-inference");
  });

  it("shows exact active duplicate hints without merging the proposed thread", () => {
    const active: ContinuityThreadSourceSnapshot = Object.freeze({
      threadId: "thread-existing" as never,
      workId: "work-1" as never,
      revision: 2,
      kind: "promise",
      title: proposal.title,
      note: "기존 메모",
      status: "open",
      subjectRefs: proposal.subjectRefs,
    });
    const items = plan({ activeThreads: [active] });
    expect(items).toHaveLength(1);
    expect(items[0]?.potentialDuplicateThreadIds).toEqual([active.threadId]);
    expect(items[0]?.status).toBe("pending");
    expect(findPotentialContinuityDuplicateThreadIds({
      ...proposal,
      title: ` ${proposal.title} `,
    }, [active])).toEqual([active.threadId]);
    expect(findPotentialContinuityDuplicateThreadIds({
      ...proposal,
      title: "사용자가 편집한 제목",
    }, [active])).toEqual([]);
  });

  it("rejects unknown subject refs and non-unique or out-of-range evidence atomically", () => {
    expect(() => plan({
      proposals: [{
        ...proposal,
        subjectRefs: [{ kind: "character", id: "character-outside" as never }],
      }],
    })).toThrow(/subject/u);
    expect(() => plan({
      paragraphs: [{
        ...paragraphs[0]!,
        text: "다시 만나자, 다시 만나자",
        to: "다시 만나자, 다시 만나자".length,
      }],
    })).toThrow(/uniquely/u);
    expect(() => plan({
      sourceRange: { ...sourceRange, to: 5 },
    })).toThrow(/outside/u);
  });

  it("drops an exact pending proposal from the same source revision", () => {
    const first = plan()[0]!;
    const pending: ContinuityReviewItem = Object.freeze({
      ...first,
      itemId: "pending-existing" as never,
    });
    expect(plan({ pendingItems: [pending] })).toEqual([]);
  });
});
