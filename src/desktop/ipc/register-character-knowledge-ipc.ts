import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
  CHARACTER_KNOWLEDGE_LIST_CHANNEL,
  CHARACTER_KNOWLEDGE_POV_CHANNEL,
  CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
  CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
  CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
} from "../../application/contracts/bridge/character-knowledge-bridge";
import {
  parseCreateCharacterKnowledgeCommand,
  parseListCharacterKnowledgeCommand,
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
} from "../../application/continuity/character-knowledge-contract";

export type CharacterKnowledgeIpcRuntime = Readonly<{
  createCharacterKnowledge(
    command: CreateCharacterKnowledgeCommand,
  ): Promise<CharacterKnowledgeProjection>;
  updateCharacterKnowledge(
    command: UpdateCharacterKnowledgeCommand,
  ): Promise<CharacterKnowledgeProjection>;
  supersedeCharacterKnowledge(
    command: SupersedeCharacterKnowledgeCommand,
  ): Promise<CharacterKnowledgeProjection>;
  retireCharacterKnowledge(
    command: RetireCharacterKnowledgeCommand,
  ): Promise<CharacterKnowledgeProjection>;
  listCharacterKnowledge(
    command: ListCharacterKnowledgeCommand,
  ): Promise<CharacterKnowledgeListProjection>;
  projectPovCharacterKnowledge(
    command: ProjectPovKnowledgeCommand,
  ): Promise<PovKnowledgeContextProjection>;
}>;

export function registerCharacterKnowledgeIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender(event: IpcMainInvokeEvent): void;
  runtime: CharacterKnowledgeIpcRuntime;
}>): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (command: T) => Promise<unknown>,
  ) => input.ipcMain.handle(channel, (event, value: unknown) => {
    input.authorizeSender(event);
    return run(parse(value));
  });
  handle(
    CHARACTER_KNOWLEDGE_CREATE_CHANNEL,
    parseCreateCharacterKnowledgeCommand,
    input.runtime.createCharacterKnowledge,
  );
  handle(
    CHARACTER_KNOWLEDGE_UPDATE_CHANNEL,
    parseUpdateCharacterKnowledgeCommand,
    input.runtime.updateCharacterKnowledge,
  );
  handle(
    CHARACTER_KNOWLEDGE_SUPERSEDE_CHANNEL,
    parseSupersedeCharacterKnowledgeCommand,
    input.runtime.supersedeCharacterKnowledge,
  );
  handle(
    CHARACTER_KNOWLEDGE_RETIRE_CHANNEL,
    parseRetireCharacterKnowledgeCommand,
    input.runtime.retireCharacterKnowledge,
  );
  handle(
    CHARACTER_KNOWLEDGE_LIST_CHANNEL,
    parseListCharacterKnowledgeCommand,
    input.runtime.listCharacterKnowledge,
  );
  handle(
    CHARACTER_KNOWLEDGE_POV_CHANNEL,
    parseProjectPovKnowledgeCommand,
    input.runtime.projectPovCharacterKnowledge,
  );
}
