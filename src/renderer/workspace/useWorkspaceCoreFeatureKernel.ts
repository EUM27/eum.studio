import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";

import type { StudioBridge } from "../../application/contracts/studio-bridge";
import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import { getPreviousEpisodeFlowPreviewText } from "../../application/editor/previous-episode-flow";
import type {
  WorkspaceCatalogProjection,
  WorkspaceWorkSummary,
} from "../../application/workspace/workspace-contract";
import type { WritingSessionProjection } from "../../application/activity/work-activity-contract";
import type { EntityId } from "../../domain/writing";
import type { ManuscriptEditorHandle } from "../editor/ManuscriptEditor";
import { useActivityController } from "../features/activity/useActivityController";
import { useAssistantController } from "../features/assistant/useAssistantController";
import { useManuscriptAnnotationsController } from "../features/annotations/useManuscriptAnnotationsController";
import { useCanonReviewController } from "../features/canon/useCanonReviewController";
import { useContinuityController } from "../features/continuity/useContinuityController";
import { useCharacterKnowledgeController } from "../features/knowledge/useCharacterKnowledgeController";
import { useContextPlannerController } from "../features/context/useContextPlannerController";
import { useNarrativeDigestController } from "../features/digest/useNarrativeDigestController";
import { useCharactersController } from "../features/characters/useCharactersController";
import { useEditorToolsController } from "../features/editor-tools/useEditorToolsController";
import { useManuscriptSearchController } from "../features/editor-tools/useManuscriptSearchController";
import { useInspirationController } from "../features/inspiration/useInspirationController";
import { useLoreController } from "../features/lore/useLoreController";
import { useLoreCueController } from "../features/lore/useLoreCueController";
import { usePomodoroMusicController } from "../features/music/usePomodoroMusicController";
import { useScheduleController } from "../features/schedule/useScheduleController";
import { useEventWorkspaceController } from "../features/structure/useEventWorkspaceController";
import type { useWorkspaceStructureKernel } from "../features/structure/useWorkspaceStructureKernel";
import { useVersionController } from "../features/version/useVersionController";
import { useDocumentCompletionController } from "./documents/useDocumentCompletionController";
import type { useManuscriptFocusController } from "../features/activity/useManuscriptFocusController";
import type { useWorkspaceLifecycle } from "./lifecycle/useWorkspaceLifecycle";
import type { useWorkspaceLayoutController } from "./layout/useWorkspaceLayoutController";
import type { DocumentNavigationSurfaceWaiter } from "./navigation/useWorkspaceDocumentNavigatorController";
import type { useWorkspaceNavigationState } from "./navigation/useWorkspaceNavigationController";
import type { DocumentNavigationWorkspaceSnapshot } from "./session/WorkspaceSessionStore";
import {
  createDocumentNavigationWorkspaceSnapshot,
  selectWorkspaceSessionOpenDocumentIds,
} from "./session/WorkspaceSessionStore";
import type { usePersistenceCoordinator } from "./session/usePersistenceCoordinator";
import { useReadingLayoutController } from "./session/useReadingLayoutController";
import type { useResumeCheckpointController } from "./session/useResumeCheckpointController";
import { RuntimeBootstrapController } from "./session/RuntimeBootstrapController";
import type { useWorkspaceRuntimeProjectionController } from "./session/useWorkspaceRuntimeProjectionController";
import type { useWorkspaceSession } from "./session/useWorkspaceSession";
import { projectWorkspaceRails } from "../workspace-rail-state";

export type ManuscriptResumePreview = Readonly<{
  workId: ManuscriptDocumentSource["workId"];
  documentId: ManuscriptDocumentSource["documentId"];
  text: string;
  formatting: Readonly<{
    fontFamily: string;
    fontSizePx: number;
    contentWidthPx: number;
    lineHeight: number;
    paragraphSpacingPx: number;
    letterSpacingEm: number;
  }>;
}>;

