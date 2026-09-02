import {
  parseCreatePublishingPartnerCommand,
  parseListPublishingPartnersCommand,
  parsePublishingPartnerListProjection,
  parsePublishingPartnerProjection,
  parseUpdatePublishingPartnerCommand,
  type CreatePublishingPartnerCommand,
  type ListPublishingPartnersCommand,
  type PublishingPartnerListProjection,
  type PublishingPartnerProjection,
  type UpdatePublishingPartnerCommand,
} from "../../publishing/publishing-partner-contract";
import {
  parseCreatePublishingSubmissionCommand,
  parseListPublishingSubmissionsCommand,
  parsePublishingSubmissionListProjection,
  parsePublishingSubmissionProjection,
  parseUpdatePublishingSubmissionCommand,
  type CreatePublishingSubmissionCommand,
  type ListPublishingSubmissionsCommand,
  type PublishingSubmissionListProjection,
  type PublishingSubmissionProjection,
  type UpdatePublishingSubmissionCommand,
} from "../../publishing/publishing-submission-contract";
import {
  parseCreatePublishingContractCommand,
  parseListPublishingContractsCommand,
  parsePublishingContractListProjection,
  parsePublishingContractProjection,
  parseUpdatePublishingContractCommand,
  type CreatePublishingContractCommand,
  type ListPublishingContractsCommand,
  type PublishingContractListProjection,
  type PublishingContractProjection,
  type UpdatePublishingContractCommand,
} from "../../publishing/publishing-contract-contract";
import {
  parseCreatePublishingPublicationCommand,
  parseListPublishingPublicationsCommand,
  parsePublishingPublicationListProjection,
  parsePublishingPublicationProjection,
  parseUpdatePublishingPublicationCommand,
  type CreatePublishingPublicationCommand,
  type ListPublishingPublicationsCommand,
  type PublishingPublicationListProjection,
  type PublishingPublicationProjection,
  type UpdatePublishingPublicationCommand,
} from "../../publishing/publishing-publication-contract";
import {
  parseCreatePublishingSettlementCommand,
  parseListPublishingSettlementsCommand,
  parsePublishingSettlementListProjection,
  parsePublishingSettlementProjection,
  parseUpdatePublishingSettlementCommand,
  type CreatePublishingSettlementCommand,
  type ListPublishingSettlementsCommand,
  type PublishingSettlementListProjection,
  type PublishingSettlementProjection,
  type UpdatePublishingSettlementCommand,
} from "../../publishing/publishing-settlement-contract";
import {
  parseCreatePublishingPaymentCommand,
  parseListPublishingPaymentsCommand,
  parsePublishingPaymentListProjection,
  parsePublishingPaymentProjection,
  parseUpdatePublishingPaymentCommand,
  type CreatePublishingPaymentCommand,
  type ListPublishingPaymentsCommand,
  type PublishingPaymentListProjection,
  type PublishingPaymentProjection,
  type UpdatePublishingPaymentCommand,
} from "../../publishing/publishing-payment-contract";
import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
  parsePublishingSourceProjection,
  type CreatePublishingSourceCommand,
  type ListPublishingSourcesCommand,
  type PublishingSourceListProjection,
  type PublishingSourceProjection,
} from "../../publishing/publishing-source-contract";
import {
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  parsePublishingResearchApprovalResult,
  parsePublishingResearchCandidateProjection,
  type ApprovePublishingResearchCommand,
  type PreviewPublishingResearchCommand,
  type PublishingResearchApprovalResult,
  type PublishingResearchCandidateProjection,
} from "../../publishing/publishing-research-contract";
import {
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantApprovalResult,
  parsePublishingAssistantResult,
  parseRunPublishingAssistantCommand,
  type ApprovePublishingAssistantCandidateCommand,
  type PublishingAssistantApprovalResult,
  type PublishingAssistantResult,
  type RunPublishingAssistantCommand,
} from "../../publishing/publishing-assistant-contract";
import {
  parsePublishingEvidenceLinksProjection,
  parseSetPublishingEvidenceLinksCommand,
  type PublishingEvidenceLinksProjection,
  type SetPublishingEvidenceLinksCommand,
} from "../../publishing/publishing-evidence-link-contract";
import {
  parseApplyPublishingPartnerCsvImportCommand,
  parsePublishingPartnerCsvImportResult,
  parsePublishingPartnerCsvSelectionProjection,
  parseSelectPublishingPartnerCsvCommand,
  type ApplyPublishingPartnerCsvImportCommand,
  type PublishingPartnerCsvImportResult,
  type PublishingPartnerCsvSelectionProjection,
  type SelectPublishingPartnerCsvCommand,
} from "../../publishing/publishing-partner-csv-import";
import {
  parseApplyPublishingSubmissionCsvImportCommand,
  parsePublishingSubmissionCsvImportResult,
  parsePublishingSubmissionCsvSelectionProjection,
  parseSelectPublishingSubmissionCsvCommand,
  type ApplyPublishingSubmissionCsvImportCommand,
  type PublishingSubmissionCsvImportResult,
  type PublishingSubmissionCsvSelectionProjection,
  type SelectPublishingSubmissionCsvCommand,
} from "../../publishing/publishing-submission-csv-import";
import {
  parseLinkPublishingMailCandidateCommand,
  parseListPublishingMailCandidatesCommand,
  parsePublishingMailCandidateListProjection,
  parsePublishingMailCandidateProjection,
  parsePublishingMailCandidateReviewResult,
  parseReviewPublishingMailCandidateCommand,
  parseUpdatePublishingMailCandidateCommand,
  type LinkPublishingMailCandidateCommand,
  type ListPublishingMailCandidatesCommand,
  type PublishingMailCandidateListProjection,
  type PublishingMailCandidateProjection,
  type PublishingMailCandidateReviewResult,
  type ReviewPublishingMailCandidateCommand,
  type UpdatePublishingMailCandidateCommand,
} from "../../publishing/publishing-mail-candidate-contract";
import {
  parseConnectPublishingMailCommand,
  parseDisconnectPublishingMailCommand,
  parseGetPublishingMailConnectionCommand,
  parsePublishingMailConnectionProjection,
  parsePublishingMailSyncResult,
  parseSyncPublishingMailCommand,
  type ConnectPublishingMailCommand,
  type DisconnectPublishingMailCommand,
  type GetPublishingMailConnectionCommand,
  type PublishingMailConnectionProjection,
  type PublishingMailSyncResult,
  type SyncPublishingMailCommand,
} from "../../publishing/publishing-mail-connection-contract";
import {
  parseGetPublishingMailScheduleCommand,
  parsePublishingMailScheduleProjection,
  parseSavePublishingMailScheduleCommand,
  type GetPublishingMailScheduleCommand,
  type PublishingMailScheduleProjection,
  type SavePublishingMailScheduleCommand,
} from "../../publishing/publishing-mail-schedule-contract";
import {
  parseCreatePublishingFormTemplateCommand,
  parseListPublishingFormResponsesCommand,
  parseListPublishingFormTemplatesCommand,
  parsePublishingFormResponseListProjection,
  parsePublishingFormResponseProjection,
  parsePublishingFormTemplateListProjection,
  parsePublishingFormTemplateProjection,
  parseSavePublishingFormResponseCommand,
  parseUpdatePublishingFormTemplateCommand,
  type CreatePublishingFormTemplateCommand,
  type ListPublishingFormResponsesCommand,
  type ListPublishingFormTemplatesCommand,
  type PublishingFormResponseListProjection,
  type PublishingFormResponseProjection,
  type PublishingFormTemplateListProjection,
  type PublishingFormTemplateProjection,
  type SavePublishingFormResponseCommand,
  type UpdatePublishingFormTemplateCommand,
} from "../../publishing/publishing-form-contract";
export const PUBLISHING_PARTNER_CREATE_CHANNEL =
  "studio:publishing-partners:create";
