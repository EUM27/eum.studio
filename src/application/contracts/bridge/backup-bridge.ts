import {
  parseLocalWorkspaceBackupActionResult,
  parseLocalWorkspaceBackupStatusProjection,
  type LocalWorkspaceBackupActionResult,
  type LocalWorkspaceBackupStatusProjection,
} from "../../storage/local-workspace-backup-contract";

export const BACKUP_GET_STATUS_CHANNEL = "studio:backup:get-status";
export const BACKUP_CREATE_CHANNEL = "studio:backup:create";
export const BACKUP_RESTORE_CHANNEL = "studio:backup:restore";

export type BackupBridgeChannel =
  | typeof BACKUP_GET_STATUS_CHANNEL
  | typeof BACKUP_CREATE_CHANNEL
  | typeof BACKUP_RESTORE_CHANNEL;

export type BackupBridge = Readonly<{
  getStatus: () => Promise<LocalWorkspaceBackupStatusProjection>;
  create: () => Promise<LocalWorkspaceBackupActionResult>;
  restore: () => Promise<LocalWorkspaceBackupActionResult>;
}>;

export type BackupBridgeInvoke = (
  channel: BackupBridgeChannel,
) => Promise<unknown>;

export function createBackupBridge(invoke: BackupBridgeInvoke): BackupBridge {
  return Object.freeze({
    getStatus: async () => {
      const value = await invoke(BACKUP_GET_STATUS_CHANNEL);
      try {
        return parseLocalWorkspaceBackupStatusProjection(value);
      } catch {
        throw new Error("Invalid local workspace backup status");
      }
    },
    create: async () => {
      const value = await invoke(BACKUP_CREATE_CHANNEL);
      try {
        return parseLocalWorkspaceBackupActionResult(value);
      } catch {
        throw new Error("Invalid local workspace backup result");
      }
    },
    restore: async () => {
      const value = await invoke(BACKUP_RESTORE_CHANNEL);
      try {
        return parseLocalWorkspaceBackupActionResult(value);
      } catch {
        throw new Error("Invalid local workspace restore result");
      }
    },
  });
}
