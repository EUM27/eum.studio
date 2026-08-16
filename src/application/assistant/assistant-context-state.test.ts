import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseAssistantContextStateProjection,
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
} from "./assistant-context-state";

describe("assistant context state", () => {
  it("parses caller-owned Work and conversation commands without provider fields", () => {
    const workId = randomUUID();
    const conversationId = randomUUID();
    const destinationId = `destination:${randomUUID()}`;
    expect(parseListAssistantContextStateCommand({
      schemaVersion: 1,
      workId,
      conversationId,
    })).toEqual({ schemaVersion: 1, workId, conversationId });
    expect(parseGrantAssistantContextPermissionCommand({
      schemaVersion: 1,
      workId,
      conversationId,
      capability: "vocabulary-lookup",
      destinationId,
      localScope: "selection",
      externalScope: "selection",
      duration: "conversation",
    })).toMatchObject({ workId, conversationId, destinationId });
    expect(parseRevokeAssistantContextPermissionCommand({
      schemaVersion: 1,
      workId,
      grantId: randomUUID(),
      expectedRevision: 3,
    })).toMatchObject({ workId, expectedRevision: 3 });
  });

  it("keeps Work grants and exact-conversation grants in one strict projection", () => {
    const workId = randomUUID();
    const conversationId = randomUUID();
    const destinationId = `destination:${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const projection = {
      schemaVersion: 1,
      workId,
      conversationId,
      grants: [
        {
          schemaVersion: 1,
          grantId: randomUUID(),
          revision: 1,
          workId,
          conversationId: null,
          capability: "lore-review",
          destinationId,
          localScope: "work",
          externalScope: "work",
          duration: "work",
          createdAt,
          revokedAt: null,
          consumedAt: null,
        },
        {
          schemaVersion: 1,
          grantId: randomUUID(),
          revision: 1,
          workId,
          conversationId,
          capability: "vocabulary-lookup",
          destinationId,
          localScope: "selection",
          externalScope: "selection",
          duration: "once",
          createdAt,
          revokedAt: null,
          consumedAt: null,
        },
      ],
      receipts: [],
      candidates: [],
      notationCandidates: [],
      vocabularySuggestionCandidates: [],
      settingReviewReceipts: [],
      settingReviewFindings: [],
      settingConflictFindings: [],
      externalSettingReviewReceipts: [],
      externalSettingReviewCandidates: [],
    } as const;

    expect(parseAssistantContextStateProjection(projection)).toEqual(projection);
    expect(() => parseAssistantContextStateProjection({
      ...projection,
      grants: [{ ...projection.grants[1], conversationId: randomUUID() }],
    })).toThrow(/outside requested context/u);
  });

  it("requires Work duration to be Work-owned and session durations to name a conversation", () => {
    const command = {
      schemaVersion: 1,
      workId: randomUUID(),
      conversationId: randomUUID(),
      capability: "vocabulary-lookup",
      destinationId: `destination:${randomUUID()}`,
      localScope: "selection",
      externalScope: "selection",
      duration: "work",
    } as const;
    expect(() => parseGrantAssistantContextPermissionCommand(command)).toThrow(
      /conversationId/u,
    );
    expect(parseGrantAssistantContextPermissionCommand({
      ...command,
      conversationId: null,
    })).toMatchObject({ duration: "work", conversationId: null });
  });
});
