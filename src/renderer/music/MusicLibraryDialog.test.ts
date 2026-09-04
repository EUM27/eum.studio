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
      localMediaAvailability: { "media-a": "available" },
      onAddToQueue: () => undefined,
      onClose: () => undefined,
      onOpenConnectionSettings: () => undefined,
      onClearQueue: () => undefined,
      onMoveQueueTrack: () => undefined,
      onPlayQueue: () => undefined,
      onPlayQueueTrack: () => undefined,
      onPlayTrack: () => undefined,
      onRegisterLocalMedia: () => undefined,
      onRelinkLocalMedia: () => undefined,
      onRemoveLocalMedia: () => undefined,
      onRemoveFromQueue: () => undefined,
      onSearch: () => undefined,
      onToggleFavorite: () => undefined,
      queue: [video],
      queueSaving: false,
      registeringMode: null,
      removingMediaId: null,
      relinkingMediaId: null,
      results: [video],
      searching: false,
    }));

    expect(markup).toContain('aria-label="재생목록 탭"');
    expect(markup).toContain('aria-label="내 미디어 탭"');
    expect(markup).toContain('aria-label="YouTube 검색 탭"');
    expect(markup).toContain('aria-label="즐겨찾기 탭"');
    expect(markup).toContain('<button aria-label="원본 위치 연결"');
    expect(markup).toContain('<button aria-label="앱에 가져오기"');
    expect(markup).not.toContain("미디어 파일 등록");
    expect(markup).toContain('aria-label="재생목록"');
    expect(markup).toContain('aria-label="전체 재생"');
    expect(markup).toContain("집중 음악 위로 이동");
    expect(markup).toContain("집중 음악 아래로 이동");
    expect(markup).toContain("재생목록 비우기");
    expect(markup).toContain("저장됨");

    const disconnectedMarkup = renderToStaticMarkup(createElement(
      MusicLibraryDialog,
      {
        connected: true,
        error: null,
        favorites: [],
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
        localMediaAvailability: { "media-a": "disconnected" },
        onAddToQueue: () => undefined,
        onClose: () => undefined,
        onOpenConnectionSettings: () => undefined,
        onClearQueue: () => undefined,
        onMoveQueueTrack: () => undefined,
        onPlayQueue: () => undefined,
        onPlayQueueTrack: () => undefined,
        onPlayTrack: () => undefined,
        onRegisterLocalMedia: () => undefined,
        onRelinkLocalMedia: () => undefined,
        onRemoveLocalMedia: () => undefined,
        onRemoveFromQueue: () => undefined,
        onSearch: () => undefined,
        onToggleFavorite: () => undefined,
        queue: [],
        queueSaving: false,
        registeringMode: null,
        removingMediaId: null,
        relinkingMediaId: null,
        results: [],
        searching: false,
      },
    ));
    expect(disconnectedMarkup).toContain("연결 끊김");
    expect(disconnectedMarkup).toContain('aria-label="빗소리 다시 연결"');
    expect(disconnectedMarkup).toContain(
      'aria-label="빗소리 바로 재생" disabled=""',
    );
  });
});
