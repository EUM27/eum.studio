import { describe, expect, it } from "vitest";

import {
  parseCharacterRelationListProjection,
  parseCharacterRelationProjection,
  parseCreateCharacterRelationCommand,
  parseRetireCharacterRelationCommand,
  parseUpdateCharacterRelationCommand,
} from "./character-relation-contract";

const timestamp = "2026-08-17T00:00:00.000Z";

describe("character relation contract", () => {
  it("parses free-form Work-owned relation commands without classifying kinds", () => {
    expect(parseCreateCharacterRelationCommand({
      schemaVersion: 1,
      workId: "work-a",
      fromCharacterId: "character-a",
      toCharacterId: "character-b",
      kind: "오래된 동료",
      description: "서로의 판단을 신뢰한다.",
    })).toMatchObject({
      kind: "오래된 동료",
      description: "서로의 판단을 신뢰한다.",
    });
    expect(parseUpdateCharacterRelationCommand({
      schemaVersion: 1,
      workId: "work-a",
      relationId: "relation-a",
      expectedRevision: 2,
      changes: { description: "현재는 경계한다." },
    }).changes).toEqual({ description: "현재는 경계한다." });
    expect(parseRetireCharacterRelationCommand({
      schemaVersion: 1,
      workId: "work-a",
      relationId: "relation-a",
      expectedRevision: 3,
    }).relationId).toBe("relation-a");
  });

  it("rejects unsupported fields and empty relation kinds", () => {
    expect(() => parseCreateCharacterRelationCommand({
      schemaVersion: 1,
      workId: "work-a",
      fromCharacterId: "character-a",
      toCharacterId: "character-b",
      kind: " ",
      description: "",
    })).toThrow("kind must be a non-empty string");
    expect(() => parseUpdateCharacterRelationCommand({
      schemaVersion: 1,
      workId: "work-a",
      relationId: "relation-a",
      expectedRevision: 1,
      changes: { targetCharacterId: "character-c" },
    })).toThrow(
      "Unsupported UpdateCharacterRelationCommand.changes field: targetCharacterId",
    );
  });

  it("preserves relation history while enforcing one Work per list", () => {
    const active = parseCharacterRelationProjection({
      schemaVersion: 1,
      relationId: "relation-a",
      revision: 1,
      workId: "work-a",
      fromCharacterId: "character-a",
      toCharacterId: "character-b",
      kind: "동료",
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      retiredAt: null,
      retirementReason: null,
    });
    expect(parseCharacterRelationListProjection({
      schemaVersion: 1,
      workId: "work-a",
      relations: [active],
    }).relations).toHaveLength(1);
    expect(() => parseCharacterRelationListProjection({
      schemaVersion: 1,
      workId: "work-b",
      relations: [active],
    })).toThrow("outside Work work-b");
    expect(() => parseCharacterRelationProjection({
      ...active,
      retiredAt: timestamp,
      retirementReason: null,
    })).toThrow("retirement state is inconsistent");
  });
});
