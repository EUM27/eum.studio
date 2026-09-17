import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  LOCAL_MEDIA_INSPECT_CHANNEL,
  LOCAL_MEDIA_RELINK_CHANNEL,
  LOCAL_MEDIA_SELECT_CHANNEL,
  SCENE_MUSIC_QUEUE_LIST_CHANNEL,
  SCENE_MUSIC_QUEUE_SEARCH_CHANNEL,
  SCENE_MUSIC_QUEUE_SELECT_CHANNEL,
  YOUTUBE_MUSIC_PROFILE_CHANNEL,
  YOUTUBE_MUSIC_SEARCH_CHANNEL,
} from "../../application/contracts/studio-bridge";
import {
  parseSearchYouTubeVideosCommand,
  type SearchYouTubeVideosCommand,
  type YouTubeMusicProfile,
  type YouTubeVideoSearchResult,
} from "../../application/music/youtube-music";
import {
  parseInspectLocalMediaCommand,
  parseRelinkLocalMediaCommand,
  parseSelectLocalMediaCommand,
  type InspectLocalMediaCommand,
  type InspectLocalMediaResult,
  type RelinkLocalMediaCommand,
  type RelinkLocalMediaResult,
  type SelectLocalMediaCommand,
  type SelectLocalMediaResult,
} from "../../application/music/media-track";
import {
  parseListSceneMusicQueueCandidatesCommand,
  parseSearchSceneMusicQueuesCommand,
  parseSelectSceneMusicQueueCommand,
  type ListSceneMusicQueueCandidatesCommand,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueCandidateList,
  type SceneMusicQueueSearchResult,
  type SearchSceneMusicQueuesCommand,
  type SelectSceneMusicQueueCommand,
} from "../../application/music/scene-music-queue-contract";

export type MusicPlaybackIpcRuntime = Readonly<{
  searchSceneMusicQueues: (
    command: SearchSceneMusicQueuesCommand,
  ) => Promise<SceneMusicQueueSearchResult>;
  listSceneMusicQueueCandidates: (
    command: ListSceneMusicQueueCandidatesCommand,
  ) => Promise<SceneMusicQueueCandidateList>;
  selectSceneMusicQueue: (
    command: SelectSceneMusicQueueCommand,
  ) => Promise<SceneMusicQueueCandidate>;
}>;

export function registerMusicPlaybackIpc(input: Readonly<{
  ipcMain: Pick<IpcMain, "handle">;
  authorizeSender: (event: IpcMainInvokeEvent) => void;
  runtime: MusicPlaybackIpcRuntime;
  profile: YouTubeMusicProfile;
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
}>): void {
  input.ipcMain.handle(YOUTUBE_MUSIC_PROFILE_CHANNEL, (event) => {
    input.authorizeSender(event);
    return input.profile;
  });
  input.ipcMain.handle(
    YOUTUBE_MUSIC_SEARCH_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.searchVideos(parseSearchYouTubeVideosCommand(value));
    },
  );
  input.ipcMain.handle(LOCAL_MEDIA_SELECT_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.selectLocalMedia(parseSelectLocalMediaCommand(value));
  });
  input.ipcMain.handle(LOCAL_MEDIA_INSPECT_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.inspectLocalMedia(parseInspectLocalMediaCommand(value));
  });
  input.ipcMain.handle(LOCAL_MEDIA_RELINK_CHANNEL, (event, value: unknown) => {
    input.authorizeSender(event);
    return input.relinkLocalMedia(parseRelinkLocalMediaCommand(value));
  });
  input.ipcMain.handle(
    SCENE_MUSIC_QUEUE_SEARCH_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.searchSceneMusicQueues(
        parseSearchSceneMusicQueuesCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    SCENE_MUSIC_QUEUE_LIST_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.listSceneMusicQueueCandidates(
        parseListSceneMusicQueueCandidatesCommand(value),
      );
    },
  );
  input.ipcMain.handle(
    SCENE_MUSIC_QUEUE_SELECT_CHANNEL,
    (event, value: unknown) => {
      input.authorizeSender(event);
      return input.runtime.selectSceneMusicQueue(
        parseSelectSceneMusicQueueCommand(value),
      );
    },
  );
}
