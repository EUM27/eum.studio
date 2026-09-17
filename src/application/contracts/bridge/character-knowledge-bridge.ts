import {
  parseCharacterKnowledgeListProjection,
  parseCharacterKnowledgeProjection,
  parseCreateCharacterKnowledgeCommand,
  parseListCharacterKnowledgeCommand,
  parsePovKnowledgeContextProjection,
  parseProjectPovKnowledgeCommand,
  parseRetireCharacterKnowledgeCommand,
  parseSupersedeCharacterKnowledgeCommand,
  parseUpdateCharacterKnowledgeCommand,
  type CharacterKnowledgeListProjection,
  type CharacterKnowledgeProjection,
  type CreateCharacterKnowledgeCommand,
  type ListCharacterKnowledgeCommand,
  type PovKnowledgeContextProjection,
  type ProjectPovKnowledgeCommand,
  type RetireCharacterKnowledgeCommand,
  type SupersedeCharacterKnowledgeCommand,
  type UpdateCharacterKnowledgeCommand,
} from "../../continuity/character-knowledge-contract";

export const CHARACTER_KNOWLEDGE_CREATE_CHANNEL = "studio:character-knowledge:create";
export const CHARACTER_KNOWLEDGE_UPDATE_CHANNEL = "studio:character-knowledge:update";
export const CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL = "studio:character-knowledge:supersede";
export const CHARACTER_KNOWLEDGE_RETIRE_CHANNEL = "studio:character-knowledge:retire";
export const CHARACTER_KNOWLEDGE_LIST_CHANNEL = "studio:character-knowledge:list";
export const CHARACTER_KNOWLEDGE_POV_CHANNEL = "studio:character-knowledge:project-pov";

export type CharacterKnowledgeBridgeChannel =
  | typeof CHARACTER_KNOWLEDGE_CREATE_CHANNEL
  | typeof CHARACTER_KNOWLEDGE_UPDATE_CHANNEL
  | typeof CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL
  | typeof CHARACTER_KNOWLEDGE_RETIRE_CHANNEL
  | typeof CHARACTER_KNOWLEDGE_LIST_CHANNEL
  | typeof CHARACTER_KNOWLEDGE_POV_CHANNEL;

export type CharacterKnowledgeBridgePayload =
  | CreateCharacterKnowledgeCommand
  | UpdateCharacterKnowledgeCommand
  | SupersedeCharacterKnowledgeCommand
  | RetireCharacterKnowledgeCommand
  | ListCharacterKnowledgeCommand
  | ProjectPovKnowledgeCommand;

export type CharacterKnowledgeBridge = Readonly<{
  create(command: CreateCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  update(command: UpdateCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  supersede(command: SupersedeCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  retire(command: RetireCharacterKnowledgeCommand): Promise<CharacterKnowledgeProjection>;
  list(command: ListCharacterKnowledgeCommand): Promise<CharacterKnowledgeListProjection>;
  projectPov(command: ProjectPovKnowledgeCommand): Promise<PovKnowledgeContextProjection>;
}>;

export type CharacterKnowledgeBridgeInvoke = (
  channel: CharacterKnowledgeBridgeChannel,
  payload?: CharacterKnowledgeBridgePayload,
) => Promise<unknown>;

function parseResult<T>(
  value: unknown,
  parser: (value: unknown) => T,
  message: string,
): T {
  try {
    return parser(value);
  } catch {
    throw new Error(message);
  }
}

export function createCharacterKnowledgeBridge(
  invoke: CharacterKnowledgeBridgeInvoke,
): CharacterKnowledgeBridge {
  return Object.freeze({
    create: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
        parseCreateCharacterKnowledgeCommand(command),
      ),
      parseCharacterKnowledgeProjection,
      "Invalid CharacterKnowledge creation",
    ),
    update: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
        parseUpdateCharacterKnowledgeCommand(command),
      ),
      parseCharacterKnowledgeProjection,
      "Invalid CharacterKnowledge update",
    ),
    supersede: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
        parseSupersedeCharacterKnowledgeCommand(command),
      ),
      parseCharacterKnowledgeProjection,
      "Invalid CharacterKnowledge supersession",
    ),
    retire: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
        parseRetireCharacterKnowledgeCommand(command),
      ),
      parseCharacterKnowledgeProjection,
      "Invalid CharacterKnowledge retirement",
    ),
    list: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_LIST_CHANNEL,
        parseListCharacterKnowledgeCommand(command),
      ),
      parseCharacterKnowledgeListProjection,
      "Invalid CharacterKnowledge list",
    ),
    projectPov: async (command) => parseResult(
      await invoke(
        CHARACTER_KNOWLEDGE_POV_CHANNEL,
        parseProjectPovKnowledgeCommand(command),
      ),
      parsePovKnowledgeContextProjection,
      "Invalid CharacterKnowledge POV projection",
    ),
  });
}
