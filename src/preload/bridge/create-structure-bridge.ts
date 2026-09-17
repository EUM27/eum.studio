import {
  createStructureBridge,
  type BridgeInvoke,
  type StructureBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadStructureBridge(
  invoke: BridgeInvoke,
): StructureBridge {
  return createStructureBridge((channel, payload) => invoke(channel, payload));
}
