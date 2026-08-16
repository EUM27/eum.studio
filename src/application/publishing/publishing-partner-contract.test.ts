import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingPartnerCommand,
  parseListPublishingPartnersCommand,
  parsePublishingPartnerListProjection,
  parseUpdatePublishingPartnerCommand,
} from "./publishing-partner-contract";

describe("publishing partner contract", () => {
  it("parses a provider-neutral shared partner ledger create, update, and list flow", () => {
    expect(parseCreatePublishingPartnerCommand({
      schemaVersion: 1,
      name: "  별빛문고  ",
      parentPartnerId: null,
      submissionMethod: "온라인 폼",
      websiteUrl: "https://publisher.example/submission",
      email: "story@publisher.example",
      genres: ["판타지", "로맨스"],
      requiredLength: "시놉시스와 원고 3화",
      priority: "이번 달",
      note: "마감일을 다시 확인한다.",
    })).toEqual({
      schemaVersion: 1,
      name: "별빛문고",
      parentPartnerId: null,
      submissionMethod: "온라인 폼",
      websiteUrl: "https://publisher.example/submission",
      email: "story@publisher.example",
      genres: ["판타지", "로맨스"],
      requiredLength: "시놉시스와 원고 3화",
      priority: "이번 달",
      note: "마감일을 다시 확인한다.",
    });

    expect(parseUpdatePublishingPartnerCommand({
      schemaVersion: 1,
      partnerId: "partner-a",
      expectedRevision: 1,
      changes: {
        parentPartnerId: "publisher-group",
        email: "novel@publisher.example",
        genres: ["판타지"],
      },
    })).toEqual({
      schemaVersion: 1,
      partnerId: "partner-a",
      expectedRevision: 1,
      changes: {
        parentPartnerId: "publisher-group",
        email: "novel@publisher.example",
        genres: ["판타지"],
      },
    });

    expect(parseListPublishingPartnersCommand({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
    });

    expect(parsePublishingPartnerListProjection({
      schemaVersion: 1,
      partners: [{
        schemaVersion: 1,
        partnerId: "partner-a",
        revision: 2,
        name: "별빛문고",
        parentPartnerId: "publisher-group",
        submissionMethod: "온라인 폼",
        websiteUrl: "https://publisher.example/submission",
        email: "novel@publisher.example",
        genres: ["판타지"],
        requiredLength: "시놉시스와 원고 3화",
        priority: "이번 달",
        note: "마감일을 다시 확인한다.",
        sourceIds: ["source-a"],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T01:00:00.000Z",
      }],
    }).partners[0]).toMatchObject({
      partnerId: "partner-a",
      revision: 2,
      parentPartnerId: "publisher-group",
      sourceIds: ["source-a"],
    });
  });
});
