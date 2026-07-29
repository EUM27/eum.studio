import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parsePocRecoveryApplyRuntimeProfile,
} from "./poc-recovery-apply-runtime-profile";

function createProfileValue() {
  const workId = randomUUID();
  const documentId = randomUUID();
  const expectedBaseRevisionId = randomUUID();
  const revisionId = randomUUID();
  const expectedSafeReplayThroughByteOffset =
    randomInt(1, 1_024);
  const expectedSourceJournalEndByteOffset =
    expectedSafeReplayThroughByteOffset +
    randomInt(0, 1_024);
  return {
    schemaVersion: 1,
    compactionId: randomUUID(),
    expectedSourceJournalEndByteOffset,
    expectedSafeReplayThroughByteOffset,
    contentChecksumAlgorithm: randomUUID(),
    sourceJournalPath: randomUUID(),
    nextJournalPath: randomUUID(),
    publicationTemporaryPath: randomUUID(),
    publicationPath: randomUUID(),
    revisions: [
      {
        workId,
        documentId,
        expectedBaseRevisionId,
        revisionId,
        cause: randomUUID(),
        createdAt: new Date(
          Date.now() + randomInt(0, 1_000),
        ).toISOString(),
        durableAt: new Date(
          Date.now() + randomInt(1_001, 2_000),
        ).toISOString(),
        contentPath: randomUUID(),
      },
    ],
  };
}

function firstRevision(
  value: ReturnType<typeof createProfileValue>,
) {
  const revision = value.revisions[0];
  if (revision === undefined) {
    throw new Error("Expected a recovery revision");
  }
  return revision;
}

describe("parsePocRecoveryApplyRuntimeProfile", () => {
  it("strictly parses and deeply freezes every caller-owned recovery apply value", () => {
    const value = createProfileValue();

    const result =
      parsePocRecoveryApplyRuntimeProfile(value);

    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.revisions)).toBe(true);
    expect(Object.isFrozen(result.revisions[0])).toBe(true);
  });

  it.each([
    ["root", (value: ReturnType<typeof createProfileValue>) => {
      return { ...value, [randomUUID()]: randomUUID() };
    }],
    [
      "revision",
      (value: ReturnType<typeof createProfileValue>) => {
        const revision = firstRevision(value);
        return {
          ...value,
          revisions: [
            {
              ...revision,
              [randomUUID()]: randomUUID(),
            },
          ],
        };
      },
    ],
  ])("rejects an unsupported %s field", (_label, mutate) => {
    expect(() =>
      parsePocRecoveryApplyRuntimeProfile(
        mutate(createProfileValue()),
      ),
    ).toThrow(/Unsupported/);
  });

  it.each([
    "compactionId",
    "contentChecksumAlgorithm",
    "sourceJournalPath",
    "nextJournalPath",
    "publicationTemporaryPath",
    "publicationPath",
  ])("rejects an absent caller-owned %s", (field) => {
    const value = createProfileValue();
    Reflect.deleteProperty(value, field);

    expect(() =>
      parsePocRecoveryApplyRuntimeProfile(value),
    ).toThrow(field);
  });

  it.each([
    "workId",
    "documentId",
    "expectedBaseRevisionId",
    "revisionId",
    "cause",
    "createdAt",
    "durableAt",
    "contentPath",
  ])("rejects an empty revision %s", (field) => {
    const value = createProfileValue();
    Object.assign(firstRevision(value), {
      [field]: "",
    });

    expect(() =>
      parsePocRecoveryApplyRuntimeProfile(value),
    ).toThrow(field);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -randomInt(1, 1_024),
    Number.MAX_SAFE_INTEGER + randomInt(1, 1_024),
  ])(
    "rejects an invalid source journal boundary %s",
    (boundary) => {
      const value = createProfileValue();
      value.expectedSourceJournalEndByteOffset =
        boundary;

      expect(() =>
        parsePocRecoveryApplyRuntimeProfile(value),
      ).toThrow(/expectedSourceJournalEndByteOffset/);
    },
  );

  it("rejects a safe replay boundary after the expected source journal end", () => {
    const value = createProfileValue();
    value.expectedSafeReplayThroughByteOffset =
      value.expectedSourceJournalEndByteOffset +
      randomInt(1, 1_024);

    expect(() =>
      parsePocRecoveryApplyRuntimeProfile(value),
    ).toThrow(/expectedSafeReplayThroughByteOffset/);
  });

  it.each(["document", "revision"])(
    "rejects a duplicate %s identity",
    (identity) => {
      const value = createProfileValue();
      const revision = firstRevision(value);
      value.revisions.push({
        ...revision,
        documentId:
          identity === "document"
            ? revision.documentId
            : randomUUID(),
        revisionId:
          identity === "revision"
            ? revision.revisionId
            : randomUUID(),
        contentPath: randomUUID(),
      });

      expect(() =>
        parsePocRecoveryApplyRuntimeProfile(value),
      ).toThrow(/Duplicate/);
    },
  );

  it("requires at least one exact affected revision plan", () => {
    const value = createProfileValue();
    value.revisions = [];

    expect(() =>
      parsePocRecoveryApplyRuntimeProfile(value),
    ).toThrow(/revisions/);
  });
});
