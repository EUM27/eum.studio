import type {
  ResumeCheckpointCaptureReader,
} from "./capture-resume-checkpoint";
import type {
  EntityId,
  ResumeCheckpoint,
} from "../../domain/writing";

export type ResumeCheckpointLookup =
  | {
      readonly status: "missing";
      readonly workId: EntityId<"Work">;
    }
  | {
      readonly status: "ready";
      readonly workId: EntityId<"Work">;
      readonly checkpoint: ResumeCheckpoint;
    };

export class ResumeCheckpointIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeCheckpointIntegrityError";
  }
}

export class GetResumeCheckpointForWork {
  readonly #reader: ResumeCheckpointCaptureReader;

  constructor(reader: ResumeCheckpointCaptureReader) {
    this.#reader = reader;
  }

  async execute(
    workId: EntityId<"Work">,
  ): Promise<ResumeCheckpointLookup> {
    const work = await this.#reader.getWork(workId);
    if (work === null) {
      throw new Error(`Unknown work: ${workId}`);
    }
    const checkpointId = work.resumeCheckpointId;
    if (checkpointId === undefined) {
      return Object.freeze({ status: "missing", workId });
    }

    const checkpoint = await this.#reader.getCheckpointById(checkpointId);
    if (checkpoint === null) {
      throw new ResumeCheckpointIntegrityError(
        `Work ${workId} points to missing checkpoint ${checkpointId}`,
      );
    }
    if (
      checkpoint.meta.id !== checkpointId ||
      checkpoint.workId !== workId
    ) {
      throw new ResumeCheckpointIntegrityError(
        `Work ${workId} points to a checkpoint outside its ownership boundary`,
      );
    }
    return Object.freeze({
      status: "ready",
      workId,
      checkpoint,
    });
  }
}
