import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { MusicMiniPlayer } from "./MusicMiniPlayer";

describe("MusicMiniPlayer", () => {
  it("keeps a compact full player visible while idle", () => {
    const markup = renderToStaticMarkup(createElement(MusicMiniPlayer, {
      connection: {
        schemaVersion: 1,
        revision: 1,
        apiKeyConfigured: true,
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
      focusText: "집중 18:42",
      onOpenLibrary: () => undefined,
      onPlayPlaylist: () => undefined,
      playlist: [{
        sourceKind: "local-file",
        mediaId: "media-a",
        workId: entityId<"Work">("work-a"),
        title: "빗소리",
        fileName: "rain.mp3",
        mediaKind: "audio",
        mediaType: "audio/mpeg",
        storageMode: "external-reference",
        byteLength: 128,
      }],
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
    expect(markup).toContain("재생할 곡을 선택하세요");
    expect(markup).toContain('aria-label="선곡·재생목록 열기"');
    expect(markup).not.toContain('aria-label="음악 설정 열기"');
    expect(markup).toContain("is-idle");
    expect(markup).not.toContain("집중 18:42");
    expect(markup).toContain('aria-label="이전 곡"');
    expect(markup).toContain('aria-label="음악 재생"');
    expect(markup).toContain('aria-label="다음 곡"');
    expect(markup).toContain('aria-label="랜덤 전체 반복 켜기"');
    expect(markup).toContain('aria-label="반복 끔"');
    expect(markup).toContain('aria-label="음악 재생"');
    expect(markup).toContain('aria-label="선곡·재생목록 열기"');
    expect(markup).toContain('aria-label="재생 위치"');
    expect(markup).toContain('aria-label="음량"');
    expect(markup).not.toContain("Spotify");
  });
});
