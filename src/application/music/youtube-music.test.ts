import { describe, expect, it } from "vitest";

import {
  parseSearchYouTubeVideosCommand,
  parseYouTubeMusicProfile,
  parseYouTubeVideoSearchResult,
  parseYouTubeVideoProjection,
} from "./youtube-music";

describe("YouTube music contract", () => {
  it("parses the configured search and IFrame endpoints", () => {
    expect(parseYouTubeMusicProfile({
      schemaVersion: 1,
      providerId: "youtube",
      displayName: "YouTube",
      searchApiBaseUrl: "https://www.googleapis.com/youtube/v3",
      iframeApiUrl: "https://www.youtube.com/iframe_api",
      watchBaseUrl: "https://www.youtube.com/watch",
      playerReferer: "https://eum-studio/",
      searchLimit: 6,
      videosPerOption: 3,
      requestTimeoutMs: 10_000,
    })).toMatchObject({
      providerId: "youtube",
      searchLimit: 6,
      videosPerOption: 3,
    });
  });

  it("keeps the exact YouTube video identity used by the player", () => {
    expect(parseYouTubeVideoProjection({
      providerId: "youtube",
      videoId: "video-a",
      title: "밤의 문",
      channel: "작곡가",
      thumbnailUrl: "https://i.ytimg.com/vi/video-a/mqdefault.jpg",
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    })).toMatchObject({
      videoId: "video-a",
      title: "밤의 문",
      channel: "작곡가",
    });
  });

  it("keeps an arbitrary general search query and its playable results", () => {
    const command = parseSearchYouTubeVideosCommand({
      schemaVersion: 1,
      query: "집중용 피아노",
    });
    expect(command.query).toBe("집중용 피아노");
    expect(parseYouTubeVideoSearchResult({
      schemaVersion: 1,
      query: command.query,
      videos: [{
        providerId: "youtube",
        videoId: "video-a",
        title: "집중 피아노",
        channel: "작곡가",
        thumbnailUrl: null,
        externalUrl: "https://www.youtube.com/watch?v=video-a",
      }],
    }).videos[0]?.videoId).toBe("video-a");
  });
});
