import type { IpcMain, IpcMainInvokeEvent } from "electron";

import type { ForeshadowPointProfile } from "../../application/foreshadowing/foreshadow-point-contract";
import type { FragmentShelfProfile } from "../../application/fragments/fragment-contract";
import type {
  ExportWorkRecordsCommand,
  ExportWorkRecordsResult,
} from "../../application/activity/work-records-export";
import type {
  ExportCanonicalMarkdownCommand,
  ExportCanonicalMarkdownResult,
} from "../../application/export/canonical-markdown-export";
import type { ApplicationRuntimes } from "../runtime/create-application-runtimes";
import { registerActivityIpc } from "./register-activity-ipc";
import { registerForeshadowingIpc } from "./register-foreshadowing-ipc";
import { registerFragmentsIpc } from "./register-fragments-ipc";
import { registerManuscriptAnnotationsIpc } from "./register-manuscript-annotations-ipc";
import { registerCharactersIpc } from "./register-characters-ipc";
import { registerCanonIpc } from "./register-canon-ipc";
import { registerContinuityIpc } from "./register-continuity-ipc";
import { registerCharacterKnowledgeIpc } from "./register-character-knowledge-ipc";
import { registerContextPlannerIpc } from "./register-context-planner-ipc";
import { registerNarrativeDigestIpc } from "./register-narrative-digest-ipc";
import { registerScheduleIpc } from "./register-schedule-ipc";
import { registerQuickToolsIpc } from "./register-quick-tools-ipc";
import { registerLoreIpc } from "./register-lore-ipc";
import { registerAssistantIpc } from "./register-assistant-ipc";
import type { RunAssistantChatCommand, AssistantChatResult } from "../../application/assistant/assistant-chat";
import type { ChatGptOAuthConnectionStatus } from "../../application/assistant/chatgpt-oauth";
import type { AppSettingsProfile } from "../../application/settings/app-settings";
import type {
  SaveUiPreferencesCommand,
  UiPreferencesProjection,
} from "../../application/settings/ui-preferences";
import type { MusicSettingsProfile } from "../../application/music/work-music-settings";
import type {
  SearchYouTubeVideosCommand,
  YouTubeMusicProfile,
  YouTubeVideoSearchResult,
} from "../../application/music/youtube-music";
import type {
  InspectLocalMediaCommand,
  InspectLocalMediaResult,
  RelinkLocalMediaCommand,
  RelinkLocalMediaResult,
  SelectLocalMediaCommand,
  SelectLocalMediaResult,
} from "../../application/music/media-track";
import { registerSettingsIpc } from "./register-settings-ipc";
import { registerMusicPlaybackIpc } from "./register-music-playback-ipc";
import { registerVersionIpc } from "./register-version-ipc";
import { registerBackupIpc } from "./register-backup-ipc";
import { registerMigrationIpc } from "./register-migration-ipc";
import type { LocalWorkspaceBackupActionResult } from "../../application/storage/local-workspace-backup-contract";
import type { LegacyLoreImportRehearsalActionResult } from "../../application/migration/legacy-lore-import-contract";
import { registerPlotsIpc } from "./register-plots-ipc";
import { registerStructureIpc } from "./register-structure-ipc";
import { registerWorkspaceIpc } from "./register-workspace-ipc";
import type {
  SelectWorkCoverCommand,
  WorkCoverProjection,
} from "../../application/workspace/work-covers";
import { registerSystemIpc } from "./register-system-ipc";
import type { RuntimeInfo } from "../../application/contracts/studio-bridge";
import {
  registerEditorIpc,
  type EditorIpcRuntime,
} from "./register-editor-ipc";
import type { ManuscriptInputProfile } from "../../application/editor/manuscript-input-profile";
import type { ManuscriptFormattingProfile } from "../../application/editor/manuscript-formatting";
import type {
  ExportManuscriptTextCommand,
  ExportManuscriptTextResult,
  ManuscriptPreflightProfile,
} from "../../application/editor/manuscript-preflight";
import type {
  ManuscriptTextImportResult,
  SelectManuscriptTextImportCommand,
} from "../../application/editor/manuscript-text-import";
import type { ManuscriptCloseResult } from "../../application/contracts/studio-bridge";
import { registerPublishingIpc } from "./register-publishing-ipc";
import {
  type PublishingPartnerCsvSelectionProjection,
  type SelectPublishingPartnerCsvCommand,
} from "../../application/publishing/publishing-partner-csv-import";
import {
  type PublishingSubmissionCsvSelectionProjection,
  type SelectPublishingSubmissionCsvCommand,
} from "../../application/publishing/publishing-submission-csv-import";

