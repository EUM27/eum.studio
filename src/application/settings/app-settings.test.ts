import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createDefaultAppSettingsProjection,
  deriveWorkEpisodeCharacterProgress,
  parseAppSettingsProfile,
  parseSaveAppSettingsCommand,
  parseWorkEpisodeCharacterProgress,
} from "./app-settings";

describe("app settings", () => {
  const profile = parseAppSettingsProfile({
    schemaVersion: 1,
    defaultEpisodeCharacters: {
      defaultValue: 4_000,
      minValue: 100,
      maxValue: 100_000,
    },
  });

  it("takes the episode character default and limits only from the runtime profile", () => {
    expect(createDefaultAppSettingsProjection(profile)).toEqual({
      schemaVersion: 1,
      revision: 0,
      settings: { defaultEpisodeCharacters: 4_000 },
      updatedAt: null,
    });
    expect(
      parseSaveAppSettingsCommand(
        {
          schemaVersion: 1,
          expectedRevision: 7,
          settings: { defaultEpisodeCharacters: 3_210 },
        },
        profile,
      ).settings.defaultEpisodeCharacters,
    ).toBe(3_210);
    expect(() =>
      parseSaveAppSettingsCommand(
        {
          schemaVersion: 1,
          expectedRevision: 7,
          settings: { defaultEpisodeCharacters: 99 },
        },
        profile,
      ),
    ).toThrow("defaultEpisodeCharacters");
  });

  it("derives user-character episode completion for one exact Work", () => {
    const workId = entityId<"Work">("work-a");
    const progress = deriveWorkEpisodeCharacterProgress({
      workId,
      defaultEpisodeCharacters: 3,
      documents: [
        {
          workId,
          documentId: entityId<"Document">("document-a"),
          text: "한👨‍👩‍👧‍👦e\u0301",
        },
        {
          workId,
          documentId: entityId<"Document">("document-b"),
          text: "두 글",
        },
      ],
    });

    expect(progress).toEqual({
      defaultEpisodeCharacters: 3,
      totalCharacters: 6,
      totalEpisodeCount: 2,
      completedEpisodeCount: 2,
      completedEpisodeNumbers: [1, 2],
    });
    expect(() =>
      deriveWorkEpisodeCharacterProgress({
        workId,
        defaultEpisodeCharacters: 3,
        documents: [{
          workId: entityId<"Work">("work-b"),
          documentId: entityId<"Document">("document-c"),
          text: "다른 작품",
        }],
      }),
    ).toThrow("Work boundary");
    expect(() =>
      parseWorkEpisodeCharacterProgress({
        ...progress,
        completedEpisodeCount: 1,
      }),
    ).toThrow("inconsistent");
  });
});
