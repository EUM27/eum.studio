import {
  createSystemBridge,
  type BridgeInvoke,
  type SystemBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadSystemBridge(invoke: BridgeInvoke): SystemBridge {
  return createSystemBridge((channel) => invoke(channel));
}
