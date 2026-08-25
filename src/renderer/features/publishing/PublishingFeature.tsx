import type { ReactNode } from "react";

import type { WorkspaceCatalogProjection } from "../../../application/workspace/workspace-contract";
import { PublishingPartnerDialog } from "../../publishing/PublishingPartnerDialog";
import type { usePublishingController } from "./usePublishingController";

export type PublishingController = ReturnType<typeof usePublishingController>;

export type PublishingFeatureProps = Readonly<{
  catalog: WorkspaceCatalogProjection | null;
  controller: PublishingController;
}>;

export function PublishingFeature({
  catalog,
  controller,
}: PublishingFeatureProps): ReactNode {
  if (!controller.showPublishingPartners || catalog === null) {
    return null;
  }

  return (
    <PublishingPartnerDialog
      actionState={controller.publishingPartnerActionState}
      assistantConnections={controller.publishingAssistantConnections}
      contracts={controller.publishingContracts}
      error={controller.publishingPartnerError}
      initialSection={controller.publishingInitialSection}
      workScopeId={controller.publishingWorkScopeId}
      onClose={controller.closePublishingPartners}
      onCreate={controller.createPublishingPartner}
      onCreateContract={controller.createPublishingContract}
      onCreatePublication={controller.createPublishingPublication}
      onCreateSettlement={controller.createPublishingSettlement}
      onCreatePayment={controller.createPublishingPayment}
      onCreateSource={controller.createPublishingSource}
      onPreviewResearch={controller.previewPublishingResearch}
      onApproveResearch={controller.approvePublishingResearch}
      onRunAssistant={controller.runPublishingAssistant}
      onApproveAssistant={controller.approvePublishingAssistant}
      onSetEvidenceLinks={controller.setPublishingEvidenceLinks}
      onSelectPartnerCsv={controller.selectPublishingPartnerCsv}
      onApplyPartnerCsv={controller.applyPublishingPartnerCsv}
      onSelectSubmissionCsv={controller.selectPublishingSubmissionCsv}
      onApplySubmissionCsv={controller.applyPublishingSubmissionCsv}
      onLinkMailCandidate={controller.linkPublishingMailCandidate}
      onUpdateMailCandidate={controller.updatePublishingMailCandidate}
      onReviewMailCandidate={controller.reviewPublishingMailCandidate}
      onConnectMail={controller.connectPublishingMail}
      onSyncMail={controller.syncPublishingMail}
      onDisconnectMail={controller.disconnectPublishingMail}
      onSaveMailSchedule={controller.savePublishingMailSchedule}
      onCreateSubmission={controller.createPublishingSubmission}
      onSelect={controller.selectPublishingPartner}
      onSelectContract={controller.selectPublishingContract}
      onSelectPublication={controller.selectPublishingPublication}
      onSelectSettlement={controller.selectPublishingSettlement}
      onSelectPayment={controller.selectPublishingPayment}
      onSelectSource={controller.selectPublishingSource}
      onSelectSubmission={controller.selectPublishingSubmission}
      onUpdate={controller.updatePublishingPartner}
      onUpdateContract={controller.updatePublishingContract}
      onUpdatePublication={controller.updatePublishingPublication}
      onUpdateSettlement={controller.updatePublishingSettlement}
      onUpdatePayment={controller.updatePublishingPayment}
      onUpdateSubmission={controller.updatePublishingSubmission}
      partners={controller.publishingPartners}
      mailCandidates={controller.publishingMailCandidates}
      mailConnection={controller.publishingMailConnection}
      mailSchedule={controller.publishingMailSchedule}
      mailSyncResult={controller.publishingMailSyncResult}
      payments={controller.publishingPayments}
      sources={controller.publishingSources}
      publications={controller.publishingPublications}
      settlements={controller.publishingSettlements}
      selectedContractId={controller.selectedPublishingContractId}
      selectedPartnerId={controller.selectedPublishingPartnerId}
      selectedPublicationId={controller.selectedPublishingPublicationId}
      selectedSettlementId={controller.selectedPublishingSettlementId}
      selectedPaymentId={controller.selectedPublishingPaymentId}
      selectedSourceId={controller.selectedPublishingSourceId}
      selectedSubmissionId={controller.selectedPublishingSubmissionId}
      submissions={controller.publishingSubmissions}
      works={
        controller.publishingWorkScopeId === null
          ? catalog.works
          : catalog.works.filter(
              (work) => work.workId === controller.publishingWorkScopeId,
            )
      }
    />
  );
}
