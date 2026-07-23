import type { RevisionStore } from "../revisions/revision-store";
import type {
  Anchor,
  AnchorMatchedEvidence,
  EntityId,
  RecordMeta,
  WritingCatalog,
} from "../../domain/writing";

export type AnchorPolicy = {
  readonly schemaVersion: 1;
  readonly version: string;
  readonly contextOffsetLength: number;
};

export type AnchorEvidenceInput = {
  readonly exactQuote: string;
  readonly prefixContext: string;
  readonly suffixContext: string;
};

export type AnchorEvidenceDescriptor = {
  readonly quoteHash: string;
  readonly contextHash: string;
};

export type DescribeAnchorEvidence = (
  input: AnchorEvidenceInput,
) => AnchorEvidenceDescriptor;

export type CreateAnchorInput = {
  readonly meta: RecordMeta<"Anchor">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly policy: AnchorPolicy;
  readonly commandRef: string;
  readonly actorRef: string;
};

function assertPolicy(policy: AnchorPolicy): void {
  if (policy.version.length === 0) {
    throw new Error("Anchor policy version must not be empty");
  }
  if (
    !Number.isSafeInteger(policy.contextOffsetLength) ||
    policy.contextOffsetLength < 0
  ) {
    throw new Error(
      "Anchor policy context offset length must be a non-negative integer",
    );
  }
}

function assertRange(
  startOffset: number,
  endOffset: number,
  documentLength: number,
): void {
  if (
    !Number.isSafeInteger(startOffset) ||
    !Number.isSafeInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    endOffset > documentLength
  ) {
    throw new Error("Anchor range must stay inside its document revision");
  }
}

function freezeAnchor(anchor: Anchor): Anchor {
  return Object.freeze({
    ...anchor,
    meta: Object.freeze({ ...anchor.meta }),
    resolutionEvidence: Object.freeze({
      ...anchor.resolutionEvidence,
      matchedEvidence: Object.freeze([
        ...anchor.resolutionEvidence.matchedEvidence,
      ]),
      candidateOffsets: Object.freeze([
        ...anchor.resolutionEvidence.candidateOffsets,
      ]),
    }),
  });
}

export class CreateAnchor {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionStore;
  readonly #describeEvidence: DescribeAnchorEvidence;

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionStore;
    readonly describeEvidence: DescribeAnchorEvidence;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
    this.#describeEvidence = input.describeEvidence;
  }

  async execute(input: CreateAnchorInput): Promise<Anchor> {
    if (this.#catalog.getWork(input.workId) === null) {
      throw new Error(`Unknown work: ${input.workId}`);
    }
    if (
      this.#catalog.getDocumentForWork(
        input.workId,
        input.documentId,
      ) === null
    ) {
      throw new Error(
        `Work/document boundary violation: ${input.workId}/${input.documentId}`,
      );
    }
    const revision = await this.#revisionStore.getRevision(
      input.documentRevisionId,
    );
    if (
      revision === null ||
      revision.documentId !== input.documentId
    ) {
      throw new Error(
        `Anchor revision does not belong to document ${input.documentId}`,
      );
    }
    assertPolicy(input.policy);
    const content = await this.#revisionStore.materialize(revision.id);
    if (content.length !== revision.length) {
      throw new Error(
        `Revision length integrity failure for ${revision.id}`,
      );
    }
    assertRange(input.startOffset, input.endOffset, content.length);

    const contextLength = input.policy.contextOffsetLength;
    const exactQuote = content.slice(
      input.startOffset,
      input.endOffset,
    );
    const prefixContext = content.slice(
      Math.max(0, input.startOffset - contextLength),
      input.startOffset,
    );
    const suffixContext = content.slice(
      input.endOffset,
      input.endOffset + contextLength,
    );
    const descriptor = this.#describeEvidence({
      exactQuote,
      prefixContext,
      suffixContext,
    });
    if (
      descriptor.quoteHash.length === 0 ||
      descriptor.contextHash.length === 0
    ) {
      throw new Error("Anchor evidence hashes must not be empty");
    }
    const matchedEvidence: AnchorMatchedEvidence[] = [
      "origin-revision",
      "quote",
      "prefix-context",
      "suffix-context",
    ];

    return freezeAnchor({
      meta: input.meta,
      documentId: input.documentId,
      originRevisionId: revision.id,
      resolvedRevisionId: revision.id,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      exactQuote,
      prefixContext,
      suffixContext,
      quoteHash: descriptor.quoteHash,
      contextHash: descriptor.contextHash,
      status: "resolved",
      resolutionEvidence: {
        targetRevisionId: revision.id,
        method: "created",
        matchedEvidence,
        candidateOffsets: [input.startOffset],
        policyVersion: input.policy.version,
        assessedAt: input.meta.createdAt,
        commandRef: input.commandRef,
        actorRef: input.actorRef,
      },
    });
  }
}
