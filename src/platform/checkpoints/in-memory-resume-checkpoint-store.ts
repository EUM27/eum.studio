import type {
  ResumeCheckpointLookup,
  ResumeCheckpointStore,
  SaveResumeCheckpointInput,
} from "../../application/checkpoints/resume-checkpoint-store";
import type { RevisionStore } from "../../application/revisions/revision-store";
import type {
  EntityId,
  ResumeCheckpoint,
  WritingCatalog,
} from "../../domain/writing";

export class InMemoryResumeCheckpointStore implements ResumeCheckpointStore {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionStore;
  readonly #checkpoints = new Map<
    EntityId<"ResumeCheckpoint">,
    ResumeCheckpoint
  >();
  readonly #currentByWork = new Map<
    EntityId<"Work">,
    EntityId<"ResumeCheckpoint">
  >();

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionStore;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
  }

  async save(input: SaveResumeCheckpointInput): Promise<ResumeCheckpoint> {
    const { checkpoint } = input;
    if (this.#catalog.getWork(checkpoint.workId) === null) {
      throw new Error(`Unknown work: ${checkpoint.workId}`);
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
    const currentRevision = await this.#revisionStore.getCurrentRevision(
      checkpoint.documentId,
    );
    if (currentRevision?.id !== checkpoint.documentRevisionId) {
      throw new Error(
        `Checkpoint revision is not current for document ${checkpoint.documentId}`,
      );
    }
    if (this.#checkpoints.has(checkpoint.meta.id)) {
      throw new Error(
        `Duplicate checkpoint identity: ${checkpoint.meta.id}`,
      );
    }
    const currentCheckpointId =
      this.#currentByWork.get(checkpoint.workId) ?? null;
    if (currentCheckpointId !== input.expectedCurrentCheckpointId) {
      throw new Error(
        `Checkpoint conflict for work ${checkpoint.workId}`,
      );
    }

    const contextRefs =
      checkpoint.contextRefs === undefined
        ? undefined
        : Object.freeze(
            checkpoint.contextRefs.map((contextRef) =>
              Object.freeze({ ...contextRef }),
            ),
          );
    const saved = Object.freeze({
      ...checkpoint,
      meta: Object.freeze({ ...checkpoint.meta }),
      ...(contextRefs === undefined ? {} : { contextRefs }),
    });
    this.#checkpoints.set(saved.meta.id, saved);
    this.#currentByWork.set(saved.workId, saved.meta.id);
    return saved;
  }

  async getForWork(
    workId: EntityId<"Work">,
  ): Promise<ResumeCheckpointLookup> {
    if (this.#catalog.getWork(workId) === null) {
      throw new Error(`Unknown work: ${workId}`);
    }
    const checkpointId = this.#currentByWork.get(workId);
    if (checkpointId !== undefined) {
      const checkpoint = this.#checkpoints.get(checkpointId);
      if (checkpoint === undefined) {
        throw new Error(
          `Missing checkpoint record for work ${workId}`,
        );
      }
      return Object.freeze({
        status: "ready",
        workId,
        checkpoint,
      });
    }
    return Object.freeze({
      status: "missing",
      workId,
    });
  }
}
