import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ContinuityReviewCandidate } from "../../application/continuity/continuity-review-contract";
import type { ContinuityOverviewProjection } from "../../application/continuity/continuity-thread-contract";
import { entityId } from "../../domain/writing";
import {
  ContinuityPanel,
  type ContinuityPanelController,
} from "./ContinuityPanel";

const workId = entityId<"Work">("work-continuity-panel");
const overview: ContinuityOverviewProjection = Object.freeze({
  schemaVersion: 1,
  workId,
  threads: Object.freeze([Object.freeze({
    schemaVersion: 1,
    threadId: entityId<"ContinuityThread">("thread-panel"),
    revision: 2,
    workId,
    kind: "promise",
    title: "북문 약속",
    note: "다음 회차에서 확인",
    subjectRefs: Object.freeze([Object.freeze({
      kind: "character" as const,
      id: entityId<"Character">("character-panel"),
    })]),
    status: "open",
    openedEvidence: Object.freeze([Object.freeze({
      anchorId: entityId<"Anchor">("anchor-panel"),
      documentId: entityId<"Document">("document-panel"),
      documentRevisionId: entityId<"DocumentRevision">("revision-panel"),
      exactText: "다시 만나자",
      integrity: "resolved",
      range: Object.freeze({ from: 4, to: 10 }),
    })]),
    resolutionEvidence: Object.freeze([]),
    history: Object.freeze([Object.freeze({
      transitionId: entityId<"ContinuityTransition">("transition-panel"),
      threadId: entityId<"ContinuityThread">("thread-panel"),
      kind: "created",
      revisionBefore: null,
      revisionAfter: 1,
      resolutionMode: null,
      reason: "",
      evidenceAnchorIds: Object.freeze([entityId<"Anchor">("anchor-panel")]),
      createdAt: "2026-08-29T00:00:00.000Z",
    })]),
    openedAt: "2026-08-29T00:00:00.000Z",
    resolvedAt: null,
    updatedAt: "2026-08-29T00:00:00.000Z",
  })]),
  projectedSources: Object.freeze([
    Object.freeze({
      sourceKind: "plot-thread" as const,
      entity: Object.freeze({
        kind: "plot-thread" as const,
        id: entityId<"PlotThread">("plot-panel"),
      }),
      revision: 1,
      title: "북문으로 향하기",
      note: "플롯 원본",
      active: true,
    }),
    Object.freeze({
      sourceKind: "foreshadow-line" as const,
      entity: Object.freeze({
        kind: "foreshadow-line" as const,
        id: entityId<"ForeshadowLine">("foreshadow-panel"),
      }),
      revision: 1,
      title: "잠긴 문",
      note: "복선 원본",
      active: true,
    }),
  ]),
});
const candidate: ContinuityReviewCandidate = Object.freeze({
  schemaVersion: 1,
  candidateId: entityId<"ContinuityReviewCandidate">("candidate-panel"),
  revision: 1,
  requestId: entityId<"ContinuityReviewRequest">("request-panel"),
  workId,
  sourceRange: Object.freeze({
    documentId: entityId<"Document">("document-panel"),
    documentRevisionId: entityId<"DocumentRevision">("revision-panel"),
    from: 0,
    to: 12,
  }),
  providerId: "provider",
  modelId: "model",
  promptVersion: "eum-continuity-review-v1",
  status: "ready",
  items: Object.freeze([Object.freeze({
    itemId: entityId<"ContinuityReviewItem">("item-panel"),
    assertionBasis: "explicit-evidence",
    draft: Object.freeze({
      kind: "open-question",
      title: "누가 문을 열었는가",
      note: "답을 확인",
      subjectRefs: Object.freeze([]),
    }),
    reason: "질문이 직접 남음",
    evidence: Object.freeze([Object.freeze({
      evidenceId: entityId<"ContinuityReviewEvidence">("evidence-panel"),
      documentId: entityId<"Document">("document-panel"),
      documentRevisionId: entityId<"DocumentRevision">("revision-panel"),
      from: 2,
      to: 6,
      exactText: "누가 문을",
      anchorId: null,
    })]),
    potentialDuplicateThreadIds: Object.freeze([
      entityId<"ContinuityThread">("thread-panel"),
    ]),
    status: "pending",
    appliedThreadId: null,
  })]),
  contextReceiptId: entityId<"AssistantContextReceipt">("receipt-panel"),
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

const controller: ContinuityPanelController = {
  overview,
  candidates: [candidate],
  selectedThread: overview.threads[0]!,
  selectedThreadId: overview.threads[0]!.threadId,
  selectedCandidate: candidate,
  selectedItem: candidate.items[0]!,
  selectedCandidateId: candidate.candidateId,
  selectedItemId: candidate.items[0]!.itemId,
  pendingSelection: {
    sourceRange: candidate.sourceRange,
    exactText: "윤서는 약속했다.",
  },
  actionState: "idle",
  error: null,
  message: null,
  permissionRequired: false,
  refresh: vi.fn(async () => true),
  clearPendingSelection: vi.fn(),
  createThread: vi.fn(async () => null),
  updateThread: vi.fn(async () => null),
  resolveThread: vi.fn(async () => null),
  dismissThread: vi.fn(async () => null),
  grantPermissionAndRetry: vi.fn(async () => null),
  updateItem: vi.fn(async () => null),
  decideItem: vi.fn(async () => null),
  selectThread: vi.fn(),
  selectCandidate: vi.fn(),
  selectItem: vi.fn(),
};

describe("ContinuityPanel", () => {
  it("renders source-badged integrated records, manual exact evidence, history, and AI review", () => {
    const markup = renderToStaticMarkup(createElement(ContinuityPanel, {
      controller,
      documentLabels: { "document-panel": "1화" },
      onEvidenceOpen: vi.fn(),
      onProjectedSourceOpen: vi.fn(),
      subjectOptions: [],
    }));

    expect(markup).toContain('aria-label="연속성 레이더"');
    expect(markup).toContain("A · 구조 분석");
    expect(markup).toContain('aria-label="연속성 요약"');
    expect(markup).toContain("확인 필요");
    expect(markup).toContain("약속 · 인물");
    expect(markup).toContain('aria-label="회차별 연속성 신호"');
    expect(markup).toContain("1화");
    expect(markup).toContain("원문 열기");
    expect(markup).toContain('aria-label="연속성 필터"');
    expect(markup).toContain("열림");
    expect(markup).toContain("해결됨");
    expect(markup).toContain("원본: 플롯");
    expect(markup).toContain("원본: 복선");
    expect(markup).toContain("원본 화면에서 편집");
    expect(markup).toContain("선택 원문 근거");
    expect(markup).toContain("윤서는 약속했다.");
    expect(markup).toContain("변경 이력");
    expect(markup).toContain('aria-label="AI 정밀 분석"');
    expect(markup).toContain("B · 선택형 AI");
    expect(markup).toContain("승인 전 Candidate로만 보관됩니다.");
    expect(markup).toContain("비슷한 열린 메모");
    expect(markup).toContain("누가 문을 열었는가");
  });
});
