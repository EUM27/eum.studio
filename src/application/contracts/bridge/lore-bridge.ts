import {
  parseAddLoreEntryEvidenceCommand,
  parseCreateLoreEntryCommand,
  parseListLoreEntriesCommand,
  parseLoreEntryListProjection,
  parseLoreEntryProjection,
  parseRetireLoreEntryCommand,
  parseUpdateLoreEntryCommand,
  type AddLoreEntryEvidenceCommand,
  type CreateLoreEntryCommand,
  type ListLoreEntriesCommand,
  type LoreEntryListProjection,
  type LoreEntryProjection,
  type RetireLoreEntryCommand,
  type UpdateLoreEntryCommand,
} from "../../lore/lore-entry-contract";
import {
  parseCreateLoreCandidateCommand,
  parseListLoreCandidatesCommand,
  parseLoreCandidateApprovalResult,
  parseLoreCandidateListProjection,
  parseLoreCandidateProjection,
  parseReviewLoreCandidateCommand,
  type CreateLoreCandidateCommand,
  type ListLoreCandidatesCommand,
  type LoreCandidateApprovalResult,
  type LoreCandidateListProjection,
  type LoreCandidateProjection,
  type ReviewLoreCandidateCommand,
} from "../../lore/lore-candidate-contract";
import {
  parseLinkLoreForeshadowCommand,
  parseListLoreForeshadowLinksCommand,
  parseLoreForeshadowLinkListProjection,
  parseLoreForeshadowLinkProjection,
  parseUnlinkLoreForeshadowCommand,
  type LinkLoreForeshadowCommand,
  type ListLoreForeshadowLinksCommand,
  type LoreForeshadowLinkListProjection,
  type LoreForeshadowLinkProjection,
  type UnlinkLoreForeshadowCommand,
} from "../../lore/lore-foreshadow-link-contract";

export const LORE_ENTRY_CREATE_CHANNEL = "studio:lore-entries:create";
export const LORE_ENTRY_LIST_CHANNEL = "studio:lore-entries:list";
export const LORE_ENTRY_UPDATE_CHANNEL = "studio:lore-entries:update";
export const LORE_ENTRY_ADD_EVIDENCE_CHANNEL =
  "studio:lore-entries:add-evidence";
export const LORE_ENTRY_RETIRE_CHANNEL = "studio:lore-entries:retire";
export const LORE_CANDIDATE_CREATE_CHANNEL = "studio:lore-candidates:create";
export const LORE_CANDIDATE_LIST_CHANNEL = "studio:lore-candidates:list";
export const LORE_CANDIDATE_APPROVE_CHANNEL = "studio:lore-candidates:approve";
export const LORE_CANDIDATE_REJECT_CHANNEL = "studio:lore-candidates:reject";
export const LORE_FORESHADOW_LINK_CHANNEL =
  "studio:lore-foreshadow-links:link";
export const LORE_FORESHADOW_LIST_CHANNEL =
  "studio:lore-foreshadow-links:list";
export const LORE_FORESHADOW_UNLINK_CHANNEL =
  "studio:lore-foreshadow-links:unlink";

export type LoreBridgeChannel =
  | typeof LORE_ENTRY_CREATE_CHANNEL
  | typeof LORE_ENTRY_LIST_CHANNEL
  | typeof LORE_ENTRY_UPDATE_CHANNEL
  | typeof LORE_ENTRY_ADD_EVIDENCE_CHANNEL
  | typeof LORE_ENTRY_RETIRE_CHANNEL
  | typeof LORE_CANDIDATE_CREATE_CHANNEL
  | typeof LORE_CANDIDATE_LIST_CHANNEL
  | typeof LORE_CANDIDATE_APPROVE_CHANNEL
  | typeof LORE_CANDIDATE_REJECT_CHANNEL
  | typeof LORE_FORESHADOW_LINK_CHANNEL
  | typeof LORE_FORESHADOW_LIST_CHANNEL
  | typeof LORE_FORESHADOW_UNLINK_CHANNEL;

export type LoreBridgePayload =
  | CreateLoreEntryCommand
  | ListLoreEntriesCommand
  | UpdateLoreEntryCommand
  | AddLoreEntryEvidenceCommand
  | RetireLoreEntryCommand
  | CreateLoreCandidateCommand
  | ListLoreCandidatesCommand
  | ReviewLoreCandidateCommand
  | LinkLoreForeshadowCommand
  | ListLoreForeshadowLinksCommand
  | UnlinkLoreForeshadowCommand;

export type LoreEntriesBridge = Readonly<{
  create: (command: CreateLoreEntryCommand) => Promise<LoreEntryProjection>;
  list: (command: ListLoreEntriesCommand) => Promise<LoreEntryListProjection>;
  update: (command: UpdateLoreEntryCommand) => Promise<LoreEntryProjection>;
  addEvidence: (
    command: AddLoreEntryEvidenceCommand,
  ) => Promise<LoreEntryProjection>;
  retire: (command: RetireLoreEntryCommand) => Promise<LoreEntryProjection>;
}>;

