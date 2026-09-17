import { describe,expect,it,vi } from "vitest";

import { entityId } from "../../../domain/writing";
import { ensureWorkSceneAnalysisPermissions } from "./scene-analysis-permissions";

describe("automatic Scene analysis permissions",()=>{
  it("grants only missing Work-scoped Scene permissions for the connected destination",async()=>{
    const grantContextPermission=vi.fn(async()=>({} as never));
    await ensureWorkSceneAnalysisPermissions({
      workId:entityId<"Work">("work-1"),
      status:{providerId:"provider-1"} as never,
      client:{
        listContextState:vi.fn(async()=>({
          grants:[{
            duration:"work",capability:"narrative.digest",destinationId:"provider-1",
            revokedAt:null,localScope:"scene",externalScope:"scene",
          }],
        } as never)),
        grantContextPermission,
      },
      createConversationId:()=>entityId<"AssistantConversation">("conversation-1"),
    });
    expect(grantContextPermission).toHaveBeenCalledTimes(2);
    expect(grantContextPermission).toHaveBeenCalledWith(expect.objectContaining({
      capability:"canon.review",destinationId:"provider-1",duration:"work",
      localScope:"scene",externalScope:"scene",conversationId:null,
    }));
    expect(grantContextPermission).toHaveBeenCalledWith(expect.objectContaining({
      capability:"continuity.review",destinationId:"provider-1",duration:"work",
      localScope:"scene",externalScope:"scene",conversationId:null,
    }));
  });
});
