import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  authorizeAssistantSettingReview,
  createAssistantSettingReviewReceipt,
  findExactDuplicateSettingGroups,
  findExactSettingConflictGroups,
  parseRunAssistantSettingReviewCommand,
} from "./assistant-setting-review";

describe("assistant setting review", () => {
  it("reviews exact duplicate labels inside one Work without transmitting values", () => {
    const workId = randomUUID();
    const conversationId = randomUUID();
    const destinationId = `destination:${randomUUID()}`;
    const command = parseRunAssistantSettingReviewCommand({
      schemaVersion: 1,
      requestId: randomUUID(),
      workId,
      conversationId,
      destinationId,
    });
    const createdAt = new Date().toISOString();
    const authorization = authorizeAssistantSettingReview({
      command,
      grants: [{
        schemaVersion: 1,
        grantId: randomUUID(),
        revision: 1,
        workId,
        conversationId,
        capability: "lore-review",
        destinationId,
        localScope: "work",
        externalScope: "none",
        duration: "conversation",
        createdAt,
        revokedAt: null,
        consumedAt: null,
      }],
      settings: [
        {
          kind: "character",
          entityId: randomUUID(),
          revision: 1,
          workId,
          label: "해린",
          fields: [
            { field: "role", value: "주인공" },
            { field: "summary", value: "" },
          ],
        },
        {
          kind: "character",
          entityId: randomUUID(),
          revision: 2,
          workId,
          label: "해린",
          fields: [
            { field: "role", value: "조연" },
            { field: "summary", value: "" },
          ],
        },
        {
          kind: "plot",
          entityId: randomUUID(),
          revision: 1,
          workId,
          label: "해린",
          fields: [{ field: "stage", value: "초반" }],
        },
        {
          kind: "foreshadow",
          entityId: randomUUID(),
          revision: 1,
          workId,
          label: "푸른 문",
          fields: [{ field: "note", value: "" }],
        },
      ],
    });

    expect(authorization.allowed).toBe(true);
    if (!authorization.allowed) return;

    const groups = findExactDuplicateSettingGroups(authorization.settings);
    expect(groups).toEqual([{
      settingKind: "character",
      label: "해린",
      references: expect.arrayContaining([
        expect.objectContaining({ kind: "character", revision: 1 }),
        expect.objectContaining({ kind: "character", revision: 2 }),
      ]),
    }]);
    expect(findExactSettingConflictGroups(authorization.settings)).toEqual([{
      settingKind: "character",
      label: "해린",
      field: "role",
      references: expect.arrayContaining([
        expect.objectContaining({ kind: "character", revision: 1 }),
        expect.objectContaining({ kind: "character", revision: 2 }),
      ]),
    }]);

    const receipt = createAssistantSettingReviewReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt,
    });
    expect(receipt.reviewedSettings).toHaveLength(4);
    expect(JSON.stringify(receipt)).not.toContain("해린");
    expect(receipt.transmittedSettingCount).toBe(0);
  });

  it("requires an available Work-local lore-review grant", () => {
    const workId = randomUUID();
    const command = parseRunAssistantSettingReviewCommand({
      schemaVersion: 1,
      requestId: randomUUID(),
      workId,
      conversationId: randomUUID(),
      destinationId: `destination:${randomUUID()}`,
    });

    expect(authorizeAssistantSettingReview({
      command,
      grants: [],
      settings: [],
    })).toEqual({
      allowed: false,
      reason: "permission-required",
      missing: ["local-read"],
    });
  });
});
