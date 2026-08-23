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
      onClearQueue: () => undefined,
      onMoveQueueTrack: () => undefined,
      onPlayQueue: () => undefined,
      onPlayQueueTrack: () => undefined,
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

    expect(markup).toContain('aria-label="재생목록 탭"');
    expect(markup).toContain('aria-label="내 미디어 탭"');
    expect(markup).toContain('aria-label="YouTube 검색 탭"');
    expect(markup).toContain('aria-label="즐겨찾기 탭"');
    expect(markup).toContain('aria-label="재생목록"');
    expect(markup).toContain('aria-label="전체 재생"');
    expect(markup).toContain("집중 음악 위로 이동");
    expect(markup).toContain("집중 음악 아래로 이동");
    expect(markup).toContain("재생목록 비우기");
    expect(markup).toContain("저장됨");
  });
});
