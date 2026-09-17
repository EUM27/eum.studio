import type { EntityId } from "../../domain/writing";

export type MutableDocumentSaveTarget = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  baseRevisionId:
    EntityId<"DocumentRevision">;
  currentRevisionId:
    EntityId<"DocumentRevision">;
  nextSequence: number;
  text: string;
};

