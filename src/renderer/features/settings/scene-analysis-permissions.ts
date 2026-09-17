import type { ChatGptOAuthConnectionStatus } from "../../../application/assistant/chatgpt-oauth";
import {
  assistantContextScopeContains,
  type AssistantCapability,
} from "../../../application/assistant/assistant-context-permission";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import { entityId,type EntityId } from "../../../domain/writing";

const AUTOMATIC_SCENE_ANALYSIS_CAPABILITIES = Object.freeze([
  "narrative.digest",
  "canon.review",
  "continuity.review",
] satisfies readonly AssistantCapability[]);

export async function ensureWorkSceneAnalysisPermissions(input:Readonly<{
  workId:EntityId<"Work">;
  status:ChatGptOAuthConnectionStatus;
  client:Pick<StudioBridge["assistant"],"listContextState"|"grantContextPermission">;
  createConversationId?:()=>EntityId<"AssistantConversation">;
}>):Promise<void>{
  const conversationId=input.createConversationId?.()??
    entityId<"AssistantConversation">(crypto.randomUUID());
  const context=await input.client.listContextState({
    schemaVersion:1,workId:input.workId,conversationId,
  });
  for(const capability of AUTOMATIC_SCENE_ANALYSIS_CAPABILITIES){
    const covered=context.grants.some((grant)=>
      grant.duration==="work"&&
      grant.capability===capability&&
      grant.destinationId===input.status.providerId&&
      grant.revokedAt===null&&
      assistantContextScopeContains(grant.localScope,"scene")&&
      assistantContextScopeContains(grant.externalScope,"scene")
    );
    if(!covered){
      await input.client.grantContextPermission({
        schemaVersion:1,workId:input.workId,conversationId:null,capability,
        destinationId:input.status.providerId,localScope:"scene",
        externalScope:"scene",duration:"work",
      });
    }
  }
}
