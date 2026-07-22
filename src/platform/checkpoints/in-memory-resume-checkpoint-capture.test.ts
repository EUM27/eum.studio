import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CaptureResumeCheckpoint,
  ResumeCheckpointConflictError,
} from "../../application/checkpoints/capture-resume-checkpoint";
import {
  GetResumeCheckpointForWork,
  ResumeCheckpointIntegrityError,
} from "../../application/checkpoints/get-resume-checkpoint-for-work";
import {
  createWritingCatalog,
  entityId,
  type Document,
  type DocumentRevision,
  type EntityId,
  type RecordMeta,
  type ResumeCheckpoint,
  type Work,
  type WritingCatalog,
} from "../../domain/writing";
import { InMemoryRevisionStore } from "../revisions/in-memory-revision-store";
import { InMemoryResumeCheckpointCaptureTransaction } from "./in-memory-resume-checkpoint-capture";

function createMeta<TEntity extends string>(
  id: EntityId<TEntity>,
): RecordMeta<TEntity> {
  const createdAt = new Date().toISOString();
  return {
    id,
    schemaVersion: randomInt(1, 32),
    revision: randomInt(1, 32),
    createdAt,
    updatedAt: createdAt,
  };
}

function createWork(
  resumeCheckpointId?: EntityId<"ResumeCheckpoint">,
): Work {
  return {
    meta: createMeta(entityId<"Work">(randomUUID())),
    studioId: entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    subtitle: randomUUID(),
    kindRef: entityId<"DictionaryValue">(randomUUID()),
    statusRef: entityId<"DictionaryValue">(randomUUID()),
    orderKey: randomUUID(),
    ...(resumeCheckpointId === undefined ? {} : { resumeCheckpointId }),
    settingsId: entityId<"WorkSettings">(randomUUID()),
    customFields: { [randomUUID()]: randomUUID() },
  };
}

function createDocument(workId: EntityId<"Work">): Document {
  return {
    meta: createMeta(entityId<"Document">(randomUUID())),
    workId,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId: entityId<"Manuscript">(randomUUID()),
  };
}

function instantAfter(instant: string): string {
  return new Date(Date.parse(instant) + randomInt(1, 10_000)).toISOString();
}

function createCheckpoint(input: {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly capturedAfter: string;
  readonly checkpointId?: EntityId<"ResumeCheckpoint">;
}): ResumeCheckpoint {
  const capturedAt = instantAfter(input.capturedAfter);
  return {
    meta: {
      ...createMeta(
        input.checkpointId ??
          entityId<"ResumeCheckpoint">(randomUUID()),
      ),
      createdAt: capturedAt,
      updatedAt: capturedAt,
    },
    workId: input.workId,
    documentId: input.documentId,
    documentRevisionId: input.documentRevisionId,
    cursorAnchorId: entityId<"Anchor">(randomUUID()),
    selectionAnchorId: entityId<"Anchor">(randomUUID()),
    workspaceMode: randomUUID(),
    contextRefs: [
      {
        entityType: randomUUID(),
        entityId: randomUUID(),
      },
    ],
    focusCheckpointId: entityId<"FocusCheckpoint">(randomUUID()),
    musicCheckpointId: entityId<"MusicCheckpoint">(randomUUID()),
    capturedAt,
  };
}

function createRevisionStore(catalog: WritingCatalog): InMemoryRevisionStore {
  return new InMemoryRevisionStore({
    catalog,
    describeContent: (content) => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: content.length,
    }),
  });
}

async function appendRevision(input: {
  readonly revisionStore: InMemoryRevisionStore;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedCurrentRevisionId: EntityId<"DocumentRevision"> | null;
}): Promise<DocumentRevision> {
  const recordedAt = new Date().toISOString();
  return input.revisionStore.append({
    revisionId: entityId<"DocumentRevision">(randomUUID()),
    workId: input.workId,
    documentId: input.documentId,
    expectedCurrentRevisionId: input.expectedCurrentRevisionId,
    content: randomUUID(),
    cause: randomUUID(),
    createdAt: recordedAt,
    durableAt: recordedAt,
  });
}

