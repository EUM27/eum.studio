import type {
  DocumentRevision,
  EntityId,
  Instant,
} from "../../domain/writing";
import type {
  BlobAddress,
  BlobMetadata,
} from "../storage/blob-store";

export type RevisionContentDescriptor = {
  readonly contentRef: string;
  readonly contentHash: string;
  readonly length: number;
};

export type DescribeRevisionContent = (
  content: string,
) => RevisionContentDescriptor;

export type RevisionBlobDescriptor = {
  readonly contentHash: string;
  readonly length: number;
};

export type RevisionBlobCodec = {
  readonly identity: string;
  encode(content: string): Uint8Array;
  decode(bytes: Uint8Array): string;
  describe(
    content: string,
  ): RevisionBlobDescriptor;
};

export type RevisionBlobManifestMetadata = {
  readonly createdAt: Instant;
  readonly mediaType?: string;
  readonly originalName?: string;
};

export type AppendRevisionInput = {
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedCurrentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly content: string;
  readonly editorStateJson?: string;
  readonly changeSetRef?: string;
  readonly cause: string;
  readonly createdAt: Instant;
  readonly durableAt: Instant;
};

export type RevisionBlobProfile = {
  readonly codec: RevisionBlobCodec;
  blobRefForAddress(
    address: BlobAddress,
  ): string;
  addressForBlobRef(
    blobRef: string,
  ): BlobAddress;
  metadataForAppend(
    input: AppendRevisionInput,
  ): BlobMetadata;
  temporaryEntryIdentityForAppend(
    input: AppendRevisionInput,
  ): string;
  manifestMetadataForAppend(
    input: AppendRevisionInput,
  ): RevisionBlobManifestMetadata;
};

export type RevisionReader = {
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

export type RevisionStore = RevisionReader & {
  append(input: AppendRevisionInput): Promise<DocumentRevision>;
};
