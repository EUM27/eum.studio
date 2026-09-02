import { describe, expect, it } from "vitest";

import {
  parseCharacterKnowledgeProjection,
  parseCreateCharacterKnowledgeCommand,
  parseListCharacterKnowledgeCommand,
  parseProjectPovKnowledgeCommand,
  parsePovKnowledgeContextProjection,
  parseRetireCharacterKnowledgeCommand,
  parseSupersedeCharacterKnowledgeCommand,
  parseUpdateCharacterKnowledgeCommand,
} from "./character-knowledge-contract";

const sourceRange = Object.freeze({
  documentId: "document-1",
  documentRevisionId: "revision-1",
  from: 3,
  to: 8,
});

const activeKnowledge = Object.freeze({
  schemaVersion: 1 as const,
  knowledgeId: "knowledge-1",
  revision: 1,
  workId: "work-1",
  characterId: "character-1",
  statement: "열쇠는 북문을 연다",
  stance: "believes" as const,
  truthStatus: "false" as const,
  aboutRefs: [{ kind: "lore-entry" as const, id: "lore-1" }],
  evidence: [{
    anchorId: "anchor-1",
    documentId: "document-1",
    documentRevisionId: "revision-1",
    exactText: "비밀 열쇠",
    integrity: "resolved" as const,
    range: { from: 3, to: 8 },
  }],
  status: "active" as const,
  supersedesKnowledgeId: null,
  supersededByKnowledgeId: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

describe("CharacterKnowledge contracts", () => {
  it("keeps objective truth separate from a Character stance", () => {
    expect(parseCreateCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      characterId: "character-1",
      statement: "열쇠는 북문을 연다",
      stance: "believes",
      truthStatus: "false",
      aboutRefs: [{ kind: "lore-entry", id: "lore-1" }],
      evidenceRange: sourceRange,
    })).toMatchObject({ stance: "believes", truthStatus: "false" });

    expect(parseCharacterKnowledgeProjection(activeKnowledge)).toEqual(activeKnowledge);
  });

  it("requires state changes to use an explicit supersession command", () => {
    expect(parseUpdateCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      knowledgeId: "knowledge-1",
      expectedRevision: 1,
      statement: "열쇠는 북문을 연다",
      aboutRefs: [],
    })).not.toHaveProperty("stance");

    expect(() => parseUpdateCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      knowledgeId: "knowledge-1",
      expectedRevision: 1,
      statement: "열쇠는 북문을 연다",
      aboutRefs: [],
      stance: "knows",
    })).toThrow(/fields/u);

    expect(parseSupersedeCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      knowledgeId: "knowledge-1",
      expectedRevision: 1,
      statement: "열쇠는 남문을 연다",
      stance: "knows",
      truthStatus: "true",
      aboutRefs: [],
      evidenceRange: null,
    })).toMatchObject({
      knowledgeId: "knowledge-1",
      expectedRevision: 1,
      stance: "knows",
      truthStatus: "true",
    });
  });

  it("parses list, retire, and POV commands with exact fields", () => {
    expect(parseListCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      characterId: null,
      status: "current",
    })).toMatchObject({ characterId: null, status: "current" });
    expect(parseRetireCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      knowledgeId: "knowledge-1",
      expectedRevision: 1,
      reason: "사용자 정리",
    })).toMatchObject({ reason: "사용자 정리" });
    expect(parseProjectPovKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      characterId: "character-1",
    })).toMatchObject({ characterId: "character-1" });
  });

  it("keeps POV known, false-belief, unavailable, and objective lists distinct", () => {
    const projection = parsePovKnowledgeContextProjection({
      schemaVersion: 1,
      workId: "work-1",
      characterId: "character-1",
      objectiveFacts: [{ ...activeKnowledge, knowledgeId: "objective-1", stance: "knows", truthStatus: "true" }],
      povKnown: [{ ...activeKnowledge, knowledgeId: "known-1", stance: "knows", truthStatus: "true" }],
      povFalseBeliefs: [activeKnowledge],
      povUnavailable: [{ ...activeKnowledge, knowledgeId: "unknown-1", stance: "unaware", truthStatus: "true" }],
    });
    expect(projection.objectiveFacts[0]?.truthStatus).toBe("true");
    expect(projection.povFalseBeliefs[0]).toMatchObject({ stance: "believes", truthStatus: "false" });
    expect(projection.povUnavailable[0]?.stance).toBe("unaware");
  });

  it("rejects invalid truth, stance, lineage, and resolved evidence shapes", () => {
    expect(() => parseCreateCharacterKnowledgeCommand({
      schemaVersion: 1,
      workId: "work-1",
      characterId: "character-1",
      statement: "문장",
      stance: "knows",
      truthStatus: "certain",
      aboutRefs: [],
      evidenceRange: null,
    })).toThrow(/truthStatus/u);
    expect(() => parseCharacterKnowledgeProjection({
      ...activeKnowledge,
      supersedesKnowledgeId: "knowledge-1",
    })).toThrow(/itself/u);
    expect(() => parseCharacterKnowledgeProjection({
      ...activeKnowledge,
      evidence: [{ ...activeKnowledge.evidence[0], range: null }],
    })).toThrow(/range/u);
  });
});
