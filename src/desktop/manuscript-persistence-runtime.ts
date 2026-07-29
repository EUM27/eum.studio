import type { ManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import type { ChangeBatch } from "../application/persistence/change-batch";
import {
  SaveChangeBatch,
  type ChangeBatchTargetValidator,
  type DurableSaveTarget,
  type SaveReceipt,
  type SaveChangeBatchStage,
} from "../application/persistence/save-change-batch";
import type { EntityId } from "../domain/writing";
import {
  appendJournalPayloadDurably,
  type AppendOnlyJournalStage,
  type AppendOnlyJournalStageContext,
} from "../platform/journal/append-only-journal";
import { createNodeCryptoJournalChecksumAdapter } from "../platform/journal/node-crypto-journal-checksum";
import type { ManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";

export type ManuscriptPersistenceRuntime = {
  readonly saveChangeBatch: SaveChangeBatch;
};

export function createManuscriptSaveHandler(
  runtime: ManuscriptPersistenceRuntime | null,
): (value: unknown) => Promise<SaveReceipt> {
  return async (value) => {
    if (runtime === null) {
      throw new Error(
        "Durable manuscript persistence is unavailable",
      );
    }
    return runtime.saveChangeBatch.execute(value);
  };
}

export function createManuscriptPersistenceRuntime(input: {
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly journalProfile: ManuscriptJournalRuntimeProfile;
  readonly onSaveStage?: (
    stage: SaveChangeBatchStage,
    batch: ChangeBatch,
  ) => Promise<void>;
  readonly onJournalStage?: (
    stage: AppendOnlyJournalStage,
    context: AppendOnlyJournalStageContext,
  ) => Promise<void>;
}): ManuscriptPersistenceRuntime {
  const documentsById = new Map(
    input.documentProfile.documents.map((document) => [
      document.documentId,
      document,
    ]),
  );
  const sequencesByDocument = new Map<
    EntityId<"Document">,
    number
  >();
  for (const sequence of input.journalProfile.documentSequences) {
    if (!documentsById.has(sequence.documentId)) {
      throw new Error(
        `Journal sequence references an unregistered document: ${sequence.documentId}`,
      );
    }
    sequencesByDocument.set(
      sequence.documentId,
      sequence.nextSequence,
    );
  }

  const targets: DurableSaveTarget[] =
    input.documentProfile.documents.map((document) => {
      if (document.documentRevisionId === null) {
        throw new Error(
          `Persistence target has no durable base revision: ${document.documentId}`,
        );
      }
      const nextSequence = sequencesByDocument.get(
        document.documentId,
      );
      if (nextSequence === undefined) {
        throw new Error(
          `Persistence target has no journal sequence: ${document.documentId}`,
        );
      }
      return {
        workId: document.workId,
        documentId: document.documentId,
        baseRevisionId: document.documentRevisionId,
        nextSequence,
        text: document.initialText,
      };
    });
  if (
    sequencesByDocument.size !==
    input.documentProfile.documents.length
  ) {
    throw new Error(
      "Journal document sequences do not exactly match the document profile",
    );
  }

  const validateTarget: ChangeBatchTargetValidator = {
    async execute(batch: ChangeBatch) {
      const document = documentsById.get(batch.documentId);
      if (document === undefined) {
        throw new Error(
          `Unknown manuscript profile document: ${batch.documentId}`,
        );
      }
      if (document.workId !== batch.workId) {
        throw new Error(
          `Manuscript profile work/document boundary violation: ${batch.workId}/${batch.documentId}`,
        );
      }
      if (document.documentRevisionId !== batch.baseRevisionId) {
        throw new Error(
          `Manuscript profile base revision conflict: ${batch.documentId}`,
        );
      }
      return batch;
    },
  };
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      input.journalProfile.checksumAlgorithm,
    );
  const saveChangeBatch = new SaveChangeBatch({
    targets,
    validateTarget,
    appendPayload: (payload) =>
      appendJournalPayloadDurably({
        journalPath: input.journalProfile.journalPath,
        payload,
        checksumAdapter,
        ...(input.onJournalStage === undefined
          ? {}
          : { onStage: input.onJournalStage }),
      }),
    ...(input.onSaveStage === undefined
      ? {}
      : { onStage: input.onSaveStage }),
  });

  return Object.freeze({
    saveChangeBatch,
  });
}
