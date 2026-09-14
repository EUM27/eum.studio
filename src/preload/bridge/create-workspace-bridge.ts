import {
  createWorkspaceBridge,
  type BridgeInvoke,
  type WorkspaceBridge,
} from "../../application/contracts/studio-bridge";
import type { SharedWorkspaceBridge } from "../../application/workspace/shared-workspace-snapshot";

export function createPreloadWorkspaceBridge(
  invoke: BridgeInvoke,
  shared?: SharedWorkspaceBridge,
): WorkspaceBridge {
  return Object.freeze({
    ...createWorkspaceBridge((channel, payload) => invoke(channel, payload)),
    ...(shared === undefined ? {} : { shared }),
  });
}
