import {
  createPublishingBridge,
  type BridgeInvoke,
  type PublishingBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadPublishingBridge(
  invoke: BridgeInvoke,
): PublishingBridge {
  return createPublishingBridge((channel, payload) => invoke(channel, payload));
}
