import {
  parseManuscriptInputProfile,
  type ManuscriptInputProfile,
} from "../editor/manuscript-input-profile";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../editor/manuscript-document-profile";
import {
  parseManuscriptFormattingProfile,
  parseSaveManuscriptDocumentChangeCommand,
  parseSaveManuscriptFormattingCommand,
  parseSaveManuscriptFormattingReceipt,
  type ManuscriptFormattingProfile,
  type SaveManuscriptDocumentChangeCommand,
  type SaveManuscriptFormattingCommand,
  type SaveManuscriptFormattingReceipt,
} from "../editor/manuscript-formatting";
import {
  parseGetWorkManuscriptLayoutSettingsCommand,
  parseSaveWorkManuscriptLayoutSettingsCommand,
  parseWorkManuscriptLayoutSettingsProjection,
  type GetWorkManuscriptLayoutSettingsCommand,
  type SaveWorkManuscriptLayoutSettingsCommand,
  type WorkManuscriptLayoutSettingsProjection,
} from "../editor/work-manuscript-layout-settings";
import {
  parseExportManuscriptTextCommand,
  parseExportManuscriptTextResult,
  parseGetManuscriptPreflightSettingsCommand,
  parseManuscriptPreflightProfile,
  parseManuscriptPreflightSettingsProjection,
  parseSaveManuscriptPreflightSettingsCommand,
  type ExportManuscriptTextCommand,
  type ExportManuscriptTextResult,
  type GetManuscriptPreflightSettingsCommand,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightSettingsProjection,
  type SaveManuscriptPreflightSettingsCommand,
} from "../editor/manuscript-preflight";
import {
  parseManuscriptTextImportResult,
  parseSelectManuscriptTextImportCommand,
  type ManuscriptTextImportResult,
  type SelectManuscriptTextImportCommand,
} from "../editor/manuscript-text-import";
import {
  parseGetContinuousReadingProgressCommand,
  parseSaveContinuousReadingProgressCommand,
  parseWorkContinuousReadingProgressProjection,
  type GetContinuousReadingProgressCommand,
  type SaveContinuousReadingProgressCommand,
  type WorkContinuousReadingProgressProjection,
} from "../editor/continuous-reading-progress";
import {
  parseChangeBatch,
  type ChangeBatch,
} from "../persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptPersistenceProfile,
} from "../persistence/manuscript-persistence-profile";
import {
  parseSaveReceipt,
  type SaveReceipt,
} from "../persistence/save-change-batch";
import {
  parseApplyStartupRecoveryAcknowledgement,
  parseApplyStartupRecoveryCommand,
  parseStartupRecoveryProjection,
  type ApplyStartupRecoveryAcknowledgement,
  type ApplyStartupRecoveryCommand,
  type StartupRecoveryProjection,
} from "../persistence/startup-recovery-contract";
import {
  parseManuscriptResumeCheckpointProjection,
  type ManuscriptResumeCheckpointProjection,
} from "../checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateFirstWorkResult,
  parseCreateWorkCommand,
  parseCreateWorkResult,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  parseWorkspaceCatalogProjection,
  type ActivateWorkspaceLocationCommand,
  type CaptureWorkspaceResumeCommand,
  type CreateDocumentFolderCommand,
  type CreateDocumentCommand,
  type CreateDocumentResult,
  type CreateFirstWorkCommand,
  type CreateFirstWorkResult,
  type CreateWorkCommand,
  type CreateWorkResult,
  type MoveDocumentCommand,
  type PlaceDocumentInFolderCommand,
  type RenameDocumentFolderCommand,
  type RenameDocumentCommand,
  type RenameWorkCommand,
  type RetireDocumentCommand,
  type RetireDocumentFolderCommand,
  type RetireWorkCommand,
  type WorkspaceCatalogProjection,
} from "../workspace/workspace-contract";
import {
  parseDocumentCompletionProjection,
  parseGetDocumentCompletionCommand,
  parseSetDocumentCompletionCommand,
  type DocumentCompletionProjection,
  type GetDocumentCompletionCommand,
  type SetDocumentCompletionCommand,
} from "../workspace/document-completion";
import {
  parseSetWorkFavoriteCommand,
  parseWorkFavoritesProjection,
  type SetWorkFavoriteCommand,
  type WorkFavoritesProjection,
} from "../workspace/work-favorites";
import {
  parseSelectWorkCoverCommand,
  parseWorkCoverProjection,
  parseWorkCoversProjection,
  type SelectWorkCoverCommand,
  type WorkCoverProjection,
  type WorkCoversProjection,
} from "../workspace/work-covers";
import {
  parseCreateAnchorlessEventCommand,
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseEventBlockProjection,
  parseEventSourceProjection,
  parseLinkEventSourceCommand,
  parseListEventBlocksCommand,
  parseMoveEventBlockCommand,
  parseReplaceEventSourceCommand,
  parseRetireEventSourceCommand,
  type CreateAnchorlessEventCommand,
  type CreateEventBlockCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type EventSourceProjection,
  type LinkEventSourceCommand,
  type ListEventBlocksCommand,
  type MoveEventBlockCommand,
  type ReplaceEventSourceCommand,
  type RetireEventSourceCommand,
} from "../structure/event-block-contract";
import {
  parseEventRailProjection,
  parseListEventRailCommand,
  type EventRailProjection,
  type ListEventRailCommand,
} from "../structure/event-rail-projection";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  parseSceneOverrideProjection,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../structure/scene-override-contract";
import {
  parseListSceneProjectionCommand,
  parseSceneProjectionList,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type ListSceneProjectionCommand,
  type SceneProjectionList,
  type SetSceneEventOverrideCommand,
  type UpdateSceneRuleSetCommand,
} from "../structure/scene-projection";
import {
  parseDecideSceneExtractionAnnotationCommand,
  parseDecideSceneExtractionBoundaryCommand,
  parseListSceneExtractionCandidatesCommand,
  parseRunSceneExtractionCommand,
  parseSceneExtractionCandidateList,
  parseSceneExtractionAnnotationDecisionResult,
  parseSceneExtractionDecisionResult,
  parseSceneExtractionResult,
  type DecideSceneExtractionAnnotationCommand,
  type DecideSceneExtractionBoundaryCommand,
  type ListSceneExtractionCandidatesCommand,
  type RunSceneExtractionCommand,
  type SceneExtractionAnnotationDecisionResult,
  type SceneExtractionCandidateList,
  type SceneExtractionDecisionResult,
  type SceneExtractionResult,
} from "../structure/scene-extraction-contract";
import {
  parseCompleteSceneDraftInsertionCommand,
  parseListSceneDraftCandidatesCommand,
  parsePrepareSceneDraftInsertionCommand,
  parsePrepareSceneDraftInsertionResult,
  parseRunSceneDraftCommand,
  parseRunSceneDraftResult,
  parseSceneDraftCandidate,
  parseSceneDraftCandidateList,
  parseUpdateSceneDraftCandidateCommand,
  type CompleteSceneDraftInsertionCommand,
  type ListSceneDraftCandidatesCommand,
  type PrepareSceneDraftInsertionCommand,
  type PrepareSceneDraftInsertionResult,
  type RunSceneDraftCommand,
  type RunSceneDraftResult,
  type SceneDraftCandidate,
  type SceneDraftCandidateList,
  type UpdateSceneDraftCandidateCommand,
} from "../structure/scene-draft-contract";
import {
  parseListSceneAnnotationsCommand,
  parseSceneAnnotationList,
  type ListSceneAnnotationsCommand,
  type SceneAnnotationList,
} from "../structure/scene-annotation-contract";
import {
  parseCaptureFragmentCommand,
  parseFragmentListProjection,
  parseFragmentProjection,
  parseFragmentShelfProfile,
  parseListFragmentsCommand,
  parseRecordFragmentUseCommand,
  parseRetireFragmentCommand,
  parseUpdateFragmentCommand,
  type CaptureFragmentCommand,
  type FragmentListProjection,
  type FragmentProjection,
  type FragmentShelfProfile,
  type ListFragmentsCommand,
  type RecordFragmentUseCommand,
  type RetireFragmentCommand,
  type UpdateFragmentCommand,
} from "../fragments/fragment-contract";
import {
  parseCreateForeshadowLineCommand,
  parseForeshadowLineListProjection,
  parseForeshadowLineProjection,
  parseListForeshadowLinesCommand,
  parseRetireForeshadowLineCommand,
  parseUpdateForeshadowLineCommand,
  type CreateForeshadowLineCommand,
  type ForeshadowLineListProjection,
  type ForeshadowLineProjection,
  type ListForeshadowLinesCommand,
  type RetireForeshadowLineCommand,
  type UpdateForeshadowLineCommand,
} from "../foreshadowing/foreshadow-line-contract";
import {
  parseAddCharacterEvidenceCommand,
  parseCharacterListProjection,
  parseCharacterProjection,
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
} from "../characters/character-contract";
import {
  parseCharacterRelationListProjection,
  parseCharacterRelationProjection,
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
} from "../characters/character-relation-contract";
import {
  parseCharacterExtractionCandidateList,
  parseCharacterExtractionDecisionResult,
  parseCharacterExtractionResult,
  parseDecideCharacterExtractionItemCommand,
  parseListCharacterExtractionCandidatesCommand,
  parseRunCharacterExtractionCommand,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionResult,
  type DecideCharacterExtractionItemCommand,
  type ListCharacterExtractionCandidatesCommand,
  type RunCharacterExtractionCommand,
} from "../characters/character-extraction-contract";
import {
  parseCharacterGenerationCandidateList,
  parseCharacterGenerationDecisionResult,
  parseCharacterGenerationResult,
  parseDecideCharacterGenerationItemCommand,
  parseListCharacterGenerationCandidatesCommand,
  parseRunCharacterGenerationCommand,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationResult,
  type DecideCharacterGenerationItemCommand,
  type ListCharacterGenerationCandidatesCommand,
  type RunCharacterGenerationCommand,
} from "../characters/character-generation-contract";
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
} from "../lore/lore-entry-contract";
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
} from "../lore/lore-foreshadow-link-contract";
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
} from "../lore/lore-candidate-contract";
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
} from "../publishing/publishing-partner-contract";
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
} from "../publishing/publishing-submission-contract";
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
} from "../publishing/publishing-contract-contract";
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
} from "../publishing/publishing-publication-contract";
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
} from "../publishing/publishing-settlement-contract";
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
} from "../publishing/publishing-payment-contract";
import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
  parsePublishingSourceProjection,
  type CreatePublishingSourceCommand,
  type ListPublishingSourcesCommand,
  type PublishingSourceListProjection,
  type PublishingSourceProjection,
} from "../publishing/publishing-source-contract";
import {
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  parsePublishingResearchApprovalResult,
  parsePublishingResearchCandidateProjection,
  type ApprovePublishingResearchCommand,
  type PreviewPublishingResearchCommand,
  type PublishingResearchApprovalResult,
  type PublishingResearchCandidateProjection,
} from "../publishing/publishing-research-contract";
import {
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantApprovalResult,
  parsePublishingAssistantResult,
  parseRunPublishingAssistantCommand,
  type ApprovePublishingAssistantCandidateCommand,
  type PublishingAssistantApprovalResult,
  type PublishingAssistantResult,
  type RunPublishingAssistantCommand,
} from "../publishing/publishing-assistant-contract";
import {
  parsePublishingEvidenceLinksProjection,
  parseSetPublishingEvidenceLinksCommand,
  type PublishingEvidenceLinksProjection,
  type SetPublishingEvidenceLinksCommand,
} from "../publishing/publishing-evidence-link-contract";
import {
  parseApplyPublishingPartnerCsvImportCommand,
  parsePublishingPartnerCsvImportResult,
  parsePublishingPartnerCsvSelectionProjection,
  parseSelectPublishingPartnerCsvCommand,
  type ApplyPublishingPartnerCsvImportCommand,
  type PublishingPartnerCsvImportResult,
  type PublishingPartnerCsvSelectionProjection,
  type SelectPublishingPartnerCsvCommand,
} from "../publishing/publishing-partner-csv-import";
import {
  parseApplyPublishingSubmissionCsvImportCommand,
  parsePublishingSubmissionCsvImportResult,
  parsePublishingSubmissionCsvSelectionProjection,
  parseSelectPublishingSubmissionCsvCommand,
  type ApplyPublishingSubmissionCsvImportCommand,
  type PublishingSubmissionCsvImportResult,
  type PublishingSubmissionCsvSelectionProjection,
  type SelectPublishingSubmissionCsvCommand,
} from "../publishing/publishing-submission-csv-import";
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
} from "../publishing/publishing-mail-candidate-contract";
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
} from "../publishing/publishing-mail-connection-contract";
import {
  parseGetPublishingMailScheduleCommand,
  parsePublishingMailScheduleProjection,
  parseSavePublishingMailScheduleCommand,
  type GetPublishingMailScheduleCommand,
  type PublishingMailScheduleProjection,
  type SavePublishingMailScheduleCommand,
} from "../publishing/publishing-mail-schedule-contract";
import {
  parseCreatePlotThreadCommand,
  parseListPlotThreadsCommand,
  parsePlotThreadListProjection,
  parsePlotThreadProjection,
  parseRetirePlotThreadCommand,
  parseUpdatePlotThreadCommand,
  type CreatePlotThreadCommand,
  type ListPlotThreadsCommand,
  type PlotThreadListProjection,
  type PlotThreadProjection,
  type RetirePlotThreadCommand,
  type UpdatePlotThreadCommand,
} from "../plots/plot-contract";
import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parsePlotBoardProjection,
  parseSetPlotPlacementStoryTimeCommand,
  type GetDefaultPlotBoardCommand,
  type MovePlotPlacementCommand,
  type PlotBoardProjection,
  type SetPlotPlacementStoryTimeCommand,
} from "../plots/plot-board-contract";
import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  parsePlotEventLinkMutationProjection,
  parseUnlinkPlotEventCommand,
  type CreateEventFromPlotCommand,
  type CreatePlotFromEventCommand,
  type LinkPlotEventCommand,
  type ListPlotEventLinksCommand,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
  type UnlinkPlotEventCommand,
} from "../plots/plot-event-link-contract";
import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  parsePlotThreadSourceProjection,
  type LinkPlotThreadSourceCommand,
  type ListPlotThreadSourcesCommand,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../plots/plot-source-contract";
