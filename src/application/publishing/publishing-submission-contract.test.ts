import { describe, expect, it } from "vitest";

import {
  parseCreatePublishingSubmissionCommand,
  parseListPublishingSubmissionsCommand,
  parsePublishingSubmissionListProjection,
  parseUpdatePublishingSubmissionCommand,
} from "./publishing-submission-contract";

describe("publishing submission contract", () => {
  it("keeps an editable submission ledger around one immutable submission package", () => {
    expect(parseCreatePublishingSubmissionCommand({
      schemaVersion: 1,
      workId: "work-a",
      partnerId: "partner-a",
      title: "봄 투고",
      status: "검토 중",
      submittedOn: "2026-08-10",
      respondedOn: null,
      result: "",
      note: "접수 번호를 확인한다.",
      cardNote: "담당 편집부",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      partnerId: "partner-a",
      title: "봄 투고",
      status: "검토 중",
      submittedOn: "2026-08-10",
      respondedOn: null,
      result: "",
      note: "접수 번호를 확인한다.",
      cardNote: "담당 편집부",
    });

    expect(parseUpdatePublishingSubmissionCommand({
      schemaVersion: 1,
      submissionId: "submission-a",
      expectedRevision: 1,
      changes: {
        status: "회신 완료",
        respondedOn: "2026-08-18",
        result: "수정 요청",
        note: "회신 원문은 별도 보관했다.",
      },
    })).toEqual({
      schemaVersion: 1,
      submissionId: "submission-a",
      expectedRevision: 1,
      changes: {
        status: "회신 완료",
        respondedOn: "2026-08-18",
        result: "수정 요청",
        note: "회신 원문은 별도 보관했다.",
      },
    });

    expect(parseListPublishingSubmissionsCommand({
      schemaVersion: 1,
      workId: null,
    })).toEqual({ schemaVersion: 1, workId: null });

    const projection = parsePublishingSubmissionListProjection({
      schemaVersion: 1,
      submissions: [{
        schemaVersion: 1,
        submissionId: "submission-a",
        revision: 2,
        workId: "work-a",
        partnerId: "partner-a",
        title: "봄 투고",
        status: "회신 완료",
        submittedOn: "2026-08-10",
        respondedOn: "2026-08-18",
        result: "수정 요청",
        note: "회신 원문은 별도 보관했다.",
        cardNote: "담당 편집부",
        sourceIds: [],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
        package: {
          schemaVersion: 1,
          submissionPackageId: "package-a",
          workId: "work-a",
          partnerId: "partner-a",
          workSnapshotId: "snapshot-a",
          workTitleSnapshot: "별빛 아래",
          partnerNameSnapshot: "은하출판",
          manifestHash: "manifest-a",
          sealedAt: "2026-08-10T00:00:00.000Z",
          documentRevisions: [
            { documentId: "document-a", documentRevisionId: "revision-a" },
            { documentId: "document-b", documentRevisionId: "revision-b" },
          ],
        },
      }],
    });

    expect(projection.submissions[0]).toMatchObject({
      submissionId: "submission-a",
      revision: 2,
      package: {
        submissionPackageId: "package-a",
        workTitleSnapshot: "별빛 아래",
        partnerNameSnapshot: "은하출판",
        documentRevisions: [
          { documentId: "document-a", documentRevisionId: "revision-a" },
          { documentId: "document-b", documentRevisionId: "revision-b" },
        ],
      },
    });
    expect(Object.isFrozen(projection.submissions[0]?.package)).toBe(true);
    expect(Object.isFrozen(projection.submissions[0]?.package.documentRevisions)).toBe(true);
  });
});
