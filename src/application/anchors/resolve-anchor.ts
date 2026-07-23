import type { RevisionStore } from "../revisions/revision-store";
import type { DescribeAnchorEvidence } from "./create-anchor";
import type {
  Anchor,
  AnchorMatchedEvidence,
  AnchorResolutionMethod,
  EntityId,
  WritingCatalog,
} from "../../domain/writing";

export type AnchorReader = {
  getAnchorById(anchorId: EntityId<"Anchor">): Promise<Anchor | null>;
};

export type AnchorResolutionCandidate = {
  readonly startOffset: number;
  readonly endOffset: number;
};

type AnchorResolutionBase = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly targetRevisionId: EntityId<"DocumentRevision">;
};

export type ResolvedAnchor = AnchorResolutionBase & {
  readonly status: "resolved";
  readonly method: AnchorResolutionMethod;
  readonly range: AnchorResolutionCandidate;
  readonly matchedEvidence: readonly AnchorMatchedEvidence[];
};

export type ReviewableAnchor = AnchorResolutionBase & {
  readonly status: "needsReview";
  readonly candidates: readonly AnchorResolutionCandidate[];
};

export type BrokenAnchor = AnchorResolutionBase & {
  readonly status: "broken";
  readonly candidates: readonly AnchorResolutionCandidate[];
};

export type RetiredAnchor = AnchorResolutionBase & {
  readonly status: "retired";
  readonly candidates: readonly AnchorResolutionCandidate[];
};

export type AnchorResolution =
  | ResolvedAnchor
  | ReviewableAnchor
  | BrokenAnchor
  | RetiredAnchor;

export class AnchorIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnchorIntegrityError";
  }
}

function rangeAt(
  startOffset: number,
  quoteLength: number,
): AnchorResolutionCandidate {
  return Object.freeze({
    startOffset,
    endOffset: startOffset + quoteLength,
  });
}

function contextMatches(
  content: string,
  candidate: AnchorResolutionCandidate,
  anchor: Anchor,
): boolean {
  const prefixStart =
    candidate.startOffset - anchor.prefixContext.length;
  if (prefixStart < 0) {
    return false;
  }
  return (
    content.slice(prefixStart, candidate.startOffset) ===
      anchor.prefixContext &&
    content.slice(
      candidate.endOffset,
      candidate.endOffset + anchor.suffixContext.length,
    ) === anchor.suffixContext
  );
}

function findOccurrences(
  content: string,
  needle: string,
): number[] {
  if (needle.length === 0) {
    return [];
  }
  const offsets: number[] = [];
  let fromOffset = 0;
  while (fromOffset <= content.length - needle.length) {
    const offset = content.indexOf(needle, fromOffset);
    if (offset === -1) {
      break;
    }
    offsets.push(offset);
    fromOffset = offset + 1;
  }
  return offsets;
}

function freezeCandidates(
  candidates: readonly AnchorResolutionCandidate[],
): readonly AnchorResolutionCandidate[] {
  return Object.freeze(
    candidates.map((candidate) => Object.freeze({ ...candidate })),
  );
}