import {
  parseCreateForeshadowPointCommand,
  parseForeshadowPointListProjection,
  parseForeshadowPointProfile,
  parseForeshadowPointProjection,
  parseListForeshadowPointsCommand,
  type CreateForeshadowPointCommand,
  type ForeshadowPointListProjection,
  type ForeshadowPointProfile,
  type ForeshadowPointProjection,
  type ListForeshadowPointsCommand,
} from "../foreshadowing/foreshadow-point-contract";
import {
  parseConfigureAndStartPomodoroCommand,
  parseGetPomodoroCommand,
  parsePomodoroPhaseCommand,
  parsePomodoroProjection,
  parseUpdatePomodoroNoteCommand,
  type ConfigureAndStartPomodoroCommand,
  type GetPomodoroCommand,
  type PomodoroPhaseCommand,
  type PomodoroProjection,
  type UpdatePomodoroNoteCommand,
} from "../activity/pomodoro-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
} from "../activity/work-activity-contract";
import {
  parseExportWorkRecordsCommand,
  parseExportWorkRecordsResult,
  type ExportWorkRecordsCommand,
  type ExportWorkRecordsResult,
} from "../activity/work-records-export";
import {
  parseGetWorkRecordsGoalsCommand,
  parseSaveWorkRecordsGoalsCommand,
  parseWorkRecordsGoalsProjection,
  type GetWorkRecordsGoalsCommand,
  type SaveWorkRecordsGoalsCommand,
  type WorkRecordsGoalsProjection,
} from "../activity/work-records-preferences";
import {
  parseGetWorkReadthroughCommand,
  parseSaveWorkReadthroughCommand,
  parseWorkReadthroughProjection,
  type GetWorkReadthroughCommand,
  type SaveWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../activity/work-readthrough-calculator";
import {
  parseCreateWorkScheduleItemCommand,
  parseListWorkScheduleCommand,
  parseRetireWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseUpdateWorkScheduleItemCommand,
  parseWorkScheduleItemProjection,
  parseWorkScheduleProjection,
  type CreateWorkScheduleItemCommand,
  type ListWorkScheduleCommand,
  type RetireWorkScheduleItemCommand,
  type SetWorkScheduleCompletionCommand,
  type UpdateWorkScheduleItemCommand,
  type WorkScheduleItemProjection,
  type WorkScheduleProjection,
} from "../schedule/work-schedule-contract";
import {
  parseWorkCalendarProjection,
  type WorkCalendarProjection,
} from "../schedule/work-calendar-contract";
import {
  parseGetStudioTodayCommand,
  parseStudioTodayProjection,
  type GetStudioTodayCommand,
  type StudioTodayProjection,
} from "../today/studio-today-contract";
import {
  parseGetWorkQuickMemoCommand,
  parseSaveWorkQuickMemoCommand,
  parseWorkQuickMemoProjection,
  type GetWorkQuickMemoCommand,
  type SaveWorkQuickMemoCommand,
  type WorkQuickMemoProjection,
} from "../quick-tools/work-quick-memo";
import {
  parseAssistantContextPermissionGrant,
  type AssistantContextPermissionGrant,
} from "../assistant/assistant-context-permission";
import {
  parseAssistantConnectionListProjection,
  parseAssistantConnectionProjection,
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
  type DeleteAssistantConnectionCommand,
  type SaveAssistantConnectionCommand,
} from "../assistant/assistant-connection";
import {
  parseChatGptOAuthConnectionStatus,
  type ChatGptOAuthConnectionStatus,
} from "../assistant/chatgpt-oauth";
import {
  parseAssistantContextStateProjection,
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
  type AssistantContextStateProjection,
  type GrantAssistantContextPermissionCommand,
  type ListAssistantContextStateCommand,
  type RevokeAssistantContextPermissionCommand,
} from "../assistant/assistant-context-state";
import {
  parseAssistantDestinationProfile,
  type AssistantDestinationProfile,
} from "../assistant/assistant-destination-profile";
import {
  parseAssistantConnectorManifestProfile,
  type AssistantConnectorManifestProfile,
} from "../assistant/assistant-connector-manifest";
import {
  parseAssistantVocabularyLookupResult,
  parseRunAssistantVocabularyLookupCommand,
  type AssistantVocabularyLookupResult,
  type RunAssistantVocabularyLookupCommand,
} from "../assistant/assistant-vocabulary-lookup";
import {
  parseAssistantVocabularySuggestionResult,
  parseRunAssistantVocabularySuggestionCommand,
  type AssistantVocabularySuggestionResult,
  type RunAssistantVocabularySuggestionCommand,
} from "../assistant/assistant-vocabulary-suggestion";
import {
  parseAssistantExternalSettingReviewResult,
  parseRunAssistantExternalSettingReviewCommand,
  type AssistantExternalSettingReviewResult,
  type RunAssistantExternalSettingReviewCommand,
} from "../assistant/assistant-external-setting-review";
import {
  parseAssistantNotationReviewResult,
  parseRunAssistantNotationReviewCommand,
  type AssistantNotationReviewResult,
  type RunAssistantNotationReviewCommand,
} from "../assistant/assistant-notation-review";
import {
  parseAssistantSettingReviewResult,
  parseRunAssistantSettingReviewCommand,
  type AssistantSettingReviewResult,
  type RunAssistantSettingReviewCommand,
} from "../assistant/assistant-setting-review";
import {
  parseAssistantChatResult,
  parseRunAssistantChatCommand,
  type AssistantChatResult,
  type RunAssistantChatCommand,
} from "../assistant/assistant-chat";
import {
  parseAppSettingsProfile,
  parseAppSettingsProjection,
  parseSaveAppSettingsCommand,
  type AppSettingsProfile,
  type AppSettingsProjection,
  type SaveAppSettingsCommand,
} from "../settings/app-settings";
import {
  parseSaveUiPreferencesCommand,
  parseUiPreferencesProjection,
  type SaveUiPreferencesCommand,
  type UiPreferencesProjection,
} from "../settings/ui-preferences";
import {
  parseGetWorkMusicSettingsCommand,
  parseMusicSettingsProfile,
  parseSaveWorkMusicSettingsCommand,
  parseWorkMusicSettingsProjection,
  type GetWorkMusicSettingsCommand,
  type MusicSettingsProfile,
  type SaveWorkMusicSettingsCommand,
  type WorkMusicSettingsProjection,
} from "../music/work-music-settings";
import {
  parseGetWorkInspirationSettingsCommand,
  parseSaveWorkInspirationSettingsCommand,
  parseWorkInspirationSettingsProjection,
  type GetWorkInspirationSettingsCommand,
  type SaveWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../inspiration/work-inspiration-settings";
import {
  parseSaveYouTubeMusicConnectionCommand,
  parseYouTubeMusicConnectionStatus,
  type SaveYouTubeMusicConnectionCommand,
  type YouTubeMusicConnectionStatus,
} from "../music/youtube-music-connection";
import {
  parseSearchYouTubeVideosCommand,
  parseYouTubeVideoSearchResult,
  parseYouTubeMusicProfile,
  type SearchYouTubeVideosCommand,
  type YouTubeMusicProfile,
  type YouTubeVideoSearchResult,
} from "../music/youtube-music";
import {
  parseListSceneMusicQueueCandidatesCommand,
  parseSceneMusicQueueCandidate,
  parseSceneMusicQueueCandidateList,
  parseSceneMusicQueueSearchResult,
  parseSearchSceneMusicQueuesCommand,
  parseSelectSceneMusicQueueCommand,
  type ListSceneMusicQueueCandidatesCommand,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueCandidateList,
  type SceneMusicQueueSearchResult,
  type SearchSceneMusicQueuesCommand,
  type SelectSceneMusicQueueCommand,
} from "../music/scene-music-queue-contract";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseRestoreDocumentRevisionCommand,
  parseRestoreDocumentRevisionResult,
  parseWorkSnapshotListProjection,
  parseWorkSnapshotProjection,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../revisions/work-version-contract";
import {
  parseCompareWorkSnapshotCommand,
  parseWorkSnapshotComparisonProjection,
  type CompareWorkSnapshotCommand,
  type WorkSnapshotComparisonProjection,
} from "../revisions/work-snapshot-comparison";
import {
  parseLocalWorkspaceBackupActionResult,
  parseLocalWorkspaceBackupStatusProjection,
  type LocalWorkspaceBackupActionResult,
  type LocalWorkspaceBackupStatusProjection,
} from "../storage/local-workspace-backup-contract";
import {
  parseLegacyLoreImportRehearsalActionResult,
  type LegacyLoreImportRehearsalActionResult,
} from "../migration/legacy-lore-import-contract";

export const RUNTIME_INFO_CHANNEL = "studio:system:get-runtime-info";
export const MANUSCRIPT_INPUT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-input-profile";
export const MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-document-profile";
export const MANUSCRIPT_FORMATTING_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-formatting-profile";
export const MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-preflight-profile";
export const MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL =
  "studio:editor:get-manuscript-preflight-settings";
export const MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL =
  "studio:editor:save-manuscript-preflight-settings";
export const MANUSCRIPT_EXPORT_TEXT_CHANNEL =
  "studio:editor:export-manuscript-text";
export const MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL =
  "studio:editor:select-manuscript-text-import";
export const MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL =
  "studio:editor:save-change-batch";
export const MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL =
  "studio:editor:save-document-change";
export const MANUSCRIPT_SAVE_FORMATTING_CHANNEL =
  "studio:editor:save-formatting";
export const MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL =
  "studio:editor:get-work-layout-settings";
export const MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL =
  "studio:editor:save-work-layout-settings";
export const MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL =
  "studio:editor:get-manuscript-persistence-profile";
export const MANUSCRIPT_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:get-manuscript-startup-recovery";
export const MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL =
  "studio:editor:get-manuscript-resume-checkpoint";
export const MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL =
  "studio:editor:get-continuous-reading-progress";
export const MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL =
  "studio:editor:save-continuous-reading-progress";
export const MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL =
  "studio:editor:apply-manuscript-startup-recovery";
export const MANUSCRIPT_CLOSE_REQUEST_CHANNEL =
  "studio:editor:manuscript-close-request";
export const MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL =
  "studio:editor:complete-manuscript-close-request";
export const WORKSPACE_CATALOG_CHANNEL =
  "studio:workspace:get-catalog";
export const WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL =
  "studio:workspace:get-document-completion";
export const WORKSPACE_SET_DOCUMENT_COMPLETION_CHANNEL =
  "studio:workspace:set-document-completion";
export const WORKSPACE_FAVORITES_CHANNEL =
  "studio:workspace:get-favorites";
export const WORKSPACE_SET_FAVORITE_CHANNEL =
  "studio:workspace:set-favorite";
export const WORKSPACE_COVERS_CHANNEL =
  "studio:workspace:get-covers";
export const WORKSPACE_SELECT_COVER_CHANNEL =
  "studio:workspace:select-cover";
export const WORKSPACE_CREATE_FIRST_WORK_CHANNEL =
  "studio:workspace:create-first-work";
export const WORKSPACE_CREATE_WORK_CHANNEL =
  "studio:workspace:create-work";
export const WORKSPACE_CREATE_DOCUMENT_CHANNEL =
  "studio:workspace:create-document";
export const WORKSPACE_RENAME_WORK_CHANNEL =
  "studio:workspace:rename-work";
export const WORKSPACE_RENAME_DOCUMENT_CHANNEL =
  "studio:workspace:rename-document";
export const WORKSPACE_RETIRE_WORK_CHANNEL =
  "studio:workspace:retire-work";
export const WORKSPACE_RETIRE_DOCUMENT_CHANNEL =
  "studio:workspace:retire-document";
export const WORKSPACE_MOVE_DOCUMENT_CHANNEL =
  "studio:workspace:move-document";
export const WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:create-document-folder";
export const WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:rename-document-folder";
export const WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL =
  "studio:workspace:place-document-in-folder";
export const WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL =
  "studio:workspace:retire-document-folder";
export const WORKSPACE_ACTIVATE_LOCATION_CHANNEL =
  "studio:workspace:activate-location";
export const WORKSPACE_CAPTURE_RESUME_CHANNEL =
  "studio:workspace:capture-resume";
export const STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL =
  "studio:structure:create-event-block";
export const STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL =
  "studio:structure:create-anchorless-event";
export const STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL =
  "studio:structure:move-event-block";
export const STRUCTURE_LINK_EVENT_SOURCE_CHANNEL =
  "studio:structure:link-event-source";
export const STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL =
  "studio:structure:replace-event-source";
export const STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL =
  "studio:structure:retire-event-source";
export const STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL =
  "studio:structure:list-event-blocks";
export const STRUCTURE_LIST_EVENT_RAIL_CHANNEL =
  "studio:structure:list-event-rail";
export const STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL =
  "studio:structure:create-scene-override";
export const STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL =
  "studio:structure:list-scene-overrides";
export const STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL =
  "studio:structure:list-scene-projection";
export const STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL =
  "studio:structure:update-scene-rule-set";
export const STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL =
  "studio:structure:set-scene-event-override";
export const STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL =
  "studio:structure:extract-scenes";
export const STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL =
  "studio:structure:list-scene-extraction-candidates";
export const STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL =
  "studio:structure:decide-scene-extraction-boundary";
export const STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL =
  "studio:structure:list-scene-annotations";
export const STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL =
  "studio:structure:decide-scene-extraction-annotation";
export const STRUCTURE_RUN_SCENE_DRAFT_CHANNEL =
  "studio:structure:run-scene-draft";
export const STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL =
  "studio:structure:list-scene-draft-candidates";
export const STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL =
  "studio:structure:update-scene-draft-candidate";
export const STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL =
  "studio:structure:prepare-scene-draft-insertion";
export const STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL =
  "studio:structure:complete-scene-draft-insertion";
export const FRAGMENT_PROFILE_CHANNEL =
  "studio:fragments:get-profile";
export const FRAGMENT_CAPTURE_CHANNEL =
  "studio:fragments:capture";
export const FRAGMENT_LIST_CHANNEL =
  "studio:fragments:list";
export const FRAGMENT_UPDATE_CHANNEL =
  "studio:fragments:update";
export const FRAGMENT_RECORD_USE_CHANNEL =
  "studio:fragments:record-use";
export const FRAGMENT_RETIRE_CHANNEL =
  "studio:fragments:retire";
export const CHARACTER_CREATE_CHANNEL =
  "studio:characters:create";
export const CHARACTER_LIST_CHANNEL =
  "studio:characters:list";
export const CHARACTER_UPDATE_CHANNEL =
  "studio:characters:update";
export const CHARACTER_ADD_EVIDENCE_CHANNEL =
  "studio:characters:add-evidence";
export const CHARACTER_RETIRE_CHANNEL =
  "studio:characters:retire";
export const CHARACTER_RELATION_CREATE_CHANNEL =
  "studio:character-relations:create";
export const CHARACTER_RELATION_LIST_CHANNEL =
  "studio:character-relations:list";
export const CHARACTER_RELATION_UPDATE_CHANNEL =
  "studio:character-relations:update";
export const CHARACTER_RELATION_RETIRE_CHANNEL =
  "studio:character-relations:retire";
export const CHARACTER_EXTRACTION_RUN_CHANNEL =
  "studio:characters:extract";
export const CHARACTER_EXTRACTION_LIST_CHANNEL =
  "studio:characters:list-extraction-candidates";
export const CHARACTER_EXTRACTION_DECIDE_CHANNEL =
  "studio:characters:decide-extraction-candidate";
export const CHARACTER_GENERATION_RUN_CHANNEL =
  "studio:characters:generate";
export const CHARACTER_GENERATION_LIST_CHANNEL =
  "studio:characters:list-generation-candidates";
export const CHARACTER_GENERATION_DECIDE_CHANNEL =
  "studio:characters:decide-generation-candidate";
export const LORE_ENTRY_CREATE_CHANNEL =
  "studio:lore-entries:create";
export const LORE_ENTRY_LIST_CHANNEL =
  "studio:lore-entries:list";
export const LORE_ENTRY_UPDATE_CHANNEL =
  "studio:lore-entries:update";
export const LORE_ENTRY_ADD_EVIDENCE_CHANNEL =
  "studio:lore-entries:add-evidence";
export const LORE_ENTRY_RETIRE_CHANNEL =
  "studio:lore-entries:retire";
export const LORE_CANDIDATE_CREATE_CHANNEL =
  "studio:lore-candidates:create";
export const LORE_CANDIDATE_LIST_CHANNEL =
  "studio:lore-candidates:list";
export const LORE_CANDIDATE_APPROVE_CHANNEL =
  "studio:lore-candidates:approve";
export const LORE_CANDIDATE_REJECT_CHANNEL =
  "studio:lore-candidates:reject";
export const LORE_FORESHADOW_LINK_CHANNEL =
  "studio:lore-foreshadow-links:link";
export const LORE_FORESHADOW_LIST_CHANNEL =
  "studio:lore-foreshadow-links:list";
export const LORE_FORESHADOW_UNLINK_CHANNEL =
  "studio:lore-foreshadow-links:unlink";
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
export const PLOT_CREATE_CHANNEL =
  "studio:plots:create";
export const PLOT_LIST_CHANNEL =
  "studio:plots:list";
export const PLOT_DEFAULT_BOARD_CHANNEL =
  "studio:plots:get-default-board";
export const PLOT_MOVE_PLACEMENT_CHANNEL =
  "studio:plots:move-placement";
export const PLOT_SET_STORY_TIME_CHANNEL =
  "studio:plots:set-story-time";
export const PLOT_UPDATE_CHANNEL =
  "studio:plots:update";
export const PLOT_RETIRE_CHANNEL =
  "studio:plots:retire";
export const PLOT_CREATE_FROM_EVENT_CHANNEL =
  "studio:plots:create-from-event";
export const PLOT_CREATE_EVENT_CHANNEL =
  "studio:plots:create-event";
export const PLOT_LINK_EVENT_CHANNEL =
  "studio:plots:link-event";
export const PLOT_UNLINK_EVENT_CHANNEL =
  "studio:plots:unlink-event";
export const PLOT_EVENT_LINK_LIST_CHANNEL =
  "studio:plots:list-event-links";
export const PLOT_LINK_SOURCE_CHANNEL =
  "studio:plots:link-source";
export const PLOT_SOURCE_LIST_CHANNEL =
  "studio:plots:list-sources";
export const FORESHADOW_CREATE_LINE_CHANNEL =
  "studio:foreshadowing:create-line";
export const FORESHADOW_LIST_LINES_CHANNEL =
  "studio:foreshadowing:list-lines";
export const FORESHADOW_UPDATE_LINE_CHANNEL =
  "studio:foreshadowing:update-line";
export const FORESHADOW_RETIRE_LINE_CHANNEL =
  "studio:foreshadowing:retire-line";
export const FORESHADOW_POINT_PROFILE_CHANNEL =
  "studio:foreshadowing:get-point-profile";
export const FORESHADOW_CREATE_POINT_CHANNEL =
  "studio:foreshadowing:create-point";
export const FORESHADOW_LIST_POINTS_CHANNEL =
  "studio:foreshadowing:list-points";
export const ACTIVITY_LIST_WORK_CHANNEL =
  "studio:activity:list-work";
export const ACTIVITY_EXPORT_RECORDS_CHANNEL =
  "studio:activity:export-records";
export const ACTIVITY_GET_RECORDS_GOALS_CHANNEL =
  "studio:activity:get-records-goals";
export const ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL =
  "studio:activity:save-records-goals";
export const ACTIVITY_GET_READTHROUGH_CHANNEL =
  "studio:activity:get-readthrough";
export const ACTIVITY_SAVE_READTHROUGH_CHANNEL =
  "studio:activity:save-readthrough";
export const ACTIVITY_START_SESSION_CHANNEL =
  "studio:activity:start-session";
export const ACTIVITY_STOP_SESSION_CHANNEL =
  "studio:activity:stop-session";
export const ACTIVITY_START_FOCUS_CHANNEL =
  "studio:activity:start-focus";
export const ACTIVITY_STOP_FOCUS_CHANNEL =
  "studio:activity:stop-focus";
export const ACTIVITY_GET_POMODORO_CHANNEL =
  "studio:activity:get-pomodoro";
export const ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL =
  "studio:activity:configure-start-pomodoro";
export const ACTIVITY_PAUSE_POMODORO_CHANNEL =
  "studio:activity:pause-pomodoro";
export const ACTIVITY_RESUME_POMODORO_CHANNEL =
  "studio:activity:resume-pomodoro";
export const ACTIVITY_RECONCILE_POMODORO_CHANNEL =
  "studio:activity:reconcile-pomodoro";
export const ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL =
  "studio:activity:update-pomodoro-note";
export const ACTIVITY_STOP_POMODORO_CHANNEL =
  "studio:activity:stop-pomodoro";
export const SCHEDULE_LIST_WORK_CHANNEL =
  "studio:schedule:list-work";
export const SCHEDULE_LIST_CALENDAR_CHANNEL =
  "studio:schedule:list-calendar";
export const SCHEDULE_LIST_TODAY_CHANNEL =
  "studio:schedule:list-today";
export const SCHEDULE_CREATE_ITEM_CHANNEL =
  "studio:schedule:create-item";
export const SCHEDULE_UPDATE_ITEM_CHANNEL =
  "studio:schedule:update-item";
export const SCHEDULE_RETIRE_ITEM_CHANNEL =
  "studio:schedule:retire-item";
export const SCHEDULE_SET_COMPLETION_CHANNEL =
  "studio:schedule:set-completion";
export const QUICK_TOOLS_GET_MEMO_CHANNEL =
  "studio:quick-tools:get-memo";
export const QUICK_TOOLS_SAVE_MEMO_CHANNEL =
  "studio:quick-tools:save-memo";
export const ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL =
  "studio:assistant:chatgpt-oauth-status";
export const ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL =
  "studio:assistant:chatgpt-oauth-start-login";
export const ASSISTANT_CHAT_RUN_CHANNEL =
  "studio:assistant:chat-run";
export const ASSISTANT_LIST_CONTEXT_STATE_CHANNEL =
  "studio:assistant:list-context-state";
export const ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL =
  "studio:assistant:grant-context-permission";
export const ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL =
  "studio:assistant:revoke-context-permission";
export const ASSISTANT_DESTINATION_PROFILE_CHANNEL =
  "studio:assistant:get-destination-profile";
export const ASSISTANT_CONNECTOR_PROFILE_CHANNEL =
  "studio:assistant:get-connector-profile";
export const ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL =
  "studio:assistant:run-vocabulary-lookup";
export const ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL =
  "studio:assistant:run-vocabulary-suggestion";
export const ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL =
  "studio:assistant:run-external-setting-review";
export const ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL =
  "studio:assistant:run-notation-review";
export const ASSISTANT_RUN_SETTING_REVIEW_CHANNEL =
  "studio:assistant:run-setting-review";
export const ASSISTANT_LIST_CONNECTIONS_CHANNEL =
  "studio:assistant:list-connections";
export const ASSISTANT_SAVE_CONNECTION_CHANNEL =
  "studio:assistant:save-connection";
export const ASSISTANT_DELETE_CONNECTION_CHANNEL =
  "studio:assistant:delete-connection";
export const APP_SETTINGS_PROFILE_CHANNEL =
  "studio:settings:profile";
export const APP_SETTINGS_GET_CHANNEL =
  "studio:settings:get";
export const APP_SETTINGS_SAVE_CHANNEL =
  "studio:settings:save";
export const UI_PREFERENCES_GET_CHANNEL =
  "studio:settings:ui-preferences-get";
export const UI_PREFERENCES_SAVE_CHANNEL =
  "studio:settings:ui-preferences-save";
export const MUSIC_SETTINGS_PROFILE_CHANNEL =
  "studio:music:settings-profile";
export const MUSIC_SETTINGS_GET_WORK_CHANNEL =
  "studio:music:get-work-settings";
export const MUSIC_SETTINGS_SAVE_WORK_CHANNEL =
  "studio:music:save-work-settings";
export const INSPIRATION_SETTINGS_GET_WORK_CHANNEL =
  "studio:inspiration:get-work-settings";
export const INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL =
  "studio:inspiration:save-work-settings";
export const YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL =
  "studio:music:youtube-connection-status";
export const YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL =
  "studio:music:youtube-connection-save";
export const YOUTUBE_MUSIC_PROFILE_CHANNEL =
  "studio:music:youtube-profile";
export const YOUTUBE_MUSIC_SEARCH_CHANNEL =
  "studio:music:youtube-search";
export const SCENE_MUSIC_QUEUE_SEARCH_CHANNEL =
  "studio:music:scene-queue-search";
export const SCENE_MUSIC_QUEUE_LIST_CHANNEL =
  "studio:music:scene-queue-list";
export const SCENE_MUSIC_QUEUE_SELECT_CHANNEL =
  "studio:music:scene-queue-select";
export const VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL =
  "studio:version:list-document-revisions";
export const VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL =
  "studio:version:restore-document-revision";
export const VERSION_CREATE_WORK_SNAPSHOT_CHANNEL =
  "studio:version:create-work-snapshot";
export const VERSION_LIST_WORK_SNAPSHOTS_CHANNEL =
  "studio:version:list-work-snapshots";
export const VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL =
  "studio:version:compare-work-snapshot";
export const BACKUP_GET_STATUS_CHANNEL =
  "studio:backup:get-status";
export const BACKUP_CREATE_CHANNEL =
  "studio:backup:create";
export const BACKUP_RESTORE_CHANNEL =
  "studio:backup:restore";
export const MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL =
  "studio:migration:run-legacy-rehearsal";

export type RuntimeInfo = {
  appName: string;
  appVersion: string;
  platform: string;
  architecture: string;
};

export type ManuscriptCloseRequest = {
  readonly schemaVersion: 1;
  readonly requestId: string;
};

export type ManuscriptCloseResult = {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly status: "saved" | "failed";
};

export type StudioBridge = {
  system: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
  };
  workspace: {
    getCatalog: () => Promise<WorkspaceCatalogProjection>;
    getDocumentCompletion: (
      command: GetDocumentCompletionCommand,
    ) => Promise<DocumentCompletionProjection>;
    setDocumentCompletion: (
      command: SetDocumentCompletionCommand,
    ) => Promise<DocumentCompletionProjection>;
    getFavorites: () => Promise<WorkFavoritesProjection>;
    setFavorite: (
      command: SetWorkFavoriteCommand,
    ) => Promise<WorkFavoritesProjection>;
    getCovers: () => Promise<WorkCoversProjection>;
    selectCover: (
      command: SelectWorkCoverCommand,
    ) => Promise<WorkCoverProjection | null>;
    activateLocation: (
      command: ActivateWorkspaceLocationCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    createWork: (
      command: CreateWorkCommand,
    ) => Promise<CreateWorkResult>;
    createFirstWork: (
      command: CreateFirstWorkCommand,
    ) => Promise<CreateFirstWorkResult>;
    createDocument: (
      command: CreateDocumentCommand,
    ) => Promise<CreateDocumentResult>;
    renameWork: (
      command: RenameWorkCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    renameDocument: (
      command: RenameDocumentCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    retireWork: (
      command: RetireWorkCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    retireDocument: (
      command: RetireDocumentCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    moveDocument: (
      command: MoveDocumentCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    createDocumentFolder: (
      command: CreateDocumentFolderCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    renameDocumentFolder: (
      command: RenameDocumentFolderCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    placeDocumentInFolder: (
      command: PlaceDocumentInFolderCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    retireDocumentFolder: (
      command: RetireDocumentFolderCommand,
    ) => Promise<WorkspaceCatalogProjection>;
    captureResume: (
      command: CaptureWorkspaceResumeCommand,
    ) => Promise<ManuscriptResumeCheckpointProjection>;
  };
  structure: {
    createEventBlock: (
      command: CreateEventBlockCommand,
    ) => Promise<EventBlockProjection>;
    createAnchorlessEvent: (
      command: CreateAnchorlessEventCommand,
    ) => Promise<EventBlockProjection>;
    moveEventBlock: (
      command: MoveEventBlockCommand,
    ) => Promise<EventBlockListProjection>;
    linkEventSource: (
      command: LinkEventSourceCommand,
    ) => Promise<EventSourceProjection>;
    replaceEventSource: (
      command: ReplaceEventSourceCommand,
    ) => Promise<EventSourceProjection>;
    retireEventSource: (
      command: RetireEventSourceCommand,
    ) => Promise<EventSourceProjection>;
    listEventBlocks: (
      command: ListEventBlocksCommand,
    ) => Promise<EventBlockListProjection>;
    listEventRail: (
      command: ListEventRailCommand,
    ) => Promise<EventRailProjection>;
    createSceneOverride: (
      command: CreateSceneOverrideCommand,
    ) => Promise<SceneOverrideProjection>;
    listSceneOverrides: (
      command: ListSceneOverridesCommand,
    ) => Promise<SceneOverrideListProjection>;
    listSceneProjection: (
      command: ListSceneProjectionCommand,
    ) => Promise<SceneProjectionList>;
    updateSceneRuleSet: (
      command: UpdateSceneRuleSetCommand,
    ) => Promise<SceneProjectionList>;
    setSceneEventOverride: (
      command: SetSceneEventOverrideCommand,
    ) => Promise<SceneProjectionList>;
    runSceneExtraction: (
      command: RunSceneExtractionCommand,
    ) => Promise<SceneExtractionResult>;
    listSceneExtractionCandidates: (
      command: ListSceneExtractionCandidatesCommand,
    ) => Promise<SceneExtractionCandidateList>;
    decideSceneExtractionBoundary: (
      command: DecideSceneExtractionBoundaryCommand,
    ) => Promise<SceneExtractionDecisionResult>;
    listSceneAnnotations: (
      command: ListSceneAnnotationsCommand,
    ) => Promise<SceneAnnotationList>;
    decideSceneExtractionAnnotation: (
      command: DecideSceneExtractionAnnotationCommand,
    ) => Promise<SceneExtractionAnnotationDecisionResult>;
    runSceneDraft: (
      command: RunSceneDraftCommand,
    ) => Promise<RunSceneDraftResult>;
    listSceneDraftCandidates: (
      command: ListSceneDraftCandidatesCommand,
    ) => Promise<SceneDraftCandidateList>;
    updateSceneDraftCandidate: (
      command: UpdateSceneDraftCandidateCommand,
    ) => Promise<SceneDraftCandidate>;
    prepareSceneDraftInsertion: (
      command: PrepareSceneDraftInsertionCommand,
    ) => Promise<PrepareSceneDraftInsertionResult>;
    completeSceneDraftInsertion: (
      command: CompleteSceneDraftInsertionCommand,
    ) => Promise<SceneDraftCandidate>;
  };
  fragments: {
    getProfile: () => Promise<FragmentShelfProfile>;
    capture: (
      command: CaptureFragmentCommand,
    ) => Promise<FragmentProjection>;
    list: (
      command: ListFragmentsCommand,
    ) => Promise<FragmentListProjection>;
    update: (
      command: UpdateFragmentCommand,
    ) => Promise<FragmentProjection>;
    recordUse: (
      command: RecordFragmentUseCommand,
    ) => Promise<FragmentProjection>;
    retire: (
      command: RetireFragmentCommand,
    ) => Promise<FragmentProjection>;
  };
  characters: {
    create: (
      command: CreateCharacterCommand,
    ) => Promise<CharacterProjection>;
    list: (
      command: ListCharactersCommand,
    ) => Promise<CharacterListProjection>;
    update: (
      command: UpdateCharacterCommand,
    ) => Promise<CharacterProjection>;
    addEvidence: (
      command: AddCharacterEvidenceCommand,
    ) => Promise<CharacterProjection>;
    retire: (
      command: RetireCharacterCommand,
    ) => Promise<CharacterProjection>;
    createRelation: (
      command: CreateCharacterRelationCommand,
    ) => Promise<CharacterRelationProjection>;
    listRelations: (
      command: ListCharacterRelationsCommand,
    ) => Promise<CharacterRelationListProjection>;
    updateRelation: (
      command: UpdateCharacterRelationCommand,
    ) => Promise<CharacterRelationProjection>;
    retireRelation: (
      command: RetireCharacterRelationCommand,
    ) => Promise<CharacterRelationProjection>;
    runExtraction: (
      command: RunCharacterExtractionCommand,
    ) => Promise<CharacterExtractionResult>;
    listExtractionCandidates: (
      command: ListCharacterExtractionCandidatesCommand,
    ) => Promise<CharacterExtractionCandidateList>;
    decideExtractionItem: (
      command: DecideCharacterExtractionItemCommand,
    ) => Promise<CharacterExtractionDecisionResult>;
    runGeneration: (
      command: RunCharacterGenerationCommand,
    ) => Promise<CharacterGenerationResult>;
    listGenerationCandidates: (
      command: ListCharacterGenerationCandidatesCommand,
    ) => Promise<CharacterGenerationCandidateList>;
    decideGenerationItem: (
      command: DecideCharacterGenerationItemCommand,
    ) => Promise<CharacterGenerationDecisionResult>;
  };
  loreEntries: {
    create: (
      command: CreateLoreEntryCommand,
    ) => Promise<LoreEntryProjection>;
    list: (
      command: ListLoreEntriesCommand,
    ) => Promise<LoreEntryListProjection>;
    update: (
      command: UpdateLoreEntryCommand,
    ) => Promise<LoreEntryProjection>;
    addEvidence: (
      command: AddLoreEntryEvidenceCommand,
    ) => Promise<LoreEntryProjection>;
    retire: (
      command: RetireLoreEntryCommand,
    ) => Promise<LoreEntryProjection>;
  };
  loreCandidates: {
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
  };
  loreForeshadowLinks: {
    link: (
      command: LinkLoreForeshadowCommand,
    ) => Promise<LoreForeshadowLinkProjection>;
    list: (
      command: ListLoreForeshadowLinksCommand,
    ) => Promise<LoreForeshadowLinkListProjection>;
    unlink: (
      command: UnlinkLoreForeshadowCommand,
    ) => Promise<LoreForeshadowLinkProjection>;
  };
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
  plots: {
    create: (
      command: CreatePlotThreadCommand,
    ) => Promise<PlotThreadProjection>;
    list: (
      command: ListPlotThreadsCommand,
    ) => Promise<PlotThreadListProjection>;
    getDefaultBoard: (
      command: GetDefaultPlotBoardCommand,
    ) => Promise<PlotBoardProjection>;
    movePlacement: (
      command: MovePlotPlacementCommand,
    ) => Promise<PlotBoardProjection>;
    setStoryTime: (
      command: SetPlotPlacementStoryTimeCommand,
    ) => Promise<PlotBoardProjection>;
    update: (
      command: UpdatePlotThreadCommand,
    ) => Promise<PlotThreadProjection>;
    retire: (
      command: RetirePlotThreadCommand,
    ) => Promise<PlotThreadProjection>;
    createFromEvent: (
      command: CreatePlotFromEventCommand,
    ) => Promise<PlotEventLinkMutationProjection>;
    createEvent: (
      command: CreateEventFromPlotCommand,
    ) => Promise<PlotEventLinkMutationProjection>;
    linkEvent: (
      command: LinkPlotEventCommand,
    ) => Promise<PlotEventLinkMutationProjection>;
    unlinkEvent: (
      command: UnlinkPlotEventCommand,
    ) => Promise<PlotEventLinkMutationProjection>;
    listEventLinks: (
      command: ListPlotEventLinksCommand,
    ) => Promise<PlotEventLinkListProjection>;
    linkSource: (
      command: LinkPlotThreadSourceCommand,
    ) => Promise<PlotThreadSourceProjection>;
    listSources: (
      command: ListPlotThreadSourcesCommand,
    ) => Promise<PlotThreadSourceListProjection>;
  };
  foreshadowing: {
    getPointProfile: () => Promise<ForeshadowPointProfile>;
    createLine: (
      command: CreateForeshadowLineCommand,
    ) => Promise<ForeshadowLineProjection>;
    listLines: (
      command: ListForeshadowLinesCommand,
    ) => Promise<ForeshadowLineListProjection>;
    updateLine: (
      command: UpdateForeshadowLineCommand,
    ) => Promise<ForeshadowLineProjection>;
    retireLine: (
      command: RetireForeshadowLineCommand,
    ) => Promise<ForeshadowLineProjection>;
    createPoint: (
      command: CreateForeshadowPointCommand,
    ) => Promise<ForeshadowPointProjection>;
    listPoints: (
      command: ListForeshadowPointsCommand,
    ) => Promise<ForeshadowPointListProjection>;
  };
  activity: {
    exportRecords: (
      command: ExportWorkRecordsCommand,
    ) => Promise<ExportWorkRecordsResult>;
    listWork: (
      command: ListWorkActivityCommand,
    ) => Promise<WorkActivityProjection>;
    getRecordsGoals: (
      command: GetWorkRecordsGoalsCommand,
    ) => Promise<WorkRecordsGoalsProjection>;
    saveRecordsGoals: (
      command: SaveWorkRecordsGoalsCommand,
    ) => Promise<WorkRecordsGoalsProjection>;
    getReadthrough: (
      command: GetWorkReadthroughCommand,
    ) => Promise<WorkReadthroughProjection>;
    saveReadthrough: (
      command: SaveWorkReadthroughCommand,
    ) => Promise<WorkReadthroughProjection>;
    startSession: (
      command: StartWritingSessionCommand,
    ) => Promise<WorkActivityProjection>;
    stopSession: (
      command: StopWritingSessionCommand,
    ) => Promise<WorkActivityProjection>;
    startFocus: (
      command: StartFocusCycleCommand,
    ) => Promise<WorkActivityProjection>;
    stopFocus: (
      command: StopFocusCycleCommand,
    ) => Promise<WorkActivityProjection>;
    getPomodoro: (
      command: GetPomodoroCommand,
    ) => Promise<PomodoroProjection>;
    configureAndStartPomodoro: (
      command: ConfigureAndStartPomodoroCommand,
    ) => Promise<PomodoroProjection>;
    pausePomodoro: (
      command: PomodoroPhaseCommand,
    ) => Promise<PomodoroProjection>;
    resumePomodoro: (
      command: PomodoroPhaseCommand,
    ) => Promise<PomodoroProjection>;
    reconcilePomodoro: (
      command: PomodoroPhaseCommand,
    ) => Promise<PomodoroProjection>;
    updatePomodoroNote: (
      command: UpdatePomodoroNoteCommand,
    ) => Promise<PomodoroProjection>;
    stopPomodoro: (
      command: PomodoroPhaseCommand,
    ) => Promise<PomodoroProjection>;
  };
  schedule: {
    listWork: (
      command: ListWorkScheduleCommand,
    ) => Promise<WorkScheduleProjection>;
    listCalendar: (
      command: ListWorkScheduleCommand,
    ) => Promise<WorkCalendarProjection>;
    listToday: (
      command: GetStudioTodayCommand,
    ) => Promise<StudioTodayProjection>;
    createItem: (
      command: CreateWorkScheduleItemCommand,
    ) => Promise<WorkScheduleItemProjection>;
    updateItem: (
      command: UpdateWorkScheduleItemCommand,
    ) => Promise<WorkScheduleItemProjection>;
    retireItem: (
      command: RetireWorkScheduleItemCommand,
    ) => Promise<void>;
    setCompletion: (
      command: SetWorkScheduleCompletionCommand,
    ) => Promise<WorkScheduleItemProjection>;
  };
  settings: {
    getProfile: () => Promise<AppSettingsProfile>;
    get: () => Promise<AppSettingsProjection>;
    save: (
      command: SaveAppSettingsCommand,
    ) => Promise<AppSettingsProjection>;
    getUiPreferences: () => Promise<UiPreferencesProjection>;
    saveUiPreferences: (
      command: SaveUiPreferencesCommand,
    ) => Promise<UiPreferencesProjection>;
    getMusicProfile: () => Promise<MusicSettingsProfile>;
    getWorkMusic: (
      command: GetWorkMusicSettingsCommand,
    ) => Promise<WorkMusicSettingsProjection>;
    saveWorkMusic: (
      command: SaveWorkMusicSettingsCommand,
    ) => Promise<WorkMusicSettingsProjection>;
    getWorkInspiration: (
      command: GetWorkInspirationSettingsCommand,
    ) => Promise<WorkInspirationSettingsProjection>;
    saveWorkInspiration: (
      command: SaveWorkInspirationSettingsCommand,
    ) => Promise<WorkInspirationSettingsProjection>;
    getYouTubeMusicConnectionStatus: () => Promise<YouTubeMusicConnectionStatus>;
    saveYouTubeMusicConnection: (
      command: SaveYouTubeMusicConnectionCommand,
    ) => Promise<YouTubeMusicConnectionStatus>;
  };
  musicPlayback: {
    getProfile: () => Promise<YouTubeMusicProfile>;
    searchVideos: (
      command: SearchYouTubeVideosCommand,
    ) => Promise<YouTubeVideoSearchResult>;
    searchSceneQueues: (
      command: SearchSceneMusicQueuesCommand,
    ) => Promise<SceneMusicQueueSearchResult>;
    listSceneQueueCandidates: (
      command: ListSceneMusicQueueCandidatesCommand,
    ) => Promise<SceneMusicQueueCandidateList>;
    selectSceneQueue: (
      command: SelectSceneMusicQueueCommand,
    ) => Promise<SceneMusicQueueCandidate>;
  };
  quickTools: {
    getMemo: (
      command: GetWorkQuickMemoCommand,
    ) => Promise<WorkQuickMemoProjection>;
    saveMemo: (
      command: SaveWorkQuickMemoCommand,
    ) => Promise<WorkQuickMemoProjection>;
  };
  assistant: {
    getChatGptOAuthStatus: () => Promise<ChatGptOAuthConnectionStatus>;
    startChatGptOAuthLogin: () => Promise<ChatGptOAuthConnectionStatus>;
    runChat: (
      command: RunAssistantChatCommand,
    ) => Promise<AssistantChatResult>;
    listConnections: () => Promise<AssistantConnectionListProjection>;
    saveConnection: (
      command: SaveAssistantConnectionCommand,
    ) => Promise<AssistantConnectionProjection>;
    deleteConnection: (
      command: DeleteAssistantConnectionCommand,
    ) => Promise<void>;
    getConnectorProfile: () => Promise<AssistantConnectorManifestProfile>;
    getDestinationProfile: () => Promise<AssistantDestinationProfile>;
    listContextState: (
      command: ListAssistantContextStateCommand,
    ) => Promise<AssistantContextStateProjection>;
    grantContextPermission: (
      command: GrantAssistantContextPermissionCommand,
    ) => Promise<AssistantContextPermissionGrant>;
    revokeContextPermission: (
      command: RevokeAssistantContextPermissionCommand,
    ) => Promise<AssistantContextPermissionGrant>;
    runVocabularyLookup: (
      command: RunAssistantVocabularyLookupCommand,
    ) => Promise<AssistantVocabularyLookupResult>;
    runVocabularySuggestion: (
      command: RunAssistantVocabularySuggestionCommand,
    ) => Promise<AssistantVocabularySuggestionResult>;
    runExternalSettingReview: (
      command: RunAssistantExternalSettingReviewCommand,
    ) => Promise<AssistantExternalSettingReviewResult>;
    runNotationReview: (
      command: RunAssistantNotationReviewCommand,
    ) => Promise<AssistantNotationReviewResult>;
    runSettingReview: (
      command: RunAssistantSettingReviewCommand,
    ) => Promise<AssistantSettingReviewResult>;
  };
  version: {
    compareWorkSnapshot: (
      command: CompareWorkSnapshotCommand,
    ) => Promise<WorkSnapshotComparisonProjection>;
    listDocumentRevisions: (
      command: ListDocumentRevisionsCommand,
    ) => Promise<DocumentRevisionListProjection>;
    restoreDocumentRevision: (
      command: RestoreDocumentRevisionCommand,
    ) => Promise<RestoreDocumentRevisionResult>;
    createWorkSnapshot: (
      command: CreateWorkSnapshotCommand,
    ) => Promise<WorkSnapshotProjection>;
    listWorkSnapshots: (
      command: ListWorkSnapshotsCommand,
    ) => Promise<WorkSnapshotListProjection>;
  };
  backup: {
    getStatus: () => Promise<LocalWorkspaceBackupStatusProjection>;
    create: () => Promise<LocalWorkspaceBackupActionResult>;
    restore: () => Promise<LocalWorkspaceBackupActionResult>;
  };
  migration: {
    runLegacyLoreRehearsal: () => Promise<LegacyLoreImportRehearsalActionResult>;
  };
  editor: {
    getManuscriptInputProfile: () => Promise<ManuscriptInputProfile>;
    getManuscriptDocumentProfile: () => Promise<ManuscriptDocumentProfile>;
    getManuscriptFormattingProfile: () => Promise<ManuscriptFormattingProfile>;
    getManuscriptPreflightProfile: () => Promise<ManuscriptPreflightProfile>;
    getManuscriptPreflightSettings: (
      command: GetManuscriptPreflightSettingsCommand,
    ) => Promise<ManuscriptPreflightSettingsProjection>;
    saveManuscriptPreflightSettings: (
      command: SaveManuscriptPreflightSettingsCommand,
    ) => Promise<ManuscriptPreflightSettingsProjection>;
    exportManuscriptText: (
      command: ExportManuscriptTextCommand,
    ) => Promise<ExportManuscriptTextResult>;
    selectManuscriptTextImport: (
      command: SelectManuscriptTextImportCommand,
    ) => Promise<ManuscriptTextImportResult>;
    getManuscriptPersistenceProfile: () => Promise<ManuscriptPersistenceProfile | null>;
    getManuscriptStartupRecovery: () => Promise<StartupRecoveryProjection>;
    getManuscriptResumeCheckpoint: () => Promise<ManuscriptResumeCheckpointProjection>;
    getContinuousReadingProgress: (
      command: GetContinuousReadingProgressCommand,
    ) => Promise<WorkContinuousReadingProgressProjection>;
    saveContinuousReadingProgress: (
      command: SaveContinuousReadingProgressCommand,
    ) => Promise<WorkContinuousReadingProgressProjection>;
    saveChangeBatch: (batch: ChangeBatch) => Promise<SaveReceipt>;
    saveDocumentChange: (
      command: SaveManuscriptDocumentChangeCommand,
    ) => Promise<SaveReceipt>;
    saveFormatting: (
      command: SaveManuscriptFormattingCommand,
    ) => Promise<SaveManuscriptFormattingReceipt>;
    getWorkManuscriptLayoutSettings: (
      command: GetWorkManuscriptLayoutSettingsCommand,
    ) => Promise<WorkManuscriptLayoutSettingsProjection>;
    saveWorkManuscriptLayoutSettings: (
      command: SaveWorkManuscriptLayoutSettingsCommand,
    ) => Promise<WorkManuscriptLayoutSettingsProjection>;
    applyManuscriptStartupRecovery: (
      command: ApplyStartupRecoveryCommand,
    ) => Promise<ApplyStartupRecoveryAcknowledgement>;
    onManuscriptCloseRequest: (
      listener: (
        request: ManuscriptCloseRequest,
      ) => void,
    ) => () => void;
    completeManuscriptCloseRequest: (
      result: ManuscriptCloseResult,
    ) => Promise<ManuscriptCloseResult>;
  };
};

export type BridgeInvoke = (
  channel:
    | typeof RUNTIME_INFO_CHANNEL
    | typeof MANUSCRIPT_INPUT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_FORMATTING_PROFILE_CHANNEL
    | typeof MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL
    | typeof MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL
    | typeof MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL
    | typeof MANUSCRIPT_EXPORT_TEXT_CHANNEL
    | typeof MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL
    | typeof MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL
    | typeof MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL
    | typeof MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL
    | typeof MANUSCRIPT_SAVE_FORMATTING_CHANNEL
    | typeof MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL
    | typeof MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL
    | typeof MANUSCRIPT_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL
    | typeof MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL
    | typeof MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL
    | typeof MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL
    | typeof MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL
    | typeof WORKSPACE_CATALOG_CHANNEL
    | typeof WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL
    | typeof WORKSPACE_SET_DOCUMENT_COMPLETION_CHANNEL
    | typeof WORKSPACE_FAVORITES_CHANNEL
    | typeof WORKSPACE_SET_FAVORITE_CHANNEL
    | typeof WORKSPACE_COVERS_CHANNEL
    | typeof WORKSPACE_SELECT_COVER_CHANNEL
    | typeof WORKSPACE_CREATE_FIRST_WORK_CHANNEL
    | typeof WORKSPACE_CREATE_WORK_CHANNEL
    | typeof WORKSPACE_CREATE_DOCUMENT_CHANNEL
    | typeof WORKSPACE_RENAME_WORK_CHANNEL
    | typeof WORKSPACE_RENAME_DOCUMENT_CHANNEL
    | typeof WORKSPACE_RETIRE_WORK_CHANNEL
    | typeof WORKSPACE_RETIRE_DOCUMENT_CHANNEL
    | typeof WORKSPACE_MOVE_DOCUMENT_CHANNEL
    | typeof WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL
    | typeof WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL
    | typeof WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL
    | typeof WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL
    | typeof WORKSPACE_ACTIVATE_LOCATION_CHANNEL
    | typeof WORKSPACE_CAPTURE_RESUME_CHANNEL
    | typeof STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL
    | typeof STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL
    | typeof STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL
    | typeof STRUCTURE_LINK_EVENT_SOURCE_CHANNEL
    | typeof STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL
    | typeof STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL
    | typeof STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL
    | typeof STRUCTURE_LIST_EVENT_RAIL_CHANNEL
    | typeof STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL
    | typeof STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL
    | typeof STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL
    | typeof STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL
    | typeof STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL
    | typeof STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL
    | typeof STRUCTURE_RUN_SCENE_DRAFT_CHANNEL
    | typeof STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL
    | typeof STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL
    | typeof STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL
    | typeof STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL
    | typeof FRAGMENT_PROFILE_CHANNEL
    | typeof FRAGMENT_CAPTURE_CHANNEL
    | typeof FRAGMENT_LIST_CHANNEL
    | typeof FRAGMENT_UPDATE_CHANNEL
    | typeof FRAGMENT_RECORD_USE_CHANNEL
    | typeof FRAGMENT_RETIRE_CHANNEL
    | typeof CHARACTER_CREATE_CHANNEL
    | typeof CHARACTER_LIST_CHANNEL
    | typeof CHARACTER_UPDATE_CHANNEL
    | typeof CHARACTER_ADD_EVIDENCE_CHANNEL
    | typeof CHARACTER_RETIRE_CHANNEL
    | typeof CHARACTER_RELATION_CREATE_CHANNEL
    | typeof CHARACTER_RELATION_LIST_CHANNEL
    | typeof CHARACTER_RELATION_UPDATE_CHANNEL
    | typeof CHARACTER_RELATION_RETIRE_CHANNEL
    | typeof CHARACTER_EXTRACTION_RUN_CHANNEL
    | typeof CHARACTER_EXTRACTION_LIST_CHANNEL
    | typeof CHARACTER_EXTRACTION_DECIDE_CHANNEL
    | typeof CHARACTER_GENERATION_RUN_CHANNEL
    | typeof CHARACTER_GENERATION_LIST_CHANNEL
    | typeof CHARACTER_GENERATION_DECIDE_CHANNEL
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
    | typeof LORE_FORESHADOW_UNLINK_CHANNEL
    | typeof PUBLISHING_PARTNER_CREATE_CHANNEL
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
    | typeof PLOT_CREATE_CHANNEL
    | typeof PLOT_LIST_CHANNEL
    | typeof PLOT_DEFAULT_BOARD_CHANNEL
    | typeof PLOT_MOVE_PLACEMENT_CHANNEL
    | typeof PLOT_SET_STORY_TIME_CHANNEL
    | typeof PLOT_UPDATE_CHANNEL
    | typeof PLOT_RETIRE_CHANNEL
    | typeof PLOT_CREATE_FROM_EVENT_CHANNEL
    | typeof PLOT_CREATE_EVENT_CHANNEL
    | typeof PLOT_LINK_EVENT_CHANNEL
    | typeof PLOT_UNLINK_EVENT_CHANNEL
    | typeof PLOT_EVENT_LINK_LIST_CHANNEL
    | typeof PLOT_LINK_SOURCE_CHANNEL
    | typeof PLOT_SOURCE_LIST_CHANNEL
    | typeof FORESHADOW_CREATE_LINE_CHANNEL
    | typeof FORESHADOW_LIST_LINES_CHANNEL
    | typeof FORESHADOW_UPDATE_LINE_CHANNEL
    | typeof FORESHADOW_RETIRE_LINE_CHANNEL
    | typeof FORESHADOW_POINT_PROFILE_CHANNEL
    | typeof FORESHADOW_CREATE_POINT_CHANNEL
    | typeof FORESHADOW_LIST_POINTS_CHANNEL
    | typeof ACTIVITY_LIST_WORK_CHANNEL
    | typeof ACTIVITY_EXPORT_RECORDS_CHANNEL
    | typeof ACTIVITY_GET_RECORDS_GOALS_CHANNEL
    | typeof ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL
    | typeof ACTIVITY_GET_READTHROUGH_CHANNEL
    | typeof ACTIVITY_SAVE_READTHROUGH_CHANNEL
    | typeof ACTIVITY_START_SESSION_CHANNEL
    | typeof ACTIVITY_STOP_SESSION_CHANNEL
    | typeof ACTIVITY_START_FOCUS_CHANNEL
    | typeof ACTIVITY_STOP_FOCUS_CHANNEL
    | typeof ACTIVITY_GET_POMODORO_CHANNEL
    | typeof ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL
    | typeof ACTIVITY_PAUSE_POMODORO_CHANNEL
    | typeof ACTIVITY_RESUME_POMODORO_CHANNEL
    | typeof ACTIVITY_RECONCILE_POMODORO_CHANNEL
    | typeof ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL
    | typeof ACTIVITY_STOP_POMODORO_CHANNEL
    | typeof SCHEDULE_LIST_WORK_CHANNEL
    | typeof SCHEDULE_LIST_CALENDAR_CHANNEL
    | typeof SCHEDULE_LIST_TODAY_CHANNEL
    | typeof SCHEDULE_CREATE_ITEM_CHANNEL
    | typeof SCHEDULE_UPDATE_ITEM_CHANNEL
    | typeof SCHEDULE_RETIRE_ITEM_CHANNEL
    | typeof SCHEDULE_SET_COMPLETION_CHANNEL
    | typeof QUICK_TOOLS_GET_MEMO_CHANNEL
    | typeof QUICK_TOOLS_SAVE_MEMO_CHANNEL
    | typeof ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL
    | typeof ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL
    | typeof ASSISTANT_CHAT_RUN_CHANNEL
    | typeof ASSISTANT_LIST_CONTEXT_STATE_CHANNEL
    | typeof ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL
    | typeof ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL
    | typeof ASSISTANT_DESTINATION_PROFILE_CHANNEL
    | typeof ASSISTANT_CONNECTOR_PROFILE_CHANNEL
    | typeof ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL
    | typeof ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL
    | typeof ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL
    | typeof ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL
    | typeof ASSISTANT_RUN_SETTING_REVIEW_CHANNEL
    | typeof ASSISTANT_LIST_CONNECTIONS_CHANNEL
    | typeof ASSISTANT_SAVE_CONNECTION_CHANNEL
    | typeof ASSISTANT_DELETE_CONNECTION_CHANNEL
    | typeof APP_SETTINGS_PROFILE_CHANNEL
    | typeof APP_SETTINGS_GET_CHANNEL
    | typeof APP_SETTINGS_SAVE_CHANNEL
    | typeof UI_PREFERENCES_GET_CHANNEL
    | typeof UI_PREFERENCES_SAVE_CHANNEL
    | typeof MUSIC_SETTINGS_PROFILE_CHANNEL
    | typeof MUSIC_SETTINGS_GET_WORK_CHANNEL
    | typeof MUSIC_SETTINGS_SAVE_WORK_CHANNEL
    | typeof INSPIRATION_SETTINGS_GET_WORK_CHANNEL
    | typeof INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL
    | typeof YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL
    | typeof YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL
    | typeof YOUTUBE_MUSIC_PROFILE_CHANNEL
    | typeof YOUTUBE_MUSIC_SEARCH_CHANNEL
    | typeof SCENE_MUSIC_QUEUE_SEARCH_CHANNEL
    | typeof SCENE_MUSIC_QUEUE_LIST_CHANNEL
    | typeof SCENE_MUSIC_QUEUE_SELECT_CHANNEL
    | typeof VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL
    | typeof VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL
    | typeof VERSION_CREATE_WORK_SNAPSHOT_CHANNEL
    | typeof VERSION_LIST_WORK_SNAPSHOTS_CHANNEL
    | typeof VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL
    | typeof BACKUP_GET_STATUS_CHANNEL
    | typeof BACKUP_CREATE_CHANNEL
    | typeof BACKUP_RESTORE_CHANNEL
    | typeof MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  payload?:
    | ChangeBatch
    | SaveManuscriptDocumentChangeCommand
    | SaveManuscriptFormattingCommand
    | GetWorkManuscriptLayoutSettingsCommand
    | SaveWorkManuscriptLayoutSettingsCommand
    | GetManuscriptPreflightSettingsCommand
    | SaveManuscriptPreflightSettingsCommand
    | ExportManuscriptTextCommand
    | SelectManuscriptTextImportCommand
    | ApplyStartupRecoveryCommand
    | ManuscriptCloseResult
    | GetContinuousReadingProgressCommand
    | SaveContinuousReadingProgressCommand
    | CreateFirstWorkCommand
    | CreateWorkCommand
    | CreateDocumentCommand
    | RenameWorkCommand
    | RenameDocumentCommand
    | RetireWorkCommand
    | RetireDocumentCommand
    | ActivateWorkspaceLocationCommand
    | CaptureWorkspaceResumeCommand
    | CreateEventBlockCommand
    | CreateAnchorlessEventCommand
    | LinkEventSourceCommand
    | ReplaceEventSourceCommand
    | RetireEventSourceCommand
    | ListEventBlocksCommand
    | ListEventRailCommand
    | CreateSceneOverrideCommand
    | ListSceneOverridesCommand
    | ListSceneProjectionCommand
    | UpdateSceneRuleSetCommand
    | SetSceneEventOverrideCommand
    | RunSceneExtractionCommand
    | ListSceneExtractionCandidatesCommand
    | DecideSceneExtractionBoundaryCommand
    | ListSceneAnnotationsCommand
    | DecideSceneExtractionAnnotationCommand
    | RunSceneDraftCommand
    | ListSceneDraftCandidatesCommand
    | UpdateSceneDraftCandidateCommand
    | PrepareSceneDraftInsertionCommand
    | CompleteSceneDraftInsertionCommand
    | SearchSceneMusicQueuesCommand
    | ListSceneMusicQueueCandidatesCommand
    | SelectSceneMusicQueueCommand
    | CaptureFragmentCommand
    | ListFragmentsCommand
    | UpdateFragmentCommand
    | RecordFragmentUseCommand
    | RetireFragmentCommand
    | CreateCharacterCommand
    | ListCharactersCommand
    | UpdateCharacterCommand
    | AddCharacterEvidenceCommand
    | RetireCharacterCommand
    | CreateCharacterRelationCommand
    | ListCharacterRelationsCommand
    | UpdateCharacterRelationCommand
    | RetireCharacterRelationCommand
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
    | UnlinkLoreForeshadowCommand
    | CreatePublishingPartnerCommand
    | ListPublishingPartnersCommand
    | UpdatePublishingPartnerCommand
    | CreatePlotThreadCommand
    | ListPlotThreadsCommand
    | UpdatePlotThreadCommand
    | RetirePlotThreadCommand
    | CreatePlotFromEventCommand
    | CreateEventFromPlotCommand
    | LinkPlotEventCommand
    | UnlinkPlotEventCommand
    | ListPlotEventLinksCommand
    | CreateForeshadowLineCommand
    | ListForeshadowLinesCommand
    | UpdateForeshadowLineCommand
    | RetireForeshadowLineCommand
    | CreateForeshadowPointCommand
    | ListForeshadowPointsCommand
    | ListWorkActivityCommand
    | ExportWorkRecordsCommand
    | GetWorkRecordsGoalsCommand
    | SaveWorkRecordsGoalsCommand
    | GetWorkReadthroughCommand
    | SaveWorkReadthroughCommand
    | StartWritingSessionCommand
    | StopWritingSessionCommand
    | StartFocusCycleCommand
    | StopFocusCycleCommand
    | GetPomodoroCommand
    | ConfigureAndStartPomodoroCommand
    | PomodoroPhaseCommand
    | ListWorkScheduleCommand
    | CreateWorkScheduleItemCommand
    | UpdateWorkScheduleItemCommand
    | RetireWorkScheduleItemCommand
    | SetWorkScheduleCompletionCommand
    | GetWorkQuickMemoCommand
    | SaveWorkQuickMemoCommand
    | ListAssistantContextStateCommand
    | GrantAssistantContextPermissionCommand
    | RevokeAssistantContextPermissionCommand
    | RunAssistantVocabularyLookupCommand
    | RunAssistantVocabularySuggestionCommand
    | RunAssistantExternalSettingReviewCommand
    | RunCharacterExtractionCommand
    | ListCharacterExtractionCandidatesCommand
    | DecideCharacterExtractionItemCommand
    | RunCharacterGenerationCommand
    | ListCharacterGenerationCandidatesCommand
    | DecideCharacterGenerationItemCommand
    | RunAssistantNotationReviewCommand
    | RunAssistantSettingReviewCommand
    | SaveAssistantConnectionCommand
    | DeleteAssistantConnectionCommand
    | SaveAppSettingsCommand
    | GetWorkMusicSettingsCommand
    | SaveWorkMusicSettingsCommand
    | GetWorkInspirationSettingsCommand
    | SaveWorkInspirationSettingsCommand
    | SaveYouTubeMusicConnectionCommand
    | ListDocumentRevisionsCommand
    | RestoreDocumentRevisionCommand
    | CreateWorkSnapshotCommand
    | ListWorkSnapshotsCommand
    | CompareWorkSnapshotCommand,
) => Promise<unknown>;

export type BridgeListen = (
  channel: typeof MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  listener: (payload: unknown) => void,
) => () => void;

function parseCloseContractRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${recordName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertCloseContractFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  recordName: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported ${recordName} field: ${field}`,
      );
    }
  }
}

function parseCloseRequestId(
  value: unknown,
  recordName: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${recordName}.requestId must be a non-empty string`,
    );
  }
  return value;
}

export function parseManuscriptCloseRequest(
  value: unknown,
): ManuscriptCloseRequest {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseRequest",
  );
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId"],
    "ManuscriptCloseRequest",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseRequest schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseRequest",
    ),
  });
}

export function parseManuscriptCloseResult(
  value: unknown,
): ManuscriptCloseResult {
  const input = parseCloseContractRecord(
    value,
    "ManuscriptCloseResult",
  );
  assertCloseContractFields(
    input,
    ["schemaVersion", "requestId", "status"],
    "ManuscriptCloseResult",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ManuscriptCloseResult schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }
  if (
    input.status !== "saved" &&
    input.status !== "failed"
  ) {
    throw new Error(
      `Unsupported ManuscriptCloseResult status: ${String(
        input.status,
      )}`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCloseRequestId(
      input.requestId,
      "ManuscriptCloseResult",
    ),
    status: input.status,
  });
}

export function isRuntimeInfo(value: unknown): value is RuntimeInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.appName === "string" &&
    typeof candidate.appVersion === "string" &&
    typeof candidate.platform === "string" &&
    typeof candidate.architecture === "string"
  );
}

export function createStudioBridge(
  invoke: BridgeInvoke,
  listen: BridgeListen,
): StudioBridge {
  return {
    system: {
      getRuntimeInfo: async () => {
        const value = await invoke(RUNTIME_INFO_CHANNEL);
        if (!isRuntimeInfo(value)) {
          throw new Error("Invalid runtime information");
        }
        return value;
      },
    },
    workspace: {
      getCatalog: async () => {
        const value = await invoke(WORKSPACE_CATALOG_CHANNEL);
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid workspace catalog");
        }
      },
      getDocumentCompletion: async (input) => {
        const command = parseGetDocumentCompletionCommand(input);
        const value = await invoke(
          WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
          command,
        );
        try {
          return parseDocumentCompletionProjection(value);
        } catch {
          throw new Error("Invalid Document completion projection");
        }
      },
      setDocumentCompletion: async (input) => {
        const command = parseSetDocumentCompletionCommand(input);
        const value = await invoke(
          WORKSPACE_SET_DOCUMENT_COMPLETION_CHANNEL,
          command,
        );
        try {
          return parseDocumentCompletionProjection(value);
        } catch {
          throw new Error("Invalid saved Document completion projection");
        }
      },
      getFavorites: async () => {
        const value = await invoke(WORKSPACE_FAVORITES_CHANNEL);
        try {
          return parseWorkFavoritesProjection(value);
        } catch {
          throw new Error("Invalid Work favorites projection");
        }
      },
      setFavorite: async (input) => {
        const command = parseSetWorkFavoriteCommand(input);
        const value = await invoke(WORKSPACE_SET_FAVORITE_CHANNEL, command);
        try {
          return parseWorkFavoritesProjection(value);
        } catch {
          throw new Error("Invalid Work favorites update result");
        }
      },
      getCovers: async () => {
        const value = await invoke(WORKSPACE_COVERS_CHANNEL);
        try {
          return parseWorkCoversProjection(value);
        } catch {
          throw new Error("Invalid Work covers projection");
        }
      },
      selectCover: async (input) => {
        const command = parseSelectWorkCoverCommand(input);
        const value = await invoke(WORKSPACE_SELECT_COVER_CHANNEL, command);
        if (value === null) return null;
        try {
          return parseWorkCoverProjection(value);
        } catch {
          throw new Error("Invalid Work cover selection result");
        }
      },
      activateLocation: async (input) => {
        const command = parseActivateWorkspaceLocationCommand(input);
        const value = await invoke(
          WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid workspace activation result");
        }
      },
      createWork: async (input) => {
        const command = parseCreateWorkCommand(input);
        const value = await invoke(WORKSPACE_CREATE_WORK_CHANNEL, command);
        try {
          return parseCreateWorkResult(value);
        } catch {
          throw new Error("Invalid Work creation result");
        }
      },
      createFirstWork: async (input) => {
        const command = parseCreateFirstWorkCommand(input);
        const value = await invoke(
          WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
          command,
        );
        try {
          return parseCreateFirstWorkResult(value);
        } catch {
          throw new Error("Invalid first Work creation result");
        }
      },
      createDocument: async (input) => {
        const command = parseCreateDocumentCommand(input);
        const value = await invoke(
          WORKSPACE_CREATE_DOCUMENT_CHANNEL,
          command,
        );
        try {
          return parseCreateDocumentResult(value);
        } catch {
          throw new Error("Invalid Document creation result");
        }
      },
      renameWork: async (input) => {
        const command = parseRenameWorkCommand(input);
        const value = await invoke(
          WORKSPACE_RENAME_WORK_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Work rename result");
        }
      },
      renameDocument: async (input) => {
        const command = parseRenameDocumentCommand(input);
        const value = await invoke(
          WORKSPACE_RENAME_DOCUMENT_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document rename result");
        }
      },
      retireWork: async (input) => {
        const command = parseRetireWorkCommand(input);
        const value = await invoke(
          WORKSPACE_RETIRE_WORK_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Work retirement result");
        }
      },
      retireDocument: async (input) => {
        const command = parseRetireDocumentCommand(input);
        const value = await invoke(
          WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document retirement result");
        }
      },
      moveDocument: async (input) => {
        const command = parseMoveDocumentCommand(input);
        const value = await invoke(
          WORKSPACE_MOVE_DOCUMENT_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document move result");
        }
      },
      createDocumentFolder: async (input) => {
        const command = parseCreateDocumentFolderCommand(input);
        const value = await invoke(
          WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document folder creation result");
        }
      },
      renameDocumentFolder: async (input) => {
        const command = parseRenameDocumentFolderCommand(input);
        const value = await invoke(
          WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document folder rename result");
        }
      },
      placeDocumentInFolder: async (input) => {
        const command = parsePlaceDocumentInFolderCommand(input);
        const value = await invoke(
          WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document folder placement result");
        }
      },
      retireDocumentFolder: async (input) => {
        const command = parseRetireDocumentFolderCommand(input);
        const value = await invoke(
          WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
          command,
        );
        try {
          return parseWorkspaceCatalogProjection(value);
        } catch {
          throw new Error("Invalid Document folder retirement result");
        }
      },
      captureResume: async (input) => {
        const command = parseCaptureWorkspaceResumeCommand(input);
        const value = await invoke(
          WORKSPACE_CAPTURE_RESUME_CHANNEL,
          command,
        );
        try {
          return parseManuscriptResumeCheckpointProjection(value);
        } catch {
          throw new Error("Invalid workspace resume result");
        }
      },
    },
    structure: {
      createEventBlock: async (input) => {
        const command = parseCreateEventBlockCommand(input);
        const value = await invoke(
          STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
          command,
        );
        try {
          return parseEventBlockProjection(value);
        } catch {
          throw new Error("Invalid EventBlock creation result");
        }
      },
      createAnchorlessEvent: async (input) => {
        const command = parseCreateAnchorlessEventCommand(input);
        const value = await invoke(
          STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
          command,
        );
        try {
          return parseEventBlockProjection(value);
        } catch {
          throw new Error("Invalid anchorless EventBlock creation result");
        }
      },
      moveEventBlock: async (input) => {
        const command = parseMoveEventBlockCommand(input);
        const value = await invoke(
          STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
          command,
        );
        try {
          return parseEventBlockListProjection(value);
        } catch {
          throw new Error("Invalid EventBlock move result");
        }
      },
      linkEventSource: async (input) => {
        const command = parseLinkEventSourceCommand(input);
        const value = await invoke(
          STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
          command,
        );
        try {
          return parseEventSourceProjection(value);
        } catch {
          throw new Error("Invalid EventSource link result");
        }
      },
      replaceEventSource: async (input) => {
        const command = parseReplaceEventSourceCommand(input);
        const value = await invoke(
          STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
          command,
        );
        try {
          return parseEventSourceProjection(value);
        } catch {
          throw new Error("Invalid EventSource replacement result");
        }
      },
      retireEventSource: async (input) => {
        const command = parseRetireEventSourceCommand(input);
        const value = await invoke(
          STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
          command,
        );
        try {
          return parseEventSourceProjection(value);
        } catch {
          throw new Error("Invalid EventSource retirement result");
        }
      },
      listEventBlocks: async (input) => {
        const command = parseListEventBlocksCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
          command,
        );
        try {
          return parseEventBlockListProjection(value);
        } catch {
          throw new Error("Invalid EventBlock list");
        }
      },
      listEventRail: async (input) => {
        const command = parseListEventRailCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
          command,
        );
        try {
          return parseEventRailProjection(value);
        } catch {
          throw new Error("Invalid event rail projection");
        }
      },
      createSceneOverride: async (input) => {
        const command = parseCreateSceneOverrideCommand(input);
        const value = await invoke(
          STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
          command,
        );
        try {
          return parseSceneOverrideProjection(value);
        } catch {
          throw new Error("Invalid SceneOverride creation result");
        }
      },
      listSceneOverrides: async (input) => {
        const command = parseListSceneOverridesCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
          command,
        );
        try {
          return parseSceneOverrideListProjection(value);
        } catch {
          throw new Error("Invalid SceneOverride list");
        }
      },
      listSceneProjection: async (input) => {
        const command = parseListSceneProjectionCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
          command,
        );
        try {
          return parseSceneProjectionList(value);
        } catch {
          throw new Error("Invalid SceneProjection list");
        }
      },
      updateSceneRuleSet: async (input) => {
        const command = parseUpdateSceneRuleSetCommand(input);
        const value = await invoke(
          STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
          command,
        );
        try {
          return parseSceneProjectionList(value);
        } catch {
          throw new Error("Invalid SceneProjection list");
        }
      },
      setSceneEventOverride: async (input) => {
        const command = parseSetSceneEventOverrideCommand(input);
        const value = await invoke(
          STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
          command,
        );
        try {
          return parseSceneProjectionList(value);
        } catch {
          throw new Error("Invalid SceneProjection list");
        }
      },
      runSceneExtraction: async (input) => {
        const command = parseRunSceneExtractionCommand(input);
        const value = await invoke(
          STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
          command,
        );
        try {
          return parseSceneExtractionResult(value);
        } catch {
          throw new Error("Invalid scene extraction result");
        }
      },
      listSceneExtractionCandidates: async (input) => {
        const command = parseListSceneExtractionCandidatesCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
          command,
        );
        try {
          return parseSceneExtractionCandidateList(value);
        } catch {
          throw new Error("Invalid scene extraction Candidate list");
        }
      },
      decideSceneExtractionBoundary: async (input) => {
        const command = parseDecideSceneExtractionBoundaryCommand(input);
        const value = await invoke(
          STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
          command,
        );
        try {
          return parseSceneExtractionDecisionResult(value);
        } catch {
          throw new Error("Invalid scene extraction decision result");
        }
      },
      listSceneAnnotations: async (input) => {
        const command = parseListSceneAnnotationsCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
          command,
        );
        try {
          return parseSceneAnnotationList(value);
        } catch {
          throw new Error("Invalid scene annotation list");
        }
      },
      decideSceneExtractionAnnotation: async (input) => {
        const command = parseDecideSceneExtractionAnnotationCommand(input);
        const value = await invoke(
          STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
          command,
        );
        try {
          return parseSceneExtractionAnnotationDecisionResult(value);
        } catch {
          throw new Error("Invalid scene extraction annotation decision result");
        }
      },
      runSceneDraft: async (input) => {
        const command = parseRunSceneDraftCommand(input);
        const value = await invoke(STRUCTURE_RUN_SCENE_DRAFT_CHANNEL, command);
        try {
          return parseRunSceneDraftResult(value);
        } catch {
          throw new Error("Invalid scene draft result");
        }
      },
      listSceneDraftCandidates: async (input) => {
        const command = parseListSceneDraftCandidatesCommand(input);
        const value = await invoke(
          STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
          command,
        );
        try {
          return parseSceneDraftCandidateList(value);
        } catch {
          throw new Error("Invalid scene draft Candidate list");
        }
      },
      updateSceneDraftCandidate: async (input) => {
        const command = parseUpdateSceneDraftCandidateCommand(input);
        const value = await invoke(
          STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
          command,
        );
        try {
          return parseSceneDraftCandidate(value);
        } catch {
          throw new Error("Invalid updated scene draft Candidate");
        }
      },
      prepareSceneDraftInsertion: async (input) => {
        const command = parsePrepareSceneDraftInsertionCommand(input);
        const value = await invoke(
          STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
          command,
        );
        try {
          return parsePrepareSceneDraftInsertionResult(value);
        } catch {
          throw new Error("Invalid scene draft insertion preparation");
        }
      },
      completeSceneDraftInsertion: async (input) => {
        const command = parseCompleteSceneDraftInsertionCommand(input);
        const value = await invoke(
          STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
          command,
        );
        try {
          return parseSceneDraftCandidate(value);
        } catch {
          throw new Error("Invalid completed scene draft Candidate");
        }
      },
    },
    fragments: {
      getProfile: async () => {
        const value = await invoke(FRAGMENT_PROFILE_CHANNEL);
        try {
          return parseFragmentShelfProfile(value);
        } catch {
          throw new Error("Invalid fragment shelf profile");
        }
      },
      capture: async (input) => {
        const command = parseCaptureFragmentCommand(input);
        const value = await invoke(FRAGMENT_CAPTURE_CHANNEL, command);
        try {
          return parseFragmentProjection(value);
        } catch {
          throw new Error("Invalid fragment capture result");
        }
      },
      list: async (input) => {
        const command = parseListFragmentsCommand(input);
        const value = await invoke(FRAGMENT_LIST_CHANNEL, command);
        try {
          return parseFragmentListProjection(value);
        } catch {
          throw new Error("Invalid fragment list");
        }
      },
      update: async (input) => {
        const command = parseUpdateFragmentCommand(input);
        const value = await invoke(FRAGMENT_UPDATE_CHANNEL, command);
        try {
          return parseFragmentProjection(value);
        } catch {
          throw new Error("Invalid fragment update result");
        }
      },
      recordUse: async (input) => {
        const command = parseRecordFragmentUseCommand(input);
        const value = await invoke(FRAGMENT_RECORD_USE_CHANNEL, command);
        try {
          return parseFragmentProjection(value);
        } catch {
          throw new Error("Invalid fragment use result");
        }
      },
      retire: async (input) => {
        const command = parseRetireFragmentCommand(input);
        const value = await invoke(FRAGMENT_RETIRE_CHANNEL, command);
        try {
          return parseFragmentProjection(value);
        } catch {
          throw new Error("Invalid fragment retirement result");
        }
      },
    },
    characters: {
      create: async (input) => {
        const command = parseCreateCharacterCommand(input);
        const value = await invoke(CHARACTER_CREATE_CHANNEL, command);
        try {
          return parseCharacterProjection(value);
        } catch {
          throw new Error("Invalid character creation result");
        }
      },
      list: async (input) => {
        const command = parseListCharactersCommand(input);
        const value = await invoke(CHARACTER_LIST_CHANNEL, command);
        try {
          return parseCharacterListProjection(value);
        } catch {
          throw new Error("Invalid character list");
        }
      },
      update: async (input) => {
        const command = parseUpdateCharacterCommand(input);
        const value = await invoke(CHARACTER_UPDATE_CHANNEL, command);
        try {
          return parseCharacterProjection(value);
        } catch {
          throw new Error("Invalid character update result");
        }
      },
      addEvidence: async (input) => {
        const command = parseAddCharacterEvidenceCommand(input);
        const value = await invoke(CHARACTER_ADD_EVIDENCE_CHANNEL, command);
        try {
          return parseCharacterProjection(value);
        } catch {
          throw new Error("Invalid character evidence result");
        }
      },
      retire: async (input) => {
        const command = parseRetireCharacterCommand(input);
        const value = await invoke(CHARACTER_RETIRE_CHANNEL, command);
        try {
          return parseCharacterProjection(value);
        } catch {
          throw new Error("Invalid character retirement result");
        }
      },
      createRelation: async (input) => {
        const command = parseCreateCharacterRelationCommand(input);
        const value = await invoke(CHARACTER_RELATION_CREATE_CHANNEL, command);
        try {
          return parseCharacterRelationProjection(value);
        } catch {
          throw new Error("Invalid character relation creation result");
        }
      },
      listRelations: async (input) => {
        const command = parseListCharacterRelationsCommand(input);
        const value = await invoke(CHARACTER_RELATION_LIST_CHANNEL, command);
        try {
          return parseCharacterRelationListProjection(value);
        } catch {
          throw new Error("Invalid character relation list");
        }
      },
      updateRelation: async (input) => {
        const command = parseUpdateCharacterRelationCommand(input);
        const value = await invoke(CHARACTER_RELATION_UPDATE_CHANNEL, command);
        try {
          return parseCharacterRelationProjection(value);
        } catch {
          throw new Error("Invalid character relation update result");
        }
      },
      retireRelation: async (input) => {
        const command = parseRetireCharacterRelationCommand(input);
        const value = await invoke(CHARACTER_RELATION_RETIRE_CHANNEL, command);
        try {
          return parseCharacterRelationProjection(value);
        } catch {
          throw new Error("Invalid character relation retirement result");
        }
      },
      runExtraction: async (input) => {
        const command = parseRunCharacterExtractionCommand(input);
        const value = await invoke(CHARACTER_EXTRACTION_RUN_CHANNEL, command);
        try {
          return parseCharacterExtractionResult(value);
        } catch {
          throw new Error("Invalid character extraction result");
        }
      },
      listExtractionCandidates: async (input) => {
        const command = parseListCharacterExtractionCandidatesCommand(input);
        const value = await invoke(CHARACTER_EXTRACTION_LIST_CHANNEL, command);
        try {
          return parseCharacterExtractionCandidateList(value);
        } catch {
          throw new Error("Invalid character extraction Candidate list");
        }
      },
      decideExtractionItem: async (input) => {
        const command = parseDecideCharacterExtractionItemCommand(input);
        const value = await invoke(CHARACTER_EXTRACTION_DECIDE_CHANNEL, command);
        try {
          return parseCharacterExtractionDecisionResult(
            value,
            parseCharacterProjection,
          );
        } catch {
          throw new Error("Invalid character extraction decision result");
        }
      },
      runGeneration: async (input) => {
        const command = parseRunCharacterGenerationCommand(input);
        const value = await invoke(CHARACTER_GENERATION_RUN_CHANNEL, command);
        try {
          return parseCharacterGenerationResult(value);
        } catch {
          throw new Error("Invalid character generation result");
        }
      },
      listGenerationCandidates: async (input) => {
        const command = parseListCharacterGenerationCandidatesCommand(input);
        const value = await invoke(CHARACTER_GENERATION_LIST_CHANNEL, command);
        try {
          return parseCharacterGenerationCandidateList(value);
        } catch {
          throw new Error("Invalid character generation Candidate list");
        }
      },
      decideGenerationItem: async (input) => {
        const command = parseDecideCharacterGenerationItemCommand(input);
        const value = await invoke(CHARACTER_GENERATION_DECIDE_CHANNEL, command);
        try {
          return parseCharacterGenerationDecisionResult(
            value,
            parseCharacterProjection,
          );
        } catch {
          throw new Error("Invalid character generation decision result");
        }
      },
    },
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
    plots: {
      create: async (input) => {
        const command = parseCreatePlotThreadCommand(input);
        const value = await invoke(PLOT_CREATE_CHANNEL, command);
        try {
          return parsePlotThreadProjection(value);
        } catch {
          throw new Error("Invalid plot creation result");
        }
      },
      list: async (input) => {
        const command = parseListPlotThreadsCommand(input);
        const value = await invoke(PLOT_LIST_CHANNEL, command);
        try {
          return parsePlotThreadListProjection(value);
        } catch {
          throw new Error("Invalid plot list");
        }
      },
      getDefaultBoard: async (input) => {
        const command = parseGetDefaultPlotBoardCommand(input);
        const value = await invoke(PLOT_DEFAULT_BOARD_CHANNEL, command);
        try {
          return parsePlotBoardProjection(value);
        } catch {
          throw new Error("Invalid default plot board");
        }
      },
      movePlacement: async (input) => {
        const command = parseMovePlotPlacementCommand(input);
        const value = await invoke(PLOT_MOVE_PLACEMENT_CHANNEL, command);
        try {
          return parsePlotBoardProjection(value);
        } catch {
          throw new Error("Invalid plot placement move result");
        }
      },
      setStoryTime: async (input) => {
        const command = parseSetPlotPlacementStoryTimeCommand(input);
        const value = await invoke(PLOT_SET_STORY_TIME_CHANNEL, command);
        try {
          return parsePlotBoardProjection(value);
        } catch {
          throw new Error("Invalid plot placement story-time result");
        }
      },
      update: async (input) => {
        const command = parseUpdatePlotThreadCommand(input);
        const value = await invoke(PLOT_UPDATE_CHANNEL, command);
        try {
          return parsePlotThreadProjection(value);
        } catch {
          throw new Error("Invalid plot update result");
        }
      },
      retire: async (input) => {
        const command = parseRetirePlotThreadCommand(input);
        const value = await invoke(PLOT_RETIRE_CHANNEL, command);
        try {
          return parsePlotThreadProjection(value);
        } catch {
          throw new Error("Invalid plot retirement result");
        }
      },
      createFromEvent: async (input) => {
        const command = parseCreatePlotFromEventCommand(input);
        const value = await invoke(PLOT_CREATE_FROM_EVENT_CHANNEL, command);
        try {
          return parsePlotEventLinkMutationProjection(value);
        } catch {
          throw new Error("Invalid plot creation from event result");
        }
      },
      createEvent: async (input) => {
        const command = parseCreateEventFromPlotCommand(input);
        const value = await invoke(PLOT_CREATE_EVENT_CHANNEL, command);
        try {
          return parsePlotEventLinkMutationProjection(value);
        } catch {
          throw new Error("Invalid event creation from plot result");
        }
      },
      linkEvent: async (input) => {
        const command = parseLinkPlotEventCommand(input);
        const value = await invoke(PLOT_LINK_EVENT_CHANNEL, command);
        try {
          return parsePlotEventLinkMutationProjection(value);
        } catch {
          throw new Error("Invalid plot/event link result");
        }
      },
      unlinkEvent: async (input) => {
        const command = parseUnlinkPlotEventCommand(input);
        const value = await invoke(PLOT_UNLINK_EVENT_CHANNEL, command);
        try {
          return parsePlotEventLinkMutationProjection(value);
        } catch {
          throw new Error("Invalid plot/event unlink result");
        }
      },
      listEventLinks: async (input) => {
        const command = parseListPlotEventLinksCommand(input);
        const value = await invoke(PLOT_EVENT_LINK_LIST_CHANNEL, command);
        try {
          return parsePlotEventLinkListProjection(value);
        } catch {
          throw new Error("Invalid plot/event link list");
        }
      },
      linkSource: async (input) => {
        const command = parseLinkPlotThreadSourceCommand(input);
        const value = await invoke(PLOT_LINK_SOURCE_CHANNEL, command);
        try {
          return parsePlotThreadSourceProjection(value);
        } catch {
          throw new Error("Invalid plot source link result");
        }
      },
      listSources: async (input) => {
        const command = parseListPlotThreadSourcesCommand(input);
        const value = await invoke(PLOT_SOURCE_LIST_CHANNEL, command);
        try {
          return parsePlotThreadSourceListProjection(value);
        } catch {
          throw new Error("Invalid plot source list");
        }
      },
    },
    foreshadowing: {
      getPointProfile: async () => {
        const value = await invoke(FORESHADOW_POINT_PROFILE_CHANNEL);
        try {
          return parseForeshadowPointProfile(value);
        } catch {
          throw new Error("Invalid foreshadow point profile");
        }
      },
      createLine: async (input) => {
        const command = parseCreateForeshadowLineCommand(input);
        const value = await invoke(FORESHADOW_CREATE_LINE_CHANNEL, command);
        try {
          return parseForeshadowLineProjection(value);
        } catch {
          throw new Error("Invalid foreshadow line creation result");
        }
      },
      listLines: async (input) => {
        const command = parseListForeshadowLinesCommand(input);
        const value = await invoke(FORESHADOW_LIST_LINES_CHANNEL, command);
        try {
          return parseForeshadowLineListProjection(value);
        } catch {
          throw new Error("Invalid foreshadow line list");
        }
      },
      updateLine: async (input) => {
        const command = parseUpdateForeshadowLineCommand(input);
        const value = await invoke(FORESHADOW_UPDATE_LINE_CHANNEL, command);
        try {
          return parseForeshadowLineProjection(value);
        } catch {
          throw new Error("Invalid foreshadow line update result");
        }
      },
      retireLine: async (input) => {
        const command = parseRetireForeshadowLineCommand(input);
        const value = await invoke(FORESHADOW_RETIRE_LINE_CHANNEL, command);
        try {
          return parseForeshadowLineProjection(value);
        } catch {
          throw new Error("Invalid foreshadow line retirement result");
        }
      },
      createPoint: async (input) => {
        const command = parseCreateForeshadowPointCommand(input);
        const value = await invoke(FORESHADOW_CREATE_POINT_CHANNEL, command);
        try {
          return parseForeshadowPointProjection(value);
        } catch {
          throw new Error("Invalid foreshadow point creation result");
        }
      },
      listPoints: async (input) => {
        const command = parseListForeshadowPointsCommand(input);
        const value = await invoke(FORESHADOW_LIST_POINTS_CHANNEL, command);
        try {
          return parseForeshadowPointListProjection(value);
        } catch {
          throw new Error("Invalid foreshadow point list");
        }
      },
    },
    activity: {
      exportRecords: async (input) => {
        const command = parseExportWorkRecordsCommand(input);
        const value = await invoke(ACTIVITY_EXPORT_RECORDS_CHANNEL, command);
        try {
          return parseExportWorkRecordsResult(value);
        } catch {
          throw new Error("Invalid Work records export result");
        }
      },
      getRecordsGoals: async (input) => {
        const command = parseGetWorkRecordsGoalsCommand(input);
        const value = await invoke(
          ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
          command,
        );
        try {
          return parseWorkRecordsGoalsProjection(value);
        } catch {
          throw new Error("Invalid Work records goals projection");
        }
      },
      saveRecordsGoals: async (input) => {
        const command = parseSaveWorkRecordsGoalsCommand(input);
        const value = await invoke(
          ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
          command,
        );
        try {
          return parseWorkRecordsGoalsProjection(value);
        } catch {
          throw new Error("Invalid saved Work records goals projection");
        }
      },
      getReadthrough: async (input) => {
        const command = parseGetWorkReadthroughCommand(input);
        const value = await invoke(ACTIVITY_GET_READTHROUGH_CHANNEL, command);
        try {
          return parseWorkReadthroughProjection(value);
        } catch {
          throw new Error("Invalid Work readthrough projection");
        }
      },
      saveReadthrough: async (input) => {
        const command = parseSaveWorkReadthroughCommand(input);
        const value = await invoke(ACTIVITY_SAVE_READTHROUGH_CHANNEL, command);
        try {
          return parseWorkReadthroughProjection(value);
        } catch {
          throw new Error("Invalid saved Work readthrough projection");
        }
      },
      listWork: async (input) => {
        const command = parseListWorkActivityCommand(input);
        const value = await invoke(ACTIVITY_LIST_WORK_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid Work activity projection");
        }
      },
      startSession: async (input) => {
        const command = parseStartWritingSessionCommand(input);
        const value = await invoke(ACTIVITY_START_SESSION_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid WritingSession result");
        }
      },
      stopSession: async (input) => {
        const command = parseStopWritingSessionCommand(input);
        const value = await invoke(ACTIVITY_STOP_SESSION_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid WritingSession result");
        }
      },
      startFocus: async (input) => {
        const command = parseStartFocusCycleCommand(input);
        const value = await invoke(ACTIVITY_START_FOCUS_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid FocusCycle result");
        }
      },
      stopFocus: async (input) => {
        const command = parseStopFocusCycleCommand(input);
        const value = await invoke(ACTIVITY_STOP_FOCUS_CHANNEL, command);
        try {
          return parseWorkActivityProjection(value);
        } catch {
          throw new Error("Invalid FocusCycle result");
        }
      },
      getPomodoro: async (input) => {
        const command = parseGetPomodoroCommand(input);
        const value = await invoke(ACTIVITY_GET_POMODORO_CHANNEL, command);
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid Pomodoro projection");
        }
      },
      configureAndStartPomodoro: async (input) => {
        const command = parseConfigureAndStartPomodoroCommand(input);
        const value = await invoke(
          ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
          command,
        );
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid configured Pomodoro projection");
        }
      },
      pausePomodoro: async (input) => {
        const command = parsePomodoroPhaseCommand(input);
        const value = await invoke(ACTIVITY_PAUSE_POMODORO_CHANNEL, command);
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid paused Pomodoro projection");
        }
      },
      resumePomodoro: async (input) => {
        const command = parsePomodoroPhaseCommand(input);
        const value = await invoke(ACTIVITY_RESUME_POMODORO_CHANNEL, command);
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid resumed Pomodoro projection");
        }
      },
      reconcilePomodoro: async (input) => {
        const command = parsePomodoroPhaseCommand(input);
        const value = await invoke(
          ACTIVITY_RECONCILE_POMODORO_CHANNEL,
          command,
        );
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid reconciled Pomodoro projection");
        }
      },
      updatePomodoroNote: async (input) => {
        const command = parseUpdatePomodoroNoteCommand(input);
        const value = await invoke(
          ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL,
          command,
        );
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid updated Pomodoro projection");
        }
      },
      stopPomodoro: async (input) => {
        const command = parsePomodoroPhaseCommand(input);
        const value = await invoke(ACTIVITY_STOP_POMODORO_CHANNEL, command);
        try {
          return parsePomodoroProjection(value);
        } catch {
          throw new Error("Invalid stopped Pomodoro projection");
        }
      },
    },
    schedule: {
      listWork: async (input) => {
        const command = parseListWorkScheduleCommand(input);
        const value = await invoke(SCHEDULE_LIST_WORK_CHANNEL, command);
        try {
          return parseWorkScheduleProjection(value);
        } catch {
          throw new Error("Invalid Work schedule projection");
        }
      },
      listCalendar: async (input) => {
        const command = parseListWorkScheduleCommand(input);
        const value = await invoke(SCHEDULE_LIST_CALENDAR_CHANNEL, command);
        try {
          return parseWorkCalendarProjection(value);
        } catch {
          throw new Error("Invalid Work calendar projection");
        }
      },
      listToday: async (input) => {
        const command = parseGetStudioTodayCommand(input);
        const value = await invoke(SCHEDULE_LIST_TODAY_CHANNEL, command);
        try {
          return parseStudioTodayProjection(value);
        } catch {
          throw new Error("Invalid Studio Today projection");
        }
      },
      createItem: async (input) => {
        const command = parseCreateWorkScheduleItemCommand(input);
        const value = await invoke(SCHEDULE_CREATE_ITEM_CHANNEL, command);
        try {
          return parseWorkScheduleItemProjection(value);
        } catch {
          throw new Error("Invalid created Work schedule item");
        }
      },
      updateItem: async (input) => {
        const command = parseUpdateWorkScheduleItemCommand(input);
        const value = await invoke(SCHEDULE_UPDATE_ITEM_CHANNEL, command);
        try {
          return parseWorkScheduleItemProjection(value);
        } catch {
          throw new Error("Invalid updated Work schedule item");
        }
      },
      retireItem: async (input) => {
        const command = parseRetireWorkScheduleItemCommand(input);
        const value = await invoke(SCHEDULE_RETIRE_ITEM_CHANNEL, command);
        if (value !== undefined) {
          throw new Error("Invalid Work schedule retirement result");
        }
      },
      setCompletion: async (input) => {
        const command = parseSetWorkScheduleCompletionCommand(input);
        const value = await invoke(SCHEDULE_SET_COMPLETION_CHANNEL, command);
        try {
          return parseWorkScheduleItemProjection(value);
        } catch {
          throw new Error("Invalid Work schedule completion result");
        }
      },
    },
    settings: {
      getProfile: async () => {
        const value = await invoke(APP_SETTINGS_PROFILE_CHANNEL);
        try {
          return parseAppSettingsProfile(value);
        } catch {
          throw new Error("Invalid app settings profile");
        }
      },
      get: async () => {
        const value = await invoke(APP_SETTINGS_GET_CHANNEL);
        try {
          return parseAppSettingsProjection(value);
        } catch {
          throw new Error("Invalid app settings projection");
        }
      },
      save: async (input) => {
        const profileValue = await invoke(APP_SETTINGS_PROFILE_CHANNEL);
        let profile: AppSettingsProfile;
        try {
          profile = parseAppSettingsProfile(profileValue);
        } catch {
          throw new Error("Invalid app settings profile");
        }
        const command = parseSaveAppSettingsCommand(input, profile);
        const value = await invoke(APP_SETTINGS_SAVE_CHANNEL, command);
        try {
          return parseAppSettingsProjection(value, profile);
        } catch {
          throw new Error("Invalid saved app settings projection");
        }
      },
      getUiPreferences: async () => {
        const value = await invoke(UI_PREFERENCES_GET_CHANNEL);
        try {
          return parseUiPreferencesProjection(value);
        } catch {
          throw new Error("Invalid UI preferences projection");
        }
      },
      saveUiPreferences: async (input) => {
        const command = parseSaveUiPreferencesCommand(input);
        const value = await invoke(UI_PREFERENCES_SAVE_CHANNEL, command);
        try {
          return parseUiPreferencesProjection(value);
        } catch {
          throw new Error("Invalid saved UI preferences projection");
        }
      },
      getMusicProfile: async () => {
        const value = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
        try {
          return parseMusicSettingsProfile(value);
        } catch {
          throw new Error("Invalid music settings profile");
        }
      },
      getWorkMusic: async (input) => {
        const command = parseGetWorkMusicSettingsCommand(input);
        const profileValue = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
        const profile = parseMusicSettingsProfile(profileValue);
        const value = await invoke(MUSIC_SETTINGS_GET_WORK_CHANNEL, command);
        try {
          return parseWorkMusicSettingsProjection(value, profile);
        } catch {
          throw new Error("Invalid Work music settings projection");
        }
      },
      saveWorkMusic: async (input) => {
        const profileValue = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
        const profile = parseMusicSettingsProfile(profileValue);
        const command = parseSaveWorkMusicSettingsCommand(input, profile);
        const value = await invoke(MUSIC_SETTINGS_SAVE_WORK_CHANNEL, command);
        try {
          return parseWorkMusicSettingsProjection(value, profile);
        } catch {
          throw new Error("Invalid saved Work music settings projection");
        }
      },
      getWorkInspiration: async (input) => {
        const command = parseGetWorkInspirationSettingsCommand(input);
        const value = await invoke(
          INSPIRATION_SETTINGS_GET_WORK_CHANNEL,
          command,
        );
        try {
          return parseWorkInspirationSettingsProjection(value);
        } catch {
          throw new Error("Invalid Work inspiration settings projection");
        }
      },
      saveWorkInspiration: async (input) => {
        const command = parseSaveWorkInspirationSettingsCommand(input);
        const value = await invoke(
          INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
          command,
        );
        try {
          return parseWorkInspirationSettingsProjection(value);
        } catch {
          throw new Error("Invalid saved Work inspiration settings projection");
        }
      },
      getYouTubeMusicConnectionStatus: async () => {
        const value = await invoke(YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL);
        try {
          return parseYouTubeMusicConnectionStatus(value);
        } catch {
          throw new Error("Invalid YouTube music connection status");
        }
      },
      saveYouTubeMusicConnection: async (input) => {
        const command = parseSaveYouTubeMusicConnectionCommand(input);
        const value = await invoke(YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL, command);
        try {
          return parseYouTubeMusicConnectionStatus(value);
        } catch {
          throw new Error("Invalid saved YouTube music connection status");
        }
      },
    },
    musicPlayback: {
      getProfile: async () => {
        const value = await invoke(YOUTUBE_MUSIC_PROFILE_CHANNEL);
        try {
          return parseYouTubeMusicProfile(value);
        } catch {
          throw new Error("Invalid YouTube music profile");
        }
      },
      searchVideos: async (input) => {
        const command = parseSearchYouTubeVideosCommand(input);
        const value = await invoke(YOUTUBE_MUSIC_SEARCH_CHANNEL, command);
        try {
          return parseYouTubeVideoSearchResult(value);
        } catch {
          throw new Error("Invalid YouTube music search result");
        }
      },
      searchSceneQueues: async (input) => {
        const command = parseSearchSceneMusicQueuesCommand(input);
        const value = await invoke(SCENE_MUSIC_QUEUE_SEARCH_CHANNEL, command);
        try {
          return parseSceneMusicQueueSearchResult(value);
        } catch {
          throw new Error("Invalid scene music queue search result");
        }
      },
      listSceneQueueCandidates: async (input) => {
        const command = parseListSceneMusicQueueCandidatesCommand(input);
        const value = await invoke(SCENE_MUSIC_QUEUE_LIST_CHANNEL, command);
        try {
          return parseSceneMusicQueueCandidateList(value);
        } catch {
          throw new Error("Invalid scene music queue Candidate list");
        }
      },
      selectSceneQueue: async (input) => {
        const command = parseSelectSceneMusicQueueCommand(input);
        const value = await invoke(SCENE_MUSIC_QUEUE_SELECT_CHANNEL, command);
        try {
          return parseSceneMusicQueueCandidate(value);
        } catch {
          throw new Error("Invalid selected scene music queue Candidate");
        }
      },
    },
    quickTools: {
      getMemo: async (input) => {
        const command = parseGetWorkQuickMemoCommand(input);
        const value = await invoke(QUICK_TOOLS_GET_MEMO_CHANNEL, command);
        try {
          return parseWorkQuickMemoProjection(value);
        } catch {
          throw new Error("Invalid Work quick memo projection");
        }
      },
      saveMemo: async (input) => {
        const command = parseSaveWorkQuickMemoCommand(input);
        const value = await invoke(QUICK_TOOLS_SAVE_MEMO_CHANNEL, command);
        try {
          return parseWorkQuickMemoProjection(value);
        } catch {
          throw new Error("Invalid saved Work quick memo projection");
        }
      },
    },
    assistant: {
      getChatGptOAuthStatus: async () => {
        const value = await invoke(ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL);
        try {
          return parseChatGptOAuthConnectionStatus(value);
        } catch {
          throw new Error("Invalid ChatGPT OAuth connection status");
        }
      },
      startChatGptOAuthLogin: async () => {
        const value = await invoke(ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL);
        try {
          return parseChatGptOAuthConnectionStatus(value);
        } catch {
          throw new Error("Invalid ChatGPT OAuth login result");
        }
      },
      runChat: async (input) => {
        const command = parseRunAssistantChatCommand(input);
        const value = await invoke(ASSISTANT_CHAT_RUN_CHANNEL, command);
        try {
          return parseAssistantChatResult(value);
        } catch {
          throw new Error("Invalid assistant chat result");
        }
      },
      listConnections: async () => {
        const value = await invoke(ASSISTANT_LIST_CONNECTIONS_CHANNEL);
        try {
          return parseAssistantConnectionListProjection(value);
        } catch {
          throw new Error("Invalid assistant connection list projection");
        }
      },
      saveConnection: async (input) => {
        const command = parseSaveAssistantConnectionCommand(input);
        const value = await invoke(ASSISTANT_SAVE_CONNECTION_CHANNEL, command);
        try {
          return parseAssistantConnectionProjection(value);
        } catch {
          throw new Error("Invalid saved assistant connection projection");
        }
      },
      deleteConnection: async (input) => {
        const command = parseDeleteAssistantConnectionCommand(input);
        const value = await invoke(ASSISTANT_DELETE_CONNECTION_CHANNEL, command);
        if (value !== undefined) {
          throw new Error("Invalid assistant connection deletion result");
        }
      },
      getConnectorProfile: async () => {
        const value = await invoke(ASSISTANT_CONNECTOR_PROFILE_CHANNEL);
        try {
          return parseAssistantConnectorManifestProfile(value);
        } catch {
          throw new Error("Invalid assistant connector profile");
        }
      },
      getDestinationProfile: async () => {
        const value = await invoke(ASSISTANT_DESTINATION_PROFILE_CHANNEL);
        try {
          return parseAssistantDestinationProfile(value);
        } catch {
          throw new Error("Invalid assistant destination profile");
        }
      },
      listContextState: async (input) => {
        const command = parseListAssistantContextStateCommand(input);
        const value = await invoke(
          ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
          command,
        );
        try {
          return parseAssistantContextStateProjection(value);
        } catch {
          throw new Error("Invalid assistant context state projection");
        }
      },
      grantContextPermission: async (input) => {
        const command = parseGrantAssistantContextPermissionCommand(input);
        const value = await invoke(
          ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
          command,
        );
        try {
          return parseAssistantContextPermissionGrant(value);
        } catch {
          throw new Error("Invalid assistant context permission grant");
        }
      },
      revokeContextPermission: async (input) => {
        const command = parseRevokeAssistantContextPermissionCommand(input);
        const value = await invoke(
          ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
          command,
        );
        try {
          return parseAssistantContextPermissionGrant(value);
        } catch {
          throw new Error("Invalid revoked assistant context permission grant");
        }
      },
      runVocabularyLookup: async (input) => {
        const command = parseRunAssistantVocabularyLookupCommand(input);
        const value = await invoke(
          ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
          command,
        );
        try {
          return parseAssistantVocabularyLookupResult(value);
        } catch {
          throw new Error("Invalid assistant vocabulary lookup result");
        }
      },
      runVocabularySuggestion: async (input) => {
        const command = parseRunAssistantVocabularySuggestionCommand(input);
        const value = await invoke(
          ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
          command,
        );
        try {
          return parseAssistantVocabularySuggestionResult(value);
        } catch {
          throw new Error("Invalid assistant vocabulary suggestion result");
        }
      },
      runExternalSettingReview: async (input) => {
        const command = parseRunAssistantExternalSettingReviewCommand(input);
        const value = await invoke(
          ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
          command,
        );
        try {
          return parseAssistantExternalSettingReviewResult(value);
        } catch {
          throw new Error("Invalid assistant external setting review result");
        }
      },
      runNotationReview: async (input) => {
        const command = parseRunAssistantNotationReviewCommand(input);
        const value = await invoke(
          ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
          command,
        );
        try {
          return parseAssistantNotationReviewResult(value);
        } catch {
          throw new Error("Invalid assistant notation review result");
        }
      },
      runSettingReview: async (input) => {
        const command = parseRunAssistantSettingReviewCommand(input);
        const value = await invoke(
          ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
          command,
        );
        try {
          return parseAssistantSettingReviewResult(value);
        } catch {
          throw new Error("Invalid assistant setting review result");
        }
      },
    },
    version: {
      compareWorkSnapshot: async (input) => {
        const command = parseCompareWorkSnapshotCommand(input);
        const value = await invoke(
          VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
          command,
        );
        try {
          return parseWorkSnapshotComparisonProjection(value);
        } catch {
          throw new Error("Invalid WorkSnapshot comparison");
        }
      },
      listDocumentRevisions: async (input) => {
        const command = parseListDocumentRevisionsCommand(input);
        const value = await invoke(
          VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
          command,
        );
        try {
          return parseDocumentRevisionListProjection(value);
        } catch {
          throw new Error("Invalid Document revision list");
        }
      },
      restoreDocumentRevision: async (input) => {
        const command = parseRestoreDocumentRevisionCommand(input);
        const value = await invoke(
          VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
          command,
        );
        try {
          return parseRestoreDocumentRevisionResult(value);
        } catch {
          throw new Error("Invalid Document revision restore result");
        }
      },
      createWorkSnapshot: async (input) => {
        const command = parseCreateWorkSnapshotCommand(input);
        const value = await invoke(
          VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
          command,
        );
        try {
          return parseWorkSnapshotProjection(value);
        } catch {
          throw new Error("Invalid WorkSnapshot creation result");
        }
      },
      listWorkSnapshots: async (input) => {
        const command = parseListWorkSnapshotsCommand(input);
        const value = await invoke(
          VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
          command,
        );
        try {
          return parseWorkSnapshotListProjection(value);
        } catch {
          throw new Error("Invalid WorkSnapshot list");
        }
      },
    },
    backup: {
      getStatus: async () => {
        const value = await invoke(BACKUP_GET_STATUS_CHANNEL);
        try {
          return parseLocalWorkspaceBackupStatusProjection(value);
        } catch {
          throw new Error("Invalid local workspace backup status");
        }
      },
      create: async () => {
        const value = await invoke(BACKUP_CREATE_CHANNEL);
        try {
          return parseLocalWorkspaceBackupActionResult(value);
        } catch {
          throw new Error("Invalid local workspace backup result");
        }
      },
      restore: async () => {
        const value = await invoke(BACKUP_RESTORE_CHANNEL);
        try {
          return parseLocalWorkspaceBackupActionResult(value);
        } catch {
          throw new Error("Invalid local workspace restore result");
        }
      },
    },
    migration: {
      runLegacyLoreRehearsal: async () => {
        const value = await invoke(MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL);
        try {
          return parseLegacyLoreImportRehearsalActionResult(value);
        } catch {
          throw new Error("Invalid legacy import rehearsal result");
        }
      },
    },
    editor: {
      getManuscriptInputProfile: async () => {
        const value = await invoke(MANUSCRIPT_INPUT_PROFILE_CHANNEL);
        try {
          return parseManuscriptInputProfile(value);
        } catch {
          throw new Error("Invalid manuscript input profile");
        }
      },
      getManuscriptDocumentProfile: async () => {
        const value = await invoke(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL);
        try {
          return parseManuscriptDocumentProfile(value);
        } catch {
          throw new Error("Invalid manuscript document profile");
        }
      },
      getManuscriptFormattingProfile: async () => {
        const value = await invoke(MANUSCRIPT_FORMATTING_PROFILE_CHANNEL);
        try {
          return parseManuscriptFormattingProfile(value);
        } catch {
          throw new Error("Invalid manuscript formatting profile");
        }
      },
      getManuscriptPreflightProfile: async () => {
        const value = await invoke(MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL);
        try {
          return parseManuscriptPreflightProfile(value);
        } catch {
          throw new Error("Invalid manuscript preflight profile");
        }
      },
      getManuscriptPreflightSettings: async (input) => {
        const command = parseGetManuscriptPreflightSettingsCommand(input);
        const value = await invoke(
          MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
          command,
        );
        try {
          return parseManuscriptPreflightSettingsProjection(value);
        } catch {
          throw new Error("Invalid manuscript preflight settings");
        }
      },
      saveManuscriptPreflightSettings: async (input) => {
        const command = parseSaveManuscriptPreflightSettingsCommand(input);
        const value = await invoke(
          MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
          command,
        );
        try {
          return parseManuscriptPreflightSettingsProjection(value);
        } catch {
          throw new Error("Invalid saved manuscript preflight settings");
        }
      },
      exportManuscriptText: async (input) => {
        const command = parseExportManuscriptTextCommand(input);
        const value = await invoke(MANUSCRIPT_EXPORT_TEXT_CHANNEL, command);
        try {
          return parseExportManuscriptTextResult(value);
        } catch {
          throw new Error("Invalid manuscript text export result");
        }
      },
      selectManuscriptTextImport: async (input) => {
        const command = parseSelectManuscriptTextImportCommand(input);
        const value = await invoke(
          MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
          command,
        );
        try {
          return parseManuscriptTextImportResult(value);
        } catch {
          throw new Error("Invalid manuscript text import result");
        }
      },
      getManuscriptPersistenceProfile: async () => {
        const value = await invoke(
          MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
        );
        try {
          return parseManuscriptPersistenceProfile(value);
        } catch {
          throw new Error(
            "Invalid manuscript persistence profile",
          );
        }
      },
      getManuscriptStartupRecovery: async () => {
        const value = await invoke(
          MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
        );
        try {
          return parseStartupRecoveryProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript startup recovery",
          );
        }
      },
      getManuscriptResumeCheckpoint: async () => {
        const value = await invoke(
          MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
        );
        try {
          return parseManuscriptResumeCheckpointProjection(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript resume checkpoint",
          );
        }
      },
      getContinuousReadingProgress: async (input) => {
        const command = parseGetContinuousReadingProgressCommand(input);
        const value = await invoke(
          MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
          command,
        );
        try {
          return parseWorkContinuousReadingProgressProjection(value);
        } catch {
          throw new Error("Invalid continuous reading progress projection");
        }
      },
      saveContinuousReadingProgress: async (input) => {
        const command = parseSaveContinuousReadingProgressCommand(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
          command,
        );
        try {
          return parseWorkContinuousReadingProgressProjection(value);
        } catch {
          throw new Error("Invalid saved continuous reading progress projection");
        }
      },
      saveChangeBatch: async (input) => {
        const batch = parseChangeBatch(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
          batch,
        );
        try {
          return parseSaveReceipt(value);
        } catch {
          throw new Error("Invalid save receipt");
        }
      },
      saveDocumentChange: async (input) => {
        const command = parseSaveManuscriptDocumentChangeCommand(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
          command,
        );
        try {
          return parseSaveReceipt(value);
        } catch {
          throw new Error("Invalid document change save receipt");
        }
      },
      saveFormatting: async (input) => {
        const command = parseSaveManuscriptFormattingCommand(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_FORMATTING_CHANNEL,
          command,
        );
        try {
          return parseSaveManuscriptFormattingReceipt(value);
        } catch {
          throw new Error("Invalid manuscript formatting save receipt");
        }
      },
      getWorkManuscriptLayoutSettings: async (input) => {
        const command = parseGetWorkManuscriptLayoutSettingsCommand(input);
        const value = await invoke(
          MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
          command,
        );
        try {
          return parseWorkManuscriptLayoutSettingsProjection(value);
        } catch {
          throw new Error("Invalid Work manuscript layout settings projection");
        }
      },
      saveWorkManuscriptLayoutSettings: async (input) => {
        const command = parseSaveWorkManuscriptLayoutSettingsCommand(input);
        const value = await invoke(
          MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
          command,
        );
        try {
          return parseWorkManuscriptLayoutSettingsProjection(value);
        } catch {
          throw new Error("Invalid saved Work manuscript layout settings projection");
        }
      },
      applyManuscriptStartupRecovery: async (
        input,
      ) => {
        const command =
          parseApplyStartupRecoveryCommand(input);
        const value = await invoke(
          MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
          command,
        );
        try {
          return parseApplyStartupRecoveryAcknowledgement(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript recovery acknowledgement",
          );
        }
      },
      onManuscriptCloseRequest: (
        listener,
      ) =>
        listen(
          MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
          (value) => {
            listener(
              parseManuscriptCloseRequest(
                value,
              ),
            );
          },
        ),
      completeManuscriptCloseRequest: async (
        input,
      ) => {
        const result =
          parseManuscriptCloseResult(input);
        const value = await invoke(
          MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
          result,
        );
        try {
          return parseManuscriptCloseResult(
            value,
          );
        } catch {
          throw new Error(
            "Invalid manuscript close result",
          );
        }
      },
    },
  };
}
