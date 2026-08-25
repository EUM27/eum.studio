import {
  createActivityBridge,
  type ActivityBridge,
  type BridgeInvoke,
} from "../../application/contracts/studio-bridge";

export function createPreloadActivityBridge(
  invoke: BridgeInvoke,
): ActivityBridge {
  return createActivityBridge((channel, payload) => invoke(channel, payload));
}
