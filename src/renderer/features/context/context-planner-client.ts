import type {
  AssistantBridge,
  ContextPlannerBridge,
} from "../../../application/contracts/studio-bridge";

export function createContextPlannerClient(input: Readonly<{
  assistant: Pick<AssistantBridge, "getConnectorProfile">;
  context: ContextPlannerBridge;
}>) {
  return Object.freeze({
    getConnectorProfile: () => input.assistant.getConnectorProfile(),
    listPolicies: input.context.listPolicies,
    savePolicy: input.context.savePolicy,
    plan: input.context.plan,
    listManifests: input.context.listManifests,
    listActivities: input.context.listActivities,
  });
}
