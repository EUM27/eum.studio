import {
  useCallback,
  type MutableRefObject,
  type RefObject,
} from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type {
  ActivateWorkspaceLocationCommand,
  WorkspaceCatalogProjection,
} from "../../../application/workspace/workspace-contract";
import type { EntityId } from "../../../domain/writing";
import type { ManuscriptEditorHandle } from "../../editor/ManuscriptEditor";
import type { useManuscriptSearchController } from "../../features/editor-tools/useManuscriptSearchController";
import { activateWorkspaceLocationThroughPorts } from "../lifecycle/WorkspaceLifecycleCoordinator";
import type { useWorkspaceLifecycle } from "../lifecycle/useWorkspaceLifecycle";
import type { usePersistenceCoordinator } from "../session/usePersistenceCoordinator";
import {
  matchesInstalledEditorDocumentIdentity,
  type DocumentNavigationWorkspaceSnapshot,
} from "../session/WorkspaceSessionStore";
import type { useWorkspaceSession } from "../session/useWorkspaceSession";
import type { useWorkspaceNavigationState } from "./useWorkspaceNavigationController";
import type { DocumentNavigationFeatureAdapter } from "./useWorkspaceFeatureNavigationController";
import type {
  DocumentNavigationDocument,
  DocumentNavigationPorts,
  DocumentNavigationSurfaceOutcome,
} from "./document-target";

export type DocumentNavigationSurfaceWaiter = Readonly<{
  resolve: (outcome: DocumentNavigationSurfaceOutcome) => void;
}>;

export function useWorkspaceDocumentNavigatorController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWorkId: EntityId<"Work"> | null;
  client: Pick<StudioBridge, "workspace">;
  controllers: Readonly<{
    lifecycle: ReturnType<typeof useWorkspaceLifecycle>;
    navigation: ReturnType<typeof useWorkspaceNavigationState>;
    search: ReturnType<typeof useManuscriptSearchController>;
  }>;
  documentNavigationSurfaceWaitersRef: MutableRefObject<
    DocumentNavigationSurfaceWaiter[]
  >;
  documentNavigationWorkspaceRef: MutableRefObject<
    DocumentNavigationWorkspaceSnapshot
  >;
  installedEditorDocumentRef: MutableRefObject<
    DocumentNavigationDocument | null
  >;
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  onCatalogChange: ((catalog: WorkspaceCatalogProjection) => void) | undefined;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    "durableSaveQueueRef"
  >;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  session: ReturnType<typeof useWorkspaceSession>;
}>) {
  const {
    documentNavigationSurfaceWaitersRef,
    documentNavigationWorkspaceRef,
    installedEditorDocumentRef,
    manuscriptEditorRef,
    onCatalogChange,
    persistDocument,
  } = input;
  const {
    setWorkspaceActionError,
    setWorkspaceActionState,
  } = input.controllers.lifecycle;
  const {
    showWorkSection,
    workSection,
  } = input.controllers.navigation;
  const {
    clearSearch: clearManuscriptSearch,
  } = input.controllers.search;
  const {
    durableSaveQueueRef,
  } = input.persistence;
  const {
    runtime,
    setRuntime,
  } = input.session;

  const activateWorkspaceLocation = useCallback(
      async (
        command: ActivateWorkspaceLocationCommand,
      ): Promise<WorkspaceCatalogProjection> =>
        activateWorkspaceLocationThroughPorts({
          runtime: runtime.status === "ready" ? runtime : null,
          command,
          client: input.client.workspace,
          persistDocument,
          ports: {
            setActionState: setWorkspaceActionState,
            setActionError: setWorkspaceActionError,
            clearManuscriptSearch,
            applyRuntimeProjection: (projection) => {
              setRuntime((current) =>
                current.status === "ready"
                  ? { ...current, ...projection }
                  : current,
              );
            },
            ...(onCatalogChange === undefined ? {} : { onCatalogChange }),
          },
        }),
      [clearManuscriptSearch, input.client.workspace, onCatalogChange, persistDocument, runtime, setRuntime, setWorkspaceActionError, setWorkspaceActionState],
    );
  
  const createDocumentNavigationPorts = useCallback(
      (
        adapter: DocumentNavigationFeatureAdapter,
      ): DocumentNavigationPorts => ({
        getWorkspaceSnapshot: () => {
          const workspace = documentNavigationWorkspaceRef.current;
          return Object.freeze({
            activeWorkId: workspace.activeWorkId,
            activeDocument: workspace.activeDocument === null
              ? null
              : Object.freeze({
                  workId: workspace.activeDocument.workId,
                  documentId: workspace.activeDocument.documentId,
                }),
            editorDocument: installedEditorDocumentRef.current,
            documents: Object.freeze(workspace.documents.map((document) =>
              Object.freeze({
                workId: document.workId,
                documentId: document.documentId,
              })
            )),
          });
        },
        getCurrentRevision: (document) => {
          const currentDocument =
            documentNavigationWorkspaceRef.current.documents.find(
              (candidate) =>
                candidate.workId === document.workId &&
                candidate.documentId === document.documentId,
            );
          return durableSaveQueueRef.current?.getCurrentRevisionId(
            document.documentId,
          ) ?? currentDocument?.documentRevisionId ?? null;
        },
        ensureSurface: () => {
          if (adapter.surfacePolicy === "preserve") return "ready";
          if (workSection === "write") return "ready";
          return new Promise<DocumentNavigationSurfaceOutcome>((resolve) => {
            documentNavigationSurfaceWaitersRef.current.push(
              Object.freeze({ resolve }),
            );
            showWorkSection("write");
          });
        },
        activateWorkspaceLocation: async (document) => {
          adapter.onActivationStarted(document);
          try {
            await activateWorkspaceLocation({
              schemaVersion: 1,
              workId: document.workId,
              documentId: document.documentId,
            });
            return "activated";
          } catch {
            return "blocked";
          }
        },
        applyTabPolicy: adapter.applyTabPolicy,
        selectRange: (document, range) => {
          const currentDocument =
            documentNavigationWorkspaceRef.current.documents.find(
              (candidate) =>
                candidate.workId === document.workId &&
                candidate.documentId === document.documentId,
            );
          if (currentDocument === undefined) return "invalid-location";
          const selected = manuscriptEditorRef.current?.selectDocumentRange(
            currentDocument,
            range,
          ) ?? false;
          if (selected) adapter.onRevealSucceeded(document);
          return selected ? "revealed" : "invalid-location";
        },
        placeCursor: () => "blocked",
        revealPreviewOffset: (document, offset) => {
          if (!matchesInstalledEditorDocumentIdentity(
            installedEditorDocumentRef.current,
            document,
          )) {
            return "invalid-location";
          }
          const currentDocument =
            documentNavigationWorkspaceRef.current.documents.find(
              (candidate) =>
                candidate.workId === document.workId &&
                candidate.documentId === document.documentId,
            );
          if (currentDocument === undefined) return "invalid-location";
          const revealed = manuscriptEditorRef.current?.revealDocumentOffset(
            currentDocument,
            offset,
          ) ?? false;
          if (revealed) adapter.onRevealSucceeded(document);
          return revealed ? "revealed" : "invalid-location";
        },
      }),
      [activateWorkspaceLocation, documentNavigationSurfaceWaitersRef, documentNavigationWorkspaceRef, durableSaveQueueRef, installedEditorDocumentRef, manuscriptEditorRef, showWorkSection, workSection],
    );
  return {
    activateWorkspaceLocation,
    createDocumentNavigationPorts,
  };
}
