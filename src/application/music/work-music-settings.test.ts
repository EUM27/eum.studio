import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createDefaultWorkMusicSettingsProjection,
  parseMusicSettingsProfile,
  parseSaveWorkMusicSettingsCommand,
} from "./work-music-settings";

describe("work music settings", () => {
  const profile = parseMusicSettingsProfile({
    schemaVersion: 1,
    workDefaults: {
      autoOnEpisodeTransition: false,
      autoOnSceneTransition: false,
      autoPlayOnPomodoroStart: true,
      preciseSelection: false,
      transitionPlaybackMode: "restart",
    },
    transitionPlaybackModes: ["restart", "ask"],
  });

  it("creates settings for one exact Work from the runtime profile", () => {
    const workId = entityId<"Work">("work-music-a");

    expect(createDefaultWorkMusicSettingsProjection(workId, profile)).toEqual({
      schemaVersion: 1,
      workId,
      revision: 0,
      settings: profile.workDefaults,
      updatedAt: null,
    });
    expect(profile.workDefaults.favoriteTracks).toEqual([]);
    expect(profile.workDefaults.playlistTracks).toEqual([]);
    expect(profile.workDefaults.localMedia).toEqual([]);
  });

  it("preserves unique favorite videos in Work-owned settings", () => {
    const workId = entityId<"Work">("work-music-a");
    const favorite = {
      providerId: "youtube",
      videoId: "video-a",
      title: "집중 음악",
      channel: "작곡가",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    };

    expect(parseSaveWorkMusicSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 2,
      settings: {
        ...profile.workDefaults,
        favoriteTracks: [favorite],
      },
    }, profile).settings.favoriteTracks).toEqual([favorite]);
  });

  it("preserves the ordered playlist in Work-owned settings", () => {
    const workId = entityId<"Work">("work-music-a");
    const videos = [1, 2].map((index) => ({
      providerId: "youtube",
      videoId: `video-${index}`,
      title: `곡 ${index}`,
      channel: "작곡가",
      thumbnailUrl: null,
      externalUrl: `https://www.youtube.com/watch?v=video-${index}`,
    }));

    expect(parseSaveWorkMusicSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 2,
      settings: {
        ...profile.workDefaults,
        playlistTracks: videos,
      },
    }, profile).settings.playlistTracks).toEqual(videos);
  });

  it("preserves registered local media and an ordered mixed playlist", () => {
    const workId = entityId<"Work">("work-music-a");
    const localTrack = {
      sourceKind: "local-file",
      mediaId: "media-a",
      workId,
      title: "빗소리",
      fileName: "rain.mp3",
      mediaKind: "audio",
      mediaType: "audio/mpeg",
      storageMode: "external-reference",
      byteLength: 128,
    } as const;
    const youtubeTrack = {
      providerId: "youtube",
      videoId: "video-a",
      title: "집중 음악",
      channel: "작곡가",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=video-a",
    };

    const settings = parseSaveWorkMusicSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 2,
      settings: {
        ...profile.workDefaults,
        localMedia: [localTrack],
        playlistTracks: [youtubeTrack, localTrack],
      },
    }, profile).settings;

    expect(settings.localMedia).toEqual([localTrack]);
    expect(settings.playlistTracks).toEqual([youtubeTrack, localTrack]);
  });

  it("reads the previous YouTube-only field names into the unified track fields", () => {
    const workId = entityId<"Work">("work-music-a");
    const video = {
      providerId: "youtube",
      videoId: "legacy-video",
      title: "기존 영상",
      channel: "채널",
      thumbnailUrl: null,
      externalUrl: "https://www.youtube.com/watch?v=legacy-video",
    };

    const settings = parseSaveWorkMusicSettingsCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 2,
      settings: {
        autoOnEpisodeTransition: false,
        autoOnSceneTransition: false,
        autoPlayOnPomodoroStart: true,
        preciseSelection: false,
        transitionPlaybackMode: "restart",
        favoriteVideos: [video],
        playlistVideos: [video],
      },
    }, profile).settings;

    expect(settings.favoriteTracks).toEqual([video]);
    expect(settings.playlistTracks).toEqual([video]);
  });

  it("accepts only the configured transition playback modes", () => {
    const workId = entityId<"Work">("work-music-a");
    expect(
      parseSaveWorkMusicSettingsCommand(
        {
          schemaVersion: 1,
          workId,
          expectedRevision: 2,
          settings: {
            ...profile.workDefaults,
            autoOnEpisodeTransition: true,
            transitionPlaybackMode: "ask",
          },
        },
        profile,
      ).settings.transitionPlaybackMode,
    ).toBe("ask");
    expect(() =>
      parseSaveWorkMusicSettingsCommand(
        {
          schemaVersion: 1,
          workId,
          expectedRevision: 2,
          settings: {
            ...profile.workDefaults,
            transitionPlaybackMode: "resume",
          },
        },
        profile,
      ),
    ).toThrow("transitionPlaybackMode");
  });
});
