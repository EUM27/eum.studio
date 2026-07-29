import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  appendFile,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  CompactJournalIntoRevision,
  type CompactionRevisionPlan,
} from "../../application/persistence/compact-journal-into-revision";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../../application/persistence/change-batch";
import type { JournalReplayTarget } from "../../application/persistence/replay-journal";
import {
  entityId,
} from "../../domain/writing";
import { appendJournalPayloadDurably } from "../journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../journal/node-crypto-journal-checksum";
import {
  createPocJournalCompactionPort,
  PocJournalCompactionConflictError,
  resolvePocJournalCompaction,
  type PocJournalCompactionStage,
  type PocJournalCompactionStoragePlan,
} from "./poc-journal-compaction-port";

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

function selectDifferentRuntimeHashAlgorithm(
  excludedAlgorithm: string,
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
      "Test runtime exposes no second hash algorithm",
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

type Scenario = {
  readonly target: JournalReplayTarget;
  readonly payload: Uint8Array;
  readonly expectedText: string;
  readonly revisionPlan: CompactionRevisionPlan;
  readonly storagePlan: PocJournalCompactionStoragePlan;
  readonly checksumAdapter:
    ReturnType<typeof createNodeCryptoJournalChecksumAdapter>;
  readonly expectedJournalEndByteOffset: number;
  readonly orphanJournalPath: string;
};

async function createScenario(): Promise<Scenario> {
  const directory = await createTemporaryDirectory();
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      selectRuntimeHashAlgorithm(),
    );
  const target: JournalReplayTarget = {
    workId: entityId<"Work">(randomUUID()),
    documentId: entityId<"Document">(randomUUID()),
    baseRevisionId:
      entityId<"DocumentRevision">(randomUUID()),
    nextSequence: randomInt(0, 10_000),
    text: randomUUID(),
  };
  const insertedText = randomUUID();
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: target.workId,
    documentId: target.documentId,
    baseRevisionId: target.baseRevisionId,
    sequence: target.nextSequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: target.text.length,
    afterTextLengthUtf16:
      target.text.length + insertedText.length,
    changes: [
      {
        fromUtf16: target.text.length,
        toUtf16: target.text.length,
        insertedText,
      },
    ],
  });
  const payload = serializeCanonicalChangeBatch(batch);
  const sourceJournalPath = join(
    directory,
    randomUUID(),
  );
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath: sourceJournalPath,
      payload,
      checksumAdapter,
    });
  const revisionId =
    entityId<"DocumentRevision">(randomUUID());
  const timestamp = new Date().toISOString();
  const revisionPlan: CompactionRevisionPlan = {
    workId: target.workId,
    documentId: target.documentId,
    expectedBaseRevisionId: target.baseRevisionId,
    revisionId,
    cause: randomUUID(),
    createdAt: timestamp,
    durableAt: timestamp,
  };
  const compactionId =
    entityId<"JournalCompaction">(randomUUID());
  const storagePlan: PocJournalCompactionStoragePlan = {
    compactionId,
    sourceJournalPath,
    nextJournalPath: join(directory, randomUUID()),
    publicationTemporaryPath: join(
      directory,
      randomUUID(),
    ),
    publicationPath: join(directory, randomUUID()),
    revisionFiles: [
      {
        revisionId,
        contentPath: join(directory, randomUUID()),
      },
    ],
  };

  return {
    target,
    payload,
    expectedText: target.text + insertedText,
    revisionPlan,
    storagePlan,
    checksumAdapter,
    expectedJournalEndByteOffset:
      appendReceipt.frameEndByteOffset,
    orphanJournalPath: join(directory, randomUUID()),
  };
}

async function executeScenario(
  scenario: Scenario,
  onStage?: (
    stage: PocJournalCompactionStage,
  ) => Promise<void>,
) {
  const command = new CompactJournalIntoRevision({
    checksumAdapter: scenario.checksumAdapter,
    port: createPocJournalCompactionPort({
      storagePlan: scenario.storagePlan,
      checksumAdapter: scenario.checksumAdapter,
      ...(onStage === undefined
        ? {}
        : { onStage }),
    }),
  });
  return command.execute({
    compactionId: scenario.storagePlan.compactionId,
    expectedJournalEndByteOffset:
      scenario.expectedJournalEndByteOffset,
    targets: [scenario.target],
    payloads: [scenario.payload],
    revisionPlans: [scenario.revisionPlan],
  });
}

function resolveScenario(
  scenario: Scenario,
  resolveActiveJournalChecksumAdapter = (
    adapterId: string,
  ) =>
    adapterId === scenario.checksumAdapter.id
      ? scenario.checksumAdapter
      : null,
) {
  return resolvePocJournalCompaction({
    storagePlan: scenario.storagePlan,
    checksumAdapter: scenario.checksumAdapter,
    resolveActiveJournalChecksumAdapter,
  });
}

