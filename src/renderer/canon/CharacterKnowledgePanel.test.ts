import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../domain/writing";
import {
  CharacterKnowledgePanel,
  type CharacterKnowledgePanelController,
} from "./CharacterKnowledgePanel";

const workId = entityId<"Work">("work-1");
const characterId = entityId<"Character">("character-1");
const entry = Object.freeze({
  schemaVersion: 1 as const,
  knowledgeId: entityId<"CharacterKnowledge">("knowledge-1"),
  revision: 2,
  workId,
  characterId,
  statement: "열쇠는 북문을 연다",
  stance: "believes" as const,
  truthStatus: "false" as const,
  aboutRefs: Object.freeze([]),
  evidence: Object.freeze([Object.freeze({
    anchorId: entityId<"Anchor">("anchor-1"),
    documentId: entityId<"Document">("document-1"),
    documentRevisionId: entityId<"DocumentRevision">("revision-1"),
    exactText: "윤서는 믿었다",
    integrity: "resolved" as const,
    range: Object.freeze({ from: 0, to: 7 }),
  })]),
  status: "active" as const,
  supersedesKnowledgeId: entityId<"CharacterKnowledge">("knowledge-0"),
  supersededByKnowledgeId: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:01.000Z",
});

const controller: CharacterKnowledgePanelController = {
  entries: [entry], selectedEntry: entry, selectedKnowledgeId: entry.knowledgeId,
  pendingSelection: { sourceRange: { documentId: entry.evidence[0]!.documentId, documentRevisionId: entry.evidence[0]!.documentRevisionId, from: 0, to: 7 }, exactText: "윤서는 믿었다" },
  pov: { schemaVersion: 1, workId, characterId, objectiveFacts: [], povKnown: [], povFalseBeliefs: [entry], povUnavailable: [] },
  actionState: "idle", error: null, message: null,
  refresh: vi.fn(async () => true), create: vi.fn(async () => null),
  update: vi.fn(async () => null), supersede: vi.fn(async () => null),
  retire: vi.fn(async () => null), projectPov: vi.fn(async () => null),
  clearPendingSelection: vi.fn(), selectEntry: vi.fn(),
};

describe("CharacterKnowledgePanel", () => {
  it("renders explicit Character, truth/stance, exact evidence, lineage, and POV surfaces", () => {
    const markup = renderToStaticMarkup(createElement(CharacterKnowledgePanel, {
      characters: [{ characterId, name: "윤서", retiredAt: null } as never],
      controller,
      documentLabels: { "document-1": "1화" },
      onEvidenceOpen: vi.fn(),
      referenceOptions: [],
    }));
    expect(markup).toContain("선택 원문을 인물 지식으로 저장");
    expect(markup).toContain("대상 인물");
    expect(markup).toContain("인물의 인식");
    expect(markup).toContain("객관적 사실 여부");
    expect(markup).toContain("윤서는 믿었다");
    expect(markup).toContain("계보:");
    expect(markup).toContain("이전 상태 보존 후 새 상태 만들기");
    expect(markup).toContain("POV 인물의 잘못된 믿음");
    expect(markup).toContain("원문 열기");
  });
});
