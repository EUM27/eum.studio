import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CharacterProjection } from "../../application/characters/character-contract";
import { entityId } from "../../domain/writing";
import { CharacterManagerDialog } from "./CharacterManagerDialog";

const character: CharacterProjection = Object.freeze({
  schemaVersion: 1,
  characterId: entityId<"Character">("character-1"),
  revision: 2,
  workId: entityId<"Work">("work-1"),
  name: "윤서",
  role: "기록자",
  summary: "사건의 증언자다.",
  note: "2화 말투 확인",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

describe("CharacterManagerDialog", () => {
  it("shows a Work character list and free-text profile fields", () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterManagerDialog, {
        actionState: "idle",
        characters: [character],
        error: null,
        onClose: () => undefined,
        onCreate: () => undefined,
        onRetire: () => undefined,
        onSelect: () => undefined,
        onUpdate: () => undefined,
        selectedCharacterId: character.characterId,
      }),
    );

    expect(markup).toContain("인물 관리");
    expect(markup).toContain("새 인물");
    expect(markup).toContain("윤서");
    expect(markup).toContain("기록자");
    expect(markup).toContain("사건의 증언자다.");
    expect(markup).toContain("2화 말투 확인");
    expect(markup).toContain("인물 치우기");
    expect(markup).toContain('name="role"');
    expect(markup).not.toContain('name="role"><option');
  });

  it("offers an explicit empty create form without inventing a profile", () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterManagerDialog, {
        actionState: "idle",
        characters: [],
        error: null,
        onClose: () => undefined,
        onCreate: () => undefined,
        onRetire: () => undefined,
        onSelect: () => undefined,
        onUpdate: () => undefined,
        selectedCharacterId: null,
      }),
    );

    expect(markup).toContain("이 작품에 등록한 인물이 없습니다.");
    expect(markup).toContain("인물 이름");
    expect(markup).toContain("인물 만들기");
    expect(markup).not.toContain("주인공");
    expect(markup).not.toContain("조력자");
  });
});
