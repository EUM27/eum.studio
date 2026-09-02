import type { CharacterKnowledgeIpcRuntime } from "../ipc/register-character-knowledge-ipc";

export function pickCharacterKnowledgeRuntime(
  runtime: CharacterKnowledgeIpcRuntime,
): CharacterKnowledgeIpcRuntime {
  return Object.freeze({
    createCharacterKnowledge: (command) => runtime.createCharacterKnowledge(command),
    updateCharacterKnowledge: (command) => runtime.updateCharacterKnowledge(command),
    supersedeCharacterKnowledge: (command) => runtime.supersedeCharacterKnowledge(command),
    retireCharacterKnowledge: (command) => runtime.retireCharacterKnowledge(command),
    listCharacterKnowledge: (command) => runtime.listCharacterKnowledge(command),
    projectPovCharacterKnowledge: (command) =>
      runtime.projectPovCharacterKnowledge(command),
  });
}
