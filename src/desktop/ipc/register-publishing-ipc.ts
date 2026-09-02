import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  PUBLISHING_ASSISTANT_APPROVE_CHANNEL,
  PUBLISHING_ASSISTANT_RUN_CHANNEL,
  PUBLISHING_CONTRACT_CREATE_CHANNEL,
  PUBLISHING_CONTRACT_LIST_CHANNEL,
  PUBLISHING_CONTRACT_UPDATE_CHANNEL,
  PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL,
  PUBLISHING_FORM_RESPONSE_LIST_CHANNEL,
  PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL,
  PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL,
  PUBLISHING_PARTNER_CREATE_CHANNEL,
  PUBLISHING_PARTNER_CSV_APPLY_CHANNEL,
  PUBLISHING_PARTNER_CSV_SELECT_CHANNEL,
  PUBLISHING_PARTNER_LIST_CHANNEL,
  PUBLISHING_PARTNER_UPDATE_CHANNEL,
  PUBLISHING_PAYMENT_CREATE_CHANNEL,
  PUBLISHING_PAYMENT_LIST_CHANNEL,
  PUBLISHING_PAYMENT_UPDATE_CHANNEL,
  PUBLISHING_PUBLICATION_CREATE_CHANNEL,
  PUBLISHING_PUBLICATION_LIST_CHANNEL,
  PUBLISHING_PUBLICATION_UPDATE_CHANNEL,
  PUBLISHING_RESEARCH_APPROVE_CHANNEL,
  PUBLISHING_RESEARCH_PREVIEW_CHANNEL,
  PUBLISHING_SETTLEMENT_CREATE_CHANNEL,
  PUBLISHING_SETTLEMENT_LIST_CHANNEL,
  PUBLISHING_SETTLEMENT_UPDATE_CHANNEL,
  PUBLISHING_SOURCE_CREATE_CHANNEL,
  PUBLISHING_SOURCE_LIST_CHANNEL,
  PUBLISHING_SUBMISSION_CREATE_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL,
  PUBLISHING_SUBMISSION_LIST_CHANNEL,
  PUBLISHING_SUBMISSION_UPDATE_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseCreatePublishingPartnerCommand,
  parseListPublishingPartnersCommand,
  parseUpdatePublishingPartnerCommand,
} from "../../application/publishing/publishing-partner-contract";
import {
  parseCreatePublishingSubmissionCommand,
  parseListPublishingSubmissionsCommand,
  parseUpdatePublishingSubmissionCommand,
} from "../../application/publishing/publishing-submission-contract";
import {
  parseCreatePublishingContractCommand,
  parseListPublishingContractsCommand,
  parseUpdatePublishingContractCommand,
} from "../../application/publishing/publishing-contract-contract";
import {
  parseCreatePublishingPublicationCommand,
  parseListPublishingPublicationsCommand,
  parseUpdatePublishingPublicationCommand,
} from "../../application/publishing/publishing-publication-contract";
import {
  parseCreatePublishingSettlementCommand,
  parseListPublishingSettlementsCommand,
  parseUpdatePublishingSettlementCommand,
} from "../../application/publishing/publishing-settlement-contract";
import {
  parseCreatePublishingPaymentCommand,
  parseListPublishingPaymentsCommand,
  parseUpdatePublishingPaymentCommand,
} from "../../application/publishing/publishing-payment-contract";
import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
} from "../../application/publishing/publishing-source-contract";
import {
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  parsePublishingResearchApprovalResult,
  parsePublishingResearchCandidateProjection,
} from "../../application/publishing/publishing-research-contract";
import {
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantApprovalResult,
  parsePublishingAssistantResult,
  parseRunPublishingAssistantCommand,
} from "../../application/publishing/publishing-assistant-contract";
import { parseSetPublishingEvidenceLinksCommand } from "../../application/publishing/publishing-evidence-link-contract";
import {
  parseApplyPublishingPartnerCsvImportCommand,
  parseSelectPublishingPartnerCsvCommand,
} from "../../application/publishing/publishing-partner-csv-import";
import {
  parseApplyPublishingSubmissionCsvImportCommand,
  parseSelectPublishingSubmissionCsvCommand,
} from "../../application/publishing/publishing-submission-csv-import";
import {
  parseLinkPublishingMailCandidateCommand,
  parseListPublishingMailCandidatesCommand,
  parseReviewPublishingMailCandidateCommand,
  parseUpdatePublishingMailCandidateCommand,
} from "../../application/publishing/publishing-mail-candidate-contract";
import {
  parseConnectPublishingMailCommand,
  parseDisconnectPublishingMailCommand,
  parseGetPublishingMailConnectionCommand,
  parseSyncPublishingMailCommand,
} from "../../application/publishing/publishing-mail-connection-contract";
import {
  parseGetPublishingMailScheduleCommand,
  parseSavePublishingMailScheduleCommand,
} from "../../application/publishing/publishing-mail-schedule-contract";
import {
  parseCreatePublishingFormTemplateCommand,
  parseListPublishingFormResponsesCommand,
  parseListPublishingFormTemplatesCommand,
  parseSavePublishingFormResponseCommand,
  parseUpdatePublishingFormTemplateCommand,
} from "../../application/publishing/publishing-form-contract";

