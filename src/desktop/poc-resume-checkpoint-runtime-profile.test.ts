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
  parsePocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";

function createProfile() {
  const recordedAt =
    new Date().toISOString();
  const workId = randomUUID();
  const documentId = randomUUID();
  const revisionId = randomUUID();
  const content = randomUUID();
  return {
    schemaVersion: 1,
    codecId: randomUUID(),
    publicationChecksumAlgorithm:
      randomUUID(),
    anchorEvidenceChecksumAlgorithm:
      randomUUID(),
    storagePlan: {
      publicationId: randomUUID(),
      publicationTemporaryPath:
        randomUUID(),
      publicationPath: randomUUID(),
    },
    works: [
      {
        meta: {
          id: workId,
          schemaVersion:
            randomInt(1, 32),
          revision:
            randomInt(0, 32),
          createdAt: recordedAt,
          updatedAt: recordedAt,
        },
        studioId: randomUUID(),
        title: randomUUID(),
        orderKey: randomUUID(),
        settingsId: randomUUID(),
      },
    ],
    documents: [
      {
        meta: {
          id: documentId,
          schemaVersion:
            randomInt(1, 32),
          revision:
            randomInt(0, 32),
          createdAt: recordedAt,
          updatedAt: recordedAt,
        },
        workId,
        title: randomUUID(),
        orderKey: randomUUID(),
        manuscriptId: randomUUID(),
      },
    ],
    revisions: [
      {
        revision: {
          id: revisionId,
          documentId,
          contentRef: randomUUID(),
          contentHash: randomUUID(),
          length: content.length,
          cause: randomUUID(),
          createdAt: recordedAt,
          durableAt: recordedAt,
        },
        content,
      },
    ],
    publicationRevisionHeads: [
      {
        documentId,
        revisionId,
      },
    ],
    baselineCheckpoints: [],
    anchors: [],
  };
}

describe("POC ResumeCheckpoint runtime profile", () => {
  it("strictly parses caller-owned storage, state, revision content, and algorithms", () => {
    const input = createProfile();
    const profile =
      parsePocResumeCheckpointRuntimeProfile(
        input,
      );

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(
      true,
    );
    expect(
      Object.isFrozen(profile.revisions),
    ).toBe(true);
  });

  it("rejects unsupported fields, duplicate identities, and revision length conflicts", () => {
    const unsupported = {
      ...createProfile(),
      [randomUUID()]: randomUUID(),
    };
    expect(() =>
      parsePocResumeCheckpointRuntimeProfile(
        unsupported,
      ),
    ).toThrow(/Unsupported/u);

    const duplicate = createProfile();
    duplicate.works.push(
      duplicate.works[0] as
        (typeof duplicate.works)[number],
    );
    expect(() =>
      parsePocResumeCheckpointRuntimeProfile(
        duplicate,
      ),
    ).toThrow(/Duplicate Work/u);

    const lengthConflict =
      createProfile();
    const source =
      lengthConflict.revisions[0];
    if (source === undefined) {
      throw new Error(
        "Test profile has no revision",
      );
    }
    source.revision.length += 1;
    expect(() =>
      parsePocResumeCheckpointRuntimeProfile(
        lengthConflict,
      ),
    ).toThrow(
      /Revision content length conflict/u,
    );
  });
});
