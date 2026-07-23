import type {
  CommitResumeCheckpointCaptureInput,
  ResumeCheckpointCaptureResult,
  ResumeCheckpointCaptureTransaction,
} from "../../application/checkpoints/capture-resume-checkpoint";
import { ResumeCheckpointConflictError } from "../../application/checkpoints/capture-resume-checkpoint";
import type { RevisionStore } from "../../application/revisions/revision-store";
import type {
  Anchor,
  EntityId,
  ResumeCheckpoint,
  Work,
} from "../../domain/writing";

type ResumeCheckpointCaptureState = {
  readonly works: ReadonlyMap<EntityId<"Work">, Work>;
  readonly checkpoints: ReadonlyMap<
    EntityId<"ResumeCheckpoint">,
    ResumeCheckpoint
  >;
  readonly anchors: ReadonlyMap<EntityId<"Anchor">, Anchor>;
};

function freezeWorkSnapshot(work: Work): Work {
  const customFields =
    work.customFields === undefined
      ? undefined
      : Object.freeze({ ...work.customFields });
  return Object.freeze({
    ...work,
    meta: Object.freeze({ ...work.meta }),
    ...(customFields === undefined ? {} : { customFields }),
  });
}

function freezeCheckpointSnapshot(
  checkpoint: ResumeCheckpoint,
): ResumeCheckpoint {
  const contextRefs =
    checkpoint.contextRefs === undefined
      ? undefined
      : Object.freeze(
          checkpoint.contextRefs.map((contextRef) =>
            Object.freeze({ ...contextRef }),
          ),
        );
  return Object.freeze({
    ...checkpoint,
    meta: Object.freeze({ ...checkpoint.meta }),
    ...(contextRefs === undefined ? {} : { contextRefs }),
  });
}

function freezeAnchorSnapshot(anchor: Anchor): Anchor {
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

function currentCheckpointId(
  work: Work,
): EntityId<"ResumeCheckpoint"> | null {
  return work.resumeCheckpointId ?? null;
}

export class InMemoryResumeCheckpointCaptureTransaction
  implements ResumeCheckpointCaptureTransaction
{
  readonly #revisionStore: RevisionStore;
  #state: ResumeCheckpointCaptureState;

  constructor(input: {
    readonly works: readonly Work[];
    readonly checkpoints?: readonly ResumeCheckpoint[];
    readonly anchors?: readonly Anchor[];
    readonly revisionStore: RevisionStore;
  }) {
    this.#revisionStore = input.revisionStore;
    const works = new Map<EntityId<"Work">, Work>();
    for (const work of input.works) {
      if (works.has(work.meta.id)) {
        throw new Error(`Duplicate work identity: ${work.meta.id}`);
      }
      const snapshot = freezeWorkSnapshot(work);
      works.set(snapshot.meta.id, snapshot);
    }
    const checkpoints = new Map<
      EntityId<"ResumeCheckpoint">,
      ResumeCheckpoint
    >();
    for (const checkpoint of input.checkpoints ?? []) {
      if (checkpoints.has(checkpoint.meta.id)) {
        throw new Error(
          `Duplicate checkpoint identity: ${checkpoint.meta.id}`,
        );
      }
      const snapshot = freezeCheckpointSnapshot(checkpoint);
      checkpoints.set(snapshot.meta.id, snapshot);
    }
    const anchors = new Map<EntityId<"Anchor">, Anchor>();
    for (const anchor of input.anchors ?? []) {
      if (anchors.has(anchor.meta.id)) {
        throw new Error(`Duplicate anchor identity: ${anchor.meta.id}`);
      }
      const snapshot = freezeAnchorSnapshot(anchor);
      anchors.set(snapshot.meta.id, snapshot);
    }
    this.#state = { works, checkpoints, anchors };
  }

  async getWork(workId: EntityId<"Work">): Promise<Work | null> {
    return this.#state.works.get(workId) ?? null;
  }

  async getCheckpointById(
    checkpointId: EntityId<"ResumeCheckpoint">,
  ): Promise<ResumeCheckpoint | null> {
    return this.#state.checkpoints.get(checkpointId) ?? null;
  }

  async getAnchorById(
    anchorId: EntityId<"Anchor">,
  ): Promise<Anchor | null> {
    return this.#state.anchors.get(anchorId) ?? null;
  }

  async commit(
    input: CommitResumeCheckpointCaptureInput,
  ): Promise<ResumeCheckpointCaptureResult> {
    const currentRevision = await this.#revisionStore.getCurrentRevision(
      input.checkpoint.documentId,
    );

    const currentWork = this.#state.works.get(input.checkpoint.workId);
    if (currentWork === undefined) {
      throw new Error(`Unknown work: ${input.checkpoint.workId}`);
    }
    if (currentWork.meta.revision !== input.expectedWorkRevision) {
      throw new ResumeCheckpointConflictError(
        `Work revision conflict for ${input.checkpoint.workId}`,
      );
    }
    if (
      currentCheckpointId(currentWork) !==
      input.expectedResumeCheckpointId
    ) {
      throw new ResumeCheckpointConflictError(
        `Resume checkpoint pointer conflict for ${input.checkpoint.workId}`,
      );
    }
    if (
      currentRevision?.id !== input.expectedCurrentDocumentRevisionId ||
      input.checkpoint.documentRevisionId !==
        input.expectedCurrentDocumentRevisionId
    ) {
      throw new Error(
        `Checkpoint revision is not the current durable revision for document ${input.checkpoint.documentId}`,
      );
    }
    if (this.#state.checkpoints.has(input.checkpoint.meta.id)) {
      throw new Error(
        `Duplicate checkpoint identity: ${input.checkpoint.meta.id}`,
      );
    }
    if (
      input.nextWork.meta.id !== currentWork.meta.id ||
      input.nextWork.resumeCheckpointId !== input.checkpoint.meta.id
    ) {
      throw new Error("Invalid Work update for checkpoint capture");
    }
    if (
      input.nextWork.meta.revision !==
      input.expectedWorkRevision + 1
    ) {
      throw new Error("Checkpoint capture must advance Work revision once");
    }

    const checkpoint = freezeCheckpointSnapshot(input.checkpoint);
    const work = freezeWorkSnapshot(input.nextWork);
    const works = new Map(this.#state.works);
    const checkpoints = new Map(this.#state.checkpoints);
    works.set(work.meta.id, work);
    checkpoints.set(checkpoint.meta.id, checkpoint);
    this.#state = {
      works,
      checkpoints,
      anchors: this.#state.anchors,
    };

    return Object.freeze({ checkpoint, work });
  }
}
