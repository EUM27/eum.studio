import { describe, expect, it, vi } from "vitest";

import {
  CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
  CHARACTER_KNOWLEDGE_LIST_CHANNEL,
  CHARACTER_KNOWLEDGE_POV_CHANNEL,
  CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
  CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
  CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
  createCharacterKnowledgeBridge,
} from "./character-knowledge-bridge";

const projection = Object.freeze({
  schemaVersion: 1 as const,
  knowledgeId: "knowledge-1",
  revision: 1,
  workId: "work-1",
  characterId: "character-1",
  statement: "열쇠는 북문을 연다",
  stance: "believes" as const,
  truthStatus: "false" as const,
  aboutRefs: [],
  evidence: [],
  status: "active" as const,
  supersedesKnowledgeId: null,
  supersededByKnowledgeId: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

describe("CharacterKnowledge bridge", () => {
  it("validates and invokes all six narrow channels", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === CHARACTER_KNOWLEDGE_LIST_CHANNEL) {
        return { schemaVersion: 1, workId: "work-1", entries: [projection] };
      }
      if (channel === CHARACTER_KNOWLEDGE_POV_CHANNEL) {
        return {
          schemaVersion: 1,
          workId: "work-1",
          characterId: "character-1",
          objectiveFacts: [],
          povKnown: [],
          povFalseBeliefs: [projection],
          povUnavailable: [],
        };
      }
      return projection;
    });
    const bridge = createCharacterKnowledgeBridge(invoke);
    await bridge.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "열쇠는 북문을 연다", stance: "believes", truthStatus: "false", aboutRefs: [], evidenceRange: null });
    await bridge.update({ schemaVersion: 1, workId: "work-1" as never, knowledgeId: "knowledge-1" as never, expectedRevision: 1, statement: "열쇠가 북문을 연다", aboutRefs: [] });
    await bridge.supersede({ schemaVersion: 1, workId: "work-1" as never, knowledgeId: "knowledge-1" as never, expectedRevision: 1, statement: "열쇠는 남문을 연다", stance: "knows", truthStatus: "true", aboutRefs: [], evidenceRange: null });
    await bridge.retire({ schemaVersion: 1, workId: "work-1" as never, knowledgeId: "knowledge-1" as never, expectedRevision: 1, reason: "정리" });
    await bridge.list({ schemaVersion: 1, workId: "work-1" as never, characterId: null, status: "all" });
    await bridge.projectPov({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never });
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
      CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
      CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
      CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
      CHARACTER_KNOWLEDGE_LIST_CHANNEL,
      CHARACTER_KNOWLEDGE_POV_CHANNEL,
    ]);
  });

  it("rejects extra command fields before invoking IPC", async () => {
    const invoke = vi.fn();
    const bridge = createCharacterKnowledgeBridge(invoke);
    await expect(bridge.create({
      schemaVersion: 1,
      workId: "work-1",
      characterId: "character-1",
      statement: "문장",
      stance: "knows",
      truthStatus: "true",
      aboutRefs: [],
      evidenceRange: null,
      token: "must-not-cross",
    } as never)).rejects.toThrow(/fields/u);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects malformed runtime results", async () => {
    const bridge = createCharacterKnowledgeBridge(async () => ({
      ...projection,
      truthStatus: "certain",
    }));
    await expect(bridge.create({ schemaVersion: 1, workId: "work-1" as never, characterId: "character-1" as never, statement: "문장", stance: "knows", truthStatus: "true", aboutRefs: [], evidenceRange: null }))
      .rejects.toThrow(/Invalid CharacterKnowledge creation/u);
  });
});
