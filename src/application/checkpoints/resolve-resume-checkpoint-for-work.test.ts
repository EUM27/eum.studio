import { createHash, randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { CreateAnchor } from "../anchors/create-anchor";
import {
  ResolveResumeCheckpointForWork,
  ResumeAnchorIntegrityError,
} from "./resolve-resume-checkpoint-for-work";
import {
  createWritingCatalog,
  entityId,
  type Anchor,
  type Document,
  type DocumentRevision,
  type EntityId,
  type RecordMeta,
  type ResumeCheckpoint,
  type Work,
  type WritingCatalog,
} from "../../domain/writing";
import { InMemoryResumeCheckpointCaptureTransaction } from "../../platform/checkpoints/in-memory-resume-checkpoint-capture";
import { InMemoryRevisionStore } from "../../platform/revisions/in-memory-revision-store";

function createMeta<TEntity extends string>(
  id: EntityId<TEntity>,
): RecordMeta<TEntity> {
  const recordedAt = new Date().toISOString();
  return {
    id,
    schemaVersion: randomInt(1, 32),
    revision: randomInt(1, 32),
    createdAt: recordedAt,
    updatedAt: recordedAt,
  };
}

function createWork(
  checkpointId?: EntityId<"ResumeCheckpoint">,
): Work {
  return {
    meta: createMeta(entityId<"Work">(randomUUID())),
    studioId: entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    ...(checkpointId === undefined
      ? {}
      : { resumeCheckpointId: checkpointId }),
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

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createCheckpoint(input: {
  readonly checkpointId: EntityId<"ResumeCheckpoint">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly cursorAnchorId: EntityId<"Anchor">;
  readonly selectionAnchorId?: EntityId<"Anchor">;
}): ResumeCheckpoint {
  const capturedAt = new Date().toISOString();
  return {
    meta: {
      ...createMeta(input.checkpointId),
      createdAt: capturedAt,
      updatedAt: capturedAt,
    },
    workId: input.workId,
    documentId: input.documentId,
    documentRevisionId: input.revisionId,
    cursorAnchorId: input.cursorAnchorId,
    ...(input.selectionAnchorId === undefined
      ? {}
      : { selectionAnchorId: input.selectionAnchorId }),
    workspaceMode: randomUUID(),
    capturedAt,
  };
}

async function appendRevision(input: {
  readonly revisionStore: InMemoryRevisionStore;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly parentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly content: string;
}): Promise<DocumentRevision> {
  const recordedAt = new Date().toISOString();
  return input.revisionStore.append({
    revisionId: entityId<"DocumentRevision">(randomUUID()),
    workId: input.workId,
    documentId: input.documentId,
    expectedCurrentRevisionId: input.parentRevisionId,
    content: input.content,
    cause: randomUUID(),
    createdAt: recordedAt,
    durableAt: recordedAt,
  });
}

type ResumeHarness = {
  readonly catalog: WritingCatalog;
  readonly revisionStore: InMemoryRevisionStore;
  readonly work: Work;
  readonly document: Document;
  readonly originRevision: DocumentRevision;
  readonly targetRevision: DocumentRevision;
  readonly cursorAnchor: Anchor;
  readonly selectionAnchor: Anchor;
  readonly checkpoint: ResumeCheckpoint;
  readonly service: ResolveResumeCheckpointForWork;
};

async function createResumeHarness(input: {
  readonly originContent: string;
  readonly targetContent?: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}): Promise<ResumeHarness> {
  const checkpointId = entityId<"ResumeCheckpoint">(randomUUID());
  const work = createWork(checkpointId);
  const document = createDocument(work.meta.id);
  const catalog = createWritingCatalog({
    works: [work],
    documents: [document],
  });
  const describeEvidence = (evidence: {
    readonly exactQuote: string;
    readonly prefixContext: string;
    readonly suffixContext: string;
  }) => ({
    quoteHash: digest(evidence.exactQuote),
    contextHash: digest(
      JSON.stringify([
        evidence.prefixContext,
        evidence.suffixContext,
      ]),
    ),
  });
  const revisionStore = new InMemoryRevisionStore({
    catalog,
    describeContent: (content) => ({
      contentRef: randomUUID(),
      contentHash: digest(content),
      length: content.length,
    }),
  });
  const originRevision = await appendRevision({
    revisionStore,
    workId: work.meta.id,
    documentId: document.meta.id,
    parentRevisionId: null,
    content: input.originContent,
  });
  const createAnchor = new CreateAnchor({
    catalog,
    revisionStore,
    describeEvidence,
  });
  const policy = {
    schemaVersion: 1 as const,
    version: randomUUID(),
    contextOffsetLength: randomInt(2, 8),
  };
  const cursorAnchor = await createAnchor.execute({
    meta: createMeta(entityId<"Anchor">(randomUUID())),
    workId: work.meta.id,
    documentId: document.meta.id,
    documentRevisionId: originRevision.id,
    startOffset: input.selectionStart,
    endOffset: input.selectionStart,
    policy,
    commandRef: randomUUID(),
    actorRef: randomUUID(),
  });
  const selectionAnchor = await createAnchor.execute({
    meta: createMeta(entityId<"Anchor">(randomUUID())),
    workId: work.meta.id,
    documentId: document.meta.id,
    documentRevisionId: originRevision.id,
    startOffset: input.selectionStart,
    endOffset: input.selectionEnd,
    policy,
    commandRef: randomUUID(),
    actorRef: randomUUID(),
  });
  const targetRevision =
    input.targetContent === undefined
      ? originRevision
      : await appendRevision({
          revisionStore,
          workId: work.meta.id,
          documentId: document.meta.id,
          parentRevisionId: originRevision.id,
          content: input.targetContent,
        });
  const checkpoint = createCheckpoint({
    checkpointId,
    workId: work.meta.id,
    documentId: document.meta.id,
    revisionId: originRevision.id,
    cursorAnchorId: cursorAnchor.meta.id,
    selectionAnchorId: selectionAnchor.meta.id,
  });
  const reader = new InMemoryResumeCheckpointCaptureTransaction({
    works: [work],
    checkpoints: [checkpoint],
    anchors: [cursorAnchor, selectionAnchor],
    revisionStore,
  });
  const service = new ResolveResumeCheckpointForWork({
    catalog,
    revisionStore,
    reader,
    describeEvidence,
  });
  return {
    catalog,
    revisionStore,
    work,
    document,
    originRevision,
    targetRevision,
    cursorAnchor,
    selectionAnchor,
    checkpoint,
    service,
  };
}

describe("ResolveResumeCheckpointForWork", () => {
  it("restores the exact cursor and selection without expanding them", async () => {
    const prefix = randomUUID();
    const selection = `\n${randomUUID().slice(0, randomInt(2, 8))}`;
    const suffix = randomUUID();
    const originContent = `${prefix}${selection}${suffix}`;
    const selectionStart = prefix.length;
    const harness = await createResumeHarness({
      originContent,
      selectionStart,
      selectionEnd: selectionStart + selection.length,
    });

    await expect(
      harness.service.execute(harness.work.meta.id),
    ).resolves.toMatchObject({
      status: "resolved",
      workId: harness.work.meta.id,
      documentId: harness.document.meta.id,
      targetRevisionId: harness.targetRevision.id,
      cursorOffset: selectionStart,
      selection: {
        startOffset: selectionStart,
        endOffset: selectionStart + selection.length,
      },
    });
  });

  it("remaps only a unique quote with compatible context", async () => {
    const leading = randomUUID();
    const prefix = randomUUID();
    const selection = randomUUID();
    const suffix = randomUUID();
    const trailing = randomUUID();
    const originContent = `${prefix}${selection}${suffix}${trailing}`;
    const targetContent = `${leading}${originContent}`;
    const selectionStart = prefix.length;
    const harness = await createResumeHarness({
      originContent,
      targetContent,
      selectionStart,
      selectionEnd: selectionStart + selection.length,
    });

    const result = await harness.service.execute(harness.work.meta.id);

    expect(result).toMatchObject({
      status: "resolved",
      documentId: harness.document.meta.id,
      targetRevisionId: harness.targetRevision.id,
      cursorOffset: leading.length + selectionStart,
      selection: {
        startOffset: leading.length + selectionStart,
        endOffset: leading.length + selectionStart + selection.length,
      },
    });
    if (result.status !== "resolved") {
      throw new Error("Expected a resolved checkpoint");
    }
    expect(
      result.anchorResolutions.map((item) =>
        item.status === "resolved" ? item.method : item.status,
      ),
    ).toEqual(["context-match", "unique-quote"]);
  });

  it("opens the owned document without moving when repeated evidence is ambiguous or missing", async () => {
    const prefix = randomUUID();
    const selection = randomUUID();
    const suffix = randomUUID();
    const neighborhood = `${prefix}${selection}${suffix}`;
    const selectionStart = prefix.length;
    const leading = randomUUID();
    const ambiguousHarness = await createResumeHarness({
      originContent: neighborhood,
      targetContent: `${leading}${neighborhood}${randomUUID()}${neighborhood}`,
      selectionStart,
      selectionEnd: selectionStart + selection.length,
    });

    const ambiguous = await ambiguousHarness.service.execute(
      ambiguousHarness.work.meta.id,
    );

    expect(ambiguous).toMatchObject({
      status: "needsReview",
      documentId: ambiguousHarness.document.meta.id,
      targetRevisionId: ambiguousHarness.targetRevision.id,
      move: null,
    });
    if (ambiguous.status !== "needsReview") {
      throw new Error("Expected an ambiguous checkpoint");
    }
    expect(
      ambiguous.anchorResolutions.some(
        (resolution) =>
          resolution.status === "needsReview" &&
          resolution.candidates.length > 1,
      ),
    ).toBe(true);

    const brokenHarness = await createResumeHarness({
      originContent: neighborhood,
      targetContent: randomUUID(),
      selectionStart,
      selectionEnd: selectionStart + selection.length,
    });

    await expect(
      brokenHarness.service.execute(brokenHarness.work.meta.id),
    ).resolves.toMatchObject({
      status: "broken",
      documentId: brokenHarness.document.meta.id,
      targetRevisionId: brokenHarness.targetRevision.id,
      move: null,
    });
  });

  it("rejects anchors outside the checkpoint document and revision boundary", async () => {
    const content = randomUUID();
    const selectionStart = randomInt(1, content.length - 2);
    const harness = await createResumeHarness({
      originContent: content,
      selectionStart,
      selectionEnd: selectionStart + 1,
    });
    const foreignDocumentId = entityId<"Document">(randomUUID());
    const corruptedAnchor = {
      ...harness.cursorAnchor,
      documentId: foreignDocumentId,
    } satisfies Anchor;
    const reader = new InMemoryResumeCheckpointCaptureTransaction({
      works: [harness.work],
      checkpoints: [harness.checkpoint],
      anchors: [corruptedAnchor, harness.selectionAnchor],
      revisionStore: harness.revisionStore,
    });
    const service = new ResolveResumeCheckpointForWork({
      catalog: harness.catalog,
      revisionStore: harness.revisionStore,
      reader,
      describeEvidence: (evidence) => ({
        quoteHash: digest(evidence.exactQuote),
        contextHash: digest(
          JSON.stringify([
            evidence.prefixContext,
            evidence.suffixContext,
          ]),
        ),
      }),
    });

    await expect(service.execute(harness.work.meta.id)).rejects.toBeInstanceOf(
      ResumeAnchorIntegrityError,
    );
  });
});
