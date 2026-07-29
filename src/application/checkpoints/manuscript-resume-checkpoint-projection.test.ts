import {
  randomInt,
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseManuscriptResumeCheckpointProjection,
} from "./manuscript-resume-checkpoint-projection";

describe("manuscript resume checkpoint projection", () => {
  it("preserves only exact resolved ownership and directional selection coordinates", () => {
    const value = {
      schemaVersion: 1,
      status: "resolved",
      workId: randomUUID(),
      documentId: randomUUID(),
      targetRevisionId: randomUUID(),
      selection: {
        anchor: randomInt(0, 1_000),
        head: randomInt(0, 1_000),
      },
    } as const;

    expect(
      parseManuscriptResumeCheckpointProjection(
        value,
      ),
    ).toEqual(value);
  });

  it("rejects extra fields and any move for unresolved evidence", () => {
    const unresolved = {
      schemaVersion: 1,
      status: "needsReview",
      workId: randomUUID(),
      documentId: randomUUID(),
      targetRevisionId: randomUUID(),
      move: null,
    } as const;
    expect(() =>
      parseManuscriptResumeCheckpointProjection({
        ...unresolved,
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow(/fields/u);
    expect(() =>
      parseManuscriptResumeCheckpointProjection({
        ...unresolved,
        move: {
          anchor: randomInt(0, 1_000),
          head: randomInt(0, 1_000),
        },
      }),
    ).toThrow(/cannot move/u);
  });
});
