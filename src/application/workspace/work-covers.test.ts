import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseSaveWorkCoverCommand,
  parseSelectWorkCoverCommand,
  parseWorkCoversProjection,
} from "./work-covers";

describe("work cover contract", () => {
  it("keeps exact work ownership and image content", () => {
    const workId = entityId<"Work">(randomUUID());
    const cover = {
      schemaVersion: 1,
      workId,
      mediaType: "image/png",
      contentBase64: "aW1hZ2U=",
    } as const;

    expect(parseSelectWorkCoverCommand({ schemaVersion: 1, workId })).toEqual({
      schemaVersion: 1,
      workId,
    });
    expect(parseSaveWorkCoverCommand(cover)).toEqual(cover);
    expect(
      parseWorkCoversProjection({ schemaVersion: 1, covers: [cover] }),
    ).toEqual({ schemaVersion: 1, covers: [cover] });
  });

  it("rejects duplicate cover ownership", () => {
    const workId = entityId<"Work">(randomUUID());
    const cover = {
      schemaVersion: 1,
      workId,
      mediaType: "image/png",
      contentBase64: "aW1hZ2U=",
    } as const;

    expect(() =>
      parseWorkCoversProjection({ schemaVersion: 1, covers: [cover, cover] }),
    ).toThrow("Duplicate Work cover identity");
  });
});
