import {
  AnchorIntegrityError,
  ResolveAnchor,
  type AnchorReader,
  type AnchorResolution,
} from "../anchors/resolve-anchor";
import type { DescribeAnchorEvidence } from "../anchors/create-anchor";
import {
  GetResumeCheckpointForWork,
} from "./get-resume-checkpoint-for-work";
import type { ResumeCheckpointCaptureReader } from "./capture-resume-checkpoint";
import type { RevisionReader } from "../revisions/revision-store";
import type {
  Anchor,
  EntityId,
  ResumeCheckpoint,
  WritingCatalog,
} from "../../domain/writing";

export type ResumeCheckpointReader =
  ResumeCheckpointCaptureReader & AnchorReader;

type ResumeResolutionBase = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly targetRevisionId: EntityId<"DocumentRevision">;
  readonly checkpoint: ResumeCheckpoint;
  readonly anchorResolutions: readonly AnchorResolution[];
};

export type ResumeCheckpointResolution =
  | {
      readonly status: "missing";
      readonly workId: EntityId<"Work">;
    }
  | (ResumeResolutionBase & {
      readonly status: "resolved";
      readonly cursorOffset: number;
      readonly selection?: {
        readonly startOffset: number;
        readonly endOffset: number;
      };
    })
  | (ResumeResolutionBase & {
      readonly status: "needsReview";
      readonly move: null;
    })
  | (ResumeResolutionBase & {
      readonly status: "broken";
      readonly move: null;
    });

export class ResumeAnchorIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAnchorIntegrityError";
  }
}

function assertCheckpointAnchor(
  checkpoint: ResumeCheckpoint,
  anchor: Anchor,
  role: "cursor" | "selection",
): void {
  if (
    anchor.documentId !== checkpoint.documentId ||
    anchor.originRevisionId !== checkpoint.documentRevisionId
  ) {
    throw new ResumeAnchorIntegrityError(
      `${role} anchor is outside the checkpoint document revision`,
    );
  }
  const isEmpty = anchor.startOffset === anchor.endOffset;
  if (
    (role === "cursor" && !isEmpty) ||
    (role === "selection" && isEmpty)
  ) {
    throw new ResumeAnchorIntegrityError(
      `${role} anchor has an invalid range shape`,
    );
  }
}

export class ResolveResumeCheckpointForWork {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionReader;
  readonly #reader: ResumeCheckpointReader;
  readonly #checkpointQuery: GetResumeCheckpointForWork;
  readonly #anchorResolver: ResolveAnchor;

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionReader;
    readonly reader: ResumeCheckpointReader;
    readonly describeEvidence: DescribeAnchorEvidence;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
    this.#reader = input.reader;
    this.#checkpointQuery = new GetResumeCheckpointForWork(input.reader);
    this.#anchorResolver = new ResolveAnchor({
      catalog: input.catalog,
      revisionStore: input.revisionStore,
      reader: input.reader,
      describeEvidence: input.describeEvidence,
    });
  }

  async execute(
    workId: EntityId<"Work">,
  ): Promise<ResumeCheckpointResolution> {
    const lookup = await this.#checkpointQuery.execute(workId);
    if (lookup.status === "missing") {
      return lookup;
    }
    const { checkpoint } = lookup;
    if (
      this.#catalog.getDocumentForWork(
        workId,
        checkpoint.documentId,
      ) === null
    ) {
      throw new ResumeAnchorIntegrityError(
        "Checkpoint document is outside its Work boundary",
      );
    }
    const checkpointRevision = await this.#revisionStore.getRevision(
      checkpoint.documentRevisionId,
    );
    if (
      checkpointRevision === null ||
      checkpointRevision.documentId !== checkpoint.documentId
    ) {
      throw new ResumeAnchorIntegrityError(
        "Checkpoint revision is outside its document boundary",
      );
    }
    const currentRevision =
      await this.#revisionStore.getCurrentRevision(
        checkpoint.documentId,
      );
    if (currentRevision === null) {
      throw new ResumeAnchorIntegrityError(
        "Checkpoint document has no durable current revision",
      );
    }
    const cursorAnchor = await this.#reader.getAnchorById(
      checkpoint.cursorAnchorId,
    );
    if (
      cursorAnchor === null ||
      cursorAnchor.meta.id !== checkpoint.cursorAnchorId
    ) {
      throw new ResumeAnchorIntegrityError(
        "Checkpoint cursor anchor is missing",
      );
    }
    assertCheckpointAnchor(checkpoint, cursorAnchor, "cursor");

    const selectionAnchor =
      checkpoint.selectionAnchorId === undefined
        ? null
        : await this.#reader.getAnchorById(
            checkpoint.selectionAnchorId,
          );
    if (
      checkpoint.selectionAnchorId !== undefined &&
      (selectionAnchor === null ||
        selectionAnchor.meta.id !== checkpoint.selectionAnchorId)
    ) {
      throw new ResumeAnchorIntegrityError(
        "Checkpoint selection anchor is missing",
      );
    }
    if (selectionAnchor !== null) {
      if (selectionAnchor.meta.id === cursorAnchor.meta.id) {
        throw new ResumeAnchorIntegrityError(
          "Cursor and selection anchors must have distinct identities",
        );
      }
      assertCheckpointAnchor(
        checkpoint,
        selectionAnchor,
        "selection",
      );
    }

    let anchorResolutions: readonly AnchorResolution[];
    try {
      anchorResolutions = Object.freeze(
        await Promise.all(
          [cursorAnchor, selectionAnchor]
            .filter((anchor): anchor is Anchor => anchor !== null)
            .map((anchor) =>
              this.#anchorResolver.execute({
                workId,
                anchorId: anchor.meta.id,
                targetRevisionId: currentRevision.id,
              }),
            ),
        ),
      );
    } catch (error) {
      if (error instanceof AnchorIntegrityError) {
        throw new ResumeAnchorIntegrityError(error.message);
      }
      throw error;
    }
    const base = {
      workId,
      documentId: checkpoint.documentId,
      targetRevisionId: currentRevision.id,
      checkpoint,
      anchorResolutions,
    };
    if (
      anchorResolutions.some(
        (resolution) =>
          resolution.status === "broken" ||
          resolution.status === "retired",
      )
    ) {
      return Object.freeze({
        ...base,
        status: "broken",
        move: null,
      });
    }
    if (
      anchorResolutions.some(
        (resolution) => resolution.status === "needsReview",
      )
    ) {
      return Object.freeze({
        ...base,
        status: "needsReview",
        move: null,
      });
    }

    const [cursorResolution, selectionResolution] =
      anchorResolutions;
    if (
      cursorResolution === undefined ||
      cursorResolution.status !== "resolved"
    ) {
      throw new ResumeAnchorIntegrityError(
        "Resolved checkpoint is missing its cursor range",
      );
    }
    return Object.freeze({
      ...base,
      status: "resolved",
      cursorOffset: cursorResolution.range.startOffset,
      ...(selectionResolution === undefined
        ? {}
        : selectionResolution.status === "resolved"
          ? {
              selection: Object.freeze({
                startOffset:
                  selectionResolution.range.startOffset,
                endOffset: selectionResolution.range.endOffset,
              }),
            }
          : {}),
    });
  }
}
