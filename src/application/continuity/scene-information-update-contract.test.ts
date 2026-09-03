import { describe, expect, it } from "vitest";

import {
  SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
  assertSceneInformationReviewedEntityScope,
  parseSceneInformationUpdateExecution,
} from "./scene-information-update-contract";

describe("Scene information update contract", () => {
  it("parses one strict result containing digest, canon, continuity, and review coverage", () => {
    const result = parseSceneInformationUpdateExecution({
      providerId: "provider-1",
      modelId: "model-1",
      promptVersion: SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
      digest: { text: "윤서는 북문이 열린다는 사실을 확인했다." },
      canon: {
        proposals: [{
          targetKind: "character-knowledge",
          targetHint: "북문은 열릴지도 모른다.",
          operationHint: "update",
          assertionBasis: "explicit-evidence",
          reason: "추측이 확인되었다.",
          fields: { stance: "knows", truthStatus: "true" },
          evidence: [{ paragraphId: "p1", quote: "사실을 확인했다" }],
        }],
      },
      continuity: {
        proposals: [{
          assertionBasis: "explicit-evidence",
          kind: "open-question",
          title: "북문을 연 사람",
          note: "아직 밝혀지지 않았다.",
          subjectRefs: [{ kind: "lore-entry", id: "lore-1" }],
          reason: "행위자가 드러나지 않았다.",
          evidence: [{ paragraphId: "p1", quote: "북문" }],
        }],
      },
      reviewedEntities: [{
        entity: { kind: "character", id: "character-1" },
        outcome: "unchanged",
        reason: "지속 필드 변화가 없다.",
      }],
    });

    expect(result.digest.text).toContain("북문");
    expect(result.canon.proposals[0]?.targetKind).toBe("character-knowledge");
    expect(result.continuity.proposals[0]?.kind).toBe("open-question");
    expect(result.reviewedEntities).toEqual([{
      entity: { kind: "character", id: "character-1" },
      outcome: "unchanged",
      reason: "지속 필드 변화가 없다.",
    }]);
  });

  it("rejects unknown coverage outcomes instead of manufacturing success", () => {
    expect(() => parseSceneInformationUpdateExecution({
      providerId: "provider-1",
      modelId: "model-1",
      promptVersion: SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
      digest: { text: "요약" },
      canon: { proposals: [] },
      continuity: { proposals: [] },
      reviewedEntities: [{
        entity: { kind: "character", id: "character-1" },
        outcome: "applied",
        reason: "잘못된 성공 상태",
      }],
    })).toThrow(/outcome/u);
  });

  it("rejects review coverage for an entity that was not supplied", () => {
    const execution = parseSceneInformationUpdateExecution({
      providerId: "provider-1",
      modelId: "model-1",
      promptVersion: SCENE_INFORMATION_UPDATE_PROMPT_VERSION,
      digest: { text: "요약" },
      canon: { proposals: [] },
      continuity: { proposals: [] },
      reviewedEntities: [{
        entity: { kind: "character", id: "invented-character" },
        outcome: "unchanged",
        reason: "입력에 없던 인물",
      }],
    });

    expect(() => assertSceneInformationReviewedEntityScope(
      execution.reviewedEntities,
      ["character:character-1"],
    )).toThrow(/outside its supplied scope/u);
  });
});
