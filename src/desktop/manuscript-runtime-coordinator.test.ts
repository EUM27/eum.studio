import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
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
import { parseManuscriptBatchingPolicy } from "../application/persistence/manuscript-persistence-profile";
import { createApplyStartupRecoveryCommand } from "../application/persistence/startup-recovery-contract";
import { appendJournalPayloadDurably } from "../platform/journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import {
  createManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  parsePocRecoveryApplyRuntimeProfile,
} from "./poc-recovery-apply-runtime-profile";

const temporaryDirectories: string[] = [];

function selectHashAlgorithm(
  excludedAlgorithm?: string,
): string {
  const algorithms = getHashes().filter(
    (algorithm) => {
      if (algorithm === excludedAlgorithm) {
        return false;
      }
      try {
        createHash(algorithm).digest();
        return true;
      } catch {
        return false;
      }
    },
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

function createAppendBatch(input: {
  readonly workId: string;
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly sequence: number;
  readonly beforeText: string;
  readonly insertedText: string;
}) {
  return parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: input.workId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    sequence: input.sequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: input.beforeText.length,
    afterTextLengthUtf16:
      input.beforeText.length + input.insertedText.length,
    changes: [
      {
        fromUtf16: input.beforeText.length,
        toUtf16: input.beforeText.length,
        insertedText: input.insertedText,
      },
    ],
  });
}

