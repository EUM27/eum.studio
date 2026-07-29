import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  appendFile,
  mkdtemp,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../application/persistence/change-batch";
import {
  createApplyStartupRecoveryCommand,
} from "../application/persistence/startup-recovery-contract";
import { appendJournalPayloadDurably } from "../platform/journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import {
  applyManuscriptStartupRecovery,
  isManuscriptStartupRecoveryApplyAvailable,
} from "./apply-manuscript-startup-recovery";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  resolveManuscriptStartupRecovery,
  type ManuscriptStartupRecoveryResult,
} from "./manuscript-startup-recovery";
import {
  parsePocRecoveryApplyRuntimeProfile,
  type PocRecoveryApplyRuntimeProfile,
} from "./poc-recovery-apply-runtime-profile";

const temporaryDirectories: string[] = [];

function usableHashAlgorithms(): readonly string[] {
  return getHashes().filter((algorithm) => {
    try {
      createHash(algorithm).digest();
      return true;
    } catch {
      return false;
    }
  });
}

function selectHashAlgorithm(
  excludedAlgorithm?: string,
): string {
  const algorithms = usableHashAlgorithms().filter(
    (algorithm) =>
      algorithm !== excludedAlgorithm,
  );
  const algorithm =
    algorithms[randomInt(0, algorithms.length)];
  if (algorithm === undefined) {
    throw new Error(
      "Test runtime exposes no requested hash algorithm",
    );
  }
  return algorithm;
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function pathPresence(
  filePath: string,
): Promise<"present" | "missing"> {
  try {
    await stat(filePath);
    return "present";
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return "missing";
    }
    throw error;
  }
}

afterEach(async () => {
  const temporaryRoot = resolve(tmpdir());
  for (const directory of temporaryDirectories.splice(0)) {
    const resolvedDirectory = resolve(directory);
    if (
      resolvedDirectory === temporaryRoot ||
      !resolvedDirectory.startsWith(temporaryRoot)
    ) {
      throw new Error(
        "Refusing to remove a test directory outside the OS temporary root",
      );
    }
    await rm(resolvedDirectory, {
      recursive: true,
      force: true,
    });
  }
});

