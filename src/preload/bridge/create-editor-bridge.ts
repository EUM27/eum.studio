import {
  createEditorBridge,
  type BridgeInvoke,
  type BridgeListen,
  type EditorBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadEditorBridge(
  invoke: BridgeInvoke,
  listen: BridgeListen,
): EditorBridge {
  return createEditorBridge(
    (channel, payload) => invoke(channel, payload),
    listen,
  );
}
