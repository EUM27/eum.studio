import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingSettlementCommand,
  parseListPublishingSettlementsCommand,
  parsePublishingSettlementListProjection,
  parseUpdatePublishingSettlementCommand,
} from "./publishing-settlement-contract";

describe("publishing settlement contract", () => {
  it("parses a Work-owned settlement linked to one publication", () => {
    const create = {
      schemaVersion: 1,
      workId: "work-a",
      publicationId: "publication-a",
      title: "9월 정산서",
      periodStartsOn: "2026-09-01",
      periodEndsOn: "2026-09-30",
      issuedOn: "2026-10-10",
      reviewStatus: "검토 중",
      currencyCode: "KRW",
      reportedAmount: 1250000,
      items: [],
      note: "원문 파일 별도 보관",
    } as const;
    expect(parseCreatePublishingSettlementCommand(create)).toEqual(create);
    expect(parseListPublishingSettlementsCommand({ schemaVersion: 1, workId: null }))
      .toEqual({ schemaVersion: 1, workId: null });
    expect(parseUpdatePublishingSettlementCommand({
      schemaVersion: 1,
      settlementId: "settlement-a",
      expectedRevision: 1,
      changes: {
        reviewStatus: "확인 완료",
        reportedAmount: 1240000,
        items: [{
          settlementLineItemId: null,
          label: "플랫폼 수수료 조정",
          amount: -10000,
          note: "명세서 반영",
        }],
      },
    })).toMatchObject({
      settlementId: "settlement-a",
      changes: { reviewStatus: "확인 완료", reportedAmount: 1240000 },
    });

    const projection = parsePublishingSettlementListProjection({
      schemaVersion: 1,
      settlements: [{
        ...create,
        settlementId: "settlement-a",
        revision: 2,
        workTitleSnapshot: "별빛 아래",
        publicationTitleSnapshot: "주 2회 연재",
        items: [{
          settlementLineItemId: "item-a",
          label: "플랫폼 수수료 조정",
          amount: -10000,
          note: "명세서 반영",
        }],
        sourceIds: [],
        createdAt: "2026-10-10T00:00:00.000Z",
        updatedAt: "2026-10-11T00:00:00.000Z",
      }],
    });
    expect(projection.settlements[0]).toMatchObject({
      settlementId: "settlement-a",
      publicationId: "publication-a",
      publicationTitleSnapshot: "주 2회 연재",
      reportedAmount: 1250000,
      items: [{ settlementLineItemId: "item-a", amount: -10000 }],
    });
  });
});
