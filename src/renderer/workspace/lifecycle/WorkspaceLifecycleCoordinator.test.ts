import { describe, expect, it } from "vitest";

import { LatestWorkspaceActivationLane } from "./WorkspaceLifecycleCoordinator";

function deferred(): Readonly<{
  promise: Promise<void>;
  resolve: () => void;
}> {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise === undefined) {
    throw new Error("Deferred activation was not initialized");
  }
  return Object.freeze({ promise, resolve: resolvePromise });
}

describe("LatestWorkspaceActivationLane", () => {
  it("runs one activation at a time and keeps only the latest pending selection", async () => {
    const lane = new LatestWorkspaceActivationLane();
    const firstGate = deferred();
    const runs: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const task = (label: string, gate: Promise<void> = Promise.resolve()) =>
      async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        runs.push(label);
        await gate;
        active -= 1;
      };

    const first = lane.enqueue(task("first", firstGate.promise));
    const superseded = lane.enqueue(task("superseded"));
    const latest = lane.enqueue(task("latest"));

    expect(runs).toEqual(["first"]);
    firstGate.resolve();
    await Promise.all([first, superseded, latest]);

    expect(runs).toEqual(["first", "latest"]);
    expect(maximumActive).toBe(1);
  });
});
