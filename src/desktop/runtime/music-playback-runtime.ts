import type { MusicPlaybackIpcRuntime } from "../ipc/register-music-playback-ipc";

export function pickMusicPlaybackRuntime(
  runtime: MusicPlaybackIpcRuntime,
): MusicPlaybackIpcRuntime {
  return Object.freeze({
    searchSceneMusicQueues: (command) =>
      runtime.searchSceneMusicQueues(command),
    listSceneMusicQueueCandidates: (command) =>
      runtime.listSceneMusicQueueCandidates(command),
    selectSceneMusicQueue: (command) =>
      runtime.selectSceneMusicQueue(command),
  });
}
