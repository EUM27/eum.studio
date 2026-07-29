import type { WritingCatalog } from "../../domain/writing";
import type { RevisionStore } from "../revisions/revision-store";
import type { ChangeBatch } from "./change-batch";

export class ChangeBatchTargetConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangeBatchTargetConflictError";
  }
}

export class ValidateChangeBatchTarget {
  readonly #catalog: WritingCatalog;
  readonly #revisionStore: RevisionStore;

  constructor(input: {
    readonly catalog: WritingCatalog;
    readonly revisionStore: RevisionStore;
  }) {
    this.#catalog = input.catalog;
    this.#revisionStore = input.revisionStore;
  }

  async execute(batch: ChangeBatch): Promise<ChangeBatch> {
    if (this.#catalog.getWork(batch.workId) === null) {
      throw new Error(`Unknown work: ${batch.workId}`);
    }

    if (this.#catalog.getDocument(batch.documentId) === null) {
      throw new Error(`Unknown document: ${batch.documentId}`);
    }

    if (
      this.#catalog.getDocumentForWork(
        batch.workId,
        batch.documentId,
      ) === null
    ) {
      throw new Error(
        `Work/document boundary violation: ${batch.workId}/${batch.documentId}`,
      );
    }

    const currentRevision =
      await this.#revisionStore.getCurrentRevision(batch.documentId);
    if (currentRevision === null) {
      throw new ChangeBatchTargetConflictError(
        `Document has no durable base revision: ${batch.documentId}`,
      );
    }
    if (currentRevision.documentId !== batch.documentId) {
      throw new Error(
        `Revision/document boundary violation: ${currentRevision.id}/${batch.documentId}`,
      );
    }
    if (currentRevision.id !== batch.baseRevisionId) {
      throw new ChangeBatchTargetConflictError(
        `Base revision conflict for document ${batch.documentId}`,
      );
    }

    return batch;
  }
}
