import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { PublishingPartnerProjection } from "./publishing-partner-contract";
import {
  buildPublishingPartnerCsvImportPreview,
  parseApplyPublishingPartnerCsvImportCommand,
  parsePublishingPartnerCsvText,
} from "./publishing-partner-csv-import";

const existing: PublishingPartnerProjection = Object.freeze({
  schemaVersion: 1,
  partnerId: entityId<"PublishingPartner">("partner-a"),
  revision: 1,
  name: "기존 출판사",
  parentPartnerId: null,
  submissionMethod: "",
  websiteUrl: "",
  email: "old@example.test",
  genres: [],
  requiredLength: "",
  priority: "",
  note: "기존 메모",
  sourceIds: [],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
});

describe("publishing partner CSV import", () => {
  it("parses quoted cells and maps only explicitly selected headers", () => {
    const csvText = '이름,이메일,메모\r\n기존 출판사,new@example.test,"첫 줄\n둘째 줄"\r\n새 문고,new2@example.test,신규';
    expect(parsePublishingPartnerCsvText(csvText).rows[0]).toEqual({
      이름: "기존 출판사",
      이메일: "new@example.test",
      메모: "첫 줄\n둘째 줄",
    });
    const command = parseApplyPublishingPartnerCsvImportCommand({
      schemaVersion: 1,
      fileName: "투고처.csv",
      csvText,
      mapping: { name: "이름", email: "이메일", note: "메모" },
    });
    const preview = buildPublishingPartnerCsvImportPreview({
      ...command,
      partners: [existing],
    });
    expect(preview.fileIssues).toEqual([]);
    expect(preview.rowIssues).toEqual([]);
    expect(preview.readyRows).toMatchObject([
      {
        rowNumber: 2,
        existingPartnerId: existing.partnerId,
        values: { name: "기존 출판사", email: "new@example.test", note: "첫 줄\n둘째 줄" },
      },
      {
        rowNumber: 3,
        existingPartnerId: null,
        values: { name: "새 문고", email: "new2@example.test", note: "신규" },
      },
    ]);
    expect(existing.email).toBe("old@example.test");
  });

  it("keeps missing and ambiguous relations out of the approved rows", () => {
    const preview = buildPublishingPartnerCsvImportPreview({
      fileName: "투고처.csv",
      csvText: "이름,모출판사\n자식 문고,없는 출판사\n중복,\n중복,",
      mapping: { name: "이름", parentPartnerName: "모출판사" },
      partners: [existing],
    });
    expect(preview.readyRows).toEqual([]);
    expect(preview.rowIssues.map((issue) => issue.reasons)).toEqual([
      ["missing-parent"],
      ["duplicate-import-name"],
      ["duplicate-import-name"],
    ]);
  });
});
