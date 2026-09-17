import { createHash,randomUUID } from "node:crypto";
import type { AssistantConnectorExecutionReceipt } from "../../../application/assistant/assistant-connector-manifest";
import type { ApprovePublishingAssistantCandidateCommand,PublishingAssistantApprovalResult,PublishingAssistantRecordCandidate,PublishingAssistantResult,RunPublishingAssistantCommand } from "../../../application/publishing/publishing-assistant-contract";
import { buildPublishingAssistantRegistry,parseApprovePublishingAssistantCandidateCommand,parsePublishingAssistantApprovalResult,parsePublishingAssistantIntentPayload,parsePublishingAssistantResult,parseRunPublishingAssistantCommand,resolvePublishingAssistantIntent } from "../../../application/publishing/publishing-assistant-contract";
import type { CreatePublishingContractCommand,ListPublishingContractsCommand,PublishingContractListProjection,PublishingContractProjection,UpdatePublishingContractCommand } from "../../../application/publishing/publishing-contract-contract";
import { parseCreatePublishingContractCommand,parseListPublishingContractsCommand,parsePublishingContractListProjection,parseUpdatePublishingContractCommand } from "../../../application/publishing/publishing-contract-contract";
import type { PublishingEvidenceLinksProjection,SetPublishingEvidenceLinksCommand } from "../../../application/publishing/publishing-evidence-link-contract";
import { parsePublishingEvidenceLinksProjection,parseSetPublishingEvidenceLinksCommand } from "../../../application/publishing/publishing-evidence-link-contract";
import type { CreatePublishingFormTemplateCommand,ListPublishingFormResponsesCommand,PublishingFormResponseListProjection,PublishingFormResponseProjection,PublishingFormTemplateListProjection,PublishingFormTemplateProjection,SavePublishingFormResponseCommand,UpdatePublishingFormTemplateCommand } from "../../../application/publishing/publishing-form-contract";
import { parseCreatePublishingFormTemplateCommand,parseListPublishingFormResponsesCommand,parseListPublishingFormTemplatesCommand,parsePublishingFormResponseListProjection,parsePublishingFormTemplateListProjection,parseSavePublishingFormResponseCommand,parseUpdatePublishingFormTemplateCommand } from "../../../application/publishing/publishing-form-contract";
import type { LinkPublishingMailCandidateCommand,PublishingMailCandidateListProjection,PublishingMailCandidateProjection,PublishingMailCandidateReviewResult,RecordPublishingMailCandidateCommand,ReviewPublishingMailCandidateCommand,UpdatePublishingMailCandidateCommand } from "../../../application/publishing/publishing-mail-candidate-contract";
import { parseLinkPublishingMailCandidateCommand,parseListPublishingMailCandidatesCommand,parsePublishingMailCandidateListProjection,parsePublishingMailCandidateReviewResult,parseRecordPublishingMailCandidateCommand,parseReviewPublishingMailCandidateCommand,parseUpdatePublishingMailCandidateCommand } from "../../../application/publishing/publishing-mail-candidate-contract";
import type { CreatePublishingPartnerCommand,PublishingPartnerListProjection,PublishingPartnerProjection,UpdatePublishingPartnerCommand } from "../../../application/publishing/publishing-partner-contract";
import { parseCreatePublishingPartnerCommand,parseListPublishingPartnersCommand,parsePublishingPartnerListProjection,parseUpdatePublishingPartnerCommand } from "../../../application/publishing/publishing-partner-contract";
import type { ApplyPublishingPartnerCsvImportCommand,PublishingPartnerCsvImportResult } from "../../../application/publishing/publishing-partner-csv-import";
import { buildPublishingPartnerCsvImportPreview,parseApplyPublishingPartnerCsvImportCommand,parsePublishingPartnerCsvImportResult } from "../../../application/publishing/publishing-partner-csv-import";
import type { CreatePublishingPaymentCommand,ListPublishingPaymentsCommand,PublishingPaymentListProjection,PublishingPaymentProjection,UpdatePublishingPaymentCommand } from "../../../application/publishing/publishing-payment-contract";
import { parseCreatePublishingPaymentCommand,parseListPublishingPaymentsCommand,parsePublishingPaymentListProjection,parseUpdatePublishingPaymentCommand } from "../../../application/publishing/publishing-payment-contract";
import type { CreatePublishingPublicationCommand,ListPublishingPublicationsCommand,PublishingPublicationListProjection,PublishingPublicationProjection,UpdatePublishingPublicationCommand } from "../../../application/publishing/publishing-publication-contract";
import { parseCreatePublishingPublicationCommand,parseListPublishingPublicationsCommand,parsePublishingPublicationListProjection,parseUpdatePublishingPublicationCommand } from "../../../application/publishing/publishing-publication-contract";
import type { ApprovePublishingResearchCommand,PreviewPublishingResearchCommand,PublishingResearchApprovalResult,PublishingResearchCandidateProjection } from "../../../application/publishing/publishing-research-contract";
import { buildPublishingResearchCandidate,parseApprovePublishingResearchCommand,parsePreviewPublishingResearchCommand,parsePublishingResearchApprovalResult } from "../../../application/publishing/publishing-research-contract";
import type { CreatePublishingSettlementCommand,ListPublishingSettlementsCommand,PublishingSettlementListProjection,PublishingSettlementProjection,UpdatePublishingSettlementCommand } from "../../../application/publishing/publishing-settlement-contract";
import { parseCreatePublishingSettlementCommand,parseListPublishingSettlementsCommand,parsePublishingSettlementListProjection,parseUpdatePublishingSettlementCommand } from "../../../application/publishing/publishing-settlement-contract";
import type { CreatePublishingSourceCommand,PublishingSourceListProjection,PublishingSourceProjection } from "../../../application/publishing/publishing-source-contract";
import { parseCreatePublishingSourceCommand,parseListPublishingSourcesCommand,parsePublishingSourceListProjection } from "../../../application/publishing/publishing-source-contract";
import type { CreatePublishingSubmissionCommand,ListPublishingSubmissionsCommand,PublishingSubmissionListProjection,PublishingSubmissionProjection,UpdatePublishingSubmissionCommand } from "../../../application/publishing/publishing-submission-contract";
import { parseCreatePublishingSubmissionCommand,parseListPublishingSubmissionsCommand,parsePublishingSubmissionListProjection,parseUpdatePublishingSubmissionCommand } from "../../../application/publishing/publishing-submission-contract";
import type { ApplyPublishingSubmissionCsvImportCommand,PublishingSubmissionCsvImportResult } from "../../../application/publishing/publishing-submission-csv-import";
import { buildPublishingSubmissionCsvImportPreview,parseApplyPublishingSubmissionCsvImportCommand,parsePublishingSubmissionCsvImportResult } from "../../../application/publishing/publishing-submission-csv-import";
import type { StorageTransaction } from "../../../application/storage/storage-service";
import type { EntityId } from "../../../domain/writing";
import { entityId } from "../../../domain/writing";
import { openNodeSqliteLedger } from "../../../platform/storage/node-sqlite-ledger";
import type { LocalWorkspaceRuntimeOptions } from "../contracts";
import type { StoredPublishingPartnerRow } from "../repositories/publishing";
import { projectStoredPublishingContractRow,projectStoredPublishingFormResponseRow,projectStoredPublishingFormTemplateRow,projectStoredPublishingMailCandidateRow,projectStoredPublishingPartnerRow,projectStoredPublishingPaymentRow,projectStoredPublishingPublicationRow,projectStoredPublishingSettlementRow,projectStoredPublishingSourceRow,projectStoredPublishingSubmissionRow,PUBLISHING_EVIDENCE_TARGET_TABLES,readStoredPublishingContractRowById,readStoredPublishingContractRows,readStoredPublishingFormResponseRowByWorkPartner,readStoredPublishingFormResponseRows,readStoredPublishingFormTemplateRowById,readStoredPublishingFormTemplateRows,readStoredPublishingMailCandidateRowById,readStoredPublishingMailCandidateRowBySource,readStoredPublishingMailCandidateRows,readStoredPublishingPartnerRowById,readStoredPublishingPartnerRows,readStoredPublishingPaymentRowById,readStoredPublishingPaymentRows,readStoredPublishingPublicationRowById,readStoredPublishingPublicationRows,readStoredPublishingSettlementRowById,readStoredPublishingSettlementRows,readStoredPublishingSourceRowById,readStoredPublishingSourceRows,readStoredPublishingSubmissionRowById,readStoredPublishingSubmissionRows } from "../repositories/publishing";
import { createRecordMeta } from "../repositories/record-builders";
import { WORK_STRUCTURE_REVISION_ROWS_SQL } from "../repositories/revisions";
import { readNullableString,readRequiredInteger,readRequiredString } from "../repositories/scalars";
import { createTimeZoneDateKey } from "../repositories/time";
import type { NodeSqliteDatabase } from "../storage-contracts";
import { LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION } from "../storage-profiles";

import type { WorkspaceOperationCoordinator } from "../operation-coordinator";
import type { WorkspaceRuntimeState } from "../state";
import type { InfrastructureService } from "./infrastructure";

/** Owns publishing commands and their existing transaction boundaries. */
export class PublishingService {
  readonly #state: WorkspaceRuntimeState;
  readonly #operations: WorkspaceOperationCoordinator;
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #options: Pick<LocalWorkspaceRuntimeOptions, "executePublishingAssistantIntent" | "timezone">;
  readonly #publishingAssistantCandidates = new Map<
    string,
    Readonly<{
      candidate: PublishingAssistantRecordCandidate;
      receipt: AssistantConnectorExecutionReceipt;
    }>
  >();
  readonly #infrastructure: Pick<InfrastructureService, "assertOpen">;

  constructor(input: {
    readonly state: WorkspaceRuntimeState;
    readonly operations: WorkspaceOperationCoordinator;
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
    readonly options: Pick<LocalWorkspaceRuntimeOptions, "executePublishingAssistantIntent" | "timezone">;
    readonly infrastructure: Pick<InfrastructureService, "assertOpen">;
  }) {
    this.#state = input.state;
    this.#operations = input.operations;
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#options = input.options;
    this.#infrastructure = input.infrastructure;
  }

