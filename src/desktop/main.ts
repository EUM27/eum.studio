import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACTIVITY_EXPORT_RECORDS_CHANNEL,
  ACTIVITY_LIST_WORK_CHANNEL,
  ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
  ACTIVITY_GET_READTHROUGH_CHANNEL,
  ACTIVITY_GET_POMODORO_CHANNEL,
  ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
  ACTIVITY_PAUSE_POMODORO_CHANNEL,
  ACTIVITY_RESUME_POMODORO_CHANNEL,
  ACTIVITY_RECONCILE_POMODORO_CHANNEL,
  ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL,
  ACTIVITY_STOP_POMODORO_CHANNEL,
  ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
  ACTIVITY_SAVE_READTHROUGH_CHANNEL,
  ACTIVITY_START_FOCUS_CHANNEL,
  ACTIVITY_START_SESSION_CHANNEL,
  ACTIVITY_STOP_FOCUS_CHANNEL,
  ACTIVITY_STOP_SESSION_CHANNEL,
  ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL,
  ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
  ASSISTANT_CHAT_RUN_CHANNEL,
  ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_CONNECTOR_PROFILE_CHANNEL,
  ASSISTANT_DELETE_CONNECTION_CHANNEL,
  ASSISTANT_DESTINATION_PROFILE_CHANNEL,
  ASSISTANT_LIST_CONNECTIONS_CHANNEL,
  ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
  ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
  ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
  ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
  ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
  ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
  ASSISTANT_SAVE_CONNECTION_CHANNEL,
  BACKUP_CREATE_CHANNEL,
  BACKUP_GET_STATUS_CHANNEL,
  BACKUP_RESTORE_CHANNEL,
  CHARACTER_ADD_EVIDENCE_CHANNEL,
  CHARACTER_CREATE_CHANNEL,
  CHARACTER_EXTRACTION_DECIDE_CHANNEL,
  CHARACTER_EXTRACTION_LIST_CHANNEL,
  CHARACTER_EXTRACTION_RUN_CHANNEL,
  CHARACTER_GENERATION_DECIDE_CHANNEL,
  CHARACTER_GENERATION_LIST_CHANNEL,
  CHARACTER_GENERATION_RUN_CHANNEL,
  CHARACTER_LIST_CHANNEL,
  CHARACTER_RELATION_CREATE_CHANNEL,
  CHARACTER_RELATION_LIST_CHANNEL,
  CHARACTER_RELATION_RETIRE_CHANNEL,
  CHARACTER_RELATION_UPDATE_CHANNEL,
  CHARACTER_RETIRE_CHANNEL,
  CHARACTER_UPDATE_CHANNEL,
  LORE_ENTRY_ADD_EVIDENCE_CHANNEL,
  LORE_ENTRY_CREATE_CHANNEL,
  LORE_ENTRY_LIST_CHANNEL,
  LORE_ENTRY_RETIRE_CHANNEL,
  LORE_ENTRY_UPDATE_CHANNEL,
  LORE_CANDIDATE_APPROVE_CHANNEL,
  LORE_CANDIDATE_CREATE_CHANNEL,
  LORE_CANDIDATE_LIST_CHANNEL,
  LORE_CANDIDATE_REJECT_CHANNEL,
  LORE_FORESHADOW_LINK_CHANNEL,
  LORE_FORESHADOW_LIST_CHANNEL,
  LORE_FORESHADOW_UNLINK_CHANNEL,
  PUBLISHING_PARTNER_CREATE_CHANNEL,
  PUBLISHING_PARTNER_LIST_CHANNEL,
  PUBLISHING_PARTNER_UPDATE_CHANNEL,
  PUBLISHING_SUBMISSION_CREATE_CHANNEL,
  PUBLISHING_SUBMISSION_LIST_CHANNEL,
  PUBLISHING_SUBMISSION_UPDATE_CHANNEL,
  PUBLISHING_CONTRACT_CREATE_CHANNEL,
  PUBLISHING_CONTRACT_LIST_CHANNEL,
  PUBLISHING_CONTRACT_UPDATE_CHANNEL,
  PUBLISHING_PUBLICATION_CREATE_CHANNEL,
  PUBLISHING_PUBLICATION_LIST_CHANNEL,
  PUBLISHING_PUBLICATION_UPDATE_CHANNEL,
  PUBLISHING_SETTLEMENT_CREATE_CHANNEL,
  PUBLISHING_SETTLEMENT_LIST_CHANNEL,
  PUBLISHING_SETTLEMENT_UPDATE_CHANNEL,
  PUBLISHING_PAYMENT_CREATE_CHANNEL,
  PUBLISHING_PAYMENT_LIST_CHANNEL,
  PUBLISHING_PAYMENT_UPDATE_CHANNEL,
  PUBLISHING_SOURCE_CREATE_CHANNEL,
  PUBLISHING_SOURCE_LIST_CHANNEL,
  PUBLISHING_RESEARCH_PREVIEW_CHANNEL,
  PUBLISHING_RESEARCH_APPROVE_CHANNEL,
  PUBLISHING_ASSISTANT_RUN_CHANNEL,
  PUBLISHING_ASSISTANT_APPROVE_CHANNEL,
  PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL,
  PUBLISHING_PARTNER_CSV_SELECT_CHANNEL,
  PUBLISHING_PARTNER_CSV_APPLY_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL,
  PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL,
  PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL,
  PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL,
  PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL,
  PLOT_CREATE_CHANNEL,
  PLOT_CREATE_EVENT_CHANNEL,
  PLOT_CREATE_FROM_EVENT_CHANNEL,
  PLOT_EVENT_LINK_LIST_CHANNEL,
  PLOT_DEFAULT_BOARD_CHANNEL,
  PLOT_LINK_EVENT_CHANNEL,
  PLOT_LINK_SOURCE_CHANNEL,
  PLOT_LIST_CHANNEL,
  PLOT_MOVE_PLACEMENT_CHANNEL,
  PLOT_SET_STORY_TIME_CHANNEL,
  PLOT_RETIRE_CHANNEL,
  PLOT_SOURCE_LIST_CHANNEL,
  PLOT_UNLINK_EVENT_CHANNEL,
  PLOT_UPDATE_CHANNEL,
  FRAGMENT_CAPTURE_CHANNEL,
  FRAGMENT_LIST_CHANNEL,
  FRAGMENT_PROFILE_CHANNEL,
  FRAGMENT_RECORD_USE_CHANNEL,
  FRAGMENT_RETIRE_CHANNEL,
  FRAGMENT_UPDATE_CHANNEL,
  FORESHADOW_CREATE_LINE_CHANNEL,
  FORESHADOW_CREATE_POINT_CHANNEL,
  FORESHADOW_LIST_LINES_CHANNEL,
  FORESHADOW_LIST_POINTS_CHANNEL,
  FORESHADOW_POINT_PROFILE_CHANNEL,
  FORESHADOW_RETIRE_LINE_CHANNEL,
  FORESHADOW_UPDATE_LINE_CHANNEL,
  MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
  MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL,
  MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_FORMATTING_PROFILE_CHANNEL,
  MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
  MANUSCRIPT_EXPORT_TEXT_CHANNEL,
  MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
  MANUSCRIPT_INPUT_PROFILE_CHANNEL,
  MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL,
  MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
  MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL,
  MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
  MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL,
  MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
  MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
  MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
  MANUSCRIPT_SAVE_FORMATTING_CHANNEL,
  MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
  MANUSCRIPT_STARTUP_RECOVERY_CHANNEL,
  MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
  RUNTIME_INFO_CHANNEL,
  QUICK_TOOLS_GET_MEMO_CHANNEL,
  QUICK_TOOLS_SAVE_MEMO_CHANNEL,
  APP_SETTINGS_PROFILE_CHANNEL,
  APP_SETTINGS_GET_CHANNEL,
  APP_SETTINGS_SAVE_CHANNEL,
  UI_PREFERENCES_GET_CHANNEL,
  UI_PREFERENCES_SAVE_CHANNEL,
  MUSIC_SETTINGS_PROFILE_CHANNEL,
  MUSIC_SETTINGS_GET_WORK_CHANNEL,
  MUSIC_SETTINGS_SAVE_WORK_CHANNEL,
  INSPIRATION_SETTINGS_GET_WORK_CHANNEL,
  INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
  YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL,
  YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL,
  YOUTUBE_MUSIC_PROFILE_CHANNEL,
  YOUTUBE_MUSIC_SEARCH_CHANNEL,
  SCENE_MUSIC_QUEUE_SEARCH_CHANNEL,
  SCENE_MUSIC_QUEUE_LIST_CHANNEL,
  SCENE_MUSIC_QUEUE_SELECT_CHANNEL,
  SCHEDULE_CREATE_ITEM_CHANNEL,
  SCHEDULE_LIST_CALENDAR_CHANNEL,
  SCHEDULE_LIST_TODAY_CHANNEL,
  SCHEDULE_LIST_WORK_CHANNEL,
  SCHEDULE_RETIRE_ITEM_CHANNEL,
  SCHEDULE_SET_COMPLETION_CHANNEL,
  SCHEDULE_UPDATE_ITEM_CHANNEL,
  STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
  STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
  STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
  STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
  STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
  STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
  STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
  STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
  STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
  STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
  STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
  STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
  STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
  STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
  STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
  STRUCTURE_RUN_SCENE_DRAFT_CHANNEL,
  STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
  STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
  STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
  STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
  STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
  VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
  VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
  VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
  VERSION_READ_DOCUMENT_REVISION_CHANNEL,
  VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
  VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
  WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
  WORKSPACE_CATALOG_CHANNEL,
  WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_COMPLETE_DOCUMENT_CHANNEL,
  WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
  WORKSPACE_FAVORITES_CHANNEL,
  WORKSPACE_SET_FAVORITE_CHANNEL,
  WORKSPACE_COVERS_CHANNEL,
  WORKSPACE_SELECT_COVER_CHANNEL,
  WORKSPACE_CAPTURE_RESUME_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_CHANNEL,
  WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
  WORKSPACE_CREATE_WORK_CHANNEL,
  WORKSPACE_MOVE_DOCUMENT_CHANNEL,
  WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RENAME_DOCUMENT_CHANNEL,
  WORKSPACE_RENAME_WORK_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
  WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
  WORKSPACE_RETIRE_WORK_CHANNEL,
  parseManuscriptCloseResult,
  type ManuscriptCloseRequest,
  type RuntimeInfo,
} from "../application/contracts/studio-bridge";
import {
  parseCreateAnchorlessEventCommand,
  parseCreateEventBlockCommand,
  parseEventBlockListProjection,
  parseLinkEventSourceCommand,
  parseListEventBlocksCommand,
  parseMoveEventBlockCommand,
  parseReplaceEventSourceCommand,
  parseRetireEventSourceCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type EventSourceProjection,
} from "../application/structure/event-block-contract";
import {
  parseListEventRailCommand,
  type EventRailProjection,
} from "../application/structure/event-rail-projection";
import {
  parseCreateSceneOverrideCommand,
  parseListSceneOverridesCommand,
  parseSceneOverrideListProjection,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import {
  parseListSceneProjectionCommand,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type SceneProjectionList,
} from "../application/structure/scene-projection";
import {
  parseDecideSceneExtractionAnnotationCommand,
  parseDecideSceneExtractionBoundaryCommand,
  parseListSceneExtractionCandidatesCommand,
  parseRunSceneExtractionCommand,
  parseSceneExtractionCandidateList,
  type SceneExtractionCandidateList,
  type SceneExtractionDecisionResult,
  type SceneExtractionAnnotationDecisionResult,
  type SceneExtractionResult,
} from "../application/structure/scene-extraction-contract";
import {
  parseCompleteSceneDraftInsertionCommand,
  parseListSceneDraftCandidatesCommand,
  parsePrepareSceneDraftInsertionCommand,
  parseRunSceneDraftCommand,
  parseSceneDraftCandidateList,
  parseUpdateSceneDraftCandidateCommand,
  type PrepareSceneDraftInsertionResult,
  type RunSceneDraftResult,
  type SceneDraftCandidate,
  type SceneDraftCandidateList,
} from "../application/structure/scene-draft-contract";
import {
  parseListSceneAnnotationsCommand,
  parseSceneAnnotationList,
  type SceneAnnotationList,
} from "../application/structure/scene-annotation-contract";
import {
  parseCaptureFragmentCommand,
  parseFragmentListProjection,
  parseFragmentShelfProfile,
  parseListFragmentsCommand,
  parseRecordFragmentUseCommand,
  parseRetireFragmentCommand,
  parseUpdateFragmentCommand,
  type FragmentListProjection,
  type FragmentProjection,
} from "../application/fragments/fragment-contract";
import {
  parseAddCharacterEvidenceCommand,
  parseCharacterListProjection,
  parseCreateCharacterCommand,
  parseListCharactersCommand,
  parseRetireCharacterCommand,
  parseUpdateCharacterCommand,
  type CharacterListProjection,
  type CharacterProjection,
} from "../application/characters/character-contract";
import {
  parseCharacterRelationListProjection,
  parseCreateCharacterRelationCommand,
  parseListCharacterRelationsCommand,
  parseRetireCharacterRelationCommand,
  parseUpdateCharacterRelationCommand,
  type CharacterRelationListProjection,
  type CharacterRelationProjection,
} from "../application/characters/character-relation-contract";
import {
  parseCharacterExtractionCandidateList,
  parseDecideCharacterExtractionItemCommand,
  parseListCharacterExtractionCandidatesCommand,
  parseRunCharacterExtractionCommand,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionResult,
} from "../application/characters/character-extraction-contract";
import {
  parseCharacterGenerationCandidateList,
  parseDecideCharacterGenerationItemCommand,
  parseListCharacterGenerationCandidatesCommand,
  parseRunCharacterGenerationCommand,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationResult,
} from "../application/characters/character-generation-contract";
import {
  parseAddLoreEntryEvidenceCommand,
  parseCreateLoreEntryCommand,
  parseListLoreEntriesCommand,
  parseLoreEntryListProjection,
  parseRetireLoreEntryCommand,
  parseUpdateLoreEntryCommand,
  type LoreEntryListProjection,
  type LoreEntryProjection,
} from "../application/lore/lore-entry-contract";
import {
  parseLinkLoreForeshadowCommand,
  parseListLoreForeshadowLinksCommand,
  parseLoreForeshadowLinkListProjection,
  parseUnlinkLoreForeshadowCommand,
  type LoreForeshadowLinkListProjection,
  type LoreForeshadowLinkProjection,
} from "../application/lore/lore-foreshadow-link-contract";
import {
  parseCreateLoreCandidateCommand,
  parseListLoreCandidatesCommand,
  parseLoreCandidateListProjection,
  parseReviewLoreCandidateCommand,
  type LoreCandidateApprovalResult,
  type LoreCandidateListProjection,
  type LoreCandidateProjection,
} from "../application/lore/lore-candidate-contract";
import {
  parseCreatePublishingPartnerCommand,
  parseListPublishingPartnersCommand,
  parsePublishingPartnerListProjection,
  parseUpdatePublishingPartnerCommand,
  type PublishingPartnerListProjection,
  type PublishingPartnerProjection,
} from "../application/publishing/publishing-partner-contract";
import {
  parseCreatePublishingSubmissionCommand,
  parseListPublishingSubmissionsCommand,
  parsePublishingSubmissionListProjection,
  parseUpdatePublishingSubmissionCommand,
  type PublishingSubmissionListProjection,
  type PublishingSubmissionProjection,
} from "../application/publishing/publishing-submission-contract";
import {
  parseCreatePublishingContractCommand,
  parseListPublishingContractsCommand,
  parsePublishingContractListProjection,
  parseUpdatePublishingContractCommand,
  type PublishingContractListProjection,
  type PublishingContractProjection,
} from "../application/publishing/publishing-contract-contract";
import {
  parseCreatePublishingPublicationCommand,
  parseListPublishingPublicationsCommand,
  parsePublishingPublicationListProjection,
  parseUpdatePublishingPublicationCommand,
  type PublishingPublicationListProjection,
  type PublishingPublicationProjection,
} from "../application/publishing/publishing-publication-contract";
import {
  parseCreatePublishingSettlementCommand,
  parseListPublishingSettlementsCommand,
  parsePublishingSettlementListProjection,
  parseUpdatePublishingSettlementCommand,
  type PublishingSettlementListProjection,
  type PublishingSettlementProjection,
} from "../application/publishing/publishing-settlement-contract";
import {
  parseCreatePublishingPaymentCommand,
  parseListPublishingPaymentsCommand,
  parsePublishingPaymentListProjection,
  parseUpdatePublishingPaymentCommand,
  type PublishingPaymentListProjection,
  type PublishingPaymentProjection,
} from "../application/publishing/publishing-payment-contract";
import {
  parseCreatePublishingSourceCommand,
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
  type PublishingSourceListProjection,
  type PublishingSourceProjection,
} from "../application/publishing/publishing-source-contract";
import {
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  parsePublishingResearchApprovalResult,
  parsePublishingResearchCandidateProjection,
  type PublishingResearchApprovalResult,
  type PublishingResearchCandidateProjection,
} from "../application/publishing/publishing-research-contract";
import {
  parseApprovePublishingAssistantCandidateCommand,
  parsePublishingAssistantApprovalResult,
  parsePublishingAssistantResult,
  parseRunPublishingAssistantCommand,
  type PublishingAssistantApprovalResult,
  type PublishingAssistantResult,
} from "../application/publishing/publishing-assistant-contract";
import {
  parseSetPublishingEvidenceLinksCommand,
  type PublishingEvidenceLinksProjection,
} from "../application/publishing/publishing-evidence-link-contract";
import {
  parseApplyPublishingPartnerCsvImportCommand,
  parsePublishingPartnerCsvSelectionProjection,
  parseSelectPublishingPartnerCsvCommand,
  type PublishingPartnerCsvImportResult,
} from "../application/publishing/publishing-partner-csv-import";
import {
  parseApplyPublishingSubmissionCsvImportCommand,
  parsePublishingSubmissionCsvSelectionProjection,
  parseSelectPublishingSubmissionCsvCommand,
  type PublishingSubmissionCsvImportResult,
} from "../application/publishing/publishing-submission-csv-import";
import {
  parseLinkPublishingMailCandidateCommand,
  parseListPublishingMailCandidatesCommand,
  parsePublishingMailCandidateListProjection,
  parseRecordPublishingMailCandidateCommand,
  parseReviewPublishingMailCandidateCommand,
  parseUpdatePublishingMailCandidateCommand,
  type PublishingMailCandidateListProjection,
  type PublishingMailCandidateProjection,
  type PublishingMailCandidateReviewResult,
} from "../application/publishing/publishing-mail-candidate-contract";
import {
  parseConnectPublishingMailCommand,
  parseDisconnectPublishingMailCommand,
  parseGetPublishingMailConnectionCommand,
  parsePublishingMailConnectionProjection,
  parsePublishingMailConnectorProfile,
  parseSyncPublishingMailCommand,
  type PublishingMailConnectionProjection,
  type PublishingMailSyncResult,
} from "../application/publishing/publishing-mail-connection-contract";
import {
  parseGetPublishingMailScheduleCommand,
  parsePublishingMailScheduleProjection,
  parseSavePublishingMailScheduleCommand,
  type PublishingMailScheduleProjection,
} from "../application/publishing/publishing-mail-schedule-contract";
import {
  parseCreatePlotThreadCommand,
  parseListPlotThreadsCommand,
  parsePlotThreadListProjection,
  parseRetirePlotThreadCommand,
  parseUpdatePlotThreadCommand,
  type PlotThreadListProjection,
  type PlotThreadProjection,
} from "../application/plots/plot-contract";
import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parseSetPlotPlacementStoryTimeCommand,
  type PlotBoardProjection,
} from "../application/plots/plot-board-contract";
import {
  parseCreateEventFromPlotCommand,
  parseCreatePlotFromEventCommand,
  parseLinkPlotEventCommand,
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  parseUnlinkPlotEventCommand,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
} from "../application/plots/plot-event-link-contract";
import {
  parseLinkPlotThreadSourceCommand,
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../application/plots/plot-source-contract";
import {
  parseCreateForeshadowLineCommand,
  parseForeshadowLineListProjection,
  parseListForeshadowLinesCommand,
  parseRetireForeshadowLineCommand,
  parseUpdateForeshadowLineCommand,
  type ForeshadowLineListProjection,
  type ForeshadowLineProjection,
} from "../application/foreshadowing/foreshadow-line-contract";
import {
  parseCreateForeshadowPointCommand,
  parseForeshadowPointListProjection,
  parseForeshadowPointProfile,
  parseListForeshadowPointsCommand,
  type ForeshadowPointListProjection,
  type ForeshadowPointProjection,
} from "../application/foreshadowing/foreshadow-point-contract";
import {
  parseConfigureAndStartPomodoroCommand,
  parseGetPomodoroCommand,
  parsePomodoroPhaseCommand,
  parsePomodoroProjection,
  parseUpdatePomodoroNoteCommand,
  type PomodoroProjection,
} from "../application/activity/pomodoro-contract";
import {
  parseListWorkActivityCommand,
  parseStartFocusCycleCommand,
  parseStartWritingSessionCommand,
  parseStopFocusCycleCommand,
  parseStopWritingSessionCommand,
  parseWorkActivityProjection,
  type WorkActivityProjection,
} from "../application/activity/work-activity-contract";
import {
  parseExportWorkRecordsCommand,
  type PreparedWorkRecordsExport,
} from "../application/activity/work-records-export";
import {
  createUnsetWorkRecordsGoals,
  parseGetWorkRecordsGoalsCommand,
  parseSaveWorkRecordsGoalsCommand,
  type WorkRecordsGoalsProjection,
} from "../application/activity/work-records-preferences";
import {
  createUnsetWorkReadthrough,
  parseGetWorkReadthroughCommand,
  parseSaveWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../application/activity/work-readthrough-calculator";
import {
  parseCreateWorkScheduleItemCommand,
  parseListWorkScheduleCommand,
  parseRetireWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseUpdateWorkScheduleItemCommand,
  parseWorkScheduleProjection,
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
  type StudioTodayProjection,
} from "../application/today/studio-today-contract";
import {
  parseGetWorkQuickMemoCommand,
  parseSaveWorkQuickMemoCommand,
  type WorkQuickMemoProjection,
} from "../application/quick-tools/work-quick-memo";
import type {
  AssistantContextPermissionGrant,
} from "../application/assistant/assistant-context-permission";
import {
  parseDeleteAssistantConnectionCommand,
  parseSaveAssistantConnectionCommand,
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
} from "../application/assistant/assistant-connection";
import {
  parseGrantAssistantContextPermissionCommand,
  parseListAssistantContextStateCommand,
  parseRevokeAssistantContextPermissionCommand,
  type AssistantContextStateProjection,
} from "../application/assistant/assistant-context-state";
import {
  parseAssistantDestinationProfile,
  type AssistantDestinationProfile,
} from "../application/assistant/assistant-destination-profile";
import {
  parseAssistantConnectorManifestProfile,
  createAssistantConnectorExecutor,
  type AssistantConnectorManifestProfile,
} from "../application/assistant/assistant-connector-manifest";
import {
  createChatGptOAuthAssistantConnectionId,
  parseChatGptOAuthProfile,
} from "../application/assistant/chatgpt-oauth";
import { parseRunAssistantChatCommand } from "../application/assistant/assistant-chat";
import {
  parseRunAssistantVocabularySuggestionCommand,
  type AssistantVocabularySuggestionResult,
} from "../application/assistant/assistant-vocabulary-suggestion";
import {
  parseRunAssistantExternalSettingReviewCommand,
  type AssistantExternalSettingReviewResult,
} from "../application/assistant/assistant-external-setting-review";
import {
  parseRunAssistantVocabularyLookupCommand,
  type AssistantVocabularyLookupResult,
} from "../application/assistant/assistant-vocabulary-lookup";
import {
  parseRunAssistantNotationReviewCommand,
  type AssistantNotationReviewResult,
} from "../application/assistant/assistant-notation-review";
import {
  parseRunAssistantSettingReviewCommand,
  type AssistantSettingReviewResult,
} from "../application/assistant/assistant-setting-review";
import {
  createDefaultAppSettingsProjection,
  deriveWorkEpisodeCharacterProgress,
  parseAppSettingsProfile,
  parseSaveAppSettingsCommand,
  type AppSettingsProjection,
} from "../application/settings/app-settings";
import { parseSaveUiPreferencesCommand } from "../application/settings/ui-preferences";
import {
  createDefaultWorkMusicSettingsProjection,
  parseGetWorkMusicSettingsCommand,
  parseMusicSettingsProfile,
  parseSaveWorkMusicSettingsCommand,
  type WorkMusicSettingsProjection,
} from "../application/music/work-music-settings";
import {
  createDefaultWorkInspirationSettingsProjection,
  parseGetWorkInspirationSettingsCommand,
  parseSaveWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../application/inspiration/work-inspiration-settings";
import {
  parseSaveYouTubeMusicConnectionCommand,
  type YouTubeMusicConnectionStatus,
} from "../application/music/youtube-music-connection";
import {
  parseSearchYouTubeVideosCommand,
  parseYouTubeMusicProfile,
} from "../application/music/youtube-music";
import {
  parseListSceneMusicQueueCandidatesCommand,
  parseSceneMusicQueueCandidateList,
  parseSearchSceneMusicQueuesCommand,
  parseSelectSceneMusicQueueCommand,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueCandidateList,
  type SceneMusicQueueSearchResult,
} from "../application/music/scene-music-queue-contract";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseReadDocumentRevisionCommand,
  parseRestoreDocumentRevisionCommand,
  parseWorkSnapshotListProjection,
  type DocumentRevisionListProjection,
  type DocumentRevisionContentProjection,
  type RestoreDocumentRevisionResult,
  type WorkSnapshotListProjection,
  type WorkSnapshotProjection,
} from "../application/revisions/work-version-contract";
import {
  parseCompareWorkSnapshotCommand,
  type WorkSnapshotComparisonProjection,
} from "../application/revisions/work-snapshot-comparison";
import { parseManuscriptDocumentProfile } from "../application/editor/manuscript-document-profile";
import { parseManuscriptInputProfile } from "../application/editor/manuscript-input-profile";
import { parseManuscriptFormattingProfile } from "../application/editor/manuscript-formatting";
import {
  createDefaultWorkManuscriptLayoutSettingsProjection,
  parseGetWorkManuscriptLayoutSettingsCommand,
  parseSaveWorkManuscriptLayoutSettingsCommand,
  parseWorkManuscriptLayoutSettingsProjection,
  type WorkManuscriptLayoutSettingsProjection,
} from "../application/editor/work-manuscript-layout-settings";
import {
  createDefaultManuscriptPreflightSettings,
  parseExportManuscriptTextCommand,
  parseGetManuscriptPreflightSettingsCommand,
  parseManuscriptPreflightProfile,
  parseSaveManuscriptPreflightSettingsCommand,
  type ExportManuscriptTextCommand,
  type ManuscriptPreflightSettingsProjection,
} from "../application/editor/manuscript-preflight";
import {
  normalizeImportedManuscriptText,
  parseSelectManuscriptTextImportCommand,
} from "../application/editor/manuscript-text-import";
import {
  createUnsetContinuousReadingProgress,
  parseGetContinuousReadingProgressCommand,
  parseSaveContinuousReadingProgressCommand,
  type WorkContinuousReadingProgressProjection,
} from "../application/editor/continuous-reading-progress";
import type {
  ManuscriptResumeCheckpointProjection,
} from "../application/checkpoints/manuscript-resume-checkpoint-projection";
import {
  parseManuscriptBatchingPolicy,
} from "../application/persistence/manuscript-persistence-profile";
import {
  parseActivateWorkspaceLocationCommand,
  parseCaptureWorkspaceResumeCommand,
  parseCreateDocumentFolderCommand,
  parseCreateDocumentCommand,
  parseCreateWorkCommand,
  parseCreateFirstWorkCommand,
  parseMoveDocumentCommand,
  parsePlaceDocumentInFolderCommand,
  parseRenameDocumentFolderCommand,
  parseRenameDocumentCommand,
  parseRenameWorkCommand,
  parseRetireDocumentCommand,
  parseRetireDocumentFolderCommand,
  parseRetireWorkCommand,
  parseWorkspaceCatalogProjection,
  type CreateDocumentResult,
  type CreateFirstWorkResult,
  type CreateWorkResult,
  type WorkspaceCatalogProjection,
} from "../application/workspace/workspace-contract";
import {
  parseClearDocumentCompletionCommand,
  parseCompleteDocumentCommand,
  parseGetDocumentCompletionCommand,
  type DocumentCompletionProjection,
} from "../application/workspace/document-completion";
import {
  parseSetWorkFavoriteCommand,
  parseWorkFavoritesProjection,
  type WorkFavoritesProjection,
} from "../application/workspace/work-favorites";
import {
  parseSaveWorkCoverCommand,
  parseSelectWorkCoverCommand,
  parseWorkCoverProjection,
  parseWorkCoversProjection,
  type WorkCoverProjection,
  type WorkCoversProjection,
} from "../application/workspace/work-covers";
import {
  parseLocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import {
  parseLocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";
import {
  parseLegacyLoreImportProfile,
} from "../application/migration/legacy-lore-import-profile";
import {
  parseLegacyBrowserSourceExportProfile,
} from "../application/migration/browser-source-export";
import type {
  LocalWorkspaceBackupStatusProjection,
  LocalWorkspaceBackupSummary,
} from "../application/storage/local-workspace-backup-contract";
import { parseManuscriptJournalRuntimeProfile } from "./manuscript-journal-runtime-profile";
import {
  createManuscriptRuntimeCoordinator,
  type ManuscriptRuntimeCoordinator,
} from "./manuscript-runtime-coordinator";
import {
  openLocalWorkspaceRuntime,
  type LocalWorkspaceRuntime,
} from "./local-workspace-runtime";
import { runLegacyLoreImportRehearsal } from "./legacy-lore-import-rehearsal";
import {
  createPoc2CrashGate,
  parsePoc2CrashGateProfile,
  type Poc2CrashGateStage,
} from "./poc-2-crash-gate-profile";
import { parsePocRecoveryApplyRuntimeProfile } from "./poc-recovery-apply-runtime-profile";
import {
  parsePocResumeCheckpointRuntimeProfile,
} from "./poc-resume-checkpoint-runtime-profile";
import { readRuntimeProfileValue } from "./runtime-profile-source";
import { exportNodeManuscriptText } from "../platform/export/node-manuscript-text-export";
import {
  openNodeAssistantConnectionStore,
} from "../platform/assistant/node-assistant-connection-store";
import {
  createNodeChatGptOAuthLogin,
  openNodeChatGptOAuthStore,
} from "../platform/assistant/node-chatgpt-oauth";
import {
  createNodeChatGptCodexClient,
} from "../platform/assistant/node-chatgpt-codex";
import {
  createChatGptOAuthWindowLauncher,
  createChatGptOAuthWindowOptions,
} from "./chatgpt-oauth-window";
import { openNodeYouTubeMusicConnectionStore } from "../platform/music/node-youtube-music-connection-store";
import { createNodeYouTubeMusicSearchClient } from "../platform/music/node-youtube-music-search";
import { openNodeUiPreferencesStore } from "../platform/settings/node-ui-preferences-store";
import {
  openNodePublishingMailConnectionStore,
} from "../platform/publishing/node-publishing-mail-connection-store";
import {
  openNodePublishingMailScheduleStore,
} from "../platform/publishing/node-publishing-mail-schedule-store";
import { createGoogleMailConnector } from "../platform/publishing/google-mail-connector";
import { createPublishingMailRuntime } from "./publishing-mail-runtime";
import { createPublishingMailScheduleRuntime } from "./publishing-mail-schedule-runtime";
import { createStructuredJsonHttpConnector } from "../platform/assistant/structured-json-http-connector";
import { entityId } from "../domain/writing";
import {
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
  shouldShowMainWindow,
} from "./window-policy";
import {
  withYouTubePlayerReferer,
  YOUTUBE_PLAYER_REQUEST_FILTER,
} from "./youtube-player-request-policy";

let mainWindow: BrowserWindow | null = null;
let configuredRendererTarget: string | null =
  null;
let pendingCloseRequest:
  ManuscriptCloseRequest | null = null;
let allowMainWindowClose = false;
let activeApplicationRuntime: ApplicationRuntime | null = null;
let activeYouTubePlayerReferer: string | null = null;

function mediaTypeForWorkCover(filePath: string): string {
  switch (path.extname(filePath).toLocaleLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    default:
      throw new Error("Unsupported Work cover image type");
  }
}

type ApplicationRuntime = {
  readonly manuscript: ManuscriptRuntimeCoordinator;
  getWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection>;
  saveWorkManuscriptLayoutSettings(
    value: unknown,
  ): Promise<WorkManuscriptLayoutSettingsProjection>;
  getWorkspaceCatalog(): WorkspaceCatalogProjection;
  getDocumentCompletion(value: unknown): Promise<DocumentCompletionProjection>;
  completeDocument(value: unknown): Promise<DocumentCompletionProjection>;
  clearDocumentCompletion(value: unknown): Promise<DocumentCompletionProjection>;
  getWorkFavorites(): WorkFavoritesProjection;
  setWorkFavorite(value: unknown): Promise<WorkFavoritesProjection>;
  getWorkCovers(): WorkCoversProjection;
  saveWorkCover(value: unknown): Promise<WorkCoverProjection>;
  activateWorkspaceLocation(value: unknown): Promise<WorkspaceCatalogProjection>;
  createWork(value: unknown): Promise<CreateWorkResult>;
  createFirstWork(value: unknown): Promise<CreateFirstWorkResult>;
  createDocument(value: unknown): Promise<CreateDocumentResult>;
  renameWork(value: unknown): Promise<WorkspaceCatalogProjection>;
  renameDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
  retireWork(value: unknown): Promise<WorkspaceCatalogProjection>;
  retireDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
  moveDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
  createDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  renameDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  placeDocumentInFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  retireDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  captureWorkspaceResume(value: unknown): Promise<ManuscriptResumeCheckpointProjection>;
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
  runSceneExtraction(value: unknown): Promise<SceneExtractionResult>;
  listSceneExtractionCandidates(value: unknown): Promise<SceneExtractionCandidateList>;
  decideSceneExtractionBoundary(value: unknown): Promise<SceneExtractionDecisionResult>;
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
  searchSceneMusicQueues(value: unknown): Promise<SceneMusicQueueSearchResult>;
  listSceneMusicQueueCandidates(
    value: unknown,
  ): Promise<SceneMusicQueueCandidateList>;
  selectSceneMusicQueue(value: unknown): Promise<SceneMusicQueueCandidate>;
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
  createLoreCandidate(value: unknown): Promise<LoreCandidateProjection>;
  listLoreCandidates(value: unknown): Promise<LoreCandidateListProjection>;
  approveLoreCandidate(value: unknown): Promise<LoreCandidateApprovalResult>;
  rejectLoreCandidate(value: unknown): Promise<LoreCandidateProjection>;
  linkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection>;
  listLoreForeshadowLinks(value: unknown): Promise<LoreForeshadowLinkListProjection>;
  unlinkLoreForeshadow(value: unknown): Promise<LoreForeshadowLinkProjection>;
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
  previewPublishingResearch(value: unknown): Promise<PublishingResearchCandidateProjection>;
  approvePublishingResearch(value: unknown): Promise<PublishingResearchApprovalResult>;
  runPublishingAssistant(value: unknown): Promise<PublishingAssistantResult>;
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
  recordPublishingMailCandidate(value: unknown): Promise<PublishingMailCandidateProjection>;
  listPublishingMailCandidates(value: unknown): Promise<PublishingMailCandidateListProjection>;
  linkPublishingMailCandidate(value: unknown): Promise<PublishingMailCandidateProjection>;
  updatePublishingMailCandidate(value: unknown): Promise<PublishingMailCandidateProjection>;
  reviewPublishingMailCandidate(value: unknown): Promise<PublishingMailCandidateReviewResult>;
  getPublishingMailConnection(value: unknown): Promise<PublishingMailConnectionProjection>;
  connectPublishingMail(value: unknown): Promise<PublishingMailConnectionProjection>;
  syncPublishingMail(value: unknown): Promise<PublishingMailSyncResult>;
  disconnectPublishingMail(value: unknown): Promise<PublishingMailConnectionProjection>;
  getPublishingMailSchedule(value: unknown): Promise<PublishingMailScheduleProjection>;
  savePublishingMailSchedule(value: unknown): Promise<PublishingMailScheduleProjection>;
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
  listPlotThreadSources(value: unknown): Promise<PlotThreadSourceListProjection>;
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
  getWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection>;
  saveWorkMusicSettings(value: unknown): Promise<WorkMusicSettingsProjection>;
  getWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection>;
  saveWorkInspirationSettings(
    value: unknown,
  ): Promise<WorkInspirationSettingsProjection>;
  getYouTubeMusicConnectionStatus(): Promise<YouTubeMusicConnectionStatus>;
  saveYouTubeMusicConnection(value: unknown): Promise<YouTubeMusicConnectionStatus>;
  getWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection>;
  saveWorkQuickMemo(value: unknown): Promise<WorkQuickMemoProjection>;
  listAssistantConnections(): Promise<AssistantConnectionListProjection>;
  saveAssistantConnection(value: unknown): Promise<AssistantConnectionProjection>;
  deleteAssistantConnection(value: unknown): Promise<void>;
  listAssistantContextState(
    value: unknown,
  ): Promise<AssistantContextStateProjection>;
  grantAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant>;
  revokeAssistantContextPermission(
    value: unknown,
  ): Promise<AssistantContextPermissionGrant>;
  getAssistantConnectorProfile(): AssistantConnectorManifestProfile;
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
  runAssistantNotationReview(
    value: unknown,
  ): Promise<AssistantNotationReviewResult>;
  runAssistantSettingReview(
    value: unknown,
  ): Promise<AssistantSettingReviewResult>;
  listDocumentRevisions(value: unknown): Promise<DocumentRevisionListProjection>;
  readDocumentRevision(value: unknown): Promise<DocumentRevisionContentProjection>;
  restoreDocumentRevision(value: unknown): Promise<RestoreDocumentRevisionResult>;
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
  createBackupBundle(bundlePath: string): Promise<LocalWorkspaceBackupSummary>;
  restoreBackupBundle(
    bundlePath: string,
    targetPath: string,
  ): Promise<LocalWorkspaceBackupSummary>;
  close(): void;
};

function projectConfiguredWorkspaceCatalog(
  documentProfile: ReturnType<typeof parseManuscriptDocumentProfile>,
): WorkspaceCatalogProjection {
  const projectedAt = new Date().toISOString();
  const works = new Map<
    string,
    {
      workId: string;
      title: string;
      updatedAt: string;
      folders: never[];
      documents: Array<{
        documentId: string;
        title: string;
        currentRevisionId: string;
        folderId: null;
      }>;
    }
  >();
  for (const document of documentProfile.documents) {
    let work = works.get(document.workId);
    if (work === undefined) {
      work = {
        workId: document.workId,
        title: document.label,
        updatedAt: projectedAt,
        folders: [],
        documents: [],
      };
      works.set(document.workId, work);
    }
    work.documents.push({
      documentId: document.documentId,
      title: document.label,
      currentRevisionId:
        document.documentRevisionId ??
        `configured-${document.documentId}`,
      folderId: null,
    });
  }
  const activeDocument = documentProfile.documents.find(
    (document) =>
      document.documentId === documentProfile.initialDocumentId,
  );
  if (activeDocument === undefined) {
    throw new Error("Configured manuscript profile has no active document");
  }
  return parseWorkspaceCatalogProjection({
    schemaVersion: 1,
    works: [...works.values()],
    activeWorkId: activeDocument.workId,
    activeDocumentId: activeDocument.documentId,
    canCreateFirstWork: false,
  });
}

function assertTrustedRendererSender(
  event: IpcMainInvokeEvent,
): void {
  const window = mainWindow;
  const rendererTarget =
    configuredRendererTarget;
  const senderFrame =
    event.senderFrame;
  if (
    window === null ||
    rendererTarget === null ||
    senderFrame === null ||
    !isTrustedRendererIpcSender({
      senderWebContentsId:
        event.sender.id,
      trustedWebContentsId:
        window.webContents.id,
      senderFrameUrl:
        senderFrame.url,
      senderMainFrameUrl:
        event.sender.mainFrame.url,
      configuredRendererTarget:
        rendererTarget,
    })
  ) {
    throw new Error(
      "Rejected untrusted renderer IPC sender",
    );
  }
}

async function registerApplicationHandlers(): Promise<void> {
  const ephemeralWorkId = randomUUID();
  const ephemeralDocumentId = randomUUID();
  const ephemeralRevisionId = randomUUID();
  const ephemeralDocumentProfile = parseManuscriptDocumentProfile({
    schemaVersion: 1,
    initialDocumentId: ephemeralDocumentId,
    documents: [
      {
        workId: ephemeralWorkId,
        documentId: ephemeralDocumentId,
        documentRevisionId: ephemeralRevisionId,
        label: "새 원고",
        initialText: "",
      },
    ],
  });
  const documentProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const documentProfile =
    documentProfileValue === null
      ? ephemeralDocumentProfile
      : parseManuscriptDocumentProfile(documentProfileValue);
  const manuscriptInputProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE,
    filePath: process.env.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const manuscriptInputProfile = parseManuscriptInputProfile(
    manuscriptInputProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "manuscript-input.json"),
          "utf8",
        ),
      ),
  );
  const formattingProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_FORMATTING_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_FORMATTING_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const formattingProfile = parseManuscriptFormattingProfile(
    formattingProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(
            app.getAppPath(),
            "config",
            "manuscript-formatting.json",
          ),
          "utf8",
        ),
      ),
  );
  const appSettingsProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_APP_SETTINGS_PROFILE,
    filePath: process.env.EUM_STUDIO_APP_SETTINGS_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const appSettingsProfile = parseAppSettingsProfile(
    appSettingsProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "app-settings.json"),
          "utf8",
        ),
      ),
  );
  const musicSettingsProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_MUSIC_SETTINGS_PROFILE,
    filePath: process.env.EUM_STUDIO_MUSIC_SETTINGS_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const musicSettingsProfile = parseMusicSettingsProfile(
    musicSettingsProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "music-settings.json"),
          "utf8",
        ),
      ),
  );
  const assistantDestinationProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_ASSISTANT_DESTINATION_PROFILE,
    filePath: process.env.EUM_STUDIO_ASSISTANT_DESTINATION_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const assistantDestinationProfile = parseAssistantDestinationProfile(
    assistantDestinationProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "assistant-destinations.json"),
          "utf8",
        ),
      ),
  );
  const assistantConnectorProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_ASSISTANT_CONNECTOR_PROFILE,
    filePath: process.env.EUM_STUDIO_ASSISTANT_CONNECTOR_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const assistantConnectorProfile = parseAssistantConnectorManifestProfile(
    assistantConnectorProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "assistant-connectors.json"),
          "utf8",
        ),
      ),
  );
  const chatGptOAuthProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_CHATGPT_OAUTH_PROFILE,
    filePath: process.env.EUM_STUDIO_CHATGPT_OAUTH_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const chatGptOAuthProfile = parseChatGptOAuthProfile(
    chatGptOAuthProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "chatgpt-oauth.json"),
          "utf8",
        ),
    ),
  );
  const youtubeMusicProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_YOUTUBE_MUSIC_PROFILE,
    filePath: process.env.EUM_STUDIO_YOUTUBE_MUSIC_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const youtubeMusicProfile = parseYouTubeMusicProfile(
    youtubeMusicProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "youtube-music.json"),
          "utf8",
        ),
      ),
  );
  activeYouTubePlayerReferer = youtubeMusicProfile.playerReferer;
  const publishingMailConnectorProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE,
    filePath: process.env.EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const publishingMailConnectorProfile = parsePublishingMailConnectorProfile(
    publishingMailConnectorProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(app.getAppPath(), "config", "publishing-mail-connectors.json"),
          "utf8",
        ),
      ),
  );
  const preflightProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const preflightProfile = parseManuscriptPreflightProfile(
    preflightProfileValue ??
      JSON.parse(
        readFileSync(
          path.join(
            app.getAppPath(),
            "config",
            "manuscript-preflight.json",
          ),
          "utf8",
        ),
      ),
  );
  const fragmentProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_FRAGMENT_SHELF_PROFILE,
    filePath: process.env.EUM_STUDIO_FRAGMENT_SHELF_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const fragmentProfile = parseFragmentShelfProfile(
    fragmentProfileValue ?? JSON.parse(readFileSync(
      path.join(app.getAppPath(), "config", "fragment-shelf.json"),
      "utf8",
    )),
  );
  const foreshadowPointProfileValue = readRuntimeProfileValue({
    inlineJson: process.env.EUM_STUDIO_FORESHADOW_POINT_PROFILE,
    filePath: process.env.EUM_STUDIO_FORESHADOW_POINT_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const foreshadowPointProfile = parseForeshadowPointProfile(
    foreshadowPointProfileValue ?? JSON.parse(readFileSync(
      path.join(app.getAppPath(), "config", "foreshadowing.json"),
      "utf8",
    )),
  );
  const journalProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const journalProfile =
    journalProfileValue === null
      ? null
      : parseManuscriptJournalRuntimeProfile(
          journalProfileValue,
        );
  const batchingProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE,
    filePath:
      process.env.EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE_PATH,
    readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  });
  const batchingPolicy =
    batchingProfileValue === null
      ? null
      : parseManuscriptBatchingPolicy(
          batchingProfileValue,
        );
  const crashGateProfileValue = readRuntimeProfileValue({
    inlineJson:
      process.env.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE,
    filePath:
      process.env.EUM_STUDIO_POC_2_CRASH_GATE_PROFILE_PATH,
    readTextFile: (filePath) =>
      readFileSync(filePath, "utf8"),
  });
  const crashGate =
    crashGateProfileValue === null
      ? null
      : createPoc2CrashGate({
          profile: parsePoc2CrashGateProfile(
            crashGateProfileValue,
          ),
          enterPending: () =>
            new Promise<void>(() => undefined),
        });
  const recoveryApplyProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        process.env
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE,
      filePath:
        process.env
          .EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const recoveryApplyProfile =
    recoveryApplyProfileValue === null
      ? null
      : parsePocRecoveryApplyRuntimeProfile(
          recoveryApplyProfileValue,
        );
  const resumeCheckpointProfileValue =
    readRuntimeProfileValue({
      inlineJson:
        process.env
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE,
      filePath:
        process.env
          .EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE_PATH,
      readTextFile: (filePath) =>
        readFileSync(filePath, "utf8"),
    });
  const resumeCheckpointProfile =
    resumeCheckpointProfileValue === null
      ? null
      : parsePocResumeCheckpointRuntimeProfile(
          resumeCheckpointProfileValue,
        );
  const useEphemeralTestWorkspace =
    process.env.EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE === "1";
  const hasConfiguredManuscriptRuntime =
    documentProfileValue !== null ||
    journalProfileValue !== null ||
    batchingProfileValue !== null ||
    recoveryApplyProfileValue !== null ||
    resumeCheckpointProfileValue !== null ||
    crashGateProfileValue !== null;
  const youtubeMusicConnectionStore =
    await openNodeYouTubeMusicConnectionStore({
      rootDirectoryPath: path.join(
        app.getPath("userData"),
        "youtube-music-connection-v1",
      ),
      cipher: {
        isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
        encryptString: (plainText) => safeStorage.encryptString(plainText),
        decryptString: (encrypted) =>
          safeStorage.decryptString(Buffer.from(encrypted)),
      },
    });
  const uiPreferencesStore = await openNodeUiPreferencesStore({
    rootDirectoryPath: path.join(app.getPath("userData"), "ui-preferences-v1"),
  });
  const chatGptOAuthStore = await openNodeChatGptOAuthStore({
    rootDirectoryPath: path.join(app.getPath("userData"), "chatgpt-oauth-v1"),
    providerId: chatGptOAuthProfile.providerId,
    displayName: chatGptOAuthProfile.displayName,
    modelId: chatGptOAuthProfile.upstream.model,
    cipher: {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (plainText) => safeStorage.encryptString(plainText),
      decryptString: (encrypted) =>
        safeStorage.decryptString(Buffer.from(encrypted)),
    },
  });
  const chatGptOAuthWindowLauncher = createChatGptOAuthWindowLauncher({
    createWindow: () => {
      const window = new BrowserWindow(
        createChatGptOAuthWindowOptions(mainWindow ?? undefined),
      );
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      return {
        close: () => window.close(),
        focus: () => window.focus(),
        isDestroyed: () => window.isDestroyed(),
        loadURL: (url) => window.loadURL(url),
        onceClosed: (listener) => {
          window.once("closed", listener);
        },
      };
    },
  });
  const chatGptOAuthLogin = createNodeChatGptOAuthLogin({
    profile: chatGptOAuthProfile,
    store: chatGptOAuthStore,
    openExternal: (url) => chatGptOAuthWindowLauncher.open(url),
  });
  const chatGptCodexClient = createNodeChatGptCodexClient({
    profile: chatGptOAuthProfile,
    store: chatGptOAuthStore,
  });
  const chatGptAssistantConnectionId =
    createChatGptOAuthAssistantConnectionId(chatGptOAuthProfile.providerId);
  const youtubeMusicSearchClient = createNodeYouTubeMusicSearchClient({
    profile: youtubeMusicProfile,
    store: youtubeMusicConnectionStore,
  });
  let applicationRuntime: ApplicationRuntime;
  if (
    !hasConfiguredManuscriptRuntime &&
    !useEphemeralTestWorkspace
  ) {
    const configuredRoot =
      process.env.EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH;
    if (
      configuredRoot !== undefined &&
      !path.isAbsolute(configuredRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH must be absolute",
      );
    }
    const configuredAssistantConnectionRoot =
      process.env.EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH;
    if (
      configuredAssistantConnectionRoot !== undefined &&
      !path.isAbsolute(configuredAssistantConnectionRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH must be absolute",
      );
    }
    const configuredPublishingMailConnectionRoot =
      process.env.EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH;
    if (
      configuredPublishingMailConnectionRoot !== undefined &&
      !path.isAbsolute(configuredPublishingMailConnectionRoot)
    ) {
      throw new Error(
        "EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH must be absolute",
      );
    }
    const assistantConnectionStore =
      await openNodeAssistantConnectionStore({
        rootDirectoryPath:
          configuredAssistantConnectionRoot ??
          path.join(app.getPath("userData"), "assistant-connections-v1"),
        cipher: {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encryptString: (plainText) => safeStorage.encryptString(plainText),
          decryptString: (encrypted) =>
            safeStorage.decryptString(Buffer.from(encrypted)),
        },
      });
    const publishingMailRootDirectory =
      configuredPublishingMailConnectionRoot ??
      path.join(app.getPath("userData"), "publishing-mail-connection-v1");
    const publishingMailConnectionStore =
      await openNodePublishingMailConnectionStore({
        rootDirectoryPath: publishingMailRootDirectory,
        cipher: {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encryptString: (plainText) => safeStorage.encryptString(plainText),
          decryptString: (encrypted) =>
            safeStorage.decryptString(Buffer.from(encrypted)),
        },
      });
    const publishingMailScheduleStore =
      await openNodePublishingMailScheduleStore({
        rootDirectoryPath: publishingMailRootDirectory,
      });
    const assistantConnectorExecutor = createAssistantConnectorExecutor({
      manifestProfile: assistantConnectorProfile,
      adapters: [createStructuredJsonHttpConnector()],
      readConnection: (connectionId) => {
        const connection = assistantConnectionStore.list().connections.find(
          (entry) => entry.connectionId === connectionId,
        );
        if (connection === undefined) {
          throw new Error(`Unknown assistant connection: ${connectionId}`);
        }
        if (connection.connectorKind === null) {
          throw new Error(`Assistant connection kind is not configured: ${connectionId}`);
        }
        return Object.freeze({
          connectionId,
          connectorKind: connection.connectorKind,
          endpoint: connection.endpoint,
          model: connection.model,
          credential: assistantConnectionStore.readCredential(connectionId),
        });
      },
      createReceiptId: () => entityId<"ConnectorReceipt">(randomUUID()),
      now: () => new Date().toISOString(),
    });
    const localRuntime: LocalWorkspaceRuntime =
      await openLocalWorkspaceRuntime({
        rootDirectoryPath:
          configuredRoot ??
          path.join(app.getPath("userData"), "workspace-v1"),
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        batchingPolicy: parseManuscriptBatchingPolicy({
          schemaVersion: 1,
          maxTransactionsPerBatch: 1,
          maxDelayMs: 0,
        }),
        formattingProfile,
        appSettingsProfile,
        musicSettingsProfile,
        preflightProfile,
        fragmentProfile,
        foreshadowPointProfile,
        assistantDestinationProfile,
        executeAssistantVocabularySuggestion: async (input) => {
          const requestFingerprint = `sha256:${createHash("sha256")
            .update(JSON.stringify({
              query: input.query,
              context: input.context,
            }))
            .digest("hex")}`;
          if (input.connectionId === chatGptAssistantConnectionId) {
            const startedAt = new Date().toISOString();
            const payload = await chatGptCodexClient.suggestVocabulary({
              query: input.query,
              context: input.context,
            });
            return Object.freeze({
              receipt: Object.freeze({
                schemaVersion: 1 as const,
                receiptId: entityId<"ConnectorReceipt">(randomUUID()),
                requestId: entityId<"AssistantConnectorRequest">(
                  input.requestId,
                ),
                connectionId: input.connectionId,
                connectorKind: chatGptOAuthProfile.providerId,
                operation: "vocabulary-suggestions" as const,
                requestFingerprint,
                startedAt,
                completedAt: new Date().toISOString(),
                resultState: "succeeded" as const,
              }),
              payload,
            });
          }
          const execution = await assistantConnectorExecutor.execute({
            schemaVersion: 1,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId: input.connectionId,
            capability: "vocabulary-lookup",
            operation: "vocabulary-suggestions",
            requestFingerprint,
            input: Object.freeze({
              query: input.query,
              context: input.context,
            }),
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        executeAssistantExternalSettingReview: async (input) => {
          const connectorInput = Object.freeze({
            query: input.query,
            manuscript: Object.freeze({
              documentId: input.sourceRange.documentId,
              documentRevisionId: input.sourceRange.documentRevisionId,
              from: input.sourceRange.from,
              to: input.sourceRange.to,
              text: input.manuscript,
            }),
            settings: input.settings,
          });
          const requestFingerprint = `sha256:${createHash("sha256")
            .update(JSON.stringify(connectorInput))
            .digest("hex")}`;
          if (input.connectionId === chatGptAssistantConnectionId) {
            const startedAt = new Date().toISOString();
            const payload = await chatGptCodexClient.reviewSettings(
              connectorInput,
            );
            return Object.freeze({
              receipt: Object.freeze({
                schemaVersion: 1 as const,
                receiptId: entityId<"ConnectorReceipt">(randomUUID()),
                requestId: entityId<"AssistantConnectorRequest">(
                  input.requestId,
                ),
                connectionId: input.connectionId,
                connectorKind: chatGptOAuthProfile.providerId,
                operation: "setting-review" as const,
                requestFingerprint,
                startedAt,
                completedAt: new Date().toISOString(),
                resultState: "succeeded" as const,
              }),
              payload,
            });
          }
          const execution = await assistantConnectorExecutor.execute({
            schemaVersion: 1,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId: input.connectionId,
            capability: "lore-review",
            operation: "setting-review",
            requestFingerprint,
            input: connectorInput,
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        characterExtraction: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ paragraphs }) =>
            chatGptCodexClient.extractCharacters(paragraphs),
        }),
        characterGeneration: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ brief }) =>
            chatGptCodexClient.generateCharacters(brief),
        }),
        sceneExtraction: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ paragraphs }) =>
            chatGptCodexClient.extractScenes(paragraphs),
        }),
        sceneDraft: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: ({ context }) => chatGptCodexClient.draftScene(context),
        }),
        sceneMusicSearch: Object.freeze({
          providerId: youtubeMusicProfile.providerId,
          searchLimit: youtubeMusicProfile.searchLimit,
          tracksPerOption: youtubeMusicProfile.videosPerOption,
          isConnected: () =>
            youtubeMusicConnectionStore.getStatus().apiKeyConfigured,
          execute: ({ query, limit }) =>
            youtubeMusicSearchClient.searchVideos(query, limit),
        }),
        executePublishingAssistantIntent: async (input) => {
          const connectorInput = Object.freeze({
            statement: input.statement,
            currentDate: input.currentDate,
            registry: input.registry,
          });
          const execution = await assistantConnectorExecutor.execute({
            schemaVersion: 1,
            requestId: input.requestId,
            connectionId: input.connectionId,
            capability: "publishing-operations",
            operation: "publishing-intent",
            requestFingerprint: `sha256:${createHash("sha256")
              .update(JSON.stringify(connectorInput))
              .digest("hex")}`,
            input: connectorInput,
          });
          return Object.freeze({
            receipt: execution.receipt,
            payload: execution.payload,
          });
        },
        emptyDocumentProfile: ephemeralDocumentProfile,
        defaults: parseLocalWorkspaceDefaults(
          JSON.parse(
            readFileSync(
              process.env.EUM_STUDIO_LOCAL_WORKSPACE_DEFAULTS_PATH ??
                path.join(
                  app.getAppPath(),
                  "config",
                  "local-workspace-defaults.json",
                ),
              "utf8",
            ),
          ),
        ),
        backupProfile: parseLocalWorkspaceBackupProfile(
          JSON.parse(
            readFileSync(
              process.env.EUM_STUDIO_LOCAL_WORKSPACE_BACKUP_PROFILE_PATH ??
                path.join(
                  app.getAppPath(),
                  "config",
                  "local-workspace-backup.json",
                ),
              "utf8",
            ),
          ),
        ),
      });
    const publishingMailRuntime = createPublishingMailRuntime({
      profile: publishingMailConnectorProfile,
      adapters: [createGoogleMailConnector()],
      openAuthorizationUrl: (url) => shell.openExternal(url),
      readConnection: () => publishingMailConnectionStore.readConnection(),
      saveConnection: (value) =>
        publishingMailConnectionStore.saveConnection(value),
      saveLastSyncedAt: (value) =>
        publishingMailConnectionStore.saveLastSyncedAt(value),
      clearConnection: () => publishingMailConnectionStore.clear(),
      listPartnerSenderAddresses: async () => {
        const projection = await localRuntime.listPublishingPartners({
          schemaVersion: 1,
        });
        return projection.partners.map((partner) => partner.email);
      },
      listCandidateSourceKeys: async () => {
        const projection = await localRuntime.listPublishingMailCandidates({
          schemaVersion: 1,
        });
        return projection.candidates.map(
          (candidate) => `${candidate.sourceAccountId}\u0000${candidate.messageId}`,
        );
      },
      recordCandidate: async (command) => {
        await localRuntime.recordPublishingMailCandidate(command);
      },
    });
    const publishingMailScheduleRuntime = createPublishingMailScheduleRuntime({
      readSchedule: () => publishingMailScheduleStore.readSchedule(),
      saveSettings: (value) => publishingMailScheduleStore.saveSettings(value),
      recordAttempt: (value) => publishingMailScheduleStore.recordAttempt(value),
      isConnected: () => publishingMailConnectionStore.readConnection() !== null,
      sync: (value) => publishingMailRuntime.sync(value),
    });
    publishingMailScheduleRuntime.reconcile();
    applicationRuntime = {
      manuscript: localRuntime,
      getWorkManuscriptLayoutSettings: (value) =>
        localRuntime.getWorkManuscriptLayoutSettings(value),
      saveWorkManuscriptLayoutSettings: (value) =>
        localRuntime.saveWorkManuscriptLayoutSettings(value),
      getWorkspaceCatalog: () =>
        localRuntime.getWorkspaceCatalog(),
      getDocumentCompletion: (value) =>
        localRuntime.getDocumentCompletion(value),
      completeDocument: (value) =>
        localRuntime.completeDocument(value),
      clearDocumentCompletion: (value) =>
        localRuntime.clearDocumentCompletion(value),
      getWorkFavorites: () =>
        localRuntime.getWorkFavorites(),
      setWorkFavorite: (value) =>
        localRuntime.setWorkFavorite(value),
      getWorkCovers: () =>
        localRuntime.getWorkCovers(),
      saveWorkCover: (value) =>
        localRuntime.saveWorkCover(value),
      activateWorkspaceLocation: (value) =>
        localRuntime.activateWorkspaceLocation(value),
      createWork: (value) =>
        localRuntime.createWork(value),
      createFirstWork: (value) =>
        localRuntime.createFirstWork(value),
      createDocument: (value) =>
        localRuntime.createDocument(value),
      renameWork: (value) =>
        localRuntime.renameWork(value),
      renameDocument: (value) =>
        localRuntime.renameDocument(value),
      retireWork: (value) =>
        localRuntime.retireWork(value),
      retireDocument: (value) =>
        localRuntime.retireDocument(value),
      moveDocument: (value) =>
        localRuntime.moveDocument(value),
      createDocumentFolder: (value) =>
        localRuntime.createDocumentFolder(value),
      renameDocumentFolder: (value) =>
        localRuntime.renameDocumentFolder(value),
      placeDocumentInFolder: (value) =>
        localRuntime.placeDocumentInFolder(value),
      retireDocumentFolder: (value) =>
        localRuntime.retireDocumentFolder(value),
      captureWorkspaceResume: (value) =>
        localRuntime.captureWorkspaceResume(value),
      createEventBlock: (value) =>
        localRuntime.createEventBlock(value),
      createAnchorlessEvent: (value) =>
        localRuntime.createAnchorlessEvent(value),
      moveEventBlock: (value) =>
        localRuntime.moveEventBlock(value),
      linkEventSource: (value) =>
        localRuntime.linkEventSource(value),
      replaceEventSource: (value) =>
        localRuntime.replaceEventSource(value),
      retireEventSource: (value) =>
        localRuntime.retireEventSource(value),
      listEventBlocks: (value) =>
        localRuntime.listEventBlocks(value),
      listEventRail: (value) =>
        localRuntime.listEventRail(value),
      createSceneOverride: (value) =>
        localRuntime.createSceneOverride(value),
      listSceneOverrides: (value) =>
        localRuntime.listSceneOverrides(value),
      listSceneProjection: (value) =>
        localRuntime.listSceneProjection(value),
      updateSceneRuleSet: (value) =>
        localRuntime.updateSceneRuleSet(value),
      setSceneEventOverride: (value) =>
        localRuntime.setSceneEventOverride(value),
      runSceneExtraction: (value) =>
        localRuntime.runSceneExtraction(value),
      listSceneExtractionCandidates: (value) =>
        localRuntime.listSceneExtractionCandidates(value),
      decideSceneExtractionBoundary: (value) =>
        localRuntime.decideSceneExtractionBoundary(value),
      listSceneAnnotations: (value) =>
        localRuntime.listSceneAnnotations(value),
      decideSceneExtractionAnnotation: (value) =>
        localRuntime.decideSceneExtractionAnnotation(value),
      runSceneDraft: (value) => localRuntime.runSceneDraft(value),
      listSceneDraftCandidates: (value) =>
        localRuntime.listSceneDraftCandidates(value),
      updateSceneDraftCandidate: (value) =>
        localRuntime.updateSceneDraftCandidate(value),
      prepareSceneDraftInsertion: (value) =>
        localRuntime.prepareSceneDraftInsertion(value),
      completeSceneDraftInsertion: (value) =>
        localRuntime.completeSceneDraftInsertion(value),
      searchSceneMusicQueues: (value) =>
        localRuntime.searchSceneMusicQueues(value),
      listSceneMusicQueueCandidates: (value) =>
        localRuntime.listSceneMusicQueueCandidates(value),
      selectSceneMusicQueue: (value) =>
        localRuntime.selectSceneMusicQueue(value),
      captureFragment: (value) =>
        localRuntime.captureFragment(value),
      listFragments: (value) =>
        localRuntime.listFragments(value),
      updateFragment: (value) =>
        localRuntime.updateFragment(value),
      recordFragmentUse: (value) =>
        localRuntime.recordFragmentUse(value),
      retireFragment: (value) =>
        localRuntime.retireFragment(value),
      createCharacter: (value) =>
        localRuntime.createCharacter(value),
      listCharacters: (value) =>
        localRuntime.listCharacters(value),
      updateCharacter: (value) =>
        localRuntime.updateCharacter(value),
      addCharacterEvidence: (value) =>
        localRuntime.addCharacterEvidence(value),
      retireCharacter: (value) =>
        localRuntime.retireCharacter(value),
      createCharacterRelation: (value) =>
        localRuntime.createCharacterRelation(value),
      listCharacterRelations: (value) =>
        localRuntime.listCharacterRelations(value),
      updateCharacterRelation: (value) =>
        localRuntime.updateCharacterRelation(value),
      retireCharacterRelation: (value) =>
        localRuntime.retireCharacterRelation(value),
      createLoreEntry: (value) =>
        localRuntime.createLoreEntry(value),
      listLoreEntries: (value) =>
        localRuntime.listLoreEntries(value),
      updateLoreEntry: (value) =>
        localRuntime.updateLoreEntry(value),
      addLoreEntryEvidence: (value) =>
        localRuntime.addLoreEntryEvidence(value),
      retireLoreEntry: (value) =>
        localRuntime.retireLoreEntry(value),
      createLoreCandidate: (value) =>
        localRuntime.createLoreCandidate(value),
      listLoreCandidates: (value) =>
        localRuntime.listLoreCandidates(value),
      approveLoreCandidate: (value) =>
        localRuntime.approveLoreCandidate(value),
      rejectLoreCandidate: (value) =>
        localRuntime.rejectLoreCandidate(value),
      linkLoreForeshadow: (value) =>
        localRuntime.linkLoreForeshadow(value),
      listLoreForeshadowLinks: (value) =>
        localRuntime.listLoreForeshadowLinks(value),
      unlinkLoreForeshadow: (value) =>
        localRuntime.unlinkLoreForeshadow(value),
      createPublishingPartner: (value) =>
        localRuntime.createPublishingPartner(value),
      listPublishingPartners: (value) =>
        localRuntime.listPublishingPartners(value),
      updatePublishingPartner: (value) =>
        localRuntime.updatePublishingPartner(value),
      createPublishingSubmission: (value) =>
        localRuntime.createPublishingSubmission(value),
      listPublishingSubmissions: (value) =>
        localRuntime.listPublishingSubmissions(value),
      updatePublishingSubmission: (value) =>
        localRuntime.updatePublishingSubmission(value),
      createPublishingContract: (value) =>
        localRuntime.createPublishingContract(value),
      listPublishingContracts: (value) =>
        localRuntime.listPublishingContracts(value),
      updatePublishingContract: (value) =>
        localRuntime.updatePublishingContract(value),
      createPublishingPublication: (value) =>
        localRuntime.createPublishingPublication(value),
      listPublishingPublications: (value) =>
        localRuntime.listPublishingPublications(value),
      updatePublishingPublication: (value) =>
        localRuntime.updatePublishingPublication(value),
      createPublishingSettlement: (value) =>
        localRuntime.createPublishingSettlement(value),
      listPublishingSettlements: (value) =>
        localRuntime.listPublishingSettlements(value),
      updatePublishingSettlement: (value) =>
        localRuntime.updatePublishingSettlement(value),
      createPublishingPayment: (value) =>
        localRuntime.createPublishingPayment(value),
      listPublishingPayments: (value) =>
        localRuntime.listPublishingPayments(value),
      updatePublishingPayment: (value) =>
        localRuntime.updatePublishingPayment(value),
      createPublishingSource: (value) =>
        localRuntime.createPublishingSource(value),
      listPublishingSources: (value) =>
        localRuntime.listPublishingSources(value),
      previewPublishingResearch: (value) =>
        localRuntime.previewPublishingResearch(value),
      approvePublishingResearch: (value) =>
        localRuntime.approvePublishingResearch(value),
      runPublishingAssistant: (value) =>
        localRuntime.runPublishingAssistant(value),
      approvePublishingAssistantCandidate: (value) =>
        localRuntime.approvePublishingAssistantCandidate(value),
      setPublishingEvidenceLinks: (value) =>
        localRuntime.setPublishingEvidenceLinks(value),
      applyPublishingPartnerCsvImport: (value) =>
        localRuntime.applyPublishingPartnerCsvImport(value),
      applyPublishingSubmissionCsvImport: (value) =>
        localRuntime.applyPublishingSubmissionCsvImport(value),
      recordPublishingMailCandidate: (value) =>
        localRuntime.recordPublishingMailCandidate(value),
      listPublishingMailCandidates: (value) =>
        localRuntime.listPublishingMailCandidates(value),
      linkPublishingMailCandidate: (value) =>
        localRuntime.linkPublishingMailCandidate(value),
      updatePublishingMailCandidate: (value) =>
        localRuntime.updatePublishingMailCandidate(value),
      reviewPublishingMailCandidate: (value) =>
        localRuntime.reviewPublishingMailCandidate(value),
      getPublishingMailConnection: (value) =>
        publishingMailRuntime.status(value),
      connectPublishingMail: async (value) => {
        await publishingMailRuntime.connect(value);
        await publishingMailScheduleRuntime.runDueIfNeeded();
        return publishingMailRuntime.status({ schemaVersion: 1 });
      },
      syncPublishingMail: (value) =>
        publishingMailScheduleRuntime.sync(value),
      disconnectPublishingMail: async (value) => {
        const projection = await publishingMailRuntime.disconnect(value);
        publishingMailScheduleRuntime.reconcile();
        return projection;
      },
      getPublishingMailSchedule: (value) =>
        publishingMailScheduleRuntime.status(value),
      savePublishingMailSchedule: (value) =>
        publishingMailScheduleRuntime.save(value),
      createPlotThread: (value) =>
        localRuntime.createPlotThread(value),
      listPlotThreads: (value) =>
        localRuntime.listPlotThreads(value),
      getDefaultPlotBoard: (value) =>
        localRuntime.getDefaultPlotBoard(value),
      movePlotPlacement: (value) =>
        localRuntime.movePlotPlacement(value),
      setPlotPlacementStoryTime: (value) =>
        localRuntime.setPlotPlacementStoryTime(value),
      updatePlotThread: (value) =>
        localRuntime.updatePlotThread(value),
      retirePlotThread: (value) =>
        localRuntime.retirePlotThread(value),
      createPlotFromEvent: (value) =>
        localRuntime.createPlotFromEvent(value),
      createEventFromPlot: (value) =>
        localRuntime.createEventFromPlot(value),
      linkPlotEvent: (value) =>
        localRuntime.linkPlotEvent(value),
      unlinkPlotEvent: (value) =>
        localRuntime.unlinkPlotEvent(value),
      listPlotEventLinks: (value) =>
        localRuntime.listPlotEventLinks(value),
      linkPlotThreadSource: (value) =>
        localRuntime.linkPlotThreadSource(value),
      listPlotThreadSources: (value) =>
        localRuntime.listPlotThreadSources(value),
      createForeshadowLine: (value) =>
        localRuntime.createForeshadowLine(value),
      listForeshadowLines: (value) =>
        localRuntime.listForeshadowLines(value),
      updateForeshadowLine: (value) =>
        localRuntime.updateForeshadowLine(value),
      retireForeshadowLine: (value) =>
        localRuntime.retireForeshadowLine(value),
      createForeshadowPoint: (value) =>
        localRuntime.createForeshadowPoint(value),
      listForeshadowPoints: (value) =>
        localRuntime.listForeshadowPoints(value),
      startWritingSession: (value) =>
        localRuntime.startWritingSession(value),
      stopWritingSession: (value) =>
        localRuntime.stopWritingSession(value),
      startFocusCycle: (value) =>
        localRuntime.startFocusCycle(value),
      stopFocusCycle: (value) =>
        localRuntime.stopFocusCycle(value),
      listWorkActivity: (value) =>
        localRuntime.listWorkActivity(value),
      getPomodoro: (value) =>
        localRuntime.getPomodoro(value),
      configureAndStartPomodoro: (value) =>
        localRuntime.configureAndStartPomodoro(value),
      pausePomodoro: (value) =>
        localRuntime.pausePomodoro(value),
      resumePomodoro: (value) =>
        localRuntime.resumePomodoro(value),
      reconcilePomodoro: (value) =>
        localRuntime.reconcilePomodoro(value),
      updatePomodoroNote: (value) =>
        localRuntime.updatePomodoroNote(value),
      stopPomodoro: (value) =>
        localRuntime.stopPomodoro(value),
      prepareWorkRecordsExport: (value) =>
        localRuntime.prepareWorkRecordsExport(value),
      getWorkRecordsGoals: (value) =>
        localRuntime.getWorkRecordsGoals(value),
      saveWorkRecordsGoals: (value) =>
        localRuntime.saveWorkRecordsGoals(value),
      getWorkReadthrough: (value) =>
        localRuntime.getWorkReadthrough(value),
      saveWorkReadthrough: (value) =>
        localRuntime.saveWorkReadthrough(value),
      getContinuousReadingProgress: (value) =>
        localRuntime.getContinuousReadingProgress(value),
      saveContinuousReadingProgress: (value) =>
        localRuntime.saveContinuousReadingProgress(value),
      listWorkSchedule: (value) =>
        localRuntime.listWorkSchedule(value),
      listWorkCalendar: (value) =>
        localRuntime.listWorkCalendar(value),
      getStudioToday: (value) =>
        localRuntime.getStudioToday(value),
      createWorkScheduleItem: (value) =>
        localRuntime.createWorkScheduleItem(value),
      updateWorkScheduleItem: (value) =>
        localRuntime.updateWorkScheduleItem(value),
      retireWorkScheduleItem: (value) =>
        localRuntime.retireWorkScheduleItem(value),
      setWorkScheduleCompletion: (value) =>
        localRuntime.setWorkScheduleCompletion(value),
      getAppSettings: () =>
        localRuntime.getAppSettings(),
      saveAppSettings: (value) =>
        localRuntime.saveAppSettings(value),
      getWorkMusicSettings: (value) =>
        localRuntime.getWorkMusicSettings(value),
      saveWorkMusicSettings: (value) =>
        localRuntime.saveWorkMusicSettings(value),
      getWorkInspirationSettings: (value) =>
        localRuntime.getWorkInspirationSettings(value),
      saveWorkInspirationSettings: (value) =>
        localRuntime.saveWorkInspirationSettings(value),
      getYouTubeMusicConnectionStatus: async () =>
        youtubeMusicConnectionStore.getStatus(),
      saveYouTubeMusicConnection: (value) =>
        youtubeMusicConnectionStore.save(value),
      getWorkQuickMemo: (value) =>
        localRuntime.getWorkQuickMemo(value),
      saveWorkQuickMemo: (value) =>
        localRuntime.saveWorkQuickMemo(value),
      listAssistantConnections: async () =>
        assistantConnectionStore.list(),
      saveAssistantConnection: (value) =>
        assistantConnectionStore.save(value),
      deleteAssistantConnection: (value) =>
        assistantConnectionStore.delete(value),
      listAssistantContextState: (value) =>
        localRuntime.listAssistantContextState(value),
      grantAssistantContextPermission: (value) =>
        localRuntime.grantAssistantContextPermission(value),
      revokeAssistantContextPermission: (value) =>
        localRuntime.revokeAssistantContextPermission(value),
      getAssistantConnectorProfile: () => assistantConnectorProfile,
      getAssistantDestinationProfile: () =>
        localRuntime.getAssistantDestinationProfile(),
      runAssistantVocabularyLookup: (value) =>
        localRuntime.runAssistantVocabularyLookup(value),
      runAssistantVocabularySuggestion: (value) =>
        localRuntime.runAssistantVocabularySuggestion(value),
      runAssistantExternalSettingReview: (value) =>
        localRuntime.runAssistantExternalSettingReview(value),
      runCharacterExtraction: (value) =>
        localRuntime.runCharacterExtraction(value),
      listCharacterExtractionCandidates: (value) =>
        localRuntime.listCharacterExtractionCandidates(value),
      decideCharacterExtractionItem: (value) =>
        localRuntime.decideCharacterExtractionItem(value),
      runCharacterGeneration: (value) =>
        localRuntime.runCharacterGeneration(value),
      listCharacterGenerationCandidates: (value) =>
        localRuntime.listCharacterGenerationCandidates(value),
      decideCharacterGenerationItem: (value) =>
        localRuntime.decideCharacterGenerationItem(value),
      runAssistantNotationReview: (value) =>
        localRuntime.runAssistantNotationReview(value),
      runAssistantSettingReview: (value) =>
        localRuntime.runAssistantSettingReview(value),
      listDocumentRevisions: (value) =>
        localRuntime.listDocumentRevisions(value),
      readDocumentRevision: (value) =>
        localRuntime.readDocumentRevision(value),
      restoreDocumentRevision: (value) =>
        localRuntime.restoreDocumentRevision(value),
      createWorkSnapshot: (value) =>
        localRuntime.createWorkSnapshot(value),
      listWorkSnapshots: (value) =>
        localRuntime.listWorkSnapshots(value),
      compareWorkSnapshot: (value) =>
        localRuntime.compareWorkSnapshot(value),
      getManuscriptPreflightSettings: (value) =>
        localRuntime.getManuscriptPreflightSettings(value),
      saveManuscriptPreflightSettings: (value) =>
        localRuntime.saveManuscriptPreflightSettings(value),
      prepareManuscriptTextExport: (value) =>
        localRuntime.prepareManuscriptTextExport(value),
      getBackupStatus: () =>
        localRuntime.getBackupStatus(),
      createBackupBundle: (bundlePath) =>
        localRuntime.createBackupBundle(bundlePath),
      restoreBackupBundle: (bundlePath, targetPath) =>
        localRuntime.restoreBackupBundle(bundlePath, targetPath),
      close: () => {
        publishingMailScheduleRuntime.close();
        localRuntime.close();
      },
    };
  } else {
    const manuscriptRuntime =
      await createManuscriptRuntimeCoordinator({
        documentProfile,
        journalProfile,
        batchingPolicy,
        recoveryApplyProfile,
        resumeCheckpointProfile,
        ...(crashGate === null
          ? {}
          : {
              onSaveStage: (stage) => {
                const crashStage:
                  Poc2CrashGateStage =
                  stage === "target-validated"
                    ? "save-target-validated"
                    : "before-journal-append";
                return crashGate.reach(crashStage);
              },
              onJournalStage: () =>
                crashGate.reach(
                  "journal-frame-written-before-sync",
                ),
            }),
      });
    let workspaceCatalog =
      projectConfiguredWorkspaceCatalog(documentProfile);
    let configuredWorkFavorites = parseWorkFavoritesProjection({
      schemaVersion: 1,
      workIds: [],
    });
    let configuredWorkCovers = parseWorkCoversProjection({
      schemaVersion: 1,
      covers: [],
    });
    const configuredWorkManuscriptLayouts = new Map<
      string,
      WorkManuscriptLayoutSettingsProjection
    >();
    const configuredWorkActivities = new Map<string, WorkActivityProjection>();
    const readConfiguredWorkActivity = (
      workId: WorkspaceCatalogProjection["activeWorkId"] & string,
    ): WorkActivityProjection =>
      configuredWorkActivities.get(workId) ??
      parseWorkActivityProjection({
        schemaVersion: 1,
        workId,
        activeSessionId: null,
        activeFocusCycleId: null,
        sessions: [],
        focusCycles: [],
      });
    applicationRuntime = {
      manuscript: manuscriptRuntime,
      getWorkManuscriptLayoutSettings: async (value) => {
        const command = parseGetWorkManuscriptLayoutSettingsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return configuredWorkManuscriptLayouts.get(command.workId) ??
          createDefaultWorkManuscriptLayoutSettingsProjection(
            command.workId,
            formattingProfile,
          );
      },
      saveWorkManuscriptLayoutSettings: async (value) => {
        const command = parseSaveWorkManuscriptLayoutSettingsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        const current = configuredWorkManuscriptLayouts.get(command.workId) ??
          createDefaultWorkManuscriptLayoutSettingsProjection(
            command.workId,
            formattingProfile,
          );
        if (current.revision !== command.expectedRevision) {
          throw new Error(
            `Work manuscript layout revision conflict: expected ${command.expectedRevision}, current ${current.revision}`,
          );
        }
        const projection = parseWorkManuscriptLayoutSettingsProjection({
          schemaVersion: 1,
          workId: command.workId,
          revision: current.revision + 1,
          settings: command.settings,
        });
        configuredWorkManuscriptLayouts.set(command.workId, projection);
        return projection;
      },
      getWorkspaceCatalog: () => workspaceCatalog,
      getDocumentCompletion: async (value) => {
        const command = parseGetDocumentCompletionCommand(value);
        const work = workspaceCatalog.works.find(
          (candidate) => candidate.workId === command.workId,
        );
        const document = work?.documents.find(
          (candidate) => candidate.documentId === command.documentId,
        );
        if (document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${command.documentId}`,
          );
        }
        return document.completion;
      },
      completeDocument: async (value) => {
        parseCompleteDocumentCommand(value);
        throw new Error(
          "Document completion is unavailable in a configured manuscript runtime",
        );
      },
      clearDocumentCompletion: async (value) => {
        parseClearDocumentCompletionCommand(value);
        throw new Error(
          "Document completion clearing is unavailable in a configured manuscript runtime",
        );
      },
      getWorkFavorites: () => configuredWorkFavorites,
      setWorkFavorite: async (value) => {
        const command = parseSetWorkFavoriteCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        const nextWorkIds = command.favorite
          ? [...new Set([...configuredWorkFavorites.workIds, command.workId])]
          : configuredWorkFavorites.workIds.filter(
              (workId) => workId !== command.workId,
            );
        configuredWorkFavorites = parseWorkFavoritesProjection({
          schemaVersion: 1,
          workIds: nextWorkIds,
        });
        return configuredWorkFavorites;
      },
      getWorkCovers: () => configuredWorkCovers,
      saveWorkCover: async (value) => {
        const command = parseSaveWorkCoverCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        const cover = parseWorkCoverProjection(command);
        configuredWorkCovers = parseWorkCoversProjection({
          schemaVersion: 1,
          covers: [
            ...configuredWorkCovers.covers.filter(
              (candidate) => candidate.workId !== cover.workId,
            ),
            cover,
          ],
        });
        return cover;
      },
      activateWorkspaceLocation: async (value) => {
        const command = parseActivateWorkspaceLocationCommand(value);
        const work = workspaceCatalog.works.find(
          (candidate) => candidate.workId === command.workId,
        );
        if (work === undefined) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        if (command.documentId === null) {
          throw new Error(
            "Configured manuscript activation requires an explicit Document",
          );
        }
        if (
          !work.documents.some(
            (document) => document.documentId === command.documentId,
          )
        ) {
          throw new Error(
            `Work ${command.workId} does not own Document ${command.documentId}`,
          );
        }
        workspaceCatalog = parseWorkspaceCatalogProjection({
          ...workspaceCatalog,
          activeWorkId: command.workId,
          activeDocumentId: command.documentId,
        });
        return workspaceCatalog;
      },
      createWork: async () => {
        throw new Error(
          "Work creation is unavailable in a configured manuscript runtime",
        );
      },
      createFirstWork: async () => {
        throw new Error(
          "First Work creation is unavailable in a configured manuscript runtime",
        );
      },
      createDocument: async () => {
        throw new Error(
          "Document creation is unavailable in a configured manuscript runtime",
        );
      },
      renameWork: async () => {
        throw new Error(
          "Work rename is unavailable in a configured manuscript runtime",
        );
      },
      renameDocument: async () => {
        throw new Error(
          "Document rename is unavailable in a configured manuscript runtime",
        );
      },
      retireWork: async () => {
        throw new Error(
          "Work retirement is unavailable in a configured manuscript runtime",
        );
      },
      retireDocument: async () => {
        throw new Error(
          "Document retirement is unavailable in a configured manuscript runtime",
        );
      },
      moveDocument: async () => {
        throw new Error(
          "Document ordering is unavailable in a configured manuscript runtime",
        );
      },
      createDocumentFolder: async () => {
        throw new Error(
          "Document folder creation is unavailable in a configured manuscript runtime",
        );
      },
      renameDocumentFolder: async () => {
        throw new Error(
          "Document folder rename is unavailable in a configured manuscript runtime",
        );
      },
      placeDocumentInFolder: async () => {
        throw new Error(
          "Document folder placement is unavailable in a configured manuscript runtime",
        );
      },
      retireDocumentFolder: async () => {
        throw new Error(
          "Document folder retirement is unavailable in a configured manuscript runtime",
        );
      },
      captureWorkspaceResume: async () => {
        throw new Error(
          "Workspace resume capture is unavailable in a configured manuscript runtime",
        );
      },
      createEventBlock: async () => {
        throw new Error(
          "EventBlock creation is unavailable in a configured manuscript runtime",
        );
      },
      createAnchorlessEvent: async () => {
        throw new Error(
          "Anchorless EventBlock creation is unavailable in a configured manuscript runtime",
        );
      },
      moveEventBlock: async () => {
        throw new Error(
          "EventBlock movement is unavailable in a configured manuscript runtime",
        );
      },
      linkEventSource: async () => {
        throw new Error(
          "EventSource linking is unavailable in a configured manuscript runtime",
        );
      },
      replaceEventSource: async () => {
        throw new Error(
          "EventSource replacement is unavailable in a configured manuscript runtime",
        );
      },
      retireEventSource: async () => {
        throw new Error(
          "EventSource retirement is unavailable in a configured manuscript runtime",
        );
      },
      listEventBlocks: async (value) => {
        const command = parseListEventBlocksCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseEventBlockListProjection({
          schemaVersion: 1,
          workId: command.workId,
          eventBlocks: [],
          eventSources: [],
        });
      },
      listEventRail: async (value) => {
        parseListEventRailCommand(value);
        throw new Error(
          "Event rail is unavailable in a configured manuscript runtime",
        );
      },
      createSceneOverride: async () => {
        throw new Error(
          "SceneOverride creation is unavailable in a configured manuscript runtime",
        );
      },
      listSceneOverrides: async (value) => {
        const command = parseListSceneOverridesCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneOverrideListProjection({
          schemaVersion: 1,
          workId: command.workId,
          sceneOverrides: [],
        });
      },
      listSceneProjection: async (value) => {
        parseListSceneProjectionCommand(value);
        throw new Error(
          "Scene projection is unavailable in a configured manuscript runtime",
        );
      },
      updateSceneRuleSet: async (value) => {
        parseUpdateSceneRuleSetCommand(value);
        throw new Error(
          "SceneRuleSet updates are unavailable in a configured manuscript runtime",
        );
      },
      setSceneEventOverride: async (value) => {
        parseSetSceneEventOverrideCommand(value);
        throw new Error(
          "Scene event overrides are unavailable in a configured manuscript runtime",
        );
      },
      runSceneExtraction: async () => {
        throw new Error(
          "Scene extraction is unavailable in a configured manuscript runtime",
        );
      },
      listSceneExtractionCandidates: async (value) => {
        const command = parseListSceneExtractionCandidatesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneExtractionCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      decideSceneExtractionBoundary: async () => {
        throw new Error(
          "Scene extraction decisions are unavailable in a configured manuscript runtime",
        );
      },
      listSceneAnnotations: async (value) => {
        const command = parseListSceneAnnotationsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneAnnotationList({
          schemaVersion: 1,
          workId: command.workId,
          annotations: [],
        });
      },
      decideSceneExtractionAnnotation: async () => {
        throw new Error(
          "Scene extraction annotation decisions are unavailable in a configured manuscript runtime",
        );
      },
      runSceneDraft: async (value) => {
        parseRunSceneDraftCommand(value);
        throw new Error(
          "Scene drafting is unavailable in a configured manuscript runtime",
        );
      },
      listSceneDraftCandidates: async (value) => {
        const command = parseListSceneDraftCandidatesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneDraftCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      updateSceneDraftCandidate: async (value) => {
        parseUpdateSceneDraftCandidateCommand(value);
        throw new Error(
          "Scene draft updates are unavailable in a configured manuscript runtime",
        );
      },
      prepareSceneDraftInsertion: async (value) => {
        parsePrepareSceneDraftInsertionCommand(value);
        throw new Error(
          "Scene draft insertion is unavailable in a configured manuscript runtime",
        );
      },
      completeSceneDraftInsertion: async (value) => {
        parseCompleteSceneDraftInsertionCommand(value);
        throw new Error(
          "Scene draft insertion is unavailable in a configured manuscript runtime",
        );
      },
      searchSceneMusicQueues: async (value) => {
        parseSearchSceneMusicQueuesCommand(value);
        throw new Error(
          "Scene music queue search is unavailable in a configured manuscript runtime",
        );
      },
      listSceneMusicQueueCandidates: async (value) => {
        const command = parseListSceneMusicQueueCandidatesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseSceneMusicQueueCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      selectSceneMusicQueue: async (value) => {
        parseSelectSceneMusicQueueCommand(value);
        throw new Error(
          "Scene music queue selection is unavailable in a configured manuscript runtime",
        );
      },
      captureFragment: async () => {
        throw new Error(
          "Fragment capture is unavailable in a configured manuscript runtime",
        );
      },
      listFragments: async (value) => {
        const command = parseListFragmentsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseFragmentListProjection({
          schemaVersion: 1,
          workId: command.workId,
          fragments: [],
        });
      },
      updateFragment: async () => {
        throw new Error(
          "Fragment update is unavailable in a configured manuscript runtime",
        );
      },
      recordFragmentUse: async () => {
        throw new Error(
          "Fragment use recording is unavailable in a configured manuscript runtime",
        );
      },
      retireFragment: async () => {
        throw new Error(
          "Fragment retirement is unavailable in a configured manuscript runtime",
        );
      },
      createCharacter: async () => {
        throw new Error(
          "Character creation is unavailable in a configured manuscript runtime",
        );
      },
      listCharacters: async (value) => {
        const command = parseListCharactersCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseCharacterListProjection({
          schemaVersion: 1,
          workId: command.workId,
          characters: [],
        });
      },
      updateCharacter: async () => {
        throw new Error(
          "Character update is unavailable in a configured manuscript runtime",
        );
      },
      addCharacterEvidence: async () => {
        throw new Error(
          "Character evidence is unavailable in a configured manuscript runtime",
        );
      },
      retireCharacter: async () => {
        throw new Error(
          "Character retirement is unavailable in a configured manuscript runtime",
        );
      },
      createCharacterRelation: async () => {
        throw new Error(
          "Character relation creation is unavailable in a configured manuscript runtime",
        );
      },
      listCharacterRelations: async (value) => {
        const command = parseListCharacterRelationsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseCharacterRelationListProjection({
          schemaVersion: 1,
          workId: command.workId,
          relations: [],
        });
      },
      updateCharacterRelation: async () => {
        throw new Error(
          "Character relation update is unavailable in a configured manuscript runtime",
        );
      },
      retireCharacterRelation: async () => {
        throw new Error(
          "Character relation retirement is unavailable in a configured manuscript runtime",
        );
      },
      createLoreEntry: async () => {
        throw new Error(
          "Lore entry creation is unavailable in a configured manuscript runtime",
        );
      },
      listLoreEntries: async (value) => {
        const command = parseListLoreEntriesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseLoreEntryListProjection({
          schemaVersion: 1,
          workId: command.workId,
          entries: [],
        });
      },
      updateLoreEntry: async () => {
        throw new Error(
          "Lore entry update is unavailable in a configured manuscript runtime",
        );
      },
      addLoreEntryEvidence: async () => {
        throw new Error(
          "Lore entry evidence is unavailable in a configured manuscript runtime",
        );
      },
      retireLoreEntry: async () => {
        throw new Error(
          "Lore entry retirement is unavailable in a configured manuscript runtime",
        );
      },
      createLoreCandidate: async (value) => {
        parseCreateLoreCandidateCommand(value);
        throw new Error(
          "Lore candidate creation is unavailable in a configured manuscript runtime",
        );
      },
      listLoreCandidates: async (value) => {
        const command = parseListLoreCandidatesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseLoreCandidateListProjection({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      approveLoreCandidate: async (value) => {
        parseReviewLoreCandidateCommand(value);
        throw new Error(
          "Lore candidate approval is unavailable in a configured manuscript runtime",
        );
      },
      rejectLoreCandidate: async (value) => {
        parseReviewLoreCandidateCommand(value);
        throw new Error(
          "Lore candidate rejection is unavailable in a configured manuscript runtime",
        );
      },
      linkLoreForeshadow: async () => {
        throw new Error(
          "Lore/foreshadow linking is unavailable in a configured manuscript runtime",
        );
      },
      listLoreForeshadowLinks: async (value) => {
        const command = parseListLoreForeshadowLinksCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseLoreForeshadowLinkListProjection({
          schemaVersion: 1,
          workId: command.workId,
          links: [],
        });
      },
      unlinkLoreForeshadow: async () => {
        throw new Error(
          "Lore/foreshadow unlinking is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingPartner: async () => {
        throw new Error(
          "Publishing partner creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingPartners: async (value) => {
        parseListPublishingPartnersCommand(value);
        return parsePublishingPartnerListProjection({
          schemaVersion: 1,
          partners: [],
        });
      },
      updatePublishingPartner: async () => {
        throw new Error(
          "Publishing partner update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingSubmission: async () => {
        throw new Error(
          "Publishing submission creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingSubmissions: async (value) => {
        parseListPublishingSubmissionsCommand(value);
        return parsePublishingSubmissionListProjection({
          schemaVersion: 1,
          submissions: [],
        });
      },
      updatePublishingSubmission: async () => {
        throw new Error(
          "Publishing submission update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingContract: async () => {
        throw new Error(
          "Publishing contract creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingContracts: async (value) => {
        parseListPublishingContractsCommand(value);
        return parsePublishingContractListProjection({
          schemaVersion: 1,
          contracts: [],
        });
      },
      updatePublishingContract: async () => {
        throw new Error(
          "Publishing contract update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingPublication: async () => {
        throw new Error(
          "Publishing publication creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingPublications: async (value) => {
        parseListPublishingPublicationsCommand(value);
        return parsePublishingPublicationListProjection({
          schemaVersion: 1,
          publications: [],
        });
      },
      updatePublishingPublication: async () => {
        throw new Error(
          "Publishing publication update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingSettlement: async () => {
        throw new Error(
          "Publishing settlement creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingSettlements: async (value) => {
        parseListPublishingSettlementsCommand(value);
        return parsePublishingSettlementListProjection({
          schemaVersion: 1,
          settlements: [],
        });
      },
      updatePublishingSettlement: async () => {
        throw new Error(
          "Publishing settlement update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingPayment: async () => {
        throw new Error(
          "Publishing payment creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingPayments: async (value) => {
        parseListPublishingPaymentsCommand(value);
        return parsePublishingPaymentListProjection({
          schemaVersion: 1,
          payments: [],
        });
      },
      updatePublishingPayment: async () => {
        throw new Error(
          "Publishing payment update is unavailable in a configured manuscript runtime",
        );
      },
      createPublishingSource: async () => {
        throw new Error(
          "Publishing source creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingSources: async (value) => {
        parseListPublishingSourcesCommand(value);
        return parsePublishingSourceListProjection({
          schemaVersion: 1,
          sources: [],
        });
      },
      previewPublishingResearch: async (value) => {
        parsePreviewPublishingResearchCommand(value);
        throw new Error(
          "Publishing research preview is unavailable in a configured manuscript runtime",
        );
      },
      approvePublishingResearch: async (value) => {
        parseApprovePublishingResearchCommand(value);
        throw new Error(
          "Publishing research approval is unavailable in a configured manuscript runtime",
        );
      },
      runPublishingAssistant: async (value) => {
        parseRunPublishingAssistantCommand(value);
        throw new Error(
          "Publishing assistant is unavailable in a configured manuscript runtime",
        );
      },
      approvePublishingAssistantCandidate: async (value) => {
        parseApprovePublishingAssistantCandidateCommand(value);
        throw new Error(
          "Publishing assistant approval is unavailable in a configured manuscript runtime",
        );
      },
      setPublishingEvidenceLinks: async (value) => {
        parseSetPublishingEvidenceLinksCommand(value);
        throw new Error(
          "Publishing evidence linking is unavailable in a configured manuscript runtime",
        );
      },
      applyPublishingPartnerCsvImport: async (value) => {
        parseApplyPublishingPartnerCsvImportCommand(value);
        throw new Error(
          "Publishing partner CSV import is unavailable in a configured manuscript runtime",
        );
      },
      applyPublishingSubmissionCsvImport: async (value) => {
        parseApplyPublishingSubmissionCsvImportCommand(value);
        throw new Error(
          "Publishing submission CSV import is unavailable in a configured manuscript runtime",
        );
      },
      recordPublishingMailCandidate: async (value) => {
        parseRecordPublishingMailCandidateCommand(value);
        throw new Error(
          "Publishing mail candidate recording is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingMailCandidates: async (value) => {
        parseListPublishingMailCandidatesCommand(value);
        return parsePublishingMailCandidateListProjection({
          schemaVersion: 1,
          candidates: [],
        });
      },
      linkPublishingMailCandidate: async (value) => {
        parseLinkPublishingMailCandidateCommand(value);
        throw new Error(
          "Publishing mail candidate linking is unavailable in a configured manuscript runtime",
        );
      },
      updatePublishingMailCandidate: async (value) => {
        parseUpdatePublishingMailCandidateCommand(value);
        throw new Error(
          "Publishing mail candidate update is unavailable in a configured manuscript runtime",
        );
      },
      reviewPublishingMailCandidate: async (value) => {
        parseReviewPublishingMailCandidateCommand(value);
        throw new Error(
          "Publishing mail candidate review is unavailable in a configured manuscript runtime",
        );
      },
      getPublishingMailConnection: async (value) => {
        parseGetPublishingMailConnectionCommand(value);
        return parsePublishingMailConnectionProjection({
          schemaVersion: 1,
          connectors: publishingMailConnectorProfile.connectors.map(
            ({ connectorKind, displayName }) => ({ connectorKind, displayName }),
          ),
          state: "disconnected",
          activeConnectorKind: null,
          accountLabel: "",
          clientId: "",
          scopes: [],
          lastSyncedAt: null,
        });
      },
      connectPublishingMail: async (value) => {
        parseConnectPublishingMailCommand(value);
        throw new Error(
          "Publishing mail connection is unavailable in a configured manuscript runtime",
        );
      },
      syncPublishingMail: async (value) => {
        parseSyncPublishingMailCommand(value);
        throw new Error(
          "Publishing mail sync is unavailable in a configured manuscript runtime",
        );
      },
      disconnectPublishingMail: async (value) => {
        parseDisconnectPublishingMailCommand(value);
        throw new Error(
          "Publishing mail disconnection is unavailable in a configured manuscript runtime",
        );
      },
      getPublishingMailSchedule: async (value) => {
        parseGetPublishingMailScheduleCommand(value);
        return parsePublishingMailScheduleProjection({
          schemaVersion: 1,
          enabled: false,
          localTime: null,
          lastAttemptedAt: null,
          lastSuccessfulAt: null,
          lastAttemptStatus: null,
        });
      },
      savePublishingMailSchedule: async (value) => {
        parseSavePublishingMailScheduleCommand(value);
        throw new Error(
          "Publishing mail schedule is unavailable in a configured manuscript runtime",
        );
      },
      createPlotThread: async () => {
        throw new Error(
          "Plot creation is unavailable in a configured manuscript runtime",
        );
      },
      listPlotThreads: async (value) => {
        const command = parseListPlotThreadsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parsePlotThreadListProjection({
          schemaVersion: 1,
          workId: command.workId,
          plots: [],
        });
      },
      getDefaultPlotBoard: async (value) => {
        parseGetDefaultPlotBoardCommand(value);
        throw new Error(
          "Plot boards are unavailable in a configured manuscript runtime",
        );
      },
      movePlotPlacement: async (value) => {
        parseMovePlotPlacementCommand(value);
        throw new Error(
          "Plot placement moves are unavailable in a configured manuscript runtime",
        );
      },
      setPlotPlacementStoryTime: async (value) => {
        parseSetPlotPlacementStoryTimeCommand(value);
        throw new Error(
          "Plot placement story time is unavailable in a configured manuscript runtime",
        );
      },
      updatePlotThread: async () => {
        throw new Error(
          "Plot update is unavailable in a configured manuscript runtime",
        );
      },
      retirePlotThread: async () => {
        throw new Error(
          "Plot retirement is unavailable in a configured manuscript runtime",
        );
      },
      createPlotFromEvent: async () => {
        throw new Error(
          "Plot creation from an event is unavailable in a configured manuscript runtime",
        );
      },
      createEventFromPlot: async () => {
        throw new Error(
          "Event creation from a plot is unavailable in a configured manuscript runtime",
        );
      },
      linkPlotEvent: async () => {
        throw new Error(
          "Plot/event linking is unavailable in a configured manuscript runtime",
        );
      },
      unlinkPlotEvent: async () => {
        throw new Error(
          "Plot/event unlinking is unavailable in a configured manuscript runtime",
        );
      },
      listPlotEventLinks: async (value) => {
        const command = parseListPlotEventLinksCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parsePlotEventLinkListProjection({
          schemaVersion: 1,
          workId: command.workId,
          links: [],
        });
      },
      linkPlotThreadSource: async () => {
        throw new Error(
          "Plot source linking is unavailable in a configured manuscript runtime",
        );
      },
      listPlotThreadSources: async (value) => {
        const command = parseListPlotThreadSourcesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parsePlotThreadSourceListProjection({
          schemaVersion: 1,
          workId: command.workId,
          sources: [],
        });
      },
      createForeshadowLine: async () => {
        throw new Error(
          "Foreshadow line creation is unavailable in a configured manuscript runtime",
        );
      },
      listForeshadowLines: async (value) => {
        const command = parseListForeshadowLinesCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseForeshadowLineListProjection({
          schemaVersion: 1,
          workId: command.workId,
          lines: [],
        });
      },
      updateForeshadowLine: async () => {
        throw new Error(
          "Foreshadow line update is unavailable in a configured manuscript runtime",
        );
      },
      retireForeshadowLine: async () => {
        throw new Error(
          "Foreshadow line retirement is unavailable in a configured manuscript runtime",
        );
      },
      createForeshadowPoint: async () => {
        throw new Error(
          "Foreshadow point creation is unavailable in a configured manuscript runtime",
        );
      },
      listForeshadowPoints: async (value) => {
        const command = parseListForeshadowPointsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseForeshadowPointListProjection({
          schemaVersion: 1,
          workId: command.workId,
          points: [],
        });
      },
      startWritingSession: async (value) => {
        const command = parseStartWritingSessionCommand(value);
        const work = workspaceCatalog.works.find(
          (candidate) => candidate.workId === command.workId,
        );
        const document = work?.documents.find(
          (candidate) => candidate.documentId === command.documentId,
        );
        if (work === undefined || document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${command.documentId}`,
          );
        }
        const current = readConfiguredWorkActivity(command.workId);
        if (current.activeSessionId !== null) {
          throw new Error(`Work already has an active WritingSession: ${command.workId}`);
        }
        const startedAt = new Date().toISOString();
        const sessionId = randomUUID();
        const projection = parseWorkActivityProjection({
          ...current,
          activeSessionId: sessionId,
          sessions: [
            ...current.sessions,
            {
              schemaVersion: 1,
              sessionId,
              workId: command.workId,
              documentId: command.documentId,
              state: "active",
              startedAt,
              endedAt: null,
              activeDurationMs: 0,
              startRevisionId: document.currentRevisionId,
              endRevisionId: null,
              characterDelta: null,
              note: command.note,
            },
          ],
        });
        configuredWorkActivities.set(command.workId, projection);
        return projection;
      },
      stopWritingSession: async (value) => {
        const command = parseStopWritingSessionCommand(value);
        const current = readConfiguredWorkActivity(command.workId);
        const session = current.sessions.find(
          (candidate) => candidate.sessionId === command.sessionId,
        );
        if (session === undefined || session.state !== "active") {
          throw new Error(`WritingSession is not active: ${command.sessionId}`);
        }
        const work = workspaceCatalog.works.find(
          (candidate) => candidate.workId === command.workId,
        );
        const document = work?.documents.find(
          (candidate) => candidate.documentId === session.documentId,
        );
        if (document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${session.documentId}`,
          );
        }
        const endedAt = new Date().toISOString();
        const projection = parseWorkActivityProjection({
          ...current,
          activeSessionId: null,
          sessions: current.sessions.map((candidate) =>
            candidate.sessionId === command.sessionId
              ? {
                  ...candidate,
                  state: "completed",
                  endedAt,
                  activeDurationMs: Math.max(
                    0,
                    Date.parse(endedAt) - Date.parse(candidate.startedAt),
                  ),
                  endRevisionId: document.currentRevisionId,
                }
              : candidate
          ),
        });
        configuredWorkActivities.set(command.workId, projection);
        return projection;
      },
      startFocusCycle: async () => {
        throw new Error(
          "FocusCycle is unavailable in a configured manuscript runtime",
        );
      },
      stopFocusCycle: async () => {
        throw new Error(
          "FocusCycle is unavailable in a configured manuscript runtime",
        );
      },
      listWorkActivity: async (value) => {
        const command = parseListWorkActivityCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return readConfiguredWorkActivity(command.workId);
      },
      getPomodoro: async (value) => {
        const command = parseGetPomodoroCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parsePomodoroProjection({
          schemaVersion: 1,
          workId: command.workId,
          settings: null,
          status: "unconfigured",
          completedWorkCycles: 0,
          activePhase: null,
        });
      },
      configureAndStartPomodoro: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      pausePomodoro: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      resumePomodoro: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      reconcilePomodoro: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      updatePomodoroNote: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      stopPomodoro: async () => {
        throw new Error("Pomodoro is unavailable in a configured manuscript runtime");
      },
      prepareWorkRecordsExport: async (value) => {
        const command = parseExportWorkRecordsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        throw new Error(
          "Work records export is unavailable in a configured manuscript runtime",
        );
      },
      getWorkRecordsGoals: async (value) => {
        const command = parseGetWorkRecordsGoalsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return {
          schemaVersion: 1,
          workId: command.workId,
          revision: 0,
          goals: createUnsetWorkRecordsGoals(),
        };
      },
      saveWorkRecordsGoals: async () => {
        throw new Error(
          "Work records goal persistence is unavailable in a configured manuscript runtime",
        );
      },
      getWorkReadthrough: async (value) => {
        const command = parseGetWorkReadthroughCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return {
          schemaVersion: 1,
          workId: command.workId,
          revision: 0,
          entries: createUnsetWorkReadthrough(),
        };
      },
      saveWorkReadthrough: async () => {
        throw new Error(
          "Work readthrough persistence is unavailable in a configured manuscript runtime",
        );
      },
      getContinuousReadingProgress: async (value) => {
        const command = parseGetContinuousReadingProgressCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return {
          schemaVersion: 1,
          workId: command.workId,
          revision: 0,
          location: createUnsetContinuousReadingProgress(),
        };
      },
      saveContinuousReadingProgress: async () => {
        throw new Error(
          "Continuous reading progress persistence is unavailable in a configured manuscript runtime",
        );
      },
      listWorkSchedule: async (value) => {
        const command = parseListWorkScheduleCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseWorkScheduleProjection({
          schemaVersion: 1,
          workId: command.workId,
          range: command.range,
          items: [],
          occurrences: [],
          episodeProgress: deriveWorkEpisodeCharacterProgress({
            workId: command.workId,
            defaultEpisodeCharacters:
              appSettingsProfile.defaultEpisodeCharacters.defaultValue,
            documents: documentProfile.documents
              .filter((document) => document.workId === command.workId)
              .map((document) => ({
                workId: document.workId,
                documentId: document.documentId,
                text: document.initialText,
              })),
          }),
        });
      },
      listWorkCalendar: async (value) => {
        const command = parseListWorkScheduleCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseWorkCalendarProjection({
          schemaVersion: 1,
          workId: command.workId,
          range: command.range,
          items: [],
          occurrences: [],
          completedDocumentCount: 0,
          episodeProgress: deriveWorkEpisodeCharacterProgress({
            workId: command.workId,
            defaultEpisodeCharacters:
              appSettingsProfile.defaultEpisodeCharacters.defaultValue,
            documents: documentProfile.documents
              .filter((document) => document.workId === command.workId)
              .map((document) => ({
                workId: document.workId,
                documentId: document.documentId,
                text: document.initialText,
              })),
          }),
        });
      },
      getStudioToday: async (value) => {
        const command = parseGetStudioTodayCommand(value);
        return projectStudioToday({
          date: command.date,
          works: workspaceCatalog.works.map((work) => ({
            workId: work.workId,
            workTitle: work.title,
            calendar: parseWorkCalendarProjection({
              schemaVersion: 1,
              workId: work.workId,
              range: { from: command.date, to: command.date },
              items: [],
              occurrences: [],
              completedDocumentCount: 0,
              episodeProgress: deriveWorkEpisodeCharacterProgress({
                workId: work.workId,
                defaultEpisodeCharacters:
                  appSettingsProfile.defaultEpisodeCharacters.defaultValue,
                documents: documentProfile.documents
                  .filter((document) => document.workId === work.workId)
                  .map((document) => ({
                    workId: document.workId,
                    documentId: document.documentId,
                    text: document.initialText,
                  })),
              }),
            }),
          })),
        });
      },
      createWorkScheduleItem: async () => {
        throw new Error(
          "Work schedule persistence is unavailable in a configured manuscript runtime",
        );
      },
      updateWorkScheduleItem: async () => {
        throw new Error(
          "Work schedule persistence is unavailable in a configured manuscript runtime",
        );
      },
      retireWorkScheduleItem: async () => {
        throw new Error(
          "Work schedule persistence is unavailable in a configured manuscript runtime",
        );
      },
      setWorkScheduleCompletion: async () => {
        throw new Error(
          "Work schedule persistence is unavailable in a configured manuscript runtime",
        );
      },
      getAppSettings: async () =>
        createDefaultAppSettingsProjection(appSettingsProfile),
      saveAppSettings: async () => {
        throw new Error(
          "App settings persistence is unavailable in a configured manuscript runtime",
        );
      },
      getWorkMusicSettings: async (value) => {
        const command = parseGetWorkMusicSettingsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return createDefaultWorkMusicSettingsProjection(
          command.workId,
          musicSettingsProfile,
        );
      },
      saveWorkMusicSettings: async () => {
        throw new Error(
          "Work music settings persistence is unavailable in a configured manuscript runtime",
        );
      },
      getWorkInspirationSettings: async (value) => {
        const command = parseGetWorkInspirationSettingsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return createDefaultWorkInspirationSettingsProjection(command.workId);
      },
      saveWorkInspirationSettings: async () => {
        throw new Error(
          "Work inspiration settings persistence is unavailable in a configured manuscript runtime",
        );
      },
      getYouTubeMusicConnectionStatus: async () =>
        youtubeMusicConnectionStore.getStatus(),
      saveYouTubeMusicConnection: (value) =>
        youtubeMusicConnectionStore.save(value),
      getWorkQuickMemo: async (value) => {
        const command = parseGetWorkQuickMemoCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return {
          schemaVersion: 1,
          workId: command.workId,
          revision: 0,
          text: "",
          updatedAt: null,
        };
      },
      saveWorkQuickMemo: async () => {
        throw new Error(
          "Work quick memo persistence is unavailable in a configured manuscript runtime",
        );
      },
      listAssistantConnections: async () => ({
        schemaVersion: 1,
        connections: [],
      }),
      saveAssistantConnection: async () => {
        throw new Error(
          "Assistant connection persistence is unavailable in a configured manuscript runtime",
        );
      },
      deleteAssistantConnection: async () => {
        throw new Error(
          "Assistant connection persistence is unavailable in a configured manuscript runtime",
        );
      },
      listAssistantContextState: async () => {
        throw new Error(
          "Assistant context state is unavailable in a configured manuscript runtime",
        );
      },
      grantAssistantContextPermission: async () => {
        throw new Error(
          "Assistant context permission persistence is unavailable in a configured manuscript runtime",
        );
      },
      revokeAssistantContextPermission: async () => {
        throw new Error(
          "Assistant context permission persistence is unavailable in a configured manuscript runtime",
        );
      },
      getAssistantConnectorProfile: () => assistantConnectorProfile,
      getAssistantDestinationProfile: () => assistantDestinationProfile,
      runAssistantVocabularyLookup: async () => {
        throw new Error(
          "Assistant vocabulary lookup is unavailable in a configured manuscript runtime",
        );
      },
      runAssistantVocabularySuggestion: async () => {
        throw new Error(
          "Assistant vocabulary suggestion is unavailable in a configured manuscript runtime",
        );
      },
      runAssistantExternalSettingReview: async () => {
        throw new Error(
          "Assistant external setting review is unavailable in a configured manuscript runtime",
        );
      },
      runCharacterExtraction: async () => {
        throw new Error(
          "Character extraction is unavailable in a configured manuscript runtime",
        );
      },
      listCharacterExtractionCandidates: async (value) => {
        const command = parseListCharacterExtractionCandidatesCommand(value);
        return parseCharacterExtractionCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      decideCharacterExtractionItem: async () => {
        throw new Error(
          "Character extraction decisions are unavailable in a configured manuscript runtime",
        );
      },
      runCharacterGeneration: async () => {
        throw new Error(
          "Character generation is unavailable in a configured manuscript runtime",
        );
      },
      listCharacterGenerationCandidates: async (value) => {
        const command = parseListCharacterGenerationCandidatesCommand(value);
        return parseCharacterGenerationCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      decideCharacterGenerationItem: async () => {
        throw new Error(
          "Character generation decisions are unavailable in a configured manuscript runtime",
        );
      },
      runAssistantNotationReview: async () => {
        throw new Error(
          "Assistant notation review is unavailable in a configured manuscript runtime",
        );
      },
      runAssistantSettingReview: async () => {
        throw new Error(
          "Assistant setting review is unavailable in a configured manuscript runtime",
        );
      },
      listDocumentRevisions: async (value) => {
        const command = parseListDocumentRevisionsCommand(value);
        const document = workspaceCatalog.works
          .find((work) => work.workId === command.workId)
          ?.documents.find(
            (candidate) => candidate.documentId === command.documentId,
          );
        if (document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${command.documentId}`,
          );
        }
        return parseDocumentRevisionListProjection({
          schemaVersion: 1,
          workId: command.workId,
          documentId: command.documentId,
          revisions: [],
        });
        },
      readDocumentRevision: async (value) => {
        parseReadDocumentRevisionCommand(value);
        throw new Error(
          "Document revision content is unavailable in a configured manuscript runtime",
        );
      },
      restoreDocumentRevision: async () => {
        throw new Error(
          "Document revision restore is unavailable in a configured manuscript runtime",
        );
      },
      createWorkSnapshot: async () => {
        throw new Error(
          "WorkSnapshot creation is unavailable in a configured manuscript runtime",
        );
      },
      listWorkSnapshots: async (value) => {
        const command = parseListWorkSnapshotsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseWorkSnapshotListProjection({
          schemaVersion: 1,
          workId: command.workId,
          snapshots: [],
        });
      },
      compareWorkSnapshot: async (value) => {
        const command = parseCompareWorkSnapshotCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        throw new Error(
          "WorkSnapshot comparison is unavailable in a configured manuscript runtime",
        );
      },
      getManuscriptPreflightSettings: async (value) => {
        const command = parseGetManuscriptPreflightSettingsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return {
          schemaVersion: 1,
          workId: command.workId,
          revision: 0,
          settings: createDefaultManuscriptPreflightSettings(
            preflightProfile,
          ),
        };
      },
      saveManuscriptPreflightSettings: async () => {
        throw new Error(
          "Manuscript preflight settings persistence is unavailable in a configured manuscript runtime",
        );
      },
      prepareManuscriptTextExport: async (value) => {
        const command = parseExportManuscriptTextCommand(value);
        const document = workspaceCatalog.works
          .find((work) => work.workId === command.workId)
          ?.documents.find(
            (candidate) => candidate.documentId === command.documentId,
          );
        if (document === undefined) {
          throw new Error(
            `Work/document boundary violation: ${command.workId}/${command.documentId}`,
          );
        }
        return command;
      },
      getBackupStatus: async () => ({
        schemaVersion: 1,
        lastVerified: null,
      }),
      createBackupBundle: async () => {
        throw new Error(
          "Backup creation is unavailable in a configured manuscript runtime",
        );
      },
      restoreBackupBundle: async () => {
        throw new Error(
          "Backup restore is unavailable in a configured manuscript runtime",
        );
      },
      close: () => undefined,
    };
  }
  activeApplicationRuntime = applicationRuntime;
  const manuscriptRuntime = applicationRuntime.manuscript;

  ipcMain.handle(RUNTIME_INFO_CHANNEL, (): RuntimeInfo => {
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
    };
  });
  ipcMain.handle(MANUSCRIPT_INPUT_PROFILE_CHANNEL, () => {
    return manuscriptInputProfile;
  });
  ipcMain.handle(MANUSCRIPT_FORMATTING_PROFILE_CHANNEL, () => {
    return formattingProfile;
  });
  ipcMain.handle(MANUSCRIPT_PREFLIGHT_PROFILE_CHANNEL, () => {
    return preflightProfile;
  });
  ipcMain.handle(FRAGMENT_PROFILE_CHANNEL, () => fragmentProfile);
  ipcMain.handle(
    FORESHADOW_POINT_PROFILE_CHANNEL,
    () => foreshadowPointProfile,
  );
  ipcMain.handle(
    MANUSCRIPT_PREFLIGHT_GET_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getManuscriptPreflightSettings(
        parseGetManuscriptPreflightSettingsCommand(value),
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_PREFLIGHT_SAVE_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveManuscriptPreflightSettings(
        parseSaveManuscriptPreflightSettingsCommand(
          value,
          preflightProfile,
        ),
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_EXPORT_TEXT_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const command = await applicationRuntime.prepareManuscriptTextExport(
        parseExportManuscriptTextCommand(value),
      );
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selected = await dialog.showSaveDialog(owner, {
        title: "원고 TXT 내보내기",
        buttonLabel: "내보내기",
        defaultPath: command.suggestedFileName,
        filters: [
          {
            name: "텍스트 문서",
            extensions: ["txt"],
          },
        ],
      });
      if (selected.canceled || selected.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const receipt = await exportNodeManuscriptText({
        finalPath: selected.filePath,
        text: command.text,
      });
      return {
        schemaVersion: 1,
        status: "completed",
        byteLength: receipt.byteLength,
      } as const;
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SELECT_TEXT_IMPORT_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const command = parseSelectManuscriptTextImportCommand(value);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const configuredFilePath =
        process.env.EUM_STUDIO_MANUSCRIPT_TEXT_IMPORT_PATH;
      const filePath = configuredFilePath === undefined
        ? (await dialog.showOpenDialog(owner, {
            title: "원고 TXT 가져오기",
            buttonLabel: "가져오기",
            properties: ["openFile"],
            filters: [
              {
                name: "텍스트 문서",
                extensions: ["txt"],
              },
            ],
          })).filePaths[0]
        : configuredFilePath;
      if (filePath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const content = readFileSync(filePath);
      return {
        schemaVersion: 1,
        status: "selected",
        workId: command.workId,
        documentId: command.documentId,
        documentRevisionId: command.documentRevisionId,
        fileName: path.basename(filePath),
        text: normalizeImportedManuscriptText(content.toString("utf8")),
        byteLength: content.byteLength,
      } as const;
    },
  );
  ipcMain.handle(WORKSPACE_CATALOG_CHANNEL, () => {
    return applicationRuntime.getWorkspaceCatalog();
  });
  ipcMain.handle(
    WORKSPACE_GET_DOCUMENT_COMPLETION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getDocumentCompletion(
        parseGetDocumentCompletionCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_COMPLETE_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.completeDocument(
        parseCompleteDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CLEAR_DOCUMENT_COMPLETION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.clearDocumentCompletion(
        parseClearDocumentCompletionCommand(value),
      );
    },
  );
  ipcMain.handle(WORKSPACE_FAVORITES_CHANNEL, () => {
    return applicationRuntime.getWorkFavorites();
  });
  ipcMain.handle(
    WORKSPACE_SET_FAVORITE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.setWorkFavorite(
        parseSetWorkFavoriteCommand(value),
      );
    },
  );
  ipcMain.handle(WORKSPACE_COVERS_CHANNEL, () => {
    return applicationRuntime.getWorkCovers();
  });
  ipcMain.handle(
    WORKSPACE_SELECT_COVER_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const command = parseSelectWorkCoverCommand(value);
      const owner = mainWindow;
      if (owner === null) throw new Error("Main window is unavailable");
      const selected = await dialog.showOpenDialog(owner, {
        title: "작품 표지 선택",
        buttonLabel: "표지 선택",
        properties: ["openFile"],
        filters: [
          {
            name: "이미지",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"],
          },
        ],
      });
      const filePath = selected.filePaths[0];
      if (selected.canceled || filePath === undefined) return null;
      return applicationRuntime.saveWorkCover({
        schemaVersion: 1,
        workId: command.workId,
        mediaType: mediaTypeForWorkCover(filePath),
        contentBase64: readFileSync(filePath).toString("base64"),
      });
    },
  );
  ipcMain.handle(
    WORKSPACE_ACTIVATE_LOCATION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.activateWorkspaceLocation(
        parseActivateWorkspaceLocationCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createWork(
        parseCreateWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_FIRST_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createFirstWork(
        parseCreateFirstWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createDocument(
        parseCreateDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RENAME_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.renameWork(
        parseRenameWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RENAME_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.renameDocument(
        parseRenameDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RETIRE_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireWork(
        parseRetireWorkCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RETIRE_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireDocument(
        parseRetireDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_MOVE_DOCUMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.moveDocument(
        parseMoveDocumentCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CREATE_DOCUMENT_FOLDER_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createDocumentFolder(
        parseCreateDocumentFolderCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RENAME_DOCUMENT_FOLDER_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.renameDocumentFolder(
        parseRenameDocumentFolderCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_PLACE_DOCUMENT_IN_FOLDER_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.placeDocumentInFolder(
        parsePlaceDocumentInFolderCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_RETIRE_DOCUMENT_FOLDER_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireDocumentFolder(
        parseRetireDocumentFolderCommand(value),
      );
    },
  );
  ipcMain.handle(
    WORKSPACE_CAPTURE_RESUME_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.captureWorkspaceResume(
        parseCaptureWorkspaceResumeCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_CREATE_EVENT_BLOCK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createEventBlock(
        parseCreateEventBlockCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_CREATE_ANCHORLESS_EVENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createAnchorlessEvent(
        parseCreateAnchorlessEventCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_MOVE_EVENT_BLOCK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.moveEventBlock(
        parseMoveEventBlockCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LINK_EVENT_SOURCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.linkEventSource(
        parseLinkEventSourceCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_REPLACE_EVENT_SOURCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.replaceEventSource(
        parseReplaceEventSourceCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_RETIRE_EVENT_SOURCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireEventSource(
        parseRetireEventSourceCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_EVENT_BLOCKS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listEventBlocks(
        parseListEventBlocksCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_EVENT_RAIL_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listEventRail(
        parseListEventRailCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_CREATE_SCENE_OVERRIDE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createSceneOverride(
        parseCreateSceneOverrideCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_OVERRIDES_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneOverrides(
        parseListSceneOverridesCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_PROJECTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneProjection(
        parseListSceneProjectionCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_UPDATE_SCENE_RULE_SET_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateSceneRuleSet(
        parseUpdateSceneRuleSetCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_SET_SCENE_EVENT_OVERRIDE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.setSceneEventOverride(
        parseSetSceneEventOverrideCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_RUN_SCENE_EXTRACTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runSceneExtraction(
        parseRunSceneExtractionCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_EXTRACTION_CANDIDATES_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneExtractionCandidates(
        parseListSceneExtractionCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_DECIDE_SCENE_EXTRACTION_BOUNDARY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.decideSceneExtractionBoundary(
        parseDecideSceneExtractionBoundaryCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_ANNOTATIONS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneAnnotations(
        parseListSceneAnnotationsCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_DECIDE_SCENE_EXTRACTION_ANNOTATION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.decideSceneExtractionAnnotation(
        parseDecideSceneExtractionAnnotationCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_RUN_SCENE_DRAFT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runSceneDraft(parseRunSceneDraftCommand(value));
    },
  );
  ipcMain.handle(
    STRUCTURE_LIST_SCENE_DRAFT_CANDIDATES_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneDraftCandidates(
        parseListSceneDraftCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_UPDATE_SCENE_DRAFT_CANDIDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateSceneDraftCandidate(
        parseUpdateSceneDraftCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_PREPARE_SCENE_DRAFT_INSERTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.prepareSceneDraftInsertion(
        parsePrepareSceneDraftInsertionCommand(value),
      );
    },
  );
  ipcMain.handle(
    STRUCTURE_COMPLETE_SCENE_DRAFT_INSERTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.completeSceneDraftInsertion(
        parseCompleteSceneDraftInsertionCommand(value),
      );
    },
  );
  ipcMain.handle(
    FRAGMENT_CAPTURE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.captureFragment(
        parseCaptureFragmentCommand(value),
      );
    },
  );
  ipcMain.handle(
    FRAGMENT_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listFragments(
        parseListFragmentsCommand(value),
      );
    },
  );
  ipcMain.handle(
    FRAGMENT_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateFragment(
        parseUpdateFragmentCommand(value),
      );
    },
  );
  ipcMain.handle(
    FRAGMENT_RECORD_USE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.recordFragmentUse(
        parseRecordFragmentUseCommand(value),
      );
    },
  );
  ipcMain.handle(
    FRAGMENT_RETIRE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireFragment(
        parseRetireFragmentCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createCharacter(
        parseCreateCharacterCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listCharacters(
        parseListCharactersCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateCharacter(
        parseUpdateCharacterCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_ADD_EVIDENCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.addCharacterEvidence(
        parseAddCharacterEvidenceCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_RETIRE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireCharacter(
        parseRetireCharacterCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_RELATION_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createCharacterRelation(
        parseCreateCharacterRelationCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_RELATION_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listCharacterRelations(
        parseListCharacterRelationsCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_RELATION_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateCharacterRelation(
        parseUpdateCharacterRelationCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_RELATION_RETIRE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireCharacterRelation(
        parseRetireCharacterRelationCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_EXTRACTION_RUN_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runCharacterExtraction(
        parseRunCharacterExtractionCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_EXTRACTION_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listCharacterExtractionCandidates(
        parseListCharacterExtractionCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_EXTRACTION_DECIDE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.decideCharacterExtractionItem(
        parseDecideCharacterExtractionItemCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_GENERATION_RUN_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runCharacterGeneration(
        parseRunCharacterGenerationCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_GENERATION_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listCharacterGenerationCandidates(
        parseListCharacterGenerationCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    CHARACTER_GENERATION_DECIDE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.decideCharacterGenerationItem(
        parseDecideCharacterGenerationItemCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_ENTRY_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createLoreEntry(
        parseCreateLoreEntryCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_ENTRY_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listLoreEntries(
        parseListLoreEntriesCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_ENTRY_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateLoreEntry(
        parseUpdateLoreEntryCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_ENTRY_ADD_EVIDENCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.addLoreEntryEvidence(
        parseAddLoreEntryEvidenceCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_ENTRY_RETIRE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireLoreEntry(
        parseRetireLoreEntryCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_CANDIDATE_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createLoreCandidate(
        parseCreateLoreCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_CANDIDATE_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listLoreCandidates(
        parseListLoreCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_CANDIDATE_APPROVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.approveLoreCandidate(
        parseReviewLoreCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_CANDIDATE_REJECT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.rejectLoreCandidate(
        parseReviewLoreCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_FORESHADOW_LINK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.linkLoreForeshadow(
        parseLinkLoreForeshadowCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_FORESHADOW_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listLoreForeshadowLinks(
        parseListLoreForeshadowLinksCommand(value),
      );
    },
  );
  ipcMain.handle(
    LORE_FORESHADOW_UNLINK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.unlinkLoreForeshadow(
        parseUnlinkLoreForeshadowCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PARTNER_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingPartner(
        parseCreatePublishingPartnerCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PARTNER_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingPartners(
        parseListPublishingPartnersCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PARTNER_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingPartner(
        parseUpdatePublishingPartnerCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SUBMISSION_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingSubmission(
        parseCreatePublishingSubmissionCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SUBMISSION_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingSubmissions(
        parseListPublishingSubmissionsCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SUBMISSION_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingSubmission(
        parseUpdatePublishingSubmissionCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_CONTRACT_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingContract(
        parseCreatePublishingContractCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_CONTRACT_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingContracts(
        parseListPublishingContractsCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_CONTRACT_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingContract(
        parseUpdatePublishingContractCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PUBLICATION_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingPublication(
        parseCreatePublishingPublicationCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PUBLICATION_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingPublications(
        parseListPublishingPublicationsCommand(value),
      ).then(parsePublishingPublicationListProjection);
    },
  );
  ipcMain.handle(
    PUBLISHING_PUBLICATION_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingPublication(
        parseUpdatePublishingPublicationCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SETTLEMENT_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingSettlement(
        parseCreatePublishingSettlementCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SETTLEMENT_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingSettlements(
        parseListPublishingSettlementsCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SETTLEMENT_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingSettlement(
        parseUpdatePublishingSettlementCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PAYMENT_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingPayment(
        parseCreatePublishingPaymentCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PAYMENT_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingPayments(
        parseListPublishingPaymentsCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PAYMENT_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingPayment(
        parseUpdatePublishingPaymentCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SOURCE_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPublishingSource(
        parseCreatePublishingSourceCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SOURCE_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingSources(
        parseListPublishingSourcesCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_RESEARCH_PREVIEW_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.previewPublishingResearch(
        parsePreviewPublishingResearchCommand(value),
      ).then(parsePublishingResearchCandidateProjection);
    },
  );
  ipcMain.handle(
    PUBLISHING_RESEARCH_APPROVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.approvePublishingResearch(
        parseApprovePublishingResearchCommand(value),
      ).then(parsePublishingResearchApprovalResult);
    },
  );
  ipcMain.handle(
    PUBLISHING_ASSISTANT_RUN_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runPublishingAssistant(
        parseRunPublishingAssistantCommand(value),
      ).then(parsePublishingAssistantResult);
    },
  );
  ipcMain.handle(
    PUBLISHING_ASSISTANT_APPROVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.approvePublishingAssistantCandidate(
        parseApprovePublishingAssistantCandidateCommand(value),
      ).then(parsePublishingAssistantApprovalResult);
    },
  );
  ipcMain.handle(
    PUBLISHING_EVIDENCE_SET_LINKS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.setPublishingEvidenceLinks(
        parseSetPublishingEvidenceLinksCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_PARTNER_CSV_SELECT_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      parseSelectPublishingPartnerCsvCommand(value);
      const owner = mainWindow;
      if (owner === null) throw new Error("Main window is unavailable");
      const selected = await dialog.showOpenDialog(owner, {
        title: "투고처 CSV 선택",
        buttonLabel: "CSV 선택",
        properties: ["openFile"],
        filters: [{ name: "CSV 문서", extensions: ["csv"] }],
      });
      const filePath = selected.filePaths[0];
      if (selected.canceled || filePath === undefined) {
        return parsePublishingPartnerCsvSelectionProjection({
          schemaVersion: 1,
          status: "cancelled",
        });
      }
      return parsePublishingPartnerCsvSelectionProjection({
        schemaVersion: 1,
        status: "selected",
        fileName: path.basename(filePath),
        csvText: readFileSync(filePath, "utf8"),
      });
    },
  );
  ipcMain.handle(
    PUBLISHING_PARTNER_CSV_APPLY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.applyPublishingPartnerCsvImport(
        parseApplyPublishingPartnerCsvImportCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_SUBMISSION_CSV_SELECT_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      parseSelectPublishingSubmissionCsvCommand(value);
      const owner = mainWindow;
      if (owner === null) throw new Error("Main window is unavailable");
      const selected = await dialog.showOpenDialog(owner, {
        title: "투고 이력 CSV 선택",
        buttonLabel: "CSV 선택",
        properties: ["openFile"],
        filters: [{ name: "CSV 문서", extensions: ["csv"] }],
      });
      const filePath = selected.filePaths[0];
      if (selected.canceled || filePath === undefined) {
        return parsePublishingSubmissionCsvSelectionProjection({
          schemaVersion: 1,
          status: "cancelled",
        });
      }
      return parsePublishingSubmissionCsvSelectionProjection({
        schemaVersion: 1,
        status: "selected",
        fileName: path.basename(filePath),
        csvText: readFileSync(filePath, "utf8"),
      });
    },
  );
  ipcMain.handle(
    PUBLISHING_SUBMISSION_CSV_APPLY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.applyPublishingSubmissionCsvImport(
        parseApplyPublishingSubmissionCsvImportCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CANDIDATE_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPublishingMailCandidates(
        parseListPublishingMailCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CANDIDATE_LINK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.linkPublishingMailCandidate(
        parseLinkPublishingMailCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CANDIDATE_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePublishingMailCandidate(
        parseUpdatePublishingMailCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CANDIDATE_REVIEW_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.reviewPublishingMailCandidate(
        parseReviewPublishingMailCandidateCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CONNECTION_STATUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getPublishingMailConnection(
        parseGetPublishingMailConnectionCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CONNECTION_CONNECT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.connectPublishingMail(
        parseConnectPublishingMailCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CONNECTION_SYNC_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.syncPublishingMail(
        parseSyncPublishingMailCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_CONNECTION_DISCONNECT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.disconnectPublishingMail(
        parseDisconnectPublishingMailCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_SCHEDULE_STATUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getPublishingMailSchedule(
        parseGetPublishingMailScheduleCommand(value),
      );
    },
  );
  ipcMain.handle(
    PUBLISHING_MAIL_SCHEDULE_SAVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.savePublishingMailSchedule(
        parseSavePublishingMailScheduleCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_CREATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPlotThread(
        parseCreatePlotThreadCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPlotThreads(
        parseListPlotThreadsCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_DEFAULT_BOARD_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getDefaultPlotBoard(
        parseGetDefaultPlotBoardCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_MOVE_PLACEMENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.movePlotPlacement(
        parseMovePlotPlacementCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_SET_STORY_TIME_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.setPlotPlacementStoryTime(
        parseSetPlotPlacementStoryTimeCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_UPDATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePlotThread(
        parseUpdatePlotThreadCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_RETIRE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retirePlotThread(
        parseRetirePlotThreadCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_CREATE_FROM_EVENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createPlotFromEvent(
        parseCreatePlotFromEventCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_CREATE_EVENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createEventFromPlot(
        parseCreateEventFromPlotCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_LINK_EVENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.linkPlotEvent(
        parseLinkPlotEventCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_UNLINK_EVENT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.unlinkPlotEvent(
        parseUnlinkPlotEventCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_EVENT_LINK_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPlotEventLinks(
        parseListPlotEventLinksCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_LINK_SOURCE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.linkPlotThreadSource(
        parseLinkPlotThreadSourceCommand(value),
      );
    },
  );
  ipcMain.handle(
    PLOT_SOURCE_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listPlotThreadSources(
        parseListPlotThreadSourcesCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_CREATE_LINE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createForeshadowLine(
        parseCreateForeshadowLineCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_LIST_LINES_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listForeshadowLines(
        parseListForeshadowLinesCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_UPDATE_LINE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateForeshadowLine(
        parseUpdateForeshadowLineCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_RETIRE_LINE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireForeshadowLine(
        parseRetireForeshadowLineCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_CREATE_POINT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createForeshadowPoint(
        parseCreateForeshadowPointCommand(value),
      );
    },
  );
  ipcMain.handle(
    FORESHADOW_LIST_POINTS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listForeshadowPoints(
        parseListForeshadowPointsCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_LIST_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkActivity(
        parseListWorkActivityCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_EXPORT_RECORDS_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const prepared = await applicationRuntime.prepareWorkRecordsExport(
        parseExportWorkRecordsCommand(value),
      );
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const isJson = prepared.format === "json";
      const selected = await dialog.showSaveDialog(owner, {
        title: isJson
          ? "집필 기록 JSON 내보내기"
          : "집필 기록 CSV 내보내기",
        buttonLabel: "내보내기",
        defaultPath: prepared.suggestedFileName,
        filters: [
          {
            name: isJson ? "JSON 문서" : "CSV 문서",
            extensions: [prepared.format],
          },
        ],
      });
      if (selected.canceled || selected.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const receipt = await exportNodeManuscriptText({
        finalPath: selected.filePath,
        text: prepared.text,
      });
      return {
        schemaVersion: 1,
        status: "completed",
        byteLength: receipt.byteLength,
        sessionCount: prepared.sessionCount,
      } as const;
    },
  );
  ipcMain.handle(
    ACTIVITY_GET_RECORDS_GOALS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkRecordsGoals(
        parseGetWorkRecordsGoalsCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_SAVE_RECORDS_GOALS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkRecordsGoals(
        parseSaveWorkRecordsGoalsCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_GET_READTHROUGH_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkReadthrough(
        parseGetWorkReadthroughCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_SAVE_READTHROUGH_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkReadthrough(
        parseSaveWorkReadthroughCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_LIST_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkSchedule(
        parseListWorkScheduleCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_LIST_CALENDAR_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkCalendar(
        parseListWorkScheduleCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_LIST_TODAY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getStudioToday(
        parseGetStudioTodayCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_CREATE_ITEM_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createWorkScheduleItem(
        parseCreateWorkScheduleItemCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_UPDATE_ITEM_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updateWorkScheduleItem(
        parseUpdateWorkScheduleItemCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_RETIRE_ITEM_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.retireWorkScheduleItem(
        parseRetireWorkScheduleItemCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCHEDULE_SET_COMPLETION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.setWorkScheduleCompletion(
        parseSetWorkScheduleCompletionCommand(value),
      );
    },
  );
  ipcMain.handle(
    APP_SETTINGS_PROFILE_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return appSettingsProfile;
    },
  );
  ipcMain.handle(
    APP_SETTINGS_GET_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getAppSettings();
    },
  );
  ipcMain.handle(
    APP_SETTINGS_SAVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveAppSettings(
        parseSaveAppSettingsCommand(value, appSettingsProfile),
      );
    },
  );
  ipcMain.handle(
    UI_PREFERENCES_GET_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return uiPreferencesStore.get();
    },
  );
  ipcMain.handle(
    UI_PREFERENCES_SAVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return uiPreferencesStore.save(parseSaveUiPreferencesCommand(value));
    },
  );
  ipcMain.handle(
    MUSIC_SETTINGS_PROFILE_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return musicSettingsProfile;
    },
  );
  ipcMain.handle(
    MUSIC_SETTINGS_GET_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkMusicSettings(
        parseGetWorkMusicSettingsCommand(value),
      );
    },
  );
  ipcMain.handle(
    MUSIC_SETTINGS_SAVE_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkMusicSettings(
        parseSaveWorkMusicSettingsCommand(value, musicSettingsProfile),
      );
    },
  );
  ipcMain.handle(
    INSPIRATION_SETTINGS_GET_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkInspirationSettings(
        parseGetWorkInspirationSettingsCommand(value),
      );
    },
  );
  ipcMain.handle(
    INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkInspirationSettings(
        parseSaveWorkInspirationSettingsCommand(value),
      );
    },
  );
  ipcMain.handle(
    YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getYouTubeMusicConnectionStatus();
    },
  );
  ipcMain.handle(
    YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveYouTubeMusicConnection(
        parseSaveYouTubeMusicConnectionCommand(value),
      );
    },
  );
  ipcMain.handle(
    YOUTUBE_MUSIC_PROFILE_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return youtubeMusicProfile;
    },
  );
  ipcMain.handle(
    YOUTUBE_MUSIC_SEARCH_CHANNEL,
    async (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const command = parseSearchYouTubeVideosCommand(value);
      return Object.freeze({
        schemaVersion: 1,
        query: command.query,
        videos: await youtubeMusicSearchClient.searchVideos(
          command.query,
          youtubeMusicProfile.searchLimit,
        ),
      });
    },
  );
  ipcMain.handle(
    SCENE_MUSIC_QUEUE_SEARCH_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.searchSceneMusicQueues(
        parseSearchSceneMusicQueuesCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCENE_MUSIC_QUEUE_LIST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listSceneMusicQueueCandidates(
        parseListSceneMusicQueueCandidatesCommand(value),
      );
    },
  );
  ipcMain.handle(
    SCENE_MUSIC_QUEUE_SELECT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.selectSceneMusicQueue(
        parseSelectSceneMusicQueueCommand(value),
      );
    },
  );
  ipcMain.handle(
    QUICK_TOOLS_GET_MEMO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkQuickMemo(
        parseGetWorkQuickMemoCommand(value),
      );
    },
  );
  ipcMain.handle(
    QUICK_TOOLS_SAVE_MEMO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkQuickMemo(
        parseSaveWorkQuickMemoCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_CHATGPT_OAUTH_STATUS_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return chatGptOAuthStore.getStatus();
    },
  );
  ipcMain.handle(
    ASSISTANT_CHATGPT_OAUTH_START_LOGIN_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return chatGptOAuthLogin.startLogin();
    },
  );
  ipcMain.handle(
    ASSISTANT_CHAT_RUN_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const command = parseRunAssistantChatCommand(value);
      return chatGptCodexClient.chat(command.messages);
    },
  );
  ipcMain.handle(
    ASSISTANT_LIST_CONNECTIONS_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listAssistantConnections();
    },
  );
  ipcMain.handle(
    ASSISTANT_SAVE_CONNECTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveAssistantConnection(
        parseSaveAssistantConnectionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_DELETE_CONNECTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.deleteAssistantConnection(
        parseDeleteAssistantConnectionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_CONNECTOR_PROFILE_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getAssistantConnectorProfile();
    },
  );
  ipcMain.handle(
    ASSISTANT_DESTINATION_PROFILE_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getAssistantDestinationProfile();
    },
  );
  ipcMain.handle(
    ASSISTANT_LIST_CONTEXT_STATE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listAssistantContextState(
        parseListAssistantContextStateCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_GRANT_CONTEXT_PERMISSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.grantAssistantContextPermission(
        parseGrantAssistantContextPermissionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_REVOKE_CONTEXT_PERMISSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.revokeAssistantContextPermission(
        parseRevokeAssistantContextPermissionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_RUN_VOCABULARY_LOOKUP_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runAssistantVocabularyLookup(
        parseRunAssistantVocabularyLookupCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_RUN_VOCABULARY_SUGGESTION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runAssistantVocabularySuggestion(
        parseRunAssistantVocabularySuggestionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_RUN_EXTERNAL_SETTING_REVIEW_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runAssistantExternalSettingReview(
        parseRunAssistantExternalSettingReviewCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_RUN_NOTATION_REVIEW_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runAssistantNotationReview(
        parseRunAssistantNotationReviewCommand(value),
      );
    },
  );
  ipcMain.handle(
    ASSISTANT_RUN_SETTING_REVIEW_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.runAssistantSettingReview(
        parseRunAssistantSettingReviewCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_START_SESSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.startWritingSession(
        parseStartWritingSessionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_STOP_SESSION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.stopWritingSession(
        parseStopWritingSessionCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_START_FOCUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.startFocusCycle(
        parseStartFocusCycleCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_STOP_FOCUS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.stopFocusCycle(
        parseStopFocusCycleCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_GET_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getPomodoro(parseGetPomodoroCommand(value));
    },
  );
  ipcMain.handle(
    ACTIVITY_CONFIGURE_START_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.configureAndStartPomodoro(
        parseConfigureAndStartPomodoroCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_PAUSE_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.pausePomodoro(parsePomodoroPhaseCommand(value));
    },
  );
  ipcMain.handle(
    ACTIVITY_RESUME_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.resumePomodoro(parsePomodoroPhaseCommand(value));
    },
  );
  ipcMain.handle(
    ACTIVITY_RECONCILE_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.reconcilePomodoro(
        parsePomodoroPhaseCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_UPDATE_POMODORO_NOTE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.updatePomodoroNote(
        parseUpdatePomodoroNoteCommand(value),
      );
    },
  );
  ipcMain.handle(
    ACTIVITY_STOP_POMODORO_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.stopPomodoro(parsePomodoroPhaseCommand(value));
    },
  );
  ipcMain.handle(
    VERSION_LIST_DOCUMENT_REVISIONS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listDocumentRevisions(
        parseListDocumentRevisionsCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_READ_DOCUMENT_REVISION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.readDocumentRevision(
        parseReadDocumentRevisionCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_RESTORE_DOCUMENT_REVISION_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.restoreDocumentRevision(
        parseRestoreDocumentRevisionCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_CREATE_WORK_SNAPSHOT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.createWorkSnapshot(
        parseCreateWorkSnapshotCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_LIST_WORK_SNAPSHOTS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.listWorkSnapshots(
        parseListWorkSnapshotsCommand(value),
      );
    },
  );
  ipcMain.handle(
    VERSION_COMPARE_WORK_SNAPSHOT_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.compareWorkSnapshot(
        parseCompareWorkSnapshotCommand(value),
      );
    },
  );
  ipcMain.handle(
    BACKUP_GET_STATUS_CHANNEL,
    (event) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getBackupStatus();
    },
  );
  ipcMain.handle(
    BACKUP_CREATE_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selected = await dialog.showSaveDialog(owner, {
        title: "새 백업",
        buttonLabel: "백업 만들기",
      });
      if (selected.canceled || selected.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const summary = await applicationRuntime.createBackupBundle(
        selected.filePath,
      );
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
  ipcMain.handle(
    BACKUP_RESTORE_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selectedBundle = await dialog.showOpenDialog(owner, {
        title: "복원할 백업 선택",
        buttonLabel: "백업 선택",
        properties: ["openDirectory"],
      });
      const bundlePath = selectedBundle.filePaths[0];
      if (selectedBundle.canceled || bundlePath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const selectedTarget = await dialog.showSaveDialog(owner, {
        title: "복원할 새 작업실 위치",
        buttonLabel: "새 위치에 복원",
      });
      if (selectedTarget.canceled || selectedTarget.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const summary = await applicationRuntime.restoreBackupBundle(
        bundlePath,
        selectedTarget.filePath,
      );
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
  ipcMain.handle(
    MIGRATION_RUN_LEGACY_REHEARSAL_CHANNEL,
    async (event) => {
      assertTrustedRendererSender(event);
      const owner = mainWindow;
      if (owner === null) {
        throw new Error("Main window is unavailable");
      }
      const selectedSource = await dialog.showOpenDialog(owner, {
        title: "기존 이음 에디터 폴더 선택",
        buttonLabel: "원본 폴더 선택",
        properties: ["openDirectory"],
      });
      const sourceRootPath = selectedSource.filePaths[0];
      if (selectedSource.canceled || sourceRootPath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const selectedBrowserBundle = await dialog.showOpenDialog(owner, {
        title: "기존 브라우저 데이터 내보내기 선택",
        buttonLabel: "브라우저 내보내기 선택",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      const browserExportBundlePath = selectedBrowserBundle.filePaths[0];
      if (
        selectedBrowserBundle.canceled ||
        browserExportBundlePath === undefined
      ) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const selectedTarget = await dialog.showSaveDialog(owner, {
        title: "가져오기 리허설을 저장할 새 위치",
        buttonLabel: "리허설 위치 선택",
      });
      if (selectedTarget.canceled || selectedTarget.filePath === "") {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const profile = parseLegacyLoreImportProfile(
        JSON.parse(
          readFileSync(
            process.env.EUM_STUDIO_LEGACY_LORE_IMPORT_PROFILE_PATH ??
              path.join(
                app.getAppPath(),
                "config",
                "legacy-lore-import.json",
              ),
            "utf8",
          ),
        ),
      );
      const browserExportProfile = parseLegacyBrowserSourceExportProfile(
        JSON.parse(
          readFileSync(
            process.env
              .EUM_STUDIO_LEGACY_BROWSER_SOURCE_EXPORT_PROFILE_PATH ??
              path.join(
                app.getAppPath(),
                "config",
                "legacy-browser-source-export.json",
              ),
            "utf8",
          ),
        ),
      );
      const summary = await runLegacyLoreImportRehearsal({
        sourceRootPath,
        targetRootPath: selectedTarget.filePath,
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        profile,
        browserExportBundlePath,
        browserExportProfile,
      });
      return { schemaVersion: 1, status: "completed", summary } as const;
    },
  );
  ipcMain.handle(MANUSCRIPT_DOCUMENT_PROFILE_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptDocumentProfile();
  });
  ipcMain.handle(MANUSCRIPT_PERSISTENCE_PROFILE_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptPersistenceProfile();
  });
  ipcMain.handle(MANUSCRIPT_STARTUP_RECOVERY_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptStartupRecovery();
  });
  ipcMain.handle(MANUSCRIPT_RESUME_CHECKPOINT_CHANNEL, () => {
    return manuscriptRuntime.getManuscriptResumeCheckpoint();
  });
  ipcMain.handle(
    MANUSCRIPT_GET_CONTINUOUS_READING_PROGRESS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getContinuousReadingProgress(
        parseGetContinuousReadingProgressCommand(value),
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SAVE_CONTINUOUS_READING_PROGRESS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveContinuousReadingProgress(
        parseSaveContinuousReadingProgressCommand(value),
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SAVE_CHANGE_BATCH_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.saveChangeBatch(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SAVE_DOCUMENT_CHANGE_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.saveDocumentChange(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SAVE_FORMATTING_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.saveFormatting(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_GET_WORK_LAYOUT_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.getWorkManuscriptLayoutSettings(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_SAVE_WORK_LAYOUT_SETTINGS_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return applicationRuntime.saveWorkManuscriptLayoutSettings(value);
    },
  );
  ipcMain.handle(
    MANUSCRIPT_APPLY_STARTUP_RECOVERY_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      return manuscriptRuntime.applyManuscriptStartupRecovery(
        value,
      );
    },
  );
  ipcMain.handle(
    MANUSCRIPT_COMPLETE_CLOSE_REQUEST_CHANNEL,
    (event, value: unknown) => {
      assertTrustedRendererSender(event);
      const result =
        parseManuscriptCloseResult(value);
      const request = pendingCloseRequest;
      if (
        request === null ||
        request.requestId !==
          result.requestId
      ) {
        throw new Error(
          "Manuscript close result does not identify the pending request",
        );
      }
      pendingCloseRequest = null;
      if (result.status === "saved") {
        const window = mainWindow;
        if (window !== null) {
          allowMainWindowClose = true;
          setImmediate(() => {
            if (!window.isDestroyed()) {
              window.close();
            }
          });
        }
      }
      return result;
    },
  );
}

async function createMainWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, "../preload/index.js");
  const rendererFile = path.join(
    __dirname,
    "../../dist-renderer/index.html",
  );
  const configuredRendererUrl = process.env.EUM_STUDIO_RENDERER_URL;
  const rendererTarget =
    configuredRendererUrl ?? pathToFileURL(rendererFile).toString();
  configuredRendererTarget =
    rendererTarget;
  pendingCloseRequest = null;
  allowMainWindowClose = false;

  const window = new BrowserWindow({
    autoHideMenuBar: true,
    height: 800,
    minHeight: 480,
    minWidth: 640,
    show: false,
    titleBarOverlay: {
      color: "#00000000",
      height: 38,
      symbolColor: "#787878",
    },
    titleBarStyle: "hidden",
    webPreferences: createSecureWebPreferences(preloadPath),
    width: 1200,
  });
  mainWindow = window;

  if (activeYouTubePlayerReferer !== null) {
    const playerReferer = activeYouTubePlayerReferer;
    window.webContents.session.webRequest.onBeforeSendHeaders(
      YOUTUBE_PLAYER_REQUEST_FILTER,
      (details, callback) => {
        callback({
          requestHeaders: withYouTubePlayerReferer(
            details.requestHeaders,
            playerReferer,
          ),
        });
      },
    );
  }

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, requestedTarget) => {
    if (!isAllowedRendererNavigation(requestedTarget, rendererTarget)) {
      event.preventDefault();
    }
  });
  window.once("ready-to-show", () => {
    if (shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)) {
      window.show();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      configuredRendererTarget =
        null;
      pendingCloseRequest = null;
      allowMainWindowClose = false;
    }
  });
  window.on("close", (event) => {
    if (allowMainWindowClose) {
      return;
    }
    if (
      activeApplicationRuntime?.getWorkspaceCatalog().canCreateFirstWork ===
      true
    ) {
      allowMainWindowClose = true;
      return;
    }
    event.preventDefault();
    if (
      pendingCloseRequest !== null
    ) {
      return;
    }
    const request: ManuscriptCloseRequest =
      Object.freeze({
        schemaVersion: 1,
        requestId: randomUUID(),
      });
    pendingCloseRequest = request;
    window.webContents.send(
      MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
      request,
    );
  });

  if (configuredRendererUrl === undefined) {
    await window.loadFile(rendererFile);
  } else {
    await window.loadURL(configuredRendererUrl);
  }

  return window;
}

app.enableSandbox();

app.whenReady().then(async () => {
  await registerApplicationHandlers();
  mainWindow = await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  activeApplicationRuntime?.close();
  activeApplicationRuntime = null;
  activeYouTubePlayerReferer = null;
});
