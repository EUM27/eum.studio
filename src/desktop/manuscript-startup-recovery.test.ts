import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
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
  CompactJournalIntoRevision,
} from "../application/persistence/compact-journal-into-revision";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../application/persistence/change-batch";
import {
  entityId,
} from "../domain/writing";
import { appendJournalPayloadDurably } from "../platform/journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import { createPocJournalCompactionPort } from "../platform/persistence/poc-journal-compaction-port";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  resolveManuscriptStartupRecovery,
} from "./manuscript-startup-recovery";
import {
  parsePocRecoveryApplyRuntimeProfile,
  type PocRecoveryApplyRuntimeProfile,
} from "./poc-recovery-apply-runtime-profile";

const temporaryDirectories: string[] = [];

function selectRuntimeHashAlgorithm(): string {
  const algorithms = getHashes().filter((algorithm) => {
    try {
      createHash(algorithm).digest();
      return true;
    } catch {
      return false;
    }
  });
  const algorithm =
    algorithms[randomInt(0, algorithms.length)];
  if (algorithm === undefined) {
    throw new Error("Test runtime exposes no hash algorithm");
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

async function createBaseline() {
  const directory = await createTemporaryDirectory();
  const workId = randomUUID();
  const documentId = randomUUID();
  const baseRevisionId = randomUUID();
  const initialText = randomUUID();
  const nextSequence = randomInt(0, 10_000);
  const journalPath = join(directory, randomUUID());
  const checksumAlgorithm =
    selectRuntimeHashAlgorithm();
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
      checksumAlgorithm,
      documentSequences: [
        {
          documentId,
          nextSequence,
        },
      ],
    });
  return {
    directory,
    workId: entityId<"Work">(workId),
    documentId: entityId<"Document">(documentId),
    baseRevisionId:
      entityId<"DocumentRevision">(baseRevisionId),
    initialText,
    nextSequence,
    checksumAlgorithm,
    journalPath,
    documentProfile,
    journalProfile,
  };
}

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

async function appendBaselineBatch(
  baseline: Awaited<ReturnType<typeof createBaseline>>,
  input?: {
    readonly baseRevisionId?: string;
    readonly sequence?: number;
    readonly beforeText?: string;
  },
) {
  const insertedText = randomUUID();
  const batch = createAppendBatch({
    workId: baseline.workId,
    documentId: baseline.documentId,
    baseRevisionId:
      input?.baseRevisionId ??
      baseline.baseRevisionId,
    sequence:
      input?.sequence ?? baseline.nextSequence,
    beforeText:
      input?.beforeText ?? baseline.initialText,
    insertedText,
  });
  const payload = serializeCanonicalChangeBatch(batch);
  const receipt = await appendJournalPayloadDurably({
    journalPath: baseline.journalPath,
    payload,
    checksumAdapter:
      createNodeCryptoJournalChecksumAdapter(
        baseline.checksumAlgorithm,
      ),
  });
  return {
    batch,
    payload,
    receipt,
    insertedText,
    expectedText:
      (input?.beforeText ?? baseline.initialText) +
      insertedText,
  };
}

function createApplyProfile(input: {
  readonly baseline: Awaited<
    ReturnType<typeof createBaseline>
  >;
  readonly expectedSourceJournalEndByteOffset: number;
  readonly expectedSafeReplayThroughByteOffset: number;
}): PocRecoveryApplyRuntimeProfile {
  const { baseline } = input;
  const timestamp = new Date().toISOString();
  return parsePocRecoveryApplyRuntimeProfile({
    schemaVersion: 1,
    compactionId: randomUUID(),
    expectedSourceJournalEndByteOffset:
      input.expectedSourceJournalEndByteOffset,
    expectedSafeReplayThroughByteOffset:
      input.expectedSafeReplayThroughByteOffset,
    contentChecksumAlgorithm:
      selectRuntimeHashAlgorithm(),
    sourceJournalPath: baseline.journalPath,
    nextJournalPath: join(
      baseline.directory,
      randomUUID(),
    ),
    publicationTemporaryPath: join(
      baseline.directory,
      randomUUID(),
    ),
    publicationPath: join(
      baseline.directory,
      randomUUID(),
    ),
    revisions: [
      {
        workId: baseline.workId,
        documentId: baseline.documentId,
        expectedBaseRevisionId:
          baseline.baseRevisionId,
        revisionId: randomUUID(),
        cause: randomUUID(),
        createdAt: timestamp,
        durableAt: timestamp,
        contentPath: join(
          baseline.directory,
          randomUUID(),
        ),
      },
    ],
  });
}

