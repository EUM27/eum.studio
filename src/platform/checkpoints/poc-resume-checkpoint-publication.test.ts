import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  rm,
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
  CaptureResumeCheckpoint,
} from "../../application/checkpoints/capture-resume-checkpoint";
import type { RevisionStore } from "../../application/revisions/revision-store";
import {
  entityId,
  type Anchor,
  type Document,
  type DocumentRevision,
  type ResumeCheckpoint,
  type Work,
  type WritingCatalog,
} from "../../domain/writing";
import { createNodeCryptoJournalChecksumAdapter } from "../journal/node-crypto-journal-checksum";
import {
  createPocResumeCheckpointCaptureTransaction,
  resolvePocResumeCheckpointPublication,
  type PocResumeCheckpointPublicationCodec,
  type PocResumeCheckpointPublicationPayload,
  type PocResumeCheckpointPublicationStage,
  type PocResumeCheckpointStoragePlan,
} from "./poc-resume-checkpoint-publication";

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

function createCodec(): PocResumeCheckpointPublicationCodec {
  const id = randomUUID();
  return {
    id,
    async encode(payload) {
      return new TextEncoder().encode(
        JSON.stringify(payload),
      );
    },
    async decode(bytes) {
      return JSON.parse(
        new TextDecoder("utf-8", {
          fatal: true,
        }).decode(bytes),
      ) as PocResumeCheckpointPublicationPayload;
    },
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  return directory;
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
  readonly work: Work;
  readonly document: Document;
  readonly revision: DocumentRevision;
  readonly checkpoint: ResumeCheckpoint;
  readonly anchors: readonly Anchor[];
  readonly catalog: WritingCatalog;
  readonly revisionStore: RevisionStore;
  readonly storagePlan: PocResumeCheckpointStoragePlan;
  readonly codec: PocResumeCheckpointPublicationCodec;
  readonly checksumAdapter:
    ReturnType<typeof createNodeCryptoJournalChecksumAdapter>;
};

async function createScenario(): Promise<Scenario> {
  const directory = await createTemporaryDirectory();
  const timestamp = new Date().toISOString();
  const workId = entityId<"Work">(randomUUID());
  const documentId =
    entityId<"Document">(randomUUID());
  const revisionId =
    entityId<"DocumentRevision">(randomUUID());
  const work: Work = Object.freeze({
    meta: Object.freeze({
      id: workId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    studioId: entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId:
      entityId<"WorkSettings">(randomUUID()),
    customFields: Object.freeze({
      [randomUUID()]: randomUUID(),
    }),
  });
  const document: Document = Object.freeze({
    meta: Object.freeze({
      id: documentId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    workId,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId:
      entityId<"Manuscript">(randomUUID()),
  });
  const content = randomUUID();
  const revision: DocumentRevision = Object.freeze({
    id: revisionId,
    documentId,
    contentRef: randomUUID(),
    contentHash: randomUUID(),
    length: content.length,
    cause: randomUUID(),
    createdAt: timestamp,
    durableAt: timestamp,
  });
  const cursorAnchorId =
    entityId<"Anchor">(randomUUID());
  const cursorOffset = randomInt(0, content.length + 1);
  const anchor: Anchor = Object.freeze({
    meta: Object.freeze({
      id: cursorAnchorId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    documentId,
    originRevisionId: revisionId,
    resolvedRevisionId: revisionId,
    startOffset: cursorOffset,
    endOffset: cursorOffset,
    exactQuote: "",
    prefixContext: content.slice(0, cursorOffset),
    suffixContext: content.slice(cursorOffset),
    quoteHash: randomUUID(),
    contextHash: randomUUID(),
    status: "resolved",
    resolutionEvidence: Object.freeze({
      targetRevisionId: revisionId,
      method: "created",
      matchedEvidence: Object.freeze([
        "origin-revision",
      ] as const),
      candidateOffsets: Object.freeze([
        cursorOffset,
      ]),
      policyVersion: randomUUID(),
      assessedAt: timestamp,
    }),
  });
  const checkpoint: ResumeCheckpoint =
    Object.freeze({
      meta: Object.freeze({
        id: entityId<"ResumeCheckpoint">(
          randomUUID(),
        ),
        schemaVersion: 1,
        revision: randomInt(0, 10_000),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      workId,
      documentId,
      documentRevisionId: revisionId,
      cursorAnchorId,
      workspaceMode: randomUUID(),
      contextRefs: Object.freeze([
        Object.freeze({
          entityType: randomUUID(),
          entityId: randomUUID(),
        }),
      ]),
      capturedAt: timestamp,
    });
  const catalog: WritingCatalog = {
    getWork(id) {
      return id === workId ? work : null;
    },
    getDocument(id) {
      return id === documentId ? document : null;
    },
    getDocumentForWork(selectedWorkId, selectedDocumentId) {
      return selectedWorkId === workId &&
        selectedDocumentId === documentId
        ? document
        : null;
    },
  };
  const revisionStore: RevisionStore = {
    async append() {
      throw new Error("Scenario does not append revisions");
    },
    async getCurrentRevision(selectedDocumentId) {
      return selectedDocumentId === documentId
        ? revision
        : null;
    },
    async getRevision(selectedRevisionId) {
      return selectedRevisionId === revisionId
        ? revision
        : null;
    },
    async materialize(selectedRevisionId) {
      if (selectedRevisionId !== revisionId) {
        throw new Error("Unknown scenario revision");
      }
      return content;
    },
  };
  const storagePlan: PocResumeCheckpointStoragePlan = {
    publicationId:
      entityId<"ResumeCheckpointPublication">(
        randomUUID(),
      ),
    publicationTemporaryPath: join(
      directory,
      randomUUID(),
    ),
    publicationPath: join(directory, randomUUID()),
  };

  return {
    work,
    document,
    revision,
    checkpoint,
    anchors: [anchor],
    catalog,
    revisionStore,
    storagePlan,
    codec: createCodec(),
    checksumAdapter:
      createNodeCryptoJournalChecksumAdapter(
        selectRuntimeHashAlgorithm(),
      ),
  };
}

function createCapture(
  scenario: Scenario,
  onStage?: (
    stage: PocResumeCheckpointPublicationStage,
  ) => Promise<void>,
) {
  const transaction =
    createPocResumeCheckpointCaptureTransaction({
      works: [scenario.work],
      anchors: scenario.anchors,
      revisionStore: scenario.revisionStore,
      storagePlan: scenario.storagePlan,
      codec: scenario.codec,
      checksumAdapter: scenario.checksumAdapter,
      ...(onStage === undefined ? {} : { onStage }),
    });
  return {
    transaction,
    command: new CaptureResumeCheckpoint({
      catalog: scenario.catalog,
      revisionStore: scenario.revisionStore,
      transaction,
    }),
  };
}

async function executeCapture(
  scenario: Scenario,
  onStage?: (
    stage: PocResumeCheckpointPublicationStage,
  ) => Promise<void>,
) {
  const capture = createCapture(scenario, onStage);
  const result = await capture.command.execute({
    checkpoint: scenario.checkpoint,
    expectedWorkRevision:
      scenario.work.meta.revision,
    expectedResumeCheckpointId: null,
    expectedCurrentDocumentRevisionId:
      scenario.revision.id,
  });
  return {
    ...capture,
    result,
  };
}

async function resolveScenario(scenario: Scenario) {
  return resolvePocResumeCheckpointPublication({
    works: [scenario.work],
    checkpoints: [],
    anchors: scenario.anchors,
    revisionStore: scenario.revisionStore,
    storagePlan: scenario.storagePlan,
    codec: scenario.codec,
    checksumAdapter: scenario.checksumAdapter,
  });
}

describe("POC ResumeCheckpoint publication", () => {
  it("publishes the Work pointer, checkpoint, and Anchor copies in one durable frame", async () => {
    const scenario = await createScenario();

    const capture = await executeCapture(scenario);
    const recovery = await resolveScenario(scenario);

    expect(
      capture.result.work.resumeCheckpointId,
    ).toBe(scenario.checkpoint.meta.id);
    expect(recovery.status).toBe("published");
    expect(recovery.state.works).toContainEqual(
      capture.result.work,
    );
    expect(recovery.state.checkpoints).toContainEqual(
      scenario.checkpoint,
    );
    expect(recovery.state.anchors).toEqual(
      scenario.anchors,
    );
  });

  it("keeps both in-process and restart state on the old pointer when execution stops before rename", async () => {
    const scenario = await createScenario();
    const fault = new Error(randomUUID());
    const capture = createCapture(
      scenario,
      async (stage) => {
        if (stage === "publication-temp-synced") {
          throw fault;
        }
      },
    );

    await expect(
      capture.command.execute({
        checkpoint: scenario.checkpoint,
        expectedWorkRevision:
          scenario.work.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId:
          scenario.revision.id,
      }),
    ).rejects.toBe(fault);
    expect(
      await capture.transaction.getWork(
        scenario.work.meta.id,
      ),
    ).toEqual(scenario.work);
    const recovery = await resolveScenario(scenario);
    expect(recovery.status).toBe("baseline");
    expect(recovery.state.works).toEqual([
      scenario.work,
    ]);
    expect(recovery.state.checkpoints).toEqual([]);
  });

  it("recovers the new pointer and checkpoint when acknowledgement is lost after rename", async () => {
    const scenario = await createScenario();
    const fault = new Error(randomUUID());

    await expect(
      executeCapture(scenario, async (stage) => {
        if (stage === "publication-renamed") {
          throw fault;
        }
      }),
    ).rejects.toBe(fault);

    const recovery = await resolveScenario(scenario);
    expect(recovery.status).toBe("published");
    expect(
      recovery.state.works[0]?.resumeCheckpointId,
    ).toBe(scenario.checkpoint.meta.id);
    expect(recovery.state.checkpoints).toContainEqual(
      scenario.checkpoint,
    );
  });

  it("returns an explicit invalid state and preserves the baseline when the final frame is corrupted", async () => {
    const scenario = await createScenario();
    await executeCapture(scenario);
    await writeFile(
      scenario.storagePlan.publicationPath,
      new Uint8Array([
        randomInt(0, 256),
        randomInt(0, 256),
      ]),
    );

    const recovery = await resolveScenario(scenario);

    expect(recovery.status).toBe("invalid");
    expect(recovery.state.works).toEqual([
      scenario.work,
    ]);
    expect(recovery.state.checkpoints).toEqual([]);
  });

  it("does not publish when the caller codec rejects the complete state", async () => {
    const scenario = await createScenario();
    const codecError = new Error(randomUUID());
    const codec: PocResumeCheckpointPublicationCodec = {
      ...scenario.codec,
      async encode() {
        throw codecError;
      },
    };
    const transaction =
      createPocResumeCheckpointCaptureTransaction({
        works: [scenario.work],
        anchors: scenario.anchors,
        revisionStore: scenario.revisionStore,
        storagePlan: scenario.storagePlan,
        codec,
        checksumAdapter: scenario.checksumAdapter,
      });
    const command = new CaptureResumeCheckpoint({
      catalog: scenario.catalog,
      revisionStore: scenario.revisionStore,
      transaction,
    });

    await expect(
      command.execute({
        checkpoint: scenario.checkpoint,
        expectedWorkRevision:
          scenario.work.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId:
          scenario.revision.id,
      }),
    ).rejects.toBe(codecError);
    expect(
      await transaction.getWork(
        scenario.work.meta.id,
      ),
    ).toEqual(scenario.work);
  });

  it("does not publish bytes that the caller codec cannot decode for restart", async () => {
    const scenario = await createScenario();
    const codecError = new Error(randomUUID());
    const codec: PocResumeCheckpointPublicationCodec = {
      ...scenario.codec,
      async decode() {
        throw codecError;
      },
    };
    const transaction =
      createPocResumeCheckpointCaptureTransaction({
        works: [scenario.work],
        anchors: scenario.anchors,
        revisionStore: scenario.revisionStore,
        storagePlan: scenario.storagePlan,
        codec,
        checksumAdapter: scenario.checksumAdapter,
      });
    const command = new CaptureResumeCheckpoint({
      catalog: scenario.catalog,
      revisionStore: scenario.revisionStore,
      transaction,
    });

    await expect(
      command.execute({
        checkpoint: scenario.checkpoint,
        expectedWorkRevision:
          scenario.work.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId:
          scenario.revision.id,
      }),
    ).rejects.toBe(codecError);
    const recovery =
      await resolvePocResumeCheckpointPublication({
        works: [scenario.work],
        checkpoints: [],
        anchors: scenario.anchors,
        revisionStore: scenario.revisionStore,
        storagePlan: scenario.storagePlan,
        codec: scenario.codec,
        checksumAdapter: scenario.checksumAdapter,
      });
    expect(recovery.status).toBe("baseline");
  });

  it("rejects a missing caller path instead of choosing a runtime path", async () => {
    const scenario = await createScenario();

    expect(() =>
      createPocResumeCheckpointCaptureTransaction({
        works: [scenario.work],
        anchors: scenario.anchors,
        revisionStore: scenario.revisionStore,
        storagePlan: {
          ...scenario.storagePlan,
          publicationPath: "",
        },
        codec: scenario.codec,
        checksumAdapter: scenario.checksumAdapter,
      }),
    ).toThrow();
  });
});
