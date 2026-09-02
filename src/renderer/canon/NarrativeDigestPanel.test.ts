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
});
