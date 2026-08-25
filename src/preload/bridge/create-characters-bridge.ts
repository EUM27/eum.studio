import {
  createCharactersBridge,
  type BridgeInvoke,
  type CharactersBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadCharactersBridge(
  invoke: BridgeInvoke,
): CharactersBridge {
  return createCharactersBridge((channel, payload) => invoke(channel, payload));
}
