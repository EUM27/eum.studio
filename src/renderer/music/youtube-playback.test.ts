import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { loadYouTubePlayback } from "./youtube-playback";

it("restores a paused video without starting audio, and retains the playback position", () => {
  const player = { cueVideoById: vi.fn(), loadVideoById: vi.fn() };
  const videoId = randomUUID();
  loadYouTubePlayback(player, videoId, { currentTime: 12.5, paused: true });
  expect(player.cueVideoById).toHaveBeenCalledWith({ videoId, startSeconds: 12.5 });
  expect(player.loadVideoById).not.toHaveBeenCalled();
  loadYouTubePlayback(player, videoId, { currentTime: 12.5, paused: false });
  expect(player.loadVideoById).toHaveBeenCalledWith({ videoId, startSeconds: 12.5 });
  loadYouTubePlayback(player, videoId);
  expect(player.loadVideoById).toHaveBeenLastCalledWith(videoId);
});