function firstRevision(
  profile: PocRecoveryApplyRuntimeProfile,
) {
  const revision = profile.revisions[0];
  if (revision === undefined) {
    throw new Error("Expected one recovery revision");
  }
  return revision;
}

async function publishRecovery(input: {
  readonly baseline: Awaited<
    ReturnType<typeof createBaseline>
  >;
  readonly appended: Awaited<
    ReturnType<typeof appendBaselineBatch>
  >;
  readonly applyProfile: PocRecoveryApplyRuntimeProfile;
}) {
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      input.applyProfile.contentChecksumAlgorithm,
    );
  const command = new CompactJournalIntoRevision({
    checksumAdapter,
    port: createPocJournalCompactionPort({
      storagePlan: {
        compactionId:
          input.applyProfile.compactionId,
        sourceJournalPath:
          input.applyProfile.sourceJournalPath,
        nextJournalPath:
          input.applyProfile.nextJournalPath,
        publicationTemporaryPath:
          input.applyProfile
            .publicationTemporaryPath,
        publicationPath:
          input.applyProfile.publicationPath,
        revisionFiles:
          input.applyProfile.revisions.map(
            (revision) => ({
              revisionId: revision.revisionId,
              contentPath: revision.contentPath,
            }),
          ),
      },
      checksumAdapter,
    }),
  });
  await command.execute({
    compactionId: input.applyProfile.compactionId,
    expectedJournalEndByteOffset:
      input.applyProfile
        .expectedSourceJournalEndByteOffset,
    targets: [
      {
        workId: input.baseline.workId,
        documentId: input.baseline.documentId,
        baseRevisionId:
          input.baseline.baseRevisionId,
        nextSequence: input.baseline.nextSequence,
        text: input.baseline.initialText,
      },
    ],
    payloads: [input.appended.payload],
    revisionPlans: input.applyProfile.revisions,
  });
}