export const PUBLISHING_PARTNER_LIST_CHANNEL =
  "studio:publishing-partners:list";
export const PUBLISHING_PARTNER_UPDATE_CHANNEL =
  "studio:publishing-partners:update";
export const PUBLISHING_SUBMISSION_CREATE_CHANNEL =
  "studio:publishing-submissions:create";
export const PUBLISHING_SUBMISSION_LIST_CHANNEL =
  "studio:publishing-submissions:list";
export const PUBLISHING_SUBMISSION_UPDATE_CHANNEL =
  "studio:publishing-submissions:update";
export const PUBLISHING_CONTRACT_CREATE_CHANNEL =
  "studio:publishing-contracts:create";
export const PUBLISHING_CONTRACT_LIST_CHANNEL =
  "studio:publishing-contracts:list";
export const PUBLISHING_CONTRACT_UPDATE_CHANNEL =
  "studio:publishing-contracts:update";
export const PUBLISHING_PUBLICATION_CREATE_CHANNEL =
  "studio:publishing-publications:create";
export const PUBLISHING_PUBLICATION_LIST_CHANNEL =
  "studio:publishing-publications:list";
export const PUBLISHING_PUBLICATION_UPDATE_CHANNEL =
  "studio:publishing-publications:update";
export const PUBLISHING_SETTLEMENT_CREATE_CHANNEL =
  "studio:publishing-settlements:create";
