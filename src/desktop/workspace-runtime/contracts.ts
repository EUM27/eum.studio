import type { PomodoroProjection } from "../../application/activity/pomodoro-contract";
import type { WorkActivityProjection } from "../../application/activity/work-activity-contract";
import type { WorkReadthroughProjection } from "../../application/activity/work-readthrough-calculator";
import type { PreparedWorkRecordsExport } from "../../application/activity/work-records-export";
import type { WorkRecordsGoalsProjection } from "../../application/activity/work-records-preferences";
import type { AssistantConnectorExecutionReceipt } from "../../application/assistant/assistant-connector-manifest";
import type { AssistantContextAccessResult,AssistantContextPermissionGrant,AssistantContextRequest } from "../../application/assistant/assistant-context-permission";
import type { AssistantContextStateProjection } from "../../application/assistant/assistant-context-state";
import type { AssistantDestinationProfile } from "../../application/assistant/assistant-destination-profile";
import type { AssistantExternalSettingReviewResult } from "../../application/assistant/assistant-external-setting-review";
import type { AssistantNotationReviewResult } from "../../application/assistant/assistant-notation-review";
import type { CancelAssistantRequestResult } from "../../application/assistant/assistant-request-lifecycle";
import type { AssistantSettingReviewResult,AssistantSettingReviewSource } from "../../application/assistant/assistant-setting-review";
import type { AssistantVocabularyLookupResult } from "../../application/assistant/assistant-vocabulary-lookup";
import type { AssistantVocabularySuggestionResult } from "../../application/assistant/assistant-vocabulary-suggestion";
import type { CanonReviewCandidate,CanonReviewCandidateList,CanonReviewDecisionResult,CanonReviewResult } from "../../application/canon/canon-review-contract";
import type { CanonReviewConnectorInput,CanonReviewExecution } from "../../application/canon/canon-review-model-output";
import type { CharacterListProjection,CharacterProjection } from "../../application/characters/character-contract";
import type { CharacterExtractionCandidateList,CharacterExtractionDecisionResult,CharacterExtractionModelPayload,CharacterExtractionParagraph,CharacterExtractionResult } from "../../application/characters/character-extraction-contract";
import { CHARACTER_EXTRACTION_PROMPT_VERSION } from "../../application/characters/character-extraction-contract";
import type { CharacterGenerationBrief,CharacterGenerationCandidateList,CharacterGenerationDecisionResult,CharacterGenerationModelPayload,CharacterGenerationResult } from "../../application/characters/character-generation-contract";
import { CHARACTER_GENERATION_PROMPT_VERSION } from "../../application/characters/character-generation-contract";
import type { CharacterRelationListProjection,CharacterRelationProjection } from "../../application/characters/character-relation-contract";
import type { ManuscriptResumeCheckpointProjection } from "../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { AssistantContextActivityList,AssistantContextManifestList,AssistantContextPlanProjection } from "../../application/continuity/assistant-context-manifest";
import type { AssistantEntityContextPolicyList,AssistantEntityContextPolicyProjection } from "../../application/continuity/assistant-context-policy";
import type { CharacterKnowledgeListProjection,CharacterKnowledgeProjection,PovKnowledgeContextProjection } from "../../application/continuity/character-knowledge-contract";
import type { ContinuityReviewCandidate,ContinuityReviewCandidateList,ContinuityReviewDecisionResult,ContinuityReviewResult } from "../../application/continuity/continuity-review-contract";
import type { ContinuityReviewConnectorInput,ContinuityReviewExecution } from "../../application/continuity/continuity-review-model-output";
import type { ContinuityOverviewProjection,ContinuityThreadProjection } from "../../application/continuity/continuity-thread-contract";
import type { NarrativeDigestListProjection,NarrativeDigestResult } from "../../application/continuity/narrative-digest-contract";
import type { AutomaticSceneAnalysisResult,SceneAnalysisRunListProjection } from "../../application/continuity/scene-analysis-run-contract";
import type { SceneInformationUpdateConnectorInput,SceneInformationUpdateExecution } from "../../application/continuity/scene-information-update-contract";
import type { WorkContinuousReadingProgressProjection } from "../../application/editor/continuous-reading-progress";
import type { ManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import type { ManuscriptFormattingProfile } from "../../application/editor/manuscript-formatting";
import type { ExportManuscriptTextCommand,ManuscriptPreflightProfile,ManuscriptPreflightSettingsProjection } from "../../application/editor/manuscript-preflight";
import type { MoveRangeToEpisodeReceipt } from "../../application/editor/move-range-to-episode";
import type { WorkManuscriptLayoutSettingsProjection } from "../../application/editor/work-manuscript-layout-settings";
import type { PreparedCanonicalMarkdownExport } from "../../application/export/canonical-markdown-export";
import type { ForeshadowLineListProjection,ForeshadowLineProjection } from "../../application/foreshadowing/foreshadow-line-contract";
import type { ForeshadowPointListProjection,ForeshadowPointProfile,ForeshadowPointProjection } from "../../application/foreshadowing/foreshadow-point-contract";
import type { FragmentListProjection,FragmentProjection,FragmentShelfProfile } from "../../application/fragments/fragment-contract";
import type { WorkInspirationSettingsProjection } from "../../application/inspiration/work-inspiration-settings";
import type { LoreCandidateApprovalResult,LoreCandidateListProjection,LoreCandidateProjection } from "../../application/lore/lore-candidate-contract";
import type { LoreEntryListProjection,LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type { LoreForeshadowLinkListProjection,LoreForeshadowLinkProjection } from "../../application/lore/lore-foreshadow-link-contract";
import type { SceneMusicQueueCandidate,SceneMusicQueueCandidateList,SceneMusicQueueSearchResult } from "../../application/music/scene-music-queue-contract";
import type { MusicSettingsProfile,WorkMusicSettingsProjection } from "../../application/music/work-music-settings";
import type { YouTubeVideoProjection } from "../../application/music/youtube-music";
import type { ManuscriptBatchingPolicy } from "../../application/persistence/manuscript-persistence-profile";
import type { PlotBoardProjection } from "../../application/plots/plot-board-contract";
import type { PlotThreadListProjection,PlotThreadProjection } from "../../application/plots/plot-contract";
import type { PlotEventLinkListProjection,PlotEventLinkMutationProjection } from "../../application/plots/plot-event-link-contract";
import type { PlotThreadSourceListProjection,PlotThreadSourceProjection } from "../../application/plots/plot-source-contract";
import type { PublishingAssistantApprovalResult,PublishingAssistantRegistry,PublishingAssistantResult } from "../../application/publishing/publishing-assistant-contract";
import type { PublishingContractListProjection,PublishingContractProjection } from "../../application/publishing/publishing-contract-contract";
import type { PublishingEvidenceLinksProjection } from "../../application/publishing/publishing-evidence-link-contract";
import type { PublishingFormResponseListProjection,PublishingFormResponseProjection,PublishingFormTemplateListProjection,PublishingFormTemplateProjection } from "../../application/publishing/publishing-form-contract";
import type { PublishingMailCandidateListProjection,PublishingMailCandidateProjection,PublishingMailCandidateReviewResult } from "../../application/publishing/publishing-mail-candidate-contract";
import type { PublishingPartnerListProjection,PublishingPartnerProjection } from "../../application/publishing/publishing-partner-contract";
import type { PublishingPartnerCsvImportResult } from "../../application/publishing/publishing-partner-csv-import";
import type { PublishingPaymentListProjection,PublishingPaymentProjection } from "../../application/publishing/publishing-payment-contract";
import type { PublishingPublicationListProjection,PublishingPublicationProjection } from "../../application/publishing/publishing-publication-contract";
import type { PublishingResearchApprovalResult,PublishingResearchCandidateProjection } from "../../application/publishing/publishing-research-contract";
import type { PublishingSettlementListProjection,PublishingSettlementProjection } from "../../application/publishing/publishing-settlement-contract";
import type { PublishingSourceListProjection,PublishingSourceProjection } from "../../application/publishing/publishing-source-contract";
import type { PublishingSubmissionListProjection,PublishingSubmissionProjection } from "../../application/publishing/publishing-submission-contract";
import type { PublishingSubmissionCsvImportResult } from "../../application/publishing/publishing-submission-csv-import";
import type { WorkQuickMemoProjection } from "../../application/quick-tools/work-quick-memo";
import type { ManuscriptAnnotationListProjection,ManuscriptAnnotationProjection } from "../../application/review/manuscript-annotation-contract";
import type { WorkSnapshotComparisonProjection } from "../../application/revisions/work-snapshot-comparison";
import type { WorkSnapshotSceneSelectionPlan } from "../../application/revisions/work-snapshot-scene-plan";
import type { DocumentRevisionContentProjection,DocumentRevisionListProjection,RestoreDocumentRevisionResult,WorkSnapshotListProjection,WorkSnapshotProjection } from "../../application/revisions/work-version-contract";
import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import type { WorkScheduleItemProjection,WorkScheduleProjection } from "../../application/schedule/work-schedule-contract";
import type { AppSettingsProfile,AppSettingsProjection } from "../../application/settings/app-settings";
import type { WorkSceneAnalysisSettingsProjection } from "../../application/settings/work-scene-analysis-settings";
import type { LocalWorkspaceBackupMode,LocalWorkspaceBackupStatusProjection,LocalWorkspaceBackupSummary } from "../../application/storage/local-workspace-backup-contract";
import type { LocalWorkspaceBackupProfile } from "../../application/storage/local-workspace-backup-profile";
import type { EventBlockListProjection,EventBlockProjection,EventSourceProjection } from "../../application/structure/event-block-contract";
import type { EventRailProjection } from "../../application/structure/event-rail-projection";
import type { SceneAnnotationList } from "../../application/structure/scene-annotation-contract";
import type { SceneCanonCheckProjection,SceneCanonContextListProjection } from "../../application/structure/scene-canon-context";
import type { PrepareSceneDraftInsertionResult,RunSceneDraftResult,SceneDraftCandidate,SceneDraftCandidateList,SceneDraftContext,SceneDraftModelPayload } from "../../application/structure/scene-draft-contract";
import { SCENE_DRAFT_PROMPT_VERSION } from "../../application/structure/scene-draft-contract";
import type { SceneExtractionAnnotationDecisionResult,SceneExtractionCandidateList,SceneExtractionDecisionResult,SceneExtractionModelPayload,SceneExtractionParagraph,SceneExtractionResult } from "../../application/structure/scene-extraction-contract";
import { SCENE_EXTRACTION_PROMPT_VERSION } from "../../application/structure/scene-extraction-contract";
import type { SceneMetadataBindingProjection } from "../../application/structure/scene-metadata-binding-contract";
import type { SceneOverrideListProjection,SceneOverrideProjection } from "../../application/structure/scene-override-contract";
import type { SceneProjectionList } from "../../application/structure/scene-projection";
import type { SceneDeletionPreview,SceneDeletionReceipt,SceneTrashListProjection } from "../../application/structure/scene-trash-contract";
import type { StudioTodayProjection } from "../../application/today/studio-today-contract";
import type { DocumentCompletionProjection } from "../../application/workspace/document-completion";
import type { LocalWorkspaceDefaults } from "../../application/workspace/local-workspace-defaults";
import type { WorkCoverProjection,WorkCoversProjection } from "../../application/workspace/work-covers";
import type { WorkFavoritesProjection } from "../../application/workspace/work-favorites";
import type { CreateDocumentResult,CreateFirstWorkResult,CreateWorkResult,WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import type { EntityId } from "../../domain/writing";
import type { NarrativeDigestConnector } from "../continuity/local-narrative-digest-runtime";
import type { ManuscriptRuntimeCoordinator } from "../manuscript-runtime-coordinator";

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
    captureFragment(value: unknown): Promise<FragmentProjection>;
    listFragments(value: unknown): Promise<FragmentListProjection>;
    updateFragment(value: unknown): Promise<FragmentProjection>;
    recordFragmentUse(value: unknown): Promise<FragmentProjection>;
    retireFragment(value: unknown): Promise<FragmentProjection>;
    createManuscriptAnnotation(
      value: unknown,
    ): Promise<ManuscriptAnnotationProjection>;
    listManuscriptAnnotations(
      value: unknown,
    ): Promise<ManuscriptAnnotationListProjection>;
    updateManuscriptAnnotation(
      value: unknown,
    ): Promise<ManuscriptAnnotationProjection>;
    retireManuscriptAnnotation(
      value: unknown,
    ): Promise<ManuscriptAnnotationProjection>;
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
    cancelAssistantRequest(value: unknown): CancelAssistantRequestResult;
    runAssistantExternalSettingReview(
      value: unknown,
    ): Promise<AssistantExternalSettingReviewResult>;
    runCanonReview(value: unknown): Promise<CanonReviewResult>;
    listCanonReviewCandidates(
      value: unknown,
    ): Promise<CanonReviewCandidateList>;
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
    decideContinuityReviewItem(
      value: unknown,
    ): Promise<ContinuityReviewDecisionResult>;
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
    createBackupBundle(finalBundleRoot: string, mode?: LocalWorkspaceBackupMode): Promise<LocalWorkspaceBackupSummary>;
    restoreBackupBundle(
      finalBundleRoot: string,
      targetFinalRoot: string,
    ): Promise<LocalWorkspaceBackupSummary>;
    close(): void;
  };

export type CharacterExtractionExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof CHARACTER_EXTRACTION_PROMPT_VERSION;
  payload: CharacterExtractionModelPayload;
}>;

export type CharacterGenerationExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof CHARACTER_GENERATION_PROMPT_VERSION;
  payload: CharacterGenerationModelPayload;
}>;

