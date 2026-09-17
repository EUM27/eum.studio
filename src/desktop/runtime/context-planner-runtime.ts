import type { ContextPlannerIpcRuntime } from "../ipc/register-context-planner-ipc";

export function pickContextPlannerRuntime(runtime: ContextPlannerIpcRuntime): ContextPlannerIpcRuntime {
  return Object.freeze({
    listAssistantEntityContextPolicies: (command) => runtime.listAssistantEntityContextPolicies(command),
    saveAssistantEntityContextPolicy: (command) => runtime.saveAssistantEntityContextPolicy(command),
    planAssistantContext: (command) => runtime.planAssistantContext(command),
    listAssistantContextManifests: (command) => runtime.listAssistantContextManifests(command),
    listAssistantContextActivities: (command) => runtime.listAssistantContextActivities(command),
  });
}
