import { describe, expect, it } from "vitest";

import {
  parseCharacterListProjection,
  parseCharacterProjection,
  parseCreateCharacterCommand,
  parseListCharactersCommand,
  parseRetireCharacterCommand,
  parseUpdateCharacterCommand,
} from "./character-contract";

describe("character contract", () => {
  it("parses explicit Work-owned create, list, update, and retirement commands", () => {
    expect(parseCreateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      name: "  윤서  ",
      aliases: [" 서린 "],
      role: "관찰자",
      summary: "주인공의 선택을 기록한다.",
      appearance: "검은 단발",
      personality: "신중함",
      speech: "짧게 말함",
      goal: "사건 기록",
      conflict: "증언과 우정",
      note: "말투 확인",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      name: "윤서",
      aliases: ["서린"],
      role: "관찰자",
      summary: "주인공의 선택을 기록한다.",
      appearance: "검은 단발",
      personality: "신중함",
      speech: "짧게 말함",
      goal: "사건 기록",
      conflict: "증언과 우정",
      note: "말투 확인",
    });
    expect(parseListCharactersCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
    expect(parseUpdateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      characterId: "character-a",
      expectedRevision: 2,
      changes: {
        name: "윤서린",
        aliases: ["윤서"],
        role: "기록자",
        summary: "사건의 증언자다.",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "2화 말투 확인",
      },
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      characterId: "character-a",
      expectedRevision: 2,
      changes: {
        name: "윤서린",
        aliases: ["윤서"],
        role: "기록자",
        summary: "사건의 증언자다.",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "2화 말투 확인",
      },
    });
    expect(parseRetireCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      characterId: "character-a",
      expectedRevision: 3,
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      characterId: "character-a",
      expectedRevision: 3,
    });
  });

  it("requires an explicit name but no fixed role or generated profile fields", () => {
    expect(parseCreateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      name: "윤서",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
    })).toMatchObject({ name: "윤서", role: "" });
    expect(() => parseCreateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      name: "   ",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
    })).toThrow("name must be a non-empty string");
    expect(() => parseCreateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      name: "윤서",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
      avatar: "sample",
    })).toThrow("Unsupported CreateCharacterCommand field: avatar");
  });

  it("requires at least one explicit editable field", () => {
    expect(() => parseUpdateCharacterCommand({
      schemaVersion: 1,
      workId: "work-a",
      characterId: "character-a",
      expectedRevision: 1,
      changes: {},
    })).toThrow("changes must contain at least one field");
  });

  it("rejects a character list containing another Work", () => {
    expect(() => parseCharacterListProjection({
      schemaVersion: 1,
      workId: "work-a",
      characters: [{
        schemaVersion: 1,
        characterId: "character-b",
        revision: 1,
        workId: "work-b",
        name: "다른 작품 인물",
        aliases: [],
        role: "",
        summary: "",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "",
        evidences: [],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        retiredAt: null,
      }],
    })).toThrow("outside Work work-a");
  });

  it("parses only the character-owned projection fields", () => {
    expect(parseCharacterProjection({
      schemaVersion: 1,
      characterId: "character-a",
      revision: 1,
      workId: "work-a",
      name: "윤서",
      aliases: [],
      role: "",
      summary: "",
      appearance: "",
      personality: "",
      speech: "",
      goal: "",
      conflict: "",
      note: "",
      evidences: [],
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      retiredAt: null,
    })).toMatchObject({ characterId: "character-a", name: "윤서" });
  });
});
