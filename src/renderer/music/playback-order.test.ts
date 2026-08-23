import { describe, expect, it } from "vitest";

import {
  createPlaybackOrder,
  endedPlaybackStep,
  nextPlaybackStep,
  previousPlaybackStep,
} from "./playback-order";

describe("music playback order", () => {
  it("keeps the whole ordered queue when playback starts from a selected track", () => {
    let state = createPlaybackOrder(4, 1, false, () => 0);

    const next = nextPlaybackStep(state, "off", () => 0);
    expect(next?.index).toBe(2);
    state = next!.state;

    const previous = previousPlaybackStep(state, "off");
    expect(previous?.index).toBe(1);
  });

  it("separates one-track repeat, full repeat, and repeat-off behavior", () => {
    const last = createPlaybackOrder(3, 2, false, () => 0);

    expect(endedPlaybackStep(last, "one", () => 0)?.index).toBe(2);
    expect(endedPlaybackStep(last, "all", () => 0)?.index).toBe(0);
    expect(endedPlaybackStep(last, "off", () => 0)).toBeNull();
  });

  it("plays every queued track once before random full repeat reshuffles", () => {
    let state = createPlaybackOrder(4, 0, true, () => 0);
    const firstCycle = [state.order[state.position]];

    for (let index = 0; index < 3; index += 1) {
      const step = endedPlaybackStep(state, "all", () => 0);
      expect(step).not.toBeNull();
      state = step!.state;
      firstCycle.push(step!.index);
    }

    expect(new Set(firstCycle)).toEqual(new Set([0, 1, 2, 3]));
    const nextCycle = endedPlaybackStep(state, "all", () => 0);
    expect(nextCycle).not.toBeNull();
    expect(nextCycle!.index).not.toBe(firstCycle.at(-1));
  });

  it("returns to the actual previous shuffled track", () => {
    let state = createPlaybackOrder(4, 0, true, () => 0);
    const next = nextPlaybackStep(state, "all", () => 0)!;
    state = next.state;
    const afterNext = nextPlaybackStep(state, "all", () => 0)!;
    state = afterNext.state;

    const previous = previousPlaybackStep(state, "all");
    expect(previous?.index).toBe(next.index);
  });
});
