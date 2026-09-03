import {
  useCallback,
  useEffect,
  useMemo,
  type MutableRefObject,
} from "react";

import type { ManuscriptDocumentProfile, ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import {
  serializeManuscriptEditorDocumentState,
  type ManuscriptEditorDocumentState,
} from "../../../application/editor/manuscript-formatting";
import type { WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import { entityId } from "../../../domain/writing";
import type {
  ManuscriptDocumentStateSummary,
} from "../../editor/ManuscriptEditor";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import type { useLoreCueState } from "../../features/lore/useLoreCueController";
import type { DocumentNavigationDocument } from "../navigation/document-target";
import { DocumentNavigator } from "../navigation/DocumentNavigator";
import {
  type RuntimeProjection,
  RuntimeBootstrapController,
} from "./RuntimeBootstrapController";
import type { usePersistenceCoordinator } from "./usePersistenceCoordinator";
import type { useResumeCheckpointController } from "./useResumeCheckpointController";
import { createInstalledEditorDocumentIdentity } from "./WorkspaceSessionStore";
import type { useWorkspaceLayoutController } from "../layout/useWorkspaceLayoutController";
import type { useWorkspaceSession } from "./useWorkspaceSession";

export function useWorkspaceRuntimeProjectionController(input: Readonly<{
  captureResumeAndLoadCatalog: ReturnType<
    typeof useResumeCheckpointController
  >["captureResumeAndLoadCatalog"];
  client: Pick<StudioBridge, "editor" | "workspace">;
  documentNavigationSelectionResumeSuppressionRef: MutableRefObject<
    DocumentNavigationDocument | null
  >;
  documentNavigator: DocumentNavigator;
  installedEditorDocumentRef: MutableRefObject<
    DocumentNavigationDocument | null
  >;
  layout: Pick<
    ReturnType<typeof useWorkspaceLayoutController>,
    "installActiveManuscriptPosition"
  >;
  loreCueState: Pick<ReturnType<typeof useLoreCueState>, "resetLoreCue">;
  onCatalogChange: ((catalog: WorkspaceCatalogProjection) => void) | undefined;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    "durableSaveQueueRef" | "installDurableSaveQueue"
  >;
  runtimeBootstrapController: RuntimeBootstrapController;
  session: Pick<ReturnType<typeof useWorkspaceSession>, "setRuntime">;
  telemetryStore: ManuscriptTelemetryStore;
}>) {
  const {
    captureResumeAndLoadCatalog,
    documentNavigationSelectionResumeSuppressionRef,
    documentNavigator,
    installedEditorDocumentRef,
    onCatalogChange,
    runtimeBootstrapController,
    telemetryStore,
  } = input;
  const {
    installActiveManuscriptPosition,
  } = input.layout;
  const {
    resetLoreCue,
  } = input.loreCueState;
  const {
    durableSaveQueueRef,
    installDurableSaveQueue,
  } = input.persistence;
  const {
    setRuntime,
  } = input.session;

    const handleFormattingChange = useCallback(
      (
        document: ManuscriptDocumentSource,
        state: ManuscriptEditorDocumentState,
      ) => {
        const pending = durableSaveQueueRef.current?.recordFormatting(
          document.documentId,
          serializeManuscriptEditorDocumentState(state),
        );
        void pending?.catch(() => undefined);
      },
      [durableSaveQueueRef],
    );
    const handleCompositionEnd = useCallback(
      (document: ManuscriptDocumentSource) => {
        const pending =
          durableSaveQueueRef.current?.compositionEnd(
            document.documentId,
          );
        void pending?.catch(() => undefined);
      },
      [durableSaveQueueRef],
    );
    const handleDocumentActivated = useCallback(
      (
        _document: ManuscriptDocumentSource,
        summary: ManuscriptDocumentStateSummary,
      ) => {
        const installedDocument =
          createInstalledEditorDocumentIdentity(_document);
        installedEditorDocumentRef.current = installedDocument;
        const selection = summary.selection.ranges[summary.selection.mainIndex];
        if (selection !== undefined) {
          installActiveManuscriptPosition(
            _document.documentId,
            selection.head,
          );
        }
        resetLoreCue();
        telemetryStore.publish(
          summary.statistics,
          summary.selection.ranges.some((range) => !range.empty),
        );
        let resumeSummary: ManuscriptDocumentStateSummary | undefined = summary;
        documentNavigator.notifyEditorActivated(installedDocument);
        const selectionResumeSuppression =
          documentNavigationSelectionResumeSuppressionRef.current;
        if (
          selectionResumeSuppression?.workId === _document.workId &&
          selectionResumeSuppression.documentId === _document.documentId
        ) {
          documentNavigationSelectionResumeSuppressionRef.current = null;
          resumeSummary = undefined;
        }
        void captureResumeAndLoadCatalog(_document, resumeSummary)
          .then((catalog) => {
            setRuntime((current) =>
              current.status === "ready"
                ? { ...current, catalog }
                : current,
            );
            onCatalogChange?.(catalog);
          })
          .catch(() => undefined);
      },
      [captureResumeAndLoadCatalog, documentNavigationSelectionResumeSuppressionRef, documentNavigator, installActiveManuscriptPosition, installedEditorDocumentRef, onCatalogChange, resetLoreCue, setRuntime, telemetryStore],
    );
    const durableQueueScheduler = useMemo(() => Object.freeze({
      schedule: (delayMs: number, callback: () => void) =>
        window.setTimeout(callback, delayMs),
      cancel: (handle: unknown) => {
        if (typeof handle === "number") window.clearTimeout(handle);
      },
    }), []);
    const createDurableQueueBatchId = useCallback(() =>
      entityId<"ChangeBatch">(crypto.randomUUID()), []);
    const readDurableQueueNow = useCallback(() => new Date().toISOString(), []);
  
    const installRuntimeProjection = useCallback(
      (
        projection: RuntimeProjection,
        preferredDocumentId:
          ManuscriptDocumentProfile["initialDocumentId"] | null,
      ) => {
        const {
          info,
          inputProfile,
          formattingProfile,
          preflightProfile,
          fragmentProfile,
          foreshadowPointProfile,
          documentProfile,
          persistenceProfile,
          startupRecovery,
          resumeCheckpoint,
          catalog,
        } = projection;
        if (
          startupRecovery.status !== "clean" &&
          persistenceProfile !== null
        ) {
          throw new Error(
            "Recovery-blocked runtime exposed a persistence projection",
          );
        }
        const resumeDocument =
          resumeCheckpoint.status ===
            "resolved" ||
          resumeCheckpoint.status ===
            "needsReview" ||
          resumeCheckpoint.status ===
            "broken"
            ? documentProfile.documents.find(
                (document) =>
                  document.documentId ===
                    resumeCheckpoint.documentId &&
                  document.workId ===
                    resumeCheckpoint.workId &&
                  document.documentRevisionId ===
                    resumeCheckpoint.targetRevisionId,
              )
            : undefined;
        if (
          (resumeCheckpoint.status ===
            "resolved" ||
            resumeCheckpoint.status ===
              "needsReview" ||
            resumeCheckpoint.status ===
              "broken") &&
          resumeDocument === undefined
        ) {
          throw new Error(
            "Resume checkpoint does not match the confirmed document source",
          );
        }
        if (
          resumeCheckpoint.status ===
            "resolved" &&
          resumeDocument !== undefined &&
          (resumeCheckpoint.selection.anchor >
            resumeDocument.initialText.length ||
            resumeCheckpoint.selection.head >
              resumeDocument.initialText.length)
        ) {
          throw new Error(
            "Resume checkpoint selection is outside the confirmed document source",
          );
        }
        installDurableSaveQueue({
          createBatchId: createDurableQueueBatchId,
          documentProfile,
          editorClient: input.client.editor,
          now: readDurableQueueNow,
          persistenceProfile,
          scheduler: durableQueueScheduler,
        });
        const catalogActiveDocument =
          catalog.activeDocumentId === null
            ? undefined
            : documentProfile.documents.find(
                (document) =>
                  document.documentId === catalog.activeDocumentId,
              );
        if (
          catalog.activeDocumentId !== null &&
          catalogActiveDocument === undefined
        ) {
          throw new Error(
            "The catalog active Document is missing from the document profile",
          );
        }
        const activeDocumentId =
          preferredDocumentId !== null &&
          documentProfile.documents.some(
            (document) =>
              document.documentId ===
              preferredDocumentId,
          )
            ? preferredDocumentId
            : resumeDocument?.documentId ??
              catalogActiveDocument?.documentId ??
              null;
        setRuntime({
          status: "ready",
          info,
          inputProfile,
          formattingProfile,
          preflightProfile,
          fragmentProfile,
          foreshadowPointProfile,
          documentProfile,
          persistenceProfile,
          startupRecovery,
          resumeCheckpoint,
          catalog,
          activeDocumentId,
        });
      },
      [createDurableQueueBatchId, durableQueueScheduler, input.client.editor, installDurableSaveQueue, readDurableQueueNow, setRuntime],
    );
  
    useEffect(() => {
      let disposed = false;
  
      void runtimeBootstrapController.load().then(
        (projection) => {
          if (!disposed) {
            try {
              installRuntimeProjection(
                projection,
                null,
              );
            } catch {
              durableSaveQueueRef.current = null;
              setRuntime({ status: "error" });
            }
          }
        },
        () => {
          if (!disposed) {
            setRuntime({ status: "error" });
          }
        },
      );
  
      return () => {
        disposed = true;
        durableSaveQueueRef.current = null;
      };
    }, [durableSaveQueueRef, installRuntimeProjection, runtimeBootstrapController, setRuntime]);
  
  
  return {
    handleFormattingChange,
    handleCompositionEnd,
    handleDocumentActivated,
    installRuntimeProjection,
  };
}
