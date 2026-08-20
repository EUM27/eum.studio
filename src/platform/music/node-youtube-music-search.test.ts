import { describe, expect, it } from "vitest";

import { parseYouTubeMusicProfile } from "../../application/music/youtube-music";
import type { YouTubeMusicConnectionStore } from "./node-youtube-music-connection-store";
import { createNodeYouTubeMusicSearchClient } from "./node-youtube-music-search";

const profile = parseYouTubeMusicProfile({
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
});

function connectedStore(): YouTubeMusicConnectionStore {
  return {
    getStatus: () => ({
      schemaVersion: 1,
      revision: 1,
      apiKeyConfigured: true,
      updatedAt: "2026-08-18T00:00:00.000Z",
    }),
    save: async () => {
      throw new Error("not used");
    },
    readApiKey: () => "test-youtube-key",
  };
}

describe("node YouTube music search", () => {
  it("searches server-side with the stored key and returns embeddable video identities", async () => {
    const requestedUrls: string[] = [];
    const client = createNodeYouTubeMusicSearchClient({
      profile,
      store: connectedStore(),
      fetchImpl: async (url) => {
        requestedUrls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{
              id: { videoId: "video-a" },
              snippet: {
                title: "밤의 문 &amp; 새벽",
                channelTitle: "작곡가",
                thumbnails: {
                  medium: { url: "https://i.ytimg.com/vi/video-a/mqdefault.jpg" },
                },
              },
            }],
          }),
          text: async () => "",
        };
      },
    });

    await expect(client.searchVideos("닫힌 방 밤", 6)).resolves.toEqual([{
      providerId: "youtube",
      videoId: "video-a",
      title: "밤의 문 & 새벽",
      channel: "작곡가",
      thumbnailUrl: "https://i.ytimg.com/vi/video-a/mqdefault.jpg",
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    }]);
    const request = new URL(requestedUrls[0]!);
    expect(request.pathname).toBe("/youtube/v3/search");
    expect(request.searchParams.get("q")).toContain("닫힌 방 밤");
    expect(request.searchParams.get("q")).toContain("-shorts");
    expect(request.searchParams.get("videoDuration")).toBe("medium");
    expect(request.searchParams.get("type")).toBe("video");
    expect(request.searchParams.get("videoEmbeddable")).toBe("true");
    expect(request.searchParams.get("key")).toBe("test-youtube-key");
  });
});
