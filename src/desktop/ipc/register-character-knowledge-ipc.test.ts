import { describe, expect, it, vi } from "vitest";

import {
  CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
  CHARACTER_KNOWLEDGE_LIST_CHANNEL,
  CHARACTER_KNOWLEDGE_POV_CHANNEL,
  CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
  CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
  CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
} from "../../application/contracts/bridge/character-knowledge-bridge";
import { registerCharacterKnowledgeIpc } from "./register-character-knowledge-ipc";

describe("registerCharacterKnowledgeIpc", () => {
  it("registers authenticated, parsed handlers for the narrow runtime", async () => {
    const handlers = new Map<string, (event: unknown, value: unknown) => Promise<unknown>>();
    const authorizeSender = vi.fn();
    const projection = {
      schemaVersion: 1, knowledgeId: "knowledge-1", revision: 1, workId: "work-1",
      characterId: "character-1", statement: "문장", stance: "knows",
      truthStatus: "true", aboutRefs: [], evidence: [], status: "active",
      supersedesKnowledgeId: null, supersededByKnowledgeId: null,
      createdAt: "2026-08-29T00:00:00.000Z", updatedAt: "2026-08-29T00:00:00.000Z",
    } as const;
    const runtime = {
      createCharacterKnowledge: vi.fn(async () => projection),
      updateCharacterKnowledge: vi.fn(async () => projection),
      supersedeCharacterKnowledge: vi.fn(async () => projection),
      retireCharacterKnowledge: vi.fn(async () => projection),
      listCharacterKnowledge: vi.fn(async () => ({ schemaVersion: 1 as const, workId: "work-1" as never, entries: [projection] })),
      projectPovCharacterKnowledge: vi.fn(async () => ({ schemaVersion: 1 as const, workId: "work-1" as never, characterId: "character-1" as never, objectiveFacts: [projection], povKnown: [projection], povFalseBeliefs: [], povUnavailable: [] })),
    };
    registerCharacterKnowledgeIpc({
      ipcMain: { handle: (channel: string, handler: unknown) => { handlers.set(channel, handler as never); } } as never,
      authorizeSender,
      runtime: runtime as never,
    });
    expect([...handlers.keys()]).toEqual([
      CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
      CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
      CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
      CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
      CHARACTER_KNOWLEDGE_LIST_CHANNEL,
      CHARACTER_KNOWLEDGE_POV_CHANNEL,
    ]);
    const event = {};
    await handlers.get(CHARACTER_KNOWLEDGE_CREATE_CHANNEL)!(event, {
      schemaVersion: 1, workId: "work-1", characterId: "character-1",
      statement: "문장", stance: "knows", truthStatus: "true",
      aboutRefs: [], evidenceRange: null,
    });
    expect(authorizeSender).toHaveBeenCalledWith(event);
    expect(runtime.createCharacterKnowledge).toHaveBeenCalledWith(expect.objectContaining({ statement: "문장" }));
  });

  it("does not pass malformed payloads to the runtime", async () => {
    const handlers = new Map<string, (event: unknown, value: unknown) => Promise<unknown>>();
    const runtime = {
      createCharacterKnowledge: vi.fn(), updateCharacterKnowledge: vi.fn(), supersedeCharacterKnowledge: vi.fn(),
      retireCharacterKnowledge: vi.fn(), listCharacterKnowledge: vi.fn(), projectPovCharacterKnowledge: vi.fn(),
    };
    registerCharacterKnowledgeIpc({
      ipcMain: { handle: (channel: string, handler: unknown) => { handlers.set(channel, handler as never); } } as never,
      authorizeSender: vi.fn(),
      runtime: runtime as never,
    });
    expect(() => handlers.get(CHARACTER_KNOWLEDGE_CREATE_CHANNEL)!({}, {
      schemaVersion: 1, workId: "work-1", characterId: "character-1",
      statement: "문장", stance: "knows", truthStatus: "true",
      aboutRefs: [], evidenceRange: null, token: "blocked",
    })).toThrow(/fields/u);
    expect(runtime.createCharacterKnowledge).not.toHaveBeenCalled();
  });
});
