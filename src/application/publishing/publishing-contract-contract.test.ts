import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingContractCommand,
  parseListPublishingContractsCommand,
  parsePublishingContractListProjection,
  parseUpdatePublishingContractCommand,
} from "./publishing-contract-contract";

describe("publishing contract contract", () => {
  it("parses a Work-owned contract with an optional same-boundary submission link", () => {
    const create = {
      schemaVersion: 1,
      workId: "work-a",
      partnerId: "partner-a",
      submissionId: "submission-a",
      title: "전자 출판 계약",
      status: "체결",
      signedOn: "2026-08-20",
      startsOn: "2026-09-01",
      endsOn: "2028-08-31",
      rightsScope: "국내 전자 출판권",
      advanceAmount: 1500000,
      currencyCode: "KRW",
      revenueShareNote: "순매출 기준",
      note: "원본 계약서는 별도 보관",
    } as const;
    expect(parseCreatePublishingContractCommand(create)).toEqual(create);
    expect(parseListPublishingContractsCommand({ schemaVersion: 1, workId: null }))
      .toEqual({ schemaVersion: 1, workId: null });
    expect(parseUpdatePublishingContractCommand({
      schemaVersion: 1,
      contractId: "contract-a",
      expectedRevision: 1,
      changes: {
        status: "진행 중",
        rightsScope: "국내 전자·오디오 출판권",
        advanceAmount: null,
        note: "부속 합의 확인",
      },
    })).toEqual({
      schemaVersion: 1,
      contractId: "contract-a",
      expectedRevision: 1,
      changes: {
        status: "진행 중",
        rightsScope: "국내 전자·오디오 출판권",
        advanceAmount: null,
        note: "부속 합의 확인",
      },
    });

    const projection = parsePublishingContractListProjection({
      schemaVersion: 1,
      contracts: [{
        ...create,
        contractId: "contract-a",
        revision: 2,
        workTitleSnapshot: "별빛 아래",
        partnerNameSnapshot: "은하출판",
        sourceIds: [],
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-21T00:00:00.000Z",
      }],
    });
    expect(projection.contracts[0]).toMatchObject({
      contractId: "contract-a",
      submissionId: "submission-a",
      workTitleSnapshot: "별빛 아래",
      partnerNameSnapshot: "은하출판",
      rightsScope: "국내 전자 출판권",
      advanceAmount: 1500000,
      currencyCode: "KRW",
    });
  });
});
