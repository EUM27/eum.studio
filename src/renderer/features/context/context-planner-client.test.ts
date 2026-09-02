import { describe, expect, it, vi } from "vitest";

import { createContextPlannerClient } from "./context-planner-client";

describe("createContextPlannerClient", () => {
  it("keeps connector budget discovery and context operations on typed bridges", async () => {
    const assistant = { getConnectorProfile: vi.fn() };
    const context = {
      listPolicies: vi.fn(), savePolicy: vi.fn(), plan: vi.fn(),
      listManifests: vi.fn(), listActivities: vi.fn(),
    };
    const client = createContextPlannerClient({ assistant: assistant as never, context: context as never });
    await client.getConnectorProfile();
    await client.listPolicies({} as never);
    await client.savePolicy({} as never);
    await client.plan({} as never);
    await client.listManifests({} as never);
    await client.listActivities({} as never);
    expect(assistant.getConnectorProfile).toHaveBeenCalledOnce();
    expect(Object.values(context).every((mock) => mock.mock.calls.length === 1)).toBe(true);
  });
});
