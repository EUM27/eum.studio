import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CHARACTER_ADD_EVIDENCE_CHANNEL,
  CHARACTER_CREATE_CHANNEL,
  CHARACTER_EXTRACTION_DECIDE_CHANNEL,
  CHARACTER_EXTRACTION_LIST_CHANNEL,
  CHARACTER_EXTRACTION_RUN_CHANNEL,
  CHARACTER_GENERATION_DECIDE_CHANNEL,
  CHARACTER_GENERATION_LIST_CHANNEL,
  CHARACTER_GENERATION_RUN_CHANNEL,
  CHARACTER_LIST_CHANNEL,
  CHARACTER_RELATION_CREATE_CHANNEL,
  CHARACTER_RELATION_LIST_CHANNEL,
  CHARACTER_RELATION_RETIRE_CHANNEL,
  CHARACTER_RELATION_UPDATE_CHANNEL,
  CHARACTER_RETIRE_CHANNEL,
  CHARACTER_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseAddCharacterEvidenceCommand,
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
} from "../../application/characters/character-contract";
import {
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
} from "../../application/characters/character-relation-contract";
import {
  parseDecideCharacterExtractionItemCommand,
  parseListCharacterExtractionCandidatesCommand,
  parseRunCharacterExtractionCommand,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionResult,
  type DecideCharacterExtractionItemCommand,
  type ListCharacterExtractionCandidatesCommand,
  type RunCharacterExtractionCommand,
} from "../../application/characters/character-extraction-contract";
import {
  parseDecideCharacterGenerationItemCommand,
  parseListCharacterGenerationCandidatesCommand,
  parseRunCharacterGenerationCommand,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationResult,
  type DecideCharacterGenerationItemCommand,
  type ListCharacterGenerationCandidatesCommand,
  type RunCharacterGenerationCommand,
} from "../../application/characters/character-generation-contract";

export type CharactersIpcRuntime = Readonly<{
  createCharacter: (command: CreateCharacterCommand) => Promise<CharacterProjection>;
  listCharacters: (command: ListCharactersCommand) => Promise<CharacterListProjection>;
  updateCharacter: (command: UpdateCharacterCommand) => Promise<CharacterProjection>;
  addCharacterEvidence: (command: AddCharacterEvidenceCommand) => Promise<CharacterProjection>;
  retireCharacter: (command: RetireCharacterCommand) => Promise<CharacterProjection>;
  createCharacterRelation: (command: CreateCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  listCharacterRelations: (command: ListCharacterRelationsCommand) => Promise<CharacterRelationListProjection>;
  updateCharacterRelation: (command: UpdateCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  retireCharacterRelation: (command: RetireCharacterRelationCommand) => Promise<CharacterRelationProjection>;
  runCharacterExtraction: (command: RunCharacterExtractionCommand) => Promise<CharacterExtractionResult>;
  listCharacterExtractionCandidates: (command: ListCharacterExtractionCandidatesCommand) => Promise<CharacterExtractionCandidateList>;
  decideCharacterExtractionItem: (command: DecideCharacterExtractionItemCommand) => Promise<CharacterExtractionDecisionResult>;
  runCharacterGeneration: (command: RunCharacterGenerationCommand) => Promise<CharacterGenerationResult>;
  listCharacterGenerationCandidates: (command: ListCharacterGenerationCandidatesCommand) => Promise<CharacterGenerationCandidateList>;
  decideCharacterGenerationItem: (command: DecideCharacterGenerationItemCommand) => Promise<CharacterGenerationDecisionResult>;
}>;

export function registerCharactersIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: CharactersIpcRuntime;
}>): void {
  const handle = <T>(channel: string, parse: (value: unknown) => T, run: (command: T) => Promise<unknown>) =>
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return run(parse(value));
    });
  handle(CHARACTER_CREATE_CHANNEL, parseCreateCharacterCommand, input.runtime.createCharacter);
  handle(CHARACTER_LIST_CHANNEL, parseListCharactersCommand, input.runtime.listCharacters);
  handle(CHARACTER_UPDATE_CHANNEL, parseUpdateCharacterCommand, input.runtime.updateCharacter);
  handle(CHARACTER_ADD_EVIDENCE_CHANNEL, parseAddCharacterEvidenceCommand, input.runtime.addCharacterEvidence);
  handle(CHARACTER_RETIRE_CHANNEL, parseRetireCharacterCommand, input.runtime.retireCharacter);
  handle(CHARACTER_RELATION_CREATE_CHANNEL, parseCreateCharacterRelationCommand, input.runtime.createCharacterRelation);
  handle(CHARACTER_RELATION_LIST_CHANNEL, parseListCharacterRelationsCommand, input.runtime.listCharacterRelations);
  handle(CHARACTER_RELATION_UPDATE_CHANNEL, parseUpdateCharacterRelationCommand, input.runtime.updateCharacterRelation);
  handle(CHARACTER_RELATION_RETIRE_CHANNEL, parseRetireCharacterRelationCommand, input.runtime.retireCharacterRelation);
  handle(CHARACTER_EXTRACTION_RUN_CHANNEL, parseRunCharacterExtractionCommand, input.runtime.runCharacterExtraction);
  handle(CHARACTER_EXTRACTION_LIST_CHANNEL, parseListCharacterExtractionCandidatesCommand, input.runtime.listCharacterExtractionCandidates);
  handle(CHARACTER_EXTRACTION_DECIDE_CHANNEL, parseDecideCharacterExtractionItemCommand, input.runtime.decideCharacterExtractionItem);
  handle(CHARACTER_GENERATION_RUN_CHANNEL, parseRunCharacterGenerationCommand, input.runtime.runCharacterGeneration);
  handle(CHARACTER_GENERATION_LIST_CHANNEL, parseListCharacterGenerationCandidatesCommand, input.runtime.listCharacterGenerationCandidates);
  handle(CHARACTER_GENERATION_DECIDE_CHANNEL, parseDecideCharacterGenerationItemCommand, input.runtime.decideCharacterGenerationItem);
}
