import {
  createVersionBridge,
  type BridgeInvoke,
  type VersionBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadVersionBridge(invoke: BridgeInvoke): VersionBridge {
  return createVersionBridge((channel, payload) => invoke(channel, payload));
}
