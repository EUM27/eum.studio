import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  LORE_CANDIDATE_APPROVE_CHANNEL,
  LORE_CANDIDATE_CREATE_CHANNEL,
  LORE_CANDIDATE_LIST_CHANNEL,
  LORE_CANDIDATE_REJECT_CHANNEL,
  LORE_ENTRY_ADD_EVIDENCE_CHANNEL,
  LORE_ENTRY_CREATE_CHANNEL,
  LORE_ENTRY_LIST_CHANNEL,
  LORE_ENTRY_RETIRE_CHANNEL,
  LORE_ENTRY_UPDATE_CHANNEL,
  LORE_FORESHADOW_LINK_CHANNEL,
  LORE_FORESHADOW_LIST_CHANNEL,
  LORE_FORESHADOW_UNLINK_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseAddLoreEntryEvidenceCommand,
  parseCreateLoreEntryCommand,
  parseListLoreEntriesCommand,
  parseRetireLoreEntryCommand,
  parseUpdateLoreEntryCommand,
  type AddLoreEntryEvidenceCommand,
  type CreateLoreEntryCommand,
  type ListLoreEntriesCommand,
  type LoreEntryListProjection,
  type LoreEntryProjection,
  type RetireLoreEntryCommand,
  type UpdateLoreEntryCommand,
} from "../../application/lore/lore-entry-contract";
import {
  parseCreateLoreCandidateCommand,
  parseListLoreCandidatesCommand,
  parseReviewLoreCandidateCommand,
  type CreateLoreCandidateCommand,
  type ListLoreCandidatesCommand,
  type LoreCandidateApprovalResult,
  type LoreCandidateListProjection,
  type LoreCandidateProjection,
  type ReviewLoreCandidateCommand,
} from "../../application/lore/lore-candidate-contract";
import {
  parseLinkLoreForeshadowCommand,
  parseListLoreForeshadowLinksCommand,
  parseUnlinkLoreForeshadowCommand,
  type LinkLoreForeshadowCommand,
  type ListLoreForeshadowLinksCommand,
  type LoreForeshadowLinkListProjection,
  type LoreForeshadowLinkProjection,
  type UnlinkLoreForeshadowCommand,
} from "../../application/lore/lore-foreshadow-link-contract";

export type LoreIpcRuntime = Readonly<{
  createLoreEntry: (command: CreateLoreEntryCommand) => Promise<LoreEntryProjection>;
  listLoreEntries: (
    command: ListLoreEntriesCommand,
  ) => Promise<LoreEntryListProjection>;
  updateLoreEntry: (command: UpdateLoreEntryCommand) => Promise<LoreEntryProjection>;
  addLoreEntryEvidence: (
    command: AddLoreEntryEvidenceCommand,
  ) => Promise<LoreEntryProjection>;
  retireLoreEntry: (command: RetireLoreEntryCommand) => Promise<LoreEntryProjection>;
  createLoreCandidate: (
    command: CreateLoreCandidateCommand,
  ) => Promise<LoreCandidateProjection>;
  listLoreCandidates: (
    command: ListLoreCandidatesCommand,
  ) => Promise<LoreCandidateListProjection>;
  approveLoreCandidate: (
    command: ReviewLoreCandidateCommand,
  ) => Promise<LoreCandidateApprovalResult>;
  rejectLoreCandidate: (
    command: ReviewLoreCandidateCommand,
  ) => Promise<LoreCandidateProjection>;
  linkLoreForeshadow: (
    command: LinkLoreForeshadowCommand,
  ) => Promise<LoreForeshadowLinkProjection>;
  listLoreForeshadowLinks: (
    command: ListLoreForeshadowLinksCommand,
  ) => Promise<LoreForeshadowLinkListProjection>;
  unlinkLoreForeshadow: (
    command: UnlinkLoreForeshadowCommand,
  ) => Promise<LoreForeshadowLinkProjection>;
}>;

export function registerLoreIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: LoreIpcRuntime;
}>): void {
  input.ipcMain.handle(LORE_ENTRY_CREATE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.createLoreEntry(parseCreateLoreEntryCommand(value));
  });
  input.ipcMain.handle(LORE_ENTRY_LIST_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listLoreEntries(parseListLoreEntriesCommand(value));
  });
  input.ipcMain.handle(LORE_ENTRY_UPDATE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.updateLoreEntry(parseUpdateLoreEntryCommand(value));
  });
  input.ipcMain.handle(
    LORE_ENTRY_ADD_EVIDENCE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.addLoreEntryEvidence(
        parseAddLoreEntryEvidenceCommand(value),
      );
    },
  );
  input.ipcMain.handle(LORE_ENTRY_RETIRE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.retireLoreEntry(parseRetireLoreEntryCommand(value));
  });
  input.ipcMain.handle(
    LORE_CANDIDATE_CREATE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.createLoreCandidate(
        parseCreateLoreCandidateCommand(value),
      );
    },
  );
  input.ipcMain.handle(LORE_CANDIDATE_LIST_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listLoreCandidates(
      parseListLoreCandidatesCommand(value),
    );
  });
  input.ipcMain.handle(
    LORE_CANDIDATE_APPROVE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.approveLoreCandidate(
        parseReviewLoreCandidateCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    LORE_CANDIDATE_REJECT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.rejectLoreCandidate(
        parseReviewLoreCandidateCommand(value),
      );
    },
  );
  input.ipcMain.handle(LORE_FORESHADOW_LINK_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.linkLoreForeshadow(
      parseLinkLoreForeshadowCommand(value),
    );
  });
  input.ipcMain.handle(LORE_FORESHADOW_LIST_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.listLoreForeshadowLinks(
      parseListLoreForeshadowLinksCommand(value),
    );
  });
  input.ipcMain.handle(
    LORE_FORESHADOW_UNLINK_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.unlinkLoreForeshadow(
        parseUnlinkLoreForeshadowCommand(value),
      );
    },
  );
}
