import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LoreCandidateProjection } from "../../application/lore/lore-candidate-contract";
import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import { entityId } from "../../domain/writing";
import { LoreCandidateDialog } from "./LoreCandidateDialog";

const workId = entityId<"Work">("work-a");
const documentId = entityId<"Document">("document-a");
const revisionId = entityId<"DocumentRevision">("revision-a");

const entry: LoreEntryProjection = Object.freeze({
  schemaVersion: 1,
  loreEntryId: entityId<"LoreEntry">("lore-a"),
  revision: 1,
  workId,
  title: "북쪽 탑",
  content: "종이 세 번 울린다.",
  category: "장소",
  aliases: Object.freeze(["북탑"]),
  enabled: true,
  evidences: Object.freeze([]),
  history: Object.freeze([]),
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

function candidate(input: {
  readonly id: string;
  readonly certainty: "explicit" | "inferred";
  readonly blockReason: LoreCandidateProjection["approvalBlockReason"];
  readonly text: string;
}): LoreCandidateProjection {
  return Object.freeze({
    schemaVersion: 1,
    candidateId: entityId<"LoreCandidate">(input.id),
    revision: 1,
    workId,
    source: input.certainty === "explicit" ? "user" : "assistant",
    certainty: input.certainty,
    proposal: Object.freeze({
      kind: "create",
      title: input.id === "candidate-a" ? "북쪽 탑" : "추정 설정",
      content: "검토할 설정 내용",
      category: "장소",
      aliases: Object.freeze([]),
      enabled: true,
    }),
    evidence: Object.freeze({
      anchorId: entityId<"Anchor">(`anchor-${input.id}`),
      sourceDocumentId: documentId,
      sourceDocumentRevisionId: revisionId,
      exactText: input.text,
      integrity: input.blockReason === "evidence-stale" ? "needsReview" : "resolved",
      range: input.blockReason === "evidence-stale"
        ? null
        : Object.freeze({ from: 4, to: 14 }),
    }),
    reason: "선택한 원고에서 발견",
    status: "pending",
    approvedLoreEntryId: null,
    approvalBlockReason: input.blockReason,
    createdAt: "2026-08-10T00:00:00.000Z",
    reviewedAt: null,
  });
}

describe("LoreCandidateDialog", () => {
  it("shows separate pending Candidates with exact evidence and review controls", () => {
    const markup = renderToStaticMarkup(createElement(LoreCandidateDialog, {
      actionState: "idle",
      canCapture: true,
      candidates: [
        candidate({
          id: "candidate-a",
          certainty: "explicit",
          blockReason: null,
          text: "북쪽 탑에서 종이 울렸다.",
        }),
        candidate({
          id: "candidate-b",
          certainty: "inferred",
          blockReason: "evidence-stale",
          text: "안개 너머에 탑이 있었다.",
        }),
      ],
      documentLabels: { "document-a": "3화" },
      entries: [entry],
      error: null,
      onApprove: () => undefined,
      onClose: () => undefined,
      onCreate: () => undefined,
      onOpenEvidence: () => undefined,
      onReject: () => undefined,
    }));

    expect(markup).toContain("별빛 검토함");
    expect(markup).toContain("현재 선택을 후보로 담기");
    expect(markup).toContain("북쪽 탑에서 종이 울렸다.");
    expect(markup).toContain("안개 너머에 탑이 있었다.");
    expect(markup).toContain("3화");
    expect(markup).toContain("승인");
    expect(markup).toContain("거절");
    expect(markup).toContain("원문 열기");
    expect(markup).toContain("원문이 변경됨");
    expect(markup).toContain("승인 전에는 확정 별빛을 바꾸지 않습니다.");
  });
});
