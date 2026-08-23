import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { MusicLibraryDialog } from "./MusicLibraryDialog";

describe("MusicLibraryDialog", () => {
  it("exposes real search, playback queue, and favorite controls", () => {
    const video = {
      providerId: "youtube",
      videoId: "video-a",
      title: "집중 음악",
      channel: "채널",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    };
    const markup = renderToStaticMarkup(createElement(MusicLibraryDialog, {
      connected: true,
      error: null,
      favorites: [video],
      localMedia: [{
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
      onAddToQueue: () => undefined,
      onClose: () => undefined,
      onOpenConnectionSettings: () => undefined,
      onPlayQueue: () => undefined,
      onPlayTrack: () => undefined,
      onRegisterLocalMedia: () => undefined,
      onRemoveFromQueue: () => undefined,
      onSearch: () => undefined,
      onToggleFavorite: () => undefined,
      queue: [video],
      queueSaving: false,
      registeringMode: null,
      results: [video],
      searching: false,
    }));

    expect(markup).toContain("미디어 라이브러리");
    expect(markup).toContain('aria-label="원본 위치 연결"');
    expect(markup).toContain('aria-label="앱에 가져오기"');
    expect(markup).toMatch(/aria-label="원본 위치 연결"[^>]*checked/u);
    expect(markup).toContain("미디어 파일 등록");
    expect(markup).toContain('aria-label="내 미디어"');
    expect(markup).toContain("rain.mp3");
    expect(markup).toContain('aria-label="음악 검색어"');
    expect(markup).toContain('aria-label="재생목록"');
    expect(markup).toContain('aria-label="즐겨찾기"');
    expect(markup).toContain("전체 재생");
    expect(markup).toContain("작품에 저장됨");
  });
});
