import {
  parseSearchYouTubeVideosCommand,
  parseYouTubeMusicProfile,
  parseYouTubeVideoSearchResult,
  type SearchYouTubeVideosCommand,
  type YouTubeMusicProfile,
  type YouTubeVideoSearchResult,
} from "../../music/youtube-music";
import {
  parseSelectLocalMediaCommand,
  parseSelectLocalMediaResult,
  type SelectLocalMediaCommand,
  type SelectLocalMediaResult,
} from "../../music/media-track";
import {
  parseListSceneMusicQueueCandidatesCommand,
  parseSceneMusicQueueCandidate,
  parseSceneMusicQueueCandidateList,
  parseSceneMusicQueueSearchResult,
  parseSearchSceneMusicQueuesCommand,
  parseSelectSceneMusicQueueCommand,
  type ListSceneMusicQueueCandidatesCommand,
  type SceneMusicQueueCandidate,
  type SceneMusicQueueCandidateList,
  type SceneMusicQueueSearchResult,
  type SearchSceneMusicQueuesCommand,
  type SelectSceneMusicQueueCommand,
} from "../../music/scene-music-queue-contract";

export const YOUTUBE_MUSIC_PROFILE_CHANNEL = "studio:music:youtube-profile";
export const YOUTUBE_MUSIC_SEARCH_CHANNEL = "studio:music:youtube-search";
export const LOCAL_MEDIA_SELECT_CHANNEL = "studio:music:local-media-select";
export const SCENE_MUSIC_QUEUE_SEARCH_CHANNEL =
  "studio:music:scene-queue-search";
export const SCENE_MUSIC_QUEUE_LIST_CHANNEL =
  "studio:music:scene-queue-list";
export const SCENE_MUSIC_QUEUE_SELECT_CHANNEL =
  "studio:music:scene-queue-select";

export type MusicPlaybackBridgeChannel =
  | typeof YOUTUBE_MUSIC_PROFILE_CHANNEL
  | typeof YOUTUBE_MUSIC_SEARCH_CHANNEL
  | typeof LOCAL_MEDIA_SELECT_CHANNEL
  | typeof SCENE_MUSIC_QUEUE_SEARCH_CHANNEL
  | typeof SCENE_MUSIC_QUEUE_LIST_CHANNEL
  | typeof SCENE_MUSIC_QUEUE_SELECT_CHANNEL;

export type MusicPlaybackBridgePayload =
  | SearchYouTubeVideosCommand
  | SelectLocalMediaCommand
  | SearchSceneMusicQueuesCommand
  | ListSceneMusicQueueCandidatesCommand
  | SelectSceneMusicQueueCommand;

export type MusicPlaybackBridge = Readonly<{
  getProfile: () => Promise<YouTubeMusicProfile>;
  searchVideos: (
    command: SearchYouTubeVideosCommand,
  ) => Promise<YouTubeVideoSearchResult>;
  selectLocalMedia: (
    command: SelectLocalMediaCommand,
  ) => Promise<SelectLocalMediaResult>;
  searchSceneQueues: (
    command: SearchSceneMusicQueuesCommand,
  ) => Promise<SceneMusicQueueSearchResult>;
  listSceneQueueCandidates: (
    command: ListSceneMusicQueueCandidatesCommand,
  ) => Promise<SceneMusicQueueCandidateList>;
  selectSceneQueue: (
    command: SelectSceneMusicQueueCommand,
  ) => Promise<SceneMusicQueueCandidate>;
}>;

export type MusicPlaybackBridgeInvoke = (
  channel: MusicPlaybackBridgeChannel,
  payload?: MusicPlaybackBridgePayload,
) => Promise<unknown>;

export function createMusicPlaybackBridge(
  invoke: MusicPlaybackBridgeInvoke,
): MusicPlaybackBridge {
  return Object.freeze({
    getProfile: async () => {
      const value = await invoke(YOUTUBE_MUSIC_PROFILE_CHANNEL);
      try {
        return parseYouTubeMusicProfile(value);
      } catch {
        throw new Error("Invalid YouTube music profile");
      }
    },
    searchVideos: async (input) => {
      const command = parseSearchYouTubeVideosCommand(input);
      const value = await invoke(YOUTUBE_MUSIC_SEARCH_CHANNEL, command);
      try {
        return parseYouTubeVideoSearchResult(value);
      } catch {
        throw new Error("Invalid YouTube music search result");
      }
    },
    selectLocalMedia: async (input) => {
      const command = parseSelectLocalMediaCommand(input);
      const value = await invoke(LOCAL_MEDIA_SELECT_CHANNEL, command);
      try {
        const result = parseSelectLocalMediaResult(value);
        if (result.status === "selected" && result.workId !== command.workId) {
          throw new Error("Selected local media crossed the Work boundary");
        }
        return result;
      } catch {
        throw new Error("Invalid local media selection result");
      }
    },
    searchSceneQueues: async (input) => {
      const command = parseSearchSceneMusicQueuesCommand(input);
      const value = await invoke(SCENE_MUSIC_QUEUE_SEARCH_CHANNEL, command);
      try {
        return parseSceneMusicQueueSearchResult(value);
      } catch {
        throw new Error("Invalid scene music queue search result");
      }
    },
    listSceneQueueCandidates: async (input) => {
      const command = parseListSceneMusicQueueCandidatesCommand(input);
      const value = await invoke(SCENE_MUSIC_QUEUE_LIST_CHANNEL, command);
      try {
        return parseSceneMusicQueueCandidateList(value);
      } catch {
        throw new Error("Invalid scene music queue Candidate list");
      }
    },
    selectSceneQueue: async (input) => {
      const command = parseSelectSceneMusicQueueCommand(input);
      const value = await invoke(SCENE_MUSIC_QUEUE_SELECT_CHANNEL, command);
      try {
        return parseSceneMusicQueueCandidate(value);
      } catch {
        throw new Error("Invalid selected scene music queue Candidate");
      }
    },
  });
}
