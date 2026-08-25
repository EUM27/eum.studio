import type { SettingsIpcRuntime } from "../ipc/register-settings-ipc";

export function pickSettingsRuntime(
  runtime: SettingsIpcRuntime,
): SettingsIpcRuntime {
  return Object.freeze({
    getAppSettings: () => runtime.getAppSettings(),
    saveAppSettings: (command) => runtime.saveAppSettings(command),
    getWorkMusicSettings: (command) => runtime.getWorkMusicSettings(command),
    saveWorkMusicSettings: (command) =>
      runtime.saveWorkMusicSettings(command),
    getWorkInspirationSettings: (command) =>
      runtime.getWorkInspirationSettings(command),
    saveWorkInspirationSettings: (command) =>
      runtime.saveWorkInspirationSettings(command),
    getYouTubeMusicConnectionStatus: () =>
      runtime.getYouTubeMusicConnectionStatus(),
    saveYouTubeMusicConnection: (command) =>
      runtime.saveYouTubeMusicConnection(command),
  });
}
