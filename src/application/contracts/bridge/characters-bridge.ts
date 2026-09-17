import {
  parseAddCharacterEvidenceCommand,
  parseCharacterListProjection,
  parseCharacterProjection,
  parseCreateCharacterCommand,
  parseListCharactersCommand,
  parseRetireCharacterCommand,
  parseUpdateCharacterCommand,
  type AddCharacterEvidenceCommand,
  type CharacterListProjection,
  type CharacterProjection,
  type CreateCharacterCommand,
  type ListCharactersCommand,
  type RetireCharacterCommand,
  type UpdateCharacterCommand,
} from "../../characters/character-contract";
import {
  parseCharacterRelationListProjection,
  parseCharacterRelationProjection,
  parseCreateCharacterRelationCommand,
  parseListCharacterRelationsCommand,
  parseRetireCharacterRelationCommand,
  parseUpdateCharacterRelationCommand,
  type CharacterRelationListProjection,
  type CharacterRelationProjection,
  type CreateCharacterRelationCommand,
  type ListCharacterRelationsCommand,
  type RetireCharacterRelationCommand,
  type UpdateCharacterRelationCommand,
} from "../../characters/character-relation-contract";
import {
  parseCharacterExtractionCandidateList,
  parseCharacterExtractionDecisionResult,
  parseCharacterExtractionResult,
  parseDecideCharacterExtractionItemCommand,
  parseListCharacterExtractionCandidatesCommand,
  parseRunCharacterExtractionCommand,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionResult,
  type DecideCharacterExtractionItemCommand,
  type ListCharacterExtractionCandidatesCommand,
  type RunCharacterExtractionCommand,
} from "../../characters/character-extraction-contract";
import {
  parseCharacterGenerationCandidateList,
  parseCharacterGenerationDecisionResult,
  parseCharacterGenerationResult,
  parseDecideCharacterGenerationItemCommand,
  parseListCharacterGenerationCandidatesCommand,
  parseRunCharacterGenerationCommand,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationResult,
  type DecideCharacterGenerationItemCommand,
  type ListCharacterGenerationCandidatesCommand,
  type RunCharacterGenerationCommand,
} from "../../characters/character-generation-contract";

export const CHARACTER_CREATE_CHANNEL = "studio:characters:create";
export const CHARACTER_LIST_CHANNEL = "studio:characters:list";
export const CHARACTER_UPDATE_CHANNEL = "studio:characters:update";
export const CHARACTER_ADD_EVIDENCE_CHANNEL = "studio:characters:add-evidence";
export const CHARACTER_RETIRE_CHANNEL = "studio:characters:retire";
export const CHARACTER_RELATION_CREATE_CHANNEL = "studio:character-relations:create";
export const CHARACTER_RELATION_LIST_CHANNEL = "studio:character-relations:list";
export const CHARACTER_RELATION_UPDATE_CHANNEL = "studio:character-relations:update";
export const CHARACTER_RELATION_RETIRE_CHANNEL = "studio:character-relations:retire";
export const CHARACTER_EXTRACTION_RUN_CHANNEL = "studio:characters:extract";
export const CHARACTER_EXTRACTION_LIST_CHANNEL = "studio:characters:list-extraction-candidates";
export const CHARACTER_EXTRACTION_DECIDE_CHANNEL = "studio:characters:decide-extraction-candidate";
export const CHARACTER_GENERATION_RUN_CHANNEL = "studio:characters:generate";
export const CHARACTER_GENERATION_LIST_CHANNEL = "studio:characters:list-generation-candidates";
export const CHARACTER_GENERATION_DECIDE_CHANNEL = "studio:characters:decide-generation-candidate";

export type CharactersBridgePayload =
  | CreateCharacterCommand | ListCharactersCommand | UpdateCharacterCommand
  | AddCharacterEvidenceCommand | RetireCharacterCommand
  | CreateCharacterRelationCommand | ListCharacterRelationsCommand
  | UpdateCharacterRelationCommand | RetireCharacterRelationCommand
  | RunCharacterExtractionCommand | ListCharacterExtractionCandidatesCommand
  | DecideCharacterExtractionItemCommand | RunCharacterGenerationCommand
  | ListCharacterGenerationCandidatesCommand | DecideCharacterGenerationItemCommand;

export type CharactersBridgeChannel =
  | typeof CHARACTER_CREATE_CHANNEL | typeof CHARACTER_LIST_CHANNEL
  | typeof CHARACTER_UPDATE_CHANNEL | typeof CHARACTER_ADD_EVIDENCE_CHANNEL
  | typeof CHARACTER_RETIRE_CHANNEL | typeof CHARACTER_RELATION_CREATE_CHANNEL
  | typeof CHARACTER_RELATION_LIST_CHANNEL | typeof CHARACTER_RELATION_UPDATE_CHANNEL
  | typeof CHARACTER_RELATION_RETIRE_CHANNEL | typeof CHARACTER_EXTRACTION_RUN_CHANNEL
  | typeof CHARACTER_EXTRACTION_LIST_CHANNEL | typeof CHARACTER_EXTRACTION_DECIDE_CHANNEL
  | typeof CHARACTER_GENERATION_RUN_CHANNEL | typeof CHARACTER_GENERATION_LIST_CHANNEL
  | typeof CHARACTER_GENERATION_DECIDE_CHANNEL;

