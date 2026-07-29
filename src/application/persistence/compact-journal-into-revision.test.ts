import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
  type ChangeBatch,
} from "./change-batch";
import {
  CompactJournalIntoRevision,
  JournalCompactionContentMismatchError,
  JournalCompactionPlanError,
  JournalCompactionReplayError,
  type CompactionRevisionPlan,
  type JournalCompactionPort,
  type JournalCompactionPublication,
  type ManuscriptContentChecksumAdapter,
  type PrepareCompactionRevisionInput,
  type PreparedCompactionRevision,
  type PublishJournalCompactionInput,
} from "./compact-journal-into-revision";
import type { JournalReplayTarget } from "./replay-journal";

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

function createChecksumAdapter(): ManuscriptContentChecksumAdapter {
  const algorithm = selectRuntimeHashAlgorithm();
  return {
    id: algorithm,
    async digest(input) {
      return new Uint8Array(
        createHash(algorithm).update(input).digest(),
      );
    },
  };
}

function createTarget(): JournalReplayTarget {
  return {
    workId: entityId<"Work">(randomUUID()),
    documentId: entityId<"Document">(randomUUID()),
    baseRevisionId:
      entityId<"DocumentRevision">(randomUUID()),
    nextSequence: randomInt(0, 10_000),
    text: randomUUID(),
  };
}

