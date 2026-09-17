import type { BackupIpcRuntime } from "../ipc/register-backup-ipc";

export function pickBackupRuntime(runtime: BackupIpcRuntime): BackupIpcRuntime {
  return Object.freeze({
    getBackupStatus: () => runtime.getBackupStatus(),
  });
}
