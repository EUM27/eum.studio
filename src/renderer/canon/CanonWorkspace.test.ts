import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CanonReviewCandidate } from "../../application/canon/canon-review-contract";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type { CharacterRelationProjection } from "../../application/characters/character-relation-contract";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import { entityId } from "../../domain/writing";
import {
  CanonWorkspace,
  type CanonWorkspaceController,
} from "./CanonWorkspace";
import type { ContinuityPanelController } from "./ContinuityPanel";
import type { CharacterKnowledgePanelController } from "./CharacterKnowledgePanel";

const workId = entityId<"Work">("work-canon-workspace");
const evidence = Object.freeze({
  evidenceId: entityId<"CanonReviewEvidence">("evidence-canon"),
  documentId: entityId<"Document">("document-canon"),
  documentRevisionId: entityId<"DocumentRevision">("revision-canon"),
  from: 2,
  to: 9,
  exactText: "달빛 아래 서 있었다.",
  anchorId: null,
});
const candidate: CanonReviewCandidate = Object.freeze({
  schemaVersion: 1,
  candidateId: entityId<"CanonReviewCandidate">("candidate-canon-workspace"),
  revision: 1,
  requestId: entityId<"CanonReviewRequest">("request-canon-workspace"),
  workId,
  sourceRange: Object.freeze({
    documentId: evidence.documentId,
    documentRevisionId: evidence.documentRevisionId,
    from: evidence.from,
    to: evidence.to,
  }),
  providerId: "provider-runtime",
  modelId: "model-runtime",
  promptVersion: "eum-canon-review-v1",
  status: "ready",
  items: Object.freeze([Object.freeze({
    itemId: entityId<"CanonReviewItem">("item-canon-workspace"),
    targetHint: "윤서",
    target: Object.freeze({ kind: "character" as const, operation: "create" as const }),
    assertionBasis: "explicit-evidence" as const,
    reason: "원문에서 이름과 역할이 직접 확인됩니다.",
    evidence: Object.freeze([evidence]),
    fieldChanges: Object.freeze([Object.freeze({
      field: "summary" as const,
      before: null,
      after: "달빛 아래 나타난 인물",
      selected: true,
    })]),
    status: "pending" as const,
    appliedTargetId: null,
  })]),
  contextReceiptId: entityId<"AssistantContextReceipt">("receipt-canon-workspace"),
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

const character: CharacterProjection = Object.freeze({
  schemaVersion: 1,
  characterId: entityId<"Character">("character-yunseo"),
  revision: 2,
  workId,
  name: "윤서",
  aliases: Object.freeze([]),
  role: "주인공",
  summary: "기록을 좇는 인물",
  appearance: "",
  personality: "",
  speech: "",
  goal: "",
  conflict: "",
  note: "",
  evidences: Object.freeze([Object.freeze({
    anchorId: entityId<"Anchor">("anchor-canon-workspace"),
    documentId: evidence.documentId,
    documentRevisionId: evidence.documentRevisionId,
    exactText: evidence.exactText,
    integrity: "resolved" as const,
    range: Object.freeze({ from: evidence.from, to: evidence.to }),
    createdAt: "2026-08-29T00:00:00.000Z",
  })]),
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  retiredAt: null,
});

const loreEntry: LoreEntryProjection = Object.freeze({
  schemaVersion: 1,
  loreEntryId: entityId<"LoreEntry">("lore-moon"),
  revision: 1,
  workId,
  title: "달빛 기록",
  content: "달빛이 길을 밝힌다.",
  category: "배경",
  aliases: Object.freeze([]),
  enabled: true,
  evidences: Object.freeze([]),
  history: Object.freeze([]),
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  retiredAt: null,
});

const relation: CharacterRelationProjection = Object.freeze({
  schemaVersion: 1,
  relationId: entityId<"CharacterRelation">("relation-yunseo-minho"),
  revision: 1,
  workId,
  fromCharacterId: entityId<"Character">("character-yunseo"),
  toCharacterId: entityId<"Character">("character-minho"),
  kind: "동료",
  description: "같은 기록 임무를 맡는다.",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  retiredAt: null,
  retirementReason: null,
});

const approvedRelationCandidate: CanonReviewCandidate = Object.freeze({
  ...candidate,
  candidateId: entityId<"CanonReviewCandidate">("candidate-relation-evidence"),
  revision: 2,
  status: "completed",
  items: Object.freeze([Object.freeze({
    itemId: entityId<"CanonReviewItem">("item-relation-evidence"),
    targetHint: "윤서와 민호",
    target: Object.freeze({
      kind: "character-relation" as const,
      operation: "update" as const,
      relationId: relation.relationId,
      expectedRevision: 1,
    }),
    assertionBasis: "explicit-evidence" as const,
    reason: "관계가 원문에 직접 확인됩니다.",
    evidence: Object.freeze([Object.freeze({
      ...evidence,
      anchorId: entityId<"Anchor">("anchor-relation-evidence"),
    })]),
    fieldChanges: Object.freeze([Object.freeze({
      field: "description" as const,
      before: "같은 기록 임무를 맡는다.",
      after: "달빛 아래 함께 기록한다.",
      selected: true,
    })]),
    status: "approved" as const,
    appliedTargetId: relation.relationId,
  })]),
});

function controller(value: CanonReviewCandidate = candidate): CanonWorkspaceController {
  return {
    candidates: Object.freeze([value]),
    selectedCandidate: value,
    selectedItem: value.items[0]!,
    selectedCandidateId: value.candidateId,
    selectedItemId: value.items[0]!.itemId,
    actionState: "idle",
    error: null,
    message: null,
    permissionRequired: false,
    selectCandidate: vi.fn(),
    selectItem: vi.fn(),
    refreshCandidates: vi.fn(async () => true),
    exportMarkdown: vi.fn(async () => ({
      schemaVersion: 1 as const,
      status: "cancelled" as const,
    })),
    grantPermissionAndRetry: vi.fn(async () => null),
    updateItem: vi.fn(async () => value),
    resolveTarget: vi.fn(async () => value),
    decideItem: vi.fn(async () => null),
  };
}

const continuityController: ContinuityPanelController = {
  overview: null,
  candidates: [],
  selectedThread: null,
  selectedThreadId: null,
  selectedCandidate: null,
  selectedItem: null,
  selectedCandidateId: null,
  selectedItemId: null,
  pendingSelection: null,
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

const characterKnowledgeController: CharacterKnowledgePanelController = {
  entries: [],
  selectedEntry: null,
  selectedKnowledgeId: null,
  pendingSelection: null,
  pov: null,
  actionState: "idle",
  error: null,
  message: null,
  refresh: vi.fn(async () => true),
  create: vi.fn(async () => null),
  update: vi.fn(async () => null),
  supersede: vi.fn(async () => null),
  retire: vi.fn(async () => null),
  projectPov: vi.fn(async () => null),
  clearPendingSelection: vi.fn(),
  selectEntry: vi.fn(),
};
const contextPlannerController = {
  policies: [], manifests: [], activities: [], connectors: [], plan: null,
  actionState: "idle", error: null, message: null,
  refresh: vi.fn(async () => true), savePolicy: vi.fn(async () => null),
  runPlan: vi.fn(async () => null),
} as never;

describe("CanonWorkspace", () => {
  it("renders accessible canonical and review tabs with a three-column evidence review", () => {
    const markup = renderToStaticMarkup(createElement(CanonWorkspace, {
      activeTab: "review",
      characters: [character],
      controller: controller(),
      continuityController,
      continuitySubjectOptions: [],
      characterKnowledgeController,
      characterKnowledgeReferenceOptions: [],
      contextPlannerController,
      contextEntityOptions: [],
      documentLabels: { [evidence.documentId]: "1화" },
      loreEntries: [loreEntry],
      onEvidenceOpen: vi.fn(),
      onTabChange: vi.fn(),
      relations: [],
      workTitle: "달빛 기록",
    }));

    expect(markup).toContain('aria-label="별빛 작업"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain(">별빛<");
    expect(markup).toContain(">변경 검토<");
    expect(markup).toContain(">연속성<");
    expect(markup).toContain(">인물 지식<");
    expect(markup).toContain(">문맥·활동<");
    expect(markup).toContain('class="canon-review-grid"');
    expect(markup).toContain('aria-label="변경 후보"');
    expect(markup).toContain('aria-label="필드 변경 비교"');
    expect(markup).toContain('aria-label="원문 근거"');
    expect(markup).toContain("달빛 아래 서 있었다.");
    expect(markup).toContain("승인");
    expect(markup).toContain("기각");
    expect(markup).toContain("별빛 Markdown 내보내기");
    expect(markup).toContain("Obsidian 호환 단방향 사본 · 다시 가져오기 없음");
  });

  it("shows approved exact evidence from the canonical Character detail", () => {
    const markup = renderToStaticMarkup(createElement(CanonWorkspace, {
      activeTab: "canonical",
      characters: [character],
      controller: controller(),
      continuityController,
      continuitySubjectOptions: [],
      characterKnowledgeController,
      characterKnowledgeReferenceOptions: [],
      contextPlannerController,
      contextEntityOptions: [],
      documentLabels: { [evidence.documentId]: "1화" },
      loreEntries: [loreEntry],
      onEvidenceOpen: vi.fn(),
      onTabChange: vi.fn(),
      relations: [],
      workTitle: "달빛 기록",
    }));

    expect(markup).toContain('aria-label="별빛 원문 근거"');
    expect(markup).toContain(evidence.exactText);
    expect(markup).toContain(">원문 열기<");
  });

  it("shows anchor-backed approved Candidate evidence in the canonical relation detail", () => {
    const markup = renderToStaticMarkup(createElement(CanonWorkspace, {
      activeTab: "canonical",
      characters: [],
      controller: controller(approvedRelationCandidate),
      continuityController,
      continuitySubjectOptions: [],
      characterKnowledgeController,
      characterKnowledgeReferenceOptions: [],
      contextPlannerController,
      contextEntityOptions: [],
      documentLabels: { [evidence.documentId]: "1화" },
      loreEntries: [],
      onEvidenceOpen: vi.fn(),
      onTabChange: vi.fn(),
      relations: [relation],
      workTitle: "달빛 기록",
    }));

    expect(markup).toContain("같은 기록 임무를 맡는다.");
    expect(markup).toContain('aria-label="별빛 원문 근거"');
    expect(markup).toContain(evidence.exactText);
    expect(markup).toContain(">원문 열기<");
  });
});
