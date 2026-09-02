import { describe, expect, it, vi } from "vitest";

import {
  CONTEXT_ACTIVITIES_LIST_CHANNEL,
  CONTEXT_MANIFESTS_LIST_CHANNEL,
  CONTEXT_PLAN_CHANNEL,
  CONTEXT_POLICY_LIST_CHANNEL,
  CONTEXT_POLICY_SAVE_CHANNEL,
  createContextPlannerBridge,
} from "./context-planner-bridge";

describe("Context Planner bridge", () => {
  it("validates and invokes the five narrow channels", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === CONTEXT_POLICY_LIST_CHANNEL) return { schemaVersion: 1, workId: "work-1", policies: [] };
      if (channel === CONTEXT_POLICY_SAVE_CHANNEL) return { schemaVersion: 1, workId: "work-1", entity: { kind: "character", id: "character-1" }, revision: 1, mode: "required", updatedAt: "2026-08-29T00:00:00.000Z" };
      if (channel === CONTEXT_PLAN_CHANNEL) return { schemaVersion: 1, status: "planned", workId: "work-1", capability: "canon.review", tokenBudget: 10, estimatedTokenCount: 0, entries: [], excluded: [] };
      if (channel === CONTEXT_MANIFESTS_LIST_CHANNEL) return { schemaVersion: 1, workId: "work-1", manifests: [] };
      return { schemaVersion: 1, workId: "work-1", activities: [] };
    });
    const bridge = createContextPlannerBridge(invoke);
    await bridge.listPolicies({ schemaVersion: 1, workId: "work-1" as never });
    await bridge.savePolicy({ schemaVersion: 1, workId: "work-1" as never, entity: { kind: "character", id: "character-1" as never }, expectedRevision: null, mode: "required" });
    await bridge.plan({ schemaVersion: 1, workId: "work-1" as never, capability: "canon.review", sourceRange: null, sceneId: null, povCharacterId: null, userQuery: "", tokenBudget: 10 });
    await bridge.listManifests({ schemaVersion: 1, workId: "work-1" as never });
    await bridge.listActivities({ schemaVersion: 1, workId: "work-1" as never });
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      CONTEXT_POLICY_LIST_CHANNEL,
      CONTEXT_POLICY_SAVE_CHANNEL,
      CONTEXT_PLAN_CHANNEL,
      CONTEXT_MANIFESTS_LIST_CHANNEL,
      CONTEXT_ACTIVITIES_LIST_CHANNEL,
    ]);
  });

  it("rejects malformed commands and sensitive result fields", async () => {
    const invoke = vi.fn(async () => ({ schemaVersion: 1, workId: "work-1", activities: [{ prompt: "원고" }] }));
    const bridge = createContextPlannerBridge(invoke);
    await expect(bridge.plan({ schemaVersion: 1, workId: "work-1", capability: "canon.review", sourceRange: null, sceneId: null, povCharacterId: null, userQuery: "", tokenBudget: 10, score: 1 } as never))
      .rejects.toThrow(/fields/u);
    await expect(bridge.listActivities({ schemaVersion: 1, workId: "work-1" as never }))
      .rejects.toThrow(/Invalid Assistant context activity list/u);
  });
});
