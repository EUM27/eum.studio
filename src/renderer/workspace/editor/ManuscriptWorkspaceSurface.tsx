import type { ComponentProps, RefObject } from "react";
import { useMemo, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import { FocusModeToolbar, type FocusModeToolbarProps } from "../../editor/FocusModeToolbar";
import {
  ManuscriptEditor,
  type ManuscriptEditorHandle,
} from "../../editor/ManuscriptEditor";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import type { useActivityController } from "../../features/activity/useActivityController";
import type { useEditorToolsController } from "../../features/editor-tools/useEditorToolsController";
import type { useMoveRangeToEpisodeController } from "../../features/editor-tools/useMoveRangeToEpisodeController";
import type { useFocusModeController } from "../../features/activity/useFocusModeController";
import type { useEventWorkspaceController } from "../../features/structure/useEventWorkspaceController";
import type { useSceneWorkspaceController } from "../../features/structure/useSceneWorkspaceController";
import type { useLoreCueController } from "../../features/lore/useLoreCueController";
import type { useReadingLayoutController } from "../session/useReadingLayoutController";
import type { WorkspaceRuntimeState } from "../session/workspace-session-state";

type ReadyWorkspaceRuntime = Extract<
  WorkspaceRuntimeState,
  Readonly<{ status: "ready" }>
>;

function FocusModeToolbarWithTelemetry(
  input: Omit<FocusModeToolbarProps, "currentDocumentCharacterCount"> & {
    readonly telemetryStore: ManuscriptTelemetryStore;
  },
) {
  const { telemetryStore, ...toolbar } = input;
  const statistics = useSyncExternalStore(
    telemetryStore.subscribeStatistics,
    telemetryStore.getStatisticsSnapshot,
  );
  return (
    <FocusModeToolbar
      {...toolbar}
      currentDocumentCharacterCount={statistics.characterCount}
    />
  );
}

type ManuscriptCallbacks = Pick<
  ComponentProps<typeof ManuscriptEditor>,
  | "onCompositionEnd"
  | "onDocumentActivated"
  | "onFormattingChange"
  | "onTransaction"
>;

export function ManuscriptWorkspaceSurface(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeWorkDocuments: readonly ManuscriptDocumentSource[];
  callbacks: ManuscriptCallbacks;
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    editorTools: ReturnType<typeof useEditorToolsController>;
    episodeMove: ReturnType<typeof useMoveRangeToEpisodeController>;
    event: ReturnType<typeof useEventWorkspaceController>;
    focus: ReturnType<typeof useFocusModeController>;
    loreCue: ReturnType<typeof useLoreCueController>;
    readingLayout: ReturnType<typeof useReadingLayoutController>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
  }>;
  editorRef: RefObject<ManuscriptEditorHandle | null>;
  focusStatus: Readonly<{
    forwardWriting: string | null;
    pomodoro: string | null;
    save: string;
    timer: string | null;
  }>;
  loreEntries: ComponentProps<typeof ManuscriptEditor>["loreEntries"];
  navigation: Readonly<{
    activateDocument: (documentId: string) => void;
    closeDocumentTab: (documentId: string) => void;
  }>;
  openDocuments: readonly ManuscriptDocumentSource[];
  runtime: ReadyWorkspaceRuntime | null;
  sceneProjection: SceneProjectionList | null;
  telemetryStore: ManuscriptTelemetryStore;
  titleEditTarget: string | null;
  workspaceActionState: string;
  workspaceSurface: string;
}>) {
  const {
    activeDocument,
    activeWorkDocuments,
    callbacks,
    controllers,
    editorRef,
    focusStatus,
    loreEntries,
    navigation,
    openDocuments,
    runtime,
    sceneProjection,
    telemetryStore,
    titleEditTarget,
    workspaceActionState,
    workspaceSurface,
  } = input;
  const activity = controllers.activity;
  const editorTools = controllers.editorTools;
  const episodeMove = controllers.episodeMove;
  const event = controllers.event;
  const focus = controllers.focus;
  const loreCue = controllers.loreCue;
  const readingLayout = controllers.readingLayout;
  const scene = controllers.scene;
  const manuscriptSceneRanges = useMemo(() => {
    if (activeDocument === null || sceneProjection === null) return [];
    return sceneProjection.scenes
      .filter((candidate) =>
        candidate.documentId === activeDocument.documentId &&
        candidate.range !== null
      )
      .map((candidate) => Object.freeze({
        sceneKey: candidate.sceneKey,
        sceneIndex: candidate.sceneIndex,
        start: candidate.range!.start,
        end: candidate.range!.end,
        integrity: candidate.integrity,
        spansEpisodes: (candidate.sceneIdentity?.segments.length ?? 0) > 1,
      }));
  }, [activeDocument, sceneProjection]);

  return (
    <div
      className="manuscript-workspace-surface"
      hidden={workspaceSurface !== "manuscript"}
    >
      {focus.focusMode && runtime !== null && activeDocument !== null && (
        <FocusModeToolbarWithTelemetry
          contentWidthPx={focus.focusContentWidthPx}
          currentBlockHighlight={focus.focusCurrentBlockHighlight}
          exitLabel={
            editorTools.activeForwardWriting === null
              ? "집중 화면 종료"
              : "수정금지 종료"
          }
          modeLabel={
            editorTools.activeForwardWriting === null ? null : "수정금지 집필"
          }
          modeStatus={focusStatus.forwardWriting}
          onContentWidthChange={focus.changeFocusContentWidth}
          onCurrentBlockHighlightChange={focus.changeFocusCurrentBlockHighlight}
          onExit={() => {
            if (editorTools.activeForwardWriting === null) {
              focus.exitFocusMode();
            } else {
              editorTools.stopForwardWriting();
            }
          }}
          onTypewriterModeChange={focus.changeFocusTypewriterMode}
          onTypewriterPositionChange={focus.changeFocusTypewriterPosition}
          onZoomChange={focus.changeFocusZoom}
          pomodoroPhase={activity.activePomodoroPhase?.phase ?? null}
          pomodoroStatus={focusStatus.pomodoro}
          saveStatus={focusStatus.save}
          timerStatus={focusStatus.timer}
          telemetryStore={telemetryStore}
          typewriterMode={focus.focusTypewriterMode}
          typewriterPositionPercent={focus.focusTypewriterPositionPercent}
          zoomPercent={focus.focusZoomPercent}
        />
      )}
      {runtime !== null && activeDocument !== null && (
        <nav aria-label="열린 회차 탭" className="document-tab-strip">
          <div className="document-tab-list" role="tablist">
            {openDocuments.map((document) => {
              const isActive = document.documentId === runtime.activeDocumentId;
              return (
                <div
                  className={
                    isActive
                      ? "document-tab-item document-tab-item-active"
                      : "document-tab-item"
                  }
                  key={document.documentId}
                >
                  <button
                    aria-selected={isActive}
                    className="document-tab-activate"
                    disabled={
                      workspaceActionState !== "idle" ||
                      titleEditTarget !== null
                    }
                    onClick={() =>
                      navigation.activateDocument(document.documentId)
                    }
                    role="tab"
                    tabIndex={isActive ? 0 : -1}
                    type="button"
                  >
                    {document.label}
                  </button>
                  <button
                    aria-label={`${document.label} 탭 닫기`}
                    className="document-tab-close"
                    disabled={
                      openDocuments.length === 1 ||
                      workspaceActionState !== "idle" ||
                      titleEditTarget !== null
                    }
                    onClick={() =>
                      navigation.closeDocumentTab(document.documentId)
                    }
                    title="탭 닫기"
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </nav>
      )}
      {runtime !== null && activeDocument !== null && (
        <ManuscriptEditor
          accessibleName="원고"
          activeDocument={activeDocument}
          formattingProfile={runtime.formattingProfile}
          {...(focus.focusMode && workspaceSurface === "manuscript"
            ? {
                focusPresentation: {
                  active: true,
                  contentWidthPx: focus.focusContentWidthPx,
                  currentBlockHighlight: focus.focusCurrentBlockHighlight,
                  typewriterMode: focus.focusTypewriterMode,
                  typewriterPositionPercent:
                    focus.focusTypewriterPositionPercent,
                  zoomPercent: focus.focusZoomPercent,
                },
              }
            : {})}
          forwardWriteProtectedLength={
            editorTools.activeForwardWriting?.protectedLength ?? null
          }
          heatmapMode={editorTools.heatmapMode}
          inputProfile={runtime.inputProfile}
          {...(readingLayout.workManuscriptLayout?.workId === activeDocument.workId
            ? {
                layoutSettings: readingLayout.workManuscriptLayout.settings,
              }
            : {})}
          loreEntries={loreEntries}
          canMoveToNextEpisode={episodeMove.canMoveToNextEpisode}
          orderedDocuments={activeWorkDocuments}
          onBlur={activity.handleDocumentBlur}
          onAddEvent={event.openContextEventDialog}
          onAddScene={() => {
            void scene.createSceneBoundary();
          }}
          onMergeScene={() => {
            void scene.mergeCurrentSceneWithPrevious();
          }}
          onSplitScene={() => {
            void scene.createSceneBoundary("split");
          }}
          onSceneBoundaryHistoryToggle={(entry, active) => {
            void scene.applySceneBoundaryHistory(entry, active);
          }}
          onCompositionEnd={callbacks.onCompositionEnd}
          onDocumentActivated={callbacks.onDocumentActivated}
          onFormattingChange={callbacks.onFormattingChange}
          onHeatmapModeChange={editorTools.changeHeatmapMode}
          onLayoutSettingsChange={readingLayout.handleWorkManuscriptLayoutChange}
          onImportText={() => {
            void editorTools.selectManuscriptTextImport();
          }}
          onMoveToNextEpisode={() => {
            void episodeMove.moveHereToNextEpisode();
          }}
          onLoreCueHover={loreCue.handleLoreCueHover}
          onOpenLoreCue={loreCue.openLoreCueInspector}
          onOpenContinuousReading={() => {
            void readingLayout.openContinuousReading();
          }}
          onOpenAnalysis={editorTools.openManuscriptAnalysis}
          onOpenPreflight={editorTools.openManuscriptPreflight}
          onTransaction={callbacks.onTransaction}
          onUndoExternal={episodeMove.requestUndoLastMove}
          readOnly={
            runtime.startupRecovery.status !== "clean" ||
            workspaceActionState === "setting-document-completion" ||
            episodeMove.actionState !== "idle"
          }
          ref={editorRef}
          resumeLocation={
            runtime.resumeCheckpoint.status === "resolved"
              ? runtime.resumeCheckpoint
              : null
          }
          sceneBoundaryPreviews={scene.sceneBoundaryPreviews}
          sceneRanges={manuscriptSceneRanges}
        />
      )}
      {editorTools.preflightActionError !== null && (
        <p className="preflight-open-error" role="alert">
          {editorTools.preflightActionError}
        </p>
      )}
      {editorTools.manuscriptTextImportError !== null &&
        editorTools.manuscriptTextImport === null && (
          <p className="preflight-open-error" role="alert">
            {editorTools.manuscriptTextImportError}
          </p>
        )}
      {readingLayout.continuousReadingOpenError !== null && (
        <p className="preflight-open-error" role="alert">
          {readingLayout.continuousReadingOpenError}
        </p>
      )}
      {episodeMove.actionError !== null && (
        <p className="preflight-open-error" role="alert">
          {episodeMove.actionError}
        </p>
      )}
    </div>
  );
}
