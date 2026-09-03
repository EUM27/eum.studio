import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  safeStorage,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

if (process.env.EUM_STUDIO_DISABLE_SANDBOX === "1") {
  app.commandLine.appendSwitch("no-sandbox");
}

import { registerStudioIpc } from "./ipc/register-studio-ipc";
import { createApplicationRuntimes } from "./runtime/create-application-runtimes";
import { pickEditorRuntime } from "./runtime/editor-runtime";
import type { MoveRangeToEpisodeReceipt } from "../application/editor/move-range-to-episode";

import {
  MANUSCRIPT_CLOSE_REQUEST_CHANNEL,
  type ManuscriptCloseRequest,
} from "../application/contracts/studio-bridge";
import {
  parseEventBlockListProjection,
  parseListEventBlocksCommand,
  type EventBlockListProjection,
  type EventBlockProjection,
  type EventSourceProjection,
} from "../application/structure/event-block-contract";
import {
  parseListEventRailCommand,
  type EventRailProjection,
} from "../application/structure/event-rail-projection";
import {
  parseListSceneOverridesCommand,
  parseRelocateSceneSegmentCommand,
  parseSceneOverrideListProjection,
  type SceneOverrideListProjection,
  type SceneOverrideProjection,
} from "../application/structure/scene-override-contract";
import {
  parseRebindSceneMetadataCommand,
  type SceneMetadataBindingProjection,
} from "../application/structure/scene-metadata-binding-contract";
import {
  parseDeleteSceneCommand,
  parseListSceneTrashCommand,
  parsePrepareSceneDeletionCommand,
  parseRestoreSceneTrashCommand,
  parseUndoSceneDeletionCommand,
  type SceneDeletionPreview,
  type SceneDeletionReceipt,
  type SceneTrashListProjection,
} from "../application/structure/scene-trash-contract";
import {
  parseListSceneProjectionCommand,
  parseSetSceneEventOverrideCommand,
  parseUpdateSceneRuleSetCommand,
  type SceneProjectionList,
} from "../application/structure/scene-projection";
import {
  parseFinalizeSceneCanonCheckCommand,
  parseListSceneCanonContextsCommand,
  parseSceneCanonContextListProjection,
  type SceneCanonCheckProjection,
  type SceneCanonContextListProjection,
} from "../application/structure/scene-canon-context";
import {
  parseListSceneExtractionCandidatesCommand,
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
  parseFragmentListProjection,
  parseFragmentShelfProfile,
  parseListFragmentsCommand,
  type FragmentListProjection,
  type FragmentProjection,
} from "../application/fragments/fragment-contract";
import {
  parseListManuscriptAnnotationsCommand,
  parseManuscriptAnnotationListProjection,
  type ManuscriptAnnotationListProjection,
  type ManuscriptAnnotationProjection,
} from "../application/review/manuscript-annotation-contract";
import {
  parseCharacterListProjection,
  parseListCharactersCommand,
  type CharacterListProjection,
  type CharacterProjection,
} from "../application/characters/character-contract";
import {
  parseCharacterRelationListProjection,
  parseListCharacterRelationsCommand,
  type CharacterRelationListProjection,
  type CharacterRelationProjection,
} from "../application/characters/character-relation-contract";
import {
  parseCharacterExtractionCandidateList,
  parseListCharacterExtractionCandidatesCommand,
  type CharacterExtractionCandidateList,
  type CharacterExtractionDecisionResult,
  type CharacterExtractionResult,
} from "../application/characters/character-extraction-contract";
import {
  parseCharacterGenerationCandidateList,
  parseListCharacterGenerationCandidatesCommand,
  type CharacterGenerationCandidateList,
  type CharacterGenerationDecisionResult,
  type CharacterGenerationResult,
} from "../application/characters/character-generation-contract";
import {
  parseCanonReviewCandidateList,
  parseListCanonReviewCandidatesCommand,
  type CanonReviewCandidate,
  type CanonReviewCandidateList,
  type CanonReviewDecisionResult,
  type CanonReviewResult,
} from "../application/canon/canon-review-contract";
import {
  parseContinuityReviewCandidateList,
  parseListContinuityReviewCandidatesCommand,
  type ContinuityReviewCandidate,
  type ContinuityReviewCandidateList,
  type ContinuityReviewDecisionResult,
  type ContinuityReviewResult,
} from "../application/continuity/continuity-review-contract";
import {
  parseContinuityOverviewProjection,
  parseListContinuityThreadsCommand,
  type ContinuityOverviewProjection,
  type ContinuityThreadProjection,
} from "../application/continuity/continuity-thread-contract";
import {
  parseCharacterKnowledgeListProjection,
  parseListCharacterKnowledgeCommand,
  parsePovKnowledgeContextProjection,
  parseProjectPovKnowledgeCommand,
  type CharacterKnowledgeListProjection,
  type CharacterKnowledgeProjection,
  type PovKnowledgeContextProjection,
} from "../application/continuity/character-knowledge-contract";
import {
  parseAssistantEntityContextPolicyList,
  parseListAssistantEntityContextPoliciesCommand,
  type AssistantEntityContextPolicyList,
  type AssistantEntityContextPolicyProjection,
} from "../application/continuity/assistant-context-policy";
import {
  parseAssistantContextActivityList,
  parseAssistantContextManifestList,
  parseListAssistantContextActivitiesCommand,
  parseListAssistantContextManifestsCommand,
  type AssistantContextActivityList,
  type AssistantContextManifestList,
  type AssistantContextPlanProjection,
} from "../application/continuity/assistant-context-manifest";
import {
  parseListLoreEntriesCommand,
  parseLoreEntryListProjection,
  type LoreEntryListProjection,
  type LoreEntryProjection,
} from "../application/lore/lore-entry-contract";
import {
  parseListLoreForeshadowLinksCommand,
  parseLoreForeshadowLinkListProjection,
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
  parseListPublishingPartnersCommand,
  parsePublishingPartnerListProjection,
  type PublishingPartnerListProjection,
  type PublishingPartnerProjection,
} from "../application/publishing/publishing-partner-contract";
import {
  parseListPublishingSubmissionsCommand,
  parsePublishingSubmissionListProjection,
  type PublishingSubmissionListProjection,
  type PublishingSubmissionProjection,
} from "../application/publishing/publishing-submission-contract";
import {
  parseListPublishingFormResponsesCommand,
  parseListPublishingFormTemplatesCommand,
  parsePublishingFormResponseListProjection,
  parsePublishingFormTemplateListProjection,
  type PublishingFormResponseListProjection,
  type PublishingFormResponseProjection,
  type PublishingFormTemplateListProjection,
  type PublishingFormTemplateProjection,
} from "../application/publishing/publishing-form-contract";
import {
  parseListPublishingContractsCommand,
  parsePublishingContractListProjection,
  type PublishingContractListProjection,
  type PublishingContractProjection,
} from "../application/publishing/publishing-contract-contract";
import {
  parseListPublishingPublicationsCommand,
  parsePublishingPublicationListProjection,
  type PublishingPublicationListProjection,
  type PublishingPublicationProjection,
} from "../application/publishing/publishing-publication-contract";
import {
  parseListPublishingSettlementsCommand,
  parsePublishingSettlementListProjection,
  type PublishingSettlementListProjection,
  type PublishingSettlementProjection,
} from "../application/publishing/publishing-settlement-contract";
import {
  parseListPublishingPaymentsCommand,
  parsePublishingPaymentListProjection,
  type PublishingPaymentListProjection,
  type PublishingPaymentProjection,
} from "../application/publishing/publishing-payment-contract";
import {
  parseListPublishingSourcesCommand,
  parsePublishingSourceListProjection,
  type PublishingSourceListProjection,
  type PublishingSourceProjection,
} from "../application/publishing/publishing-source-contract";
import {
  parseApprovePublishingResearchCommand,
  parsePreviewPublishingResearchCommand,
  type PublishingResearchApprovalResult,
  type PublishingResearchCandidateProjection,
} from "../application/publishing/publishing-research-contract";
import {
  parseApprovePublishingAssistantCandidateCommand,
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
  type PublishingPartnerCsvImportResult,
} from "../application/publishing/publishing-partner-csv-import";
import {
  parseApplyPublishingSubmissionCsvImportCommand,
  parsePublishingSubmissionCsvSelectionProjection,
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
  parseListPlotThreadsCommand,
  parsePlotThreadListProjection,
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
  parseListPlotEventLinksCommand,
  parsePlotEventLinkListProjection,
  type PlotEventLinkListProjection,
  type PlotEventLinkMutationProjection,
} from "../application/plots/plot-event-link-contract";
import {
  parseListPlotThreadSourcesCommand,
  parsePlotThreadSourceListProjection,
  type PlotThreadSourceListProjection,
  type PlotThreadSourceProjection,
} from "../application/plots/plot-source-contract";
import {
  parseForeshadowLineListProjection,
  parseListForeshadowLinesCommand,
  type ForeshadowLineListProjection,
  type ForeshadowLineProjection,
} from "../application/foreshadowing/foreshadow-line-contract";
import {
  parseForeshadowPointListProjection,
  parseForeshadowPointProfile,
  parseListForeshadowPointsCommand,
  type ForeshadowPointListProjection,
  type ForeshadowPointProjection,
} from "../application/foreshadowing/foreshadow-point-contract";
import {
  parseGetPomodoroCommand,
  parsePomodoroProjection,
  type PomodoroProjection,
} from "../application/activity/pomodoro-contract";
import {
  parseListWorkActivityCommand,
  parseStartWritingSessionCommand,
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
  type WorkRecordsGoalsProjection,
} from "../application/activity/work-records-preferences";
import {
  createUnsetWorkReadthrough,
  parseGetWorkReadthroughCommand,
  type WorkReadthroughProjection,
} from "../application/activity/work-readthrough-calculator";
import {
  parseListWorkScheduleCommand,
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
  type WorkQuickMemoProjection,
} from "../application/quick-tools/work-quick-memo";
import type {
  AssistantContextPermissionGrant,
} from "../application/assistant/assistant-context-permission";
import {
  type AssistantConnectionListProjection,
  type AssistantConnectionProjection,
} from "../application/assistant/assistant-connection";
import {
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
import {
  type AssistantVocabularySuggestionResult,
} from "../application/assistant/assistant-vocabulary-suggestion";
import {
  type AssistantExternalSettingReviewResult,
} from "../application/assistant/assistant-external-setting-review";
import {
  type AssistantVocabularyLookupResult,
} from "../application/assistant/assistant-vocabulary-lookup";
import {
  type AssistantNotationReviewResult,
} from "../application/assistant/assistant-notation-review";
import {
  type AssistantSettingReviewResult,
} from "../application/assistant/assistant-setting-review";
import {
  createDefaultAppSettingsProjection,
  deriveWorkEpisodeCharacterProgress,
  parseAppSettingsProfile,
  type AppSettingsProjection,
} from "../application/settings/app-settings";
import {
  createDefaultWorkMusicSettingsProjection,
  parseGetWorkMusicSettingsCommand,
  parseMusicSettingsProfile,
  type WorkMusicSettingsProjection,
} from "../application/music/work-music-settings";
import {
  createDefaultWorkSceneAnalysisSettingsProjection,
  parseGetWorkSceneAnalysisSettingsCommand,
  type WorkSceneAnalysisSettingsProjection,
} from "../application/settings/work-scene-analysis-settings";
import {
  createDefaultWorkInspirationSettingsProjection,
  parseGetWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../application/inspiration/work-inspiration-settings";
import {
  type YouTubeMusicConnectionStatus,
} from "../application/music/youtube-music-connection";
import {
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
  parseDocumentRevisionListProjection,
  parseListDocumentRevisionsCommand,
  parseListWorkSnapshotsCommand,
  parseReadDocumentRevisionCommand,
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
import {
  parsePlanWorkSnapshotSceneSelectionCommand,
  type WorkSnapshotSceneSelectionPlan,
} from "../application/revisions/work-snapshot-scene-plan";
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
  type ExportManuscriptTextCommand,
  type ManuscriptPreflightSettingsProjection,
} from "../application/editor/manuscript-preflight";
import {
  parseExportCanonicalMarkdownCommand,
  type PreparedCanonicalMarkdownExport,
} from "../application/export/canonical-markdown-export";
import {
  normalizeImportedManuscriptText,
} from "../application/editor/manuscript-text-import";
import {
  createUnsetContinuousReadingProgress,
  parseGetContinuousReadingProgressCommand,
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
import { exportNodeCanonicalMarkdownBundle } from "../platform/export/node-canonical-markdown-export";
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
  parseListNarrativeDigestsCommand,
  parseNarrativeDigestListProjection,
  type NarrativeDigestListProjection,
  type NarrativeDigestResult,
} from "../application/continuity/narrative-digest-contract";
import {
  parseListSceneAnalysisRunsCommand,
  type AutomaticSceneAnalysisResult,
  type SceneAnalysisRunListProjection,
} from "../application/continuity/scene-analysis-run-contract";
import {
  createChatGptOAuthWindowLauncher,
  createChatGptOAuthWindowOptions,
} from "./chatgpt-oauth-window";
import { openNodeYouTubeMusicConnectionStore } from "../platform/music/node-youtube-music-connection-store";
import { createNodeYouTubeMusicSearchClient } from "../platform/music/node-youtube-music-search";
import { openNodeLocalMediaLibrary } from "../platform/music/node-local-media-library";
import { createNodeLocalMediaResponse } from "../platform/music/node-local-media-response";
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
  canActivateMainWindow,
  createSecureWebPreferences,
  isAllowedRendererNavigation,
  isTrustedRendererIpcSender,
  shouldRecoverMainWindowRenderer,
  shouldDisableHardwareAcceleration,
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
let applicationHandlersRegistered = false;
let applicationIsQuitting = false;
let rendererRecoveryPromise: Promise<void> | null = null;
let activeApplicationRuntime: ApplicationRuntime | null = null;
let activeYouTubePlayerReferer: string | null = null;

protocol.registerSchemesAsPrivileged([{
  scheme: "eum-media",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

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

function configuredLocalMediaSelectionPaths(value: string): readonly string[] {
  const parsed = JSON.parse(value) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string" || !path.isAbsolute(entry))
  ) {
    throw new Error(
      "EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS must be a JSON array of absolute paths",
    );
  }
  return Object.freeze([...parsed]);
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
  retireAllDocuments(value: unknown): Promise<WorkspaceCatalogProjection>;
  moveDocument(value: unknown): Promise<WorkspaceCatalogProjection>;
  createDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  renameDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  placeDocumentInFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  retireDocumentFolder(value: unknown): Promise<WorkspaceCatalogProjection>;
  captureWorkspaceResume(value: unknown): Promise<ManuscriptResumeCheckpointProjection>;
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
  relocateSceneSegment(value: unknown): Promise<SceneProjectionList>;
  listSceneOverrides(value: unknown): Promise<SceneOverrideListProjection>;
  listSceneProjection(value: unknown): Promise<SceneProjectionList>;
  listSceneCanonContexts(value: unknown): Promise<SceneCanonContextListProjection>;
  finalizeSceneCanonCheck(value: unknown): Promise<SceneCanonCheckProjection>;
  updateSceneRuleSet(value: unknown): Promise<SceneProjectionList>;
  setSceneEventOverride(value: unknown): Promise<SceneProjectionList>;
  rebindSceneMetadata(value: unknown): Promise<SceneMetadataBindingProjection>;
  prepareSceneDeletion(value: unknown): Promise<SceneDeletionPreview>;
  deleteScene(value: unknown): Promise<SceneDeletionReceipt>;
  listSceneTrash(value: unknown): Promise<SceneTrashListProjection>;
  restoreSceneTrash(value: unknown): Promise<SceneDeletionReceipt>;
  undoSceneDeletion(value: unknown): Promise<SceneDeletionReceipt>;
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
  createManuscriptAnnotation(value: unknown): Promise<ManuscriptAnnotationProjection>;
  listManuscriptAnnotations(value: unknown): Promise<ManuscriptAnnotationListProjection>;
  updateManuscriptAnnotation(value: unknown): Promise<ManuscriptAnnotationProjection>;
  retireManuscriptAnnotation(value: unknown): Promise<ManuscriptAnnotationProjection>;
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
  createPublishingFormTemplate(value: unknown): Promise<PublishingFormTemplateProjection>;
  listPublishingFormTemplates(value: unknown): Promise<PublishingFormTemplateListProjection>;
  updatePublishingFormTemplate(value: unknown): Promise<PublishingFormTemplateProjection>;
  listPublishingFormResponses(value: unknown): Promise<PublishingFormResponseListProjection>;
  savePublishingFormResponse(value: unknown): Promise<PublishingFormResponseProjection>;
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
  getWorkSceneAnalysisSettings(
    value: unknown,
  ): Promise<WorkSceneAnalysisSettingsProjection>;
  saveWorkSceneAnalysisSettings(
    value: unknown,
  ): Promise<WorkSceneAnalysisSettingsProjection>;
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
  runCanonReview(value: unknown): Promise<CanonReviewResult>;
  listCanonReviewCandidates(value: unknown): Promise<CanonReviewCandidateList>;
  updateCanonReviewItem(value: unknown): Promise<CanonReviewCandidate>;
  resolveCanonReviewItemTarget(value: unknown): Promise<CanonReviewCandidate>;
  decideCanonReviewItem(value: unknown): Promise<CanonReviewDecisionResult>;
  createContinuityThread(value: unknown): Promise<ContinuityThreadProjection>;
  updateContinuityThread(value: unknown): Promise<ContinuityThreadProjection>;
  listContinuityThreads(value: unknown): Promise<ContinuityOverviewProjection>;
  resolveContinuityThread(value: unknown): Promise<ContinuityThreadProjection>;
  dismissContinuityThread(value: unknown): Promise<ContinuityThreadProjection>;
  runContinuityReview(value: unknown): Promise<ContinuityReviewResult>;
  listContinuityReviewCandidates(
    value: unknown,
  ): Promise<ContinuityReviewCandidateList>;
  updateContinuityReviewItem(value: unknown): Promise<ContinuityReviewCandidate>;
  decideContinuityReviewItem(value: unknown): Promise<ContinuityReviewDecisionResult>;
  createCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection>;
  updateCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection>;
  supersedeCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection>;
  retireCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeProjection>;
  listCharacterKnowledge(value: unknown): Promise<CharacterKnowledgeListProjection>;
  projectPovCharacterKnowledge(value: unknown): Promise<PovKnowledgeContextProjection>;
  listAssistantEntityContextPolicies(value: unknown): Promise<AssistantEntityContextPolicyList>;
  saveAssistantEntityContextPolicy(value: unknown): Promise<AssistantEntityContextPolicyProjection>;
  planAssistantContext(value: unknown): Promise<AssistantContextPlanProjection>;
  listAssistantContextManifests(value: unknown): Promise<AssistantContextManifestList>;
  listAssistantContextActivities(value: unknown): Promise<AssistantContextActivityList>;
  generateNarrativeDigest(value: unknown): Promise<NarrativeDigestResult>;
  generateSceneNarrativeDigest(value: unknown): Promise<NarrativeDigestResult>;
  runAutomaticSceneAnalysis(value: unknown): Promise<AutomaticSceneAnalysisResult>;
  listSceneAnalysisRuns(value: unknown): Promise<SceneAnalysisRunListProjection>;
  listNarrativeDigests(value: unknown): Promise<NarrativeDigestListProjection>;
  regenerateNarrativeDigest(value: unknown): Promise<NarrativeDigestResult>;
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
  planWorkSnapshotSceneSelection(value: unknown): Promise<WorkSnapshotSceneSelectionPlan>;
  getManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection>;
  saveManuscriptPreflightSettings(
    value: unknown,
  ): Promise<ManuscriptPreflightSettingsProjection>;
  prepareManuscriptTextExport(
    value: unknown,
  ): Promise<ExportManuscriptTextCommand>;
  prepareCanonicalMarkdownExport(
    value: unknown,
  ): Promise<PreparedCanonicalMarkdownExport>;
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
  const localMediaLibrary = await openNodeLocalMediaLibrary({
    rootDirectoryPath: path.join(
      app.getPath("userData"),
      "local-media-library-v1",
    ),
  });
  protocol.handle("eum-media", async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405 });
    }
    try {
      const source = await localMediaLibrary.resolvePlaybackUrl(request.url);
      return createNodeLocalMediaResponse({
        filePath: source.filePath,
        mediaType: source.mediaType,
        method: request.method,
        rangeHeader: request.headers.get("range"),
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  const uiPreferencesStore = await openNodeUiPreferencesStore({
    rootDirectoryPath: path.join(app.getPath("userData"), "ui-preferences-v2"),
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
    const chatGptContextConnector = assistantConnectorProfile.connectors.find(
      (entry) => entry.connectorKind === chatGptOAuthProfile.providerId,
    );
    if (
      chatGptContextConnector === undefined ||
      !chatGptContextConnector.capabilities.includes("canon.review") ||
      !chatGptContextConnector.capabilities.includes("continuity.review") ||
      !chatGptContextConnector.capabilities.includes("narrative.digest")
    ) {
      throw new Error(
        `Assistant connector manifest is missing Canon/Continuity/NarrativeDigest context budget: ${chatGptOAuthProfile.providerId}`,
      );
    }
    const localWorkspaceDefaults = parseLocalWorkspaceDefaults(
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
    );
    const localRuntime: LocalWorkspaceRuntime =
      await openLocalWorkspaceRuntime({
        rootDirectoryPath:
          configuredRoot ??
          path.join(app.getPath("userData"), "workspace-v1"),
        studioDisplayName: app.getName(),
        locale: app.getLocale(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        batchingPolicy: localWorkspaceDefaults.manuscriptBatchingPolicy,
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
        canonReview: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.reviewCanon(input),
        }),
        continuityReview: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.reviewContinuity(input),
        }),
        narrativeDigest: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          contextTokenBudget: chatGptContextConnector.contextTokenBudget,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.generateNarrativeDigest(input),
        }),
        sceneInformationUpdate: Object.freeze({
          destinationId: chatGptOAuthProfile.providerId,
          isConnected: () => chatGptOAuthStore.getStatus().connected,
          execute: (input) => chatGptCodexClient.updateSceneInformation(input),
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
        defaults: localWorkspaceDefaults,
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
      retireAllDocuments: (value) =>
        localRuntime.retireAllDocuments(value),
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
      moveRangeToEpisode: (value) =>
        localRuntime.moveRangeToEpisode(value),
      undoMoveRangeToEpisode: (value) =>
        localRuntime.undoMoveRangeToEpisode(value),
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
      relocateSceneSegment: (value) =>
        localRuntime.relocateSceneSegment(value),
      listSceneOverrides: (value) =>
        localRuntime.listSceneOverrides(value),
      listSceneProjection: (value) =>
        localRuntime.listSceneProjection(value),
      listSceneCanonContexts: (value) =>
        localRuntime.listSceneCanonContexts(value),
      finalizeSceneCanonCheck: (value) =>
        localRuntime.finalizeSceneCanonCheck(value),
      updateSceneRuleSet: (value) =>
        localRuntime.updateSceneRuleSet(value),
      setSceneEventOverride: (value) =>
        localRuntime.setSceneEventOverride(value),
      rebindSceneMetadata: (value) =>
        localRuntime.rebindSceneMetadata(value),
      prepareSceneDeletion: (value) =>
        localRuntime.prepareSceneDeletion(value),
      deleteScene: (value) => localRuntime.deleteScene(value),
      listSceneTrash: (value) => localRuntime.listSceneTrash(value),
      restoreSceneTrash: (value) => localRuntime.restoreSceneTrash(value),
      undoSceneDeletion: (value) => localRuntime.undoSceneDeletion(value),
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
      createManuscriptAnnotation: (value) =>
        localRuntime.createManuscriptAnnotation(value),
      listManuscriptAnnotations: (value) =>
        localRuntime.listManuscriptAnnotations(value),
      updateManuscriptAnnotation: (value) =>
        localRuntime.updateManuscriptAnnotation(value),
      retireManuscriptAnnotation: (value) =>
        localRuntime.retireManuscriptAnnotation(value),
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
      createPublishingFormTemplate: (value) =>
        localRuntime.createPublishingFormTemplate(value),
      listPublishingFormTemplates: (value) =>
        localRuntime.listPublishingFormTemplates(value),
      updatePublishingFormTemplate: (value) =>
        localRuntime.updatePublishingFormTemplate(value),
      listPublishingFormResponses: (value) =>
        localRuntime.listPublishingFormResponses(value),
      savePublishingFormResponse: (value) =>
        localRuntime.savePublishingFormResponse(value),
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
      getWorkSceneAnalysisSettings: (value) =>
        localRuntime.getWorkSceneAnalysisSettings(value),
      saveWorkSceneAnalysisSettings: (value) =>
        localRuntime.saveWorkSceneAnalysisSettings(value),
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
      runCanonReview: (value) =>
        localRuntime.runCanonReview(value),
      listCanonReviewCandidates: (value) =>
        localRuntime.listCanonReviewCandidates(value),
      updateCanonReviewItem: (value) =>
        localRuntime.updateCanonReviewItem(value),
      resolveCanonReviewItemTarget: (value) =>
        localRuntime.resolveCanonReviewItemTarget(value),
      decideCanonReviewItem: (value) =>
        localRuntime.decideCanonReviewItem(value),
      createContinuityThread: (value) =>
        localRuntime.createContinuityThread(value),
      updateContinuityThread: (value) =>
        localRuntime.updateContinuityThread(value),
      listContinuityThreads: (value) =>
        localRuntime.listContinuityThreads(value),
      resolveContinuityThread: (value) =>
        localRuntime.resolveContinuityThread(value),
      dismissContinuityThread: (value) =>
        localRuntime.dismissContinuityThread(value),
      runContinuityReview: (value) =>
        localRuntime.runContinuityReview(value),
      listContinuityReviewCandidates: (value) =>
        localRuntime.listContinuityReviewCandidates(value),
      updateContinuityReviewItem: (value) =>
        localRuntime.updateContinuityReviewItem(value),
      decideContinuityReviewItem: (value) =>
        localRuntime.decideContinuityReviewItem(value),
      createCharacterKnowledge: (value) =>
        localRuntime.createCharacterKnowledge(value),
      updateCharacterKnowledge: (value) =>
        localRuntime.updateCharacterKnowledge(value),
      supersedeCharacterKnowledge: (value) =>
        localRuntime.supersedeCharacterKnowledge(value),
      retireCharacterKnowledge: (value) =>
        localRuntime.retireCharacterKnowledge(value),
      listCharacterKnowledge: (value) =>
        localRuntime.listCharacterKnowledge(value),
      projectPovCharacterKnowledge: (value) =>
        localRuntime.projectPovCharacterKnowledge(value),
      listAssistantEntityContextPolicies: (value) =>
        localRuntime.listAssistantEntityContextPolicies(value),
      saveAssistantEntityContextPolicy: (value) =>
        localRuntime.saveAssistantEntityContextPolicy(value),
      planAssistantContext: (value) =>
        localRuntime.planAssistantContext(value),
      listAssistantContextManifests: (value) =>
        localRuntime.listAssistantContextManifests(value),
      listAssistantContextActivities: (value) =>
        localRuntime.listAssistantContextActivities(value),
      generateNarrativeDigest: (value) =>
        localRuntime.generateNarrativeDigest(value),
      generateSceneNarrativeDigest: (value) =>
        localRuntime.generateSceneNarrativeDigest(value),
      runAutomaticSceneAnalysis: (value) =>
        localRuntime.runAutomaticSceneAnalysis(value),
      listSceneAnalysisRuns: (value) =>
        localRuntime.listSceneAnalysisRuns(value),
      listNarrativeDigests: (value) =>
        localRuntime.listNarrativeDigests(value),
      regenerateNarrativeDigest: (value) =>
        localRuntime.regenerateNarrativeDigest(value),
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
      planWorkSnapshotSceneSelection: (value) =>
        localRuntime.planWorkSnapshotSceneSelection(value),
      getManuscriptPreflightSettings: (value) =>
        localRuntime.getManuscriptPreflightSettings(value),
      saveManuscriptPreflightSettings: (value) =>
        localRuntime.saveManuscriptPreflightSettings(value),
      prepareManuscriptTextExport: (value) =>
        localRuntime.prepareManuscriptTextExport(value),
      prepareCanonicalMarkdownExport: (value) =>
        localRuntime.prepareCanonicalMarkdownExport(value),
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
      retireAllDocuments: async () => {
        throw new Error(
          "All-Document retirement is unavailable in a configured manuscript runtime",
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
      moveRangeToEpisode: async () => {
        throw new Error(
          "Episode range move is unavailable in a configured manuscript runtime",
        );
      },
      undoMoveRangeToEpisode: async () => {
        throw new Error(
          "Episode range move undo is unavailable in a configured manuscript runtime",
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
      relocateSceneSegment: async (value) => {
        parseRelocateSceneSegmentCommand(value);
        throw new Error(
          "Scene range movement is unavailable in a configured manuscript runtime",
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
      listSceneCanonContexts: async (value) => {
        const command=parseListSceneCanonContextsCommand(value);
        return parseSceneCanonContextListProjection({
          schemaVersion:1,workId:command.workId,contexts:[],
        });
      },
      finalizeSceneCanonCheck: async (value) => {
        parseFinalizeSceneCanonCheckCommand(value);
        throw new Error("Scene Canon check finalization is unavailable in a configured manuscript runtime");
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
      rebindSceneMetadata: async (value) => {
        parseRebindSceneMetadataCommand(value);
        throw new Error(
          "Scene metadata binding is unavailable in a configured manuscript runtime",
        );
      },
      prepareSceneDeletion: async (value) => {
        parsePrepareSceneDeletionCommand(value);
        throw new Error(
          "Scene deletion is unavailable in a configured manuscript runtime",
        );
      },
      deleteScene: async (value) => {
        parseDeleteSceneCommand(value);
        throw new Error(
          "Scene deletion is unavailable in a configured manuscript runtime",
        );
      },
      listSceneTrash: async (value) => {
        parseListSceneTrashCommand(value);
        throw new Error(
          "Scene trash is unavailable in a configured manuscript runtime",
        );
      },
      restoreSceneTrash: async (value) => {
        parseRestoreSceneTrashCommand(value);
        throw new Error(
          "Scene restore is unavailable in a configured manuscript runtime",
        );
      },
      undoSceneDeletion: async (value) => {
        parseUndoSceneDeletionCommand(value);
        throw new Error(
          "Scene deletion undo is unavailable in a configured manuscript runtime",
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
      createManuscriptAnnotation: async () => {
        throw new Error(
          "Manuscript annotations are unavailable in a configured manuscript runtime",
        );
      },
      listManuscriptAnnotations: async (value) => {
        const command = parseListManuscriptAnnotationsCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return parseManuscriptAnnotationListProjection({
          schemaVersion: 1,
          workId: command.workId,
          annotations: [],
        });
      },
      updateManuscriptAnnotation: async () => {
        throw new Error(
          "Manuscript annotations are unavailable in a configured manuscript runtime",
        );
      },
      retireManuscriptAnnotation: async () => {
        throw new Error(
          "Manuscript annotations are unavailable in a configured manuscript runtime",
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
      createPublishingFormTemplate: async () => {
        throw new Error(
          "Publishing form template creation is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingFormTemplates: async (value) => {
        parseListPublishingFormTemplatesCommand(value);
        return parsePublishingFormTemplateListProjection({
          schemaVersion: 1,
          templates: [],
        });
      },
      updatePublishingFormTemplate: async () => {
        throw new Error(
          "Publishing form template update is unavailable in a configured manuscript runtime",
        );
      },
      listPublishingFormResponses: async (value) => {
        parseListPublishingFormResponsesCommand(value);
        return parsePublishingFormResponseListProjection({
          schemaVersion: 1,
          responses: [],
        });
      },
      savePublishingFormResponse: async () => {
        throw new Error(
          "Publishing form response storage is unavailable in a configured manuscript runtime",
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
      getWorkSceneAnalysisSettings: async (value) => {
        const command = parseGetWorkSceneAnalysisSettingsCommand(value);
        if (
          !workspaceCatalog.works.some(
            (work) => work.workId === command.workId,
          )
        ) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        return createDefaultWorkSceneAnalysisSettingsProjection(command.workId);
      },
      saveWorkSceneAnalysisSettings: async () => {
        throw new Error(
          "Work scene analysis settings persistence is unavailable in a configured manuscript runtime",
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
      runCanonReview: async () => {
        throw new Error(
          "Canon review is unavailable in a configured manuscript runtime",
        );
      },
      listCanonReviewCandidates: async (value) => {
        const command = parseListCanonReviewCandidatesCommand(value);
        return parseCanonReviewCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      updateCanonReviewItem: async () => {
        throw new Error(
          "Canon review editing is unavailable in a configured manuscript runtime",
        );
      },
      resolveCanonReviewItemTarget: async () => {
        throw new Error(
          "Canon review target resolution is unavailable in a configured manuscript runtime",
        );
      },
      decideCanonReviewItem: async () => {
        throw new Error(
          "Canon review decisions are unavailable in a configured manuscript runtime",
        );
      },
      createContinuityThread: async () => {
        throw new Error(
          "Continuity creation is unavailable in a configured manuscript runtime",
        );
      },
      updateContinuityThread: async () => {
        throw new Error(
          "Continuity editing is unavailable in a configured manuscript runtime",
        );
      },
      listContinuityThreads: async (value) => {
        const command = parseListContinuityThreadsCommand(value);
        return parseContinuityOverviewProjection({
          schemaVersion: 1,
          workId: command.workId,
          threads: [],
          projectedSources: [],
        });
      },
      resolveContinuityThread: async () => {
        throw new Error(
          "Continuity resolution is unavailable in a configured manuscript runtime",
        );
      },
      dismissContinuityThread: async () => {
        throw new Error(
          "Continuity dismissal is unavailable in a configured manuscript runtime",
        );
      },
      runContinuityReview: async () => {
        throw new Error(
          "Continuity review is unavailable in a configured manuscript runtime",
        );
      },
      listContinuityReviewCandidates: async (value) => {
        const command = parseListContinuityReviewCandidatesCommand(value);
        return parseContinuityReviewCandidateList({
          schemaVersion: 1,
          workId: command.workId,
          candidates: [],
        });
      },
      updateContinuityReviewItem: async () => {
        throw new Error(
          "Continuity review editing is unavailable in a configured manuscript runtime",
        );
      },
      decideContinuityReviewItem: async () => {
        throw new Error(
          "Continuity review decisions are unavailable in a configured manuscript runtime",
        );
      },
      createCharacterKnowledge: async () => {
        throw new Error(
          "CharacterKnowledge creation is unavailable in a configured manuscript runtime",
        );
      },
      updateCharacterKnowledge: async () => {
        throw new Error(
          "CharacterKnowledge editing is unavailable in a configured manuscript runtime",
        );
      },
      supersedeCharacterKnowledge: async () => {
        throw new Error(
          "CharacterKnowledge supersession is unavailable in a configured manuscript runtime",
        );
      },
      retireCharacterKnowledge: async () => {
        throw new Error(
          "CharacterKnowledge retirement is unavailable in a configured manuscript runtime",
        );
      },
      listCharacterKnowledge: async (value) => {
        const command = parseListCharacterKnowledgeCommand(value);
        return parseCharacterKnowledgeListProjection({
          schemaVersion: 1,
          workId: command.workId,
          entries: [],
        });
      },
      projectPovCharacterKnowledge: async (value) => {
        const command = parseProjectPovKnowledgeCommand(value);
        return parsePovKnowledgeContextProjection({
          schemaVersion: 1,
          workId: command.workId,
          characterId: command.characterId,
          objectiveFacts: [],
          povKnown: [],
          povFalseBeliefs: [],
          povUnavailable: [],
        });
      },
      listAssistantEntityContextPolicies: async (value) => {
        const command = parseListAssistantEntityContextPoliciesCommand(value);
        return parseAssistantEntityContextPolicyList({
          schemaVersion: 1,
          workId: command.workId,
          policies: [],
        });
      },
      saveAssistantEntityContextPolicy: async () => {
        throw new Error(
          "Assistant context policy is unavailable in a configured manuscript runtime",
        );
      },
      planAssistantContext: async () => {
        throw new Error(
          "Assistant context planning is unavailable in a configured manuscript runtime",
        );
      },
      listAssistantContextManifests: async (value) => {
        const command = parseListAssistantContextManifestsCommand(value);
        return parseAssistantContextManifestList({
          schemaVersion: 1,
          workId: command.workId,
          manifests: [],
        });
      },
      listAssistantContextActivities: async (value) => {
        const command = parseListAssistantContextActivitiesCommand(value);
        return parseAssistantContextActivityList({
          schemaVersion: 1,
          workId: command.workId,
          activities: [],
        });
      },
      generateNarrativeDigest: async () => {
        throw new Error(
          "NarrativeDigest generation is unavailable in a configured manuscript runtime",
        );
      },
      generateSceneNarrativeDigest: async () => {
        throw new Error(
          "Scene NarrativeDigest generation is unavailable in a configured manuscript runtime",
        );
      },
      runAutomaticSceneAnalysis: async () => {
        throw new Error(
          "Automatic Scene analysis is unavailable in a configured manuscript runtime",
        );
      },
      listSceneAnalysisRuns: async (value) => {
        const command = parseListSceneAnalysisRunsCommand(value);
        return {
          schemaVersion: 1,
          workId: command.workId,
          runs: [],
        };
      },
      listNarrativeDigests: async (value) => {
        const command = parseListNarrativeDigestsCommand(value);
        return parseNarrativeDigestListProjection({
          schemaVersion: 1,
          workId: command.workId,
          digests: [],
        });
      },
      regenerateNarrativeDigest: async () => {
        throw new Error(
          "NarrativeDigest regeneration is unavailable in a configured manuscript runtime",
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
      planWorkSnapshotSceneSelection: async (value) => {
        parsePlanWorkSnapshotSceneSelectionCommand(value);
        throw new Error("WorkSnapshot Scene selection planning is unavailable in a configured manuscript runtime");
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
      prepareCanonicalMarkdownExport: async (value) => {
        const command = parseExportCanonicalMarkdownCommand(value);
        if (!workspaceCatalog.works.some((work) => work.workId === command.workId)) {
          throw new Error(`Unknown Work: ${command.workId}`);
        }
        throw new Error(
          "Canonical Markdown export is unavailable in a configured manuscript runtime",
        );
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

  registerStudioIpc({
    ipcMain,
    authorizeSender: assertTrustedRendererSender,
    runtimes: createApplicationRuntimes(applicationRuntime),
    getRuntimeInfo: () => ({
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      architecture: process.arch,
    }),
    editor: {
      runtime: pickEditorRuntime({
        getManuscriptDocumentProfile: () =>
          manuscriptRuntime.getManuscriptDocumentProfile(),
        getManuscriptPersistenceProfile: () =>
          manuscriptRuntime.getManuscriptPersistenceProfile(),
        getManuscriptStartupRecovery: () =>
          manuscriptRuntime.getManuscriptStartupRecovery(),
        getManuscriptResumeCheckpoint: () =>
          manuscriptRuntime.getManuscriptResumeCheckpoint(),
        getManuscriptPreflightSettings: (command) =>
          applicationRuntime.getManuscriptPreflightSettings(command),
        saveManuscriptPreflightSettings: (command) =>
          applicationRuntime.saveManuscriptPreflightSettings(command),
        getContinuousReadingProgress: (command) =>
          applicationRuntime.getContinuousReadingProgress(command),
        saveContinuousReadingProgress: (command) =>
          applicationRuntime.saveContinuousReadingProgress(command),
        saveChangeBatch: (value) => manuscriptRuntime.saveChangeBatch(value),
        saveDocumentChange: (value) =>
          manuscriptRuntime.saveDocumentChange(value),
        saveFormatting: (value) => manuscriptRuntime.saveFormatting(value),
        moveRangeToEpisode: (value) =>
          applicationRuntime.moveRangeToEpisode(value),
        undoMoveRangeToEpisode: (value) =>
          applicationRuntime.undoMoveRangeToEpisode(value),
        getWorkManuscriptLayoutSettings: (value) =>
          applicationRuntime.getWorkManuscriptLayoutSettings(value),
        saveWorkManuscriptLayoutSettings: (value) =>
          applicationRuntime.saveWorkManuscriptLayoutSettings(value),
        applyManuscriptStartupRecovery: (value) =>
          manuscriptRuntime.applyManuscriptStartupRecovery(value),
      }),
      profiles: {
        input: manuscriptInputProfile,
        formatting: formattingProfile,
        preflight: preflightProfile,
      },
      exportText: async (input) => {
        const command = await applicationRuntime.prepareManuscriptTextExport(
          input,
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
      selectTextImport: async (command) => {
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
      completeCloseRequest: (result) => {
        const request = pendingCloseRequest;
        if (request === null || request.requestId !== result.requestId) {
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
    },
    profiles: {
      appSettings: appSettingsProfile,
      fragment: fragmentProfile,
      foreshadowPoint: foreshadowPointProfile,
      musicSettings: musicSettingsProfile,
      youtubeMusic: youtubeMusicProfile,
    },
    canonicalMarkdownExport: async (input) => {
      const prepared = await applicationRuntime.prepareCanonicalMarkdownExport(input);
      const owner = mainWindow;
      if (owner === null) throw new Error("Main window is unavailable");
      const configuredRoot = process.env.EUM_STUDIO_CANONICAL_MARKDOWN_EXPORT_ROOT_PATH;
      const baseDirectoryPath = configuredRoot ?? (await dialog.showOpenDialog(owner, {
        title: "별빛 Markdown 내보낼 폴더 선택",
        buttonLabel: "이 폴더에 내보내기",
        properties: ["openDirectory", "createDirectory"],
      })).filePaths[0];
      if (baseDirectoryPath === undefined) {
        return { schemaVersion: 1, status: "cancelled" } as const;
      }
      const receipt = await exportNodeCanonicalMarkdownBundle({
        baseDirectoryPath,
        bundle: prepared,
      });
      return {
        schemaVersion: 1,
        status: "completed",
        directoryName: receipt.directoryName,
        fileCount: receipt.fileCount,
        byteLength: receipt.byteLength,
        sourceManifestHash: receipt.sourceManifestHash,
        bundleManifestHash: receipt.bundleManifestHash,
        entityCounts: prepared.entityCounts,
      } as const;
    },
    activityExportRecords: async (command) => {
      const prepared = await applicationRuntime.prepareWorkRecordsExport(
        command,
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
        filters: [{
          name: isJson ? "JSON 문서" : "CSV 문서",
          extensions: [prepared.format],
        }],
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
    assistant: {
      getOAuthStatus: () => chatGptOAuthStore.getStatus(),
      startOAuthLogin: () => chatGptOAuthLogin.startLogin(),
      runChat: (command) => chatGptCodexClient.chat(command.messages),
    },
    backup: {
      create: async () => {
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
      restore: async () => {
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
    },
    uiPreferences: {
      get: () => uiPreferencesStore.get(),
      save: (command) => uiPreferencesStore.save(command),
    },
    musicPlayback: {
      searchVideos: async (command) => Object.freeze({
        schemaVersion: 1,
        query: command.query,
        videos: await youtubeMusicSearchClient.searchVideos(
          command.query,
          youtubeMusicProfile.searchLimit,
        ),
      }),
      selectLocalMedia: async (command) => {
        const configuredPaths =
          process.env.EUM_STUDIO_LOCAL_MEDIA_SELECTION_PATHS;
        let filePaths: readonly string[];
        if (configuredPaths !== undefined) {
          filePaths = configuredLocalMediaSelectionPaths(configuredPaths);
        } else {
          const owner = mainWindow;
          if (owner === null) throw new Error("Main window is unavailable");
          const selection = await dialog.showOpenDialog(owner, {
            title: command.storageMode === "external-reference"
              ? "미디어 원본 위치 연결"
              : "미디어를 앱에 가져오기",
            buttonLabel: command.storageMode === "external-reference"
              ? "연결"
              : "가져오기",
            properties: ["openFile", "multiSelections"],
            filters: [{ name: "미디어 파일", extensions: ["mp3", "mp4"] }],
          });
          if (selection.canceled) {
            return Object.freeze({ schemaVersion: 1, status: "cancelled" });
          }
          filePaths = selection.filePaths;
        }
        if (filePaths.length === 0) {
          return Object.freeze({ schemaVersion: 1, status: "cancelled" });
        }
        return Object.freeze({
          schemaVersion: 1,
          status: "selected",
          workId: command.workId,
          tracks: await localMediaLibrary.register({
            workId: command.workId,
            storageMode: command.storageMode,
            filePaths,
          }),
        });
      },
    },
    migration: {
      runLegacyLoreRehearsal: async () => {
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
    },
    publishing: {
      selectPartnerCsv: async () => {
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
      selectSubmissionCsv: async () => {
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
    },
    workspace: {
      selectCover: async (command) => {
        const owner = mainWindow;
        if (owner === null) throw new Error("Main window is unavailable");
        const selected = await dialog.showOpenDialog(owner, {
          title: "작품 표지 선택",
          buttonLabel: "표지 선택",
          properties: ["openFile"],
          filters: [
            {
              name: "이미지",
              extensions: [
                "png",
                "jpg",
                "jpeg",
                "webp",
                "gif",
                "avif",
                "bmp",
              ],
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
    },
  });
}

function describeDesktopFailure(reason: unknown): string {
  return reason instanceof Error && reason.message.trim().length > 0
    ? reason.message
    : "알 수 없는 데스크톱 오류";
}

function quitAfterDesktopFailure(
  title: string,
  reason: unknown,
): void {
  if (applicationIsQuitting) return;
  applicationIsQuitting = true;
  const detail = describeDesktopFailure(reason);
  console.error(`[eum-studio desktop] ${title}: ${detail}`);
  try {
    dialog.showErrorBox(
      "이음 스튜디오",
      `${title}\n\n${detail}\n\n앱을 다시 실행하면 마지막으로 저장된 원고에서 복구합니다.`,
    );
  } finally {
    app.quit();
  }
}

function activateMainWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  if (shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)) {
    window.show();
    window.focus();
  }
}

function waitForRendererReload(window: BrowserWindow): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const webContents = window.webContents;
    let settled = false;
    const cleanup = () => {
      webContents.removeListener("did-finish-load", handleLoaded);
      webContents.removeListener("did-fail-load", handleFailedLoad);
      webContents.removeListener("render-process-gone", handleRendererGone);
      webContents.removeListener("destroyed", handleDestroyed);
    };
    const finish = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reason === undefined) resolve();
      else reject(reason);
    };
    const handleLoaded = () => finish();
    const handleFailedLoad = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      _validatedUrl: string,
      isMainFrame: boolean,
    ) => {
      if (!isMainFrame || errorCode === -3) return;
      finish(new Error(
        `Renderer reload failed (${errorCode}): ${errorDescription}`,
      ));
    };
    const handleRendererGone = (
      _event: Electron.Event,
      details: Electron.RenderProcessGoneDetails,
    ) => finish(new Error(
      `Renderer exited again during recovery (${details.reason}, ${details.exitCode})`,
    ));
    const handleDestroyed = () => finish(new Error(
      "Renderer was destroyed during recovery",
    ));

    webContents.once("did-finish-load", handleLoaded);
    webContents.on("did-fail-load", handleFailedLoad);
    webContents.once("render-process-gone", handleRendererGone);
    webContents.once("destroyed", handleDestroyed);
    try {
      webContents.reload();
    } catch (reason) {
      finish(reason);
    }
  });
}

function scheduleRendererRecovery(
  window: BrowserWindow,
  failure: Readonly<{ reason: string; exitCode: number }>,
): void {
  if (!shouldRecoverMainWindowRenderer({
    failedWindowIsCurrent: mainWindow === window,
    isQuitting: applicationIsQuitting || allowMainWindowClose,
    recoveryInProgress: rendererRecoveryPromise !== null,
    windowDestroyed: window.isDestroyed(),
    webContentsDestroyed: window.webContents.isDestroyed(),
  })) return;

  const recovery = waitForRendererReload(window).then(() => {
    if (mainWindow === window && !window.isDestroyed()) {
      pendingCloseRequest = null;
      allowMainWindowClose = false;
      activateMainWindow(window);
    }
  });
  rendererRecoveryPromise = recovery;
  void recovery.then(
    () => undefined,
    (reason) => quitAfterDesktopFailure(
      `화면 프로세스를 복구하지 못했습니다 (${failure.reason}, ${failure.exitCode})`,
      reason,
    ),
  ).finally(() => {
    if (rendererRecoveryPromise === recovery) rendererRecoveryPromise = null;
  });
}

async function activateOrCreateMainWindow(): Promise<void> {
  if (
    applicationIsQuitting ||
    !app.isReady() ||
    !applicationHandlersRegistered
  ) return;
  const window = mainWindow;
  if (
    window !== null &&
    canActivateMainWindow({
      windowDestroyed: window.isDestroyed(),
      webContentsDestroyed: window.webContents.isDestroyed(),
      rendererCrashed: !window.webContents.isDestroyed() &&
        window.webContents.isCrashed(),
    })
  ) {
    activateMainWindow(window);
    return;
  }
  if (
    window !== null &&
    !window.isDestroyed() &&
    !window.webContents.isDestroyed() &&
    window.webContents.isCrashed()
  ) {
    scheduleRendererRecovery(window, { reason: "second-instance", exitCode: 0 });
    return;
  }

  const replacement = await createMainWindow();
  if (window !== null && !window.isDestroyed()) {
    window.destroy();
  }
  activateMainWindow(replacement);
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
  window.webContents.on("render-process-gone", (_event, details) => {
    scheduleRendererRecovery(window, details);
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

  try {
    if (configuredRendererUrl === undefined) {
      await window.loadFile(rendererFile);
    } else {
      await window.loadURL(configuredRendererUrl);
    }
  } catch (reason) {
    allowMainWindowClose = true;
    if (!window.isDestroyed()) window.destroy();
    if (mainWindow === window) {
      mainWindow = null;
      configuredRendererTarget = null;
      pendingCloseRequest = null;
      allowMainWindowClose = false;
    }
    throw reason;
  }
  if (
    !window.isDestroyed() &&
    !window.isVisible() &&
    shouldShowMainWindow(process.env.EUM_STUDIO_WINDOW_VISIBILITY)
  ) {
    activateMainWindow(window);
  }

  return window;
}

if (shouldDisableHardwareAcceleration(
  process.env.EUM_STUDIO_HARDWARE_ACCELERATION,
)) {
  app.disableHardwareAcceleration();
}
if (process.env.EUM_STUDIO_DISABLE_SANDBOX !== "1") {
  app.enableSandbox();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  applicationIsQuitting = true;
  app.quit();
} else {
  app.on("second-instance", () => {
    void activateOrCreateMainWindow().catch((reason) => {
      quitAfterDesktopFailure("앱 창을 다시 열지 못했습니다.", reason);
    });
  });
  void app.whenReady().then(async () => {
    await registerApplicationHandlers();
    applicationHandlersRegistered = true;
    mainWindow = await createMainWindow();

    app.on("activate", () => {
      void activateOrCreateMainWindow().catch((reason) => {
        quitAfterDesktopFailure("앱 창을 다시 열지 못했습니다.", reason);
      });
    });
  }).catch((reason) => {
    quitAfterDesktopFailure("앱을 시작하지 못했습니다.", reason);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  applicationIsQuitting = true;
});

app.on("will-quit", () => {
  activeApplicationRuntime?.close();
  activeApplicationRuntime = null;
  activeYouTubePlayerReferer = null;
});
