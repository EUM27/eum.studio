import {
  createAssistantBridge,
  type AssistantBridge,
  type BridgeInvoke,
} from "../../application/contracts/studio-bridge";

export function createPreloadAssistantBridge(
  invoke: BridgeInvoke,
): AssistantBridge {
  return createAssistantBridge((channel, payload) => invoke(channel, payload));
}
