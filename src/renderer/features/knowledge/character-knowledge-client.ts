import type { CharacterKnowledgeBridge } from "../../../application/contracts/studio-bridge";
import type {
  CreateCharacterKnowledgeCommand,
  ListCharacterKnowledgeCommand,
  ProjectPovKnowledgeCommand,
  RetireCharacterKnowledgeCommand,
  SupersedeCharacterKnowledgeCommand,
  UpdateCharacterKnowledgeCommand,
} from "../../../application/continuity/character-knowledge-contract";

export function createCharacterKnowledgeClient(bridge: CharacterKnowledgeBridge) {
  return Object.freeze({
    create: (command: CreateCharacterKnowledgeCommand) => bridge.create(command),
    update: (command: UpdateCharacterKnowledgeCommand) => bridge.update(command),
    supersede: (command: SupersedeCharacterKnowledgeCommand) => bridge.supersede(command),
    retire: (command: RetireCharacterKnowledgeCommand) => bridge.retire(command),
    list: (command: ListCharacterKnowledgeCommand) => bridge.list(command),
    projectPov: (command: ProjectPovKnowledgeCommand) => bridge.projectPov(command),
  });
}
