import { describe,expect,it } from "vitest";
import { entityId } from "../../domain/writing";
import { deriveSceneLineageReferenceReviews,parseSceneCanonContextListProjection } from "./scene-canon-context";

describe("scene canon context",()=>{
  it("marks split and broadening merge references for review without inventing inheritance",()=>{
    const left=entityId<"Scene">("scene-left"),right=entityId<"Scene">("scene-right"),merged=entityId<"Scene">("scene-merged");
    const reviews=deriveSceneLineageReferenceReviews([
      {lineageOperationId:entityId("op-split"),operation:"split",parentSceneIds:[left],childSceneIds:[left,right]},
      {lineageOperationId:entityId("op-merge"),operation:"merge",parentSceneIds:[left,right],childSceneIds:[merged]},
    ],[{referenceKind:"continuity-thread",referenceId:"thread-1",sceneId:left},{referenceKind:"character-knowledge",referenceId:"knowledge-1",sceneId:right}]);
    expect(reviews).toHaveLength(3);expect(reviews.every((review)=>review.status==="needs-review")).toBe(true);
    expect(reviews.find((review)=>review.lineageOperationId==="op-split")?.candidateSceneIds).toEqual([left,right]);
  });
  it("parses scene-linked Continuity and Knowledge without canonical mutation fields",()=>{
    expect(parseSceneCanonContextListProjection({schemaVersion:1,workId:"work-1",contexts:[{schemaVersion:1,workId:"work-1",sceneId:"scene-1",continuity:[{threadId:"thread-1",revision:1,title:"약속",status:"open"}],knowledge:[{knowledgeId:"knowledge-1",revision:1,characterId:"character-1",statement:"문이 잠겼다",stance:"knows",truthStatus:"true",status:"active"}],lineageReviews:[]}]})).toMatchObject({contexts:[{continuity:[{title:"약속"}],knowledge:[{statement:"문이 잠겼다"}]}]});
  });
});