export class ResolveAnchor {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionStore;
  readonly #reader: AnchorReader;
  readonly #describeEvidence: DescribeAnchorEvidence;

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionStore;
    readonly reader: AnchorReader;
    readonly describeEvidence: DescribeAnchorEvidence;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
    this.#reader = input.reader;
    this.#describeEvidence = input.describeEvidence;
  }

  async execute(input: {
    readonly workId: EntityId<"Work">;
    readonly anchorId: EntityId<"Anchor">;
    readonly targetRevisionId: EntityId<"DocumentRevision">;
  }): Promise<AnchorResolution> {
    const anchor = await this.#reader.getAnchorById(input.anchorId);
    if (anchor === null || anchor.meta.id !== input.anchorId) {
      throw new AnchorIntegrityError(
        `Missing anchor: ${input.anchorId}`,
      );
    }
    if (
      this.#catalog.getDocumentForWork(
        input.workId,
        anchor.documentId,
      ) === null
    ) {
      throw new AnchorIntegrityError(
        `Anchor ${anchor.meta.id} is outside Work ${input.workId}`,
      );
    }
    const originRevision = await this.#revisionStore.getRevision(
      anchor.originRevisionId,
    );
    const targetRevision = await this.#revisionStore.getRevision(
      input.targetRevisionId,
    );
    if (
      originRevision === null ||
      originRevision.documentId !== anchor.documentId
    ) {
      throw new AnchorIntegrityError(
        `Anchor ${anchor.meta.id} has an invalid origin revision`,
      );
    }
    if (
      targetRevision === null ||
      targetRevision.documentId !== anchor.documentId
    ) {
      throw new AnchorIntegrityError(
        `Anchor ${anchor.meta.id} cannot resolve outside its document`,
      );
    }
    const originContent = await this.#revisionStore.materialize(
      originRevision.id,
    );
    if (
      !Number.isSafeInteger(anchor.startOffset) ||
      !Number.isSafeInteger(anchor.endOffset) ||
      anchor.startOffset < 0 ||
      anchor.endOffset < anchor.startOffset ||
      anchor.endOffset > originContent.length
    ) {
      throw new AnchorIntegrityError(
        `Anchor ${anchor.meta.id} has an invalid origin range`,
      );
    }
    const capturedEvidence = {
      exactQuote: originContent.slice(
        anchor.startOffset,
        anchor.endOffset,
      ),
      prefixContext: originContent.slice(
        Math.max(
          0,
          anchor.startOffset - anchor.prefixContext.length,
        ),
        anchor.startOffset,
      ),
      suffixContext: originContent.slice(
        anchor.endOffset,
        anchor.endOffset + anchor.suffixContext.length,
      ),
    };
    const descriptor = this.#describeEvidence(capturedEvidence);
    if (
      capturedEvidence.exactQuote !== anchor.exactQuote ||
      capturedEvidence.prefixContext !== anchor.prefixContext ||
      capturedEvidence.suffixContext !== anchor.suffixContext ||
      descriptor.quoteHash !== anchor.quoteHash ||
      descriptor.contextHash !== anchor.contextHash
    ) {
      throw new AnchorIntegrityError(
        `Anchor ${anchor.meta.id} evidence does not match its origin revision`,
      );
    }
    const base = {
      anchorId: anchor.meta.id,
      documentId: anchor.documentId,
      targetRevisionId: targetRevision.id,
    };
    if (anchor.status === "retired") {
      return Object.freeze({
        ...base,
        status: "retired",
        candidates: Object.freeze([]),
      });
    }

    const targetContent = await this.#revisionStore.materialize(
      targetRevision.id,
    );
    const storedRange = rangeAt(
      anchor.startOffset,
      anchor.exactQuote.length,
    );
    if (
      storedRange.endOffset <= targetContent.length &&
      targetContent.slice(
        storedRange.startOffset,
        storedRange.endOffset,
      ) === anchor.exactQuote &&
      contextMatches(targetContent, storedRange, anchor)
    ) {
      return Object.freeze({
        ...base,
        status: "resolved",
        method: "exact-offset",
        range: storedRange,
        matchedEvidence: Object.freeze([
          "quote",
          "prefix-context",
          "suffix-context",
        ] satisfies AnchorMatchedEvidence[]),
      });
    }

    if (anchor.exactQuote.length === 0) {
      const contextNeedle =
        anchor.prefixContext + anchor.suffixContext;
      if (contextNeedle.length === 0) {
        const candidate = rangeAt(
          Math.min(anchor.startOffset, targetContent.length),
          0,
        );
        return Object.freeze({
          ...base,
          status: "needsReview",
          candidates: freezeCandidates([candidate]),
        });
      }
      const candidates = findOccurrences(
        targetContent,
        contextNeedle,
      ).map((offset) =>
        rangeAt(offset + anchor.prefixContext.length, 0),
      );
      if (candidates.length === 1) {
        return Object.freeze({
          ...base,
          status: "resolved",
          method: "context-match",
          range: candidates[0]!,
          matchedEvidence: Object.freeze([
            "prefix-context",
            "suffix-context",
          ] satisfies AnchorMatchedEvidence[]),
        });
      }
      if (candidates.length > 1) {
        return Object.freeze({
          ...base,
          status: "needsReview",
          candidates: freezeCandidates(candidates),
        });
      }
      return Object.freeze({
        ...base,
        status: "broken",
        candidates: Object.freeze([]),
      });
    }

    const quoteCandidates = findOccurrences(
      targetContent,
      anchor.exactQuote,
    ).map((offset) => rangeAt(offset, anchor.exactQuote.length));
    const compatibleCandidates = quoteCandidates.filter((candidate) =>
      contextMatches(targetContent, candidate, anchor),
    );
    if (compatibleCandidates.length === 1) {
      return Object.freeze({
        ...base,
        status: "resolved",
        method: "unique-quote",
        range: compatibleCandidates[0]!,
        matchedEvidence: Object.freeze([
          "quote",
          "prefix-context",
          "suffix-context",
        ] satisfies AnchorMatchedEvidence[]),
      });
    }
    const reviewCandidates =
      compatibleCandidates.length > 0
        ? compatibleCandidates
        : quoteCandidates;
    if (reviewCandidates.length > 0) {
      return Object.freeze({
        ...base,
        status: "needsReview",
        candidates: freezeCandidates(reviewCandidates),
      });
    }
    return Object.freeze({
      ...base,
      status: "broken",
      candidates: Object.freeze([]),
    });
  }
}
