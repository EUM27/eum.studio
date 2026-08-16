import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseCreateLoreCandidateCommand,
  parseLoreCandidateApprovalResult,
  parseLoreCandidateListProjection,
  parseLoreCandidateProjection,
  parseReviewLoreCandidateCommand,
} from "./lore-candidate-contract";

const workId = entityId<"Work">("work-1");
const documentId = entityId<"Document">("document-1");
const revisionId = entityId<"DocumentRevision">("revision-1");
const anchorId = entityId<"Anchor">("anchor-1");
const candidateId = entityId<"LoreCandidate">("candidate-1");
const loreEntryId = entityId<"LoreEntry">("lore-1");

const candidate = Object.freeze({
  schemaVersion: 1,
  candidateId,
  revision: 1,
  workId,
  source: "user",
  certainty: "explicit",
  proposal: Object.freeze({
    kind: "create",
    title: "북쪽 탑",
    content: "종이 세 번 울린다.",
    category: "장소",
    aliases: Object.freeze(["북탑"]),
    enabled: true,
  }),
  evidence: Object.freeze({
    anchorId,
    sourceDocumentId: documentId,
    sourceDocumentRevisionId: revisionId,
    exactText: "종이 세 번 울렸다.",
    integrity: "resolved",
    range: Object.freeze({ from: 2, to: 13 }),
  }),
  reason: "사용자가 직접 선택함",
  status: "pending",
  approvedLoreEntryId: null,
  approvalBlockReason: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  reviewedAt: null,
});

describe("lore Candidate contract", () => {
  it("keeps exact evidence and an explicit create proposal separate from canonical lore", () => {
    expect(parseCreateLoreCandidateCommand({
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 13, head: 2 },
      exactText: "종이 세 번 울렸다.",
      source: "user",
      certainty: "explicit",
      proposal: candidate.proposal,
      reason: candidate.reason,
    })).toEqual({
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 13, head: 2 },
      exactText: "종이 세 번 울렸다.",
      source: "user",
      certainty: "explicit",
      proposal: candidate.proposal,
      reason: candidate.reason,
    });
    expect(parseLoreCandidateProjection(candidate)).toEqual(candidate);
  });

  it("accepts an exact target revision and only explicit update fields", () => {
    expect(parseCreateLoreCandidateCommand({
      schemaVersion: 1,
      workId,
      documentId,
      selection: { anchor: 2, head: 13 },
      exactText: "종이 세 번 울렸다.",
      source: "assistant",
      certainty: "inferred",
      proposal: {
        kind: "update",
        loreEntryId,
        expectedLoreEntryRevision: 3,
        changes: { content: "새 내용", enabled: false },
      },
      reason: "검토 제안",
    }).proposal).toEqual({
      kind: "update",
      loreEntryId,
      expectedLoreEntryRevision: 3,
      changes: { content: "새 내용", enabled: false },
    });
  });

  it("preserves processed Candidates while rejecting cross-Work projections", () => {
    const approved = {
      ...candidate,
      revision: 2,
      status: "approved",
      approvedLoreEntryId: loreEntryId,
      approvalBlockReason: "already-reviewed",
      reviewedAt: "2026-08-10T01:00:00.000Z",
    } as const;
    expect(parseLoreCandidateListProjection({
      schemaVersion: 1,
      workId,
      candidates: [approved],
    }).candidates).toHaveLength(1);
    expect(() => parseLoreCandidateListProjection({
      schemaVersion: 1,
      workId,
      candidates: [{ ...candidate, workId: "work-2" }],
    })).toThrow(/outside Work/);
  });

  it("requires revision-checked review and consistent approval ownership", () => {
    expect(parseReviewLoreCandidateCommand({
      schemaVersion: 1,
      workId,
      candidateId,
      expectedRevision: 1,
    })).toEqual({ schemaVersion: 1, workId, candidateId, expectedRevision: 1 });
    expect(() => parseReviewLoreCandidateCommand({
      schemaVersion: 1,
      workId,
      candidateId,
      expectedRevision: 0,
    })).toThrow(/positive safe integer/);
    expect(() => parseLoreCandidateApprovalResult({
      schemaVersion: 1,
      candidate: { ...candidate, status: "rejected", reviewedAt: "now" },
      loreEntry: {
        schemaVersion: 1,
        loreEntryId,
        revision: 1,
        workId,
        title: "북쪽 탑",
        content: "",
        category: "",
        aliases: [],
        enabled: true,
        evidences: [],
        history: [],
        createdAt: "now",
        updatedAt: "now",
        retiredAt: null,
      },
    })).toThrow();
  });
});