export type LoreCandidatesBridge = Readonly<{
  create: (
    command: CreateLoreCandidateCommand,
  ) => Promise<LoreCandidateProjection>;
  list: (
    command: ListLoreCandidatesCommand,
  ) => Promise<LoreCandidateListProjection>;
  approve: (
    command: ReviewLoreCandidateCommand,
  ) => Promise<LoreCandidateApprovalResult>;
  reject: (
    command: ReviewLoreCandidateCommand,
  ) => Promise<LoreCandidateProjection>;
}>;

export type LoreForeshadowLinksBridge = Readonly<{
  link: (
    command: LinkLoreForeshadowCommand,
  ) => Promise<LoreForeshadowLinkProjection>;
  list: (
    command: ListLoreForeshadowLinksCommand,
  ) => Promise<LoreForeshadowLinkListProjection>;
  unlink: (
    command: UnlinkLoreForeshadowCommand,
  ) => Promise<LoreForeshadowLinkProjection>;
}>;

export type LoreBridge = Readonly<{
  loreEntries: LoreEntriesBridge;
  loreCandidates: LoreCandidatesBridge;
  loreForeshadowLinks: LoreForeshadowLinksBridge;
}>;

export type LoreBridgeInvoke = (
  channel: LoreBridgeChannel,
  payload?: LoreBridgePayload,
) => Promise<unknown>;

export function createLoreBridge(invoke: LoreBridgeInvoke): LoreBridge {
  return Object.freeze({
    loreEntries: {
      create: async (input) => {
        const command = parseCreateLoreEntryCommand(input);
        const value = await invoke(LORE_ENTRY_CREATE_CHANNEL, command);
        try {
          return parseLoreEntryProjection(value);
        } catch {
          throw new Error("Invalid lore entry creation result");
        }
      },
      list: async (input) => {
        const command = parseListLoreEntriesCommand(input);
        const value = await invoke(LORE_ENTRY_LIST_CHANNEL, command);
        try {
          return parseLoreEntryListProjection(value);
        } catch {
          throw new Error("Invalid lore entry list");
        }
      },
      update: async (input) => {
        const command = parseUpdateLoreEntryCommand(input);
        const value = await invoke(LORE_ENTRY_UPDATE_CHANNEL, command);
        try {
          return parseLoreEntryProjection(value);
        } catch {
          throw new Error("Invalid lore entry update result");
        }
      },
      addEvidence: async (input) => {
        const command = parseAddLoreEntryEvidenceCommand(input);
        const value = await invoke(LORE_ENTRY_ADD_EVIDENCE_CHANNEL, command);
        try {
          return parseLoreEntryProjection(value);
        } catch {
          throw new Error("Invalid lore entry evidence result");
        }
      },
      retire: async (input) => {
        const command = parseRetireLoreEntryCommand(input);
        const value = await invoke(LORE_ENTRY_RETIRE_CHANNEL, command);
        try {
          return parseLoreEntryProjection(value);
        } catch {
          throw new Error("Invalid lore entry retirement result");
        }
      },
    },
    loreCandidates: {
      create: async (input) => {
        const command = parseCreateLoreCandidateCommand(input);
        const value = await invoke(LORE_CANDIDATE_CREATE_CHANNEL, command);
        try {
          return parseLoreCandidateProjection(value);
        } catch {
          throw new Error("Invalid lore candidate creation result");
        }
      },
      list: async (input) => {
        const command = parseListLoreCandidatesCommand(input);
        const value = await invoke(LORE_CANDIDATE_LIST_CHANNEL, command);
        try {
          return parseLoreCandidateListProjection(value);
        } catch {
          throw new Error("Invalid lore candidate list");
        }
      },
      approve: async (input) => {
        const command = parseReviewLoreCandidateCommand(input);
        const value = await invoke(LORE_CANDIDATE_APPROVE_CHANNEL, command);
        try {
          return parseLoreCandidateApprovalResult(value);
        } catch {
          throw new Error("Invalid lore candidate approval result");
        }
      },
      reject: async (input) => {
        const command = parseReviewLoreCandidateCommand(input);
        const value = await invoke(LORE_CANDIDATE_REJECT_CHANNEL, command);
        try {
          return parseLoreCandidateProjection(value);
        } catch {
          throw new Error("Invalid lore candidate rejection result");
        }
      },
    },
    loreForeshadowLinks: {
      link: async (input) => {
        const command = parseLinkLoreForeshadowCommand(input);
        const value = await invoke(LORE_FORESHADOW_LINK_CHANNEL, command);
        try {
          return parseLoreForeshadowLinkProjection(value);
        } catch {
          throw new Error("Invalid lore/foreshadow link result");
        }
      },
      list: async (input) => {
        const command = parseListLoreForeshadowLinksCommand(input);
        const value = await invoke(LORE_FORESHADOW_LIST_CHANNEL, command);
        try {
          return parseLoreForeshadowLinkListProjection(value);
        } catch {
          throw new Error("Invalid lore/foreshadow link list");
        }
      },
      unlink: async (input) => {
        const command = parseUnlinkLoreForeshadowCommand(input);
        const value = await invoke(LORE_FORESHADOW_UNLINK_CHANNEL, command);
        try {
          return parseLoreForeshadowLinkProjection(value);
        } catch {
          throw new Error("Invalid lore/foreshadow unlink result");
        }
      },
    },
  });
}
