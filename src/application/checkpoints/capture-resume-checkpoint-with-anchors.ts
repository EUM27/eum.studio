import type {
  RevisionStore,
} from "../revisions/revision-store";
import {
  ResumeCheckpointConflictError,
  type ResumeCheckpointCaptureReader,
  type ResumeCheckpointCaptureResult,
} from "./capture-resume-checkpoint";
import type {
  Anchor,
  EntityId,
  ResumeCheckpoint,
  Work,
  WritingCatalog,
} from "../../domain/writing";

export type CommitResumeCheckpointWithAnchorsInput = {
  readonly checkpoint:
    ResumeCheckpoint;
  readonly cursorAnchor: Anchor;
  readonly selectionAnchor?:
    Anchor;
  readonly expectedWorkRevision:
    number;
  readonly expectedResumeCheckpointId:
    | EntityId<"ResumeCheckpoint">
    | null;
  readonly expectedDocumentRevisionId:
    EntityId<"DocumentRevision">;
  readonly expectedDocumentRevisionLength:
    number;
  readonly nextWork: Work;
};

export type ResumeCheckpointWithAnchorsCaptureTransaction =
  ResumeCheckpointCaptureReader & {
    commit(
      input:
        CommitResumeCheckpointWithAnchorsInput,
    ):
      Promise<
        ResumeCheckpointCaptureResult
      >;
  };

export type CaptureResumeCheckpointWithAnchorsInput = {
  readonly checkpoint:
    ResumeCheckpoint;
  readonly cursorAnchor: Anchor;
  readonly selectionAnchor?:
    Anchor;
  readonly expectedWorkRevision:
    number;
  readonly expectedResumeCheckpointId:
    | EntityId<"ResumeCheckpoint">
    | null;
  readonly expectedDocumentRevisionId:
    EntityId<"DocumentRevision">;
};

function currentCheckpointId(
  work: Work,
): EntityId<"ResumeCheckpoint"> | null {
  return (
    work.resumeCheckpointId ??
    null
  );
}

function assertAnchorRange(
  anchor: Anchor,
  revisionLength: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(
      anchor.startOffset,
    ) ||
    !Number.isSafeInteger(
      anchor.endOffset,
    ) ||
    anchor.startOffset < 0 ||
    anchor.endOffset < 0 ||
    anchor.startOffset >
      anchor.endOffset ||
    anchor.endOffset >
      revisionLength
  ) {
    throw new Error(
      `${label} Anchor range is outside the current durable revision`,
    );
  }
}

function assertAnchorRevision(
  anchor: Anchor,
  checkpoint:
    ResumeCheckpoint,
  expectedDocumentRevisionId:
    EntityId<"DocumentRevision">,
  label: string,
): void {
  if (
    anchor.documentId !==
      checkpoint.documentId
  ) {
    throw new Error(
      `${label} Anchor document does not match the checkpoint document`,
    );
  }
  if (
    anchor.originRevisionId !==
      expectedDocumentRevisionId ||
    anchor.resolvedRevisionId !==
      expectedDocumentRevisionId
  ) {
    throw new Error(
      `${label} Anchor revision does not match the current durable revision`,
    );
  }
}

function assertAnchorReferences(
  input:
    CaptureResumeCheckpointWithAnchorsInput,
): void {
  if (
    input.checkpoint
      .cursorAnchorId !==
    input.cursorAnchor.meta.id
  ) {
    throw new Error(
      "Checkpoint cursor Anchor reference does not match the supplied Anchor",
    );
  }
  const checkpointSelectionId =
    input.checkpoint
      .selectionAnchorId ??
    null;
  const suppliedSelectionId =
    input.selectionAnchor
      ?.meta.id ??
    null;
  if (
    checkpointSelectionId !==
    suppliedSelectionId
  ) {
    throw new Error(
      "Checkpoint selection Anchor reference does not match the supplied Anchor",
    );
  }
}

export class CaptureResumeCheckpointWithAnchors {
  readonly #catalog:
    WritingCatalog;
  readonly #revisionStore:
    RevisionStore;
  readonly #transaction:
    ResumeCheckpointWithAnchorsCaptureTransaction;

