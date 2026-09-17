import type { IpcRenderer } from "electron";
import { WORK_MUSIC_SETTINGS_CHANGED_CHANNEL } from "../../application/music/shared-music-playback";
import { parseSharedMusicCommand, parseSharedMusicMessage, parseSharedMusicSnapshot, parseSharedMusicState, SHARED_MUSIC_ATTACH_CHANNEL, SHARED_MUSIC_COMMAND_CHANNEL, SHARED_MUSIC_DETACH_CHANNEL, SHARED_MUSIC_MESSAGE_CHANNEL, SHARED_MUSIC_PUBLISH_CHANNEL, type SharedMusicBridge } from "../../application/music/shared-music-playback";

export function createSharedMusicBridge(ipc: Pick<IpcRenderer, "invoke" | "on" | "removeListener">): SharedMusicBridge {
  return Object.freeze({
    attach: async () => {
      const value: unknown = await ipc.invoke(SHARED_MUSIC_ATTACH_CHANNEL);
      if (typeof value !== "object" || value === null || !("clientId" in value) || !Number.isSafeInteger(value.clientId) || !("snapshot" in value)) throw new Error("Invalid music registration");
      return { clientId: value.clientId as number, snapshot: parseSharedMusicSnapshot(value.snapshot) };
    },
    detach: async () => { await ipc.invoke(SHARED_MUSIC_DETACH_CHANNEL); },
    command: async (command) => { await ipc.invoke(SHARED_MUSIC_COMMAND_CHANNEL, parseSharedMusicCommand(command)); },
    publish: async (epoch, state) => { await ipc.invoke(SHARED_MUSIC_PUBLISH_CHANNEL, { epoch, state: parseSharedMusicState(state) }); },
    onMessage: (listener) => {
      const handle = (_event: unknown, value: unknown) => listener(parseSharedMusicMessage(value));
      ipc.on(SHARED_MUSIC_MESSAGE_CHANNEL, handle);
      return () => { ipc.removeListener(SHARED_MUSIC_MESSAGE_CHANNEL, handle); };
    },
    onSettingsChanged: (listener) => {
      const handle = (_event: unknown, workId: unknown) => { if (typeof workId === "string" && workId.length > 0) listener(workId); };
      ipc.on(WORK_MUSIC_SETTINGS_CHANGED_CHANNEL, handle);
      return () => { ipc.removeListener(WORK_MUSIC_SETTINGS_CHANGED_CHANNEL, handle); };
    },
  });
}
