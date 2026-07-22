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

export type SaveResumeCheckpointInput = {
  readonly checkpoint: ResumeCheckpoint;
  readonly expectedCurrentCheckpointId: EntityId<"ResumeCheckpoint"> | null;
};

export type ResumeCheckpointStore = {
  save(input: SaveResumeCheckpointInput): Promise<ResumeCheckpoint>;
  getForWork(
    workId: EntityId<"Work">,
  ): Promise<ResumeCheckpointLookup>;
};
