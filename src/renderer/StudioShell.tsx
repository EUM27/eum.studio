import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronDown,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import {
  WorkspaceRoot as ManuscriptWorkspace,
} from "./WorkspaceRoot";
import { WorkspaceController } from "./workspace/lifecycle/WorkspaceController";
import { LibraryPage } from "./library/LibraryPage";
import {
  QUICK_TOOL_CREATE_WORK_COMMAND_ID,
  QUICK_TOOL_MAIN_COMMAND_ID,
  QuickToolsDialog,
} from "./quick-tools/QuickToolsDialog";
import type { QuickToolTarget } from "../application/quick-tools/quick-tool-search";
import { AppSettingsDialog } from "./settings/AppSettingsDialog";
import { StudioAppShell } from "./shell/StudioAppShell";
import {
  BackupDialog,
  CreateWorkDialog,
  ImportRehearsalDialog,
  RenameWorkDialog,
} from "./shell/StudioShellDialogs";
import { StarlightThemePicker } from "./theme/StarlightThemePicker";
import { PublishingFeature } from "./features/publishing/PublishingFeature";
import { usePublishingController } from "./features/publishing/usePublishingController";
import { useStudioSettingsController } from "./features/settings/useStudioSettingsController";
import { useUiPreferencesController } from "./features/settings/useUiPreferencesController";
import { useBackupMigrationController } from "./features/backup/useBackupMigrationController";
import { useLibraryController } from "./library/useLibraryController";
import { StudioToolContext } from "./quick-tools/StudioToolContext";
import { StudioToolRegistry, type StudioTool } from "./quick-tools/studio-tool-registry";


