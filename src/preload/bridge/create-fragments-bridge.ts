import {
  createFragmentsBridge,
  type BridgeInvoke,
  type FragmentsBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadFragmentsBridge(
  invoke: BridgeInvoke,
): FragmentsBridge {
  return createFragmentsBridge((channel, payload) =>
    invoke(channel, payload)
  );
}