  constructor(input: {
    readonly catalog:
      WritingCatalog;
    readonly revisionStore:
      RevisionStore;
    readonly transaction:
      ResumeCheckpointWithAnchorsCaptureTransaction;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore =
      input.revisionStore;
    this.#transaction =
      input.transaction;
  }

  async execute(
    input:
      CaptureResumeCheckpointWithAnchorsInput,
  ): Promise<
    ResumeCheckpointCaptureResult
  > {
    assertAnchorReferences(input);
    const { checkpoint } =
      input;
    const work =
      await this.#transaction
        .getWork(
          checkpoint.workId,
        );
    if (work === null) {
      throw new Error(
        `Unknown work: ${checkpoint.workId}`,
      );
    }
    if (
      work.meta.revision !==
      input.expectedWorkRevision
    ) {
      throw new ResumeCheckpointConflictError(
        `Work revision conflict for ${checkpoint.workId}`,
      );
    }
    if (
      currentCheckpointId(work) !==
      input
        .expectedResumeCheckpointId
    ) {
      throw new ResumeCheckpointConflictError(
        `Resume checkpoint pointer conflict for ${checkpoint.workId}`,
      );
    }

    if (
      this.#catalog.getDocument(
        checkpoint.documentId,
      ) === null
    ) {
      throw new Error(
        `Unknown document: ${checkpoint.documentId}`,
      );
    }
    if (
      this.#catalog
        .getDocumentForWork(
          checkpoint.workId,
          checkpoint.documentId,
        ) === null
    ) {
      throw new Error(
        `Work/document boundary violation: ${checkpoint.workId}/${checkpoint.documentId}`,
      );
    }
    if (
      checkpoint
        .documentRevisionId !==
      input
        .expectedDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision does not match the expected durable revision for document ${checkpoint.documentId}`,
      );
    }

    const currentRevision =
      await this.#revisionStore
        .getCurrentRevision(
          checkpoint.documentId,
        );
    if (
      currentRevision?.id !==
      input
        .expectedDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision is not the current durable revision for document ${checkpoint.documentId}`,
      );
    }
    if (
      !Number.isSafeInteger(
        currentRevision.length,
      ) ||
      currentRevision.length < 0
    ) {
      throw new Error(
        "Current durable revision length must be a non-negative safe integer",
      );
    }

    assertAnchorRevision(
      input.cursorAnchor,
      checkpoint,
      input
        .expectedDocumentRevisionId,
      "Cursor",
    );
    assertAnchorRange(
      input.cursorAnchor,
      currentRevision.length,
      "Cursor",
    );
    if (
      input.cursorAnchor
        .startOffset !==
      input.cursorAnchor.endOffset
    ) {
      throw new Error(
        "Cursor Anchor must be zero-width",
      );
    }
    if (
      input.selectionAnchor !==
      undefined
    ) {
      assertAnchorRevision(
        input.selectionAnchor,
        checkpoint,
        input
          .expectedDocumentRevisionId,
        "Selection",
      );
      assertAnchorRange(
        input.selectionAnchor,
        currentRevision.length,
        "Selection",
      );
    }

    const nextWork: Work = {
      ...work,
      meta: {
        ...work.meta,
        revision:
          work.meta.revision + 1,
        updatedAt:
          checkpoint.capturedAt,
      },
      resumeCheckpointId:
        checkpoint.meta.id,
    };

    return this.#transaction
      .commit({
        checkpoint,
        cursorAnchor:
          input.cursorAnchor,
        ...(input.selectionAnchor ===
        undefined
          ? {}
          : {
              selectionAnchor:
                input
                  .selectionAnchor,
            }),
        expectedWorkRevision:
          input
            .expectedWorkRevision,
        expectedResumeCheckpointId:
          input
            .expectedResumeCheckpointId,
        expectedDocumentRevisionId:
          input
            .expectedDocumentRevisionId,
        expectedDocumentRevisionLength:
          currentRevision.length,
        nextWork,
      });
  }
}
