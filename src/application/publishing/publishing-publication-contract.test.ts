import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingPublicationCommand,
  parseListPublishingPublicationsCommand,
  parsePublishingPublicationListProjection,
  parseUpdatePublishingPublicationCommand,
} from "./publishing-publication-contract";

describe("publishing publication contract", () => {
  it("parses a Work-owned publication with optional contract and channel links", () => {
    const create = {
      schemaVersion: 1,
      workId: "work-a",
      contractId: "contract-a",
      channelPartnerId: "partner-channel",
      title: "주 2회 연재",
      status: "연재 중",
      format: "웹 연재",
      scheduledOn: "2026-09-01",
      startsOn: "2026-09-03",
      endsOn: null,
      publishedUnitCount: 12,
      plannedUnitCount: 40,
      scheduleNote: "화·금 공개",
      note: "채널 공지 확인",
    } as const;
    expect(parseCreatePublishingPublicationCommand(create)).toEqual(create);
    expect(parseListPublishingPublicationsCommand({ schemaVersion: 1, workId: null }))
      .toEqual({ schemaVersion: 1, workId: null });
    expect(parseUpdatePublishingPublicationCommand({
      schemaVersion: 1,
      publicationId: "publication-a",
      expectedRevision: 1,
      changes: {
        status: "휴재",
        publishedUnitCount: 13,
        plannedUnitCount: null,
        scheduleNote: "복귀일 미정",
      },
    })).toEqual({
      schemaVersion: 1,
      publicationId: "publication-a",
      expectedRevision: 1,
      changes: {
        status: "휴재",
        publishedUnitCount: 13,
        plannedUnitCount: null,
        scheduleNote: "복귀일 미정",
      },
    });

    const projection = parsePublishingPublicationListProjection({
      schemaVersion: 1,
      publications: [{
        ...create,
        publicationId: "publication-a",
        revision: 2,
        workTitleSnapshot: "별빛 아래",
        channelNameSnapshot: "별빛 연재관",
        sourceIds: [],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-10T00:00:00.000Z",
      }],
    });
    expect(projection.publications[0]).toMatchObject({
      publicationId: "publication-a",
      contractId: "contract-a",
      channelPartnerId: "partner-channel",
      publishedUnitCount: 12,
      plannedUnitCount: 40,
      scheduleNote: "화·금 공개",
    });
  });
});
