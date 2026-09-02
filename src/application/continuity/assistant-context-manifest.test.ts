import { describe, expect, it } from "vitest";

import {
  parseAssistantContextActivityList,
  parseAssistantContextManifestProjection,
  parseAssistantContextPlanProjection,
} from "./assistant-context-manifest";

describe("Assistant context manifest contracts", () => {
  it("parses receipt-linked entity/digest entries, exclusions, and safe activity", () => {
    const manifest = parseAssistantContextManifestProjection({
      schemaVersion: 1,
      manifestId: "manifest-1",
      receiptId: "receipt-1",
      workId: "work-1",
      entries: [
        { kind: "entity", entity: { kind: "character", id: "character-1" }, entityRevision: 3, inclusionReason: "pov-knowledge" },
        { kind: "digest", digestId: "digest-1", sourceManifestHash: "hash-1", inclusionReason: "derived-digest" },
      ],
      excluded: [{ kind: "entity", entity: { kind: "lore-entry", id: "lore-1" }, entityRevision: 2, reason: "withheld-policy" }],
      estimatedTokenCount: 42,
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    expect(manifest.entries).toHaveLength(2);
    expect(manifest.excluded[0]).toMatchObject({ reason: "withheld-policy" });
    expect(parseAssistantContextActivityList({
      schemaVersion: 1,
      workId: "work-1",
      activities: [{
        schemaVersion: 1,
        activityId: "activity-1",
        workId: "work-1",
        receiptId: "receipt-1",
        manifestId: "manifest-1",
        capability: "canon.review",
        destinationId: "provider-1",
        providerId: "provider-1",
        modelId: "model-1",
        startedAt: "2026-08-29T00:00:00.000Z",
        completedAt: "2026-08-29T00:00:01.000Z",
        stageDurationsMs: { plan: 3, authorize: 2, connector: 10, persist: 1 },
        readRanges: [],
        transmittedRanges: [],
        readCharacterCount: 12,
        transmittedCharacterCount: 8,
        candidateCount: 1,
      }],
    }).activities[0]).toMatchObject({ modelId: "model-1", candidateCount: 1 });
  });

  it("parses planned and required-over-budget projections without hidden score fields", () => {
    expect(parseAssistantContextPlanProjection({
      schemaVersion: 1,
      status: "required-context-over-budget",
      workId: "work-1",
      capability: "canon.review",
      tokenBudget: 10,
      requiredTokenCount: 12,
      requiredEntries: [{ kind: "entity", entity: { kind: "character", id: "character-1" }, entityRevision: 1, inclusionReason: "required-policy" }],
      excluded: [],
    })).toMatchObject({ status: "required-context-over-budget", requiredTokenCount: 12 });
    expect(() => parseAssistantContextPlanProjection({
      schemaVersion: 1,
      status: "planned",
      workId: "work-1",
      capability: "canon.review",
      tokenBudget: 10,
      estimatedTokenCount: 1,
      entries: [],
      excluded: [],
      score: 100,
    })).toThrow(/fields/u);
  });

  it("rejects sensitive activity payload fields", () => {
    expect(() => parseAssistantContextActivityList({
      schemaVersion: 1,
      workId: "work-1",
      activities: [{ prompt: "원고 전체" }],
    })).toThrow();
  });
});
