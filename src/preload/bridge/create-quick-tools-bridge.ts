import {
  createQuickToolsBridge,
  type BridgeInvoke,
  type QuickToolsBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadQuickToolsBridge(
  invoke: BridgeInvoke,
): QuickToolsBridge {
  return createQuickToolsBridge((channel, payload) => invoke(channel, payload));
}
