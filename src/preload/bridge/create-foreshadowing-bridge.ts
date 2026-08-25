import {
  createForeshadowingBridge,
  type BridgeInvoke,
  type ForeshadowingBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadForeshadowingBridge(
  invoke: BridgeInvoke,
): ForeshadowingBridge {
  return createForeshadowingBridge((channel, payload) =>
    invoke(channel, payload)
  );
}
