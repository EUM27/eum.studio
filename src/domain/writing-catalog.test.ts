import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createWritingCatalog,
  entityId,
  type Document,
  type EntityId,
  type RecordMeta,
  type Work,
} from "./writing";

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

describe("writing catalog", () => {
  it("rejects an empty opaque entity identity", () => {
    expect(() => entityId<"Work">("")).toThrow("non-empty");
  });

  it("resolves only explicitly registered works and their owned documents", () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const originalWorkTitle = work.title;
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });

    (work as { title: string }).title = randomUUID();

    expect(catalog.getWork(work.meta.id)?.title).toBe(originalWorkTitle);
    expect(catalog.getDocument(document.meta.id)).toEqual(document);
    expect(
      catalog.getWork(entityId<"Work">(randomUUID())),
    ).toBeNull();
    expect(
      catalog.getDocument(entityId<"Document">(randomUUID())),
    ).toBeNull();
    expect(Object.isFrozen(catalog.getWork(work.meta.id))).toBe(true);
    expect(Object.isFrozen(catalog.getDocument(document.meta.id))).toBe(true);
  });

  it("rejects a document whose owning work is absent", () => {
    const registeredWork = createWork();
    const foreignDocument = createDocument(
      entityId<"Work">(randomUUID()),
    );

    expect(() =>
      createWritingCatalog({
        works: [registeredWork],
        documents: [foreignDocument],
      }),
    ).toThrow("registered work");
  });

  it("rejects duplicate work identities instead of replacing an owner", () => {
    const work = createWork();
    const duplicate = {
      ...createWork(),
      meta: createMeta(work.meta.id),
    };

    expect(() =>
      createWritingCatalog({
        works: [work, duplicate],
        documents: [],
      }),
    ).toThrow("Duplicate work identity");
  });

  it("rejects duplicate document identities instead of replacing manuscript ownership", () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const duplicate = {
      ...createDocument(work.meta.id),
      meta: createMeta(document.meta.id),
    };

    expect(() =>
      createWritingCatalog({
        works: [work],
        documents: [document, duplicate],
      }),
    ).toThrow("Duplicate document identity");
  });

  it("resolves a document only through its owning work boundary", () => {
    const owningWork = createWork();
    const otherWork = createWork();
    const document = createDocument(owningWork.meta.id);
    const catalog = createWritingCatalog({
      works: [owningWork, otherWork],
      documents: [document],
    });

    expect(
      catalog.getDocumentForWork(
        owningWork.meta.id,
        document.meta.id,
      ),
    ).toEqual(document);
    expect(
      catalog.getDocumentForWork(
        otherWork.meta.id,
        document.meta.id,
      ),
    ).toBeNull();
  });
});