export const PUBLISHING_SETTLEMENT_LIST_CHANNEL =
  "studio:publishing-settlements:list";
export const PUBLISHING_SETTLEMENT_UPDATE_CHANNEL =
  "studio:publishing-settlements:update";
export const PUBLISHING_PAYMENT_CREATE_CHANNEL =
  "studio:publishing-payments:create";
export const PUBLISHING_PAYMENT_LIST_CHANNEL =
  "studio:publishing-payments:list";
export const PUBLISHING_PAYMENT_UPDATE_CHANNEL =
  "studio:publishing-payments:update";
export const PUBLISHING_SOURCE_CREATE_CHANNEL =
  "studio:publishing-sources:create";
export const PUBLISHING_SOURCE_LIST_CHANNEL =
  "studio:publishing-sources:list";
export const PUBLISHING_RESEARCH_PREVIEW_CHANNEL =
  "studio:publishing-research:preview";
export const PUBLISHING_RESEARCH_APPROVE_CHANNEL =
  "studio:publishing-research:approve";
export const PUBLISHING_ASSISTANT_RUN_CHANNEL =
  "studio:publishing-assistant:run";
export const PUBLISHING_ASSISTANT_APPROVE_CHANNEL =
  "studio:publishing-assistant:approve";
export const PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL =
  "studio:publishing-evidence:set-links";
export const PUBLISHING_PARTNER_CSV_SELECT_CHANNEL =
  "studio:publishing-imports:select-partner-csv";
export const PUBLISHING_PARTNER_CSV_APPLY_CHANNEL =
  "studio:publishing-imports:apply-partner-csv";
export const PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL =
  "studio:publishing-imports:select-submission-csv";
export const PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL =
  "studio:publishing-imports:apply-submission-csv";
export const PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL =
  "studio:publishing-mail-candidates:list";
export const PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL =
  "studio:publishing-mail-candidates:link";
export const PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL =
  "studio:publishing-mail-candidates:update";
export const PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL =
  "studio:publishing-mail-candidates:review";
export const PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL =
  "studio:publishing-mail-connection:status";
export const PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL =
  "studio:publishing-mail-connection:connect";
export const PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL =
  "studio:publishing-mail-connection:sync";
export const PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL =
  "studio:publishing-mail-connection:disconnect";
export const PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL =
  "studio:publishing-mail-schedule:status";
export const PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL =
  "studio:publishing-mail-schedule:save";
export const PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL =
  "studio:publishing-forms:templates:create";
export const PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL =
  "studio:publishing-forms:templates:list";
export const PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL =
  "studio:publishing-forms:templates:update";
export const PUBLISHING_FORM_RESPONSE_LIST_CHANNEL =
  "studio:publishing-forms:responses:list";
export const PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL =
  "studio:publishing-forms:responses:save";

