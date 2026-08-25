import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import type {
  LocalWorkspaceBackupActionResult,
  LocalWorkspaceBackupStatusProjection,
} from "../../application/storage/local-workspace-backup-contract";

export type BackupIpcRuntime = Readonly<{
  getBackupStatus: () => Promise<LocalWorkspaceBackupStatusProjection>;
}>;

export function registerBackupIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: BackupIpcRuntime;
  create: () => Promise<LocalWorkspaceBackupActionResult>;
  restore: () => Promise<LocalWorkspaceBackupActionResult>;
}>): void {
  input.ipcMain.handle(BACKUP_GET_STATUS_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.getBackupStatus();
  });
  input.ipcMain.handle(BACKUP_CREATE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.create();
  });
  input.ipcMain.handle(BACKUP_RESTORE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.restore();
  });
}
