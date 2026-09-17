import {
  createNarrativeDigestBridge,
  type BridgeInvoke,
  type NarrativeDigestBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadNarrativeDigestBridge(invoke: BridgeInvoke): NarrativeDigestBridge {
  return createNarrativeDigestBridge(invoke);
}
