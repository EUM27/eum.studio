import type { RevisionStore } from "../revisions/revision-store";
import type {
  Anchor,
  EntityId,
  ResumeCheckpoint,
  Work,
  WritingCatalog,
} from "../../domain/writing";

export type ResumeCheckpointCaptureResult = {
  readonly checkpoint: ResumeCheckpoint;
  readonly work: Work;
};

export type CommitResumeCheckpointCaptureInput = {
  readonly checkpoint: ResumeCheckpoint;
  readonly expectedWorkRevision: number;
  readonly expectedResumeCheckpointId:
    | EntityId<"ResumeCheckpoint">
    | null;
  readonly expectedCurrentDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly nextWork: Work;
};

export type ResumeCheckpointCaptureReader = {
  getWork(workId: EntityId<"Work">): Promise<Work | null>;
  getCheckpointById(
    checkpointId: EntityId<"ResumeCheckpoint">,
  ): Promise<ResumeCheckpoint | null>;
  getAnchorById(
    anchorId: EntityId<"Anchor">,
  ): Promise<Anchor | null>;
};

export type ResumeCheckpointCaptureTransaction =
  ResumeCheckpointCaptureReader & {
    commit(
      input: CommitResumeCheckpointCaptureInput,
    ): Promise<ResumeCheckpointCaptureResult>;
  };

export type CaptureResumeCheckpointInput = {
  readonly checkpoint: ResumeCheckpoint;
  readonly expectedWorkRevision: number;
  readonly expectedResumeCheckpointId:
    | EntityId<"ResumeCheckpoint">
    | null;
  readonly expectedCurrentDocumentRevisionId: EntityId<"DocumentRevision">;
};

export class ResumeCheckpointConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeCheckpointConflictError";
  }
}

function currentCheckpointId(
  work: Work,
): EntityId<"ResumeCheckpoint"> | null {
  return work.resumeCheckpointId ?? null;
}

export class CaptureResumeCheckpoint {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionStore;
  readonly #transaction: ResumeCheckpointCaptureTransaction;

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionStore;
    readonly transaction: ResumeCheckpointCaptureTransaction;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
    this.#transaction = input.transaction;
  }

  async execute(
    input: CaptureResumeCheckpointInput,
  ): Promise<ResumeCheckpointCaptureResult> {
    const { checkpoint } = input;
    const work = await this.#transaction.getWork(checkpoint.workId);
    if (work === null) {
      throw new Error(`Unknown work: ${checkpoint.workId}`);
    }
    if (work.meta.revision !== input.expectedWorkRevision) {
      throw new ResumeCheckpointConflictError(
        `Work revision conflict for ${checkpoint.workId}`,
      );
    }
    if (
      currentCheckpointId(work) !== input.expectedResumeCheckpointId
    ) {
      throw new ResumeCheckpointConflictError(
        `Resume checkpoint pointer conflict for ${checkpoint.workId}`,
      );
    }

    const document = this.#catalog.getDocument(checkpoint.documentId);
    if (document === null) {
      throw new Error(`Unknown document: ${checkpoint.documentId}`);
    }
    if (
      this.#catalog.getDocumentForWork(
        checkpoint.workId,
        checkpoint.documentId,
      ) === null
    ) {
      throw new Error(
        `Work/document boundary violation: ${checkpoint.workId}/${checkpoint.documentId}`,
      );
    }
    if (
      checkpoint.documentRevisionId !==
      input.expectedCurrentDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision does not match the expected current durable revision for document ${checkpoint.documentId}`,
      );
    }

    const currentRevision = await this.#revisionStore.getCurrentRevision(
      checkpoint.documentId,
    );
    if (
      currentRevision?.id !== input.expectedCurrentDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision is not the current durable revision for document ${checkpoint.documentId}`,
      );
    }

    const nextWork: Work = {
      ...work,
      meta: {
        ...work.meta,
        revision: work.meta.revision + 1,
        updatedAt: checkpoint.capturedAt,
      },
      resumeCheckpointId: checkpoint.meta.id,
    };

    return this.#transaction.commit({
      checkpoint,
      expectedWorkRevision: input.expectedWorkRevision,
      expectedResumeCheckpointId: input.expectedResumeCheckpointId,
      expectedCurrentDocumentRevisionId:
        input.expectedCurrentDocumentRevisionId,
      nextWork,
    });
  }
}
