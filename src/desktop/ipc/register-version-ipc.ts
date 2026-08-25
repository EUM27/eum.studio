import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
  VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
  VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
  VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
  VERSION_READ_DOCUMENT_REVISION_CHANNEL,
  VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreateWorkSnapshotCommand,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseReadDocumentRevisionCommand,
  parseRestoreDocumentRevisionCommand,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionContentProjection,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type ReadDocumentRevisionCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../../application/revisions/work-version-contract";
import {
  parseCompareWorkSnapshotCommand,
  type CompareWorkSnapshotCommand,
  type WorkSnapshotComparisonProjection,
} from "../../application/revisions/work-snapshot-comparison";

export type VersionIpcRuntime = Readonly<{
  listDocumentRevisions: (
    command: ListDocumentRevisionsCommand,
  ) => Promise<DocumentRevisionListProjection>;
  readDocumentRevision: (
    command: ReadDocumentRevisionCommand,
  ) => Promise<DocumentRevisionContentProjection>;
  restoreDocumentRevision: (
    command: RestoreDocumentRevisionCommand,
  ) => Promise<RestoreDocumentRevisionResult>;
  createWorkSnapshot: (
    command: CreateWorkSnapshotCommand,
  ) => Promise<WorkSnapshotProjection>;
  listWorkSnapshots: (
    command: ListWorkSnapshotsCommand,
  ) => Promise<WorkSnapshotListProjection>;
  compareWorkSnapshot: (
    command: CompareWorkSnapshotCommand,
  ) => Promise<WorkSnapshotComparisonProjection>;
}>;

export function registerVersionIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: VersionIpcRuntime;
}>): void {
  input.ipcMain.handle(
    VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.listDocumentRevisions(
        parseListDocumentRevisionsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    VERSION_READ_DOCUMENT_REVISION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.readDocumentRevision(
        parseReadDocumentRevisionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.restoreDocumentRevision(
        parseRestoreDocumentRevisionCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.createWorkSnapshot(
        parseCreateWorkSnapshotCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.listWorkSnapshots(
        parseListWorkSnapshotsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.compareWorkSnapshot(
        parseCompareWorkSnapshotCommand(value),
      );
    },
  );
}
