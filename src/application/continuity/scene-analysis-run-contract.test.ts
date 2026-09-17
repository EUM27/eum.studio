import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseListSceneAnalysisRunsCommand,
  parseRunAutomaticSceneAnalysisCommand,
  parseSceneAnalysisRunProjection,
} from "./scene-analysis-run-contract";

describe("automatic Scene analysis run contract", () => {
  it("parses exact stable Scene inputs and retryable stage state", () => {
    expect(parseRunAutomaticSceneAnalysisCommand({
      schemaVersion: 1,
      digestRequestId: "digest-request-1",
      canonRequestId: "canon-request-1",
      continuityRequestId: "continuity-request-1",
      workId: "work-1",
      conversationId: "conversation-1",
      sceneId: "scene-1",
      sourceRange: {
        documentId: "document-1",
        documentRevisionId: "revision-1",
        from: 2,
        to: 8,
      },
      trigger: "episode-transition",
    })).toEqual({
      schemaVersion: 1,
      digestRequestId: entityId<"NarrativeDigestRequest">("digest-request-1"),
      canonRequestId: entityId<"CanonReviewRequest">("canon-request-1"),
      continuityRequestId: entityId<"ContinuityReviewRequest">("continuity-request-1"),
      workId: entityId<"Work">("work-1"),
      conversationId: entityId<"AssistantConversation">("conversation-1"),
      sceneId: entityId<"Scene">("scene-1"),
      sourceRange: {
        documentId: entityId<"Document">("document-1"),
        documentRevisionId: entityId<"DocumentRevision">("revision-1"),
        from: 2,
        to: 8,
      },
      trigger: "episode-transition",
    });
    expect(parseListSceneAnalysisRunsCommand({
      schemaVersion: 1,
      workId: "work-1",
    })).toEqual({ schemaVersion: 1, workId: entityId<"Work">("work-1") });
  });

  it("requires a Candidate only for a completed Candidate stage and an error only for failure", () => {
    const base = {
      schemaVersion: 1,
      runId: "run-1",
      revision: 2,
      workId: "work-1",
      sceneId: "scene-1",
      digestId: "digest-1",
      sourceFingerprint: "fingerprint-1",
      trigger: "scene-transition",
      attemptCount: 1,
      informationUpdate: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:01:00.000Z",
    };
    expect(parseSceneAnalysisRunProjection({
      ...base,
      loreStatus: "candidate",
      canonCandidateId: "candidate-1",
      lastError: null,
    })).toMatchObject({ loreStatus: "candidate", canonCandidateId: "candidate-1" });
    expect(parseSceneAnalysisRunProjection({
      ...base,
      loreStatus: "failed",
      canonCandidateId: null,
      lastError: "temporary failure",
    })).toMatchObject({ loreStatus: "failed", lastError: "temporary failure" });
    expect(() => parseSceneAnalysisRunProjection({
      ...base,
      loreStatus: "candidate",
      canonCandidateId: null,
      lastError: null,
    })).toThrow(/canonCandidateId/u);
    expect(() => parseSceneAnalysisRunProjection({
      ...base,
      loreStatus: "no-change",
      canonCandidateId: null,
      lastError: "unexpected",
    })).toThrow(/lastError/u);
  });
});
