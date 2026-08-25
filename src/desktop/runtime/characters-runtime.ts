import type { CharactersIpcRuntime } from "../ipc/register-characters-ipc";

export function pickCharactersRuntime(runtime: CharactersIpcRuntime): CharactersIpcRuntime {
  return Object.freeze({
    createCharacter: (command) => runtime.createCharacter(command),
    listCharacters: (command) => runtime.listCharacters(command),
    updateCharacter: (command) => runtime.updateCharacter(command),
    addCharacterEvidence: (command) => runtime.addCharacterEvidence(command),
    retireCharacter: (command) => runtime.retireCharacter(command),
    createCharacterRelation: (command) => runtime.createCharacterRelation(command),
    listCharacterRelations: (command) => runtime.listCharacterRelations(command),
    updateCharacterRelation: (command) => runtime.updateCharacterRelation(command),
    retireCharacterRelation: (command) => runtime.retireCharacterRelation(command),
    runCharacterExtraction: (command) => runtime.runCharacterExtraction(command),
    listCharacterExtractionCandidates: (command) => runtime.listCharacterExtractionCandidates(command),
    decideCharacterExtractionItem: (command) => runtime.decideCharacterExtractionItem(command),
    runCharacterGeneration: (command) => runtime.runCharacterGeneration(command),
    listCharacterGenerationCandidates: (command) => runtime.listCharacterGenerationCandidates(command),
    decideCharacterGenerationItem: (command) => runtime.decideCharacterGenerationItem(command),
  });
}
