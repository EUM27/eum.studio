import { describe, expect, it } from "vitest";

import {
  isLocalMediaTrack,
  isYouTubeMusicTrack,
  localMediaPlaybackUrl,
  musicTrackIdentity,
  parseLocalMediaPlaybackUrl,
  parseInspectLocalMediaCommand,
  parseInspectLocalMediaResult,
  parseRelinkLocalMediaCommand,
  parseRelinkLocalMediaResult,
  parseLocalMediaTrackProjection,
  parseSelectLocalMediaCommand,
  parseSelectLocalMediaResult,
} from "./media-track";

describe("music media track contract", () => {
  const localTrack = {
    sourceKind: "local-file",
    mediaId: "media-a",
    workId: "work-a",
    title: "빗소리",
    fileName: "rain.mp3",
    mediaKind: "audio",
    mediaType: "audio/mpeg",
    storageMode: "external-reference",
    byteLength: 128,
  } as const;

  it("keeps an opaque local media identity without exposing its file path", () => {
    const parsed = parseLocalMediaTrackProjection(localTrack);

    expect(parsed).toEqual(localTrack);
    expect(JSON.stringify(parsed)).not.toContain(":\\");
    expect(isLocalMediaTrack(parsed)).toBe(true);
    expect(isYouTubeMusicTrack(parsed)).toBe(false);
    expect(musicTrackIdentity(parsed)).toBe("local:media-a");
  });

  it("round-trips the Work-owned streaming URL without embedding a local path", () => {
    const parsed = parseLocalMediaTrackProjection(localTrack);
    const url = localMediaPlaybackUrl(parsed);

    expect(url).toBe("eum-media://library/work-a/media-a");
    expect(parseLocalMediaPlaybackUrl(url)).toEqual({
      workId: "work-a",
      mediaId: "media-a",
    });
  });

  it("accepts both explicit registration modes and validates selected tracks", () => {
    expect(parseSelectLocalMediaCommand({
      schemaVersion: 1,
      workId: "work-a",
      storageMode: "external-reference",
    }).storageMode).toBe("external-reference");
    expect(parseSelectLocalMediaCommand({
      schemaVersion: 1,
      workId: "work-a",
      storageMode: "managed-copy",
    }).storageMode).toBe("managed-copy");

    expect(parseSelectLocalMediaResult({
      schemaVersion: 1,
      status: "selected",
      workId: "work-a",
      tracks: [localTrack],
    })).toEqual({
      schemaVersion: 1,
      status: "selected",
      workId: "work-a",
      tracks: [localTrack],
    });
  });

  it("validates Work-owned availability inspection and exact relink results", () => {
    expect(parseInspectLocalMediaCommand({
      schemaVersion: 1,
      workId: "work-a",
      mediaIds: ["media-a"],
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      mediaIds: ["media-a"],
    });
    expect(parseInspectLocalMediaResult({
      schemaVersion: 1,
      workId: "work-a",
      entries: [{
        schemaVersion: 1,
        workId: "work-a",
        mediaId: "media-a",
        status: "disconnected",
      }],
    }).entries[0]?.status).toBe("disconnected");
    const command = parseRelinkLocalMediaCommand({
      schemaVersion: 1,
      workId: "work-a",
      mediaId: "media-a",
    });
    expect(parseRelinkLocalMediaResult({
      schemaVersion: 1,
      status: "relinked",
      availability: {
        schemaVersion: 1,
        workId: command.workId,
        mediaId: command.mediaId,
        status: "available",
      },
    })).toMatchObject({
      status: "relinked",
      availability: { status: "available" },
    });
    expect(() => parseInspectLocalMediaResult({
      schemaVersion: 1,
      workId: "work-a",
      entries: [{
        schemaVersion: 1,
        workId: "work-b",
        mediaId: "media-a",
        status: "available",
      }],
    })).toThrow("cross the Work boundary");
  });
});
