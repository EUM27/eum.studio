import {
  createHash,
  randomUUID,
} from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  CreateAnchor,
  createAnchorForKnownRevisionContent,
} from "../application/anchors/create-anchor";
import {
  ResolveAnchor,
} from "../application/anchors/resolve-anchor";
import {
  CaptureResumeCheckpointWithAnchors,
  type ResumeCheckpointWithAnchorsCaptureTransaction,
} from "../application/checkpoints/capture-resume-checkpoint-with-anchors";
import {
  ResolveResumeCheckpointForWork,
  ResumeAnchorIntegrityError,
  type ResumeCheckpointResolution,
} from "../application/checkpoints/resolve-resume-checkpoint-for-work";
import {
  parseManuscriptDocumentProfile,
  type ManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import {
  createDefaultManuscriptEditorDocumentState,
  parseManuscriptEditorDocumentState,
  parseSaveManuscriptDocumentChangeCommand,
  parseSaveManuscriptFormattingCommand,
  serializeManuscriptEditorDocumentState,
  type ManuscriptFormattingProfile,
  type SaveManuscriptFormattingReceipt,
} from "../application/editor/manuscript-formatting";
import {
  moveManuscriptEditorStateRange,
  moveRangeToEpisodeText,
  parseMoveRangeToEpisodeCommand,
  parseMoveRangeToEpisodeReceipt,
  parseUndoMoveRangeToEpisodeCommand,
  planEpisodeSceneIdentityChanges,
  type EpisodeRangeMoveStore,
  type MoveRangeToEpisodeCommand,
  type MoveRangeToEpisodeReceipt,
  type SceneEpisodeSegmentRange,
  type UndoMoveRangeToEpisodeCommand,
} from "../application/editor/move-range-to-episode";
import {
  createDefaultWorkManuscriptLayoutSettingsProjection,
  parseGetWorkManuscriptLayoutSettingsCommand,
  parseManuscriptLayoutSettings,
  parseSaveWorkManuscriptLayoutSettingsCommand,
  parseWorkManuscriptLayoutSettingsProjection,
  readManuscriptLayoutSettings,
  type SaveWorkManuscriptLayoutSettingsCommand,
  type WorkManuscriptLayoutSettingsProjection,
} from "../application/editor/work-manuscript-layout-settings";
import {
  createManuscriptPreflightBoundaryContext,
  createDefaultManuscriptPreflightSettings,
  diagnoseManuscriptPreflight,
  parseExportManuscriptTextCommand,
  parseGetManuscriptPreflightSettingsCommand,
  parseManuscriptPreflightSettings,
  parseManuscriptPreflightSettingsProjection,
  parseSaveManuscriptPreflightSettingsCommand,
  type ExportManuscriptTextCommand,
  type ManuscriptPreflightProfile,
  type ManuscriptPreflightSettingsProjection,
} from "../application/editor/manuscript-preflight";
import {
  applyChangeBatch,
} from "../application/persistence/apply-change-batch";
import {
  classifyChangeBatchIdentity,
  encodeDurableText,
  parseChangeBatch,
  type ChangeBatch,
} from "../application/persistence/change-batch";
import {
  parseManuscriptPersistenceProfile,
  type ManuscriptBatchingPolicy,
  type ManuscriptPersistenceProfile,
} from "../application/persistence/manuscript-persistence-profile";
import {
  DurableChangeBatchSaveConflictError,
  type RevisionSaveReceipt,
  type SaveReceipt,
} from "../application/persistence/save-change-batch";
import type {
  ApplyStartupRecoveryAcknowledgement,
  StartupRecoveryProjection,
} from "../application/persistence/startup-recovery-contract";
import type {
  RevisionBlobProfile,
  RevisionStore,
} from "../application/revisions/revision-store";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionContentProjection,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseReadDocumentRevisionCommand,
  parseRestoreDocumentRevisionCommand,
  parseRestoreDocumentRevisionResult,
  parseWorkSnapshotListProjection,
  type CreateWorkSnapshotCommand,
  type DocumentRevisionContentProjection,
  type DocumentRevisionListProjection,
  type ListDocumentRevisionsCommand,
  type ListWorkSnapshotsCommand,
  type ReadDocumentRevisionCommand,
  type RestoreDocumentRevisionCommand,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
import {
  deriveWorkSnapshotComparison,
  parseCompareWorkSnapshotCommand,
  type CompareWorkSnapshotCommand,
  type MaterializedWorkSnapshotDocument,
  type WorkSnapshotComparisonProjection,
} from "../application/revisions/work-snapshot-comparison";
import type {
  StorageTransaction,
} from "../application/storage/storage-service";
import type {
  LocalWorkspaceBackupStatusProjection,
  LocalWorkspaceBackupSummary,
} from "../application/storage/local-workspace-backup-contract";
import type {
  LocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";
import {
  createPomodoroPolicyPlan,
  parseConfigureAndStartPomodoroCommand,
  parseGetPomodoroCommand,
  parsePomodoroPhaseCommand,
  parsePomodoroPolicyPlan,
  parsePomodoroProjection,
  parseUpdatePomodoroNoteCommand,
  serializePomodoroPolicyPlan,
  type ConfigureAndStartPomodoroCommand,
  type GetPomodoroCommand,
  type PomodoroPhase,
  type PomodoroPhaseCommand,
  type PomodoroPolicyPlan,
  type PomodoroProjection,
  type UpdatePomodoroNoteCommand,
} from "../application/activity/pomodoro-contract";
import {
  authorizeAssistantContextRequest,
  createAssistantContextReceipt,
  parseAssistantContextPermissionGrant,
  parseAssistantContextReceipt,
  parseAssistantContextRequest,
  type AssistantContextAccessResult,
  type AssistantContextPermissionGrant,
  type AssistantContextReceipt,
  type AssistantContextRequest,
} from "../application/assistant/assistant-context-permission";
import {
  parseAssistantContextStateProjection,
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
  type AssistantContextStateProjection,
  type GrantAssistantContextPermissionCommand,
  type ListAssistantContextStateCommand,
  type RevokeAssistantContextPermissionCommand,
} from "../application/assistant/assistant-context-state";
import {
  parseAssistantDestinationProfile,
  type AssistantDestinationProfile,
} from "../application/assistant/assistant-destination-profile";
import type {
  AssistantConnectorExecutionReceipt,
} from "../application/assistant/assistant-connector-manifest";
import {
  findExactVocabularyOccurrences,
  parseAssistantVocabularyCandidate,
  parseAssistantVocabularyLookupResult,
  parseRunAssistantVocabularyLookupCommand,
  type AssistantVocabularyCandidate,
  type AssistantVocabularyLookupResult,
  type RunAssistantVocabularyLookupCommand,
} from "../application/assistant/assistant-vocabulary-lookup";
import {
  authorizeAssistantVocabularySuggestion,
  createAssistantVocabularySuggestionCandidate,
  parseAssistantVocabularySuggestionCandidate,
  parseAssistantVocabularySuggestionResult,
  parseRunAssistantVocabularySuggestionCommand,
  type AssistantVocabularySuggestionCandidate,
  type AssistantVocabularySuggestionResult,
  type RunAssistantVocabularySuggestionCommand,
} from "../application/assistant/assistant-vocabulary-suggestion";
import {
  authorizeAssistantExternalSettingReview,
  createAssistantExternalSettingReviewRecords,
  parseAssistantExternalSettingReviewCandidate,
  parseAssistantExternalSettingReviewReceipt,
  parseAssistantExternalSettingReviewResult,
  parseRunAssistantExternalSettingReviewCommand,
  type AssistantExternalSettingReviewCandidate,
  type AssistantExternalSettingReviewReceipt,
  type AssistantExternalSettingReviewResult,
  type RunAssistantExternalSettingReviewCommand,
} from "../application/assistant/assistant-external-setting-review";
import {
  createAssistantNotationFindings,
  parseAssistantNotationCandidate,
  parseAssistantNotationReviewResult,
  parseRunAssistantNotationReviewCommand,
  type AssistantNotationCandidate,
  type AssistantNotationReviewResult,
  type RunAssistantNotationReviewCommand,
} from "../application/assistant/assistant-notation-review";
import {
  authorizeAssistantSettingReview,
  createAssistantSettingReviewReceipt,
  findExactDuplicateSettingGroups,
  findExactSettingConflictGroups,
  parseAssistantSettingConflictFinding,
  parseAssistantSettingReviewFinding,
  parseAssistantSettingReviewReceipt,
  parseAssistantSettingReviewResult,
  parseAssistantSettingReviewSource,
  parseRunAssistantSettingReviewCommand,
  type AssistantSettingConflictFinding,
  type AssistantSettingReviewFinding,
  type AssistantSettingReviewReceipt,
  type AssistantSettingReviewResult,
  type AssistantSettingReviewSource,
  type RunAssistantSettingReviewCommand,
} from "../application/assistant/assistant-setting-review";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type FocusCycleProjection,
  type ListWorkActivityCommand,
  type StartFocusCycleCommand,
  type StartWritingSessionCommand,
  type StopFocusCycleCommand,
  type StopWritingSessionCommand,
  type WorkActivityProjection,
  type WritingSessionProjection,
} from "../application/activity/work-activity-contract";
import {
  parseExportWorkRecordsCommand,
  prepareWorkRecordsExport,
  type PreparedWorkRecordsExport,
} from "../application/activity/work-records-export";
import {
  createUnsetWorkRecordsGoals,
  parseGetWorkRecordsGoalsCommand,
  parseSaveWorkRecordsGoalsCommand,
  parseWorkRecordsGoals,
  parseWorkRecordsGoalsProjection,
  type SaveWorkRecordsGoalsCommand,
  type WorkRecordsGoalsProjection,
} from "../application/activity/work-records-preferences";
import {
  createUnsetWorkReadthrough,
  parseGetWorkReadthroughCommand,
  parseSaveWorkReadthroughCommand,
  parseWorkReadthroughProjection,
  type SaveWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../application/activity/work-readthrough-calculator";
import {
  createUnsetContinuousReadingProgress,
  parseGetContinuousReadingProgressCommand,
  parseSaveContinuousReadingProgressCommand,
  parseWorkContinuousReadingProgressProjection,
  splitContinuousReadingLines,
  type SaveContinuousReadingProgressCommand,
  type WorkContinuousReadingProgressProjection,
} from "../application/editor/continuous-reading-progress";
import {
  deriveWorkScheduleOccurrences,
  parseCreateWorkScheduleItemCommand,
  parseListWorkScheduleCommand,
  parseRetireWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseUpdateWorkScheduleItemCommand,
  parseWorkScheduleDdayWorkload,
  parseWorkScheduleItemProjection,
  parseWorkScheduleProjection,
  type CreateWorkScheduleItemCommand,
  type ListWorkScheduleCommand,
  type RetireWorkScheduleItemCommand,
  type SetWorkScheduleCompletionCommand,
  type UpdateWorkScheduleItemCommand,
  type WorkRoutineCompletion,
  type WorkScheduleItemInput,
  type WorkScheduleItemProjection,
  type WorkScheduleProjection,
} from "../application/schedule/work-schedule-contract";
import {
  parseWorkCalendarProjection,
  type WorkCalendarProjection,
} from "../application/schedule/work-calendar-contract";
import {
  parseGetStudioTodayCommand,
  projectStudioToday,
  type GetStudioTodayCommand,
  type StudioTodayProjection,
} from "../application/today/studio-today-contract";
import {
  parseGetWorkQuickMemoCommand,
  parseSaveWorkQuickMemoCommand,
  parseWorkQuickMemoProjection,
  type SaveWorkQuickMemoCommand,
  type WorkQuickMemoProjection,
} from "../application/quick-tools/work-quick-memo";
import {
  createDefaultAppSettingsProjection,
  deriveWorkEpisodeCharacterProgress,
  parseAppSettingsProjection,
  parseSaveAppSettingsCommand,
  type AppSettingsProfile,
  type AppSettingsProjection,
  type SaveAppSettingsCommand,
} from "../application/settings/app-settings";
import {
  createDefaultWorkMusicSettingsProjection,
  parseGetWorkMusicSettingsCommand,
  parseSaveWorkMusicSettingsCommand,
  parseWorkMusicSettings,
  parseWorkMusicSettingsProjection,
  type MusicSettingsProfile,
  type SaveWorkMusicSettingsCommand,
  type WorkMusicSettingsProjection,
} from "../application/music/work-music-settings";
import {
  createDefaultWorkInspirationSettingsProjection,
  parseGetWorkInspirationSettingsCommand,
  parseSaveWorkInspirationSettingsCommand,
  parseWorkInspirationSettings,
  parseWorkInspirationSettingsProjection,
  type SaveWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../application/inspiration/work-inspiration-settings";
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
} from "../application/music/scene-music-queue-contract";
import {
  parseYouTubeVideoProjection,
  type YouTubeVideoProjection,
} from "../application/music/youtube-music";
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
} from "../application/structure/event-block-contract";
import {
  compareEventOutlineOrderKeys,
  isFractionalEventOutlineOrderKey,
} from "../application/structure/event-outline-order";
import {
  deriveEventRailProjection,
  parseListEventRailCommand,
  type EventRailProjection,
  type ListEventRailCommand,
} from "../application/structure/event-rail-projection";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  parseSceneOverrideProjection,
  type CreateSceneOverrideCommand,
  type ListSceneOverridesCommand,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import {
  deriveSceneProjection,
  parseListSceneProjectionCommand,
  parseSceneEventOverrideProjection,
  parseSceneRuleSetProjection,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type ListSceneProjectionCommand,
  type SceneEpisodeSegmentProjection,
  type SceneEventOverrideProjection,
  type SceneProjectionList,
  type SceneRuleSetProjection,
  type SetSceneEventOverrideCommand,
  type UpdateSceneRuleSetCommand,
} from "../application/structure/scene-projection";
import {
  SCENE_EXTRACTION_PROMPT_VERSION,
  createSceneExtractionParagraphs,
  parseDecideSceneExtractionAnnotationCommand,
  parseDecideSceneExtractionBoundaryCommand,
  parseListSceneExtractionCandidatesCommand,
  parseRunSceneExtractionCommand,
  parseSceneExtractionCandidate,
  parseSceneExtractionCandidateList,
  parseSceneExtractionAnnotationDecisionResult,
  parseSceneExtractionDecisionResult,
  parseSceneExtractionResult,
  resolveSceneExtractionModelScenes,
  type DecideSceneExtractionBoundaryCommand,
  type DecideSceneExtractionAnnotationCommand,
  type ListSceneExtractionCandidatesCommand,
  type RunSceneExtractionCommand,
  type SceneExtractionCandidate,
  type SceneExtractionCandidateList,
  type SceneExtractionDecisionResult,
  type SceneExtractionAnnotationDecisionResult,
  type SceneExtractionModelPayload,
  type SceneExtractionParagraph,
  type SceneExtractionResult,
} from "../application/structure/scene-extraction-contract";
import {
  SCENE_DRAFT_PROMPT_VERSION,
  parseCompleteSceneDraftInsertionCommand,
  parseListSceneDraftCandidatesCommand,
  parsePrepareSceneDraftInsertionCommand,
  parsePrepareSceneDraftInsertionResult,
  parseRunSceneDraftCommand,
  parseRunSceneDraftResult,
  parseSceneDraftCandidate,
  parseSceneDraftCandidateList,
  parseSceneDraftContext,
  parseUpdateSceneDraftCandidateCommand,
  type CompleteSceneDraftInsertionCommand,
  type ListSceneDraftCandidatesCommand,
  type PrepareSceneDraftInsertionCommand,
  type PrepareSceneDraftInsertionResult,
  type RunSceneDraftCommand,
  type RunSceneDraftResult,
  type SceneDraftCandidate,
  type SceneDraftCandidateList,
  type SceneDraftContext,
  type SceneDraftModelPayload,
  type UpdateSceneDraftCandidateCommand,
} from "../application/structure/scene-draft-contract";
import {
  parseListSceneAnnotationsCommand,
  parseSceneAnnotationList,
  parseSceneAnnotationProjection,
  type ListSceneAnnotationsCommand,
  type SceneAnnotationList,
  type SceneAnnotationProjection,
} from "../application/structure/scene-annotation-contract";
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
} from "../application/fragments/fragment-contract";
import {
  parseAddCharacterEvidenceCommand,
  parseCharacterListProjection,
  parseCharacterProjection,
  parseCreateCharacterCommand,
  parseListCharactersCommand,
  parseRetireCharacterCommand,
  parseUpdateCharacterCommand,
  type AddCharacterEvidenceCommand,
  type CharacterEvidenceProjection,
  type CharacterListProjection,
  type CharacterProjection,
  type CreateCharacterCommand,
  type ListCharactersCommand,
  type RetireCharacterCommand,
  type UpdateCharacterCommand,
} from "../application/characters/character-contract";
import {
  parseCharacterRelationListProjection,
  parseCharacterRelationProjection,
  parseCreateCharacterRelationCommand,
  parseListCharacterRelationsCommand,
  parseRetireCharacterRelationCommand,
  parseUpdateCharacterRelationCommand,
  type CharacterRelationListProjection,
  type CharacterRelationProjection,
  type CharacterRelationRetirementReason,
  type CreateCharacterRelationCommand,
  type ListCharacterRelationsCommand,
  type RetireCharacterRelationCommand,
  type UpdateCharacterRelationCommand,
} from "../application/characters/character-relation-contract";
import {
  CHARACTER_EXTRACTION_PROMPT_VERSION,
  createCharacterExtractionParagraphs,
  parseCharacterExtractionCandidate,
  parseCharacterExtractionCandidateList,
  parseCharacterExtractionDecisionResult,
  parseCharacterExtractionResult,
  parseDecideCharacterExtractionItemCommand,
  parseListCharacterExtractionCandidatesCommand,
  parseRunCharacterExtractionCommand,
  resolveCharacterExtractionEvidences,
  type CharacterExtractionCandidate,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionModelPayload,
  type CharacterExtractionParagraph,
  type CharacterExtractionResult,
  type DecideCharacterExtractionItemCommand,
  type ListCharacterExtractionCandidatesCommand,
  type RunCharacterExtractionCommand,
} from "../application/characters/character-extraction-contract";
import {
  CHARACTER_GENERATION_PROMPT_VERSION,
  parseCharacterGenerationCandidate,
  parseCharacterGenerationCandidateList,
  parseCharacterGenerationDecisionResult,
  parseCharacterGenerationResult,
  parseDecideCharacterGenerationItemCommand,
  parseListCharacterGenerationCandidatesCommand,
  parseRunCharacterGenerationCommand,
  type CharacterGenerationBrief,
  type CharacterGenerationCandidate,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationModelPayload,
  type CharacterGenerationResult,
  type DecideCharacterGenerationItemCommand,
  type ListCharacterGenerationCandidatesCommand,
  type RunCharacterGenerationCommand,
} from "../application/characters/character-generation-contract";
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
  type LoreEntryEvidenceProjection,
  type LoreEntryHistoryProjection,
  type LoreEntryListProjection,
  type LoreEntryProjection,
  type RetireLoreEntryCommand,
  type UpdateLoreEntryCommand,
} from "../application/lore/lore-entry-contract";
import {
  parseCreateLoreCandidateCommand,
  parseListLoreCandidatesCommand,
  parseLoreCandidateApprovalResult,
  parseLoreCandidateListProjection,
  parseLoreCandidateProjection,
  parseLoreCandidateProposal,
  parseReviewLoreCandidateCommand,
  type CreateLoreCandidateCommand,
  type ListLoreCandidatesCommand,
  type LoreCandidateApprovalBlockReason,
  type LoreCandidateApprovalResult,
  type LoreCandidateListProjection,
  type LoreCandidateProjection,
  type LoreCandidateProposal,
  type ReviewLoreCandidateCommand,
} from "../application/lore/lore-candidate-contract";
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
  type LoreForeshadowUnlinkReason,
  type UnlinkLoreForeshadowCommand,
} from "../application/lore/lore-foreshadow-link-contract";
import {
  parseCreatePublishingPartnerCommand,
  parseListPublishingPartnersCommand,
  parsePublishingPartnerListProjection,
  parsePublishingPartnerProjection,
  parseUpdatePublishingPartnerCommand,
  type CreatePublishingPartnerCommand,
  type PublishingPartnerListProjection,
  type PublishingPartnerProjection,
  type UpdatePublishingPartnerCommand,
} from "../application/publishing/publishing-partner-contract";
import {
  parseCreatePublishingSubmissionCommand,
  parseListPublishingSubmissionsCommand,
  parsePublishingSubmissionListProjection,
  parsePublishingSubmissionProjection,
  parseSubmissionPackageProjection,
  parseUpdatePublishingSubmissionCommand,
  type CreatePublishingSubmissionCommand,
  type ListPublishingSubmissionsCommand,
  type PublishingSubmissionListProjection,
  type PublishingSubmissionProjection,
  type SubmissionPackageProjection,
  type UpdatePublishingSubmissionCommand,
} from "../application/publishing/publishing-submission-contract";
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
} from "../application/publishing/publishing-contract-contract";
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
} from "../application/publishing/publishing-publication-contract";
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
} from "../application/publishing/publishing-settlement-contract";
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
} from "../application/publishing/publishing-payment-contract";
import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
  parsePublishingSourceProjection,
  type CreatePublishingSourceCommand,
  type PublishingSourceListProjection,
  type PublishingSourceProjection,
} from "../application/publishing/publishing-source-contract";
import {
  buildPublishingResearchCandidate,
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  parsePublishingResearchApprovalResult,
  type ApprovePublishingResearchCommand,
  type PublishingResearchApprovalResult,
  type PublishingResearchCandidateProjection,
  type PreviewPublishingResearchCommand,
} from "../application/publishing/publishing-research-contract";
import {
  buildPublishingAssistantRegistry,
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantApprovalResult,
  parsePublishingAssistantIntentPayload,
  parsePublishingAssistantResult,
  parseRunPublishingAssistantCommand,
  resolvePublishingAssistantIntent,
  type ApprovePublishingAssistantCandidateCommand,
  type PublishingAssistantApprovalResult,
  type PublishingAssistantRecordCandidate,
  type PublishingAssistantRegistry,
  type PublishingAssistantResult,
  type RunPublishingAssistantCommand,
} from "../application/publishing/publishing-assistant-contract";
import {
  parsePublishingEvidenceLinksProjection,
  parseSetPublishingEvidenceLinksCommand,
  type PublishingEvidenceLinksProjection,
  type PublishingEvidenceTargetKind,
  type SetPublishingEvidenceLinksCommand,
} from "../application/publishing/publishing-evidence-link-contract";
import {
  buildPublishingPartnerCsvImportPreview,
  parseApplyPublishingPartnerCsvImportCommand,
  parsePublishingPartnerCsvImportResult,
  type ApplyPublishingPartnerCsvImportCommand,
  type PublishingPartnerCsvImportResult,
} from "../application/publishing/publishing-partner-csv-import";
import {
  buildPublishingSubmissionCsvImportPreview,
  parseApplyPublishingSubmissionCsvImportCommand,
  parsePublishingSubmissionCsvImportResult,
  type ApplyPublishingSubmissionCsvImportCommand,
  type PublishingSubmissionCsvImportResult,
} from "../application/publishing/publishing-submission-csv-import";
import {
  parseLinkPublishingMailCandidateCommand,
  parseListPublishingMailCandidatesCommand,
  parsePublishingMailCandidateListProjection,
  parsePublishingMailCandidateProjection,
  parsePublishingMailCandidateReviewResult,
  parseRecordPublishingMailCandidateCommand,
  parseReviewPublishingMailCandidateCommand,
  parseUpdatePublishingMailCandidateCommand,
  type LinkPublishingMailCandidateCommand,
  type PublishingMailCandidateListProjection,
  type PublishingMailCandidateProjection,
  type PublishingMailCandidateReviewResult,
  type RecordPublishingMailCandidateCommand,
  type ReviewPublishingMailCandidateCommand,
  type UpdatePublishingMailCandidateCommand,
} from "../application/publishing/publishing-mail-candidate-contract";
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
} from "../application/plots/plot-contract";
import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parsePlotBoardProjection,
  parseSetPlotPlacementStoryTimeCommand,
  type GetDefaultPlotBoardCommand,
  type MovePlotPlacementCommand,
  type PlotBoardProjection,
  type PlotLaneKind,
  type SetPlotPlacementStoryTimeCommand,
} from "../application/plots/plot-board-contract";
import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  parsePlotEventLinkMutationProjection,
  parsePlotEventLinkProjection,
  parseUnlinkPlotEventCommand,
  type CreateEventFromPlotCommand,
  type CreatePlotFromEventCommand,
  type LinkPlotEventCommand,
  type ListPlotEventLinksCommand,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
  type PlotEventLinkProjection,
  type UnlinkPlotEventCommand,
} from "../application/plots/plot-event-link-contract";
import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  parsePlotThreadSourceProjection,
  type LinkPlotThreadSourceCommand,
  type ListPlotThreadSourcesCommand,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../application/plots/plot-source-contract";
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
} from "../application/foreshadowing/foreshadow-line-contract";
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
} from "../application/foreshadowing/foreshadow-point-contract";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateDocumentResult,
  parseCreateFirstWorkCommand,
  parseCreateWorkCommand,
  parseCreateWorkResult,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireAllDocumentsCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  parseWorkspaceCatalogProjection,
  type ActivateWorkspaceLocationCommand,
  type CaptureWorkspaceResumeCommand,
  type CreateDocumentFolderCommand,
  type CreateDocumentResult,
  type CreateFirstWorkCommand,
  type CreateFirstWorkResult,
  type CreateWorkResult,
  type MoveDocumentCommand,
  type PlaceDocumentInFolderCommand,
  type RenameDocumentFolderCommand,
  type RenameDocumentCommand,
  type RenameWorkCommand,
  type RetireDocumentCommand,
  type RetireAllDocumentsCommand,
  type RetireDocumentFolderCommand,
  type RetireWorkCommand,
  type WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import {
  parseSetWorkFavoriteCommand,
  parseWorkFavoritesProjection,
  type SetWorkFavoriteCommand,
  type WorkFavoritesProjection,
} from "../application/workspace/work-favorites";
import {
  parseClearDocumentCompletionCommand,
  parseCompleteDocumentCommand,
  deriveDocumentCompletionDate,
  parseDocumentCompletionProjection,
  parseGetDocumentCompletionCommand,
  type ClearDocumentCompletionCommand,
  type CompleteDocumentCommand,
  type DocumentCompletionProjection,
  type GetDocumentCompletionCommand,
} from "../application/workspace/document-completion";
import {
  parseSaveWorkCoverCommand,
  parseWorkCoverProjection,
  parseWorkCoversProjection,
  type SaveWorkCoverCommand,
  type WorkCoverProjection,
  type WorkCoversProjection,
} from "../application/workspace/work-covers";
import type {
  LocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import type {
  Poc3AnchorRecord,
  Poc3LedgerRecord,
} from "../domain/poc-3-storage-ledger";
import {
  compareFractionalOrderKeys,
  createOrderKeyBetween,
  createRebalancedOrderKeys,
} from "../domain/fractional-order-key";
import {
  createWritingCatalog,
  entityId,
  type Anchor,
  type Document,
  type EntityId,
  type Work,
} from "../domain/writing";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../platform/anchors/node-crypto-anchor-evidence";
import {
  createNodeImmutableBlobStore,
} from "../platform/storage/node-immutable-blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
} from "../platform/storage/node-immutable-blob-store-profile";
import {
  openNodeSqliteLedger,
} from "../platform/storage/node-sqlite-ledger";
import {
  parsePoc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";
import type {
  ManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import {
  createLocalWorkspaceBackupService,
  type LocalWorkspaceBackupService,
} from "./local-workspace-backup-service";
import {
  migrateLocalWorkspaceEventSourcesIfNeeded,
} from "./local-workspace-event-source-migration";
import {
  migrateLocalWorkspacePlotEventLinksIfNeeded,
} from "./local-workspace-plot-event-link-migration";
import {
  migrateLocalWorkspacePlotBoardsIfNeeded,
} from "./local-workspace-plot-board-migration";
import {
  migrateLocalWorkspaceSceneProjectionIfNeeded,
} from "./local-workspace-scene-projection-migration";
import {
  migrateLocalWorkspaceCharacterExtractionIfNeeded,
} from "./local-workspace-character-extraction-migration";
import {
  migrateLocalWorkspaceCharacterRelationsIfNeeded,
} from "./local-workspace-character-relation-migration";
import {
  migrateLocalWorkspaceSceneExtractionIfNeeded,
} from "./local-workspace-scene-extraction-migration";
import {
  migrateLocalWorkspaceCharacterGenerationIfNeeded,
} from "./local-workspace-character-generation-migration";
import {
  migrateLocalWorkspaceSceneAnnotationsIfNeeded,
} from "./local-workspace-scene-annotation-migration";
import {
  migrateLocalWorkspaceSceneMusicQueuesIfNeeded,
} from "./local-workspace-scene-music-queue-migration";
import {
  migrateLocalWorkspaceSceneDraftsIfNeeded,
} from "./local-workspace-scene-draft-migration";
import {
  migrateLocalWorkspaceManuscriptLayoutIfNeeded,
} from "./local-workspace-manuscript-layout-migration";
import {
  migrateLocalWorkspaceDocumentCompletionIfNeeded,
} from "./local-workspace-document-completion-migration";
import {
  migrateLocalWorkspaceEpisodeRangeMovesIfNeeded,
} from "./local-workspace-episode-range-move-migration";

type NodeSqliteStatement = {
  all(
    ...parameters: readonly unknown[]
  ): readonly Record<string, unknown>[];
  run(
    ...parameters: readonly unknown[]
  ): {
    readonly changes: number | bigint;
  };
};

type NodeSqliteDatabase = {
  prepare(sql: string): NodeSqliteStatement;
  exec(sql: string): void;
  close(): void;
};

type NodeSqliteModule = {
  readonly DatabaseSync: new (
    databasePath: string,
  ) => NodeSqliteDatabase;
};

type StoredDocumentRow = {
  readonly workId: EntityId<"Work">;
  readonly workSchemaVersion: number;
  readonly workRevision: number;
  readonly workCreatedAt: string;
  readonly workTitle: string;
  readonly workUpdatedAt: string;
  readonly workStudioId: EntityId<"Studio">;
  readonly workOrderKey: string;
  readonly workResumeCheckpointId:
    EntityId<"ResumeCheckpoint"> | null;
  readonly workSettingsId: EntityId<"WorkSettings">;
  readonly documentId: EntityId<"Document">;
  readonly documentSchemaVersion: number;
  readonly documentRevision: number;
  readonly documentCreatedAt: string;
  readonly documentUpdatedAt: string;
  readonly documentTitle: string;
  readonly documentOrderKey: string;
  readonly folderId: EntityId<"DocumentFolder"> | null;
  readonly manuscriptId: EntityId<"Manuscript">;
  readonly currentRevisionId:
    EntityId<"DocumentRevision">;
  readonly completionRevision: number | null;
  readonly completionCompletedAt: string | null;
  readonly completionCompletedDate: string | null;
  readonly completionCompletedTimeZone: string | null;
  readonly completionDocumentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly completionUpdatedAt: string | null;
};

type StoredDocumentFolderRow = {
  readonly folderId: EntityId<"DocumentFolder">;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workId: EntityId<"Work">;
  readonly parentFolderId: EntityId<"DocumentFolder"> | null;
  readonly title: string;
  readonly orderKey: string;
};

type StoredWorkRow = {
  readonly workId: EntityId<"Work">;
  readonly workTitle: string;
  readonly workUpdatedAt: string;
};

type MutableDocumentSaveTarget = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  baseRevisionId:
    EntityId<"DocumentRevision">;
  currentRevisionId:
    EntityId<"DocumentRevision">;
  nextSequence: number;
  text: string;
};

type AcceptedBatch = {
  readonly batch: ChangeBatch;
  readonly receipt: RevisionSaveReceipt;
  readonly editorStateJson: string | undefined;
};

type StoredEventBlockRow = {
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly parentEventId: EntityId<"EventBlock"> | null;
  readonly outlineOrderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredEventSourceAnchorRow = {
  readonly anchorId: EntityId<"Anchor">;
  readonly documentId: EntityId<"Document">;
  readonly exactQuote: string;
};

type StoredEventSourceRow = {
  readonly eventSourceId: EntityId<"EventSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly rangeGroupId: EntityId<"RangeGroup">;
  readonly role: "primary" | "supporting";
  readonly anchors: readonly StoredEventSourceAnchorRow[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredSceneOverrideRow = {
  readonly sceneOverrideId: EntityId<"SceneOverride">;
  readonly anchorId: EntityId<"Anchor">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly operation: CreateSceneOverrideCommand["operation"];
  readonly baseRuleSetRevision: number;
  readonly note: string;
  readonly exactQuote: string;
  readonly orderIndex: number;
  readonly createdAt: string;
};

type StoredSceneEpisodeSegmentRow = {
  readonly segmentId: EntityId<"EpisodeSceneSegment">;
  readonly sceneId: EntityId<"Scene">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly anchorId: EntityId<"Anchor">;
};

type StoredSceneRuleSetRow = {
  readonly sceneRuleSetId: EntityId<"SceneRuleSet">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly displayName: string;
  readonly boundaryRulesJson: string;
  readonly normalizationPolicy: SceneRuleSetProjection["normalizationPolicy"];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredSceneEventOverrideRow = {
  readonly sceneEventOverrideId: EntityId<"SceneEventOverride">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sceneKey: string;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly operation: SceneEventOverrideProjection["operation"];
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredFragmentRow = {
  readonly fragmentId: EntityId<"Fragment">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly kindId: string;
  readonly title: string;
  readonly pinned: boolean;
  readonly useCount: number;
  readonly exactText: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredCharacterRow = {
  readonly characterId: EntityId<"Character">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly role: string;
  readonly summary: string;
  readonly appearance: string;
  readonly personality: string;
  readonly speech: string;
  readonly goal: string;
  readonly conflict: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredCharacterEvidenceRow = {
  readonly evidenceId: EntityId<"CharacterEvidence">;
  readonly workId: EntityId<"Work">;
  readonly characterId: EntityId<"Character">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
};

type StoredCharacterRelationRow = {
  readonly relationId: EntityId<"CharacterRelation">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly fromCharacterId: EntityId<"Character">;
  readonly toCharacterId: EntityId<"Character">;
  readonly kind: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly retirementReason: CharacterRelationRetirementReason | null;
};

type StoredCharacterExtractionCandidateRow = {
  readonly requestId: EntityId<"CharacterExtractionRequest">;
  readonly candidate: CharacterExtractionCandidate;
};

type StoredCharacterGenerationCandidateRow = {
  readonly requestId: EntityId<"CharacterGenerationRequest">;
  readonly candidate: CharacterGenerationCandidate;
};

type StoredSceneExtractionCandidateRow = {
  readonly requestId: EntityId<"SceneExtractionRequest">;
  readonly candidate: SceneExtractionCandidate;
};

type StoredSceneDraftCandidateRow = {
  readonly requestId: EntityId<"SceneDraftRequest">;
  readonly candidate: Omit<SceneDraftCandidate, "integrity">;
};

type StoredSceneAnnotationRow = SceneAnnotationProjection;

type StoredSceneMusicQueueCandidateRow = Omit<
  SceneMusicQueueCandidate,
  "integrity"
>;

type StoredLoreEntryRow = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredLoreEntryEvidenceRow = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
};

type StoredLoreEntryHistoryRow = {
  readonly historyId: EntityId<"LoreEntryHistory">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly workId: EntityId<"Work">;
  readonly entryRevision: number;
  readonly changeKind: LoreEntryHistoryProjection["changeKind"];
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly evidenceAnchorIds: readonly EntityId<"Anchor">[];
  readonly changedAt: string;
};

type StoredLoreCandidateRow = {
  readonly candidateId: EntityId<"LoreCandidate">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly source: LoreCandidateProjection["source"];
  readonly certainty: LoreCandidateProjection["certainty"];
  readonly proposal: LoreCandidateProposal;
  readonly reason: string;
  readonly status: LoreCandidateProjection["status"];
  readonly approvedLoreEntryId: EntityId<"LoreEntry"> | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
};

type StoredPublishingPartnerRow = {
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly revision: number;
  readonly name: string;
  readonly parentPartnerId: EntityId<"PublishingPartner"> | null;
  readonly submissionMethod: string;
  readonly websiteUrl: string;
  readonly email: string;
  readonly genres: readonly string[];
  readonly requiredLength: string;
  readonly priority: string;
  readonly note: string;
  readonly sourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredPublishingSubmissionRow = Omit<
  PublishingSubmissionProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingContractRow = Omit<
  PublishingContractProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingPublicationRow = Omit<
  PublishingPublicationProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingSettlementRow = Omit<
  PublishingSettlementProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingPaymentRow = Omit<
  PublishingPaymentProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingSourceRow = Omit<
  PublishingSourceProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

type StoredPublishingMailCandidateRow = Omit<
  PublishingMailCandidateProjection,
  "schemaVersion"
> & {
  readonly retiredAt: string | null;
};

const PUBLISHING_EVIDENCE_TARGET_TABLES: Readonly<
  Record<PublishingEvidenceTargetKind, string>
> = Object.freeze({
  partner: "publishing_partners",
  submission: "publishing_submissions",
  contract: "publishing_contracts",
  publication: "publishing_publications",
  settlement: "publishing_settlements",
  payment: "publishing_payments",
});

type StoredPlotThreadRow = {
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredPlotEventLinkRow = {
  readonly plotEventLinkId: EntityId<"PlotEventLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly eventBlockId: EntityId<"EventBlock">;
  readonly role: "primary" | "supporting";
  readonly createdFrom:
    | "event-to-plot"
    | "plot-to-event"
    | "manual-link";
  readonly plotTitle: string;
  readonly eventTitle: string;
  readonly plotRetiredAt: string | null;
  readonly eventRetiredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredPlotBoardRow = {
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly mode: "sequence" | "time-map";
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredPlotLaneRow = {
  readonly plotLaneId: EntityId<"PlotLane">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly title: string;
  readonly kind: PlotLaneKind;
  readonly orderKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type StoredPlotPlacementRow = {
  readonly plotPlacementId: EntityId<"PlotPlacement">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotBoardId: EntityId<"PlotBoard">;
  readonly plotLaneId: EntityId<"PlotLane">;
  readonly plotBeatId: EntityId<"PlotThread">;
  readonly orderKey: string;
  readonly storyTime: number | null;
  readonly storyTimeEnd: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
  readonly plotTitle: string;
  readonly plotStage: string;
  readonly plotSummary: string;
  readonly plotNote: string;
  readonly plotCreatedAt: string;
  readonly plotUpdatedAt: string;
  readonly plotRetiredAt: string | null;
  readonly plotRevision: number;
};

type StoredPlotThreadSourceRow = {
  readonly sourceId: EntityId<"PlotThreadSource">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly plotThreadId: EntityId<"PlotThread">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly exactText: string;
  readonly createdAt: string;
  readonly retiredAt: string | null;
};

type StoredForeshadowLineRow = {
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly title: string;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

type StoredForeshadowPointRow = {
  readonly pointId: EntityId<"ForeshadowPoint">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly roleId: string;
  readonly note: string;
  readonly exactText: string;
  readonly createdAt: string;
};

type StoredLoreForeshadowLinkRow = {
  readonly linkId: EntityId<"LoreForeshadowLink">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
  readonly unlinkReason: LoreForeshadowUnlinkReason | null;
};

type StoredWritingSessionRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document"> | null;
  readonly state: "active" | "completed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly startRevisionId: EntityId<"DocumentRevision"> | null;
  readonly endRevisionId: EntityId<"DocumentRevision"> | null;
  readonly note: string;
};

type StoredActivityIntervalRow = {
  readonly sessionId: EntityId<"WritingSession">;
  readonly startedAt: string;
  readonly endedAt: string;
};

type StoredFocusCycleRow = {
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly policyId: string;
  readonly state: "running" | "paused" | "completed" | "stopped";
  readonly phaseRef: string;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string | null;
  readonly remainingAtPause: number | null;
  readonly pauseReason: string | null;
  readonly completedAt: string | null;
  readonly note: string;
};

type StoredFocusPolicyRow = {
  readonly policyId: string;
  readonly workId: EntityId<"Work">;
  readonly phaseDefinitionsJson: string;
  readonly completionPolicy: string;
};

export type LocalWorkspaceRuntime =
  ManuscriptRuntimeCoordinator & {
    getWorkspaceCatalog(): WorkspaceCatalogProjection;
    getDocumentCompletion(value: unknown): Promise<DocumentCompletionProjection>;
    completeDocument(value: unknown): Promise<DocumentCompletionProjection>;
    clearDocumentCompletion(value: unknown): Promise<DocumentCompletionProjection>;
    getWorkFavorites(): WorkFavoritesProjection;
    setWorkFavorite(value: unknown): Promise<WorkFavoritesProjection>;
    getWorkCovers(): WorkCoversProjection;
    saveWorkCover(value: unknown): Promise<WorkCoverProjection>;
    activateWorkspaceLocation(
      value: unknown,
    ): Promise<WorkspaceCatalogProjection>;
    createWork(value: unknown): Promise<CreateWorkResult>;
    createFirstWork(
      value: unknown,
    ): Promise<CreateFirstWorkResult>;
    createDocument(
      value: unknown,
    ): Promise<CreateDocumentResult>;
    renameWork(value: unknown): Promise<WorkspaceCatalogProjection>;
    renameDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
    retireWork(value: unknown): Promise<WorkspaceCatalogProjection>;
    retireDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
    retireAllDocuments(value: unknown): Promise<WorkspaceCatalogProjection>;
    moveDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
    createDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
    renameDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
    placeDocumentInFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
    retireDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
    captureWorkspaceResume(
      value: unknown,
    ): Promise<ManuscriptResumeCheckpointProjection>;
    moveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt>;
    undoMoveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt>;
    createEventBlock(value: unknown): Promise<EventBlockProjection>;
    createAnchorlessEvent(value: unknown): Promise<EventBlockProjection>;
    moveEventBlock(value: unknown): Promise<EventBlockListProjection>;
    linkEventSource(value: unknown): Promise<EventSourceProjection>;
    replaceEventSource(value: unknown): Promise<EventSourceProjection>;
    retireEventSource(value: unknown): Promise<EventSourceProjection>;
    listEventBlocks(value: unknown): Promise<EventBlockListProjection>;
    listEventRail(value: unknown): Promise<EventRailProjection>;
    createSceneOverride(value: unknown): Promise<SceneOverrideProjection>;
    listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection>;
    listSceneProjection(value: unknown): Promise<SceneProjectionList>;
    updateSceneRuleSet(value: unknown): Promise<SceneProjectionList>;
    setSceneEventOverride(value: unknown): Promise<SceneProjectionList>;
    captureFragment(value: unknown): Promise<FragmentProjection>;
    listFragments(value: unknown): Promise<FragmentListProjection>;
    updateFragment(value: unknown): Promise<FragmentProjection>;
    recordFragmentUse(value: unknown): Promise<FragmentProjection>;
    retireFragment(value: unknown): Promise<FragmentProjection>;
    createCharacter(value: unknown): Promise<CharacterProjection>;
    listCharacters(value: unknown): Promise<CharacterListProjection>;
    updateCharacter(value: unknown): Promise<CharacterProjection>;
    addCharacterEvidence(value: unknown): Promise<CharacterProjection>;
    retireCharacter(value: unknown): Promise<CharacterProjection>;
    createCharacterRelation(value: unknown): Promise<CharacterRelationProjection>;
    listCharacterRelations(value: unknown): Promise<CharacterRelationListProjection>;
    updateCharacterRelation(value: unknown): Promise<CharacterRelationProjection>;
    retireCharacterRelation(value: unknown): Promise<CharacterRelationProjection>;
    createLoreEntry(value: unknown): Promise<LoreEntryProjection>;
    listLoreEntries(value: unknown): Promise<LoreEntryListProjection>;
    updateLoreEntry(value: unknown): Promise<LoreEntryProjection>;
    addLoreEntryEvidence(value: unknown): Promise<LoreEntryProjection>;
    retireLoreEntry(value: unknown): Promise<LoreEntryProjection>;
    linkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection>;
    listLoreForeshadowLinks(
      value: unknown,
    ): Promise<LoreForeshadowLinkListProjection>;
    unlinkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection>;
    createLoreCandidate(value: unknown): Promise<LoreCandidateProjection>;
    listLoreCandidates(value: unknown): Promise<LoreCandidateListProjection>;
    approveLoreCandidate(value: unknown): Promise<LoreCandidateApprovalResult>;
    rejectLoreCandidate(value: unknown): Promise<LoreCandidateProjection>;
    createPublishingPartner(value: unknown): Promise<PublishingPartnerProjection>;
    listPublishingPartners(value: unknown): Promise<PublishingPartnerListProjection>;
    updatePublishingPartner(value: unknown): Promise<PublishingPartnerProjection>;
    createPublishingSubmission(value: unknown): Promise<PublishingSubmissionProjection>;
    listPublishingSubmissions(value: unknown): Promise<PublishingSubmissionListProjection>;
    updatePublishingSubmission(value: unknown): Promise<PublishingSubmissionProjection>;
    createPublishingContract(value: unknown): Promise<PublishingContractProjection>;
    listPublishingContracts(value: unknown): Promise<PublishingContractListProjection>;
    updatePublishingContract(value: unknown): Promise<PublishingContractProjection>;
    createPublishingPublication(value: unknown): Promise<PublishingPublicationProjection>;
    listPublishingPublications(value: unknown): Promise<PublishingPublicationListProjection>;
    updatePublishingPublication(value: unknown): Promise<PublishingPublicationProjection>;
    createPublishingSettlement(value: unknown): Promise<PublishingSettlementProjection>;
    listPublishingSettlements(value: unknown): Promise<PublishingSettlementListProjection>;
    updatePublishingSettlement(value: unknown): Promise<PublishingSettlementProjection>;
    createPublishingPayment(value: unknown): Promise<PublishingPaymentProjection>;
    listPublishingPayments(value: unknown): Promise<PublishingPaymentListProjection>;
    updatePublishingPayment(value: unknown): Promise<PublishingPaymentProjection>;
    createPublishingSource(value: unknown): Promise<PublishingSourceProjection>;
    listPublishingSources(value: unknown): Promise<PublishingSourceListProjection>;
    previewPublishingResearch(
      value: unknown,
    ): Promise<PublishingResearchCandidateProjection>;
    approvePublishingResearch(
      value: unknown,
    ): Promise<PublishingResearchApprovalResult>;
    runPublishingAssistant(
      value: unknown,
    ): Promise<PublishingAssistantResult>;
    approvePublishingAssistantCandidate(
      value: unknown,
    ): Promise<PublishingAssistantApprovalResult>;
    setPublishingEvidenceLinks(
      value: unknown,
    ): Promise<PublishingEvidenceLinksProjection>;
    applyPublishingPartnerCsvImport(
      value: unknown,
    ): Promise<PublishingPartnerCsvImportResult>;
    applyPublishingSubmissionCsvImport(
      value: unknown,
    ): Promise<PublishingSubmissionCsvImportResult>;
    recordPublishingMailCandidate(
      value: unknown,
    ): Promise<PublishingMailCandidateProjection>;
    listPublishingMailCandidates(
      value: unknown,
    ): Promise<PublishingMailCandidateListProjection>;
    linkPublishingMailCandidate(
      value: unknown,
    ): Promise<PublishingMailCandidateProjection>;
    updatePublishingMailCandidate(
      value: unknown,
    ): Promise<PublishingMailCandidateProjection>;
    reviewPublishingMailCandidate(
      value: unknown,
    ): Promise<PublishingMailCandidateReviewResult>;
    createPlotThread(value: unknown): Promise<PlotThreadProjection>;
    listPlotThreads(value: unknown): Promise<PlotThreadListProjection>;
    getDefaultPlotBoard(value: unknown): Promise<PlotBoardProjection>;
    movePlotPlacement(value: unknown): Promise<PlotBoardProjection>;
    setPlotPlacementStoryTime(value: unknown): Promise<PlotBoardProjection>;
    updatePlotThread(value: unknown): Promise<PlotThreadProjection>;
    retirePlotThread(value: unknown): Promise<PlotThreadProjection>;
    createPlotFromEvent(value: unknown): Promise<PlotEventLinkMutationProjection>;
    createEventFromPlot(value: unknown): Promise<PlotEventLinkMutationProjection>;
    linkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection>;
    unlinkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection>;
    listPlotEventLinks(value: unknown): Promise<PlotEventLinkListProjection>;
    linkPlotThreadSource(value: unknown): Promise<PlotThreadSourceProjection>;
    listPlotThreadSources(
      value: unknown,
    ): Promise<PlotThreadSourceListProjection>;
    createForeshadowLine(value: unknown): Promise<ForeshadowLineProjection>;
    listForeshadowLines(value: unknown): Promise<ForeshadowLineListProjection>;
    updateForeshadowLine(value: unknown): Promise<ForeshadowLineProjection>;
    retireForeshadowLine(value: unknown): Promise<ForeshadowLineProjection>;
    createForeshadowPoint(value: unknown): Promise<ForeshadowPointProjection>;
    listForeshadowPoints(value: unknown): Promise<ForeshadowPointListProjection>;
    startWritingSession(value: unknown): Promise<WorkActivityProjection>;
    stopWritingSession(value: unknown): Promise<WorkActivityProjection>;
    startFocusCycle(value: unknown): Promise<WorkActivityProjection>;
    stopFocusCycle(value: unknown): Promise<WorkActivityProjection>;
    listWorkActivity(value: unknown): Promise<WorkActivityProjection>;
    getPomodoro(value: unknown): Promise<PomodoroProjection>;
    configureAndStartPomodoro(value: unknown): Promise<PomodoroProjection>;
    pausePomodoro(value: unknown): Promise<PomodoroProjection>;
    resumePomodoro(value: unknown): Promise<PomodoroProjection>;
    reconcilePomodoro(value: unknown): Promise<PomodoroProjection>;
    updatePomodoroNote(value: unknown): Promise<PomodoroProjection>;
    stopPomodoro(value: unknown): Promise<PomodoroProjection>;
    prepareWorkRecordsExport(value: unknown): Promise<PreparedWorkRecordsExport>;
    getWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection>;
    saveWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection>;
    getWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection>;
    saveWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection>;
    getContinuousReadingProgress(
      value: unknown,
    ): Promise<WorkContinuousReadingProgressProjection>;
    saveContinuousReadingProgress(
      value: unknown,
    ): Promise<WorkContinuousReadingProgressProjection>;
    listWorkSchedule(value: unknown): Promise<WorkScheduleProjection>;
    listWorkCalendar(value: unknown): Promise<WorkCalendarProjection>;
    getStudioToday(value: unknown): Promise<StudioTodayProjection>;
    createWorkScheduleItem(value: unknown): Promise<WorkScheduleItemProjection>;
    updateWorkScheduleItem(value: unknown): Promise<WorkScheduleItemProjection>;
    retireWorkScheduleItem(value: unknown): Promise<void>;
    setWorkScheduleCompletion(value: unknown): Promise<WorkScheduleItemProjection>;
    getAppSettings(): Promise<AppSettingsProjection>;
    saveAppSettings(value: unknown): Promise<AppSettingsProjection>;
    getWorkManuscriptLayoutSettings(
      value: unknown,
    ): Promise<WorkManuscriptLayoutSettingsProjection>;
    saveWorkManuscriptLayoutSettings(
      value: unknown,
    ): Promise<WorkManuscriptLayoutSettingsProjection>;
    getWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection>;
    saveWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection>;
    getWorkInspirationSettings(
      value: unknown,
    ): Promise<WorkInspirationSettingsProjection>;
    saveWorkInspirationSettings(
      value: unknown,
    ): Promise<WorkInspirationSettingsProjection>;
    getWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection>;
    saveWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection>;
    listAssistantContextState(
      value: unknown,
    ): Promise<AssistantContextStateProjection>;
    grantAssistantContextPermission(
      value: unknown,
    ): Promise<AssistantContextPermissionGrant>;
    revokeAssistantContextPermission(
      value: unknown,
    ): Promise<AssistantContextPermissionGrant>;
    authorizeAssistantContextAccess(
      value: unknown,
    ): Promise<AssistantContextAccessResult>;
    getAssistantDestinationProfile(): AssistantDestinationProfile;
    runAssistantVocabularyLookup(
      value: unknown,
    ): Promise<AssistantVocabularyLookupResult>;
    runAssistantVocabularySuggestion(
      value: unknown,
    ): Promise<AssistantVocabularySuggestionResult>;
    runAssistantExternalSettingReview(
      value: unknown,
    ): Promise<AssistantExternalSettingReviewResult>;
    runCharacterExtraction(value: unknown): Promise<CharacterExtractionResult>;
    listCharacterExtractionCandidates(
      value: unknown,
    ): Promise<CharacterExtractionCandidateList>;
    decideCharacterExtractionItem(
      value: unknown,
    ): Promise<CharacterExtractionDecisionResult>;
    runCharacterGeneration(value: unknown): Promise<CharacterGenerationResult>;
    listCharacterGenerationCandidates(
      value: unknown,
    ): Promise<CharacterGenerationCandidateList>;
    decideCharacterGenerationItem(
      value: unknown,
    ): Promise<CharacterGenerationDecisionResult>;
    runSceneExtraction(value: unknown): Promise<SceneExtractionResult>;
    listSceneExtractionCandidates(
      value: unknown,
    ): Promise<SceneExtractionCandidateList>;
    decideSceneExtractionBoundary(
      value: unknown,
    ): Promise<SceneExtractionDecisionResult>;
    listSceneAnnotations(value: unknown): Promise<SceneAnnotationList>;
    decideSceneExtractionAnnotation(
      value: unknown,
    ): Promise<SceneExtractionAnnotationDecisionResult>;
    runSceneDraft(value: unknown): Promise<RunSceneDraftResult>;
    listSceneDraftCandidates(value: unknown): Promise<SceneDraftCandidateList>;
    updateSceneDraftCandidate(value: unknown): Promise<SceneDraftCandidate>;
    prepareSceneDraftInsertion(
      value: unknown,
    ): Promise<PrepareSceneDraftInsertionResult>;
    completeSceneDraftInsertion(value: unknown): Promise<SceneDraftCandidate>;
    searchSceneMusicQueues(
      value: unknown,
    ): Promise<SceneMusicQueueSearchResult>;
    listSceneMusicQueueCandidates(
      value: unknown,
    ): Promise<SceneMusicQueueCandidateList>;
    selectSceneMusicQueue(
      value: unknown,
    ): Promise<SceneMusicQueueCandidate>;
    runAssistantNotationReview(
      value: unknown,
    ): Promise<AssistantNotationReviewResult>;
    runAssistantSettingReview(
      value: unknown,
    ): Promise<AssistantSettingReviewResult>;
    listDocumentRevisions(
      value: unknown,
    ): Promise<DocumentRevisionListProjection>;
    readDocumentRevision(
      value: unknown,
    ): Promise<DocumentRevisionContentProjection>;
    restoreDocumentRevision(
      value: unknown,
    ): Promise<RestoreDocumentRevisionResult>;
    createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection>;
    listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection>;
    compareWorkSnapshot(value: unknown): Promise<WorkSnapshotComparisonProjection>;
    getManuscriptPreflightSettings(
      value: unknown,
    ): Promise<ManuscriptPreflightSettingsProjection>;
    saveManuscriptPreflightSettings(
      value: unknown,
    ): Promise<ManuscriptPreflightSettingsProjection>;
    prepareManuscriptTextExport(
      value: unknown,
    ): Promise<ExportManuscriptTextCommand>;
    getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection>;
    createBackupBundle(finalBundleRoot: string): Promise<LocalWorkspaceBackupSummary>;
    restoreBackupBundle(
      finalBundleRoot: string,
      targetFinalRoot: string,
    ): Promise<LocalWorkspaceBackupSummary>;
    close(): void;
  };

type CharacterExtractionExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof CHARACTER_EXTRACTION_PROMPT_VERSION;
  payload: CharacterExtractionModelPayload;
}>;

type PreparedCharacterExtraction =
  | Readonly<{ result: CharacterExtractionResult }>
  | Readonly<{
      command: RunCharacterExtractionCommand;
      contextReceiptId: EntityId<"AssistantContextReceipt">;
      paragraphs: readonly CharacterExtractionParagraph[];
      execute: () => Promise<CharacterExtractionExecution>;
    }>;

type CharacterGenerationExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof CHARACTER_GENERATION_PROMPT_VERSION;
  payload: CharacterGenerationModelPayload;
}>;

type PreparedCharacterGeneration =
  | Readonly<{ result: CharacterGenerationResult }>
  | Readonly<{
      command: RunCharacterGenerationCommand;
      execute: () => Promise<CharacterGenerationExecution>;
    }>;

type SceneExtractionExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof SCENE_EXTRACTION_PROMPT_VERSION;
  payload: SceneExtractionModelPayload;
}>;

type PreparedSceneExtraction =
  | Readonly<{ result: SceneExtractionResult }>
  | Readonly<{
      command: RunSceneExtractionCommand;
      contextReceiptId: EntityId<"AssistantContextReceipt">;
      paragraphs: readonly SceneExtractionParagraph[];
      execute: () => Promise<SceneExtractionExecution>;
    }>;

type SceneDraftExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof SCENE_DRAFT_PROMPT_VERSION;
  payload: SceneDraftModelPayload;
}>;

type PreparedSceneDraft =
  | Readonly<{ result: RunSceneDraftResult }>
  | Readonly<{
      command: RunSceneDraftCommand;
      context: SceneDraftContext;
      execute: () => Promise<SceneDraftExecution>;
    }>;

type PreparedSceneMusicQueueSearch =
  | Readonly<{ result: SceneMusicQueueSearchResult }>
  | Readonly<{
      command: SearchSceneMusicQueuesCommand;
      sceneAnnotation: SceneAnnotationProjection;
      execute: () => Promise<readonly YouTubeVideoProjection[]>;
    }>;

export type LocalWorkspaceRuntimeOptions = {
  readonly rootDirectoryPath: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly documentCompletionClock?: Readonly<{
    now(): string;
  }>;
  readonly batchingPolicy:
    ManuscriptBatchingPolicy;
  readonly formattingProfile: ManuscriptFormattingProfile;
  readonly appSettingsProfile: AppSettingsProfile;
  readonly musicSettingsProfile: MusicSettingsProfile;
  readonly preflightProfile?: ManuscriptPreflightProfile;
  readonly fragmentProfile?: FragmentShelfProfile;
  readonly foreshadowPointProfile?: ForeshadowPointProfile;
  readonly assistantDestinationProfile?: AssistantDestinationProfile;
  readonly executeAssistantVocabularySuggestion?: (
    input: Readonly<{
      requestId: EntityId<"AssistantVocabularySuggestionRequest">;
      connectionId: EntityId<"AssistantConnection">;
      query: string;
      context: string | null;
    }>,
  ) => Promise<Readonly<{
    receipt: AssistantConnectorExecutionReceipt;
    payload: unknown;
  }>>;
  readonly executeAssistantExternalSettingReview?: (
    input: Readonly<{
      requestId: EntityId<"AssistantExternalSettingReviewRequest">;
      connectionId: EntityId<"AssistantConnection">;
      query: string;
      sourceRange: AssistantContextRequest["readRanges"][number];
      manuscript: string;
      settings: readonly AssistantSettingReviewSource[];
    }>,
  ) => Promise<Readonly<{
    receipt: AssistantConnectorExecutionReceipt;
    payload: unknown;
  }>>;
  readonly characterExtraction?: Readonly<{
    destinationId: string;
    isConnected: () => boolean;
    execute: (
      input: Readonly<{
        requestId: EntityId<"CharacterExtractionRequest">;
        paragraphs: readonly CharacterExtractionParagraph[];
      }>,
    ) => Promise<CharacterExtractionExecution>;
  }>;
  readonly characterGeneration?: Readonly<{
    destinationId: string;
    isConnected: () => boolean;
    execute: (
      input: Readonly<{
        requestId: EntityId<"CharacterGenerationRequest">;
        brief: CharacterGenerationBrief;
      }>,
    ) => Promise<CharacterGenerationExecution>;
  }>;
  readonly sceneExtraction?: Readonly<{
    destinationId: string;
    isConnected: () => boolean;
    execute: (
      input: Readonly<{
        requestId: EntityId<"SceneExtractionRequest">;
        paragraphs: readonly SceneExtractionParagraph[];
      }>,
    ) => Promise<SceneExtractionExecution>;
  }>;
  readonly sceneDraft?: Readonly<{
    destinationId: string;
    isConnected: () => boolean;
    execute: (
      input: Readonly<{
        requestId: EntityId<"SceneDraftRequest">;
        context: SceneDraftContext;
      }>,
    ) => Promise<SceneDraftExecution>;
  }>;
  readonly sceneMusicSearch?: Readonly<{
    providerId: string;
    searchLimit: number;
    tracksPerOption: number;
    isConnected: () => boolean;
    execute: (
      input: Readonly<{ query: string; limit: number }>,
    ) => Promise<readonly YouTubeVideoProjection[]>;
  }>;
  readonly executePublishingAssistantIntent?: (
    input: Readonly<{
      requestId: EntityId<"AssistantConnectorRequest">;
      connectionId: EntityId<"AssistantConnection">;
      statement: string;
      currentDate: string;
      registry: PublishingAssistantRegistry;
    }>,
  ) => Promise<Readonly<{
    receipt: AssistantConnectorExecutionReceipt;
    payload: unknown;
  }>>;
  readonly emptyDocumentProfile:
    ManuscriptDocumentProfile;
  readonly defaults: LocalWorkspaceDefaults;
  readonly backupProfile: LocalWorkspaceBackupProfile;
};

export const LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION = 15;
export const LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY =
  "eum-studio-ledger-sha256-v1";
export const LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY =
  "eum-studio-manuscript-utf16le-v1";
export const LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM = "sha256";

const DOCUMENT_ROWS_SQL = `
SELECT
  w.id AS "workId",
  w.schema_version AS "workSchemaVersion",
  w.revision AS "workRevision",
  w.created_at AS "workCreatedAt",
  w.title AS "workTitle",
  w.updated_at AS "workUpdatedAt",
  w.studio_id AS "workStudioId",
  w.order_key AS "workOrderKey",
  w.resume_checkpoint_id AS "workResumeCheckpointId",
  w.settings_id AS "workSettingsId",
  d.id AS "documentId",
  d.schema_version AS "documentSchemaVersion",
  d.revision AS "documentRevision",
  d.created_at AS "documentCreatedAt",
  d.updated_at AS "documentUpdatedAt",
  d.title AS "documentTitle",
  d.order_key AS "documentOrderKey",
  d.folder_id AS "folderId",
  d.manuscript_id AS "manuscriptId",
  m.current_revision_id AS "currentRevisionId",
  dc.revision AS "completionRevision",
  dc.completed_at AS "completionCompletedAt",
  dc.completed_date AS "completionCompletedDate",
  dc.completed_time_zone AS "completionCompletedTimeZone",
  dc.completed_document_revision_id AS "completionDocumentRevisionId",
  dc.updated_at AS "completionUpdatedAt"
FROM works AS w
JOIN documents AS d
  ON d.work_id = w.id
JOIN manuscripts AS m
  ON m.id = d.manuscript_id
  AND m.work_id = w.id
  AND m.document_id = d.id
LEFT JOIN document_completion_status AS dc
  ON dc.work_id = w.id
  AND dc.document_id = d.id
WHERE
  w.retired_at IS NULL
  AND d.retired_at IS NULL
  AND d.archived_at IS NULL
ORDER BY
  w.updated_at DESC,
  w.order_key DESC,
  d.order_key ASC,
  d.created_at ASC
`;

const DOCUMENT_FOLDER_ROWS_SQL = `
SELECT
  f.id AS "folderId",
  f.schema_version AS "schemaVersion",
  f.revision AS "revision",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.work_id AS "workId",
  f.parent_folder_id AS "parentFolderId",
  f.title AS "title",
  f.order_key AS "orderKey"
FROM document_folders AS f
JOIN works AS w
  ON w.id = f.work_id
WHERE
  w.retired_at IS NULL
  AND f.retired_at IS NULL
ORDER BY
  f.order_key ASC,
  f.created_at ASC
`;

const WORK_ROWS_SQL = `
SELECT
  id AS "workId",
  title AS "workTitle",
  updated_at AS "workUpdatedAt"
FROM works
WHERE retired_at IS NULL
ORDER BY updated_at DESC, order_key DESC
`;

const EVENT_BLOCK_ROWS_SQL = `
SELECT
  e.id AS "eventBlockId",
  e.revision AS "revision",
  e.work_id AS "workId",
  e.title AS "title",
  COALESCE(e.note, '') AS "note",
  e.parent_event_id AS "parentEventId",
  e.order_key AS "outlineOrderKey",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  e.retired_at AS "retiredAt"
FROM event_blocks AS e
WHERE
  e.work_id = ?
  AND e.retired_at IS NULL
ORDER BY e.order_key ASC
`;

const EVENT_BLOCK_ROW_BY_ID_SQL = `
SELECT
  e.id AS "eventBlockId",
  e.revision AS "revision",
  e.work_id AS "workId",
  e.title AS "title",
  COALESCE(e.note, '') AS "note",
  e.parent_event_id AS "parentEventId",
  e.order_key AS "outlineOrderKey",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  e.retired_at AS "retiredAt"
FROM event_blocks AS e
WHERE e.work_id = ? AND e.id = ?
`;

const EVENT_SOURCE_ROWS_SQL = `
SELECT
  es.id AS "eventSourceId",
  es.revision AS "revision",
  es.work_id AS "workId",
  es.event_block_id AS "eventBlockId",
  es.range_group_id AS "rangeGroupId",
  es.role AS "role",
  es.created_at AS "createdAt",
  es.updated_at AS "updatedAt",
  es.retired_at AS "retiredAt",
  rga.order_index AS "anchorOrderIndex",
  a.id AS "anchorId",
  a.document_id AS "documentId",
  a.exact_quote AS "exactQuote"
FROM event_sources AS es
JOIN event_blocks AS e
  ON e.work_id = es.work_id
  AND e.id = es.event_block_id
  AND e.retired_at IS NULL
JOIN range_groups AS rg
  ON rg.work_id = es.work_id
  AND rg.id = es.range_group_id
LEFT JOIN range_group_anchors AS rga
  ON rga.work_id = rg.work_id
  AND rga.range_group_id = rg.id
LEFT JOIN anchors AS a
  ON a.work_id = rga.work_id
  AND a.id = rga.anchor_id
WHERE
  es.work_id = ?
  AND es.retired_at IS NULL
ORDER BY
  es.created_at ASC,
  es.id ASC,
  rga.order_index ASC
`;

const SCENE_OVERRIDE_ROWS_SQL = `
SELECT
  so.id AS "sceneOverrideId",
  soa.anchor_id AS "anchorId",
  so.work_id AS "workId",
  so.document_id AS "documentId",
  so.operation AS "operation",
  so.base_rule_set_revision AS "baseRuleSetRevision",
  COALESCE(so.note, '') AS "note",
  a.exact_quote AS "exactQuote",
  soa.order_index AS "orderIndex",
  so.created_at AS "createdAt"
FROM scene_overrides AS so
JOIN scene_override_anchors AS soa
  ON soa.work_id = so.work_id
  AND soa.document_id = so.document_id
  AND soa.scene_override_id = so.id
JOIN anchors AS a
  ON a.work_id = soa.work_id
  AND a.document_id = soa.document_id
  AND a.id = soa.anchor_id
WHERE
  so.work_id = ?
  AND so.retired_at IS NULL
ORDER BY so.created_at ASC, so.id ASC, soa.order_index ASC
`;

const SCENE_RULE_SET_ROW_BY_WORK_SQL = `
SELECT
  srs.id AS "sceneRuleSetId",
  srs.revision AS "revision",
  srs.work_id AS "workId",
  srs.display_name AS "displayName",
  srs.boundary_rules_json AS "boundaryRulesJson",
  srs.normalization_policy AS "normalizationPolicy",
  srs.enabled AS "enabled",
  srs.created_at AS "createdAt",
  srs.updated_at AS "updatedAt"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN scene_rule_sets AS srs
  ON srs.work_id = ws.work_id
  AND srs.id = ws.scene_rule_set_id
WHERE
  w.id = ?
  AND w.retired_at IS NULL
  AND srs.retired_at IS NULL
`;

const SCENE_EVENT_OVERRIDE_ROWS_SQL = `
SELECT
  seo.id AS "sceneEventOverrideId",
  seo.revision AS "revision",
  seo.work_id AS "workId",
  seo.scene_key AS "sceneKey",
  seo.event_block_id AS "eventBlockId",
  seo.operation AS "operation",
  seo.created_at AS "createdAt",
  seo.updated_at AS "updatedAt"
FROM scene_event_overrides AS seo
WHERE seo.work_id = ? AND seo.retired_at IS NULL
ORDER BY seo.created_at ASC, seo.id ASC
`;

const SCENE_EPISODE_SEGMENT_ROWS_SQL = `
SELECT
  segment.id AS "segmentId",
  segment.scene_id AS "sceneId",
  segment.work_id AS "workId",
  segment.document_id AS "documentId",
  segment.anchor_id AS "anchorId"
FROM scene_episode_segments AS segment
JOIN scene_identities AS scene
  ON scene.work_id = segment.work_id
  AND scene.id = segment.scene_id
  AND scene.retired_at IS NULL
JOIN documents AS document
  ON document.work_id = segment.work_id
  AND document.id = segment.document_id
  AND document.retired_at IS NULL
  AND document.archived_at IS NULL
WHERE
  segment.work_id = ?
  AND segment.retired_at IS NULL
ORDER BY segment.created_at, segment.id
`;

const ACTIVE_FRAGMENT_ROWS_SQL = `
SELECT
  f.id AS "fragmentId",
  f.revision AS "revision",
  f.work_id AS "workId",
  f.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  f.source_anchor_id AS "sourceAnchorId",
  f.kind_id AS "kindId",
  f.title AS "title",
  f.pinned AS "pinned",
  f.use_count AS "useCount",
  a.exact_quote AS "exactText",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.retired_at AS "retiredAt"
FROM fragments AS f
JOIN anchors AS a
  ON a.work_id = f.work_id
  AND a.document_id = f.source_document_id
  AND a.id = f.source_anchor_id
WHERE f.work_id = ? AND f.retired_at IS NULL
ORDER BY f.pinned DESC, f.updated_at DESC, f.id ASC
`;

const FRAGMENT_ROW_BY_ID_SQL = `
SELECT
  f.id AS "fragmentId",
  f.revision AS "revision",
  f.work_id AS "workId",
  f.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  f.source_anchor_id AS "sourceAnchorId",
  f.kind_id AS "kindId",
  f.title AS "title",
  f.pinned AS "pinned",
  f.use_count AS "useCount",
  a.exact_quote AS "exactText",
  f.created_at AS "createdAt",
  f.updated_at AS "updatedAt",
  f.retired_at AS "retiredAt"
FROM fragments AS f
JOIN anchors AS a
  ON a.work_id = f.work_id
  AND a.document_id = f.source_document_id
  AND a.id = f.source_anchor_id
WHERE f.work_id = ? AND f.id = ?
`;

const ACTIVE_CHARACTER_ROWS_SQL = `
SELECT
  id AS "characterId",
  revision AS "revision",
  work_id AS "workId",
  name AS "name",
  aliases_json AS "aliasesJson",
  role AS "role",
  summary AS "summary",
  appearance AS "appearance",
  personality AS "personality",
  speech AS "speech",
  goal AS "goal",
  conflict AS "conflict",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM characters
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

const CHARACTER_ROW_BY_ID_SQL = `
SELECT
  id AS "characterId",
  revision AS "revision",
  work_id AS "workId",
  name AS "name",
  aliases_json AS "aliasesJson",
  role AS "role",
  summary AS "summary",
  appearance AS "appearance",
  personality AS "personality",
  speech AS "speech",
  goal AS "goal",
  conflict AS "conflict",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM characters
WHERE work_id = ? AND id = ?
`;

const CHARACTER_EVIDENCE_ROWS_SQL = `
SELECT
  e.id AS "evidenceId",
  e.work_id AS "workId",
  e.character_id AS "characterId",
  e.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  e.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  e.created_at AS "createdAt"
FROM character_evidence AS e
JOIN anchors AS a
  ON a.work_id = e.work_id
  AND a.document_id = e.source_document_id
  AND a.id = e.source_anchor_id
WHERE e.work_id = ? AND e.character_id = ?
ORDER BY e.created_at ASC, e.id ASC
`;

const CHARACTER_RELATION_ROWS_SQL = `
SELECT
  id AS "relationId",
  revision AS "revision",
  work_id AS "workId",
  from_character_id AS "fromCharacterId",
  to_character_id AS "toCharacterId",
  kind AS "kind",
  description AS "description",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  retirement_reason AS "retirementReason"
FROM character_relations
WHERE work_id = ?
ORDER BY updated_at DESC, id ASC
`;

const CHARACTER_RELATION_ROW_BY_ID_SQL = `
SELECT
  id AS "relationId",
  revision AS "revision",
  work_id AS "workId",
  from_character_id AS "fromCharacterId",
  to_character_id AS "toCharacterId",
  kind AS "kind",
  description AS "description",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt",
  retirement_reason AS "retirementReason"
FROM character_relations
WHERE work_id = ? AND id = ?
`;

const CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_from AS "sourceFrom",
  source_to AS "sourceTo",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  items_json AS "itemsJson",
  context_receipt_id AS "contextReceiptId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_character_extraction_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

const CHARACTER_EXTRACTION_CANDIDATE_BY_ID_SQL = `
${CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

const CHARACTER_GENERATION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  brief_json AS "briefJson",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  items_json AS "itemsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_character_generation_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

const CHARACTER_GENERATION_CANDIDATE_BY_ID_SQL = `
${CHARACTER_GENERATION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

const SCENE_EXTRACTION_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_from AS "sourceFrom",
  source_to AS "sourceTo",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  status AS "status",
  scenes_json AS "scenesJson",
  boundaries_json AS "boundariesJson",
  context_receipt_id AS "contextReceiptId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_scene_extraction_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

const SCENE_EXTRACTION_CANDIDATE_BY_ID_SQL = `
${SCENE_EXTRACTION_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

const SCENE_DRAFT_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  plot_thread_id AS "plotThreadId",
  plot_thread_revision AS "plotThreadRevision",
  target_document_id AS "targetDocumentId",
  target_document_revision_id AS "targetDocumentRevisionId",
  insertion_offset AS "insertionOffset",
  provider_id AS "providerId",
  model_id AS "modelId",
  prompt_version AS "promptVersion",
  context_json AS "contextJson",
  generated_text AS "generatedText",
  draft_text AS "draftText",
  status AS "status",
  applied_document_revision_id AS "appliedDocumentRevisionId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM assistant_scene_draft_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

const SCENE_DRAFT_CANDIDATE_BY_ID_SQL = `
${SCENE_DRAFT_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

const SCENE_ANNOTATION_ROWS_SQL = `
SELECT
  id AS "sceneAnnotationId",
  revision AS "revision",
  work_id AS "workId",
  scene_key AS "sceneKey",
  document_id AS "documentId",
  document_revision_id AS "documentRevisionId",
  source_candidate_id AS "sourceCandidateId",
  source_scene_item_id AS "sourceSceneItemId",
  title AS "title",
  summary AS "summary",
  pov_character_id AS "povCharacterId",
  location AS "location",
  time AS "time",
  character_ids_json AS "characterIdsJson",
  goal AS "goal",
  conflict AS "conflict",
  outcome AS "outcome",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM scene_annotations
WHERE work_id = ?
ORDER BY updated_at DESC, id ASC
`;

const SCENE_ANNOTATION_BY_KEY_SQL = `
${SCENE_ANNOTATION_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND scene_key = ?",
)}
`;

const SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL = `
SELECT
  id AS "candidateId",
  request_id AS "requestId",
  revision AS "revision",
  work_id AS "workId",
  scene_key AS "sceneKey",
  scene_annotation_id AS "sceneAnnotationId",
  scene_annotation_revision AS "sceneAnnotationRevision",
  provider_id AS "providerId",
  query_text AS "query",
  status AS "status",
  options_json AS "optionsJson",
  selected_option_id AS "selectedOptionId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM scene_music_queue_candidates
WHERE work_id = ?
ORDER BY updated_at DESC, id DESC
`;

const SCENE_MUSIC_QUEUE_CANDIDATE_BY_ID_SQL = `
${SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL.replace(
  "WHERE work_id = ?",
  "WHERE work_id = ? AND id = ?",
)}
`;

const ACTIVE_LORE_ENTRY_ROWS_SQL = `
SELECT
  id AS "loreEntryId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM lore_entries
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

const LORE_ENTRY_ROW_BY_ID_SQL = `
SELECT
  id AS "loreEntryId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM lore_entries
WHERE work_id = ? AND id = ?
`;

const LORE_ENTRY_EVIDENCE_ROWS_SQL = `
SELECT
  lee.lore_entry_id AS "loreEntryId",
  lee.work_id AS "workId",
  lee.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  lee.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  lee.created_at AS "createdAt"
FROM lore_entry_evidence AS lee
JOIN anchors AS a
  ON a.work_id = lee.work_id
  AND a.document_id = lee.source_document_id
  AND a.id = lee.source_anchor_id
WHERE lee.work_id = ? AND lee.lore_entry_id = ?
ORDER BY lee.created_at ASC, lee.source_anchor_id ASC
`;

const LORE_ENTRY_HISTORY_ROWS_SQL = `
SELECT
  id AS "historyId",
  lore_entry_id AS "loreEntryId",
  work_id AS "workId",
  entry_revision AS "entryRevision",
  change_kind AS "changeKind",
  title AS "title",
  content AS "content",
  category AS "category",
  aliases_json AS "aliasesJson",
  enabled AS "enabled",
  evidence_anchor_ids_json AS "evidenceAnchorIdsJson",
  changed_at AS "changedAt"
FROM lore_entry_history
WHERE work_id = ? AND lore_entry_id = ?
ORDER BY entry_revision DESC, id ASC
`;

const LORE_FORESHADOW_LINK_SELECT_SQL = `
SELECT
  id AS "linkId",
  revision AS "revision",
  work_id AS "workId",
  lore_entry_id AS "loreEntryId",
  line_id AS "lineId",
  linked_at AS "linkedAt",
  unlinked_at AS "unlinkedAt",
  unlink_reason AS "unlinkReason"
FROM lore_foreshadow_links
`;

const LORE_FORESHADOW_LINK_ROWS_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE work_id = ? AND retired_at IS NULL
ORDER BY linked_at ASC, id ASC
`;

const LORE_FORESHADOW_LINK_ROW_BY_ID_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

const ACTIVE_LORE_FORESHADOW_LINK_BY_PAIR_SQL = `
${LORE_FORESHADOW_LINK_SELECT_SQL}
WHERE
  work_id = ?
  AND lore_entry_id = ?
  AND line_id = ?
  AND unlinked_at IS NULL
  AND retired_at IS NULL
`;

const LORE_CANDIDATE_SELECT_SQL = `
SELECT
  id AS "candidateId",
  revision AS "revision",
  work_id AS "workId",
  source_document_id AS "sourceDocumentId",
  source_document_revision_id AS "sourceDocumentRevisionId",
  source_anchor_id AS "sourceAnchorId",
  exact_text AS "exactText",
  source AS "source",
  certainty AS "certainty",
  proposal_json AS "proposalJson",
  reason AS "reason",
  status AS "status",
  approved_lore_entry_id AS "approvedLoreEntryId",
  created_at AS "createdAt",
  reviewed_at AS "reviewedAt"
FROM lore_candidates
`;

const LORE_CANDIDATE_ROWS_SQL = `
${LORE_CANDIDATE_SELECT_SQL}
WHERE work_id = ? AND retired_at IS NULL
ORDER BY created_at DESC, id ASC
`;

const LORE_CANDIDATE_ROW_BY_ID_SQL = `
${LORE_CANDIDATE_SELECT_SQL}
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

const ACTIVE_PUBLISHING_PARTNER_ROWS_SQL = `
SELECT
  id AS "partnerId",
  revision AS "revision",
  name AS "name",
  parent_partner_id AS "parentPartnerId",
  submission_method AS "submissionMethod",
  website_url AS "websiteUrl",
  email AS "email",
  genres_json AS "genresJson",
  required_length AS "requiredLength",
  priority AS "priority",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_partners
WHERE retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

const PUBLISHING_PARTNER_ROW_BY_ID_SQL = `
SELECT
  id AS "partnerId",
  revision AS "revision",
  name AS "name",
  parent_partner_id AS "parentPartnerId",
  submission_method AS "submissionMethod",
  website_url AS "websiteUrl",
  email AS "email",
  genres_json AS "genresJson",
  required_length AS "requiredLength",
  priority AS "priority",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_partners
WHERE id = ?
`;

const PUBLISHING_SUBMISSION_SELECT_SQL = `
SELECT
  submission.id AS "submissionId",
  submission.revision AS "revision",
  submission.work_id AS "workId",
  submission.partner_id AS "partnerId",
  submission.title AS "title",
  submission.status AS "status",
  submission.submitted_on AS "submittedOn",
  submission.responded_on AS "respondedOn",
  submission.result AS "result",
  submission.note AS "note",
  submission.card_note AS "cardNote",
  submission.source_ids_json AS "sourceIdsJson",
  submission.created_at AS "createdAt",
  submission.updated_at AS "updatedAt",
  submission.retired_at AS "retiredAt",
  package.id AS "submissionPackageId",
  package.work_snapshot_id AS "workSnapshotId",
  package.work_title_snapshot AS "workTitleSnapshot",
  package.partner_name_snapshot AS "partnerNameSnapshot",
  package.manifest_hash AS "packageManifestHash",
  package.sealed_at AS "sealedAt",
  reference.document_id AS "documentId",
  reference.document_revision_id AS "documentRevisionId"
FROM publishing_submissions AS submission
JOIN submission_packages AS package
  ON package.id = submission.submission_package_id
  AND package.work_id = submission.work_id
  AND package.partner_id = submission.partner_id
LEFT JOIN work_snapshot_document_revisions AS reference
  ON reference.work_id = package.work_id
  AND reference.work_snapshot_id = package.work_snapshot_id
`;

const ACTIVE_PUBLISHING_SUBMISSION_ROWS_SQL = `
${PUBLISHING_SUBMISSION_SELECT_SQL}
WHERE
  submission.retired_at IS NULL
  AND (? IS NULL OR submission.work_id = ?)
ORDER BY submission.updated_at DESC, submission.id ASC, reference.document_id ASC
`;

const PUBLISHING_SUBMISSION_ROW_BY_ID_SQL = `
${PUBLISHING_SUBMISSION_SELECT_SQL}
WHERE submission.id = ?
ORDER BY reference.document_id ASC
`;

const PUBLISHING_CONTRACT_SELECT_SQL = `
SELECT
  id AS "contractId",
  revision AS "revision",
  work_id AS "workId",
  partner_id AS "partnerId",
  submission_id AS "submissionId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  partner_name_snapshot AS "partnerNameSnapshot",
  status AS "status",
  signed_on AS "signedOn",
  starts_on AS "startsOn",
  ends_on AS "endsOn",
  rights_scope AS "rightsScope",
  advance_amount AS "advanceAmount",
  currency_code AS "currencyCode",
  revenue_share_note AS "revenueShareNote",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_contracts
`;

const ACTIVE_PUBLISHING_CONTRACT_ROWS_SQL = `
${PUBLISHING_CONTRACT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

const PUBLISHING_CONTRACT_ROW_BY_ID_SQL = `
${PUBLISHING_CONTRACT_SELECT_SQL}
WHERE id = ?
`;

const PUBLISHING_PUBLICATION_SELECT_SQL = `
SELECT
  id AS "publicationId",
  revision AS "revision",
  work_id AS "workId",
  contract_id AS "contractId",
  channel_partner_id AS "channelPartnerId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  channel_name_snapshot AS "channelNameSnapshot",
  status AS "status",
  format AS "format",
  scheduled_on AS "scheduledOn",
  starts_on AS "startsOn",
  ends_on AS "endsOn",
  published_unit_count AS "publishedUnitCount",
  planned_unit_count AS "plannedUnitCount",
  schedule_note AS "scheduleNote",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_publications
`;

const ACTIVE_PUBLISHING_PUBLICATION_ROWS_SQL = `
${PUBLISHING_PUBLICATION_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

const PUBLISHING_PUBLICATION_ROW_BY_ID_SQL = `
${PUBLISHING_PUBLICATION_SELECT_SQL}
WHERE id = ?
`;

const PUBLISHING_SETTLEMENT_SELECT_SQL = `
SELECT
  id AS "settlementId",
  revision AS "revision",
  work_id AS "workId",
  publication_id AS "publicationId",
  title AS "title",
  work_title_snapshot AS "workTitleSnapshot",
  publication_title_snapshot AS "publicationTitleSnapshot",
  period_starts_on AS "periodStartsOn",
  period_ends_on AS "periodEndsOn",
  issued_on AS "issuedOn",
  review_status AS "reviewStatus",
  currency_code AS "currencyCode",
  reported_amount AS "reportedAmount",
  items_json AS "itemsJson",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_settlements
`;

const ACTIVE_PUBLISHING_SETTLEMENT_ROWS_SQL = `
${PUBLISHING_SETTLEMENT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

const PUBLISHING_SETTLEMENT_ROW_BY_ID_SQL = `
${PUBLISHING_SETTLEMENT_SELECT_SQL}
WHERE id = ?
`;

const PUBLISHING_PAYMENT_SELECT_SQL = `
SELECT
  id AS "paymentId",
  revision AS "revision",
  work_id AS "workId",
  settlement_id AS "settlementId",
  work_title_snapshot AS "workTitleSnapshot",
  settlement_title_snapshot AS "settlementTitleSnapshot",
  received_on AS "receivedOn",
  confirmed_on AS "confirmedOn",
  amount AS "amount",
  currency_code AS "currencyCode",
  match_status AS "matchStatus",
  payer_label AS "payerLabel",
  reference AS "reference",
  note AS "note",
  source_ids_json AS "sourceIdsJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM publishing_payments
`;

const ACTIVE_PUBLISHING_PAYMENT_ROWS_SQL = `
${PUBLISHING_PAYMENT_SELECT_SQL}
WHERE retired_at IS NULL AND (? IS NULL OR work_id = ?)
ORDER BY updated_at DESC, id ASC
`;

const PUBLISHING_PAYMENT_ROW_BY_ID_SQL = `
${PUBLISHING_PAYMENT_SELECT_SQL}
WHERE id = ?
`;

const PUBLISHING_SOURCE_SELECT_SQL = `
SELECT
  id AS "sourceId",
  revision AS "revision",
  source_kind AS "kind",
  label AS "label",
  url AS "url",
  observed_at AS "observedAt",
  authority AS "authority",
  imported_fields_json AS "importedFieldsJson",
  created_at AS "createdAt",
  retired_at AS "retiredAt"
FROM publishing_sources
`;

const ACTIVE_PUBLISHING_SOURCE_ROWS_SQL = `
${PUBLISHING_SOURCE_SELECT_SQL}
WHERE retired_at IS NULL
ORDER BY created_at DESC, id ASC
`;

const PUBLISHING_SOURCE_ROW_BY_ID_SQL = `
${PUBLISHING_SOURCE_SELECT_SQL}
WHERE id = ?
`;

const PUBLISHING_MAIL_CANDIDATE_SELECT_SQL = `
SELECT
  candidate.id AS "candidateId",
  candidate.revision AS "revision",
  candidate.source_id AS "sourceId",
  candidate.source_account_id AS "sourceAccountId",
  candidate.message_id AS "messageId",
  candidate.thread_id AS "threadId",
  candidate.sender AS "from",
  candidate.subject AS "subject",
  candidate.received_at AS "receivedAt",
  candidate.snippet AS "snippet",
  candidate.body_fingerprint AS "bodyFingerprint",
  candidate.submission_id AS "submissionId",
  submission.partner_id AS "partnerId",
  candidate.match_reason AS "matchReason",
  candidate.proposed_status AS "proposedStatus",
  candidate.proposed_result AS "proposedResult",
  candidate.proposed_responded_on AS "proposedRespondedOn",
  candidate.proposed_note AS "proposedNote",
  candidate.classification_connection_id AS "classificationConnectionId",
  candidate.classification_model AS "classificationModel",
  candidate.review_status AS "reviewStatus",
  candidate.created_at AS "createdAt",
  candidate.updated_at AS "updatedAt",
  candidate.retired_at AS "retiredAt"
FROM publishing_mail_candidates AS candidate
LEFT JOIN publishing_submissions AS submission
  ON submission.id = candidate.submission_id
`;

const ACTIVE_PUBLISHING_MAIL_CANDIDATE_ROWS_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.retired_at IS NULL
ORDER BY candidate.received_at DESC, candidate.id ASC
`;

const PUBLISHING_MAIL_CANDIDATE_ROW_BY_ID_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.id = ?
`;

const PUBLISHING_MAIL_CANDIDATE_ROW_BY_SOURCE_SQL = `
${PUBLISHING_MAIL_CANDIDATE_SELECT_SQL}
WHERE candidate.source_account_id = ? AND candidate.message_id = ?
`;

const ACTIVE_PLOT_THREAD_ROWS_SQL = `
SELECT
  id AS "plotThreadId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  stage AS "stage",
  summary AS "summary",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM plot_threads
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

const PLOT_THREAD_ROW_BY_ID_SQL = `
SELECT
  id AS "plotThreadId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  stage AS "stage",
  summary AS "summary",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM plot_threads
WHERE work_id = ? AND id = ?
`;

const DEFAULT_PLOT_BOARD_ROWS_SQL = `
SELECT
  id AS "plotBoardId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  mode AS "mode",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM plot_boards
WHERE work_id = ? AND mode = 'sequence'
ORDER BY created_at ASC, id ASC
`;

const PLOT_LANE_ROWS_SQL = `
SELECT
  id AS "plotLaneId",
  revision AS "revision",
  work_id AS "workId",
  plot_board_id AS "plotBoardId",
  title AS "title",
  kind AS "kind",
  order_key AS "orderKey",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM plot_lanes
WHERE work_id = ? AND plot_board_id = ?
`;

const PLOT_PLACEMENT_SELECT_SQL = `
SELECT
  placement.id AS "plotPlacementId",
  placement.revision AS "revision",
  placement.work_id AS "workId",
  placement.plot_board_id AS "plotBoardId",
  placement.plot_lane_id AS "plotLaneId",
  placement.plot_thread_id AS "plotBeatId",
  placement.order_key AS "orderKey",
  placement.story_time AS "storyTime",
  placement.story_time_end AS "storyTimeEnd",
  placement.created_at AS "createdAt",
  placement.updated_at AS "updatedAt",
  placement.retired_at AS "retiredAt",
  plot.title AS "plotTitle",
  plot.stage AS "plotStage",
  plot.summary AS "plotSummary",
  plot.note AS "plotNote",
  plot.created_at AS "plotCreatedAt",
  plot.updated_at AS "plotUpdatedAt",
  plot.retired_at AS "plotRetiredAt",
  plot.revision AS "plotRevision"
FROM plot_placements AS placement
JOIN plot_threads AS plot
  ON plot.work_id = placement.work_id
  AND plot.id = placement.plot_thread_id
`;

const ACTIVE_PLOT_PLACEMENT_ROWS_SQL = `
${PLOT_PLACEMENT_SELECT_SQL}
WHERE placement.work_id = ?
  AND placement.plot_board_id = ?
  AND placement.retired_at IS NULL
`;

const PLOT_PLACEMENT_ROW_BY_ID_SQL = `
${PLOT_PLACEMENT_SELECT_SQL}
WHERE placement.work_id = ? AND placement.id = ?
`;

const PLOT_EVENT_LINK_SELECT_SQL = `
SELECT
  link.id AS "plotEventLinkId",
  link.revision AS "revision",
  link.work_id AS "workId",
  link.plot_thread_id AS "plotBeatId",
  link.event_block_id AS "eventBlockId",
  link.role AS "role",
  link.created_from AS "createdFrom",
  plot.title AS "plotTitle",
  event.title AS "eventTitle",
  plot.retired_at AS "plotRetiredAt",
  event.retired_at AS "eventRetiredAt",
  link.created_at AS "createdAt",
  link.updated_at AS "updatedAt",
  link.retired_at AS "retiredAt"
FROM plot_event_links AS link
JOIN plot_threads AS plot
  ON plot.work_id = link.work_id
  AND plot.id = link.plot_thread_id
JOIN event_blocks AS event
  ON event.work_id = link.work_id
  AND event.id = link.event_block_id
`;

const ACTIVE_PLOT_EVENT_LINK_ROWS_SQL = `
${PLOT_EVENT_LINK_SELECT_SQL}
WHERE link.work_id = ? AND link.retired_at IS NULL
ORDER BY link.created_at ASC, link.id ASC
`;

const PLOT_EVENT_LINK_ROW_BY_ID_SQL = `
${PLOT_EVENT_LINK_SELECT_SQL}
WHERE link.work_id = ? AND link.id = ?
`;

const ACTIVE_PLOT_THREAD_SOURCE_ROWS_SQL = `
SELECT
  pts.id AS "sourceId",
  pts.revision AS "revision",
  pts.work_id AS "workId",
  pts.plot_thread_id AS "plotThreadId",
  pts.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  pts.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  pts.created_at AS "createdAt",
  pts.retired_at AS "retiredAt"
FROM plot_thread_sources AS pts
JOIN plot_threads AS pt
  ON pt.work_id = pts.work_id
  AND pt.id = pts.plot_thread_id
  AND pt.retired_at IS NULL
JOIN anchors AS a
  ON a.work_id = pts.work_id
  AND a.document_id = pts.source_document_id
  AND a.id = pts.source_anchor_id
WHERE pts.work_id = ? AND pts.retired_at IS NULL
ORDER BY pts.created_at ASC, pts.id ASC
`;

const ACTIVE_PLOT_THREAD_SOURCE_BY_PLOT_SQL = `
SELECT
  pts.id AS "sourceId",
  pts.revision AS "revision",
  pts.work_id AS "workId",
  pts.plot_thread_id AS "plotThreadId",
  pts.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  pts.source_anchor_id AS "sourceAnchorId",
  a.exact_quote AS "exactText",
  pts.created_at AS "createdAt",
  pts.retired_at AS "retiredAt"
FROM plot_thread_sources AS pts
JOIN anchors AS a
  ON a.work_id = pts.work_id
  AND a.document_id = pts.source_document_id
  AND a.id = pts.source_anchor_id
WHERE
  pts.work_id = ?
  AND pts.plot_thread_id = ?
  AND pts.retired_at IS NULL
`;

const ACTIVE_FORESHADOW_LINE_ROWS_SQL = `
SELECT
  id AS "lineId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM foreshadow_lines
WHERE work_id = ? AND retired_at IS NULL
ORDER BY updated_at DESC, id ASC
`;

const FORESHADOW_LINE_ROW_BY_ID_SQL = `
SELECT
  id AS "lineId",
  revision AS "revision",
  work_id AS "workId",
  title AS "title",
  note AS "note",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  retired_at AS "retiredAt"
FROM foreshadow_lines
WHERE work_id = ? AND id = ?
`;

const ACTIVE_FORESHADOW_POINT_ROWS_SQL = `
SELECT
  fp.id AS "pointId",
  fp.revision AS "revision",
  fp.work_id AS "workId",
  fp.line_id AS "lineId",
  fp.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  fp.source_anchor_id AS "sourceAnchorId",
  fp.role_id AS "roleId",
  fp.note AS "note",
  a.exact_quote AS "exactText",
  fp.created_at AS "createdAt"
FROM foreshadow_points AS fp
JOIN foreshadow_lines AS fl
  ON fl.work_id = fp.work_id
  AND fl.id = fp.line_id
  AND fl.retired_at IS NULL
JOIN anchors AS a
  ON a.work_id = fp.work_id
  AND a.document_id = fp.source_document_id
  AND a.id = fp.source_anchor_id
WHERE fp.work_id = ? AND fp.retired_at IS NULL
ORDER BY fp.created_at ASC, fp.id ASC
`;

const FORESHADOW_POINT_ROW_BY_ID_SQL = `
SELECT
  fp.id AS "pointId",
  fp.revision AS "revision",
  fp.work_id AS "workId",
  fp.line_id AS "lineId",
  fp.source_document_id AS "sourceDocumentId",
  a.origin_revision_id AS "sourceDocumentRevisionId",
  fp.source_anchor_id AS "sourceAnchorId",
  fp.role_id AS "roleId",
  fp.note AS "note",
  a.exact_quote AS "exactText",
  fp.created_at AS "createdAt"
FROM foreshadow_points AS fp
JOIN anchors AS a
  ON a.work_id = fp.work_id
  AND a.document_id = fp.source_document_id
  AND a.id = fp.source_anchor_id
WHERE fp.work_id = ? AND fp.id = ?
`;

const WORK_SCENE_RULE_REVISION_SQL = `
SELECT srs.revision AS "baseRuleSetRevision"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN scene_rule_sets AS srs
  ON srs.work_id = ws.work_id
  AND srs.id = ws.scene_rule_set_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

const WORK_ACTIVITY_POLICY_ROWS_SQL = `
SELECT
  ws.activity_policy_id AS "activityPolicyId",
  ws.focus_policy_id AS "focusPolicyId"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

const CURRENT_FOCUS_POLICY_ROW_SQL = `
SELECT
  fp.id AS "policyId",
  fp.work_id AS "workId",
  fp.phase_definitions_json AS "phaseDefinitionsJson",
  fp.completion_policy AS "completionPolicy"
FROM works AS w
JOIN work_settings AS ws
  ON ws.work_id = w.id
  AND ws.id = w.settings_id
JOIN focus_policies AS fp
  ON fp.work_id = ws.work_id
  AND fp.id = ws.focus_policy_id
WHERE w.id = ? AND w.retired_at IS NULL
`;

const FOCUS_POLICY_ROW_BY_ID_SQL = `
SELECT
  id AS "policyId",
  work_id AS "workId",
  phase_definitions_json AS "phaseDefinitionsJson",
  completion_policy AS "completionPolicy"
FROM focus_policies
WHERE work_id = ? AND id = ? AND retired_at IS NULL
`;

const WRITING_SESSION_ROWS_SQL = `
SELECT
  id AS "sessionId",
  work_id AS "workId",
  document_id AS "documentId",
  state AS "state",
  started_at AS "startedAt",
  ended_at AS "endedAt",
  start_revision_id AS "startRevisionId",
  end_revision_id AS "endRevisionId",
  COALESCE(note, '') AS "note"
FROM writing_sessions
WHERE work_id = ? AND retired_at IS NULL
ORDER BY started_at DESC, id DESC
`;

const ACTIVITY_INTERVAL_ROWS_SQL = `
SELECT
  session_id AS "sessionId",
  started_at AS "startedAt",
  ended_at AS "endedAt"
FROM activity_intervals
WHERE work_id = ?
ORDER BY started_at ASC, id ASC
`;

const FOCUS_CYCLE_ROWS_SQL = `
SELECT
  id AS "focusCycleId",
  work_id AS "workId",
  session_id AS "sessionId",
  policy_id AS "policyId",
  state AS "state",
  pause_reason AS "pauseReason",
  phase_ref AS "phaseRef",
  target_duration AS "targetDurationMs",
  started_at AS "startedAt",
  deadline_at AS "deadlineAt",
  remaining_at_pause AS "remainingAtPause",
  completed_at AS "completedAt",
  COALESCE(note, '') AS "note"
FROM focus_cycles
WHERE work_id = ? AND retired_at IS NULL
ORDER BY created_at DESC, id DESC
`;

const DOCUMENT_REVISION_ROWS_SQL = `
SELECT
  dr.id AS "revisionId",
  dr.work_id AS "workId",
  dr.document_id AS "documentId",
  dr.parent_revision_id AS "parentRevisionId",
  dr.length AS "length",
  dr.cause AS "cause",
  dr.created_at AS "createdAt",
  dr.durable_at AS "durableAt",
  CASE WHEN m.current_revision_id = dr.id THEN 1 ELSE 0 END AS "isCurrent"
FROM document_revisions AS dr
JOIN manuscripts AS m
  ON m.work_id = dr.work_id
  AND m.document_id = dr.document_id
WHERE dr.work_id = ? AND dr.document_id = ?
ORDER BY dr.created_at DESC, dr.id DESC
`;

const WORK_SNAPSHOT_ROWS_SQL = `
SELECT
  ws.id AS "workSnapshotId",
  ws.work_id AS "workId",
  ws.label AS "label",
  ws.cause AS "cause",
  ws.manifest_hash AS "manifestHash",
  ws.created_at AS "createdAt",
  wsdr.document_id AS "documentId",
  wsdr.document_revision_id AS "documentRevisionId"
FROM work_snapshots AS ws
LEFT JOIN work_snapshot_document_revisions AS wsdr
  ON wsdr.work_id = ws.work_id
  AND wsdr.work_snapshot_id = ws.id
WHERE ws.work_id = ?
ORDER BY ws.created_at DESC, ws.id DESC, wsdr.document_id ASC
`;

const WORK_STRUCTURE_REVISION_ROWS_SQL = `
SELECT 'Anchor' AS "entityKind", id AS "entityId", revision AS "revision"
FROM anchors
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'EventBlock', id, revision
FROM event_blocks
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'EventSource', id, revision
FROM event_sources
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'PlotEventLink', id, revision
FROM plot_event_links
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'RangeGroup', id, revision
FROM range_groups
WHERE work_id = ? AND retired_at IS NULL
UNION ALL
SELECT 'SceneOverride', id, revision
FROM scene_overrides
WHERE work_id = ? AND retired_at IS NULL
ORDER BY "entityKind" ASC, "entityId" ASC
`;

const STUDIO_ROWS_SQL = `
SELECT id
FROM studios
ORDER BY created_at ASC, id ASC
`;

function loadNodeSqlite(): NodeSqliteModule {
  const loaded = process.getBuiltinModule(
    "node:sqlite",
  ) as NodeSqliteModule | undefined;
  if (loaded === undefined) {
    throw new Error("node:sqlite is unavailable");
  }
  return loaded;
}

function createTimeZoneDateKey(
  timezone: string,
): (timestamp: string) => string {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (timestamp) => {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) {
      throw new Error(`Invalid Work records timestamp: ${timestamp}`);
    }
    const parts = new Map(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const year = parts.get("year");
    const month = parts.get("month");
    const day = parts.get("day");
    if (year === undefined || month === undefined || day === undefined) {
      throw new Error("Work records calendar date could not be derived");
    }
    return `${year}-${month}-${day}`;
  };
}

function readRequiredString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readRequiredInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = row[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(`${label}.${field} must be a safe integer`);
  }
  return value;
}

function readNullableIdentity<TEntity extends string>(
  row: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function decodeDurableText(bytes: Uint8Array): string {
  if (bytes.byteLength % 2 !== 0) {
    throw new Error("Durable manuscript bytes must contain complete UTF-16 code units");
  }
  const codeUnits = new Uint16Array(bytes.byteLength / 2);
  for (let index = 0; index < codeUnits.length; index += 1) {
    codeUnits[index] =
      (bytes[index * 2] ?? 0) |
      ((bytes[index * 2 + 1] ?? 0) << 8);
  }
  const chunks: string[] = [];
  const chunkSize = 16_384;
  for (let index = 0; index < codeUnits.length; index += chunkSize) {
    chunks.push(
      String.fromCharCode(
        ...codeUnits.subarray(index, index + chunkSize),
      ),
    );
  }
  return chunks.join("");
}

export function createLocalWorkspaceRevisionBlobProfile(
  findStoredManifestCreatedAt: (blobRef: string) => string | null = () => null,
): RevisionBlobProfile {
  const manifestCreatedAtByBlobRef = new Map<string, string>();
  const blobRefForAddress = (address: {
    readonly checksumIdentity: string;
    readonly checksumValue: string;
  }) =>
    JSON.stringify([
      LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      address.checksumIdentity,
      address.checksumValue,
    ]);
  return Object.freeze({
    codec: Object.freeze({
      identity: LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY,
      encode: encodeDurableText,
      decode: decodeDurableText,
      describe: (content: string) => {
        const bytes = encodeDurableText(content);
        return Object.freeze({
          contentHash: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
            .update(bytes)
            .digest("hex"),
          length: content.length,
        });
      },
    }),
    blobRefForAddress,
    addressForBlobRef: (blobRef) => {
      const decoded = JSON.parse(blobRef) as readonly unknown[];
      if (
        decoded.length !== 3 ||
        decoded[0] !== LOCAL_WORKSPACE_MANUSCRIPT_CODEC_IDENTITY ||
        typeof decoded[1] !== "string" ||
        typeof decoded[2] !== "string"
      ) {
        throw new Error("Stored manuscript blob reference is invalid");
      }
      return Object.freeze({
        checksumIdentity: decoded[1],
        checksumValue: decoded[2],
      });
    },
    metadataForAppend: (input) =>
      Object.freeze({
        kind: "manuscript-revision",
        workId: input.workId,
        documentId: input.documentId,
        revisionId: input.revisionId,
      }),
    temporaryEntryIdentityForAppend: (input) =>
      input.revisionId,
    manifestMetadataForAppend: (input) => {
      const bytes = encodeDurableText(input.content);
      const blobRef = blobRefForAddress({
        checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
        checksumValue: createHash(LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM)
          .update(bytes)
          .digest("hex"),
      });
      let createdAt = manifestCreatedAtByBlobRef.get(blobRef);
      if (createdAt === undefined) {
        createdAt = findStoredManifestCreatedAt(blobRef) ?? input.createdAt;
        manifestCreatedAtByBlobRef.set(blobRef, createdAt);
      }
      return Object.freeze({
        createdAt,
        mediaType: "text/plain; charset=utf-16le",
      });
    },
  });
}

export function createLocalWorkspaceStorageProfiles(
  rootDirectoryPath: string,
) {
  const databasePath = path.join(
    rootDirectoryPath,
    "workspace.sqlite3",
  );
  const ledgerProfile = parsePoc3StorageOpenProfile({
    databasePath,
    checksumIdentity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
    requestedSettings: {
      journalMode: {
        applySql: "PRAGMA journal_mode = WAL",
        verifySql: "PRAGMA journal_mode",
        expectedRows: [{ journal_mode: "wal" }],
      },
      synchronous: {
        applySql: "PRAGMA synchronous = FULL",
        verifySql: "PRAGMA synchronous",
        expectedRows: [{ synchronous: 2 }],
      },
      foreignKeys: {
        applySql: "PRAGMA foreign_keys = ON",
        verifySql: "PRAGMA foreign_keys",
        expectedRows: [{ foreign_keys: 1 }],
      },
    },
    targetSchemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
  });
  const blobStoreProfile = parseNodeImmutableBlobStoreProfile({
    rootDirectoryPath,
    checksum: {
      identity: LOCAL_WORKSPACE_LEDGER_CHECKSUM_IDENTITY,
      algorithm: LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    },
    publishedLayout: {
      directorySegments: ["blobs", "published"],
      shardWidths: [2, 2],
      fileNamePrefix: "",
      fileNameSuffix: ".blob",
    },
    temporaryLayout: {
      directorySegments: ["blobs", "temporary"],
    },
  });
  return Object.freeze({
    databasePath,
    ledgerProfile,
    blobStoreProfile,
  });
}

function createRecordMeta(now: string) {
  return Object.freeze({
    schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });
}

function createAnchorLedgerRecord(
  workId: EntityId<"Work">,
  anchor: Anchor,
): Poc3AnchorRecord {
  return Object.freeze({
    kind: "anchor",
    ...anchor.meta,
    workId,
    documentId: anchor.documentId,
    originRevisionId: anchor.originRevisionId,
    resolvedRevisionId: anchor.resolvedRevisionId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    exactQuote: anchor.exactQuote,
    prefixContext: anchor.prefixContext,
    suffixContext: anchor.suffixContext,
    quoteHash: anchor.quoteHash,
    contextHash: anchor.contextHash,
    ...(anchor.lineageRef === undefined
      ? {}
      : { lineageRef: anchor.lineageRef }),
    status: anchor.status,
    resolutionEvidenceJson: JSON.stringify(
      anchor.resolutionEvidence,
    ),
  });
}

function insertAnchorLedgerRecord(
  database: NodeSqliteDatabase,
  record: Poc3AnchorRecord,
): void {
  database.prepare(`
    INSERT INTO anchors (
      id, schema_version, revision, created_at, updated_at, retired_at,
      work_id, document_id, origin_revision_id, resolved_revision_id,
      start_offset, end_offset, exact_quote, prefix_context, suffix_context,
      quote_hash, context_hash, lineage_ref, status, resolution_evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.schemaVersion,
    record.revision,
    record.createdAt,
    record.updatedAt,
    record.retiredAt ?? null,
    record.workId,
    record.documentId,
    record.originRevisionId,
    record.resolvedRevisionId,
    record.startOffset,
    record.endOffset,
    record.exactQuote,
    record.prefixContext,
    record.suffixContext,
    record.quoteHash,
    record.contextHash,
    record.lineageRef ?? null,
    record.status,
    record.resolutionEvidenceJson,
  );
}

function createInitialRecords(input: {
  readonly includeStudio: boolean;
  readonly studioId: string;
  readonly studioDisplayName: string;
  readonly locale: string;
  readonly timezone: string;
  readonly command: CreateFirstWorkCommand;
  readonly now: string;
  readonly workId: string;
  readonly settingsId: string;
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
  readonly sceneRuleSetId: string;
  readonly plotBoardId: string;
  readonly plotLaneId: string;
  readonly documentId: string;
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly defaults: LocalWorkspaceDefaults;
  readonly includeBlobManifest: boolean;
}): readonly Poc3LedgerRecord[] {
  const meta = createRecordMeta(input.now);
  return Object.freeze([
    ...(input.includeStudio
      ? [
          {
            kind: "studio" as const,
            id: input.studioId,
            displayName: input.studioDisplayName,
            locale: input.locale,
            timezone: input.timezone,
            settingsRevision: 1,
            createdAt: input.now,
          },
        ]
      : []),
    {
      kind: "work",
      ...meta,
      id: input.workId,
      studioId: input.studioId,
      title: input.command.title,
      orderKey: JSON.stringify([input.now, input.workId]),
      settingsId: input.settingsId,
    },
    {
      kind: "plotBoard",
      ...meta,
      id: input.plotBoardId,
      workId: input.workId,
      title: input.defaults.plotBoard.defaultBoardTitle,
      mode: "sequence",
    },
    {
      kind: "plotLane",
      ...meta,
      id: input.plotLaneId,
      workId: input.workId,
      plotBoardId: input.plotBoardId,
      title: input.defaults.plotBoard.defaultLaneTitle,
      laneKind: "default",
      orderKey: "0/1",
    },
    {
      kind: "activityPolicy",
      ...meta,
      id: input.activityPolicyId,
      workId: input.workId,
      ...input.defaults.activityPolicy,
    },
    {
      kind: "focusPolicy",
      ...meta,
      id: input.focusPolicyId,
      workId: input.workId,
      ...input.defaults.focusPolicy,
    },
    {
      kind: "sceneRuleSet",
      ...meta,
      id: input.sceneRuleSetId,
      workId: input.workId,
      displayName: input.defaults.sceneRuleSet.displayName,
      boundaryRulesJson: JSON.stringify(
        input.defaults.sceneRuleSet.boundaryRules,
      ),
      normalizationPolicy: input.defaults.sceneRuleSet.normalizationPolicy,
      enabled: input.defaults.sceneRuleSet.enabled,
    },
    {
      kind: "workSettings",
      id: input.settingsId,
      workId: input.workId,
      sceneRuleSetId: input.sceneRuleSetId,
      activityPolicyId: input.activityPolicyId,
      focusPolicyId: input.focusPolicyId,
      railPreferencesJson: input.defaults.railPreferencesJson,
      revision: 1,
    },
    ...(input.includeBlobManifest
      ? [{
          kind: "blobManifest" as const,
          blobRef: input.blobRef,
          checksumIdentity: input.checksumIdentity,
          checksumValue: input.checksumValue,
          byteLength: input.byteLength,
          createdAt: input.now,
          mediaType: "text/plain; charset=utf-16le",
        }]
      : []),
    {
      kind: "document",
      ...meta,
      id: input.documentId,
      workId: input.workId,
      title: input.command.firstDocumentTitle,
      orderKey: JSON.stringify([input.now, input.documentId]),
      manuscriptId: input.manuscriptId,
    },
    {
      kind: "documentRevision",
      id: input.revisionId,
      workId: input.workId,
      documentId: input.documentId,
      contentRef: input.blobRef,
      contentHash: input.contentHash,
      length: 0,
      cause: "create-first-document",
      createdAt: input.now,
      durableAt: input.now,
    },
    {
      kind: "manuscript",
      id: input.manuscriptId,
      workId: input.workId,
      documentId: input.documentId,
      currentRevisionId: input.revisionId,
      durableRevisionId: input.revisionId,
      updatedAt: input.now,
    },
  ]);
}

function createDocumentRecords(input: {
  readonly now: string;
  readonly workId: string;
  readonly title: string;
  readonly documentId: string;
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly blobRef: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly includeBlobManifest: boolean;
}): readonly Poc3LedgerRecord[] {
  const meta = createRecordMeta(input.now);
  return Object.freeze([
    ...(input.includeBlobManifest
      ? [{
          kind: "blobManifest" as const,
          blobRef: input.blobRef,
          checksumIdentity: input.checksumIdentity,
          checksumValue: input.checksumValue,
          byteLength: input.byteLength,
          createdAt: input.now,
          mediaType: "text/plain; charset=utf-16le",
        }]
      : []),
    {
      kind: "document",
      ...meta,
      id: input.documentId,
      workId: input.workId,
      title: input.title,
      orderKey: JSON.stringify([input.now, input.documentId]),
      manuscriptId: input.manuscriptId,
    },
    {
      kind: "documentRevision",
      id: input.revisionId,
      workId: input.workId,
      documentId: input.documentId,
      contentRef: input.blobRef,
      contentHash: input.contentHash,
      length: 0,
      cause: "create-document",
      createdAt: input.now,
      durableAt: input.now,
    },
    {
      kind: "manuscript",
      id: input.manuscriptId,
      workId: input.workId,
      documentId: input.documentId,
      currentRevisionId: input.revisionId,
      durableRevisionId: input.revisionId,
      updatedAt: input.now,
    },
  ]);
}

function shouldInsertBlobManifest(
  database: NodeSqliteDatabase,
  input: {
    readonly blobRef: string;
    readonly checksumIdentity: string;
    readonly checksumValue: string;
    readonly byteLength: number;
  },
): boolean {
  const rows = database
    .prepare(`
      SELECT
        checksum_identity AS "checksumIdentity",
        checksum_value AS "checksumValue",
        byte_length AS "byteLength"
      FROM blob_manifests
      WHERE blob_ref = ?
    `)
    .all(input.blobRef);
  if (rows.length === 0) {
    return true;
  }
  if (rows.length !== 1) {
    throw new Error(`Blob manifest identity is ambiguous: ${input.blobRef}`);
  }
  const row = rows[0] ?? {};
  if (
    row.checksumIdentity !== input.checksumIdentity ||
    row.checksumValue !== input.checksumValue ||
    row.byteLength !== input.byteLength
  ) {
    throw new Error(`Blob manifest content conflict: ${input.blobRef}`);
  }
  return false;
}

class DefaultLocalWorkspaceRuntime
  implements LocalWorkspaceRuntime
{
  readonly #database: NodeSqliteDatabase;
  readonly #ledger: Awaited<
    ReturnType<typeof openNodeSqliteLedger>
  >;
  readonly #revisionStore: RevisionStore;
  readonly #episodeRangeMoveStore: EpisodeRangeMoveStore;
  readonly #blobStore: Awaited<
    ReturnType<typeof createNodeImmutableBlobStore>
  >;
  readonly #blobProfile: RevisionBlobProfile;
  readonly #backupService: LocalWorkspaceBackupService;
  readonly #options: LocalWorkspaceRuntimeOptions;
  readonly #documentTargets = new Map<
    EntityId<"Document">,
    MutableDocumentSaveTarget
  >();
  readonly #acceptedByBatchId = new Map<
    EntityId<"ChangeBatch">,
    AcceptedBatch
  >();
  readonly #publishingAssistantCandidates = new Map<
    string,
    Readonly<{
      candidate: PublishingAssistantRecordCandidate;
      receipt: AssistantConnectorExecutionReceipt;
    }>
  >();
  #documentProfile: ManuscriptDocumentProfile;
  #catalog: WorkspaceCatalogProjection;
  #resumeProjection: ManuscriptResumeCheckpointProjection;
  #savePending: Promise<void> = Promise.resolve();
  #createPending: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(input: {
    readonly database: NodeSqliteDatabase;
    readonly ledger: Awaited<
      ReturnType<typeof openNodeSqliteLedger>
    >;
    readonly revisionStore: RevisionStore;
    readonly episodeRangeMoveStore: EpisodeRangeMoveStore;
    readonly blobStore: Awaited<
      ReturnType<typeof createNodeImmutableBlobStore>
    >;
    readonly blobProfile: RevisionBlobProfile;
    readonly backupService: LocalWorkspaceBackupService;
    readonly options: LocalWorkspaceRuntimeOptions;
    readonly documentProfile: ManuscriptDocumentProfile;
    readonly catalog: WorkspaceCatalogProjection;
    readonly resumeProjection: ManuscriptResumeCheckpointProjection;
    readonly documentTargets:
      readonly MutableDocumentSaveTarget[];
  }) {
    this.#database = input.database;
    this.#ledger = input.ledger;
    this.#revisionStore = input.revisionStore;
    this.#episodeRangeMoveStore = input.episodeRangeMoveStore;
    this.#blobStore = input.blobStore;
    this.#blobProfile = input.blobProfile;
    this.#backupService = input.backupService;
    this.#options = input.options;
    this.#documentProfile = input.documentProfile;
    this.#catalog = input.catalog;
    this.#resumeProjection = input.resumeProjection;
    for (const target of input.documentTargets) {
      this.#documentTargets.set(target.documentId, target);
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error("Local workspace runtime is closed");
    }
  }

  #getDocumentCompletionSerially(
    command: GetDocumentCompletionCommand,
  ): DocumentCompletionProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const rows = this.#database.prepare(`
      SELECT
        revision,
        completed_at AS "completedAt",
        completed_date AS "completedDate",
        completed_time_zone AS "completedTimeZone",
        completed_document_revision_id AS "completedDocumentRevisionId",
        updated_at AS "updatedAt"
      FROM document_completion_status
      WHERE work_id = ? AND document_id = ?
    `).all(command.workId, command.documentId);
    if (rows.length > 1) {
      throw new Error(`Document completion identity is ambiguous: ${command.documentId}`);
    }
    if (rows.length === 0) {
      return parseDocumentCompletionProjection({
        schemaVersion: 1,
        workId: command.workId,
        documentId: command.documentId,
        revision: 0,
        completedAt: null,
        completedDate: null,
        completedTimeZone: null,
        completedDocumentRevisionId: null,
        state: "incomplete",
        updatedAt: null,
      });
    }
    const row = rows[0] ?? {};
    const completedDocumentRevisionId = readNullableIdentity<"DocumentRevision">(
      row,
      "completedDocumentRevisionId",
      "Document completion row",
    );
    return parseDocumentCompletionProjection({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      revision: readRequiredInteger(row, "revision", "Document completion row"),
      completedAt: readNullableString(row, "completedAt", "Document completion row"),
      completedDate: readNullableString(row, "completedDate", "Document completion row"),
      completedTimeZone: readNullableString(
        row,
        "completedTimeZone",
        "Document completion row",
      ),
      completedDocumentRevisionId,
      state: completedDocumentRevisionId === null
        ? "incomplete"
        : completedDocumentRevisionId === target.currentRevisionId
          ? "current"
          : "edited-after-completion",
      updatedAt: readRequiredString(row, "updatedAt", "Document completion row"),
    });
  }

  #completeDocumentSerially(
    command: CompleteDocumentCommand,
  ): DocumentCompletionProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    let completion: DocumentCompletionProjection;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const ownershipRows = this.#database.prepare(`
        SELECT m.current_revision_id AS "currentRevisionId"
        FROM documents AS d
        JOIN works AS w
          ON w.id = d.work_id
        JOIN manuscripts AS m
          ON m.work_id = d.work_id
          AND m.document_id = d.id
          AND m.id = d.manuscript_id
        WHERE
          d.work_id = ?
          AND d.id = ?
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
      `).all(command.workId, command.documentId);
      if (ownershipRows.length !== 1) {
        throw new Error(
          `Document is unavailable for completion: ${command.documentId}`,
        );
      }
      const durableRevisionId = entityId<"DocumentRevision">(
        readRequiredString(
          ownershipRows[0] ?? {},
          "currentRevisionId",
          "Document completion ownership row",
        ),
      );
      if (
        durableRevisionId !== command.expectedDocumentRevisionId ||
        target.currentRevisionId !== command.expectedDocumentRevisionId
      ) {
        throw new Error(
          `Document revision conflict: expected ${command.expectedDocumentRevisionId}, current ${durableRevisionId}`,
        );
      }
      const current = this.#getDocumentCompletionSerially(command);
      if (current.revision !== command.expectedCompletionRevision) {
        throw new Error(
          `Document completion revision conflict: expected ${command.expectedCompletionRevision}, current ${current.revision}`,
        );
      }
      if (current.completedDocumentRevisionId === durableRevisionId) {
        completion = current;
      } else {
        const updatedAt = this.#options.documentCompletionClock?.now() ??
          new Date().toISOString();
        const completedDate = deriveDocumentCompletionDate(
          updatedAt,
          this.#options.timezone,
        );
        if (current.revision === 0) {
          this.#database.prepare(`
            INSERT INTO document_completion_status (
              work_id,
              document_id,
              schema_version,
              revision,
              completed_at,
              completed_date,
              completed_time_zone,
              completed_document_revision_id,
              updated_at
            ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?)
          `).run(
            command.workId,
            command.documentId,
            updatedAt,
            completedDate,
            this.#options.timezone,
            durableRevisionId,
            updatedAt,
          );
        } else {
          const updated = this.#database.prepare(`
            UPDATE document_completion_status
            SET
              revision = revision + 1,
              completed_at = ?,
              completed_date = ?,
              completed_time_zone = ?,
              completed_document_revision_id = ?,
              updated_at = ?
            WHERE work_id = ? AND document_id = ? AND revision = ?
          `).run(
            updatedAt,
            completedDate,
            this.#options.timezone,
            durableRevisionId,
            updatedAt,
            command.workId,
            command.documentId,
            current.revision,
          );
          if (Number(updated.changes) !== 1) {
            throw new Error(`Document completion changed: ${command.documentId}`);
          }
        }
        completion = this.#getDocumentCompletionSerially(command);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
    this.#updateCatalogDocumentCompletion(target, completion);
    return completion;
  }

  #clearDocumentCompletionSerially(
    command: ClearDocumentCompletionCommand,
  ): DocumentCompletionProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    let completion: DocumentCompletionProjection;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.#getDocumentCompletionSerially(command);
      if (current.revision !== command.expectedCompletionRevision) {
        throw new Error(
          `Document completion revision conflict: expected ${command.expectedCompletionRevision}, current ${current.revision}`,
        );
      }
      if (current.completedAt === null) {
        completion = current;
      } else {
        const updatedAt = this.#options.documentCompletionClock?.now() ??
          new Date().toISOString();
        const updated = this.#database.prepare(`
          UPDATE document_completion_status
          SET
            revision = revision + 1,
            completed_at = NULL,
            completed_date = NULL,
            completed_time_zone = NULL,
            completed_document_revision_id = NULL,
            updated_at = ?
          WHERE work_id = ? AND document_id = ? AND revision = ?
        `).run(
          updatedAt,
          command.workId,
          command.documentId,
          current.revision,
        );
        if (Number(updated.changes) !== 1) {
          throw new Error(`Document completion changed: ${command.documentId}`);
        }
        completion = this.#getDocumentCompletionSerially(command);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    }
    this.#updateCatalogDocumentCompletion(target, completion);
    return completion;
  }

  #updateCatalogDocumentCompletion(
    target: MutableDocumentSaveTarget,
    completion = this.#getDocumentCompletionSerially({
      schemaVersion: 1,
      workId: target.workId,
      documentId: target.documentId,
    }),
  ): void {
    this.#catalog = parseWorkspaceCatalogProjection({
      ...this.#catalog,
      works: this.#catalog.works.map((work) =>
        work.workId === target.workId
          ? {
              ...work,
              documents: work.documents.map((document) =>
                document.documentId === target.documentId
                  ? {
                      ...document,
                      currentRevisionId: target.currentRevisionId,
                      completion,
                    }
                  : document
              ),
            }
          : work
      ),
    });
  }

  #getPreflightProfile(): ManuscriptPreflightProfile {
    const profile = this.#options.preflightProfile;
    if (profile === undefined) {
      throw new Error("Manuscript preflight profile is not configured");
    }
    return profile;
  }

  #getFragmentProfile(): FragmentShelfProfile {
    const profile = this.#options.fragmentProfile;
    if (profile === undefined) {
      throw new Error("Fragment shelf profile is not configured");
    }
    return parseFragmentShelfProfile(profile);
  }

  #getForeshadowPointProfile(): ForeshadowPointProfile {
    const profile = this.#options.foreshadowPointProfile;
    if (profile === undefined) {
      throw new Error("Foreshadow point profile is not configured");
    }
    return parseForeshadowPointProfile(profile);
  }

  #getAssistantDestinationProfile(): AssistantDestinationProfile {
    const profile = this.#options.assistantDestinationProfile;
    if (profile === undefined) {
      throw new Error("Assistant destination profile is not configured");
    }
    return parseAssistantDestinationProfile(profile);
  }

  getWorkspaceCatalog(): WorkspaceCatalogProjection {
    this.#assertOpen();
    return this.#catalog;
  }

  getDocumentCompletion(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#assertOpen();
    const command = parseGetDocumentCompletionCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getDocumentCompletionSerially(command)
    );
  }

  completeDocument(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#assertOpen();
    const command = parseCompleteDocumentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#completeDocumentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  clearDocumentCompletion(
    value: unknown,
  ): Promise<DocumentCompletionProjection> {
    this.#assertOpen();
    const command = parseClearDocumentCompletionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#clearDocumentCompletionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkFavorites(): WorkFavoritesProjection {
    this.#assertOpen();
    return this.#readWorkFavorites();
  }

  setWorkFavorite(value: unknown): Promise<WorkFavoritesProjection> {
    this.#assertOpen();
    const command = parseSetWorkFavoriteCommand(value);
    const execution = this.#createPending.then(() =>
      this.#setWorkFavoriteSerially(command),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkCovers(): WorkCoversProjection {
    this.#assertOpen();
    return this.#readWorkCovers();
  }

  saveWorkCover(value: unknown): Promise<WorkCoverProjection> {
    this.#assertOpen();
    const command = parseSaveWorkCoverCommand(value);
    const execution = this.#createPending.then(() =>
      this.#saveWorkCoverSerially(command),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  activateWorkspaceLocation(
    value: unknown,
  ): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseActivateWorkspaceLocationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      await this.#reload(command);
      return this.#catalog;
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  renameWork(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRenameWorkCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#renameWorkSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  renameDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRenameDocumentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#renameDocumentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireWork(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRetireWorkCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireWorkSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRetireDocumentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireDocumentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireAllDocuments(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRetireAllDocumentsCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireAllDocumentsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  moveDocument(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseMoveDocumentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#moveDocumentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseCreateDocumentFolderCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createDocumentFolderSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  renameDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRenameDocumentFolderCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#renameDocumentFolderSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  placeDocumentInFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parsePlaceDocumentInFolderCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#placeDocumentInFolderSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection> {
    this.#assertOpen();
    const command = parseRetireDocumentFolderCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireDocumentFolderSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getManuscriptDocumentProfile(): ManuscriptDocumentProfile {
    this.#assertOpen();
    return this.#documentProfile;
  }

  getContinuousReadingProgress(
    value: unknown,
  ): Promise<WorkContinuousReadingProgressProjection> {
    this.#assertOpen();
    const command = parseGetContinuousReadingProgressCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getContinuousReadingProgressSerially(command.workId),
    );
  }

  saveContinuousReadingProgress(
    value: unknown,
  ): Promise<WorkContinuousReadingProgressProjection> {
    this.#assertOpen();
    const command = parseSaveContinuousReadingProgressCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveContinuousReadingProgressSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getManuscriptPersistenceProfile(): ManuscriptPersistenceProfile | null {
    this.#assertOpen();
    if (this.#documentTargets.size === 0) {
      return null;
    }
    return parseManuscriptPersistenceProfile({
      schemaVersion: 1,
      batching: this.#options.batchingPolicy,
      documentSequences: [...this.#documentTargets.values()].map(
        (target) => ({
          documentId: target.documentId,
          nextSequence: target.nextSequence,
        }),
      ),
    });
  }

  getManuscriptStartupRecovery(): StartupRecoveryProjection {
    this.#assertOpen();
    return Object.freeze({
      schemaVersion: 1,
      status: "clean",
      issues: Object.freeze([]),
    });
  }

  getManuscriptResumeCheckpoint(): ManuscriptResumeCheckpointProjection {
    this.#assertOpen();
    return this.#resumeProjection;
  }

  captureWorkspaceResume(
    value: unknown,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    this.#assertOpen();
    const command = parseCaptureWorkspaceResumeCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#captureWorkspaceResumeSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createEventBlock(value: unknown): Promise<EventBlockProjection> {
    this.#assertOpen();
    const command = parseCreateEventBlockCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createEventBlockSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createAnchorlessEvent(value: unknown): Promise<EventBlockProjection> {
    this.#assertOpen();
    const command = parseCreateAnchorlessEventCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createAnchorlessEventSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  moveEventBlock(value: unknown): Promise<EventBlockListProjection> {
    this.#assertOpen();
    const command = parseMoveEventBlockCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#moveEventBlockSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  linkEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#assertOpen();
    const command = parseLinkEventSourceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#linkEventSourceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  replaceEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#assertOpen();
    const command = parseReplaceEventSourceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#replaceEventSourceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireEventSource(value: unknown): Promise<EventSourceProjection> {
    this.#assertOpen();
    const command = parseRetireEventSourceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireEventSourceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listEventBlocks(value: unknown): Promise<EventBlockListProjection> {
    this.#assertOpen();
    const command = parseListEventBlocksCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listEventBlocksSerially(command),
    );
  }

  listEventRail(value: unknown): Promise<EventRailProjection> {
    this.#assertOpen();
    const command = parseListEventRailCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listEventRailSerially(command),
    );
  }

  createSceneOverride(value: unknown): Promise<SceneOverrideProjection> {
    this.#assertOpen();
    const command = parseCreateSceneOverrideCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createSceneOverrideSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection> {
    this.#assertOpen();
    const command = parseListSceneOverridesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneOverridesSerially(command),
    );
  }

  listSceneProjection(value: unknown): Promise<SceneProjectionList> {
    this.#assertOpen();
    const command = parseListSceneProjectionCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneProjectionSerially(command),
    );
  }

  updateSceneRuleSet(value: unknown): Promise<SceneProjectionList> {
    this.#assertOpen();
    const command = parseUpdateSceneRuleSetCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateSceneRuleSetSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  setSceneEventOverride(value: unknown): Promise<SceneProjectionList> {
    this.#assertOpen();
    const command = parseSetSceneEventOverrideCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#setSceneEventOverrideSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  captureFragment(value: unknown): Promise<FragmentProjection> {
    this.#assertOpen();
    const command = parseCaptureFragmentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#captureFragmentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listFragments(value: unknown): Promise<FragmentListProjection> {
    this.#assertOpen();
    const command = parseListFragmentsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listFragmentsSerially(command),
    );
  }

  updateFragment(value: unknown): Promise<FragmentProjection> {
    this.#assertOpen();
    const command = parseUpdateFragmentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateFragmentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  recordFragmentUse(value: unknown): Promise<FragmentProjection> {
    this.#assertOpen();
    const command = parseRecordFragmentUseCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#recordFragmentUseSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireFragment(value: unknown): Promise<FragmentProjection> {
    this.#assertOpen();
    const command = parseRetireFragmentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireFragmentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createCharacter(value: unknown): Promise<CharacterProjection> {
    this.#assertOpen();
    const command = parseCreateCharacterCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createCharacterSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listCharacters(value: unknown): Promise<CharacterListProjection> {
    this.#assertOpen();
    const command = parseListCharactersCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listCharactersSerially(command),
    );
  }

  updateCharacter(value: unknown): Promise<CharacterProjection> {
    this.#assertOpen();
    const command = parseUpdateCharacterCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateCharacterSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  addCharacterEvidence(value: unknown): Promise<CharacterProjection> {
    this.#assertOpen();
    const command = parseAddCharacterEvidenceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#addCharacterEvidenceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireCharacter(value: unknown): Promise<CharacterProjection> {
    this.#assertOpen();
    const command = parseRetireCharacterCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireCharacterSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#assertOpen();
    const command = parseCreateCharacterRelationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createCharacterRelationSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listCharacterRelations(value: unknown): Promise<CharacterRelationListProjection> {
    this.#assertOpen();
    const command = parseListCharacterRelationsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listCharacterRelationsSerially(command),
    );
  }

  updateCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#assertOpen();
    const command = parseUpdateCharacterRelationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateCharacterRelationSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  retireCharacterRelation(value: unknown): Promise<CharacterRelationProjection> {
    this.#assertOpen();
    const command = parseRetireCharacterRelationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireCharacterRelationSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  createLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#assertOpen();
    const command = parseCreateLoreEntryCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createLoreEntrySerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listLoreEntries(value: unknown): Promise<LoreEntryListProjection> {
    this.#assertOpen();
    const command = parseListLoreEntriesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listLoreEntriesSerially(command),
    );
  }

  updateLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#assertOpen();
    const command = parseUpdateLoreEntryCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateLoreEntrySerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  addLoreEntryEvidence(value: unknown): Promise<LoreEntryProjection> {
    this.#assertOpen();
    const command = parseAddLoreEntryEvidenceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#addLoreEntryEvidenceSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  retireLoreEntry(value: unknown): Promise<LoreEntryProjection> {
    this.#assertOpen();
    const command = parseRetireLoreEntryCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireLoreEntrySerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  linkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection> {
    this.#assertOpen();
    const command = parseLinkLoreForeshadowCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#linkLoreForeshadowSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listLoreForeshadowLinks(
    value: unknown,
  ): Promise<LoreForeshadowLinkListProjection> {
    this.#assertOpen();
    const command = parseListLoreForeshadowLinksCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listLoreForeshadowLinksSerially(command),
    );
  }

  unlinkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection> {
    this.#assertOpen();
    const command = parseUnlinkLoreForeshadowCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#unlinkLoreForeshadowSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  createLoreCandidate(value: unknown): Promise<LoreCandidateProjection> {
    this.#assertOpen();
    const command = parseCreateLoreCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createLoreCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listLoreCandidates(value: unknown): Promise<LoreCandidateListProjection> {
    this.#assertOpen();
    const command = parseListLoreCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listLoreCandidatesSerially(command),
    );
  }

  approveLoreCandidate(value: unknown): Promise<LoreCandidateApprovalResult> {
    this.#assertOpen();
    const command = parseReviewLoreCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#approveLoreCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  rejectLoreCandidate(value: unknown): Promise<LoreCandidateProjection> {
    this.#assertOpen();
    const command = parseReviewLoreCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#rejectLoreCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  createPublishingPartner(
    value: unknown,
  ): Promise<PublishingPartnerProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingPartnerCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingPartnerSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingPartners(
    value: unknown,
  ): Promise<PublishingPartnerListProjection> {
    this.#assertOpen();
    parseListPublishingPartnersCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingPartnersSerially(),
    );
  }

  updatePublishingPartner(
    value: unknown,
  ): Promise<PublishingPartnerProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingPartnerCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingPartnerSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingSubmission(
    value: unknown,
  ): Promise<PublishingSubmissionProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingSubmissionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingSubmissionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingSubmissions(
    value: unknown,
  ): Promise<PublishingSubmissionListProjection> {
    this.#assertOpen();
    const command = parseListPublishingSubmissionsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingSubmissionsSerially(command),
    );
  }

  updatePublishingSubmission(
    value: unknown,
  ): Promise<PublishingSubmissionProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingSubmissionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingSubmissionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingContract(
    value: unknown,
  ): Promise<PublishingContractProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingContractCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingContractSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingContracts(
    value: unknown,
  ): Promise<PublishingContractListProjection> {
    this.#assertOpen();
    const command = parseListPublishingContractsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingContractsSerially(command),
    );
  }

  updatePublishingContract(
    value: unknown,
  ): Promise<PublishingContractProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingContractCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingContractSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingPublication(
    value: unknown,
  ): Promise<PublishingPublicationProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingPublicationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingPublicationSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingPublications(
    value: unknown,
  ): Promise<PublishingPublicationListProjection> {
    this.#assertOpen();
    const command = parseListPublishingPublicationsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingPublicationsSerially(command),
    );
  }

  updatePublishingPublication(
    value: unknown,
  ): Promise<PublishingPublicationProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingPublicationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingPublicationSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingSettlement(
    value: unknown,
  ): Promise<PublishingSettlementProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingSettlementCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingSettlementSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingSettlements(
    value: unknown,
  ): Promise<PublishingSettlementListProjection> {
    this.#assertOpen();
    const command = parseListPublishingSettlementsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingSettlementsSerially(command),
    );
  }

  updatePublishingSettlement(
    value: unknown,
  ): Promise<PublishingSettlementProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingSettlementCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingSettlementSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingPayment(
    value: unknown,
  ): Promise<PublishingPaymentProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingPaymentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingPaymentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingPayments(
    value: unknown,
  ): Promise<PublishingPaymentListProjection> {
    this.#assertOpen();
    const command = parseListPublishingPaymentsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPublishingPaymentsSerially(command),
    );
  }

  updatePublishingPayment(
    value: unknown,
  ): Promise<PublishingPaymentProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingPaymentCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingPaymentSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPublishingSource(
    value: unknown,
  ): Promise<PublishingSourceProjection> {
    this.#assertOpen();
    const command = parseCreatePublishingSourceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPublishingSourceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPublishingSources(
    value: unknown,
  ): Promise<PublishingSourceListProjection> {
    this.#assertOpen();
    parseListPublishingSourcesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
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
    this.#assertOpen();
    const command = parsePreviewPublishingResearchCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#previewPublishingResearchSerially(command),
    );
  }

  approvePublishingResearch(
    value: unknown,
  ): Promise<PublishingResearchApprovalResult> {
    this.#assertOpen();
    const command = parseApprovePublishingResearchCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#approvePublishingResearchSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runPublishingAssistant(
    value: unknown,
  ): Promise<PublishingAssistantResult> {
    this.#assertOpen();
    const command = parseRunPublishingAssistantCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runPublishingAssistantSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  approvePublishingAssistantCandidate(
    value: unknown,
  ): Promise<PublishingAssistantApprovalResult> {
    this.#assertOpen();
    const command = parseApprovePublishingAssistantCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#approvePublishingAssistantCandidateSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  setPublishingEvidenceLinks(
    value: unknown,
  ): Promise<PublishingEvidenceLinksProjection> {
    this.#assertOpen();
    const command = parseSetPublishingEvidenceLinksCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#setPublishingEvidenceLinksSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  applyPublishingPartnerCsvImport(
    value: unknown,
  ): Promise<PublishingPartnerCsvImportResult> {
    this.#assertOpen();
    const command = parseApplyPublishingPartnerCsvImportCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#applyPublishingPartnerCsvImportSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  applyPublishingSubmissionCsvImport(
    value: unknown,
  ): Promise<PublishingSubmissionCsvImportResult> {
    this.#assertOpen();
    const command = parseApplyPublishingSubmissionCsvImportCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#applyPublishingSubmissionCsvImportSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  recordPublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateProjection> {
    this.#assertOpen();
    const command = parseRecordPublishingMailCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#recordPublishingMailCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listPublishingMailCandidates(
    value: unknown,
  ): Promise<PublishingMailCandidateListProjection> {
    this.#assertOpen();
    parseListPublishingMailCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
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
    this.#assertOpen();
    const command = parseLinkPublishingMailCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#linkPublishingMailCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  updatePublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateProjection> {
    this.#assertOpen();
    const command = parseUpdatePublishingMailCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePublishingMailCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  reviewPublishingMailCandidate(
    value: unknown,
  ): Promise<PublishingMailCandidateReviewResult> {
    this.#assertOpen();
    const command = parseReviewPublishingMailCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#reviewPublishingMailCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  createPlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#assertOpen();
    const command = parseCreatePlotThreadCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPlotThreadSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPlotThreads(value: unknown): Promise<PlotThreadListProjection> {
    this.#assertOpen();
    const command = parseListPlotThreadsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPlotThreadsSerially(command),
    );
  }

  getDefaultPlotBoard(value: unknown): Promise<PlotBoardProjection> {
    this.#assertOpen();
    const command = parseGetDefaultPlotBoardCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getDefaultPlotBoardSerially(command),
    );
  }

  movePlotPlacement(value: unknown): Promise<PlotBoardProjection> {
    this.#assertOpen();
    const command = parseMovePlotPlacementCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#movePlotPlacementSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  setPlotPlacementStoryTime(value: unknown): Promise<PlotBoardProjection> {
    this.#assertOpen();
    const command = parseSetPlotPlacementStoryTimeCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#setPlotPlacementStoryTimeSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  updatePlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#assertOpen();
    const command = parseUpdatePlotThreadCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePlotThreadSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retirePlotThread(value: unknown): Promise<PlotThreadProjection> {
    this.#assertOpen();
    const command = parseRetirePlotThreadCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retirePlotThreadSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createPlotFromEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#assertOpen();
    const command = parseCreatePlotFromEventCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createPlotFromEventSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  createEventFromPlot(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#assertOpen();
    const command = parseCreateEventFromPlotCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createEventFromPlotSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  linkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#assertOpen();
    const command = parseLinkPlotEventCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#linkPlotEventSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  unlinkPlotEvent(value: unknown): Promise<PlotEventLinkMutationProjection> {
    this.#assertOpen();
    const command = parseUnlinkPlotEventCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#unlinkPlotEventSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listPlotEventLinks(value: unknown): Promise<PlotEventLinkListProjection> {
    this.#assertOpen();
    const command = parseListPlotEventLinksCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPlotEventLinksSerially(command),
    );
  }

  linkPlotThreadSource(value: unknown): Promise<PlotThreadSourceProjection> {
    this.#assertOpen();
    const command = parseLinkPlotThreadSourceCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#linkPlotThreadSourceSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listPlotThreadSources(
    value: unknown,
  ): Promise<PlotThreadSourceListProjection> {
    this.#assertOpen();
    const command = parseListPlotThreadSourcesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listPlotThreadSourcesSerially(command),
    );
  }

  createForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#assertOpen();
    const command = parseCreateForeshadowLineCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createForeshadowLineSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listForeshadowLines(value: unknown): Promise<ForeshadowLineListProjection> {
    this.#assertOpen();
    const command = parseListForeshadowLinesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listForeshadowLinesSerially(command),
    );
  }

  updateForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#assertOpen();
    const command = parseUpdateForeshadowLineCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateForeshadowLineSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireForeshadowLine(value: unknown): Promise<ForeshadowLineProjection> {
    this.#assertOpen();
    const command = parseRetireForeshadowLineCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#retireForeshadowLineSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createForeshadowPoint(value: unknown): Promise<ForeshadowPointProjection> {
    this.#assertOpen();
    const command = parseCreateForeshadowPointCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createForeshadowPointSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listForeshadowPoints(value: unknown): Promise<ForeshadowPointListProjection> {
    this.#assertOpen();
    const command = parseListForeshadowPointsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listForeshadowPointsSerially(command),
    );
  }

  startWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStartWritingSessionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#startWritingSessionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  stopWritingSession(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStopWritingSessionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#stopWritingSessionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  startFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStartFocusCycleCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#startFocusCycleSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  stopFocusCycle(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseStopFocusCycleCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#stopFocusCycleSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listWorkActivity(value: unknown): Promise<WorkActivityProjection> {
    this.#assertOpen();
    const command = parseListWorkActivityCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkActivitySerially(command),
    );
  }

  getPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parseGetPomodoroCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getPomodoroSerially(command),
    );
  }

  configureAndStartPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parseConfigureAndStartPomodoroCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#configureAndStartPomodoroSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  pausePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#pausePomodoroSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  resumePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#resumePomodoroSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  reconcilePomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#reconcilePomodoroSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  updatePomodoroNote(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parseUpdatePomodoroNoteCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updatePomodoroNoteSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  stopPomodoro(value: unknown): Promise<PomodoroProjection> {
    this.#assertOpen();
    const command = parsePomodoroPhaseCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#stopPomodoroSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  prepareWorkRecordsExport(value: unknown): Promise<PreparedWorkRecordsExport> {
    this.#assertOpen();
    const command = parseExportWorkRecordsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(async () => {
      const work = this.#catalog.works.find(
        (candidate) => candidate.workId === command.workId,
      );
      if (work === undefined) {
        throw new Error(`Unknown Work: ${command.workId}`);
      }
      const activity = await this.#listWorkActivitySerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      return prepareWorkRecordsExport({
        command,
        workTitle: work.title,
        documents: work.documents.map((document) => ({
          documentId: document.documentId,
          title: document.title,
        })),
        activity,
        dateKey: createTimeZoneDateKey(this.#options.timezone),
      });
    });
  }

  listDocumentRevisions(
    value: unknown,
  ): Promise<DocumentRevisionListProjection> {
    this.#assertOpen();
    const command = parseListDocumentRevisionsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listDocumentRevisionsSerially(command),
    );
  }

  readDocumentRevision(
    value: unknown,
  ): Promise<DocumentRevisionContentProjection> {
    this.#assertOpen();
    const command = parseReadDocumentRevisionCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#readDocumentRevisionSerially(command)
    );
  }

  restoreDocumentRevision(
    value: unknown,
  ): Promise<RestoreDocumentRevisionResult> {
    this.#assertOpen();
    const command = parseRestoreDocumentRevisionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#restoreDocumentRevisionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createWorkSnapshot(value: unknown): Promise<WorkSnapshotProjection> {
    this.#assertOpen();
    const command = parseCreateWorkSnapshotCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createWorkSnapshotSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listWorkSnapshots(value: unknown): Promise<WorkSnapshotListProjection> {
    this.#assertOpen();
    const command = parseListWorkSnapshotsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkSnapshotsSerially(command),
    );
  }

  compareWorkSnapshot(value: unknown): Promise<WorkSnapshotComparisonProjection> {
    this.#assertOpen();
    const command = parseCompareWorkSnapshotCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#compareWorkSnapshotSerially(command),
    );
  }

  getWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection> {
    this.#assertOpen();
    const command = parseGetWorkRecordsGoalsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkRecordsGoalsSerially(command.workId),
    );
  }

  saveWorkRecordsGoals(value: unknown): Promise<WorkRecordsGoalsProjection> {
    this.#assertOpen();
    const command = parseSaveWorkRecordsGoalsCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkRecordsGoalsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection> {
    this.#assertOpen();
    const command = parseGetWorkReadthroughCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkReadthroughSerially(command.workId),
    );
  }

  saveWorkReadthrough(value: unknown): Promise<WorkReadthroughProjection> {
    this.#assertOpen();
    const command = parseSaveWorkReadthroughCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkReadthroughSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listWorkSchedule(value: unknown): Promise<WorkScheduleProjection> {
    this.#assertOpen();
    const command = parseListWorkScheduleCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkScheduleSerially(command),
    );
  }

  listWorkCalendar(value: unknown): Promise<WorkCalendarProjection> {
    this.#assertOpen();
    const command = parseListWorkScheduleCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listWorkCalendarSerially(command),
    );
  }

  getStudioToday(value: unknown): Promise<StudioTodayProjection> {
    this.#assertOpen();
    const command = parseGetStudioTodayCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getStudioTodaySerially(command),
    );
  }

  createWorkScheduleItem(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#assertOpen();
    const command = parseCreateWorkScheduleItemCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#createWorkScheduleItemSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  updateWorkScheduleItem(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#assertOpen();
    const command = parseUpdateWorkScheduleItemCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateWorkScheduleItemSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  retireWorkScheduleItem(value: unknown): Promise<void> {
    this.#assertOpen();
    const command = parseRetireWorkScheduleItemCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      this.#retireWorkScheduleItemSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  setWorkScheduleCompletion(
    value: unknown,
  ): Promise<WorkScheduleItemProjection> {
    this.#assertOpen();
    const command = parseSetWorkScheduleCompletionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#setWorkScheduleCompletionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getAppSettings(): Promise<AppSettingsProjection> {
    this.#assertOpen();
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getAppSettingsSerially(),
    );
  }

  saveAppSettings(value: unknown): Promise<AppSettingsProjection> {
    this.#assertOpen();
    const command = parseSaveAppSettingsCommand(
      value,
      this.#options.appSettingsProfile,
    );
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveAppSettingsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection> {
    this.#assertOpen();
    const command = parseGetWorkManuscriptLayoutSettingsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkManuscriptLayoutSettingsSerially(command.workId),
    );
  }

  saveWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection> {
    this.#assertOpen();
    const parsed = parseSaveWorkManuscriptLayoutSettingsCommand(value);
    const command: SaveWorkManuscriptLayoutSettingsCommand = Object.freeze({
      ...parsed,
      settings: parseManuscriptLayoutSettings(
        parsed.settings,
        this.#options.formattingProfile,
      ),
    });
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkManuscriptLayoutSettingsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection> {
    this.#assertOpen();
    const command = parseGetWorkMusicSettingsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkMusicSettingsSerially(command.workId),
    );
  }

  saveWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection> {
    this.#assertOpen();
    const command = parseSaveWorkMusicSettingsCommand(
      value,
      this.#options.musicSettingsProfile,
    );
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkMusicSettingsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection> {
    this.#assertOpen();
    const command = parseGetWorkInspirationSettingsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkInspirationSettingsSerially(command.workId),
    );
  }

  saveWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection> {
    this.#assertOpen();
    const command = parseSaveWorkInspirationSettingsCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkInspirationSettingsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection> {
    this.#assertOpen();
    const command = parseGetWorkQuickMemoCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getWorkQuickMemoSerially(command.workId),
    );
  }

  saveWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection> {
    this.#assertOpen();
    const command = parseSaveWorkQuickMemoCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveWorkQuickMemoSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  listAssistantContextState(
    value: unknown,
  ): Promise<AssistantContextStateProjection> {
    this.#assertOpen();
    const command = parseListAssistantContextStateCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listAssistantContextStateSerially(command),
    );
  }

  grantAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant> {
    this.#assertOpen();
    const command = parseGrantAssistantContextPermissionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#grantAssistantContextPermissionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  revokeAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant> {
    this.#assertOpen();
    const command = parseRevokeAssistantContextPermissionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#revokeAssistantContextPermissionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  authorizeAssistantContextAccess(
    value: unknown,
  ): Promise<AssistantContextAccessResult> {
    this.#assertOpen();
    const request = parseAssistantContextRequest(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#authorizeAssistantContextAccessSerially(request);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getAssistantDestinationProfile(): AssistantDestinationProfile {
    this.#assertOpen();
    return this.#getAssistantDestinationProfile();
  }

  runAssistantVocabularyLookup(
    value: unknown,
  ): Promise<AssistantVocabularyLookupResult> {
    this.#assertOpen();
    const command = parseRunAssistantVocabularyLookupCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runAssistantVocabularyLookupSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runAssistantVocabularySuggestion(
    value: unknown,
  ): Promise<AssistantVocabularySuggestionResult> {
    this.#assertOpen();
    const command = parseRunAssistantVocabularySuggestionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runAssistantVocabularySuggestionSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runAssistantExternalSettingReview(
    value: unknown,
  ): Promise<AssistantExternalSettingReviewResult> {
    this.#assertOpen();
    const command = parseRunAssistantExternalSettingReviewCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runAssistantExternalSettingReviewSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runCharacterExtraction(value: unknown): Promise<CharacterExtractionResult> {
    this.#assertOpen();
    const command = parseRunCharacterExtractionCommand(value);
    const preparation = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#prepareCharacterExtractionSerially(command);
    });
    this.#createPending = preparation.then(
      () => undefined,
      () => undefined,
    );
    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#createPending.then(async () => {
        await this.#savePending;
        return this.#recordCharacterExtractionSerially(
          prepared,
          executed,
        );
      });
      this.#createPending = recording.then(
        () => undefined,
        () => undefined,
      );
      return recording;
    });
  }

  listCharacterExtractionCandidates(
    value: unknown,
  ): Promise<CharacterExtractionCandidateList> {
    this.#assertOpen();
    const command = parseListCharacterExtractionCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listCharacterExtractionCandidatesSerially(command)
    );
  }

  decideCharacterExtractionItem(
    value: unknown,
  ): Promise<CharacterExtractionDecisionResult> {
    this.#assertOpen();
    const command = parseDecideCharacterExtractionItemCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#decideCharacterExtractionItemSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runCharacterGeneration(value: unknown): Promise<CharacterGenerationResult> {
    this.#assertOpen();
    const command = parseRunCharacterGenerationCommand(value);
    const preparation = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#prepareCharacterGenerationSerially(command);
    });
    this.#createPending = preparation.then(
      () => undefined,
      () => undefined,
    );
    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#createPending.then(async () => {
        await this.#savePending;
        return this.#recordCharacterGenerationSerially(prepared, executed);
      });
      this.#createPending = recording.then(
        () => undefined,
        () => undefined,
      );
      return recording;
    });
  }

  listCharacterGenerationCandidates(
    value: unknown,
  ): Promise<CharacterGenerationCandidateList> {
    this.#assertOpen();
    const command = parseListCharacterGenerationCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listCharacterGenerationCandidatesSerially(command)
    );
  }

  decideCharacterGenerationItem(
    value: unknown,
  ): Promise<CharacterGenerationDecisionResult> {
    this.#assertOpen();
    const command = parseDecideCharacterGenerationItemCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#decideCharacterGenerationItemSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runSceneExtraction(value: unknown): Promise<SceneExtractionResult> {
    this.#assertOpen();
    const command = parseRunSceneExtractionCommand(value);
    const preparation = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#prepareSceneExtractionSerially(command);
    });
    this.#createPending = preparation.then(() => undefined, () => undefined);
    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#createPending.then(async () => {
        await this.#savePending;
        return this.#recordSceneExtractionSerially(prepared, executed);
      });
      this.#createPending = recording.then(() => undefined, () => undefined);
      return recording;
    });
  }

  listSceneExtractionCandidates(
    value: unknown,
  ): Promise<SceneExtractionCandidateList> {
    this.#assertOpen();
    const command = parseListSceneExtractionCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneExtractionCandidatesSerially(command)
    );
  }

  decideSceneExtractionBoundary(
    value: unknown,
  ): Promise<SceneExtractionDecisionResult> {
    this.#assertOpen();
    const command = parseDecideSceneExtractionBoundaryCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#decideSceneExtractionBoundarySerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  listSceneAnnotations(value: unknown): Promise<SceneAnnotationList> {
    this.#assertOpen();
    const command = parseListSceneAnnotationsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneAnnotationsSerially(command)
    );
  }

  decideSceneExtractionAnnotation(
    value: unknown,
  ): Promise<SceneExtractionAnnotationDecisionResult> {
    this.#assertOpen();
    const command = parseDecideSceneExtractionAnnotationCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#decideSceneExtractionAnnotationSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  runSceneDraft(value: unknown): Promise<RunSceneDraftResult> {
    this.#assertOpen();
    const command = parseRunSceneDraftCommand(value);
    const preparation = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#prepareSceneDraftSerially(command);
    });
    this.#createPending = preparation.then(() => undefined, () => undefined);
    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const executed = await prepared.execute();
      const recording = this.#createPending.then(async () => {
        await this.#savePending;
        return this.#recordSceneDraftSerially(prepared, executed);
      });
      this.#createPending = recording.then(() => undefined, () => undefined);
      return recording;
    });
  }

  listSceneDraftCandidates(value: unknown): Promise<SceneDraftCandidateList> {
    this.#assertOpen();
    const command = parseListSceneDraftCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneDraftCandidatesSerially(command)
    );
  }

  updateSceneDraftCandidate(value: unknown): Promise<SceneDraftCandidate> {
    this.#assertOpen();
    const command = parseUpdateSceneDraftCandidateCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#updateSceneDraftCandidateSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  prepareSceneDraftInsertion(
    value: unknown,
  ): Promise<PrepareSceneDraftInsertionResult> {
    this.#assertOpen();
    const command = parsePrepareSceneDraftInsertionCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#prepareSceneDraftInsertionSerially(command)
    );
  }

  completeSceneDraftInsertion(value: unknown): Promise<SceneDraftCandidate> {
    this.#assertOpen();
    const command = parseCompleteSceneDraftInsertionCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#completeSceneDraftInsertionSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  searchSceneMusicQueues(
    value: unknown,
  ): Promise<SceneMusicQueueSearchResult> {
    this.#assertOpen();
    const command = parseSearchSceneMusicQueuesCommand(value);
    const preparation = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#prepareSceneMusicQueueSearchSerially(command);
    });
    this.#createPending = preparation.then(() => undefined, () => undefined);
    return preparation.then(async (prepared) => {
      if ("result" in prepared) return prepared.result;
      const tracks = await prepared.execute();
      const recording = this.#createPending.then(async () => {
        await this.#savePending;
        return this.#recordSceneMusicQueueSearchSerially(prepared, tracks);
      });
      this.#createPending = recording.then(() => undefined, () => undefined);
      return recording;
    });
  }

  listSceneMusicQueueCandidates(
    value: unknown,
  ): Promise<SceneMusicQueueCandidateList> {
    this.#assertOpen();
    const command = parseListSceneMusicQueueCandidatesCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#listSceneMusicQueueCandidatesSerially(command)
    );
  }

  selectSceneMusicQueue(
    value: unknown,
  ): Promise<SceneMusicQueueCandidate> {
    this.#assertOpen();
    const command = parseSelectSceneMusicQueueCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#selectSceneMusicQueueSerially(command);
    });
    this.#createPending = execution.then(() => undefined, () => undefined);
    return execution;
  }

  runAssistantNotationReview(
    value: unknown,
  ): Promise<AssistantNotationReviewResult> {
    this.#assertOpen();
    const command = parseRunAssistantNotationReviewCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runAssistantNotationReviewSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  runAssistantSettingReview(
    value: unknown,
  ): Promise<AssistantSettingReviewResult> {
    this.#assertOpen();
    const command = parseRunAssistantSettingReviewCommand(value);
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#runAssistantSettingReviewSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  getManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection> {
    this.#assertOpen();
    const command = parseGetManuscriptPreflightSettingsCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#getManuscriptPreflightSettingsSerially(command.workId),
    );
  }

  saveManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection> {
    this.#assertOpen();
    const command = parseSaveManuscriptPreflightSettingsCommand(
      value,
      this.#getPreflightProfile(),
    );
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#saveManuscriptPreflightSettingsSerially(command);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  prepareManuscriptTextExport(
    value: unknown,
  ): Promise<ExportManuscriptTextCommand> {
    this.#assertOpen();
    const command = parseExportManuscriptTextCommand(value);
    return Promise.all([this.#createPending, this.#savePending]).then(() => {
      const target = this.#documentTargets.get(command.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Work/document boundary violation: ${command.workId}/${command.documentId}`,
        );
      }
      return command;
    });
  }

  getBackupStatus(): Promise<LocalWorkspaceBackupStatusProjection> {
    this.#assertOpen();
    return Promise.all([this.#createPending, this.#savePending]).then(() =>
      this.#backupService.getStatus(),
    );
  }

  #getWorkQuickMemoSerially(
    workId: EntityId<"Work">,
  ): WorkQuickMemoProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          memo_text AS "text",
          updated_at AS "updatedAt"
        FROM work_quick_memos
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkQuickMemoProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        text: "",
        updatedAt: null,
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work quick memo identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    return parseWorkQuickMemoProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work quick memo row",
      ),
      workId,
      revision: readRequiredInteger(row, "revision", "Work quick memo row"),
      text: readString(row, "text", "Work quick memo row"),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work quick memo row",
      ),
    });
  }

  #deriveWorkManuscriptLayoutSettings(
    workId: EntityId<"Work">,
  ): WorkManuscriptLayoutSettingsProjection {
    const defaults = createDefaultWorkManuscriptLayoutSettingsProjection(
      workId,
      this.#options.formattingProfile,
    );
    const workDocuments = this.#documentProfile.documents.filter(
      (document) => document.workId === workId,
    );
    const activeDocument =
      this.#catalog.activeWorkId === workId &&
      this.#catalog.activeDocumentId !== null
        ? workDocuments.find(
            (document) =>
              document.documentId === this.#catalog.activeDocumentId,
          )
        : undefined;
    const source = activeDocument?.editorStateJson === undefined
      ? workDocuments.find((document) => document.editorStateJson !== undefined)
      : activeDocument;
    if (source?.editorStateJson === undefined) return defaults;
    const state = parseManuscriptEditorDocumentState(
      JSON.parse(source.editorStateJson),
      this.#options.formattingProfile,
      source.initialText.length,
    );
    return Object.freeze({
      ...defaults,
      settings: readManuscriptLayoutSettings(state),
    });
  }

  #getWorkManuscriptLayoutSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkManuscriptLayoutSettingsProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson"
      FROM work_manuscript_layout_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return this.#deriveWorkManuscriptLayoutSettings(workId);
    }
    if (rows.length !== 1) {
      throw new Error(`Work manuscript layout identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const settings = parseManuscriptLayoutSettings(
      JSON.parse(
        readRequiredString(
          row,
          "settingsJson",
          "Work manuscript layout settings row",
        ),
      ),
      this.#options.formattingProfile,
    );
    return parseWorkManuscriptLayoutSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work manuscript layout settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work manuscript layout settings row",
      ),
      settings,
    });
  }

  #saveWorkManuscriptLayoutSettingsSerially(
    command: SaveWorkManuscriptLayoutSettingsCommand,
  ): WorkManuscriptLayoutSettingsProjection {
    const current = this.#getWorkManuscriptLayoutSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work manuscript layout revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const nextRevision = current.revision + 1;
    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(command.settings);
    if (current.revision === 0) {
      this.#database.prepare(`
        INSERT INTO work_manuscript_layout_settings (
          work_id,
          schema_version,
          revision,
          settings_json,
          updated_at
        ) VALUES (?, 1, ?, ?, ?)
      `).run(command.workId, nextRevision, serialized, updatedAt);
    } else {
      const updated = this.#database.prepare(`
        UPDATE work_manuscript_layout_settings
        SET revision = ?, settings_json = ?, updated_at = ?
        WHERE work_id = ? AND revision = ?
      `).run(
        nextRevision,
        serialized,
        updatedAt,
        command.workId,
        command.expectedRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error("Work manuscript layout changed before save completed");
      }
    }
    return this.#getWorkManuscriptLayoutSettingsSerially(command.workId);
  }

  #getAppSettingsSerially(): AppSettingsProjection {
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          default_episode_characters AS "defaultEpisodeCharacters",
          updated_at AS "updatedAt"
        FROM app_settings
        WHERE singleton = 1
      `)
      .all();
    if (rows.length === 0) {
      return createDefaultAppSettingsProjection(
        this.#options.appSettingsProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error("App settings identity is ambiguous");
    }
    const row = rows[0] ?? {};
    return parseAppSettingsProjection(
      {
        schemaVersion: readRequiredInteger(
          row,
          "schemaVersion",
          "App settings row",
        ),
        revision: readRequiredInteger(row, "revision", "App settings row"),
        settings: {
          defaultEpisodeCharacters: readRequiredInteger(
            row,
            "defaultEpisodeCharacters",
            "App settings row",
          ),
        },
        updatedAt: readRequiredString(row, "updatedAt", "App settings row"),
      },
      this.#options.appSettingsProfile,
    );
  }

  #saveAppSettingsSerially(
    command: SaveAppSettingsCommand,
  ): AppSettingsProjection {
    const current = this.#getAppSettingsSerially();
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `App settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    if (current.revision === 0) {
      this.#database
        .prepare(`
          INSERT INTO app_settings (
            singleton,
            schema_version,
            revision,
            default_episode_characters,
            updated_at
          ) VALUES (1, 1, 1, ?, ?)
        `)
        .run(command.settings.defaultEpisodeCharacters, updatedAt);
    } else {
      const updated = this.#database
        .prepare(`
          UPDATE app_settings
          SET
            revision = revision + 1,
            default_episode_characters = ?,
            updated_at = ?
          WHERE singleton = 1 AND revision = ?
        `)
        .run(
          command.settings.defaultEpisodeCharacters,
          updatedAt,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error("App settings changed before the save completed");
      }
    }
    return this.#getAppSettingsSerially();
  }

  #getWorkMusicSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkMusicSettingsProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson",
        updated_at AS "updatedAt"
      FROM work_music_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return createDefaultWorkMusicSettingsProjection(
        workId,
        this.#options.musicSettingsProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error(`Work music settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const settingsJson = readRequiredString(
      row,
      "settingsJson",
      "Work music settings row",
    );
    return parseWorkMusicSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work music settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work music settings row",
      ),
      settings: parseWorkMusicSettings(
        JSON.parse(settingsJson),
        this.#options.musicSettingsProfile,
      ),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work music settings row",
      ),
    }, this.#options.musicSettingsProfile);
  }

  #saveWorkMusicSettingsSerially(
    command: SaveWorkMusicSettingsCommand,
  ): WorkMusicSettingsProjection {
    const current = this.#getWorkMusicSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work music settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const updated = this.#database.prepare(`
      INSERT INTO work_music_settings (
        work_id,
        schema_version,
        revision,
        settings_json,
        updated_at
      ) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(work_id) DO UPDATE SET
        revision = excluded.revision,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
      WHERE work_music_settings.revision = ?
    `).run(
      command.workId,
      nextRevision,
      JSON.stringify(command.settings),
      updatedAt,
      command.expectedRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Work music settings changed before save: ${command.workId}`);
    }
    return this.#getWorkMusicSettingsSerially(command.workId);
  }

  #getWorkInspirationSettingsSerially(
    workId: EntityId<"Work">,
  ): WorkInspirationSettingsProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database.prepare(`
      SELECT
        schema_version AS "schemaVersion",
        revision,
        settings_json AS "settingsJson",
        updated_at AS "updatedAt"
      FROM work_inspiration_settings
      WHERE work_id = ?
    `).all(workId);
    if (rows.length === 0) {
      return createDefaultWorkInspirationSettingsProjection(workId);
    }
    if (rows.length !== 1) {
      throw new Error(`Work inspiration settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    return parseWorkInspirationSettingsProjection({
      schemaVersion: readRequiredInteger(
        row,
        "schemaVersion",
        "Work inspiration settings row",
      ),
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work inspiration settings row",
      ),
      settings: parseWorkInspirationSettings(JSON.parse(readRequiredString(
        row,
        "settingsJson",
        "Work inspiration settings row",
      ))),
      updatedAt: readRequiredString(
        row,
        "updatedAt",
        "Work inspiration settings row",
      ),
    });
  }

  #saveWorkInspirationSettingsSerially(
    command: SaveWorkInspirationSettingsCommand,
  ): WorkInspirationSettingsProjection {
    const current = this.#getWorkInspirationSettingsSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work inspiration settings revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const updated = this.#database.prepare(`
      INSERT INTO work_inspiration_settings (
        work_id,
        schema_version,
        revision,
        settings_json,
        updated_at
      ) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(work_id) DO UPDATE SET
        revision = excluded.revision,
        settings_json = excluded.settings_json,
        updated_at = excluded.updated_at
      WHERE work_inspiration_settings.revision = ?
    `).run(
      command.workId,
      nextRevision,
      JSON.stringify(command.settings),
      updatedAt,
      command.expectedRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(
        `Work inspiration settings changed before save: ${command.workId}`,
      );
    }
    return this.#getWorkInspirationSettingsSerially(command.workId);
  }

  #saveWorkQuickMemoSerially(
    command: SaveWorkQuickMemoCommand,
  ): WorkQuickMemoProjection {
    const current = this.#getWorkQuickMemoSerially(command.workId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work quick memo revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (command.text === "") {
      if (current.revision === 0) return current;
      const removed = this.#database
        .prepare(`
          DELETE FROM work_quick_memos
          WHERE work_id = ? AND revision = ?
        `)
        .run(command.workId, command.expectedRevision);
      if (Number(removed.changes) !== 1) {
        throw new Error(`Work quick memo changed: ${command.workId}`);
      }
      return this.#getWorkQuickMemoSerially(command.workId);
    }
    const updatedAt = new Date().toISOString();
    if (current.revision === 0) {
      this.#database
        .prepare(`
          INSERT INTO work_quick_memos (
            work_id,
            schema_version,
            revision,
            memo_text,
            updated_at
          ) VALUES (?, 1, 1, ?, ?)
        `)
        .run(command.workId, command.text, updatedAt);
    } else {
      const updated = this.#database
        .prepare(`
          UPDATE work_quick_memos
          SET revision = revision + 1, memo_text = ?, updated_at = ?
          WHERE work_id = ? AND revision = ?
        `)
        .run(
          command.text,
          updatedAt,
          command.workId,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work quick memo changed: ${command.workId}`);
      }
    }
    return this.#getWorkQuickMemoSerially(command.workId);
  }

  #assertAssistantWorkExists(workId: EntityId<"Work">): void {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
  }

  #parseAssistantPermissionGrantRow(
    row: Record<string, unknown>,
  ): AssistantContextPermissionGrant {
    const label = "Assistant context permission grant row";
    return parseAssistantContextPermissionGrant({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      grantId: readRequiredString(row, "grantId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readNullableString(row, "conversationId", label),
      capability: readRequiredString(row, "capability", label),
      destinationId: readRequiredString(row, "destinationId", label),
      localScope: readRequiredString(row, "localScope", label),
      externalScope: readRequiredString(row, "externalScope", label),
      duration: readRequiredString(row, "duration", label),
      createdAt: readRequiredString(row, "createdAt", label),
      revokedAt: readNullableString(row, "revokedAt", label),
      consumedAt: readNullableString(row, "consumedAt", label),
    });
  }

  #readAssistantPermissionGrants(
    workId: EntityId<"Work">,
    conversationId: EntityId<"AssistantConversation">,
  ): readonly AssistantContextPermissionGrant[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "grantId",
            revision,
            work_id AS "workId",
            conversation_id AS "conversationId",
            capability,
            destination_id AS "destinationId",
            local_scope AS "localScope",
            external_scope AS "externalScope",
            duration,
            created_at AS "createdAt",
            revoked_at AS "revokedAt",
            consumed_at AS "consumedAt"
          FROM assistant_context_permission_grants
          WHERE
            work_id = ? AND
            (duration = 'work' OR conversation_id = ?)
          ORDER BY created_at, id
        `)
        .all(workId, conversationId)
        .map((row) =>
          this.#parseAssistantPermissionGrantRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #readAssistantPermissionGrant(
    workId: EntityId<"Work">,
    grantId: EntityId<"AssistantContextPermissionGrant">,
  ): AssistantContextPermissionGrant {
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          id AS "grantId",
          revision,
          work_id AS "workId",
          conversation_id AS "conversationId",
          capability,
          destination_id AS "destinationId",
          local_scope AS "localScope",
          external_scope AS "externalScope",
          duration,
          created_at AS "createdAt",
          revoked_at AS "revokedAt",
          consumed_at AS "consumedAt"
        FROM assistant_context_permission_grants
        WHERE work_id = ? AND id = ?
      `)
      .all(workId, grantId);
    if (rows.length !== 1) {
      throw new Error(`Unknown assistant context permission grant: ${grantId}`);
    }
    return this.#parseAssistantPermissionGrantRow(
      (rows[0] ?? {}) as Record<string, unknown>,
    );
  }

  #parseAssistantReceiptJson(value: string, label: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`${label} is invalid JSON`);
    }
  }

  #parseAssistantContextReceiptRow(
    row: Record<string, unknown>,
  ): AssistantContextReceipt {
    const label = "Assistant context receipt row";
    return parseAssistantContextReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      capability: readRequiredString(row, "capability", label),
      destinationId: readRequiredString(row, "destinationId", label),
      readRanges: this.#parseAssistantReceiptJson(
        readRequiredString(row, "readRangesJson", label),
        `${label}.readRangesJson`,
      ),
      transmittedRanges: this.#parseAssistantReceiptJson(
        readRequiredString(row, "transmittedRangesJson", label),
        `${label}.transmittedRangesJson`,
      ),
      readCharacterCount: readRequiredInteger(
        row,
        "readCharacterCount",
        label,
      ),
      transmittedCharacterCount: readRequiredInteger(
        row,
        "transmittedCharacterCount",
        label,
      ),
      grantIds: this.#parseAssistantReceiptJson(
        readRequiredString(row, "grantIdsJson", label),
        `${label}.grantIdsJson`,
      ),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantContextReceipts(
    workId: EntityId<"Work">,
    conversationId: EntityId<"AssistantConversation">,
  ): readonly AssistantContextReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            capability,
            destination_id AS "destinationId",
            read_ranges_json AS "readRangesJson",
            transmitted_ranges_json AS "transmittedRangesJson",
            read_character_count AS "readCharacterCount",
            transmitted_character_count AS "transmittedCharacterCount",
            grant_ids_json AS "grantIdsJson",
            created_at AS "createdAt"
          FROM assistant_context_receipts
          WHERE work_id = ? AND conversation_id = ?
          ORDER BY created_at, id
        `)
        .all(workId, conversationId)
        .map((row) =>
          this.#parseAssistantContextReceiptRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #parseAssistantVocabularyCandidateRow(
    row: Record<string, unknown>,
  ): AssistantVocabularyCandidate {
    const label = "Assistant vocabulary candidate row";
    return parseAssistantVocabularyCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      query: readRequiredString(row, "query", label),
      occurrences: this.#parseAssistantReceiptJson(
        readRequiredString(row, "occurrencesJson", label),
        `${label}.occurrencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantVocabularyCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantVocabularyCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            source_range_json AS "sourceRangeJson",
            query_text AS "query",
            occurrences_json AS "occurrencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_vocabulary_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) =>
          this.#parseAssistantVocabularyCandidateRow(
            row as Record<string, unknown>,
          )
        ),
    );
  }

  #parseAssistantVocabularySuggestionCandidateRow(
    row: Record<string, unknown>,
  ): AssistantVocabularySuggestionCandidate {
    const label = "Assistant vocabulary suggestion candidate row";
    return parseAssistantVocabularySuggestionCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      query: readRequiredString(row, "query", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      suggestions: this.#parseAssistantReceiptJson(
        readRequiredString(row, "suggestionsJson", label),
        `${label}.suggestionsJson`,
      ),
      note: readString(row, "note", label),
      connectorReceiptId: readRequiredString(
        row,
        "connectorReceiptId",
        label,
      ),
      contextReceiptId: readNullableString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantVocabularySuggestionCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantVocabularySuggestionCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            query_text AS "query",
            source_range_json AS "sourceRangeJson",
            suggestions_json AS "suggestionsJson",
            note_text AS "note",
            connector_receipt_id AS "connectorReceiptId",
            context_receipt_id AS "contextReceiptId",
            created_at AS "createdAt"
          FROM assistant_vocabulary_suggestion_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantVocabularySuggestionCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantExternalSettingReviewReceiptRow(
    row: Record<string, unknown>,
  ): AssistantExternalSettingReviewReceipt {
    const label = "Assistant external setting review receipt row";
    return parseAssistantExternalSettingReviewReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      transmittedSettings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "transmittedSettingsJson", label),
        `${label}.transmittedSettingsJson`,
      ),
      transmittedSettingCount: readRequiredInteger(
        row,
        "transmittedSettingCount",
        label,
      ),
      connectorReceiptId: readRequiredString(
        row,
        "connectorReceiptId",
        label,
      ),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantExternalSettingReviewReceipts(
    workId: EntityId<"Work">,
  ): readonly AssistantExternalSettingReviewReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            source_range_json AS "sourceRangeJson",
            transmitted_settings_json AS "transmittedSettingsJson",
            transmitted_setting_count AS "transmittedSettingCount",
            connector_receipt_id AS "connectorReceiptId",
            context_receipt_id AS "contextReceiptId",
            created_at AS "createdAt"
          FROM assistant_external_setting_review_receipts
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantExternalSettingReviewReceiptRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantExternalSettingReviewCandidateRow(
    row: Record<string, unknown>,
  ): AssistantExternalSettingReviewCandidate {
    const label = "Assistant external setting review Candidate row";
    return parseAssistantExternalSettingReviewCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      connectionId: readRequiredString(row, "connectionId", label),
      query: readRequiredString(row, "query", label),
      reply: readString(row, "reply", label),
      proposals: this.#parseAssistantReceiptJson(
        readRequiredString(row, "proposalsJson", label),
        `${label}.proposalsJson`,
      ),
      reviewNotes: this.#parseAssistantReceiptJson(
        readRequiredString(row, "reviewNotesJson", label),
        `${label}.reviewNotesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantExternalSettingReviewCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantExternalSettingReviewCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            connection_id AS "connectionId",
            query_text AS "query",
            reply_text AS "reply",
            proposals_json AS "proposalsJson",
            review_notes_json AS "reviewNotesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_external_setting_review_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantExternalSettingReviewCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantNotationCandidateRow(
    row: Record<string, unknown>,
  ): AssistantNotationCandidate {
    const label = "Assistant notation candidate row";
    return parseAssistantNotationCandidate({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      candidateId: readRequiredString(row, "candidateId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      sourceRange: this.#parseAssistantReceiptJson(
        readRequiredString(row, "sourceRangeJson", label),
        `${label}.sourceRangeJson`,
      ),
      findings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "findingsJson", label),
        `${label}.findingsJson`,
      ),
      regexError: readNullableString(row, "regexError", label),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantNotationCandidates(
    workId: EntityId<"Work">,
  ): readonly AssistantNotationCandidate[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "candidateId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            source_range_json AS "sourceRangeJson",
            findings_json AS "findingsJson",
            regex_error AS "regexError",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_notation_candidates
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantNotationCandidateRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingReviewReceiptRow(
    row: Record<string, unknown>,
  ): AssistantSettingReviewReceipt {
    const label = "Assistant setting review receipt row";
    return parseAssistantSettingReviewReceipt({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      receiptId: readRequiredString(row, "receiptId", label),
      requestId: readRequiredString(row, "requestId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      capability: "lore-review",
      destinationId: readRequiredString(row, "destinationId", label),
      reviewedSettings: this.#parseAssistantReceiptJson(
        readRequiredString(row, "reviewedSettingsJson", label),
        `${label}.reviewedSettingsJson`,
      ),
      transmittedSettingCount: readRequiredInteger(
        row,
        "transmittedSettingCount",
        label,
      ),
      grantIds: this.#parseAssistantReceiptJson(
        readRequiredString(row, "grantIdsJson", label),
        `${label}.grantIdsJson`,
      ),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingReviewReceipts(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewReceipt[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "receiptId",
            request_id AS "requestId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            reviewed_settings_json AS "reviewedSettingsJson",
            transmitted_setting_count AS "transmittedSettingCount",
            grant_ids_json AS "grantIdsJson",
            created_at AS "createdAt"
          FROM assistant_setting_review_receipts
          WHERE work_id = ?
          ORDER BY created_at, id
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingReviewReceiptRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingReviewFindingRow(
    row: Record<string, unknown>,
  ): AssistantSettingReviewFinding {
    const label = "Assistant setting review finding row";
    return parseAssistantSettingReviewFinding({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      findingId: readRequiredString(row, "findingId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      kind: readRequiredString(row, "kind", label),
      settingKind: readRequiredString(row, "settingKind", label),
      label: readRequiredString(row, "label", label),
      references: this.#parseAssistantReceiptJson(
        readRequiredString(row, "referencesJson", label),
        `${label}.referencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingReviewFindings(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewFinding[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "findingId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            finding_kind AS "kind",
            setting_kind AS "settingKind",
            duplicate_label AS "label",
            references_json AS "referencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_setting_review_findings
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingReviewFindingRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #parseAssistantSettingConflictFindingRow(
    row: Record<string, unknown>,
  ): AssistantSettingConflictFinding {
    const label = "Assistant setting conflict finding row";
    return parseAssistantSettingConflictFinding({
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      findingId: readRequiredString(row, "findingId", label),
      workId: readRequiredString(row, "workId", label),
      conversationId: readRequiredString(row, "conversationId", label),
      destinationId: readRequiredString(row, "destinationId", label),
      kind: readRequiredString(row, "kind", label),
      settingKind: readRequiredString(row, "settingKind", label),
      label: readRequiredString(row, "label", label),
      field: readRequiredString(row, "field", label),
      references: this.#parseAssistantReceiptJson(
        readRequiredString(row, "referencesJson", label),
        `${label}.referencesJson`,
      ),
      receiptId: readRequiredString(row, "receiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
    });
  }

  #readAssistantSettingConflictFindings(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingConflictFinding[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            schema_version AS "schemaVersion",
            id AS "findingId",
            work_id AS "workId",
            conversation_id AS "conversationId",
            destination_id AS "destinationId",
            finding_kind AS "kind",
            setting_kind AS "settingKind",
            duplicate_label AS "label",
            field_name AS "field",
            references_json AS "referencesJson",
            receipt_id AS "receiptId",
            created_at AS "createdAt"
          FROM assistant_setting_conflict_findings
          WHERE work_id = ?
          ORDER BY created_at DESC, id DESC
        `)
        .all(workId)
        .map((row) => this.#parseAssistantSettingConflictFindingRow(
          row as Record<string, unknown>,
        )),
    );
  }

  #readAssistantSettingReviewSources(
    workId: EntityId<"Work">,
  ): readonly AssistantSettingReviewSource[] {
    const queries = [
      {
        kind: "character",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            name AS label,
            role,
            summary,
            note
          FROM characters
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
      {
        kind: "plot",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            title AS label,
            stage,
            summary,
            note
          FROM plot_threads
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
      {
        kind: "foreshadow",
        sql: `
          SELECT
            id AS "entityId",
            revision,
            work_id AS "workId",
            title AS label,
            note
          FROM foreshadow_lines
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY id
        `,
      },
    ] as const;
    return Object.freeze(queries.flatMap(({ kind, sql }) =>
      this.#database.prepare(sql).all(workId).map((row) => {
        const label = "Assistant setting review source row";
        const record = row as Record<string, unknown>;
        return parseAssistantSettingReviewSource({
          kind,
          entityId: readRequiredString(record, "entityId", label),
          revision: readRequiredInteger(record, "revision", label),
          workId: readRequiredString(record, "workId", label),
          label: readRequiredString(record, "label", label),
          fields: kind === "character"
            ? [
                { field: "role", value: readString(record, "role", label) },
                { field: "summary", value: readString(record, "summary", label) },
                { field: "note", value: readString(record, "note", label) },
              ]
            : kind === "plot"
              ? [
                  { field: "stage", value: readString(record, "stage", label) },
                  { field: "summary", value: readString(record, "summary", label) },
                  { field: "note", value: readString(record, "note", label) },
                ]
              : [
                  { field: "note", value: readString(record, "note", label) },
                ],
        });
      })
    ));
  }

  #listAssistantContextStateSerially(
    command: ListAssistantContextStateCommand,
  ): AssistantContextStateProjection {
    this.#assertAssistantWorkExists(command.workId);
    return parseAssistantContextStateProjection({
      schemaVersion: 1,
      workId: command.workId,
      conversationId: command.conversationId,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      receipts: this.#readAssistantContextReceipts(
        command.workId,
        command.conversationId,
      ),
      candidates: this.#readAssistantVocabularyCandidates(command.workId),
      notationCandidates: this.#readAssistantNotationCandidates(command.workId),
      vocabularySuggestionCandidates:
        this.#readAssistantVocabularySuggestionCandidates(command.workId),
      settingReviewReceipts: this.#readAssistantSettingReviewReceipts(
        command.workId,
      ),
      settingReviewFindings: this.#readAssistantSettingReviewFindings(
        command.workId,
      ),
      settingConflictFindings: this.#readAssistantSettingConflictFindings(
        command.workId,
      ),
      externalSettingReviewReceipts:
        this.#readAssistantExternalSettingReviewReceipts(command.workId),
      externalSettingReviewCandidates:
        this.#readAssistantExternalSettingReviewCandidates(command.workId),
    });
  }

  #grantAssistantContextPermissionSerially(
    command: GrantAssistantContextPermissionCommand,
  ): AssistantContextPermissionGrant {
    this.#assertAssistantWorkExists(command.workId);
    const grant = parseAssistantContextPermissionGrant({
      ...command,
      grantId: randomUUID(),
      revision: 1,
      createdAt: new Date().toISOString(),
      revokedAt: null,
      consumedAt: null,
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_context_permission_grants (
          id,
          schema_version,
          revision,
          work_id,
          conversation_id,
          capability,
          destination_id,
          local_scope,
          external_scope,
          duration,
          created_at,
          revoked_at,
          consumed_at
        ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `)
      .run(
        grant.grantId,
        grant.workId,
        grant.conversationId,
        grant.capability,
        grant.destinationId,
        grant.localScope,
        grant.externalScope,
        grant.duration,
        grant.createdAt,
      );
    return this.#readAssistantPermissionGrant(grant.workId, grant.grantId);
  }

  #revokeAssistantContextPermissionSerially(
    command: RevokeAssistantContextPermissionCommand,
  ): AssistantContextPermissionGrant {
    this.#assertAssistantWorkExists(command.workId);
    const current = this.#readAssistantPermissionGrant(
      command.workId,
      command.grantId,
    );
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Assistant context permission revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.revokedAt !== null) return current;
    const revokedAt = new Date().toISOString();
    const updated = this.#database
      .prepare(`
        UPDATE assistant_context_permission_grants
        SET revision = revision + 1, revoked_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND revoked_at IS NULL
      `)
      .run(
        revokedAt,
        command.workId,
        command.grantId,
        command.expectedRevision,
      );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Assistant context permission changed: ${command.grantId}`);
    }
    return this.#readAssistantPermissionGrant(
      command.workId,
      command.grantId,
    );
  }

  #authorizeAssistantContextAccessSerially(
    request: AssistantContextRequest,
  ): AssistantContextAccessResult {
    this.#assertAssistantWorkExists(request.workId);
    const grants = this.#readAssistantPermissionGrants(
      request.workId,
      request.conversationId,
    );
    const authorization = authorizeAssistantContextRequest({
      request,
      grants,
      documents: [...this.#documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
    });
    if (!authorization.allowed) return authorization;
    const receipt = createAssistantContextReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const grantId of authorization.consumedGrantIds) {
        const current = grants.find((grant) => grant.grantId === grantId);
        if (current === undefined) {
          throw new Error(`Unknown consumed assistant grant: ${grantId}`);
        }
        const consumed = this.#database
          .prepare(`
            UPDATE assistant_context_permission_grants
            SET revision = revision + 1, consumed_at = ?
            WHERE
              work_id = ? AND
              id = ? AND
              revision = ? AND
              duration = 'once' AND
              revoked_at IS NULL AND
              consumed_at IS NULL
          `)
          .run(
            receipt.createdAt,
            request.workId,
            grantId,
            current.revision,
          );
        if (Number(consumed.changes) !== 1) {
          throw new Error(`Assistant context permission changed: ${grantId}`);
        }
      }
      this.#database
        .prepare(`
          INSERT INTO assistant_context_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            capability,
            destination_id,
            read_ranges_json,
            transmitted_ranges_json,
            read_character_count,
            transmitted_character_count,
            grant_ids_json,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          receipt.receiptId,
          receipt.requestId,
          receipt.workId,
          receipt.conversationId,
          receipt.capability,
          receipt.destinationId,
          JSON.stringify(receipt.readRanges),
          JSON.stringify(receipt.transmittedRanges),
          receipt.readCharacterCount,
          receipt.transmittedCharacterCount,
          JSON.stringify(receipt.grantIds),
          receipt.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return Object.freeze({ allowed: true, receipt });
  }

  #runAssistantVocabularyLookupSerially(
    command: RunAssistantVocabularyLookupCommand,
  ): AssistantVocabularyLookupResult {
    this.#assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-exact-vocabulary-search" ||
      !destination.capabilities.includes("vocabulary-lookup")
    ) {
      throw new Error(`Unknown vocabulary lookup destination: ${command.destinationId}`);
    }
    const sourceTarget = this.#documentTargets.get(
      command.sourceRange.documentId,
    );
    if (sourceTarget === undefined) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "source-unavailable",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.workId !== command.workId) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "outside-work",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.currentRevisionId !== command.sourceRange.documentRevisionId) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "stale-context",
        documentId: command.sourceRange.documentId,
      });
    }
    if (command.sourceRange.to > sourceTarget.text.length) {
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "invalid-range",
        documentId: command.sourceRange.documentId,
      });
    }
    const searchDocuments = [...this.#documentTargets.values()]
      .filter((target) => target.workId === command.workId)
      .map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        text: target.text,
      }));
    const authorization = this.#authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: command.requestId,
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "vocabulary-lookup",
        destinationId: command.destinationId,
        requiredLocalScope: destination.requiredLocalScope,
        requiredExternalScope: destination.requiredExternalScope,
        readRanges: searchDocuments
          .filter((document) => document.text.length > 0)
          .map((document) => ({
            documentId: document.documentId,
            documentRevisionId: document.documentRevisionId,
            from: 0,
            to: document.text.length,
          })),
        transmittedRanges: [],
      }),
    );
    if (!authorization.allowed) {
      if (authorization.reason === "permission-required") {
        return parseAssistantVocabularyLookupResult({
          schemaVersion: 1,
          status: "permission-required",
          missing: authorization.missing,
        });
      }
      return parseAssistantVocabularyLookupResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: authorization.reason,
        documentId: authorization.documentId,
      });
    }
    const query = sourceTarget.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const candidate = parseAssistantVocabularyCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      workId: command.workId,
      conversationId: command.conversationId,
      destinationId: command.destinationId,
      sourceRange: command.sourceRange,
      query,
      occurrences: findExactVocabularyOccurrences({
        workId: command.workId,
        query,
        documents: searchDocuments,
      }),
      receiptId: authorization.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_vocabulary_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          source_range_json,
          query_text,
          occurrences_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        candidate.candidateId,
        candidate.workId,
        candidate.conversationId,
        candidate.destinationId,
        JSON.stringify(candidate.sourceRange),
        candidate.query,
        JSON.stringify(candidate.occurrences),
        candidate.receiptId,
        candidate.createdAt,
      );
    return parseAssistantVocabularyLookupResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #runAssistantVocabularySuggestionSerially(
    command: RunAssistantVocabularySuggestionCommand,
  ): Promise<AssistantVocabularySuggestionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const authorization = authorizeAssistantVocabularySuggestion({
      command,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      documents: [...this.#documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
    });
    if (!authorization.allowed) {
      return authorization.reason === "permission-required"
        ? parseAssistantVocabularySuggestionResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: authorization.missing,
          })
        : parseAssistantVocabularySuggestionResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: authorization.reason,
            documentId: authorization.documentId,
          });
    }
    const execute = this.#options.executeAssistantVocabularySuggestion;
    if (execute === undefined) {
      throw new Error("Assistant vocabulary suggestion connector is not configured");
    }
    let context: string | null = null;
    let contextReceiptId: EntityId<"AssistantContextReceipt"> | null = null;
    if (command.sourceRange !== null) {
      const access = this.#authorizeAssistantContextAccessSerially(
        authorization.context.request,
      );
      if (!access.allowed) {
        return access.reason === "permission-required"
          ? parseAssistantVocabularySuggestionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
            })
          : parseAssistantVocabularySuggestionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            });
      }
      const sourceTarget = this.#documentTargets.get(
        command.sourceRange.documentId,
      );
      if (sourceTarget === undefined) {
        throw new Error(
          `Authorized assistant source disappeared: ${command.sourceRange.documentId}`,
        );
      }
      context = sourceTarget.text.slice(
        command.sourceRange.from,
        command.sourceRange.to,
      );
      contextReceiptId = access.receipt.receiptId;
    }
    const executed = await execute(Object.freeze({
      requestId: command.requestId,
      connectionId: command.connectionId,
      query: command.query,
      context,
    }));
    if (
      String(executed.receipt.requestId) !== String(command.requestId) ||
      executed.receipt.connectionId !== command.connectionId ||
      executed.receipt.operation !== "vocabulary-suggestions"
    ) {
      throw new Error("Assistant connector receipt does not match the request");
    }
    const candidate = createAssistantVocabularySuggestionCandidate({
      authorization,
      payload: executed.payload,
      candidateId: randomUUID(),
      connectorReceiptId: executed.receipt.receiptId,
      contextReceiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO assistant_connector_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            connector_kind,
            operation,
            request_fingerprint,
            started_at,
            completed_at,
            result_state
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          executed.receipt.receiptId,
          executed.receipt.requestId,
          candidate.workId,
          candidate.conversationId,
          executed.receipt.connectionId,
          executed.receipt.connectorKind,
          executed.receipt.operation,
          executed.receipt.requestFingerprint,
          executed.receipt.startedAt,
          executed.receipt.completedAt,
          executed.receipt.resultState,
        );
      this.#database
        .prepare(`
        INSERT INTO assistant_vocabulary_suggestion_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          connection_id,
          query_text,
          source_range_json,
          suggestions_json,
          note_text,
          connector_receipt_id,
          context_receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          candidate.candidateId,
          candidate.workId,
          candidate.conversationId,
          candidate.connectionId,
          candidate.query,
          JSON.stringify(candidate.sourceRange),
          JSON.stringify(candidate.suggestions),
          candidate.note,
          candidate.connectorReceiptId,
          candidate.contextReceiptId,
          candidate.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantVocabularySuggestionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #runAssistantExternalSettingReviewSerially(
    command: RunAssistantExternalSettingReviewCommand,
  ): Promise<AssistantExternalSettingReviewResult> {
    this.#assertAssistantWorkExists(command.workId);
    const settings = this.#readAssistantSettingReviewSources(command.workId);
    const authorization = authorizeAssistantExternalSettingReview({
      command,
      grants: this.#readAssistantPermissionGrants(
        command.workId,
        command.conversationId,
      ),
      documents: [...this.#documentTargets.values()].map((target) => ({
        workId: target.workId,
        documentId: target.documentId,
        documentRevisionId: target.currentRevisionId,
        length: target.text.length,
      })),
      settings,
    });
    if (!authorization.allowed) {
      return authorization.reason === "permission-required"
        ? parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: authorization.missing,
          })
        : parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: authorization.reason,
            documentId: authorization.documentId,
          });
    }
    const access = this.#authorizeAssistantContextAccessSerially(
      authorization.context.request,
    );
    if (!access.allowed) {
      return access.reason === "permission-required"
        ? parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "permission-required",
            missing: access.missing,
          })
        : parseAssistantExternalSettingReviewResult({
            schemaVersion: 1,
            status: "context-rejected",
            reason: access.reason,
            documentId: access.documentId,
          });
    }
    const sourceTarget = this.#documentTargets.get(
      command.sourceRange.documentId,
    );
    if (sourceTarget === undefined) {
      throw new Error(`Authorized assistant source disappeared: ${command.sourceRange.documentId}`);
    }
    const execute = this.#options.executeAssistantExternalSettingReview;
    if (execute === undefined) {
      throw new Error("Assistant external setting review connector is not configured");
    }
    const executed = await execute(Object.freeze({
      requestId: command.requestId,
      connectionId: command.connectionId,
      query: command.query,
      sourceRange: command.sourceRange,
      manuscript: sourceTarget.text.slice(
        command.sourceRange.from,
        command.sourceRange.to,
      ),
      settings,
    }));
    if (
      String(executed.receipt.requestId) !== String(command.requestId) ||
      executed.receipt.connectionId !== command.connectionId ||
      executed.receipt.operation !== "setting-review"
    ) {
      throw new Error("Assistant connector receipt does not match the setting review request");
    }
    const records = createAssistantExternalSettingReviewRecords({
      authorization,
      payload: executed.payload,
      candidateId: randomUUID(),
      receiptId: randomUUID(),
      connectorReceiptId: executed.receipt.receiptId,
      contextReceiptId: access.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO assistant_connector_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            connector_kind,
            operation,
            request_fingerprint,
            started_at,
            completed_at,
            result_state
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          executed.receipt.receiptId,
          executed.receipt.requestId,
          records.receipt.workId,
          records.receipt.conversationId,
          executed.receipt.connectionId,
          executed.receipt.connectorKind,
          executed.receipt.operation,
          executed.receipt.requestFingerprint,
          executed.receipt.startedAt,
          executed.receipt.completedAt,
          executed.receipt.resultState,
        );
      this.#database
        .prepare(`
          INSERT INTO assistant_external_setting_review_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            connection_id,
            source_range_json,
            transmitted_settings_json,
            transmitted_setting_count,
            connector_receipt_id,
            context_receipt_id,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          records.receipt.receiptId,
          records.receipt.requestId,
          records.receipt.workId,
          records.receipt.conversationId,
          records.receipt.connectionId,
          JSON.stringify(records.receipt.sourceRange),
          JSON.stringify(records.receipt.transmittedSettings),
          records.receipt.transmittedSettingCount,
          records.receipt.connectorReceiptId,
          records.receipt.contextReceiptId,
          records.receipt.createdAt,
        );
      this.#database
        .prepare(`
          INSERT INTO assistant_external_setting_review_candidates (
            id,
            schema_version,
            work_id,
            conversation_id,
            connection_id,
            query_text,
            reply_text,
            proposals_json,
            review_notes_json,
            receipt_id,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          records.candidate.candidateId,
          records.candidate.workId,
          records.candidate.conversationId,
          records.candidate.connectionId,
          records.candidate.query,
          records.candidate.reply,
          JSON.stringify(records.candidate.proposals),
          JSON.stringify(records.candidate.reviewNotes),
          records.candidate.receiptId,
          records.candidate.createdAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantExternalSettingReviewResult({
      schemaVersion: 1,
      status: "candidate",
      receipt: records.receipt,
      candidate: records.candidate,
    });
  }

  #prepareCharacterExtractionSerially(
    command: RunCharacterExtractionCommand,
  ): PreparedCharacterExtraction {
    this.#assertAssistantWorkExists(command.workId);
    const connector = this.#options.characterExtraction;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseCharacterExtractionResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    if (command.sourceRange.from === command.sourceRange.to) {
      return Object.freeze({
        result: parseCharacterExtractionResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "invalid-range",
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const access = this.#authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: entityId<"AssistantContextRequest">(command.requestId),
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "character.extract",
        destinationId: connector.destinationId,
        requiredLocalScope: "selection",
        requiredExternalScope: "selection",
        readRanges: [command.sourceRange],
        transmittedRanges: [command.sourceRange],
      }),
    );
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseCharacterExtractionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseCharacterExtractionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const target = this.#documentTargets.get(command.sourceRange.documentId);
    if (target === undefined) {
      throw new Error(
        `Authorized character extraction source disappeared: ${command.sourceRange.documentId}`,
      );
    }
    const manuscript = target.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const paragraphs = createCharacterExtractionParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      paragraphs,
      execute: () => connector.execute({
        requestId: command.requestId,
        paragraphs,
      }),
    });
  }

  #recordCharacterExtractionSerially(
    prepared: Exclude<PreparedCharacterExtraction, { result: CharacterExtractionResult }>,
    executed: CharacterExtractionExecution,
  ): CharacterExtractionResult {
    if (executed.promptVersion !== CHARACTER_EXTRACTION_PROMPT_VERSION) {
      throw new Error("Character extraction prompt version does not match");
    }
    const target = this.#documentTargets.get(
      prepared.command.sourceRange.documentId,
    );
    const stale =
      target === undefined ||
      target.workId !== prepared.command.workId ||
      target.currentRevisionId !==
        prepared.command.sourceRange.documentRevisionId;
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const items = Object.freeze(executed.payload.characters.map((proposal) => {
      const names = new Set([proposal.name, ...proposal.aliases]);
      const matchingCharacterIds = Object.freeze(
        characters
          .filter((character) =>
            [character.name, ...character.aliases].some((name) => names.has(name))
          )
          .map((character) => character.characterId),
      );
      return Object.freeze({
        itemId: entityId<"CharacterExtractionItem">(randomUUID()),
        name: proposal.name,
        aliases: proposal.aliases,
        role: proposal.role,
        summary: proposal.summary,
        appearance: proposal.appearance,
        personality: proposal.personality,
        speech: proposal.speech,
        goal: proposal.goal,
        conflict: proposal.conflict,
        note: proposal.note,
        evidences: resolveCharacterExtractionEvidences({
          sourceRange: prepared.command.sourceRange,
          paragraphs: prepared.paragraphs,
          proposal,
        }),
        matchingCharacterIds,
        status: "pending" as const,
        approvedCharacterId: null,
      });
    }));
    const createdAt = new Date().toISOString();
    const candidate = parseCharacterExtractionCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: stale ? "stale" : items.length === 0 ? "completed" : "ready",
      items,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_character_extraction_candidates (
        id,
        schema_version,
        request_id,
        revision,
        work_id,
        source_document_id,
        source_document_revision_id,
        source_from,
        source_to,
        provider_id,
        model_id,
        prompt_version,
        status,
        items_json,
        context_receipt_id,
        created_at,
        updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.sourceRange.documentId,
      candidate.sourceRange.documentRevisionId,
      candidate.sourceRange.from,
      candidate.sourceRange.to,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.items),
      candidate.contextReceiptId,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseCharacterExtractionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listCharacterExtractionCandidatesSerially(
    command: ListCharacterExtractionCandidatesCommand,
  ): CharacterExtractionCandidateList {
    this.#assertAssistantWorkExists(command.workId);
    return parseCharacterExtractionCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredCharacterExtractionCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  #markCharacterExtractionCandidateStale(
    candidate: CharacterExtractionCandidate,
  ): CharacterExtractionCandidate {
    if (candidate.status === "stale") return candidate;
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE assistant_character_extraction_candidates
      SET revision = revision + 1, status = 'stale', updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ?
    `).run(
      updatedAt,
      candidate.workId,
      candidate.candidateId,
      candidate.revision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(
        `Character extraction Candidate revision conflict: ${candidate.candidateId}`,
      );
    }
    const stored = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (stored === null) {
      throw new Error(
        `Character extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    return stored.candidate;
  }

  async #createCharacterExtractionEvidenceAnchors(input: {
    readonly candidate: CharacterExtractionCandidate;
    readonly item: CharacterExtractionCandidate["items"][number];
    readonly characterId: EntityId<"Character">;
    readonly createdAt: string;
  }) {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(input.candidate.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${input.candidate.workId}`);
    }
    return Promise.all(input.item.evidences.map(async (evidence) => {
      const target = this.#documentTargets.get(evidence.documentId);
      if (
        target === undefined ||
        target.workId !== input.candidate.workId ||
        target.currentRevisionId !== evidence.documentRevisionId ||
        target.text.slice(evidence.from, evidence.to) !== evidence.exactText
      ) {
        throw new Error("Character extraction evidence is stale");
      }
      const anchorId = entityId<"Anchor">(randomUUID());
      const anchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: anchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
        workId: input.candidate.workId,
        documentId: evidence.documentId,
        documentRevisionId: evidence.documentRevisionId,
        startOffset: evidence.from,
        endOffset: evidence.to,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: input.item.itemId,
        actorRef: work.studioId,
      });
      return Object.freeze({
        anchorId,
        anchor,
        evidenceId: entityId<"CharacterEvidence">(randomUUID()),
        sourceDocumentId: evidence.documentId,
        characterId: input.characterId,
      });
    }));
  }

  async #decideCharacterExtractionItemSerially(
    command: DecideCharacterExtractionItemCommand,
  ): Promise<CharacterExtractionDecisionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(
        `Unknown character extraction Candidate: ${command.candidateId}`,
      );
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Character extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const sourceTarget = this.#documentTargets.get(
      candidate.sourceRange.documentId,
    );
    if (
      sourceTarget === undefined ||
      sourceTarget.workId !== command.workId ||
      sourceTarget.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseCharacterExtractionDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markCharacterExtractionCandidateStale(candidate),
      }, parseCharacterProjection);
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Character extraction Candidate is not actionable: ${candidate.status}`,
      );
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(
        `Character extraction item is not pending: ${command.itemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    let characterId: EntityId<"Character"> | null = null;
    let currentCharacter: StoredCharacterRow | null = null;
    if (command.decision.kind === "create") {
      characterId = entityId<"Character">(randomUUID());
    } else if (command.decision.kind === "merge") {
      characterId = command.decision.targetCharacterId;
      currentCharacter = readStoredCharacterRowById(
        this.#database,
        command.workId,
        characterId,
      );
      if (
        currentCharacter === null ||
        currentCharacter.retiredAt !== null ||
        currentCharacter.revision !== command.decision.expectedCharacterRevision
      ) {
        throw new Error(`Character revision conflict: ${characterId}`);
      }
    }
    const evidenceAnchors = characterId === null
      ? Object.freeze([])
      : await this.#createCharacterExtractionEvidenceAnchors({
          candidate,
          item,
          characterId,
          createdAt: changedAt,
        });
    const itemStatus = command.decision.kind === "create"
      ? "created" as const
      : command.decision.kind === "merge"
        ? "merged" as const
        : "excluded" as const;
    const nextItems = Object.freeze(candidate.items.map((entry) =>
      entry.itemId === item.itemId
        ? Object.freeze({
            ...entry,
            status: itemStatus,
            approvedCharacterId: characterId,
          })
        : entry
    ));
    const nextCandidateStatus = nextItems.some((entry) => entry.status === "pending")
      ? "ready" as const
      : "completed" as const;
    const mergeFields = command.decision.kind === "merge"
      ? new Set(command.decision.fields)
      : new Set<never>();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (characterId !== null && command.decision.kind === "create") {
        transaction.write({
          kind: "character",
          ...createRecordMeta(changedAt),
          id: characterId,
          workId: command.workId,
          name: item.name,
          aliases: item.aliases,
          role: item.role,
          summary: item.summary,
          appearance: item.appearance,
          personality: item.personality,
          speech: item.speech,
          goal: item.goal,
          conflict: item.conflict,
          note: item.note,
        });
      }
      if (
        characterId !== null &&
        command.decision.kind === "merge" &&
        currentCharacter !== null
      ) {
        transaction.write({
          kind: "characterUpdate",
          id: characterId,
          workId: command.workId,
          expectedRevision: currentCharacter.revision,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          updatedAt: changedAt,
          name: mergeFields.has("name") ? item.name : currentCharacter.name,
          aliases: mergeFields.has("aliases")
            ? item.aliases
            : currentCharacter.aliases,
          role: mergeFields.has("role") ? item.role : currentCharacter.role,
          summary: mergeFields.has("summary")
            ? item.summary
            : currentCharacter.summary,
          appearance: mergeFields.has("appearance")
            ? item.appearance
            : currentCharacter.appearance,
          personality: mergeFields.has("personality")
            ? item.personality
            : currentCharacter.personality,
          speech: mergeFields.has("speech")
            ? item.speech
            : currentCharacter.speech,
          goal: mergeFields.has("goal") ? item.goal : currentCharacter.goal,
          conflict: mergeFields.has("conflict")
            ? item.conflict
            : currentCharacter.conflict,
          note: mergeFields.has("note") ? item.note : currentCharacter.note,
        });
      }
      for (const evidence of evidenceAnchors) {
        transaction.write(
          createAnchorLedgerRecord(command.workId, evidence.anchor),
        );
        transaction.write({
          kind: "characterEvidence",
          id: evidence.evidenceId,
          workId: command.workId,
          characterId: evidence.characterId,
          sourceDocumentId: evidence.sourceDocumentId,
          sourceAnchorId: evidence.anchorId,
          createdAt: changedAt,
        });
      }
      transaction.write({
        kind: "characterExtractionCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextCandidateStatus,
        items: nextItems,
        updatedAt: changedAt,
      });
    });
    const nextStoredCandidate = readStoredCharacterExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStoredCandidate === null) {
      throw new Error(
        `Character extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, candidate.workId)
        .map((row) => this.#projectCharacterRow(row)),
    );
    return parseCharacterExtractionDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStoredCandidate.candidate,
      characters,
    }, parseCharacterProjection);
  }

  #prepareCharacterGenerationSerially(
    command: RunCharacterGenerationCommand,
  ): PreparedCharacterGeneration {
    this.#assertAssistantWorkExists(command.workId);
    const connector = this.#options.characterGeneration;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseCharacterGenerationResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    return Object.freeze({
      command,
      execute: () => connector.execute({
        requestId: command.requestId,
        brief: command.brief,
      }),
    });
  }

  #recordCharacterGenerationSerially(
    prepared: Exclude<PreparedCharacterGeneration, { result: CharacterGenerationResult }>,
    executed: CharacterGenerationExecution,
  ): CharacterGenerationResult {
    if (executed.promptVersion !== CHARACTER_GENERATION_PROMPT_VERSION) {
      throw new Error("Character generation prompt version does not match");
    }
    this.#assertAssistantWorkExists(prepared.command.workId);
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const items = Object.freeze(executed.payload.characters.map((proposal) => {
      const names = new Set([proposal.name, ...proposal.aliases]);
      const matchingCharacterIds = Object.freeze(
        characters
          .filter((character) =>
            [character.name, ...character.aliases].some((name) => names.has(name))
          )
          .map((character) => character.characterId),
      );
      return Object.freeze({
        itemId: entityId<"CharacterGenerationItem">(randomUUID()),
        name: proposal.name,
        aliases: proposal.aliases,
        role: proposal.role,
        summary: proposal.summary,
        appearance: proposal.appearance,
        personality: proposal.personality,
        speech: proposal.speech,
        goal: proposal.goal,
        conflict: proposal.conflict,
        note: proposal.note,
        matchingCharacterIds,
        status: "pending" as const,
        approvedCharacterId: null,
      });
    }));
    const createdAt = new Date().toISOString();
    const candidate = parseCharacterGenerationCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      brief: prepared.command.brief,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: items.length === 0 ? "completed" : "ready",
      items,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_character_generation_candidates (
        id,
        schema_version,
        request_id,
        revision,
        work_id,
        brief_json,
        provider_id,
        model_id,
        prompt_version,
        status,
        items_json,
        created_at,
        updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      JSON.stringify(candidate.brief),
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.items),
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseCharacterGenerationResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listCharacterGenerationCandidatesSerially(
    command: ListCharacterGenerationCandidatesCommand,
  ): CharacterGenerationCandidateList {
    this.#assertAssistantWorkExists(command.workId);
    return parseCharacterGenerationCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredCharacterGenerationCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  async #decideCharacterGenerationItemSerially(
    command: DecideCharacterGenerationItemCommand,
  ): Promise<CharacterGenerationDecisionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredCharacterGenerationCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(
        `Unknown character generation Candidate: ${command.candidateId}`,
      );
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Character generation Candidate revision conflict: ${command.candidateId}`,
      );
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Character generation Candidate is not actionable: ${candidate.status}`,
      );
    }
    const item = candidate.items.find((entry) => entry.itemId === command.itemId);
    if (item === undefined || item.status !== "pending") {
      throw new Error(
        `Character generation item is not pending: ${command.itemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    let characterId: EntityId<"Character"> | null = null;
    let currentCharacter: StoredCharacterRow | null = null;
    if (command.decision.kind === "create") {
      characterId = entityId<"Character">(randomUUID());
    } else if (command.decision.kind === "merge") {
      characterId = command.decision.targetCharacterId;
      currentCharacter = readStoredCharacterRowById(
        this.#database,
        command.workId,
        characterId,
      );
      if (
        currentCharacter === null ||
        currentCharacter.retiredAt !== null ||
        currentCharacter.revision !== command.decision.expectedCharacterRevision
      ) {
        throw new Error(`Character revision conflict: ${characterId}`);
      }
    }
    const itemStatus = command.decision.kind === "create"
      ? "created" as const
      : command.decision.kind === "merge"
        ? "merged" as const
        : "excluded" as const;
    const nextItems = Object.freeze(candidate.items.map((entry) =>
      entry.itemId === item.itemId
        ? Object.freeze({
            ...entry,
            status: itemStatus,
            approvedCharacterId: characterId,
          })
        : entry
    ));
    const nextCandidateStatus = nextItems.some((entry) => entry.status === "pending")
      ? "ready" as const
      : "completed" as const;
    const mergeFields = command.decision.kind === "merge"
      ? new Set(command.decision.fields)
      : new Set<never>();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (characterId !== null && command.decision.kind === "create") {
        transaction.write({
          kind: "character",
          ...createRecordMeta(changedAt),
          id: characterId,
          workId: command.workId,
          name: item.name,
          aliases: item.aliases,
          role: item.role,
          summary: item.summary,
          appearance: item.appearance,
          personality: item.personality,
          speech: item.speech,
          goal: item.goal,
          conflict: item.conflict,
          note: item.note,
        });
      }
      if (
        characterId !== null &&
        command.decision.kind === "merge" &&
        currentCharacter !== null
      ) {
        transaction.write({
          kind: "characterUpdate",
          id: characterId,
          workId: command.workId,
          expectedRevision: currentCharacter.revision,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          updatedAt: changedAt,
          name: mergeFields.has("name") ? item.name : currentCharacter.name,
          aliases: mergeFields.has("aliases")
            ? item.aliases
            : currentCharacter.aliases,
          role: mergeFields.has("role") ? item.role : currentCharacter.role,
          summary: mergeFields.has("summary")
            ? item.summary
            : currentCharacter.summary,
          appearance: mergeFields.has("appearance")
            ? item.appearance
            : currentCharacter.appearance,
          personality: mergeFields.has("personality")
            ? item.personality
            : currentCharacter.personality,
          speech: mergeFields.has("speech") ? item.speech : currentCharacter.speech,
          goal: mergeFields.has("goal") ? item.goal : currentCharacter.goal,
          conflict: mergeFields.has("conflict")
            ? item.conflict
            : currentCharacter.conflict,
          note: mergeFields.has("note") ? item.note : currentCharacter.note,
        });
      }
      transaction.write({
        kind: "characterGenerationCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextCandidateStatus,
        items: nextItems,
        updatedAt: changedAt,
      });
    });
    const nextStoredCandidate = readStoredCharacterGenerationCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStoredCandidate === null) {
      throw new Error(
        `Character generation Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, candidate.workId)
        .map((row) => this.#projectCharacterRow(row)),
    );
    return parseCharacterGenerationDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStoredCandidate.candidate,
      characters,
    }, parseCharacterProjection);
  }

  #prepareSceneExtractionSerially(
    command: RunSceneExtractionCommand,
  ): PreparedSceneExtraction {
    this.#assertAssistantWorkExists(command.workId);
    const connector = this.#options.sceneExtraction;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseSceneExtractionResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    if (command.sourceRange.from === command.sourceRange.to) {
      return Object.freeze({
        result: parseSceneExtractionResult({
          schemaVersion: 1,
          status: "context-rejected",
          reason: "invalid-range",
          documentId: command.sourceRange.documentId,
        }),
      });
    }
    const access = this.#authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: entityId<"AssistantContextRequest">(command.requestId),
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "scene.extract",
        destinationId: connector.destinationId,
        requiredLocalScope: "selection",
        requiredExternalScope: "selection",
        readRanges: [command.sourceRange],
        transmittedRanges: [command.sourceRange],
      }),
    );
    if (!access.allowed) {
      return Object.freeze({
        result: access.reason === "permission-required"
          ? parseSceneExtractionResult({
              schemaVersion: 1,
              status: "permission-required",
              missing: access.missing,
              destinationId: connector.destinationId,
            })
          : parseSceneExtractionResult({
              schemaVersion: 1,
              status: "context-rejected",
              reason: access.reason,
              documentId: access.documentId,
            }),
      });
    }
    const target = this.#documentTargets.get(command.sourceRange.documentId);
    if (target === undefined) {
      throw new Error(
        `Authorized scene extraction source disappeared: ${command.sourceRange.documentId}`,
      );
    }
    const manuscript = target.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const paragraphs = createSceneExtractionParagraphs({
      sourceRange: command.sourceRange,
      manuscript,
    });
    return Object.freeze({
      command,
      contextReceiptId: access.receipt.receiptId,
      paragraphs,
      execute: () => connector.execute({
        requestId: command.requestId,
        paragraphs,
      }),
    });
  }

  #recordSceneExtractionSerially(
    prepared: Exclude<PreparedSceneExtraction, { result: SceneExtractionResult }>,
    executed: SceneExtractionExecution,
  ): SceneExtractionResult {
    if (executed.promptVersion !== SCENE_EXTRACTION_PROMPT_VERSION) {
      throw new Error("Scene extraction prompt version does not match");
    }
    const target = this.#documentTargets.get(
      prepared.command.sourceRange.documentId,
    );
    const stale =
      target === undefined ||
      target.workId !== prepared.command.workId ||
      target.currentRevisionId !== prepared.command.sourceRange.documentRevisionId;
    const characters = readStoredCharacterRows(
      this.#database,
      prepared.command.workId,
    );
    const resolveCharacterId = (name: string): EntityId<"Character"> | null => {
      if (!name) return null;
      const matches = characters.filter((character) =>
        character.name === name || character.aliases.includes(name)
      );
      return matches.length === 1 ? matches[0]!.characterId : null;
    };
    const resolved = resolveSceneExtractionModelScenes({
      sourceRange: prepared.command.sourceRange,
      paragraphs: prepared.paragraphs,
      payload: executed.payload,
    });
    const scenes = Object.freeze(resolved.map(({ proposal, range }) => {
      const sceneItemId = entityId<"SceneExtractionItem">(randomUUID());
      const characterIds = Object.freeze([
        ...new Set(proposal.characters
          .map(resolveCharacterId)
          .filter((value): value is EntityId<"Character"> => value !== null)),
      ]);
      return Object.freeze({
        sceneItemId,
        title: proposal.title,
        fromParagraphId: proposal.fromParagraphId,
        toParagraphId: proposal.toParagraphId,
        range,
        summary: proposal.summary,
        povCharacterId: resolveCharacterId(proposal.povCharacter),
        location: proposal.location,
        time: proposal.time,
        characterIds,
        goal: proposal.goal,
        conflict: proposal.conflict,
        outcome: proposal.outcome,
        annotationStatus: "pending" as const,
        sceneAnnotationId: null,
      });
    }));
    const boundaries = Object.freeze(scenes.slice(1).map((scene, index) =>
      Object.freeze({
        boundaryId: entityId<"SceneExtractionBoundary">(randomUUID()),
        fromSceneItemId: scenes[index]!.sceneItemId,
        toSceneItemId: scene.sceneItemId,
        offset: scene.range.from,
        status: "pending" as const,
        sceneOverrideId: null,
      })
    ));
    const createdAt = new Date().toISOString();
    const candidate = parseSceneExtractionCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      sourceRange: prepared.command.sourceRange,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      status: stale ? "stale" : scenes.length === 0 ? "completed" : "ready",
      scenes,
      boundaries,
      contextReceiptId: prepared.contextReceiptId,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO assistant_scene_extraction_candidates (
        id, schema_version, request_id, revision, work_id,
        source_document_id, source_document_revision_id, source_from, source_to,
        provider_id, model_id, prompt_version, status, scenes_json,
        boundaries_json, context_receipt_id, created_at, updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.sourceRange.documentId,
      candidate.sourceRange.documentRevisionId,
      candidate.sourceRange.from,
      candidate.sourceRange.to,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      candidate.status,
      JSON.stringify(candidate.scenes),
      JSON.stringify(candidate.boundaries),
      candidate.contextReceiptId,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseSceneExtractionResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #listSceneExtractionCandidatesSerially(
    command: ListSceneExtractionCandidatesCommand,
  ): SceneExtractionCandidateList {
    this.#assertAssistantWorkExists(command.workId);
    return parseSceneExtractionCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates: readStoredSceneExtractionCandidateRows(
        this.#database,
        command.workId,
      ).map((row) => row.candidate),
    });
  }

  #markSceneExtractionCandidateStale(
    candidate: SceneExtractionCandidate,
  ): SceneExtractionCandidate {
    if (candidate.status === "stale") return candidate;
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_extraction_candidates
      SET revision = revision + 1, status = 'stale', updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ?
    `).run(
      updatedAt,
      candidate.workId,
      candidate.candidateId,
      candidate.revision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${candidate.candidateId}`,
      );
    }
    const stored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (stored === null) {
      throw new Error(
        `Scene extraction Candidate disappeared: ${candidate.candidateId}`,
      );
    }
    return stored.candidate;
  }

  async #decideSceneExtractionBoundarySerially(
    command: DecideSceneExtractionBoundaryCommand,
  ): Promise<SceneExtractionDecisionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredSceneExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(`Unknown scene extraction Candidate: ${command.candidateId}`);
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const target = this.#documentTargets.get(candidate.sourceRange.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseSceneExtractionDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markSceneExtractionCandidateStale(candidate),
      });
    }
    if (candidate.status !== "ready") {
      throw new Error(`Scene extraction Candidate is not actionable: ${candidate.status}`);
    }
    const boundary = candidate.boundaries.find(
      (entry) => entry.boundaryId === command.boundaryId,
    );
    if (boundary === undefined || boundary.status !== "pending") {
      throw new Error(`Scene extraction boundary is not pending: ${command.boundaryId}`);
    }
    if (
      boundary.offset < candidate.sourceRange.from ||
      boundary.offset > candidate.sourceRange.to ||
      boundary.offset > target.text.length
    ) {
      throw new Error("Scene extraction boundary is outside the current selection");
    }
    const changedAt = new Date().toISOString();
    let sceneOverrideId: EntityId<"SceneOverride"> | null = null;
    let anchorId: EntityId<"Anchor"> | null = null;
    let anchor: Anchor | null = null;
    let baseRuleSetRevision = 0;
    if (command.decision === "accept") {
      const catalog = createCatalogFromStoredRows(
        readStoredDocumentRows(this.#database),
      );
      const work = catalog.getWork(command.workId);
      if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
      const settingsRows = this.#database.prepare(WORK_SCENE_RULE_REVISION_SQL)
        .all(command.workId);
      const settingsRow = settingsRows[0];
      if (settingsRows.length !== 1 || settingsRow === undefined) {
        throw new Error(`Work scene settings are missing: ${command.workId}`);
      }
      baseRuleSetRevision = readRequiredInteger(
        settingsRow,
        "baseRuleSetRevision",
        "Work scene settings",
      );
      sceneOverrideId = entityId<"SceneOverride">(randomUUID());
      anchorId = entityId<"Anchor">(randomUUID());
      anchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: anchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: changedAt,
          updatedAt: changedAt,
        },
        workId: command.workId,
        documentId: candidate.sourceRange.documentId,
        documentRevisionId: candidate.sourceRange.documentRevisionId,
        startOffset: boundary.offset,
        endOffset: boundary.offset,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: boundary.boundaryId,
        actorRef: work.studioId,
      });
    }
    const nextBoundaries = Object.freeze(candidate.boundaries.map((entry) =>
      entry.boundaryId === boundary.boundaryId
        ? Object.freeze({
            ...entry,
            status: command.decision === "accept"
              ? "accepted" as const
              : "excluded" as const,
            sceneOverrideId,
          })
        : entry
    ));
    const nextStatus =
      nextBoundaries.some((entry) => entry.status === "pending") ||
        candidate.scenes.some((entry) => entry.annotationStatus === "pending")
      ? "ready" as const
      : "completed" as const;
    const fromScene = candidate.scenes.find(
      (scene) => scene.sceneItemId === boundary.fromSceneItemId,
    );
    const toScene = candidate.scenes.find(
      (scene) => scene.sceneItemId === boundary.toSceneItemId,
    );
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (anchor !== null && anchorId !== null && sceneOverrideId !== null) {
        transaction.write(createAnchorLedgerRecord(command.workId, anchor));
        transaction.write({
          kind: "sceneOverride",
          ...createRecordMeta(changedAt),
          id: sceneOverrideId,
          workId: command.workId,
          documentId: candidate.sourceRange.documentId,
          operation: "split",
          anchorIds: [anchorId],
          baseRuleSetRevision,
          note: `AI 장면 경계: ${fromScene?.title ?? "이전 장면"} → ${toScene?.title ?? "다음 장면"}`,
        });
      }
      transaction.write({
        kind: "sceneExtractionCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextStatus,
        boundaries: nextBoundaries,
        updatedAt: changedAt,
      });
    });
    const nextStored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStored === null) {
      throw new Error(`Scene extraction Candidate disappeared: ${candidate.candidateId}`);
    }
    return parseSceneExtractionDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStored.candidate,
      sceneProjection: await this.#listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }

  #listSceneAnnotationsSerially(
    command: ListSceneAnnotationsCommand,
  ): SceneAnnotationList {
    this.#assertAssistantWorkExists(command.workId);
    return parseSceneAnnotationList({
      schemaVersion: 1,
      workId: command.workId,
      annotations: readStoredSceneAnnotationRows(this.#database, command.workId),
    });
  }

  async #decideSceneExtractionAnnotationSerially(
    command: DecideSceneExtractionAnnotationCommand,
  ): Promise<SceneExtractionAnnotationDecisionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const storedCandidate = readStoredSceneExtractionCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (storedCandidate === null) {
      throw new Error(`Unknown scene extraction Candidate: ${command.candidateId}`);
    }
    const candidate = storedCandidate.candidate;
    if (candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene extraction Candidate revision conflict: ${command.candidateId}`,
      );
    }
    const target = this.#documentTargets.get(candidate.sourceRange.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== candidate.sourceRange.documentRevisionId
    ) {
      return parseSceneExtractionAnnotationDecisionResult({
        schemaVersion: 1,
        status: "stale",
        candidate: this.#markSceneExtractionCandidateStale(candidate),
      });
    }
    if (candidate.status !== "ready") {
      throw new Error(
        `Scene extraction Candidate is not actionable: ${candidate.status}`,
      );
    }
    if (candidate.boundaries.some((boundary) => boundary.status === "pending")) {
      throw new Error("Scene extraction boundaries must be decided first");
    }
    const sceneItem = candidate.scenes.find(
      (scene) => scene.sceneItemId === command.sceneItemId,
    );
    if (sceneItem === undefined || sceneItem.annotationStatus !== "pending") {
      throw new Error(
        `Scene extraction annotation is not pending: ${command.sceneItemId}`,
      );
    }
    const changedAt = new Date().toISOString();
    const annotationDecision = command.decision;
    let sceneAnnotationId: EntityId<"SceneAnnotation"> | null = null;
    let existingAnnotation: StoredSceneAnnotationRow | null = null;
    if (annotationDecision.kind === "accept") {
      const sceneProjection = await this.#listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const matchingScene = sceneProjection.scenes.find((scene) =>
        scene.sceneKey === annotationDecision.sceneKey &&
        scene.documentId === sceneItem.range.documentId &&
        scene.documentRevisionId === sceneItem.range.documentRevisionId &&
        scene.integrity === "resolved" &&
        scene.range !== null &&
        scene.range.start === sceneItem.range.from &&
        scene.range.end >= sceneItem.range.to &&
        /^\n*$/u.test(target.text.slice(sceneItem.range.to, scene.range.end))
      );
      if (matchingScene === undefined) {
        throw new Error(
          "Scene extraction annotation does not match the current SceneProjection",
        );
      }
      existingAnnotation = readStoredSceneAnnotationRowByKey(
        this.#database,
        command.workId,
        annotationDecision.sceneKey,
      );
      if (
        (existingAnnotation === null &&
          annotationDecision.expectedAnnotationRevision !== null) ||
        (existingAnnotation !== null &&
          existingAnnotation.revision !==
            annotationDecision.expectedAnnotationRevision)
      ) {
        throw new Error(
          `Scene annotation revision conflict: ${annotationDecision.sceneKey}`,
        );
      }
      const referencedCharacterIds = new Set([
        ...sceneItem.characterIds,
        ...(sceneItem.povCharacterId === null
          ? []
          : [sceneItem.povCharacterId]),
      ]);
      for (const characterId of referencedCharacterIds) {
        if (
          readStoredCharacterRowById(
            this.#database,
            command.workId,
            characterId,
          ) === null
        ) {
          throw new Error(
            `Scene annotation Character is outside its Work: ${characterId}`,
          );
        }
      }
      sceneAnnotationId = existingAnnotation?.sceneAnnotationId ??
        entityId<"SceneAnnotation">(randomUUID());
    }
    const nextScenes = Object.freeze(candidate.scenes.map((scene) =>
      scene.sceneItemId === sceneItem.sceneItemId
        ? Object.freeze({
            ...scene,
            annotationStatus: annotationDecision.kind === "accept"
              ? "approved" as const
              : "excluded" as const,
            sceneAnnotationId,
          })
        : scene
    ));
    const nextStatus =
      candidate.boundaries.some((entry) => entry.status === "pending") ||
        nextScenes.some((entry) => entry.annotationStatus === "pending")
        ? "ready" as const
        : "completed" as const;
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (
        annotationDecision.kind === "accept" &&
        sceneAnnotationId !== null
      ) {
        const annotationFields = {
          documentId: sceneItem.range.documentId,
          documentRevisionId: sceneItem.range.documentRevisionId,
          sourceCandidateId: candidate.candidateId,
          sourceSceneItemId: sceneItem.sceneItemId,
          title: sceneItem.title,
          summary: sceneItem.summary,
          ...(sceneItem.povCharacterId === null
            ? {}
            : { povCharacterId: sceneItem.povCharacterId }),
          location: sceneItem.location,
          time: sceneItem.time,
          characterIds: sceneItem.characterIds,
          goal: sceneItem.goal,
          conflict: sceneItem.conflict,
          outcome: sceneItem.outcome,
        } as const;
        if (existingAnnotation === null) {
          transaction.write({
            kind: "sceneAnnotation",
            ...createRecordMeta(changedAt),
            schemaVersion: 1,
            id: sceneAnnotationId,
            workId: command.workId,
            sceneKey: annotationDecision.sceneKey,
            ...annotationFields,
          });
        } else {
          transaction.write({
            kind: "sceneAnnotationUpdate",
            id: sceneAnnotationId,
            workId: command.workId,
            expectedRevision: existingAnnotation.revision,
            updatedAt: changedAt,
            ...annotationFields,
          });
        }
      }
      transaction.write({
        kind: "sceneExtractionAnnotationCandidateDecision",
        id: candidate.candidateId,
        workId: candidate.workId,
        expectedRevision: candidate.revision,
        status: nextStatus,
        scenes: nextScenes,
        updatedAt: changedAt,
      });
    });
    const nextStored = readStoredSceneExtractionCandidateRowById(
      this.#database,
      candidate.workId,
      candidate.candidateId,
    );
    if (nextStored === null) {
      throw new Error(`Scene extraction Candidate disappeared: ${candidate.candidateId}`);
    }
    return parseSceneExtractionAnnotationDecisionResult({
      schemaVersion: 1,
      status: "applied",
      candidate: nextStored.candidate,
      annotations: this.#listSceneAnnotationsSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
      sceneProjection: await this.#listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }

  #createSceneDraftContextSerially(input: {
    readonly workId: EntityId<"Work">;
    readonly plotThreadId: EntityId<"PlotThread">;
    readonly expectedPlotRevision: number;
    readonly characterIds: readonly EntityId<"Character">[];
    readonly settingIds: readonly EntityId<"LoreEntry">[];
  }): SceneDraftContext {
    const plot = readStoredPlotThreadRowById(
      this.#database,
      input.workId,
      input.plotThreadId,
    );
    if (
      plot === null ||
      plot.retiredAt !== null ||
      plot.revision !== input.expectedPlotRevision
    ) {
      throw new Error(`Plot revision conflict: ${input.plotThreadId}`);
    }
    const events = readStoredPlotEventLinkRows(this.#database, input.workId)
      .filter((link) => link.plotBeatId === input.plotThreadId)
      .map((link) => {
        const event = readStoredEventBlockRowById(
          this.#database,
          input.workId,
          link.eventBlockId,
        );
        if (event === null || event.retiredAt !== null) {
          throw new Error(`Linked event is unavailable: ${link.eventBlockId}`);
        }
        return Object.freeze({
          plotEventLinkId: link.plotEventLinkId,
          linkRevision: link.revision,
          role: link.role,
          eventBlockId: event.eventBlockId,
          eventRevision: event.revision,
          title: event.title,
          note: event.note,
        });
      });
    const characters = input.characterIds.map((characterId) => {
      const character = readStoredCharacterRowById(
        this.#database,
        input.workId,
        characterId,
      );
      if (character === null || character.retiredAt !== null) {
        throw new Error(`Scene draft Character is unavailable: ${characterId}`);
      }
      return Object.freeze({
        characterId: character.characterId,
        revision: character.revision,
        name: character.name,
        aliases: character.aliases,
        role: character.role,
        summary: character.summary,
        appearance: character.appearance,
        personality: character.personality,
        speech: character.speech,
        goal: character.goal,
        conflict: character.conflict,
        note: character.note,
      });
    });
    const settings = input.settingIds.map((loreEntryId) => {
      const setting = readStoredLoreEntryRowById(
        this.#database,
        input.workId,
        loreEntryId,
      );
      if (
        setting === null ||
        setting.retiredAt !== null ||
        !setting.enabled
      ) {
        throw new Error(`Scene draft setting is unavailable: ${loreEntryId}`);
      }
      return Object.freeze({
        loreEntryId: setting.loreEntryId,
        revision: setting.revision,
        title: setting.title,
        content: setting.content,
        category: setting.category,
        aliases: setting.aliases,
      });
    });
    return parseSceneDraftContext({
      plot: {
        plotThreadId: plot.plotThreadId,
        revision: plot.revision,
        title: plot.title,
        stage: plot.stage,
        summary: plot.summary,
        note: plot.note,
      },
      events,
      characters,
      settings,
    });
  }

  #sceneDraftContextIsCurrent(
    candidate: Omit<SceneDraftCandidate, "integrity">,
  ): boolean {
    try {
      const current = this.#createSceneDraftContextSerially({
        workId: candidate.workId,
        plotThreadId: candidate.context.plot.plotThreadId,
        expectedPlotRevision: candidate.context.plot.revision,
        characterIds: candidate.context.characters.map(
          (character) => character.characterId,
        ),
        settingIds: candidate.context.settings.map(
          (setting) => setting.loreEntryId,
        ),
      });
      return JSON.stringify(current) === JSON.stringify(candidate.context);
    } catch {
      return false;
    }
  }

  async #findExactSceneDraftInsertionRevision(
    candidate: Omit<SceneDraftCandidate, "integrity">,
  ): Promise<EntityId<"DocumentRevision"> | null> {
    const target = this.#documentTargets.get(candidate.target.documentId);
    if (
      target === undefined ||
      target.workId !== candidate.workId ||
      target.currentRevisionId === candidate.target.documentRevisionId
    ) {
      return null;
    }
    const revision = await this.#revisionStore.getRevision(
      target.currentRevisionId,
    );
    if (
      revision === null ||
      revision.documentId !== candidate.target.documentId ||
      revision.parentRevisionId !== candidate.target.documentRevisionId
    ) {
      return null;
    }
    const baseText = await this.#revisionStore.materialize(
      candidate.target.documentRevisionId,
    );
    if (candidate.target.insertionOffset > baseText.length) return null;
    const expected =
      baseText.slice(0, candidate.target.insertionOffset) +
      candidate.draftText +
      baseText.slice(candidate.target.insertionOffset);
    const result = await this.#revisionStore.materialize(revision.id);
    return result === expected ? revision.id : null;
  }

  async #projectStoredSceneDraftCandidate(
    stored: StoredSceneDraftCandidateRow,
  ): Promise<SceneDraftCandidate> {
    if (stored.candidate.status === "applied") {
      return parseSceneDraftCandidate({
        ...stored.candidate,
        integrity: "current",
      });
    }
    const insertedRevision = await this.#findExactSceneDraftInsertionRevision(
      stored.candidate,
    );
    if (insertedRevision !== null) {
      return parseSceneDraftCandidate({
        ...stored.candidate,
        integrity: "inserted",
      });
    }
    const target = this.#documentTargets.get(stored.candidate.target.documentId);
    const current =
      target !== undefined &&
      target.workId === stored.candidate.workId &&
      target.currentRevisionId ===
        stored.candidate.target.documentRevisionId &&
      stored.candidate.target.insertionOffset <= target.text.length &&
      this.#sceneDraftContextIsCurrent(stored.candidate);
    return parseSceneDraftCandidate({
      ...stored.candidate,
      integrity: current ? "current" : "stale",
    });
  }

  #prepareSceneDraftSerially(command: RunSceneDraftCommand): PreparedSceneDraft {
    this.#assertAssistantWorkExists(command.workId);
    const target = this.#documentTargets.get(command.target.documentId);
    if (
      target === undefined ||
      target.workId !== command.workId ||
      target.currentRevisionId !== command.target.documentRevisionId ||
      command.target.insertionOffset > target.text.length
    ) {
      throw new Error("Scene draft target is not the current Document revision");
    }
    const context = this.#createSceneDraftContextSerially({
      workId: command.workId,
      plotThreadId: command.plotThreadId,
      expectedPlotRevision: command.expectedPlotRevision,
      characterIds: command.characterIds,
      settingIds: command.settingIds,
    });
    const connector = this.#options.sceneDraft;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseRunSceneDraftResult({
          schemaVersion: 1,
          status: "login-required",
        }),
      });
    }
    return Object.freeze({
      command,
      context,
      execute: () => connector.execute({
        requestId: command.requestId,
        context,
      }),
    });
  }

  async #recordSceneDraftSerially(
    prepared: Exclude<PreparedSceneDraft, { result: RunSceneDraftResult }>,
    executed: SceneDraftExecution,
  ): Promise<RunSceneDraftResult> {
    if (executed.promptVersion !== SCENE_DRAFT_PROMPT_VERSION) {
      throw new Error("Scene draft prompt version does not match");
    }
    const createdAt = new Date().toISOString();
    const storedCandidate = Object.freeze({
      schemaVersion: 1 as const,
      candidateId: entityId<"SceneDraftCandidate">(randomUUID()),
      revision: 1,
      workId: prepared.command.workId,
      context: prepared.context,
      target: prepared.command.target,
      providerId: executed.providerId,
      modelId: executed.modelId,
      promptVersion: executed.promptVersion,
      generatedText: executed.payload.draftText,
      draftText: executed.payload.draftText,
      status: "ready" as const,
      appliedDocumentRevisionId: null,
      createdAt,
      updatedAt: createdAt,
    });
    const candidate = await this.#projectStoredSceneDraftCandidate({
      requestId: prepared.command.requestId,
      candidate: storedCandidate,
    });
    this.#database.prepare(`
      INSERT INTO assistant_scene_draft_candidates (
        id, schema_version, request_id, revision, work_id, plot_thread_id,
        plot_thread_revision, target_document_id, target_document_revision_id,
        insertion_offset, provider_id, model_id, prompt_version, context_json,
        generated_text, draft_text, status, applied_document_revision_id,
        created_at, updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', NULL, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.context.plot.plotThreadId,
      candidate.context.plot.revision,
      candidate.target.documentId,
      candidate.target.documentRevisionId,
      candidate.target.insertionOffset,
      candidate.providerId,
      candidate.modelId,
      candidate.promptVersion,
      JSON.stringify(candidate.context),
      candidate.generatedText,
      candidate.draftText,
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseRunSceneDraftResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #listSceneDraftCandidatesSerially(
    command: ListSceneDraftCandidatesCommand,
  ): Promise<SceneDraftCandidateList> {
    this.#assertAssistantWorkExists(command.workId);
    const candidates = await Promise.all(
      readStoredSceneDraftCandidateRows(this.#database, command.workId).map(
        (stored) => this.#projectStoredSceneDraftCandidate(stored),
      ),
    );
    return parseSceneDraftCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #updateSceneDraftCandidateSerially(
    command: UpdateSceneDraftCandidateCommand,
  ): Promise<SceneDraftCandidate> {
    this.#assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    const candidate = await this.#projectStoredSceneDraftCandidate(stored);
    if (
      candidate.revision !== command.expectedCandidateRevision ||
      candidate.status !== "ready" ||
      candidate.integrity !== "current"
    ) {
      throw new Error(`Scene draft Candidate is not editable: ${command.candidateId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_draft_candidates
      SET revision = revision + 1, draft_text = ?, updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'ready'
    `).run(
      command.draftText,
      updatedAt,
      command.workId,
      command.candidateId,
      command.expectedCandidateRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const next = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) throw new Error("Scene draft Candidate disappeared");
    return this.#projectStoredSceneDraftCandidate(next);
  }

  async #prepareSceneDraftInsertionSerially(
    command: PrepareSceneDraftInsertionCommand,
  ): Promise<PrepareSceneDraftInsertionResult> {
    this.#assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    if (stored.candidate.revision !== command.expectedCandidateRevision) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const candidate = await this.#projectStoredSceneDraftCandidate(stored);
    if (candidate.status !== "ready") {
      throw new Error(`Scene draft Candidate is already applied: ${command.candidateId}`);
    }
    if (candidate.integrity === "inserted") {
      const resultDocumentRevisionId =
        await this.#findExactSceneDraftInsertionRevision(stored.candidate);
      if (resultDocumentRevisionId === null) {
        throw new Error("Inserted scene draft revision disappeared");
      }
      return parsePrepareSceneDraftInsertionResult({
        schemaVersion: 1,
        status: "already-inserted",
        candidate,
        resultDocumentRevisionId,
      });
    }
    if (candidate.integrity === "stale") {
      return parsePrepareSceneDraftInsertionResult({
        schemaVersion: 1,
        status: "stale",
        candidate,
      });
    }
    const target = this.#documentTargets.get(candidate.target.documentId);
    if (target === undefined) throw new Error("Scene draft target disappeared");
    return parsePrepareSceneDraftInsertionResult({
      schemaVersion: 1,
      status: "authorized",
      candidate,
      baseDocumentLength: target.text.length,
    });
  }

  async #completeSceneDraftInsertionSerially(
    command: CompleteSceneDraftInsertionCommand,
  ): Promise<SceneDraftCandidate> {
    this.#assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene draft Candidate: ${command.candidateId}`);
    }
    if (
      stored.candidate.revision !== command.expectedCandidateRevision ||
      stored.candidate.status !== "ready"
    ) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const exactRevision = await this.#findExactSceneDraftInsertionRevision(
      stored.candidate,
    );
    if (exactRevision !== command.resultDocumentRevisionId) {
      throw new Error("Scene draft insertion revision does not match exact text");
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE assistant_scene_draft_candidates
      SET
        revision = revision + 1,
        status = 'applied',
        applied_document_revision_id = ?,
        updated_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'ready'
    `).run(
      command.resultDocumentRevisionId,
      updatedAt,
      command.workId,
      command.candidateId,
      command.expectedCandidateRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Scene draft Candidate revision conflict: ${command.candidateId}`);
    }
    const next = readStoredSceneDraftCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) throw new Error("Scene draft Candidate disappeared");
    return this.#projectStoredSceneDraftCandidate(next);
  }

  async #readCurrentSceneAnnotationForMusicSerially(
    workId: EntityId<"Work">,
    sceneKey: string,
  ): Promise<SceneAnnotationProjection | null> {
    const annotation = readStoredSceneAnnotationRowByKey(
      this.#database,
      workId,
      sceneKey,
    );
    if (annotation === null) return null;
    const projection = await this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId,
    });
    const scene = projection.scenes.find((entry) =>
      entry.sceneKey === sceneKey &&
      entry.integrity === "resolved" &&
      entry.range !== null &&
      entry.documentId === annotation.documentId &&
      entry.documentRevisionId === annotation.documentRevisionId
    );
    return scene === undefined ? null : annotation;
  }

  async #prepareSceneMusicQueueSearchSerially(
    command: SearchSceneMusicQueuesCommand,
  ): Promise<PreparedSceneMusicQueueSearch> {
    this.#assertAssistantWorkExists(command.workId);
    const sceneAnnotation = await this.#readCurrentSceneAnnotationForMusicSerially(
      command.workId,
      command.sceneKey,
    );
    if (sceneAnnotation === null) {
      throw new Error(`Current scene annotation is unavailable: ${command.sceneKey}`);
    }
    if (sceneAnnotation.revision !== command.expectedAnnotationRevision) {
      throw new Error(`Scene annotation revision conflict: ${command.sceneKey}`);
    }
    const connector = this.#options.sceneMusicSearch;
    if (connector === undefined || !connector.isConnected()) {
      return Object.freeze({
        result: parseSceneMusicQueueSearchResult({
          schemaVersion: 1,
          status: "connection-required",
        }),
      });
    }
    if (
      !Number.isSafeInteger(connector.searchLimit) ||
      connector.searchLimit < 1 ||
      !Number.isSafeInteger(connector.tracksPerOption) ||
      connector.tracksPerOption < 1 ||
      connector.tracksPerOption > connector.searchLimit
    ) {
      throw new Error("Scene music queue profile is invalid");
    }
    return Object.freeze({
      command,
      sceneAnnotation,
      execute: () => connector.execute({
        query: command.query,
        limit: connector.searchLimit,
      }),
    });
  }

  async #recordSceneMusicQueueSearchSerially(
    prepared: Exclude<
      PreparedSceneMusicQueueSearch,
      { result: SceneMusicQueueSearchResult }
    >,
    tracks: readonly YouTubeVideoProjection[],
  ): Promise<SceneMusicQueueSearchResult> {
    const connector = this.#options.sceneMusicSearch;
    if (connector === undefined) {
      throw new Error("Scene music search connector is unavailable");
    }
    const parsedTracks = Object.freeze(tracks.map((track, index) => {
      const parsed = parseYouTubeVideoProjection(
        track,
        `Scene music search tracks[${index}]`,
      );
      if (parsed.providerId !== connector.providerId) {
        throw new Error("Scene music search returned a mismatched track");
      }
      return parsed;
    }));
    const options = Object.freeze(Array.from(
      { length: Math.ceil(parsedTracks.length / connector.tracksPerOption) },
      (_value, index) => Object.freeze({
        optionId: entityId<"SceneMusicQueueOption">(randomUUID()),
        tracks: Object.freeze(parsedTracks.slice(
          index * connector.tracksPerOption,
          (index + 1) * connector.tracksPerOption,
        )),
      }),
    ));
    const currentAnnotation =
      await this.#readCurrentSceneAnnotationForMusicSerially(
        prepared.command.workId,
        prepared.command.sceneKey,
      );
    const integrity =
      currentAnnotation?.sceneAnnotationId ===
          prepared.sceneAnnotation.sceneAnnotationId &&
        currentAnnotation.revision === prepared.sceneAnnotation.revision
        ? "current" as const
        : "stale" as const;
    const createdAt = new Date().toISOString();
    const candidate = parseSceneMusicQueueCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      revision: 1,
      workId: prepared.command.workId,
      sceneKey: prepared.command.sceneKey,
      sceneAnnotationId: prepared.sceneAnnotation.sceneAnnotationId,
      sceneAnnotationRevision: prepared.sceneAnnotation.revision,
      providerId: connector.providerId,
      query: prepared.command.query,
      status: "ready",
      integrity,
      options,
      selectedOptionId: null,
      createdAt,
      updatedAt: createdAt,
    });
    this.#database.prepare(`
      INSERT INTO scene_music_queue_candidates (
        id, schema_version, request_id, revision, work_id, scene_key,
        scene_annotation_id, scene_annotation_revision, provider_id,
        query_text, status, options_json, selected_option_id, created_at,
        updated_at
      ) VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, ?, 'ready', ?, NULL, ?, ?)
    `).run(
      candidate.candidateId,
      prepared.command.requestId,
      candidate.workId,
      candidate.sceneKey,
      candidate.sceneAnnotationId,
      candidate.sceneAnnotationRevision,
      candidate.providerId,
      candidate.query,
      JSON.stringify(candidate.options),
      candidate.createdAt,
      candidate.updatedAt,
    );
    return parseSceneMusicQueueSearchResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  async #listSceneMusicQueueCandidatesSerially(
    command: ListSceneMusicQueueCandidatesCommand,
  ): Promise<SceneMusicQueueCandidateList> {
    this.#assertAssistantWorkExists(command.workId);
    const projection = await this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const annotations = new Map(
      readStoredSceneAnnotationRows(this.#database, command.workId).map(
        (annotation) => [annotation.sceneKey, annotation] as const,
      ),
    );
    const currentSceneKeys = new Set(projection.scenes.flatMap((scene) => {
      const annotation = annotations.get(scene.sceneKey);
      return scene.integrity === "resolved" &&
          scene.range !== null &&
          annotation !== undefined &&
          scene.documentId === annotation.documentId &&
          scene.documentRevisionId === annotation.documentRevisionId
        ? [scene.sceneKey]
        : [];
    }));
    const candidates = readStoredSceneMusicQueueCandidateRows(
      this.#database,
      command.workId,
    ).map((candidate) => {
      const annotation = annotations.get(candidate.sceneKey);
      return parseSceneMusicQueueCandidate({
        ...candidate,
        integrity:
          currentSceneKeys.has(candidate.sceneKey) &&
            annotation?.sceneAnnotationId === candidate.sceneAnnotationId &&
            annotation.revision === candidate.sceneAnnotationRevision
            ? "current"
            : "stale",
      });
    });
    return parseSceneMusicQueueCandidateList({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #selectSceneMusicQueueSerially(
    command: SelectSceneMusicQueueCommand,
  ): Promise<SceneMusicQueueCandidate> {
    this.#assertAssistantWorkExists(command.workId);
    const stored = readStoredSceneMusicQueueCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (stored === null) {
      throw new Error(`Unknown scene music queue Candidate: ${command.candidateId}`);
    }
    if (stored.revision !== command.expectedCandidateRevision) {
      throw new Error(
        `Scene music queue Candidate revision conflict: ${command.candidateId}`,
      );
    }
    if (stored.status === "superseded") {
      throw new Error("Superseded scene music queue Candidate cannot be selected");
    }
    if (!stored.options.some((option) => option.optionId === command.optionId)) {
      throw new Error(`Unknown scene music queue option: ${command.optionId}`);
    }
    const currentAnnotation =
      await this.#readCurrentSceneAnnotationForMusicSerially(
        command.workId,
        stored.sceneKey,
      );
    if (
      currentAnnotation === null ||
      currentAnnotation.sceneAnnotationId !== stored.sceneAnnotationId ||
      currentAnnotation.revision !== stored.sceneAnnotationRevision
    ) {
      throw new Error("Stale scene music queue Candidate cannot be selected");
    }
    const changedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        UPDATE scene_music_queue_candidates
        SET revision = revision + 1, status = 'superseded', updated_at = ?
        WHERE
          work_id = ? AND scene_key = ? AND status = 'selected' AND id <> ?
      `).run(
        changedAt,
        command.workId,
        stored.sceneKey,
        stored.candidateId,
      );
      const selected = this.#database.prepare(`
        UPDATE scene_music_queue_candidates
        SET
          revision = revision + 1,
          status = 'selected',
          selected_option_id = ?,
          updated_at = ?
        WHERE
          work_id = ? AND id = ? AND revision = ?
          AND status IN ('ready', 'selected')
      `).run(
        command.optionId,
        changedAt,
        command.workId,
        command.candidateId,
        command.expectedCandidateRevision,
      );
      if (Number(selected.changes) !== 1) {
        throw new Error(
          `Scene music queue Candidate revision conflict: ${command.candidateId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const next = readStoredSceneMusicQueueCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (next === null) {
      throw new Error(`Scene music queue Candidate disappeared: ${command.candidateId}`);
    }
    return parseSceneMusicQueueCandidate({ ...next, integrity: "current" });
  }

  #runAssistantNotationReviewSerially(
    command: RunAssistantNotationReviewCommand,
  ): AssistantNotationReviewResult {
    this.#assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-selected-notation-review" ||
      !destination.capabilities.includes("vocabulary-lookup")
    ) {
      throw new Error(`Unknown notation review destination: ${command.destinationId}`);
    }
    const sourceTarget = this.#documentTargets.get(command.sourceRange.documentId);
    if (sourceTarget === undefined) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "source-unavailable",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.workId !== command.workId) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "outside-work",
        documentId: command.sourceRange.documentId,
      });
    }
    if (sourceTarget.currentRevisionId !== command.sourceRange.documentRevisionId) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "stale-context",
        documentId: command.sourceRange.documentId,
      });
    }
    if (command.sourceRange.to > sourceTarget.text.length) {
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: "invalid-range",
        documentId: command.sourceRange.documentId,
      });
    }
    const authorization = this.#authorizeAssistantContextAccessSerially(
      parseAssistantContextRequest({
        schemaVersion: 1,
        requestId: command.requestId,
        workId: command.workId,
        conversationId: command.conversationId,
        capability: "vocabulary-lookup",
        destinationId: command.destinationId,
        requiredLocalScope: destination.requiredLocalScope,
        requiredExternalScope: destination.requiredExternalScope,
        readRanges: [command.sourceRange],
        transmittedRanges: [],
      }),
    );
    if (!authorization.allowed) {
      if (authorization.reason === "permission-required") {
        return parseAssistantNotationReviewResult({
          schemaVersion: 1,
          status: "permission-required",
          missing: authorization.missing,
        });
      }
      return parseAssistantNotationReviewResult({
        schemaVersion: 1,
        status: "context-rejected",
        reason: authorization.reason,
        documentId: authorization.documentId,
      });
    }
    const selectedText = sourceTarget.text.slice(
      command.sourceRange.from,
      command.sourceRange.to,
    );
    const report = diagnoseManuscriptPreflight(
      selectedText,
      this.#getManuscriptPreflightSettingsSerially(command.workId).settings,
      createManuscriptPreflightBoundaryContext(
        sourceTarget.text,
        command.sourceRange,
      ),
    );
    const candidate = parseAssistantNotationCandidate({
      schemaVersion: 1,
      candidateId: randomUUID(),
      workId: command.workId,
      conversationId: command.conversationId,
      destinationId: command.destinationId,
      sourceRange: command.sourceRange,
      findings: createAssistantNotationFindings({
        sourceRange: command.sourceRange,
        report,
      }),
      regexError: report.regexError,
      receiptId: authorization.receipt.receiptId,
      createdAt: new Date().toISOString(),
    });
    this.#database
      .prepare(`
        INSERT INTO assistant_notation_candidates (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          source_range_json,
          findings_json,
          regex_error,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        candidate.candidateId,
        candidate.workId,
        candidate.conversationId,
        candidate.destinationId,
        JSON.stringify(candidate.sourceRange),
        JSON.stringify(candidate.findings),
        candidate.regexError,
        candidate.receiptId,
        candidate.createdAt,
      );
    return parseAssistantNotationReviewResult({
      schemaVersion: 1,
      status: "candidate",
      candidate,
    });
  }

  #runAssistantSettingReviewSerially(
    command: RunAssistantSettingReviewCommand,
  ): AssistantSettingReviewResult {
    this.#assertAssistantWorkExists(command.workId);
    const destination = this.#getAssistantDestinationProfile().destinations.find(
      (entry) => entry.destinationId === command.destinationId,
    );
    if (
      destination === undefined ||
      destination.kind !== "local-exact-setting-review" ||
      !destination.capabilities.includes("lore-review")
    ) {
      throw new Error(`Unknown setting review destination: ${command.destinationId}`);
    }
    const grants = this.#readAssistantPermissionGrants(
      command.workId,
      command.conversationId,
    );
    const permission = authorizeAssistantSettingReview({
      command,
      grants,
      settings: [],
    });
    if (!permission.allowed) {
      return parseAssistantSettingReviewResult({
        schemaVersion: 1,
        status: "permission-required",
        missing: permission.missing,
      });
    }
    const authorization = authorizeAssistantSettingReview({
      command,
      grants,
      settings: this.#readAssistantSettingReviewSources(command.workId),
    });
    if (!authorization.allowed) {
      throw new Error("Assistant setting review permission changed during execution");
    }
    const createdAt = new Date().toISOString();
    const receipt = createAssistantSettingReviewReceipt({
      authorization,
      receiptId: randomUUID(),
      createdAt,
    });
    const findings = Object.freeze(
      findExactDuplicateSettingGroups(authorization.settings).map((group) =>
        parseAssistantSettingReviewFinding({
          schemaVersion: 1,
          findingId: randomUUID(),
          workId: command.workId,
          conversationId: command.conversationId,
          destinationId: command.destinationId,
          kind: "duplicate",
          settingKind: group.settingKind,
          label: group.label,
          references: group.references,
          receiptId: receipt.receiptId,
          createdAt,
        })
      ),
    );
    const conflicts = Object.freeze(
      findExactSettingConflictGroups(authorization.settings).map((group) =>
        parseAssistantSettingConflictFinding({
          schemaVersion: 1,
          findingId: randomUUID(),
          workId: command.workId,
          conversationId: command.conversationId,
          destinationId: command.destinationId,
          kind: "conflict",
          settingKind: group.settingKind,
          label: group.label,
          field: group.field,
          references: group.references,
          receiptId: receipt.receiptId,
          createdAt,
        })
      ),
    );
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const grantId of authorization.consumedGrantIds) {
        const current = grants.find((grant) => grant.grantId === grantId);
        if (current === undefined) {
          throw new Error(`Unknown consumed assistant grant: ${grantId}`);
        }
        const consumed = this.#database
          .prepare(`
            UPDATE assistant_context_permission_grants
            SET revision = revision + 1, consumed_at = ?
            WHERE
              work_id = ? AND
              id = ? AND
              revision = ? AND
              duration = 'once' AND
              revoked_at IS NULL AND
              consumed_at IS NULL
          `)
          .run(
            createdAt,
            command.workId,
            grantId,
            current.revision,
          );
        if (Number(consumed.changes) !== 1) {
          throw new Error(`Assistant context permission changed: ${grantId}`);
        }
      }
      this.#database
        .prepare(`
          INSERT INTO assistant_setting_review_receipts (
            id,
            schema_version,
            request_id,
            work_id,
            conversation_id,
            destination_id,
            reviewed_settings_json,
            transmitted_setting_count,
            grant_ids_json,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, ?, ?)
        `)
        .run(
          receipt.receiptId,
          receipt.requestId,
          receipt.workId,
          receipt.conversationId,
          receipt.destinationId,
          JSON.stringify(receipt.reviewedSettings),
          JSON.stringify(receipt.grantIds),
          receipt.createdAt,
        );
      const insertFinding = this.#database.prepare(`
        INSERT INTO assistant_setting_review_findings (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          finding_kind,
          setting_kind,
          duplicate_label,
          references_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, 'duplicate', ?, ?, ?, ?, ?)
      `);
      for (const finding of findings) {
        insertFinding.run(
          finding.findingId,
          finding.workId,
          finding.conversationId,
          finding.destinationId,
          finding.settingKind,
          finding.label,
          JSON.stringify(finding.references),
          finding.receiptId,
          finding.createdAt,
        );
      }
      const insertConflict = this.#database.prepare(`
        INSERT INTO assistant_setting_conflict_findings (
          id,
          schema_version,
          work_id,
          conversation_id,
          destination_id,
          finding_kind,
          setting_kind,
          duplicate_label,
          field_name,
          references_json,
          receipt_id,
          created_at
        ) VALUES (?, 1, ?, ?, ?, 'conflict', ?, ?, ?, ?, ?, ?)
      `);
      for (const finding of conflicts) {
        insertConflict.run(
          finding.findingId,
          finding.workId,
          finding.conversationId,
          finding.destinationId,
          finding.settingKind,
          finding.label,
          finding.field,
          JSON.stringify(finding.references),
          finding.receiptId,
          finding.createdAt,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseAssistantSettingReviewResult({
      schemaVersion: 1,
      status: "reviewed",
      receipt,
      findings,
      conflicts,
    });
  }

  #scheduleItemStorageValues(item: WorkScheduleItemInput): {
    readonly kind: WorkScheduleItemInput["kind"];
    readonly label: string;
    readonly scheduleDate: string;
    readonly scheduleTime: string | null;
    readonly workloadJson: string | null;
  } {
    if (item.kind === "routine") {
      return {
        kind: item.kind,
        label: item.label,
        scheduleDate: item.startDate,
        scheduleTime: item.time,
        workloadJson: null,
      };
    }
    return {
      kind: item.kind,
      label: item.label,
      scheduleDate: item.date,
      scheduleTime: item.time,
      workloadJson:
        item.kind === "dday" ? JSON.stringify(item.workload) : null,
    };
  }

  #parseWorkScheduleRow(
    row: Record<string, unknown>,
  ): WorkScheduleItemProjection {
    const label = "Work schedule item row";
    const kind = readRequiredString(row, "kind", label);
    const common = {
      schemaVersion: readRequiredInteger(row, "schemaVersion", label),
      itemId: readRequiredString(row, "itemId", label),
      workId: readRequiredString(row, "workId", label),
      revision: readRequiredInteger(row, "revision", label),
      kind,
      label: readRequiredString(row, "label", label),
      time: readNullableString(row, "scheduleTime", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    };
    const scheduleDate = readRequiredString(row, "scheduleDate", label);
    const workloadJson = readNullableString(row, "workloadJson", label);
    const completedAt = readNullableString(row, "completedAt", label);
    if (kind === "task") {
      if (workloadJson !== null) {
        throw new Error("Schedule task must not contain D-DAY workload");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        date: scheduleDate,
        completedAt,
      });
    }
    if (kind === "routine") {
      if (workloadJson !== null || completedAt !== null) {
        throw new Error("Schedule routine row contains unsupported state");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        startDate: scheduleDate,
      });
    }
    if (kind === "dday") {
      if (workloadJson === null || completedAt !== null) {
        throw new Error("Schedule D-DAY row is incomplete");
      }
      return parseWorkScheduleItemProjection({
        ...common,
        kind,
        date: scheduleDate,
        workload: parseWorkScheduleDdayWorkload(JSON.parse(workloadJson)),
      });
    }
    throw new Error(`Unsupported Work schedule item kind: ${kind}`);
  }

  #readWorkScheduleItems(
    workId: EntityId<"Work">,
  ): readonly WorkScheduleItemProjection[] {
    return Object.freeze(
      this.#database
        .prepare(`
          SELECT
            id AS "itemId",
            schema_version AS "schemaVersion",
            revision,
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            work_id AS "workId",
            kind,
            label,
            schedule_date AS "scheduleDate",
            schedule_time AS "scheduleTime",
            workload_json AS "workloadJson",
            completed_at AS "completedAt"
          FROM work_schedule_items
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY schedule_date, COALESCE(schedule_time, ''), created_at, id
        `)
        .all(workId)
        .map((row) => this.#parseWorkScheduleRow(row)),
    );
  }

  #readWorkScheduleItem(
    workId: EntityId<"Work">,
    itemId: EntityId<"WorkScheduleItem">,
  ): WorkScheduleItemProjection {
    const item = this.#readWorkScheduleItems(workId).find(
      (candidate) => candidate.itemId === itemId,
    );
    if (item === undefined) {
      throw new Error(`Unknown Work schedule item: ${workId}/${itemId}`);
    }
    return item;
  }

  #listWorkScheduleSerially(
    command: ListWorkScheduleCommand,
  ): WorkScheduleProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const items = this.#readWorkScheduleItems(command.workId);
    const routineCompletions: WorkRoutineCompletion[] = this.#database
      .prepare(`
        SELECT
          c.routine_id AS "itemId",
          c.occurrence_date AS "date",
          c.completed_at AS "completedAt"
        FROM work_routine_completions AS c
        JOIN work_schedule_items AS i
          ON i.work_id = c.work_id
          AND i.id = c.routine_id
        WHERE
          c.work_id = ?
          AND c.occurrence_date >= ?
          AND c.occurrence_date <= ?
          AND i.kind = 'routine'
          AND i.retired_at IS NULL
        ORDER BY c.occurrence_date, c.routine_id
      `)
      .all(command.workId, command.range.from, command.range.to)
      .map((row) => ({
        itemId: entityId<"WorkScheduleItem">(
          readRequiredString(row, "itemId", "Routine completion row"),
        ),
        date: readRequiredString(row, "date", "Routine completion row"),
        completedAt: readRequiredString(
          row,
          "completedAt",
          "Routine completion row",
        ),
      }));
    return parseWorkScheduleProjection({
      schemaVersion: 1,
      workId: command.workId,
      range: command.range,
      items,
      occurrences: deriveWorkScheduleOccurrences({
        workId: command.workId,
        range: command.range,
        items,
        routineCompletions,
      }),
      episodeProgress: deriveWorkEpisodeCharacterProgress({
        workId: command.workId,
        defaultEpisodeCharacters:
          this.#getAppSettingsSerially().settings.defaultEpisodeCharacters,
        documents: work.documents.map((document) => {
          const target = this.#documentTargets.get(document.documentId);
          if (target === undefined || target.workId !== command.workId) {
            throw new Error(
              `Work/document boundary violation: ${command.workId}/${document.documentId}`,
            );
          }
          return {
            workId: target.workId,
            documentId: target.documentId,
            text: target.text,
          };
        }),
      }),
    });
  }

  #listWorkCalendarSerially(
    command: ListWorkScheduleCommand,
  ): WorkCalendarProjection {
    const schedule = this.#listWorkScheduleSerially(command);
    const completedDocumentCount = readRequiredInteger(
      this.#database.prepare(`
        SELECT COUNT(*) AS count
        FROM document_completion_status AS dc
        JOIN documents AS d
          ON d.work_id = dc.work_id
          AND d.id = dc.document_id
        JOIN works AS w
          ON w.id = dc.work_id
        WHERE
          dc.work_id = ?
          AND dc.completed_at IS NOT NULL
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
      `).all(command.workId)[0] ?? {},
      "count",
      "Completed Document count row",
    );
    const completionOccurrences = this.#database
      .prepare(`
        SELECT
          dc.document_id AS "documentId",
          d.title AS "documentTitle",
          dc.completed_at AS "completedAt",
          dc.completed_date AS "completedDate",
          dc.completed_document_revision_id AS "completedDocumentRevisionId",
          m.current_revision_id AS "currentDocumentRevisionId"
        FROM document_completion_status AS dc
        JOIN documents AS d
          ON d.work_id = dc.work_id
          AND d.id = dc.document_id
        JOIN manuscripts AS m
          ON m.work_id = d.work_id
          AND m.document_id = d.id
          AND m.id = d.manuscript_id
        JOIN works AS w
          ON w.id = dc.work_id
        WHERE
          dc.work_id = ?
          AND dc.completed_at IS NOT NULL
          AND dc.completed_date >= ?
          AND dc.completed_date <= ?
          AND w.retired_at IS NULL
          AND d.retired_at IS NULL
          AND d.archived_at IS NULL
        ORDER BY dc.completed_date, dc.completed_at, dc.document_id
      `)
      .all(command.workId, command.range.from, command.range.to)
      .map((row) => {
        const documentId = entityId<"Document">(
          readRequiredString(
            row,
            "documentId",
            "Document completion occurrence row",
          ),
        );
        const documentTitle = readRequiredString(
          row,
          "documentTitle",
          "Document completion occurrence row",
        );
        const completedDocumentRevisionId = entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "completedDocumentRevisionId",
            "Document completion occurrence row",
          ),
        );
        const currentDocumentRevisionId = entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "currentDocumentRevisionId",
            "Document completion occurrence row",
          ),
        );
        return {
          occurrenceId: `document-completion:${documentId}`,
          workId: command.workId,
          documentId,
          documentTitle,
          kind: "document-completion" as const,
          label: `${documentTitle} 완료`,
          date: readRequiredString(
            row,
            "completedDate",
            "Document completion occurrence row",
          ),
          time: null,
          completed: true,
          completedAt: readRequiredString(
            row,
            "completedAt",
            "Document completion occurrence row",
          ),
          completedDocumentRevisionId,
          state: completedDocumentRevisionId === currentDocumentRevisionId
            ? "current" as const
            : "edited-after-completion" as const,
        };
      });
    return parseWorkCalendarProjection({
      ...schedule,
      occurrences: [...schedule.occurrences, ...completionOccurrences],
      completedDocumentCount,
    });
  }

  #getStudioTodaySerially(
    command: GetStudioTodayCommand,
  ): StudioTodayProjection {
    return projectStudioToday({
      date: command.date,
      works: this.#catalog.works.map((work) => ({
        workId: work.workId,
        workTitle: work.title,
        calendar: this.#listWorkCalendarSerially({
          schemaVersion: 1,
          workId: work.workId,
          range: { from: command.date, to: command.date },
        }),
      })),
    });
  }

  #createWorkScheduleItemSerially(
    command: CreateWorkScheduleItemCommand,
  ): WorkScheduleItemProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const itemId = entityId<"WorkScheduleItem">(randomUUID());
    const now = new Date().toISOString();
    const values = this.#scheduleItemStorageValues(command.item);
    this.#database
      .prepare(`
        INSERT INTO work_schedule_items (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          kind,
          label,
          schedule_date,
          schedule_time,
          workload_json,
          completed_at
        ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(
        itemId,
        now,
        now,
        command.workId,
        values.kind,
        values.label,
        values.scheduleDate,
        values.scheduleTime,
        values.workloadJson,
      );
    return this.#readWorkScheduleItem(command.workId, itemId);
  }

  #updateWorkScheduleItemSerially(
    command: UpdateWorkScheduleItemCommand,
  ): WorkScheduleItemProjection {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.kind !== command.item.kind) {
      throw new Error("Work schedule item kind cannot be changed");
    }
    const values = this.#scheduleItemStorageValues(command.item);
    const updated = this.#database
      .prepare(`
        UPDATE work_schedule_items
        SET
          revision = revision + 1,
          updated_at = ?,
          label = ?,
          schedule_date = ?,
          schedule_time = ?,
          workload_json = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `)
      .run(
        new Date().toISOString(),
        values.label,
        values.scheduleDate,
        values.scheduleTime,
        values.workloadJson,
        command.workId,
        command.itemId,
        command.expectedRevision,
      );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Work schedule item changed: ${command.itemId}`);
    }
    return this.#readWorkScheduleItem(command.workId, command.itemId);
  }

  #retireWorkScheduleItemSerially(
    command: RetireWorkScheduleItemCommand,
  ): void {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    const now = new Date().toISOString();
    const retired = this.#database
      .prepare(`
        UPDATE work_schedule_items
        SET revision = revision + 1, updated_at = ?, retired_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `)
      .run(
        now,
        now,
        command.workId,
        command.itemId,
        command.expectedRevision,
      );
    if (Number(retired.changes) !== 1) {
      throw new Error(`Work schedule item changed: ${command.itemId}`);
    }
  }

  #setWorkScheduleCompletionSerially(
    command: SetWorkScheduleCompletionCommand,
  ): WorkScheduleItemProjection {
    const current = this.#readWorkScheduleItem(command.workId, command.itemId);
    if (current.revision !== command.expectedRevision) {
      throw new Error(
        `Work schedule item revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
      );
    }
    if (current.kind === "dday") {
      throw new Error("D-DAY does not support completion state");
    }
    if (current.kind === "task") {
      if (command.date !== current.date) {
        throw new Error("Schedule task completion date must match its date");
      }
      if ((current.completedAt !== null) === command.completed) return current;
      const now = new Date().toISOString();
      const updated = this.#database
        .prepare(`
          UPDATE work_schedule_items
          SET revision = revision + 1, updated_at = ?, completed_at = ?
          WHERE
            work_id = ?
            AND id = ?
            AND revision = ?
            AND retired_at IS NULL
        `)
        .run(
          now,
          command.completed ? now : null,
          command.workId,
          command.itemId,
          command.expectedRevision,
        );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work schedule item changed: ${command.itemId}`);
      }
      return this.#readWorkScheduleItem(command.workId, command.itemId);
    }
    if (command.date < current.startDate) {
      throw new Error("Routine completion date precedes its start date");
    }
    if (command.completed) {
      this.#database
        .prepare(`
          INSERT OR IGNORE INTO work_routine_completions (
            work_id,
            routine_id,
            occurrence_date,
            completed_at
          ) VALUES (?, ?, ?, ?)
        `)
        .run(
          command.workId,
          command.itemId,
          command.date,
          new Date().toISOString(),
        );
    } else {
      this.#database
        .prepare(`
          DELETE FROM work_routine_completions
          WHERE work_id = ? AND routine_id = ? AND occurrence_date = ?
        `)
        .run(command.workId, command.itemId, command.date);
    }
    return current;
  }

  #getWorkRecordsGoalsSerially(
    workId: EntityId<"Work">,
  ): WorkRecordsGoalsProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          goals_json AS "goalsJson"
        FROM work_records_goals
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkRecordsGoalsProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        goals: createUnsetWorkRecordsGoals(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work records goals identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Work records goals row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Work records goals schemaVersion must be 1");
    }
    return parseWorkRecordsGoalsProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Work records goals row",
      ),
      goals: parseWorkRecordsGoals(
        JSON.parse(
          readRequiredString(
            row,
            "goalsJson",
            "Work records goals row",
          ),
        ),
      ),
    });
  }

  #saveWorkRecordsGoalsSerially(
    command: SaveWorkRecordsGoalsCommand,
  ): WorkRecordsGoalsProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const serializedGoals = JSON.stringify(command.goals);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_records_goals
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Work records goals identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Work records goals row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Work records goals revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_records_goals (
              work_id,
              schema_version,
              revision,
              goals_json,
              updated_at
            ) VALUES (?, 1, 1, ?, ?)
          `)
          .run(command.workId, serializedGoals, updatedAt);
      } else {
        this.#database
          .prepare(`
            UPDATE work_records_goals
            SET
              revision = revision + 1,
              goals_json = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(serializedGoals, updatedAt, command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getWorkRecordsGoalsSerially(command.workId);
  }

  #getContinuousReadingProgressSerially(
    workId: EntityId<"Work">,
  ): WorkContinuousReadingProgressProjection {
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          document_id AS "documentId",
          document_revision_id AS "documentRevisionId",
          text_offset AS "textOffset"
        FROM work_continuous_reading_progress
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkContinuousReadingProgressProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        location: createUnsetContinuousReadingProgress(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Continuous reading progress identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Continuous reading progress row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Continuous reading progress schemaVersion must be 1");
    }
    const documentId = readNullableIdentity<"Document">(
      row,
      "documentId",
      "Continuous reading progress row",
    );
    const documentRevisionId = readNullableIdentity<"DocumentRevision">(
      row,
      "documentRevisionId",
      "Continuous reading progress row",
    );
    const textOffsetValue = row.textOffset;
    if (
      (textOffsetValue !== null &&
        (!Number.isSafeInteger(textOffsetValue) || (textOffsetValue as number) < 0)) ||
      ((documentId === null || documentRevisionId === null) !==
        (textOffsetValue === null)) ||
      ((documentId === null) !== (documentRevisionId === null))
    ) {
      throw new Error("Continuous reading progress row location is invalid");
    }
    return parseWorkContinuousReadingProgressProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(
        row,
        "revision",
        "Continuous reading progress row",
      ),
      location:
        documentId === null ||
        documentRevisionId === null ||
        textOffsetValue === null
          ? null
          : {
              documentId,
              documentRevisionId,
              textOffset: textOffsetValue,
            },
    });
  }

  #saveContinuousReadingProgressSerially(
    command: SaveContinuousReadingProgressCommand,
  ): WorkContinuousReadingProgressProjection {
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (command.location !== null) {
      const document = work.documents.find(
        (candidate) => candidate.documentId === command.location?.documentId,
      );
      if (document === undefined) {
        throw new Error(
          `Continuous reading Document is outside Work: ${command.location.documentId}`,
        );
      }
      const source = this.#documentProfile.documents.find(
        (candidate) => candidate.documentId === document.documentId,
      );
      if (
        source === undefined ||
        source.documentRevisionId !== command.location.documentRevisionId ||
        !splitContinuousReadingLines(source.initialText).some(
          (line) => line.textOffset === command.location?.textOffset,
        )
      ) {
        throw new Error(
          `Continuous reading text offset is stale for Document ${document.documentId}`,
        );
      }
    }

    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_continuous_reading_progress
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Continuous reading progress identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Continuous reading progress row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Continuous reading progress revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      const location = command.location;
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_continuous_reading_progress (
              work_id,
              schema_version,
              revision,
              document_id,
              document_revision_id,
              text_offset,
              updated_at
            ) VALUES (?, 1, 1, ?, ?, ?, ?)
          `)
          .run(
            command.workId,
            location?.documentId ?? null,
            location?.documentRevisionId ?? null,
            location?.textOffset ?? null,
            updatedAt,
          );
      } else {
        this.#database
          .prepare(`
            UPDATE work_continuous_reading_progress
            SET
              revision = revision + 1,
              document_id = ?,
              document_revision_id = ?,
              text_offset = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(
            location?.documentId ?? null,
            location?.documentRevisionId ?? null,
            location?.textOffset ?? null,
            updatedAt,
            command.workId,
          );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getContinuousReadingProgressSerially(command.workId);
  }

  #getWorkReadthroughSerially(
    workId: EntityId<"Work">,
  ): WorkReadthroughProjection {
    const work = this.#catalog.works.find((candidate) => candidate.workId === workId);
    if (work === undefined) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          entries_json AS "entriesJson"
        FROM work_readthrough_settings
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseWorkReadthroughProjection({
        schemaVersion: 1,
        workId,
        revision: 0,
        entries: createUnsetWorkReadthrough(),
      });
    }
    if (rows.length !== 1) {
      throw new Error(`Work readthrough identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Work readthrough row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Work readthrough schemaVersion must be 1");
    }
    const projection = parseWorkReadthroughProjection({
      schemaVersion,
      workId,
      revision: readRequiredInteger(row, "revision", "Work readthrough row"),
      entries: JSON.parse(
        readRequiredString(row, "entriesJson", "Work readthrough row"),
      ),
    });
    const ownedDocumentIds = new Set(
      work.documents.map((document) => document.documentId),
    );
    for (const entry of projection.entries) {
      if (!ownedDocumentIds.has(entry.documentId)) {
        throw new Error(
          `Work readthrough Document is outside Work: ${entry.documentId}`,
        );
      }
    }
    return projection;
  }

  #saveWorkReadthroughSerially(
    command: SaveWorkReadthroughCommand,
  ): WorkReadthroughProjection {
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const ownedDocumentIds = new Set(
      work.documents.map((document) => document.documentId),
    );
    for (const entry of command.entries) {
      if (!ownedDocumentIds.has(entry.documentId)) {
        throw new Error(
          `Work readthrough Document is outside Work: ${entry.documentId}`,
        );
      }
    }

    const serializedEntries = JSON.stringify(command.entries);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const currentRows = this.#database
        .prepare(`
          SELECT revision
          FROM work_readthrough_settings
          WHERE work_id = ?
        `)
        .all(command.workId);
      if (currentRows.length > 1) {
        throw new Error(
          `Work readthrough identity is ambiguous: ${command.workId}`,
        );
      }
      const currentRevision =
        currentRows.length === 0
          ? 0
          : readRequiredInteger(
              currentRows[0] ?? {},
              "revision",
              "Work readthrough row",
            );
      if (currentRevision !== command.expectedRevision) {
        throw new Error(
          `Work readthrough revision conflict: expected ${command.expectedRevision}, current ${currentRevision}`,
        );
      }
      if (currentRevision === 0) {
        this.#database
          .prepare(`
            INSERT INTO work_readthrough_settings (
              work_id,
              schema_version,
              revision,
              entries_json,
              updated_at
            ) VALUES (?, 1, 1, ?, ?)
          `)
          .run(command.workId, serializedEntries, updatedAt);
      } else {
        this.#database
          .prepare(`
            UPDATE work_readthrough_settings
            SET
              revision = revision + 1,
              entries_json = ?,
              updated_at = ?
            WHERE work_id = ?
          `)
          .run(serializedEntries, updatedAt, command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getWorkReadthroughSerially(command.workId);
  }

  #getManuscriptPreflightSettingsSerially(
    workId: EntityId<"Work">,
  ): ManuscriptPreflightSettingsProjection {
    const preflightProfile = this.#getPreflightProfile();
    if (!this.#catalog.works.some((work) => work.workId === workId)) {
      throw new Error(`Unknown Work: ${workId}`);
    }
    const rows = this.#database
      .prepare(`
        SELECT
          schema_version AS "schemaVersion",
          revision,
          settings_json AS "settingsJson"
        FROM manuscript_preflight_settings
        WHERE work_id = ?
      `)
      .all(workId);
    if (rows.length === 0) {
      return parseManuscriptPreflightSettingsProjection(
        {
          schemaVersion: 1,
          workId,
          revision: 0,
          settings: createDefaultManuscriptPreflightSettings(
            preflightProfile,
          ),
        },
        preflightProfile,
      );
    }
    if (rows.length !== 1) {
      throw new Error(`Preflight settings identity is ambiguous: ${workId}`);
    }
    const row = rows[0] ?? {};
    const schemaVersion = readRequiredInteger(
      row,
      "schemaVersion",
      "Manuscript preflight settings row",
    );
    if (schemaVersion !== 1) {
      throw new Error("Manuscript preflight settings schemaVersion must be 1");
    }
    const settingsJson = readRequiredString(
      row,
      "settingsJson",
      "Manuscript preflight settings row",
    );
    return parseManuscriptPreflightSettingsProjection(
      {
        schemaVersion,
        workId,
        revision: readRequiredInteger(
          row,
          "revision",
          "Manuscript preflight settings row",
        ),
        settings: parseManuscriptPreflightSettings(
          JSON.parse(settingsJson),
          preflightProfile,
        ),
      },
      preflightProfile,
    );
  }

  #saveManuscriptPreflightSettingsSerially(
    command: ReturnType<typeof parseSaveManuscriptPreflightSettingsCommand>,
  ): ManuscriptPreflightSettingsProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const serializedSettings = JSON.stringify(command.settings);
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO manuscript_preflight_settings (
            work_id,
            schema_version,
            revision,
            settings_json,
            updated_at
          ) VALUES (?, 1, 1, ?, ?)
          ON CONFLICT(work_id) DO UPDATE SET
            revision = manuscript_preflight_settings.revision + 1,
            settings_json = excluded.settings_json,
            updated_at = excluded.updated_at
        `)
        .run(command.workId, serializedSettings, updatedAt);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#getManuscriptPreflightSettingsSerially(command.workId);
  }

  createBackupBundle(
    finalBundleRoot: string,
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#assertOpen();
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#backupService.createBundle(finalBundleRoot);
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  restoreBackupBundle(
    finalBundleRoot: string,
    targetFinalRoot: string,
  ): Promise<LocalWorkspaceBackupSummary> {
    this.#assertOpen();
    const execution = this.#createPending.then(async () => {
      await this.#savePending;
      return this.#backupService.restoreBundle(
        finalBundleRoot,
        targetFinalRoot,
      );
    });
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  #listDocumentRevisionsSerially(
    command: ListDocumentRevisionsCommand,
  ): DocumentRevisionListProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#database
      .prepare(DOCUMENT_REVISION_ROWS_SQL)
      .all(command.workId, command.documentId)
      .map((row, index) => {
        const label = `Document revision rows[${index}]`;
        const isCurrent = readRequiredInteger(row, "isCurrent", label);
        if (isCurrent !== 0 && isCurrent !== 1) {
          throw new Error(`${label}.isCurrent must be zero or one`);
        }
        return {
          schemaVersion: 1,
          revisionId: readRequiredString(row, "revisionId", label),
          workId: readRequiredString(row, "workId", label),
          documentId: readRequiredString(row, "documentId", label),
          parentRevisionId: readNullableIdentity<"DocumentRevision">(
            row,
            "parentRevisionId",
            label,
          ),
          length: readRequiredInteger(row, "length", label),
          cause: readRequiredString(row, "cause", label),
          createdAt: readRequiredString(row, "createdAt", label),
          durableAt: readRequiredString(row, "durableAt", label),
          isCurrent: isCurrent === 1,
        };
      });
    return parseDocumentRevisionListProjection({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      revisions,
    });
  }

  async #readDocumentRevisionSerially(
    command: ReadDocumentRevisionCommand,
  ): Promise<DocumentRevisionContentProjection> {
    const revisions = this.#listDocumentRevisionsSerially(command);
    const revision = revisions.revisions.find(
      (candidate) => candidate.revisionId === command.revisionId,
    );
    if (revision === undefined) {
      throw new Error(
        `DocumentRevision is outside its Document: ${command.revisionId}`,
      );
    }
    return parseDocumentRevisionContentProjection({
      schemaVersion: 1,
      revision,
      text: await this.#revisionStore.materialize(command.revisionId),
    });
  }

  async #restoreDocumentRevisionSerially(
    command: RestoreDocumentRevisionCommand,
  ): Promise<RestoreDocumentRevisionResult> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const revisions = this.#listDocumentRevisionsSerially(command);
    if (
      !revisions.revisions.some(
        (revision) => revision.revisionId === command.targetRevisionId,
      )
    ) {
      throw new Error(
        `DocumentRevision is outside its Document: ${command.targetRevisionId}`,
      );
    }
    const restoredText = await this.#revisionStore.materialize(
      command.targetRevisionId,
    );
    const restoredEditorStateJson = readRevisionEditorStateJson(
      this.#database,
      {
        revisionId: command.targetRevisionId,
        workId: command.workId,
        documentId: command.documentId,
      },
    );
    const restoredAt = new Date().toISOString();
    const restored = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: command.workId,
      documentId: command.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: restoredText,
      ...(restoredEditorStateJson === undefined
        ? {}
        : { editorStateJson: restoredEditorStateJson }),
      cause: JSON.stringify({
        kind: "restore-document-revision",
        targetRevisionId: command.targetRevisionId,
      }),
      createdAt: restoredAt,
      durableAt: restoredAt,
    });
    target.baseRevisionId = restored.id;
    target.currentRevisionId = restored.id;
    target.nextSequence = 0;
    target.text = restoredText;
    await this.#reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
    });
    return parseRestoreDocumentRevisionResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: command.targetRevisionId,
      restoredRevisionId: restored.id,
    });
  }

  async #createWorkSnapshotSerially(
    command: CreateWorkSnapshotCommand,
  ): Promise<WorkSnapshotProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const documentRevisions = [...this.#documentTargets.values()]
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
        const label = `Work structure revision rows[${index}]`;
        return {
          entityKind: readRequiredString(row, "entityKind", label),
          entityId: readRequiredString(row, "entityId", label),
          revision: readRequiredInteger(row, "revision", label),
        };
      });
    const structureRevisionRefsJson = JSON.stringify(structureRevisionRefs);
    const manifest = JSON.stringify({
      schemaVersion: 1,
      workId: command.workId,
      documentRevisions,
      structureRevisionRefs,
    });
    const manifestHash = createHash(
      LOCAL_WORKSPACE_CONTENT_HASH_ALGORITHM,
    )
      .update(manifest, "utf8")
      .digest("hex");
    const createdAt = new Date().toISOString();
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "workSnapshot",
        id: workSnapshotId,
        workId: command.workId,
        documentRevisions,
        structureRevisionRefsJson,
        manifestHash,
        label: command.label,
        cause: "manual",
        createdAt,
      });
    });
    const snapshots = this.#listWorkSnapshotsSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = snapshots.snapshots.find(
      (snapshot) => snapshot.workSnapshotId === workSnapshotId,
    );
    if (created === undefined) {
      throw new Error(`Stored WorkSnapshot is missing: ${workSnapshotId}`);
    }
    return created;
  }

  #listWorkSnapshotsSerially(
    command: ListWorkSnapshotsCommand,
  ): WorkSnapshotListProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = this.#database
      .prepare(WORK_SNAPSHOT_ROWS_SQL)
      .all(command.workId);
    const snapshots = new Map<
      EntityId<"WorkSnapshot">,
      {
        readonly schemaVersion: 1;
        readonly workSnapshotId: EntityId<"WorkSnapshot">;
        readonly workId: EntityId<"Work">;
        readonly label: string;
        readonly cause: string;
        readonly manifestHash: string;
        readonly createdAt: string;
        readonly documentRevisions: Array<{
          readonly documentId: EntityId<"Document">;
          readonly documentRevisionId: EntityId<"DocumentRevision">;
        }>;
      }
    >();
    rows.forEach((row, index) => {
      const label = `Work snapshot rows[${index}]`;
      const workSnapshotId = entityId<"WorkSnapshot">(
        readRequiredString(row, "workSnapshotId", label),
      );
      let snapshot = snapshots.get(workSnapshotId);
      if (snapshot === undefined) {
        snapshot = {
          schemaVersion: 1,
          workSnapshotId,
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          label: readRequiredString(row, "label", label),
          cause: readRequiredString(row, "cause", label),
          manifestHash: readRequiredString(row, "manifestHash", label),
          createdAt: readRequiredString(row, "createdAt", label),
          documentRevisions: [],
        };
        snapshots.set(workSnapshotId, snapshot);
      }
      const documentId = row.documentId;
      const documentRevisionId = row.documentRevisionId;
      if (documentId === null && documentRevisionId === null) {
        return;
      }
      if (
        typeof documentId !== "string" ||
        documentId.length === 0 ||
        typeof documentRevisionId !== "string" ||
        documentRevisionId.length === 0
      ) {
        throw new Error(`${label} has an incomplete DocumentRevision entry`);
      }
      snapshot.documentRevisions.push({
        documentId: entityId<"Document">(documentId),
        documentRevisionId: entityId<"DocumentRevision">(
          documentRevisionId,
        ),
      });
    });
    return parseWorkSnapshotListProjection({
      schemaVersion: 1,
      workId: command.workId,
      snapshots: [...snapshots.values()],
    });
  }

  async #compareWorkSnapshotSerially(
    command: CompareWorkSnapshotCommand,
  ): Promise<WorkSnapshotComparisonProjection> {
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const snapshot = this.#listWorkSnapshotsSerially({
      schemaVersion: 1,
      workId: command.workId,
    }).snapshots.find(
      (candidate) => candidate.workSnapshotId === command.workSnapshotId,
    );
    if (snapshot === undefined) {
      throw new Error(
        `Unknown WorkSnapshot for Work: ${command.workSnapshotId}/${command.workId}`,
      );
    }
    const titleRows = this.#database
      .prepare(`
        SELECT id AS "documentId", title
        FROM documents
        WHERE work_id = ?
      `)
      .all(command.workId);
    const titleByDocument = new Map<EntityId<"Document">, string>();
    titleRows.forEach((row, index) => {
      const label = `WorkSnapshot comparison Document rows[${index}]`;
      const documentId = entityId<"Document">(
        readRequiredString(row, "documentId", label),
      );
      if (titleByDocument.has(documentId)) {
        throw new Error(`Duplicate Document for WorkSnapshot comparison: ${documentId}`);
      }
      titleByDocument.set(
        documentId,
        readRequiredString(row, "title", label),
      );
    });
    const materialize = async (input: {
      readonly documentId: EntityId<"Document">;
      readonly documentRevisionId: EntityId<"DocumentRevision">;
      readonly title: string;
    }): Promise<MaterializedWorkSnapshotDocument> => {
      const revision = await this.#revisionStore.getRevision(
        input.documentRevisionId,
      );
      if (revision === null || revision.documentId !== input.documentId) {
        throw new Error(
          `WorkSnapshot revision is outside Document: ${input.documentRevisionId}/${input.documentId}`,
        );
      }
      return Object.freeze({
        ...input,
        text: await this.#revisionStore.materialize(input.documentRevisionId),
      });
    };
    const snapshotDocuments = await Promise.all(
      snapshot.documentRevisions.map((reference) => {
        const title = titleByDocument.get(reference.documentId);
        if (title === undefined) {
          throw new Error(
            `WorkSnapshot Document is outside Work: ${reference.documentId}`,
          );
        }
        return materialize({ ...reference, title });
      }),
    );
    const currentDocuments = await Promise.all(
      work.documents.map((document) => {
        const target = this.#documentTargets.get(document.documentId);
        if (target === undefined || target.workId !== command.workId) {
          throw new Error(
            `Current WorkSnapshot comparison target is outside Work: ${document.documentId}`,
          );
        }
        return materialize({
          documentId: document.documentId,
          documentRevisionId: target.currentRevisionId,
          title: document.title,
        });
      }),
    );
    return deriveWorkSnapshotComparison({
      command,
      snapshot,
      snapshotDocuments,
      currentDocuments,
    });
  }

  async #startWritingSessionSerially(
    command: StartWritingSessionCommand,
  ): Promise<WorkActivityProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const sessions = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    );
    if (sessions.some((session) => session.state === "active")) {
      throw new Error(`Work already has an active WritingSession: ${command.workId}`);
    }
    const policies = readWorkActivityPolicyIds(this.#database, command.workId);
    const now = new Date().toISOString();
    const sessionId = entityId<"WritingSession">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "writingSession",
        ...createRecordMeta(now),
        id: sessionId,
        workId: command.workId,
        documentId: command.documentId,
        policyId: policies.activityPolicyId,
        state: "active",
        startedAt: now,
        lastDurableHeartbeatAt: now,
        startRevisionId: target.currentRevisionId,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
    });
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #stopWritingSessionSerially(
    command: StopWritingSessionCommand,
  ): Promise<WorkActivityProjection> {
    const session = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.sessionId === command.sessionId);
    if (session === undefined) {
      throw new Error(`Unknown WritingSession: ${command.sessionId}`);
    }
    if (session.state !== "active") {
      throw new Error(`WritingSession is not active: ${command.sessionId}`);
    }
    if (session.documentId === null) {
      throw new Error(`WritingSession has no Document: ${command.sessionId}`);
    }
    const target = this.#documentTargets.get(session.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${session.documentId}`,
      );
    }
    const endedAt = new Date().toISOString();
    const intervalId = entityId<"ActivityInterval">(randomUUID());
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE writing_sessions
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'completed',
          ended_at = ?,
          last_durable_heartbeat_at = ?,
          end_revision_id = ?
        WHERE id = ? AND work_id = ? AND state = 'active'
      `).run(
        endedAt,
        endedAt,
        endedAt,
        target.currentRevisionId,
        command.sessionId,
        command.workId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`WritingSession changed before stop: ${command.sessionId}`);
      }
      this.#database.prepare(`
        INSERT INTO activity_intervals (
          id,
          work_id,
          session_id,
          activity_class,
          started_at,
          ended_at,
          document_id,
          evidence_count,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        intervalId,
        command.workId,
        command.sessionId,
        "manuscript",
        session.startedAt,
        endedAt,
        session.documentId,
        0,
        "manual",
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #startFocusCycleSerially(
    command: StartFocusCycleCommand,
  ): Promise<WorkActivityProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const cycles = readStoredFocusCycleRows(this.#database, command.workId);
    if (cycles.some((cycle) => cycle.state === "running" || cycle.state === "paused")) {
      throw new Error(`Work already has an active FocusCycle: ${command.workId}`);
    }
    const activeSession = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    ).find((session) => session.state === "active");
    const policies = readWorkActivityPolicyIds(this.#database, command.workId);
    const startedAt = new Date().toISOString();
    const deadlineAt = new Date(
      Date.parse(startedAt) + command.targetDurationMs,
    ).toISOString();
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "focusCycle",
        ...createRecordMeta(startedAt),
        id: focusCycleId,
        workId: command.workId,
        ...(activeSession === undefined
          ? {}
          : { sessionId: activeSession.sessionId }),
        policyId: policies.focusPolicyId,
        phaseRef: command.phaseRef,
        state: "running",
        targetDuration: command.targetDurationMs,
        startedAt,
        deadlineAt,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
    });
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #stopFocusCycleSerially(
    command: StopFocusCycleCommand,
  ): Promise<WorkActivityProjection> {
    const focusCycle = readStoredFocusCycleRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.focusCycleId === command.focusCycleId);
    if (focusCycle === undefined) {
      throw new Error(`Unknown FocusCycle: ${command.focusCycleId}`);
    }
    if (focusCycle.state !== "running") {
      throw new Error(`FocusCycle is not running: ${command.focusCycleId}`);
    }
    const completedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE focus_cycles
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'stopped',
          completed_at = ?
        WHERE id = ? AND work_id = ? AND state = 'running'
      `).run(
        completedAt,
        completedAt,
        command.focusCycleId,
        command.workId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`FocusCycle changed before stop: ${command.focusCycleId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#listWorkActivitySerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #listWorkActivitySerially(
    command: ListWorkActivityCommand,
  ): Promise<WorkActivityProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const sessionRows = readStoredWritingSessionRows(
      this.#database,
      command.workId,
    );
    const intervals = readStoredActivityIntervalRows(
      this.#database,
      command.workId,
    );
    const intervalDurationBySession = new Map<string, number>();
    for (const interval of intervals) {
      const durationMs = Math.max(
        0,
        readTimestamp(interval.endedAt, "ActivityInterval.endedAt") -
          readTimestamp(interval.startedAt, "ActivityInterval.startedAt"),
      );
      intervalDurationBySession.set(
        interval.sessionId,
        (intervalDurationBySession.get(interval.sessionId) ?? 0) + durationMs,
      );
    }
    const sessions: WritingSessionProjection[] = await Promise.all(
      sessionRows.map(async (session) => {
        let characterDelta: number | null = null;
        if (
          session.startRevisionId !== null &&
          session.endRevisionId !== null
        ) {
          const [startText, endText] = await Promise.all([
            this.#revisionStore.materialize(session.startRevisionId),
            this.#revisionStore.materialize(session.endRevisionId),
          ]);
          characterDelta = endText.length - startText.length;
        }
        const activeDurationMs =
          session.state === "active"
            ? Math.max(
                intervalDurationBySession.get(session.sessionId) ?? 0,
                Date.now() - readTimestamp(session.startedAt, "WritingSession.startedAt"),
              )
            : (intervalDurationBySession.get(session.sessionId) ?? 0);
        return {
          schemaVersion: 1,
          sessionId: session.sessionId,
          workId: session.workId,
          documentId: session.documentId,
          state: session.state,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          activeDurationMs,
          startRevisionId: session.startRevisionId,
          endRevisionId: session.endRevisionId,
          characterDelta,
          note: session.note,
        };
      }),
    );
    const focusCycles: FocusCycleProjection[] = readStoredFocusCycleRows(
      this.#database,
      command.workId,
    ).map((cycle) => {
      const policy = readFocusPolicyRowById(
        this.#database,
        command.workId,
        cycle.policyId,
      );
      const pomodoroPlan = readPomodoroPolicyPlan(policy);
      return {
        schemaVersion: 1,
        focusCycleId: cycle.focusCycleId,
        workId: cycle.workId,
        sessionId: cycle.sessionId,
        state: cycle.state,
        phaseRef:
          pomodoroPlan === null
            ? cycle.phaseRef
            : findPomodoroPhaseDefinition(pomodoroPlan, cycle.phaseRef).phase,
        targetDurationMs: cycle.targetDurationMs,
        startedAt: cycle.startedAt,
        deadlineAt: cycle.deadlineAt,
        remainingDurationMs: cycle.remainingAtPause,
        pauseReason: cycle.pauseReason,
        completedAt: cycle.completedAt,
        note: cycle.note,
      };
    });
    return parseWorkActivityProjection({
      schemaVersion: 1,
      workId: command.workId,
      activeSessionId:
        sessions.find((session) => session.state === "active")?.sessionId ?? null,
      activeFocusCycleId:
        focusCycles.find(
          (cycle) => cycle.state === "running" || cycle.state === "paused",
        )?.focusCycleId ?? null,
      sessions,
      focusCycles,
    });
  }

  #getPomodoroSerially(command: GetPomodoroCommand): PomodoroProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs: Date.now(),
    });
  }

  #configureAndStartPomodoroSerially(
    command: ConfigureAndStartPomodoroCommand,
  ): PomodoroProjection {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const active = readStoredFocusCycleRows(this.#database, command.workId).find(
      (cycle) => cycle.state === "running" || cycle.state === "paused",
    );
    if (active !== undefined) {
      throw new Error(`Work already has an active FocusCycle: ${command.workId}`);
    }
    const currentPolicy = readCurrentFocusPolicyRow(
      this.#database,
      command.workId,
    );
    const plan = createPomodoroPolicyPlan(
      {
        workDurationMs: command.workDurationMs,
        breakDurationMs: command.breakDurationMs,
        workCycleCount: command.workCycleCount,
        autoAdvance: command.autoAdvance,
      },
      () => randomUUID(),
    );
    const firstPhase = plan.phases.find((phase) => phase.phase === "work");
    if (firstPhase === undefined) {
      throw new Error("Configured Pomodoro has no work phase");
    }
    const policyId = randomUUID();
    const focusCycleId = entityId<"FocusCycle">(randomUUID());
    const nowMs = Date.now();
    const startedAt = new Date(nowMs).toISOString();
    const phaseDefinitionsJson = serializePomodoroPolicyPlan(plan);
    const completionPolicy = plan.settings.autoAdvance
      ? "auto-advance"
      : "manual";
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const insertedPolicy = this.#database.prepare(`
        INSERT INTO focus_policies (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          phase_definitions_json,
          background_policy,
          music_start_policy,
          completion_policy,
          visibility
        )
        SELECT
          ?,
          schema_version,
          1,
          ?,
          ?,
          NULL,
          work_id,
          ?,
          background_policy,
          music_start_policy,
          ?,
          visibility
        FROM focus_policies
        WHERE work_id = ? AND id = ? AND retired_at IS NULL
      `).run(
        policyId,
        startedAt,
        startedAt,
        phaseDefinitionsJson,
        completionPolicy,
        command.workId,
        currentPolicy.policyId,
      );
      if (Number(insertedPolicy.changes) !== 1) {
        throw new Error(`Current Work focus policy changed: ${command.workId}`);
      }
      const updatedSettings = this.#database.prepare(`
        UPDATE work_settings
        SET focus_policy_id = ?, revision = revision + 1
        WHERE work_id = ? AND focus_policy_id = ?
      `).run(policyId, command.workId, currentPolicy.policyId);
      if (Number(updatedSettings.changes) !== 1) {
        throw new Error(`Work focus settings changed: ${command.workId}`);
      }
      insertPomodoroCycle({
        database: this.#database,
        focusCycleId,
        workId: command.workId,
        sessionId: readActiveWritingSessionId(this.#database, command.workId),
        policyId,
        phaseRef: firstPhase.phaseRef,
        state: "running",
        pauseReason: null,
        targetDurationMs: firstPhase.targetDurationMs,
        startedAt,
        deadlineAt: new Date(nowMs + firstPhase.targetDurationMs).toISOString(),
        remainingAtPause: null,
        note: command.note,
      });
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #pausePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      cycle.state !== "running" ||
      cycle.deadlineAt === null
    ) {
      throw new Error(`Pomodoro phase is not running: ${command.focusCycleId}`);
    }
    const remainingDurationMs = Math.max(
      0,
      readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
    );
    if (remainingDurationMs === 0) {
      transitionCompletedPomodoroPhase({
        database: this.#database,
        workId: command.workId,
        focusCycleId: command.focusCycleId,
        nowMs,
        restore: false,
      });
    } else {
      const updatedAt = new Date(nowMs).toISOString();
      const updated = this.#database.prepare(`
        UPDATE focus_cycles
        SET
          revision = revision + 1,
          updated_at = ?,
          state = 'paused',
          pause_reason = 'manual',
          deadline_at = NULL,
          remaining_at_pause = ?
        WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
      `).run(
        updatedAt,
        remainingDurationMs,
        command.focusCycleId,
        command.workId,
        policy.policyId,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Pomodoro phase changed before pause: ${command.focusCycleId}`);
      }
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #resumePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      cycle.state !== "paused" ||
      cycle.remainingAtPause === null ||
      cycle.remainingAtPause <= 0
    ) {
      throw new Error(`Pomodoro phase is not paused: ${command.focusCycleId}`);
    }
    const updatedAt = new Date(nowMs).toISOString();
    const deadlineAt = new Date(nowMs + cycle.remainingAtPause).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'running',
        pause_reason = NULL,
        deadline_at = ?,
        remaining_at_pause = NULL
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'paused'
    `).run(
      updatedAt,
      deadlineAt,
      command.focusCycleId,
      command.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before resume: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #reconcilePomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    transitionCompletedPomodoroPhase({
      database: this.#database,
      workId: command.workId,
      focusCycleId: command.focusCycleId,
      nowMs,
      restore: false,
    });
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #updatePomodoroNoteSerially(
    command: UpdatePomodoroNoteCommand,
  ): PomodoroProjection {
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (cycle === undefined) {
      throw new Error(`Unknown Pomodoro phase: ${command.focusCycleId}`);
    }
    if (cycle.state !== "running" && cycle.state !== "paused") {
      throw new Error(`Pomodoro phase is not active: ${command.focusCycleId}`);
    }
    const nowMs = Date.now();
    const updatedAt = new Date(nowMs).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET revision = revision + 1, updated_at = ?, note = ?
      WHERE id = ? AND work_id = ? AND state IN ('running', 'paused')
    `).run(
      updatedAt,
      command.note.length === 0 ? null : command.note,
      command.focusCycleId,
      command.workId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before note save: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  #stopPomodoroSerially(command: PomodoroPhaseCommand): PomodoroProjection {
    const nowMs = Date.now();
    const policy = readCurrentFocusPolicyRow(this.#database, command.workId);
    if (readPomodoroPolicyPlan(policy) === null) {
      throw new Error(`Current Work has no configured Pomodoro: ${command.workId}`);
    }
    const cycle = readStoredFocusCycleRows(this.#database, command.workId).find(
      (candidate) => candidate.focusCycleId === command.focusCycleId,
    );
    if (
      cycle === undefined ||
      cycle.policyId !== policy.policyId ||
      (cycle.state !== "running" && cycle.state !== "paused")
    ) {
      throw new Error(`Pomodoro phase is not active: ${command.focusCycleId}`);
    }
    const remainingDurationMs = cycle.state === "paused"
      ? cycle.remainingAtPause
      : cycle.deadlineAt === null
        ? null
        : Math.max(
            0,
            readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
          );
    const completedAt = new Date(nowMs).toISOString();
    const updated = this.#database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'stopped',
        pause_reason = NULL,
        deadline_at = NULL,
        remaining_at_pause = ?,
        completed_at = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state IN ('running', 'paused')
    `).run(
      completedAt,
      remainingDurationMs,
      completedAt,
      command.focusCycleId,
      command.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before stop: ${command.focusCycleId}`);
    }
    return deriveStoredPomodoroProjection({
      database: this.#database,
      workId: command.workId,
      nowMs,
    });
  }

  async #createEventBlockSerially(
    command: CreateEventBlockCommand,
  ): Promise<EventBlockProjection> {
    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.#prepareEventSourceRange(
      command,
      eventBlockId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(
        createAnchorLedgerRecord(command.workId, sourceRange.anchor),
      );
      transaction.write({
        kind: "rangeGroup",
        ...meta,
        id: sourceRange.rangeGroupId,
        workId: command.workId,
        orderedAnchorIds: [sourceRange.anchorId],
      });
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: command.title,
        ...(command.note.length === 0 ? {} : { note: command.note }),
        outlineOrderKey: this.#nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: "primary",
      });
    });
    const projection = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventBlocks.find(
      (eventBlock) => eventBlock.eventBlockId === eventBlockId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventBlock is missing: ${eventBlockId}`);
    }
    return created;
  }

  async #createAnchorlessEventSerially(
    command: CreateAnchorlessEventCommand,
  ): Promise<EventBlockProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: command.title,
        ...(command.note.length === 0 ? {} : { note: command.note }),
        outlineOrderKey: this.#nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
    });
    const projection = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventBlocks.find(
      (eventBlock) => eventBlock.eventBlockId === eventBlockId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventBlock is missing: ${eventBlockId}`);
    }
    return created;
  }

  #nextEventOutlineOrderKey(
    workId: EntityId<"Work">,
    createdAt: string,
    eventBlockId: EntityId<"EventBlock">,
  ): string {
    const events = readStoredEventBlockRows(this.#database, workId);
    if (events.length === 0) return "0/1";
    if (events.every((event) =>
      isFractionalEventOutlineOrderKey(event.outlineOrderKey)
    )) {
      return createOrderKeyBetween(events.at(-1)?.outlineOrderKey ?? null, null);
    }
    return JSON.stringify([createdAt, eventBlockId]);
  }

  async #moveEventBlockSerially(
    command: MoveEventBlockCommand,
  ): Promise<EventBlockListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const events = [...readStoredEventBlockRows(this.#database, command.workId)];
    const current = events.find(
      (event) => event.eventBlockId === command.eventBlockId,
    );
    if (current === undefined || current.retiredAt !== null) {
      throw new Error(`Unknown active EventBlock: ${command.eventBlockId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`EventBlock revision conflict: ${command.eventBlockId}`);
    }
    if (
      command.beforeEventBlockId === command.eventBlockId ||
      command.afterEventBlockId === command.eventBlockId
    ) {
      throw new Error("EventBlock cannot be its own move neighbor");
    }

    const remaining = events.filter(
      (event) => event.eventBlockId !== command.eventBlockId,
    );
    const beforeIndex = command.beforeEventBlockId === undefined
      ? -1
      : remaining.findIndex(
          (event) => event.eventBlockId === command.beforeEventBlockId,
        );
    const afterIndex = command.afterEventBlockId === undefined
      ? -1
      : remaining.findIndex(
          (event) => event.eventBlockId === command.afterEventBlockId,
        );
    if (command.beforeEventBlockId !== undefined && beforeIndex < 0) {
      throw new Error(
        `Move predecessor is outside the Work: ${command.beforeEventBlockId}`,
      );
    }
    if (command.afterEventBlockId !== undefined && afterIndex < 0) {
      throw new Error(
        `Move successor is outside the Work: ${command.afterEventBlockId}`,
      );
    }
    if (
      command.beforeEventBlockId !== undefined &&
      command.afterEventBlockId !== undefined &&
      beforeIndex + 1 !== afterIndex
    ) {
      throw new Error("Move neighbors are not adjacent in the Event outline");
    }
    if (
      command.beforeEventBlockId !== undefined &&
      command.afterEventBlockId === undefined &&
      beforeIndex !== remaining.length - 1
    ) {
      throw new Error("Move predecessor is not the final EventBlock");
    }
    if (
      command.beforeEventBlockId === undefined &&
      command.afterEventBlockId !== undefined &&
      afterIndex !== 0
    ) {
      throw new Error("Move successor is not the first EventBlock");
    }
    if (
      command.beforeEventBlockId === undefined &&
      command.afterEventBlockId === undefined &&
      remaining.length !== 0
    ) {
      throw new Error("Move without neighbors requires an empty Event outline");
    }

    const insertionIndex = command.beforeEventBlockId === undefined
      ? 0
      : beforeIndex + 1;
    const ordered = [...remaining];
    ordered.splice(insertionIndex, 0, current);
    if (ordered.every((event, index) =>
      event.eventBlockId === events[index]?.eventBlockId
    )) {
      return this.#listEventBlocksSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
    }

    const updatedAt = new Date().toISOString();
    const allFractional = events.every((event) =>
      isFractionalEventOutlineOrderKey(event.outlineOrderKey)
    );
    const previous = ordered[insertionIndex - 1] ?? null;
    const next = ordered[insertionIndex + 1] ?? null;
    const orderKey = allFractional
      ? createOrderKeyBetween(
          previous?.outlineOrderKey ?? null,
          next?.outlineOrderKey ?? null,
        )
      : null;
    if (
      orderKey !== null &&
      orderKey.length <= this.#options.defaults.plotBoard.orderKeyLengthLimit
    ) {
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "eventBlockOutlineMove",
          id: current.eventBlockId,
          workId: command.workId,
          expectedRevision: command.expectedRevision,
          outlineOrderKey: orderKey,
          updatedAt,
        });
      });
    } else {
      const rebalancedKeys = createRebalancedOrderKeys(ordered.length);
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "eventBlockOutlineRebalance",
          workId: command.workId,
          updatedAt,
          events: ordered.map((event, index) => ({
            id: event.eventBlockId,
            expectedRevision: event.revision,
            outlineOrderKey: rebalancedKeys[index] as string,
          })),
        });
      });
    }
    return this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #linkEventSourceSerially(
    command: LinkEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const eventBlock = readStoredEventBlockRows(
      this.#database,
      command.workId,
    ).find((candidate) => candidate.eventBlockId === command.eventBlockId);
    if (eventBlock === undefined) {
      throw new Error(`Unknown EventBlock: ${command.eventBlockId}`);
    }
    const createdAt = new Date().toISOString();
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.#prepareEventSourceRange(
      command,
      eventSourceId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(
        createAnchorLedgerRecord(command.workId, sourceRange.anchor),
      );
      transaction.write({
        kind: "rangeGroup",
        ...meta,
        id: sourceRange.rangeGroupId,
        workId: command.workId,
        orderedAnchorIds: [sourceRange.anchorId],
      });
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId: command.eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: command.role,
      });
    });
    const projection = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventSources.find(
      (source) => source.eventSourceId === eventSourceId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventSource is missing: ${eventSourceId}`);
    }
    return created;
  }

  async #replaceEventSourceSerially(
    command: ReplaceEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const current = readStoredEventSourceRows(
      this.#database,
      command.workId,
    ).find((source) => source.eventSourceId === command.eventSourceId);
    if (
      current === undefined ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`EventSource revision conflict: ${command.eventSourceId}`);
    }
    const createdAt = new Date().toISOString();
    const eventSourceId = entityId<"EventSource">(randomUUID());
    const sourceRange = await this.#prepareEventSourceRange(
      command,
      eventSourceId,
      createdAt,
    );
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(
        createAnchorLedgerRecord(command.workId, sourceRange.anchor),
      );
      transaction.write({
        kind: "rangeGroup",
        ...meta,
        id: sourceRange.rangeGroupId,
        workId: command.workId,
        orderedAnchorIds: [sourceRange.anchorId],
      });
      transaction.write({
        kind: "eventSource",
        ...meta,
        id: eventSourceId,
        workId: command.workId,
        eventBlockId: current.eventBlockId,
        rangeGroupId: sourceRange.rangeGroupId,
        role: current.role,
        replacesEventSourceId: current.eventSourceId,
        expectedReplacedRevision: command.expectedRevision,
      });
    });
    const projection = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.eventSources.find(
      (source) => source.eventSourceId === eventSourceId,
    );
    if (created === undefined) {
      throw new Error(`Stored EventSource is missing: ${eventSourceId}`);
    }
    return created;
  }

  async #retireEventSourceSerially(
    command: RetireEventSourceCommand,
  ): Promise<EventSourceProjection> {
    const current = readStoredEventSourceRows(
      this.#database,
      command.workId,
    ).find((source) => source.eventSourceId === command.eventSourceId);
    if (
      current === undefined ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`EventSource revision conflict: ${command.eventSourceId}`);
    }
    const currentProjection = await this.#projectEventSourceRow(current);
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "eventSourceRetirement",
        id: command.eventSourceId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    return parseEventSourceProjection({
      ...currentProjection,
      revision: currentProjection.revision + 1,
      updatedAt: retiredAt,
      retiredAt,
    });
  }

  async #prepareEventSourceRange(
    command: {
      readonly workId: EntityId<"Work">;
      readonly documentId: EntityId<"Document">;
      readonly selection: {
        readonly anchor: number;
        readonly head: number;
      };
      readonly exactQuote: string;
    },
    commandRef: EntityId<"EventBlock"> | EntityId<"EventSource">,
    createdAt: string,
  ) {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("EventSource selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "EventSource selected quote does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rangeGroupId = entityId<"RangeGroup">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef,
      actorRef: work.studioId,
    });
    return Object.freeze({ rangeGroupId, anchorId, anchor });
  }

  async #listEventBlocksSerially(
    command: ListEventBlocksCommand,
  ): Promise<EventBlockListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredEventBlockRows(this.#database, command.workId);
    const eventBlocks = Object.freeze(
      rows.map((row) => parseEventBlockProjection({
        schemaVersion: 1,
        eventBlockId: row.eventBlockId,
        revision: row.revision,
        workId: row.workId,
        title: row.title,
        note: row.note,
        parentEventId: row.parentEventId,
        outlineOrderKey: row.outlineOrderKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        retiredAt: row.retiredAt,
      })),
    );
    const eventSources = await Promise.all(
      readStoredEventSourceRows(this.#database, command.workId).map((row) =>
        this.#projectEventSourceRow(row),
      ),
    );
    return parseEventBlockListProjection({
      schemaVersion: 1,
      workId: command.workId,
      eventBlocks,
      eventSources,
    });
  }

  async #projectEventSourceRow(
    row: StoredEventSourceRow,
  ): Promise<EventSourceProjection> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const anchors = await Promise.all(row.anchors.map(async (anchor) => {
      const target = this.#documentTargets.get(anchor.documentId);
      if (target === undefined || target.workId !== row.workId) {
        throw new Error(
          `EventSource document is outside its Work: ${row.eventSourceId}`,
        );
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: anchor.anchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity =
        resolution.status === "resolved"
          ? "resolved"
          : resolution.status === "needsReview"
            ? "needsReview"
            : "broken";
      return {
        anchorId: anchor.anchorId,
        documentId: anchor.documentId,
        documentRevisionId: target.currentRevisionId,
        exactQuote: anchor.exactQuote,
        integrity,
        range:
          resolution.status === "resolved"
            ? {
                from: resolution.range.startOffset,
                to: resolution.range.endOffset,
              }
            : null,
      };
    }));
    return parseEventSourceProjection({
      schemaVersion: 1,
      eventSourceId: row.eventSourceId,
      revision: row.revision,
      workId: row.workId,
      eventBlockId: row.eventBlockId,
      rangeGroupId: row.rangeGroupId,
      role: row.role,
      anchors,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      retiredAt: row.retiredAt,
    });
  }

  async #listEventRailSerially(
    command: ListEventRailCommand,
  ): Promise<EventRailProjection> {
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const events = await this.#listEventBlocksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const links = this.#listPlotEventLinksSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    return deriveEventRailProjection({
      workId: command.workId,
      documents: work.documents.map((document, documentIndex) =>
        Object.freeze({
          documentId: document.documentId,
          title: document.title,
          documentIndex,
        }),
      ),
      eventBlocks: events.eventBlocks,
      eventSources: events.eventSources,
      plotEventLinks: links.links,
      board: this.#getDefaultPlotBoardSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    });
  }

  async #createSceneOverrideSerially(
    command: CreateSceneOverrideCommand,
  ): Promise<SceneOverrideProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("SceneOverride boundary is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactQuote) {
      throw new Error(
        "SceneOverride boundary quote does not match the current durable revision",
      );
    }
    const storedRows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(storedRows);
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const settingsRows = this.#database
      .prepare(WORK_SCENE_RULE_REVISION_SQL)
      .all(command.workId);
    const settingsRow = settingsRows[0];
    if (settingsRows.length !== 1 || settingsRow === undefined) {
      throw new Error(`Work scene settings are missing: ${command.workId}`);
    }
    const baseRuleSetRevision = readRequiredInteger(
      settingsRow,
      "baseRuleSetRevision",
      "Work scene settings",
    );
    const createdAt = new Date().toISOString();
    const sceneOverrideId = entityId<"SceneOverride">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const describeEvidence = createNodeCryptoAnchorEvidenceDescriptor(
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence,
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: sceneOverrideId,
      actorRef: work.studioId,
    });
    const sceneIdentityRecords: Poc3LedgerRecord[] = [];
    if (command.operation === "split") {
      const sceneProjection = await this.#listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const sourceScene = sceneProjection.scenes.find(
        (scene) =>
          scene.documentId === command.documentId &&
          scene.range !== null &&
          scene.range.start < from &&
          to < scene.range.end,
      );
      if (sourceScene === undefined || sourceScene.range === null) {
        throw new Error("Scene split must stay inside one current Scene");
      }
      const leftSceneId = sourceScene.sceneIdentity?.sceneId ??
        entityId<"Scene">(randomUUID());
      const rightSceneId = entityId<"Scene">(randomUUID());
      if (sourceScene.sceneIdentity === undefined) {
        sceneIdentityRecords.push({
          kind: "sceneIdentity",
          ...createRecordMeta(createdAt),
          id: leftSceneId,
          workId: command.workId,
        });
      }
      sceneIdentityRecords.push({
        kind: "sceneIdentity",
        ...createRecordMeta(createdAt),
        id: rightSceneId,
        workId: command.workId,
      });

      const segmentsToReplace = (sourceScene.sceneIdentity?.segments ?? [])
        .filter(
          (segment) =>
            segment.range !== null &&
            (segment.documentIndex > sourceScene.documentIndex ||
              (segment.documentId === command.documentId &&
                segment.range.start < sourceScene.range!.end &&
                segment.range.end > sourceScene.range!.start)),
        );
      for (const segment of segmentsToReplace) {
        sceneIdentityRecords.push({
          kind: "sceneEpisodeSegmentRetirement",
          id: segment.segmentId,
          workId: command.workId,
          retiredAt: createdAt,
        });
      }

      const segmentRanges: Array<Readonly<{
        sceneId: EntityId<"Scene">;
        documentId: EntityId<"Document">;
        start: number;
        end: number;
      }>> = [
        Object.freeze({
          sceneId: leftSceneId,
          documentId: command.documentId,
          start: sourceScene.range.start,
          end: from,
        }),
        Object.freeze({
          sceneId: rightSceneId,
          documentId: command.documentId,
          start: to,
          end: sourceScene.range.end,
        }),
        ...segmentsToReplace.flatMap((segment) => {
          if (
            segment.range === null ||
            segment.documentId === command.documentId
          ) return [];
          return [Object.freeze({
            sceneId: rightSceneId,
            documentId: segment.documentId,
            start: segment.range.start,
            end: segment.range.end,
          })];
        }),
      ];
      for (const segmentRange of segmentRanges) {
        if (segmentRange.start >= segmentRange.end) continue;
        const segmentTarget = this.#documentTargets.get(segmentRange.documentId);
        if (
          segmentTarget === undefined ||
          segmentTarget.workId !== command.workId ||
          segmentRange.end > segmentTarget.text.length
        ) {
          throw new Error("Scene split segment is outside the current Work");
        }
        const segmentId = entityId<"EpisodeSceneSegment">(randomUUID());
        const segmentAnchor = createAnchorForKnownRevisionContent({
          meta: {
            id: entityId<"Anchor">(randomUUID()),
            schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
            revision: 1,
            createdAt,
            updatedAt: createdAt,
          },
          documentId: segmentRange.documentId,
          documentRevisionId: segmentTarget.currentRevisionId,
          content: segmentTarget.text,
          startOffset: segmentRange.start,
          endOffset: segmentRange.end,
          policy: this.#options.defaults.anchorPolicy,
          commandRef: sceneOverrideId,
          actorRef: work.studioId,
          describeEvidence,
        });
        sceneIdentityRecords.push(
          createAnchorLedgerRecord(command.workId, segmentAnchor),
          {
            kind: "sceneEpisodeSegment",
            ...createRecordMeta(createdAt),
            id: segmentId,
            workId: command.workId,
            sceneId: segmentRange.sceneId,
            documentId: segmentRange.documentId,
            anchorId: segmentAnchor.meta.id,
          },
        );
      }
    } else if (command.operation === "merge") {
      const sceneProjection = await this.#listSceneProjectionSerially({
        schemaVersion: 1,
        workId: command.workId,
      });
      const leftScene = [...sceneProjection.scenes]
        .reverse()
        .find(
          (scene) =>
            scene.documentId === command.documentId &&
            scene.range !== null &&
            scene.range.end === from,
        );
      const rightScene = sceneProjection.scenes.find(
        (scene) =>
          scene.documentId === command.documentId &&
          scene.range !== null &&
          scene.range.start === to,
      );
      if (
        leftScene !== undefined &&
        leftScene.range !== null &&
        rightScene !== undefined &&
        rightScene.range !== null &&
        (leftScene.sceneIdentity !== undefined ||
          rightScene.sceneIdentity !== undefined)
      ) {
        const mergedSceneId = leftScene.sceneIdentity?.sceneId ??
          rightScene.sceneIdentity?.sceneId;
        if (mergedSceneId === undefined) {
          throw new Error("Scene merge identity is missing");
        }
        const segmentsById = new Map(
          [
            ...(leftScene.sceneIdentity?.segments ?? []),
            ...(rightScene.sceneIdentity?.segments ?? []),
          ].map((segment) => [segment.segmentId, segment] as const),
        );
        for (const segment of segmentsById.values()) {
          sceneIdentityRecords.push({
            kind: "sceneEpisodeSegmentRetirement",
            id: segment.segmentId,
            workId: command.workId,
            retiredAt: createdAt,
          });
        }
        const rangesByDocument = new Map<
          EntityId<"Document">,
          Array<{ start: number; end: number }>
        >();
        for (const segment of segmentsById.values()) {
          if (segment.range === null) continue;
          const ranges = rangesByDocument.get(segment.documentId) ?? [];
          ranges.push({
            start: segment.range.start,
            end: segment.range.end,
          });
          rangesByDocument.set(segment.documentId, ranges);
        }
        rangesByDocument.set(command.documentId, [{
          start: leftScene.range.start,
          end: rightScene.range.end,
        }]);
        for (const [documentId, ranges] of rangesByDocument) {
          const orderedRanges = [...ranges].sort(
            (left, right) => left.start - right.start || left.end - right.end,
          );
          const mergedRanges: Array<{ start: number; end: number }> = [];
          for (const range of orderedRanges) {
            const previous = mergedRanges.at(-1);
            if (previous !== undefined && range.start <= previous.end) {
              previous.end = Math.max(previous.end, range.end);
            } else {
              mergedRanges.push({ ...range });
            }
          }
          const segmentTarget = this.#documentTargets.get(documentId);
          if (segmentTarget === undefined || segmentTarget.workId !== command.workId) {
            throw new Error("Scene merge segment is outside the current Work");
          }
          for (const range of mergedRanges) {
            if (range.start >= range.end || range.end > segmentTarget.text.length) {
              throw new Error("Scene merge segment range is invalid");
            }
            const segmentAnchor = createAnchorForKnownRevisionContent({
              meta: {
                id: entityId<"Anchor">(randomUUID()),
                schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
                revision: 1,
                createdAt,
                updatedAt: createdAt,
              },
              documentId,
              documentRevisionId: segmentTarget.currentRevisionId,
              content: segmentTarget.text,
              startOffset: range.start,
              endOffset: range.end,
              policy: this.#options.defaults.anchorPolicy,
              commandRef: sceneOverrideId,
              actorRef: work.studioId,
              describeEvidence,
            });
            sceneIdentityRecords.push(
              createAnchorLedgerRecord(command.workId, segmentAnchor),
              {
                kind: "sceneEpisodeSegment",
                ...createRecordMeta(createdAt),
                id: entityId<"EpisodeSceneSegment">(randomUUID()),
                workId: command.workId,
                sceneId: mergedSceneId,
                documentId,
                anchorId: segmentAnchor.meta.id,
              },
            );
          }
        }
        const rightSceneId = rightScene.sceneIdentity?.sceneId;
        if (rightSceneId !== undefined && rightSceneId !== mergedSceneId) {
          sceneIdentityRecords.push({
            kind: "sceneIdentityRetirement",
            id: rightSceneId,
            workId: command.workId,
            retiredAt: createdAt,
          });
        }
      }
    }
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "sceneOverride",
        ...createRecordMeta(createdAt),
        id: sceneOverrideId,
        workId: command.workId,
        documentId: command.documentId,
        operation: command.operation,
        anchorIds: [anchorId],
        baseRuleSetRevision,
        ...(command.note.length === 0 ? {} : { note: command.note }),
      });
      for (const record of sceneIdentityRecords) {
        transaction.write(record);
      }
    });
    const projection = await this.#listSceneOverridesSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const created = projection.sceneOverrides.find(
      (sceneOverride) => sceneOverride.sceneOverrideId === sceneOverrideId,
    );
    if (created === undefined) {
      throw new Error(`Stored SceneOverride is missing: ${sceneOverrideId}`);
    }
    return created;
  }

  async #listSceneOverridesSerially(
    command: ListSceneOverridesCommand,
  ): Promise<SceneOverrideListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const rows = readStoredSceneOverrideRows(this.#database, command.workId);
    const grouped = new Map<
      EntityId<"SceneOverride">,
      StoredSceneOverrideRow[]
    >();
    for (const row of rows) {
      const existing = grouped.get(row.sceneOverrideId);
      if (existing === undefined) {
        grouped.set(row.sceneOverrideId, [row]);
      } else {
        existing.push(row);
      }
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const projectedSceneOverrides = await Promise.all(
      [...grouped.values()].map(async (groupRows) => {
        const first = groupRows[0];
        if (first === undefined) {
          throw new Error("SceneOverride must contain at least one Anchor");
        }
        const target = this.#documentTargets.get(first.documentId);
        if (target === undefined) {
          return null;
        }
        if (target.workId !== first.workId) {
          throw new Error(
            `SceneOverride document is outside its Work: ${first.sceneOverrideId}`,
          );
        }
        const boundaries = await Promise.all(
          groupRows.map(async (row) => {
            const resolution = await resolver.execute({
              workId: row.workId,
              anchorId: row.anchorId,
              targetRevisionId: target.currentRevisionId,
            });
            const integrity =
              resolution.status === "resolved"
                ? "resolved"
                : resolution.status === "needsReview"
                  ? "needsReview"
                  : "broken";
            return {
              anchorId: row.anchorId,
              documentRevisionId: target.currentRevisionId,
              exactQuote: row.exactQuote,
              integrity,
              range:
                resolution.status === "resolved"
                  ? {
                      from: resolution.range.startOffset,
                      to: resolution.range.endOffset,
                    }
                  : null,
            } as const;
          }),
        );
        return parseSceneOverrideProjection({
          schemaVersion: 1,
          sceneOverrideId: first.sceneOverrideId,
          workId: first.workId,
          documentId: first.documentId,
          operation: first.operation,
          baseRuleSetRevision: first.baseRuleSetRevision,
          note: first.note,
          boundaries,
          createdAt: first.createdAt,
        });
      }),
    );
    const sceneOverrides = projectedSceneOverrides.filter(
      (projection): projection is SceneOverrideProjection => projection !== null,
    );
    return parseSceneOverrideListProjection({
      schemaVersion: 1,
      workId: command.workId,
      sceneOverrides,
    });
  }

  #projectSceneRuleSetRow(
    row: StoredSceneRuleSetRow,
  ): SceneRuleSetProjection {
    let boundaryRules: unknown;
    try {
      boundaryRules = JSON.parse(row.boundaryRulesJson);
    } catch {
      throw new Error(`SceneRuleSet rules are not valid JSON: ${row.sceneRuleSetId}`);
    }
    return parseSceneRuleSetProjection({
      schemaVersion: 1,
      sceneRuleSetId: row.sceneRuleSetId,
      revision: row.revision,
      workId: row.workId,
      displayName: row.displayName,
      boundaryRules,
      normalizationPolicy: row.normalizationPolicy,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  #projectSceneEventOverrideRows(
    rows: readonly StoredSceneEventOverrideRow[],
  ): readonly SceneEventOverrideProjection[] {
    return Object.freeze(rows.map((row) =>
      parseSceneEventOverrideProjection({
        schemaVersion: 1,
        ...row,
      })));
  }

  async #listSceneProjectionSerially(
    command: ListSceneProjectionCommand,
  ): Promise<SceneProjectionList> {
    const work = this.#catalog.works.find(
      (candidate) => candidate.workId === command.workId,
    );
    if (work === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const documents = work.documents.map((document, documentIndex) => {
      const target = this.#documentTargets.get(document.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Scene projection document is unavailable: ${document.documentId}`,
        );
      }
      return Object.freeze({
        workId: command.workId,
        documentId: document.documentId,
        documentRevisionId: target.currentRevisionId,
        title: document.title,
        documentIndex,
        text: target.text,
      });
    });
    const storedSceneSegments: readonly StoredSceneEpisodeSegmentRow[] =
      Object.freeze(this.#database.prepare(SCENE_EPISODE_SEGMENT_ROWS_SQL)
        .all(command.workId)
        .map((row, index) => {
          const label = `Scene episode segment rows[${index}]`;
          return Object.freeze({
            segmentId: entityId<"EpisodeSceneSegment">(
              readRequiredString(row, "segmentId", label),
            ),
            sceneId: entityId<"Scene">(
              readRequiredString(row, "sceneId", label),
            ),
            workId: entityId<"Work">(
              readRequiredString(row, "workId", label),
            ),
            documentId: entityId<"Document">(
              readRequiredString(row, "documentId", label),
            ),
            anchorId: entityId<"Anchor">(
              readRequiredString(row, "anchorId", label),
            ),
          });
        }));
    const resolver = new ResolveAnchor({
      catalog: createCatalogFromStoredRows(readStoredDocumentRows(this.#database)),
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const sceneSegments: readonly SceneEpisodeSegmentProjection[] =
      Object.freeze(await Promise.all(storedSceneSegments.map(async (segment) => {
        const documentIndex = work.documents.findIndex(
          (document) => document.documentId === segment.documentId,
        );
        const document = work.documents[documentIndex];
        const target = this.#documentTargets.get(segment.documentId);
        if (
          documentIndex < 0 ||
          document === undefined ||
          target === undefined ||
          target.workId !== command.workId
        ) {
          throw new Error(
            `Scene episode segment is outside its Work: ${segment.segmentId}`,
          );
        }
        const resolution = await resolver.execute({
          workId: command.workId,
          anchorId: segment.anchorId,
          targetRevisionId: target.currentRevisionId,
        });
        const integrity = resolution.status === "resolved"
          ? "resolved"
          : resolution.status === "needsReview"
            ? "needsReview"
            : "broken";
        return Object.freeze({
          segmentId: segment.segmentId,
          sceneId: segment.sceneId,
          documentId: segment.documentId,
          documentRevisionId: target.currentRevisionId,
          documentTitle: document.title,
          documentIndex,
          range: resolution.status === "resolved"
            ? Object.freeze({
                start: resolution.range.startOffset,
                end: resolution.range.endOffset,
              })
            : null,
          integrity,
        });
      })));
    const [events, overrides] = await Promise.all([
      this.#listEventBlocksSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
      this.#listSceneOverridesSerially({
        schemaVersion: 1,
        workId: command.workId,
      }),
    ]);
    return deriveSceneProjection({
      workId: command.workId,
      ruleSet: this.#projectSceneRuleSetRow(
        readStoredSceneRuleSetRow(this.#database, command.workId),
      ),
      documents,
      sceneOverrides: overrides.sceneOverrides,
      eventBlocks: events.eventBlocks,
      eventSources: events.eventSources,
      sceneEventOverrides: this.#projectSceneEventOverrideRows(
        readStoredSceneEventOverrideRows(this.#database, command.workId),
      ),
      sceneSegments,
    });
  }

  async #updateSceneRuleSetSerially(
    command: UpdateSceneRuleSetCommand,
  ): Promise<SceneProjectionList> {
    const current = readStoredSceneRuleSetRow(this.#database, command.workId);
    if (
      current.sceneRuleSetId !== command.sceneRuleSetId ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`SceneRuleSet revision conflict: ${command.sceneRuleSetId}`);
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "sceneRuleSetUpdate",
        id: command.sceneRuleSetId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        displayName: command.displayName,
        boundaryRulesJson: JSON.stringify(command.boundaryRules),
        normalizationPolicy: command.normalizationPolicy,
        enabled: command.enabled,
        updatedAt,
      });
    });
    return this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  async #setSceneEventOverrideSerially(
    command: SetSceneEventOverrideCommand,
  ): Promise<SceneProjectionList> {
    const projection = await this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    if (!projection.scenes.some((scene) => scene.sceneKey === command.sceneKey)) {
      throw new Error(`Unknown SceneProjection: ${command.sceneKey}`);
    }
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null || eventBlock.retiredAt !== null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    const current = readStoredSceneEventOverrideRows(
      this.#database,
      command.workId,
    ).find(
      (candidate) =>
        candidate.sceneKey === command.sceneKey &&
        candidate.eventBlockId === command.eventBlockId,
    );
    if ((current?.revision ?? null) !== command.expectedRevision) {
      throw new Error(
        `SceneEventOverride revision conflict: ${command.sceneKey}/${command.eventBlockId}`,
      );
    }
    if (current?.operation === command.operation) return projection;
    if (current === undefined && command.operation === null) return projection;

    const changedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (current !== undefined) {
        transaction.write({
          kind: "sceneEventOverrideRetirement",
          id: current.sceneEventOverrideId,
          workId: command.workId,
          expectedRevision: current.revision,
          retiredAt: changedAt,
        });
      }
      if (command.operation !== null) {
        transaction.write({
          kind: "sceneEventOverride",
          ...createRecordMeta(changedAt),
          id: entityId<"SceneEventOverride">(randomUUID()),
          workId: command.workId,
          sceneKey: command.sceneKey,
          eventBlockId: command.eventBlockId,
          operation: command.operation,
        });
      }
    });
    return this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
  }

  #assertConfiguredFragmentKind(kindId: string): void {
    if (!this.#getFragmentProfile().kinds.some((kind) => kind.id === kindId)) {
      throw new Error(`Unknown fragment kind: ${kindId}`);
    }
  }

  async #projectFragmentRows(
    rows: readonly StoredFragmentRow[],
  ): Promise<readonly FragmentProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return parseFragmentProjection({
          schemaVersion: 1,
          ...row,
          integrity: "broken",
          range: null,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return parseFragmentProjection({
        schemaVersion: 1,
        ...row,
        integrity,
        range: resolution.status === "resolved"
          ? {
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            }
          : null,
      });
    }));
  }

  async #captureFragmentSerially(
    command: CaptureFragmentCommand,
  ): Promise<FragmentProjection> {
    this.#assertConfiguredFragmentKind(command.kindId);
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Fragment selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Fragment selected text does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const fragmentId = entityId<"Fragment">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: fragmentId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "fragment",
        ...createRecordMeta(createdAt),
        id: fragmentId,
        workId: command.workId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        kindId: command.kindId,
        title: command.title,
        pinned: false,
        useCount: 0,
      });
    });
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      fragmentId,
    );
    if (stored === null) {
      throw new Error(`Stored fragment is missing: ${fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored fragment could not be projected: ${fragmentId}`);
    }
    return projection;
  }

  async #listFragmentsSerially(
    command: ListFragmentsCommand,
  ): Promise<FragmentListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const fragments = await this.#projectFragmentRows(
      readStoredFragmentRows(this.#database, command.workId),
    );
    return parseFragmentListProjection({
      schemaVersion: 1,
      workId: command.workId,
      fragments,
    });
  }

  async #updateFragmentSerially(
    command: UpdateFragmentCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const kindId = command.changes.kindId ?? current.kindId;
    this.#assertConfiguredFragmentKind(kindId);
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        kind_id = ?,
        title = ?,
        pinned = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      kindId,
      command.changes.title ?? current.title,
      (command.changes.pinned ?? current.pinned) ? 1 : 0,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Updated fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Updated fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }

  async #recordFragmentUseSerially(
    command: RecordFragmentUseCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    if (!Number.isSafeInteger(current.useCount + 1)) {
      throw new Error(`Fragment use count cannot advance: ${command.fragmentId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        use_count = use_count + 1
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Used fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Used fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }

  async #retireFragmentSerially(
    command: RetireFragmentCommand,
  ): Promise<FragmentProjection> {
    const current = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (current === null) {
      throw new Error(
        `Work/fragment boundary violation: ${command.workId}/${command.fragmentId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Fragment is already retired: ${command.fragmentId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const retiredAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE fragments
      SET
        revision = revision + 1,
        updated_at = ?,
        retired_at = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      retiredAt,
      retiredAt,
      command.workId,
      command.fragmentId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Fragment revision conflict: ${command.fragmentId}`);
    }
    const stored = readStoredFragmentRowById(
      this.#database,
      command.workId,
      command.fragmentId,
    );
    if (stored === null) {
      throw new Error(`Retired fragment is missing: ${command.fragmentId}`);
    }
    const [projection] = await this.#projectFragmentRows([stored]);
    if (projection === undefined) {
      throw new Error(`Retired fragment could not be projected: ${command.fragmentId}`);
    }
    return projection;
  }

  async #projectCharacterEvidenceRows(
    rows: readonly StoredCharacterEvidenceRow[],
  ): Promise<readonly CharacterEvidenceProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return Object.freeze({
          anchorId: row.sourceAnchorId,
          documentId: row.sourceDocumentId,
          documentRevisionId: row.sourceDocumentRevisionId,
          exactText: row.exactText,
          integrity: "broken" as const,
          range: null,
          createdAt: row.createdAt,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      return Object.freeze({
        anchorId: row.sourceAnchorId,
        documentId: row.sourceDocumentId,
        documentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity: resolution.status === "resolved"
          ? "resolved" as const
          : resolution.status === "needsReview"
            ? "needsReview" as const
            : "broken" as const,
        range: resolution.status === "resolved"
          ? Object.freeze({
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            })
          : null,
        createdAt: row.createdAt,
      });
    }));
  }

  async #projectCharacterRow(
    row: StoredCharacterRow,
  ): Promise<CharacterProjection> {
    const evidences = await this.#projectCharacterEvidenceRows(
      readStoredCharacterEvidenceRows(
        this.#database,
        row.workId,
        row.characterId,
      ),
    );
    return parseCharacterProjection({
      schemaVersion: 1,
      ...row,
      evidences,
    });
  }

  async #createCharacterSerially(
    command: CreateCharacterCommand,
  ): Promise<CharacterProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const characterId = entityId<"Character">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "character",
        ...createRecordMeta(createdAt),
        id: characterId,
        workId: command.workId,
        name: command.name,
        aliases: command.aliases,
        role: command.role,
        summary: command.summary,
        appearance: command.appearance,
        personality: command.personality,
        speech: command.speech,
        goal: command.goal,
        conflict: command.conflict,
        note: command.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      characterId,
    );
    if (stored === null) {
      throw new Error(`Stored character is missing: ${characterId}`);
    }
    return this.#projectCharacterRow(stored);
  }

  async #listCharactersSerially(
    command: ListCharactersCommand,
  ): Promise<CharacterListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const characters = await Promise.all(
      readStoredCharacterRows(this.#database, command.workId)
        .map((character) => this.#projectCharacterRow(character)),
    );
    return parseCharacterListProjection({
      schemaVersion: 1,
      workId: command.workId,
      characters,
    });
  }

  async #updateCharacterSerially(
    command: UpdateCharacterCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character is retired: ${command.characterId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterUpdate",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        updatedAt,
        name: command.changes.name ?? current.name,
        aliases: command.changes.aliases ?? current.aliases,
        role: command.changes.role ?? current.role,
        summary: command.changes.summary ?? current.summary,
        appearance: command.changes.appearance ?? current.appearance,
        personality: command.changes.personality ?? current.personality,
        speech: command.changes.speech ?? current.speech,
        goal: command.changes.goal ?? current.goal,
        conflict: command.changes.conflict ?? current.conflict,
        note: command.changes.note ?? current.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Updated character is missing: ${command.characterId}`);
    }
    return this.#projectCharacterRow(stored);
  }

  async #addCharacterEvidenceSerially(
    command: AddCharacterEvidenceCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (target.currentRevisionId !== command.documentRevisionId) {
      throw new Error("Character evidence revision is stale");
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to <= from || to > target.text.length) {
      throw new Error("Character evidence selection must be non-empty and current");
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: command.documentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: command.characterId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "characterEvidence",
        id: entityId<"CharacterEvidence">(randomUUID()),
        workId: command.workId,
        characterId: command.characterId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        createdAt,
      });
      transaction.write({
        kind: "characterUpdate",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        updatedAt: createdAt,
        name: current.name,
        aliases: current.aliases,
        role: current.role,
        summary: current.summary,
        appearance: current.appearance,
        personality: current.personality,
        speech: current.speech,
        goal: current.goal,
        conflict: current.conflict,
        note: current.note,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Updated character is missing: ${command.characterId}`);
    }
    return this.#projectCharacterRow(stored);
  }

  async #retireCharacterSerially(
    command: RetireCharacterCommand,
  ): Promise<CharacterProjection> {
    const current = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (current === null) {
      throw new Error(
        `Work/character boundary violation: ${command.workId}/${command.characterId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character is already retired: ${command.characterId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character revision conflict: ${command.characterId}`);
    }
    const retiredAt = new Date().toISOString();
    const related = readStoredCharacterRelationRows(
      this.#database,
      command.workId,
    ).filter((relation) =>
      relation.retiredAt === null &&
      (
        relation.fromCharacterId === command.characterId ||
        relation.toCharacterId === command.characterId
      )
    );
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const relation of related) {
        transaction.write({
          kind: "characterRelationRetirement",
          id: relation.relationId,
          workId: command.workId,
          expectedRevision: relation.revision,
          retiredAt,
          retirementReason: "character-retired",
        });
      }
      transaction.write({
        kind: "characterRetirement",
        id: command.characterId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    const stored = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.characterId,
    );
    if (stored === null) {
      throw new Error(`Retired character is missing: ${command.characterId}`);
    }
    return this.#projectCharacterRow(stored);
  }

  async #createCharacterRelationSerially(
    command: CreateCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const fromCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.fromCharacterId,
    );
    const toCharacter = readStoredCharacterRowById(
      this.#database,
      command.workId,
      command.toCharacterId,
    );
    if (
      fromCharacter === null ||
      fromCharacter.retiredAt !== null ||
      toCharacter === null ||
      toCharacter.retiredAt !== null
    ) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}`,
      );
    }
    const createdAt = new Date().toISOString();
    const relationId = entityId<"CharacterRelation">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelation",
        ...createRecordMeta(createdAt),
        id: relationId,
        workId: command.workId,
        fromCharacterId: command.fromCharacterId,
        toCharacterId: command.toCharacterId,
        relationKind: command.kind,
        description: command.description,
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      relationId,
    );
    if (stored === null) {
      throw new Error(`Stored character relation is missing: ${relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  #listCharacterRelationsSerially(
    command: ListCharacterRelationsCommand,
  ): CharacterRelationListProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parseCharacterRelationListProjection({
      schemaVersion: 1,
      workId: command.workId,
      relations: readStoredCharacterRelationRows(
        this.#database,
        command.workId,
      ).map(projectStoredCharacterRelationRow),
    });
  }

  async #updateCharacterRelationSerially(
    command: UpdateCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    const current = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (current === null) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}/${command.relationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character relation is retired: ${command.relationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character relation revision conflict: ${command.relationId}`);
    }
    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelationUpdate",
        id: command.relationId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        updatedAt,
        relationKind: command.changes.kind ?? current.kind,
        description: command.changes.description ?? current.description,
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (stored === null) {
      throw new Error(`Updated character relation is missing: ${command.relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  async #retireCharacterRelationSerially(
    command: RetireCharacterRelationCommand,
  ): Promise<CharacterRelationProjection> {
    const current = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (current === null) {
      throw new Error(
        `Work/character relation boundary violation: ${command.workId}/${command.relationId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Character relation is retired: ${command.relationId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Character relation revision conflict: ${command.relationId}`);
    }
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "characterRelationRetirement",
        id: command.relationId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
        retirementReason: "user",
      });
    });
    const stored = readStoredCharacterRelationRowById(
      this.#database,
      command.workId,
      command.relationId,
    );
    if (stored === null) {
      throw new Error(`Retired character relation is missing: ${command.relationId}`);
    }
    return projectStoredCharacterRelationRow(stored);
  }

  async #projectLoreEntryEvidenceRows(
    rows: readonly StoredLoreEntryEvidenceRow[],
  ): Promise<readonly LoreEntryEvidenceProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return Object.freeze({
          anchorId: row.sourceAnchorId,
          sourceDocumentId: row.sourceDocumentId,
          sourceDocumentRevisionId: row.sourceDocumentRevisionId,
          exactText: row.exactText,
          integrity: "broken" as const,
          range: null,
          createdAt: row.createdAt,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return Object.freeze({
        anchorId: row.sourceAnchorId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity,
        range: resolution.status === "resolved"
          ? Object.freeze({
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            })
          : null,
        createdAt: row.createdAt,
      });
    }));
  }

  async #projectLoreEntryRow(
    row: StoredLoreEntryRow,
  ): Promise<LoreEntryProjection> {
    const evidences = await this.#projectLoreEntryEvidenceRows(
      readStoredLoreEntryEvidenceRows(
        this.#database,
        row.workId,
        row.loreEntryId,
      ),
    );
    const history = readStoredLoreEntryHistoryRows(
      this.#database,
      row.workId,
      row.loreEntryId,
    ).map((entry) => Object.freeze({
      historyId: entry.historyId,
      entryRevision: entry.entryRevision,
      changeKind: entry.changeKind,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      aliases: entry.aliases,
      enabled: entry.enabled,
      evidenceAnchorIds: entry.evidenceAnchorIds,
      changedAt: entry.changedAt,
    }));
    return parseLoreEntryProjection({
      schemaVersion: 1,
      ...row,
      evidences,
      history,
    });
  }

  async #createLoreEntrySerially(
    command: CreateLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const loreEntryId = entityId<"LoreEntry">(randomUUID());
    const historyId = entityId<"LoreEntryHistory">(randomUUID());
    let evidenceAnchorId: EntityId<"Anchor"> | null = null;
    let evidenceAnchor: Awaited<ReturnType<CreateAnchor["execute"]>> | null = null;
    if (command.evidence !== null) {
      const target = this.#documentTargets.get(command.evidence.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new Error(
          `Work/document boundary violation: ${command.workId}/${command.evidence.documentId}`,
        );
      }
      const from = Math.min(
        command.evidence.selection.anchor,
        command.evidence.selection.head,
      );
      const to = Math.max(
        command.evidence.selection.anchor,
        command.evidence.selection.head,
      );
      if (
        to > target.text.length ||
        target.text.slice(from, to) !== command.evidence.exactText
      ) {
        throw new Error(
          "Lore evidence does not match the current durable revision",
        );
      }
      evidenceAnchorId = entityId<"Anchor">(randomUUID());
      evidenceAnchor = await new CreateAnchor({
        catalog,
        revisionStore: this.#revisionStore,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      }).execute({
        meta: {
          id: evidenceAnchorId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt,
          updatedAt: createdAt,
        },
        workId: command.workId,
        documentId: command.evidence.documentId,
        documentRevisionId: target.currentRevisionId,
        startOffset: from,
        endOffset: to,
        policy: this.#options.defaults.anchorPolicy,
        commandRef: loreEntryId,
        actorRef: work.studioId,
      });
    }
    const evidenceAnchorIds = evidenceAnchorId === null
      ? Object.freeze([])
      : Object.freeze([evidenceAnchorId]);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (evidenceAnchor !== null && evidenceAnchorId !== null && command.evidence !== null) {
        transaction.write(createAnchorLedgerRecord(command.workId, evidenceAnchor));
      }
      transaction.write({
        kind: "loreEntry",
        ...createRecordMeta(createdAt),
        id: loreEntryId,
        workId: command.workId,
        title: command.title,
        content: command.content,
        category: command.category,
        aliases: command.aliases,
        enabled: command.enabled,
      });
      if (evidenceAnchorId !== null && command.evidence !== null) {
        transaction.write({
          kind: "loreEntryEvidence",
          id: evidenceAnchorId,
          workId: command.workId,
          loreEntryId,
          sourceDocumentId: command.evidence.documentId,
          sourceAnchorId: evidenceAnchorId,
          createdAt,
        });
      }
      transaction.write({
        kind: "loreEntryHistory",
        id: historyId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        workId: command.workId,
        loreEntryId,
        entryRevision: 1,
        changeKind: "created",
        title: command.title,
        content: command.content,
        category: command.category,
        aliases: command.aliases,
        enabled: command.enabled,
        evidenceAnchorIds,
        changedAt: createdAt,
      });
    });
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      loreEntryId,
    );
    if (stored === null) throw new Error(`Stored lore entry is missing: ${loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #listLoreEntriesSerially(
    command: ListLoreEntriesCommand,
  ): Promise<LoreEntryListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const entries = await Promise.all(
      readStoredLoreEntryRows(this.#database, command.workId)
        .map((entry) => this.#projectLoreEntryRow(entry)),
    );
    return parseLoreEntryListProjection({
      schemaVersion: 1,
      workId: command.workId,
      entries,
    });
  }

  async #updateLoreEntrySerially(
    command: UpdateLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const updatedAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const next = Object.freeze({
      title: command.changes.title ?? current.title,
      content: command.changes.content ?? current.content,
      category: command.changes.category ?? current.category,
      aliases: command.changes.aliases ?? current.aliases,
      enabled: command.changes.enabled ?? current.enabled,
    });
    const evidenceAnchorIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET
          revision = ?,
          updated_at = ?,
          title = ?,
          content = ?,
          category = ?,
          aliases_json = ?,
          enabled = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        updatedAt,
        next.title,
        next.content,
        next.category,
        JSON.stringify(next.aliases),
        next.enabled ? 1 : 0,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "updated",
        next.title,
        next.content,
        next.category,
        JSON.stringify(next.aliases),
        next.enabled ? 1 : 0,
        JSON.stringify(evidenceAnchorIds),
        updatedAt,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Updated lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #addLoreEntryEvidenceSerially(
    command: AddLoreEntryEvidenceCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(`Work/document boundary violation: ${command.workId}/${command.documentId}`);
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length || target.text.slice(from, to) !== command.exactText) {
      throw new Error("Lore evidence does not match the current durable revision");
    }
    const catalog = createCatalogFromStoredRows(readStoredDocumentRows(this.#database));
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const changedAt = new Date().toISOString();
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt: changedAt,
        updatedAt: changedAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: command.loreEntryId,
      actorRef: work.studioId,
    });
    const previousEvidenceIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    const nextRevision = current.revision + 1;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      insertAnchorLedgerRecord(
        this.#database,
        createAnchorLedgerRecord(command.workId, anchor),
      );
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET revision = ?, updated_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        changedAt,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_evidence (
          work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        command.workId,
        command.loreEntryId,
        command.documentId,
        anchorId,
        changedAt,
      );
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "evidence-added",
        current.title,
        current.content,
        current.category,
        JSON.stringify(current.aliases),
        current.enabled ? 1 : 0,
        JSON.stringify([...previousEvidenceIds, anchorId]),
        changedAt,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Updated lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #retireLoreEntrySerially(
    command: RetireLoreEntryCommand,
  ): Promise<LoreEntryProjection> {
    const current = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    if (current.retiredAt !== null) throw new Error(`Lore entry is already retired: ${command.loreEntryId}`);
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
    }
    const retiredAt = new Date().toISOString();
    const nextRevision = current.revision + 1;
    const evidenceAnchorIds = readStoredLoreEntryEvidenceRows(
      this.#database,
      command.workId,
      command.loreEntryId,
    ).map((entry) => entry.sourceAnchorId);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE lore_entries
        SET revision = ?, updated_at = ?, retired_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
      `).run(
        nextRevision,
        retiredAt,
        retiredAt,
        command.workId,
        command.loreEntryId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Lore entry revision conflict: ${command.loreEntryId}`);
      }
      this.#database.prepare(`
        INSERT INTO lore_entry_history (
          id, schema_version, work_id, lore_entry_id, entry_revision,
          change_kind, title, content, category, aliases_json, enabled,
          evidence_anchor_ids_json, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        command.workId,
        command.loreEntryId,
        nextRevision,
        "retired",
        current.title,
        current.content,
        current.category,
        JSON.stringify(current.aliases),
        current.enabled ? 1 : 0,
        JSON.stringify(evidenceAnchorIds),
        retiredAt,
      );
      this.#database.prepare(`
        UPDATE lore_foreshadow_links
        SET
          revision = revision + 1,
          updated_at = ?,
          unlinked_at = ?,
          unlink_reason = 'lore-retired'
        WHERE
          work_id = ?
          AND lore_entry_id = ?
          AND unlinked_at IS NULL
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.loreEntryId,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (stored === null) throw new Error(`Retired lore entry is missing: ${command.loreEntryId}`);
    return this.#projectLoreEntryRow(stored);
  }

  async #linkLoreForeshadowSerially(
    command: LinkLoreForeshadowCommand,
  ): Promise<LoreForeshadowLinkProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const loreEntry = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      command.loreEntryId,
    );
    if (loreEntry === null || loreEntry.retiredAt !== null) {
      throw new Error(
        `Work/lore entry boundary violation: ${command.workId}/${command.loreEntryId}`,
      );
    }
    const line = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (line === null || line.retiredAt !== null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    const existing = readActiveLoreForeshadowLinkByPair(
      this.#database,
      command.workId,
      command.loreEntryId,
      command.lineId,
    );
    if (existing !== null) {
      return projectStoredLoreForeshadowLinkRow(existing);
    }
    const linkedAt = new Date().toISOString();
    const linkId = entityId<"LoreForeshadowLink">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "loreForeshadowLink",
        ...createRecordMeta(linkedAt),
        id: linkId,
        workId: command.workId,
        loreEntryId: command.loreEntryId,
        lineId: command.lineId,
        linkedAt,
        unlinkedAt: null,
        unlinkReason: null,
      });
    });
    const stored = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      linkId,
    );
    if (stored === null) {
      throw new Error(`Stored lore/foreshadow link is missing: ${linkId}`);
    }
    return projectStoredLoreForeshadowLinkRow(stored);
  }

  #listLoreForeshadowLinksSerially(
    command: ListLoreForeshadowLinksCommand,
  ): LoreForeshadowLinkListProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parseLoreForeshadowLinkListProjection({
      schemaVersion: 1,
      workId: command.workId,
      links: readStoredLoreForeshadowLinkRows(
        this.#database,
        command.workId,
      ).map(projectStoredLoreForeshadowLinkRow),
    });
  }

  #unlinkLoreForeshadowSerially(
    command: UnlinkLoreForeshadowCommand,
  ): LoreForeshadowLinkProjection {
    const current = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      command.linkId,
    );
    if (current === null) {
      throw new Error(
        `Work/lore foreshadow link boundary violation: ${command.workId}/${command.linkId}`,
      );
    }
    if (current.unlinkedAt !== null) {
      throw new Error(`Lore/foreshadow link is already unlinked: ${command.linkId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Lore/foreshadow link revision conflict: ${command.linkId}`);
    }
    const unlinkedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE lore_foreshadow_links
      SET
        revision = revision + 1,
        updated_at = ?,
        unlinked_at = ?,
        unlink_reason = 'user'
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND unlinked_at IS NULL
        AND retired_at IS NULL
    `).run(
      unlinkedAt,
      unlinkedAt,
      command.workId,
      command.linkId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Lore/foreshadow link revision conflict: ${command.linkId}`);
    }
    const stored = readStoredLoreForeshadowLinkRowById(
      this.#database,
      command.workId,
      command.linkId,
    );
    if (stored === null) {
      throw new Error(`Unlinked lore/foreshadow link is missing: ${command.linkId}`);
    }
    return projectStoredLoreForeshadowLinkRow(stored);
  }

  async #projectLoreCandidateRow(
    row: StoredLoreCandidateRow,
  ): Promise<LoreCandidateProjection> {
    const target = this.#documentTargets.get(row.sourceDocumentId);
    let integrity: LoreCandidateProjection["evidence"]["integrity"] = "broken";
    let range: LoreCandidateProjection["evidence"]["range"] = null;
    if (target !== undefined && target.workId === row.workId) {
      const resolver = new ResolveAnchor({
        catalog: createCatalogFromStoredRows(
          readStoredDocumentRows(this.#database),
        ),
        revisionStore: this.#revisionStore,
        reader: this.#ledger,
        describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
          this.#options.defaults.anchorEvidenceChecksumAlgorithm,
        ),
      });
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      range = resolution.status === "resolved"
        ? Object.freeze({
            from: resolution.range.startOffset,
            to: resolution.range.endOffset,
          })
        : null;
    }
    let approvalBlockReason: LoreCandidateApprovalBlockReason | null = null;
    if (row.status !== "pending") {
      approvalBlockReason = "already-reviewed";
    } else if (row.certainty !== "explicit") {
      approvalBlockReason = "inferred";
    } else if (
      target === undefined ||
      target.workId !== row.workId ||
      target.currentRevisionId !== row.sourceDocumentRevisionId
    ) {
      approvalBlockReason = "evidence-stale";
    } else if (integrity !== "resolved" || range === null) {
      approvalBlockReason = "evidence-unresolved";
    } else if (row.proposal.kind === "update") {
      const loreEntry = readStoredLoreEntryRowById(
        this.#database,
        row.workId,
        row.proposal.loreEntryId,
      );
      approvalBlockReason = loreEntry === null || loreEntry.retiredAt !== null
        ? "target-missing"
        : loreEntry.revision !== row.proposal.expectedLoreEntryRevision
          ? "target-stale"
          : null;
    }
    return parseLoreCandidateProjection({
      schemaVersion: 1,
      candidateId: row.candidateId,
      revision: row.revision,
      workId: row.workId,
      source: row.source,
      certainty: row.certainty,
      proposal: row.proposal,
      evidence: {
        anchorId: row.sourceAnchorId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        exactText: row.exactText,
        integrity,
        range,
      },
      reason: row.reason,
      status: row.status,
      approvedLoreEntryId: row.approvedLoreEntryId,
      approvalBlockReason,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    });
  }

  async #createLoreCandidateSerially(
    command: CreateLoreCandidateCommand,
  ): Promise<LoreCandidateProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (
      to > target.text.length ||
      target.text.slice(from, to) !== command.exactText
    ) {
      throw new Error("Lore Candidate evidence does not match the current durable revision");
    }
    if (command.proposal.kind === "update") {
      const loreEntry = readStoredLoreEntryRowById(
        this.#database,
        command.workId,
        command.proposal.loreEntryId,
      );
      if (loreEntry === null || loreEntry.retiredAt !== null) {
        throw new Error(
          `Work/lore entry boundary violation: ${command.workId}/${command.proposal.loreEntryId}`,
        );
      }
      if (loreEntry.revision !== command.proposal.expectedLoreEntryRevision) {
        throw new Error(
          `Lore entry revision conflict: ${command.proposal.loreEntryId}`,
        );
      }
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) throw new Error(`Unknown Work: ${command.workId}`);
    const createdAt = new Date().toISOString();
    const candidateId = entityId<"LoreCandidate">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: candidateId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "loreCandidate",
        ...createRecordMeta(createdAt),
        id: candidateId,
        workId: command.workId,
        sourceDocumentId: command.documentId,
        sourceDocumentRevisionId: target.currentRevisionId,
        sourceAnchorId: anchorId,
        exactText: command.exactText,
        source: command.source,
        certainty: command.certainty,
        proposalJson: JSON.stringify(command.proposal),
        reason: command.reason,
        status: "pending",
        approvedLoreEntryId: null,
        reviewedAt: null,
      });
    });
    const stored = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      candidateId,
    );
    if (stored === null) {
      throw new Error(`Stored Lore Candidate is missing: ${candidateId}`);
    }
    return this.#projectLoreCandidateRow(stored);
  }

  async #listLoreCandidatesSerially(
    command: ListLoreCandidatesCommand,
  ): Promise<LoreCandidateListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const candidates = await Promise.all(
      readStoredLoreCandidateRows(this.#database, command.workId)
        .map((candidate) => this.#projectLoreCandidateRow(candidate)),
    );
    return parseLoreCandidateListProjection({
      schemaVersion: 1,
      workId: command.workId,
      candidates,
    });
  }

  async #approveLoreCandidateSerially(
    command: ReviewLoreCandidateCommand,
  ): Promise<LoreCandidateApprovalResult> {
    const currentCandidate = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (currentCandidate === null) {
      throw new Error(
        `Work/Lore Candidate boundary violation: ${command.workId}/${command.candidateId}`,
      );
    }
    if (currentCandidate.revision !== command.expectedRevision) {
      throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
    }
    const candidateProjection = await this.#projectLoreCandidateRow(
      currentCandidate,
    );
    if (candidateProjection.approvalBlockReason !== null) {
      throw new Error(
        `Lore Candidate approval blocked: ${candidateProjection.approvalBlockReason}`,
      );
    }
    const reviewedAt = new Date().toISOString();
    const nextCandidateRevision = currentCandidate.revision + 1;
    let loreEntryId: EntityId<"LoreEntry">;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (currentCandidate.proposal.kind === "create") {
        loreEntryId = entityId<"LoreEntry">(randomUUID());
        this.#database.prepare(`
          INSERT INTO lore_entries (
            id, schema_version, revision, created_at, updated_at, retired_at,
            work_id, title, content, category, aliases_json, enabled
          ) VALUES (?, ?, 1, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        `).run(
          loreEntryId,
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          reviewedAt,
          reviewedAt,
          command.workId,
          currentCandidate.proposal.title,
          currentCandidate.proposal.content,
          currentCandidate.proposal.category,
          JSON.stringify(currentCandidate.proposal.aliases),
          currentCandidate.proposal.enabled ? 1 : 0,
        );
        this.#database.prepare(`
          INSERT INTO lore_entry_evidence (
            work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          command.workId,
          loreEntryId,
          currentCandidate.sourceDocumentId,
          currentCandidate.sourceAnchorId,
          reviewedAt,
        );
        this.#database.prepare(`
          INSERT INTO lore_entry_history (
            id, schema_version, work_id, lore_entry_id, entry_revision,
            change_kind, title, content, category, aliases_json, enabled,
            evidence_anchor_ids_json, changed_at
          ) VALUES (?, ?, ?, ?, 1, 'created', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          command.workId,
          loreEntryId,
          currentCandidate.proposal.title,
          currentCandidate.proposal.content,
          currentCandidate.proposal.category,
          JSON.stringify(currentCandidate.proposal.aliases),
          currentCandidate.proposal.enabled ? 1 : 0,
          JSON.stringify([currentCandidate.sourceAnchorId]),
          reviewedAt,
        );
      } else {
        loreEntryId = currentCandidate.proposal.loreEntryId;
        const loreEntry = readStoredLoreEntryRowById(
          this.#database,
          command.workId,
          loreEntryId,
        );
        if (
          loreEntry === null ||
          loreEntry.retiredAt !== null ||
          loreEntry.revision !== currentCandidate.proposal.expectedLoreEntryRevision
        ) {
          throw new Error(`Lore Candidate target changed: ${loreEntryId}`);
        }
        const nextLoreRevision = loreEntry.revision + 1;
        const nextLore = {
          title: currentCandidate.proposal.changes.title ?? loreEntry.title,
          content: currentCandidate.proposal.changes.content ?? loreEntry.content,
          category: currentCandidate.proposal.changes.category ?? loreEntry.category,
          aliases: currentCandidate.proposal.changes.aliases ?? loreEntry.aliases,
          enabled: currentCandidate.proposal.changes.enabled ?? loreEntry.enabled,
        };
        const update = this.#database.prepare(`
          UPDATE lore_entries
          SET revision = ?, updated_at = ?, title = ?, content = ?, category = ?,
              aliases_json = ?, enabled = ?
          WHERE work_id = ? AND id = ? AND revision = ? AND retired_at IS NULL
        `).run(
          nextLoreRevision,
          reviewedAt,
          nextLore.title,
          nextLore.content,
          nextLore.category,
          JSON.stringify(nextLore.aliases),
          nextLore.enabled ? 1 : 0,
          command.workId,
          loreEntryId,
          currentCandidate.proposal.expectedLoreEntryRevision,
        );
        if (Number(update.changes) !== 1) {
          throw new Error(`Lore Candidate target revision conflict: ${loreEntryId}`);
        }
        this.#database.prepare(`
          INSERT INTO lore_entry_evidence (
            work_id, lore_entry_id, source_document_id, source_anchor_id, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          command.workId,
          loreEntryId,
          currentCandidate.sourceDocumentId,
          currentCandidate.sourceAnchorId,
          reviewedAt,
        );
        const evidenceAnchorIds = [
          ...readStoredLoreEntryEvidenceRows(
            this.#database,
            command.workId,
            loreEntryId,
          ).map((evidence) => evidence.sourceAnchorId),
        ];
        this.#database.prepare(`
          INSERT INTO lore_entry_history (
            id, schema_version, work_id, lore_entry_id, entry_revision,
            change_kind, title, content, category, aliases_json, enabled,
            evidence_anchor_ids_json, changed_at
          ) VALUES (?, ?, ?, ?, ?, 'updated', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          command.workId,
          loreEntryId,
          nextLoreRevision,
          nextLore.title,
          nextLore.content,
          nextLore.category,
          JSON.stringify(nextLore.aliases),
          nextLore.enabled ? 1 : 0,
          JSON.stringify(evidenceAnchorIds),
          reviewedAt,
        );
      }
      const review = this.#database.prepare(`
        UPDATE lore_candidates
        SET revision = ?, updated_at = ?, status = 'approved',
            approved_lore_entry_id = ?, reviewed_at = ?
        WHERE work_id = ? AND id = ? AND revision = ? AND status = 'pending'
      `).run(
        nextCandidateRevision,
        reviewedAt,
        loreEntryId,
        reviewedAt,
        command.workId,
        command.candidateId,
        command.expectedRevision,
      );
      if (Number(review.changes) !== 1) {
        throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const reviewedCandidate = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    const loreEntry = readStoredLoreEntryRowById(
      this.#database,
      command.workId,
      loreEntryId,
    );
    if (reviewedCandidate === null || loreEntry === null) {
      throw new Error(`Approved Lore Candidate result is missing: ${command.candidateId}`);
    }
    return parseLoreCandidateApprovalResult({
      schemaVersion: 1,
      candidate: await this.#projectLoreCandidateRow(reviewedCandidate),
      loreEntry: await this.#projectLoreEntryRow(loreEntry),
    });
  }

  async #rejectLoreCandidateSerially(
    command: ReviewLoreCandidateCommand,
  ): Promise<LoreCandidateProjection> {
    const current = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (current === null) {
      throw new Error(
        `Work/Lore Candidate boundary violation: ${command.workId}/${command.candidateId}`,
      );
    }
    if (current.status !== "pending") {
      throw new Error(`Lore Candidate is already reviewed: ${command.candidateId}`);
    }
    const reviewedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE lore_candidates
      SET revision = revision + 1, updated_at = ?, status = 'rejected', reviewed_at = ?
      WHERE work_id = ? AND id = ? AND revision = ? AND status = 'pending'
    `).run(
      reviewedAt,
      reviewedAt,
      command.workId,
      command.candidateId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Lore Candidate revision conflict: ${command.candidateId}`);
    }
    const rejected = readStoredLoreCandidateRowById(
      this.#database,
      command.workId,
      command.candidateId,
    );
    if (rejected === null) {
      throw new Error(`Rejected Lore Candidate is missing: ${command.candidateId}`);
    }
    return this.#projectLoreCandidateRow(rejected);
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

  async #createPublishingSubmissionSerially(
    command: CreatePublishingSubmissionCommand,
  ): Promise<PublishingSubmissionProjection> {
    const work = this.#catalog.works.find(
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

    const documentRevisions = [...this.#documentTargets.values()]
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
      !this.#catalog.works.some((work) => work.workId === command.workId)
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
    const work = this.#catalog.works.find(
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
      !this.#catalog.works.some((work) => work.workId === command.workId)
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
    const work = this.#catalog.works.find(
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
      !this.#catalog.works.some((work) => work.workId === command.workId)
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
    const work = this.#catalog.works.find(
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
      !this.#catalog.works.some((work) => work.workId === command.workId)
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
    const work = this.#catalog.works.find(
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
      !this.#catalog.works.some((work) => work.workId === command.workId)
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
      works: this.#catalog.works.map((work) => ({
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
    const work = this.#catalog.works.find(
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

    const documentRevisions = [...this.#documentTargets.values()]
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
      works: this.#catalog.works,
      partners,
    });
    if (preview.fileIssues.length > 0) {
      throw new Error(
        `Publishing submission CSV has file issues: ${preview.fileIssues.join(",")}`,
      );
    }

    const sealedAt = new Date().toISOString();
    const prepared = preview.readyRows.map((row) => {
      const work = this.#catalog.works.find((candidate) => candidate.workId === row.workId);
      const partner = partners.find((candidate) => candidate.partnerId === row.partnerId);
      if (work === undefined || partner === undefined) {
        throw new Error(`Publishing submission CSV relation changed at row ${row.rowNumber}`);
      }
      const documentRevisions = [...this.#documentTargets.values()]
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

  #readDefaultPlotBoardContext(workId: EntityId<"Work">): Readonly<{
    board: StoredPlotBoardRow;
    lanes: readonly StoredPlotLaneRow[];
    defaultLane: StoredPlotLaneRow;
    placements: readonly StoredPlotPlacementRow[];
  }> {
    const board = readStoredDefaultPlotBoardRow(this.#database, workId);
    const lanes = readStoredPlotLaneRows(
      this.#database,
      workId,
      board.plotBoardId,
    );
    const defaultLanes = lanes.filter((lane) => lane.kind === "default");
    if (defaultLanes.length !== 1) {
      throw new Error(
        `Default PlotBoard must have exactly one default PlotLane: ${board.plotBoardId}`,
      );
    }
    return Object.freeze({
      board,
      lanes,
      defaultLane: defaultLanes[0] as StoredPlotLaneRow,
      placements: readStoredActivePlotPlacementRows(
        this.#database,
        workId,
        board.plotBoardId,
      ),
    });
  }

  #projectDefaultPlotBoard(workId: EntityId<"Work">): PlotBoardProjection {
    const context = this.#readDefaultPlotBoardContext(workId);
    return parsePlotBoardProjection({
      schemaVersion: 1,
      ...context.board,
      lanes: context.lanes.map((lane) => ({
        schemaVersion: 1,
        ...lane,
        placements: context.placements
          .filter((placement) => placement.plotLaneId === lane.plotLaneId)
          .sort((left, right) =>
            compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
            left.plotPlacementId.localeCompare(right.plotPlacementId))
          .map((placement) => ({
            schemaVersion: 1,
            plotPlacementId: placement.plotPlacementId,
            revision: placement.revision,
            workId: placement.workId,
            plotBoardId: placement.plotBoardId,
            plotLaneId: placement.plotLaneId,
            plotBeatId: placement.plotBeatId,
            orderKey: placement.orderKey,
            storyTime: placement.storyTime,
            storyTimeEnd: placement.storyTimeEnd,
            createdAt: placement.createdAt,
            updatedAt: placement.updatedAt,
            retiredAt: placement.retiredAt,
            plotBeat: {
              schemaVersion: 1,
              plotThreadId: placement.plotBeatId,
              revision: placement.plotRevision,
              workId: placement.workId,
              title: placement.plotTitle,
              stage: placement.plotStage,
              summary: placement.plotSummary,
              note: placement.plotNote,
              createdAt: placement.plotCreatedAt,
              updatedAt: placement.plotUpdatedAt,
              retiredAt: placement.plotRetiredAt,
            },
          })),
      })),
    });
  }

  #getDefaultPlotBoardSerially(
    command: GetDefaultPlotBoardCommand,
  ): PlotBoardProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return this.#projectDefaultPlotBoard(command.workId);
  }

  #prepareDefaultPlotPlacement(workId: EntityId<"Work">): Readonly<{
    plotPlacementId: EntityId<"PlotPlacement">;
    plotBoardId: EntityId<"PlotBoard">;
    plotLaneId: EntityId<"PlotLane">;
    orderKey: string;
    expectedBoardRevision: number;
  }> {
    const context = this.#readDefaultPlotBoardContext(workId);
    const lanePlacements = context.placements
      .filter((placement) => placement.plotLaneId === context.defaultLane.plotLaneId)
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotPlacementId.localeCompare(right.plotPlacementId));
    const last = lanePlacements.at(-1) ?? null;
    return Object.freeze({
      plotPlacementId: entityId<"PlotPlacement">(randomUUID()),
      plotBoardId: context.board.plotBoardId,
      plotLaneId: context.defaultLane.plotLaneId,
      orderKey: createOrderKeyBetween(last?.orderKey ?? null, null),
      expectedBoardRevision: context.board.revision,
    });
  }

  async #movePlotPlacementSerially(
    command: MovePlotPlacementCommand,
  ): Promise<PlotBoardProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const current = readStoredPlotPlacementRowById(
      this.#database,
      command.workId,
      command.plotPlacementId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown active PlotPlacement: ${command.plotPlacementId}`);
    }
    if (current.revision !== command.expectedPlacementRevision) {
      throw new Error(`PlotPlacement revision conflict: ${command.plotPlacementId}`);
    }
    if (
      command.beforePlacementId === command.plotPlacementId ||
      command.afterPlacementId === command.plotPlacementId
    ) {
      throw new Error("PlotPlacement cannot be its own move neighbor");
    }

    const context = this.#readDefaultPlotBoardContext(command.workId);
    if (context.board.plotBoardId !== command.targetBoardId) {
      throw new Error(
        `Work/PlotBoard boundary violation: ${command.workId}/${command.targetBoardId}`,
      );
    }
    if (context.board.revision !== command.expectedBoardRevision) {
      throw new Error(`PlotBoard revision conflict: ${command.targetBoardId}`);
    }
    if (!context.lanes.some((lane) => lane.plotLaneId === command.targetLaneId)) {
      throw new Error(
        `PlotBoard/PlotLane boundary violation: ${command.targetBoardId}/${command.targetLaneId}`,
      );
    }

    const targetPlacements = context.placements
      .filter((placement) =>
        placement.plotLaneId === command.targetLaneId &&
        placement.plotPlacementId !== command.plotPlacementId)
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotPlacementId.localeCompare(right.plotPlacementId));
    const beforeIndex = command.beforePlacementId === undefined
      ? -1
      : targetPlacements.findIndex(
          (placement) => placement.plotPlacementId === command.beforePlacementId,
        );
    const afterIndex = command.afterPlacementId === undefined
      ? -1
      : targetPlacements.findIndex(
          (placement) => placement.plotPlacementId === command.afterPlacementId,
        );
    if (command.beforePlacementId !== undefined && beforeIndex < 0) {
      throw new Error(`Move predecessor is outside the target lane: ${command.beforePlacementId}`);
    }
    if (command.afterPlacementId !== undefined && afterIndex < 0) {
      throw new Error(`Move successor is outside the target lane: ${command.afterPlacementId}`);
    }
    if (
      command.beforePlacementId !== undefined &&
      command.afterPlacementId !== undefined &&
      beforeIndex + 1 !== afterIndex
    ) {
      throw new Error("Move neighbors are not adjacent in the target lane");
    }
    if (
      command.beforePlacementId !== undefined &&
      command.afterPlacementId === undefined &&
      beforeIndex !== targetPlacements.length - 1
    ) {
      throw new Error("Move predecessor is not the final target-lane placement");
    }
    if (
      command.beforePlacementId === undefined &&
      command.afterPlacementId !== undefined &&
      afterIndex !== 0
    ) {
      throw new Error("Move successor is not the first target-lane placement");
    }
    if (
      command.beforePlacementId === undefined &&
      command.afterPlacementId === undefined &&
      targetPlacements.length !== 0
    ) {
      throw new Error("Move without neighbors requires an empty target lane");
    }

    const previous = beforeIndex < 0 ? null : targetPlacements[beforeIndex] ?? null;
    const next = afterIndex < 0 ? null : targetPlacements[afterIndex] ?? null;
    const orderKey = createOrderKeyBetween(
      previous?.orderKey ?? null,
      next?.orderKey ?? null,
    );
    const updatedAt = new Date().toISOString();
    if (orderKey.length <= this.#options.defaults.plotBoard.orderKeyLengthLimit) {
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "plotPlacementMove",
          id: current.plotPlacementId,
          workId: command.workId,
          expectedRevision: command.expectedPlacementRevision,
          plotBoardId: command.targetBoardId,
          plotLaneId: command.targetLaneId,
          orderKey,
          expectedBoardRevision: command.expectedBoardRevision,
          updatedAt,
        });
      });
    } else {
      const insertIndex = command.beforePlacementId === undefined
        ? 0
        : beforeIndex + 1;
      const ordered = [...targetPlacements];
      ordered.splice(insertIndex, 0, current);
      const rebalancedKeys = createRebalancedOrderKeys(ordered.length);
      await this.#ledger.transaction(async (transaction: StorageTransaction) => {
        transaction.write({
          kind: "plotPlacementRebalance",
          workId: command.workId,
          plotBoardId: command.targetBoardId,
          expectedBoardRevision: command.expectedBoardRevision,
          updatedAt,
          placements: ordered.map((placement, index) => ({
            id: placement.plotPlacementId,
            expectedRevision: placement.revision,
            plotLaneId: command.targetLaneId,
            orderKey: rebalancedKeys[index] as string,
          })),
        });
      });
    }
    return this.#projectDefaultPlotBoard(command.workId);
  }

  async #setPlotPlacementStoryTimeSerially(
    command: SetPlotPlacementStoryTimeCommand,
  ): Promise<PlotBoardProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const current = readStoredPlotPlacementRowById(
      this.#database,
      command.workId,
      command.plotPlacementId,
    );
    if (current === null || current.retiredAt !== null) {
      throw new Error(`Unknown active PlotPlacement: ${command.plotPlacementId}`);
    }
    if (current.plotBoardId !== command.plotBoardId) {
      throw new Error(
        `PlotPlacement/PlotBoard boundary violation: ${command.plotPlacementId}/${command.plotBoardId}`,
      );
    }
    if (current.revision !== command.expectedPlacementRevision) {
      throw new Error(`PlotPlacement revision conflict: ${command.plotPlacementId}`);
    }
    const context = this.#readDefaultPlotBoardContext(command.workId);
    if (context.board.plotBoardId !== command.plotBoardId) {
      throw new Error(
        `Work/PlotBoard boundary violation: ${command.workId}/${command.plotBoardId}`,
      );
    }
    if (context.board.revision !== command.expectedBoardRevision) {
      throw new Error(`PlotBoard revision conflict: ${command.plotBoardId}`);
    }

    const updatedAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotPlacementStoryTime",
        id: current.plotPlacementId,
        workId: command.workId,
        expectedRevision: command.expectedPlacementRevision,
        plotBoardId: command.plotBoardId,
        storyTime: command.storyTime,
        storyTimeEnd: command.storyTimeEnd,
        expectedBoardRevision: command.expectedBoardRevision,
        updatedAt,
      });
    });
    return this.#projectDefaultPlotBoard(command.workId);
  }

  async #createPlotThreadSerially(
    command: CreatePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const plotThreadId = entityId<"PlotThread">(randomUUID());
    const placement = this.#prepareDefaultPlotPlacement(command.workId);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotThread",
        ...createRecordMeta(createdAt),
        id: plotThreadId,
        workId: command.workId,
        title: command.title,
        stage: command.stage,
        summary: command.summary,
        note: command.note,
      });
      transaction.write({
        kind: "plotPlacement",
        ...createRecordMeta(createdAt),
        id: placement.plotPlacementId,
        workId: command.workId,
        plotBoardId: placement.plotBoardId,
        plotLaneId: placement.plotLaneId,
        plotThreadId,
        orderKey: placement.orderKey,
      });
      transaction.write({
        kind: "plotBoardTouch",
        id: placement.plotBoardId,
        workId: command.workId,
        expectedRevision: placement.expectedBoardRevision,
        updatedAt: createdAt,
      });
    });
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Stored plot is missing: ${plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  async #listPlotThreadsSerially(
    command: ListPlotThreadsCommand,
  ): Promise<PlotThreadListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const plots = readStoredPlotThreadRows(
      this.#database,
      command.workId,
    ).map((plot) => parsePlotThreadProjection({
      schemaVersion: 1,
      ...plot,
    }));
    return parsePlotThreadListProjection({
      schemaVersion: 1,
      workId: command.workId,
      plots,
    });
  }

  async #updatePlotThreadSerially(
    command: UpdatePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    const current = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (current === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotThreadId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE plot_threads
      SET
        revision = revision + 1,
        updated_at = ?,
        title = ?,
        stage = ?,
        summary = ?,
        note = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.title ?? current.title,
      command.changes.stage ?? current.stage,
      command.changes.summary ?? current.summary,
      command.changes.note ?? current.note,
      command.workId,
      command.plotThreadId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Updated plot is missing: ${command.plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  async #retirePlotThreadSerially(
    command: RetirePlotThreadCommand,
  ): Promise<PlotThreadProjection> {
    const current = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (current === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Plot is already retired: ${command.plotThreadId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const retiredAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE plot_threads
      SET
        revision = revision + 1,
        updated_at = ?,
        retired_at = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      retiredAt,
      retiredAt,
      command.workId,
      command.plotThreadId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Plot revision conflict: ${command.plotThreadId}`);
    }
    const stored = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null) {
      throw new Error(`Retired plot is missing: ${command.plotThreadId}`);
    }
    return parsePlotThreadProjection({ schemaVersion: 1, ...stored });
  }

  #projectPlotEventLinkRow(
    row: StoredPlotEventLinkRow,
  ): PlotEventLinkProjection {
    return parsePlotEventLinkProjection({
      schemaVersion: 1,
      ...row,
      titleMatch: row.plotTitle === row.eventTitle ? "matched" : "mismatched",
    });
  }

  async #projectPlotEventLinkMutation(
    row: StoredPlotEventLinkRow,
    status: "created" | "existing" | "retired",
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      row.workId,
      row.plotBeatId,
    );
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      row.workId,
      row.eventBlockId,
    );
    if (plotBeat === null || eventBlock === null) {
      throw new Error(`PlotEventLink counterpart is missing: ${row.plotEventLinkId}`);
    }
    const eventSources = await Promise.all(
      readStoredEventSourceRows(this.#database, row.workId)
        .filter((source) => source.eventBlockId === row.eventBlockId)
        .map((source) => this.#projectEventSourceRow(source)),
    );
    return parsePlotEventLinkMutationProjection({
      schemaVersion: 1,
      status,
      plotBeat: parsePlotThreadProjection({ schemaVersion: 1, ...plotBeat }),
      eventBlock: parseEventBlockProjection({
        schemaVersion: 1,
        eventBlockId: eventBlock.eventBlockId,
        revision: eventBlock.revision,
        workId: eventBlock.workId,
        title: eventBlock.title,
        note: eventBlock.note,
        parentEventId: eventBlock.parentEventId,
        outlineOrderKey: eventBlock.outlineOrderKey,
        createdAt: eventBlock.createdAt,
        updatedAt: eventBlock.updatedAt,
        retiredAt: eventBlock.retiredAt,
      }),
      eventSources,
      link: this.#projectPlotEventLinkRow(row),
    });
  }

  #listPlotEventLinksSerially(
    command: ListPlotEventLinksCommand,
  ): PlotEventLinkListProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    return parsePlotEventLinkListProjection({
      schemaVersion: 1,
      workId: command.workId,
      links: readStoredPlotEventLinkRows(this.#database, command.workId).map(
        (row) => this.#projectPlotEventLinkRow(row),
      ),
    });
  }

  async #createPlotFromEventSerially(
    command: CreatePlotFromEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    if (eventBlock.retiredAt !== null) {
      throw new Error(`EventBlock is retired: ${command.eventBlockId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.eventBlockId === command.eventBlockId &&
        link.role === "primary" &&
        link.plotRetiredAt === null,
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }

    const createdAt = new Date().toISOString();
    const plotBeatId = entityId<"PlotThread">(randomUUID());
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    const placement = this.#prepareDefaultPlotPlacement(command.workId);
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotThread",
        ...meta,
        id: plotBeatId,
        workId: command.workId,
        title: eventBlock.title,
        stage: "",
        summary: eventBlock.note,
        note: "",
      });
      transaction.write({
        kind: "plotEventLink",
        ...meta,
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: plotBeatId,
        eventBlockId: command.eventBlockId,
        role: "primary",
        createdFrom: "event-to-plot",
      });
      transaction.write({
        kind: "plotPlacement",
        ...meta,
        id: placement.plotPlacementId,
        workId: command.workId,
        plotBoardId: placement.plotBoardId,
        plotLaneId: placement.plotLaneId,
        plotThreadId: plotBeatId,
        orderKey: placement.orderKey,
      });
      transaction.write({
        kind: "plotBoardTouch",
        id: placement.plotBoardId,
        workId: command.workId,
        expectedRevision: placement.expectedBoardRevision,
        updatedAt: createdAt,
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #createEventFromPlotSerially(
    command: CreateEventFromPlotCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotBeatId,
    );
    if (plotBeat === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotBeatId}`,
      );
    }
    if (plotBeat.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotBeatId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.plotBeatId === command.plotBeatId && link.role === "primary",
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }

    const createdAt = new Date().toISOString();
    const eventBlockId = entityId<"EventBlock">(randomUUID());
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    const eventSourceId = command.source.kind === "exact-selection"
      ? entityId<"EventSource">(randomUUID())
      : null;
    const sourceRange = command.source.kind === "exact-selection"
      ? await this.#prepareEventSourceRange(
          {
            workId: command.workId,
            documentId: command.source.documentId,
            selection: command.source.selection,
            exactQuote: command.source.exactQuote,
          },
          eventBlockId,
          createdAt,
        )
      : null;
    const meta = createRecordMeta(createdAt);
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      if (sourceRange !== null && eventSourceId !== null) {
        transaction.write(
          createAnchorLedgerRecord(command.workId, sourceRange.anchor),
        );
        transaction.write({
          kind: "rangeGroup",
          ...meta,
          id: sourceRange.rangeGroupId,
          workId: command.workId,
          orderedAnchorIds: [sourceRange.anchorId],
        });
      }
      transaction.write({
        kind: "eventBlock",
        ...meta,
        id: eventBlockId,
        workId: command.workId,
        title: plotBeat.title,
        ...(plotBeat.summary.length === 0 ? {} : { note: plotBeat.summary }),
        outlineOrderKey: this.#nextEventOutlineOrderKey(
          command.workId,
          createdAt,
          eventBlockId,
        ),
        collapsed: false,
      });
      if (sourceRange !== null && eventSourceId !== null) {
        transaction.write({
          kind: "eventSource",
          ...meta,
          id: eventSourceId,
          workId: command.workId,
          eventBlockId,
          rangeGroupId: sourceRange.rangeGroupId,
          role: "primary",
        });
      }
      transaction.write({
        kind: "plotEventLink",
        ...meta,
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: command.plotBeatId,
        eventBlockId,
        role: "primary",
        createdFrom: "plot-to-event",
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #linkPlotEventSerially(
    command: LinkPlotEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const plotBeat = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotBeatId,
    );
    if (plotBeat === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotBeatId}`,
      );
    }
    if (plotBeat.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotBeatId}`);
    }
    const eventBlock = readStoredEventBlockRowById(
      this.#database,
      command.workId,
      command.eventBlockId,
    );
    if (eventBlock === null) {
      throw new Error(
        `Work/event boundary violation: ${command.workId}/${command.eventBlockId}`,
      );
    }
    if (eventBlock.retiredAt !== null) {
      throw new Error(`EventBlock is retired: ${command.eventBlockId}`);
    }
    const activeLinks = readStoredPlotEventLinkRows(
      this.#database,
      command.workId,
    );
    const existing = activeLinks.find(
      (link) =>
        link.plotBeatId === command.plotBeatId &&
        link.eventBlockId === command.eventBlockId,
    );
    if (existing !== undefined) {
      return this.#projectPlotEventLinkMutation(existing, "existing");
    }
    if (
      command.role === "primary" &&
      activeLinks.some(
        (link) => link.plotBeatId === command.plotBeatId && link.role === "primary",
      )
    ) {
      throw new Error(`Plot already has a primary EventBlock: ${command.plotBeatId}`);
    }

    const createdAt = new Date().toISOString();
    const plotEventLinkId = entityId<"PlotEventLink">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotEventLink",
        ...createRecordMeta(createdAt),
        id: plotEventLinkId,
        workId: command.workId,
        plotThreadId: command.plotBeatId,
        eventBlockId: command.eventBlockId,
        role: command.role,
        createdFrom: "manual-link",
      });
    });
    const stored = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      plotEventLinkId,
    );
    if (stored === null) {
      throw new Error(`Stored PlotEventLink is missing: ${plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(stored, "created");
  }

  async #unlinkPlotEventSerially(
    command: UnlinkPlotEventCommand,
  ): Promise<PlotEventLinkMutationProjection> {
    const current = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      command.plotEventLinkId,
    );
    if (
      current === null ||
      current.retiredAt !== null ||
      current.revision !== command.expectedRevision
    ) {
      throw new Error(`PlotEventLink revision conflict: ${command.plotEventLinkId}`);
    }
    const retiredAt = new Date().toISOString();
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "plotEventLinkRetirement",
        id: command.plotEventLinkId,
        workId: command.workId,
        expectedRevision: command.expectedRevision,
        retiredAt,
      });
    });
    const retired = readStoredPlotEventLinkRowById(
      this.#database,
      command.workId,
      command.plotEventLinkId,
    );
    if (retired === null) {
      throw new Error(`Retired PlotEventLink is missing: ${command.plotEventLinkId}`);
    }
    return this.#projectPlotEventLinkMutation(retired, "retired");
  }

  async #projectPlotThreadSourceRows(
    rows: readonly StoredPlotThreadSourceRow[],
  ): Promise<readonly PlotThreadSourceProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return parsePlotThreadSourceProjection({
          schemaVersion: 1,
          sourceId: row.sourceId,
          revision: row.revision,
          workId: row.workId,
          plotThreadId: row.plotThreadId,
          sourceDocumentId: row.sourceDocumentId,
          sourceDocumentRevisionId: row.sourceDocumentRevisionId,
          sourceAnchorId: row.sourceAnchorId,
          exactText: row.exactText,
          createdAt: row.createdAt,
          integrity: "broken",
          range: null,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return parsePlotThreadSourceProjection({
        schemaVersion: 1,
        sourceId: row.sourceId,
        revision: row.revision,
        workId: row.workId,
        plotThreadId: row.plotThreadId,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentRevisionId: row.sourceDocumentRevisionId,
        sourceAnchorId: row.sourceAnchorId,
        exactText: row.exactText,
        createdAt: row.createdAt,
        integrity,
        range: resolution.status === "resolved"
          ? {
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            }
          : null,
      });
    }));
  }

  async #linkPlotThreadSourceSerially(
    command: LinkPlotThreadSourceCommand,
  ): Promise<PlotThreadSourceProjection> {
    const plot = readStoredPlotThreadRowById(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (plot === null) {
      throw new Error(
        `Work/plot boundary violation: ${command.workId}/${command.plotThreadId}`,
      );
    }
    if (plot.retiredAt !== null) {
      throw new Error(`Plot is retired: ${command.plotThreadId}`);
    }
    const current = readStoredActivePlotThreadSourceByPlot(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if ((current?.sourceId ?? null) !== command.expectedSourceId) {
      throw new Error(`Plot source revision conflict: ${command.plotThreadId}`);
    }
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Plot source selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Plot source selected text does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const sourceId = entityId<"PlotThreadSource">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: sourceId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "plotThreadSource",
        ...createRecordMeta(createdAt),
        id: sourceId,
        workId: command.workId,
        plotThreadId: command.plotThreadId,
        expectedSourceId: command.expectedSourceId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
      });
    });
    const stored = readStoredActivePlotThreadSourceByPlot(
      this.#database,
      command.workId,
      command.plotThreadId,
    );
    if (stored === null || stored.sourceId !== sourceId) {
      throw new Error(`Stored plot source is missing: ${sourceId}`);
    }
    const [projection] = await this.#projectPlotThreadSourceRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored plot source could not be projected: ${sourceId}`);
    }
    return projection;
  }

  async #listPlotThreadSourcesSerially(
    command: ListPlotThreadSourcesCommand,
  ): Promise<PlotThreadSourceListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const sources = await this.#projectPlotThreadSourceRows(
      readStoredPlotThreadSourceRows(this.#database, command.workId),
    );
    return parsePlotThreadSourceListProjection({
      schemaVersion: 1,
      workId: command.workId,
      sources,
    });
  }

  async #createForeshadowLineSerially(
    command: CreateForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const lineId = entityId<"ForeshadowLine">(randomUUID());
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write({
        kind: "foreshadowLine",
        ...createRecordMeta(createdAt),
        id: lineId,
        workId: command.workId,
        title: command.title,
        note: command.note,
      });
    });
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      lineId,
    );
    if (stored === null) {
      throw new Error(`Stored foreshadow line is missing: ${lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  async #listForeshadowLinesSerially(
    command: ListForeshadowLinesCommand,
  ): Promise<ForeshadowLineListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const lines = readStoredForeshadowLineRows(
      this.#database,
      command.workId,
    ).map((line) => parseForeshadowLineProjection({
      schemaVersion: 1,
      ...line,
    }));
    return parseForeshadowLineListProjection({
      schemaVersion: 1,
      workId: command.workId,
      lines,
    });
  }

  async #updateForeshadowLineSerially(
    command: UpdateForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    const current = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (current === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Foreshadow line is retired: ${command.lineId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const updatedAt = new Date().toISOString();
    const result = this.#database.prepare(`
      UPDATE foreshadow_lines
      SET
        revision = revision + 1,
        updated_at = ?,
        title = ?,
        note = ?
      WHERE
        work_id = ?
        AND id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      updatedAt,
      command.changes.title ?? current.title,
      command.changes.note ?? current.note,
      command.workId,
      command.lineId,
      command.expectedRevision,
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (stored === null) {
      throw new Error(`Updated foreshadow line is missing: ${command.lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  async #retireForeshadowLineSerially(
    command: RetireForeshadowLineCommand,
  ): Promise<ForeshadowLineProjection> {
    const current = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (current === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (current.retiredAt !== null) {
      throw new Error(`Foreshadow line is already retired: ${command.lineId}`);
    }
    if (current.revision !== command.expectedRevision) {
      throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
    }
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#database.prepare(`
        UPDATE foreshadow_lines
        SET
          revision = revision + 1,
          updated_at = ?,
          retired_at = ?
        WHERE
          work_id = ?
          AND id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.lineId,
        command.expectedRevision,
      );
      if (Number(result.changes) !== 1) {
        throw new Error(`Foreshadow line revision conflict: ${command.lineId}`);
      }
      this.#database.prepare(`
        UPDATE lore_foreshadow_links
        SET
          revision = revision + 1,
          updated_at = ?,
          unlinked_at = ?,
          unlink_reason = 'foreshadow-retired'
        WHERE
          work_id = ?
          AND line_id = ?
          AND unlinked_at IS NULL
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        command.lineId,
      );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    const stored = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (stored === null) {
      throw new Error(`Retired foreshadow line is missing: ${command.lineId}`);
    }
    return parseForeshadowLineProjection({ schemaVersion: 1, ...stored });
  }

  #assertConfiguredForeshadowPointRole(roleId: string): void {
    if (
      !this.#getForeshadowPointProfile().roles.some(
        (role) => role.id === roleId,
      )
    ) {
      throw new Error(`Unknown foreshadow point role: ${roleId}`);
    }
  }

  async #projectForeshadowPointRows(
    rows: readonly StoredForeshadowPointRow[],
  ): Promise<readonly ForeshadowPointProjection[]> {
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const resolver = new ResolveAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      reader: this.#ledger,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    return Promise.all(rows.map(async (row) => {
      const target = this.#documentTargets.get(row.sourceDocumentId);
      if (target === undefined || target.workId !== row.workId) {
        return parseForeshadowPointProjection({
          schemaVersion: 1,
          ...row,
          integrity: "broken",
          range: null,
        });
      }
      const resolution = await resolver.execute({
        workId: row.workId,
        anchorId: row.sourceAnchorId,
        targetRevisionId: target.currentRevisionId,
      });
      const integrity = resolution.status === "resolved"
        ? "resolved"
        : resolution.status === "needsReview"
          ? "needsReview"
          : "broken";
      return parseForeshadowPointProjection({
        schemaVersion: 1,
        ...row,
        integrity,
        range: resolution.status === "resolved"
          ? {
              from: resolution.range.startOffset,
              to: resolution.range.endOffset,
            }
          : null,
      });
    }));
  }

  async #createForeshadowPointSerially(
    command: CreateForeshadowPointCommand,
  ): Promise<ForeshadowPointProjection> {
    this.#assertConfiguredForeshadowPointRole(command.roleId);
    const line = readStoredForeshadowLineRowById(
      this.#database,
      command.workId,
      command.lineId,
    );
    if (line === null) {
      throw new Error(
        `Work/foreshadow line boundary violation: ${command.workId}/${command.lineId}`,
      );
    }
    if (line.retiredAt !== null) {
      throw new Error(`Foreshadow line is retired: ${command.lineId}`);
    }
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const from = Math.min(command.selection.anchor, command.selection.head);
    const to = Math.max(command.selection.anchor, command.selection.head);
    if (to > target.text.length) {
      throw new Error("Foreshadow point selection is outside the current manuscript");
    }
    if (target.text.slice(from, to) !== command.exactText) {
      throw new Error(
        "Foreshadow point selected text does not match the current durable revision",
      );
    }
    const catalog = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    );
    const work = catalog.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const createdAt = new Date().toISOString();
    const pointId = entityId<"ForeshadowPoint">(randomUUID());
    const anchorId = entityId<"Anchor">(randomUUID());
    const anchor = await new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    }).execute({
      meta: {
        id: anchorId,
        schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: from,
      endOffset: to,
      policy: this.#options.defaults.anchorPolicy,
      commandRef: pointId,
      actorRef: work.studioId,
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      transaction.write(createAnchorLedgerRecord(command.workId, anchor));
      transaction.write({
        kind: "foreshadowPoint",
        ...createRecordMeta(createdAt),
        id: pointId,
        workId: command.workId,
        lineId: command.lineId,
        sourceDocumentId: command.documentId,
        sourceAnchorId: anchorId,
        roleId: command.roleId,
        note: command.note,
      });
    });
    const stored = readStoredForeshadowPointRowById(
      this.#database,
      command.workId,
      pointId,
    );
    if (stored === null) {
      throw new Error(`Stored foreshadow point is missing: ${pointId}`);
    }
    const [projection] = await this.#projectForeshadowPointRows([stored]);
    if (projection === undefined) {
      throw new Error(`Stored foreshadow point could not be projected: ${pointId}`);
    }
    return projection;
  }

  async #listForeshadowPointsSerially(
    command: ListForeshadowPointsCommand,
  ): Promise<ForeshadowPointListProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const points = await this.#projectForeshadowPointRows(
      readStoredForeshadowPointRows(this.#database, command.workId),
    );
    return parseForeshadowPointListProjection({
      schemaVersion: 1,
      workId: command.workId,
      points,
    });
  }

  async #captureWorkspaceResumeSerially(
    command: CaptureWorkspaceResumeCommand,
  ): Promise<ManuscriptResumeCheckpointProjection> {
    const target = this.#documentTargets.get(command.documentId);
    if (target === undefined || target.workId !== command.workId) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.selection.anchor > target.text.length ||
      command.selection.head > target.text.length
    ) {
      throw new Error("Resume selection is outside the current manuscript");
    }
    const rows = readStoredDocumentRows(this.#database);
    const catalog = createCatalogFromStoredRows(rows);
    const transaction =
      this.#ledger.createResumeCheckpointCaptureTransaction({});
    const work = await transaction.getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const capturedAt = new Date().toISOString();
    const commandRef = randomUUID();
    const checkpointId = entityId<"ResumeCheckpoint">(randomUUID());
    const cursorAnchorId = entityId<"Anchor">(randomUUID());
    const selectionAnchorId =
      command.selection.anchor === command.selection.head
        ? null
        : entityId<"Anchor">(randomUUID());
    const createAnchor = new CreateAnchor({
      catalog,
      revisionStore: this.#revisionStore,
      describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
        this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      ),
    });
    const recordMeta = (id: EntityId<"Anchor">) => ({
      id,
      schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
      revision: 1,
      createdAt: capturedAt,
      updatedAt: capturedAt,
    });
    const cursorAnchor = await createAnchor.execute({
      meta: recordMeta(cursorAnchorId),
      workId: command.workId,
      documentId: command.documentId,
      documentRevisionId: target.currentRevisionId,
      startOffset: command.selection.head,
      endOffset: command.selection.head,
      policy: this.#options.defaults.anchorPolicy,
      commandRef,
      actorRef: work.studioId,
    });
    const selectionAnchor =
      selectionAnchorId === null
        ? undefined
        : await createAnchor.execute({
            meta: recordMeta(selectionAnchorId),
            workId: command.workId,
            documentId: command.documentId,
            documentRevisionId: target.currentRevisionId,
            startOffset: Math.min(
              command.selection.anchor,
              command.selection.head,
            ),
            endOffset: Math.max(
              command.selection.anchor,
              command.selection.head,
            ),
            policy: this.#options.defaults.anchorPolicy,
            commandRef,
            actorRef: work.studioId,
          });
    await new CaptureResumeCheckpointWithAnchors({
      catalog,
      revisionStore: this.#revisionStore,
      transaction,
    }).execute({
      checkpoint: {
        meta: {
          id: checkpointId,
          schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
          revision: 1,
          createdAt: capturedAt,
          updatedAt: capturedAt,
        },
        workId: command.workId,
        documentId: command.documentId,
        documentRevisionId: target.currentRevisionId,
        cursorAnchorId,
        ...(selectionAnchorId === null
          ? {}
          : { selectionAnchorId }),
        workspaceMode: command.workspaceMode,
        capturedAt,
      },
      cursorAnchor,
      ...(selectionAnchor === undefined ? {} : { selectionAnchor }),
      expectedWorkRevision: work.meta.revision,
      expectedResumeCheckpointId: work.resumeCheckpointId ?? null,
      expectedDocumentRevisionId: target.currentRevisionId,
    });
    this.#resumeProjection = Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: command.workId,
      documentId: command.documentId,
      targetRevisionId: target.currentRevisionId,
      selection: Object.freeze({ ...command.selection }),
    });
    this.#catalog = parseWorkspaceCatalogProjection({
      ...this.#catalog,
      works: this.#catalog.works.map((candidate) =>
        candidate.workId === command.workId
          ? { ...candidate, updatedAt: capturedAt }
          : candidate,
      ),
      activeWorkId: command.workId,
      activeDocumentId: command.documentId,
    });
    return this.#resumeProjection;
  }

  saveChangeBatch(value: unknown): Promise<SaveReceipt> {
    this.#assertOpen();
    const execution = this.#savePending.then(() =>
      this.#saveChangeBatchSerially(value),
    );
    this.#savePending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  saveDocumentChange(value: unknown): Promise<SaveReceipt> {
    this.#assertOpen();
    const command = parseSaveManuscriptDocumentChangeCommand(value);
    const execution = this.#savePending.then(() =>
      this.#saveChangeBatchSerially(
        command.batch,
        command.editorStateJson,
      ),
    );
    this.#savePending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  moveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt> {
    this.#assertOpen();
    const command = parseMoveRangeToEpisodeCommand(value);
    const execution = Promise.all([this.#createPending, this.#savePending])
      .then(() => this.#moveRangeToEpisodeSerially(command));
    const settled = execution.then(
      () => undefined,
      () => undefined,
    );
    this.#createPending = settled;
    this.#savePending = settled;
    return execution;
  }

  undoMoveRangeToEpisode(value: unknown): Promise<MoveRangeToEpisodeReceipt> {
    this.#assertOpen();
    const command = parseUndoMoveRangeToEpisodeCommand(value);
    const execution = Promise.all([this.#createPending, this.#savePending])
      .then(() => this.#undoMoveRangeToEpisodeSerially(command));
    const settled = execution.then(
      () => undefined,
      () => undefined,
    );
    this.#createPending = settled;
    this.#savePending = settled;
    return execution;
  }

  #readEditorStateForRevision(
    workId: EntityId<"Work">,
    documentId: EntityId<"Document">,
    revisionId: EntityId<"DocumentRevision">,
    textLength: number,
  ) {
    const stored = readRevisionEditorStateJson(this.#database, {
      workId,
      documentId,
      revisionId,
    });
    return stored === undefined
      ? createDefaultManuscriptEditorDocumentState(this.#options.formattingProfile)
      : parseManuscriptEditorDocumentState(
          JSON.parse(stored),
          this.#options.formattingProfile,
          textLength,
        );
  }

  #installMovedDocumentTarget(
    target: MutableDocumentSaveTarget,
    revisionId: EntityId<"DocumentRevision">,
    text: string,
  ): void {
    target.baseRevisionId = revisionId;
    target.currentRevisionId = revisionId;
    target.nextSequence = 0;
    target.text = text;
    for (const [batchId, accepted] of this.#acceptedByBatchId) {
      if (accepted.batch.documentId === target.documentId) {
        this.#acceptedByBatchId.delete(batchId);
      }
    }
  }

  async #moveRangeToEpisodeSerially(
    command: MoveRangeToEpisodeCommand,
  ): Promise<MoveRangeToEpisodeReceipt> {
    const source = this.#documentTargets.get(command.sourceEpisodeId);
    const target = this.#documentTargets.get(command.targetEpisodeId);
    if (
      source === undefined ||
      target === undefined ||
      source.workId !== command.workId ||
      target.workId !== command.workId
    ) {
      throw new Error("Episode move must stay inside one Work");
    }
    if (
      source.currentRevisionId !== command.expectedSourceRevisionId ||
      target.currentRevisionId !== command.expectedTargetRevisionId
    ) {
      throw new Error("Episode move revision conflict");
    }
    const movedText = moveRangeToEpisodeText({
      sourceText: source.text,
      targetText: target.text,
      from: command.from,
      to: command.to,
      placement: command.placement,
    });
    const projection = await this.#listSceneProjectionSerially({
      schemaVersion: 1,
      workId: command.workId,
    });
    const annotatedSceneKeys = new Set(
      readStoredSceneAnnotationRows(this.#database, command.workId)
        .map((annotation) => annotation.sceneKey),
    );
    const scenePlan = planEpisodeSceneIdentityChanges({
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      from: command.from,
      to: command.to,
      targetInsertOffset: movedText.targetInsertOffset,
      scenes: projection.scenes
        .filter(
          (scene) =>
            scene.documentId === command.sourceEpisodeId &&
            scene.range !== null,
        )
        .map((scene) => ({
          sceneKey: scene.sceneKey,
          sceneId: scene.sceneIdentity?.sceneId ?? null,
          range: scene.range as { readonly start: number; readonly end: number },
          explicitlyStructured:
            scene.sceneIdentity !== undefined ||
            scene.source === "override" ||
            (scene.range?.start ?? 0) > 0 ||
            (scene.range?.end ?? source.text.length) < source.text.length ||
            annotatedSceneKeys.has(scene.sceneKey),
          existingSegments: (scene.sceneIdentity?.segments ?? [])
            .flatMap((segment): readonly SceneEpisodeSegmentRange[] =>
              segment.range === null
                ? []
                : [Object.freeze({
                    segmentId: segment.segmentId,
                    sceneId: segment.sceneId,
                    documentId: segment.documentId,
                    range: segment.range,
                  })]),
        })),
      createSceneId: () => entityId<"Scene">(randomUUID()),
      createSegmentId: () =>
        entityId<"EpisodeSceneSegment">(randomUUID()),
    });
    const sourceState = this.#readEditorStateForRevision(
      command.workId,
      command.sourceEpisodeId,
      source.currentRevisionId,
      source.text.length,
    );
    const targetState = this.#readEditorStateForRevision(
      command.workId,
      command.targetEpisodeId,
      target.currentRevisionId,
      target.text.length,
    );
    const movedEditorState = moveManuscriptEditorStateRange({
      sourceText: source.text,
      targetText: target.text,
      sourceState,
      targetState,
      from: command.from,
      to: command.to,
      placement: command.placement,
    });
    const moveId = entityId<"EpisodeRangeMove">(randomUUID());
    const sourceRevisionId = entityId<"DocumentRevision">(randomUUID());
    const targetRevisionId = entityId<"DocumentRevision">(randomUUID());
    const changedAt = new Date().toISOString();
    const sourceRevision = Object.freeze({
      revisionId: sourceRevisionId,
      workId: command.workId,
      documentId: command.sourceEpisodeId,
      expectedCurrentRevisionId: source.currentRevisionId,
      content: movedText.sourceText,
      editorStateJson: serializeManuscriptEditorDocumentState(
        movedEditorState.sourceState,
      ),
      cause: JSON.stringify({
        kind: "move-range-to-episode",
        moveId,
        role: "source",
      }),
      createdAt: changedAt,
      durableAt: changedAt,
    });
    const targetRevision = Object.freeze({
      revisionId: targetRevisionId,
      workId: command.workId,
      documentId: command.targetEpisodeId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: movedText.targetText,
      editorStateJson: serializeManuscriptEditorDocumentState(
        movedEditorState.targetState,
      ),
      cause: JSON.stringify({
        kind: "move-range-to-episode",
        moveId,
        role: "target",
      }),
      createdAt: changedAt,
      durableAt: changedAt,
    });
    const work = createCatalogFromStoredRows(
      readStoredDocumentRows(this.#database),
    ).getWork(command.workId);
    if (work === null) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const describeEvidence = createNodeCryptoAnchorEvidenceDescriptor(
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    const preparedSegments = scenePlan.createdSegments.map((segment) => {
      const isSource = segment.documentId === command.sourceEpisodeId;
      const documentRevisionId = isSource
        ? sourceRevisionId
        : targetRevisionId;
      const content = isSource ? movedText.sourceText : movedText.targetText;
      const anchorId = entityId<"Anchor">(randomUUID());
      return Object.freeze({
        segmentId: segment.segmentId,
        sceneId: segment.sceneId,
        anchor: createAnchorForKnownRevisionContent({
          meta: {
            id: anchorId,
            schemaVersion: LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
            revision: 1,
            createdAt: changedAt,
            updatedAt: changedAt,
          },
          documentId: segment.documentId,
          documentRevisionId,
          content,
          startOffset: segment.range.start,
          endOffset: segment.range.end,
          policy: this.#options.defaults.anchorPolicy,
          commandRef: moveId,
          actorRef: work.studioId,
          describeEvidence,
        }),
      });
    });
    const committed = await this.#episodeRangeMoveStore.commit({
      moveId,
      workId: command.workId,
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      from: command.from,
      to: command.to,
      placement: command.placement,
      sourceRevision,
      targetRevision,
      createdSceneIds: scenePlan.createdSceneIds,
      retiredSegmentIds: scenePlan.retiredSegmentIds,
      createdSegments: preparedSegments,
    });
    this.#installMovedDocumentTarget(
      source,
      committed.sourceRevision.id,
      movedText.sourceText,
    );
    this.#installMovedDocumentTarget(
      target,
      committed.targetRevision.id,
      movedText.targetText,
    );
    await this.#reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: command.sourceEpisodeId,
    });
    return parseMoveRangeToEpisodeReceipt({
      schemaVersion: 1,
      status: "moved",
      moveId,
      workId: command.workId,
      sourceEpisodeId: command.sourceEpisodeId,
      targetEpisodeId: command.targetEpisodeId,
      sourceRevisionId: committed.sourceRevision.id,
      targetRevisionId: committed.targetRevision.id,
      sceneIds: committed.sceneIds,
    });
  }

  async #undoMoveRangeToEpisodeSerially(
    command: UndoMoveRangeToEpisodeCommand,
  ): Promise<MoveRangeToEpisodeReceipt> {
    const rows = this.#database.prepare(`
      SELECT
        source_document_id AS "sourceEpisodeId",
        target_document_id AS "targetEpisodeId",
        source_before_revision_id AS "sourceBeforeRevisionId",
        target_before_revision_id AS "targetBeforeRevisionId",
        source_after_revision_id AS "sourceAfterRevisionId",
        target_after_revision_id AS "targetAfterRevisionId",
        status
      FROM episode_range_moves
      WHERE id = ? AND work_id = ?
    `).all(command.moveId, command.workId);
    if (rows.length !== 1) {
      throw new Error(`Unknown Episode range move: ${command.moveId}`);
    }
    const row = rows[0] ?? {};
    const label = "Episode range move undo row";
    const sourceEpisodeId = entityId<"Document">(
      readRequiredString(row, "sourceEpisodeId", label),
    );
    const targetEpisodeId = entityId<"Document">(
      readRequiredString(row, "targetEpisodeId", label),
    );
    const sourceAfterRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "sourceAfterRevisionId", label),
    );
    const targetAfterRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "targetAfterRevisionId", label),
    );
    const source = this.#documentTargets.get(sourceEpisodeId);
    const target = this.#documentTargets.get(targetEpisodeId);
    if (
      readRequiredString(row, "status", label) !== "active" ||
      source === undefined ||
      target === undefined ||
      source.workId !== command.workId ||
      target.workId !== command.workId ||
      source.currentRevisionId !== command.expectedSourceRevisionId ||
      target.currentRevisionId !== command.expectedTargetRevisionId ||
      source.currentRevisionId !== sourceAfterRevisionId ||
      target.currentRevisionId !== targetAfterRevisionId
    ) {
      throw new Error(`Episode range move is not undoable: ${command.moveId}`);
    }
    const sourceBeforeRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "sourceBeforeRevisionId", label),
    );
    const targetBeforeRevisionId = entityId<"DocumentRevision">(
      readRequiredString(row, "targetBeforeRevisionId", label),
    );
    const [sourceBeforeText, targetBeforeText] = await Promise.all([
      this.#revisionStore.materialize(sourceBeforeRevisionId),
      this.#revisionStore.materialize(targetBeforeRevisionId),
    ]);
    const changedAt = new Date().toISOString();
    const sourceRevisionId = entityId<"DocumentRevision">(randomUUID());
    const targetRevisionId = entityId<"DocumentRevision">(randomUUID());
    const sourceBeforeState = this.#readEditorStateForRevision(
      command.workId,
      sourceEpisodeId,
      sourceBeforeRevisionId,
      sourceBeforeText.length,
    );
    const targetBeforeState = this.#readEditorStateForRevision(
      command.workId,
      targetEpisodeId,
      targetBeforeRevisionId,
      targetBeforeText.length,
    );
    const committed = await this.#episodeRangeMoveStore.undo({
      moveId: command.moveId,
      workId: command.workId,
      sourceRevision: {
        revisionId: sourceRevisionId,
        workId: command.workId,
        documentId: sourceEpisodeId,
        expectedCurrentRevisionId: source.currentRevisionId,
        content: sourceBeforeText,
        editorStateJson: serializeManuscriptEditorDocumentState(
          sourceBeforeState,
        ),
        cause: JSON.stringify({
          kind: "undo-move-range-to-episode",
          moveId: command.moveId,
          role: "source",
        }),
        createdAt: changedAt,
        durableAt: changedAt,
      },
      targetRevision: {
        revisionId: targetRevisionId,
        workId: command.workId,
        documentId: targetEpisodeId,
        expectedCurrentRevisionId: target.currentRevisionId,
        content: targetBeforeText,
        editorStateJson: serializeManuscriptEditorDocumentState(
          targetBeforeState,
        ),
        cause: JSON.stringify({
          kind: "undo-move-range-to-episode",
          moveId: command.moveId,
          role: "target",
        }),
        createdAt: changedAt,
        durableAt: changedAt,
      },
    });
    this.#installMovedDocumentTarget(
      source,
      committed.sourceRevision.id,
      sourceBeforeText,
    );
    this.#installMovedDocumentTarget(
      target,
      committed.targetRevision.id,
      targetBeforeText,
    );
    await this.#reload({
      schemaVersion: 1,
      workId: command.workId,
      documentId: sourceEpisodeId,
    });
    return parseMoveRangeToEpisodeReceipt({
      schemaVersion: 1,
      status: "undone",
      moveId: command.moveId,
      workId: command.workId,
      sourceEpisodeId,
      targetEpisodeId,
      sourceRevisionId: committed.sourceRevision.id,
      targetRevisionId: committed.targetRevision.id,
      sceneIds: committed.sceneIds,
    });
  }

  saveFormatting(value: unknown): Promise<SaveManuscriptFormattingReceipt> {
    this.#assertOpen();
    const command = parseSaveManuscriptFormattingCommand(value);
    const execution = this.#savePending.then(async () => {
      const target = this.#documentTargets.get(command.documentId);
      if (target === undefined || target.workId !== command.workId) {
        throw new DurableChangeBatchSaveConflictError(
          `Work/document boundary violation: ${command.workId}/${command.documentId}`,
        );
      }
      if (target.currentRevisionId !== command.expectedCurrentRevisionId) {
        throw new DurableChangeBatchSaveConflictError(
          `Revision conflict for document ${command.documentId}`,
        );
      }
      const editorStateJson = canonicalizeEditorStateJson(
        command.editorStateJson,
        this.#options.formattingProfile,
        target.text.length,
      );
      const now = new Date().toISOString();
      const revision = await this.#revisionStore.append({
        revisionId: entityId<"DocumentRevision">(randomUUID()),
        workId: target.workId,
        documentId: target.documentId,
        expectedCurrentRevisionId: target.currentRevisionId,
        content: target.text,
        editorStateJson,
        cause: JSON.stringify({ kind: "manuscript-formatting" }),
        createdAt: now,
        durableAt: now,
      });
      target.currentRevisionId = revision.id;
      this.#updateDocumentProfile(target, editorStateJson);
      return Object.freeze({
        schemaVersion: 1 as const,
        workId: target.workId,
        documentId: target.documentId,
        revisionId: revision.id,
      });
    });
    this.#savePending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #saveChangeBatchSerially(
    value: unknown,
    editorStateJsonInput?: string,
  ): Promise<SaveReceipt> {
    const batch = parseChangeBatch(value);
    const accepted = this.#acceptedByBatchId.get(batch.batchId);
    if (accepted !== undefined) {
      if (
        classifyChangeBatchIdentity(accepted.batch, batch) ===
          "duplicate" &&
        accepted.editorStateJson === editorStateJsonInput
      ) {
        return accepted.receipt;
      }
      throw new DurableChangeBatchSaveConflictError(
        `Batch identity conflict: ${batch.batchId}`,
      );
    }
    const target = this.#documentTargets.get(batch.documentId);
    if (target === undefined) {
      throw new DurableChangeBatchSaveConflictError(
        `Unknown local workspace document: ${batch.documentId}`,
      );
    }
    if (target.workId !== batch.workId) {
      throw new DurableChangeBatchSaveConflictError(
        `Work/document boundary violation: ${batch.workId}/${batch.documentId}`,
      );
    }
    if (target.baseRevisionId !== batch.baseRevisionId) {
      throw new DurableChangeBatchSaveConflictError(
        `Base revision conflict for document ${batch.documentId}`,
      );
    }
    if (target.nextSequence !== batch.sequence) {
      throw new DurableChangeBatchSaveConflictError(
        `Sequence conflict for document ${batch.documentId}: expected ${target.nextSequence}, received ${batch.sequence}`,
      );
    }
    const nextText = applyChangeBatch(target.text, batch);
    const editorStateJson =
      editorStateJsonInput === undefined
        ? undefined
        : canonicalizeEditorStateJson(
            editorStateJsonInput,
            this.#options.formattingProfile,
            nextText.length,
          );
    const now = new Date().toISOString();
    const revision = await this.#revisionStore.append({
      revisionId: entityId<"DocumentRevision">(randomUUID()),
      workId: target.workId,
      documentId: target.documentId,
      expectedCurrentRevisionId: target.currentRevisionId,
      content: nextText,
      ...(editorStateJson === undefined ? {} : { editorStateJson }),
      cause: JSON.stringify({
        kind: "manuscript-edit",
        batchId: batch.batchId,
      }),
      createdAt: now,
      durableAt: now,
    });
    const receipt = Object.freeze({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      revisionId: revision.id,
    });
    target.currentRevisionId = revision.id;
    target.nextSequence += 1;
    target.text = nextText;
    this.#updateDocumentProfile(target, editorStateJson);
    this.#acceptedByBatchId.set(batch.batchId, {
      batch,
      receipt,
      editorStateJson,
    });
    return receipt;
  }

  #updateDocumentProfile(
    target: MutableDocumentSaveTarget,
    editorStateJson: string | undefined,
  ): void {
    this.#documentProfile = parseManuscriptDocumentProfile({
      ...this.#documentProfile,
      documents: this.#documentProfile.documents.map((document) =>
        document.documentId === target.documentId &&
        document.workId === target.workId
          ? {
              workId: document.workId,
              documentId: document.documentId,
              documentRevisionId: target.currentRevisionId,
              label: document.label,
              initialText: target.text,
              ...(editorStateJson === undefined ? {} : { editorStateJson }),
            }
          : document,
      ),
    });
    this.#updateCatalogDocumentCompletion(target);
  }

  async #renameWorkSerially(
    command: RenameWorkCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) => candidate.workId === command.workId,
    );
    if (row === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (row.workTitle === command.title) {
      return this.#catalog;
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE works
        SET
          title = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        command.title,
        updatedAt,
        command.workId,
        row.workRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work changed before rename: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  #readWorkFavorites(): WorkFavoritesProjection {
    const workIds = this.#database
      .prepare(`
        SELECT favorite.work_id AS "workId"
        FROM work_favorites AS favorite
        JOIN works AS work ON work.id = favorite.work_id
        WHERE work.retired_at IS NULL
        ORDER BY favorite.favorited_at, favorite.work_id
      `)
      .all()
      .map((row) =>
        entityId<"Work">(
          readRequiredString(row, "workId", "Work favorite row"),
        ),
      );
    return parseWorkFavoritesProjection({ schemaVersion: 1, workIds });
  }

  #setWorkFavoriteSerially(
    command: SetWorkFavoriteCommand,
  ): WorkFavoritesProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (command.favorite) {
        this.#database
          .prepare(`
            INSERT INTO work_favorites (
              work_id,
              schema_version,
              favorited_at
            ) VALUES (?, 1, ?)
            ON CONFLICT (work_id) DO NOTHING
          `)
          .run(command.workId, new Date().toISOString());
      } else {
        this.#database
          .prepare("DELETE FROM work_favorites WHERE work_id = ?")
          .run(command.workId);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return this.#readWorkFavorites();
  }

  #readWorkCovers(): WorkCoversProjection {
    const covers = this.#database
      .prepare(`
        SELECT
          cover.work_id AS "workId",
          cover.media_type AS "mediaType",
          cover.content_base64 AS "contentBase64"
        FROM work_covers AS cover
        JOIN works AS work ON work.id = cover.work_id
        WHERE work.retired_at IS NULL
        ORDER BY cover.updated_at, cover.work_id
      `)
      .all()
      .map((row) =>
        parseWorkCoverProjection({
          schemaVersion: 1,
          workId: readRequiredString(row, "workId", "Work cover row"),
          mediaType: readRequiredString(row, "mediaType", "Work cover row"),
          contentBase64: readRequiredString(
            row,
            "contentBase64",
            "Work cover row",
          ),
        }),
      );
    return parseWorkCoversProjection({ schemaVersion: 1, covers });
  }

  #saveWorkCoverSerially(
    command: SaveWorkCoverCommand,
  ): WorkCoverProjection {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(`
          INSERT INTO work_covers (
            work_id,
            schema_version,
            media_type,
            content_base64,
            updated_at
          ) VALUES (?, 1, ?, ?, ?)
          ON CONFLICT (work_id) DO UPDATE SET
            media_type = excluded.media_type,
            content_base64 = excluded.content_base64,
            updated_at = excluded.updated_at
        `)
        .run(
          command.workId,
          command.mediaType,
          command.contentBase64,
          new Date().toISOString(),
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    return parseWorkCoverProjection(command);
  }

  async #renameDocumentSerially(
    command: RenameDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (row === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (row.documentTitle === command.title) {
      return this.#catalog;
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE documents
        SET
          title = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(
        command.title,
        updatedAt,
        command.documentId,
        command.workId,
        row.documentRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(
          `Document changed before rename: ${command.documentId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #retireWorkSerially(
    command: RetireWorkCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const rows = this.#database.prepare(`
      SELECT revision
      FROM works
      WHERE id = ? AND retired_at IS NULL
    `).all(command.workId);
    if (rows.length === 0) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (rows.length !== 1) {
      throw new Error(`Work identity is ambiguous: ${command.workId}`);
    }
    const workRevision = readRequiredInteger(
      rows[0] ?? {},
      "revision",
      "Work retirement",
    );
    const remainingWorks = this.#catalog.works.filter(
      (work) => work.workId !== command.workId,
    );
    const activeWorkId = this.#catalog.activeWorkId;
    const preferredWork =
      activeWorkId === command.workId
        ? remainingWorks[0]
        : remainingWorks.find((work) => work.workId === activeWorkId);
    const preferredLocation =
      preferredWork === undefined
        ? undefined
        : {
            schemaVersion: 1 as const,
            workId: preferredWork.workId,
            documentId:
              activeWorkId === command.workId
                ? (preferredWork.documents[0]?.documentId ?? null)
                : this.#catalog.activeDocumentId,
          };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updated = this.#database.prepare(`
        UPDATE works
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.workId,
        workRevision,
      );
      if (Number(updated.changes) !== 1) {
        throw new Error(`Work changed before retirement: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reload(preferredLocation);
    return this.#catalog;
  }

  async #retireDocumentSerially(
    command: RetireDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const row = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (row === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const activeDocumentId = this.#catalog.activeDocumentId;
    const activeWorkId = this.#catalog.activeWorkId;
    const owner = this.#catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const targetIndex = owner.documents.findIndex(
      (document) => document.documentId === command.documentId,
    );
    if (targetIndex < 0) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const remainingDocuments = owner.documents.filter(
      (document) => document.documentId !== command.documentId,
    );
    const adjacentDocument =
      remainingDocuments[targetIndex] ??
      remainingDocuments[targetIndex - 1] ??
      null;
    const preferredLocation =
      activeDocumentId === command.documentId
        ? {
            schemaVersion: 1 as const,
            workId: command.workId,
            documentId: adjacentDocument?.documentId ?? null,
          }
        : activeWorkId === null
          ? undefined
          : {
              schemaVersion: 1 as const,
              workId: activeWorkId,
              documentId: activeDocumentId,
            };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updatedDocument = this.#database.prepare(`
        UPDATE documents
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.documentId,
        command.workId,
        row.documentRevision,
      );
      if (Number(updatedDocument.changes) !== 1) {
        throw new Error(
          `Document changed before retirement: ${command.documentId}`,
        );
      }
      this.#database.prepare(`
        UPDATE scene_episode_segments
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND document_id = ?
          AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId, command.documentId);
      this.#database.prepare(`
        UPDATE scene_identities
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND retired_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM scene_episode_segments AS segment
            WHERE
              segment.work_id = scene_identities.work_id
              AND segment.scene_id = scene_identities.id
              AND segment.retired_at IS NULL
          )
      `).run(retiredAt, retiredAt, command.workId);
      const updatedWork = this.#database.prepare(`
        UPDATE works
        SET
          resume_checkpoint_id = CASE
            WHEN resume_checkpoint_id IN (
              SELECT id
              FROM resume_checkpoints
              WHERE work_id = ? AND document_id = ?
            ) THEN NULL
            ELSE resume_checkpoint_id
          END,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        command.workId,
        command.documentId,
        retiredAt,
        command.workId,
        row.workRevision,
      );
      if (Number(updatedWork.changes) !== 1) {
        throw new Error(`Work changed before Document retirement: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reload(preferredLocation);
    return this.#catalog;
  }

  async #retireAllDocumentsSerially(
    command: RetireAllDocumentsCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const owner = this.#catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (owner.documents.length === 0) {
      return this.#catalog;
    }
    const activeWorkId = this.#catalog.activeWorkId;
    const activeDocumentId = this.#catalog.activeDocumentId;
    const preferredLocation = activeWorkId === command.workId
      ? {
          schemaVersion: 1 as const,
          workId: command.workId,
          documentId: null,
        }
      : activeWorkId === null
        ? undefined
        : {
            schemaVersion: 1 as const,
            workId: activeWorkId,
            documentId: activeDocumentId,
          };
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updatedDocuments = this.#database.prepare(`
        UPDATE documents
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      if (Number(updatedDocuments.changes) !== owner.documents.length) {
        throw new Error(
          `Documents changed before all-Document retirement: ${command.workId}`,
        );
      }
      this.#database.prepare(`
        UPDATE scene_episode_segments
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      this.#database.prepare(`
        UPDATE scene_identities
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND retired_at IS NULL
      `).run(retiredAt, retiredAt, command.workId);
      const updatedWork = this.#database.prepare(`
        UPDATE works
        SET
          resume_checkpoint_id = NULL,
          revision = revision + 1,
          updated_at = ?
        WHERE id = ? AND retired_at IS NULL
      `).run(retiredAt, command.workId);
      if (Number(updatedWork.changes) !== 1) {
        throw new Error(
          `Work changed before all-Document retirement: ${command.workId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reload(preferredLocation);
    return this.#catalog;
  }

  async #moveDocumentSerially(
    command: MoveDocumentCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const owner = this.#catalog.works.find(
      (work) => work.workId === command.workId,
    );
    if (owner === undefined) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const currentIndex = owner.documents.findIndex(
      (document) => document.documentId === command.documentId,
    );
    if (currentIndex < 0) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const targetIndex =
      currentIndex + (command.direction === "earlier" ? -1 : 1);
    const targetSummary = owner.documents[targetIndex];
    if (targetSummary === undefined) {
      return this.#catalog;
    }
    const rows = readStoredDocumentRows(this.#database);
    const currentRow = rows.find(
      (row) =>
        row.workId === command.workId &&
        row.documentId === command.documentId,
    );
    const targetRow = rows.find(
      (row) =>
        row.workId === command.workId &&
        row.documentId === targetSummary.documentId,
    );
    if (currentRow === undefined || targetRow === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    const updatedAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const updateOrder = this.#database.prepare(`
        UPDATE documents
        SET
          order_key = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
          AND archived_at IS NULL
      `);
      const moved = updateOrder.run(
        targetRow.documentOrderKey,
        updatedAt,
        currentRow.documentId,
        command.workId,
        currentRow.documentRevision,
      );
      const displaced = updateOrder.run(
        currentRow.documentOrderKey,
        updatedAt,
        targetRow.documentId,
        command.workId,
        targetRow.documentRevision,
      );
      if (Number(moved.changes) !== 1 || Number(displaced.changes) !== 1) {
        throw new Error(
          `Document order changed before move: ${command.documentId}`,
        );
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #createDocumentFolderSerially(
    command: CreateDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    if (
      command.parentFolderId !== null &&
      !readStoredDocumentFolderRows(this.#database).some(
        (folder) =>
          folder.workId === command.workId &&
          folder.folderId === command.parentFolderId,
      )
    ) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.parentFolderId}`,
      );
    }
    const folderId = entityId<"DocumentFolder">(randomUUID());
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const created = this.#database.prepare(`
        INSERT INTO document_folders (
          id,
          schema_version,
          revision,
          created_at,
          updated_at,
          retired_at,
          work_id,
          parent_folder_id,
          title,
          order_key
        )
        SELECT ?, ?, ?, ?, ?, NULL, id, ?, ?, ?
        FROM works
        WHERE id = ? AND retired_at IS NULL
      `).run(
        folderId,
        LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
        1,
        now,
        now,
        command.parentFolderId,
        command.title,
        JSON.stringify([now, folderId]),
        command.workId,
      );
      if (Number(created.changes) !== 1) {
        throw new Error(`Work changed before folder creation: ${command.workId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #renameDocumentFolderSerially(
    command: RenameDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const folder = readStoredDocumentFolderRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.folderId === command.folderId,
    );
    if (folder === undefined) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    if (folder.title === command.title) {
      return this.#catalog;
    }
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE document_folders
      SET
        title = ?,
        revision = revision + 1,
        updated_at = ?
      WHERE
        id = ?
        AND work_id = ?
        AND revision = ?
        AND retired_at IS NULL
    `).run(
      command.title,
      updatedAt,
      command.folderId,
      command.workId,
      folder.revision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Document folder changed before rename: ${command.folderId}`);
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #placeDocumentInFolderSerially(
    command: PlaceDocumentInFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const document = readStoredDocumentRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.documentId === command.documentId,
    );
    if (document === undefined) {
      throw new Error(
        `Work/document boundary violation: ${command.workId}/${command.documentId}`,
      );
    }
    if (
      command.folderId !== null &&
      !readStoredDocumentFolderRows(this.#database).some(
        (folder) =>
          folder.workId === command.workId &&
          folder.folderId === command.folderId,
      )
    ) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    if (document.folderId === command.folderId) {
      return this.#catalog;
    }
    const updatedAt = new Date().toISOString();
    const updated = this.#database.prepare(`
      UPDATE documents
      SET
        folder_id = ?,
        revision = revision + 1,
        updated_at = ?
      WHERE
        id = ?
        AND work_id = ?
        AND revision = ?
        AND retired_at IS NULL
        AND archived_at IS NULL
    `).run(
      command.folderId,
      updatedAt,
      command.documentId,
      command.workId,
      document.documentRevision,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Document changed before folder placement: ${command.documentId}`);
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #retireDocumentFolderSerially(
    command: RetireDocumentFolderCommand,
  ): Promise<WorkspaceCatalogProjection> {
    const folder = readStoredDocumentFolderRows(this.#database).find(
      (candidate) =>
        candidate.workId === command.workId &&
        candidate.folderId === command.folderId,
    );
    if (folder === undefined) {
      throw new Error(
        `Work/folder boundary violation: ${command.workId}/${command.folderId}`,
      );
    }
    const retiredAt = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare(`
        UPDATE documents
        SET
          folder_id = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE work_id = ? AND folder_id = ?
      `).run(
        folder.parentFolderId,
        retiredAt,
        command.workId,
        command.folderId,
      );
      this.#database.prepare(`
        UPDATE document_folders
        SET
          parent_folder_id = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          work_id = ?
          AND parent_folder_id = ?
          AND retired_at IS NULL
      `).run(
        folder.parentFolderId,
        retiredAt,
        command.workId,
        command.folderId,
      );
      const retired = this.#database.prepare(`
        UPDATE document_folders
        SET
          retired_at = ?,
          revision = revision + 1,
          updated_at = ?
        WHERE
          id = ?
          AND work_id = ?
          AND revision = ?
          AND retired_at IS NULL
      `).run(
        retiredAt,
        retiredAt,
        command.folderId,
        command.workId,
        folder.revision,
      );
      if (Number(retired.changes) !== 1) {
        throw new Error(`Document folder changed before retirement: ${command.folderId}`);
      }
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
    await this.#reloadPreservingActiveLocation();
    return this.#catalog;
  }

  async #reloadPreservingActiveLocation(): Promise<void> {
    const activeWorkId = this.#catalog.activeWorkId;
    if (activeWorkId === null) {
      await this.#reload();
      return;
    }
    await this.#reload({
      schemaVersion: 1,
      workId: activeWorkId,
      documentId: this.#catalog.activeDocumentId,
    });
  }

  async applyManuscriptStartupRecovery(): Promise<ApplyStartupRecoveryAcknowledgement> {
    this.#assertOpen();
    throw new Error("Local workspace startup recovery is not pending");
  }

  createDocument(value: unknown): Promise<CreateDocumentResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createDocumentSerially(value),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #createDocumentSerially(value: unknown): Promise<CreateDocumentResult> {
    const command = parseCreateDocumentCommand(value);
    if (!this.#catalog.works.some((work) => work.workId === command.workId)) {
      throw new Error(`Unknown Work: ${command.workId}`);
    }
    const now = new Date().toISOString();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: command.workId,
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(published.address);
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createDocumentRecords({
      now,
      workId: command.workId,
      title: command.title,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    const location = parseActivateWorkspaceLocationCommand({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
    });
    await this.#reload(location);
    return parseCreateDocumentResult({
      schemaVersion: 1,
      workId: command.workId,
      documentId,
      revisionId,
    });
  }

  createFirstWork(value: unknown): Promise<CreateFirstWorkResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createWorkSerially(
        parseCreateFirstWorkCommand(value),
        true,
      ),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  createWork(value: unknown): Promise<CreateWorkResult> {
    this.#assertOpen();
    const execution = this.#createPending.then(() =>
      this.#createWorkSerially(
        parseCreateWorkCommand(value),
        false,
      ),
    );
    this.#createPending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #createWorkSerially(
    command: CreateFirstWorkCommand,
    requireEmptyCatalog: boolean,
  ): Promise<CreateWorkResult> {
    if (requireEmptyCatalog && !this.#catalog.canCreateFirstWork) {
      throw new Error("The local workspace already contains a Work");
    }
    const studioRows = this.#database
      .prepare(STUDIO_ROWS_SQL)
      .all();
    if (studioRows.length > 1) {
      throw new Error("Local workspace has more than one Studio owner");
    }
    const includeStudio = studioRows.length === 0;
    const studioId = includeStudio
      ? randomUUID()
      : readRequiredString(
          studioRows[0] ?? {},
          "id",
          "Studio lookup",
        );
    const now = new Date().toISOString();
    const workId = randomUUID();
    const settingsId = randomUUID();
    const activityPolicyId = randomUUID();
    const focusPolicyId = randomUUID();
    const sceneRuleSetId = randomUUID();
    const plotBoardId = randomUUID();
    const plotLaneId = randomUUID();
    const documentId = randomUUID();
    const manuscriptId = randomUUID();
    const revisionId = randomUUID();
    const revisionInput = Object.freeze({
      revisionId: entityId<"DocumentRevision">(revisionId),
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
      expectedCurrentRevisionId: null,
      content: "",
      cause: "create-first-document",
      createdAt: now,
      durableAt: now,
    });
    const published = await this.#blobStore.append({
      bytes: this.#blobProfile.codec.encode(revisionInput.content),
      metadata: this.#blobProfile.metadataForAppend(revisionInput),
      temporaryEntryIdentity:
        this.#blobProfile.temporaryEntryIdentityForAppend(revisionInput),
    });
    const blobRef = this.#blobProfile.blobRefForAddress(
      published.address,
    );
    const descriptor = this.#blobProfile.codec.describe("");
    const records = createInitialRecords({
      includeStudio,
      studioId,
      studioDisplayName: this.#options.studioDisplayName,
      locale: this.#options.locale,
      timezone: this.#options.timezone,
      command,
      now,
      workId,
      settingsId,
      activityPolicyId,
      focusPolicyId,
      sceneRuleSetId,
      plotBoardId,
      plotLaneId,
      documentId,
      manuscriptId,
      revisionId,
      blobRef,
      checksumIdentity: published.address.checksumIdentity,
      checksumValue: published.address.checksumValue,
      byteLength: published.byteLength,
      contentHash: descriptor.contentHash,
      defaults: this.#options.defaults,
      includeBlobManifest: shouldInsertBlobManifest(this.#database, {
        blobRef,
        checksumIdentity: published.address.checksumIdentity,
        checksumValue: published.address.checksumValue,
        byteLength: published.byteLength,
      }),
    });
    await this.#ledger.transaction(async (transaction: StorageTransaction) => {
      for (const record of records) {
        transaction.write(record);
      }
    });
    await this.#reload({
      schemaVersion: 1,
      workId: entityId<"Work">(workId),
      documentId: entityId<"Document">(documentId),
    });
    return parseCreateWorkResult({
      schemaVersion: 1,
      workId,
      documentId,
      revisionId,
    });
  }

  async #reload(
    preferredLocation?: ActivateWorkspaceLocationCommand,
  ): Promise<void> {
    const existingTargets = new Map(this.#documentTargets);
    const loaded = await loadWorkspaceState(
      this.#database,
      this.#revisionStore,
      this.#options.emptyDocumentProfile,
      this.#ledger.createResumeCheckpointCaptureTransaction({}),
      this.#options.defaults.anchorEvidenceChecksumAlgorithm,
      preferredLocation,
    );
    this.#catalog = loaded.catalog;
    this.#documentProfile = loaded.documentProfile;
    this.#resumeProjection = loaded.resumeProjection;
    this.#documentTargets.clear();
    for (const loadedTarget of loaded.documentTargets) {
      const existingTarget = existingTargets.get(
        loadedTarget.documentId,
      );
      if (existingTarget === undefined) {
        this.#documentTargets.set(
          loadedTarget.documentId,
          loadedTarget,
        );
        continue;
      }
      if (
        existingTarget.currentRevisionId !==
          loadedTarget.currentRevisionId ||
        existingTarget.text !== loadedTarget.text ||
        existingTarget.workId !== loadedTarget.workId
      ) {
        throw new Error(
          `Workspace reload diverged from the active durable target: ${loadedTarget.documentId}`,
        );
      }
      this.#documentTargets.set(
        existingTarget.documentId,
        existingTarget,
      );
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#database.close();
    this.#ledger.close();
  }
}

function readStoredDocumentRows(
  database: NodeSqliteDatabase,
): readonly StoredDocumentRow[] {
  return Object.freeze(
    database
      .prepare(DOCUMENT_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Document rows[${index}]`;
        return {
        workId: entityId<"Work">(
          readRequiredString(row, "workId", label),
        ),
        workSchemaVersion: readRequiredInteger(
          row,
          "workSchemaVersion",
          label,
        ),
        workRevision: readRequiredInteger(row, "workRevision", label),
        workCreatedAt: readRequiredString(row, "workCreatedAt", label),
        workTitle: readRequiredString(
          row,
          "workTitle",
          label,
        ),
        workUpdatedAt: readRequiredString(
          row,
          "workUpdatedAt",
          label,
        ),
        workStudioId: entityId<"Studio">(
          readRequiredString(row, "workStudioId", label),
        ),
        workOrderKey: readRequiredString(row, "workOrderKey", label),
        workResumeCheckpointId: readNullableIdentity<"ResumeCheckpoint">(
          row,
          "workResumeCheckpointId",
          label,
        ),
        workSettingsId: entityId<"WorkSettings">(
          readRequiredString(row, "workSettingsId", label),
        ),
        documentId: entityId<"Document">(
          readRequiredString(row, "documentId", label),
        ),
        documentSchemaVersion: readRequiredInteger(
          row,
          "documentSchemaVersion",
          label,
        ),
        documentRevision: readRequiredInteger(
          row,
          "documentRevision",
          label,
        ),
        documentCreatedAt: readRequiredString(
          row,
          "documentCreatedAt",
          label,
        ),
        documentUpdatedAt: readRequiredString(
          row,
          "documentUpdatedAt",
          label,
        ),
        documentTitle: readRequiredString(
          row,
          "documentTitle",
          label,
        ),
        documentOrderKey: readRequiredString(
          row,
          "documentOrderKey",
          label,
        ),
        folderId: readNullableIdentity<"DocumentFolder">(
          row,
          "folderId",
          label,
        ),
        manuscriptId: entityId<"Manuscript">(
          readRequiredString(row, "manuscriptId", label),
        ),
        currentRevisionId: entityId<"DocumentRevision">(
          readRequiredString(
            row,
            "currentRevisionId",
            label,
          ),
        ),
        completionRevision: readNullableInteger(
          row,
          "completionRevision",
          label,
        ),
        completionCompletedAt: readNullableString(
          row,
          "completionCompletedAt",
          label,
        ),
        completionCompletedDate: readNullableString(
          row,
          "completionCompletedDate",
          label,
        ),
        completionCompletedTimeZone: readNullableString(
          row,
          "completionCompletedTimeZone",
          label,
        ),
        completionDocumentRevisionId: readNullableIdentity<"DocumentRevision">(
          row,
          "completionDocumentRevisionId",
          label,
        ),
        completionUpdatedAt: readNullableString(
          row,
          "completionUpdatedAt",
          label,
        ),
      };
      }),
  );
}

function readStoredDocumentFolderRows(
  database: NodeSqliteDatabase,
): readonly StoredDocumentFolderRow[] {
  return Object.freeze(
    database
      .prepare(DOCUMENT_FOLDER_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Document folder rows[${index}]`;
        return Object.freeze({
          folderId: entityId<"DocumentFolder">(
            readRequiredString(row, "folderId", label),
          ),
          schemaVersion: readRequiredInteger(row, "schemaVersion", label),
          revision: readRequiredInteger(row, "revision", label),
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          parentFolderId: readNullableIdentity<"DocumentFolder">(
            row,
            "parentFolderId",
            label,
          ),
          title: readRequiredString(row, "title", label),
          orderKey: readRequiredString(row, "orderKey", label),
        });
      }),
  );
}

function readStoredWorkRows(
  database: NodeSqliteDatabase,
): readonly StoredWorkRow[] {
  return Object.freeze(
    database
      .prepare(WORK_ROWS_SQL)
      .all()
      .map((row, index) => {
        const label = `Work rows[${index}]`;
        return Object.freeze({
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          workTitle: readRequiredString(row, "workTitle", label),
          workUpdatedAt: readRequiredString(
            row,
            "workUpdatedAt",
            label,
          ),
        });
      }),
  );
}

function parseStoredEventBlockRow(
  row: Record<string, unknown>,
  label: string,
): StoredEventBlockRow {
  const note = row.note;
  if (typeof note !== "string") {
    throw new Error(`${label}.note must be a string`);
  }
  const parentEventId = readNullableString(
    row,
    "parentEventId",
    label,
  );
  return Object.freeze({
    eventBlockId: entityId<"EventBlock">(
      readRequiredString(row, "eventBlockId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    note,
    parentEventId:
      parentEventId === null
        ? null
        : entityId<"EventBlock">(parentEventId),
    outlineOrderKey: readRequiredString(
      row,
      "outlineOrderKey",
      label,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredEventBlockRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredEventBlockRow[] {
  return Object.freeze(
    database
      .prepare(EVENT_BLOCK_ROWS_SQL)
      .all(workId)
      .map((row, index) => parseStoredEventBlockRow(
        row,
        `EventBlock rows[${index}]`,
      ))
      .sort((left, right) =>
        compareEventOutlineOrderKeys(
          left.outlineOrderKey,
          right.outlineOrderKey,
        ) || left.eventBlockId.localeCompare(right.eventBlockId)),
  );
}

function readStoredEventBlockRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  eventBlockId: EntityId<"EventBlock">,
): StoredEventBlockRow | null {
  const rows = database.prepare(EVENT_BLOCK_ROW_BY_ID_SQL).all(
    workId,
    eventBlockId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`EventBlock lookup returned duplicate rows: ${eventBlockId}`);
  }
  return parseStoredEventBlockRow(rows[0] ?? {}, "EventBlock lookup");
}

function readStoredEventSourceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredEventSourceRow[] {
  const grouped = new Map<
    EntityId<"EventSource">,
    {
      readonly eventSourceId: EntityId<"EventSource">;
      readonly revision: number;
      readonly workId: EntityId<"Work">;
      readonly eventBlockId: EntityId<"EventBlock">;
      readonly rangeGroupId: EntityId<"RangeGroup">;
      readonly role: "primary" | "supporting";
      readonly anchors: StoredEventSourceAnchorRow[];
      readonly createdAt: string;
      readonly updatedAt: string;
      readonly retiredAt: string | null;
    }
  >();
  database
    .prepare(EVENT_SOURCE_ROWS_SQL)
    .all(workId)
    .forEach((row, index) => {
      const label = `EventSource rows[${index}]`;
      const eventSourceId = entityId<"EventSource">(
        readRequiredString(row, "eventSourceId", label),
      );
      const role = readRequiredString(row, "role", label);
      if (role !== "primary" && role !== "supporting") {
        throw new Error(`${label}.role is invalid`);
      }
      let source = grouped.get(eventSourceId);
      if (source === undefined) {
        source = {
          eventSourceId,
          revision: readRequiredInteger(row, "revision", label),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          eventBlockId: entityId<"EventBlock">(
            readRequiredString(row, "eventBlockId", label),
          ),
          rangeGroupId: entityId<"RangeGroup">(
            readRequiredString(row, "rangeGroupId", label),
          ),
          role,
          anchors: [],
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
          retiredAt: readNullableString(row, "retiredAt", label),
        };
        grouped.set(eventSourceId, source);
      }
      const anchorId = readNullableString(row, "anchorId", label);
      const documentId = readNullableString(row, "documentId", label);
      const exactQuote = row.exactQuote;
      const orderIndex = readNullableInteger(row, "anchorOrderIndex", label);
      if (anchorId === null) {
        if (documentId !== null || exactQuote !== null || orderIndex !== null) {
          throw new Error(`${label} contains a partial EventSource anchor`);
        }
        return;
      }
      if (
        documentId === null ||
        typeof exactQuote !== "string" ||
        exactQuote.length === 0 ||
        orderIndex === null
      ) {
        throw new Error(`${label} contains an invalid EventSource anchor`);
      }
      source.anchors.push(Object.freeze({
        anchorId: entityId<"Anchor">(anchorId),
        documentId: entityId<"Document">(documentId),
        exactQuote,
      }));
    });
  return Object.freeze(
    [...grouped.values()].map((source) => Object.freeze({
      ...source,
      anchors: Object.freeze([...source.anchors]),
    })),
  );
}

function parseStoredFragmentRow(
  row: Record<string, unknown>,
  label: string,
): StoredFragmentRow {
  const pinned = readRequiredInteger(row, "pinned", label);
  const useCount = readRequiredInteger(row, "useCount", label);
  const revision = readRequiredInteger(row, "revision", label);
  if ((pinned !== 0 && pinned !== 1) || useCount < 0 || revision < 1) {
    throw new Error(`${label} contains invalid fragment metadata`);
  }
  return Object.freeze({
    fragmentId: entityId<"Fragment">(
      readRequiredString(row, "fragmentId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    kindId: readRequiredString(row, "kindId", label),
    title: readString(row, "title", label),
    pinned: pinned === 1,
    useCount,
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredFragmentRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredFragmentRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FRAGMENT_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredFragmentRow(
        row,
        `Fragment rows[${index}]`,
      )),
  );
}

function readStoredFragmentRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  fragmentId: EntityId<"Fragment">,
): StoredFragmentRow | null {
  const rows = database.prepare(FRAGMENT_ROW_BY_ID_SQL).all(workId, fragmentId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Fragment lookup returned duplicate rows: ${fragmentId}`);
  }
  return parseStoredFragmentRow(rows[0] ?? {}, "Fragment lookup");
}

function parseStoredCharacterRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    characterId: entityId<"Character">(
      readRequiredString(row, "characterId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    name: readRequiredString(row, "name", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    role: readString(row, "role", label),
    summary: readString(row, "summary", label),
    appearance: readString(row, "appearance", label),
    personality: readString(row, "personality", label),
    speech: readString(row, "speech", label),
    goal: readString(row, "goal", label),
    conflict: readString(row, "conflict", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredCharacterRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_CHARACTER_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterRow(
        row,
        `Character rows[${index}]`,
      )),
  );
}

function readStoredCharacterRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: EntityId<"Character">,
): StoredCharacterRow | null {
  const rows = database.prepare(CHARACTER_ROW_BY_ID_SQL).all(
    workId,
    characterId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Character lookup returned duplicate rows: ${characterId}`);
  }
  return parseStoredCharacterRow(rows[0] ?? {}, "Character lookup");
}

function parseStoredCharacterEvidenceRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterEvidenceRow {
  return Object.freeze({
    evidenceId: entityId<"CharacterEvidence">(
      readRequiredString(row, "evidenceId", label),
    ),
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    characterId: entityId<"Character">(
      readRequiredString(row, "characterId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

function readStoredCharacterEvidenceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  characterId: EntityId<"Character">,
): readonly StoredCharacterEvidenceRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_EVIDENCE_ROWS_SQL).all(workId, characterId)
      .map((row, index) => parseStoredCharacterEvidenceRow(
        row,
        `Character evidence rows[${index}]`,
      )),
  );
}

function parseStoredCharacterRelationRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterRelationRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be positive`);
  }
  const retiredAt = readNullableString(row, "retiredAt", label);
  const retirementReason = readNullableString(row, "retirementReason", label);
  if (
    retirementReason !== null &&
    retirementReason !== "user" &&
    retirementReason !== "character-retired"
  ) {
    throw new Error(`${label}.retirementReason is unsupported`);
  }
  if ((retiredAt === null) !== (retirementReason === null)) {
    throw new Error(`${label} retirement state is inconsistent`);
  }
  return Object.freeze({
    relationId: entityId<"CharacterRelation">(
      readRequiredString(row, "relationId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    fromCharacterId: entityId<"Character">(
      readRequiredString(row, "fromCharacterId", label),
    ),
    toCharacterId: entityId<"Character">(
      readRequiredString(row, "toCharacterId", label),
    ),
    kind: readRequiredString(row, "kind", label),
    description: readString(row, "description", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt,
    retirementReason: retirementReason as CharacterRelationRetirementReason | null,
  });
}

function projectStoredCharacterRelationRow(
  row: StoredCharacterRelationRow,
): CharacterRelationProjection {
  return parseCharacterRelationProjection({
    schemaVersion: 1,
    ...row,
  });
}

function readStoredCharacterRelationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterRelationRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_RELATION_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterRelationRow(
        row,
        `Character relation rows[${index}]`,
      )),
  );
}

function readStoredCharacterRelationRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  relationId: EntityId<"CharacterRelation">,
): StoredCharacterRelationRow | null {
  const rows = database.prepare(CHARACTER_RELATION_ROW_BY_ID_SQL).all(
    workId,
    relationId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Character relation lookup returned duplicates: ${relationId}`);
  }
  return parseStoredCharacterRelationRow(
    rows[0] ?? {},
    "Character relation lookup",
  );
}

function parseStoredCharacterExtractionCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterExtractionCandidateRow {
  const itemsJson = readRequiredString(row, "itemsJson", label);
  const sourceRange = {
    documentId: readRequiredString(row, "sourceDocumentId", label),
    documentRevisionId: readRequiredString(
      row,
      "sourceDocumentRevisionId",
      label,
    ),
    from: readRequiredInteger(row, "sourceFrom", label),
    to: readRequiredInteger(row, "sourceTo", label),
  };
  return Object.freeze({
    requestId: entityId<"CharacterExtractionRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseCharacterExtractionCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      sourceRange,
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      items: JSON.parse(itemsJson),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

function readStoredCharacterExtractionCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterExtractionCandidateRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_EXTRACTION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterExtractionCandidateRow(
        row,
        `Character extraction Candidate rows[${index}]`,
      )),
  );
}

function readStoredCharacterExtractionCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"CharacterExtractionCandidate">,
): StoredCharacterExtractionCandidateRow | null {
  const rows = database.prepare(
    CHARACTER_EXTRACTION_CANDIDATE_BY_ID_SQL,
  ).all(workId, candidateId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Character extraction Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredCharacterExtractionCandidateRow(
    rows[0] ?? {},
    "Character extraction Candidate lookup",
  );
}

function parseStoredCharacterGenerationCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredCharacterGenerationCandidateRow {
  return Object.freeze({
    requestId: entityId<"CharacterGenerationRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseCharacterGenerationCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      brief: JSON.parse(readRequiredString(row, "briefJson", label)),
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      items: JSON.parse(readRequiredString(row, "itemsJson", label)),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

function readStoredCharacterGenerationCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredCharacterGenerationCandidateRow[] {
  return Object.freeze(
    database.prepare(CHARACTER_GENERATION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredCharacterGenerationCandidateRow(
        row,
        `Character generation Candidate rows[${index}]`,
      )),
  );
}

function readStoredCharacterGenerationCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"CharacterGenerationCandidate">,
): StoredCharacterGenerationCandidateRow | null {
  const rows = database.prepare(
    CHARACTER_GENERATION_CANDIDATE_BY_ID_SQL,
  ).all(workId, candidateId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Character generation Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredCharacterGenerationCandidateRow(
    rows[0] ?? {},
    "Character generation Candidate lookup",
  );
}

function parseStoredSceneExtractionCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneExtractionCandidateRow {
  return Object.freeze({
    requestId: entityId<"SceneExtractionRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate: parseSceneExtractionCandidate({
      schemaVersion: 1,
      candidateId: readRequiredString(row, "candidateId", label),
      revision: readRequiredInteger(row, "revision", label),
      workId: readRequiredString(row, "workId", label),
      sourceRange: {
        documentId: readRequiredString(row, "sourceDocumentId", label),
        documentRevisionId: readRequiredString(
          row,
          "sourceDocumentRevisionId",
          label,
        ),
        from: readRequiredInteger(row, "sourceFrom", label),
        to: readRequiredInteger(row, "sourceTo", label),
      },
      providerId: readRequiredString(row, "providerId", label),
      modelId: readRequiredString(row, "modelId", label),
      promptVersion: readRequiredString(row, "promptVersion", label),
      status: readRequiredString(row, "status", label),
      scenes: JSON.parse(readRequiredString(row, "scenesJson", label)),
      boundaries: JSON.parse(readRequiredString(row, "boundariesJson", label)),
      contextReceiptId: readRequiredString(row, "contextReceiptId", label),
      createdAt: readRequiredString(row, "createdAt", label),
      updatedAt: readRequiredString(row, "updatedAt", label),
    }),
  });
}

function readStoredSceneExtractionCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneExtractionCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_EXTRACTION_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneExtractionCandidateRow(
        row,
        `Scene extraction Candidate rows[${index}]`,
      )),
  );
}

function readStoredSceneExtractionCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneExtractionCandidate">,
): StoredSceneExtractionCandidateRow | null {
  const rows = database.prepare(SCENE_EXTRACTION_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene extraction Candidate lookup is ambiguous: ${candidateId}`);
  }
  return parseStoredSceneExtractionCandidateRow(
    rows[0] ?? {},
    "Scene extraction Candidate lookup",
  );
}

function parseStoredSceneDraftCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneDraftCandidateRow {
  const context = parseSceneDraftContext(
    JSON.parse(readRequiredString(row, "contextJson", label)),
  );
  const plotThreadId = entityId<"PlotThread">(
    readRequiredString(row, "plotThreadId", label),
  );
  const plotThreadRevision = readRequiredInteger(
    row,
    "plotThreadRevision",
    label,
  );
  if (
    context.plot.plotThreadId !== plotThreadId ||
    context.plot.revision !== plotThreadRevision
  ) {
    throw new Error(`${label} plot context does not match stored columns`);
  }
  const candidate = parseSceneDraftCandidate({
    schemaVersion: 1,
    candidateId: readRequiredString(row, "candidateId", label),
    revision: readRequiredInteger(row, "revision", label),
    workId: readRequiredString(row, "workId", label),
    context,
    target: {
      documentId: readRequiredString(row, "targetDocumentId", label),
      documentRevisionId: readRequiredString(
        row,
        "targetDocumentRevisionId",
        label,
      ),
      insertionOffset: readRequiredInteger(row, "insertionOffset", label),
    },
    providerId: readRequiredString(row, "providerId", label),
    modelId: readRequiredString(row, "modelId", label),
    promptVersion: readRequiredString(row, "promptVersion", label),
    generatedText: readRequiredString(row, "generatedText", label),
    draftText: readRequiredString(row, "draftText", label),
    status: readRequiredString(row, "status", label),
    integrity: "current",
    appliedDocumentRevisionId: readNullableString(
      row,
      "appliedDocumentRevisionId",
      label,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    requestId: entityId<"SceneDraftRequest">(
      readRequiredString(row, "requestId", label),
    ),
    candidate,
  });
}

function readStoredSceneDraftCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneDraftCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_DRAFT_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneDraftCandidateRow(
        row,
        `Scene draft Candidate rows[${index}]`,
      )),
  );
}

function readStoredSceneDraftCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneDraftCandidate">,
): StoredSceneDraftCandidateRow | null {
  const rows = database.prepare(SCENE_DRAFT_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene draft Candidate lookup is ambiguous: ${candidateId}`);
  }
  return parseStoredSceneDraftCandidateRow(
    rows[0] ?? {},
    "Scene draft Candidate lookup",
  );
}

function parseStoredSceneAnnotationRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneAnnotationRow {
  return parseSceneAnnotationProjection({
    schemaVersion: 1,
    sceneAnnotationId: readRequiredString(row, "sceneAnnotationId", label),
    revision: readRequiredInteger(row, "revision", label),
    workId: readRequiredString(row, "workId", label),
    sceneKey: readRequiredString(row, "sceneKey", label),
    documentId: readRequiredString(row, "documentId", label),
    documentRevisionId: readRequiredString(row, "documentRevisionId", label),
    sourceCandidateId: readRequiredString(row, "sourceCandidateId", label),
    sourceSceneItemId: readRequiredString(row, "sourceSceneItemId", label),
    title: readRequiredString(row, "title", label),
    summary: readString(row, "summary", label),
    povCharacterId: readNullableString(row, "povCharacterId", label),
    location: readString(row, "location", label),
    time: readString(row, "time", label),
    characterIds: JSON.parse(
      readRequiredString(row, "characterIdsJson", label),
    ),
    goal: readString(row, "goal", label),
    conflict: readString(row, "conflict", label),
    outcome: readString(row, "outcome", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

function readStoredSceneAnnotationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneAnnotationRow[] {
  return Object.freeze(
    database.prepare(SCENE_ANNOTATION_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneAnnotationRow(
        row,
        `Scene annotation rows[${index}]`,
      )),
  );
}

function readStoredSceneAnnotationRowByKey(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  sceneKey: string,
): StoredSceneAnnotationRow | null {
  const rows = database.prepare(SCENE_ANNOTATION_BY_KEY_SQL).all(
    workId,
    sceneKey,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Scene annotation lookup is ambiguous: ${sceneKey}`);
  }
  return parseStoredSceneAnnotationRow(
    rows[0] ?? {},
    "Scene annotation lookup",
  );
}

function parseStoredSceneMusicQueueCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredSceneMusicQueueCandidateRow {
  return parseSceneMusicQueueCandidate({
    schemaVersion: 1,
    candidateId: readRequiredString(row, "candidateId", label),
    revision: readRequiredInteger(row, "revision", label),
    workId: readRequiredString(row, "workId", label),
    sceneKey: readRequiredString(row, "sceneKey", label),
    sceneAnnotationId: readRequiredString(row, "sceneAnnotationId", label),
    sceneAnnotationRevision: readRequiredInteger(
      row,
      "sceneAnnotationRevision",
      label,
    ),
    providerId: readRequiredString(row, "providerId", label),
    query: readRequiredString(row, "query", label),
    status: readRequiredString(row, "status", label),
    integrity: "current",
    options: JSON.parse(readRequiredString(row, "optionsJson", label)),
    selectedOptionId: readNullableString(row, "selectedOptionId", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

function readStoredSceneMusicQueueCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneMusicQueueCandidateRow[] {
  return Object.freeze(
    database.prepare(SCENE_MUSIC_QUEUE_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredSceneMusicQueueCandidateRow(
        row,
        `Scene music queue Candidate rows[${index}]`,
      )),
  );
}

function readStoredSceneMusicQueueCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"SceneMusicQueueCandidate">,
): StoredSceneMusicQueueCandidateRow | null {
  const rows = database.prepare(SCENE_MUSIC_QUEUE_CANDIDATE_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Scene music queue Candidate lookup is ambiguous: ${candidateId}`,
    );
  }
  return parseStoredSceneMusicQueueCandidateRow(
    rows[0] ?? {},
    "Scene music queue Candidate lookup",
  );
}

function parseStoredLoreEntryRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryRow {
  const revision = readRequiredInteger(row, "revision", label);
  const enabled = readRequiredInteger(row, "enabled", label);
  if (revision < 1 || (enabled !== 0 && enabled !== 1)) {
    throw new Error(`${label} contains invalid lore entry metadata`);
  }
  return Object.freeze({
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    title: readRequiredString(row, "title", label),
    content: readString(row, "content", label),
    category: readString(row, "category", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    enabled: enabled === 1,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredLoreEntryRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreEntryRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_LORE_ENTRY_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreEntryRow(
        row,
        `Lore entry rows[${index}]`,
      )),
  );
}

function readStoredLoreEntryRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): StoredLoreEntryRow | null {
  const rows = database.prepare(LORE_ENTRY_ROW_BY_ID_SQL).all(
    workId,
    loreEntryId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore entry lookup returned duplicate rows: ${loreEntryId}`);
  }
  return parseStoredLoreEntryRow(rows[0] ?? {}, "Lore entry lookup");
}

function parseStoredLoreEntryEvidenceRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryEvidenceRow {
  return Object.freeze({
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

function readStoredLoreEntryEvidenceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): readonly StoredLoreEntryEvidenceRow[] {
  return Object.freeze(
    database.prepare(LORE_ENTRY_EVIDENCE_ROWS_SQL).all(workId, loreEntryId)
      .map((row, index) => parseStoredLoreEntryEvidenceRow(
        row,
        `Lore entry evidence rows[${index}]`,
      )),
  );
}

function parseStoredLoreEntryHistoryRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreEntryHistoryRow {
  const entryRevision = readRequiredInteger(row, "entryRevision", label);
  const enabled = readRequiredInteger(row, "enabled", label);
  const changeKind = readRequiredString(row, "changeKind", label);
  if (
    entryRevision < 1 ||
    (enabled !== 0 && enabled !== 1) ||
    !["created", "updated", "evidence-added", "retired"].includes(changeKind)
  ) {
    throw new Error(`${label} contains invalid lore history metadata`);
  }
  return Object.freeze({
    historyId: entityId<"LoreEntryHistory">(
      readRequiredString(row, "historyId", label),
    ),
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    entryRevision,
    changeKind: changeKind as StoredLoreEntryHistoryRow["changeKind"],
    title: readRequiredString(row, "title", label),
    content: readString(row, "content", label),
    category: readString(row, "category", label),
    aliases: parseStoredStringArray(
      readRequiredString(row, "aliasesJson", label),
      `${label}.aliasesJson`,
    ),
    enabled: enabled === 1,
    evidenceAnchorIds: Object.freeze(parseStoredStringArray(
      readRequiredString(row, "evidenceAnchorIdsJson", label),
      `${label}.evidenceAnchorIdsJson`,
    ).map((anchorId) => entityId<"Anchor">(anchorId))),
    changedAt: readRequiredString(row, "changedAt", label),
  });
}

function readStoredLoreEntryHistoryRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
): readonly StoredLoreEntryHistoryRow[] {
  return Object.freeze(
    database.prepare(LORE_ENTRY_HISTORY_ROWS_SQL).all(workId, loreEntryId)
      .map((row, index) => parseStoredLoreEntryHistoryRow(
        row,
        `Lore entry history rows[${index}]`,
      )),
  );
}

function parseStoredLoreForeshadowLinkRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreForeshadowLinkRow {
  const revision = readRequiredInteger(row, "revision", label);
  const unlinkedAt = readNullableString(row, "unlinkedAt", label);
  const unlinkReason = readNullableString(row, "unlinkReason", label);
  if (
    revision < 1 ||
    (
      unlinkReason !== null &&
      unlinkReason !== "user" &&
      unlinkReason !== "lore-retired" &&
      unlinkReason !== "foreshadow-retired"
    ) ||
    ((unlinkedAt === null) !== (unlinkReason === null))
  ) {
    throw new Error(`${label} contains invalid lore/foreshadow link metadata`);
  }
  return Object.freeze({
    linkId: entityId<"LoreForeshadowLink">(
      readRequiredString(row, "linkId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    loreEntryId: entityId<"LoreEntry">(
      readRequiredString(row, "loreEntryId", label),
    ),
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
    ),
    linkedAt: readRequiredString(row, "linkedAt", label),
    unlinkedAt,
    unlinkReason: unlinkReason as LoreForeshadowUnlinkReason | null,
  });
}

function projectStoredLoreForeshadowLinkRow(
  row: StoredLoreForeshadowLinkRow,
): LoreForeshadowLinkProjection {
  return parseLoreForeshadowLinkProjection({
    schemaVersion: 1,
    ...row,
  });
}

function readStoredLoreForeshadowLinkRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreForeshadowLinkRow[] {
  return Object.freeze(
    database.prepare(LORE_FORESHADOW_LINK_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreForeshadowLinkRow(
        row,
        `Lore/foreshadow link rows[${index}]`,
      )),
  );
}

function readStoredLoreForeshadowLinkRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  linkId: EntityId<"LoreForeshadowLink">,
): StoredLoreForeshadowLinkRow | null {
  const rows = database.prepare(LORE_FORESHADOW_LINK_ROW_BY_ID_SQL).all(
    workId,
    linkId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore/foreshadow link lookup returned duplicate rows: ${linkId}`);
  }
  return parseStoredLoreForeshadowLinkRow(
    rows[0] ?? {},
    "Lore/foreshadow link lookup",
  );
}

function readActiveLoreForeshadowLinkByPair(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  loreEntryId: EntityId<"LoreEntry">,
  lineId: EntityId<"ForeshadowLine">,
): StoredLoreForeshadowLinkRow | null {
  const rows = database.prepare(ACTIVE_LORE_FORESHADOW_LINK_BY_PAIR_SQL).all(
    workId,
    loreEntryId,
    lineId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Active lore/foreshadow link lookup returned duplicate rows: ${loreEntryId}/${lineId}`,
    );
  }
  return parseStoredLoreForeshadowLinkRow(
    rows[0] ?? {},
    "Active lore/foreshadow link lookup",
  );
}

function parseStoredLoreCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredLoreCandidateRow {
  const revision = readRequiredInteger(row, "revision", label);
  const source = readRequiredString(row, "source", label);
  const certainty = readRequiredString(row, "certainty", label);
  const status = readRequiredString(row, "status", label);
  const reviewedAt = readNullableString(row, "reviewedAt", label);
  const approvedLoreEntryId = readNullableIdentity<"LoreEntry">(
    row,
    "approvedLoreEntryId",
    label,
  );
  if (
    revision < 1 ||
    (source !== "user" && source !== "assistant") ||
    (certainty !== "explicit" && certainty !== "inferred") ||
    (status !== "pending" && status !== "approved" && status !== "rejected") ||
    ((status === "pending") !== (reviewedAt === null)) ||
    ((status === "approved") !== (approvedLoreEntryId !== null))
  ) {
    throw new Error(`${label} contains invalid lore Candidate metadata`);
  }
  let rawProposal: unknown;
  try {
    rawProposal = JSON.parse(
      readRequiredString(row, "proposalJson", label),
    ) as unknown;
  } catch {
    throw new Error(`${label}.proposalJson must be JSON`);
  }
  return Object.freeze({
    candidateId: entityId<"LoreCandidate">(
      readRequiredString(row, "candidateId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    source: source as StoredLoreCandidateRow["source"],
    certainty: certainty as StoredLoreCandidateRow["certainty"],
    proposal: parseLoreCandidateProposal(rawProposal),
    reason: readString(row, "reason", label),
    status: status as StoredLoreCandidateRow["status"],
    approvedLoreEntryId,
    createdAt: readRequiredString(row, "createdAt", label),
    reviewedAt,
  });
}

function readStoredLoreCandidateRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredLoreCandidateRow[] {
  return Object.freeze(
    database.prepare(LORE_CANDIDATE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredLoreCandidateRow(
        row,
        `Lore Candidate rows[${index}]`,
      )),
  );
}

function readStoredLoreCandidateRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  candidateId: EntityId<"LoreCandidate">,
): StoredLoreCandidateRow | null {
  const rows = database.prepare(LORE_CANDIDATE_ROW_BY_ID_SQL).all(
    workId,
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Lore Candidate lookup returned duplicate rows: ${candidateId}`);
  }
  return parseStoredLoreCandidateRow(
    rows[0] ?? {},
    "Lore Candidate lookup",
  );
}

function parseStoredStringArray(
  value: string,
  label: string,
): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must be JSON`);
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return Object.freeze(parsed.map((entry) => entry as string));
}

function parseStoredPublishingPartnerRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPartnerRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    partnerId: entityId<"PublishingPartner">(
      readRequiredString(row, "partnerId", label),
    ),
    revision,
    name: readRequiredString(row, "name", label),
    parentPartnerId: readNullableIdentity<"PublishingPartner">(
      row,
      "parentPartnerId",
      label,
    ),
    submissionMethod: readString(row, "submissionMethod", label),
    websiteUrl: readString(row, "websiteUrl", label),
    email: readString(row, "email", label),
    genres: parseStoredStringArray(
      readRequiredString(row, "genresJson", label),
      `${label}.genresJson`,
    ),
    requiredLength: readString(row, "requiredLength", label),
    priority: readString(row, "priority", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingPartnerRow(
  row: StoredPublishingPartnerRow,
): PublishingPartnerProjection {
  return parsePublishingPartnerProjection({
    schemaVersion: 1,
    partnerId: row.partnerId,
    revision: row.revision,
    name: row.name,
    parentPartnerId: row.parentPartnerId,
    submissionMethod: row.submissionMethod,
    websiteUrl: row.websiteUrl,
    email: row.email,
    genres: row.genres,
    requiredLength: row.requiredLength,
    priority: row.priority,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingPartnerRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingPartnerRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PARTNER_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingPartnerRow(
        row,
        `Publishing partner rows[${index}]`,
      )),
  );
}

function readStoredPublishingPartnerRowById(
  database: NodeSqliteDatabase,
  partnerId: EntityId<"PublishingPartner">,
): StoredPublishingPartnerRow | null {
  const rows = database.prepare(PUBLISHING_PARTNER_ROW_BY_ID_SQL).all(partnerId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing partner lookup returned duplicate rows: ${partnerId}`);
  }
  return parseStoredPublishingPartnerRow(
    rows[0] ?? {},
    "Publishing partner lookup",
  );
}

function parseStoredPublishingSubmissionRows(
  rows: readonly Record<string, unknown>[],
  label: string,
): readonly StoredPublishingSubmissionRow[] {
  type GroupedRow = {
    readonly submissionId: EntityId<"PublishingSubmission">;
    readonly revision: number;
    readonly workId: EntityId<"Work">;
    readonly partnerId: EntityId<"PublishingPartner">;
    readonly title: string;
    readonly status: string;
    readonly submittedOn: string | null;
    readonly respondedOn: string | null;
    readonly result: string;
    readonly note: string;
    readonly cardNote: string;
    readonly sourceIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly retiredAt: string | null;
    readonly submissionPackageId: EntityId<"SubmissionPackage">;
    readonly workSnapshotId: EntityId<"WorkSnapshot">;
    readonly workTitleSnapshot: string;
    readonly partnerNameSnapshot: string;
    readonly packageManifestHash: string;
    readonly sealedAt: string;
    readonly documentRevisions: Array<{
      readonly documentId: EntityId<"Document">;
      readonly documentRevisionId: EntityId<"DocumentRevision">;
    }>;
  };

  const grouped = new Map<EntityId<"PublishingSubmission">, GroupedRow>();
  rows.forEach((row, index) => {
    const rowLabel = `${label}[${index}]`;
    const submissionId = entityId<"PublishingSubmission">(
      readRequiredString(row, "submissionId", rowLabel),
    );
    let entry = grouped.get(submissionId);
    if (entry === undefined) {
      const revision = readRequiredInteger(row, "revision", rowLabel);
      if (revision < 1) {
        throw new Error(`${rowLabel}.revision must be at least 1`);
      }
      entry = {
        submissionId,
        revision,
        workId: entityId<"Work">(
          readRequiredString(row, "workId", rowLabel),
        ),
        partnerId: entityId<"PublishingPartner">(
          readRequiredString(row, "partnerId", rowLabel),
        ),
        title: readString(row, "title", rowLabel),
        status: readString(row, "status", rowLabel),
        submittedOn: readNullableString(row, "submittedOn", rowLabel),
        respondedOn: readNullableString(row, "respondedOn", rowLabel),
        result: readString(row, "result", rowLabel),
        note: readString(row, "note", rowLabel),
        cardNote: readString(row, "cardNote", rowLabel),
        sourceIds: parseStoredStringArray(
          readRequiredString(row, "sourceIdsJson", rowLabel),
          `${rowLabel}.sourceIdsJson`,
        ),
        createdAt: readRequiredString(row, "createdAt", rowLabel),
        updatedAt: readRequiredString(row, "updatedAt", rowLabel),
        retiredAt: readNullableString(row, "retiredAt", rowLabel),
        submissionPackageId: entityId<"SubmissionPackage">(
          readRequiredString(row, "submissionPackageId", rowLabel),
        ),
        workSnapshotId: entityId<"WorkSnapshot">(
          readRequiredString(row, "workSnapshotId", rowLabel),
        ),
        workTitleSnapshot: readString(row, "workTitleSnapshot", rowLabel),
        partnerNameSnapshot: readRequiredString(
          row,
          "partnerNameSnapshot",
          rowLabel,
        ),
        packageManifestHash: readRequiredString(
          row,
          "packageManifestHash",
          rowLabel,
        ),
        sealedAt: readRequiredString(row, "sealedAt", rowLabel),
        documentRevisions: [],
      };
      grouped.set(submissionId, entry);
    }
    const documentId = row.documentId;
    const documentRevisionId = row.documentRevisionId;
    if (documentId === null && documentRevisionId === null) return;
    if (
      typeof documentId !== "string" ||
      documentId.length === 0 ||
      typeof documentRevisionId !== "string" ||
      documentRevisionId.length === 0
    ) {
      throw new Error(`${rowLabel} has an incomplete SubmissionPackage revision`);
    }
    entry.documentRevisions.push({
      documentId: entityId<"Document">(documentId),
      documentRevisionId: entityId<"DocumentRevision">(documentRevisionId),
    });
  });

  return Object.freeze([...grouped.values()].map((entry) => {
    const packageProjection: SubmissionPackageProjection =
      parseSubmissionPackageProjection({
        schemaVersion: 1,
        submissionPackageId: entry.submissionPackageId,
        workId: entry.workId,
        partnerId: entry.partnerId,
        workSnapshotId: entry.workSnapshotId,
        workTitleSnapshot: entry.workTitleSnapshot,
        partnerNameSnapshot: entry.partnerNameSnapshot,
        manifestHash: entry.packageManifestHash,
        sealedAt: entry.sealedAt,
        documentRevisions: entry.documentRevisions,
      });
    const projection = parsePublishingSubmissionProjection({
      schemaVersion: 1,
      submissionId: entry.submissionId,
      revision: entry.revision,
      workId: entry.workId,
      partnerId: entry.partnerId,
      title: entry.title,
      status: entry.status,
      submittedOn: entry.submittedOn,
      respondedOn: entry.respondedOn,
      result: entry.result,
      note: entry.note,
      cardNote: entry.cardNote,
      sourceIds: entry.sourceIds,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      package: packageProjection,
    });
    return Object.freeze({
      submissionId: projection.submissionId,
      revision: projection.revision,
      workId: projection.workId,
      partnerId: projection.partnerId,
      title: projection.title,
      status: projection.status,
      submittedOn: projection.submittedOn,
      respondedOn: projection.respondedOn,
      result: projection.result,
      note: projection.note,
      cardNote: projection.cardNote,
      sourceIds: projection.sourceIds,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      package: projection.package,
      retiredAt: entry.retiredAt,
    });
  }));
}

function projectStoredPublishingSubmissionRow(
  row: StoredPublishingSubmissionRow,
): PublishingSubmissionProjection {
  return parsePublishingSubmissionProjection({
    schemaVersion: 1,
    submissionId: row.submissionId,
    revision: row.revision,
    workId: row.workId,
    partnerId: row.partnerId,
    title: row.title,
    status: row.status,
    submittedOn: row.submittedOn,
    respondedOn: row.respondedOn,
    result: row.result,
    note: row.note,
    cardNote: row.cardNote,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    package: row.package,
  });
}

function readStoredPublishingSubmissionRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingSubmissionRow[] {
  return parseStoredPublishingSubmissionRows(
    database.prepare(ACTIVE_PUBLISHING_SUBMISSION_ROWS_SQL).all(
      workId,
      workId,
    ),
    "Publishing submission rows",
  );
}

function readStoredPublishingSubmissionRowById(
  database: NodeSqliteDatabase,
  submissionId: EntityId<"PublishingSubmission">,
): StoredPublishingSubmissionRow | null {
  const rows = database.prepare(PUBLISHING_SUBMISSION_ROW_BY_ID_SQL).all(
    submissionId,
  );
  if (rows.length === 0) return null;
  const submissions = parseStoredPublishingSubmissionRows(
    rows,
    "Publishing submission lookup",
  );
  if (submissions.length !== 1) {
    throw new Error(`Publishing submission lookup returned duplicate rows: ${submissionId}`);
  }
  return submissions[0] ?? null;
}

function parseStoredPublishingContractRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingContractRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const advanceAmountValue = row.advanceAmount;
  if (
    advanceAmountValue !== null &&
    (typeof advanceAmountValue !== "number" ||
      !Number.isFinite(advanceAmountValue) ||
      advanceAmountValue < 0)
  ) {
    throw new Error(`${label}.advanceAmount must be non-negative or null`);
  }
  const submissionIdValue = readNullableString(row, "submissionId", label);
  const projection = parsePublishingContractProjection({
    schemaVersion: 1,
    contractId: readRequiredString(row, "contractId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    partnerId: readRequiredString(row, "partnerId", label),
    submissionId: submissionIdValue,
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    partnerNameSnapshot: readRequiredString(row, "partnerNameSnapshot", label),
    status: readString(row, "status", label),
    signedOn: readNullableString(row, "signedOn", label),
    startsOn: readNullableString(row, "startsOn", label),
    endsOn: readNullableString(row, "endsOn", label),
    rightsScope: readString(row, "rightsScope", label),
    advanceAmount: advanceAmountValue,
    currencyCode: readString(row, "currencyCode", label),
    revenueShareNote: readString(row, "revenueShareNote", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    contractId: projection.contractId,
    revision: projection.revision,
    workId: projection.workId,
    partnerId: projection.partnerId,
    submissionId: projection.submissionId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    partnerNameSnapshot: projection.partnerNameSnapshot,
    status: projection.status,
    signedOn: projection.signedOn,
    startsOn: projection.startsOn,
    endsOn: projection.endsOn,
    rightsScope: projection.rightsScope,
    advanceAmount: projection.advanceAmount,
    currencyCode: projection.currencyCode,
    revenueShareNote: projection.revenueShareNote,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingContractRow(
  row: StoredPublishingContractRow,
): PublishingContractProjection {
  return parsePublishingContractProjection({
    schemaVersion: 1,
    contractId: row.contractId,
    revision: row.revision,
    workId: row.workId,
    partnerId: row.partnerId,
    submissionId: row.submissionId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    partnerNameSnapshot: row.partnerNameSnapshot,
    status: row.status,
    signedOn: row.signedOn,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    rightsScope: row.rightsScope,
    advanceAmount: row.advanceAmount,
    currencyCode: row.currencyCode,
    revenueShareNote: row.revenueShareNote,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingContractRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingContractRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_CONTRACT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingContractRow(
        row,
        `Publishing contract rows[${index}]`,
      )),
  );
}

function readStoredPublishingContractRowById(
  database: NodeSqliteDatabase,
  contractId: EntityId<"PublishingContract">,
): StoredPublishingContractRow | null {
  const rows = database.prepare(PUBLISHING_CONTRACT_ROW_BY_ID_SQL).all(contractId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing contract lookup returned duplicate rows: ${contractId}`);
  }
  return parseStoredPublishingContractRow(rows[0] ?? {}, "Publishing contract lookup");
}

function parseStoredPublishingPublicationRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPublicationRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const projection = parsePublishingPublicationProjection({
    schemaVersion: 1,
    publicationId: readRequiredString(row, "publicationId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    contractId: readNullableString(row, "contractId", label),
    channelPartnerId: readNullableString(row, "channelPartnerId", label),
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    channelNameSnapshot: readString(row, "channelNameSnapshot", label),
    status: readString(row, "status", label),
    format: readString(row, "format", label),
    scheduledOn: readNullableString(row, "scheduledOn", label),
    startsOn: readNullableString(row, "startsOn", label),
    endsOn: readNullableString(row, "endsOn", label),
    publishedUnitCount: readNullableInteger(row, "publishedUnitCount", label),
    plannedUnitCount: readNullableInteger(row, "plannedUnitCount", label),
    scheduleNote: readString(row, "scheduleNote", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    publicationId: projection.publicationId,
    revision: projection.revision,
    workId: projection.workId,
    contractId: projection.contractId,
    channelPartnerId: projection.channelPartnerId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    channelNameSnapshot: projection.channelNameSnapshot,
    status: projection.status,
    format: projection.format,
    scheduledOn: projection.scheduledOn,
    startsOn: projection.startsOn,
    endsOn: projection.endsOn,
    publishedUnitCount: projection.publishedUnitCount,
    plannedUnitCount: projection.plannedUnitCount,
    scheduleNote: projection.scheduleNote,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingPublicationRow(
  row: StoredPublishingPublicationRow,
): PublishingPublicationProjection {
  return parsePublishingPublicationProjection({
    schemaVersion: 1,
    publicationId: row.publicationId,
    revision: row.revision,
    workId: row.workId,
    contractId: row.contractId,
    channelPartnerId: row.channelPartnerId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    channelNameSnapshot: row.channelNameSnapshot,
    status: row.status,
    format: row.format,
    scheduledOn: row.scheduledOn,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    publishedUnitCount: row.publishedUnitCount,
    plannedUnitCount: row.plannedUnitCount,
    scheduleNote: row.scheduleNote,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingPublicationRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingPublicationRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PUBLICATION_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingPublicationRow(
        row,
        `Publishing publication rows[${index}]`,
      )),
  );
}

function readStoredPublishingPublicationRowById(
  database: NodeSqliteDatabase,
  publicationId: EntityId<"PublishingPublication">,
): StoredPublishingPublicationRow | null {
  const rows = database.prepare(PUBLISHING_PUBLICATION_ROW_BY_ID_SQL).all(publicationId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing publication lookup returned duplicate rows: ${publicationId}`);
  }
  return parseStoredPublishingPublicationRow(
    rows[0] ?? {},
    "Publishing publication lookup",
  );
}

function parseStoredPublishingSettlementRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingSettlementRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const reportedAmountValue = row.reportedAmount;
  if (
    reportedAmountValue !== null &&
    (typeof reportedAmountValue !== "number" || !Number.isFinite(reportedAmountValue))
  ) {
    throw new Error(`${label}.reportedAmount must be finite or null`);
  }
  let items: unknown;
  try {
    items = JSON.parse(readRequiredString(row, "itemsJson", label)) as unknown;
  } catch {
    throw new Error(`${label}.itemsJson must be JSON`);
  }
  const projection = parsePublishingSettlementProjection({
    schemaVersion: 1,
    settlementId: readRequiredString(row, "settlementId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    publicationId: readRequiredString(row, "publicationId", label),
    title: readString(row, "title", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    publicationTitleSnapshot: readString(row, "publicationTitleSnapshot", label),
    periodStartsOn: readNullableString(row, "periodStartsOn", label),
    periodEndsOn: readNullableString(row, "periodEndsOn", label),
    issuedOn: readNullableString(row, "issuedOn", label),
    reviewStatus: readString(row, "reviewStatus", label),
    currencyCode: readString(row, "currencyCode", label),
    reportedAmount: reportedAmountValue,
    items,
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    settlementId: projection.settlementId,
    revision: projection.revision,
    workId: projection.workId,
    publicationId: projection.publicationId,
    title: projection.title,
    workTitleSnapshot: projection.workTitleSnapshot,
    publicationTitleSnapshot: projection.publicationTitleSnapshot,
    periodStartsOn: projection.periodStartsOn,
    periodEndsOn: projection.periodEndsOn,
    issuedOn: projection.issuedOn,
    reviewStatus: projection.reviewStatus,
    currencyCode: projection.currencyCode,
    reportedAmount: projection.reportedAmount,
    items: projection.items,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingSettlementRow(
  row: StoredPublishingSettlementRow,
): PublishingSettlementProjection {
  return parsePublishingSettlementProjection({
    schemaVersion: 1,
    settlementId: row.settlementId,
    revision: row.revision,
    workId: row.workId,
    publicationId: row.publicationId,
    title: row.title,
    workTitleSnapshot: row.workTitleSnapshot,
    publicationTitleSnapshot: row.publicationTitleSnapshot,
    periodStartsOn: row.periodStartsOn,
    periodEndsOn: row.periodEndsOn,
    issuedOn: row.issuedOn,
    reviewStatus: row.reviewStatus,
    currencyCode: row.currencyCode,
    reportedAmount: row.reportedAmount,
    items: row.items,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingSettlementRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingSettlementRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_SETTLEMENT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingSettlementRow(
        row,
        `Publishing settlement rows[${index}]`,
      )),
  );
}

function readStoredPublishingSettlementRowById(
  database: NodeSqliteDatabase,
  settlementId: EntityId<"PublishingSettlement">,
): StoredPublishingSettlementRow | null {
  const rows = database.prepare(PUBLISHING_SETTLEMENT_ROW_BY_ID_SQL).all(settlementId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing settlement lookup returned duplicate rows: ${settlementId}`);
  }
  return parseStoredPublishingSettlementRow(
    rows[0] ?? {},
    "Publishing settlement lookup",
  );
}

function parseStoredPublishingPaymentRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingPaymentRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const amountValue = row.amount;
  if (typeof amountValue !== "number" || !Number.isFinite(amountValue)) {
    throw new Error(`${label}.amount must be finite`);
  }
  const projection = parsePublishingPaymentProjection({
    schemaVersion: 1,
    paymentId: readRequiredString(row, "paymentId", label),
    revision,
    workId: readRequiredString(row, "workId", label),
    settlementId: readNullableString(row, "settlementId", label),
    workTitleSnapshot: readString(row, "workTitleSnapshot", label),
    settlementTitleSnapshot: readString(row, "settlementTitleSnapshot", label),
    receivedOn: readNullableString(row, "receivedOn", label),
    confirmedOn: readNullableString(row, "confirmedOn", label),
    amount: amountValue,
    currencyCode: readString(row, "currencyCode", label),
    matchStatus: readString(row, "matchStatus", label),
    payerLabel: readString(row, "payerLabel", label),
    reference: readString(row, "reference", label),
    note: readString(row, "note", label),
    sourceIds: parseStoredStringArray(
      readRequiredString(row, "sourceIdsJson", label),
      `${label}.sourceIdsJson`,
    ),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    paymentId: projection.paymentId,
    revision: projection.revision,
    workId: projection.workId,
    settlementId: projection.settlementId,
    workTitleSnapshot: projection.workTitleSnapshot,
    settlementTitleSnapshot: projection.settlementTitleSnapshot,
    receivedOn: projection.receivedOn,
    confirmedOn: projection.confirmedOn,
    amount: projection.amount,
    currencyCode: projection.currencyCode,
    matchStatus: projection.matchStatus,
    payerLabel: projection.payerLabel,
    reference: projection.reference,
    note: projection.note,
    sourceIds: projection.sourceIds,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingPaymentRow(
  row: StoredPublishingPaymentRow,
): PublishingPaymentProjection {
  return parsePublishingPaymentProjection({
    schemaVersion: 1,
    paymentId: row.paymentId,
    revision: row.revision,
    workId: row.workId,
    settlementId: row.settlementId,
    workTitleSnapshot: row.workTitleSnapshot,
    settlementTitleSnapshot: row.settlementTitleSnapshot,
    receivedOn: row.receivedOn,
    confirmedOn: row.confirmedOn,
    amount: row.amount,
    currencyCode: row.currencyCode,
    matchStatus: row.matchStatus,
    payerLabel: row.payerLabel,
    reference: row.reference,
    note: row.note,
    sourceIds: row.sourceIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingPaymentRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work"> | null,
): readonly StoredPublishingPaymentRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_PAYMENT_ROWS_SQL).all(workId, workId)
      .map((row, index) => parseStoredPublishingPaymentRow(
        row,
        `Publishing payment rows[${index}]`,
      )),
  );
}

function readStoredPublishingPaymentRowById(
  database: NodeSqliteDatabase,
  paymentId: EntityId<"PublishingPayment">,
): StoredPublishingPaymentRow | null {
  const rows = database.prepare(PUBLISHING_PAYMENT_ROW_BY_ID_SQL).all(paymentId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing payment lookup returned duplicate rows: ${paymentId}`);
  }
  return parseStoredPublishingPaymentRow(
    rows[0] ?? {},
    "Publishing payment lookup",
  );
}

function parseStoredPublishingSourceRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingSourceRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  let importedFields: unknown;
  try {
    importedFields = JSON.parse(
      readRequiredString(row, "importedFieldsJson", label),
    ) as unknown;
  } catch {
    throw new Error(`${label}.importedFieldsJson must be JSON`);
  }
  const projection = parsePublishingSourceProjection({
    schemaVersion: 1,
    sourceId: readRequiredString(row, "sourceId", label),
    revision,
    kind: readString(row, "kind", label),
    label: readString(row, "label", label),
    url: readNullableString(row, "url", label),
    observedAt: readNullableString(row, "observedAt", label),
    authority: readString(row, "authority", label),
    importedFields,
    createdAt: readRequiredString(row, "createdAt", label),
  });
  return Object.freeze({
    sourceId: projection.sourceId,
    revision: projection.revision,
    kind: projection.kind,
    label: projection.label,
    url: projection.url,
    observedAt: projection.observedAt,
    authority: projection.authority,
    importedFields: projection.importedFields,
    createdAt: projection.createdAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingSourceRow(
  row: StoredPublishingSourceRow,
): PublishingSourceProjection {
  return parsePublishingSourceProjection({
    schemaVersion: 1,
    sourceId: row.sourceId,
    revision: row.revision,
    kind: row.kind,
    label: row.label,
    url: row.url,
    observedAt: row.observedAt,
    authority: row.authority,
    importedFields: row.importedFields,
    createdAt: row.createdAt,
  });
}

function readStoredPublishingSourceRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingSourceRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_SOURCE_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingSourceRow(
        row,
        `Publishing source rows[${index}]`,
      )),
  );
}

function readStoredPublishingSourceRowById(
  database: NodeSqliteDatabase,
  sourceId: EntityId<"PublishingSource">,
): StoredPublishingSourceRow | null {
  const rows = database.prepare(PUBLISHING_SOURCE_ROW_BY_ID_SQL).all(sourceId);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing source lookup returned duplicate rows: ${sourceId}`);
  }
  return parseStoredPublishingSourceRow(
    rows[0] ?? {},
    "Publishing source lookup",
  );
}

function parseStoredPublishingMailCandidateRow(
  row: Record<string, unknown>,
  label: string,
): StoredPublishingMailCandidateRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const projection = parsePublishingMailCandidateProjection({
    schemaVersion: 1,
    candidateId: readRequiredString(row, "candidateId", label),
    revision,
    sourceId: readRequiredString(row, "sourceId", label),
    sourceAccountId: readRequiredString(row, "sourceAccountId", label),
    messageId: readRequiredString(row, "messageId", label),
    threadId: readRequiredString(row, "threadId", label),
    from: readString(row, "from", label),
    subject: readString(row, "subject", label),
    receivedAt: readRequiredString(row, "receivedAt", label),
    snippet: readString(row, "snippet", label),
    bodyFingerprint: readRequiredString(row, "bodyFingerprint", label),
    submissionId: readNullableString(row, "submissionId", label),
    partnerId: readNullableString(row, "partnerId", label),
    matchReason: readString(row, "matchReason", label),
    proposedStatus: readString(row, "proposedStatus", label),
    proposedResult: readString(row, "proposedResult", label),
    proposedRespondedOn: readNullableString(row, "proposedRespondedOn", label),
    proposedNote: readString(row, "proposedNote", label),
    classificationConnectionId: row.classificationConnectionId === null
      ? null
      : readString(row, "classificationConnectionId", label),
    classificationModel: readString(row, "classificationModel", label),
    reviewStatus: readRequiredString(row, "reviewStatus", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
  return Object.freeze({
    candidateId: projection.candidateId,
    revision: projection.revision,
    sourceId: projection.sourceId,
    sourceAccountId: projection.sourceAccountId,
    messageId: projection.messageId,
    threadId: projection.threadId,
    from: projection.from,
    subject: projection.subject,
    receivedAt: projection.receivedAt,
    snippet: projection.snippet,
    bodyFingerprint: projection.bodyFingerprint,
    submissionId: projection.submissionId,
    partnerId: projection.partnerId,
    matchReason: projection.matchReason,
    proposedStatus: projection.proposedStatus,
    proposedResult: projection.proposedResult,
    proposedRespondedOn: projection.proposedRespondedOn,
    proposedNote: projection.proposedNote,
    classificationConnectionId: projection.classificationConnectionId,
    classificationModel: projection.classificationModel,
    reviewStatus: projection.reviewStatus,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function projectStoredPublishingMailCandidateRow(
  row: StoredPublishingMailCandidateRow,
): PublishingMailCandidateProjection {
  return parsePublishingMailCandidateProjection({
    schemaVersion: 1,
    candidateId: row.candidateId,
    revision: row.revision,
    sourceId: row.sourceId,
    sourceAccountId: row.sourceAccountId,
    messageId: row.messageId,
    threadId: row.threadId,
    from: row.from,
    subject: row.subject,
    receivedAt: row.receivedAt,
    snippet: row.snippet,
    bodyFingerprint: row.bodyFingerprint,
    submissionId: row.submissionId,
    partnerId: row.partnerId,
    matchReason: row.matchReason,
    proposedStatus: row.proposedStatus,
    proposedResult: row.proposedResult,
    proposedRespondedOn: row.proposedRespondedOn,
    proposedNote: row.proposedNote,
    classificationConnectionId: row.classificationConnectionId,
    classificationModel: row.classificationModel,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readStoredPublishingMailCandidateRows(
  database: NodeSqliteDatabase,
): readonly StoredPublishingMailCandidateRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PUBLISHING_MAIL_CANDIDATE_ROWS_SQL).all()
      .map((row, index) => parseStoredPublishingMailCandidateRow(
        row,
        `Publishing mail candidate rows[${index}]`,
      )),
  );
}

function readStoredPublishingMailCandidateRowById(
  database: NodeSqliteDatabase,
  candidateId: EntityId<"PublishingMailCandidate">,
): StoredPublishingMailCandidateRow | null {
  const rows = database.prepare(PUBLISHING_MAIL_CANDIDATE_ROW_BY_ID_SQL).all(
    candidateId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Publishing mail candidate lookup returned duplicate rows: ${candidateId}`);
  }
  return parseStoredPublishingMailCandidateRow(
    rows[0] ?? {},
    "Publishing mail candidate lookup",
  );
}

function readStoredPublishingMailCandidateRowBySource(
  database: NodeSqliteDatabase,
  sourceAccountId: string,
  messageId: string,
): StoredPublishingMailCandidateRow | null {
  const rows = database.prepare(PUBLISHING_MAIL_CANDIDATE_ROW_BY_SOURCE_SQL).all(
    sourceAccountId,
    messageId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Publishing mail candidate source lookup returned duplicate rows: ${sourceAccountId}/${messageId}`,
    );
  }
  return parseStoredPublishingMailCandidateRow(
    rows[0] ?? {},
    "Publishing mail candidate source lookup",
  );
}

function parseStoredPlotThreadRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotThreadRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    plotThreadId: entityId<"PlotThread">(
      readRequiredString(row, "plotThreadId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    stage: readString(row, "stage", label),
    summary: readString(row, "summary", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredPlotThreadRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotThreadRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_THREAD_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotThreadRow(
        row,
        `Plot rows[${index}]`,
      )),
  );
}

function readStoredPlotThreadRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotThreadId: EntityId<"PlotThread">,
): StoredPlotThreadRow | null {
  const rows = database.prepare(PLOT_THREAD_ROW_BY_ID_SQL).all(
    workId,
    plotThreadId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Plot lookup returned duplicate rows: ${plotThreadId}`);
  }
  return parseStoredPlotThreadRow(rows[0] ?? {}, "Plot lookup");
}

function parseStoredPlotBoardRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotBoardRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const mode = readRequiredString(row, "mode", label);
  if (mode !== "sequence" && mode !== "time-map") {
    throw new Error(`${label}.mode is invalid`);
  }
  return Object.freeze({
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    title: readRequiredString(row, "title", label),
    mode,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

function readStoredDefaultPlotBoardRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredPlotBoardRow {
  const rows = database.prepare(DEFAULT_PLOT_BOARD_ROWS_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(
      `Work must have exactly one default sequence PlotBoard: ${workId}`,
    );
  }
  return parseStoredPlotBoardRow(rows[0] ?? {}, "Default PlotBoard lookup");
}

function parseStoredPlotLaneRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotLaneRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) throw new Error(`${label}.revision must be at least 1`);
  const kind = readRequiredString(row, "kind", label);
  if (
    kind !== "default" &&
    kind !== "main" &&
    kind !== "subplot" &&
    kind !== "stage" &&
    kind !== "custom"
  ) {
    throw new Error(`${label}.kind is invalid`);
  }
  return Object.freeze({
    plotLaneId: entityId<"PlotLane">(
      readRequiredString(row, "plotLaneId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    title: readRequiredString(row, "title", label),
    kind,
    orderKey: readRequiredString(row, "orderKey", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

function readStoredPlotLaneRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotBoardId: EntityId<"PlotBoard">,
): readonly StoredPlotLaneRow[] {
  return Object.freeze(
    database.prepare(PLOT_LANE_ROWS_SQL).all(workId, plotBoardId)
      .map((row, index) => parseStoredPlotLaneRow(row, `PlotLane rows[${index}]`))
      .sort((left, right) =>
        compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
        left.plotLaneId.localeCompare(right.plotLaneId)),
  );
}

function readNullableFiniteNumber(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${field} must be null or a finite number`);
  }
  return value;
}

function parseStoredPlotPlacementRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotPlacementRow {
  const revision = readRequiredInteger(row, "revision", label);
  const plotRevision = readRequiredInteger(row, "plotRevision", label);
  if (revision < 1 || plotRevision < 1) {
    throw new Error(`${label} revisions must be at least 1`);
  }
  return Object.freeze({
    plotPlacementId: entityId<"PlotPlacement">(
      readRequiredString(row, "plotPlacementId", label),
    ),
    revision,
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBoardId: entityId<"PlotBoard">(
      readRequiredString(row, "plotBoardId", label),
    ),
    plotLaneId: entityId<"PlotLane">(
      readRequiredString(row, "plotLaneId", label),
    ),
    plotBeatId: entityId<"PlotThread">(
      readRequiredString(row, "plotBeatId", label),
    ),
    orderKey: readRequiredString(row, "orderKey", label),
    storyTime: readNullableFiniteNumber(row, "storyTime", label),
    storyTimeEnd: readNullableFiniteNumber(row, "storyTimeEnd", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
    plotTitle: readRequiredString(row, "plotTitle", label),
    plotStage: readString(row, "plotStage", label),
    plotSummary: readString(row, "plotSummary", label),
    plotNote: readString(row, "plotNote", label),
    plotCreatedAt: readRequiredString(row, "plotCreatedAt", label),
    plotUpdatedAt: readRequiredString(row, "plotUpdatedAt", label),
    plotRetiredAt: readNullableString(row, "plotRetiredAt", label),
    plotRevision,
  });
}

function readStoredActivePlotPlacementRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotBoardId: EntityId<"PlotBoard">,
): readonly StoredPlotPlacementRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_PLACEMENT_ROWS_SQL).all(workId, plotBoardId)
      .map((row, index) =>
        parseStoredPlotPlacementRow(row, `PlotPlacement rows[${index}]`)),
  );
}

function readStoredPlotPlacementRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotPlacementId: EntityId<"PlotPlacement">,
): StoredPlotPlacementRow | null {
  const rows = database.prepare(PLOT_PLACEMENT_ROW_BY_ID_SQL).all(
    workId,
    plotPlacementId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`PlotPlacement lookup returned duplicate rows: ${plotPlacementId}`);
  }
  return parseStoredPlotPlacementRow(rows[0] ?? {}, "PlotPlacement lookup");
}

function parseStoredPlotEventLinkRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotEventLinkRow {
  const role = readRequiredString(row, "role", label);
  if (role !== "primary" && role !== "supporting") {
    throw new Error(`${label}.role is invalid`);
  }
  const createdFrom = readRequiredString(row, "createdFrom", label);
  if (
    createdFrom !== "event-to-plot" &&
    createdFrom !== "plot-to-event" &&
    createdFrom !== "manual-link"
  ) {
    throw new Error(`${label}.createdFrom is invalid`);
  }
  return Object.freeze({
    plotEventLinkId: entityId<"PlotEventLink">(
      readRequiredString(row, "plotEventLinkId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    plotBeatId: entityId<"PlotThread">(
      readRequiredString(row, "plotBeatId", label),
    ),
    eventBlockId: entityId<"EventBlock">(
      readRequiredString(row, "eventBlockId", label),
    ),
    role,
    createdFrom,
    plotTitle: readRequiredString(row, "plotTitle", label),
    eventTitle: readRequiredString(row, "eventTitle", label),
    plotRetiredAt: readNullableString(row, "plotRetiredAt", label),
    eventRetiredAt: readNullableString(row, "eventRetiredAt", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredPlotEventLinkRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotEventLinkRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_EVENT_LINK_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotEventLinkRow(
        row,
        `PlotEventLink rows[${index}]`,
      )),
  );
}

function readStoredPlotEventLinkRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotEventLinkId: EntityId<"PlotEventLink">,
): StoredPlotEventLinkRow | null {
  const rows = database.prepare(PLOT_EVENT_LINK_ROW_BY_ID_SQL).all(
    workId,
    plotEventLinkId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`PlotEventLink lookup returned duplicate rows: ${plotEventLinkId}`);
  }
  return parseStoredPlotEventLinkRow(rows[0] ?? {}, "PlotEventLink lookup");
}

function parseStoredPlotThreadSourceRow(
  row: Record<string, unknown>,
  label: string,
): StoredPlotThreadSourceRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    sourceId: entityId<"PlotThreadSource">(
      readRequiredString(row, "sourceId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    plotThreadId: entityId<"PlotThread">(
      readRequiredString(row, "plotThreadId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredPlotThreadSourceRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredPlotThreadSourceRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_PLOT_THREAD_SOURCE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredPlotThreadSourceRow(
        row,
        `Plot source rows[${index}]`,
      )),
  );
}

function readStoredActivePlotThreadSourceByPlot(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  plotThreadId: EntityId<"PlotThread">,
): StoredPlotThreadSourceRow | null {
  const rows = database.prepare(ACTIVE_PLOT_THREAD_SOURCE_BY_PLOT_SQL).all(
    workId,
    plotThreadId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(
      `Plot source lookup returned duplicate rows: ${plotThreadId}`,
    );
  }
  return parseStoredPlotThreadSourceRow(
    rows[0] ?? {},
    "Plot source lookup",
  );
}

function parseStoredForeshadowLineRow(
  row: Record<string, unknown>,
  label: string,
): StoredForeshadowLineRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    title: readRequiredString(row, "title", label),
    note: readString(row, "note", label),
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
    retiredAt: readNullableString(row, "retiredAt", label),
  });
}

function readStoredForeshadowLineRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredForeshadowLineRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FORESHADOW_LINE_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredForeshadowLineRow(
        row,
        `Foreshadow line rows[${index}]`,
      )),
  );
}

function readStoredForeshadowLineRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  lineId: EntityId<"ForeshadowLine">,
): StoredForeshadowLineRow | null {
  const rows = database.prepare(FORESHADOW_LINE_ROW_BY_ID_SQL).all(
    workId,
    lineId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Foreshadow line lookup returned duplicate rows: ${lineId}`);
  }
  return parseStoredForeshadowLineRow(
    rows[0] ?? {},
    "Foreshadow line lookup",
  );
}

function parseStoredForeshadowPointRow(
  row: Record<string, unknown>,
  label: string,
): StoredForeshadowPointRow {
  const revision = readRequiredInteger(row, "revision", label);
  if (revision < 1) {
    throw new Error(`${label}.revision must be at least 1`);
  }
  return Object.freeze({
    pointId: entityId<"ForeshadowPoint">(
      readRequiredString(row, "pointId", label),
    ),
    revision,
    workId: entityId<"Work">(
      readRequiredString(row, "workId", label),
    ),
    lineId: entityId<"ForeshadowLine">(
      readRequiredString(row, "lineId", label),
    ),
    sourceDocumentId: entityId<"Document">(
      readRequiredString(row, "sourceDocumentId", label),
    ),
    sourceDocumentRevisionId: entityId<"DocumentRevision">(
      readRequiredString(row, "sourceDocumentRevisionId", label),
    ),
    sourceAnchorId: entityId<"Anchor">(
      readRequiredString(row, "sourceAnchorId", label),
    ),
    roleId: readRequiredString(row, "roleId", label),
    note: readString(row, "note", label),
    exactText: readRequiredString(row, "exactText", label),
    createdAt: readRequiredString(row, "createdAt", label),
  });
}

function readStoredForeshadowPointRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredForeshadowPointRow[] {
  return Object.freeze(
    database.prepare(ACTIVE_FORESHADOW_POINT_ROWS_SQL).all(workId)
      .map((row, index) => parseStoredForeshadowPointRow(
        row,
        `Foreshadow point rows[${index}]`,
      )),
  );
}

function readStoredForeshadowPointRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  pointId: EntityId<"ForeshadowPoint">,
): StoredForeshadowPointRow | null {
  const rows = database.prepare(FORESHADOW_POINT_ROW_BY_ID_SQL).all(
    workId,
    pointId,
  );
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Foreshadow point lookup returned duplicate rows: ${pointId}`);
  }
  return parseStoredForeshadowPointRow(
    rows[0] ?? {},
    "Foreshadow point lookup",
  );
}

function readStoredSceneOverrideRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneOverrideRow[] {
  return Object.freeze(
    database
      .prepare(SCENE_OVERRIDE_ROWS_SQL)
      .all(workId)
      .map((row, index) => {
        const label = `SceneOverride rows[${index}]`;
        const operation = readRequiredString(row, "operation", label);
        if (
          operation !== "add" &&
          operation !== "delete" &&
          operation !== "ignore" &&
          operation !== "merge" &&
          operation !== "split"
        ) {
          throw new Error(`${label}.operation is invalid`);
        }
        const note = row.note;
        const exactQuote = row.exactQuote;
        if (typeof note !== "string") {
          throw new Error(`${label}.note must be a string`);
        }
        if (typeof exactQuote !== "string") {
          throw new Error(`${label}.exactQuote must be a string`);
        }
        const baseRuleSetRevision = readRequiredInteger(
          row,
          "baseRuleSetRevision",
          label,
        );
        const orderIndex = readRequiredInteger(row, "orderIndex", label);
        if (baseRuleSetRevision < 0 || orderIndex < 0) {
          throw new Error(`${label} contains a negative revision or order`);
        }
        return Object.freeze({
          sceneOverrideId: entityId<"SceneOverride">(
            readRequiredString(row, "sceneOverrideId", label),
          ),
          anchorId: entityId<"Anchor">(
            readRequiredString(row, "anchorId", label),
          ),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          documentId: entityId<"Document">(
            readRequiredString(row, "documentId", label),
          ),
          operation,
          baseRuleSetRevision,
          note,
          exactQuote,
          orderIndex,
          createdAt: readRequiredString(row, "createdAt", label),
        });
      }),
  );
}

function readStoredSceneRuleSetRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredSceneRuleSetRow {
  const rows = database.prepare(SCENE_RULE_SET_ROW_BY_WORK_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Work must have exactly one active SceneRuleSet: ${workId}`);
  }
  const row = rows[0] ?? {};
  const label = "SceneRuleSet row";
  const normalizationPolicy = readRequiredString(
    row,
    "normalizationPolicy",
    label,
  );
  if (
    normalizationPolicy !== "preserve" &&
    normalizationPolicy !== "trim-line-whitespace"
  ) {
    throw new Error(`${label}.normalizationPolicy is invalid`);
  }
  const enabled = readRequiredInteger(row, "enabled", label);
  if (enabled !== 0 && enabled !== 1) {
    throw new Error(`${label}.enabled must be 0 or 1`);
  }
  return Object.freeze({
    sceneRuleSetId: entityId<"SceneRuleSet">(
      readRequiredString(row, "sceneRuleSetId", label),
    ),
    revision: readRequiredInteger(row, "revision", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    displayName: readRequiredString(row, "displayName", label),
    boundaryRulesJson: readRequiredString(row, "boundaryRulesJson", label),
    normalizationPolicy,
    enabled: enabled === 1,
    createdAt: readRequiredString(row, "createdAt", label),
    updatedAt: readRequiredString(row, "updatedAt", label),
  });
}

function readStoredSceneEventOverrideRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredSceneEventOverrideRow[] {
  return Object.freeze(
    database.prepare(SCENE_EVENT_OVERRIDE_ROWS_SQL).all(workId)
      .map((row, index) => {
        const label = `SceneEventOverride rows[${index}]`;
        const operation = readRequiredString(row, "operation", label);
        if (operation !== "include" && operation !== "exclude") {
          throw new Error(`${label}.operation is invalid`);
        }
        return Object.freeze({
          sceneEventOverrideId: entityId<"SceneEventOverride">(
            readRequiredString(row, "sceneEventOverrideId", label),
          ),
          revision: readRequiredInteger(row, "revision", label),
          workId: entityId<"Work">(
            readRequiredString(row, "workId", label),
          ),
          sceneKey: readRequiredString(row, "sceneKey", label),
          eventBlockId: entityId<"EventBlock">(
            readRequiredString(row, "eventBlockId", label),
          ),
          operation,
          createdAt: readRequiredString(row, "createdAt", label),
          updatedAt: readRequiredString(row, "updatedAt", label),
        });
      }),
  );
}

function readString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function readNullableString(
  row: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

function readNullableInteger(
  row: Record<string, unknown>,
  field: string,
  label: string,
): number | null {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be null or a non-negative integer`);
  }
  return value;
}

function readTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return timestamp;
}

function readWorkActivityPolicyIds(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): {
  readonly activityPolicyId: string;
  readonly focusPolicyId: string;
} {
  const rows = database.prepare(WORK_ACTIVITY_POLICY_ROWS_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Work activity settings are missing: ${workId}`);
  }
  const row = rows[0] ?? {};
  return Object.freeze({
    activityPolicyId: readRequiredString(
      row,
      "activityPolicyId",
      "Work activity settings",
    ),
    focusPolicyId: readRequiredString(
      row,
      "focusPolicyId",
      "Work activity settings",
    ),
  });
}

function parseStoredFocusPolicyRow(
  row: Record<string, unknown>,
  label: string,
): StoredFocusPolicyRow {
  return Object.freeze({
    policyId: readRequiredString(row, "policyId", label),
    workId: entityId<"Work">(readRequiredString(row, "workId", label)),
    phaseDefinitionsJson: readRequiredString(
      row,
      "phaseDefinitionsJson",
      label,
    ),
    completionPolicy: readRequiredString(row, "completionPolicy", label),
  });
}

function readCurrentFocusPolicyRow(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): StoredFocusPolicyRow {
  const rows = database.prepare(CURRENT_FOCUS_POLICY_ROW_SQL).all(workId);
  if (rows.length !== 1) {
    throw new Error(`Current Work focus policy is missing: ${workId}`);
  }
  return parseStoredFocusPolicyRow(
    rows[0] ?? {},
    "Current Work focus policy",
  );
}

function readFocusPolicyRowById(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
  policyId: string,
): StoredFocusPolicyRow {
  const rows = database
    .prepare(FOCUS_POLICY_ROW_BY_ID_SQL)
    .all(workId, policyId);
  if (rows.length !== 1) {
    throw new Error(`Unknown Work focus policy: ${workId}/${policyId}`);
  }
  return parseStoredFocusPolicyRow(rows[0] ?? {}, "Work focus policy");
}

function readPomodoroPolicyPlan(
  policy: StoredFocusPolicyRow,
): PomodoroPolicyPlan | null {
  let definitions: unknown;
  try {
    definitions = JSON.parse(policy.phaseDefinitionsJson) as unknown;
  } catch {
    throw new Error(`Focus policy definitions are invalid JSON: ${policy.policyId}`);
  }
  if (!Array.isArray(definitions)) {
    throw new Error(`Focus policy definitions must be an array: ${policy.policyId}`);
  }
  const header = definitions[0];
  if (
    header === undefined ||
    typeof header !== "object" ||
    header === null ||
    Array.isArray(header) ||
    (header as Record<string, unknown>).kind !== "pomodoro"
  ) {
    return null;
  }
  return parsePomodoroPolicyPlan({
    phaseDefinitionsJson: policy.phaseDefinitionsJson,
    completionPolicy: policy.completionPolicy,
  });
}

function readStoredWritingSessionRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredWritingSessionRow[] {
  return Object.freeze(
    database.prepare(WRITING_SESSION_ROWS_SQL).all(workId).map((row, index) => {
      const label = `WritingSession rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (state !== "active" && state !== "completed") {
        throw new Error(`${label}.state is unsupported`);
      }
      const endedAt = readNullableString(row, "endedAt", label);
      const startRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "startRevisionId",
        label,
      );
      const endRevisionId = readNullableIdentity<"DocumentRevision">(
        row,
        "endRevisionId",
        label,
      );
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        documentId: readNullableIdentity<"Document">(
          row,
          "documentId",
          label,
        ),
        state,
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt,
        startRevisionId,
        endRevisionId,
        note: readString(row, "note", label),
      });
    }),
  );
}

function readStoredActivityIntervalRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredActivityIntervalRow[] {
  return Object.freeze(
    database.prepare(ACTIVITY_INTERVAL_ROWS_SQL).all(workId).map((row, index) => {
      const label = `ActivityInterval rows[${index}]`;
      return Object.freeze({
        sessionId: entityId<"WritingSession">(
          readRequiredString(row, "sessionId", label),
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        endedAt: readRequiredString(row, "endedAt", label),
      });
    }),
  );
}

function readStoredFocusCycleRows(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): readonly StoredFocusCycleRow[] {
  return Object.freeze(
    database.prepare(FOCUS_CYCLE_ROWS_SQL).all(workId).map((row, index) => {
      const label = `FocusCycle rows[${index}]`;
      const state = readRequiredString(row, "state", label);
      if (
        state !== "running" &&
        state !== "paused" &&
        state !== "completed" &&
        state !== "stopped"
      ) {
        throw new Error(`${label}.state is unsupported`);
      }
      return Object.freeze({
        focusCycleId: entityId<"FocusCycle">(
          readRequiredString(row, "focusCycleId", label),
        ),
        workId: entityId<"Work">(readRequiredString(row, "workId", label)),
        sessionId: readNullableIdentity<"WritingSession">(
          row,
          "sessionId",
          label,
        ),
        policyId: readRequiredString(row, "policyId", label),
        state,
        pauseReason: readNullableString(row, "pauseReason", label),
        phaseRef: readRequiredString(row, "phaseRef", label),
        targetDurationMs: readRequiredInteger(
          row,
          "targetDurationMs",
          label,
        ),
        startedAt: readRequiredString(row, "startedAt", label),
        deadlineAt: readNullableString(row, "deadlineAt", label),
        remainingAtPause: readNullableInteger(
          row,
          "remainingAtPause",
          label,
        ),
        completedAt: readNullableString(row, "completedAt", label),
        note: readString(row, "note", label),
      });
    }),
  );
}

function findPomodoroPhaseDefinition(
  plan: PomodoroPolicyPlan,
  phaseRef: string,
) {
  const phase = plan.phases.find((candidate) => candidate.phaseRef === phaseRef);
  if (phase === undefined) {
    throw new Error(`FocusCycle references an unknown Pomodoro phase: ${phaseRef}`);
  }
  return phase;
}

function deriveStoredPomodoroProjection(input: {
  readonly database: NodeSqliteDatabase;
  readonly workId: EntityId<"Work">;
  readonly nowMs: number;
}): PomodoroProjection {
  const policy = readCurrentFocusPolicyRow(input.database, input.workId);
  const plan = readPomodoroPolicyPlan(policy);
  if (plan === null) {
    return parsePomodoroProjection({
      schemaVersion: 1,
      workId: input.workId,
      settings: null,
      status: "unconfigured",
      completedWorkCycles: 0,
      activePhase: null,
    });
  }
  const cycles = readStoredFocusCycleRows(input.database, input.workId).filter(
    (cycle) => cycle.policyId === policy.policyId,
  );
  for (const cycle of cycles) {
    findPomodoroPhaseDefinition(plan, cycle.phaseRef);
  }
  const activeCycles = cycles.filter(
    (cycle) => cycle.state === "running" || cycle.state === "paused",
  );
  if (activeCycles.length > 1) {
    throw new Error(`Work has more than one active Pomodoro phase: ${input.workId}`);
  }
  const workPhaseRef = plan.phases.find((phase) => phase.phase === "work")?.phaseRef;
  if (workPhaseRef === undefined) {
    throw new Error(`Pomodoro work phase is missing: ${policy.policyId}`);
  }
  const completedWorkCycles = cycles.filter(
    (cycle) => cycle.state === "completed" && cycle.phaseRef === workPhaseRef,
  ).length;
  const activeCycle = activeCycles[0];
  const activePhase = activeCycle === undefined
    ? null
    : (() => {
        const definition = findPomodoroPhaseDefinition(plan, activeCycle.phaseRef);
        const cycleNumber = definition.phase === "work"
          ? completedWorkCycles + 1
          : completedWorkCycles;
        if (cycleNumber <= 0 || cycleNumber > plan.settings.workCycleCount) {
          throw new Error(
            `Pomodoro phase cycle number is outside its policy: ${activeCycle.focusCycleId}`,
          );
        }
        let remainingDurationMs: number;
        if (activeCycle.state === "running") {
          if (activeCycle.deadlineAt === null || activeCycle.pauseReason !== null) {
            throw new Error(
              `Running Pomodoro phase fields are inconsistent: ${activeCycle.focusCycleId}`,
            );
          }
          remainingDurationMs = Math.max(
            0,
            readTimestamp(activeCycle.deadlineAt, "FocusCycle.deadlineAt") -
              input.nowMs,
          );
        } else {
          if (
            activeCycle.deadlineAt !== null ||
            activeCycle.remainingAtPause === null ||
            activeCycle.pauseReason === null
          ) {
            throw new Error(
              `Paused Pomodoro phase fields are inconsistent: ${activeCycle.focusCycleId}`,
            );
          }
          remainingDurationMs = activeCycle.remainingAtPause;
        }
        return {
          focusCycleId: activeCycle.focusCycleId,
          state: activeCycle.state,
          phase: definition.phase,
          cycleNumber,
          targetDurationMs: activeCycle.targetDurationMs,
          remainingDurationMs,
          startedAt: activeCycle.startedAt,
          deadlineAt: activeCycle.deadlineAt,
          pauseReason: activeCycle.pauseReason,
          note: activeCycle.note,
        };
      })();
  const status = activePhase === null
    ? completedWorkCycles === plan.settings.workCycleCount
      ? "completed"
      : "idle"
    : activePhase.state;
  return parsePomodoroProjection({
    schemaVersion: 1,
    workId: input.workId,
    settings: plan.settings,
    status,
    completedWorkCycles,
    activePhase,
  });
}

function readActiveWritingSessionId(
  database: NodeSqliteDatabase,
  workId: EntityId<"Work">,
): EntityId<"WritingSession"> | null {
  return (
    readStoredWritingSessionRows(database, workId).find(
      (session) => session.state === "active",
    )?.sessionId ?? null
  );
}

function insertPomodoroCycle(input: {
  readonly database: NodeSqliteDatabase;
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly workId: EntityId<"Work">;
  readonly sessionId: EntityId<"WritingSession"> | null;
  readonly policyId: string;
  readonly phaseRef: string;
  readonly state: "running" | "paused";
  readonly pauseReason: "restore" | "phase-complete" | null;
  readonly targetDurationMs: number;
  readonly startedAt: string;
  readonly deadlineAt: string | null;
  readonly remainingAtPause: number | null;
  readonly note: string;
}): void {
  input.database.prepare(`
    INSERT INTO focus_cycles (
      id,
      schema_version,
      revision,
      created_at,
      updated_at,
      retired_at,
      work_id,
      session_id,
      policy_id,
      phase_ref,
      state,
      pause_reason,
      target_duration,
      started_at,
      deadline_at,
      remaining_at_pause,
      completed_at,
      note,
      music_queue_id
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
  `).run(
    input.focusCycleId,
    LOCAL_WORKSPACE_LEDGER_SCHEMA_VERSION,
    1,
    input.startedAt,
    input.startedAt,
    input.workId,
    input.sessionId,
    input.policyId,
    input.phaseRef,
    input.state,
    input.pauseReason,
    input.targetDurationMs,
    input.startedAt,
    input.deadlineAt,
    input.remainingAtPause,
    input.note.length === 0 ? null : input.note,
  );
}

function transitionCompletedPomodoroPhase(input: {
  readonly database: NodeSqliteDatabase;
  readonly workId: EntityId<"Work">;
  readonly focusCycleId: EntityId<"FocusCycle">;
  readonly nowMs: number;
  readonly restore: boolean;
}): boolean {
  const policy = readCurrentFocusPolicyRow(input.database, input.workId);
  const plan = readPomodoroPolicyPlan(policy);
  if (plan === null) {
    throw new Error(`Current Work has no configured Pomodoro: ${input.workId}`);
  }
  const cycles = readStoredFocusCycleRows(input.database, input.workId).filter(
    (cycle) => cycle.policyId === policy.policyId,
  );
  const current = cycles.find(
    (cycle) => cycle.focusCycleId === input.focusCycleId,
  );
  if (current === undefined || current.state !== "running") {
    throw new Error(`Pomodoro phase is not running: ${input.focusCycleId}`);
  }
  if (current.deadlineAt === null) {
    throw new Error(`Running Pomodoro phase has no deadline: ${input.focusCycleId}`);
  }
  const deadlineMs = readTimestamp(current.deadlineAt, "FocusCycle.deadlineAt");
  if (deadlineMs > input.nowMs) return false;
  const definition = findPomodoroPhaseDefinition(plan, current.phaseRef);
  const completedWorkCycles = cycles.filter((cycle) => {
    const phase = findPomodoroPhaseDefinition(plan, cycle.phaseRef);
    return cycle.state === "completed" && phase.phase === "work";
  }).length;
  const completedAfter = completedWorkCycles + (definition.phase === "work" ? 1 : 0);
  const nextPhase: PomodoroPhase | null = definition.phase === "work"
    ? completedAfter >= plan.settings.workCycleCount
      ? null
      : "break"
    : "work";
  const nextDefinition = nextPhase === null
    ? null
    : plan.phases.find((phase) => phase.phase === nextPhase) ?? null;
  if (nextPhase !== null && nextDefinition === null) {
    throw new Error(`Pomodoro next phase is missing: ${policy.policyId}/${nextPhase}`);
  }
  const transitionAt = new Date(input.nowMs).toISOString();
  input.database.exec("BEGIN IMMEDIATE");
  try {
    const updated = input.database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'completed',
        pause_reason = NULL,
        deadline_at = NULL,
        remaining_at_pause = NULL,
        completed_at = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
    `).run(
      transitionAt,
      current.deadlineAt,
      current.focusCycleId,
      input.workId,
      policy.policyId,
    );
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed before completion: ${current.focusCycleId}`);
    }
    if (nextDefinition !== null) {
      const shouldRun = !input.restore && plan.settings.autoAdvance;
      insertPomodoroCycle({
        database: input.database,
        focusCycleId: entityId<"FocusCycle">(randomUUID()),
        workId: input.workId,
        sessionId: readActiveWritingSessionId(input.database, input.workId),
        policyId: policy.policyId,
        phaseRef: nextDefinition.phaseRef,
        state: shouldRun ? "running" : "paused",
        pauseReason: shouldRun
          ? null
          : input.restore
            ? "restore"
            : "phase-complete",
        targetDurationMs: nextDefinition.targetDurationMs,
        startedAt: transitionAt,
        deadlineAt: shouldRun
          ? new Date(input.nowMs + nextDefinition.targetDurationMs).toISOString()
          : null,
        remainingAtPause: shouldRun ? null : nextDefinition.targetDurationMs,
        note: current.note,
      });
    }
    input.database.exec("COMMIT");
  } catch (error) {
    input.database.exec("ROLLBACK");
    throw error;
  }
  return true;
}

function restoreRunningPomodoroCycles(
  database: NodeSqliteDatabase,
  nowMs: number,
): void {
  const rows = database.prepare(`
    SELECT work_id AS "workId", id AS "focusCycleId"
    FROM focus_cycles
    WHERE state = 'running' AND retired_at IS NULL
    ORDER BY work_id ASC, created_at ASC, id ASC
  `).all();
  for (const [index, row] of rows.entries()) {
    const label = `Running FocusCycle rows[${index}]`;
    const workId = entityId<"Work">(readRequiredString(row, "workId", label));
    const focusCycleId = entityId<"FocusCycle">(
      readRequiredString(row, "focusCycleId", label),
    );
    const cycle = readStoredFocusCycleRows(database, workId).find(
      (candidate) => candidate.focusCycleId === focusCycleId,
    );
    if (cycle === undefined) throw new Error(`Unknown running FocusCycle: ${focusCycleId}`);
    const policy = readFocusPolicyRowById(database, workId, cycle.policyId);
    if (readPomodoroPolicyPlan(policy) === null) continue;
    if (readCurrentFocusPolicyRow(database, workId).policyId !== policy.policyId) {
      throw new Error(`Running Pomodoro is outside current Work policy: ${focusCycleId}`);
    }
    if (cycle.deadlineAt === null) {
      throw new Error(`Running Pomodoro phase has no deadline: ${focusCycleId}`);
    }
    const remainingDurationMs = Math.max(
      0,
      readTimestamp(cycle.deadlineAt, "FocusCycle.deadlineAt") - nowMs,
    );
    if (remainingDurationMs === 0) {
      transitionCompletedPomodoroPhase({
        database,
        workId,
        focusCycleId,
        nowMs,
        restore: true,
      });
      continue;
    }
    const updatedAt = new Date(nowMs).toISOString();
    const updated = database.prepare(`
      UPDATE focus_cycles
      SET
        revision = revision + 1,
        updated_at = ?,
        state = 'paused',
        pause_reason = 'restore',
        deadline_at = NULL,
        remaining_at_pause = ?
      WHERE id = ? AND work_id = ? AND policy_id = ? AND state = 'running'
    `).run(updatedAt, remainingDurationMs, focusCycleId, workId, policy.policyId);
    if (Number(updated.changes) !== 1) {
      throw new Error(`Pomodoro phase changed during restore: ${focusCycleId}`);
    }
  }
}

function createCatalogFromStoredRows(
  rows: readonly StoredDocumentRow[],
) {
  const works = new Map<EntityId<"Work">, Work>();
  const documents: Document[] = [];
  for (const row of rows) {
    if (!works.has(row.workId)) {
      works.set(row.workId, {
        meta: {
          id: row.workId,
          schemaVersion: row.workSchemaVersion,
          revision: row.workRevision,
          createdAt: row.workCreatedAt,
          updatedAt: row.workUpdatedAt,
        },
        studioId: row.workStudioId,
        title: row.workTitle,
        orderKey: row.workOrderKey,
        ...(row.workResumeCheckpointId === null
          ? {}
          : { resumeCheckpointId: row.workResumeCheckpointId }),
        settingsId: row.workSettingsId,
      });
    }
    documents.push({
      meta: {
        id: row.documentId,
        schemaVersion: row.documentSchemaVersion,
        revision: row.documentRevision,
        createdAt: row.documentCreatedAt,
        updatedAt: row.documentUpdatedAt,
      },
      workId: row.workId,
      ...(row.folderId === null ? {} : { folderId: row.folderId }),
      title: row.documentTitle,
      orderKey: row.documentOrderKey,
      manuscriptId: row.manuscriptId,
    });
  }
  return createWritingCatalog({
    works: [...works.values()],
    documents,
  });
}

function projectResumeResolution(
  resolution: ResumeCheckpointResolution,
): ManuscriptResumeCheckpointProjection {
  if (resolution.status === "missing") {
    return Object.freeze({
      schemaVersion: 1,
      status: "missing",
      workId: resolution.workId,
    });
  }
  if (
    resolution.status === "needsReview" ||
    resolution.status === "broken"
  ) {
    return Object.freeze({
      schemaVersion: 1,
      status: resolution.status,
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      move: null,
    });
  }
  const selection = resolution.selection;
  if (selection === undefined) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: resolution.cursorOffset,
        head: resolution.cursorOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.startOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.endOffset,
        head: selection.startOffset,
      }),
    });
  }
  if (resolution.cursorOffset === selection.endOffset) {
    return Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId: resolution.workId,
      documentId: resolution.documentId,
      targetRevisionId: resolution.targetRevisionId,
      selection: Object.freeze({
        anchor: selection.startOffset,
        head: selection.endOffset,
      }),
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "invalid",
    workId: resolution.workId,
    reason: "selection-shape-conflict",
    move: null,
  });
}

function readRevisionEditorStateJson(
  database: NodeSqliteDatabase,
  input: {
    readonly revisionId: EntityId<"DocumentRevision">;
    readonly workId: EntityId<"Work">;
    readonly documentId: EntityId<"Document">;
  },
): string | undefined {
  const rows = database
    .prepare(`
      SELECT editor_state_json AS "editorStateJson"
      FROM document_revision_editor_states
      WHERE
        revision_id = ?
        AND work_id = ?
        AND document_id = ?
    `)
    .all(input.revisionId, input.workId, input.documentId);
  if (rows.length === 0) {
    return undefined;
  }
  if (rows.length !== 1) {
    throw new Error(
      `Editor state identity is ambiguous: ${input.revisionId}`,
    );
  }
  return readRequiredString(
    rows[0] ?? {},
    "editorStateJson",
    "Document revision editor state",
  );
}

function canonicalizeEditorStateJson(
  editorStateJson: string,
  profile: ManuscriptFormattingProfile,
  textLength: number,
): string {
  return serializeManuscriptEditorDocumentState(
    parseManuscriptEditorDocumentState(
      JSON.parse(editorStateJson),
      profile,
      textLength,
    ),
  );
}

async function loadWorkspaceState(
  database: NodeSqliteDatabase,
  revisionStore: RevisionStore,
  emptyDocumentProfile: ManuscriptDocumentProfile,
  resumeReader: ResumeCheckpointWithAnchorsCaptureTransaction,
  anchorEvidenceChecksumAlgorithm: string,
  preferredLocation?: ActivateWorkspaceLocationCommand,
): Promise<{
  readonly catalog: WorkspaceCatalogProjection;
  readonly documentProfile: ManuscriptDocumentProfile;
  readonly resumeProjection: ManuscriptResumeCheckpointProjection;
  readonly documentTargets:
    readonly MutableDocumentSaveTarget[];
}> {
  const workRows = readStoredWorkRows(database);
  const folderRows = readStoredDocumentFolderRows(database);
  const rows = readStoredDocumentRows(database);
  if (workRows.length === 0) {
    return Object.freeze({
      catalog: parseWorkspaceCatalogProjection({
        schemaVersion: 1,
        works: [],
        activeWorkId: null,
        activeDocumentId: null,
        canCreateFirstWork: true,
      }),
      documentProfile: emptyDocumentProfile,
      resumeProjection: Object.freeze({
        schemaVersion: 1,
        status: "unavailable",
      }),
      documentTargets: Object.freeze([]),
    });
  }
  const materialized = await Promise.all(
    rows.map(async (row) => ({
      row,
      text: await revisionStore.materialize(row.currentRevisionId),
      editorStateJson: readRevisionEditorStateJson(database, {
        revisionId: row.currentRevisionId,
        workId: row.workId,
        documentId: row.documentId,
      }),
    })),
  );
  const worksById = new Map<
    EntityId<"Work">,
    {
      readonly workId: EntityId<"Work">;
      readonly title: string;
      readonly updatedAt: string;
      readonly folders: Array<{
        readonly folderId: EntityId<"DocumentFolder">;
        readonly title: string;
        readonly parentFolderId: EntityId<"DocumentFolder"> | null;
      }>;
      readonly documents: Array<{
        readonly documentId: EntityId<"Document">;
        readonly title: string;
        readonly currentRevisionId:
          EntityId<"DocumentRevision">;
        readonly folderId: EntityId<"DocumentFolder"> | null;
        readonly completion: DocumentCompletionProjection;
      }>;
    }
  >();
  for (const row of workRows) {
    worksById.set(row.workId, {
      workId: row.workId,
      title: row.workTitle,
      updatedAt: row.workUpdatedAt,
      folders: [],
      documents: [],
    });
  }
  for (const folder of folderRows) {
    const work = worksById.get(folder.workId);
    if (work === undefined) {
      throw new Error(`Document folder belongs to an unavailable Work: ${folder.workId}`);
    }
    work.folders.push({
      folderId: folder.folderId,
      title: folder.title,
      parentFolderId: folder.parentFolderId,
    });
  }
  for (const { row } of materialized) {
    const work = worksById.get(row.workId);
    if (work === undefined) {
      throw new Error(`Document belongs to an unavailable Work: ${row.workId}`);
    }
    work.documents.push({
      documentId: row.documentId,
      title: row.documentTitle,
      currentRevisionId: row.currentRevisionId,
      folderId: row.folderId,
      completion: parseDocumentCompletionProjection({
        schemaVersion: 1,
        workId: row.workId,
        documentId: row.documentId,
        revision: row.completionRevision ?? 0,
        completedAt: row.completionCompletedAt,
        completedDate: row.completionCompletedDate,
        completedTimeZone: row.completionCompletedTimeZone,
        completedDocumentRevisionId: row.completionDocumentRevisionId,
        state: row.completionDocumentRevisionId === null
          ? "incomplete"
          : row.completionDocumentRevisionId === row.currentRevisionId
            ? "current"
            : "edited-after-completion",
        updatedAt: row.completionUpdatedAt,
      }),
    });
  }
  const works = [...worksById.values()];
  const activeWork =
    preferredLocation === undefined
      ? works[0]
      : works.find((work) => work.workId === preferredLocation.workId);
  if (preferredLocation !== undefined && activeWork === undefined) {
    throw new Error(`Unknown workspace Work: ${preferredLocation.workId}`);
  }
  if (activeWork === undefined) {
    throw new Error("Stored workspace has no active Work");
  }
  const writingCatalog = createCatalogFromStoredRows(rows);
  let resumeProjection: ManuscriptResumeCheckpointProjection;
  if (activeWork.documents.length === 0) {
    resumeProjection = Object.freeze({
      schemaVersion: 1,
      status: "unavailable",
    });
  } else {
    try {
      resumeProjection = projectResumeResolution(
        await new ResolveResumeCheckpointForWork({
          catalog: writingCatalog,
          revisionStore,
          reader: resumeReader,
          describeEvidence: createNodeCryptoAnchorEvidenceDescriptor(
            anchorEvidenceChecksumAlgorithm,
          ),
        }).execute(activeWork.workId),
      );
    } catch (error) {
      if (!(error instanceof ResumeAnchorIntegrityError)) {
        throw error;
      }
      resumeProjection = Object.freeze({
        schemaVersion: 1,
        status: "invalid",
        workId: activeWork.workId,
        reason: "anchor-integrity-conflict",
        move: null,
      });
    }
  }
  const explicitDocument =
    preferredLocation?.documentId === null ||
    preferredLocation?.documentId === undefined
      ? undefined
      : activeWork.documents.find(
          (document) =>
            document.documentId === preferredLocation.documentId,
        );
  if (
    preferredLocation?.documentId !== null &&
    preferredLocation?.documentId !== undefined &&
    explicitDocument === undefined
  ) {
    throw new Error(
      `Work/document boundary violation: ${preferredLocation.workId}/${preferredLocation.documentId}`,
    );
  }
  const resumeDocument =
    resumeProjection.status === "resolved" ||
    resumeProjection.status === "needsReview" ||
    resumeProjection.status === "broken"
      ? activeWork.documents.find(
          (document) =>
            document.documentId === resumeProjection.documentId,
        )
      : undefined;
  const activeDocument =
    explicitDocument ??
    resumeDocument ??
    activeWork.documents[0];
  const catalog = parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works,
    activeWorkId: activeWork.workId,
    activeDocumentId: activeDocument?.documentId ?? null,
    canCreateFirstWork: false,
  });
  const firstMaterializedDocument = materialized[0];
  const documentProfile =
    firstMaterializedDocument === undefined
      ? emptyDocumentProfile
      : parseManuscriptDocumentProfile({
          schemaVersion: 1,
          initialDocumentId:
            activeDocument?.documentId ??
            firstMaterializedDocument.row.documentId,
          documents: materialized.map(({ row, text, editorStateJson }) => ({
            workId: row.workId,
            documentId: row.documentId,
            documentRevisionId: row.currentRevisionId,
            label: row.documentTitle,
            initialText: text,
            ...(editorStateJson === undefined ? {} : { editorStateJson }),
          })),
        });
  return Object.freeze({
    catalog,
    documentProfile,
    resumeProjection,
    documentTargets: Object.freeze(
      materialized.map(({ row, text }) => ({
        workId: row.workId,
        documentId: row.documentId,
        baseRevisionId: row.currentRevisionId,
        currentRevisionId: row.currentRevisionId,
        nextSequence: 0,
        text,
      })),
    ),
  });
}

async function ensureSceneRuleSetState(input: Readonly<{
  database: NodeSqliteDatabase;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  defaults: LocalWorkspaceDefaults;
}>): Promise<void> {
  const missingRows = input.database.prepare(`
    SELECT
      ws.work_id AS "workId",
      ws.scene_rule_set_id AS "sceneRuleSetId"
    FROM work_settings AS ws
    LEFT JOIN scene_rule_sets AS srs
      ON srs.work_id = ws.work_id
      AND srs.id = ws.scene_rule_set_id
      AND srs.retired_at IS NULL
    WHERE srs.id IS NULL
    ORDER BY ws.work_id ASC
  `).all();
  if (missingRows.length === 0) return;
  const now = new Date().toISOString();
  await input.ledger.transaction(async (transaction: StorageTransaction) => {
    missingRows.forEach((row, index) => {
      const label = `Missing SceneRuleSet rows[${index}]`;
      transaction.write({
        kind: "sceneRuleSet",
        ...createRecordMeta(now),
        id: readRequiredString(row, "sceneRuleSetId", label),
        workId: readRequiredString(row, "workId", label),
        displayName: input.defaults.sceneRuleSet.displayName,
        boundaryRulesJson: JSON.stringify(
          input.defaults.sceneRuleSet.boundaryRules,
        ),
        normalizationPolicy: input.defaults.sceneRuleSet.normalizationPolicy,
        enabled: input.defaults.sceneRuleSet.enabled,
      });
    });
  });
}

async function ensureDefaultPlotBoardState(input: Readonly<{
  database: NodeSqliteDatabase;
  ledger: Awaited<ReturnType<typeof openNodeSqliteLedger>>;
  defaults: LocalWorkspaceDefaults;
}>): Promise<void> {
  const workRows = input.database.prepare(`
    SELECT id AS "workId"
    FROM works
    ORDER BY created_at ASC, id ASC
  `).all();
  for (const [workIndex, workRow] of workRows.entries()) {
    const workId = entityId<"Work">(
      readRequiredString(workRow, "workId", `Work rows[${workIndex}]`),
    );
    const boardRows = input.database.prepare(DEFAULT_PLOT_BOARD_ROWS_SQL).all(workId);
    if (boardRows.length > 1) {
      throw new Error(`Work has more than one default sequence PlotBoard: ${workId}`);
    }

    const now = new Date().toISOString();
    const board = boardRows.length === 0
      ? Object.freeze({
          plotBoardId: entityId<"PlotBoard">(randomUUID()),
          revision: 1,
          workId,
          title: input.defaults.plotBoard.defaultBoardTitle,
          mode: "sequence" as const,
          createdAt: now,
          updatedAt: now,
        })
      : parseStoredPlotBoardRow(boardRows[0] ?? {}, "Default PlotBoard bootstrap");
    const existingLanes = boardRows.length === 0
      ? []
      : [...readStoredPlotLaneRows(input.database, workId, board.plotBoardId)];
    const defaultLanes = existingLanes.filter((lane) => lane.kind === "default");
    if (boardRows.length !== 0 && defaultLanes.length !== 1) {
      throw new Error(
        `Default PlotBoard must have exactly one default PlotLane: ${board.plotBoardId}`,
      );
    }
    const defaultLane = defaultLanes[0] ?? Object.freeze({
      plotLaneId: entityId<"PlotLane">(randomUUID()),
      revision: 1,
      workId,
      plotBoardId: board.plotBoardId,
      title: input.defaults.plotBoard.defaultLaneTitle,
      kind: "default" as const,
      orderKey: "0/1",
      createdAt: now,
      updatedAt: now,
    });

    const existingPlacements = boardRows.length === 0
      ? []
      : readStoredActivePlotPlacementRows(
          input.database,
          workId,
          board.plotBoardId,
        ).filter((placement) => placement.plotLaneId === defaultLane.plotLaneId)
          .sort((left, right) =>
            compareFractionalOrderKeys(left.orderKey, right.orderKey) ||
            left.plotPlacementId.localeCompare(right.plotPlacementId));
    const missingPlotRows = input.database.prepare(`
      SELECT plot.id AS "plotThreadId"
      FROM plot_threads AS plot
      WHERE
        plot.work_id = ?
        AND plot.retired_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM plot_placements AS placement
          WHERE
            placement.work_id = plot.work_id
            AND placement.plot_thread_id = plot.id
        )
      ORDER BY plot.created_at ASC, plot.id ASC
    `).all(workId);
    const placementRecords: Poc3LedgerRecord[] = [];
    let previousKey = existingPlacements.at(-1)?.orderKey ?? null;
    for (const [plotIndex, plotRow] of missingPlotRows.entries()) {
      const plotThreadId = readRequiredString(
        plotRow,
        "plotThreadId",
        `Unplaced plot rows[${plotIndex}]`,
      );
      const orderKey = createOrderKeyBetween(previousKey, null);
      placementRecords.push({
        kind: "plotPlacement",
        ...createRecordMeta(now),
        id: randomUUID(),
        workId,
        plotBoardId: board.plotBoardId,
        plotLaneId: defaultLane.plotLaneId,
        plotThreadId,
        orderKey,
      });
      previousKey = orderKey;
    }
    if (boardRows.length !== 0 && placementRecords.length === 0) continue;

    await input.ledger.transaction(async (transaction: StorageTransaction) => {
      if (boardRows.length === 0) {
        transaction.write({
          kind: "plotBoard",
          ...createRecordMeta(now),
          id: board.plotBoardId,
          workId,
          title: board.title,
          mode: board.mode,
        });
        transaction.write({
          kind: "plotLane",
          ...createRecordMeta(now),
          id: defaultLane.plotLaneId,
          workId,
          plotBoardId: board.plotBoardId,
          title: defaultLane.title,
          laneKind: defaultLane.kind,
          orderKey: defaultLane.orderKey,
        });
      }
      for (const record of placementRecords) transaction.write(record);
      if (placementRecords.length > 0) {
        transaction.write({
          kind: "plotBoardTouch",
          id: board.plotBoardId,
          workId,
          expectedRevision: board.revision,
          updatedAt: now,
        });
      }
    });
  }
}

export async function openLocalWorkspaceRuntime(
  options: LocalWorkspaceRuntimeOptions,
): Promise<LocalWorkspaceRuntime> {
  if (!path.isAbsolute(options.rootDirectoryPath)) {
    throw new Error("Local workspace root path must be absolute");
  }
  await mkdir(options.rootDirectoryPath, { recursive: true });
  const profiles = createLocalWorkspaceStorageProfiles(
    options.rootDirectoryPath,
  );
  await migrateLocalWorkspaceEventSourcesIfNeeded({
    ...profiles.ledgerProfile,
    targetSchemaVersion: 2,
  });
  await migrateLocalWorkspacePlotEventLinksIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspacePlotBoardsIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspaceSceneProjectionIfNeeded(profiles.ledgerProfile);
  await migrateLocalWorkspaceCharacterExtractionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCharacterRelationsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneExtractionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceCharacterGenerationIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneAnnotationsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneMusicQueuesIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceSceneDraftsIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceManuscriptLayoutIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceDocumentCompletionIfNeeded(
    profiles.ledgerProfile,
  );
  await migrateLocalWorkspaceEpisodeRangeMovesIfNeeded(
    profiles.ledgerProfile,
  );
  const ledger = await openNodeSqliteLedger(profiles.ledgerProfile);
  const blobStore = await createNodeImmutableBlobStore(
    profiles.blobStoreProfile,
  );
  const { DatabaseSync } = loadNodeSqlite();
  const database = new DatabaseSync(profiles.databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    await ensureSceneRuleSetState({
      database,
      ledger,
      defaults: options.defaults,
    });
    await ensureDefaultPlotBoardState({
      database,
      ledger,
      defaults: options.defaults,
    });
    restoreRunningPomodoroCycles(database, Date.now());
    const blobProfile = createLocalWorkspaceRevisionBlobProfile((blobRef) => {
      const rows = database
        .prepare(`
          SELECT created_at AS "createdAt"
          FROM blob_manifests
          WHERE blob_ref = ?
        `)
        .all(blobRef);
      if (rows.length === 0) {
        return null;
      }
      if (rows.length !== 1) {
        throw new Error(`Blob manifest identity is ambiguous: ${blobRef}`);
      }
      return readRequiredString(
        rows[0] ?? {},
        "createdAt",
        "Blob manifest lookup",
      );
    });
    const revisionStore = ledger.createRevisionStore({
      blobStore,
      blobProfile,
    });
    const episodeRangeMoveStore = ledger.createEpisodeRangeMoveStore({
      blobStore,
      blobProfile,
    });
    const backupService = createLocalWorkspaceBackupService({
      rootDirectoryPath: options.rootDirectoryPath,
      sourceBlobStore: blobStore,
      profile: options.backupProfile,
    });
    const loaded = await loadWorkspaceState(
      database,
      revisionStore,
      options.emptyDocumentProfile,
      ledger.createResumeCheckpointCaptureTransaction({}),
      options.defaults.anchorEvidenceChecksumAlgorithm,
    );
    return new DefaultLocalWorkspaceRuntime({
      database,
      ledger,
      revisionStore,
      episodeRangeMoveStore,
      blobStore,
      blobProfile,
      backupService,
      options,
      ...loaded,
    });
  } catch (error) {
    database.close();
    ledger.close();
    throw error;
  }
}
