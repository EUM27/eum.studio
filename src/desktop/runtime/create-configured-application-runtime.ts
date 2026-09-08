import { randomUUID } from "node:crypto";
import { parseGetPomodoroCommand, parsePomodoroProjection } from "../../application/activity/pomodoro-contract";
import { parseListWorkActivityCommand, parseStartWritingSessionCommand, parseStopWritingSessionCommand, parseWorkActivityProjection, type WorkActivityProjection } from "../../application/activity/work-activity-contract";
import { createUnsetWorkReadthrough, parseGetWorkReadthroughCommand } from "../../application/activity/work-readthrough-calculator";
import { parseExportWorkRecordsCommand } from "../../application/activity/work-records-export";
import { createUnsetWorkRecordsGoals, parseGetWorkRecordsGoalsCommand } from "../../application/activity/work-records-preferences";
import { parseCancelAssistantRequestCommand } from "../../application/assistant/assistant-request-lifecycle";
import { parseCanonReviewCandidateList, parseListCanonReviewCandidatesCommand } from "../../application/canon/canon-review-contract";
import { parseCharacterListProjection, parseListCharactersCommand } from "../../application/characters/character-contract";
import { parseCharacterExtractionCandidateList, parseListCharacterExtractionCandidatesCommand } from "../../application/characters/character-extraction-contract";
import { parseCharacterGenerationCandidateList, parseListCharacterGenerationCandidatesCommand } from "../../application/characters/character-generation-contract";
import { parseCharacterRelationListProjection, parseListCharacterRelationsCommand } from "../../application/characters/character-relation-contract";
import { parseAssistantContextActivityList, parseAssistantContextManifestList, parseListAssistantContextActivitiesCommand, parseListAssistantContextManifestsCommand } from "../../application/continuity/assistant-context-manifest";
import { parseAssistantEntityContextPolicyList, parseListAssistantEntityContextPoliciesCommand } from "../../application/continuity/assistant-context-policy";
import { parseCharacterKnowledgeListProjection, parseListCharacterKnowledgeCommand, parsePovKnowledgeContextProjection, parseProjectPovKnowledgeCommand } from "../../application/continuity/character-knowledge-contract";
import { parseContinuityReviewCandidateList, parseListContinuityReviewCandidatesCommand } from "../../application/continuity/continuity-review-contract";
import { parseContinuityOverviewProjection, parseListContinuityThreadsCommand } from "../../application/continuity/continuity-thread-contract";
import { parseListNarrativeDigestsCommand, parseNarrativeDigestListProjection } from "../../application/continuity/narrative-digest-contract";
import { parseListSceneAnalysisRunsCommand } from "../../application/continuity/scene-analysis-run-contract";
import { createUnsetContinuousReadingProgress, parseGetContinuousReadingProgressCommand } from "../../application/editor/continuous-reading-progress";
import { parseManuscriptDocumentProfile } from "../../application/editor/manuscript-document-profile";
import { createDefaultManuscriptPreflightSettings, parseExportManuscriptTextCommand, parseGetManuscriptPreflightSettingsCommand } from "../../application/editor/manuscript-preflight";
import { createDefaultWorkManuscriptLayoutSettingsProjection, parseGetWorkManuscriptLayoutSettingsCommand, parseSaveWorkManuscriptLayoutSettingsCommand, parseWorkManuscriptLayoutSettingsProjection, type WorkManuscriptLayoutSettingsProjection } from "../../application/editor/work-manuscript-layout-settings";
import { parseExportCanonicalMarkdownCommand } from "../../application/export/canonical-markdown-export";
import { parseForeshadowLineListProjection, parseListForeshadowLinesCommand } from "../../application/foreshadowing/foreshadow-line-contract";
import { parseForeshadowPointListProjection, parseListForeshadowPointsCommand } from "../../application/foreshadowing/foreshadow-point-contract";
import { parseFragmentListProjection, parseListFragmentsCommand } from "../../application/fragments/fragment-contract";
import { createDefaultWorkInspirationSettingsProjection, parseGetWorkInspirationSettingsCommand } from "../../application/inspiration/work-inspiration-settings";
import { parseCreateLoreCandidateCommand, parseListLoreCandidatesCommand, parseLoreCandidateListProjection, parseReviewLoreCandidateCommand } from "../../application/lore/lore-candidate-contract";
import { parseListLoreEntriesCommand, parseLoreEntryListProjection } from "../../application/lore/lore-entry-contract";
import { parseListLoreForeshadowLinksCommand, parseLoreForeshadowLinkListProjection } from "../../application/lore/lore-foreshadow-link-contract";
import { parseListSceneMusicQueueCandidatesCommand, parseSceneMusicQueueCandidateList, parseSearchSceneMusicQueuesCommand, parseSelectSceneMusicQueueCommand } from "../../application/music/scene-music-queue-contract";
import { createDefaultWorkMusicSettingsProjection, parseGetWorkMusicSettingsCommand } from "../../application/music/work-music-settings";
import { parseGetDefaultPlotBoardCommand, parseMovePlotPlacementCommand, parseSetPlotPlacementStoryTimeCommand } from "../../application/plots/plot-board-contract";
import { parseListPlotThreadsCommand, parsePlotThreadListProjection } from "../../application/plots/plot-contract";
import { parseListPlotEventLinksCommand, parsePlotEventLinkListProjection } from "../../application/plots/plot-event-link-contract";
import { parseListPlotThreadSourcesCommand, parsePlotThreadSourceListProjection } from "../../application/plots/plot-source-contract";
import { parseApprovePublishingAssistantCandidateCommand, parseRunPublishingAssistantCommand } from "../../application/publishing/publishing-assistant-contract";
import { parseListPublishingContractsCommand, parsePublishingContractListProjection } from "../../application/publishing/publishing-contract-contract";
import { parseSetPublishingEvidenceLinksCommand } from "../../application/publishing/publishing-evidence-link-contract";
import { parseListPublishingFormResponsesCommand, parseListPublishingFormTemplatesCommand, parsePublishingFormResponseListProjection, parsePublishingFormTemplateListProjection } from "../../application/publishing/publishing-form-contract";
import { parseLinkPublishingMailCandidateCommand, parseListPublishingMailCandidatesCommand, parsePublishingMailCandidateListProjection, parseRecordPublishingMailCandidateCommand, parseReviewPublishingMailCandidateCommand, parseUpdatePublishingMailCandidateCommand } from "../../application/publishing/publishing-mail-candidate-contract";
import { parseConnectPublishingMailCommand, parseDisconnectPublishingMailCommand, parseGetPublishingMailConnectionCommand, parsePublishingMailConnectionProjection, parseSyncPublishingMailCommand } from "../../application/publishing/publishing-mail-connection-contract";
import { parseGetPublishingMailScheduleCommand, parsePublishingMailScheduleProjection, parseSavePublishingMailScheduleCommand } from "../../application/publishing/publishing-mail-schedule-contract";
import { parseListPublishingPartnersCommand, parsePublishingPartnerListProjection } from "../../application/publishing/publishing-partner-contract";
import { parseApplyPublishingPartnerCsvImportCommand } from "../../application/publishing/publishing-partner-csv-import";
import { parseListPublishingPaymentsCommand, parsePublishingPaymentListProjection } from "../../application/publishing/publishing-payment-contract";
import { parseListPublishingPublicationsCommand, parsePublishingPublicationListProjection } from "../../application/publishing/publishing-publication-contract";
import { parseApprovePublishingResearchCommand, parsePreviewPublishingResearchCommand } from "../../application/publishing/publishing-research-contract";
import { parseListPublishingSettlementsCommand, parsePublishingSettlementListProjection } from "../../application/publishing/publishing-settlement-contract";
import { parseListPublishingSourcesCommand, parsePublishingSourceListProjection } from "../../application/publishing/publishing-source-contract";
import { parseListPublishingSubmissionsCommand, parsePublishingSubmissionListProjection } from "../../application/publishing/publishing-submission-contract";
import { parseApplyPublishingSubmissionCsvImportCommand } from "../../application/publishing/publishing-submission-csv-import";
import { parseGetWorkQuickMemoCommand } from "../../application/quick-tools/work-quick-memo";
import { parseListManuscriptAnnotationsCommand, parseManuscriptAnnotationListProjection } from "../../application/review/manuscript-annotation-contract";
import { parseCompareWorkSnapshotCommand } from "../../application/revisions/work-snapshot-comparison";
import { parsePlanWorkSnapshotSceneSelectionCommand } from "../../application/revisions/work-snapshot-scene-plan";
import { parseDocumentRevisionListProjection, parseListDocumentRevisionsCommand, parseListWorkSnapshotsCommand, parseReadDocumentRevisionCommand, parseWorkSnapshotListProjection } from "../../application/revisions/work-version-contract";
import { parseWorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import { parseListWorkScheduleCommand, parseWorkScheduleProjection } from "../../application/schedule/work-schedule-contract";
import { createDefaultAppSettingsProjection, deriveWorkEpisodeCharacterProgress } from "../../application/settings/app-settings";
import { createDefaultWorkSceneAnalysisSettingsProjection, parseGetWorkSceneAnalysisSettingsCommand } from "../../application/settings/work-scene-analysis-settings";
import { parseEventBlockListProjection, parseListEventBlocksCommand } from "../../application/structure/event-block-contract";
import { parseListEventRailCommand } from "../../application/structure/event-rail-projection";
import { parseListSceneAnnotationsCommand, parseSceneAnnotationList } from "../../application/structure/scene-annotation-contract";
import { parseFinalizeSceneCanonCheckCommand, parseListSceneCanonContextsCommand, parseSceneCanonContextListProjection } from "../../application/structure/scene-canon-context";
import { parseCompleteSceneDraftInsertionCommand, parseListSceneDraftCandidatesCommand, parsePrepareSceneDraftInsertionCommand, parseRunSceneDraftCommand, parseSceneDraftCandidateList, parseUpdateSceneDraftCandidateCommand } from "../../application/structure/scene-draft-contract";
import { parseListSceneExtractionCandidatesCommand, parseSceneExtractionCandidateList } from "../../application/structure/scene-extraction-contract";
import { parseRebindSceneMetadataCommand } from "../../application/structure/scene-metadata-binding-contract";
import { parseListSceneOverridesCommand, parseRelocateSceneSegmentCommand, parseSceneOverrideListProjection } from "../../application/structure/scene-override-contract";
import { parseListSceneProjectionCommand, parseSetSceneEventOverrideCommand, parseUpdateSceneRuleSetCommand } from "../../application/structure/scene-projection";
import { parseDeleteSceneCommand, parseListSceneTrashCommand, parsePrepareSceneDeletionCommand, parseRestoreSceneTrashCommand, parseUndoSceneDeletionCommand } from "../../application/structure/scene-trash-contract";
import { parseGetStudioTodayCommand, projectStudioToday } from "../../application/today/studio-today-contract";
import { parseClearDocumentCompletionCommand, parseCompleteDocumentCommand, parseGetDocumentCompletionCommand } from "../../application/workspace/document-completion";
import { parseSaveWorkCoverCommand, parseWorkCoverProjection, parseWorkCoversProjection } from "../../application/workspace/work-covers";
import { parseSetWorkFavoriteCommand, parseWorkFavoritesProjection } from "../../application/workspace/work-favorites";
import { parseActivateWorkspaceLocationCommand, parseWorkspaceCatalogProjection, type WorkspaceCatalogProjection } from "../../application/workspace/workspace-contract";
import { openNodeYouTubeMusicConnectionStore } from "../../platform/music/node-youtube-music-connection-store";
import { createManuscriptRuntimeCoordinator } from "../manuscript-runtime-coordinator";
import { type Poc2CrashGateStage } from "../poc-2-crash-gate-profile";
import type { ApplicationRuntime } from "./application-runtime-contract";
import type { ApplicationProfiles } from "./load-application-profiles";

type ConfiguredApplicationRuntimeInput = Readonly<Pick<ApplicationProfiles, "documentProfile" | "journalProfile" | "batchingPolicy" | "recoveryApplyProfile" | "resumeCheckpointProfile" | "crashGate" | "formattingProfile" | "publishingMailConnectorProfile" | "appSettingsProfile" | "musicSettingsProfile" | "assistantConnectorProfile" | "assistantDestinationProfile" | "preflightProfile"> & {
  youtubeMusicConnectionStore: Pick<Awaited<ReturnType<typeof openNodeYouTubeMusicConnectionStore>>, "getStatus" | "save">;
}>;

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

export async function createConfiguredApplicationRuntime(input: ConfiguredApplicationRuntimeInput): Promise<ApplicationRuntime> {
  const { documentProfile, journalProfile, batchingPolicy, recoveryApplyProfile, resumeCheckpointProfile, crashGate, formattingProfile, publishingMailConnectorProfile, appSettingsProfile, musicSettingsProfile, youtubeMusicConnectionStore, assistantConnectorProfile, assistantDestinationProfile, preflightProfile } = input;

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
  const runtime: ApplicationRuntime = {
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
      const command = parseListSceneCanonContextsCommand(value);
      return parseSceneCanonContextListProjection({
        schemaVersion: 1, workId: command.workId, contexts: [],
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
    cancelAssistantRequest: (value) => {
      parseCancelAssistantRequestCommand(value);
      return Object.freeze({ schemaVersion: 1, status: "not-running" });
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

  return runtime;
}
