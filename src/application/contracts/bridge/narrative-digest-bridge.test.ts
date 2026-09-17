import { describe,expect,it,vi } from "vitest";

import {
  NARRATIVE_DIGEST_GENERATE_CHANNEL,
  NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,
  NARRATIVE_DIGEST_LIST_CHANNEL,
  NARRATIVE_DIGEST_REGENERATE_CHANNEL,
  createNarrativeDigestBridge,
} from "./narrative-digest-bridge";

const manifest = {
  schemaVersion: 1 as const,scope: { kind: "work" as const },promptVersion: "eum-narrative-digest-v1",
  documents: [{ documentId: "document-1" as never,documentRevisionId: "revision-1" as never }],
  eventBlocks: [],characters: [],characterRelations: [],loreEntries: [],continuityThreads: [],characterKnowledge: [],
};

describe("NarrativeDigest bridge", () => {
  it("validates commands and results for generate, list, and regenerate", async () => {
    const digest = {
      schemaVersion: 1 as const,digestId: "digest-1",workId: "work-1",scope: { kind: "work" },
      sceneSource: null,
      sourceManifest: manifest,sourceManifestHash: "hash",text: "요약",providerId: "provider",modelId: "model",
      promptVersion: "eum-narrative-digest-v1",integrity: "current",contextReceiptId: "receipt-1",createdAt: "2026-08-29T00:00:00.000Z",
    };
    const invoke = vi.fn(async (channel: string) => channel === NARRATIVE_DIGEST_LIST_CHANNEL
      ? { schemaVersion: 1,workId: "work-1",digests: [digest] }
      : { schemaVersion: 1,status: "generated",digest });
    const bridge = createNarrativeDigestBridge(invoke);
    await expect(bridge.generate({ schemaVersion: 1,requestId: "request-1" as never,workId: "work-1" as never,conversationId: "conversation-1" as never,scope: { kind: "work" },documentIds: ["document-1" as never] })).resolves.toMatchObject({ status: "generated" });
    await expect(bridge.generateScene({
      schemaVersion:1,requestId:"scene-request" as never,workId:"work-1" as never,
      conversationId:"conversation-1" as never,sceneId:"scene-1" as never,
      sourceRange:{documentId:"document-1" as never,documentRevisionId:"revision-1" as never,from:0,to:2},
      trigger:"scene-transition",
    })).resolves.toMatchObject({status:"generated"});
    await expect(bridge.list({ schemaVersion: 1,workId: "work-1" as never })).resolves.toMatchObject({ digests: [{ text: "요약" }] });
    await expect(bridge.regenerate({ schemaVersion: 1,requestId: "request-2" as never,workId: "work-1" as never,conversationId: "conversation-1" as never,digestId: "digest-1" as never })).resolves.toMatchObject({ status: "generated" });
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      NARRATIVE_DIGEST_GENERATE_CHANNEL,NARRATIVE_DIGEST_GENERATE_SCENE_CHANNEL,NARRATIVE_DIGEST_LIST_CHANNEL,NARRATIVE_DIGEST_REGENERATE_CHANNEL,
    ]);
  });
});
