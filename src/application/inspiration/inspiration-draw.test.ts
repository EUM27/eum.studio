import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  drawCharacter,
  drawEvents,
  parseInspirationDrawProfile,
  parseKeywordDraft,
} from "./inspiration-draw";
import {
  createDefaultWorkInspirationSettingsProjection,
  parseSaveWorkInspirationSettingsCommand,
} from "./work-inspiration-settings";

const profile = parseInspirationDrawProfile({
  schemaVersion: 1,
  characterDefaultName: "새 인물",
  characterTraitCount: 1,
  characterUserKeywordCount: 1,
  characterUserKeywordCategory: "사용자",
  characterTraitGroups: [{
    category: "성격",
    values: ["신중함"],
  }],
  eventCardCount: 2,
  eventUserKeywordDescription: "사용자 사건",
  eventCards: [{ title: "전환", description: "흐름이 바뀐다." }],
});

describe("inspiration draw", () => {
  it("draws local character traits and event cards from the profile and user pools", () => {
    expect(drawCharacter(profile, ["밤을 두려워함"], () => 0)).toEqual({
      name: "새 인물",
      traits: [
        { category: "성격", value: "신중함" },
        { category: "사용자", value: "밤을 두려워함" },
      ],
    });
    expect(drawEvents(profile, ["오래된 편지"], () => 0)).toEqual({
      cards: [
        { title: "오래된 편지", description: "사용자 사건" },
        { title: "전환", description: "흐름이 바뀐다." },
      ],
    });
  });

  it("parses comma and line-separated user keywords without duplicates", () => {
    expect(parseKeywordDraft("비밀, 귀환\n비밀")).toEqual(["비밀", "귀환"]);
  });
});

describe("Work inspiration settings", () => {
  it("starts empty and accepts work-owned keyword settings", () => {
    const workId = entityId<"Work">("work-a");
    expect(createDefaultWorkInspirationSettingsProjection(workId)).toEqual({
      schemaVersion: 1,
      workId,
      revision: 0,
      settings: { characterKeywords: [], eventKeywords: [] },
      updatedAt: null,
    });
    expect(parseSaveWorkInspirationSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 0,
      settings: {
        characterKeywords: ["  비밀을 숨김  "],
        eventKeywords: ["귀환"],
      },
    }).settings).toEqual({
      characterKeywords: ["비밀을 숨김"],
      eventKeywords: ["귀환"],
    });
  });
});
