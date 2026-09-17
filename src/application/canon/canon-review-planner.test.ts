import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { parseCanonReviewModelPayload } from "./canon-review-model-output";
import {
  planCanonReviewItems,
  resolveCanonReviewItemTarget,
  type CanonReviewSourceSnapshot,
} from "./canon-review-planner";

const sourceRange = {
  documentId: entityId<"Document">("document-1"),
  documentRevisionId: entityId<"DocumentRevision">("revision-1"),
  from: 0,
  to: 30,
} as const;

const character = {
  kind: "character",
  id: "character-1",
  revision: 3,
  workId: "work-1",
  retiredAt: null,
  fields: {
    name: "윤서",
    aliases: ["서윤"],
    role: "수습",
    summary: "기록을 지킨다.",
    appearance: "",
    personality: "신중함",
    speech: "",
    goal: "",
    conflict: "",
    note: "",
  },
} as const satisfies CanonReviewSourceSnapshot;

const lore = {
  kind: "lore-entry",
  id: "lore-1",
  revision: 2,
  workId: "work-1",
  retiredAt: null,
  fields: {
    title: "북문",
    content: "낮에는 닫혀 있다.",
    category: "장소",
    aliases: ["북쪽 문"],
    enabled: true,
  },
} as const satisfies CanonReviewSourceSnapshot;

const knowledge = {
  kind: "character-knowledge",
  id: "knowledge-1",
  revision: 2,
  workId: "work-1",
  retiredAt: null,
  fields: {
    characterId: "character-1",
    statement: "북문은 열릴지도 모른다.",
    stance: "suspects",
    truthStatus: "unknown",
    aboutRefKeys: ["lore-entry:lore-1"],
  },
} as const satisfies CanonReviewSourceSnapshot;

function payload(proposals: readonly Record<string, unknown>[]) {
  return parseCanonReviewModelPayload({ proposals });
}

