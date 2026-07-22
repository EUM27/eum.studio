import type {
  AppendRevisionInput,
  DescribeRevisionContent,
  RevisionStore,
} from "../../application/revisions/revision-store";
import type {
  DocumentRevision,
  EntityId,
  WritingCatalog,
} from "../../domain/writing";

export class InMemoryRevisionStore implements RevisionStore {
  readonly #catalog: WritingCatalog;
  readonly #describeContent: DescribeRevisionContent;
  readonly #revisions = new Map<
    EntityId<"DocumentRevision">,
    DocumentRevision
  >();
  readonly #contents = new Map<EntityId<"DocumentRevision">, string>();
  readonly #currentByDocument = new Map<
    EntityId<"Document">,
    EntityId<"DocumentRevision">
  >();

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly describeContent: DescribeRevisionContent;
  }) {
    this.#catalog = input.catalog;
    this.#describeContent = input.describeContent;
  }

  async append(input: AppendRevisionInput): Promise<DocumentRevision> {
    if (this.#catalog.getDocument(input.documentId) === null) {
      throw new Error(`Unknown document: ${input.documentId}`);
    }
    if (
      this.#catalog.getDocumentForWork(
        input.workId,
        input.documentId,
      ) === null
    ) {
      throw new Error(
        `Work/document boundary violation: ${input.workId}/${input.documentId}`,
      );
    }
    if (this.#revisions.has(input.revisionId)) {
      throw new Error(`Duplicate revision identity: ${input.revisionId}`);
    }
    const currentRevisionId =
      this.#currentByDocument.get(input.documentId) ?? null;
    if (currentRevisionId !== input.expectedCurrentRevisionId) {
      throw new Error(
        `Revision conflict for document ${input.documentId}`,
      );
    }
    const descriptor = this.#describeContent(input.content);
    if (
      !Number.isSafeInteger(descriptor.length) ||
      descriptor.length < 0
    ) {
      throw new Error("Revision content length must be a non-negative integer");
    }
    if (descriptor.contentRef.length === 0) {
      throw new Error("Revision contentRef must not be empty");
    }
    if (descriptor.contentHash.length === 0) {
      throw new Error("Revision contentHash must not be empty");
    }
    const revision = Object.freeze({
      id: input.revisionId,
      documentId: input.documentId,
      ...(input.expectedCurrentRevisionId === null
        ? {}
        : { parentRevisionId: input.expectedCurrentRevisionId }),
      ...descriptor,
      ...(input.changeSetRef === undefined
        ? {}
        : { changeSetRef: input.changeSetRef }),
      cause: input.cause,
      createdAt: input.createdAt,
      durableAt: input.durableAt,
    });

    this.#revisions.set(revision.id, revision);
    this.#contents.set(revision.id, input.content);
    this.#currentByDocument.set(revision.documentId, revision.id);
    return revision;
  }

  async getCurrentRevision(
    documentId: EntityId<"Document">,
  ): Promise<DocumentRevision | null> {
    if (this.#catalog.getDocument(documentId) === null) {
      throw new Error(`Unknown document: ${documentId}`);
    }
    const revisionId = this.#currentByDocument.get(documentId);
    return revisionId === undefined
      ? null
      : (this.#revisions.get(revisionId) ?? null);
  }

  async materialize(
    revisionId: EntityId<"DocumentRevision">,
  ): Promise<string> {
    const content = this.#contents.get(revisionId);
    if (content === undefined) {
      throw new Error(`Unknown revision: ${revisionId}`);
    }
    return content;
  }
}
