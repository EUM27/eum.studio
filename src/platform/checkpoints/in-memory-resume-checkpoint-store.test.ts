import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

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
import { InMemoryResumeCheckpointStore } from "./in-memory-resume-checkpoint-store";

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

function createWork(): Work {
  return {
    meta: createMeta(entityId<"Work">(randomUUID())),
    studioId: entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId: entityId<"WorkSettings">(randomUUID()),
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

function createCheckpoint(input: {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
}): ResumeCheckpoint {
  const contextRefs = [
    {
      entityType: randomUUID(),
      entityId: randomUUID(),
    },
  ];
  return {
    meta: createMeta(entityId<"ResumeCheckpoint">(randomUUID())),
    workId: input.workId,
    documentId: input.documentId,
    documentRevisionId: input.documentRevisionId,
    cursorAnchorId: entityId<"Anchor">(randomUUID()),
    selectionAnchorId: entityId<"Anchor">(randomUUID()),
    workspaceMode: randomUUID(),
    contextRefs,
    focusCheckpointId: entityId<"FocusCheckpoint">(randomUUID()),
    musicCheckpointId: entityId<"MusicCheckpoint">(randomUUID()),
    capturedAt: new Date().toISOString(),
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

describe("in-memory resume checkpoint store", () => {
  it("returns an explicit missing state for a registered work without a checkpoint", async () => {
    const work = createWork();
    const catalog = createWritingCatalog({
      works: [work],
      documents: [],
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore: createRevisionStore(catalog),
    });

    await expect(store.getForWork(work.meta.id)).resolves.toEqual({
      status: "missing",
      workId: work.meta.id,
    });
  });

  it("does not report an unknown work as a known work without a checkpoint", async () => {
    const work = createWork();
    const catalog = createWritingCatalog({
      works: [work],
      documents: [],
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore: createRevisionStore(catalog),
    });

    await expect(
      store.getForWork(entityId<"Work">(randomUUID())),
    ).rejects.toThrow(/Unknown work/);
  });

  it("stores and retrieves a checkpoint only after its document revision is durable", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });
    const revisionStore = createRevisionStore(catalog);
    const revision = await appendRevision({
      revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const checkpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore,
    });

    const saved = await store.save({
      checkpoint,
      expectedCurrentCheckpointId: null,
    });

    expect(saved).toEqual(checkpoint);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(Object.isFrozen(saved.meta)).toBe(true);
    expect(Object.isFrozen(saved.contextRefs)).toBe(true);
    expect(Object.isFrozen(saved.contextRefs?.[0])).toBe(true);
    await expect(store.getForWork(work.meta.id)).resolves.toEqual({
      status: "ready",
      workId: work.meta.id,
      checkpoint,
    });
  });

  it("keeps each work checkpoint independent without a global fallback", async () => {
    const firstWork = createWork();
    const secondWork = createWork();
    const firstDocument = createDocument(firstWork.meta.id);
    const secondDocument = createDocument(secondWork.meta.id);
    const catalog = createWritingCatalog({
      works: [firstWork, secondWork],
      documents: [firstDocument, secondDocument],
    });
    const revisionStore = createRevisionStore(catalog);
    const firstRevision = await appendRevision({
      revisionStore,
      workId: firstWork.meta.id,
      documentId: firstDocument.meta.id,
      expectedCurrentRevisionId: null,
    });
    const firstCheckpoint = createCheckpoint({
      workId: firstWork.meta.id,
      documentId: firstDocument.meta.id,
      documentRevisionId: firstRevision.id,
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore,
    });

    await store.save({
      checkpoint: firstCheckpoint,
      expectedCurrentCheckpointId: null,
    });

    await expect(store.getForWork(secondWork.meta.id)).resolves.toEqual({
      status: "missing",
      workId: secondWork.meta.id,
    });
    await expect(store.getForWork(firstWork.meta.id)).resolves.toEqual({
      status: "ready",
      workId: firstWork.meta.id,
      checkpoint: firstCheckpoint,
    });
  });

  it("rejects a document owned by another work without changing either work", async () => {
    const firstWork = createWork();
    const secondWork = createWork();
    const firstDocument = createDocument(firstWork.meta.id);
    const catalog = createWritingCatalog({
      works: [firstWork, secondWork],
      documents: [firstDocument],
    });
    const revisionStore = createRevisionStore(catalog);
    const firstRevision = await appendRevision({
      revisionStore,
      workId: firstWork.meta.id,
      documentId: firstDocument.meta.id,
      expectedCurrentRevisionId: null,
    });
    const mismatchedCheckpoint = createCheckpoint({
      workId: secondWork.meta.id,
      documentId: firstDocument.meta.id,
      documentRevisionId: firstRevision.id,
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore,
    });

    await expect(
      store.save({
        checkpoint: mismatchedCheckpoint,
        expectedCurrentCheckpointId: null,
      }),
    ).rejects.toThrow(/Work\/document boundary violation/);
    await expect(store.getForWork(firstWork.meta.id)).resolves.toEqual({
      status: "missing",
      workId: firstWork.meta.id,
    });
    await expect(store.getForWork(secondWork.meta.id)).resolves.toEqual({
      status: "missing",
      workId: secondWork.meta.id,
    });
  });

  it("rejects stale revision and checkpoint writes before replacing the current checkpoint", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });
    const revisionStore = createRevisionStore(catalog);
    const firstRevision = await appendRevision({
      revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
    });
    const firstCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: firstRevision.id,
    });
    const store = new InMemoryResumeCheckpointStore({
      catalog,
      revisionStore,
    });
    await store.save({
      checkpoint: firstCheckpoint,
      expectedCurrentCheckpointId: null,
    });
    const secondRevision = await appendRevision({
      revisionStore,
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: firstRevision.id,
    });
    const staleRevisionCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: firstRevision.id,
    });

    await expect(
      store.save({
        checkpoint: staleRevisionCheckpoint,
        expectedCurrentCheckpointId: firstCheckpoint.meta.id,
      }),
    ).rejects.toThrow(/Checkpoint revision is not current/);

    const secondCheckpoint = createCheckpoint({
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: secondRevision.id,
    });
    await expect(
      store.save({
        checkpoint: secondCheckpoint,
        expectedCurrentCheckpointId: null,
      }),
    ).rejects.toThrow(/Checkpoint conflict/);
    await expect(store.getForWork(work.meta.id)).resolves.toEqual({
      status: "ready",
      workId: work.meta.id,
      checkpoint: firstCheckpoint,
    });

    await expect(
      store.save({
        checkpoint: secondCheckpoint,
        expectedCurrentCheckpointId: firstCheckpoint.meta.id,
      }),
    ).resolves.toEqual(secondCheckpoint);
    await expect(store.getForWork(work.meta.id)).resolves.toEqual({
      status: "ready",
      workId: work.meta.id,
      checkpoint: secondCheckpoint,
    });
  });
});
