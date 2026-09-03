import type { ComponentProps, RefObject } from "react";
import { useMemo, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import type { SceneProjectionList } from "../../../application/structure/scene-projection";
import { ManuscriptFocusToolbar, type ManuscriptFocusToolbarProps } from "../../editor/ManuscriptFocusToolbar";
import {
  ManuscriptEditor,
  type ManuscriptEditorHandle,
} from "../../editor/ManuscriptEditor";
import { ManuscriptTelemetryStore } from "../../editor/manuscript-telemetry-store";
import type { useActivityController } from "../../features/activity/useActivityController";
import type { useManuscriptAnnotationsController } from "../../features/annotations/useManuscriptAnnotationsController";
import type { useEditorToolsController } from "../../features/editor-tools/useEditorToolsController";
import type { useMoveRangeToEpisodeController } from "../../features/editor-tools/useMoveRangeToEpisodeController";
import type { useManuscriptFocusController } from "../../features/activity/useManuscriptFocusController";
import type { useEventWorkspaceController } from "../../features/structure/useEventWorkspaceController";
import type { useSceneWorkspaceController } from "../../features/structure/useSceneWorkspaceController";
import type { useLoreCueController } from "../../features/lore/useLoreCueController";
import type { useReadingLayoutController } from "../session/useReadingLayoutController";
import type { useAutomaticSceneAnalysisController } from "../../features/analysis/useAutomaticSceneAnalysisController";
import {
  MANUSCRIPT_SAVE_STATE_LABELS,
  type ManuscriptSaveStateStore,
} from "../../persistence/manuscript-save-state-store";
import type { WorkspaceRuntimeState } from "../session/workspace-session-state";

type ReadyWorkspaceRuntime = Extract<
  WorkspaceRuntimeState,
  Readonly<{ status: "ready" }>
>;

function ManuscriptFocusToolbarWithTelemetry(
  input: Omit<
    ManuscriptFocusToolbarProps,
    "currentDocumentCharacterCount" | "modeStatus" | "saveStatus"
  > & {
    readonly activeDocumentId: ManuscriptDocumentSource["documentId"];
    readonly forwardWriting: ReturnType<
      typeof useEditorToolsController
    >["activeForwardWriting"];
    readonly recoveryStatus: ReadyWorkspaceRuntime["startupRecovery"]["status"];
    readonly saveStateStore: ManuscriptSaveStateStore;
    readonly telemetryStore: ManuscriptTelemetryStore;
  },
) {
  const {
    activeDocumentId,
    forwardWriting,
    recoveryStatus,
    saveStateStore,
    telemetryStore,
    ...toolbar
  } = input;
  const statistics = useSyncExternalStore(
    telemetryStore.subscribeStatistics,
    telemetryStore.getStatisticsSnapshot,
  );
  const saveStates = useSyncExternalStore(
    saveStateStore.subscribe,
    saveStateStore.getSnapshot,
  );
  const saveState = saveStates[activeDocumentId] ?? null;
  const saveStatus = recoveryStatus === "recovery-pending"
    ? "복구 적용 대기"
    : recoveryStatus === "read-only-error"
      ? "복구 확인 필요"
      : saveState === null
        ? "저장 경로 없음"
        : MANUSCRIPT_SAVE_STATE_LABELS[saveState];
  const writtenCharacters = forwardWriting === null
    ? null
    : Math.max(
        0,
        statistics.characterCount - forwardWriting.baselineCharacterCount,
      );
  const modeStatus = forwardWriting === null || writtenCharacters === null
    ? null
    : writtenCharacters >= forwardWriting.goalCharacters
      ? `목표 달성 · ${writtenCharacters.toLocaleString()}자`
      : `목표까지 ${(
          forwardWriting.goalCharacters - writtenCharacters
        ).toLocaleString()}자`;
  return (
    <ManuscriptFocusToolbar
      {...toolbar}
      currentDocumentCharacterCount={statistics.characterCount}
      modeStatus={modeStatus}
      saveStatus={saveStatus}
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
    annotations: ReturnType<typeof useManuscriptAnnotationsController>;
    editorTools: ReturnType<typeof useEditorToolsController>;
    episodeMove: ReturnType<typeof useMoveRangeToEpisodeController>;
    event: ReturnType<typeof useEventWorkspaceController>;
    manuscriptFocus: ReturnType<typeof useManuscriptFocusController>;
    loreCue: ReturnType<typeof useLoreCueController>;
    readingLayout: ReturnType<typeof useReadingLayoutController>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
  }>;
  editorRef: RefObject<ManuscriptEditorHandle | null>;
  automaticSceneAnalysis: ReturnType<typeof useAutomaticSceneAnalysisController>;
  manuscriptFocusStatus: Readonly<{
    pomodoro: string | null;
    timer: string | null;
  }>;
  loreEntries: ComponentProps<typeof ManuscriptEditor>["loreEntries"];
  onCanonReview: ComponentProps<typeof ManuscriptEditor>["onCanonReview"];
  onContinuityManual: ComponentProps<typeof ManuscriptEditor>["onContinuityManual"];
  onContinuityReview: ComponentProps<typeof ManuscriptEditor>["onContinuityReview"];
  onCharacterKnowledge: ComponentProps<typeof ManuscriptEditor>["onCharacterKnowledge"];
  navigation: Readonly<{
    activateDocument: (documentId: string) => void;
    closeDocumentTab: (documentId: string) => void;
  }>;
  openDocuments: readonly ManuscriptDocumentSource[];
  runtime: ReadyWorkspaceRuntime | null;
  saveStateStore: ManuscriptSaveStateStore;
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
    automaticSceneAnalysis,
    manuscriptFocusStatus,
    loreEntries,
    onCanonReview,
    onContinuityManual,
    onContinuityReview,
    onCharacterKnowledge,
    navigation,
    openDocuments,
    runtime,
    saveStateStore,
    sceneProjection,
    telemetryStore,
    titleEditTarget,
    workspaceActionState,
    workspaceSurface,
  } = input;
  const activity = controllers.activity;
  const annotations = controllers.annotations;
  const editorTools = controllers.editorTools;
  const episodeMove = controllers.episodeMove;
  const event = controllers.event;
  const manuscriptFocus = controllers.manuscriptFocus;
  const loreCue = controllers.loreCue;
  const readingLayout = controllers.readingLayout;
  const scene = controllers.scene;
  const annotationRanges = useMemo(
    () => annotations.activeDocumentAnnotations.flatMap(
      (annotation) => annotation.range === null
        ? []
        : [{
            annotationId: annotation.annotationId,
            from: annotation.range.from,
            to: annotation.range.to,
            tags: annotation.tags,
          }],
    ),
    [annotations.activeDocumentAnnotations],
  );
  const manuscriptSceneRanges = useMemo(() => {
    if (activeDocument === null || sceneProjection === null) return [];
    return sceneProjection.scenes
      .filter((candidate) =>
        candidate.documentId === activeDocument.documentId &&
        candidate.range !== null
      )
      .map((candidate) => Object.freeze({
        sceneKey: candidate.sceneKey,
        sceneId: candidate.sceneIdentity?.sceneId ?? null,
        startAnchorId: candidate.startAnchorId,
        endAnchorId: candidate.endAnchorId,
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
      {manuscriptFocus.manuscriptFocusActive && runtime !== null && activeDocument !== null && (
        <ManuscriptFocusToolbarWithTelemetry
          activeDocumentId={activeDocument.documentId}
          forwardWriting={editorTools.activeForwardWriting}
          manuscriptWidthPx={manuscriptFocus.manuscriptFocusWidthPx}
          highlightCurrentParagraph={manuscriptFocus.highlightCurrentParagraph}
          exitLabel={
            editorTools.activeForwardWriting === null
              ? "집중 화면 종료"
              : "수정금지 종료"
          }
          modeLabel={
            editorTools.activeForwardWriting === null ? null : "수정금지 집필"
          }
          onManuscriptWidthChange={manuscriptFocus.changeManuscriptFocusWidth}
          onHighlightCurrentParagraphChange={manuscriptFocus.changeCurrentParagraphHighlight}
          onExit={() => {
            if (editorTools.activeForwardWriting === null) {
              manuscriptFocus.exitManuscriptFocus();
            } else {
              editorTools.stopForwardWriting();
            }
          }}
          onCursorFollowChange={manuscriptFocus.changeCursorFollow}
          onCursorViewportChange={manuscriptFocus.changeCursorViewport}
          onTextScaleChange={manuscriptFocus.changeManuscriptTextScale}
          pomodoroPhase={activity.activePomodoroPhase?.phase ?? null}
          pomodoroStatus={manuscriptFocusStatus.pomodoro}
          recoveryStatus={runtime.startupRecovery.status}
          saveStateStore={saveStateStore}
          timerStatus={manuscriptFocusStatus.timer}
          telemetryStore={telemetryStore}
          cursorFollowEnabled={manuscriptFocus.cursorFollowEnabled}
          cursorViewportPercent={manuscriptFocus.cursorViewportPercent}
          textScalePercent={manuscriptFocus.manuscriptFocusTextScalePercent}
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
          annotationRanges={annotationRanges}
          formattingProfile={runtime.formattingProfile}
          {...(manuscriptFocus.manuscriptFocusActive && workspaceSurface === "manuscript"
            ? {
                manuscriptFocus: {
                  active: true,
                  manuscriptWidthPx: manuscriptFocus.manuscriptFocusWidthPx,
                  highlightCurrentParagraph: manuscriptFocus.highlightCurrentParagraph,
                  cursorFollowEnabled: manuscriptFocus.cursorFollowEnabled,
                  cursorViewportPercent:
                    manuscriptFocus.cursorViewportPercent,
                  textScalePercent: manuscriptFocus.manuscriptFocusTextScalePercent,
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
          onCanonReview={onCanonReview}
          onContinuityManual={onContinuityManual}
          onContinuityReview={onContinuityReview}
          onCharacterKnowledge={onCharacterKnowledge}
          onAddEvent={event.openContextEventDialog}
          onAddScene={() => {
            void scene.createSceneBoundary();
          }}
          onMergeScene={(document, offset) => {
            void scene.mergeCurrentSceneWithPrevious(document, offset);
          }}
          onMoveSceneRange={(document, move) => {
            void scene.relocateSceneRange(document, move);
          }}
          onSplitScene={(document, offset) => {
            void scene.createSceneBoundary("split", document, offset);
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
          onUndoExternal={() =>
            scene.requestUndoLastSceneDeletion() ||
            episodeMove.requestUndoLastMove()
          }
          readOnly={
            runtime.startupRecovery.status !== "clean" ||
            workspaceActionState === "setting-document-completion" ||
            episodeMove.actionState !== "idle" ||
            scene.sceneActionState !== "idle"
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
      <div className="automatic-scene-analysis-status">
        <span aria-hidden="true">자동 장면 분석</span>
        <p
          aria-label="자동 장면 분석 상태"
          aria-live="polite"
          className="automatic-scene-analysis-status-text"
        >
          {automaticSceneAnalysis.error ?? (
            !automaticSceneAnalysis.enabled
              ? "꺼짐"
              : automaticSceneAnalysis.state === "idle"
                ? "켜짐"
                : automaticSceneAnalysis.state === "running"
                  ? "분석 중"
                  : automaticSceneAnalysis.state === "skipped-disconnected"
                    ? "연결되지 않아 건너뜀"
                    : automaticSceneAnalysis.state === "permission-required"
                      ? "권한 필요"
                      : automaticSceneAnalysis.state === "stale"
                        ? "원본 변경으로 건너뜀"
                        : "분석 실패"
          )}
        </p>
        {automaticSceneAnalysis.canRetry && (
          <button
            disabled={automaticSceneAnalysis.state === "running"}
            onClick={automaticSceneAnalysis.retry}
            type="button"
          >
            다시 시도
          </button>
        )}
      </div>
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
        <div className="preflight-open-error is-dismissible" role="alert">
          <span>{episodeMove.actionError}</span>
          <button
            aria-label="회차 이동 오류 닫기"
            className="preflight-open-error-dismiss"
            onClick={episodeMove.clearActionError}
            title="닫기"
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