export type PublishingRuntimeMethod =
  | "createPublishingPartner"
  | "listPublishingPartners"
  | "updatePublishingPartner"
  | "createPublishingSubmission"
  | "listPublishingSubmissions"
  | "updatePublishingSubmission"
  | "createPublishingContract"
  | "listPublishingContracts"
  | "updatePublishingContract"
  | "createPublishingPublication"
  | "listPublishingPublications"
  | "updatePublishingPublication"
  | "createPublishingSettlement"
  | "listPublishingSettlements"
  | "updatePublishingSettlement"
  | "createPublishingPayment"
  | "listPublishingPayments"
  | "updatePublishingPayment"
  | "createPublishingSource"
  | "listPublishingSources"
  | "previewPublishingResearch"
  | "approvePublishingResearch"
  | "runPublishingAssistant"
  | "approvePublishingAssistantCandidate"
  | "setPublishingEvidenceLinks"
  | "applyPublishingPartnerCsvImport"
  | "applyPublishingSubmissionCsvImport"
  | "listPublishingMailCandidates"
  | "linkPublishingMailCandidate"
  | "updatePublishingMailCandidate"
  | "reviewPublishingMailCandidate"
  | "getPublishingMailConnection"
  | "connectPublishingMail"
  | "syncPublishingMail"
  | "disconnectPublishingMail"
  | "getPublishingMailSchedule"
  | "savePublishingMailSchedule"
  | "createPublishingFormTemplate"
  | "listPublishingFormTemplates"
  | "updatePublishingFormTemplate"
  | "listPublishingFormResponses"
  | "savePublishingFormResponse";

type PublishingRuntimeHandler = (command: unknown) => unknown;

export type PublishingIpcRuntime = Readonly<
  Record<PublishingRuntimeMethod, PublishingRuntimeHandler>
>;

type CommandParser = (value: unknown) => unknown;