describe("canon review planner", () => {
  it("keeps only changed fields for a unique active update target", () => {
    const result = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 정식 기록관이 되었다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: {
          name: "윤서",
          aliases: ["서윤"],
          role: "정식 기록관",
          summary: "기록을 지킨다.",
          appearance: "",
          personality: "신중함",
          speech: "",
          goal: "",
          conflict: "",
          note: "",
        },
        evidence: [{ paragraphId: "p1", quote: "정식 기록관" }],
      }]),
      sources: [character],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.target).toEqual({
      kind: "character",
      operation: "update",
      characterId: "character-1",
      expectedRevision: 3,
    });
    expect(result[0]?.fieldChanges).toEqual([{
      field: "role",
      before: "수습",
      after: "정식 기록관",
      selected: true,
    }]);
  });

  it("drops a fully duplicate pending proposal from the same source revision", () => {
    const result = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 정식 기록관이 되었다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: { role: "정식 기록관" },
        evidence: [{ paragraphId: "p1", quote: "정식 기록관" }],
      }]),
      sources: [character],
      pendingFieldChanges: [{
        sourceDocumentRevisionId: "revision-1",
        targetKind: "character",
        targetIdentity: "character-1",
        field: "role",
        after: "정식 기록관",
      }],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    });

    expect(result).toEqual([]);
  });

  it("keeps ambiguous matches unresolved for explicit user selection", () => {
    const secondCharacter = {
      ...character,
      id: "character-2",
      revision: 1,
      fields: { ...character.fields, name: "서윤", aliases: ["윤서"] },
    } as const satisfies CanonReviewSourceSnapshot;
    const result = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 떠났다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: { role: "여행자" },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }]),
      sources: [character, secondCharacter],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    });

    expect(result[0]?.target).toEqual({
      kind: "character",
      operation: "unresolved",
      matchingTargetIds: ["character-1", "character-2"],
    });
  });

  it("creates only with complete fields and preserves model inference as non-explicit", () => {
    const result = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "동문은 새벽에 열렸다.",
      payload: payload([{
        targetKind: "lore-entry",
        targetHint: "동문",
        operationHint: "create",
        assertionBasis: "model-inference",
        reason: "지속 설정일 가능성",
        fields: {
          title: "동문",
          content: "새벽에 열린다.",
          category: "장소",
          aliases: [],
          enabled: true,
        },
        evidence: [{ paragraphId: "p1", quote: "동문" }],
      }]),
      sources: [lore],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    });

    expect(result[0]?.target).toEqual({
      kind: "lore-entry",
      operation: "create",
    });
    expect(result[0]?.assertionBasis).toBe("model-inference");
    expect(result[0]?.fieldChanges.every((change) => change.before === null))
      .toBe(true);
  });

  it("excludes retired targets and rejects cross-Work or unknown relation endpoints", () => {
    const retired = { ...character, retiredAt: "2026-08-28T00:00:00.000Z" };
    const unresolved = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 떠났다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: { role: "여행자" },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }]),
      sources: [retired],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    });
    expect(unresolved[0]?.target.operation).toBe("unresolved");

    expect(() => planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 떠났다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "윤서",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: { role: "여행자" },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }]),
      sources: [{ ...character, workId: "work-2" }],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toThrow(/Work boundary/i);

    expect(() => planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서와 민호는 동료가 되었다.",
      payload: payload([{
        targetKind: "character-relation",
        targetHint: "동료",
        operationHint: "create",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: {
          fromCharacterId: "character-1",
          toCharacterId: "missing-character",
          kind: "동료",
          description: "함께 기록한다.",
        },
        evidence: [{ paragraphId: "p1", quote: "동료" }],
      }]),
      sources: [character],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toThrow(/character endpoint/i);
  });

  it("recomputes target revision and before values when an unresolved item is resolved", () => {
    const unresolved = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 떠났다.",
      payload: payload([{
        targetKind: "character",
        targetHint: "알 수 없음",
        operationHint: "unresolved",
        assertionBasis: "explicit-evidence",
        reason: "대상 모호",
        fields: { role: "여행자" },
        evidence: [{ paragraphId: "p1", quote: "윤서" }],
      }]),
      sources: [character],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    })[0]!;

    const resolved = resolveCanonReviewItemTarget({
      workId: "work-1",
      item: unresolved,
      selection: {
        kind: "update",
        targetId: "character-1",
        expectedRevision: 3,
      },
      sources: [character],
    });

    expect(resolved.target).toEqual({
      kind: "character",
      operation: "update",
      characterId: "character-1",
      expectedRevision: 3,
    });
    expect(resolved.fieldChanges[0]?.before).toBe("수습");
  });

  it("rejects a model proposal outside the user-requested target kinds", () => {
    expect(() => planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "북문은 밤에 열렸다.",
      payload: payload([{
        targetKind: "lore-entry",
        targetHint: "북문",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "직접 서술",
        fields: { content: "밤에 열린다." },
        evidence: [{ paragraphId: "p1", quote: "북문" }],
      }]),
      requestedTargetKinds: ["character"],
      sources: [character, lore],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-1" },
      evidenceIdFactory: { create: () => "evidence-1" },
    })).toThrow(/not requested/i);
  });

  it("plans a CharacterKnowledge supersession candidate against the active statement", () => {
    const result = planCanonReviewItems({
      workId: "work-1",
      sourceRange,
      manuscript: "윤서는 북문이 열린다는 사실을 직접 확인했다.",
      payload: payload([{
        targetKind: "character-knowledge",
        targetHint: "북문은 열릴지도 모른다.",
        operationHint: "update",
        assertionBasis: "explicit-evidence",
        reason: "추측이 직접 확인된 지식으로 바뀌었다.",
        fields: {
          statement: "북문은 열린다.",
          stance: "knows",
          truthStatus: "true",
        },
        evidence: [{ paragraphId: "p1", quote: "직접 확인" }],
      }]),
      sources: [character, lore, knowledge],
      pendingFieldChanges: [],
      itemIdFactory: { create: () => "item-knowledge" },
      evidenceIdFactory: { create: () => "evidence-knowledge" },
    });

    expect(result[0]?.target).toEqual({
      kind: "character-knowledge",
      operation: "update",
      knowledgeId: "knowledge-1",
      expectedRevision: 2,
    });
    expect(result[0]?.fieldChanges).toEqual([
      { field: "statement", before: "북문은 열릴지도 모른다.", after: "북문은 열린다.", selected: true },
      { field: "stance", before: "suspects", after: "knows", selected: true },
      { field: "truthStatus", before: "unknown", after: "true", selected: true },
    ]);
  });
});
