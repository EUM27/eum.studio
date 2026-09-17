import { describe, expect, it, vi } from "vitest";

import { entityId } from "../../../domain/writing";
import {
  LOCAL_MEDIA_INSPECT_CHANNEL,
  LOCAL_MEDIA_RELINK_CHANNEL,
  createMusicPlaybackBridge,
} from "./music-playback-bridge";

describe("music playback bridge local media recovery", () => {
  it("round-trips path-free availability and relink commands", async () => {
    const workId = entityId<"Work">("work-a");
    const inspectCommand = {
      schemaVersion: 1,
      workId,
      mediaIds: ["media-a"],
    } as const;
    const inspectResult = {
      schemaVersion: 1,
      workId,
      entries: [{
        schemaVersion: 1,
        workId,
        mediaId: "media-a",
        status: "disconnected",
      }],
    } as const;
    const relinkCommand = {
      schemaVersion: 1,
      workId,
      mediaId: "media-a",
    } as const;
    const relinkResult = {
      schemaVersion: 1,
      status: "relinked",
      availability: {
        schemaVersion: 1,
        workId,
        mediaId: "media-a",
        status: "available",
      },
    } as const;
    const invoke = vi.fn(async (channel: string) => {
      if (channel === LOCAL_MEDIA_INSPECT_CHANNEL) return inspectResult;
      if (channel === LOCAL_MEDIA_RELINK_CHANNEL) return relinkResult;
      throw new Error(`Unexpected channel: ${channel}`);
    });
    const bridge = createMusicPlaybackBridge(invoke);

    await expect(
      bridge.inspectLocalMedia(inspectCommand),
    ).resolves.toEqual(inspectResult);
    await expect(
      bridge.relinkLocalMedia(relinkCommand),
    ).resolves.toEqual(relinkResult);
    expect(invoke).toHaveBeenCalledWith(
      LOCAL_MEDIA_INSPECT_CHANNEL,
      inspectCommand,
    );
    expect(invoke).toHaveBeenCalledWith(
      LOCAL_MEDIA_RELINK_CHANNEL,
      relinkCommand,
    );
    expect(JSON.stringify(invoke.mock.calls)).not.toContain(":\\");
  });
});
