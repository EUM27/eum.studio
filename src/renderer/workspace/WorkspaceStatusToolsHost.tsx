import {
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { ManuscriptDocumentSource } from "../../application/editor/manuscript-document-profile";
import type { YouTubeMusicConnectionStatus } from "../../application/music/youtube-music-connection";
import type { WorkspaceWorkSummary } from "../../application/workspace/workspace-contract";
import type { SceneProjectionList } from "../../application/structure/scene-projection";
import { DailyGoalStatus } from "../activity/DailyGoalDialog";
import {
  SessionFeedbackPanel,
  type SessionFeedbackPanelProps,
} from "../activity/SessionFeedbackPanel";
import { BottomEventRail } from "../editor/BottomEventRail";
import { ManuscriptTelemetryStore } from "../editor/manuscript-telemetry-store";
import type { useActivityController } from "../features/activity/useActivityController";
import type { useFocusModeController } from "../features/activity/useFocusModeController";
import type { useEditorToolsController } from "../features/editor-tools/useEditorToolsController";
import type { useMusicController } from "../features/music/useMusicController";
import type { useScheduleController } from "../features/schedule/useScheduleController";
import type {
  useEventWorkspaceController,
  useEventWorkspaceState,
} from "../features/structure/useEventWorkspaceController";
import type {
  useSceneWorkspaceController,
  useSceneWorkspaceState,
} from "../features/structure/useSceneWorkspaceController";
import type { useStructureController } from "../features/structure/useStructureController";
import type { useVersionController } from "../features/version/useVersionController";
import { MusicLibraryDialog } from "../music/MusicLibraryDialog";
import { MusicMiniPlayer } from "../music/MusicMiniPlayer";
import type { ManuscriptSaveState } from "../persistence/manuscript-durable-save-queue";
import { WorkScheduleDashboard } from "../schedule/WorkScheduleDashboard";
import type { StarlightThemeKey } from "../theme/starlight-theme";
import { WorkspaceDialogHost } from "./dialogs/WorkspaceDialogHost";
import type { useWorkspaceLayoutController } from "./layout/useWorkspaceLayoutController";
import type { useReadingLayoutController } from "./session/useReadingLayoutController";
import type { WorkspaceRuntimeState } from "./session/workspace-session-state";

export const SAVE_STATE_LABELS: Readonly<Record<ManuscriptSaveState, string>> =
  Object.freeze({
    editing: "편집 중",
    saving: "저장 중",
    saved: "저장됨",
    failed: "실패",
  });

function renderInHost(
  content: ReactNode,
  host: HTMLElement | null | undefined,
): ReactNode {
  return host === null || host === undefined
    ? content
    : createPortal(content, host);
}

function SessionFeedbackWithTelemetry(
  input: Omit<SessionFeedbackPanelProps, "currentCharacterCount"> & {
    readonly telemetryStore: ManuscriptTelemetryStore;
  },
) {
  const { telemetryStore, ...feedback } = input;
  const statistics = useSyncExternalStore(
    telemetryStore.subscribeStatistics,
    telemetryStore.getStatisticsSnapshot,
  );
  return (
    <SessionFeedbackPanel
      {...feedback}
      currentCharacterCount={statistics.characterCount}
    />
  );
}

export function WorkspaceStatusToolsHost(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  activeManuscriptPosition: ReturnType<
    typeof useWorkspaceLayoutController
  >["activeManuscriptPosition"];
  activeSaveState: ManuscriptSaveState | null;
  activeWork: WorkspaceWorkSummary | null;
  activeWorkId: WorkspaceWorkSummary["workId"] | null;
  controllers: Readonly<{
    activity: ReturnType<typeof useActivityController>;
    editorTools: ReturnType<typeof useEditorToolsController>;
    event: ReturnType<typeof useEventWorkspaceController>;
    eventState: ReturnType<typeof useEventWorkspaceState>;
    scene: ReturnType<typeof useSceneWorkspaceController>;
    sceneState: ReturnType<typeof useSceneWorkspaceState>;
    focus: ReturnType<typeof useFocusModeController>;
    music: ReturnType<typeof useMusicController>;
    readingLayout: ReturnType<typeof useReadingLayoutController>;
    schedule: ReturnType<typeof useScheduleController>;
    version: ReturnType<typeof useVersionController>;
  }>;
  darkMode: boolean;
  embedded: boolean;
  eventRail: ReturnType<typeof useStructureController>["eventRail"];
  eventRailHost: HTMLElement | null | undefined;
  sceneProjection: SceneProjectionList | null;
  focusText: string | null;
  musicPlayerHost: HTMLElement | null | undefined;
  navigation: Readonly<{
    openCompletedRevisionFromSchedule: NonNullable<ComponentProps<
      typeof WorkScheduleDashboard
    >["onOpenCompletedRevision"]>;
    openDocumentFromSchedule: NonNullable<ComponentProps<
      typeof WorkScheduleDashboard
    >["onOpenDocument"]>;
    openEventRailSource: ComponentProps<
      typeof BottomEventRail
    >["onOpenSource"];
    openScene: ComponentProps<typeof BottomEventRail>["onOpenScene"];
  }>;
  onOpenSettings: (() => void) | undefined;
  onThemeChange: ((theme: StarlightThemeKey) => void) | undefined;
  preflightProfile: ComponentProps<
    typeof WorkspaceDialogHost
  >["preflightProfile"];
  runtime: WorkspaceRuntimeState;
  scheduleClient: ComponentProps<typeof WorkScheduleDashboard>["client"];
  scheduleSettingsRevision: number;
  telemetryStore: ManuscriptTelemetryStore;
  workspaceSurface: string;
  youtubeMusicConnectionStatus: YouTubeMusicConnectionStatus | null;
}>) {
  const activity = input.controllers.activity;
  const editorTools = input.controllers.editorTools;
  const event = input.controllers.event;
  const eventState = input.controllers.eventState;
  const scene = input.controllers.scene;
  const sceneState = input.controllers.sceneState;
  const focus = input.controllers.focus;
  const music = input.controllers.music;
  const readingLayout = input.controllers.readingLayout;
  const version = input.controllers.version;
  const activeDocument = input.activeDocument;
  const activeWork = input.activeWork;

  return (
    <>
      {input.runtime.status === "ready" &&
        activeWork !== null &&
        input.workspaceSurface === "manuscript" &&
        renderInHost(
          <BottomEventRail
            activeDocumentId={activeDocument?.documentId ?? null}
            cursorOffset={
              input.activeManuscriptPosition !== null &&
              input.activeManuscriptPosition.documentId ===
                activeDocument?.documentId
                ? input.activeManuscriptPosition.offset
                : null
            }
            documentTitles={Object.fromEntries(
              activeWork.documents.map((document) => [
                document.documentId,
                document.title,
              ]),
            )}
            eventBusy={eventState.eventActionState !== "idle"}
            sceneBusy={sceneState.sceneActionState !== "idle"}
            onDetachEventRange={event.retireEventSource}
            onDeleteSceneGroup={scene.deleteSceneGroup}
            onMoveEvent={event.moveEventBlock}
            {...(input.navigation.openScene === undefined
              ? {}
              : { onOpenScene: input.navigation.openScene })}
            onOpenSource={(location) => {
              void input.navigation.openEventRailSource(location);
            }}
            projection={
              input.eventRail?.workId === input.activeWorkId
                ? input.eventRail
                : null
            }
            sceneProjection={input.sceneProjection}
          />,
          input.eventRailHost,
        )}
      <footer
        aria-label="작업 상태"
        className={
          input.embedded
            ? "workspace-statusbar workspace-statusbar-embedded"
            : "workspace-statusbar"
        }
      >
        {activeDocument !== null && (
          <>
            <span
              className={
                input.embedded ? "status-item visually-hidden" : "status-item"
              }
            >
              <span>작품</span>
              <output
                data-testid="current-work"
                title={activeDocument.workId}
              >
                {activeWork?.title ?? "작품"}
              </output>
            </span>
            <span
              className={
                input.embedded ? "status-item visually-hidden" : "status-item"
              }
            >
              <span>문서</span>
              <output data-testid="current-document">
                {activeDocument.label}
              </output>
            </span>
          </>
        )}
        {renderInHost(
          <MusicMiniPlayer
            connection={input.youtubeMusicConnectionStatus}
            focusText={input.focusText}
            onOpenLibrary={music.openMusicLibrary}
            onPlayPlaylist={(startIndex) => {
              music.playMusicQueue(music.musicLibraryQueue, startIndex);
            }}
            playlist={music.musicLibraryQueue}
            playRequest={music.musicPlaybackRequest}
            profile={music.youtubeMusicProfile}
          />,
          input.musicPlayerHost,
        )}
        {activeDocument !== null &&
          activeWork !== null &&
          activity.workActivity !== null &&
          activity.pomodoro !== null && (
            <SessionFeedbackWithTelemetry
              activity={activity.workActivity}
              busy={activity.activityActionState !== "idle"}
              documents={activeWork.documents.map((document) => ({
                documentId: document.documentId,
                title: document.title,
              }))}
              darkMode={input.darkMode}
              focusCycle={
                activity.activePomodoroPhase === null
                  ? activity.activeFocusCycle
                  : undefined
              }
              focusMode={focus.focusMode}
              focusModeAvailable={
                input.workspaceSurface === "manuscript" &&
                editorTools.activeForwardWriting === null
              }
              forwardWritingActive={editorTools.activeForwardWriting !== null}
              forwardWritingAvailable={
                input.workspaceSurface === "manuscript" &&
                input.runtime.status === "ready" &&
                input.runtime.startupRecovery.status === "clean"
              }
              key={`${activeWork.workId}:${activity.workActivity.activeSessionId ?? "no-session"}:${activity.activePomodoroPhase?.focusCycleId ?? activity.activeFocusCycle?.focusCycleId ?? "no-focus"}`}
              nowMs={activity.activityClock}
              onConfigure={activity.openFocusDialog}
              onPause={() => {
                void activity.pausePomodoro();
              }}
              onResume={() => {
                void activity.resumePomodoro();
              }}
              onSaveNote={(note) => {
                void activity.savePomodoroNote(note);
              }}
              onStartWritingSession={() => {
                void activity.startWritingSession();
              }}
              onStopFocusCycle={() => {
                void activity.stopFocusCycle();
              }}
              onStopPomodoro={() => {
                void activity.stopPomodoro();
              }}
              onStopWritingSession={() => {
                void activity.stopWritingSession();
              }}
              onToggleDarkMode={() => {
                input.onThemeChange?.(
                  input.darkMode ? "light-mode" : "dark-mode",
                );
              }}
              onToggleForwardWriting={() => {
                if (editorTools.activeForwardWriting !== null) {
                  editorTools.stopForwardWriting();
                } else {
                  editorTools.openForwardWritingDialog();
                }
              }}
              onToggleFocusMode={() => {
                focus.toggleFocusMode();
              }}
              pomodoro={activity.pomodoro}
              telemetryStore={input.telemetryStore}
            />
          )}
        {activity.pomodoro?.status === "completed" &&
          activity.pomodoro.settings !== null && (
            <span
              className="activity-completion"
              data-testid="pomodoro-completed"
            >
              집중 주기 완료 {activity.pomodoro.completedWorkCycles}/
              {activity.pomodoro.settings.workCycleCount}
            </span>
          )}
        {activity.activityActionError !== null && (
          <span className="activity-status-error" role="alert">
            {activity.activityActionError}
          </span>
        )}
        {input.embedded &&
          activeDocument !== null &&
          activity.workActivity !== null &&
          activity.dailyGoals !== null && (
            <DailyGoalStatus
              activity={activity.workActivity}
              nowMs={activity.activityClock}
              onOpen={activity.openDailyGoalDialog}
              settings={activity.dailyGoals}
            />
          )}
        <span
          aria-live="polite"
          className="save-status"
          data-save-state={input.activeSaveState ?? undefined}
          data-testid="save-state"
        >
          {input.embedded && <span aria-hidden="true" className="save-dot" />}
          {input.runtime.status === "ready" &&
          input.runtime.startupRecovery.status === "recovery-pending"
            ? "복구 적용 대기"
            : input.runtime.status === "ready" &&
                input.runtime.startupRecovery.status === "read-only-error"
              ? "복구 확인 필요"
              : input.activeSaveState === null
                ? input.embedded
                  ? "저장 경로 없음"
                  : "영속 저장 미연결"
                : SAVE_STATE_LABELS[input.activeSaveState]}
        </span>
        {!input.embedded && (
          <span>
            {input.runtime.status === "loading" && "런타임 확인 중"}
            {input.runtime.status === "error" && "런타임 연결 경고"}
            {input.runtime.status === "ready" && "런타임 정상"}
          </span>
        )}
      </footer>
      {input.controllers.schedule.showSchedule && activeWork !== null && (
        <div
          className="dialog-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              input.controllers.schedule.closeSchedule();
            }
          }}
          role="presentation"
        >
          <section
            aria-label="작업 일정"
            aria-modal="true"
            className="workspace-tool-dialog"
            role="dialog"
          >
            <button
              aria-label="작업 일정 닫기"
              className="dialog-close workspace-tool-dialog-close"
              onClick={input.controllers.schedule.closeSchedule}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
            <WorkScheduleDashboard
              client={input.scheduleClient}
              key={`${activeWork.workId}:${input.scheduleSettingsRevision}`}
              onOpenCompletedRevision={(documentId, revisionId) => {
                void input.navigation.openCompletedRevisionFromSchedule(
                  documentId,
                  revisionId,
                );
              }}
              onOpenDocument={input.navigation.openDocumentFromSchedule}
              settingsRevision={input.scheduleSettingsRevision}
              work={activeWork}
            />
          </section>
        </div>
      )}
      <WorkspaceDialogHost
        activeDocument={activeDocument}
        activeWorkId={input.activeWorkId}
        activity={activity}
        editorTools={editorTools}
        eventController={event}
        eventState={eventState}
        preflightProfile={input.preflightProfile}
        readingLayout={readingLayout}
        version={version}
      />
      {music.musicLibraryOpen &&
        renderInHost(
          <MusicLibraryDialog
            connected={
              input.youtubeMusicConnectionStatus?.apiKeyConfigured === true
            }
            error={music.musicLibraryError ?? music.sceneMusicQueueError}
            favorites={music.workMusicSettings?.settings.favoriteTracks ?? []}
            localMedia={music.workMusicSettings?.settings.localMedia ?? []}
            onAddToQueue={music.addMusicLibraryTrack}
            onClose={music.closeMusicLibrary}
            onOpenConnectionSettings={() => {
              music.closeMusicLibrary();
              input.onOpenSettings?.();
            }}
            onClearQueue={music.clearMusicLibraryQueue}
            onMoveQueueTrack={(index, direction) => {
              music.moveMusicLibraryQueueTrack(index, index + direction);
            }}
            onPlayQueue={() => {
              music.playMusicQueue(music.musicLibraryQueue);
            }}
            onPlayQueueTrack={(index) => {
              music.playMusicQueue(music.musicLibraryQueue, index);
            }}
            onPlayTrack={music.playMusicLibraryTrack}
            onRegisterLocalMedia={(storageMode) => {
              void music.registerLocalMedia(storageMode);
            }}
            onRemoveFromQueue={music.removeMusicLibraryTrack}
            onSearch={(query) => {
              void music.searchMusicLibrary(query);
            }}
            onToggleFavorite={(track) => {
              void music.toggleFavoriteMusicTrack(track);
            }}
            queue={music.musicLibraryQueue}
            queueSaving={music.musicLibraryActionState === "saving-playlist"}
            registeringMode={music.localMediaRegistrationMode}
            results={music.musicLibraryResults}
            searching={music.musicLibraryActionState === "searching"}
          />,
          input.musicPlayerHost?.closest<HTMLElement>(".studio-app-shell"),
        )}
    </>
  );
}
