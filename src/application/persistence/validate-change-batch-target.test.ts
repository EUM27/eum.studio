import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createWritingCatalog,
  entityId,
  type Document,
  type DocumentRevision,
  type EntityId,
  type RecordMeta,
  type Work,
} from "../../domain/writing";
import type { RevisionStore } from "../revisions/revision-store";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "./change-batch";
import {
  ChangeBatchTargetConflictError,
  ValidateChangeBatchTarget,
} from "./validate-change-batch-target";

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

function createRevision(
  documentId: EntityId<"Document">,
  length: number,
): DocumentRevision {
  const createdAt = new Date().toISOString();
  return Object.freeze({
    id: entityId<"DocumentRevision">(randomUUID()),
    documentId,
    contentRef: randomUUID(),
    contentHash: randomUUID(),
    length,
    cause: randomUUID(),
    createdAt,
    durableAt: createdAt,
  });
}

function createBatch(input: {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevision: DocumentRevision;
  beforeTextLengthUtf16?: number;
}) {
  const insertedText = randomUUID();
  const beforeTextLengthUtf16 =
    input.beforeTextLengthUtf16 ?? input.baseRevision.length;

  return parseChangeBatch({
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: input.workId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevision.id,
    sequence: randomInt(0, 32),
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16,
    afterTextLengthUtf16:
      beforeTextLengthUtf16 + insertedText.length,
    changes: [
      {
        fromUtf16: beforeTextLengthUtf16,
        toUtf16: beforeTextLengthUtf16,
        insertedText,
      },
    ],
  });
}

function createRevisionStore(
  currentRevision: DocumentRevision | null,
): RevisionStore {
  return {
    append: vi.fn(),
    getCurrentRevision: vi.fn(async () => currentRevision),
    getRevision: vi.fn(async (revisionId) =>
      currentRevision?.id === revisionId ? currentRevision : null,
    ),
    materialize: vi.fn(),
  };
}

describe("ValidateChangeBatchTarget", () => {
  it("accepts a batch only against its registered document's current durable revision", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const revision = createRevision(
      document.meta.id,
      randomInt(1, 32),
    );
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });
    const revisionStore = createRevisionStore(revision);
    const batch = createBatch({
      workId: work.meta.id,
      documentId: document.meta.id,
      baseRevision: revision,
    });

    const validator = new ValidateChangeBatchTarget({
      catalog,
      revisionStore,
    });

    await expect(validator.execute(batch)).resolves.toBe(batch);
    expect(revisionStore.getCurrentRevision).toHaveBeenCalledWith(
      document.meta.id,
    );
  });

  it("leaves a subsequent batch's current journal-head length to atomic apply validation", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const revision = createRevision(
      document.meta.id,
      randomInt(1, 32),
    );
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });
    const batch = createBatch({
      workId: work.meta.id,
      documentId: document.meta.id,
      baseRevision: revision,
      beforeTextLengthUtf16:
        revision.length + randomInt(1, 32),
    });

    const validator = new ValidateChangeBatchTarget({
      catalog,
      revisionStore: createRevisionStore(revision),
    });

    await expect(validator.execute(batch)).resolves.toBe(batch);
  });

  it("rejects a registered document addressed through a different work before consulting revision state", async () => {
    const owningWork = createWork();
    const otherWork = createWork();
    const document = createDocument(owningWork.meta.id);
    const revision = createRevision(
      document.meta.id,
      randomInt(1, 32),
    );
    const revisionStore = createRevisionStore(revision);
    const validator = new ValidateChangeBatchTarget({
      catalog: createWritingCatalog({
        works: [owningWork, otherWork],
        documents: [document],
      }),
      revisionStore,
    });
    const batch = createBatch({
      workId: otherWork.meta.id,
      documentId: document.meta.id,
      baseRevision: revision,
    });

    await expect(validator.execute(batch)).rejects.toThrow(
      "Work/document boundary",
    );
    expect(revisionStore.getCurrentRevision).not.toHaveBeenCalled();
  });

  it("rejects stale base identity without falling back to the current revision", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const baseRevision = createRevision(
      document.meta.id,
      randomInt(1, 32),
    );
    const currentRevision = createRevision(
      document.meta.id,
      baseRevision.length,
    );
    const validator = new ValidateChangeBatchTarget({
      catalog: createWritingCatalog({
        works: [work],
        documents: [document],
      }),
      revisionStore: createRevisionStore(currentRevision),
    });

    await expect(
      validator.execute(
        createBatch({
          workId: work.meta.id,
          documentId: document.meta.id,
          baseRevision,
        }),
      ),
    ).rejects.toBeInstanceOf(ChangeBatchTargetConflictError);
  });

  it("rejects a revision returned across a different document boundary", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const foreignRevision = createRevision(
      entityId<"Document">(randomUUID()),
      randomInt(1, 32),
    );
    const validator = new ValidateChangeBatchTarget({
      catalog: createWritingCatalog({
        works: [work],
        documents: [document],
      }),
      revisionStore: createRevisionStore(foreignRevision),
    });

    await expect(
      validator.execute(
        createBatch({
          workId: work.meta.id,
          documentId: document.meta.id,
          baseRevision: foreignRevision,
        }),
      ),
    ).rejects.toThrow("Revision/document boundary");
  });
});