export function StudioRoot() {
  const [toolRegistry] = useState(() => new StudioToolRegistry());
  const workspaceTools = useSyncExternalStore(toolRegistry.subscribe, toolRegistry.getSnapshot, toolRegistry.getSnapshot);
  const toolReturnFocus = useRef<HTMLElement | null>(null);
  const [workspaceController] = useState(() => new WorkspaceController());
  const [documentRailHost, setDocumentRailHost] =
    useState<HTMLDivElement | null>(null);
  const [eventRailHost, setEventRailHost] =
    useState<HTMLDivElement | null>(null);
  const [musicPlayerHost, setMusicPlayerHost] =
    useState<HTMLDivElement | null>(null);
  const [uiPreferencesPorts] = useState(() => Object.freeze({
    bodyClassList: document.body.classList,
    storage: Object.freeze({
      getItem: (key: string) => window.localStorage.getItem(key),
      removeItem: (key: string) => {
        window.localStorage.removeItem(key);
      },
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value);
      },
    }),
  }));
  const {
    theme,
    manuscriptFocusPreferences,
    uiPreferencesReady,
    changeTheme,
    changeManuscriptFocusPreferences,
  } = useUiPreferencesController({
    bodyClassList: uiPreferencesPorts.bodyClassList,
    client: window.eumStudio.settings,
    storage: uiPreferencesPorts.storage,
  });
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(false);
  const confirmLibraryAction = useCallback(
    (message: string) => window.confirm(message),
    [],
  );
  const {
    activePage,
    catalogState,
    catalog,
    favoriteWorkIds,
    workCovers,
    resumePreview,
    showCreateWork,
    renameWorkTarget,
    actionState,
    actionError,
    scheduleByWork,
    busy,
    loadCatalog,
    acceptCatalog,
    acceptResumePreview,
    refreshSchedule,
    openCreateWorkDialog,
    closeCreateWorkDialog,
    openRenameWorkDialog,
    closeRenameWorkDialog,
    toggleWorkFavorite,
    selectWorkCover,
    openLocation,
    revealActiveWorkspace,
    openWorkSchedule,
    openCompletedRevision,
    returnToMain,
    createWork,
    renameWork,
    retireWork,
    retireDocument,
    moveDocument,
  } = useLibraryController({
    confirm: confirmLibraryAction,
    scheduleClient: window.eumStudio.schedule,
    workspaceClient: window.eumStudio.workspace,
    workspaceController,
  });
  const publishingController = usePublishingController(window.eumStudio);

  const hideQuickToolsForSettings = useCallback(() => {
    setShowQuickTools(false);
  }, []);
  const {
    showAppSettings,
    appSettingsProfile,
    appSettingsProjection,
    musicSettingsProfile,
    workMusicSettingsProjection,
    workSceneAnalysisSettingsProjection,
    youtubeMusicConnectionStatus,
    chatGptOAuthStatus,
    chatGptOAuthLoginState,
    appSettingsActionState,
    appSettingsError,
    appSettingsScheduleRevision,
    dismissAppSettingsForQuickTools,
    openAppSettings,
    closeAppSettings,
    saveAppSettings,
    removeYouTubeMusicConnection,
    startChatGptOAuthLogin,
  } = useStudioSettingsController({
    activeWorkId: catalog?.activeWorkId ?? null,
    assistantClient: window.eumStudio.assistant,
    onOpening: hideQuickToolsForSettings,
    settingsClient: window.eumStudio.settings,
    shellActionState: actionState,
  });

  const {
    showBackup,
    showImportRehearsal,
    backupStatus,
    backupActionState,
    backupError,
    importRehearsalRunning,
    importRehearsalSummary,
    importRehearsalError,
    openBackup,
    closeBackup,
    openImportRehearsal,
    closeImportRehearsal,
    runBackupAction,
    runImportRehearsal,
  } = useBackupMigrationController({
    acceptCatalog,
    backupClient: window.eumStudio.backup,
    migrationClient: window.eumStudio.migration,
    shellActionState: actionState,
    workspace: workspaceController,
  });

  const openQuickTools = useCallback(() => {
    if (showQuickTools) return;
    if (catalogState.status === "ready" && actionState === "idle") {
      toolReturnFocus.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dismissAppSettingsForQuickTools();
      setShowQuickTools(true);
    }
  }, [actionState, catalogState.status, dismissAppSettingsForQuickTools, showQuickTools]);

  const shellTools = useMemo<readonly StudioTool[]>(() => [
    { id: "studio-tool:backup", label: "백업·복원", detail: "작업실을 백업하거나 새 위치에 복원합니다.", group: "작업실", keywords: ["안전", "데이터", "복구"], disabledReason: backupActionState === "idle" ? null : "백업 작업을 마친 뒤 열 수 있습니다.", run: openBackup },
    { id: "studio-tool:settings", label: "앱 설정", detail: "집필 기준과 조수·음악 연결을 설정합니다.", group: "작업실", keywords: ["로그인", "API", "자동 분석"], run: openAppSettings },
    { id: "studio-tool:import", label: "기존 데이터 가져오기", detail: "가져올 자료를 먼저 살펴봅니다.", group: "작업실", keywords: ["이주", "불러오기"], disabledReason: importRehearsalRunning ? "가져오기 확인이 진행 중입니다." : null, run: openImportRehearsal },
    { id: "studio-tool:publishing", label: "투고 운영", detail: "투고·계약·정산을 관리합니다.", group: "작업실", keywords: ["출판사", "발행", "입금"], run: () => publishingController.openPublishingPartners() },
  ], [backupActionState, importRehearsalRunning, openAppSettings, openBackup, openImportRehearsal, publishingController]);
  const allTools = useMemo(() => [...workspaceTools, ...shellTools], [shellTools, workspaceTools]);

  useEffect(() => {
    const handleQuickToolsShortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        openQuickTools();
      }
    };
    window.addEventListener("keydown", handleQuickToolsShortcut);
    return () => {
      window.removeEventListener("keydown", handleQuickToolsShortcut);
    };
  }, [openQuickTools]);

  const selectQuickToolTarget = useCallback(
    (target: QuickToolTarget) => {
      setShowQuickTools(false);
      if (target.id === QUICK_TOOL_MAIN_COMMAND_ID) {
        returnToMain();
        return;
      }
      if (target.id === QUICK_TOOL_CREATE_WORK_COMMAND_ID) {
        openCreateWorkDialog();
        return;
      }
      if (target.kind === "command") {
        const tool = shellTools.find((candidate) => candidate.id === target.id);
        if (tool !== undefined) {
          if (!tool.disabledReason) tool.run();
        } else {
          if (revealActiveWorkspace()) toolRegistry.run(target.id);
        }
        return;
      }
      if (target.workId !== null && catalog !== null) {
        const ownedWork = catalog.works.find(
          (work) => work.workId === target.workId,
        );
        if (ownedWork === undefined) return;
        const ownedDocument =
          target.documentId === null
            ? null
            : ownedWork.documents.find(
                (document) => document.documentId === target.documentId,
              ) ?? null;
        if (target.documentId !== null && ownedDocument === null) return;
        void openLocation(ownedWork.workId, ownedDocument?.documentId ?? null);
      }
    },
    [catalog, openCreateWorkDialog, openLocation, returnToMain, revealActiveWorkspace, shellTools, toolRegistry],
  );

  return (
    <StudioToolContext value={toolRegistry}>
    <StudioAppShell
      compact={sidebarCompact}
      editor={activePage === "workspace"}
      home={activePage === "main"}
      theme={theme}
    >
      <header className="app-topbar">
        <span aria-hidden="true" className="app-topbar-mark">이</span>
        <span className="app-topbar-product">이음 스튜디오</span>
        <button
          aria-label={sidebarCompact ? "사이드바 펼치기" : "사이드바 접기"}
          className="app-topbar-button"
          onClick={() => setSidebarCompact((current) => !current)}
          type="button"
        >
          {sidebarCompact ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
        <StarlightThemePicker onChange={changeTheme} theme={theme} />
        <button
          aria-label="홈 열기"
          className="app-topbar-button"
          disabled={busy}
          onClick={returnToMain}
          type="button"
        >
          <Home aria-hidden="true" size={15} />
        </button>
        <button
          aria-label="전체 도구 열기"
          aria-keyshortcuts="Control+K Meta+K"
          className="app-topbar-tool-search"
          disabled={busy || catalogState.status !== "ready"}
          onClick={openQuickTools}
          type="button"
        >
          <Search aria-hidden="true" size={15} />
          <span>도구 찾기</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="app-topbar-music" ref={setMusicPlayerHost} />
        <button
          aria-label={showAppSettings ? "앱 설정 닫기" : "앱 설정 열기"}
          aria-pressed={showAppSettings}
          className={
            showAppSettings
              ? "app-topbar-button app-topbar-settings is-active"
              : "app-topbar-button app-topbar-settings"
          }
          disabled={busy || appSettingsActionState === "saving"}
          onClick={showAppSettings ? closeAppSettings : openAppSettings}
          title="설정"
          type="button"
        >
          <Settings aria-hidden="true" size={15} />
        </button>
      </header>
      <aside className="sidebar studio-sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">이</div>
          <div className="brand-copy">
            <strong>이음</strong>
          </div>
          <ChevronDown aria-hidden="true" className="brand-chevron" size={15} />
        </div>

        <nav aria-label="주요 화면" className="sidebar-navigation single-navigation">
          <button
            aria-label="빠른 도구 열기"
            className="sidebar-search"
            disabled={busy || catalogState.status !== "ready"}
            onClick={openQuickTools}
            title="빠른 도구 (Ctrl+K)"
            type="button"
          >
            <Search aria-hidden="true" size={16} />
            <span>빠른 도구</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            aria-label="메인"
            aria-current={activePage === "main" ? "page" : undefined}
            className={activePage === "main" ? "nav-item is-active" : "nav-item"}
            disabled={busy}
            onClick={returnToMain}
            type="button"
          >
            <Home aria-hidden="true" size={17} />
            <span>메인</span>
          </button>
        </nav>

        {activePage === "workspace" && (
          <div
            className="editor-page-body sidebar-document-rail"
            ref={setDocumentRailHost}
          />
        )}

      </aside>

      <main
        className={
          activePage === "workspace"
            ? "workspace is-editor-page"
            : "workspace"
        }
      >
        {activePage === "main" && (
          <header className="page-header main-page-header">
            <h1>홈</h1>
            <button
              aria-label="작품 만들기"
              className="header-create-work"
              disabled={busy || catalogState.status !== "ready"}
              onClick={openCreateWorkDialog}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              <span>새 작품</span>
            </button>
          </header>
        )}

        <div
          className={
            activePage === "workspace"
              ? "page-body editor-page-body"
              : "page-body main-page-body"
          }
        >
          {activePage === "main" && catalogState.status === "loading" && (
            <p className="catalog-state" aria-live="polite">작업실을 불러오는 중입니다.</p>
          )}
          {activePage === "main" && catalogState.status === "error" && (
            <section className="catalog-state catalog-error" role="alert">
              <p>로컬 작업실을 불러오지 못했습니다.</p>
              <button onClick={() => void loadCatalog()} type="button">다시 불러오기</button>
            </section>
          )}
          {activePage === "main" && catalog !== null && (
            <LibraryPage
              backupBusy={backupActionState !== "idle"}
              busy={busy}
              catalog={catalog}
              error={actionError}
              favoriteWorkIds={favoriteWorkIds}
              workCovers={workCovers}
              importBusy={importRehearsalRunning}
              resumePreview={resumePreview}
              scheduleByWork={scheduleByWork}
              onOpenBackup={openBackup}
              onCreate={openCreateWorkDialog}
              onOpenImport={openImportRehearsal}
              onOpenPublishing={publishingController.openPublishingPartners}
              onOpenCompletedRevision={(work, documentId, revisionId) => {
                void openCompletedRevision(work, documentId, revisionId);
              }}
              onOpenSchedule={(work) => {
                void openWorkSchedule(work);
              }}
              onOpen={(workId, documentId) => {
                void openLocation(workId, documentId);
              }}
              onMoveDocument={moveDocument}
              onRename={openRenameWorkDialog}
              onRetire={retireWork}
              onRetireDocument={retireDocument}
              onToggleFavorite={toggleWorkFavorite}
              onSelectCover={selectWorkCover}
            />
          )}
          {catalog !== null && !catalog.canCreateFirstWork && uiPreferencesReady && (
            <div
              className="persistent-workspace"
              hidden={activePage !== "workspace"}
            >
              <ManuscriptWorkspace
                controller={workspaceController}
                documentRailHost={documentRailHost}
                embedded
                eventRailHost={eventRailHost}
                musicPlayerHost={musicPlayerHost}
                musicSettingsRevision={workMusicSettingsProjection?.revision ?? 0}
                sceneAnalysisSettingsRevision={
                  workSceneAnalysisSettingsProjection?.revision ?? 0
                }
                sceneAnalysisEnabled={
                  workSceneAnalysisSettingsProjection?.settings.enabled ?? null
                }
                onCatalogChange={acceptCatalog}
                onOpenPublishing={publishingController.openPublishingPartners}
                onOpenSettings={openAppSettings}
                onReturnToWorks={returnToMain}
                onResumePreviewChange={acceptResumePreview}
                onScheduleChange={refreshSchedule}
                manuscriptFocusPreferences={manuscriptFocusPreferences}
                onManuscriptFocusPreferencesChange={changeManuscriptFocusPreferences}
                onThemeChange={changeTheme}
                scheduleSettingsRevision={appSettingsScheduleRevision}
                theme={theme}
                youtubeMusicConnectionStatus={youtubeMusicConnectionStatus}
              />
            </div>
          )}
        </div>
      </main>

      {activePage === "workspace" && (
        <div className="studio-event-rail-host" ref={setEventRailHost} />
      )}

      {showCreateWork && (
        <CreateWorkDialog
          error={actionError}
          onCancel={closeCreateWorkDialog}
          onSubmit={createWork}
          submitting={actionState === "creating"}
        />
      )}
      {renameWorkTarget !== null && (
        <RenameWorkDialog
          error={actionError}
          key={renameWorkTarget.workId}
          onCancel={closeRenameWorkDialog}
          onSubmit={(title) => renameWork(renameWorkTarget, title)}
          submitting={actionState === "renaming-work"}
          work={renameWorkTarget}
        />
      )}
      {showQuickTools && catalog !== null && (
        <QuickToolsDialog
          tools={allTools}
          client={window.eumStudio.quickTools}
          catalog={catalog}
          disabled={busy}
          onClose={() => {
            if (!busy) {
              setShowQuickTools(false);
              queueMicrotask(() => toolReturnFocus.current?.isConnected && toolReturnFocus.current.focus({ preventScroll: true }));
            }
          }}
          onSelect={selectQuickToolTarget}
        />
      )}
      {showAppSettings && (
        <AppSettingsDialog
          actionState={appSettingsActionState}
          chatGptOAuthLoginState={chatGptOAuthLoginState}
          chatGptOAuthStatus={chatGptOAuthStatus}
          error={appSettingsError}
          key={[
            appSettingsProjection?.revision ?? "loading",
            workMusicSettingsProjection?.revision ?? "no-work",
            workSceneAnalysisSettingsProjection?.revision ?? "no-scene-analysis",
            youtubeMusicConnectionStatus?.revision ?? "no-youtube",
            chatGptOAuthStatus?.revision ?? "no-chatgpt",
          ].join(":")}
          musicProfile={musicSettingsProfile}
          musicProjection={workMusicSettingsProjection}
          sceneAnalysisProjection={workSceneAnalysisSettingsProjection}
          onClose={closeAppSettings}
          onSave={saveAppSettings}
          onRemoveYouTubeApiKey={removeYouTubeMusicConnection}
          onStartChatGptOAuthLogin={startChatGptOAuthLogin}
          profile={appSettingsProfile}
          projection={appSettingsProjection}
          youtubeConnectionStatus={youtubeMusicConnectionStatus}
        />
      )}
      <PublishingFeature
        catalog={catalog}
        controller={publishingController}
      />
      {showBackup && (
        <BackupDialog
          actionState={backupActionState}
          error={backupError}
          onCancel={closeBackup}
          onCreate={() => runBackupAction("create")}
          onRestore={() => runBackupAction("restore")}
          status={backupStatus}
        />
      )}
      {showImportRehearsal && (
        <ImportRehearsalDialog
          error={importRehearsalError}
          onCancel={closeImportRehearsal}
          onRun={runImportRehearsal}
          running={importRehearsalRunning}
          summary={importRehearsalSummary}
        />
      )}
    </StudioAppShell>
    </StudioToolContext>
  );
}

export const StudioShell = StudioRoot;