async function createScenario(input?: {
  readonly withTail?: boolean;
}) {
  const directory = await createTemporaryDirectory();
  const workId = randomUUID();
  const documentId = randomUUID();
  const baseRevisionId = randomUUID();
  const initialText = randomUUID();
  const insertedText = randomUUID();
  const nextSequence = randomInt(0, 10_000);
  const journalPath = join(directory, randomUUID());
  const journalChecksumAlgorithm =
    selectHashAlgorithm();
  const contentChecksumAlgorithm =
    selectHashAlgorithm(
      journalChecksumAlgorithm,
    );
  const documentProfile =
    parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId: documentId,
      documents: [
        {
          workId,
          documentId,
          documentRevisionId: baseRevisionId,
          label: randomUUID(),
          initialText,
        },
      ],
    });
  const journalProfile =
    parseManuscriptJournalRuntimeProfile({
      schemaVersion: 1,
      journalPath,
      checksumAlgorithm:
        journalChecksumAlgorithm,
      documentSequences: [
        {
          documentId,
          nextSequence,
        },
      ],
    });
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId,
    documentId,
    baseRevisionId,
    sequence: nextSequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: initialText.length,
    afterTextLengthUtf16:
      initialText.length + insertedText.length,
    changes: [
      {
        fromUtf16: initialText.length,
        toUtf16: initialText.length,
        insertedText,
      },
    ],
  });
  const payload = serializeCanonicalChangeBatch(batch);
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath,
      payload,
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          journalChecksumAlgorithm,
        ),
    });
  let sourceJournalEndByteOffset =
    appendReceipt.frameEndByteOffset;
  if (input?.withTail === true) {
    const tailBytes = crypto.getRandomValues(
      new Uint8Array(randomInt(1, 64)),
    );
    await appendFile(journalPath, tailBytes);
    sourceJournalEndByteOffset +=
      tailBytes.byteLength;
  }
  const timestamp = new Date().toISOString();
  const applyProfile =
    parsePocRecoveryApplyRuntimeProfile({
      schemaVersion: 1,
      compactionId: randomUUID(),
      expectedSourceJournalEndByteOffset:
        sourceJournalEndByteOffset,
      expectedSafeReplayThroughByteOffset:
        appendReceipt.frameEndByteOffset,
      contentChecksumAlgorithm,
      sourceJournalPath: journalPath,
      nextJournalPath: join(
        directory,
        randomUUID(),
      ),
      publicationTemporaryPath: join(
        directory,
        randomUUID(),
      ),
      publicationPath: join(
        directory,
        randomUUID(),
      ),
      revisions: [
        {
          workId,
          documentId,
          expectedBaseRevisionId:
            baseRevisionId,
          revisionId: randomUUID(),
          cause: randomUUID(),
          createdAt: timestamp,
          durableAt: timestamp,
          contentPath: join(
            directory,
            randomUUID(),
          ),
        },
      ],
    });
  const startup =
    await resolveManuscriptStartupRecovery({
      baselineDocumentProfile: documentProfile,
      baselineJournalProfile: journalProfile,
      recoveryApplyProfile: applyProfile,
    });
  if (
    startup.status !== "ready" ||
    startup.recovery.status !==
      "recovery-pending"
  ) {
    throw new Error(
      "Expected a pending startup recovery",
    );
  }
  return {
    directory,
    workId,
    documentId,
    baseRevisionId,
    initialText,
    insertedText,
    nextSequence,
    documentProfile,
    journalProfile,
    applyProfile,
    startup,
    expectedText: initialText + insertedText,
  };
}

function firstRevision(
  profile: PocRecoveryApplyRuntimeProfile,
) {
  const revision = profile.revisions[0];
  if (revision === undefined) {
    throw new Error("Expected a recovery revision");
  }
  return revision;
}

function currentCandidate(
  startup: Extract<
    ManuscriptStartupRecoveryResult,
    { readonly status: "ready" }
  >,
) {
  if (
    startup.recovery.status !==
    "recovery-pending"
  ) {
    throw new Error(
      "Expected a current recovery candidate",
    );
  }
  return startup.recovery.candidate;
}

