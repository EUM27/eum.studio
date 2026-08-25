import {
  parseAppSettingsProfile,
  parseAppSettingsProjection,
  parseSaveAppSettingsCommand,
  type AppSettingsProfile,
  type AppSettingsProjection,
  type SaveAppSettingsCommand,
} from "../../settings/app-settings";
import {
  parseSaveUiPreferencesCommand,
  parseUiPreferencesProjection,
  type SaveUiPreferencesCommand,
  type UiPreferencesProjection,
} from "../../settings/ui-preferences";
import {
  parseGetWorkMusicSettingsCommand,
  parseMusicSettingsProfile,
  parseSaveWorkMusicSettingsCommand,
  parseWorkMusicSettingsProjection,
  type GetWorkMusicSettingsCommand,
  type MusicSettingsProfile,
  type SaveWorkMusicSettingsCommand,
  type WorkMusicSettingsProjection,
} from "../../music/work-music-settings";
import {
  parseGetWorkInspirationSettingsCommand,
  parseSaveWorkInspirationSettingsCommand,
  parseWorkInspirationSettingsProjection,
  type GetWorkInspirationSettingsCommand,
  type SaveWorkInspirationSettingsCommand,
  type WorkInspirationSettingsProjection,
} from "../../inspiration/work-inspiration-settings";
import {
  parseSaveYouTubeMusicConnectionCommand,
  parseYouTubeMusicConnectionStatus,
  type SaveYouTubeMusicConnectionCommand,
  type YouTubeMusicConnectionStatus,
} from "../../music/youtube-music-connection";

export const APP_SETTINGS_PROFILE_CHANNEL = "studio:settings:profile";
export const APP_SETTINGS_GET_CHANNEL = "studio:settings:get";
export const APP_SETTINGS_SAVE_CHANNEL = "studio:settings:save";
export const UI_PREFERENCES_GET_CHANNEL =
  "studio:settings:ui-preferences-get";
export const UI_PREFERENCES_SAVE_CHANNEL =
  "studio:settings:ui-preferences-save";
export const MUSIC_SETTINGS_PROFILE_CHANNEL =
  "studio:music:settings-profile";
export const MUSIC_SETTINGS_GET_WORK_CHANNEL =
  "studio:music:get-work-settings";
export const MUSIC_SETTINGS_SAVE_WORK_CHANNEL =
  "studio:music:save-work-settings";
export const INSPIRATION_SETTINGS_GET_WORK_CHANNEL =
  "studio:inspiration:get-work-settings";
export const INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL =
  "studio:inspiration:save-work-settings";
export const YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL =
  "studio:music:youtube-connection-status";
export const YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL =
  "studio:music:youtube-connection-save";

export type SettingsBridgeChannel =
  | typeof APP_SETTINGS_PROFILE_CHANNEL
  | typeof APP_SETTINGS_GET_CHANNEL
  | typeof APP_SETTINGS_SAVE_CHANNEL
  | typeof UI_PREFERENCES_GET_CHANNEL
  | typeof UI_PREFERENCES_SAVE_CHANNEL
  | typeof MUSIC_SETTINGS_PROFILE_CHANNEL
  | typeof MUSIC_SETTINGS_GET_WORK_CHANNEL
  | typeof MUSIC_SETTINGS_SAVE_WORK_CHANNEL
  | typeof INSPIRATION_SETTINGS_GET_WORK_CHANNEL
  | typeof INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL
  | typeof YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL
  | typeof YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL;

export type SettingsBridgePayload =
  | SaveAppSettingsCommand
  | SaveUiPreferencesCommand
  | GetWorkMusicSettingsCommand
  | SaveWorkMusicSettingsCommand
  | GetWorkInspirationSettingsCommand
  | SaveWorkInspirationSettingsCommand
  | SaveYouTubeMusicConnectionCommand;

export type SettingsBridge = Readonly<{
  getProfile: () => Promise<AppSettingsProfile>;
  get: () => Promise<AppSettingsProjection>;
  save: (command: SaveAppSettingsCommand) => Promise<AppSettingsProjection>;
  getUiPreferences: () => Promise<UiPreferencesProjection>;
  saveUiPreferences: (
    command: SaveUiPreferencesCommand,
  ) => Promise<UiPreferencesProjection>;
  getMusicProfile: () => Promise<MusicSettingsProfile>;
  getWorkMusic: (
    command: GetWorkMusicSettingsCommand,
  ) => Promise<WorkMusicSettingsProjection>;
  saveWorkMusic: (
    command: SaveWorkMusicSettingsCommand,
  ) => Promise<WorkMusicSettingsProjection>;
  getWorkInspiration: (
    command: GetWorkInspirationSettingsCommand,
  ) => Promise<WorkInspirationSettingsProjection>;
  saveWorkInspiration: (
    command: SaveWorkInspirationSettingsCommand,
  ) => Promise<WorkInspirationSettingsProjection>;
  getYouTubeMusicConnectionStatus: () => Promise<YouTubeMusicConnectionStatus>;
  saveYouTubeMusicConnection: (
    command: SaveYouTubeMusicConnectionCommand,
  ) => Promise<YouTubeMusicConnectionStatus>;
}>;

