import type {
  ManuscriptDocumentProfile,
  ManuscriptDocumentSource,
} from "../../../application/editor/manuscript-document-profile";
import type {
  ActivateWorkspaceLocationCommand,
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../../application/workspace/workspace-contract";
import type { StudioBridge } from "../../../application/contracts/studio-bridge";

export type WorkspaceLocationActivationPlan = Readonly<{
  currentDocument: ManuscriptDocumentSource | undefined;
  isAlreadyActive: boolean;
}>;

export type ActivatedWorkspaceLocationOwnership = Readonly<{
  selectedWork: WorkspaceWorkSummary | undefined;
  selectedDocument: ManuscriptDocumentSource | undefined;
}>;

export type SuccessfulWorkspaceActivationRuntimeProjection = Readonly<{
  catalog: WorkspaceCatalogProjection;
  activeDocumentId: ManuscriptDocumentSource["documentId"] | null;
}>;

export type WorkspaceActivationRuntime = Readonly<{
  catalog: WorkspaceCatalogProjection;
  documentProfile: ManuscriptDocumentProfile;
  activeDocumentId: ManuscriptDocumentSource["documentId"] | null;
}>;

export type WorkspaceActivationPorts = Readonly<{
  setActionState: (state: "idle" | "switching") => void;
  setActionError: (message: string | null) => void;
  clearManuscriptSearch: () => void;
  applyRuntimeProjection: (
    projection: SuccessfulWorkspaceActivationRuntimeProjection,
  ) => void;
  onCatalogChange?: (catalog: WorkspaceCatalogProjection) => void;
}>;

export type PrepareWorkspaceForMainPorts = Readonly<{
  publishResumePreview: (document: ManuscriptDocumentSource) => void;
  applyCatalog: (catalog: WorkspaceCatalogProjection) => void;
  onCatalogChange?: (catalog: WorkspaceCatalogProjection) => void;
}>;

export type WorkspaceCloseQueuePort = Readonly<{
  flushForClose: (
    documentId: ManuscriptDocumentSource["documentId"],
  ) => Promise<void>;
}>;

export type WorkspaceClosePorts = Readonly<{
  waitForContinuousReading: () => Promise<void>;
  waitForWorkLayout: () => Promise<void>;
  waitForFocusSession: () => Promise<void>;
  stopOwnedFocusSession: (
    document: ManuscriptDocumentSource | undefined,
  ) => Promise<void>;
  captureResume: (document: ManuscriptDocumentSource) => Promise<unknown>;
  completeRequest: (
    requestId: string,
    status: "saved" | "failed",
  ) => Promise<unknown>;
}>;

export function planWorkspaceLocationActivation(input: Readonly<{
  documentProfile: ManuscriptDocumentProfile;
  activeDocumentId: ManuscriptDocumentSource["documentId"] | null;
  command: ActivateWorkspaceLocationCommand;
}>): WorkspaceLocationActivationPlan {
  const currentDocument = input.documentProfile.documents.find(
    (document) => document.documentId === input.activeDocumentId,
  );
  return Object.freeze({
    currentDocument,
    isAlreadyActive:
      currentDocument !== undefined &&
      input.command.workId === currentDocument.workId &&
      input.command.documentId === currentDocument.documentId,
  });
}

export function selectActivatedWorkspaceLocationOwnership(input: Readonly<{
  catalog: WorkspaceCatalogProjection;
  documentProfile: ManuscriptDocumentProfile;
}>): ActivatedWorkspaceLocationOwnership {
  const selectedWork = input.catalog.works.find(
    (work) => work.workId === input.catalog.activeWorkId,
  );
  if (selectedWork === undefined) {
    return Object.freeze({
      selectedWork: undefined,
      selectedDocument: undefined,
    });
  }
  const selectedDocument = input.catalog.activeDocumentId === null
    ? undefined
    : input.documentProfile.documents.find(
        (document) =>
          document.workId === selectedWork.workId &&
          document.documentId === input.catalog.activeDocumentId,
      );
  return Object.freeze({ selectedWork, selectedDocument });
}

export function createSuccessfulWorkspaceActivationRuntimeProjection(
  input: Readonly<{
    catalog: WorkspaceCatalogProjection;
    selectedDocument: ManuscriptDocumentSource | undefined;
  }>,
): SuccessfulWorkspaceActivationRuntimeProjection {
  return Object.freeze({
    catalog: input.catalog,
    activeDocumentId: input.selectedDocument?.documentId ?? null,
  });
}

export async function activateWorkspaceLocationThroughPorts(input: Readonly<{
  runtime: WorkspaceActivationRuntime | null;
  command: ActivateWorkspaceLocationCommand;
  client: Pick<StudioBridge["workspace"], "activateLocation">;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  ports: WorkspaceActivationPorts;
}>): Promise<WorkspaceCatalogProjection> {
  if (input.runtime === null) {
    throw new Error("The manuscript workspace is not ready");
  }
  const activationPlan = planWorkspaceLocationActivation({
    documentProfile: input.runtime.documentProfile,
    activeDocumentId: input.runtime.activeDocumentId,
    command: input.command,
  });
  const { currentDocument } = activationPlan;
  if (activationPlan.isAlreadyActive) {
    input.ports.onCatalogChange?.(input.runtime.catalog);
    return input.runtime.catalog;
  }
  input.ports.setActionState("switching");
  input.ports.setActionError(null);
  try {
    if (currentDocument !== undefined) {
      await input.persistDocument(currentDocument);
    }
    const catalog = await input.client.activateLocation(input.command);
    const { selectedWork, selectedDocument } =
      selectActivatedWorkspaceLocationOwnership({
        catalog,
        documentProfile: input.runtime.documentProfile,
      });
    if (selectedWork === undefined) {
      throw new Error("The activated Work is missing from the catalog");
    }
    if (
      (catalog.activeDocumentId === null &&
        selectedWork.documents.length !== 0) ||
      (catalog.activeDocumentId !== null && selectedDocument === undefined)
    ) {
      throw new Error("The activated Work does not own the selected Document");
    }
    if (
      (currentDocument?.workId ?? input.runtime.catalog.activeWorkId) !==
      selectedWork.workId
    ) {
      input.ports.clearManuscriptSearch();
    }
    input.ports.applyRuntimeProjection(
      createSuccessfulWorkspaceActivationRuntimeProjection({
        catalog,
        selectedDocument,
      }),
    );
    input.ports.onCatalogChange?.(catalog);
    return catalog;
  } catch (error) {
    input.ports.setActionError("작품이나 회차를 열지 못했습니다.");
    throw error;
  } finally {
    input.ports.setActionState("idle");
  }
}

export async function prepareWorkspaceForMainThroughPorts(input: Readonly<{
  runtime: WorkspaceActivationRuntime | null;
  client: Pick<StudioBridge["workspace"], "getCatalog">;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  ports: PrepareWorkspaceForMainPorts;
}>): Promise<WorkspaceCatalogProjection> {
  const runtime = input.runtime;
  if (runtime === null) {
    throw new Error("The manuscript workspace is not ready");
  }
  const currentDocument = runtime.documentProfile.documents.find(
    (document) => document.documentId === runtime.activeDocumentId,
  );
  if (currentDocument !== undefined) {
    await input.persistDocument(currentDocument);
    input.ports.publishResumePreview(currentDocument);
  }
  const catalog = await input.client.getCatalog();
  input.ports.applyCatalog(catalog);
  input.ports.onCatalogChange?.(catalog);
  return catalog;
}

export function coordinateWorkspaceCloseRequest(input: Readonly<{
  requestId: string;
  queue: WorkspaceCloseQueuePort | null;
  documents: readonly ManuscriptDocumentSource[];
  activeDocument: ManuscriptDocumentSource | undefined;
  ports: WorkspaceClosePorts;
}>): Promise<void> {
  const queue = input.queue;
  const flush = queue === null
    ? Promise.resolve()
    : Promise.all(
        input.documents.map((document) =>
          queue.flushForClose(document.documentId)
        ),
      ).then(() => undefined);
  return flush
    .then(async () => {
      await input.ports.waitForContinuousReading();
      await input.ports.waitForWorkLayout();
      await input.ports.waitForFocusSession();
      await input.ports.stopOwnedFocusSession(input.activeDocument);
      if (input.activeDocument !== undefined) {
        await input.ports.captureResume(input.activeDocument);
      }
    })
    .then(
      () => input.ports.completeRequest(input.requestId, "saved"),
      () => input.ports.completeRequest(input.requestId, "failed"),
    )
    .then(() => undefined)
    .catch(() => undefined);
}
