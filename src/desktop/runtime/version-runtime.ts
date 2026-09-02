import type { VersionIpcRuntime } from "../ipc/register-version-ipc";

export function pickVersionRuntime(runtime: VersionIpcRuntime): VersionIpcRuntime {
  return Object.freeze({
    listDocumentRevisions: (command) =>
      runtime.listDocumentRevisions(command),
    readDocumentRevision: (command) => runtime.readDocumentRevision(command),
    restoreDocumentRevision: (command) =>
      runtime.restoreDocumentRevision(command),
    createWorkSnapshot: (command) => runtime.createWorkSnapshot(command),
    listWorkSnapshots: (command) => runtime.listWorkSnapshots(command),
    compareWorkSnapshot: (command) => runtime.compareWorkSnapshot(command),
    planWorkSnapshotSceneSelection: (command) =>
      runtime.planWorkSnapshotSceneSelection(command),
  });
}
