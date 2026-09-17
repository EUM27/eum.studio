import {
  createCharacterKnowledgeBridge,
  type BridgeInvoke,
  type CharacterKnowledgeBridge,
} from "../../application/contracts/studio-bridge";

export function createPreloadCharacterKnowledgeBridge(
  invoke: BridgeInvoke,
): CharacterKnowledgeBridge {
  return createCharacterKnowledgeBridge(invoke);
}
