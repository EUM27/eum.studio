import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createWritingCatalog,
  entityId,
  type Document,
  type EntityId,
  type RecordMeta,
  type Work,
} from "../../domain/writing";
import { InMemoryRevisionStore } from "./in-memory-revision-store";

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

function createCatalogFixture(): {
  work: Work;
  document: Document;
  catalog: ReturnType<typeof createWritingCatalog>;
} {
  const work: Work = {
    meta: createMeta(entityId<"Work">(randomUUID())),
    studioId: entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId: entityId<"WorkSettings">(randomUUID()),
  };
  const document: Document = {
    meta: createMeta(entityId<"Document">(randomUUID())),
    workId: work.meta.id,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId: entityId<"Manuscript">(randomUUID()),
  };

  return {
    work,
    document,
    catalog: createWritingCatalog({
      works: [work],
      documents: [document],
    }),
  };
}

describe("in-memory revision store", () => {
  it("appends and materializes an immutable initial revision for its document", async () => {
    const { catalog, document } = createCatalogFixture();
    const content = randomUUID();
    const contentDescriptor = {
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: content.length,
    };
    const describeContent = vi.fn(() => contentDescriptor);
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const cause = randomUUID();
    const createdAt = new Date().toISOString();
    const durableAt = new Date().toISOString();

    const revision = await store.append({
      revisionId,
      workId: document.workId,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content,
      cause,
      createdAt,
      durableAt,
    });

    expect(revision).toEqual({
      id: revisionId,
      documentId: document.meta.id,
      ...contentDescriptor,
      cause,
      createdAt,
      durableAt,
    });
    expect(Object.isFrozen(revision)).toBe(true);
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toEqual(revision);
    await expect(store.materialize(revisionId)).resolves.toBe(content);
    expect(describeContent).toHaveBeenCalledWith(content);
  });

  it("rejects a revision for an unregistered document without falling back to another document", async () => {
    const { catalog, document } = createCatalogFixture();
    const content = randomUUID();
    const describeContent = vi.fn(() => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: content.length,
    }));
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });

    await expect(
      store.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: document.workId,
        documentId: entityId<"Document">(randomUUID()),
        expectedCurrentRevisionId: null,
        content,
        cause: randomUUID(),
        createdAt: new Date().toISOString(),
        durableAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("Unknown document");
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBeNull();
    expect(describeContent).not.toHaveBeenCalled();
  });

  it("rejects a registered document addressed through a different work", async () => {
    const { work, document } = createCatalogFixture();
    const otherWork: Work = {
      meta: createMeta(entityId<"Work">(randomUUID())),
      studioId: work.studioId,
      title: randomUUID(),
      orderKey: randomUUID(),
      settingsId: entityId<"WorkSettings">(randomUUID()),
    };
    const catalog = createWritingCatalog({
      works: [work, otherWork],
      documents: [document],
    });
    const describeContent = vi.fn((value: string) => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: value.length,
    }));
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });

    await expect(
      store.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: otherWork.meta.id,
        documentId: document.meta.id,
        expectedCurrentRevisionId: null,
        content: randomUUID(),
        cause: randomUUID(),
        createdAt: new Date().toISOString(),
        durableAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("Work/document boundary");
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBeNull();
    expect(describeContent).not.toHaveBeenCalled();
  });

  it("rejects a stale expected revision without replacing the current revision", async () => {
    const { catalog, document } = createCatalogFixture();
    const describeContent = vi.fn((value: string) => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: value.length,
    }));
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });
    const initialContent = randomUUID();
    const initialRevision = await store.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: document.workId,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content: initialContent,
      cause: randomUUID(),
      createdAt: new Date().toISOString(),
      durableAt: new Date().toISOString(),
    });

    await expect(
      store.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: document.workId,
        documentId: document.meta.id,
        expectedCurrentRevisionId: null,
        content: randomUUID(),
        cause: randomUUID(),
        createdAt: new Date().toISOString(),
        durableAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("Revision conflict");
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBe(initialRevision);
    await expect(
      store.materialize(initialRevision.id),
    ).resolves.toBe(initialContent);
    expect(describeContent).toHaveBeenCalledTimes(1);
  });

  it("appends a child revision while preserving its immutable parent content", async () => {
    const { catalog, document } = createCatalogFixture();
    const describeContent = vi.fn((value: string) => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: value.length,
    }));
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });
    const parentContent = randomUUID();
    const parent = await store.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: document.workId,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content: parentContent,
      cause: randomUUID(),
      createdAt: new Date().toISOString(),
      durableAt: new Date().toISOString(),
    });
    const childContent = randomUUID();

    const child = await store.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: document.workId,
      documentId: document.meta.id,
      expectedCurrentRevisionId: parent.id,
      content: childContent,
      cause: randomUUID(),
      createdAt: new Date().toISOString(),
      durableAt: new Date().toISOString(),
    });

    expect(child.parentRevisionId).toBe(parent.id);
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBe(child);
    await expect(store.materialize(parent.id)).resolves.toBe(
      parentContent,
    );
    await expect(store.materialize(child.id)).resolves.toBe(
      childContent,
    );
  });

  it("rejects a duplicate revision identity without overwriting immutable history", async () => {
    const { catalog, document } = createCatalogFixture();
    const describeContent = vi.fn((value: string) => ({
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: value.length,
    }));
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent,
    });
    const revisionId = entityId<"DocumentRevision">(randomUUID());
    const originalContent = randomUUID();
    const original = await store.append({
      revisionId,
      workId: document.workId,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content: originalContent,
      cause: randomUUID(),
      createdAt: new Date().toISOString(),
      durableAt: new Date().toISOString(),
    });

    await expect(
      store.append({
        revisionId,
        workId: document.workId,
        documentId: document.meta.id,
        expectedCurrentRevisionId: original.id,
        content: randomUUID(),
        cause: randomUUID(),
        createdAt: new Date().toISOString(),
        durableAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("Duplicate revision identity");
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBe(original);
    await expect(store.materialize(original.id)).resolves.toBe(
      originalContent,
    );
    expect(describeContent).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a known document with no revision from an unknown document", async () => {
    const { catalog, document } = createCatalogFixture();
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent: (value) => ({
        contentRef: randomUUID(),
        contentHash: randomUUID(),
        length: value.length,
      }),
    });

    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBeNull();
    await expect(
      store.getCurrentRevision(
        entityId<"Document">(randomUUID()),
      ),
    ).rejects.toThrow("Unknown document");
  });

  it("rejects content metadata with a non-representable length", async () => {
    const { catalog, document } = createCatalogFixture();
    const content = randomUUID();
    const store = new InMemoryRevisionStore({
      catalog,
      describeContent: () => ({
        contentRef: randomUUID(),
        contentHash: randomUUID(),
        length: -randomInt(1, 32),
      }),
    });

    await expect(
      store.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: document.workId,
        documentId: document.meta.id,
        expectedCurrentRevisionId: null,
        content,
        cause: randomUUID(),
        createdAt: new Date().toISOString(),
        durableAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("content length");
    await expect(
      store.getCurrentRevision(document.meta.id),
    ).resolves.toBeNull();
  });

  it.each(["contentRef", "contentHash"] as const)(
    "rejects content metadata with an empty %s",
    async (emptyField) => {
      const { catalog, document } = createCatalogFixture();
      const content = randomUUID();
      const descriptor: {
        contentRef: string;
        contentHash: string;
        length: number;
      } = {
        contentRef: randomUUID(),
        contentHash: randomUUID(),
        length: content.length,
      };
      descriptor[emptyField] = "";
      const store = new InMemoryRevisionStore({
        catalog,
        describeContent: () => descriptor,
      });

      await expect(
        store.append({
          revisionId: entityId<"DocumentRevision">(randomUUID()),
          workId: document.workId,
          documentId: document.meta.id,
          expectedCurrentRevisionId: null,
          content,
          cause: randomUUID(),
          createdAt: new Date().toISOString(),
          durableAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(emptyField);
      await expect(
        store.getCurrentRevision(document.meta.id),
      ).resolves.toBeNull();
    },
  );
});