export type PublishingBridgeChannel =
  typeof PUBLISHING_PARTNER_CREATE_CHANNEL
  | typeof PUBLISHING_PARTNER_LIST_CHANNEL
  | typeof PUBLISHING_PARTNER_UPDATE_CHANNEL
  | typeof PUBLISHING_SUBMISSION_CREATE_CHANNEL
  | typeof PUBLISHING_SUBMISSION_LIST_CHANNEL
  | typeof PUBLISHING_SUBMISSION_UPDATE_CHANNEL
  | typeof PUBLISHING_CONTRACT_CREATE_CHANNEL
  | typeof PUBLISHING_CONTRACT_LIST_CHANNEL
  | typeof PUBLISHING_CONTRACT_UPDATE_CHANNEL
  | typeof PUBLISHING_PUBLICATION_CREATE_CHANNEL
  | typeof PUBLISHING_PUBLICATION_LIST_CHANNEL
  | typeof PUBLISHING_PUBLICATION_UPDATE_CHANNEL
  | typeof PUBLISHING_SETTLEMENT_CREATE_CHANNEL
  | typeof PUBLISHING_SETTLEMENT_LIST_CHANNEL
  | typeof PUBLISHING_SETTLEMENT_UPDATE_CHANNEL
  | typeof PUBLISHING_PAYMENT_CREATE_CHANNEL
  | typeof PUBLISHING_PAYMENT_LIST_CHANNEL
  | typeof PUBLISHING_PAYMENT_UPDATE_CHANNEL
  | typeof PUBLISHING_SOURCE_CREATE_CHANNEL
  | typeof PUBLISHING_SOURCE_LIST_CHANNEL
  | typeof PUBLISHING_RESEARCH_PREVIEW_CHANNEL
  | typeof PUBLISHING_RESEARCH_APPROVE_CHANNEL
  | typeof PUBLISHING_ASSISTANT_RUN_CHANNEL
  | typeof PUBLISHING_ASSISTANT_APPROVE_CHANNEL
  | typeof PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL
  | typeof PUBLISHING_PARTNER_CSV_SELECT_CHANNEL
  | typeof PUBLISHING_PARTNER_CSV_APPLY_CHANNEL
  | typeof PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL
  | typeof PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL
  | typeof PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL
  | typeof PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL
  | typeof PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL
  | typeof PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL
  | typeof PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL
  | typeof PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL
  | typeof PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL
  | typeof PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL
  | typeof PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL
  | typeof PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL
  | typeof PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL
  | typeof PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL
  | typeof PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL
  | typeof PUBLISHING_FORM_RESPONSE_LIST_CHANNEL
  | typeof PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL;

export type PublishingBridgePayload =
  | CreatePublishingPartnerCommand
  | ListPublishingPartnersCommand
  | UpdatePublishingPartnerCommand
  | CreatePublishingFormTemplateCommand
  | ListPublishingFormTemplatesCommand
  | UpdatePublishingFormTemplateCommand
  | ListPublishingFormResponsesCommand
  | SavePublishingFormResponseCommand;

