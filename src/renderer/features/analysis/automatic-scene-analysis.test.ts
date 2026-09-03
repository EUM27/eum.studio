import { describe,expect,it,vi } from "vitest";

import type { SceneProjection,SceneProjectionList } from "../../../application/structure/scene-projection";
import { entityId } from "../../../domain/writing";
import {
  resolveSceneAtPosition,
  executeAutomaticSceneAnalysis,
  deriveAutomaticSceneTransition,
  sceneAnalysisOccurrenceKey,
  selectSplitSceneResults,
} from "./automatic-scene-analysis";

const projection = {
  schemaVersion: 1,
  workId: entityId<"Work">("work-1"),
  status: "clean",
  ruleSet: {
    schemaVersion: 1,
    sceneRuleSetId: entityId<"SceneRuleSet">("rules-1"),
    revision: 1,
    workId: entityId<"Work">("work-1"),
    displayName: "규칙",
    boundaryRules: [],
    normalizationPolicy: "preserve",
    enabled: true,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  scenes: [
    {
      schemaVersion: 1,
      sceneKey: "scene-key-a",
      workId: entityId<"Work">("work-1"),
      documentId: entityId<"Document">("document-1"),
      documentRevisionId: entityId<"DocumentRevision">("revision-1"),
      documentTitle: "1화",
      documentIndex: 0,
      sceneIndex: 0,
      startAnchorId: entityId<"Anchor">("anchor-a"),
      endAnchorId: entityId<"Anchor">("anchor-b"),
      range: { start: 0,end: 5 },
      integrity: "resolved",
      source: "override",
      events: [],excludedEvents: [],
      sceneIdentity: { sceneId: entityId<"Scene">("scene-a"),segments: [] },
    },
    {
      schemaVersion: 1,
      sceneKey: "scene-key-b",
      workId: entityId<"Work">("work-1"),
      documentId: entityId<"Document">("document-1"),
      documentRevisionId: entityId<"DocumentRevision">("revision-1"),
      documentTitle: "1화",
      documentIndex: 0,
      sceneIndex: 1,
      startAnchorId: entityId<"Anchor">("anchor-b"),
      endAnchorId: null,
      range: { start: 5,end: 10 },
      integrity: "resolved",
      source: "override",
      events: [],excludedEvents: [],
      sceneIdentity: { sceneId: entityId<"Scene">("scene-b"),segments: [] },
    },
  ],
  unassignedEvents: [],sceneEventOverrides: [],
} satisfies SceneProjectionList;

describe("automatic Scene analysis selection",()=>{
  it("resolves exact cursor transitions by stable Scene occurrence",()=>{
    const document={workId:entityId<"Work">("work-1"),documentId:entityId<"Document">("document-1")};
    const first=resolveSceneAtPosition(projection,document,4);
    const second=resolveSceneAtPosition(projection,document,5);
    expect(sceneAnalysisOccurrenceKey(first!)).toBe("scene-a:document-1:scene-key-a");
    expect(sceneAnalysisOccurrenceKey(second!)).toBe("scene-b:document-1:scene-key-b");
    expect(deriveAutomaticSceneTransition(first,document,second))
      .toMatchObject({scene:first,trigger:"scene-transition"});
    expect(deriveAutomaticSceneTransition(first,{
      documentId:entityId<"Document">("document-2"),
    },null)).toMatchObject({scene:first,trigger:"episode-transition"});
  });

  it("selects both exact child Scenes after a split boundary",()=>{
    expect(selectSplitSceneResults(projection,entityId<"Document">("document-1"),5)
      .map((scene)=>scene.sceneIdentity?.sceneId)).toEqual(["scene-a","scene-b"]);
    const pending={
      ...projection,
      scenes:projection.scenes.map((scene)=>Object.fromEntries(
        Object.entries(scene).filter(([field])=>field!=="sceneIdentity"),
      ) as unknown as SceneProjection),
    } satisfies SceneProjectionList;
    expect(selectSplitSceneResults(pending,entityId<"Document">("document-1"),5))
      .toHaveLength(2);
    expect(sceneAnalysisOccurrenceKey(pending.scenes[0]!)).toContain("pending:");
  });

  it("runs only when enabled and connected, then stores the Scene digest before a Lore-only review",async()=>{
    const requestedScene=projection.scenes[0]!;
    const document={
      workId:entityId<"Work">("work-1"),
      documentId:entityId<"Document">("document-1"),
    } as never;
    const getChatGptOAuthStatus=vi.fn(async()=>({connected:true} as never));
    const persistDocument=vi.fn(async()=>undefined);
    const refreshSceneProjection=vi.fn(async()=>projection);
    const finalizeSceneCanonCheck=vi.fn(async()=>({
      schemaVersion:1 as const,
      workId:entityId<"Work">("work-1"),
      sceneId:entityId<"Scene">("scene-a"),
      sceneKey:"scene-key-a",
      sourceRange:{
        documentId:entityId<"Document">("document-1"),
        documentRevisionId:entityId<"DocumentRevision">("revision-1"),
        from:0,to:5,
      },
    }));
    const runSceneAnalysis=vi.fn(async()=>({status:"completed"} as never));
    const refreshDigests=vi.fn(async()=>undefined);
    const refreshCanonCandidates=vi.fn(async()=>true);
    const refreshContinuityCandidates=vi.fn(async()=>true);
    const base={
      requestedScene,trigger:"scene-transition" as const,
      activeWorkId:entityId<"Work">("work-1"),
      assistantClient:{getChatGptOAuthStatus},
      conversationId:entityId<"AssistantConversation">("conversation-1"),
      digestClient:{runSceneAnalysis},documents:[document],persistDocument,
      refreshDigests,refreshCanonCandidates,refreshContinuityCandidates,
      refreshSceneProjection,
      structureClient:{finalizeSceneCanonCheck},
    };
    await expect(executeAutomaticSceneAnalysis({...base,enabled:false}))
      .resolves.toBe("skipped-disabled");
    expect(getChatGptOAuthStatus).not.toHaveBeenCalled();
    await expect(executeAutomaticSceneAnalysis({...base,enabled:true}))
      .resolves.toBe("completed");
    expect(persistDocument).toHaveBeenCalledWith(document);
    expect(runSceneAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      sceneId:"scene-a",trigger:"scene-transition",
      sourceRange:expect.objectContaining({from:0,to:5}),
    }));
    expect(refreshCanonCandidates).toHaveBeenCalledOnce();
    expect(refreshContinuityCandidates).toHaveBeenCalledOnce();
  });

  it("does not touch the manuscript or model while disconnected",async()=>{
    const persistDocument=vi.fn(async()=>undefined);
    const runSceneAnalysis=vi.fn();
    await expect(executeAutomaticSceneAnalysis({
      enabled:true,
      requestedScene:projection.scenes[0]!,
      trigger:"episode-transition",
      activeWorkId:entityId<"Work">("work-1"),
      assistantClient:{getChatGptOAuthStatus:vi.fn(async()=>({connected:false} as never))},
      conversationId:entityId<"AssistantConversation">("conversation-1"),
      digestClient:{runSceneAnalysis:runSceneAnalysis as never},
      documents:[],persistDocument,
      refreshDigests:vi.fn(),refreshCanonCandidates:vi.fn(),
      refreshContinuityCandidates:vi.fn(),refreshSceneProjection:vi.fn(),
      structureClient:{finalizeSceneCanonCheck:vi.fn()},
    })).resolves.toBe("skipped-disconnected");
    expect(persistDocument).not.toHaveBeenCalled();
    expect(runSceneAnalysis).not.toHaveBeenCalled();
  });
});
