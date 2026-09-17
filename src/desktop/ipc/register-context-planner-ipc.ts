import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CONTEXT_ACTIVITIES_LIST_CHANNEL,
  CONTEXT_MANIFESTS_LIST_CHANNEL,
  CONTEXT_PLAN_CHANNEL,
  CONTEXT_POLICY_LIST_CHANNEL,
  CONTEXT_POLICY_SAVE_CHANNEL,
} from "../../application/contracts/bridge/context-planner-bridge";
import {
  parseListAssistantEntityContextPoliciesCommand,
  parseSaveAssistantEntityContextPolicyCommand,
  type AssistantEntityContextPolicyList,
  type AssistantEntityContextPolicyProjection,
  type ListAssistantEntityContextPoliciesCommand,
  type SaveAssistantEntityContextPolicyCommand,
} from "../../application/continuity/assistant-context-policy";
import {
  parseListAssistantContextActivitiesCommand,
  parseListAssistantContextManifestsCommand,
  type AssistantContextActivityList,
  type AssistantContextManifestList,
  type AssistantContextPlanProjection,
  type ListAssistantContextActivitiesCommand,
  type ListAssistantContextManifestsCommand,
} from "../../application/continuity/assistant-context-manifest";
import {
  parsePlanAssistantContextInput,
  type PlanAssistantContextInput,
} from "../../application/continuity/context-planner";

export type ContextPlannerIpcRuntime = Readonly<{
  listAssistantEntityContextPolicies(command: ListAssistantEntityContextPoliciesCommand): Promise<AssistantEntityContextPolicyList>;
  saveAssistantEntityContextPolicy(command: SaveAssistantEntityContextPolicyCommand): Promise<AssistantEntityContextPolicyProjection>;
  planAssistantContext(command: PlanAssistantContextInput): Promise<AssistantContextPlanProjection>;
  listAssistantContextManifests(command: ListAssistantContextManifestsCommand): Promise<AssistantContextManifestList>;
  listAssistantContextActivities(command: ListAssistantContextActivitiesCommand): Promise<AssistantContextActivityList>;
}>;

export function registerContextPlannerIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender(event: IpcMainInvokeEvent): void;
  runtime: ContextPlannerIpcRuntime;
}>): void {
  const handle = <T>(channel: string, parse: (value: unknown) => T, run: (command: T) => Promise<unknown>) =>
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  handle(CONTEXT_POLICY_LIST_CHANNEL, parseListAssistantEntityContextPoliciesCommand, input.runtime.listAssistantEntityContextPolicies);
  handle(CONTEXT_POLICY_SAVE_CHANNEL, parseSaveAssistantEntityContextPolicyCommand, input.runtime.saveAssistantEntityContextPolicy);
  handle(CONTEXT_PLAN_CHANNEL, parsePlanAssistantContextInput, input.runtime.planAssistantContext);
  handle(CONTEXT_MANIFESTS_LIST_CHANNEL, parseListAssistantContextManifestsCommand, input.runtime.listAssistantContextManifests);
  handle(CONTEXT_ACTIVITIES_LIST_CHANNEL, parseListAssistantContextActivitiesCommand, input.runtime.listAssistantContextActivities);
}