describe("resolveManuscriptStartupRecovery", () => {
  it("uses the baseline revision and reports clean when its exact journal does not exist", async () => {
    const baseline = await createBaseline();

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: null,
      });

    expect(result).toEqual({
      status: "ready",
      confirmedSource: "baseline",
      documentProfile: baseline.documentProfile,
      journalProfile: baseline.journalProfile,
      recovery: {
        status: "clean",
        issues: [],
      },
    });
    expect(
      await pathPresence(baseline.journalPath),
    ).toBe("missing");
  });

  it("scans the baseline generation and creates the exact pending candidate", async () => {
    const baseline = await createBaseline();
    const appended =
      await appendBaselineBatch(baseline);

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: null,
      });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready startup");
    }
    expect(result.confirmedSource).toBe("baseline");
    expect(result.recovery.status).toBe(
      "recovery-pending",
    );
    if (
      result.recovery.status !== "recovery-pending"
    ) {
      throw new Error("Expected recovery-pending");
    }
    expect(
      result.recovery.candidate.affectedDocuments,
    ).toEqual([
      {
        workId: baseline.workId,
        documentId: baseline.documentId,
        baseRevisionId: baseline.baseRevisionId,
        recoveredText: appended.expectedText,
        nextSequence: baseline.nextSequence + 1,
      },
    ]);
    expect(
      result.recovery.candidate
        .sourceJournalEndByteOffset,
    ).toBe(appended.receipt.frameEndByteOffset);
  });

  it("selects a valid published revision and scans only its active next generation", async () => {
    const baseline = await createBaseline();
    const appended =
      await appendBaselineBatch(baseline);
    const applyProfile = createApplyProfile({
      baseline,
      expectedSourceJournalEndByteOffset:
        appended.receipt.frameEndByteOffset,
      expectedSafeReplayThroughByteOffset:
        appended.receipt.frameEndByteOffset,
    });
    await publishRecovery({
      baseline,
      appended,
      applyProfile,
    });
    const revision = firstRevision(applyProfile);
    const activeInsertion = randomUUID();
    const activeBatch = createAppendBatch({
      workId: baseline.workId,
      documentId: baseline.documentId,
      baseRevisionId: revision.revisionId,
      sequence: baseline.nextSequence + 1,
      beforeText: appended.expectedText,
      insertedText: activeInsertion,
    });
    await appendJournalPayloadDurably({
      journalPath: applyProfile.nextJournalPath,
      payload:
        serializeCanonicalChangeBatch(activeBatch),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          baseline.checksumAlgorithm,
        ),
    });

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: applyProfile,
      });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready startup");
    }
    expect(result.confirmedSource).toBe("published");
    expect(result.documentProfile.documents[0]).toMatchObject({
      workId: baseline.workId,
      documentId: baseline.documentId,
      documentRevisionId: revision.revisionId,
      initialText: appended.expectedText,
    });
    expect(result.journalProfile).toMatchObject({
      journalPath: applyProfile.nextJournalPath,
      documentSequences: [
        {
          documentId: baseline.documentId,
          nextSequence: baseline.nextSequence + 1,
        },
      ],
    });
    expect(result.recovery.status).toBe(
      "recovery-pending",
    );
    if (
      result.recovery.status !== "recovery-pending"
    ) {
      throw new Error("Expected active recovery candidate");
    }
    expect(
      result.recovery.candidate
        .affectedDocuments[0],
    ).toMatchObject({
      baseRevisionId: revision.revisionId,
      recoveredText:
        appended.expectedText + activeInsertion,
      nextSequence: baseline.nextSequence + 2,
    });
  });

  it("reports an invalid final publication as read-only without falling back to the baseline", async () => {
    const baseline = await createBaseline();
    const applyProfile = createApplyProfile({
      baseline,
      expectedSourceJournalEndByteOffset: 0,
      expectedSafeReplayThroughByteOffset: 0,
    });
    const invalidPublicationBytes =
      new TextEncoder().encode(randomUUID());
    await writeFile(
      applyProfile.publicationPath,
      invalidPublicationBytes,
    );

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: applyProfile,
      });

    expect(result).toEqual({
      status: "read-only-error",
      confirmedSource: "publication-invalid",
      documentProfile: baseline.documentProfile,
      issues: [
        {
          source: "compaction-publication",
          reason: "invalid-frame",
        },
      ],
    });
  });

  it("keeps a tail-only journal byte-for-byte and reports it as read-only", async () => {
    const baseline = await createBaseline();
    const tailBytes = crypto.getRandomValues(
      new Uint8Array(randomInt(1, 64)),
    );
    await writeFile(baseline.journalPath, tailBytes);

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: null,
      });

    expect(result.status).toBe("read-only-error");
    if (result.status !== "read-only-error") {
      throw new Error("Expected read-only startup");
    }
    expect(result.confirmedSource).toBe("baseline");
    expect(result.issues).toMatchObject([
      {
        source: "journal-frame-tail",
        byteOffset: 0,
        byteLength: tailBytes.byteLength,
      },
    ]);
    expect(
      new Uint8Array(
        await readFile(baseline.journalPath),
      ),
    ).toEqual(tailBytes);
  });

  it("reports an unreadable active journal as read-only instead of aborting startup", async () => {
    const baseline = await createBaseline();
    await mkdir(baseline.journalPath);
    let expectedReason: string | undefined;
    try {
      await readFile(baseline.journalPath);
    } catch (error) {
      expectedReason =
        (error as NodeJS.ErrnoException).code;
    }
    if (expectedReason === undefined) {
      throw new Error(
        "Test runtime did not report a journal read error code",
      );
    }

    const result =
      await resolveManuscriptStartupRecovery({
        baselineDocumentProfile:
          baseline.documentProfile,
        baselineJournalProfile:
          baseline.journalProfile,
        recoveryApplyProfile: null,
      });

    expect(result.status).toBe("read-only-error");
    if (result.status !== "read-only-error") {
      throw new Error("Expected read-only startup");
    }
    expect(result.confirmedSource).toBe("baseline");
    expect(result.documentProfile).toBe(
      baseline.documentProfile,
    );
    expect(result.issues).toEqual([
      {
        source: "journal-read",
        reason: expectedReason,
      },
    ]);
  });
});