export function registerStudioIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtimes: ApplicationRuntimes;
  profiles: Readonly<{
    appSettings: AppSettingsProfile;
    fragment: FragmentShelfProfile;
    foreshadowPoint: ForeshadowPointProfile;
    musicSettings: MusicSettingsProfile;
    youtubeMusic: YouTubeMusicProfile;
  }>;
  activityExportRecords: (
    command: ExportWorkRecordsCommand,
  ) => Promise<ExportWorkRecordsResult>;
  canonicalMarkdownExport: (
    command: ExportCanonicalMarkdownCommand,
  ) => Promise<ExportCanonicalMarkdownResult>;
  assistant: Readonly<{
    getOAuthStatus: () => ChatGptOAuthConnectionStatus | Promise<ChatGptOAuthConnectionStatus>;
    startOAuthLogin: () => ChatGptOAuthConnectionStatus | Promise<ChatGptOAuthConnectionStatus>;
    runChat: (command: RunAssistantChatCommand) => Promise<AssistantChatResult>;
  }>;
  uiPreferences: Readonly<{
    get: () => UiPreferencesProjection | Promise<UiPreferencesProjection>;
    save: (
      command: SaveUiPreferencesCommand,
    ) => UiPreferencesProjection | Promise<UiPreferencesProjection>;
  }>;
  musicPlayback: Readonly<{
    searchVideos: (
      command: SearchYouTubeVideosCommand,
    ) => Promise<YouTubeVideoSearchResult>;
    selectLocalMedia: (
      command: SelectLocalMediaCommand,
    ) => Promise<SelectLocalMediaResult>;
    inspectLocalMedia: (
      command: InspectLocalMediaCommand,
    ) => Promise<InspectLocalMediaResult>;
    relinkLocalMedia: (
      command: RelinkLocalMediaCommand,
    ) => Promise<RelinkLocalMediaResult>;
  }>;
  backup: Readonly<{
    create: () => Promise<LocalWorkspaceBackupActionResult>;
    restore: () => Promise<LocalWorkspaceBackupActionResult>;
  }>;
  migration: Readonly<{
    runLegacyLoreRehearsal: () => Promise<LegacyLoreImportRehearsalActionResult>;
  }>;
  workspace: Readonly<{
    selectCover: (
      command: SelectWorkCoverCommand,
    ) => Promise<WorkCoverProjection | null>;
  }>;
  getRuntimeInfo: () => RuntimeInfo;
  editor: Readonly<{
    runtime: EditorIpcRuntime;
    profiles: Readonly<{
      input: ManuscriptInputProfile;
      formatting: ManuscriptFormattingProfile;
      preflight: ManuscriptPreflightProfile;
    }>;
    exportText: (
      command: ExportManuscriptTextCommand,
    ) => Promise<ExportManuscriptTextResult>;
    selectTextImport: (
      command: SelectManuscriptTextImportCommand,
    ) => Promise<ManuscriptTextImportResult>;
    completeCloseRequest: (
      result: ManuscriptCloseResult,
    ) => Promise<ManuscriptCloseResult> | ManuscriptCloseResult;
  }>;
  publishing: Readonly<{
    selectPartnerCsv: (
      command: SelectPublishingPartnerCsvCommand,
    ) => Promise<PublishingPartnerCsvSelectionProjection>;
    selectSubmissionCsv: (
      command: SelectPublishingSubmissionCsvCommand,
    ) => Promise<PublishingSubmissionCsvSelectionProjection>;
  }>;
}>): void {
  registerActivityIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.activity,
    exportRecords: input.activityExportRecords,
  });
  registerAssistantIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.assistant,
    oauth: {
      getStatus: input.assistant.getOAuthStatus,
      startLogin: input.assistant.startOAuthLogin,
    },
    runChat: input.assistant.runChat,
  });
  registerBackupIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.backup,
    create: input.backup.create,
    restore: input.backup.restore,
  });
  registerCharactersIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.characters,
  });
  registerCanonIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.canon,
    exportMarkdown: input.canonicalMarkdownExport,
  });
  registerContinuityIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.continuity,
  });
  registerCharacterKnowledgeIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.characterKnowledge,
  });
  registerContextPlannerIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.contextPlanner,
  });
  registerNarrativeDigestIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.narrativeDigest,
  });
  registerEditorIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.editor.runtime,
    profiles: input.editor.profiles,
    exportText: input.editor.exportText,
    selectTextImport: input.editor.selectTextImport,
    completeCloseRequest: input.editor.completeCloseRequest,
  });
  registerForeshadowingIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.foreshadowing,
    pointProfile: input.profiles.foreshadowPoint,
  });
  registerFragmentsIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.fragments,
    profile: input.profiles.fragment,
  });
  registerManuscriptAnnotationsIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.manuscriptAnnotations,
  });
  registerLoreIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.lore,
  });
  registerMigrationIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runLegacyLoreRehearsal: input.migration.runLegacyLoreRehearsal,
  });
  registerMusicPlaybackIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.musicPlayback,
    profile: input.profiles.youtubeMusic,
    searchVideos: input.musicPlayback.searchVideos,
    selectLocalMedia: input.musicPlayback.selectLocalMedia,
    inspectLocalMedia: input.musicPlayback.inspectLocalMedia,
    relinkLocalMedia: input.musicPlayback.relinkLocalMedia,
  });
  registerPlotsIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.plots,
  });
  registerPublishingIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.publishing,
    selectPartnerCsv: input.publishing.selectPartnerCsv,
    selectSubmissionCsv: input.publishing.selectSubmissionCsv,
  });
  registerScheduleIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.schedule,
  });
  registerQuickToolsIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.quickTools,
  });
  registerSettingsIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.settings,
    profiles: {
      app: input.profiles.appSettings,
      music: input.profiles.musicSettings,
    },
    uiPreferences: input.uiPreferences,
  });
  registerStructureIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.structure,
  });
  registerSystemIpc({
    ipcMain: input.ipcMain,
    getRuntimeInfo: input.getRuntimeInfo,
  });
  registerVersionIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.version,
  });
  registerWorkspaceIpc({
    ipcMain: input.ipcMain,
    authorizeSender: input.authorizeSender,
    runtime: input.runtimes.workspace,
    selectCover: input.workspace.selectCover,
  });
}