export function useWorkspaceCoreFeatureKernel(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | undefined;
  activeWork: WorkspaceWorkSummary | undefined;
  activeWorkId: EntityId<"Work"> | null;
  activityRefs: Readonly<{
    activeWritingSessionRef: MutableRefObject<
      WritingSessionProjection | undefined
    >;
    manuscriptFocusOwnedWritingSessionIdRef: MutableRefObject<
      EntityId<"WritingSession"> | null
    >;
    manuscriptFocusSessionPendingRef: MutableRefObject<Promise<void>>;
  }>;
  captureResumeForDocument: ReturnType<
    typeof useResumeCheckpointController
  >["captureResume"];
  client: StudioBridge;
  controllers: Readonly<{
    manuscriptFocus: ReturnType<typeof useManuscriptFocusController>;
    layout: ReturnType<typeof useWorkspaceLayoutController>;
    lifecycle: ReturnType<typeof useWorkspaceLifecycle>;
    navigation: ReturnType<typeof useWorkspaceNavigationState>;
  }>;
  documentNavigationSurfaceWaitersRef: MutableRefObject<
    DocumentNavigationSurfaceWaiter[]
  >;
  documentNavigationWorkspaceRef: MutableRefObject<
    DocumentNavigationWorkspaceSnapshot
  >;
  documentRailHost: HTMLElement | null | undefined;
  installRuntimeProjection: ReturnType<
    typeof useWorkspaceRuntimeProjectionController
  >["installRuntimeProjection"];
  manuscriptEditorRef: RefObject<ManuscriptEditorHandle | null>;
  onCatalogChange: ((catalog: WorkspaceCatalogProjection) => void) | undefined;
  onResumePreviewChange:
    | ((preview: ManuscriptResumePreview | null) => void)
    | undefined;
  onScheduleChange: (() => void) | undefined;
  persistence: Pick<
    ReturnType<typeof usePersistenceCoordinator>,
    | "continuousReadingLocationRef"
    | "continuousReadingPersistenceLane"
    | "continuousReadingProgressRef"
    | "durableSaveQueueRef"
    | "saveStateStore"
    | "workManuscriptLayoutByWorkRef"
    | "workManuscriptLayoutChangeSequenceRef"
    | "workManuscriptLayoutLoadSequenceRef"
    | "workManuscriptLayoutPersistenceLane"
  >;
  persistDocument: (document: ManuscriptDocumentSource) => Promise<void>;
  runtimeBootstrapController: RuntimeBootstrapController;
  scheduleSettingsRevision: number;
  session: ReturnType<typeof useWorkspaceSession>;
  structureKernel: ReturnType<typeof useWorkspaceStructureKernel>;
}>) {
  const {
    activeDocument,
    activeWork,
    activeWorkId,
    captureResumeForDocument,
    documentNavigationSurfaceWaitersRef,
    documentNavigationWorkspaceRef,
    documentRailHost,
    installRuntimeProjection,
    manuscriptEditorRef,
    onCatalogChange,
    onResumePreviewChange,
    onScheduleChange,
    persistDocument,
    runtimeBootstrapController,
    scheduleSettingsRevision,
  } = input;
  const {
    activeWritingSessionRef,
    manuscriptFocusOwnedWritingSessionIdRef,
    manuscriptFocusSessionPendingRef,
  } = input.activityRefs;
  const {
    setManuscriptFocusActive,
    manuscriptFocusActive,
  } = input.controllers.manuscriptFocus;
  const {
    openRail: openWorkspaceLayoutRail,
    railState,
  } = input.controllers.layout;
  const {
    setWorkspaceActionError,
    setWorkspaceActionState,
    workspaceActionState,
  } = input.controllers.lifecycle;
  const {
    showWorkSection,
    workSection,
  } = input.controllers.navigation;
  const {
    continuousReadingLocationRef,
    continuousReadingPersistenceLane,
    continuousReadingProgressRef,
    durableSaveQueueRef,
    saveStateStore,
    workManuscriptLayoutByWorkRef,
    workManuscriptLayoutChangeSequenceRef,
    workManuscriptLayoutLoadSequenceRef,
    workManuscriptLayoutPersistenceLane,
  } = input.persistence;
  const {
    documentTabSession,
    runtime,
    setRuntime,
  } = input.session;
  const {
    eventBlocks,
    eventMutations,
    eventWorkspaceState,
    listSceneMusicQueueCandidates,
    loreCueState,
    loreLinksCompatibility,
    playMusicQueue,
    refreshEventProjection,
    replaceSceneMusicQueueCandidates,
    replaceSceneProjection,
    workMusicSettings,
  } = input.structureKernel;

    const eventWorkspaceEditorPort = useMemo(() => ({
      readDocumentState: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.readDocumentState(document),
      materializeDocumentText: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.materializeDocumentText(document),
    }), [manuscriptEditorRef]);
    const eventWorkspaceControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      activeWorkId: activeWork?.workId ?? null,
      editor: eventWorkspaceEditorPort,
      eventMutations,
      persistDocument,
      refreshEventProjection,
      state: eventWorkspaceState,
    }), [
      activeDocument,
      activeWork,
      eventMutations,
      eventWorkspaceEditorPort,
      eventWorkspaceState,
      persistDocument,
      refreshEventProjection,
    ]);
    const eventWorkspaceController = useEventWorkspaceController(
      eventWorkspaceControllerInput,
    );
    const manuscriptAnnotationsEditorPort = useMemo(() => ({
      readSelection: (document: ManuscriptDocumentSource) => {
        const summary = manuscriptEditorRef.current?.readDocumentState(document);
        const selection =
          summary?.selection.ranges[summary.selection.mainIndex];
        return selection === undefined
          ? undefined
          : Object.freeze({
              anchor: selection.anchor,
              head: selection.head,
              from: selection.from,
              to: selection.to,
              empty: selection.empty,
            });
      },
      materializeDocumentText: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.materializeDocumentText(document),
      persistDocument,
    }), [manuscriptEditorRef, persistDocument]);
    const manuscriptAnnotationsController =
      useManuscriptAnnotationsController({
        activeDocument: activeDocument ?? null,
        activeWorkId,
        client: input.client.manuscriptAnnotations,
        editor: manuscriptAnnotationsEditorPort,
      });
    const {
      refreshEventRailAfterPlotChange,
    } = eventWorkspaceController;
    const loreCueEditorPort = useMemo(() => ({
      selectDocumentRange: (
        document: ManuscriptDocumentSource,
        range: Readonly<{ from: number; to: number }>,
      ) => manuscriptEditorRef.current?.selectDocumentRange(
        document,
        range,
      ) ?? false,
    }), [manuscriptEditorRef]);
    const openLoreCueInspectorRail = useCallback((workId: EntityId<"Work">) => {
      openWorkspaceLayoutRail(workId, "right");
    }, [openWorkspaceLayoutRail]);
    const loreCueControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      captureResume: captureResumeForDocument,
      editor: loreCueEditorPort,
      openInspectorRail: openLoreCueInspectorRail,
      state: loreCueState,
    }), [
      activeDocument,
      captureResumeForDocument,
      loreCueEditorPort,
      loreCueState,
      openLoreCueInspectorRail,
    ]);
    const loreCueController = useLoreCueController(loreCueControllerInput);
    const readManuscriptForSearch = useCallback((
      document: ManuscriptDocumentSource,
    ) => manuscriptEditorRef.current?.materializeDocumentText(document) ??
      document.initialText, [manuscriptEditorRef]);
    const manuscriptSearchControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      documents: runtime.status === "ready"
        ? runtime.documentProfile.documents
        : [],
      readManuscript: readManuscriptForSearch,
      ready: runtime.status === "ready",
    }), [activeDocument, readManuscriptForSearch, runtime]);
    const manuscriptSearchController = useManuscriptSearchController(
      manuscriptSearchControllerInput,
    );
    const assistantDocumentPort = useMemo(() => {
      if (activeDocument === undefined) return null;
      return ({
        source: activeDocument,
        readSelection: () => {
          const summary = manuscriptEditorRef.current?.readDocumentState(
            activeDocument,
          );
          const selection =
            summary?.selection.ranges[summary.selection.mainIndex];
          return selection === undefined
            ? undefined
            : Object.freeze({
                from: selection.from,
                to: selection.to,
                empty: selection.empty,
              });
        },
        materializeText: () =>
          manuscriptEditorRef.current?.materializeDocumentText(activeDocument) ??
          activeDocument.initialText,
        persist: () => persistDocument(activeDocument),
        getCurrentRevisionId: () =>
          durableSaveQueueRef.current?.getCurrentRevisionId(
            activeDocument.documentId,
          ) ?? null,
      });
    }, [activeDocument, durableSaveQueueRef, manuscriptEditorRef, persistDocument]);
    const assistantController = useAssistantController({
      client: input.client.assistant,
      workspace: {
        activeWorkId,
        document: assistantDocumentPort,
      },
    });
    const {
      assistantConversationId,
      chatGptOAuthStatus,
      publishAssistantOAuthStatus,
    } = assistantController;
    const reloadAfterVersionRestore = useCallback(async (
      documentId: EntityId<"Document">,
    ) => {
      const projection = await runtimeBootstrapController.load();
      installRuntimeProjection(projection, documentId);
      onCatalogChange?.(projection.catalog);
    }, [installRuntimeProjection, onCatalogChange, runtimeBootstrapController]);
    const versionControllerInput = useMemo(() => Object.freeze({
      client: input.client.version,
      document: activeDocument ?? null,
      persistDocument,
      reloadAfterRestore: reloadAfterVersionRestore,
    }), [activeDocument, input.client.version, persistDocument, reloadAfterVersionRestore]);
    const versionController = useVersionController(versionControllerInput);
    const {
      versionActionState,
      loadDocumentRevisionPreview,
    } = versionController;
    const inspirationControllerInput = useMemo(() => Object.freeze({
      activeWorkId,
      client: input.client.settings,
    }), [activeWorkId, input.client.settings]);
    const inspirationController = useInspirationController(
      inspirationControllerInput,
    );
    const scheduleControllerInput = useMemo(() => Object.freeze({
      activeWorkId,
      client: input.client.schedule,
      ...(onScheduleChange === undefined ? {} : { onScheduleChange }),
      settingsRevision: scheduleSettingsRevision,
    }), [activeWorkId, input.client.schedule, onScheduleChange, scheduleSettingsRevision]);
    const scheduleController = useScheduleController(scheduleControllerInput);
    const {
      workSchedule,
    } = scheduleController;
    const editorToolsPort = useMemo(() => ({
      isAvailable: () => manuscriptEditorRef.current !== null,
      readDocumentState: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.readDocumentState(document),
      materializeDocumentText: (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.materializeDocumentText(document),
      replaceDocumentRange: (
        document: ManuscriptDocumentSource,
        range: Readonly<{ from: number; to: number }>,
        expectedSource: string,
        result: string,
      ) => manuscriptEditorRef.current?.replaceDocumentRange(
        document,
        range,
        expectedSource,
        result,
      ) ?? false,
      selectDocumentRange: (
        document: ManuscriptDocumentSource,
        range: Readonly<{ from: number; to: number }>,
      ) => manuscriptEditorRef.current?.selectDocumentRange(document, range) ?? false,
      setManuscriptFocusActive,
    }), [setManuscriptFocusActive, manuscriptEditorRef]);
    const activeWorkDocuments = useMemo(
      () =>
        runtime.status === "ready" && activeWork !== undefined
          ? runtime.documentProfile.documents.filter(
              (document) => document.workId === activeWork.workId,
            )
          : [],
      [activeWork, runtime],
    );
    const editorToolsController = useEditorToolsController({
      client: input.client.editor,
      document: activeDocument ?? null,
      documents: activeWorkDocuments,
      editor: editorToolsPort,
      workTitle: activeWork?.title ?? null,
    });
    const {
      activeForwardWriting,
    } = editorToolsController;
    const continuousReadingCoordination = useMemo(() => Object.freeze({
      progressRef: continuousReadingProgressRef,
      locationRef: continuousReadingLocationRef,
      lane: continuousReadingPersistenceLane,
    }), [
      continuousReadingLocationRef,
      continuousReadingPersistenceLane,
      continuousReadingProgressRef,
    ]);
    const manuscriptLayoutCoordination = useMemo(() => Object.freeze({
      byWorkRef: workManuscriptLayoutByWorkRef,
      lane: workManuscriptLayoutPersistenceLane,
      loadSequenceRef: workManuscriptLayoutLoadSequenceRef,
      changeSequenceRef: workManuscriptLayoutChangeSequenceRef,
    }), [
      workManuscriptLayoutByWorkRef,
      workManuscriptLayoutChangeSequenceRef,
      workManuscriptLayoutLoadSequenceRef,
      workManuscriptLayoutPersistenceLane,
    ]);
    const materializeReadingDocumentText = useCallback(
      (document: ManuscriptDocumentSource) =>
        manuscriptEditorRef.current?.materializeDocumentText(document),
      [manuscriptEditorRef],
    );
    const readingLayoutControllerInput = useMemo(() => ({
      activeDocument: activeDocument ?? null,
      activeWorkId,
      client: input.client.editor,
      documents: activeWorkDocuments,
      ready: runtime.status === "ready",
      durableSaveQueueRef,
      persistDocument,
      materializeDocumentText: materializeReadingDocumentText,
      continuousReading: continuousReadingCoordination,
      layout: manuscriptLayoutCoordination,
    }), [activeDocument, activeWorkDocuments, activeWorkId, continuousReadingCoordination, durableSaveQueueRef, input.client.editor, manuscriptLayoutCoordination, materializeReadingDocumentText, persistDocument, runtime.status]);
    const readingLayoutController = useReadingLayoutController(
      readingLayoutControllerInput,
    );
    const {
      workManuscriptLayout,
    } = readingLayoutController;
    useEffect(() => {
      documentNavigationWorkspaceRef.current =
        createDocumentNavigationWorkspaceSnapshot({
          source: runtime.status === "ready" ? runtime : null,
          activeDocument,
        });
    }, [activeDocument, documentNavigationWorkspaceRef, runtime]);
    useEffect(() => {
      if (
        workSection !== "write" ||
        documentNavigationSurfaceWaitersRef.current.length === 0
      ) {
        return;
      }
      const waiters = documentNavigationSurfaceWaitersRef.current;
      documentNavigationSurfaceWaitersRef.current = [];
      for (const waiter of waiters) waiter.resolve("transitioned");
    }, [documentNavigationSurfaceWaitersRef, workSection]);
    const publishResumePreview = useCallback(
      (document: ManuscriptDocumentSource | undefined) => {
        if (document === undefined || runtime.status !== "ready") {
          onResumePreviewChange?.(null);
          return;
        }
        const editor = manuscriptEditorRef.current;
        const manuscript = editor?.materializeDocumentText(document) ?? document.initialText;
        const text = getPreviousEpisodeFlowPreviewText(manuscript);
        const workLayout =
          workManuscriptLayout?.workId === document.workId
            ? workManuscriptLayout.settings
            : null;
        const defaults = runtime.formattingProfile.defaults;
        const fontFamilyId = workLayout?.fontFamilyId ?? defaults.fontFamilyId;
        const fontFamily = runtime.formattingProfile.fontFamilies.find(
          (candidate) => candidate.id === fontFamilyId,
        );
        if (fontFamily === undefined) {
          throw new Error(`Unknown manuscript font family: ${fontFamilyId}`);
        }
        onResumePreviewChange?.(
          text.length === 0
            ? null
            : Object.freeze({
                workId: document.workId,
                documentId: document.documentId,
                text,
                formatting: Object.freeze({
                  fontFamily: fontFamily.cssFamily,
                  fontSizePx: workLayout?.fontSizePx ?? defaults.fontSizePx,
                  contentWidthPx:
                    workLayout?.contentWidthPx ??
                    defaults.contentWidthPx,
                  lineHeight:
                    workLayout?.lineHeight ??
                    defaults.lineHeight,
                  paragraphSpacingPx:
                    workLayout?.paragraphSpacingPx ??
                    defaults.paragraphSpacingPx,
                  letterSpacingEm:
                    workLayout?.letterSpacingEm ??
                    defaults.letterSpacingEm,
                }),
              }),
        );
      },
      [manuscriptEditorRef, onResumePreviewChange, runtime, workManuscriptLayout],
    );
    useEffect(() => {
      publishResumePreview(activeDocument);
    }, [activeDocument, publishResumePreview]);
    const sharesDocumentRailWithSidebar =
      documentRailHost !== null && documentRailHost !== undefined;
    const activeDocumentSummary = activeWork?.documents.find(
      (document) => document.documentId === activeDocument?.documentId,
    );
    const documentCompletionAction = useMemo(() => Object.freeze({
      state: workspaceActionState,
      setError: setWorkspaceActionError,
      setState: setWorkspaceActionState,
    }), [
      setWorkspaceActionError,
      setWorkspaceActionState,
      workspaceActionState,
    ]);
    const waitForDocumentCompletionFrame = useCallback(() =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      }), []);
    const getDocumentCompletionQueue = useCallback(
      () => durableSaveQueueRef.current,
      [durableSaveQueueRef],
    );
    const installDocumentCompletionCatalog = useCallback((
      catalog: WorkspaceCatalogProjection,
    ) => {
      setRuntime((current) =>
        current.status === "ready" ? { ...current, catalog } : current
      );
      onCatalogChange?.(catalog);
    }, [onCatalogChange, setRuntime]);
    const documentCompletionControllerInput = useMemo(() => ({
      action: documentCompletionAction,
      beforeFlush: waitForDocumentCompletionFrame,
      client: input.client.workspace,
      document: activeDocument ?? null,
      getQueue: getDocumentCompletionQueue,
      installCatalog: installDocumentCompletionCatalog,
      loadRevisionPreview: loadDocumentRevisionPreview,
      ...(onScheduleChange === undefined ? {} : { onScheduleChange }),
      ready: runtime.status === "ready",
      summary: activeDocumentSummary ?? null,
    }), [activeDocument, activeDocumentSummary, documentCompletionAction, getDocumentCompletionQueue, input.client.workspace, installDocumentCompletionCatalog, loadDocumentRevisionPreview, onScheduleChange, runtime.status, waitForDocumentCompletionFrame]);
    const documentCompletionController = useDocumentCompletionController(
      documentCompletionControllerInput,
    );
    const activeWorkDocumentIds = useMemo(
      () =>
        activeWorkDocuments.map((document) => document.documentId),
      [activeWorkDocuments],
    );
    const activeWorkDocumentLabels = useMemo(
      () =>
        Object.freeze(
          Object.fromEntries(
            activeWorkDocuments.map((document) => [
              document.documentId,
              document.label,
            ]),
          ),
        ),
      [activeWorkDocuments],
    );
    const openDocumentTabIds = useMemo(
      () =>
        selectWorkspaceSessionOpenDocumentIds({
          session: documentTabSession,
          activeWorkId,
          orderedDocumentIds: activeWorkDocumentIds,
          activeDocumentId:
            runtime.status === "ready"
              ? runtime.activeDocumentId
              : null,
        }),
      [
        activeWorkId,
        activeWorkDocumentIds,
        documentTabSession,
        runtime,
      ],
    );
    const openDocuments = useMemo(() => {
      const openDocumentIds = new Set(openDocumentTabIds);
      return activeWorkDocuments.filter((document) =>
        openDocumentIds.has(document.documentId),
      );
    }, [activeWorkDocuments, openDocumentTabIds]);
    const activeWorkEventBlocks =
      activeWork === undefined
        ? []
        : eventBlocks.filter(
            (eventBlock) => eventBlock.workId === activeWork.workId,
          );
    const railProjection =
      activeDocument === undefined
        ? null
        : projectWorkspaceRails(railState, activeDocument.workId);
    const pomodoroMusicControllerInput = useMemo(() => ({
      listSceneMusicQueueCandidates,
      playMusicQueue,
      readDocumentState: eventWorkspaceEditorPort.readDocumentState,
      replaceSceneMusicQueueCandidates,
      replaceSceneProjection,
      structureClient: input.client.structure,
      workMusicSettings,
    }), [eventWorkspaceEditorPort.readDocumentState, input.client.structure, listSceneMusicQueueCandidates, playMusicQueue, replaceSceneMusicQueueCandidates, replaceSceneProjection, workMusicSettings]);
    const playMusicForPomodoroStart = usePomodoroMusicController(
      pomodoroMusicControllerInput,
    );
    const playMusicForPomodoroStartRef = useRef(playMusicForPomodoroStart);
    useEffect(() => {
      playMusicForPomodoroStartRef.current = playMusicForPomodoroStart;
    }, [playMusicForPomodoroStart]);
    const playMusicForPomodoroStartPort = useCallback(
      (document: ManuscriptDocumentSource) =>
        playMusicForPomodoroStartRef.current(document),
      [],
    );
    const activityCoordination = useMemo(() => Object.freeze({
      activeWritingSessionRef,
      manuscriptFocusOwnedWritingSessionIdRef,
      manuscriptFocusSessionPendingRef,
    }), [
      activeWritingSessionRef,
      manuscriptFocusOwnedWritingSessionIdRef,
      manuscriptFocusSessionPendingRef,
    ]);
    const activityControllerInput = useMemo(() => ({
      activeWorkId,
      client: input.client.activity,
      document: activeDocument ?? null,
      manuscriptFocusActive,
      coordination: activityCoordination,
      persistDocument,
      onPomodoroStarted: playMusicForPomodoroStartPort,
    }), [activeDocument, activeWorkId, activityCoordination, manuscriptFocusActive, input.client.activity, persistDocument, playMusicForPomodoroStartPort]);
    const activityController = useActivityController(activityControllerInput);
    const {
      pomodoro,
      activityClock,
      activeFocusCycle,
      activePomodoroPhase,
    } = activityController;
    const resetCharacterWorkspaceSurfaceAfterNullWork = useCallback(() => {
      showWorkSection("write");
    }, [showWorkSection]);
    const charactersWorkspaceCompatibility = useMemo(() => Object.freeze({
      publishOAuthStatus: publishAssistantOAuthStatus,
      resetWorkspaceSurfaceAfterNullWork:
        resetCharacterWorkspaceSurfaceAfterNullWork,
    }), [
      publishAssistantOAuthStatus,
      resetCharacterWorkspaceSurfaceAfterNullWork,
    ]);
    const charactersController = useCharactersController({
      activeDocument: activeDocument ?? null,
      activeWorkId,
      assistantClient: input.client.assistant,
      assistantConversationId,
      client: input.client.characters,
      workLoadId: activeWorkId,
      workspace: charactersWorkspaceCompatibility,
    });
    const {
      characters,
      characterRelations,
      selectedCharacterId,
    } = charactersController;
    const loreController = useLoreController({
      activeDocument: activeDocument ?? null,
      activeWorkId,
      candidatesClient: input.client.loreCandidates,
      entriesClient: input.client.loreEntries,
      links: loreLinksCompatibility,
      workLoadId: activeWorkId,
    });
    const {
      loreEntries,
      loreCandidates,
      selectedLoreEntryId,
      loreActionState,
      refreshLoreCandidates,
      refreshCanonicalEntries,
      sharedLinkAction: loreSharedLinkAction,
    } = loreController;
    const {
      refreshCanonicalRecords: refreshCharacterCanonicalRecords,
    } = charactersController;
    const characterKnowledgeController = useCharacterKnowledgeController({
      activeWorkId,
      client: input.client.characterKnowledge,
      workLoadId: activeWorkId,
    });
    const refreshCharacterKnowledge = characterKnowledgeController.refresh;
    const refreshCanonicalRecords = useCallback(async () => {
      await Promise.all([
        refreshCharacterCanonicalRecords(),
        refreshCanonicalEntries(),
        refreshCharacterKnowledge(),
      ]);
    }, [
      refreshCharacterKnowledge,
      refreshCanonicalEntries,
      refreshCharacterCanonicalRecords,
    ]);
    const canonReviewController = useCanonReviewController({
      activeWorkId,
      assistantClient: input.client.assistant,
      client: input.client.canon,
      conversationId: assistantConversationId,
      refreshCanonical: refreshCanonicalRecords,
      workLoadId: activeWorkId,
    });
    const continuityController = useContinuityController({
      activeWorkId,
      assistantClient: input.client.assistant,
      client: input.client.continuity,
      conversationId: assistantConversationId,
      workLoadId: activeWorkId,
    });
    const contextPlannerController = useContextPlannerController({
      activeWorkId,
      assistantClient: input.client.assistant,
      client: input.client.contextPlanner,
      workLoadId: activeWorkId,
    });
    const narrativeDigestController = useNarrativeDigestController({
      activeWorkId,
      assistantClient: input.client.assistant,
      client: input.client.narrativeDigest,
      conversationId: assistantConversationId,
      workLoadId: activeWorkId,
    });
  
  return {
    eventWorkspaceEditorPort,
    eventWorkspaceController,
    manuscriptAnnotationsController,
    refreshEventRailAfterPlotChange,
    loreCueController,
    manuscriptSearchController,
    assistantController,
    assistantConversationId,
    chatGptOAuthStatus,
    versionController,
    versionActionState,
    inspirationController,
    scheduleController,
    workSchedule,
    editorToolsController,
    activeForwardWriting,
    activeWorkDocuments,
    readingLayoutController,
    publishResumePreview,
    sharesDocumentRailWithSidebar,
    activeDocumentSummary,
    documentCompletionController,
    activeWorkDocumentIds,
    activeWorkDocumentLabels,
    openDocuments,
    activeWorkEventBlocks,
    railProjection,
    saveStateStore,
    activityController,
    pomodoro,
    activityClock,
    activeFocusCycle,
    activePomodoroPhase,
    charactersController,
    characters,
    characterRelations,
    selectedCharacterId,
    loreController,
    loreEntries,
    loreCandidates,
    selectedLoreEntryId,
    loreActionState,
    refreshLoreCandidates,
    loreSharedLinkAction,
    canonReviewController,
    continuityController,
    characterKnowledgeController,
    contextPlannerController,
    narrativeDigestController,
  };
}