export type PublishingBridge = Readonly<{
  publishingPartners: {
    create: (
      command: CreatePublishingPartnerCommand,
    ) => Promise<PublishingPartnerProjection>;
    list: (
      command: ListPublishingPartnersCommand,
    ) => Promise<PublishingPartnerListProjection>;
    update: (
      command: UpdatePublishingPartnerCommand,
    ) => Promise<PublishingPartnerProjection>;
  };
  publishingSubmissions: {
    create: (
      command: CreatePublishingSubmissionCommand,
    ) => Promise<PublishingSubmissionProjection>;
    list: (
      command: ListPublishingSubmissionsCommand,
    ) => Promise<PublishingSubmissionListProjection>;
    update: (
      command: UpdatePublishingSubmissionCommand,
    ) => Promise<PublishingSubmissionProjection>;
  };
  publishingFormTemplates: {
    create: (
      command: CreatePublishingFormTemplateCommand,
    ) => Promise<PublishingFormTemplateProjection>;
    list: (
      command: ListPublishingFormTemplatesCommand,
    ) => Promise<PublishingFormTemplateListProjection>;
    update: (
      command: UpdatePublishingFormTemplateCommand,
    ) => Promise<PublishingFormTemplateProjection>;
  };
  publishingFormResponses: {
    list: (
      command: ListPublishingFormResponsesCommand,
    ) => Promise<PublishingFormResponseListProjection>;
    save: (
      command: SavePublishingFormResponseCommand,
    ) => Promise<PublishingFormResponseProjection>;
  };
  publishingContracts: {
    create: (
      command: CreatePublishingContractCommand,
    ) => Promise<PublishingContractProjection>;
    list: (
      command: ListPublishingContractsCommand,
    ) => Promise<PublishingContractListProjection>;
    update: (
      command: UpdatePublishingContractCommand,
    ) => Promise<PublishingContractProjection>;
  };
  publishingPublications: {
    create: (
      command: CreatePublishingPublicationCommand,
    ) => Promise<PublishingPublicationProjection>;
    list: (
      command: ListPublishingPublicationsCommand,
    ) => Promise<PublishingPublicationListProjection>;
    update: (
      command: UpdatePublishingPublicationCommand,
    ) => Promise<PublishingPublicationProjection>;
  };
  publishingSettlements: {
    create: (
      command: CreatePublishingSettlementCommand,
    ) => Promise<PublishingSettlementProjection>;
    list: (
      command: ListPublishingSettlementsCommand,
    ) => Promise<PublishingSettlementListProjection>;
    update: (
      command: UpdatePublishingSettlementCommand,
    ) => Promise<PublishingSettlementProjection>;
  };
  publishingPayments: {
    create: (
      command: CreatePublishingPaymentCommand,
    ) => Promise<PublishingPaymentProjection>;
    list: (
      command: ListPublishingPaymentsCommand,
    ) => Promise<PublishingPaymentListProjection>;
    update: (
      command: UpdatePublishingPaymentCommand,
    ) => Promise<PublishingPaymentProjection>;
  };
  publishingSources: {
    create: (
      command: CreatePublishingSourceCommand,
    ) => Promise<PublishingSourceProjection>;
    list: (
      command: ListPublishingSourcesCommand,
    ) => Promise<PublishingSourceListProjection>;
  };
  publishingResearch: {
    preview: (
      command: PreviewPublishingResearchCommand,
    ) => Promise<PublishingResearchCandidateProjection>;
    approve: (
      command: ApprovePublishingResearchCommand,
    ) => Promise<PublishingResearchApprovalResult>;
  };
  publishingAssistant: {
    run: (
      command: RunPublishingAssistantCommand,
    ) => Promise<PublishingAssistantResult>;
    approve: (
      command: ApprovePublishingAssistantCandidateCommand,
    ) => Promise<PublishingAssistantApprovalResult>;
  };
  publishingEvidence: {
    setLinks: (
      command: SetPublishingEvidenceLinksCommand,
    ) => Promise<PublishingEvidenceLinksProjection>;
  };
  publishingImports: {
    selectPartnerCsv: (
      command: SelectPublishingPartnerCsvCommand,
    ) => Promise<PublishingPartnerCsvSelectionProjection>;
    applyPartnerCsv: (
      command: ApplyPublishingPartnerCsvImportCommand,
    ) => Promise<PublishingPartnerCsvImportResult>;
    selectSubmissionCsv: (
      command: SelectPublishingSubmissionCsvCommand,
    ) => Promise<PublishingSubmissionCsvSelectionProjection>;
    applySubmissionCsv: (
      command: ApplyPublishingSubmissionCsvImportCommand,
    ) => Promise<PublishingSubmissionCsvImportResult>;
  };
  publishingMailCandidates: {
    list: (
      command: ListPublishingMailCandidatesCommand,
    ) => Promise<PublishingMailCandidateListProjection>;
    link: (
      command: LinkPublishingMailCandidateCommand,
    ) => Promise<PublishingMailCandidateProjection>;
    update: (
      command: UpdatePublishingMailCandidateCommand,
    ) => Promise<PublishingMailCandidateProjection>;
    review: (
      command: ReviewPublishingMailCandidateCommand,
    ) => Promise<PublishingMailCandidateReviewResult>;
  };
  publishingMailConnection: {
    status: (
      command: GetPublishingMailConnectionCommand,
    ) => Promise<PublishingMailConnectionProjection>;
    connect: (
      command: ConnectPublishingMailCommand,
    ) => Promise<PublishingMailConnectionProjection>;
    sync: (
      command: SyncPublishingMailCommand,
    ) => Promise<PublishingMailSyncResult>;
    disconnect: (
      command: DisconnectPublishingMailCommand,
    ) => Promise<PublishingMailConnectionProjection>;
  };
  publishingMailSchedule: {
    status: (
      command: GetPublishingMailScheduleCommand,
    ) => Promise<PublishingMailScheduleProjection>;
    save: (
      command: SavePublishingMailScheduleCommand,
    ) => Promise<PublishingMailScheduleProjection>;
  };
 }>;

export type PublishingBridgeInvoke = (
  channel: PublishingBridgeChannel,
  payload?: PublishingBridgePayload,
) => Promise<unknown>;

