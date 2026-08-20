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
    expect(profile.workDefaults.favoriteVideos).toEqual([]);
    expect(profile.workDefaults.playlistVideos).toEqual([]);
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
        favoriteVideos: [favorite],
      },
    }, profile).settings.favoriteVideos).toEqual([favorite]);
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
        playlistVideos: videos,
      },
    }, profile).settings.playlistVideos).toEqual(videos);
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
