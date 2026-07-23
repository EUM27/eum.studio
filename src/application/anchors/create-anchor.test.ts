import { createHash, randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createWritingCatalog,
  entityId,
  type Document,
  type EntityId,
  type RecordMeta,
  type Work,
} from "../../domain/writing";
import { InMemoryRevisionStore } from "../../platform/revisions/in-memory-revision-store";
import {
  CreateAnchor,
  type AnchorEvidenceDescriptor,
  type AnchorPolicy,
} from "./create-anchor";

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

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function describeEvidence(input: {
  readonly exactQuote: string;
  readonly prefixContext: string;
  readonly suffixContext: string;
}): AnchorEvidenceDescriptor {
  return {
    quoteHash: digest(input.exactQuote),
    contextHash: digest(
      JSON.stringify([input.prefixContext, input.suffixContext]),
    ),
  };
}

function createPolicy(): AnchorPolicy {
  return {
    schemaVersion: 1,
    version: randomUUID(),
    contextOffsetLength: randomInt(2, 12),
  };
}

describe("CreateAnchor", () => {
  it("preserves the exact requested offsets and captures versioned context evidence", async () => {
    const work = createWork();
    const document = createDocument(work.meta.id);
    const catalog = createWritingCatalog({
      works: [work],
      documents: [document],
    });
    const revisionStore = new InMemoryRevisionStore({
      catalog,
      describeContent: (content) => ({
        contentRef: randomUUID(),
        contentHash: digest(content),
        length: content.length,
      }),
    });
    const prefix = randomUUID();
    const exactQuote = `${randomUUID()}\n${randomUUID()}`;
    const suffix = randomUUID();
    const content = `${prefix}${exactQuote}${suffix}`;
    const recordedAt = new Date().toISOString();
    const revision = await revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: work.meta.id,
      documentId: document.meta.id,
      expectedCurrentRevisionId: null,
      content,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
    const policy = createPolicy();
    const startOffset = prefix.length;
    const endOffset = startOffset + exactQuote.length;
    const commandRef = randomUUID();
    const actorRef = randomUUID();
    const service = new CreateAnchor({
      catalog,
      revisionStore,
      describeEvidence,
    });

    const anchor = await service.execute({
      meta: createMeta(entityId<"Anchor">(randomUUID())),
      workId: work.meta.id,
      documentId: document.meta.id,
      documentRevisionId: revision.id,
      startOffset,
      endOffset,
      policy,
      commandRef,
      actorRef,
    });

    expect(anchor).toMatchObject({
      documentId: document.meta.id,
      originRevisionId: revision.id,
      resolvedRevisionId: revision.id,
      startOffset,
      endOffset,
      exactQuote,
      prefixContext: prefix.slice(-policy.contextOffsetLength),
      suffixContext: suffix.slice(0, policy.contextOffsetLength),
      status: "resolved",
      resolutionEvidence: {
        targetRevisionId: revision.id,
        method: "created",
        policyVersion: policy.version,
        commandRef,
        actorRef,
      },
    });
    expect(anchor.quoteHash).toBe(digest(exactQuote));
    expect(anchor.contextHash).toBe(
      digest(
        JSON.stringify([
          prefix.slice(-policy.contextOffsetLength),
          suffix.slice(0, policy.contextOffsetLength),
        ]),
      ),
    );
    expect(Object.isFrozen(anchor)).toBe(true);
    expect(Object.isFrozen(anchor.meta)).toBe(true);
    expect(Object.isFrozen(anchor.resolutionEvidence)).toBe(true);
    expect(
      Object.isFrozen(anchor.resolutionEvidence.matchedEvidence),
    ).toBe(true);
  });

  it("rejects cross-work documents, cross-document revisions, and expanded ranges", async () => {
    const ownerWork = createWork();
    const otherWork = createWork();
    const ownerDocument = createDocument(ownerWork.meta.id);
    const otherDocument = createDocument(otherWork.meta.id);
    const catalog = createWritingCatalog({
      works: [ownerWork, otherWork],
      documents: [ownerDocument, otherDocument],
    });
    const revisionStore = new InMemoryRevisionStore({
      catalog,
      describeContent: (content) => ({
        contentRef: randomUUID(),
        contentHash: digest(content),
        length: content.length,
      }),
    });
    const content = randomUUID();
    const recordedAt = new Date().toISOString();
    const ownerRevision = await revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: ownerWork.meta.id,
      documentId: ownerDocument.meta.id,
      expectedCurrentRevisionId: null,
      content,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
    const otherRevision = await revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: otherWork.meta.id,
      documentId: otherDocument.meta.id,
      expectedCurrentRevisionId: null,
      content,
      cause: randomUUID(),
      createdAt: recordedAt,
      durableAt: recordedAt,
    });
    const service = new CreateAnchor({
      catalog,
      revisionStore,
      describeEvidence,
    });
    const baseInput = {
      meta: createMeta(entityId<"Anchor">(randomUUID())),
      workId: ownerWork.meta.id,
      documentId: ownerDocument.meta.id,
      documentRevisionId: ownerRevision.id,
      startOffset: randomInt(1, content.length - 1),
      endOffset: content.length - 1,
      policy: createPolicy(),
      commandRef: randomUUID(),
      actorRef: randomUUID(),
    };

    await expect(
      service.execute({
        ...baseInput,
        workId: otherWork.meta.id,
      }),
    ).rejects.toThrow(/boundary/i);
    await expect(
      service.execute({
        ...baseInput,
        documentRevisionId: otherRevision.id,
      }),
    ).rejects.toThrow(/revision.*document/i);
    await expect(
      service.execute({
        ...baseInput,
        startOffset: baseInput.startOffset,
        endOffset: content.length + randomInt(1, 12),
      }),
    ).rejects.toThrow(/range/i);
    await expect(
      service.execute({
        ...baseInput,
        startOffset: baseInput.endOffset,
        endOffset: baseInput.startOffset,
      }),
    ).rejects.toThrow(/range/i);
  });
});
