import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  deriveContinuousReadingSession,
  type ContinuousReadingLocation,
  type ContinuousReadingSession,
  type WorkContinuousReadingProgressProjection,
} from "../../../application/editor/continuous-reading-progress";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type {
  ManuscriptLayoutSettings,
  WorkManuscriptLayoutSettingsProjection,
} from "../../../application/editor/work-manuscript-layout-settings";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptDurableSaveQueue } from "../../persistence/manuscript-durable-save-queue";
import type { SerialPersistenceLane } from "./PersistenceCoordinator";

function sameContinuousReadingLocation(
  left: ContinuousReadingLocation | null,
  right: ContinuousReadingLocation | null,
): boolean {
  return (
    left?.documentId === right?.documentId &&
    left?.documentRevisionId === right?.documentRevisionId &&
    left?.textOffset === right?.textOffset
  );
}

type ContinuousReadingDialogState =
  | Readonly<{ status: "closed" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; session: ContinuousReadingSession }>;

export function useReadingLayoutController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkId: EntityId<"Work"> | null;
  client: StudioBridge["editor"];
  documents: readonly ManuscriptDocumentSource[];
  ready: boolean;
  durableSaveQueueRef: MutableRefObject<ManuscriptDurableSaveQueue | null>;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  materializeDocumentText: (
    document: ManuscriptDocumentSource,
  ) => string | undefined;
  continuousReading: Readonly<{
    progressRef: MutableRefObject<
      WorkContinuousReadingProgressProjection | null
    >;
    locationRef: MutableRefObject<ContinuousReadingLocation | null>;
    lane: SerialPersistenceLane;
  }>;
  layout: Readonly<{
    byWorkRef: MutableRefObject<
      Map<string, WorkManuscriptLayoutSettingsProjection>
    >;
    lane: SerialPersistenceLane;
    loadSequenceRef: MutableRefObject<number>;
    changeSequenceRef: MutableRefObject<number>;
  }>;
}>) {
  const {
    progressRef,
    locationRef,
    lane: continuousReadingLane,
  } = input.continuousReading;
  const {
    byWorkRef,
    lane: manuscriptLayoutLane,
    loadSequenceRef,
    changeSequenceRef,
  } = input.layout;
  const activeWorkIdRef = useRef<EntityId<"Work"> | null>(null);
  const [continuousReadingDialogState, setContinuousReadingDialogState] =
    useState<ContinuousReadingDialogState>({ status: "closed" });
  const [continuousReadingOpenError, setContinuousReadingOpenError] =
    useState<string | null>(null);
  const [workManuscriptLayout, setWorkManuscriptLayout] =
    useState<WorkManuscriptLayoutSettingsProjection | null>(null);

  useEffect(() => {
    activeWorkIdRef.current = input.activeWorkId;
  }, [input.activeWorkId]);

  const persistContinuousReadingLocation = useCallback(
    (location: ContinuousReadingLocation): Promise<void> =>
      continuousReadingLane.enqueue(async () => {
        const progress = progressRef.current;
        if (progress === null) {
          throw new Error("연속 읽기 저장 상태를 찾지 못했습니다.");
        }
        if (sameContinuousReadingLocation(
          locationRef.current,
          location,
        )) return;
        const saved = await input.client.saveContinuousReadingProgress({
          schemaVersion: 1,
          workId: progress.workId,
          expectedRevision: progress.revision,
          location,
        });
        progressRef.current = saved;
        locationRef.current = saved.location;
      }),
    [continuousReadingLane, input.client, locationRef, progressRef],
  );

  const openContinuousReading = useCallback(async () => {
    if (
      !input.ready ||
      input.activeWorkId === null ||
      input.activeDocument === null ||
      continuousReadingDialogState.status !== "closed"
    ) return;
    setContinuousReadingOpenError(null);
    setContinuousReadingDialogState({ status: "loading" });
    try {
      await continuousReadingLane.waitForPending();
      await input.persistDocument(input.activeDocument);
      const queue = input.durableSaveQueueRef.current;
      if (queue !== null) {
        await Promise.all(
          input.documents
            .filter(
              (document) =>
                document.documentId !== input.activeDocument?.documentId,
            )
            .map((document) => queue.flush(document.documentId)),
        );
      }
      const documents = Object.freeze(input.documents.map((document) => {
        const documentRevisionId =
          queue?.getCurrentRevisionId(document.documentId) ??
          document.documentRevisionId;
        if (documentRevisionId === null) {
          throw new Error(
            `${document.label} 회차의 저장 revision을 찾지 못했습니다.`,
          );
        }
        const text = input.materializeDocumentText(document);
        if (text === undefined) {
          throw new Error("원고 편집기를 찾지 못했습니다.");
        }
        return Object.freeze({
          workId: document.workId,
          documentId: document.documentId,
          documentRevisionId,
          title: document.label,
          text,
        });
      }));
      const progress = await input.client.getContinuousReadingProgress({
        schemaVersion: 1,
        workId: input.activeWorkId,
      });
      progressRef.current = progress;
      locationRef.current = progress.location;
      setContinuousReadingDialogState({
        status: "ready",
        session: deriveContinuousReadingSession({
          workId: input.activeWorkId,
          documents,
          progress,
        }),
      });
    } catch (error: unknown) {
      progressRef.current = null;
      locationRef.current = null;
      setContinuousReadingDialogState({ status: "closed" });
      setContinuousReadingOpenError(
        error instanceof Error ? error.message : "연속 읽기를 열지 못했습니다.",
      );
    }
  }, [continuousReadingDialogState.status, continuousReadingLane, input, locationRef, progressRef]);

  const closeContinuousReading = useCallback(async (
    location: ContinuousReadingLocation | null,
  ) => {
    if (location !== null) {
      await persistContinuousReadingLocation(location);
    }
    await continuousReadingLane.waitForPending();
    setContinuousReadingDialogState({ status: "closed" });
    progressRef.current = null;
    locationRef.current = null;
  }, [
    continuousReadingLane,
    locationRef,
    persistContinuousReadingLocation,
    progressRef,
  ]);

  useEffect(() => {
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
    const changeSequence = changeSequenceRef.current + 1;
    changeSequenceRef.current = changeSequence;
    if (input.activeWorkId === null) return;
    const workId = input.activeWorkId;
    const cached = byWorkRef.current.get(workId);
    let disposed = false;
    const load = manuscriptLayoutLane.waitForSettled().then(() =>
      input.client.getWorkManuscriptLayoutSettings({
        schemaVersion: 1,
        workId,
      })
    );
    void load.then(
      (projection) => {
        byWorkRef.current.set(workId, projection);
        if (
          !disposed &&
          loadSequenceRef.current === loadSequence &&
          changeSequenceRef.current === changeSequence
        ) setWorkManuscriptLayout(projection);
      },
      () => {
        if (
          !disposed &&
          loadSequenceRef.current === loadSequence
        ) setWorkManuscriptLayout(cached ?? null);
      },
    );
    return () => {
      disposed = true;
    };
  }, [
    byWorkRef,
    changeSequenceRef,
    input.activeWorkId,
    input.client,
    loadSequenceRef,
    manuscriptLayoutLane,
  ]);

  const handleWorkManuscriptLayoutChange = useCallback(
    (settings: ManuscriptLayoutSettings) => {
      const workId = activeWorkIdRef.current;
      if (workId === null) return;
      const changeSequence = changeSequenceRef.current + 1;
      changeSequenceRef.current = changeSequence;
      setWorkManuscriptLayout((current) =>
        current?.workId !== workId
          ? current
          : Object.freeze({ ...current, settings })
      );
      const execution = manuscriptLayoutLane.enqueue(async () => {
        const current =
          byWorkRef.current.get(workId) ??
          await input.client.getWorkManuscriptLayoutSettings({
            schemaVersion: 1,
            workId,
          });
        const saved = await input.client.saveWorkManuscriptLayoutSettings({
          schemaVersion: 1,
          workId,
          expectedRevision: current.revision,
          settings,
        });
        byWorkRef.current.set(workId, saved);
        if (
          activeWorkIdRef.current === workId &&
          changeSequenceRef.current === changeSequence
        ) setWorkManuscriptLayout(saved);
      });
      void execution.catch(() => {
        if (
          activeWorkIdRef.current === workId &&
          changeSequenceRef.current === changeSequence
        ) {
          setWorkManuscriptLayout(
            byWorkRef.current.get(workId) ?? null,
          );
        }
      });
    },
    [byWorkRef, changeSequenceRef, input.client, manuscriptLayoutLane],
  );

  return {
    continuousReadingDialogState,
    continuousReadingOpenError,
    workManuscriptLayout,
    persistContinuousReadingLocation,
    openContinuousReading,
    closeContinuousReading,
    handleWorkManuscriptLayoutChange,
  };
}
