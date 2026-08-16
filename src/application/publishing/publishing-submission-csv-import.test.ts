import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { PublishingPartnerProjection } from "./publishing-partner-contract";
import {
  buildPublishingSubmissionCsvImportPreview,
  parseApplyPublishingSubmissionCsvImportCommand,
} from "./publishing-submission-csv-import";

const workId = entityId<"Work">("work-a");
const partnerId = entityId<"PublishingPartner">("partner-a");
const partner: PublishingPartnerProjection = Object.freeze({
  schemaVersion: 1,
  partnerId,
  revision: 1,
  name: "한빛 문고",
  parentPartnerId: null,
  submissionMethod: "",
  websiteUrl: "",
  email: "",
  genres: [],
  requiredLength: "",
  priority: "",
  note: "",
  sourceIds: [],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
});
const works = [{
  workId,
  title: "긴 여름",
  updatedAt: "2026-08-10T00:00:00.000Z",
  folders: [],
  documents: [],
}] as const;

describe("publishing submission CSV import", () => {
  it("maps only selected columns and resolves exact unique Work and partner labels", () => {
    const command = parseApplyPublishingSubmissionCsvImportCommand({
      schemaVersion: 1,
      fileName: "투고 이력.csv",
      csvText: [
        "작품,투고처,제목,투고일,상태,원시열",
        "긴 여름,한빛 문고,첫 투고,2026-08-10,접수,보존값",
      ].join("\r\n"),
      mapping: {
        workLabel: "작품",
        partnerLabel: "투고처",
        title: "제목",
        submittedOn: "투고일",
        status: "상태",
      },
    });
    const preview = buildPublishingSubmissionCsvImportPreview({
      ...command,
      works,
      partners: [partner],
    });
    expect(preview.fileIssues).toEqual([]);
    expect(preview.rowIssues).toEqual([]);
    expect(preview.readyRows).toEqual([{
      rowNumber: 2,
      workId,
      partnerId,
      values: {
        workLabel: "긴 여름",
        partnerLabel: "한빛 문고",
        title: "첫 투고",
        submittedOn: "2026-08-10",
        status: "접수",
      },
      rawFields: {
        작품: "긴 여름",
        투고처: "한빛 문고",
        제목: "첫 투고",
        투고일: "2026-08-10",
        상태: "접수",
        원시열: "보존값",
      },
    }]);
  });

  it("keeps unresolved relations and invalid date-only values out of ready rows", () => {
    const preview = buildPublishingSubmissionCsvImportPreview({
      fileName: "투고 이력.csv",
      csvText: [
        "작품,투고처,투고일,회신일",
        "없는 작품,한빛 문고,2026-08-10,",
        "긴 여름,없는 문고,2026-02-30,2026/08/11",
        ",한빛 문고,,",
      ].join("\r\n"),
      mapping: {
        workLabel: "작품",
        partnerLabel: "투고처",
        submittedOn: "투고일",
        respondedOn: "회신일",
      },
      works,
      partners: [partner],
    });
    expect(preview.readyRows).toEqual([]);
    expect(preview.rowIssues.map((issue) => issue.reasons)).toEqual([
      ["missing-work"],
      ["missing-partner", "invalid-submitted-on", "invalid-responded-on"],
      ["missing-work-label"],
    ]);
  });
});