async function createPendingScenario() {
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
  const batchingPolicy =
    parseManuscriptBatchingPolicy({
      schemaVersion: 1,
      maxTransactionsPerBatch:
        randomInt(1, 64),
      maxDelayMs: randomInt(0, 1_000),
    });
  const firstBatch = createAppendBatch({
    workId,
    documentId,
    baseRevisionId,
    sequence: nextSequence,
    beforeText: initialText,
    insertedText,
  });
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath,
      payload:
        serializeCanonicalChangeBatch(firstBatch),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          journalChecksumAlgorithm,
        ),
    });
  const timestamp = new Date().toISOString();
  const newRevisionId = randomUUID();
  const applyProfile =
    parsePocRecoveryApplyRuntimeProfile({
      schemaVersion: 1,
      compactionId: randomUUID(),
      expectedSourceJournalEndByteOffset:
        appendReceipt.frameEndByteOffset,
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
          revisionId: newRevisionId,
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
  return {
    directory,
    workId,
    documentId,
    baseRevisionId,
    newRevisionId,
    initialText,
    insertedText,
    expectedText: initialText + insertedText,
    nextSequence,
    documentProfile,
    journalProfile,
    batchingPolicy,
    applyProfile,
  };
}

describe("manuscript runtime coordinator", () => {
  it("projects a configured pending candidate but denies durable save until explicit recovery", async () => {
    const scenario = await createPendingScenario();
    const coordinator =
      await createManuscriptRuntimeCoordinator({
        documentProfile:
          scenario.documentProfile,
        journalProfile:
          scenario.journalProfile,
        batchingPolicy:
          scenario.batchingPolicy,
        recoveryApplyProfile:
          scenario.applyProfile,
        resumeCheckpointProfile: null,
      });

    const recovery =
      coordinator.getManuscriptStartupRecovery();
    expect(recovery.status).toBe(
      "recovery-pending",
    );
    if (recovery.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(recovery.applyAvailable).toBe(true);
    expect(
      coordinator.getManuscriptPersistenceProfile(),
    ).toBeNull();
    await expect(
      coordinator.saveChangeBatch({}),
    ).rejects.toThrow(/unavailable/i);
  });

  it("switches every query and subsequent save to the published revision only after explicit apply", async () => {
    const scenario = await createPendingScenario();
    const coordinator =
      await createManuscriptRuntimeCoordinator({
        documentProfile:
          scenario.documentProfile,
        journalProfile:
          scenario.journalProfile,
        batchingPolicy:
          scenario.batchingPolicy,
        recoveryApplyProfile:
          scenario.applyProfile,
        resumeCheckpointProfile: null,
      });
    const recovery =
      coordinator.getManuscriptStartupRecovery();
    if (recovery.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }

    const acknowledgement =
      await coordinator.applyManuscriptStartupRecovery(
        createApplyStartupRecoveryCommand(
          recovery.candidate,
        ),
      );

    expect(acknowledgement).toEqual({
      schemaVersion: 1,
      status: "applied",
      compactionId:
        scenario.applyProfile.compactionId,
      consumedThroughByteOffset:
        scenario.applyProfile
          .expectedSourceJournalEndByteOffset,
      reclamation: "completed",
    });
    expect(
      coordinator.getManuscriptDocumentProfile()
        .documents[0],
    ).toMatchObject({
      documentRevisionId:
        scenario.newRevisionId,
      initialText: scenario.expectedText,
    });
    expect(
      coordinator.getManuscriptPersistenceProfile(),
    ).toMatchObject({
      documentSequences: [
        {
          documentId: scenario.documentId,
          nextSequence:
            scenario.nextSequence + 1,
        },
      ],
    });
    expect(
      coordinator.getManuscriptStartupRecovery(),
    ).toEqual({
      schemaVersion: 1,
      status: "clean",
      issues: [],
    });

    const secondInsertion = randomUUID();
    const secondBatch = createAppendBatch({
      workId: scenario.workId,
      documentId: scenario.documentId,
      baseRevisionId:
        scenario.newRevisionId,
      sequence: scenario.nextSequence + 1,
      beforeText: scenario.expectedText,
      insertedText: secondInsertion,
    });
    const receipt =
      await coordinator.saveChangeBatch(
        secondBatch,
      );

    expect(receipt).toMatchObject({
      workId: scenario.workId,
      documentId: scenario.documentId,
      baseRevisionId:
        scenario.newRevisionId,
      sequence: scenario.nextSequence + 1,
    });
    expect(
      await pathPresence(
        scenario.applyProfile.nextJournalPath,
      ),
    ).toBe("present");
  });

  it("keeps a pending candidate non-applicable when no caller apply profile exists", async () => {
    const scenario = await createPendingScenario();
    const coordinator =
      await createManuscriptRuntimeCoordinator({
        documentProfile:
          scenario.documentProfile,
        journalProfile:
          scenario.journalProfile,
        batchingPolicy:
          scenario.batchingPolicy,
        recoveryApplyProfile: null,
        resumeCheckpointProfile: null,
      });
    const recovery =
      coordinator.getManuscriptStartupRecovery();
    expect(recovery.status).toBe(
      "recovery-pending",
    );
    if (recovery.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(recovery.applyAvailable).toBe(false);

    await expect(
      coordinator.applyManuscriptStartupRecovery(
        createApplyStartupRecoveryCommand(
          recovery.candidate,
        ),
      ),
    ).rejects.toThrow(/profile/i);
    expect(
      await pathPresence(
        scenario.applyProfile.publicationPath,
      ),
    ).toBe("missing");
  });

  it("preserves an unconfigured runtime as clean but unavailable instead of inventing storage values", async () => {
    const scenario = await createPendingScenario();
    const coordinator =
      await createManuscriptRuntimeCoordinator({
        documentProfile:
          scenario.documentProfile,
        journalProfile: null,
        batchingPolicy: null,
        recoveryApplyProfile: null,
        resumeCheckpointProfile: null,
      });

    expect(
      coordinator.getManuscriptStartupRecovery(),
    ).toEqual({
      schemaVersion: 1,
      status: "clean",
      issues: [],
    });
    expect(
      coordinator.getManuscriptPersistenceProfile(),
    ).toBeNull();
    await expect(
      coordinator.saveChangeBatch({}),
    ).rejects.toThrow(/unavailable/i);
  });
});
