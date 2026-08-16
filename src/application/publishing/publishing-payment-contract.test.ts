import { describe, expect, it } from "vitest";

import {
  derivePublishingSettlementReceivable,
  parseCreatePublishingPaymentCommand,
  parseListPublishingPaymentsCommand,
  parsePublishingPaymentListProjection,
  parseUpdatePublishingPaymentCommand,
} from "./publishing-payment-contract";
import { parsePublishingSettlementProjection } from "./publishing-settlement-contract";

describe("publishing payment contract", () => {
  it("parses an optional settlement link and derives receivable by exact currency", () => {
    const create = {
      schemaVersion: 1,
      workId: "work-a",
      settlementId: "settlement-a",
      receivedOn: "2026-10-15",
      confirmedOn: null,
      amount: 600000,
      currencyCode: "KRW",
      matchStatus: "부분 입금",
      payerLabel: "연재 채널",
      reference: "BANK-2026-10",
      note: "1차 입금",
    } as const;
    expect(parseCreatePublishingPaymentCommand(create)).toEqual(create);
    expect(parseListPublishingPaymentsCommand({ schemaVersion: 1, workId: null }))
      .toEqual({ schemaVersion: 1, workId: null });
    expect(parseUpdatePublishingPaymentCommand({
      schemaVersion: 1,
      paymentId: "payment-a",
      expectedRevision: 1,
      changes: { confirmedOn: "2026-10-16", amount: 590000 },
    })).toMatchObject({
      paymentId: "payment-a",
      changes: { confirmedOn: "2026-10-16", amount: 590000 },
    });

    const payments = parsePublishingPaymentListProjection({
      schemaVersion: 1,
      payments: [
        {
          ...create,
          paymentId: "payment-a",
          revision: 1,
          workTitleSnapshot: "별빛 아래",
          settlementTitleSnapshot: "9월 정산",
          sourceIds: [],
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-15T00:00:00.000Z",
        },
        {
          ...create,
          paymentId: "payment-b",
          revision: 1,
          amount: 10,
          currencyCode: "USD",
          workTitleSnapshot: "별빛 아래",
          settlementTitleSnapshot: "9월 정산",
          sourceIds: [],
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-15T00:00:00.000Z",
        },
      ],
    }).payments;
    const settlement = parsePublishingSettlementProjection({
      schemaVersion: 1,
      settlementId: "settlement-a",
      revision: 1,
      workId: "work-a",
      publicationId: "publication-a",
      title: "9월 정산",
      workTitleSnapshot: "별빛 아래",
      publicationTitleSnapshot: "주 2회 연재",
      periodStartsOn: "2026-09-01",
      periodEndsOn: "2026-09-30",
      issuedOn: "2026-10-10",
      reviewStatus: "확인 완료",
      currencyCode: "KRW",
      reportedAmount: 1250000,
      items: [],
      note: "",
      sourceIds: [],
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    });
    expect(derivePublishingSettlementReceivable({ settlement, payments })).toEqual({
      settlementId: "settlement-a",
      currencyCode: "KRW",
      expectedAmount: 1250000,
      matchedAmount: 600000,
      outstandingAmount: 650000,
      matchedPaymentIds: ["payment-a"],
      mismatchedPaymentIds: ["payment-b"],
    });
  });
});
