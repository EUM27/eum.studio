import {
  parseAssistantEntityContextPolicyList,
  parseAssistantEntityContextPolicyProjection,
  parseListAssistantEntityContextPoliciesCommand,
  parseSaveAssistantEntityContextPolicyCommand,
  type AssistantEntityContextPolicyList,
  type AssistantEntityContextPolicyProjection,
  type ListAssistantEntityContextPoliciesCommand,
  type SaveAssistantEntityContextPolicyCommand,
} from "../../continuity/assistant-context-policy";
import {
  parseAssistantContextActivityList,
  parseAssistantContextManifestList,
  parseAssistantContextPlanProjection,
  parseListAssistantContextActivitiesCommand,
  parseListAssistantContextManifestsCommand,
  type AssistantContextActivityList,
  type AssistantContextManifestList,
  type AssistantContextPlanProjection,
  type ListAssistantContextActivitiesCommand,
  type ListAssistantContextManifestsCommand,
} from "../../continuity/assistant-context-manifest";
import {
  parsePlanAssistantContextInput,
  type PlanAssistantContextInput,
} from "../../continuity/context-planner";

export const CONTEXT_POLICY_LIST_CHANNEL = "studio:context:list-policies";
export const CONTEXT_POLICY_SAVE_CHANNEL = "studio:context:save-policy";
export const CONTEXT_PLAN_CHANNEL = "studio:context:plan";
export const CONTEXT_MANIFESTS_LIST_CHANNEL = "studio:context:list-manifests";
export const CONTEXT_ACTIVITIES_LIST_CHANNEL = "studio:context:list-activities";

export type ContextPlannerBridgeChannel =
  | typeof CONTEXT_POLICY_LIST_CHANNEL
  | typeof CONTEXT_POLICY_SAVE_CHANNEL
  | typeof CONTEXT_PLAN_CHANNEL
  | typeof CONTEXT_MANIFESTS_LIST_CHANNEL
  | typeof CONTEXT_ACTIVITIES_LIST_CHANNEL;

export type ContextPlannerBridgePayload =
  | ListAssistantEntityContextPoliciesCommand
  | SaveAssistantEntityContextPolicyCommand
  | PlanAssistantContextInput
  | ListAssistantContextManifestsCommand
  | ListAssistantContextActivitiesCommand;

export type ContextPlannerBridge = Readonly<{
  listPolicies(command: ListAssistantEntityContextPoliciesCommand): Promise<AssistantEntityContextPolicyList>;
  savePolicy(command: SaveAssistantEntityContextPolicyCommand): Promise<AssistantEntityContextPolicyProjection>;
  plan(command: PlanAssistantContextInput): Promise<AssistantContextPlanProjection>;
  listManifests(command: ListAssistantContextManifestsCommand): Promise<AssistantContextManifestList>;
  listActivities(command: ListAssistantContextActivitiesCommand): Promise<AssistantContextActivityList>;
}>;

export type ContextPlannerBridgeInvoke = (
  channel: ContextPlannerBridgeChannel,
  payload?: ContextPlannerBridgePayload,
) => Promise<unknown>;

function result<T>(value: unknown, parse: (value: unknown) => T, message: string): T {
  try { return parse(value); } catch { throw new Error(message); }
}

export function createContextPlannerBridge(invoke: ContextPlannerBridgeInvoke): ContextPlannerBridge {
  return Object.freeze({
    listPolicies: async (command) => result(
      await invoke(CONTEXT_POLICY_LIST_CHANNEL, parseListAssistantEntityContextPoliciesCommand(command)),
      parseAssistantEntityContextPolicyList,
      "Invalid Assistant context policy list",
    ),
    savePolicy: async (command) => result(
      await invoke(CONTEXT_POLICY_SAVE_CHANNEL, parseSaveAssistantEntityContextPolicyCommand(command)),
      parseAssistantEntityContextPolicyProjection,
      "Invalid Assistant context policy",
    ),
    plan: async (command) => result(
      await invoke(CONTEXT_PLAN_CHANNEL, parsePlanAssistantContextInput(command)),
      parseAssistantContextPlanProjection,
      "Invalid Assistant context plan",
    ),
    listManifests: async (command) => result(
      await invoke(CONTEXT_MANIFESTS_LIST_CHANNEL, parseListAssistantContextManifestsCommand(command)),
      parseAssistantContextManifestList,
      "Invalid Assistant context manifest list",
    ),
    listActivities: async (command) => result(
      await invoke(CONTEXT_ACTIVITIES_LIST_CHANNEL, parseListAssistantContextActivitiesCommand(command)),
      parseAssistantContextActivityList,
      "Invalid Assistant context activity list",
    ),
  });
}
