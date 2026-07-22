declare const entityIdBrand: unique symbol;

export type EntityId<TEntity extends string> = string & {
  readonly [entityIdBrand]: TEntity;
};

export type Instant = string;
export type OrderKey = string;

export type RecordMeta<TEntity extends string> = {
  readonly id: EntityId<TEntity>;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly retiredAt?: Instant;
};

export type Work = {
  readonly meta: RecordMeta<"Work">;
  readonly studioId: EntityId<"Studio">;
  readonly title: string;
  readonly subtitle?: string;
  readonly kindRef?: EntityId<"DictionaryValue">;
  readonly statusRef?: EntityId<"DictionaryValue">;
  readonly orderKey: OrderKey;
  readonly resumeCheckpointId?: EntityId<"ResumeCheckpoint">;
  readonly settingsId: EntityId<"WorkSettings">;
  readonly customFields?: Readonly<Record<string, unknown>>;
};

export type Document = {
  readonly meta: RecordMeta<"Document">;
  readonly workId: EntityId<"Work">;
  readonly folderId?: EntityId<"DocumentFolder">;
  readonly documentKindRef?: EntityId<"DictionaryValue">;
  readonly title: string;
  readonly orderKey: OrderKey;
  readonly manuscriptId: EntityId<"Manuscript">;
  readonly sceneRuleSetId?: EntityId<"SceneRuleSet">;
  readonly archivedAt?: Instant;
};

export type DocumentRevision = {
  readonly id: EntityId<"DocumentRevision">;
  readonly documentId: EntityId<"Document">;
  readonly parentRevisionId?: EntityId<"DocumentRevision">;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly length: number;
  readonly changeSetRef?: string;
  readonly cause: string;
  readonly createdAt: Instant;
  readonly durableAt: Instant;
};

export type ContextReference = {
  readonly entityType: string;
  readonly entityId: string;
};

export type ResumeCheckpoint = {
  readonly meta: RecordMeta<"ResumeCheckpoint">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly cursorAnchorId: EntityId<"Anchor">;
  readonly selectionAnchorId?: EntityId<"Anchor">;
  readonly workspaceMode: string;
  readonly contextRefs?: readonly ContextReference[];
  readonly focusCheckpointId?: EntityId<"FocusCheckpoint">;
  readonly musicCheckpointId?: EntityId<"MusicCheckpoint">;
  readonly capturedAt: Instant;
};

export type WritingCatalog = {
  getWork(id: EntityId<"Work">): Work | null;
  getDocument(id: EntityId<"Document">): Document | null;
  getDocumentForWork(
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
  ): Document | null;
};

export function entityId<TEntity extends string>(
  value: string,
): EntityId<TEntity> {
  if (value.length === 0) {
    throw new Error("Entity identity must be non-empty");
  }
  return value as EntityId<TEntity>;
}

function freezeWork(work: Work): Work {
  return Object.freeze({
    ...work,
    meta: Object.freeze({ ...work.meta }),
  });
}

function freezeDocument(document: Document): Document {
  return Object.freeze({
    ...document,
    meta: Object.freeze({ ...document.meta }),
  });
}

export function createWritingCatalog(input: {
  readonly works: readonly Work[];
  readonly documents: readonly Document[];
}): WritingCatalog {
  const works = new Map<EntityId<"Work">, Work>();
  for (const work of input.works) {
    if (works.has(work.meta.id)) {
      throw new Error(`Duplicate work identity: ${work.meta.id}`);
    }
    const frozenWork = freezeWork(work);
    works.set(frozenWork.meta.id, frozenWork);
  }
  const documents = new Map<EntityId<"Document">, Document>();
  for (const document of input.documents) {
    if (documents.has(document.meta.id)) {
      throw new Error(`Duplicate document identity: ${document.meta.id}`);
    }
    if (!works.has(document.workId)) {
      throw new Error(
        `Document ${document.meta.id} does not belong to a registered work`,
      );
    }
    const frozenDocument = freezeDocument(document);
    documents.set(frozenDocument.meta.id, frozenDocument);
  }

  return Object.freeze({
    getWork: (id: EntityId<"Work">) => works.get(id) ?? null,
    getDocument: (id: EntityId<"Document">) => documents.get(id) ?? null,
    getDocumentForWork: (
      workId: EntityId<"Work">,
      documentId: EntityId<"Document">,
    ) => {
      const document = documents.get(documentId);
      return document?.workId === workId ? document : null;
    },
  });
}
