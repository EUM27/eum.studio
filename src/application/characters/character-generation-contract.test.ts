import { describe, expect, it } from "vitest";

import {
  parseCharacterGenerationCandidate,
  parseCharacterGenerationModelPayload,
  parseDecideCharacterGenerationItemCommand,
  parseRunCharacterGenerationCommand,
} from "./character-generation-contract";

describe("character generation contract", () => {
  it("keeps a free-text brief separate from a review Candidate", () => {
    expect(parseRunCharacterGenerationCommand({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      brief: {
        role: "탐정",
        personality: "집요함",
        relationships: "기록자와 협력",
        genre: "미스터리",
      },
    })).toMatchObject({
      workId: "work-a",
      brief: { role: "탐정", genre: "미스터리" },
    });

    expect(parseCharacterGenerationModelPayload({
      characters: [{
        name: "도윤",
        aliases: [],
        role: "탐정",
        summary: "사건을 추적한다.",
        appearance: "",
        personality: "집요함",
        speech: "",
        goal: "진상 규명",
        conflict: "",
        note: "기록자와 협력하는 관계 초안",
      }],
    }).characters[0]).toMatchObject({ name: "도윤", role: "탐정" });

    expect(parseCharacterGenerationCandidate({
      schemaVersion: 1,
      candidateId: "candidate-a",
      revision: 1,
      workId: "work-a",
      brief: {
        role: "탐정",
        personality: "집요함",
        relationships: "기록자와 협력",
        genre: "미스터리",
      },
      providerId: "provider-a",
      modelId: "model-a",
      promptVersion: "character-generation-v1",
      status: "ready",
      items: [{
        itemId: "item-a",
        name: "도윤",
        aliases: [],
        role: "탐정",
        summary: "사건을 추적한다.",
        appearance: "",
        personality: "집요함",
        speech: "",
        goal: "진상 규명",
        conflict: "",
        note: "기록자와 협력하는 관계 초안",
        matchingCharacterIds: [],
        status: "pending",
        approvedCharacterId: null,
      }],
      createdAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:00.000Z",
    }).items[0]).toMatchObject({
      name: "도윤",
      status: "pending",
      approvedCharacterId: null,
    });
  });

  it("requires an explicit create, merge-field, or exclude decision", () => {
    expect(parseDecideCharacterGenerationItemCommand({
      schemaVersion: 1,
      workId: "work-a",
      candidateId: "candidate-a",
      expectedCandidateRevision: 1,
      itemId: "item-a",
      decision: {
        kind: "merge",
        targetCharacterId: "character-a",
        expectedCharacterRevision: 2,
        fields: ["role", "personality"],
      },
    }).decision).toEqual({
      kind: "merge",
      targetCharacterId: "character-a",
      expectedCharacterRevision: 2,
      fields: ["role", "personality"],
    });
  });
});
