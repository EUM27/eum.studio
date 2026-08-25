import { useCallback, useState } from "react";

import type {
  PublishingPartnerProjection,
  UpdatePublishingPartnerCommand,
} from "../../../application/publishing/publishing-partner-contract";
import type {
  PublishingSubmissionProjection,
  UpdatePublishingSubmissionCommand,
} from "../../../application/publishing/publishing-submission-contract";
import type {
  PublishingContractProjection,
  UpdatePublishingContractCommand,
} from "../../../application/publishing/publishing-contract-contract";
import type {
  PublishingPublicationProjection,
  UpdatePublishingPublicationCommand,
} from "../../../application/publishing/publishing-publication-contract";
import type {
  PublishingSettlementProjection,
  UpdatePublishingSettlementCommand,
} from "../../../application/publishing/publishing-settlement-contract";
import type {
  PublishingPaymentProjection,
  UpdatePublishingPaymentCommand,
} from "../../../application/publishing/publishing-payment-contract";
import type { PublishingSourceProjection } from "../../../application/publishing/publishing-source-contract";
import type { PublishingEvidenceTargetKind } from "../../../application/publishing/publishing-evidence-link-contract";
import type {
  ApplyPublishingPartnerCsvImportCommand,
  PublishingPartnerCsvSelectionProjection,
} from "../../../application/publishing/publishing-partner-csv-import";
import type {
  ApplyPublishingSubmissionCsvImportCommand,
  PublishingSubmissionCsvSelectionProjection,
} from "../../../application/publishing/publishing-submission-csv-import";
import type {
  PublishingMailCandidateProjection,
  UpdatePublishingMailCandidateCommand,
} from "../../../application/publishing/publishing-mail-candidate-contract";
import type {
  PublishingMailConnectionProjection,
  PublishingMailSyncResult,
} from "../../../application/publishing/publishing-mail-connection-contract";
import type { PublishingMailScheduleProjection } from "../../../application/publishing/publishing-mail-schedule-contract";
import type {
  ApprovePublishingResearchCommand,
  PreviewPublishingResearchCommand,
  PublishingResearchCandidateProjection,
} from "../../../application/publishing/publishing-research-contract";
import type { PublishingAssistantResult } from "../../../application/publishing/publishing-assistant-contract";
import type { AssistantConnectionProjection } from "../../../application/assistant/assistant-connection";
import { entityId, type EntityId } from "../../../domain/writing";
import type {
  PublishingPartnerDialogActionState,
  PublishingPartnerDraft,
  PublishingContractDraft,
  PublishingPublicationDraft,
  PublishingSettlementDraft,
  PublishingPaymentDraft,
  PublishingSourceDraft,
  PublishingSubmissionDraft,
} from "../../publishing/PublishingPartnerDialog";
import type { WorkOperationsSection } from "../../workspace/WorkOperationsWorkspace";
import {
  loadPublishingControllerState,
  type PublishingClient,
} from "./publishing-client";
import {
  applyPublishingEvidenceUpdate,
  prependPublishingRecord,
  publishingActionIsIdle,
  publishingRouteForClose,
  publishingRouteForOpen,
  reconcilePublishingSelection,
  replacePublishingRecord,
} from "./publishing-state";

