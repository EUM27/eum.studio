import {
  createCanonBridge,
  type BridgeInvoke,
  type CanonBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadCanonBridge(invoke: BridgeInvoke): CanonBridge {
  return createCanonBridge(invoke);
}
