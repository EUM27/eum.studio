import { describe,expect,it,vi } from "vitest";

import {
  NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,
  NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL,
  NARRATIVE_DIGEST_LIST_CHANNEL,
  NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL,
} from "../../application/contracts/bridge/narrative-digest-bridge";
import { createPreloadNarrativeDigestBridge } from "./create-narrative-digest-bridge";

describe("createPreloadNarrativeDigestBridge", () => {
  it("exposes only validated digest and Scene analysis methods", async () => {
    const invoke = vi.fn(async (channel:string) =>
      channel===NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL
        ?{schemaVersion:1,status:"login-required"}
        :channel===NARRATIVE_DIGEST_RUN_SCENE_ANALYSIS_CHANNEL
          ?{schemaVersion:1,status:"disabled"}
          :channel===NARRATIVE_DIGEST_LIST_SCENE_ANALYSIS_RUNS_CHANNEL
            ?{schemaVersion:1,workId:"work-1",runs:[]}
        :{ schemaVersion: 1,workId: "work-1",digests: [] });
    const bridge = createPreloadNarrativeDigestBridge(invoke);
    await expect(bridge.list({ schemaVersion: 1,workId: "work-1" as never }))
      .resolves.toEqual({ schemaVersion: 1,workId: "work-1",digests: [] });
    await expect(bridge.generateScene({
      schemaVersion:1,requestId:"request-1" as never,workId:"work-1" as never,
      conversationId:"conversation-1" as never,sceneId:"scene-1" as never,
      sourceRange:{documentId:"document-1" as never,documentRevisionId:"revision-1" as never,from:0,to:1},
      trigger:"scene-transition",
    })).resolves.toEqual({schemaVersion:1,status:"login-required"});
    await expect(bridge.runSceneAnalysis({
      schemaVersion:1,digestRequestId:"digest-request-1" as never,
      canonRequestId:"canon-request-1" as never,workId:"work-1" as never,
      conversationId:"conversation-1" as never,sceneId:"scene-1" as never,
      sourceRange:{documentId:"document-1" as never,documentRevisionId:"revision-1" as never,from:0,to:1},
      trigger:"scene-transition",
    })).resolves.toEqual({schemaVersion:1,status:"disabled"});
    await expect(bridge.listSceneAnalysisRuns({
      schemaVersion:1,workId:"work-1" as never,
    })).resolves.toEqual({schemaVersion:1,workId:"work-1",runs:[]});
    expect(Object.keys(bridge).sort()).toEqual([
      "generate","generateScene","list","listSceneAnalysisRuns","regenerate","runSceneAnalysis",
    ]);
    expect(invoke).toHaveBeenCalledWith(NARRATIVE_DIGEST_LIST_CHANNEL,expect.objectContaining({ workId: "work-1" }));
    expect(invoke).toHaveBeenCalledWith(NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,expect.objectContaining({sceneId:"scene-1"}));
  });
});
