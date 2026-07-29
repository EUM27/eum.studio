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
  parsePoc2DurabilityCrashWorkerProfile,
} from "./poc-2-durability-crash-worker";

function createCompactionProfile() {
  const compactionId = randomUUID();
  const workId = randomUUID();
  const documentId = randomUUID();
  const baseRevisionId = randomUUID();
  const revisionId = randomUUID();
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    kind: "compaction",
    scenarioId: randomUUID(),
    targetStage:
      Math.random() >= 0.5
        ? "publication-temp-synced"
        : "publication-renamed",
    reachedPath: randomUUID(),
    checksumAlgorithm: randomUUID(),
    storagePlan: {
      compactionId,
      sourceJournalPath: randomUUID(),
      nextJournalPath: randomUUID(),
      publicationTemporaryPath: randomUUID(),
      publicationPath: randomUUID(),
      revisionFiles: [
        {
          revisionId,
          contentPath: randomUUID(),
        },
      ],
    },
    expectedJournalEndByteOffset:
      randomInt(0, 10_000),
    target: {
      workId,
      documentId,
      baseRevisionId,
      nextSequence: randomInt(0, 10_000),
      text: randomUUID(),
    },
    payloadBase64: Buffer.from(
      randomUUID(),
    ).toString("base64"),
    revisionPlan: {
      workId,
      documentId,
      expectedBaseRevisionId:
        baseRevisionId,
      revisionId,
      cause: randomUUID(),
      createdAt: timestamp,
      durableAt: timestamp,
    },
  } as const;
}

function createCheckpointProfile(
  revisionContent: string,
) {
  return {
    schemaVersion: 1,
    kind: "checkpoint",
    scenarioId: randomUUID(),
    targetStage:
      Math.random() >= 0.5
        ? "publication-temp-synced"
        : "publication-renamed",
    reachedPath: randomUUID(),
    checksumAlgorithm: randomUUID(),
    codecId: randomUUID(),
    storagePlan: {
      publicationId: randomUUID(),
      publicationTemporaryPath:
        randomUUID(),
      publicationPath: randomUUID(),
    },
    work: {
      [randomUUID()]: randomUUID(),
    },
    document: {
      [randomUUID()]: randomUUID(),
    },
    revision: {
      [randomUUID()]: randomUUID(),
    },
    revisionContent,
    baselineCheckpoints: [],
    checkpoint: {
      [randomUUID()]: randomUUID(),
    },
    anchors: [],
    expectedWorkRevision:
      randomInt(0, 10_000),
    expectedResumeCheckpointId: null,
    expectedCurrentDocumentRevisionId:
      randomUUID(),
  } as const;
}

describe("POC-2 durability crash worker profile", () => {
  it("strictly accepts a caller-complete compaction profile", () => {
    const profile = createCompactionProfile();

    expect(
      parsePoc2DurabilityCrashWorkerProfile(
        profile,
      ),
    ).toEqual(profile);
  });

  it("rejects missing and unsupported root fields without adding defaults", () => {
    const profile = {
      ...createCompactionProfile(),
    } as Record<string, unknown>;
    Reflect.deleteProperty(
      profile,
      "checksumAlgorithm",
    );

    expect(() =>
      parsePoc2DurabilityCrashWorkerProfile(
        profile,
      ),
    ).toThrow(/checksumAlgorithm/);
    expect(() =>
      parsePoc2DurabilityCrashWorkerProfile({
        ...createCompactionProfile(),
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow(/Unsupported/);
  });

  it("accepts an empty manuscript replay source without adding a length limit", () => {
    const source =
      createCompactionProfile();
    const profile = {
      ...source,
      target: {
        ...source.target,
        text: "",
      },
    };

    expect(() =>
      parsePoc2DurabilityCrashWorkerProfile(
        profile,
      ),
    ).not.toThrow();
  });

  it("accepts empty checkpoint revision content without adding a length limit", () => {
    expect(() =>
      parsePoc2DurabilityCrashWorkerProfile(
        createCheckpointProfile(""),
      ),
    ).not.toThrow();
  });
});