describe("applyManuscriptStartupRecovery", () => {
  it("publishes the exact candidate as a new immutable revision and only then advances to the next generation", async () => {
    const scenario = await createScenario();
    const candidate = currentCandidate(
      scenario.startup,
    );
    const command =
      createApplyStartupRecoveryCommand(candidate);
    const revision = firstRevision(
      scenario.applyProfile,
    );

    expect(
      isManuscriptStartupRecoveryApplyAvailable({
        startup: scenario.startup,
        applyProfile: scenario.applyProfile,
      }),
    ).toBe(true);

    const result =
      await applyManuscriptStartupRecovery({
        baselineDocumentProfile:
          scenario.documentProfile,
        baselineJournalProfile:
          scenario.journalProfile,
        startup: scenario.startup,
        applyProfile: scenario.applyProfile,
        command,
      });

    expect(result.schemaVersion).toBe(1);
    expect(result.reclamation).toBe("completed");
    expect(result.documentProfile.documents[0]).toMatchObject({
      workId: scenario.workId,
      documentId: scenario.documentId,
      documentRevisionId: revision.revisionId,
      initialText: scenario.expectedText,
    });
    expect(result.journalProfile).toMatchObject({
      journalPath:
        scenario.applyProfile.nextJournalPath,
      documentSequences: [
        {
          documentId: scenario.documentId,
          nextSequence:
            scenario.nextSequence + 1,
        },
      ],
    });
    expect(result.recovery).toEqual({
      schemaVersion: 1,
      status: "clean",
      issues: [],
    });
    expect(
      await pathPresence(
        scenario.applyProfile.publicationPath,
      ),
    ).toBe("present");
    expect(
      await pathPresence(
        scenario.applyProfile.sourceJournalPath,
      ),
    ).toBe("missing");
    expect(
      scenario.documentProfile.documents[0],
    ).toMatchObject({
      documentRevisionId:
        scenario.baseRevisionId,
      initialText: scenario.initialText,
    });
  });

  it("retains an issue suffix byte-for-byte in the old generation after publishing the safe prefix", async () => {
    const scenario = await createScenario({
      withTail: true,
    });
    const sourceBytesBefore = await import(
      "node:fs/promises"
    ).then(({ readFile }) =>
      readFile(
        scenario.applyProfile.sourceJournalPath,
      ),
    );
    const candidate = currentCandidate(
      scenario.startup,
    );

    const result =
      await applyManuscriptStartupRecovery({
        baselineDocumentProfile:
          scenario.documentProfile,
        baselineJournalProfile:
          scenario.journalProfile,
        startup: scenario.startup,
        applyProfile: scenario.applyProfile,
        command:
          createApplyStartupRecoveryCommand(
            candidate,
          ),
      });

    expect(result.reclamation).toBe("pending");
    expect(
      await import("node:fs/promises").then(
        ({ readFile }) =>
          readFile(
            scenario.applyProfile
              .sourceJournalPath,
          ),
      ),
    ).toEqual(sourceBytesBefore);
    expect(result.documentProfile.documents[0]).toMatchObject({
      initialText: scenario.expectedText,
      documentRevisionId: firstRevision(
        scenario.applyProfile,
      ).revisionId,
    });
    expect(result.recovery.status).toBe("clean");
  });

  it("rejects a stale candidate command without creating a publication", async () => {
    const scenario = await createScenario();
    const candidate = currentCandidate(
      scenario.startup,
    );
    const command = {
      ...createApplyStartupRecoveryCommand(
        candidate,
      ),
      expectedSourceJournalEndByteOffset:
        candidate.sourceJournalEndByteOffset + 1,
    };

    await expect(
      applyManuscriptStartupRecovery({
        baselineDocumentProfile:
          scenario.documentProfile,
        baselineJournalProfile:
          scenario.journalProfile,
        startup: scenario.startup,
        applyProfile: scenario.applyProfile,
        command,
      }),
    ).rejects.toThrow(/candidate/i);
    expect(
      await pathPresence(
        scenario.applyProfile.publicationPath,
      ),
    ).toBe("missing");
    expect(
      await pathPresence(
        scenario.applyProfile.sourceJournalPath,
      ),
    ).toBe("present");
  });

  it("rejects a caller apply profile whose safe boundary differs from the current candidate", async () => {
    const scenario = await createScenario();
    const candidate = currentCandidate(
      scenario.startup,
    );
    const mismatchedProfile =
      parsePocRecoveryApplyRuntimeProfile({
        ...scenario.applyProfile,
        expectedSafeReplayThroughByteOffset:
          scenario.applyProfile
            .expectedSafeReplayThroughByteOffset -
          1,
      });

    expect(
      isManuscriptStartupRecoveryApplyAvailable({
        startup: scenario.startup,
        applyProfile: mismatchedProfile,
      }),
    ).toBe(false);
    await expect(
      applyManuscriptStartupRecovery({
        baselineDocumentProfile:
          scenario.documentProfile,
        baselineJournalProfile:
          scenario.journalProfile,
        startup: scenario.startup,
        applyProfile: mismatchedProfile,
        command:
          createApplyStartupRecoveryCommand(
            candidate,
          ),
      }),
    ).rejects.toThrow(/profile/i);
    expect(
      await pathPresence(
        scenario.applyProfile.publicationPath,
      ),
    ).toBe("missing");
  });
});
