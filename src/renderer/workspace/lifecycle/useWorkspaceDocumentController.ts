import { useCallback, useEffect, useMemo } from "react";

import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentSource,
} from "../../../application/editor/manuscript-document-profile";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  ActivateWorkspaceLocationCommand,
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import type { useManuscriptSearchController } from "../../features/editor-tools/useManuscriptSearchController";
import type { useScheduleController } from "../../features/schedule/useScheduleController";
import type { useStructureController } from "../../features/structure/useStructureController";
import type { useVersionController } from "../../features/version/useVersionController";
import { RuntimeBootstrapController, type RuntimeProjection } from "../session/RuntimeBootstrapController";
import {
  closeWorkspaceSessionDocumentTab,
  openWorkspaceSessionDocumentTab,
} from "../session/WorkspaceSessionStore";
import type { usePersistenceCoordinator } from "../session/usePersistenceCoordinator";
import type { useWorkspaceSession } from "../session/useWorkspaceSession";
import type { useWorkspaceNavigationState } from "../navigation/useWorkspaceNavigationController";
import { prepareWorkspaceForMainThroughPorts } from "./WorkspaceLifecycleCoordinator";
import type { WorkspaceController } from "./WorkspaceController";
import { useWorkspaceCommandsController } from "./useWorkspaceCommandsController";
import type { useWorkspaceLifecycle } from "./useWorkspaceLifecycle";

