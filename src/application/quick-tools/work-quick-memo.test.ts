import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseSaveWorkQuickMemoCommand,
  parseWorkQuickMemoProjection,
} from "./work-quick-memo";

describe("Work quick memo contract", () => {
  it("preserves exact memo text without treating it as manuscript content", () => {
    const workId = entityId<"Work">("work-a");
    expect(
      parseSaveWorkQuickMemoCommand({
        schemaVersion: 1,
        workId,
        expectedRevision: 3,
        text: "  인물 이름 확인\n둘째 줄  ",
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      expectedRevision: 3,
      text: "  인물 이름 확인\n둘째 줄  ",
    });
  });

  it("accepts only the canonical empty projection and rejects extra fields", () => {
    expect(
      parseWorkQuickMemoProjection({
        schemaVersion: 1,
        workId: "work-a",
        revision: 0,
        text: "",
        updatedAt: null,
      }),
    ).toMatchObject({ revision: 0, text: "", updatedAt: null });
    expect(() =>
      parseSaveWorkQuickMemoCommand({
        schemaVersion: 1,
        workId: "work-a",
        expectedRevision: 0,
        text: "메모",
        insertIntoManuscript: true,
      }),
    ).toThrow("fields do not match");
  });
});
