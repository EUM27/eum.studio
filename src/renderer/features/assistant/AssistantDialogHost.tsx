import type { AssistantSettingReference } from "../../../application/assistant/assistant-setting-review";
import type { AssistantVocabularyOccurrence } from "../../../application/assistant/assistant-vocabulary-lookup";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { WorkspaceWorkSummary } from "../../../application/workspace/workspace-contract";
import { AssistantChatDialog } from "../../assistant/AssistantChatDialog";
import { AssistantConnectionsDialog } from "../../assistant/AssistantConnectionsDialog";
import { AssistantContextDialog } from "../../assistant/AssistantContextDialog";
import type { useAssistantController } from "./useAssistantController";

export function AssistantDialogHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWork: WorkspaceWorkSummary | null;
  controller: ReturnType<typeof useAssistantController>;
  documentLabels: Readonly<Record<string, string>>;
  hasManuscriptSelection: boolean;
  onOpenSettingReference: (reference: AssistantSettingReference) => void;
  onOpenSettings?: () => void;
  openVocabularyOccurrence: (
    occurrence: AssistantVocabularyOccurrence,
  ) => Promise<void>;
  ready: boolean;
}>) {
  const controller = input.controller;

  return (
    <>
      {controller.assistantChatDialogOpen && (
        <AssistantChatDialog
          actionState={controller.assistantChatActionState}
          error={controller.assistantChatError}
          messages={controller.assistantChatMessages}
          oauthStatus={controller.chatGptOAuthStatus}
          onClose={controller.closeAssistantChatDialog}
          onOpenSettings={() => {
            controller.hideAssistantChatDialog();
            input.onOpenSettings?.();
          }}
          onOpenTools={() => {
            controller.hideAssistantChatDialog();
            void controller.openAssistantContextDialog();
          }}
          onSend={(message) => {
            void controller.runAssistantChat(message);
          }}
        />
      )}
      {input.ready && controller.assistantConnectionsDialogOpen && (
        <AssistantConnectionsDialog
          actionState={controller.assistantConnectionsActionState}
          connections={controller.assistantConnections}
          connectorProfile={controller.assistantConnectorProfile}
          error={controller.assistantConnectionsActionError}
          key={controller.assistantConnections
            .map((connection) =>
              `${connection.connectionId}:${connection.revision}`
            )
            .join("|")}
          onClose={controller.closeAssistantConnectionsDialog}
          onDelete={(connection) => {
            void controller.deleteAssistantConnection(connection);
          }}
          onSave={(draft) => {
            void controller.saveAssistantConnection(draft);
          }}
        />
      )}
      {input.ready &&
        input.activeWork !== null &&
        controller.assistantContextDialogOpen && (
          <AssistantContextDialog
            actionState={controller.assistantContextActionState}
            canRunExternalSettingReview={input.activeDocument !== null}
            canRunNotationReview={input.hasManuscriptSelection}
            canRunVocabularyLookup={input.hasManuscriptSelection}
            connections={controller.assistantContextConnections}
            destinationProfile={controller.assistantDestinationProfile}
            documentLabels={input.documentLabels}
            error={controller.assistantContextActionError}
            onClose={controller.closeAssistantContextDialog}
            onGrant={(draft) => {
              void controller.grantAssistantContextPermission(draft);
            }}
            onOpenConnections={controller.openAssistantConnectionsFromContext}
            onOpenNotationFinding={(finding) => {
              void input.openVocabularyOccurrence(finding.range);
            }}
            onOpenSettingReference={input.onOpenSettingReference}
            onOpenVocabularyOccurrence={(occurrence) => {
              void input.openVocabularyOccurrence(occurrence);
            }}
            onRevoke={(grant) => {
              void controller.revokeAssistantContextPermission(grant);
            }}
            onRunSettingReview={(destinationId) => {
              void controller.runAssistantSettingReview(destinationId);
            }}
            onRunNotationReview={(destinationId) => {
              void controller.runAssistantNotationReview(destinationId);
            }}
            onRunVocabularyLookup={(destinationId) => {
              void controller.runAssistantVocabularyLookup(destinationId);
            }}
            onRunVocabularySuggestion={(request) => {
              void controller.runAssistantVocabularySuggestion(request);
            }}
            onRunExternalSettingReview={(request) => {
              void controller.runAssistantExternalSettingReview(request);
            }}
            projection={
              controller.assistantContextProjection?.workId ===
                  input.activeWork.workId
                ? controller.assistantContextProjection
                : null
            }
            workTitle={input.activeWork.title}
          />
        )}
    </>
  );
}
