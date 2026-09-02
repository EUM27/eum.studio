import { describe, expect, it, vi } from "vitest";

import { CHARACTER_KNOWLEDGE_LIST_CHANNEL } from "../../application/contracts/bridge/character-knowledge-bridge";
import { createPreloadCharacterKnowledgeBridge } from "./create-character-knowledge-bridge";

describe("createPreloadCharacterKnowledgeBridge", () => {
  it("exposes only the validated CharacterKnowledge namespace", async () => {
    const invoke = vi.fn(async () => ({ schemaVersion: 1, workId: "work-1", entries: [] }));
    const bridge = createPreloadCharacterKnowledgeBridge(invoke);
    await expect(bridge.list({ schemaVersion: 1, workId: "work-1" as never, characterId: null, status: "current" }))
      .resolves.toEqual({ schemaVersion: 1, workId: "work-1", entries: [] });
    expect(Object.keys(bridge).sort()).toEqual([
      "create", "list", "projectPov", "retire", "supersede", "update",
    ]);
    expect(invoke).toHaveBeenCalledWith(
      CHARACTER_KNOWLEDGE_LIST_CHANNEL,
      expect.objectContaining({ workId: "work-1" }),
    );
  });
});