function createHarness(input: {
  readonly works: readonly Work[];
  readonly documents: readonly Document[];
  readonly checkpoints?: readonly ResumeCheckpoint[];
}) {
  const catalog = createWritingCatalog({
    works: input.works,
    documents: input.documents,
  });
  const revisionStore = createRevisionStore(catalog);
  const transaction = new InMemoryResumeCheckpointCaptureTransaction({
    works: input.works,
    checkpoints: input.checkpoints ?? [],
    revisionStore,
  });
  return {
    catalog,
    revisionStore,
    transaction,
    capture: new CaptureResumeCheckpoint({
      catalog,
      revisionStore,
      transaction,
    }),
    query: new GetResumeCheckpointForWork(transaction),
  };
}

describe("in-memory ResumeCheckpoint capture transaction", () => {
  it("atomically inserts the checkpoint and advances only the Work pointer metadata", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const harness = createHarness({ works: [work], documents: [document] });
    const revision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const checkpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: work.meta.updatedAt,
    });

    const result = await harness.capture.execute({
      checkpoint,
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: null,
      expectedCurrentDocumentRevisionId: revision.id,
    });

    const expectedWork = {
      ...work,
      meta: {
        ...work.meta,
        revision: work.meta.revision + 1,
        updatedAt: checkpoint.capturedAt,
      },
      resumeCheckpointId: checkpoint.meta.id,
    };
    expect(result).toEqual({ checkpoint, work: expectedWork });
    expect(await harness.transaction.getWork(work.meta.id)).toEqual(
      expectedWork,
    );
    expect(
      await harness.transaction.getCheckpointById(checkpoint.meta.id),
    ).toEqual(checkpoint);
    expect(harness.catalog.getWork(work.meta.id)).toEqual(work);
    expect(work.resumeCheckpointId).toBeUndefined();
    expect(Object.isFrozen(result.work)).toBe(true);
    expect(Object.isFrozen(result.work.meta)).toBe(true);
    expect(Object.isFrozen(result.checkpoint)).toBe(true);
    expect(Object.isFrozen(result.checkpoint.meta)).toBe(true);
    expect(Object.isFrozen(result.checkpoint.contextRefs)).toBe(true);
    expect(Object.isFrozen(result.checkpoint.contextRefs?.[0])).toBe(true);
    await expect(harness.query.execute(work.meta.id)).resolves.toEqual({
      status: "ready",
      workId: work.meta.id,
      checkpoint,
    });
  });

  it("moves the Work pointer while preserving both immutable checkpoint records", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const harness = createHarness({ works: [work], documents: [document] });
    const revision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const firstCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: work.meta.updatedAt,
    });
    const firstResult = await harness.capture.execute({
      checkpoint: firstCheckpoint,
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: null,
      expectedCurrentDocumentRevisionId: revision.id,
    });
    const secondCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: firstResult.work.meta.updatedAt,
    });

    const secondResult = await harness.capture.execute({
      checkpoint: secondCheckpoint,
      expectedWorkRevision: firstResult.work.meta.revision,
      expectedResumeCheckpointId: firstCheckpoint.meta.id,
      expectedCurrentDocumentRevisionId: revision.id,
    });

    expect(secondResult.work.resumeCheckpointId).toBe(
      secondCheckpoint.meta.id,
    );
    expect(secondResult.work.meta.revision).toBe(work.meta.revision + 2);
    expect(
      await harness.transaction.getCheckpointById(firstCheckpoint.meta.id),
    ).toEqual(firstCheckpoint);
    expect(
      await harness.transaction.getCheckpointById(secondCheckpoint.meta.id),
    ).toEqual(secondCheckpoint);
    expect(firstResult.checkpoint).toEqual(firstCheckpoint);
    expect(firstResult.work.resumeCheckpointId).toBe(firstCheckpoint.meta.id);
  });

  it("rejects stale Work revision and pointer expectations without publishing a checkpoint", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const harness = createHarness({ works: [work], documents: [document] });
    const revision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const savedCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: work.meta.updatedAt,
    });
    const saved = await harness.capture.execute({
      checkpoint: savedCheckpoint,
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: null,
      expectedCurrentDocumentRevisionId: revision.id,
    });
    const before = await harness.transaction.getWork(work.meta.id);
    const staleRevisionCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: saved.work.meta.updatedAt,
    });

    await expect(
      harness.capture.execute({
        checkpoint: staleRevisionCheckpoint,
        expectedWorkRevision: work.meta.revision,
        expectedResumeCheckpointId: savedCheckpoint.meta.id,
        expectedCurrentDocumentRevisionId: revision.id,
      }),
    ).rejects.toBeInstanceOf(ResumeCheckpointConflictError);
    expect(await harness.transaction.getWork(work.meta.id)).toEqual(before);
    expect(
      await harness.transaction.getCheckpointById(
        staleRevisionCheckpoint.meta.id,
      ),
    ).toBeNull();

    const stalePointerCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: saved.work.meta.updatedAt,
    });
    await expect(
      harness.capture.execute({
        checkpoint: stalePointerCheckpoint,
        expectedWorkRevision: saved.work.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId: revision.id,
      }),
    ).rejects.toBeInstanceOf(ResumeCheckpointConflictError);
    expect(await harness.transaction.getWork(work.meta.id)).toEqual(before);
    expect(
      await harness.transaction.getCheckpointById(
        stalePointerCheckpoint.meta.id,
      ),
    ).toBeNull();
  });

  it("rejects stale durable revisions and duplicate checkpoint identities without partial state", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const harness = createHarness({ works: [work], documents: [document] });
    const firstRevision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const secondRevision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: firstRevision.id,
    });
    const staleCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: firstRevision.id,
      capturedAfter: work.meta.updatedAt,
    });

    await expect(
      harness.capture.execute({
        checkpoint: staleCheckpoint,
        expectedWorkRevision: work.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId: firstRevision.id,
      }),
    ).rejects.toThrow(/current durable revision/);
    expect(await harness.transaction.getWork(work.meta.id)).toEqual(work);
    expect(
      await harness.transaction.getCheckpointById(staleCheckpoint.meta.id),
    ).toBeNull();

    const checkpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: secondRevision.id,
      capturedAfter: work.meta.updatedAt,
    });
    const saved = await harness.capture.execute({
      checkpoint,
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: null,
      expectedCurrentDocumentRevisionId: secondRevision.id,
    });
    const duplicate = {
      ...createCheckpoint({
        workId: work.meta.id,
        documentId: document.meta.id,
        documentRevisionId: secondRevision.id,
        capturedAfter: saved.work.meta.updatedAt,
      }),
      meta: checkpoint.meta,
    } satisfies ResumeCheckpoint;

    await expect(
      harness.capture.execute({
        checkpoint: duplicate,
        expectedWorkRevision: saved.work.meta.revision,
        expectedResumeCheckpointId: checkpoint.meta.id,
        expectedCurrentDocumentRevisionId: secondRevision.id,
      }),
    ).rejects.toThrow(/Duplicate checkpoint identity/);
    expect(await harness.transaction.getWork(work.meta.id)).toEqual(
      saved.work,
    );
    expect(
      await harness.transaction.getCheckpointById(checkpoint.meta.id),
    ).toEqual(checkpoint);
  });

  it("rejects unknown and cross-Work ownership without changing registered Work state", async () => {
    const firstWork = createWork();
    const secondWork = createWork();
    const document = createDocument(firstWork.meta.id);
    const harness = createHarness({
      works: [firstWork, secondWork],
      documents: [document],
    });
    const revision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: firstWork.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const crossWorkCheckpoint = createCheckpoint({
      workId: secondWork.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: secondWork.meta.updatedAt,
    });
    await expect(
      harness.capture.execute({
        checkpoint: crossWorkCheckpoint,
        expectedWorkRevision: secondWork.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId: revision.id,
      }),
    ).rejects.toThrow(/Work\/document boundary violation/);

    const unknownDocumentCheckpoint = createCheckpoint({
      workId: firstWork.meta.id,
      documentId: entityId<"Document">(randomUUID()),
      documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      capturedAfter: firstWork.meta.updatedAt,
    });
    await expect(
      harness.capture.execute({
        checkpoint: unknownDocumentCheckpoint,
        expectedWorkRevision: firstWork.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId:
          unknownDocumentCheckpoint.documentRevisionId,
      }),
    ).rejects.toThrow(/Unknown document/);

    const unknownWorkCheckpoint = createCheckpoint({
      workId: entityId<"Work">(randomUUID()),
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      capturedAfter: firstWork.meta.updatedAt,
    });
    await expect(
      harness.capture.execute({
        checkpoint: unknownWorkCheckpoint,
        expectedWorkRevision: firstWork.meta.revision,
        expectedResumeCheckpointId: null,
        expectedCurrentDocumentRevisionId: revision.id,
      }),
    ).rejects.toThrow(/Unknown work/);

    expect(await harness.transaction.getWork(firstWork.meta.id)).toEqual(
      firstWork,
    );
    expect(await harness.transaction.getWork(secondWork.meta.id)).toEqual(
      secondWork,
    );
    for (const checkpoint of [
      crossWorkCheckpoint,
      unknownDocumentCheckpoint,
      unknownWorkCheckpoint,
    ]) {
      expect(
        await harness.transaction.getCheckpointById(checkpoint.meta.id),
      ).toBeNull();
    }
  });

  it("allows exactly one concurrent capture from the same Work state", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const harness = createHarness({ works: [work], documents: [document] });
    const revision = await appendRevision({
      revisionStore: harness.revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const checkpoints = [
      createCheckpoint({
        workId: work.meta.id,
        documentId: document.meta.id,
        documentRevisionId: revision.id,
        capturedAfter: work.meta.updatedAt,
      }),
      createCheckpoint({
        workId: work.meta.id,
        documentId: document.meta.id,
        documentRevisionId: revision.id,
        capturedAfter: work.meta.updatedAt,
      }),
    ] as const;

    const settled = await Promise.allSettled(
      checkpoints.map((checkpoint) =>
        harness.capture.execute({
          checkpoint,
          expectedWorkRevision: work.meta.revision,
          expectedResumeCheckpointId: null,
          expectedCurrentDocumentRevisionId: revision.id,
        }),
      ),
    );

    const fulfilled = settled.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = settled.filter(
      (result) => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(
      ResumeCheckpointConflictError,
    );
    const successfulResult = fulfilled[0]?.value;
    expect(successfulResult).toBeDefined();
    const finalWork = await harness.transaction.getWork(work.meta.id);
    expect(finalWork?.resumeCheckpointId).toBe(
      successfulResult?.checkpoint.meta.id,
    );
    const failedCheckpoint = checkpoints.find(
      (checkpoint) =>
        checkpoint.meta.id !== successfulResult?.checkpoint.meta.id,
    );
    expect(failedCheckpoint).toBeDefined();
    expect(
      await harness.transaction.getCheckpointById(
        failedCheckpoint?.meta.id as EntityId<"ResumeCheckpoint">,
      ),
    ).toBeNull();
  });

  it("queries only the Work pointer and reports missing or corrupt pointers explicitly", async () => {
    const missingWork = createWork();
    const missingHarness = createHarness({
      works: [missingWork],
      documents: [],
    });
    await expect(missingHarness.query.execute(missingWork.meta.id)).resolves
      .toEqual({ status: "missing", workId: missingWork.meta.id });
    await expect(
      missingHarness.query.execute(entityId<"Work">(randomUUID())),
    ).rejects.toThrow(/Unknown work/);

    const danglingId = entityId<"ResumeCheckpoint">(randomUUID());
    const danglingWork = createWork(danglingId);
    const unrelatedWork = createWork();
    const unrelatedCheckpoint = createCheckpoint({
      workId: unrelatedWork.meta.id,
      documentId: entityId<"Document">(randomUUID()),
      documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      capturedAfter: unrelatedWork.meta.updatedAt,
    });
    const danglingHarness = createHarness({
      works: [danglingWork, unrelatedWork],
      documents: [],
      checkpoints: [unrelatedCheckpoint],
    });
    await expect(
      danglingHarness.query.execute(danglingWork.meta.id),
    ).rejects.toBeInstanceOf(ResumeCheckpointIntegrityError);

    const owningWork = createWork();
    const crossWorkCheckpoint = createCheckpoint({
      workId: owningWork.meta.id,
      documentId: entityId<"Document">(randomUUID()),
      documentRevisionId: entityId<"DocumentRevision">(randomUUID()),
      capturedAfter: owningWork.meta.updatedAt,
    });
    const pointingWork = createWork(crossWorkCheckpoint.meta.id);
    const crossWorkHarness = createHarness({
      works: [pointingWork, owningWork],
      documents: [],
      checkpoints: [crossWorkCheckpoint],
    });
    await expect(
      crossWorkHarness.query.execute(pointingWork.meta.id),
    ).rejects.toBeInstanceOf(ResumeCheckpointIntegrityError);
  });
});