export type SettingsBridgeInvoke = (
  channel: SettingsBridgeChannel,
  payload?: SettingsBridgePayload,
) => Promise<unknown>;

export function createSettingsBridge(
  invoke: SettingsBridgeInvoke,
): SettingsBridge {
  return Object.freeze({
    getProfile: async () => {
      const value = await invoke(APP_SETTINGS_PROFILE_CHANNEL);
      try {
        return parseAppSettingsProfile(value);
      } catch {
        throw new Error("Invalid app settings profile");
      }
    },
    get: async () => {
      const value = await invoke(APP_SETTINGS_GET_CHANNEL);
      try {
        return parseAppSettingsProjection(value);
      } catch {
        throw new Error("Invalid app settings projection");
      }
    },
    save: async (input) => {
      const profileValue = await invoke(APP_SETTINGS_PROFILE_CHANNEL);
      let profile: AppSettingsProfile;
      try {
        profile = parseAppSettingsProfile(profileValue);
      } catch {
        throw new Error("Invalid app settings profile");
      }
      const command = parseSaveAppSettingsCommand(input, profile);
      const value = await invoke(APP_SETTINGS_SAVE_CHANNEL, command);
      try {
        return parseAppSettingsProjection(value, profile);
      } catch {
        throw new Error("Invalid saved app settings projection");
      }
    },
    getUiPreferences: async () => {
      const value = await invoke(UI_PREFERENCES_GET_CHANNEL);
      try {
        return parseUiPreferencesProjection(value);
      } catch {
        throw new Error("Invalid UI preferences projection");
      }
    },
    saveUiPreferences: async (input) => {
      const command = parseSaveUiPreferencesCommand(input);
      const value = await invoke(UI_PREFERENCES_SAVE_CHANNEL, command);
      try {
        return parseUiPreferencesProjection(value);
      } catch {
        throw new Error("Invalid saved UI preferences projection");
      }
    },
    getMusicProfile: async () => {
      const value = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
      try {
        return parseMusicSettingsProfile(value);
      } catch {
        throw new Error("Invalid music settings profile");
      }
    },
    getWorkMusic: async (input) => {
      const command = parseGetWorkMusicSettingsCommand(input);
      const profileValue = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
      const profile = parseMusicSettingsProfile(profileValue);
      const value = await invoke(MUSIC_SETTINGS_GET_WORK_CHANNEL, command);
      try {
        return parseWorkMusicSettingsProjection(value, profile);
      } catch {
        throw new Error("Invalid Work music settings projection");
      }
    },
    saveWorkMusic: async (input) => {
      const profileValue = await invoke(MUSIC_SETTINGS_PROFILE_CHANNEL);
      const profile = parseMusicSettingsProfile(profileValue);
      const command = parseSaveWorkMusicSettingsCommand(input, profile);
      const value = await invoke(MUSIC_SETTINGS_SAVE_WORK_CHANNEL, command);
      try {
        return parseWorkMusicSettingsProjection(value, profile);
      } catch {
        throw new Error("Invalid saved Work music settings projection");
      }
    },
    getWorkInspiration: async (input) => {
      const command = parseGetWorkInspirationSettingsCommand(input);
      const value = await invoke(INSPIRATION_SETTINGS_GET_WORK_CHANNEL, command);
      try {
        return parseWorkInspirationSettingsProjection(value);
      } catch {
        throw new Error("Invalid Work inspiration settings projection");
      }
    },
    saveWorkInspiration: async (input) => {
      const command = parseSaveWorkInspirationSettingsCommand(input);
      const value = await invoke(
        INSPIRATION_SETTINGS_SAVE_WORK_CHANNEL,
        command,
      );
      try {
        return parseWorkInspirationSettingsProjection(value);
      } catch {
        throw new Error("Invalid saved Work inspiration settings projection");
      }
    },
    getYouTubeMusicConnectionStatus: async () => {
      const value = await invoke(YOUTUBE_MUSIC_CONNECTION_STATUS_CHANNEL);
      try {
        return parseYouTubeMusicConnectionStatus(value);
      } catch {
        throw new Error("Invalid YouTube music connection status");
      }
    },
    saveYouTubeMusicConnection: async (input) => {
      const command = parseSaveYouTubeMusicConnectionCommand(input);
      const value = await invoke(
        YOUTUBE_MUSIC_CONNECTION_SAVE_CHANNEL,
        command,
      );
      try {
        return parseYouTubeMusicConnectionStatus(value);
      } catch {
        throw new Error("Invalid saved YouTube music connection status");
      }
    },
  });
}
