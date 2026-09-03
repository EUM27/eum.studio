import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createCanonReviewParagraphs,
  parseCanonReviewModelPayload,
  resolveCanonReviewEvidence,
} from "./canon-review-model-output";

const sourceRange = {
  documentId: entityId<"Document">("document-1"),
  documentRevisionId: entityId<"DocumentRevision">("revision-1"),
  from: 10,
  to: 37,
} as const;

describe("canon review model output", () => {
  it("strictly parses target-specific fields and exact quote evidence", () => {
    const payload = parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직업 변화가 직접 서술된다.",
        fields: { role: "정식 기록관" },
        evidence: [{ paragraphId: "p1", quote: "정식 기록관" }],
      }],
    });
    const paragraphs = createCanonReviewParagraphs({
      sourceRange,
      manuscript: "윤서는 정식 기록관이 되었다.\n문은 닫혔다.",
    });

    expect(payload.proposals[0]?.fields).toEqual({ role: "정식 기록관" });
    expect(resolveCanonReviewEvidence({
      sourceRange,
      paragraphs,
      proposal: payload.proposals[0]!,
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toEqual([{
      evidenceId: "evidence-1",
      documentId: "document-1",
      documentRevisionId: "revision-1",
      from: 14,
      to: 20,
      exactText: "정식 기록관",
      anchorId: null,
    }]);
  });

  it("rejects extra fields, target-kind mismatches, and empty evidence", () => {
    expect(() => parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "근거",
        fields: { enabled: true },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }],
    })).toThrow(/unsupported/i);
    expect(() => parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "lore-entry",
        targetHint: "북문",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "근거",
        fields: { title: "북문" },
        evidence: [],
      }],
    })).toThrow(/non-empty/i);
    expect(() => parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "lore-entry",
        targetHint: "북문",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "근거",
        fields: { title: "북문" },
        evidence: [{ paragraphId: "p1", quote: "북문" }],
        copiedReferenceField: "forbidden",
      }],
    })).toThrow(/schema/i);
  });

  it("requires complete create fields without inventing product defaults", () => {
    expect(() => parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "lore-entry",
        targetHint: "북문",
        operationHint: "create",
        assertionBasis: "explicit-evidence",
        reason: "새 설정",
        fields: { title: "북문", content: "밤에만 열린다." },
        evidence: [{ paragraphId: "p1", quote: "북문" }],
      }],
    })).toThrow(/create fields/i);
  });

  it("rejects missing, ambiguous, and out-of-range quote evidence", () => {
    const proposal = parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "근거",
        fields: { role: "기록관" },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }],
    }).proposals[0]!;
    expect(() => resolveCanonReviewEvidence({
      sourceRange,
      paragraphs: createCanonReviewParagraphs({
        sourceRange,
        manuscript: "윤서와 윤서",
      }),
      proposal,
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toThrow(/uniquely/i);
    expect(() => resolveCanonReviewEvidence({
      sourceRange,
      paragraphs: [],
      proposal,
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toThrow(/unknown paragraph/i);
  });

  it("parses complete CharacterKnowledge creation fields", () => {
    expect(parseCanonReviewModelPayload({
      proposals: [{
        targetKind: "character-knowledge",
        targetHint: "윤서는 북문이 열린다고 안다.",
        operationHint: "create",
        assertionBasis: "explicit-evidence",
        reason: "윤서가 사실을 직접 확인한다.",
        fields: {
          characterId: "character-1",
          statement: "북문은 새벽에 열린다.",
          stance: "knows",
          truthStatus: "true",
          aboutRefKeys: ["lore-entry:lore-1"],
        },
        evidence: [{ paragraphId: "p1", quote: "정식 기록관" }],
      }],
    }).proposals[0]?.fields).toEqual({
      characterId: "character-1",
      statement: "북문은 새벽에 열린다.",
      stance: "knows",
      truthStatus: "true",
      aboutRefKeys: ["lore-entry:lore-1"],
    });
  });
});
