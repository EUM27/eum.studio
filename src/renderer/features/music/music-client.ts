import type { StudioBridge } from "../../../application/contracts/studio-bridge";
import type { MusicTrackProjection } from "../../../application/music/media-track";
import type { WorkMusicSettingsProjection } from "../../../application/music/work-music-settings";
import type { YouTubeMusicProfile } from "../../../application/music/youtube-music";
import type { EntityId } from "../../../domain/writing";

export type WorkMusicSettingsReadClient = Pick<
  StudioBridge["settings"],
  "getWorkMusic"
>;

export type YouTubeMusicProfileReadClient = Pick<
  StudioBridge["musicPlayback"],
  "getProfile"
>;

export type MusicLibraryQueueProjectionPort = Readonly<{
  replacePlaylist: (tracks: readonly MusicTrackProjection[]) => void;
  clearPlaylist: () => void;
}>;

export type MusicTimerPort = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
}>;

const DEFAULT_TIMER_PORT: MusicTimerPort = Object.freeze({
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function startWorkMusicSettingsLoad(input: Readonly<{
  activeWorkId: EntityId<"Work"> | null;
  client: WorkMusicSettingsReadClient;
  libraryQueue: MusicLibraryQueueProjectionPort;
  onFailed: () => void;
  onLoaded: (projection: WorkMusicSettingsProjection) => void;
  onReset: () => void;
  timer?: MusicTimerPort;
}>): () => void {
  if (input.activeWorkId === null) {
    const timer = input.timer ?? DEFAULT_TIMER_PORT;
    const reset = timer.schedule(() => {
      input.onReset();
      input.libraryQueue.clearPlaylist();
    }, 0);
    return () => timer.cancel(reset);
  }
  let disposed = false;
  void input.client.getWorkMusic({
    schemaVersion: 1,
    workId: input.activeWorkId,
  }).then(
    (projection) => {
      if (!disposed) {
        input.onLoaded(projection);
        input.libraryQueue.replacePlaylist(projection.settings.playlistTracks);
      }
    },
    () => {
      if (!disposed) {
        input.onFailed();
        input.libraryQueue.clearPlaylist();
      }
    },
  );
  return () => {
    disposed = true;
  };
}

export function startYouTubeMusicProfileLoad(input: Readonly<{
  client: YouTubeMusicProfileReadClient;
  onFailed: () => void;
  onLoaded: (profile: YouTubeMusicProfile) => void;
}>): () => void {
  let disposed = false;
  void input.client.getProfile().then(
    (profile) => {
      if (!disposed) input.onLoaded(profile);
    },
    () => {
      if (!disposed) input.onFailed();
    },
  );
  return () => {
    disposed = true;
  };
}
