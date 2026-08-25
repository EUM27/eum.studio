import {
  createLoreBridge,
  type BridgeInvoke,
  type LoreBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadLoreBridge(invoke: BridgeInvoke): LoreBridge {
  return createLoreBridge((channel, payload) => invoke(channel, payload));
}
