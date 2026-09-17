import {
  createMigrationBridge,
  type BridgeInvoke,
  type MigrationBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadMigrationBridge(
  invoke: BridgeInvoke,
): MigrationBridge {
  return createMigrationBridge((channel) => invoke(channel));
}
