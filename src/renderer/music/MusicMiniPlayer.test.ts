import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MusicMiniPlayer } from "./MusicMiniPlayer";

describe("MusicMiniPlayer", () => {
  it("keeps the idle YouTube player clear of inactive playback controls", () => {
    const markup = renderToStaticMarkup(createElement(MusicMiniPlayer, {
      connection: {
        schemaVersion: 1,
        revision: 1,
        apiKeyConfigured: true,
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
      focusText: "집중 18:42",
      onOpenLibrary: () => undefined,
      playRequest: null,
      profile: {
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
      },
    }));

    expect(markup).toContain('aria-label="음악 플레이어"');
    expect(markup).toContain("YouTube 재생 대기");
    expect(markup).toContain('aria-label="선곡·재생목록 열기"');
    expect(markup).not.toContain('aria-label="음악 설정 열기"');
    expect(markup).toContain("is-idle");
    expect(markup).not.toContain("집중 18:42");
    expect(markup).not.toContain('aria-label="음악 재생"');
    expect(markup).not.toContain('aria-label="YouTube 음량"');
    expect(markup).not.toContain("Spotify");
  });
});