export function createPublishingBridge(
  invoke: PublishingBridgeInvoke,
): PublishingBridge {
  return Object.freeze({
    publishingPartners: {
      create: async (input) => {
        const command = parseCreatePublishingPartnerCommand(input);
        const value = await invoke(PUBLISHING_PARTNER_CREATE_CHANNEL, command);
        try {
          return parsePublishingPartnerProjection(value);
        } catch {
          throw new Error("Invalid publishing partner creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingPartnersCommand(input);
        const value = await invoke(PUBLISHING_PARTNER_LIST_CHANNEL, command);
        try {
          return parsePublishingPartnerListProjection(value);
        } catch {
          throw new Error("Invalid publishing partner list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingPartnerCommand(input);
        const value = await invoke(PUBLISHING_PARTNER_UPDATE_CHANNEL, command);
        try {
          return parsePublishingPartnerProjection(value);
        } catch {
          throw new Error("Invalid publishing partner update result");
        }
      },
    },
    publishingSubmissions: {
      create: async (input) => {
        const command = parseCreatePublishingSubmissionCommand(input);
        const value = await invoke(PUBLISHING_SUBMISSION_CREATE_CHANNEL, command);
        try {
          return parsePublishingSubmissionProjection(value);
        } catch {
          throw new Error("Invalid publishing submission creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingSubmissionsCommand(input);
        const value = await invoke(PUBLISHING_SUBMISSION_LIST_CHANNEL, command);
        try {
          return parsePublishingSubmissionListProjection(value);
        } catch {
          throw new Error("Invalid publishing submission list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingSubmissionCommand(input);
        const value = await invoke(PUBLISHING_SUBMISSION_UPDATE_CHANNEL, command);
        try {
          return parsePublishingSubmissionProjection(value);
        } catch {
          throw new Error("Invalid publishing submission update result");
        }
      },
    },
    publishingFormTemplates: {
      create: async (input) => {
        const command = parseCreatePublishingFormTemplateCommand(input);
        const value = await invoke(
          PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL,
          command,
        );
        try {
          return parsePublishingFormTemplateProjection(value);
        } catch {
          throw new Error("Invalid publishing form template creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingFormTemplatesCommand(input);
        const value = await invoke(
          PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL,
          command,
        );
        try {
          return parsePublishingFormTemplateListProjection(value);
        } catch {
          throw new Error("Invalid publishing form template list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingFormTemplateCommand(input);
        const value = await invoke(
          PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL,
          command,
        );
        try {
          return parsePublishingFormTemplateProjection(value);
        } catch {
          throw new Error("Invalid publishing form template update result");
        }
      },
    },
    publishingFormResponses: {
      list: async (input) => {
        const command = parseListPublishingFormResponsesCommand(input);
        const value = await invoke(
          PUBLISHING_FORM_RESPONSE_LIST_CHANNEL,
          command,
        );
        try {
          return parsePublishingFormResponseListProjection(value);
        } catch {
          throw new Error("Invalid publishing form response list");
        }
      },
      save: async (input) => {
        const command = parseSavePublishingFormResponseCommand(input);
        const value = await invoke(
          PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL,
          command,
        );
        try {
          return parsePublishingFormResponseProjection(value);
        } catch {
          throw new Error("Invalid publishing form response save result");
        }
      },
    },
    publishingContracts: {
      create: async (input) => {
        const command = parseCreatePublishingContractCommand(input);
        const value = await invoke(PUBLISHING_CONTRACT_CREATE_CHANNEL, command);
        try {
          return parsePublishingContractProjection(value);
        } catch {
          throw new Error("Invalid publishing contract creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingContractsCommand(input);
        const value = await invoke(PUBLISHING_CONTRACT_LIST_CHANNEL, command);
        try {
          return parsePublishingContractListProjection(value);
        } catch {
          throw new Error("Invalid publishing contract list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingContractCommand(input);
        const value = await invoke(PUBLISHING_CONTRACT_UPDATE_CHANNEL, command);
        try {
          return parsePublishingContractProjection(value);
        } catch {
          throw new Error("Invalid publishing contract update result");
        }
      },
    },
    publishingPublications: {
      create: async (input) => {
        const command = parseCreatePublishingPublicationCommand(input);
        const value = await invoke(PUBLISHING_PUBLICATION_CREATE_CHANNEL, command);
        try {
          return parsePublishingPublicationProjection(value);
        } catch {
          throw new Error("Invalid publishing publication creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingPublicationsCommand(input);
        const value = await invoke(PUBLISHING_PUBLICATION_LIST_CHANNEL, command);
        try {
          return parsePublishingPublicationListProjection(value);
        } catch {
          throw new Error("Invalid publishing publication list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingPublicationCommand(input);
        const value = await invoke(PUBLISHING_PUBLICATION_UPDATE_CHANNEL, command);
        try {
          return parsePublishingPublicationProjection(value);
        } catch {
          throw new Error("Invalid publishing publication update result");
        }
      },
    },
    publishingSettlements: {
      create: async (input) => {
        const command = parseCreatePublishingSettlementCommand(input);
        const value = await invoke(PUBLISHING_SETTLEMENT_CREATE_CHANNEL, command);
        try {
          return parsePublishingSettlementProjection(value);
        } catch {
          throw new Error("Invalid publishing settlement creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingSettlementsCommand(input);
        const value = await invoke(PUBLISHING_SETTLEMENT_LIST_CHANNEL, command);
        try {
          return parsePublishingSettlementListProjection(value);
        } catch {
          throw new Error("Invalid publishing settlement list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingSettlementCommand(input);
        const value = await invoke(PUBLISHING_SETTLEMENT_UPDATE_CHANNEL, command);
        try {
          return parsePublishingSettlementProjection(value);
        } catch {
          throw new Error("Invalid publishing settlement update result");
        }
      },
    },
    publishingPayments: {
      create: async (input) => {
        const command = parseCreatePublishingPaymentCommand(input);
        const value = await invoke(PUBLISHING_PAYMENT_CREATE_CHANNEL, command);
        try {
          return parsePublishingPaymentProjection(value);
        } catch {
          throw new Error("Invalid publishing payment creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingPaymentsCommand(input);
        const value = await invoke(PUBLISHING_PAYMENT_LIST_CHANNEL, command);
        try {
          return parsePublishingPaymentListProjection(value);
        } catch {
          throw new Error("Invalid publishing payment list");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingPaymentCommand(input);
        const value = await invoke(PUBLISHING_PAYMENT_UPDATE_CHANNEL, command);
        try {
          return parsePublishingPaymentProjection(value);
        } catch {
          throw new Error("Invalid publishing payment update result");
        }
      },
    },
    publishingSources: {
      create: async (input) => {
        const command = parseCreatePublishingSourceCommand(input);
        const value = await invoke(PUBLISHING_SOURCE_CREATE_CHANNEL, command);
        try {
          return parsePublishingSourceProjection(value);
        } catch {
          throw new Error("Invalid publishing source creation result");
        }
      },
      list: async (input) => {
        const command = parseListPublishingSourcesCommand(input);
        const value = await invoke(PUBLISHING_SOURCE_LIST_CHANNEL, command);
        try {
          return parsePublishingSourceListProjection(value);
        } catch {
          throw new Error("Invalid publishing source list");
        }
      },
    },
    publishingResearch: {
      preview: async (input) => {
        const command = parsePreviewPublishingResearchCommand(input);
        const value = await invoke(PUBLISHING_RESEARCH_PREVIEW_CHANNEL, command);
        try {
          return parsePublishingResearchCandidateProjection(value);
        } catch {
          throw new Error("Invalid publishing research preview");
        }
      },
      approve: async (input) => {
        const command = parseApprovePublishingResearchCommand(input);
        const value = await invoke(PUBLISHING_RESEARCH_APPROVE_CHANNEL, command);
        try {
          return parsePublishingResearchApprovalResult(value);
        } catch {
          throw new Error("Invalid publishing research approval result");
        }
      },
    },
    publishingAssistant: {
      run: async (input) => {
        const command = parseRunPublishingAssistantCommand(input);
        const value = await invoke(PUBLISHING_ASSISTANT_RUN_CHANNEL, command);
        try {
          return parsePublishingAssistantResult(value);
        } catch {
          throw new Error("Invalid publishing assistant result");
        }
      },
      approve: async (input) => {
        const command = parseApprovePublishingAssistantCandidateCommand(input);
        const value = await invoke(PUBLISHING_ASSISTANT_APPROVE_CHANNEL, command);
        try {
          return parsePublishingAssistantApprovalResult(value);
        } catch {
          throw new Error("Invalid publishing assistant approval result");
        }
      },
    },
    publishingEvidence: {
      setLinks: async (input) => {
        const command = parseSetPublishingEvidenceLinksCommand(input);
        const value = await invoke(PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL, command);
        try {
          return parsePublishingEvidenceLinksProjection(value);
        } catch {
          throw new Error("Invalid publishing evidence link result");
        }
      },
    },
    publishingImports: {
      selectPartnerCsv: async (input) => {
        const command = parseSelectPublishingPartnerCsvCommand(input);
        const value = await invoke(PUBLISHING_PARTNER_CSV_SELECT_CHANNEL, command);
        try {
          return parsePublishingPartnerCsvSelectionProjection(value);
        } catch {
          throw new Error("Invalid publishing partner CSV selection result");
        }
      },
      applyPartnerCsv: async (input) => {
        const command = parseApplyPublishingPartnerCsvImportCommand(input);
        const value = await invoke(PUBLISHING_PARTNER_CSV_APPLY_CHANNEL, command);
        try {
          return parsePublishingPartnerCsvImportResult(value);
        } catch {
          throw new Error("Invalid publishing partner CSV import result");
        }
      },
      selectSubmissionCsv: async (input) => {
        const command = parseSelectPublishingSubmissionCsvCommand(input);
        const value = await invoke(PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL, command);
        try {
          return parsePublishingSubmissionCsvSelectionProjection(value);
        } catch {
          throw new Error("Invalid publishing submission CSV selection result");
        }
      },
      applySubmissionCsv: async (input) => {
        const command = parseApplyPublishingSubmissionCsvImportCommand(input);
        const value = await invoke(PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL, command);
        try {
          return parsePublishingSubmissionCsvImportResult(value);
        } catch {
          throw new Error("Invalid publishing submission CSV import result");
        }
      },
    },
    publishingMailCandidates: {
      list: async (input) => {
        const command = parseListPublishingMailCandidatesCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL, command);
        try {
          return parsePublishingMailCandidateListProjection(value);
        } catch {
          throw new Error("Invalid publishing mail candidate list");
        }
      },
      link: async (input) => {
        const command = parseLinkPublishingMailCandidateCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL, command);
        try {
          return parsePublishingMailCandidateProjection(value);
        } catch {
          throw new Error("Invalid publishing mail candidate link result");
        }
      },
      update: async (input) => {
        const command = parseUpdatePublishingMailCandidateCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL, command);
        try {
          return parsePublishingMailCandidateProjection(value);
        } catch {
          throw new Error("Invalid publishing mail candidate update result");
        }
      },
      review: async (input) => {
        const command = parseReviewPublishingMailCandidateCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL, command);
        try {
          return parsePublishingMailCandidateReviewResult(value);
        } catch {
          throw new Error("Invalid publishing mail candidate review result");
        }
      },
    },
    publishingMailConnection: {
      status: async (input) => {
        const command = parseGetPublishingMailConnectionCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL, command);
        try {
          return parsePublishingMailConnectionProjection(value);
        } catch {
          throw new Error("Invalid publishing mail connection status");
        }
      },
      connect: async (input) => {
        const command = parseConnectPublishingMailCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL, command);
        try {
          return parsePublishingMailConnectionProjection(value);
        } catch {
          throw new Error("Invalid publishing mail connection result");
        }
      },
      sync: async (input) => {
        const command = parseSyncPublishingMailCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL, command);
        try {
          return parsePublishingMailSyncResult(value);
        } catch {
          throw new Error("Invalid publishing mail sync result");
        }
      },
      disconnect: async (input) => {
        const command = parseDisconnectPublishingMailCommand(input);
        const value = await invoke(PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL, command);
        try {
          return parsePublishingMailConnectionProjection(value);
        } catch {
          throw new Error("Invalid publishing mail disconnection result");
        }
      },
    },
    publishingMailSchedule: {
      status: async (input) => {
        const command = parseGetPublishingMailScheduleCommand(input);
        const value = await invoke(PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL, command);
        try {
          return parsePublishingMailScheduleProjection(value);
        } catch {
          throw new Error("Invalid publishing mail schedule status");
        }
      },
      save: async (input) => {
        const command = parseSavePublishingMailScheduleCommand(input);
        const value = await invoke(PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL, command);
        try {
          return parsePublishingMailScheduleProjection(value);
        } catch {
          throw new Error("Invalid publishing mail schedule save result");
        }
      },
    },
  });
}