function createAppendBatch(
  target: JournalReplayTarget,
  insertedText: string,
): ChangeBatch {
  return parseChangeBatch({
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
}

function createRevisionPlan(
  target: JournalReplayTarget,
): CompactionRevisionPlan {
  const timestamp = new Date().toISOString();
  return {
    workId: target.workId,
    documentId: target.documentId,
    expectedBaseRevisionId: target.baseRevisionId,
    revisionId:
      entityId<"DocumentRevision">(randomUUID()),
    cause: randomUUID(),
    createdAt: timestamp,
    durableAt: timestamp,
  };
}

type PortHarness = {
  readonly port: JournalCompactionPort;
  readonly events: string[];
  readonly preparedInputs: PrepareCompactionRevisionInput[];
  readonly publishInputs: PublishJournalCompactionInput[];
  readonly publication: JournalCompactionPublication | null;
  setMaterialize(
    materialize: (
      prepared: PreparedCompactionRevision,
      storedText: string,
    ) => Promise<string>,
  ): void;
  setPublish(
    publish: (
      input: PublishJournalCompactionInput,
    ) => Promise<JournalCompactionPublication>,
  ): void;
  setReclaim(
    reclaim: (
      publication: JournalCompactionPublication,
    ) => Promise<void>,
  ): void;
};

function createPortHarness(): PortHarness {
  const events: string[] = [];
  const preparedInputs: PrepareCompactionRevisionInput[] = [];
  const publishInputs: PublishJournalCompactionInput[] = [];
  const storedTextByRevision = new Map<
    EntityId<"DocumentRevision">,
    string
  >();
  let publication: JournalCompactionPublication | null = null;
  let materialize = async (
    _prepared: PreparedCompactionRevision,
    storedText: string,
  ) => storedText;
  let publish = async (
    input: PublishJournalCompactionInput,
  ): Promise<JournalCompactionPublication> => ({
    compactionId: input.compactionId,
    consumedThroughByteOffset:
      input.expectedJournalEndByteOffset,
    revisions: input.revisions.map((revision) =>
      Object.freeze({
        documentId: revision.documentId,
        revisionId: revision.revisionId,
        nextSequence: revision.nextSequence,
      }),
    ),
  });
  let reclaim: (
    publication: JournalCompactionPublication,
  ) => Promise<void> = async () => undefined;

  const port: JournalCompactionPort = {
    async prepareRevision(input) {
      events.push(`prepare:${input.documentId}`);
      preparedInputs.push(input);
      storedTextByRevision.set(
        input.revisionId,
        input.text,
      );
      return {
        compactionId: input.compactionId,
        workId: input.workId,
        documentId: input.documentId,
        expectedBaseRevisionId:
          input.expectedBaseRevisionId,
        revisionId: input.revisionId,
        contentRef: randomUUID(),
      };
    },
    async materializeRevision(prepared) {
      events.push(`materialize:${prepared.documentId}`);
      const storedText = storedTextByRevision.get(
        prepared.revisionId,
      );
      if (storedText === undefined) {
        throw new Error("Prepared revision content is missing");
      }
      return materialize(prepared, storedText);
    },
    async publish(input) {
      events.push("publish");
      publishInputs.push(input);
      publication = await publish(input);
      return publication;
    },
    async reclaim(publicationInput) {
      events.push("reclaim");
      await reclaim(publicationInput);
    },
  };

  return {
    port,
    events,
    preparedInputs,
    publishInputs,
    get publication() {
      return publication;
    },
    setMaterialize(nextMaterialize) {
      materialize = nextMaterialize;
    },
    setPublish(nextPublish) {
      publish = nextPublish;
    },
    setReclaim(nextReclaim) {
      reclaim = nextReclaim;
    },
  };
}

describe("CompactJournalIntoRevision", () => {
  it("prepares and verifies every affected document before one atomic publication and later reclamation", async () => {
    const firstTarget = createTarget();
    const secondTarget = createTarget();
    const firstInsertedText = randomUUID();
    const secondInsertedText = randomUUID();
    const firstBatch = createAppendBatch(
      firstTarget,
      firstInsertedText,
    );
    const secondBatch = createAppendBatch(
      secondTarget,
      secondInsertedText,
    );
    const firstPlan = createRevisionPlan(firstTarget);
    const secondPlan = createRevisionPlan(secondTarget);
    const compactionId =
      entityId<"JournalCompaction">(randomUUID());
    const expectedJournalEndByteOffset =
      randomInt(1_000, 100_000);
    const harness = createPortHarness();
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    const result = await command.execute({
      compactionId,
      expectedJournalEndByteOffset,
      targets: [firstTarget, secondTarget],
      payloads: [
        serializeCanonicalChangeBatch(firstBatch),
        serializeCanonicalChangeBatch(secondBatch),
      ],
      revisionPlans: [firstPlan, secondPlan],
    });

    expect(harness.events).toEqual([
      `prepare:${firstTarget.documentId}`,
      `prepare:${secondTarget.documentId}`,
      `materialize:${firstTarget.documentId}`,
      `materialize:${secondTarget.documentId}`,
      "publish",
      "reclaim",
    ]);
    expect(harness.preparedInputs).toMatchObject([
      {
        ...firstPlan,
        compactionId,
        text: firstTarget.text + firstInsertedText,
        nextSequence: firstTarget.nextSequence + 1,
      },
      {
        ...secondPlan,
        compactionId,
        text: secondTarget.text + secondInsertedText,
        nextSequence: secondTarget.nextSequence + 1,
      },
    ]);
    expect(harness.publishInputs).toHaveLength(1);
    expect(harness.publishInputs[0]).toMatchObject({
      compactionId,
      expectedJournalEndByteOffset,
      revisions: [
        {
          workId: firstTarget.workId,
          documentId: firstTarget.documentId,
          expectedBaseRevisionId:
            firstTarget.baseRevisionId,
          revisionId: firstPlan.revisionId,
          nextSequence: firstTarget.nextSequence + 1,
        },
        {
          workId: secondTarget.workId,
          documentId: secondTarget.documentId,
          expectedBaseRevisionId:
            secondTarget.baseRevisionId,
          revisionId: secondPlan.revisionId,
          nextSequence: secondTarget.nextSequence + 1,
        },
      ],
    });
    expect(result.publication).toEqual(
      harness.publication,
    );
    expect(result.reclamation).toBe("completed");
    for (const revision of result.revisions) {
      expect(revision.sourceChecksum).toEqual(
        revision.resultChecksum,
      );
    }
  });

  it("does not prepare or publish when replay cannot consume the exact verified prefix", async () => {
    const target = createTarget();
    const batch = parseChangeBatch({
      ...createAppendBatch(target, randomUUID()),
      sequence: target.nextSequence + 1,
    });
    const harness = createPortHarness();
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    await expect(
      command.execute({
        compactionId:
          entityId<"JournalCompaction">(randomUUID()),
        expectedJournalEndByteOffset:
          randomInt(1_000, 100_000),
        targets: [target],
        payloads: [
          serializeCanonicalChangeBatch(batch),
        ],
        revisionPlans: [createRevisionPlan(target)],
      }),
    ).rejects.toBeInstanceOf(JournalCompactionReplayError);
    expect(harness.events).toEqual([]);
  });

  it("requires an exact revision plan for every and only affected document", async () => {
    const affectedTarget = createTarget();
    const unaffectedTarget = createTarget();
    const batch = createAppendBatch(
      affectedTarget,
      randomUUID(),
    );
    const harness = createPortHarness();
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    await expect(
      command.execute({
        compactionId:
          entityId<"JournalCompaction">(randomUUID()),
        expectedJournalEndByteOffset:
          randomInt(1_000, 100_000),
        targets: [affectedTarget, unaffectedTarget],
        payloads: [
          serializeCanonicalChangeBatch(batch),
        ],
        revisionPlans: [
          createRevisionPlan(unaffectedTarget),
        ],
      }),
    ).rejects.toBeInstanceOf(JournalCompactionPlanError);
    expect(harness.events).toEqual([]);
  });

  it("does not publish or reclaim when prepared content differs from the replayed source", async () => {
    const target = createTarget();
    const batch = createAppendBatch(
      target,
      randomUUID(),
    );
    const harness = createPortHarness();
    harness.setMaterialize(
      async () => randomUUID(),
    );
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    await expect(
      command.execute({
        compactionId:
          entityId<"JournalCompaction">(randomUUID()),
        expectedJournalEndByteOffset:
          randomInt(1_000, 100_000),
        targets: [target],
        payloads: [
          serializeCanonicalChangeBatch(batch),
        ],
        revisionPlans: [createRevisionPlan(target)],
      }),
    ).rejects.toBeInstanceOf(
      JournalCompactionContentMismatchError,
    );
    expect(harness.events).toEqual([
      `prepare:${target.documentId}`,
      `materialize:${target.documentId}`,
    ]);
  });

  it("does not reclaim when atomic publication rejects a changed journal end", async () => {
    const target = createTarget();
    const batch = createAppendBatch(
      target,
      randomUUID(),
    );
    const publicationError = new Error(randomUUID());
    const harness = createPortHarness();
    harness.setPublish(async () => {
      throw publicationError;
    });
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    await expect(
      command.execute({
        compactionId:
          entityId<"JournalCompaction">(randomUUID()),
        expectedJournalEndByteOffset:
          randomInt(1_000, 100_000),
        targets: [target],
        payloads: [
          serializeCanonicalChangeBatch(batch),
        ],
        revisionPlans: [createRevisionPlan(target)],
      }),
    ).rejects.toBe(publicationError);
    expect(harness.events).not.toContain("reclaim");
  });

  it("reports reclamation as pending without retrying after durable publication", async () => {
    const target = createTarget();
    const batch = createAppendBatch(
      target,
      randomUUID(),
    );
    const harness = createPortHarness();
    harness.setReclaim(async () => {
      throw new Error(randomUUID());
    });
    const command = new CompactJournalIntoRevision({
      checksumAdapter: createChecksumAdapter(),
      port: harness.port,
    });

    const result = await command.execute({
      compactionId:
        entityId<"JournalCompaction">(randomUUID()),
      expectedJournalEndByteOffset:
        randomInt(1_000, 100_000),
      targets: [target],
      payloads: [
        serializeCanonicalChangeBatch(batch),
      ],
      revisionPlans: [createRevisionPlan(target)],
    });

    expect(result.reclamation).toBe("pending");
    expect(
      harness.events.filter(
        (event) => event === "reclaim",
      ),
    ).toHaveLength(1);
    expect(result.publication).toEqual(
      harness.publication,
    );
  });
});
