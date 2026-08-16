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
