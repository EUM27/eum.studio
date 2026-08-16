import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseSetWorkFavoriteCommand,
  parseWorkFavoritesProjection,
} from "./work-favorites";

describe("work favorites contract", () => {
  it("accepts an exact work-owned favorite update", () => {
    const workId = entityId<"Work">(randomUUID());

    expect(
      parseSetWorkFavoriteCommand({
        schemaVersion: 1,
        workId,
        favorite: true,
      }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      favorite: true,
    });
  });

  it("projects unique favorite work identities", () => {
    const firstWorkId = entityId<"Work">(randomUUID());
    const secondWorkId = entityId<"Work">(randomUUID());

    expect(
      parseWorkFavoritesProjection({
        schemaVersion: 1,
        workIds: [firstWorkId, secondWorkId],
      }),
    ).toEqual({
      schemaVersion: 1,
      workIds: [firstWorkId, secondWorkId],
    });
    expect(() =>
      parseWorkFavoritesProjection({
        schemaVersion: 1,
        workIds: [firstWorkId, firstWorkId],
      }),
    ).toThrow("Duplicate favorite Work");
  });

  it("rejects unsupported fields instead of widening the command", () => {
    expect(() =>
      parseSetWorkFavoriteCommand({
        schemaVersion: 1,
        workId: randomUUID(),
        favorite: true,
        documentId: randomUUID(),
      }),
    ).toThrow("Unsupported SetWorkFavoriteCommand field");
  });
});
