import {
  createWorkspaceBridge,
  type BridgeInvoke,
  type WorkspaceBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadWorkspaceBridge(
  invoke: BridgeInvoke,
): WorkspaceBridge {
  return createWorkspaceBridge((channel, payload) => invoke(channel, payload));
}
