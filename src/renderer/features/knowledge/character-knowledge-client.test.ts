import { describe, expect, it, vi } from "vitest";

import { createCharacterKnowledgeClient } from "./character-knowledge-client";

describe("createCharacterKnowledgeClient", () => {
  it("delegates only the six typed CharacterKnowledge operations", async () => {
    const bridge = {
      create: vi.fn(), update: vi.fn(), supersede: vi.fn(), retire: vi.fn(),
      list: vi.fn(), projectPov: vi.fn(),
    };
    const client = createCharacterKnowledgeClient(bridge as never);
    const commands = [
      { schemaVersion: 1, workId: "work-1", characterId: "character-1", statement: "문장", stance: "knows", truthStatus: "true", aboutRefs: [], evidenceRange: null },
      { schemaVersion: 1, workId: "work-1", knowledgeId: "knowledge-1", expectedRevision: 1, statement: "수정", aboutRefs: [] },
      { schemaVersion: 1, workId: "work-1", knowledgeId: "knowledge-1", expectedRevision: 1, statement: "새 상태", stance: "believes", truthStatus: "false", aboutRefs: [], evidenceRange: null },
      { schemaVersion: 1, workId: "work-1", knowledgeId: "knowledge-1", expectedRevision: 1, reason: "정리" },
      { schemaVersion: 1, workId: "work-1", characterId: null, status: "all" },
      { schemaVersion: 1, workId: "work-1", characterId: "character-1" },
    ] as const;
    await client.create(commands[0] as never);
    await client.update(commands[1] as never);
    await client.supersede(commands[2] as never);
    await client.retire(commands[3] as never);
    await client.list(commands[4] as never);
    await client.projectPov(commands[5] as never);
    expect(bridge.create).toHaveBeenCalledWith(commands[0]);
    expect(bridge.update).toHaveBeenCalledWith(commands[1]);
    expect(bridge.supersede).toHaveBeenCalledWith(commands[2]);
    expect(bridge.retire).toHaveBeenCalledWith(commands[3]);
    expect(bridge.list).toHaveBeenCalledWith(commands[4]);
    expect(bridge.projectPov).toHaveBeenCalledWith(commands[5]);
  });
});
