import { useCallback, useRef, useState } from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { ManuscriptDocumentProfile } from "../../../application/editor/manuscript-document-profile";
import type { WorkContinuousReadingProgressProjection } from "../../../application/editor/continuous-reading-progress";
import type { WorkManuscriptLayoutSettingsProjection } from "../../../application/editor/work-manuscript-layout-settings";
import type { ContinuousReadingLocation } from "../../../application/editor/continuous-reading-progress";
import type { ManuscriptPersistenceProfile } from "../../../application/persistence/manuscript-persistence-profile";
import type { EntityId } from "../../../domain/writing";
import {
  ManuscriptDurableSaveQueue,
  type ManuscriptSaveState,
  type SaveQueueScheduler,
} from "../../persistence/manuscript-durable-save-queue";
import { SerialPersistenceLane } from "./PersistenceCoordinator";

export function usePersistenceCoordinator() {
  const durableSaveQueueRef =
    useRef<ManuscriptDurableSaveQueue | null>(null);
  const [saveStates, setSaveStates] = useState<
    Readonly<Record<string, ManuscriptSaveState>>
  >({});
  const continuousReadingProgressRef =
    useRef<WorkContinuousReadingProgressProjection | null>(null);
  const continuousReadingLocationRef =
    useRef<ContinuousReadingLocation | null>(null);
  const [continuousReadingPersistenceLane] = useState(
    () => new SerialPersistenceLane(),
  );
  const workManuscriptLayoutByWorkRef = useRef(
    new Map<string, WorkManuscriptLayoutSettingsProjection>(),
  );
  const [workManuscriptLayoutPersistenceLane] = useState(
    () => new SerialPersistenceLane(),
  );
  const workManuscriptLayoutLoadSequenceRef = useRef(0);
  const workManuscriptLayoutChangeSequenceRef = useRef(0);

  const installDurableSaveQueue = useCallback((input: Readonly<{
    afterDocumentChangeSaved: (workId: EntityId<"Work">) => void;
    createBatchId: () => EntityId<"ChangeBatch">;
    documentProfile: ManuscriptDocumentProfile;
    editorClient: Pick<
      StudioBridge["editor"],
      "saveDocumentChange" | "saveFormatting"
    >;
    installDocumentRevision: (receipt: Readonly<{
      workId: EntityId<"Work">;
      documentId: EntityId<"Document">;
      revisionId: EntityId<"DocumentRevision">;
    }>) => void;
    now: () => string;
    persistenceProfile: ManuscriptPersistenceProfile | null;
    scheduler: SaveQueueScheduler;
  }>) => {
    if (input.persistenceProfile === null) {
      durableSaveQueueRef.current = null;
      setSaveStates({});
      return;
    }
    const sequencesByDocument = new Map(
      input.persistenceProfile.documentSequences.map((sequence) => [
        sequence.documentId,
        sequence.nextSequence,
      ]),
    );
    if (sequencesByDocument.size !== input.documentProfile.documents.length) {
      throw new Error(
        "Persistence projection does not match the document profile",
      );
    }
    const queueDocuments = input.documentProfile.documents.map((document) => {
      if (document.documentRevisionId === null) {
        throw new Error(
          `Persistence document has no durable base revision: ${document.documentId}`,
        );
      }
      const nextSequence = sequencesByDocument.get(document.documentId);
      if (nextSequence === undefined) {
        throw new Error(
          `Persistence projection has no sequence for document: ${document.documentId}`,
        );
      }
      return {
        workId: document.workId,
        documentId: document.documentId,
        baseRevisionId: document.documentRevisionId,
        nextSequence,
      };
    });
    durableSaveQueueRef.current = new ManuscriptDurableSaveQueue({
      documents: queueDocuments,
      policy: {
        maxTransactionsPerBatch:
          input.persistenceProfile.batching.maxTransactionsPerBatch,
        maxDelayMs: input.persistenceProfile.batching.maxDelayMs,
      },
      saveChangeBatch: async (batch, editorStateJson) => {
        if (editorStateJson === null) {
          throw new Error(
            `The editor state is unavailable for ${batch.documentId}`,
          );
        }
        const receipt = await input.editorClient.saveDocumentChange({
          schemaVersion: 1,
          batch,
          editorStateJson,
        });
        if ("revisionId" in receipt) {
          input.installDocumentRevision(receipt);
        }
        input.afterDocumentChangeSaved(batch.workId);
        return receipt;
      },
      saveFormatting: async (command) => {
        const receipt = await input.editorClient.saveFormatting(command);
        input.installDocumentRevision(receipt);
        return receipt;
      },
      createBatchId: input.createBatchId,
      now: input.now,
      scheduler: input.scheduler,
      onStateChange: (documentId, state) => {
        setSaveStates((current) => Object.freeze({
          ...current,
          [documentId]: state,
        }));
      },
    });
    setSaveStates(Object.freeze(Object.fromEntries(
      queueDocuments.map((document) => [
        document.documentId,
        "saved" as const,
      ]),
    )));
  }, []);

  const registerCreatedDocumentPersistence = useCallback(async (
    input: Readonly<{
      currentDocuments: ManuscriptDocumentProfile["documents"];
      documentId: string;
      editorClient: Pick<
        StudioBridge["editor"],
        | "getManuscriptDocumentProfile"
        | "getManuscriptPersistenceProfile"
        | "getManuscriptResumeCheckpoint"
      >;
    }>,
  ) => {
    const [documentProfile, persistenceProfile, resumeCheckpoint] =
      await Promise.all([
        input.editorClient.getManuscriptDocumentProfile(),
        input.editorClient.getManuscriptPersistenceProfile(),
        input.editorClient.getManuscriptResumeCheckpoint(),
      ]);
    const createdDocument = documentProfile.documents.find(
      (document) => document.documentId === input.documentId,
    );
    if (
      createdDocument === undefined ||
      createdDocument.documentRevisionId === null ||
      persistenceProfile === null
    ) {
      throw new Error("The created Document has no durable manuscript source");
    }
    if (input.currentDocuments.some(
      (document) => document.documentId === input.documentId,
    )) {
      throw new Error(`Duplicate created Document: ${input.documentId}`);
    }
    const sequence = persistenceProfile.documentSequences.find(
      (candidate) => candidate.documentId === input.documentId,
    );
    if (sequence === undefined || durableSaveQueueRef.current === null) {
      throw new Error("The created Document has no durable save sequence");
    }
    durableSaveQueueRef.current.registerDocument({
      workId: createdDocument.workId,
      documentId: createdDocument.documentId,
      baseRevisionId: createdDocument.documentRevisionId,
      nextSequence: sequence.nextSequence,
    });
    setSaveStates((current) => Object.freeze({
      ...current,
      [createdDocument.documentId]: "saved" as const,
    }));
    return Object.freeze({
      createdDocument,
      documentProfile,
      persistenceProfile,
      resumeCheckpoint,
    });
  }, []);

  return {
    durableSaveQueueRef,
    saveStates,
    setSaveStates,
    installDurableSaveQueue,
    registerCreatedDocumentPersistence,
    continuousReadingProgressRef,
    continuousReadingLocationRef,
    continuousReadingPersistenceLane,
    workManuscriptLayoutByWorkRef,
    workManuscriptLayoutPersistenceLane,
    workManuscriptLayoutLoadSequenceRef,
    workManuscriptLayoutChangeSequenceRef,
  };
}
