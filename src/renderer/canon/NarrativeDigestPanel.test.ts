import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";

import { entityId } from "../../domain/writing";
import { NarrativeDigestPanel } from "./NarrativeDigestPanel";

describe("NarrativeDigestPanel", () => {
  it("renders explicit scope/document choices and preserves stale text as regenerable history", () => {
    const workId=entityId<"Work">("work-1");
    const scope={ kind:"character" as const,characterId:entityId<"Character">("character-1") };
    const controller={
      digests:[{
        schemaVersion:1,digestId:entityId<"NarrativeDigest">("digest-1"),workId,scope,
        sceneSource:null,
        sourceManifest:{ schemaVersion:1,scope,promptVersion:"eum-narrative-digest-v1",documents:[{documentId:entityId<"Document">("document-1"),documentRevisionId:entityId<"DocumentRevision">("revision-1")}],eventBlocks:[],characters:[{entityId:"character-1",revision:2}],characterRelations:[],loreEntries:[],continuityThreads:[],characterKnowledge:[] },
        sourceManifestHash:"hash-1",text:"윤서는 북문에서 열쇠를 찾았다.",providerId:"provider-1",modelId:"model-1",promptVersion:"eum-narrative-digest-v1",integrity:"stale",contextReceiptId:entityId<"AssistantContextReceipt">("receipt-1"),createdAt:"2026-08-29T00:00:00.000Z",
      }],
      sceneAnalysisRuns:[],
      actionState:"idle",error:null,message:null,permissionRequired:false,
      refresh:vi.fn(),generate:vi.fn(),regenerate:vi.fn(),grantPermissionAndRetry:vi.fn(),
    };
    const markup=renderToStaticMarkup(createElement(NarrativeDigestPanel,{
      characters:[{ characterId:"character-1",name:"윤서",retiredAt:null } as never],
      controller:controller as never,
      documents:[{ documentId:entityId<"Document">("document-1"),label:"1화" },{ documentId:entityId<"Document">("document-2"),label:"2화" }],
    }));
    expect(markup).toContain("작품 전체");
    expect(markup).toContain("회차별");
    expect(markup).toContain("인물별");
    expect(markup).toContain("관계별");
    expect(markup).toContain("1화");
    expect(markup).toContain("2화");
    expect(markup).toContain("원본 변경 후 다시 생성 필요");
    expect(markup).toContain("윤서는 북문에서 열쇠를 찾았다.");
    expect(markup).toContain("현재 원본으로 다시 생성");
    expect(markup).not.toContain("WorkQuickMemo");
  });

  it("distinguishes a completed integrated information update from the legacy lore-only status", () => {
    const workId=entityId<"Work">("work-1");
    const digestId=entityId<"NarrativeDigest">("digest-integrated");
    const documentId=entityId<"Document">("document-1");
    const documentRevisionId=entityId<"DocumentRevision">("revision-1");
    const sceneId=entityId<"Scene">("scene-1");
    const sceneSource={ sceneId,documentId,documentRevisionId,from:0,to:8,textHash:"text-hash",trigger:"scene-transition" as const };
    const controller={
      digests:[{
        schemaVersion:1,digestId,workId,scope:{ kind:"scene" as const,sceneId },
        sceneSource,sourceManifest:{ schemaVersion:1,scope:{ kind:"scene" as const,sceneId },promptVersion:"eum-narrative-digest-v1",documents:[{documentId,documentRevisionId}],eventBlocks:[],characters:[],characterRelations:[],loreEntries:[],continuityThreads:[],characterKnowledge:[] },
        sourceManifestHash:"source-hash",text:"장면 통합 요약",providerId:"provider-1",modelId:"model-1",promptVersion:"eum-narrative-digest-v1",integrity:"current",contextReceiptId:entityId<"AssistantContextReceipt">("receipt-1"),createdAt:"2026-09-04T00:00:00.000Z",
      }],
      sceneAnalysisRuns:[{
        schemaVersion:1,runId:entityId<"SceneAnalysisRun">("run-1"),revision:2,workId,sceneId,digestId,sourceFingerprint:"source-hash",trigger:"scene-transition",loreStatus:"candidate",canonCandidateId:entityId<"CanonReviewCandidate">("canon-1"),attemptCount:1,lastError:null,createdAt:"2026-09-04T00:00:00.000Z",updatedAt:"2026-09-04T00:00:01.000Z",
        informationUpdate:{ schemaVersion:1,batchId:entityId<"SceneInformationUpdateBatch">("batch-1"),revision:1,packetHash:"packet-1",previousPacketHash:null,providerId:"provider-1",modelId:"model-1",promptVersion:"eum-scene-information-update-v1",canonCandidateId:entityId<"CanonReviewCandidate">("canon-1"),continuityCandidateId:entityId<"ContinuityReviewCandidate">("continuity-1"),status:"complete",lastError:null,reviewedEntities:[{ entity:{ kind:"character" as const,id:entityId<"Character">("character-1") },outcome:"changed" as const,reason:"관계 변화" },{ entity:{ kind:"lore-entry" as const,id:entityId<"LoreEntry">("lore-1") },outcome:"unchanged" as const,reason:"변화 없음" }],createdAt:"2026-09-04T00:00:01.000Z",updatedAt:"2026-09-04T00:00:01.000Z" },
      }],
      actionState:"idle",error:null,message:null,permissionRequired:false,
      refresh:vi.fn(),generate:vi.fn(),regenerate:vi.fn(),grantPermissionAndRetry:vi.fn(),
    };
    const markup=renderToStaticMarkup(createElement(NarrativeDigestPanel,{
      characters:[],controller:controller as never,
      documents:[{ documentId,label:"1화" }],
    }));

    expect(markup).toContain("통합 정보 갱신 완료");
    expect(markup).toContain("검토 2건(변화 1건)");
    expect(markup).toContain("작품 정보 후보 있음");
    expect(markup).toContain("연속성 후보 있음");
    expect(markup).not.toContain("별빛 후보 저장");
  });
});
