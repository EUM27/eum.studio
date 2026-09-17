import type { WorkspaceIpcRuntime } from "../ipc/register-workspace-ipc";

export function pickWorkspaceRuntime(
  runtime: WorkspaceIpcRuntime,
): WorkspaceIpcRuntime {
  return Object.freeze({
    getWorkspaceCatalog: () => runtime.getWorkspaceCatalog(),
    getDocumentCompletion: (command) =>
      runtime.getDocumentCompletion(command),
    completeDocument: (command) => runtime.completeDocument(command),
    clearDocumentCompletion: (command) =>
      runtime.clearDocumentCompletion(command),
    getWorkFavorites: () => runtime.getWorkFavorites(),
    setWorkFavorite: (command) => runtime.setWorkFavorite(command),
    getWorkCovers: () => runtime.getWorkCovers(),
    activateWorkspaceLocation: (command) =>
      runtime.activateWorkspaceLocation(command),
    createWork: (command) => runtime.createWork(command),
    createFirstWork: (command) => runtime.createFirstWork(command),
    createDocument: (command) => runtime.createDocument(command),
    renameWork: (command) => runtime.renameWork(command),
    renameDocument: (command) => runtime.renameDocument(command),
    retireWork: (command) => runtime.retireWork(command),
    retireDocument: (command) => runtime.retireDocument(command),
    retireAllDocuments: (command) => runtime.retireAllDocuments(command),
    moveDocument: (command) => runtime.moveDocument(command),
    createDocumentFolder: (command) =>
      runtime.createDocumentFolder(command),
    renameDocumentFolder: (command) =>
      runtime.renameDocumentFolder(command),
    placeDocumentInFolder: (command) =>
      runtime.placeDocumentInFolder(command),
    retireDocumentFolder: (command) =>
      runtime.retireDocumentFolder(command),
    captureWorkspaceResume: (command) =>
      runtime.captureWorkspaceResume(command),
  });
}