export function usePublishingController(client: PublishingClient) {
  const [showPublishingPartners, setShowPublishingPartners] = useState(false);
  const [publishingInitialSection, setPublishingInitialSection] = useState<
    "submissions" | "contracts" | "settlements"
  >("submissions");
  const [publishingWorkScopeId, setPublishingWorkScopeId] = useState<
    EntityId<"Work"> | null
  >(null);

  const [publishingPartners, setPublishingPartners] = useState<
    readonly PublishingPartnerProjection[]
  >([]);
  const [selectedPublishingPartnerId, setSelectedPublishingPartnerId] =
    useState<string | null>(null);
  const [publishingSubmissions, setPublishingSubmissions] = useState<
    readonly PublishingSubmissionProjection[]
  >([]);
  const [selectedPublishingSubmissionId, setSelectedPublishingSubmissionId] =
    useState<string | null>(null);
  const [publishingContracts, setPublishingContracts] = useState<
    readonly PublishingContractProjection[]
  >([]);
  const [selectedPublishingContractId, setSelectedPublishingContractId] =
    useState<string | null>(null);
  const [publishingPublications, setPublishingPublications] = useState<
    readonly PublishingPublicationProjection[]
  >([]);
  const [selectedPublishingPublicationId, setSelectedPublishingPublicationId] =
    useState<string | null>(null);
  const [publishingSettlements, setPublishingSettlements] = useState<
    readonly PublishingSettlementProjection[]
  >([]);
  const [selectedPublishingSettlementId, setSelectedPublishingSettlementId] =
    useState<string | null>(null);
  const [publishingPayments, setPublishingPayments] = useState<
    readonly PublishingPaymentProjection[]
  >([]);
  const [selectedPublishingPaymentId, setSelectedPublishingPaymentId] =
    useState<string | null>(null);
  const [publishingSources, setPublishingSources] = useState<
    readonly PublishingSourceProjection[]
  >([]);
  const [publishingAssistantConnections, setPublishingAssistantConnections] =
    useState<readonly AssistantConnectionProjection[]>([]);
  const [publishingMailCandidates, setPublishingMailCandidates] = useState<
    readonly PublishingMailCandidateProjection[]
  >([]);
  const [publishingMailConnection, setPublishingMailConnection] = useState<
    PublishingMailConnectionProjection | null
  >(null);
  const [publishingMailSyncResult, setPublishingMailSyncResult] = useState<
    PublishingMailSyncResult | null
  >(null);
  const [publishingMailSchedule, setPublishingMailSchedule] = useState<
    PublishingMailScheduleProjection | null
  >(null);
  const [selectedPublishingSourceId, setSelectedPublishingSourceId] =
    useState<string | null>(null);
  const [publishingPartnerActionState, setPublishingPartnerActionState] =
    useState<PublishingPartnerDialogActionState>("idle");
  const [publishingPartnerError, setPublishingPartnerError] = useState<
    string | null
  >(null);

  const openPublishingPartners = useCallback((
    section: WorkOperationsSection = "submissions",
    workId: EntityId<"Work"> | null = null,
  ) => {
    const route = publishingRouteForOpen(section, workId);
    setPublishingInitialSection(route.publishingInitialSection);
    setPublishingWorkScopeId(route.publishingWorkScopeId);
    setShowPublishingPartners(route.showPublishingPartners);
    setPublishingPartnerActionState(route.publishingPartnerActionState);
    setPublishingPartnerError(route.publishingPartnerError);
    void loadPublishingControllerState(client, workId).then(
      ([
        partnerProjection,
        submissionProjection,
        contractProjection,
        publicationProjection,
        settlementProjection,
        paymentProjection,
        sourceProjection,
        mailCandidateProjection,
        mailConnectionProjection,
        mailScheduleProjection,
        assistantConnectionProjection,
      ]) => {
        setPublishingPartners(partnerProjection.partners);
        setPublishingSubmissions(submissionProjection.submissions);
        setPublishingContracts(contractProjection.contracts);
        setPublishingPublications(publicationProjection.publications);
        setPublishingSettlements(settlementProjection.settlements);
        setPublishingPayments(paymentProjection.payments);
        setPublishingSources(sourceProjection.sources);
        setPublishingMailCandidates(mailCandidateProjection.candidates);
        setPublishingMailConnection(mailConnectionProjection);
        setPublishingMailSchedule(mailScheduleProjection);
        setPublishingAssistantConnections(assistantConnectionProjection.connections);
        setPublishingMailSyncResult(null);
        setSelectedPublishingPartnerId((current) =>
          reconcilePublishingSelection(
            current,
            partnerProjection.partners,
            (partner) => partner.partnerId,
          ),
        );
        setSelectedPublishingSubmissionId((current) =>
          reconcilePublishingSelection(
            current,
            submissionProjection.submissions,
            (submission) => submission.submissionId,
          ),
        );
        setSelectedPublishingContractId((current) =>
          reconcilePublishingSelection(
            current,
            contractProjection.contracts,
            (contract) => contract.contractId,
          ),
        );
        setSelectedPublishingPublicationId((current) =>
          reconcilePublishingSelection(
            current,
            publicationProjection.publications,
            (publication) => publication.publicationId,
          ),
        );
        setSelectedPublishingSettlementId((current) =>
          reconcilePublishingSelection(
            current,
            settlementProjection.settlements,
            (settlement) => settlement.settlementId,
          ),
        );
        setSelectedPublishingPaymentId((current) =>
          reconcilePublishingSelection(
            current,
            paymentProjection.payments,
            (payment) => payment.paymentId,
          ),
        );
        setSelectedPublishingSourceId((current) =>
          reconcilePublishingSelection(
            current,
            sourceProjection.sources,
            (source) => source.sourceId,
          ),
        );
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("투고 운영 원장을 불러오지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client]);

  const createPublishingPartner = useCallback(
    (draft: PublishingPartnerDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating");
      setPublishingPartnerError(null);
      void client.publishingPartners.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPartners((current) => Object.freeze([
            created,
            ...current.filter(
              (partner) => partner.partnerId !== created.partnerId,
            ),
          ]));
          setSelectedPublishingPartnerId(created.partnerId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고처를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingPartner = useCallback(
    (
      partner: PublishingPartnerProjection,
      changes: UpdatePublishingPartnerCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating");
      setPublishingPartnerError(null);
      void client.publishingPartners.update({
        schemaVersion: 1,
        partnerId: partner.partnerId,
        expectedRevision: partner.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPartners((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.partnerId !== updated.partnerId,
            ),
          ]));
          setSelectedPublishingPartnerId(updated.partnerId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고처 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingSubmission = useCallback(
    (draft: PublishingSubmissionDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-submission");
      setPublishingPartnerError(null);
      void client.publishingSubmissions.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSubmissions((current) => Object.freeze([
            created,
            ...current.filter(
              (submission) => submission.submissionId !== created.submissionId,
            ),
          ]));
          setSelectedPublishingSubmissionId(created.submissionId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고 이력을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingSubmission = useCallback(
    (
      submission: PublishingSubmissionProjection,
      changes: UpdatePublishingSubmissionCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating-submission");
      setPublishingPartnerError(null);
      void client.publishingSubmissions.update({
        schemaVersion: 1,
        submissionId: submission.submissionId,
        expectedRevision: submission.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingSubmissions((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.submissionId !== updated.submissionId,
            ),
          ]));
          setSelectedPublishingSubmissionId(updated.submissionId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("투고 이력 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingContract = useCallback(
    (draft: PublishingContractDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-contract");
      setPublishingPartnerError(null);
      void client.publishingContracts.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingContracts((current) => Object.freeze([
            created,
            ...current.filter((contract) => contract.contractId !== created.contractId),
          ]));
          setSelectedPublishingContractId(created.contractId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("계약을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingContract = useCallback(
    (
      contract: PublishingContractProjection,
      changes: UpdatePublishingContractCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating-contract");
      setPublishingPartnerError(null);
      void client.publishingContracts.update({
        schemaVersion: 1,
        contractId: contract.contractId,
        expectedRevision: contract.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingContracts((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.contractId !== updated.contractId,
            ),
          ]));
          setSelectedPublishingContractId(updated.contractId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("계약 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingPublication = useCallback(
    (draft: PublishingPublicationDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-publication");
      setPublishingPartnerError(null);
      void client.publishingPublications.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPublications((current) => Object.freeze([
            created,
            ...current.filter(
              (publication) => publication.publicationId !== created.publicationId,
            ),
          ]));
          setSelectedPublishingPublicationId(created.publicationId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("발행·연재 항목을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingPublication = useCallback(
    (
      publication: PublishingPublicationProjection,
      changes: UpdatePublishingPublicationCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating-publication");
      setPublishingPartnerError(null);
      void client.publishingPublications.update({
        schemaVersion: 1,
        publicationId: publication.publicationId,
        expectedRevision: publication.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPublications((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.publicationId !== updated.publicationId,
            ),
          ]));
          setSelectedPublishingPublicationId(updated.publicationId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("발행·연재 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingSettlement = useCallback(
    (draft: PublishingSettlementDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-settlement");
      setPublishingPartnerError(null);
      void client.publishingSettlements.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSettlements((current) => Object.freeze([
            created,
            ...current.filter(
              (settlement) => settlement.settlementId !== created.settlementId,
            ),
          ]));
          setSelectedPublishingSettlementId(created.settlementId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("정산서를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingSettlement = useCallback(
    (
      settlement: PublishingSettlementProjection,
      changes: UpdatePublishingSettlementCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating-settlement");
      setPublishingPartnerError(null);
      void client.publishingSettlements.update({
        schemaVersion: 1,
        settlementId: settlement.settlementId,
        expectedRevision: settlement.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingSettlements((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.settlementId !== updated.settlementId,
            ),
          ]));
          setSelectedPublishingSettlementId(updated.settlementId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("정산서 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingPayment = useCallback(
    (draft: PublishingPaymentDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-payment");
      setPublishingPartnerError(null);
      void client.publishingPayments.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingPayments((current) => Object.freeze([
            created,
            ...current.filter(
              (payment) => payment.paymentId !== created.paymentId,
            ),
          ]));
          setSelectedPublishingPaymentId(created.paymentId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("입금을 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const updatePublishingPayment = useCallback(
    (
      payment: PublishingPaymentProjection,
      changes: UpdatePublishingPaymentCommand["changes"],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("updating-payment");
      setPublishingPartnerError(null);
      void client.publishingPayments.update({
        schemaVersion: 1,
        paymentId: payment.paymentId,
        expectedRevision: payment.revision,
        changes,
      }).then(
        (updated) => {
          setPublishingPayments((current) => Object.freeze([
            updated,
            ...current.filter(
              (candidate) => candidate.paymentId !== updated.paymentId,
            ),
          ]));
          setSelectedPublishingPaymentId(updated.paymentId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("입금 변경을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const createPublishingSource = useCallback(
    (draft: PublishingSourceDraft) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("creating-source");
      setPublishingPartnerError(null);
      void client.publishingSources.create({
        schemaVersion: 1,
        ...draft,
      }).then(
        (created) => {
          setPublishingSources((current) => Object.freeze([
            created,
            ...current.filter((source) => source.sourceId !== created.sourceId),
          ]));
          setSelectedPublishingSourceId(created.sourceId);
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("근거를 추가하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const setPublishingEvidenceLinks = useCallback(
    (
      targetKind: PublishingEvidenceTargetKind,
      targetId: string,
      expectedRevision: number,
      sourceIds: readonly string[],
    ) => {
      if (!publishingActionIsIdle(publishingPartnerActionState)) return;
      setPublishingPartnerActionState("saving-evidence-links");
      setPublishingPartnerError(null);
      void client.publishingEvidence.setLinks({
        schemaVersion: 1,
        targetKind,
        targetId,
        expectedRevision,
        sourceIds: sourceIds.map((sourceId) =>
          entityId<"PublishingSource">(sourceId)),
      }).then(
        (updated) => {
          switch (updated.targetKind) {
            case "partner":
              setPublishingPartners((current) => Object.freeze(current.map(
                (record) => record.partnerId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
            case "submission":
              setPublishingSubmissions((current) => Object.freeze(current.map(
                (record) => record.submissionId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
            case "contract":
              setPublishingContracts((current) => Object.freeze(current.map(
                (record) => record.contractId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
            case "publication":
              setPublishingPublications((current) => Object.freeze(current.map(
                (record) => record.publicationId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
            case "settlement":
              setPublishingSettlements((current) => Object.freeze(current.map(
                (record) => record.settlementId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
            case "payment":
              setPublishingPayments((current) => Object.freeze(current.map(
                (record) => record.paymentId === updated.targetId ? applyPublishingEvidenceUpdate(record, updated) : record,
              )));
              break;
          }
          setPublishingPartnerActionState("idle");
        },
        () => {
          setPublishingPartnerError("근거 연결을 저장하지 못했습니다.");
          setPublishingPartnerActionState("idle");
        },
      );
    },
    [client, publishingPartnerActionState],
  );

  const previewPublishingResearch = useCallback(async (
    command: Omit<PreviewPublishingResearchCommand, "schemaVersion">,
  ): Promise<PublishingResearchCandidateProjection | null> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return null;
    setPublishingPartnerActionState("previewing-research");
    setPublishingPartnerError(null);
    try {
      const candidate = await client.publishingResearch.preview({
        schemaVersion: 1,
        ...command,
      });
      setPublishingPartnerActionState("idle");
      return candidate;
    } catch {
      setPublishingPartnerError("웹 자료를 현재 투고처 값과 비교하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [client, publishingPartnerActionState]);

  const approvePublishingResearch = useCallback(async (
    command: Omit<ApprovePublishingResearchCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return false;
    setPublishingPartnerActionState("approving-research");
    setPublishingPartnerError(null);
    try {
      const result = await client.publishingResearch.approve({
        schemaVersion: 1,
        ...command,
      });
      setPublishingPartners((current) => replacePublishingRecord(
        current,
        result.partner,
        (partner) => partner.partnerId,
      ));
      setPublishingSources((current) => prependPublishingRecord(
        current,
        result.source,
      ));
      setSelectedPublishingPartnerId(result.partner.partnerId);
      setSelectedPublishingSourceId(result.source.sourceId);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("선택한 웹 자료 필드를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [client, publishingPartnerActionState]);

  const runPublishingAssistant = useCallback(async (
    connectionId: EntityId<"AssistantConnection">,
    statement: string,
  ): Promise<PublishingAssistantResult | null> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return null;
    setPublishingPartnerActionState("running-assistant");
    setPublishingPartnerError(null);
    try {
      const result = await client.publishingAssistant.run({
        schemaVersion: 1,
        requestId: entityId<"AssistantConnectorRequest">(crypto.randomUUID()),
        connectionId,
        statement,
      });
      setPublishingPartnerActionState("idle");
      return result;
    } catch {
      setPublishingPartnerError("작업실 조수 요청을 해석하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [client, publishingPartnerActionState]);

  const approvePublishingAssistant = useCallback(async (
    candidateId: string,
  ): Promise<boolean> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return false;
    setPublishingPartnerActionState("approving-assistant");
    setPublishingPartnerError(null);
    try {
      const result = await client.publishingAssistant.approve({
        schemaVersion: 1,
        candidateId,
      });
      setPublishingSources((current) => Object.freeze([
        result.source,
        ...current.filter((source) => source.sourceId !== result.source.sourceId),
      ]));
      setPublishingSubmissions((current) => Object.freeze([
        ...result.submissions,
        ...current.filter((submission) => !result.submissions.some(
          (created) => created.submissionId === submission.submissionId,
        )),
      ]));
      setSelectedPublishingSourceId(result.source.sourceId);
      setSelectedPublishingSubmissionId(result.submissions[0]?.submissionId ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("작업실 조수의 투고 기록을 저장하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [client, publishingPartnerActionState]);

  const selectPublishingPartnerCsv = useCallback(async (): Promise<
    PublishingPartnerCsvSelectionProjection | null
  > => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return null;
    setPublishingPartnerActionState("selecting-partner-csv");
    setPublishingPartnerError(null);
    try {
      const selection = await client.publishingImports.selectPartnerCsv({
        schemaVersion: 1,
      });
      setPublishingPartnerActionState("idle");
      return selection;
    } catch {
      setPublishingPartnerError("투고처 CSV 파일을 읽지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [client, publishingPartnerActionState]);

  const applyPublishingPartnerCsv = useCallback(async (
    command: Omit<ApplyPublishingPartnerCsvImportCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return false;
    setPublishingPartnerActionState("applying-partner-csv");
    setPublishingPartnerError(null);
    try {
      const result = await client.publishingImports.applyPartnerCsv({
        schemaVersion: 1,
        ...command,
      });
      const [partnerProjection, sourceProjection] = await Promise.all([
        client.publishingPartners.list({ schemaVersion: 1 }),
        client.publishingSources.list({ schemaVersion: 1 }),
      ]);
      setPublishingPartners(partnerProjection.partners);
      setPublishingSources(sourceProjection.sources);
      setSelectedPublishingPartnerId(result.partnerIds[0] ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("투고처 CSV를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [client, publishingPartnerActionState]);

  const selectPublishingSubmissionCsv = useCallback(async (): Promise<
    PublishingSubmissionCsvSelectionProjection | null
  > => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return null;
    setPublishingPartnerActionState("selecting-submission-csv");
    setPublishingPartnerError(null);
    try {
      const selection = await client.publishingImports.selectSubmissionCsv({
        schemaVersion: 1,
      });
      setPublishingPartnerActionState("idle");
      return selection;
    } catch {
      setPublishingPartnerError("투고 이력 CSV 파일을 읽지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return null;
    }
  }, [client, publishingPartnerActionState]);

  const applyPublishingSubmissionCsv = useCallback(async (
    command: Omit<ApplyPublishingSubmissionCsvImportCommand, "schemaVersion">,
  ): Promise<boolean> => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return false;
    setPublishingPartnerActionState("applying-submission-csv");
    setPublishingPartnerError(null);
    try {
      const result = await client.publishingImports.applySubmissionCsv({
        schemaVersion: 1,
        ...command,
      });
      const [submissionProjection, sourceProjection] = await Promise.all([
        client.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        client.publishingSources.list({ schemaVersion: 1 }),
      ]);
      setPublishingSubmissions(submissionProjection.submissions);
      setPublishingSources(sourceProjection.sources);
      setSelectedPublishingSubmissionId(result.submissionIds[0] ?? null);
      setPublishingPartnerActionState("idle");
      return true;
    } catch {
      setPublishingPartnerError("투고 이력 CSV를 반영하지 못했습니다.");
      setPublishingPartnerActionState("idle");
      return false;
    }
  }, [client, publishingPartnerActionState]);

  const linkPublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    submissionId: PublishingSubmissionProjection["submissionId"],
  ) => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("linking-mail-candidate");
    setPublishingPartnerError(null);
    void client.publishingMailCandidates.link({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      submissionId,
    }).then(
      (updated) => {
        setPublishingMailCandidates((current) => Object.freeze(current.map(
          (item) => item.candidateId === updated.candidateId ? updated : item,
        )));
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 후보를 투고에 연결하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client, publishingPartnerActionState]);

  const connectPublishingMail = useCallback((
    connectorKind: string,
    clientId: string,
  ) => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("connecting-mail");
    setPublishingPartnerError(null);
    void client.publishingMailConnection.connect({
      schemaVersion: 1,
      connectorKind,
      clientId,
    }).then(
      (connection) => {
        setPublishingMailConnection(connection);
        setPublishingMailSyncResult(null);
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 계정을 연결하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client, publishingPartnerActionState]);

  const syncPublishingMail = useCallback(() => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("syncing-mail");
    setPublishingPartnerError(null);
    void (async () => {
      try {
        const result = await client.publishingMailConnection.sync({
          schemaVersion: 1,
        });
        const [connection, candidates, schedule] = await Promise.all([
          client.publishingMailConnection.status({ schemaVersion: 1 }),
          client.publishingMailCandidates.list({ schemaVersion: 1 }),
          client.publishingMailSchedule.status({ schemaVersion: 1 }),
        ]);
        setPublishingMailConnection(connection);
        setPublishingMailCandidates(candidates.candidates);
        setPublishingMailSchedule(schedule);
        setPublishingMailSyncResult(result);
      } catch {
        setPublishingPartnerError("메일 회신을 동기화하지 못했습니다.");
        void client.publishingMailSchedule.status({ schemaVersion: 1 }).then(
          setPublishingMailSchedule,
          () => undefined,
        );
      } finally {
        setPublishingPartnerActionState("idle");
      }
    })();
  }, [client, publishingPartnerActionState]);

  const savePublishingMailSchedule = useCallback((
    enabled: boolean,
    localTime: string | null,
  ) => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("saving-mail-schedule");
    setPublishingPartnerError(null);
    void (async () => {
      try {
        const schedule = await client.publishingMailSchedule.save({
          schemaVersion: 1,
          enabled,
          localTime,
        });
        const [connection, candidates] = await Promise.all([
          client.publishingMailConnection.status({ schemaVersion: 1 }),
          client.publishingMailCandidates.list({ schemaVersion: 1 }),
        ]);
        setPublishingMailSchedule(schedule);
        setPublishingMailConnection(connection);
        setPublishingMailCandidates(candidates.candidates);
      } catch {
        setPublishingPartnerError("메일 자동 확인 일정을 저장하지 못했습니다.");
      } finally {
        setPublishingPartnerActionState("idle");
      }
    })();
  }, [client, publishingPartnerActionState]);

  const disconnectPublishingMail = useCallback(() => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("disconnecting-mail");
    setPublishingPartnerError(null);
    void client.publishingMailConnection.disconnect({
      schemaVersion: 1,
    }).then(
      (connection) => {
        setPublishingMailConnection(connection);
        setPublishingMailSyncResult(null);
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 계정 연결을 해제하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client, publishingPartnerActionState]);

  const updatePublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    changes: UpdatePublishingMailCandidateCommand["changes"],
  ) => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("updating-mail-candidate");
    setPublishingPartnerError(null);
    void client.publishingMailCandidates.update({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      changes,
    }).then(
      (updated) => {
        setPublishingMailCandidates((current) => Object.freeze(current.map(
          (item) => item.candidateId === updated.candidateId ? updated : item,
        )));
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError("메일 후보 제안을 저장하지 못했습니다.");
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client, publishingPartnerActionState]);

  const reviewPublishingMailCandidate = useCallback((
    candidate: PublishingMailCandidateProjection,
    decision: "approve" | "ignore",
  ) => {
    if (!publishingActionIsIdle(publishingPartnerActionState)) return;
    setPublishingPartnerActionState("reviewing-mail-candidate");
    setPublishingPartnerError(null);
    void client.publishingMailCandidates.review({
      schemaVersion: 1,
      candidateId: candidate.candidateId,
      expectedRevision: candidate.revision,
      decision,
    }).then(
      (result) => {
        setPublishingMailCandidates((current) => replacePublishingRecord(
          current,
          result.candidate,
          (item) => item.candidateId,
        ));
        const submission = result.submission;
        if (submission !== null) {
          setPublishingSubmissions((current) => replacePublishingRecord(
            current,
            submission,
            (item) => item.submissionId,
          ));
        }
        setPublishingPartnerActionState("idle");
      },
      () => {
        setPublishingPartnerError(
          decision === "approve"
            ? "메일 후보를 투고 이력에 반영하지 못했습니다."
            : "메일 후보를 무시 처리하지 못했습니다.",
        );
        setPublishingPartnerActionState("idle");
      },
    );
  }, [client, publishingPartnerActionState]);

  const closePublishingPartners = useCallback(() => {
    const route = publishingRouteForClose(publishingPartnerActionState);
    if (route === null) return;
    setShowPublishingPartners(route.showPublishingPartners);
    setPublishingPartnerError(route.publishingPartnerError);
  }, [publishingPartnerActionState]);

  const selectPublishingPartner = useCallback((partnerId: string | null) => {
    setSelectedPublishingPartnerId(partnerId);
  }, []);
  const selectPublishingSubmission = useCallback((submissionId: string | null) => {
    setSelectedPublishingSubmissionId(submissionId);
  }, []);
  const selectPublishingContract = useCallback((contractId: string | null) => {
    setSelectedPublishingContractId(contractId);
  }, []);
  const selectPublishingPublication = useCallback((publicationId: string | null) => {
    setSelectedPublishingPublicationId(publicationId);
  }, []);
  const selectPublishingSettlement = useCallback((settlementId: string | null) => {
    setSelectedPublishingSettlementId(settlementId);
  }, []);
  const selectPublishingPayment = useCallback((paymentId: string | null) => {
    setSelectedPublishingPaymentId(paymentId);
  }, []);
  const selectPublishingSource = useCallback((sourceId: string | null) => {
    setSelectedPublishingSourceId(sourceId);
  }, []);

  return {
    showPublishingPartners,
    publishingInitialSection,
    publishingWorkScopeId,
    publishingPartners,
    selectedPublishingPartnerId,
    publishingSubmissions,
    selectedPublishingSubmissionId,
    publishingContracts,
    selectedPublishingContractId,
    publishingPublications,
    selectedPublishingPublicationId,
    publishingSettlements,
    selectedPublishingSettlementId,
    publishingPayments,
    selectedPublishingPaymentId,
    publishingSources,
    publishingAssistantConnections,
    publishingMailCandidates,
    publishingMailConnection,
    publishingMailSyncResult,
    publishingMailSchedule,
    selectedPublishingSourceId,
    publishingPartnerActionState,
    publishingPartnerError,
    openPublishingPartners,
    closePublishingPartners,
    createPublishingPartner,
    updatePublishingPartner,
    createPublishingSubmission,
    updatePublishingSubmission,
    createPublishingContract,
    updatePublishingContract,
    createPublishingPublication,
    updatePublishingPublication,
    createPublishingSettlement,
    updatePublishingSettlement,
    createPublishingPayment,
    updatePublishingPayment,
    createPublishingSource,
    setPublishingEvidenceLinks,
    previewPublishingResearch,
    approvePublishingResearch,
    runPublishingAssistant,
    approvePublishingAssistant,
    selectPublishingPartnerCsv,
    applyPublishingPartnerCsv,
    selectPublishingSubmissionCsv,
    applyPublishingSubmissionCsv,
    linkPublishingMailCandidate,
    connectPublishingMail,
    syncPublishingMail,
    savePublishingMailSchedule,
    disconnectPublishingMail,
    updatePublishingMailCandidate,
    reviewPublishingMailCandidate,
    selectPublishingPartner,
    selectPublishingSubmission,
    selectPublishingContract,
    selectPublishingPublication,
    selectPublishingSettlement,
    selectPublishingPayment,
    selectPublishingSource,
  };
}
