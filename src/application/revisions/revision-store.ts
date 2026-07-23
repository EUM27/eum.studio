import type {
  DocumentRevision,
  EntityId,
  Instant,
} from "../../domain/writing";

export type RevisionContentDescriptor = {
  readonly contentRef: string;
  readonly contentHash: string;
  readonly length: number;
};

export type DescribeRevisionContent = (
  content: string,
) => RevisionContentDescriptor;

export type AppendRevisionInput = {
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedCurrentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly content: string;
  readonly changeSetRef?: string;
  readonly cause: string;
  readonly createdAt: Instant;
  readonly durableAt: Instant;
};

export type RevisionStore = {
  append(input: AppendRevisionInput): Promise<DocumentRevision>;
  getCurrentRevision(
    documentId: EntityId<"Document">,
  ): Promise<DocumentRevision | null>;
  getRevision(
    revisionId: EntityId<"DocumentRevision">,
  ): Promise<DocumentRevision | null>;
  materialize(
    revisionId: EntityId<"DocumentRevision">,
  ): Promise<string>;
};