export type SceneExtractionExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof SCENE_EXTRACTION_PROMPT_VERSION;
  payload: SceneExtractionModelPayload;
}>;

export type SceneDraftExecution = Readonly<{
  providerId: string;
  modelId: string;
  promptVersion: typeof SCENE_DRAFT_PROMPT_VERSION;
  payload: SceneDraftModelPayload;
}>;

export type LocalWorkspaceRuntimeOptions = {
  readonly rootDirectoryPath: string;
  readonly localMediaLibraryRootDirectoryPath: string;
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
      signal: AbortSignal;
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
      signal: AbortSignal;
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
  readonly canonReview?: Readonly<{
    destinationId: string;
    contextTokenBudget: number;
    isConnected: () => boolean;
    execute: (input: CanonReviewConnectorInput) => Promise<CanonReviewExecution>;
  }>;
  readonly continuityReview?: Readonly<{
    destinationId: string;
    contextTokenBudget: number;
    isConnected: () => boolean;
    execute: (
      input: ContinuityReviewConnectorInput,
    ) => Promise<ContinuityReviewExecution>;
  }>;
  readonly narrativeDigest?: NarrativeDigestConnector;
  readonly sceneInformationUpdate?: Readonly<{
    destinationId: string;
    isConnected: () => boolean;
    execute: (
      input: SceneInformationUpdateConnectorInput,
    ) => Promise<SceneInformationUpdateExecution>;
  }>;
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