describe("POC journal compaction platform", () => {
  it("rejects a missing caller path instead of resolving it to the process directory", async () => {
    const scenario = await createScenario();

    expect(() =>
      createPocJournalCompactionPort({
        storagePlan: {
          ...scenario.storagePlan,
          sourceJournalPath: "",
        },
        checksumAdapter: scenario.checksumAdapter,
      }),
    ).toThrow();
  });

  it("publishes synced revision content and a new journal generation before reclaiming the source journal", async () => {
    const scenario = await createScenario();

    const result = await executeScenario(scenario);

    expect(result.reclamation).toBe("completed");
    expect(
      await pathPresence(
        scenario.storagePlan.sourceJournalPath,
      ),
    ).toBe("missing");
    expect(
      await readFile(
        scenario.storagePlan.nextJournalPath,
      ),
    ).toHaveLength(0);
    const recovery = await resolveScenario(scenario);
    expect(recovery.status).toBe("published");
    if (recovery.status !== "published") {
      throw new Error(
        "Expected a published compaction recovery",
      );
    }
    expect(recovery.activeJournalPath).toBe(
      scenario.storagePlan.nextJournalPath,
    );
    expect(recovery.consumedThroughByteOffset).toBe(
      scenario.expectedJournalEndByteOffset,
    );
    expect(recovery.revisions).toMatchObject([
      {
        workId: scenario.target.workId,
        documentId: scenario.target.documentId,
        expectedBaseRevisionId:
          scenario.target.baseRevisionId,
        revisionId: scenario.revisionPlan.revisionId,
        nextSequence:
          scenario.target.nextSequence + 1,
        content: scenario.expectedText,
      },
    ]);
  });

  it("keeps the old recovery source when execution stops before publication rename", async () => {
    const scenario = await createScenario();
    const fault = new Error(randomUUID());

    await expect(
      executeScenario(scenario, async (stage) => {
        if (stage === "publication-temp-synced") {
          throw fault;
        }
      }),
    ).rejects.toBe(fault);

    expect(
      await pathPresence(
        scenario.storagePlan.sourceJournalPath,
      ),
    ).toBe("present");
    const recovery = await resolveScenario(scenario);
    expect(recovery).toEqual({
      status: "not-published",
    });
  });

  it("rejects publication when the source journal grows after its expected end was scanned", async () => {
    const scenario = await createScenario();

    await expect(
      executeScenario(scenario, async (stage) => {
        if (stage === "before-publication-rename") {
          await appendFile(
            scenario.storagePlan.sourceJournalPath,
            new Uint8Array([randomInt(0, 256)]),
          );
        }
      }),
    ).rejects.toBeInstanceOf(
      PocJournalCompactionConflictError,
    );

    expect(
      await pathPresence(
        scenario.storagePlan.publicationPath,
      ),
    ).toBe("missing");
    expect(
      await pathPresence(
        scenario.storagePlan.sourceJournalPath,
      ),
    ).toBe("present");
  });

  it("keeps a valid publication and reports pending when source journal reclamation fails", async () => {
    const scenario = await createScenario();

    const result = await executeScenario(
      scenario,
      async (stage) => {
        if (
          stage ===
          "before-source-journal-reclamation"
        ) {
          await rename(
            scenario.storagePlan.sourceJournalPath,
            scenario.orphanJournalPath,
          );
        }
      },
    );

    expect(result.reclamation).toBe("pending");
    expect(
      await pathPresence(scenario.orphanJournalPath),
    ).toBe("present");
    const recovery = await resolveScenario(scenario);
    expect(recovery.status).toBe("published");
  });

  it("resolves a populated active journal generation with its separately caller-selected checksum adapter", async () => {
    const scenario = await createScenario();
    await executeScenario(scenario);
    const activeJournalChecksumAdapter =
      createNodeCryptoJournalChecksumAdapter(
        selectDifferentRuntimeHashAlgorithm(
          scenario.checksumAdapter.id,
        ),
      );
    await appendJournalPayloadDurably({
      journalPath: scenario.storagePlan.nextJournalPath,
      payload: new TextEncoder().encode(randomUUID()),
      checksumAdapter:
        activeJournalChecksumAdapter,
    });

    const recovery = await resolveScenario(
      scenario,
      (adapterId) =>
        adapterId ===
        activeJournalChecksumAdapter.id
          ? activeJournalChecksumAdapter
          : null,
    );

    expect(recovery.status).toBe("published");
  });

  it("does not trust a published revision whose materialized content no longer matches its checksum", async () => {
    const scenario = await createScenario();
    await executeScenario(scenario);
    const revisionFile =
      scenario.storagePlan.revisionFiles[0];
    if (revisionFile === undefined) {
      throw new Error("Scenario has no revision file");
    }
    await writeFile(
      revisionFile.contentPath,
      new Uint8Array([
        randomInt(0, 256),
        randomInt(0, 256),
      ]),
    );

    const recovery = await resolveScenario(scenario);

    expect(recovery).toEqual({
      status: "invalid",
      reason: "content-mismatch",
    });
  });
});
