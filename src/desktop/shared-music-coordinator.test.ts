import { describe, expect, it, vi } from "vitest";
import { SharedMusicCoordinator } from "./shared-music-coordinator";
import type { SharedMusicState } from "../application/music/shared-music-playback";

const state: SharedMusicState = {
  queue: [], currentIndex: 0, paused: true, loading: false, error: null, volume: 70, previousAudibleVolume: 70,
  currentTime: 0, duration: 0, repeatMode: "off", shuffle: false, showVideo: false,
  order: { order: [], position: 0, queueLength: 0, shuffled: false },
};
describe("shared music coordinator", () => {
  it("sends both windows' controls to only one playback owner", () => {
    const player = new SharedMusicCoordinator();
    const first = vi.fn(); const second = vi.fn();
    player.attach(1, first); player.attach(2, second);
    first.mockClear(); second.mockClear();
    player.command(2, { type: "toggle" });
    player.command(1, { type: "next" });
    expect(first.mock.calls.map(([message]) => message.command.type)).toEqual(["toggle", "next"]);
    expect(second).not.toHaveBeenCalled();
  });
  it("hands the last playback state to a surviving window and ignores old-owner updates", () => {
    const player = new SharedMusicCoordinator();
    player.attach(1, vi.fn());
    const oldEpoch = player.snapshot.epoch;
    player.publish(1, oldEpoch, { ...state, currentTime: 27 });
    const second = vi.fn(); player.attach(2, second);
    player.detach(1);
    expect(player.snapshot).toMatchObject({ ownerId: 2, state: { currentTime: 27 } });
    player.publish(1, oldEpoch, { ...state, currentTime: 0 });
    expect(player.snapshot.state?.currentTime).toBe(27);
    expect(second.mock.calls.at(-1)?.[0].snapshot.ownerId).toBe(2);
    player.publish(2, player.snapshot.epoch, { ...state, currentTime: 28 });
    expect(player.snapshot.state?.currentTime).toBe(28);
  });
});
