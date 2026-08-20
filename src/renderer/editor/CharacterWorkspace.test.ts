import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { CharacterProjection } from "../../application/characters/character-contract";
import type { CharacterExtractionCandidate } from "../../application/characters/character-extraction-contract";
import type { CharacterGenerationCandidate } from "../../application/characters/character-generation-contract";
import type { CharacterRelationProjection } from "../../application/characters/character-relation-contract";
import { CharacterWorkspace } from "./CharacterWorkspace";

const character: CharacterProjection = {
  schemaVersion: 1,
  characterId: entityId<"Character">("character-a"),
  revision: 2,
  workId: entityId<"Work">("work-a"),
  name: "윤서",
  aliases: ["서린"],
  role: "기록자",
  summary: "상황을 기록한다.",
  appearance: "검은 단발",
  personality: "신중함",
  speech: "짧게 말함",
  goal: "증언 보존",
  conflict: "우정과 진실",
  note: "말투 확인",
  evidences: [],
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
  retiredAt: null,
};

const candidate: CharacterExtractionCandidate = {
  schemaVersion: 1,
  candidateId: entityId<"CharacterExtractionCandidate">("candidate-a"),
  revision: 1,
  workId: entityId<"Work">("work-a"),
  sourceRange: {
    documentId: entityId<"Document">("document-a"),
    documentRevisionId: entityId<"DocumentRevision">("revision-a"),
    from: 5,
    to: 14,
  },
  providerId: "provider-a",
  modelId: "model-a",
  promptVersion: "character-extraction-v1",
  status: "ready",
  items: [{
    itemId: entityId<"CharacterExtractionItem">("item-a"),
    name: "해린",
    aliases: [],
    role: "항해사",
    summary: "",
    appearance: "",
    personality: "",
    speech: "",
    goal: "",
    conflict: "",
    note: "",
    evidences: [{
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
      from: 5,
      to: 7,
      exactText: "해린",
    }],
    matchingCharacterIds: [],
    status: "pending",
    approvedCharacterId: null,
  }],
  contextReceiptId: entityId<"AssistantContextReceipt">("receipt-a"),
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

const generationCandidate: CharacterGenerationCandidate = {
  schemaVersion: 1,
  candidateId: entityId<"CharacterGenerationCandidate">("generated-a"),
  revision: 1,
  workId: entityId<"Work">("work-a"),
  brief: {
    role: "탐정",
    personality: "집요함",
    relationships: "기록자와 협력",
    genre: "미스터리",
  },
  providerId: "provider-a",
  modelId: "model-a",
  promptVersion: "character-generation-v1",
  status: "ready",
  items: [{
    itemId: entityId<"CharacterGenerationItem">("generated-item-a"),
    name: "도윤",
    aliases: [],
    role: "탐정",
    summary: "사건을 추적한다.",
    appearance: "",
    personality: "집요함",
    speech: "",
    goal: "진상 규명",
    conflict: "",
    note: "기록자와 협력하는 관계 초안",
    matchingCharacterIds: [],
    status: "pending",
    approvedCharacterId: null,
  }],
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

const otherCharacter: CharacterProjection = {
  ...character,
  characterId: entityId<"Character">("character-b"),
  name: "재헌",
  aliases: [],
};

const relation: CharacterRelationProjection = {
  schemaVersion: 1,
  relationId: entityId<"CharacterRelation">("relation-a"),
  revision: 1,
  workId: entityId<"Work">("work-a"),
  fromCharacterId: character.characterId,
  toCharacterId: otherCharacter.characterId,
  kind: "동료",
  description: "서로의 판단을 신뢰한다.",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
  retiredAt: null,
  retirementReason: null,
};

describe("CharacterWorkspace", () => {
  it("shows the character list, confirmed detail, and local draw tool", () => {
    const markup = renderToStaticMarkup(createElement(CharacterWorkspace, {
      actionState: "idle",
      candidates: [candidate],
      characters: [character, otherCharacter],
      error: null,
      extractionActionState: "idle",
      extractionError: null,
      generationActionState: "idle",
      generationCandidates: [generationCandidate],
      generationError: null,
      inspirationBusy: false,
      inspirationKeywords: ["차가운 인상"],
      relationActionState: "idle",
      relations: [relation],
      oauthStatus: {
        schemaVersion: 1,
        revision: 1,
        providerId: "runtime-chatgpt",
        displayName: "GPT",
        modelId: "runtime-model",
        connected: true,
        email: null,
        planType: null,
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
      onAddEvidence: () => undefined,
      onAddInspirationKeywords: () => undefined,
      onCreate: () => undefined,
      onCreateRelation: () => undefined,
      onDecideCandidate: () => undefined,
      onDecideGenerationCandidate: () => undefined,
      onOpenEvidence: () => undefined,
      onOpenSettings: () => undefined,
      onDeleteInspirationKeyword: () => undefined,
      onRequestExtractionPermission: () => undefined,
      onRetire: () => undefined,
      onRetireRelation: () => undefined,
      onRunGeneration: () => undefined,
      onRunExtraction: () => undefined,
      onSaveDraw: () => undefined,
      onSelect: () => undefined,
      onUpdate: () => undefined,
      onUpdateRelation: () => undefined,
      permissionRequired: false,
      selectedCharacterId: character.characterId,
      selection: {
        documentId: "document-a",
        documentTitle: "1화",
        documentRevisionId: "revision-a",
        from: 5,
        to: 14,
      },
    }));

    expect(markup).toContain('aria-label="인물 작업면"');
    expect(markup).toContain("인물 뽑기");
    expect(markup).toContain("차가운 인상");
    expect(markup).toContain("윤서");
    expect(markup).toContain("성격·가치관");
    expect(markup).toContain("관계");
    expect(markup).toContain("윤서 → 재헌");
    expect(markup).toContain("동료");
    expect(markup).toContain("관계 추가");
    expect(markup).toContain("등장·근거");
    expect(markup).not.toContain("해린");
    expect(markup).not.toContain("설정 생성 · model-a");
  });
});
