import { describe,expect,it,vi } from "vitest";

import {
  SCENE_ANALYSIS_SETTINGS_GET_WORK_CHANNEL,
  SCENE_ANALYSIS_SETTINGS_SAVE_WORK_CHANNEL,
  createSettingsBridge,
} from "./settings-bridge";
import { entityId } from "../../../domain/writing";

describe("Settings bridge scene analysis contract",()=>{
  it("uses strict Work-owned get and save channels",async()=>{
    const workId=entityId<"Work">("work-1");
    const invoke=vi.fn(async(channel:string)=>({
      schemaVersion:1,
      workId,
      revision:channel===SCENE_ANALYSIS_SETTINGS_GET_WORK_CHANNEL?0:1,
      settings:{enabled:channel===SCENE_ANALYSIS_SETTINGS_SAVE_WORK_CHANNEL},
      updatedAt:channel===SCENE_ANALYSIS_SETTINGS_GET_WORK_CHANNEL
        ?null
        :"2026-08-30T00:00:00.000Z",
    }));
    const bridge=createSettingsBridge(invoke);
    await expect(bridge.getWorkSceneAnalysis({schemaVersion:1,workId}))
      .resolves.toMatchObject({revision:0,settings:{enabled:false}});
    await expect(bridge.saveWorkSceneAnalysis({
      schemaVersion:1,workId,expectedRevision:0,settings:{enabled:true},
    })).resolves.toMatchObject({revision:1,settings:{enabled:true}});
    expect(invoke.mock.calls.map(([channel])=>channel)).toEqual([
      SCENE_ANALYSIS_SETTINGS_GET_WORK_CHANNEL,
      SCENE_ANALYSIS_SETTINGS_SAVE_WORK_CHANNEL,
    ]);
  });
});
