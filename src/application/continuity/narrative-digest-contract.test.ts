import { describe, expect, it } from "vitest";

import {
  parseGenerateNarrativeDigestCommand,
  parseGenerateSceneNarrativeDigestCommand,
  parseListNarrativeDigestsCommand,
  parseNarrativeDigestListProjection,
  parseNarrativeDigestProjection,
  parseRegenerateNarrativeDigestCommand,
} from "./narrative-digest-contract";

const sourceManifest = {
  schemaVersion: 1,
  scope: { kind: "document", documentId: "document-1" },
  promptVersion: "eum-narrative-digest-v1",
  documents: [{ documentId: "document-1", documentRevisionId: "revision-1" }],
  eventBlocks: [], characters: [], characterRelations: [], loreEntries: [],
  continuityThreads: [], characterKnowledge: [],
};

describe("NarrativeDigest contracts", () => {
  it("requires explicit selected documents for generation and regeneration", () => {
    expect(parseGenerateNarrativeDigestCommand({
      schemaVersion: 1,
      requestId: "request-1",
      workId: "work-1",
      conversationId: "conversation-1",
      scope: { kind: "work" },
      documentIds: ["document-2", "document-1"],
    }).documentIds).toEqual(["document-1", "document-2"]);
    expect(parseRegenerateNarrativeDigestCommand({
      schemaVersion: 1,
      requestId: "request-2",
      workId: "work-1",
      conversationId: "conversation-1",
      digestId: "digest-1",
    })).toMatchObject({ digestId: "digest-1" });
    expect(() => parseGenerateNarrativeDigestCommand({
      schemaVersion: 1, requestId: "r", workId: "w", conversationId: "c",
      scope: { kind: "work" }, documentIds: [],
    })).toThrow(/documentIds/u);
    expect(() => parseGenerateNarrativeDigestCommand({
      schemaVersion:1,requestId:"r",workId:"w",conversationId:"c",
      scope:{kind:"scene",sceneId:"scene-1"},documentIds:["document-1"],
    })).toThrow(/exact Scene command/u);
  });

  it("parses immutable current/stale projections while preserving generated text", () => {
    const projection = parseNarrativeDigestProjection({
      schemaVersion: 1,
      digestId: "digest-1",
      workId: "work-1",
      scope: { kind: "document", documentId: "document-1" },
      sceneSource: null,
      sourceManifest,
      sourceManifestHash: "sha256:hash",
      text: "윤서는 북문을 조사했다.",
      providerId: "provider-1",
      modelId: "model-1",
      promptVersion: "eum-narrative-digest-v1",
      integrity: "stale",
      contextReceiptId: "receipt-1",
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    expect(projection).toMatchObject({ integrity: "stale", text: "윤서는 북문을 조사했다." });
    expect(parseNarrativeDigestListProjection({
      schemaVersion: 1,
      workId: "work-1",
      digests: [projection],
    }).digests).toHaveLength(1);
    expect(parseListNarrativeDigestsCommand({ schemaVersion: 1, workId: "work-1" }))
      .toMatchObject({ workId: "work-1" });
  });

  it("rejects source/prompt disagreement and foreign Work list entries", () => {
    expect(() => parseNarrativeDigestProjection({
      schemaVersion: 1, digestId: "d", workId: "w",
      scope: { kind: "document", documentId: "document-1" },
      sceneSource: null,
      sourceManifest, sourceManifestHash: "h", text: "t", providerId: "p",
      modelId: "m", promptVersion: "different", integrity: "current",
      contextReceiptId: "r", createdAt: "2026-08-29T00:00:00.000Z",
    })).toThrow(/promptVersion/u);
    expect(() => parseNarrativeDigestListProjection({
      schemaVersion: 1,
      workId: "other-work",
      digests: [{
        schemaVersion: 1,
        digestId: "digest-1",
        workId: "work-1",
        scope: { kind: "document", documentId: "document-1" },
        sceneSource: null,
        sourceManifest,
        sourceManifestHash: "hash",
        text: "요약",
        providerId: "provider",
        modelId: "model",
        promptVersion: "eum-narrative-digest-v1",
        integrity: "current",
        contextReceiptId: "receipt",
        createdAt: "2026-08-29T00:00:00.000Z",
      }],
    })).toThrow(/Work/u);
  });

  it("requires one exact range for a stable Scene digest", () => {
    expect(parseGenerateSceneNarrativeDigestCommand({
      schemaVersion: 1,
      requestId: "scene-request-1",
      workId: "work-1",
      conversationId: "conversation-1",
      sceneId: "scene-1",
      sourceRange: {
        documentId: "document-1",
        documentRevisionId: "revision-1",
        from: 3,
        to: 11,
      },
      trigger: "scene-transition",
    })).toMatchObject({
      sceneId: "scene-1",
      sourceRange: { from: 3, to: 11 },
    });
    expect(() => parseGenerateSceneNarrativeDigestCommand({
      schemaVersion: 1,
      requestId: "scene-request-2",
      workId: "work-1",
      conversationId: "conversation-1",
      sceneId: "scene-1",
      sourceRange: {
        documentId: "document-1",
        documentRevisionId: "revision-1",
        from: 3,
        to: 3,
      },
      trigger: "scene-transition",
    })).toThrow(/range/u);
  });
});
