import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  APP_SETTINGS_GET_CHANNEL,
  APP_SETTINGS_PROFILE_CHANNEL,
  APP_SETTINGS_SAVE_CHANNEL,
  INSPIRATION_SETTINGS_GET_WORK_CHANNEL,
  INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
  MUSIC_SETTINGS_GET_WORK_CHANNEL,
  MUSIC_SETTINGS_PROFILE_CHANNEL,
  MUSIC_SETTINGS_SAVE_WORK_CHANNEL,
  UI_PREFERENCES_GET_CHANNEL,
  UI_PREFERENCES_SAVE_CHANNEL,
  YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL,
  YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseSaveAppSettingsCommand,
  type AppSettingsProfile,
  type AppSettingsProjection,
  type SaveAppSettingsCommand,
} from "../../application/settings/app-settings";
import {
  parseSaveUiPreferencesCommand,
  type SaveUiPreferencesCommand,
  type UiPreferencesProjection,
} from "../../application/settings/ui-preferences";
import {
  parseGetWorkMusicSettingsCommand,
  parseSaveWorkMusicSettingsCommand,
  type GetWorkMusicSettingsCommand,
  type MusicSettingsProfile,
  type SaveWorkMusicSettingsCommand,
  type WorkMusicSettingsProjection,
} from "../../application/music/work-music-settings";
import {
  parseGetWorkInspirationSettingsCommand,
  parseSaveWorkInspirationSettingsCommand,
  type GetWorkInspirationSettingsCommand,
  type SaveWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../../application/inspiration/work-inspiration-settings";
import {
  parseSaveYouTubeMusicConnectionCommand,
  type SaveYouTubeMusicConnectionCommand,
  type YouTubeMusicConnectionStatus,
} from "../../application/music/youtube-music-connection";

type MaybePromise<T> = T | Promise<T>;

export type SettingsIpcRuntime = Readonly<{
  getAppSettings: () => Promise<AppSettingsProjection>;
  saveAppSettings: (
    command: SaveAppSettingsCommand,
  ) => Promise<AppSettingsProjection>;
  getWorkMusicSettings: (
    command: GetWorkMusicSettingsCommand,
  ) => Promise<WorkMusicSettingsProjection>;
  saveWorkMusicSettings: (
    command: SaveWorkMusicSettingsCommand,
  ) => Promise<WorkMusicSettingsProjection>;
  getWorkInspirationSettings: (
    command: GetWorkInspirationSettingsCommand,
  ) => Promise<WorkInspirationSettingsProjection>;
  saveWorkInspirationSettings: (
    command: SaveWorkInspirationSettingsCommand,
  ) => Promise<WorkInspirationSettingsProjection>;
  getYouTubeMusicConnectionStatus: () => Promise<YouTubeMusicConnectionStatus>;
  saveYouTubeMusicConnection: (
    command: SaveYouTubeMusicConnectionCommand,
  ) => Promise<YouTubeMusicConnectionStatus>;
}>;

export function registerSettingsIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: SettingsIpcRuntime;
  profiles: Readonly<{
    app: AppSettingsProfile;
    music: MusicSettingsProfile;
  }>;
  uiPreferences: Readonly<{
    get: () => MaybePromise<UiPreferencesProjection>;
    save: (
      command: SaveUiPreferencesCommand,
    ) => MaybePromise<UiPreferencesProjection>;
  }>;
}>): void {
  input.ipcMain.handle(APP_SETTINGS_PROFILE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.profiles.app;
  });
  input.ipcMain.handle(APP_SETTINGS_GET_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.getAppSettings();
  });
  input.ipcMain.handle(APP_SETTINGS_SAVE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.runtime.saveAppSettings(
      parseSaveAppSettingsCommand(value, input.profiles.app),
    );
  });
  input.ipcMain.handle(UI_PREFERENCES_GET_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.uiPreferences.get();
  });
  input.ipcMain.handle(UI_PREFERENCES_SAVE_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.uiPreferences.save(parseSaveUiPreferencesCommand(value));
  });
  input.ipcMain.handle(MUSIC_SETTINGS_PROFILE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.profiles.music;
  });
  input.ipcMain.handle(
    MUSIC_SETTINGS_GET_WORK_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.getWorkMusicSettings(
        parseGetWorkMusicSettingsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    MUSIC_SETTINGS_SAVE_WORK_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveWorkMusicSettings(
        parseSaveWorkMusicSettingsCommand(value, input.profiles.music),
      );
    },
  );
  input.ipcMain.handle(
    INSPIRATION_SETTINGS_GET_WORK_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.getWorkInspirationSettings(
        parseGetWorkInspirationSettingsCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveWorkInspirationSettings(
        parseSaveWorkInspirationSettingsCommand(value),
      );
    },
  );
  input.ipcMain.handle(YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.runtime.getYouTubeMusicConnectionStatus();
  });
  input.ipcMain.handle(
    YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.saveYouTubeMusicConnection(
        parseSaveYouTubeMusicConnectionCommand(value),
      );
    },
  );
}