  createPublishingPartner(
    value: unknown,
  ): Promise<PublishingPartnerProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingPartnerCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingPartnerSerially(command);
    });

    return execution;
  }

  listPublishingPartners(
    value: unknown,
  ): Promise<PublishingPartnerListProjection> {
    this.#infrastructure.assertOpen();
    parseListPublishingPartnersCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingPartnersSerially(),
    );
  }

  updatePublishingPartner(
    value: unknown,
  ): Promise<PublishingPartnerProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingPartnerCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingPartnerSerially(command);
    });

    return execution;
  }

  createPublishingFormTemplate(
    value: unknown,
  ): Promise<PublishingFormTemplateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingFormTemplateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingFormTemplateSerially(command);
    });

    return execution;
  }

  listPublishingFormTemplates(
    value: unknown,
  ): Promise<PublishingFormTemplateListProjection> {
    this.#infrastructure.assertOpen();
    parseListPublishingFormTemplatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingFormTemplatesSerially(),
    );
  }

  updatePublishingFormTemplate(
    value: unknown,
  ): Promise<PublishingFormTemplateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingFormTemplateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingFormTemplateSerially(command);
    });

    return execution;
  }

  listPublishingFormResponses(
    value: unknown,
  ): Promise<PublishingFormResponseListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingFormResponsesCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingFormResponsesSerially(command),
    );
  }

  savePublishingFormResponse(
    value: unknown,
  ): Promise<PublishingFormResponseProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSavePublishingFormResponseCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#savePublishingFormResponseSerially(command);
    });

    return execution;
  }

  createPublishingSubmission(
    value: unknown,
  ): Promise<PublishingSubmissionProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingSubmissionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingSubmissionSerially(command);
    });

    return execution;
  }

  listPublishingSubmissions(
    value: unknown,
  ): Promise<PublishingSubmissionListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingSubmissionsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingSubmissionsSerially(command),
    );
  }

  updatePublishingSubmission(
    value: unknown,
  ): Promise<PublishingSubmissionProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingSubmissionCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingSubmissionSerially(command);
    });

    return execution;
  }

  createPublishingContract(
    value: unknown,
  ): Promise<PublishingContractProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingContractCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingContractSerially(command);
    });

    return execution;
  }

  listPublishingContracts(
    value: unknown,
  ): Promise<PublishingContractListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingContractsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingContractsSerially(command),
    );
  }

  updatePublishingContract(
    value: unknown,
  ): Promise<PublishingContractProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingContractCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingContractSerially(command);
    });

    return execution;
  }

  createPublishingPublication(
    value: unknown,
  ): Promise<PublishingPublicationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingPublicationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingPublicationSerially(command);
    });

    return execution;
  }

  listPublishingPublications(
    value: unknown,
  ): Promise<PublishingPublicationListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingPublicationsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingPublicationsSerially(command),
    );
  }

  updatePublishingPublication(
    value: unknown,
  ): Promise<PublishingPublicationProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingPublicationCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingPublicationSerially(command);
    });

    return execution;
  }

  createPublishingSettlement(
    value: unknown,
  ): Promise<PublishingSettlementProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingSettlementCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingSettlementSerially(command);
    });

    return execution;
  }

  listPublishingSettlements(
    value: unknown,
  ): Promise<PublishingSettlementListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingSettlementsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingSettlementsSerially(command),
    );
  }

  updatePublishingSettlement(
    value: unknown,
  ): Promise<PublishingSettlementProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingSettlementCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingSettlementSerially(command);
    });

    return execution;
  }

  createPublishingPayment(
    value: unknown,
  ): Promise<PublishingPaymentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingPaymentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingPaymentSerially(command);
    });

    return execution;
  }

  listPublishingPayments(
    value: unknown,
  ): Promise<PublishingPaymentListProjection> {
    this.#infrastructure.assertOpen();
    const command = parseListPublishingPaymentsCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#listPublishingPaymentsSerially(command),
    );
  }

  updatePublishingPayment(
    value: unknown,
  ): Promise<PublishingPaymentProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingPaymentCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingPaymentSerially(command);
    });

    return execution;
  }

  createPublishingSource(
    value: unknown,
  ): Promise<PublishingSourceProjection> {
    this.#infrastructure.assertOpen();
    const command = parseCreatePublishingSourceCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#createPublishingSourceSerially(command);
    });

    return execution;
  }

  listPublishingSources(
    value: unknown,
  ): Promise<PublishingSourceListProjection> {
    this.#infrastructure.assertOpen();
    parseListPublishingSourcesCommand(value);
    return this.#operations.readBarrier().then(() =>
      parsePublishingSourceListProjection({
        schemaVersion: 1,
        sources: readStoredPublishingSourceRows(this.#database)
          .map(projectStoredPublishingSourceRow),
      }),
    );
  }

  previewPublishingResearch(
    value: unknown,
  ): Promise<PublishingResearchCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parsePreviewPublishingResearchCommand(value);
    return this.#operations.readBarrier().then(() =>
      this.#previewPublishingResearchSerially(command),
    );
  }

  approvePublishingResearch(
    value: unknown,
  ): Promise<PublishingResearchApprovalResult> {
    this.#infrastructure.assertOpen();
    const command = parseApprovePublishingResearchCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#approvePublishingResearchSerially(command);
    });

    return execution;
  }

  runPublishingAssistant(
    value: unknown,
  ): Promise<PublishingAssistantResult> {
    this.#infrastructure.assertOpen();
    const command = parseRunPublishingAssistantCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#runPublishingAssistantSerially(command);
    });

    return execution;
  }

  approvePublishingAssistantCandidate(
    value: unknown,
  ): Promise<PublishingAssistantApprovalResult> {
    this.#infrastructure.assertOpen();
    const command = parseApprovePublishingAssistantCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#approvePublishingAssistantCandidateSerially(command);
    });

    return execution;
  }

  setPublishingEvidenceLinks(
    value: unknown,
  ): Promise<PublishingEvidenceLinksProjection> {
    this.#infrastructure.assertOpen();
    const command = parseSetPublishingEvidenceLinksCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#setPublishingEvidenceLinksSerially(command);
    });

    return execution;
  }

  applyPublishingPartnerCsvImport(
    value: unknown,
  ): Promise<PublishingPartnerCsvImportResult> {
    this.#infrastructure.assertOpen();
    const command = parseApplyPublishingPartnerCsvImportCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#applyPublishingPartnerCsvImportSerially(command);
    });

    return execution;
  }

  applyPublishingSubmissionCsvImport(
    value: unknown,
  ): Promise<PublishingSubmissionCsvImportResult> {
    this.#infrastructure.assertOpen();
    const command = parseApplyPublishingSubmissionCsvImportCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#applyPublishingSubmissionCsvImportSerially(command);
    });

    return execution;
  }

  recordPublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseRecordPublishingMailCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#recordPublishingMailCandidateSerially(command);
    });

    return execution;
  }

  listPublishingMailCandidates(
    value: unknown,
  ): Promise<PublishingMailCandidateListProjection> {
    this.#infrastructure.assertOpen();
    parseListPublishingMailCandidatesCommand(value);
    return this.#operations.readBarrier().then(() =>
      parsePublishingMailCandidateListProjection({
        schemaVersion: 1,
        candidates: readStoredPublishingMailCandidateRows(this.#database)
          .map(projectStoredPublishingMailCandidateRow),
      }),
    );
  }

  linkPublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseLinkPublishingMailCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#linkPublishingMailCandidateSerially(command);
    });

    return execution;
  }

  updatePublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateProjection> {
    this.#infrastructure.assertOpen();
    const command = parseUpdatePublishingMailCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#updatePublishingMailCandidateSerially(command);
    });

    return execution;
  }

  reviewPublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateReviewResult> {
    this.#infrastructure.assertOpen();
    const command = parseReviewPublishingMailCandidateCommand(value);
    const execution = this.#operations.enqueueMutation(async (priorSaves) => {
      await priorSaves;
      return this.#reviewPublishingMailCandidateSerially(command);
    });

    return execution;
  }

  async #createPublishingPartnerSerially(
    command: CreatePublishingPartnerCommand,
  ): Promise<PublishingPartnerProjection> {
    if (
      command.parentPartnerId !== null &&
      readStoredPublishingPartnerRowById(
        this.#database,
        command.parentPartnerId,
      ) === null
    ) {
      throw new Error(`Unknown parent publishing partner: ${command.parentPartnerId}`);
    }
    const createdAt = new Date().toISOString();
    const partnerId = entityId<"PublishingPartner">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingPartner",
        ...createRecordMeta(createdAt),
        id: partnerId,
        name: command.name,
        parentPartnerId: command.parentPartnerId,
        submissionMethod: command.submissionMethod,
        websiteUrl: command.websiteUrl,
        email: command.email,
        genres: command.genres,
        requiredLength: command.requiredLength,
        priority: command.priority,
        note: command.note,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingPartnerRowById(
      this.#database,
      partnerId,
    );
    if (stored === null) {
      throw new Error(`Stored publishing partner is missing: ${partnerId}`);
    }
    return projectStoredPublishingPartnerRow(stored);
  }

  async #listPublishingPartnersSerially(): Promise<PublishingPartnerListProjection> {
    return parsePublishingPartnerListProjection({
      schemaVersion: 1,
      partners: readStoredPublishingPartnerRows(this.#database).map(
        projectStoredPublishingPartnerRow,
      ),
    });
  }

  async #updatePublishingPartnerSerially(
    command: UpdatePublishingPartnerCommand,
  ): Promise<PublishingPartnerProjection> {
    const current = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing partner revision conflict: ${command.partnerId}`);
    }
    const nextParentPartnerId = Object.hasOwn(
      command.changes,
      "parentPartnerId",
    )
      ? command.changes.parentPartnerId ?? null
      : current.parentPartnerId;
    if (nextParentPartnerId === command.partnerId) {
      throw new Error(`Publishing partner cannot be its own parent: ${command.partnerId}`);
    }
    if (
      nextParentPartnerId !== null &&
      readStoredPublishingPartnerRowById(
        this.#database,
        nextParentPartnerId,
      ) === null
    ) {
      throw new Error(`Unknown parent publishing partner: ${nextParentPartnerId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_partners
      SET
        revision = revision + 1,
        updated_at = ?,
        name = ?,
        parent_partner_id = ?,
        submission_method = ?,
        website_url = ?,
        email = ?,
        genres_json = ?,
        required_length = ?,
        priority = ?,
        note = ?
      WHERE
        id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.name ?? current.name,
      nextParentPartnerId,
      command.changes.submissionMethod ?? current.submissionMethod,
      command.changes.websiteUrl ?? current.websiteUrl,
      command.changes.email ?? current.email,
      JSON.stringify(command.changes.genres ?? current.genres),
      command.changes.requiredLength ?? current.requiredLength,
      command.changes.priority ?? current.priority,
      command.changes.note ?? current.note,
      command.partnerId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing partner revision conflict: ${command.partnerId}`);
    }
    const stored = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing partner is missing: ${command.partnerId}`);
    }
    return projectStoredPublishingPartnerRow(stored);
  }

  #createPublishingFormTemplateSerially(
    command: CreatePublishingFormTemplateCommand,
  ): PublishingFormTemplateProjection {
    if (command.scope === "base") {
      const existingBase = readStoredPublishingFormTemplateRows(this.#database)
        .find((template) => template.scope === "base");
      if (existingBase !== undefined) {
        throw new Error("A base publishing form template already exists");
      }
    } else {
      if (command.partnerId === null) {
        throw new Error("Partner publishing form template requires a partner");
      }
      const partner = readStoredPublishingPartnerRowById(
        this.#database,
        command.partnerId,
      );
      if (partner === null || partner.retiredAt !== null) {
        throw new Error(`Unknown publishing partner: ${command.partnerId}`);
      }
      const existingPartnerTemplate = readStoredPublishingFormTemplateRows(
        this.#database,
      ).find((template) => template.partnerId === command.partnerId);
      if (existingPartnerTemplate !== undefined) {
        throw new Error(
          `Publishing partner already has a form template: ${command.partnerId}`,
        );
      }
      if (command.sourceTemplateId !== null) {
        const source = readStoredPublishingFormTemplateRowById(
          this.#database,
          command.sourceTemplateId,
        );
        if (source === null || source.retiredAt !== null || source.scope !== "base") {
          throw new Error(
            `Publishing form source is not an active base template: ${command.sourceTemplateId}`,
          );
        }
      }
    }
    const templateId = entityId<"PublishingFormTemplate">(randomUUID());
    const createdAt = new Date().toISOString();
    this.#database.prepare(`
      INSERT INTO publishing_form_templates (
        id,schema_version,revision,created_at,updated_at,retired_at,
        scope,partner_id,source_template_id,name,description,sections_json
      ) VALUES (?,1,1,?,?,NULL,?,?,?,?,?,?)
    `).run(
      templateId,
      createdAt,
      createdAt,
      command.scope,
      command.partnerId,
      command.sourceTemplateId,
      command.name,
      command.description,
      JSON.stringify(command.sections),
    );
    const stored = readStoredPublishingFormTemplateRowById(
      this.#database,
      templateId,
    );
    if (stored === null) {
      throw new Error(`Stored publishing form template is missing: ${templateId}`);
    }
    return projectStoredPublishingFormTemplateRow(stored);
  }

  #listPublishingFormTemplatesSerially(): PublishingFormTemplateListProjection {
    return parsePublishingFormTemplateListProjection({
      schemaVersion: 1,
      templates: readStoredPublishingFormTemplateRows(this.#database).map(
        projectStoredPublishingFormTemplateRow,
      ),
    });
  }

  #updatePublishingFormTemplateSerially(
    command: UpdatePublishingFormTemplateCommand,
  ): PublishingFormTemplateProjection {
    const current = readStoredPublishingFormTemplateRowById(
      this.#database,
      command.templateId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing form template: ${command.templateId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Publishing form template revision conflict: ${command.templateId}`,
      );
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_form_templates
      SET revision=revision+1,updated_at=?,name=?,description=?,sections_json=?
      WHERE id=? AND revision=? AND retired_at IS NULL
    `).run(
      updatedAt,
      command.name,
      command.description,
      JSON.stringify(command.sections),
      command.templateId,
      command.expectedRevision,
    );
    if (Number((result as { changes?: unknown }).changes) !== 1) {
      throw new Error(
        `Publishing form template revision conflict: ${command.templateId}`,
      );
    }
    const stored = readStoredPublishingFormTemplateRowById(
      this.#database,
      command.templateId,
    );
    if (stored === null) {
      throw new Error(
        `Updated publishing form template is missing: ${command.templateId}`,
      );
    }
    return projectStoredPublishingFormTemplateRow(stored);
  }

  #listPublishingFormResponsesSerially(
    command: ListPublishingFormResponsesCommand,
  ): PublishingFormResponseListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingFormResponseListProjection({
      schemaVersion: 1,
      responses: readStoredPublishingFormResponseRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingFormResponseRow),
    });
  }

  #savePublishingFormResponseSerially(
    command: SavePublishingFormResponseCommand,
  ): PublishingFormResponseProjection {
    if (!this.#state.catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const partner = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (partner === null || partner.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }
    const template = readStoredPublishingFormTemplateRowById(
      this.#database,
      command.templateId,
    );
    if (
      template === null ||
      template.retiredAt !== null ||
      template.scope !== "partner" ||
      template.partnerId !== command.partnerId
    ) {
      throw new Error(
        `Publishing form template is outside the partner boundary: ${command.templateId}`,
      );
    }
    if (template.revision !== command.expectedTemplateRevision) {
      throw new Error(
        `Publishing form template revision conflict: ${command.templateId}`,
      );
    }
    const fieldIds = new Set(
      template.sections.flatMap((section) =>
        section.fields.map((field) => field.fieldId)),
    );
    const unknownAnswer = command.answers.find(
      (answer) => !fieldIds.has(answer.fieldId),
    );
    if (unknownAnswer !== undefined) {
      throw new Error(
        `Publishing form answer references an unknown field: ${unknownAnswer.fieldId}`,
      );
    }
    const current = readStoredPublishingFormResponseRowByWorkPartner(
      this.#database,
      command.workId,
      command.partnerId,
    );
    const updatedAt = new Date().toISOString();
    if (current === null) {
      if (command.expectedRevision !== null) {
        throw new Error(
          `Publishing form response revision conflict: ${command.workId}/${command.partnerId}`,
        );
      }
      const responseId = entityId<"PublishingFormResponse">(randomUUID());
      this.#database.prepare(`
        INSERT INTO publishing_form_responses (
          id,schema_version,revision,created_at,updated_at,
          work_id,partner_id,template_id,template_revision,answers_json
        ) VALUES (?,1,1,?,?,?,?,?,?,?)
      `).run(
        responseId,
        updatedAt,
        updatedAt,
        command.workId,
        command.partnerId,
        command.templateId,
        command.expectedTemplateRevision,
        JSON.stringify(command.answers),
      );
    } else {
      if (command.expectedRevision !== current.revision) {
        throw new Error(
          `Publishing form response revision conflict: ${command.workId}/${command.partnerId}`,
        );
      }
      const result = this.#database.prepare(`
        UPDATE publishing_form_responses
        SET revision=revision+1,updated_at=?,template_id=?,template_revision=?,answers_json=?
        WHERE work_id=? AND partner_id=? AND revision=?
      `).run(
        updatedAt,
        command.templateId,
        command.expectedTemplateRevision,
        JSON.stringify(command.answers),
        command.workId,
        command.partnerId,
        command.expectedRevision,
      );
      if (Number((result as { changes?: unknown }).changes) !== 1) {
        throw new Error(
          `Publishing form response revision conflict: ${command.workId}/${command.partnerId}`,
        );
      }
    }
    const stored = readStoredPublishingFormResponseRowByWorkPartner(
      this.#database,
      command.workId,
      command.partnerId,
    );
    if (stored === null) {
      throw new Error(
        `Stored publishing form response is missing: ${command.workId}/${command.partnerId}`,
      );
    }
    return projectStoredPublishingFormResponseRow(stored);
  }

  async #createPublishingSubmissionSerially(
    command: CreatePublishingSubmissionCommand,
  ): Promise<PublishingSubmissionProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const partner = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (partner === null || partner.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }

    const documentRevisions = [...this.#state.documentTargets.values()]
      .filter((target) => target.workId === command.workId)
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((target) => ({
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
      }));
    const structureRevisionRefs = this.#database
      .prepare(WORK_STRUCTURE_REVISION_ROWS_SQL)
      .all(
        command.workId,
        command.workId,
        command.workId,
        command.workId,
        command.workId,
        command.workId,
      )
      .map((row, index) => {
        const label = `Submission Work structure revision rows[${index}]`;
        return {
          entityKind: readRequiredString(row, "entityKind", label),
          entityId: readRequiredString(row, "entityId", label),
          revision: readRequiredInteger(row, "revision", label),
        };
      });
    const structureRevisionRefsJson = JSON.stringify(structureRevisionRefs);
    const workSnapshotManifest = JSON.stringify({
      schemaVersion: 1,
      workId: command.workId,
      documentRevisions,
      structureRevisionRefs,
    });
    const workSnapshotManifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    ).update(workSnapshotManifest, "utf8").digest("hex");
    const sealedAt = new Date().toISOString();
    const submissionId = entityId<"PublishingSubmission">(randomUUID());
    const submissionPackageId = entityId<"SubmissionPackage">(randomUUID());
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    const packageManifest = JSON.stringify({
      schemaVersion: 1,
      workId: command.workId,
      partnerId: command.partnerId,
      workSnapshotId,
      workTitleSnapshot: work.title,
      partnerNameSnapshot: partner.name,
      workSnapshotManifestHash,
      documentRevisions,
    });
    const packageManifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    ).update(packageManifest, "utf8").digest("hex");

    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "workSnapshot",
        id: workSnapshotId,
        workId: command.workId,
        documentRevisions,
        structureRevisionRefsJson,
        manifestHash: workSnapshotManifestHash,
        label: `submission:${submissionId}`,
        cause: "submission",
        createdAt: sealedAt,
      });
      transaction.write({
        kind: "submissionPackage",
        id: submissionPackageId,
        workId: command.workId,
        partnerId: command.partnerId,
        workSnapshotId,
        workTitleSnapshot: work.title,
        partnerNameSnapshot: partner.name,
        manifestHash: packageManifestHash,
        sealedAt,
      });
      transaction.write({
        kind: "publishingSubmission",
        ...createRecordMeta(sealedAt),
        id: submissionId,
        workId: command.workId,
        partnerId: command.partnerId,
        submissionPackageId,
        title: command.title,
        status: command.status,
        submittedOn: command.submittedOn,
        respondedOn: command.respondedOn,
        result: command.result,
        note: command.note,
        cardNote: command.cardNote,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingSubmissionRowById(
      this.#database,
      submissionId,
    );
    if (stored === null) {
      throw new Error(`Stored publishing submission is missing: ${submissionId}`);
    }
    return projectStoredPublishingSubmissionRow(stored);
  }

  #listPublishingSubmissionsSerially(
    command: ListPublishingSubmissionsCommand,
  ): PublishingSubmissionListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingSubmissionListProjection({
      schemaVersion: 1,
      submissions: readStoredPublishingSubmissionRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingSubmissionRow),
    });
  }

  async #updatePublishingSubmissionSerially(
    command: UpdatePublishingSubmissionCommand,
  ): Promise<PublishingSubmissionProjection> {
    const current = readStoredPublishingSubmissionRowById(
      this.#database,
      command.submissionId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing submission: ${command.submissionId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing submission revision conflict: ${command.submissionId}`);
    }
    const respondedOn = Object.hasOwn(command.changes, "respondedOn")
      ? command.changes.respondedOn ?? null
      : current.respondedOn;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_submissions
      SET
        revision = revision + 1,
        updated_at = ?,
        status = ?,
        responded_on = ?,
        result = ?,
        note = ?,
        card_note = ?
      WHERE
        id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.status ?? current.status,
      respondedOn,
      command.changes.result ?? current.result,
      command.changes.note ?? current.note,
      command.changes.cardNote ?? current.cardNote,
      command.submissionId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing submission revision conflict: ${command.submissionId}`);
    }
    const stored = readStoredPublishingSubmissionRowById(
      this.#database,
      command.submissionId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing submission is missing: ${command.submissionId}`);
    }
    return projectStoredPublishingSubmissionRow(stored);
  }

  async #createPublishingContractSerially(
    command: CreatePublishingContractCommand,
  ): Promise<PublishingContractProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    const partner = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (partner === null || partner.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }
    if (command.submissionId !== null) {
      const submission = readStoredPublishingSubmissionRowById(
        this.#database,
        command.submissionId,
      );
      if (
        submission === null ||
        submission.retiredAt !== null ||
        submission.workId !== command.workId ||
        submission.partnerId !== command.partnerId
      ) {
        throw new Error(
          `Publishing submission is outside the contract boundary: ${command.submissionId}`,
        );
      }
    }
    const createdAt = new Date().toISOString();
    const contractId = entityId<"PublishingContract">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingContract",
        ...createRecordMeta(createdAt),
        id: contractId,
        workId: command.workId,
        partnerId: command.partnerId,
        submissionId: command.submissionId,
        title: command.title,
        workTitleSnapshot: work.title,
        partnerNameSnapshot: partner.name,
        status: command.status,
        signedOn: command.signedOn,
        startsOn: command.startsOn,
        endsOn: command.endsOn,
        rightsScope: command.rightsScope,
        advanceAmount: command.advanceAmount,
        currencyCode: command.currencyCode,
        revenueShareNote: command.revenueShareNote,
        note: command.note,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingContractRowById(
      this.#database,
      contractId,
    );
    if (stored === null) {
      throw new Error(`Stored publishing contract is missing: ${contractId}`);
    }
    return projectStoredPublishingContractRow(stored);
  }

  #listPublishingContractsSerially(
    command: ListPublishingContractsCommand,
  ): PublishingContractListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingContractListProjection({
      schemaVersion: 1,
      contracts: readStoredPublishingContractRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingContractRow),
    });
  }

  async #updatePublishingContractSerially(
    command: UpdatePublishingContractCommand,
  ): Promise<PublishingContractProjection> {
    const current = readStoredPublishingContractRowById(
      this.#database,
      command.contractId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing contract: ${command.contractId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing contract revision conflict: ${command.contractId}`);
    }
    const nullableChange = <T,>(field: keyof UpdatePublishingContractCommand["changes"], currentValue: T | null) =>
      Object.hasOwn(command.changes, field)
        ? (command.changes[field] as T | null | undefined) ?? null
        : currentValue;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_contracts
      SET
        revision = revision + 1,
        updated_at = ?,
        status = ?,
        signed_on = ?,
        starts_on = ?,
        ends_on = ?,
        rights_scope = ?,
        advance_amount = ?,
        currency_code = ?,
        revenue_share_note = ?,
        note = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.status ?? current.status,
      nullableChange<string>("signedOn", current.signedOn),
      nullableChange<string>("startsOn", current.startsOn),
      nullableChange<string>("endsOn", current.endsOn),
      command.changes.rightsScope ?? current.rightsScope,
      nullableChange<number>("advanceAmount", current.advanceAmount),
      command.changes.currencyCode ?? current.currencyCode,
      command.changes.revenueShareNote ?? current.revenueShareNote,
      command.changes.note ?? current.note,
      command.contractId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing contract revision conflict: ${command.contractId}`);
    }
    const stored = readStoredPublishingContractRowById(
      this.#database,
      command.contractId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing contract is missing: ${command.contractId}`);
    }
    return projectStoredPublishingContractRow(stored);
  }

  async #createPublishingPublicationSerially(
    command: CreatePublishingPublicationCommand,
  ): Promise<PublishingPublicationProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    if (command.contractId !== null) {
      const contract = readStoredPublishingContractRowById(
        this.#database,
        command.contractId,
      );
      if (
        contract === null ||
        contract.retiredAt !== null ||
        contract.workId !== command.workId
      ) {
        throw new Error(
          `Publishing contract is outside the publication boundary: ${command.contractId}`,
        );
      }
    }
    const channel = command.channelPartnerId === null
      ? null
      : readStoredPublishingPartnerRowById(this.#database, command.channelPartnerId);
    if (command.channelPartnerId !== null && (channel === null || channel.retiredAt !== null)) {
      throw new Error(`Unknown publishing channel: ${command.channelPartnerId}`);
    }
    const createdAt = new Date().toISOString();
    const publicationId = entityId<"PublishingPublication">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingPublication",
        ...createRecordMeta(createdAt),
        id: publicationId,
        workId: command.workId,
        contractId: command.contractId,
        channelPartnerId: command.channelPartnerId,
        title: command.title,
        workTitleSnapshot: work.title,
        channelNameSnapshot: channel?.name ?? "",
        status: command.status,
        format: command.format,
        scheduledOn: command.scheduledOn,
        startsOn: command.startsOn,
        endsOn: command.endsOn,
        publishedUnitCount: command.publishedUnitCount,
        plannedUnitCount: command.plannedUnitCount,
        scheduleNote: command.scheduleNote,
        note: command.note,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingPublicationRowById(
      this.#database,
      publicationId,
    );
    if (stored === null) {
      throw new Error(`Stored publishing publication is missing: ${publicationId}`);
    }
    return projectStoredPublishingPublicationRow(stored);
  }

  #listPublishingPublicationsSerially(
    command: ListPublishingPublicationsCommand,
  ): PublishingPublicationListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingPublicationListProjection({
      schemaVersion: 1,
      publications: readStoredPublishingPublicationRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingPublicationRow),
    });
  }

  async #updatePublishingPublicationSerially(
    command: UpdatePublishingPublicationCommand,
  ): Promise<PublishingPublicationProjection> {
    const current = readStoredPublishingPublicationRowById(
      this.#database,
      command.publicationId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing publication: ${command.publicationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing publication revision conflict: ${command.publicationId}`);
    }
    const contractId = Object.hasOwn(command.changes, "contractId")
      ? command.changes.contractId ?? null
      : current.contractId;
    if (contractId !== null) {
      const contract = readStoredPublishingContractRowById(this.#database, contractId);
      if (
        contract === null ||
        contract.retiredAt !== null ||
        contract.workId !== current.workId
      ) {
        throw new Error(
          `Publishing contract is outside the publication boundary: ${contractId}`,
        );
      }
    }
    const channelPartnerId = Object.hasOwn(command.changes, "channelPartnerId")
      ? command.changes.channelPartnerId ?? null
      : current.channelPartnerId;
    const channel = channelPartnerId === null
      ? null
      : readStoredPublishingPartnerRowById(this.#database, channelPartnerId);
    if (channelPartnerId !== null && (channel === null || channel.retiredAt !== null)) {
      throw new Error(`Unknown publishing channel: ${channelPartnerId}`);
    }
    const nullableChange = <T,>(
      field: keyof UpdatePublishingPublicationCommand["changes"],
      currentValue: T | null,
    ) => Object.hasOwn(command.changes, field)
      ? (command.changes[field] as T | null | undefined) ?? null
      : currentValue;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_publications
      SET
        revision = revision + 1,
        updated_at = ?,
        contract_id = ?,
        channel_partner_id = ?,
        channel_name_snapshot = ?,
        status = ?,
        format = ?,
        scheduled_on = ?,
        starts_on = ?,
        ends_on = ?,
        published_unit_count = ?,
        planned_unit_count = ?,
        schedule_note = ?,
        note = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      contractId,
      channelPartnerId,
      Object.hasOwn(command.changes, "channelPartnerId")
        ? channel?.name ?? ""
        : current.channelNameSnapshot,
      command.changes.status ?? current.status,
      command.changes.format ?? current.format,
      nullableChange<string>("scheduledOn", current.scheduledOn),
      nullableChange<string>("startsOn", current.startsOn),
      nullableChange<string>("endsOn", current.endsOn),
      nullableChange<number>("publishedUnitCount", current.publishedUnitCount),
      nullableChange<number>("plannedUnitCount", current.plannedUnitCount),
      command.changes.scheduleNote ?? current.scheduleNote,
      command.changes.note ?? current.note,
      command.publicationId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing publication revision conflict: ${command.publicationId}`);
    }
    const stored = readStoredPublishingPublicationRowById(
      this.#database,
      command.publicationId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing publication is missing: ${command.publicationId}`);
    }
    return projectStoredPublishingPublicationRow(stored);
  }

  async #createPublishingSettlementSerially(
    command: CreatePublishingSettlementCommand,
  ): Promise<PublishingSettlementProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    const publication = readStoredPublishingPublicationRowById(
      this.#database,
      command.publicationId,
    );
    if (
      publication === null ||
      publication.retiredAt !== null ||
      publication.workId !== command.workId
    ) {
      throw new Error(
        `Publishing publication is outside the settlement boundary: ${command.publicationId}`,
      );
    }
    const items = command.items.map((item) => ({
      ...item,
      settlementLineItemId: item.settlementLineItemId ??
        entityId<"PublishingSettlementLineItem">(randomUUID()),
    }));
    const createdAt = new Date().toISOString();
    const settlementId = entityId<"PublishingSettlement">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingSettlement",
        ...createRecordMeta(createdAt),
        id: settlementId,
        workId: command.workId,
        publicationId: command.publicationId,
        title: command.title,
        workTitleSnapshot: work.title,
        publicationTitleSnapshot: publication.title,
        periodStartsOn: command.periodStartsOn,
        periodEndsOn: command.periodEndsOn,
        issuedOn: command.issuedOn,
        reviewStatus: command.reviewStatus,
        currencyCode: command.currencyCode,
        reportedAmount: command.reportedAmount,
        items,
        note: command.note,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingSettlementRowById(this.#database, settlementId);
    if (stored === null) {
      throw new Error(`Stored publishing settlement is missing: ${settlementId}`);
    }
    return projectStoredPublishingSettlementRow(stored);
  }

  #listPublishingSettlementsSerially(
    command: ListPublishingSettlementsCommand,
  ): PublishingSettlementListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingSettlementListProjection({
      schemaVersion: 1,
      settlements: readStoredPublishingSettlementRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingSettlementRow),
    });
  }

  async #updatePublishingSettlementSerially(
    command: UpdatePublishingSettlementCommand,
  ): Promise<PublishingSettlementProjection> {
    const current = readStoredPublishingSettlementRowById(
      this.#database,
      command.settlementId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing settlement: ${command.settlementId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing settlement revision conflict: ${command.settlementId}`);
    }
    const nullableChange = <T,>(
      field: keyof UpdatePublishingSettlementCommand["changes"],
      currentValue: T | null,
    ) => Object.hasOwn(command.changes, field)
      ? (command.changes[field] as T | null | undefined) ?? null
      : currentValue;
    const items = command.changes.items?.map((item) => ({
      ...item,
      settlementLineItemId: item.settlementLineItemId ??
        entityId<"PublishingSettlementLineItem">(randomUUID()),
    })) ?? current.items;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_settlements
      SET
        revision = revision + 1,
        updated_at = ?,
        period_starts_on = ?,
        period_ends_on = ?,
        issued_on = ?,
        review_status = ?,
        currency_code = ?,
        reported_amount = ?,
        items_json = ?,
        note = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      nullableChange<string>("periodStartsOn", current.periodStartsOn),
      nullableChange<string>("periodEndsOn", current.periodEndsOn),
      nullableChange<string>("issuedOn", current.issuedOn),
      command.changes.reviewStatus ?? current.reviewStatus,
      command.changes.currencyCode ?? current.currencyCode,
      nullableChange<number>("reportedAmount", current.reportedAmount),
      JSON.stringify(items),
      command.changes.note ?? current.note,
      command.settlementId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing settlement revision conflict: ${command.settlementId}`);
    }
    const stored = readStoredPublishingSettlementRowById(
      this.#database,
      command.settlementId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing settlement is missing: ${command.settlementId}`);
    }
    return projectStoredPublishingSettlementRow(stored);
  }

  async #createPublishingPaymentSerially(
    command: CreatePublishingPaymentCommand,
  ): Promise<PublishingPaymentProjection> {
    const work = this.#state.catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) throw new Error(`Unknown Work: ${command.workId}`);
    const settlement = command.settlementId === null
      ? null
      : readStoredPublishingSettlementRowById(this.#database, command.settlementId);
    if (
      command.settlementId !== null &&
      (
        settlement === null ||
        settlement.retiredAt !== null ||
        settlement.workId !== command.workId
      )
    ) {
      throw new Error(
        `Publishing settlement is outside the payment boundary: ${command.settlementId}`,
      );
    }
    const createdAt = new Date().toISOString();
    const paymentId = entityId<"PublishingPayment">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingPayment",
        ...createRecordMeta(createdAt),
        id: paymentId,
        workId: command.workId,
        settlementId: command.settlementId,
        workTitleSnapshot: work.title,
        settlementTitleSnapshot: settlement?.title ?? "",
        receivedOn: command.receivedOn,
        confirmedOn: command.confirmedOn,
        amount: command.amount,
        currencyCode: command.currencyCode,
        matchStatus: command.matchStatus,
        payerLabel: command.payerLabel,
        reference: command.reference,
        note: command.note,
        sourceIds: [],
      });
    });
    const stored = readStoredPublishingPaymentRowById(this.#database, paymentId);
    if (stored === null) {
      throw new Error(`Stored publishing payment is missing: ${paymentId}`);
    }
    return projectStoredPublishingPaymentRow(stored);
  }

  #listPublishingPaymentsSerially(
    command: ListPublishingPaymentsCommand,
  ): PublishingPaymentListProjection {
    if (
      command.workId !== null &&
      !this.#state.catalog.works.some((work) => work.workId === command.workId)
    ) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePublishingPaymentListProjection({
      schemaVersion: 1,
      payments: readStoredPublishingPaymentRows(
        this.#database,
        command.workId,
      ).map(projectStoredPublishingPaymentRow),
    });
  }

  async #updatePublishingPaymentSerially(
    command: UpdatePublishingPaymentCommand,
  ): Promise<PublishingPaymentProjection> {
    const current = readStoredPublishingPaymentRowById(
      this.#database,
      command.paymentId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing payment: ${command.paymentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing payment revision conflict: ${command.paymentId}`);
    }
    const settlementChanged = Object.hasOwn(command.changes, "settlementId");
    const settlementId = settlementChanged
      ? command.changes.settlementId ?? null
      : current.settlementId;
    const settlement = settlementId === null
      ? null
      : readStoredPublishingSettlementRowById(this.#database, settlementId);
    if (
      settlementId !== null &&
      (
        settlement === null ||
        settlement.retiredAt !== null ||
        settlement.workId !== current.workId
      )
    ) {
      throw new Error(
        `Publishing settlement is outside the payment boundary: ${settlementId}`,
      );
    }
    const nullableChange = <T,>(
      field: keyof UpdatePublishingPaymentCommand["changes"],
      currentValue: T | null,
    ) => Object.hasOwn(command.changes, field)
      ? (command.changes[field] as T | null | undefined) ?? null
      : currentValue;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_payments
      SET
        revision = revision + 1,
        updated_at = ?,
        settlement_id = ?,
        settlement_title_snapshot = ?,
        received_on = ?,
        confirmed_on = ?,
        amount = ?,
        currency_code = ?,
        match_status = ?,
        payer_label = ?,
        reference = ?,
        note = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      settlementId,
      settlementChanged ? settlement?.title ?? "" : current.settlementTitleSnapshot,
      nullableChange<string>("receivedOn", current.receivedOn),
      nullableChange<string>("confirmedOn", current.confirmedOn),
      command.changes.amount ?? current.amount,
      command.changes.currencyCode ?? current.currencyCode,
      command.changes.matchStatus ?? current.matchStatus,
      command.changes.payerLabel ?? current.payerLabel,
      command.changes.reference ?? current.reference,
      command.changes.note ?? current.note,
      command.paymentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing payment revision conflict: ${command.paymentId}`);
    }
    const stored = readStoredPublishingPaymentRowById(
      this.#database,
      command.paymentId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing payment is missing: ${command.paymentId}`);
    }
    return projectStoredPublishingPaymentRow(stored);
  }

  async #createPublishingSourceSerially(
    command: CreatePublishingSourceCommand,
  ): Promise<PublishingSourceProjection> {
    const createdAt = new Date().toISOString();
    const sourceId = entityId<"PublishingSource">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingSource",
        ...createRecordMeta(createdAt),
        id: sourceId,
        sourceKind: command.kind,
        label: command.label,
        url: command.url,
        observedAt: command.observedAt,
        authority: command.authority,
        importedFields: command.importedFields,
      });
    });
    const stored = readStoredPublishingSourceRowById(this.#database, sourceId);
    if (stored === null) {
      throw new Error(`Stored publishing source is missing: ${sourceId}`);
    }
    return projectStoredPublishingSourceRow(stored);
  }

  #previewPublishingResearchSerially(
    command: PreviewPublishingResearchCommand,
  ): PublishingResearchCandidateProjection {
    const current = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }
    return buildPublishingResearchCandidate(
      projectStoredPublishingPartnerRow(current),
      command,
    );
  }

  async #approvePublishingResearchSerially(
    command: ApprovePublishingResearchCommand,
  ): Promise<PublishingResearchApprovalResult> {
    const current = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing partner: ${command.partnerId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing partner revision conflict: ${command.partnerId}`);
    }

    const selectedFields = new Set(command.selectedFields);
    const createdAt = new Date().toISOString();
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const importedFields = Object.freeze(Object.fromEntries(
      Object.entries(command.proposals).map(([name, value]) => [
        name,
        typeof value === "string" ? value : JSON.stringify(value),
      ]),
    ));

    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        INSERT INTO publishing_sources (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          source_kind,
          label,
          url,
          observed_at,
          authority,
          imported_fields_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId,
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        1,
        createdAt,
        createdAt,
        null,
        "web",
        command.source.label,
        command.source.url,
        `${command.source.observedOn}T00:00:00.000Z`,
        command.source.authority,
        JSON.stringify(importedFields),
      );
      const result = this.#database.prepare(`
        UPDATE publishing_partners
        SET
          revision = revision + 1,
          updated_at = ?,
          website_url = ?,
          email = ?,
          genres_json = ?,
          note = ?,
          source_ids_json = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        createdAt,
        selectedFields.has("websiteUrl")
          ? command.proposals.websiteUrl
          : current.websiteUrl,
        selectedFields.has("email")
          ? command.proposals.email
          : current.email,
        JSON.stringify(
          selectedFields.has("genres")
            ? command.proposals.genres
            : current.genres,
        ),
        selectedFields.has("note")
          ? command.proposals.note
          : current.note,
        JSON.stringify([...current.sourceIds, sourceId]),
        command.partnerId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Publishing partner revision conflict: ${command.partnerId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    const partner = readStoredPublishingPartnerRowById(
      this.#database,
      command.partnerId,
    );
    const source = readStoredPublishingSourceRowById(this.#database, sourceId);
    if (partner === null || source === null) {
      throw new Error(`Stored publishing research approval is missing: ${command.partnerId}`);
    }
    return parsePublishingResearchApprovalResult({
      schemaVersion: 1,
      partner: projectStoredPublishingPartnerRow(partner),
      source: projectStoredPublishingSourceRow(source),
    });
  }

  async #runPublishingAssistantSerially(
    command: RunPublishingAssistantCommand,
  ): Promise<PublishingAssistantResult> {
    const execute = this.#options.executePublishingAssistantIntent;
    if (execute === undefined) {
      throw new Error("Publishing assistant connector is not configured");
    }
    const now = new Date().toISOString();
    const registry = buildPublishingAssistantRegistry({
      currentDate: createTimeZoneDateKey(this.#options.timezone)(now),
      works: this.#state.catalog.works.map((work) => ({
        workId: work.workId,
        title: work.title,
      })),
      partners: readStoredPublishingPartnerRows(this.#database)
        .filter((partner) => partner.retiredAt === null)
        .map((partner) => ({
          partnerId: partner.partnerId,
          name: partner.name,
        })),
      submissions: readStoredPublishingSubmissionRows(this.#database, null)
        .filter((submission) => submission.retiredAt === null)
        .map((submission) => ({
          submissionId: submission.submissionId,
          workId: submission.workId,
          partnerId: submission.partnerId,
          submittedOn: submission.submittedOn,
          respondedOn: submission.respondedOn,
        })),
    });
    const executed = await execute(Object.freeze({
      requestId: command.requestId,
      connectionId: command.connectionId,
      statement: command.statement,
      currentDate: registry.currentDate,
      registry,
    }));
    if (
      String(executed.receipt.requestId) !== String(command.requestId) ||
      executed.receipt.connectionId !== command.connectionId ||
      executed.receipt.operation !== "publishing-intent"
    ) {
      throw new Error("Publishing assistant connector receipt does not match the request");
    }
    const result = parsePublishingAssistantResult(resolvePublishingAssistantIntent({
      intent: parsePublishingAssistantIntentPayload(executed.payload),
      registry,
      statement: command.statement,
      connectionId: command.connectionId,
      receipt: executed.receipt,
      candidateId: randomUUID(),
      createdAt: now,
    }));
    if (result.status === "record-candidate") {
      this.#publishingAssistantCandidates.set(
        result.candidate.candidateId,
        Object.freeze({ candidate: result.candidate, receipt: result.receipt }),
      );
    }
    return result;
  }

  async #approvePublishingAssistantCandidateSerially(
    command: ApprovePublishingAssistantCandidateCommand,
  ): Promise<PublishingAssistantApprovalResult> {
    const held = this.#publishingAssistantCandidates.get(command.candidateId);
    if (held === undefined) {
      throw new Error(`Unknown publishing assistant Candidate: ${command.candidateId}`);
    }
    const candidate = held.candidate;
    const work = this.#state.catalog.works.find(
      (entry) => entry.workId === candidate.workId,
    );
    if (work === undefined) {
      throw new Error(`Publishing assistant Candidate Work is unavailable: ${candidate.workId}`);
    }
    if (work.title !== candidate.workTitleSnapshot) {
      throw new Error(`Publishing assistant Candidate Work changed: ${candidate.workId}`);
    }
    const partners = candidate.records.map((record) => {
      const partner = readStoredPublishingPartnerRowById(
        this.#database,
        record.partnerId,
      );
      if (partner === null || partner.retiredAt !== null) {
        throw new Error(
          `Publishing assistant Candidate partner is unavailable: ${record.partnerId}`,
        );
      }
      if (partner.name !== record.partnerNameSnapshot) {
        throw new Error(
          `Publishing assistant Candidate partner changed: ${record.partnerId}`,
        );
      }
      return partner;
    });

    const documentRevisions = [...this.#state.documentTargets.values()]
      .filter((target) => target.workId === candidate.workId)
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((target) => ({
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
      }));
    const structureRevisionRefs = this.#database
      .prepare(WORK_STRUCTURE_REVISION_ROWS_SQL)
      .all(
        candidate.workId,
        candidate.workId,
        candidate.workId,
        candidate.workId,
        candidate.workId,
        candidate.workId,
      )
      .map((row, index) => {
        const label = `Publishing assistant Work structure revision rows[${index}]`;
        return {
          entityKind: readRequiredString(row, "entityKind", label),
          entityId: readRequiredString(row, "entityId", label),
          revision: readRequiredInteger(row, "revision", label),
        };
      });
    const structureRevisionRefsJson = JSON.stringify(structureRevisionRefs);
    const workSnapshotManifest = JSON.stringify({
      schemaVersion: 1,
      workId: candidate.workId,
      documentRevisions,
      structureRevisionRefs,
    });
    const workSnapshotManifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    ).update(workSnapshotManifest, "utf8").digest("hex");
    const sealedAt = new Date().toISOString();
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const prepared = candidate.records.map((record, index) => {
      const partner = partners[index]!;
      const submissionId = entityId<"PublishingSubmission">(randomUUID());
      const submissionPackageId = entityId<"SubmissionPackage">(randomUUID());
      const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
      const packageManifest = JSON.stringify({
        schemaVersion: 1,
        workId: candidate.workId,
        partnerId: record.partnerId,
        workSnapshotId,
        workTitleSnapshot: work.title,
        partnerNameSnapshot: partner.name,
        workSnapshotManifestHash,
        documentRevisions,
      });
      return Object.freeze({
        record,
        partner,
        submissionId,
        submissionPackageId,
        workSnapshotId,
        packageManifestHash: createHash(
          LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
        ).update(packageManifest, "utf8").digest("hex"),
      });
    });

    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingSource",
        ...createRecordMeta(sealedAt),
        id: sourceId,
        sourceKind: "user-statement",
        label: candidate.statement,
        url: null,
        observedAt: sealedAt,
        authority: "",
        importedFields: Object.freeze({
          statement: candidate.statement,
          connectionId: candidate.connectionId,
          connectorReceiptId: candidate.connectorReceiptId,
          requestFingerprint: held.receipt.requestFingerprint,
        }),
      });
      for (const item of prepared) {
        transaction.write({
          kind: "workSnapshot",
          id: item.workSnapshotId,
          workId: candidate.workId,
          documentRevisions,
          structureRevisionRefsJson,
          manifestHash: workSnapshotManifestHash,
          label: `submission:${item.submissionId}`,
          cause: "submission",
          createdAt: sealedAt,
        });
        transaction.write({
          kind: "submissionPackage",
          id: item.submissionPackageId,
          workId: candidate.workId,
          partnerId: item.record.partnerId,
          workSnapshotId: item.workSnapshotId,
          workTitleSnapshot: work.title,
          partnerNameSnapshot: item.partner.name,
          manifestHash: item.packageManifestHash,
          sealedAt,
        });
        transaction.write({
          kind: "publishingSubmission",
          ...createRecordMeta(sealedAt),
          id: item.submissionId,
          workId: candidate.workId,
          partnerId: item.record.partnerId,
          submissionPackageId: item.submissionPackageId,
          title: "",
          status: "",
          submittedOn: item.record.submittedOn,
          respondedOn: null,
          result: "",
          note: "",
          cardNote: "",
          sourceIds: [sourceId],
        });
      }
    });
    this.#publishingAssistantCandidates.delete(command.candidateId);

    const source = readStoredPublishingSourceRowById(this.#database, sourceId);
    if (source === null) {
      throw new Error(`Stored publishing assistant source is missing: ${sourceId}`);
    }
    const submissions = prepared.map((item) => {
      const submission = readStoredPublishingSubmissionRowById(
        this.#database,
        item.submissionId,
      );
      if (submission === null) {
        throw new Error(
          `Stored publishing assistant submission is missing: ${item.submissionId}`,
        );
      }
      return projectStoredPublishingSubmissionRow(submission);
    });
    return parsePublishingAssistantApprovalResult({
      schemaVersion: 1,
      source: projectStoredPublishingSourceRow(source),
      submissions,
    });
  }

  #setPublishingEvidenceLinksSerially(
    command: SetPublishingEvidenceLinksCommand,
  ): PublishingEvidenceLinksProjection {
    for (const sourceId of command.sourceIds) {
      const source = readStoredPublishingSourceRowById(this.#database, sourceId);
      if (source === null || source.retiredAt !== null) {
        throw new Error(`Unknown publishing source: ${sourceId}`);
      }
    }

    const table = PUBLISHING_EVIDENCE_TARGET_TABLES[command.targetKind];
    const rows = this.#database.prepare(`
      SELECT revision, retired_at AS retiredAt
      FROM ${table}
      WHERE id = ?
    `).all(command.targetId);
    if (rows.length !== 1) {
      throw new Error(
        `Unknown publishing ${command.targetKind}: ${command.targetId}`,
      );
    }
    const row = rows[0] ?? {};
    const label = `Publishing ${command.targetKind} evidence target`;
    const revision = readRequiredInteger(row, "revision", label);
    if (readNullableString(row, "retiredAt", label) !== null) {
      throw new Error(
        `Unknown publishing ${command.targetKind}: ${command.targetId}`,
      );
    }
    if (revision !== command.expectedRevision) {
      throw new Error(
        `Publishing ${command.targetKind} revision conflict: ${command.targetId}`,
      );
    }

    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE ${table}
      SET revision = revision + 1, updated_at = ?, source_ids_json = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      JSON.stringify(command.sourceIds),
      command.targetId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(
        `Publishing ${command.targetKind} revision conflict: ${command.targetId}`,
      );
    }
    return parsePublishingEvidenceLinksProjection({
      schemaVersion: 1,
      targetKind: command.targetKind,
      targetId: command.targetId,
      revision: revision + 1,
      sourceIds: command.sourceIds,
      updatedAt,
    });
  }

  async #applyPublishingPartnerCsvImportSerially(
    command: ApplyPublishingPartnerCsvImportCommand,
  ): Promise<PublishingPartnerCsvImportResult> {
    const currentRows = readStoredPublishingPartnerRows(this.#database);
    const preview = buildPublishingPartnerCsvImportPreview({
      fileName: command.fileName,
      csvText: command.csvText,
      mapping: command.mapping,
      partners: currentRows.map(projectStoredPublishingPartnerRow),
    });
    if (preview.fileIssues.length > 0) {
      throw new Error(
        `Publishing partner CSV has file issues: ${preview.fileIssues.join(",")}`,
      );
    }

    const newPartnerIds = new Map<number, EntityId<"PublishingPartner">>();
    for (const row of preview.readyRows) {
      if (row.existingPartnerId === null) {
        newPartnerIds.set(row.rowNumber, entityId<"PublishingPartner">(randomUUID()));
      }
    }
    const partnerIdByRow = new Map(
      preview.readyRows.map((row) => [
        row.rowNumber,
        row.existingPartnerId ?? newPartnerIds.get(row.rowNumber) as EntityId<"PublishingPartner">,
      ]),
    );
    const normalized = (value: string) =>
      value.trim().normalize("NFKC").toLocaleLowerCase();
    const partnerIdsByName = new Map<string, Set<EntityId<"PublishingPartner">>>();
    for (const row of currentRows) {
      const ids = partnerIdsByName.get(normalized(row.name)) ??
        new Set<EntityId<"PublishingPartner">>();
      ids.add(row.partnerId);
      partnerIdsByName.set(normalized(row.name), ids);
    }
    for (const row of preview.readyRows) {
      const partnerId = partnerIdByRow.get(row.rowNumber);
      if (partnerId === undefined) throw new Error(`Missing CSV partner ID: ${row.rowNumber}`);
      const ids = partnerIdsByName.get(normalized(row.values.name)) ??
        new Set<EntityId<"PublishingPartner">>();
      ids.add(partnerId);
      partnerIdsByName.set(normalized(row.values.name), ids);
    }
    const parentIdFor = (
      row: (typeof preview.readyRows)[number],
      current: StoredPublishingPartnerRow | null,
    ): EntityId<"PublishingPartner"> | null => {
      if (row.values.parentPartnerName === undefined) {
        return current?.parentPartnerId ?? null;
      }
      if (row.values.parentPartnerName.length === 0) return null;
      const matches = [...(
        partnerIdsByName.get(normalized(row.values.parentPartnerName)) ?? []
      )];
      if (matches.length !== 1) {
        throw new Error(`CSV parent resolution changed at row ${row.rowNumber}`);
      }
      return matches[0] ?? null;
    };

    const createdAt = new Date().toISOString();
    const sourceIds = new Map<number, EntityId<"PublishingSource">>();
    for (const row of preview.readyRows) {
      sourceIds.set(row.rowNumber, entityId<"PublishingSource">(randomUUID()));
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const row of preview.readyRows) {
        const sourceId = sourceIds.get(row.rowNumber);
        if (sourceId === undefined) throw new Error(`Missing CSV source ID: ${row.rowNumber}`);
        this.#database.prepare(`
          INSERT INTO publishing_sources (
            id, schema_version, revision, created_at, updated_at, retired_at,
            source_kind, label, url, observed_at, authority, imported_fields_json
          ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)
        `).run(
          sourceId,
          createdAt,
          createdAt,
          "text/csv",
          `${command.fileName} · ${row.rowNumber}행`,
          createdAt,
          "",
          JSON.stringify(row.rawFields),
        );
      }

      for (const row of preview.readyRows) {
        if (row.existingPartnerId !== null) continue;
        const partnerId = partnerIdByRow.get(row.rowNumber);
        const sourceId = sourceIds.get(row.rowNumber);
        if (partnerId === undefined || sourceId === undefined) {
          throw new Error(`Missing CSV insert identity: ${row.rowNumber}`);
        }
        this.#database.prepare(`
          INSERT INTO publishing_partners (
            id, schema_version, revision, created_at, updated_at, retired_at,
            name, parent_partner_id, submission_method, website_url, email,
            genres_json, required_length, priority, note, source_ids_json
          ) VALUES (?, 1, 1, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          partnerId,
          createdAt,
          createdAt,
          row.values.name,
          row.values.submissionMethod ?? "",
          row.values.websiteUrl ?? "",
          row.values.email ?? "",
          JSON.stringify(row.values.genres ?? []),
          row.values.requiredLength ?? "",
          row.values.priority ?? "",
          row.values.note ?? "",
          JSON.stringify([sourceId]),
        );
      }

      for (const row of preview.readyRows) {
        const partnerId = partnerIdByRow.get(row.rowNumber);
        const sourceId = sourceIds.get(row.rowNumber);
        if (partnerId === undefined || sourceId === undefined) {
          throw new Error(`Missing CSV update identity: ${row.rowNumber}`);
        }
        const current = row.existingPartnerId === null
          ? null
          : currentRows.find((candidate) => candidate.partnerId === row.existingPartnerId) ?? null;
        const parentPartnerId = parentIdFor(row, current);
        if (current === null) {
          const result = this.#database.prepare(`
            UPDATE publishing_partners
            SET parent_partner_id = ?
            WHERE id = ? AND revision = 1 AND retired_at IS NULL
          `).run(parentPartnerId, partnerId);
          if (Number(result.changes) !== 1) {
            throw new Error(`CSV partner insert changed before parent link: ${partnerId}`);
          }
          continue;
        }
        const result = this.#database.prepare(`
          UPDATE publishing_partners
          SET
            revision = revision + 1,
            updated_at = ?,
            name = ?,
            parent_partner_id = ?,
            submission_method = ?,
            website_url = ?,
            email = ?,
            genres_json = ?,
            required_length = ?,
            priority = ?,
            note = ?,
            source_ids_json = ?
          WHERE id = ? AND revision = ? AND retired_at IS NULL
        `).run(
          createdAt,
          row.values.name,
          parentPartnerId,
          row.values.submissionMethod ?? current.submissionMethod,
          row.values.websiteUrl ?? current.websiteUrl,
          row.values.email ?? current.email,
          JSON.stringify(row.values.genres ?? current.genres),
          row.values.requiredLength ?? current.requiredLength,
          row.values.priority ?? current.priority,
          row.values.note ?? current.note,
          JSON.stringify([...new Set([...current.sourceIds, sourceId])]),
          partnerId,
          current.revision,
        );
        if (Number(result.changes) !== 1) {
          throw new Error(`Publishing partner CSV revision conflict: ${partnerId}`);
        }
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    const partnerIds = preview.readyRows.map((row) => {
      const partnerId = partnerIdByRow.get(row.rowNumber);
      if (partnerId === undefined) throw new Error(`Missing imported partner ID: ${row.rowNumber}`);
      return partnerId;
    });
    const appliedSourceIds = preview.readyRows.map((row) => {
      const sourceId = sourceIds.get(row.rowNumber);
      if (sourceId === undefined) throw new Error(`Missing imported source ID: ${row.rowNumber}`);
      return sourceId;
    });
    return parsePublishingPartnerCsvImportResult({
      schemaVersion: 1,
      importedCount: preview.readyRows.length,
      createdCount: preview.readyRows.filter((row) => row.existingPartnerId === null).length,
      updatedCount: preview.readyRows.filter((row) => row.existingPartnerId !== null).length,
      skippedRowNumbers: preview.rowIssues.map((issue) => issue.rowNumber),
      partnerIds,
      sourceIds: appliedSourceIds,
    });
  }

  async #applyPublishingSubmissionCsvImportSerially(
    command: ApplyPublishingSubmissionCsvImportCommand,
  ): Promise<PublishingSubmissionCsvImportResult> {
    const partners = readStoredPublishingPartnerRows(this.#database)
      .filter((partner) => partner.retiredAt === null)
      .map(projectStoredPublishingPartnerRow);
    const preview = buildPublishingSubmissionCsvImportPreview({
      fileName: command.fileName,
      csvText: command.csvText,
      mapping: command.mapping,
      works: this.#state.catalog.works,
      partners,
    });
    if (preview.fileIssues.length > 0) {
      throw new Error(
        `Publishing submission CSV has file issues: ${preview.fileIssues.join(",")}`,
      );
    }

    const sealedAt = new Date().toISOString();
    const prepared = preview.readyRows.map((row) => {
      const work = this.#state.catalog.works.find((candidate) => candidate.workId === row.workId);
      const partner = partners.find((candidate) => candidate.partnerId === row.partnerId);
      if (work === undefined || partner === undefined) {
        throw new Error(`Publishing submission CSV relation changed at row ${row.rowNumber}`);
      }
      const documentRevisions = [...this.#state.documentTargets.values()]
        .filter((target) => target.workId === row.workId)
        .sort((left, right) => left.documentId.localeCompare(right.documentId))
        .map((target) => ({
          documentId: target.documentId,
          documentRevisionId: target.currentRevisionId,
        }));
      const structureRevisionRefs = this.#database
        .prepare(WORK_STRUCTURE_REVISION_ROWS_SQL)
        .all(
          row.workId,
          row.workId,
          row.workId,
          row.workId,
          row.workId,
          row.workId,
        )
        .map((entry, index) => {
          const label = `CSV submission Work structure revision rows[${index}]`;
          return {
            entityKind: readRequiredString(entry, "entityKind", label),
            entityId: readRequiredString(entry, "entityId", label),
            revision: readRequiredInteger(entry, "revision", label),
          };
        });
      const structureRevisionRefsJson = JSON.stringify(structureRevisionRefs);
      const workSnapshotManifest = JSON.stringify({
        schemaVersion: 1,
        workId: row.workId,
        documentRevisions,
        structureRevisionRefs,
      });
      const workSnapshotManifestHash = createHash(
        LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
      ).update(workSnapshotManifest, "utf8").digest("hex");
      const submissionId = entityId<"PublishingSubmission">(randomUUID());
      const submissionPackageId = entityId<"SubmissionPackage">(randomUUID());
      const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
      const sourceId = entityId<"PublishingSource">(randomUUID());
      const packageManifest = JSON.stringify({
        schemaVersion: 1,
        workId: row.workId,
        partnerId: row.partnerId,
        workSnapshotId,
        workTitleSnapshot: work.title,
        partnerNameSnapshot: partner.name,
        workSnapshotManifestHash,
        documentRevisions,
      });
      const packageManifestHash = createHash(
        LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
      ).update(packageManifest, "utf8").digest("hex");
      return {
        row,
        work,
        partner,
        documentRevisions,
        structureRevisionRefsJson,
        workSnapshotManifestHash,
        submissionId,
        submissionPackageId,
        workSnapshotId,
        sourceId,
        packageManifestHash,
      };
    });

    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const item of prepared) {
        transaction.write({
          kind: "publishingSource",
          ...createRecordMeta(sealedAt),
          id: item.sourceId,
          sourceKind: "text/csv",
          label: `${command.fileName} · ${item.row.rowNumber}행`,
          url: null,
          observedAt: sealedAt,
          authority: "",
          importedFields: item.row.rawFields,
        });
        transaction.write({
          kind: "workSnapshot",
          id: item.workSnapshotId,
          workId: item.row.workId,
          documentRevisions: item.documentRevisions,
          structureRevisionRefsJson: item.structureRevisionRefsJson,
          manifestHash: item.workSnapshotManifestHash,
          label: `submission:${item.submissionId}`,
          cause: "submission",
          createdAt: sealedAt,
        });
        transaction.write({
          kind: "submissionPackage",
          id: item.submissionPackageId,
          workId: item.row.workId,
          partnerId: item.row.partnerId,
          workSnapshotId: item.workSnapshotId,
          workTitleSnapshot: item.work.title,
          partnerNameSnapshot: item.partner.name,
          manifestHash: item.packageManifestHash,
          sealedAt,
        });
        transaction.write({
          kind: "publishingSubmission",
          ...createRecordMeta(sealedAt),
          id: item.submissionId,
          workId: item.row.workId,
          partnerId: item.row.partnerId,
          submissionPackageId: item.submissionPackageId,
          title: item.row.values.title ?? "",
          status: item.row.values.status ?? "",
          submittedOn: item.row.values.submittedOn ?? null,
          respondedOn: item.row.values.respondedOn ?? null,
          result: item.row.values.result ?? "",
          note: item.row.values.note ?? "",
          cardNote: item.row.values.cardNote ?? "",
          sourceIds: [item.sourceId],
        });
      }
    });

    return parsePublishingSubmissionCsvImportResult({
      schemaVersion: 1,
      importedCount: prepared.length,
      skippedRowNumbers: preview.rowIssues.map((issue) => issue.rowNumber),
      submissionIds: prepared.map((item) => item.submissionId),
      submissionPackageIds: prepared.map((item) => item.submissionPackageId),
      sourceIds: prepared.map((item) => item.sourceId),
    });
  }

  async #recordPublishingMailCandidateSerially(
    command: RecordPublishingMailCandidateCommand,
  ): Promise<PublishingMailCandidateProjection> {
    const existing = readStoredPublishingMailCandidateRowBySource(
      this.#database,
      command.sourceAccountId,
      command.messageId,
    );
    if (existing !== null) {
      return projectStoredPublishingMailCandidateRow(existing);
    }

    const createdAt = new Date().toISOString();
    const sourceId = entityId<"PublishingSource">(randomUUID());
    const candidateId = entityId<"PublishingMailCandidate">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "publishingSource",
        ...createRecordMeta(createdAt),
        id: sourceId,
        sourceKind: "message/metadata",
        label: command.messageId,
        url: null,
        observedAt: command.receivedAt,
        authority: command.sourceAccountId,
        importedFields: {
          sourceAccountId: command.sourceAccountId,
          messageId: command.messageId,
          threadId: command.threadId,
          from: command.from,
          subject: command.subject,
          receivedAt: command.receivedAt,
          snippet: command.snippet,
          bodyFingerprint: command.bodyFingerprint,
        },
      });
      transaction.write({
        kind: "publishingMailCandidate",
        ...createRecordMeta(createdAt),
        id: candidateId,
        sourceId,
        sourceAccountId: command.sourceAccountId,
        messageId: command.messageId,
        threadId: command.threadId,
        from: command.from,
        subject: command.subject,
        receivedAt: command.receivedAt,
        snippet: command.snippet,
        bodyFingerprint: command.bodyFingerprint,
        submissionId: null,
        matchReason: command.matchReason,
        proposedStatus: command.proposedStatus,
        proposedResult: command.proposedResult,
        proposedRespondedOn: command.proposedRespondedOn,
        proposedNote: command.proposedNote,
        classificationConnectionId: command.classificationConnectionId,
        classificationModel: command.classificationModel,
        reviewStatus: "needs-link",
      });
    });

    const stored = readStoredPublishingMailCandidateRowById(
      this.#database,
      candidateId,
    );
    if (stored === null) {
      throw new Error(`Recorded publishing mail candidate is missing: ${candidateId}`);
    }
    return projectStoredPublishingMailCandidateRow(stored);
  }

  async #linkPublishingMailCandidateSerially(
    command: LinkPublishingMailCandidateCommand,
  ): Promise<PublishingMailCandidateProjection> {
    const current = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing mail candidate: ${command.candidateId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
    }
    if (current.reviewStatus === "approved" || current.reviewStatus === "ignored") {
      throw new Error(`Publishing mail candidate is already reviewed: ${command.candidateId}`);
    }
    const submission = readStoredPublishingSubmissionRowById(
      this.#database,
      command.submissionId,
    );
    if (submission === null || submission.retiredAt !== null) {
      throw new Error(`Unknown publishing submission: ${command.submissionId}`);
    }

    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_mail_candidates
      SET
        revision = revision + 1,
        updated_at = ?,
        submission_id = ?,
        review_status = 'unreviewed'
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      command.submissionId,
      command.candidateId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
    }
    const stored = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Linked publishing mail candidate is missing: ${command.candidateId}`);
    }
    return projectStoredPublishingMailCandidateRow(stored);
  }

  async #updatePublishingMailCandidateSerially(
    command: UpdatePublishingMailCandidateCommand,
  ): Promise<PublishingMailCandidateProjection> {
    const current = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing mail candidate: ${command.candidateId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
    }
    if (current.reviewStatus === "approved" || current.reviewStatus === "ignored") {
      throw new Error(`Publishing mail candidate is already reviewed: ${command.candidateId}`);
    }

    const proposedRespondedOn = Object.hasOwn(
      command.changes,
      "proposedRespondedOn",
    )
      ? command.changes.proposedRespondedOn ?? null
      : current.proposedRespondedOn;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE publishing_mail_candidates
      SET
        revision = revision + 1,
        updated_at = ?,
        proposed_status = ?,
        proposed_result = ?,
        proposed_responded_on = ?,
        proposed_note = ?
      WHERE id = ? AND revision = ? AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.proposedStatus ?? current.proposedStatus,
      command.changes.proposedResult ?? current.proposedResult,
      proposedRespondedOn,
      command.changes.proposedNote ?? current.proposedNote,
      command.candidateId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
    }
    const stored = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Updated publishing mail candidate is missing: ${command.candidateId}`);
    }
    return projectStoredPublishingMailCandidateRow(stored);
  }

  async #reviewPublishingMailCandidateSerially(
    command: ReviewPublishingMailCandidateCommand,
  ): Promise<PublishingMailCandidateReviewResult> {
    const current = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown publishing mail candidate: ${command.candidateId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
    }
    if (current.reviewStatus === "approved" || current.reviewStatus === "ignored") {
      throw new Error(`Publishing mail candidate is already reviewed: ${command.candidateId}`);
    }

    const updatedAt = new Date().toISOString();
    if (command.decision === "ignore") {
      const result = this.#database.prepare(`
        UPDATE publishing_mail_candidates
        SET revision = revision + 1, updated_at = ?, review_status = 'ignored'
        WHERE id = ? AND revision = ? AND retired_at IS NULL
      `).run(updatedAt, command.candidateId, command.expectedRevision);
      if (Number(result.changes) !== 1) {
        throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
      }
      const ignored = readStoredPublishingMailCandidateRowById(
        this.#database,
        command.candidateId,
      );
      if (ignored === null) {
        throw new Error(`Ignored publishing mail candidate is missing: ${command.candidateId}`);
      }
      return parsePublishingMailCandidateReviewResult({
        schemaVersion: 1,
        candidate: projectStoredPublishingMailCandidateRow(ignored),
        submission: null,
      });
    }

    if (current.reviewStatus !== "unreviewed" || current.submissionId === null) {
      throw new Error(`Publishing mail candidate requires an explicit submission link: ${command.candidateId}`);
    }
    const submission = readStoredPublishingSubmissionRowById(
      this.#database,
      current.submissionId,
    );
    if (submission === null || submission.retiredAt !== null) {
      throw new Error(`Unknown publishing submission: ${current.submissionId}`);
    }
    const sourceIds = [...new Set([...submission.sourceIds, current.sourceId])];

    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const submissionResult = this.#database.prepare(`
        UPDATE publishing_submissions
        SET
          revision = revision + 1,
          updated_at = ?,
          status = ?,
          responded_on = ?,
          result = ?,
          note = ?,
          source_ids_json = ?
        WHERE id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        updatedAt,
        current.proposedStatus,
        current.proposedRespondedOn,
        current.proposedResult,
        current.proposedNote,
        JSON.stringify(sourceIds),
        submission.submissionId,
        submission.revision,
      );
      if (Number(submissionResult.changes) !== 1) {
        throw new Error(`Publishing submission revision conflict: ${submission.submissionId}`);
      }
      const candidateResult = this.#database.prepare(`
        UPDATE publishing_mail_candidates
        SET revision = revision + 1, updated_at = ?, review_status = 'approved'
        WHERE id = ? AND revision = ? AND retired_at IS NULL
      `).run(updatedAt, command.candidateId, command.expectedRevision);
      if (Number(candidateResult.changes) !== 1) {
        throw new Error(`Publishing mail candidate revision conflict: ${command.candidateId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    const approved = readStoredPublishingMailCandidateRowById(
      this.#database,
      command.candidateId,
    );
    const updatedSubmission = readStoredPublishingSubmissionRowById(
      this.#database,
      submission.submissionId,
    );
    if (approved === null || updatedSubmission === null) {
      throw new Error(`Approved publishing mail candidate result is missing: ${command.candidateId}`);
    }
    return parsePublishingMailCandidateReviewResult({
      schemaVersion: 1,
      candidate: projectStoredPublishingMailCandidateRow(approved),
      submission: projectStoredPublishingSubmissionRow(updatedSubmission),
    });
  }
}

