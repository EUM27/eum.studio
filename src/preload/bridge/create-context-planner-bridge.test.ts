import { describe, expect, it, vi } from "vitest";

import { CONTEXT_POLICY_LIST_CHANNEL } from "../../application/contracts/bridge/context-planner-bridge";
import { createPreloadContextPlannerBridge } from "./create-context-planner-bridge";

describe("createPreloadContextPlannerBridge", () => {
  it("exposes only validated policy/plan/manifest/activity methods", async () => {
    const invoke = vi.fn(async () => ({ schemaVersion: 1, workId: "work-1", policies: [] }));
    const bridge = createPreloadContextPlannerBridge(invoke);
    await expect(bridge.listPolicies({ schemaVersion: 1, workId: "work-1" as never }))
      .resolves.toEqual({ schemaVersion: 1, workId: "work-1", policies: [] });
    expect(Object.keys(bridge).sort()).toEqual(["listActivities", "listManifests", "listPolicies", "plan", "savePolicy"]);
    expect(invoke).toHaveBeenCalledWith(CONTEXT_POLICY_LIST_CHANNEL, expect.objectContaining({ workId: "work-1" }));
  });
});
