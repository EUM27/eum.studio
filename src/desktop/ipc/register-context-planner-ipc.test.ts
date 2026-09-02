import { describe, expect, it, vi } from "vitest";

import { CONTEXT_PLAN_CHANNEL } from "../../application/contracts/bridge/context-planner-bridge";
import { registerContextPlannerIpc } from "./register-context-planner-ipc";

describe("registerContextPlannerIpc", () => {
  it("authenticates and parses context planning commands", async () => {
    const handlers = new Map<string, (event: unknown, value: unknown) => unknown>();
    const authorizeSender = vi.fn();
    const runtime = {
      listAssistantEntityContextPolicies: vi.fn(), saveAssistantEntityContextPolicy: vi.fn(),
      planAssistantContext: vi.fn(async () => ({ schemaVersion: 1, status: "planned", workId: "work-1", capability: "canon.review", tokenBudget: 10, estimatedTokenCount: 0, entries: [], excluded: [] })),
      listAssistantContextManifests: vi.fn(), listAssistantContextActivities: vi.fn(),
    };
    registerContextPlannerIpc({
      ipcMain: { handle: (channel: string, handler: unknown) => handlers.set(channel, handler as never) } as never,
      authorizeSender,
      runtime: runtime as never,
    });
    const event = {};
    await handlers.get(CONTEXT_PLAN_CHANNEL)!(event, {
      schemaVersion: 1, workId: "work-1", capability: "canon.review",
      sourceRange: null, sceneId: null, povCharacterId: null, userQuery: "", tokenBudget: 10,
    });
    expect(authorizeSender).toHaveBeenCalledWith(event);
    expect(runtime.planAssistantContext).toHaveBeenCalledWith(expect.objectContaining({ tokenBudget: 10 }));
    expect(() => handlers.get(CONTEXT_PLAN_CHANNEL)!({}, {
      schemaVersion: 1, workId: "work-1", capability: "canon.review",
      sourceRange: null, sceneId: null, povCharacterId: null, userQuery: "", tokenBudget: 10,
      score: 1,
    })).toThrow(/fields/u);
  });
});
