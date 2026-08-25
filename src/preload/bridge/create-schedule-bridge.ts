import {
  createScheduleBridge,
  type BridgeInvoke,
  type ScheduleBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadScheduleBridge(
  invoke: BridgeInvoke,
): ScheduleBridge {
  return createScheduleBridge((channel, payload) => invoke(channel, payload));
}
