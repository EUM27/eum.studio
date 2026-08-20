import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
      onAddToQueue: () => undefined,
      onClose: () => undefined,
      onOpenConnectionSettings: () => undefined,
      onPlayQueue: () => undefined,
      onPlayVideo: () => undefined,
      onRemoveFromQueue: () => undefined,
      onSearch: () => undefined,
      onToggleFavorite: () => undefined,
      queue: [video],
      queueSaving: false,
      results: [video],
      searching: false,
    }));

    expect(markup).toContain('aria-label="음악 검색어"');
    expect(markup).toContain('aria-label="재생목록"');
    expect(markup).toContain('aria-label="선호 영상"');
    expect(markup).toContain("전체 재생");
    expect(markup).toContain("작품에 저장됨");
  });
});
