import {
  createBackupBridge,
  type BackupBridge,
  type BridgeInvoke,
} from "../../application/contracts/studio-bridge";

export function createPreloadBackupBridge(invoke: BridgeInvoke): BackupBridge {
  return createBackupBridge((channel, command) => invoke(channel, command));
}