export type CharactersBridge = Readonly<{
  create: (command: CreateCharacterCommand) => Promise<CharacterProjection>;
  list: (command: ListCharactersCommand) => Promise<CharacterListProjection>;
  update: (command: UpdateCharacterCommand) => Promise<CharacterProjection>;
  addEvidence: (command: AddCharacterEvidenceCommand) => Promise<CharacterProjection>;
  retire: (command: RetireCharacterCommand) => Promise<CharacterProjection>;
  createRelation: (command: CreateCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  listRelations: (command: ListCharacterRelationsCommand) => Promise<CharacterRelationListProjection>;
  updateRelation: (command: UpdateCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  retireRelation: (command: RetireCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  runExtraction: (command: RunCharacterExtractionCommand) => Promise<CharacterExtractionResult>;
  listExtractionCandidates: (command: ListCharacterExtractionCandidatesCommand) => Promise<CharacterExtractionCandidateList>;
  decideExtractionItem: (command: DecideCharacterExtractionItemCommand) => Promise<CharacterExtractionDecisionResult>;
  runGeneration: (command: RunCharacterGenerationCommand) => Promise<CharacterGenerationResult>;
  listGenerationCandidates: (command: ListCharacterGenerationCandidatesCommand) => Promise<CharacterGenerationCandidateList>;
  decideGenerationItem: (command: DecideCharacterGenerationItemCommand) => Promise<CharacterGenerationDecisionResult>;
}>;

export type CharactersBridgeInvoke = (
  channel: CharactersBridgeChannel,
  payload?: CharactersBridgePayload,
) => Promise<unknown>;

function parseResult<T>(value: unknown, parse: (value: unknown) => T, error: string): T {
  try { return parse(value); } catch { throw new Error(error); }
}

export function createCharactersBridge(invoke: CharactersBridgeInvoke): CharactersBridge {
  return Object.freeze({
    create: async (input) => parseResult(await invoke(CHARACTER_CREATE_CHANNEL, parseCreateCharacterCommand(input)), parseCharacterProjection, "Invalid character creation result"),
    list: async (input) => parseResult(await invoke(CHARACTER_LIST_CHANNEL, parseListCharactersCommand(input)), parseCharacterListProjection, "Invalid character list"),
    update: async (input) => parseResult(await invoke(CHARACTER_UPDATE_CHANNEL, parseUpdateCharacterCommand(input)), parseCharacterProjection, "Invalid character update result"),
    addEvidence: async (input) => parseResult(await invoke(CHARACTER_ADD_EVIDENCE_CHANNEL, parseAddCharacterEvidenceCommand(input)), parseCharacterProjection, "Invalid character evidence result"),
    retire: async (input) => parseResult(await invoke(CHARACTER_RETIRE_CHANNEL, parseRetireCharacterCommand(input)), parseCharacterProjection, "Invalid character retirement result"),
    createRelation: async (input) => parseResult(await invoke(CHARACTER_RELATION_CREATE_CHANNEL, parseCreateCharacterRelationCommand(input)), parseCharacterRelationProjection, "Invalid character relation creation result"),
    listRelations: async (input) => parseResult(await invoke(CHARACTER_RELATION_LIST_CHANNEL, parseListCharacterRelationsCommand(input)), parseCharacterRelationListProjection, "Invalid character relation list"),
    updateRelation: async (input) => parseResult(await invoke(CHARACTER_RELATION_UPDATE_CHANNEL, parseUpdateCharacterRelationCommand(input)), parseCharacterRelationProjection, "Invalid character relation update result"),
    retireRelation: async (input) => parseResult(await invoke(CHARACTER_RELATION_RETIRE_CHANNEL, parseRetireCharacterRelationCommand(input)), parseCharacterRelationProjection, "Invalid character relation retirement result"),
    runExtraction: async (input) => parseResult(await invoke(CHARACTER_EXTRACTION_RUN_CHANNEL, parseRunCharacterExtractionCommand(input)), parseCharacterExtractionResult, "Invalid character extraction result"),
    listExtractionCandidates: async (input) => parseResult(await invoke(CHARACTER_EXTRACTION_LIST_CHANNEL, parseListCharacterExtractionCandidatesCommand(input)), parseCharacterExtractionCandidateList, "Invalid character extraction Candidate list"),
    decideExtractionItem: async (input) => {
      const value = await invoke(CHARACTER_EXTRACTION_DECIDE_CHANNEL, parseDecideCharacterExtractionItemCommand(input));
      try { return parseCharacterExtractionDecisionResult(value, parseCharacterProjection); } catch { throw new Error("Invalid character extraction decision result"); }
    },
    runGeneration: async (input) => parseResult(await invoke(CHARACTER_GENERATION_RUN_CHANNEL, parseRunCharacterGenerationCommand(input)), parseCharacterGenerationResult, "Invalid character generation result"),
    listGenerationCandidates: async (input) => parseResult(await invoke(CHARACTER_GENERATION_LIST_CHANNEL, parseListCharacterGenerationCandidatesCommand(input)), parseCharacterGenerationCandidateList, "Invalid character generation Candidate list"),
    decideGenerationItem: async (input) => {
      const value = await invoke(CHARACTER_GENERATION_DECIDE_CHANNEL, parseDecideCharacterGenerationItemCommand(input));
      try { return parseCharacterGenerationDecisionResult(value, parseCharacterProjection); } catch { throw new Error("Invalid character generation decision result"); }
    },
  });
}