export function registerPublishingIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: PublishingIpcRuntime;
  selectPartnerCsv: (
    command: ReturnType<typeof parseSelectPublishingPartnerCsvCommand>,
  ) => Promise<unknown>;
  selectSubmissionCsv: (
    command: ReturnType<typeof parseSelectPublishingSubmissionCsvCommand>,
  ) => Promise<unknown>;
}>): void {
  const handle = (
    channel: string,
    parse: CommandParser,
    method: PublishingRuntimeMethod,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime[method](parse(value));
    });
  };
  const handleParsedResult = (
    channel: string,
    parse: CommandParser,
    method: PublishingRuntimeMethod,
    parseResult: (value: unknown) => unknown,
  ): void => {
    input.ipcMain.handle(channel, (event, value: unknown) => {
      input.authorizeSender(event);
      return Promise.resolve(input.runtime[method](parse(value))).then(
        parseResult,
      );
    });
  };

  handle(PUBLISHING_PARTNER_CREATE_CHANNEL, parseCreatePublishingPartnerCommand,
    "createPublishingPartner");
  handle(PUBLISHING_PARTNER_LIST_CHANNEL, parseListPublishingPartnersCommand,
    "listPublishingPartners");
  handle(PUBLISHING_PARTNER_UPDATE_CHANNEL, parseUpdatePublishingPartnerCommand,
    "updatePublishingPartner");
  handle(PUBLISHING_SUBMISSION_CREATE_CHANNEL,
    parseCreatePublishingSubmissionCommand, "createPublishingSubmission");
  handle(PUBLISHING_SUBMISSION_LIST_CHANNEL,
    parseListPublishingSubmissionsCommand, "listPublishingSubmissions");
  handle(PUBLISHING_SUBMISSION_UPDATE_CHANNEL,
    parseUpdatePublishingSubmissionCommand, "updatePublishingSubmission");
  handle(PUBLISHING_FORM_TEMPLATE_CREATE_CHANNEL,
    parseCreatePublishingFormTemplateCommand, "createPublishingFormTemplate");
  handle(PUBLISHING_FORM_TEMPLATE_LIST_CHANNEL,
    parseListPublishingFormTemplatesCommand, "listPublishingFormTemplates");
  handle(PUBLISHING_FORM_TEMPLATE_UPDATE_CHANNEL,
    parseUpdatePublishingFormTemplateCommand, "updatePublishingFormTemplate");
  handle(PUBLISHING_FORM_RESPONSE_LIST_CHANNEL,
    parseListPublishingFormResponsesCommand, "listPublishingFormResponses");
  handle(PUBLISHING_FORM_RESPONSE_SAVE_CHANNEL,
    parseSavePublishingFormResponseCommand, "savePublishingFormResponse");
  handle(PUBLISHING_CONTRACT_CREATE_CHANNEL, parseCreatePublishingContractCommand,
    "createPublishingContract");
  handle(PUBLISHING_CONTRACT_LIST_CHANNEL, parseListPublishingContractsCommand,
    "listPublishingContracts");
  handle(PUBLISHING_CONTRACT_UPDATE_CHANNEL, parseUpdatePublishingContractCommand,
    "updatePublishingContract");
  handle(PUBLISHING_PUBLICATION_CREATE_CHANNEL,
    parseCreatePublishingPublicationCommand, "createPublishingPublication");
  handle(PUBLISHING_PUBLICATION_LIST_CHANNEL,
    parseListPublishingPublicationsCommand, "listPublishingPublications");
  handle(PUBLISHING_PUBLICATION_UPDATE_CHANNEL,
    parseUpdatePublishingPublicationCommand, "updatePublishingPublication");
  handle(PUBLISHING_SETTLEMENT_CREATE_CHANNEL,
    parseCreatePublishingSettlementCommand, "createPublishingSettlement");
  handle(PUBLISHING_SETTLEMENT_LIST_CHANNEL,
    parseListPublishingSettlementsCommand, "listPublishingSettlements");
  handle(PUBLISHING_SETTLEMENT_UPDATE_CHANNEL,
    parseUpdatePublishingSettlementCommand, "updatePublishingSettlement");
  handle(PUBLISHING_PAYMENT_CREATE_CHANNEL, parseCreatePublishingPaymentCommand,
    "createPublishingPayment");
  handle(PUBLISHING_PAYMENT_LIST_CHANNEL, parseListPublishingPaymentsCommand,
    "listPublishingPayments");
  handle(PUBLISHING_PAYMENT_UPDATE_CHANNEL, parseUpdatePublishingPaymentCommand,
    "updatePublishingPayment");
  handle(PUBLISHING_SOURCE_CREATE_CHANNEL, parseCreatePublishingSourceCommand,
    "createPublishingSource");
  handle(PUBLISHING_SOURCE_LIST_CHANNEL, parseListPublishingSourcesCommand,
    "listPublishingSources");
  handleParsedResult(PUBLISHING_RESEARCH_PREVIEW_CHANNEL,
    parsePreviewPublishingResearchCommand, "previewPublishingResearch",
    parsePublishingResearchCandidateProjection);
  handleParsedResult(PUBLISHING_RESEARCH_APPROVE_CHANNEL,
    parseApprovePublishingResearchCommand, "approvePublishingResearch",
    parsePublishingResearchApprovalResult);
  handleParsedResult(PUBLISHING_ASSISTANT_RUN_CHANNEL,
    parseRunPublishingAssistantCommand, "runPublishingAssistant",
    parsePublishingAssistantResult);
  handleParsedResult(PUBLISHING_ASSISTANT_APPROVE_CHANNEL,
    parseApprovePublishingAssistantCandidateCommand,
    "approvePublishingAssistantCandidate", parsePublishingAssistantApprovalResult);
  handle(PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL,
    parseSetPublishingEvidenceLinksCommand, "setPublishingEvidenceLinks");
  input.ipcMain.handle(PUBLISHING_PARTNER_CSV_SELECT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.selectPartnerCsv(parseSelectPublishingPartnerCsvCommand(value));
    });
  handle(PUBLISHING_PARTNER_CSV_APPLY_CHANNEL,
    parseApplyPublishingPartnerCsvImportCommand,
    "applyPublishingPartnerCsvImport");
  input.ipcMain.handle(PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.selectSubmissionCsv(
        parseSelectPublishingSubmissionCsvCommand(value),
      );
    });
  handle(PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL,
    parseApplyPublishingSubmissionCsvImportCommand,
    "applyPublishingSubmissionCsvImport");
  handle(PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL,
    parseListPublishingMailCandidatesCommand, "listPublishingMailCandidates");
  handle(PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL,
    parseLinkPublishingMailCandidateCommand, "linkPublishingMailCandidate");
  handle(PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL,
    parseUpdatePublishingMailCandidateCommand, "updatePublishingMailCandidate");
  handle(PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL,
    parseReviewPublishingMailCandidateCommand, "reviewPublishingMailCandidate");
  handle(PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL,
    parseGetPublishingMailConnectionCommand, "getPublishingMailConnection");
  handle(PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL,
    parseConnectPublishingMailCommand, "connectPublishingMail");
  handle(PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL,
    parseSyncPublishingMailCommand, "syncPublishingMail");
  handle(PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL,
    parseDisconnectPublishingMailCommand, "disconnectPublishingMail");
  handle(PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL,
    parseGetPublishingMailScheduleCommand, "getPublishingMailSchedule");
  handle(PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL,
    parseSavePublishingMailScheduleCommand, "savePublishingMailSchedule");
}
