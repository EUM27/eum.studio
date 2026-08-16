import { describe, expect, it } from "vitest";

import {
  parseRecordPublishingMailCandidateCommand,
  parseReviewPublishingMailCandidateCommand,
  parseUpdatePublishingMailCandidateCommand,
} from "./publishing-mail-candidate-contract";

describe("publishing mail candidate contract", () => {
  it("accepts message metadata and a body fingerprint without accepting a message body", () => {
    const command = parseRecordPublishingMailCandidateCommand({
      schemaVersion: 1,
      sourceAccountId: "account-a",
      messageId: "message-a",
      threadId: "thread-a",
      from: "reply@example.test",
      subject: "검토 결과",
      receivedAt: "2026-08-10T01:02:03.000Z",
      snippet: "결과를 안내드립니다.",
      bodyFingerprint: "sha256:abc",
      matchReason: "",
      proposedStatus: "회신 완료",
      proposedResult: "수정 요청",
      proposedRespondedOn: "2026-08-10",
      proposedNote: "회신 요약",
      classificationConnectionId: null,
      classificationModel: "",
    });
    expect(command.bodyFingerprint).toBe("sha256:abc");
    expect(() => parseRecordPublishingMailCandidateCommand({
      ...command,
      body: "메일 전문",
    })).toThrow(/Unsupported/u);
  });

  it("keeps proposal updates and approval as explicit revision commands", () => {
    expect(parseUpdatePublishingMailCandidateCommand({
      schemaVersion: 1,
      candidateId: "candidate-a",
      expectedRevision: 2,
      changes: { proposedStatus: "회신 완료", proposedRespondedOn: null },
    })).toMatchObject({ expectedRevision: 2, changes: { proposedRespondedOn: null } });
    expect(parseReviewPublishingMailCandidateCommand({
      schemaVersion: 1,
      candidateId: "candidate-a",
      expectedRevision: 3,
      decision: "approve",
    }).decision).toBe("approve");
  });
});