export function useWorkspaceDocumentController(input: Readonly<{
  activateWorkspaceLocation: (
    command: ActivateWorkspaceLocationCommand,
  ) => Promise<WorkspaceCatalogProjection>;
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWork: WorkspaceWorkSummary | undefined;
  activeWorkDocumentIds: readonly EntityId<"Document">[];
  activeWorkDocuments: readonly ManuscriptDocumentSource[];
  activeWorkId: EntityId<"Work"> | null;
  client: Pick<StudioBridge, "editor" | "workspace">;
  controllers: Readonly<{
    schedule: ReturnType<typeof useScheduleController>;
    structure: ReturnType<typeof useStructureController>;
    version: ReturnType<typeof useVersionController>;
    workspaceLifecycle: ReturnType<typeof useWorkspaceLifecycle>;
    workspaceNavigation: ReturnType<typeof useWorkspaceNavigationState>;
  }>;
  installRuntimeProjection: (
    projection: RuntimeProjection,
    preferredDocumentId: EntityId<"Document"> | null,
  ) => void;
  onCatalogChange: ((catalog: WorkspaceCatalogProjection) => void) | undefined;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    "registerCreatedDocumentPersistence"
  >;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  publishResumePreview: (
    document: ManuscriptDocumentSource | undefined,
  ) => void;
  runtimeBootstrapController: RuntimeBootstrapController;
  search: ReturnType<typeof useManuscriptSearchController>;
  session: ReturnType<typeof useWorkspaceSession>;
  workspaceController: WorkspaceController;
}>) {
  const {
    activateWorkspaceLocation,
    activeDocument,
    activeWork,
    activeWorkDocumentIds,
    activeWorkDocuments,
    installRuntimeProjection,
    onCatalogChange,
    persistDocument,
    publishResumePreview,
    runtimeBootstrapController,
  } = input;
  const {
    registerCreatedDocumentPersistence,
  } = input.persistence;
  const {
    clearSearch: clearManuscriptSearch,
  } = input.search;
  const {
    closeSchedule,
    openSchedule,
  } = input.controllers.schedule;
  const {
    refreshSceneProjection,
  } = input.controllers.structure;
  const {
    highlightDocumentRevision,
    loadDocumentRevisionPreview,
  } = input.controllers.version;
  const {
    setWorkspaceActionError,
    setWorkspaceActionState,
  } = input.controllers.workspaceLifecycle;
  const {
    selectReviewTab,
    showWorkSection,
  } = input.controllers.workspaceNavigation;
  const {
    documentTabSession,
    runtime,
    setDocumentTabSession,
    setRuntime,
  } = input.session;
  const controller = input.workspaceController;

  const installCreatedDocument = useCallback(
      async (
        documentId: string,
        catalog: WorkspaceCatalogProjection,
      ): Promise<void> => {
        if (runtime.status !== "ready") {
          throw new Error("The manuscript workspace is not ready");
        }
        const {
          createdDocument,
          documentProfile,
          persistenceProfile,
          resumeCheckpoint,
        } = await registerCreatedDocumentPersistence({
          currentDocuments: runtime.documentProfile.documents,
          documentId,
          editorClient: input.client.editor,
        });
        const orderedDocumentIds = documentProfile.documents
          .filter(
            (document) => document.workId === createdDocument.workId,
          )
          .map((document) => document.documentId);
        const previousActiveDocument =
          runtime.documentProfile.documents.find(
            (document) =>
              document.documentId === runtime.activeDocumentId &&
              document.workId === createdDocument.workId,
          );
        setDocumentTabSession((current) =>
          openWorkspaceSessionDocumentTab({
            session: current,
            workId: createdDocument.workId,
            orderedDocumentIds,
            activeDocumentId:
              previousActiveDocument?.documentId ??
              createdDocument.documentId,
            documentId: createdDocument.documentId,
          }),
        );
        setRuntime({
          ...runtime,
          documentProfile: {
            ...runtime.documentProfile,
            documents: Object.freeze([
              ...runtime.documentProfile.documents,
              createdDocument,
            ]),
          },
          persistenceProfile,
          resumeCheckpoint,
          catalog,
          activeDocumentId: createdDocument.documentId,
        });
        clearManuscriptSearch();
        onCatalogChange?.(catalog);
      },
      [clearManuscriptSearch, input.client.editor, onCatalogChange, registerCreatedDocumentPersistence, runtime, setDocumentTabSession, setRuntime],
    );
  
  const installRenamedCatalog = useCallback(
      (catalog: WorkspaceCatalogProjection) => {
        const documentTitles = new Map(
          catalog.works.flatMap((work) =>
            work.documents.map((document) => [
              `${work.workId}:${document.documentId}`,
              document.title,
            ] as const),
          ),
        );
        setRuntime((current) => {
          if (current.status !== "ready") {
            return current;
          }
          return {
            ...current,
            catalog,
            documentProfile: parseManuscriptDocumentProfile({
              ...current.documentProfile,
              documents: current.documentProfile.documents.map((document) => ({
                ...document,
                label:
                  documentTitles.get(
                    `${document.workId}:${document.documentId}`,
                  ) ?? document.label,
              })),
            }),
          };
        });
        onCatalogChange?.(catalog);
      },
      [onCatalogChange, setRuntime],
    );
  
  const installReorderedCatalog = useCallback(
      (catalog: WorkspaceCatalogProjection) => {
        const orderedDocumentKeys = catalog.works.flatMap((work) =>
          work.documents.map(
            (document) => `${work.workId}:${document.documentId}`,
          ),
        );
        const orderByDocument = new Map(
          orderedDocumentKeys.map((key, index) => [key, index] as const),
        );
        setRuntime((current) => {
          if (current.status !== "ready") {
            return current;
          }
          return {
            ...current,
            catalog,
            documentProfile: parseManuscriptDocumentProfile({
              ...current.documentProfile,
              documents: [...current.documentProfile.documents].sort(
                (left, right) =>
                  (orderByDocument.get(
                    `${left.workId}:${left.documentId}`,
                  ) ?? Number.MAX_SAFE_INTEGER) -
                  (orderByDocument.get(
                    `${right.workId}:${right.documentId}`,
                  ) ?? Number.MAX_SAFE_INTEGER),
              ),
            }),
          };
        });
        onCatalogChange?.(catalog);
      },
      [onCatalogChange, setRuntime],
    );
  
  const reloadWorkspaceCommandRuntime = useCallback(async (
      preferredDocumentId: EntityId<"Document"> | null,
    ) => {
      const projection = await runtimeBootstrapController.load();
      installRuntimeProjection(projection, preferredDocumentId);
      return projection.catalog;
    }, [installRuntimeProjection, runtimeBootstrapController]);
  
  const clearWorkspaceCommandSearch = useCallback(() => {
      clearManuscriptSearch();
    }, [clearManuscriptSearch]);
  
  const publishWorkspaceCommandCatalog = useCallback(
      (catalog: WorkspaceCatalogProjection) => {
        onCatalogChange?.(catalog);
      },
      [onCatalogChange],
    );
  
  const workspaceCommandPorts = useMemo(() => Object.freeze({
      setActionState: setWorkspaceActionState,
      setActionError: setWorkspaceActionError,
      persistDocument,
      installCreatedDocument,
      installRenamedCatalog,
      installReorderedCatalog,
      reloadRuntime: reloadWorkspaceCommandRuntime,
      clearManuscriptSearch: clearWorkspaceCommandSearch,
      publishCatalog: publishWorkspaceCommandCatalog,
      refreshSceneProjection,
    }), [
      clearWorkspaceCommandSearch,
      installCreatedDocument,
      installRenamedCatalog,
      installReorderedCatalog,
      persistDocument,
      publishWorkspaceCommandCatalog,
      refreshSceneProjection,
      reloadWorkspaceCommandRuntime,
      setWorkspaceActionError,
      setWorkspaceActionState,
    ]);
  
  const workspaceCommandsInput = useMemo(() => Object.freeze({
      activeDocument: activeDocument ?? null,
      activeWork: activeWork ?? null,
      client: input.client.workspace,
      ports: workspaceCommandPorts,
      runtime,
    }), [activeDocument, activeWork, input.client.workspace, runtime, workspaceCommandPorts]);
  
  const {
      titleEditTarget,
      titleEditValue,
      createWork,
      createDocument,
      renameWork,
      renameActiveWork,
      renameDocument,
      retireWork,
      retireDocument,
      moveDocument,
      createDocumentFolder,
      renameDocumentFolder,
      placeDocumentInFolder,
      retireDocumentFolder,
      startWorkTitleEdit,
      cancelWorkTitleEdit,
      changeTitleEditValue,
    } = useWorkspaceCommandsController(workspaceCommandsInput);
  
  const prepareForMain = useCallback(
      () => prepareWorkspaceForMainThroughPorts({
        runtime: runtime.status === "ready" ? runtime : null,
        client: input.client.workspace,
        persistDocument,
        ports: {
          publishResumePreview,
          applyCatalog: (catalog) => {
            if (runtime.status === "ready") {
              setRuntime({ ...runtime, catalog });
            }
          },
          ...(onCatalogChange === undefined ? {} : { onCatalogChange }),
        },
      }),
      [input.client.workspace, onCatalogChange, persistDocument, publishResumePreview, runtime, setRuntime],
    );
  
  const openCompletedRevision = useCallback(
      async (
        workId: EntityId<"Work">,
        documentId: EntityId<"Document">,
        revisionId: EntityId<"DocumentRevision">,
      ): Promise<WorkspaceCatalogProjection> => {
        const catalog = await activateWorkspaceLocation({
          schemaVersion: 1,
          workId,
          documentId,
        });
        highlightDocumentRevision(revisionId);
        selectReviewTab("versions");
        showWorkSection("review");
        const documentTitle = catalog.works
          .find((work) => work.workId === workId)
          ?.documents.find((document) => document.documentId === documentId)
          ?.title ?? "회차";
        await loadDocumentRevisionPreview(
          workId,
          documentId,
          revisionId,
          documentTitle,
        );
        return catalog;
      },
      [
        activateWorkspaceLocation,
        highlightDocumentRevision,
        loadDocumentRevisionPreview,
        selectReviewTab,
        showWorkSection,
      ],
    );
  
  useEffect(
      () => controller.install({
        activateLocation: activateWorkspaceLocation,
        createWork,
        moveDocument,
        openCompletedRevision,
        openSchedule,
        renameWork,
        retireDocument,
        retireWork,
        prepareForMain,
      }),
      [
        controller,
        activateWorkspaceLocation,
        createWork,
        moveDocument,
        openCompletedRevision,
        openSchedule,
        prepareForMain,
        renameWork,
        retireDocument,
        retireWork,
      ],
    );
  
  const activateDocumentById = useCallback(
      (documentId: string) => {
        if (runtime.status !== "ready") {
          return;
        }
        const selectedDocument = runtime.documentProfile.documents.find(
          (document) => document.documentId === documentId,
        );
        if (
          selectedDocument === undefined ||
          runtime.catalog.activeWorkId === null ||
          selectedDocument.workId !== runtime.catalog.activeWorkId
        ) {
          return;
        }
        const orderedDocumentIds = runtime.documentProfile.documents
          .filter(
            (document) => document.workId === selectedDocument.workId,
          )
          .map((document) => document.documentId);
        const currentActiveDocumentId =
          runtime.activeDocumentId ?? selectedDocument.documentId;
        void activateWorkspaceLocation({
          schemaVersion: 1,
          workId: selectedDocument.workId,
          documentId: selectedDocument.documentId,
        })
          .then(() => {
            setDocumentTabSession((current) =>
              openWorkspaceSessionDocumentTab({
                session: current,
                workId: selectedDocument.workId,
                orderedDocumentIds,
                activeDocumentId: currentActiveDocumentId,
                documentId: selectedDocument.documentId,
              }),
            );
          })
          .catch(() => undefined);
      },
      [activateWorkspaceLocation, runtime, setDocumentTabSession],
    );
  
  const openDocumentFromSchedule = useCallback(
      (documentId: EntityId<"Document">) => {
        closeSchedule();
        showWorkSection("write");
        activateDocumentById(documentId);
      },
      [activateDocumentById, closeSchedule, showWorkSection],
    );
  
  const openCompletedRevisionFromSchedule = useCallback(
      async (
        documentId: EntityId<"Document">,
        revisionId: EntityId<"DocumentRevision">,
      ): Promise<void> => {
        if (runtime.status !== "ready" || runtime.catalog.activeWorkId === null) {
          return;
        }
        const documentTitle = runtime.catalog.works
          .find((work) => work.workId === runtime.catalog.activeWorkId)
          ?.documents.find((document) => document.documentId === documentId)
          ?.title ?? "회차";
        await loadDocumentRevisionPreview(
          runtime.catalog.activeWorkId,
          documentId,
          revisionId,
          documentTitle,
        );
      },
      [loadDocumentRevisionPreview, runtime],
    );
  
  const closeDocumentTabById = useCallback(
      (documentId: string) => {
        if (
          runtime.status !== "ready" ||
          activeWork === undefined ||
          runtime.activeDocumentId === null
        ) {
          return;
        }
        const result = closeWorkspaceSessionDocumentTab({
          session: documentTabSession,
          workId: activeWork.workId,
          orderedDocumentIds: activeWorkDocumentIds,
          activeDocumentId: runtime.activeDocumentId,
          documentId,
        });
        if (!result.closed) {
          return;
        }
        if (
          result.nextActiveDocumentId === runtime.activeDocumentId
        ) {
          setDocumentTabSession(result.session);
          return;
        }
        const nextActiveDocument = activeWorkDocuments.find(
          (document) =>
            document.documentId === result.nextActiveDocumentId,
        );
        if (nextActiveDocument === undefined) {
          return;
        }
  
        void activateWorkspaceLocation({
          schemaVersion: 1,
          workId: activeWork.workId,
          documentId: nextActiveDocument.documentId,
        })
          .then(() => {
            setDocumentTabSession(result.session);
          })
          .catch(() => undefined);
      },
      [runtime, activeWork, documentTabSession, activeWorkDocumentIds, activeWorkDocuments, activateWorkspaceLocation, setDocumentTabSession],
    );
  return {
    titleEditTarget,
    titleEditValue,
    createDocument,
    renameActiveWork,
    renameDocument,
    retireWork,
    retireDocument,
    moveDocument,
    createDocumentFolder,
    renameDocumentFolder,
    placeDocumentInFolder,
    retireDocumentFolder,
    startWorkTitleEdit,
    cancelWorkTitleEdit,
    changeTitleEditValue,
    activateDocumentById,
    openDocumentFromSchedule,
    openCompletedRevisionFromSchedule,
    closeDocumentTabById,
  };
}
