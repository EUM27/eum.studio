import {
  createContinuityBridge,
  type BridgeInvoke,
  type ContinuityBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadContinuityBridge(
  invoke: BridgeInvoke,
): ContinuityBridge {
  return createContinuityBridge(invoke);
}
