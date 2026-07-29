import {
  randomInt,
  randomUUID,
} from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc2PerformanceProfile,
} from "./poc-2-performance-profile";

function createProfile() {
  return {
    schemaVersion: 1,
    independentRunCount:
      randomInt(2, 8),
    warmupSampleCountPerRun:
      randomInt(0, 8),
    measuredSampleCountPerRun:
      randomInt(1, 32),
    maximumDurableAckP95Ms:
      randomInt(1, 2_000),
    batching: {
      schemaVersion: 1,
      maxTransactionsPerBatch:
        randomInt(1, 8),
      maxDelayMs: randomInt(0, 2_000),
    },
  } as const;
}

describe("POC-2 performance profile", () => {
  it("strictly accepts and deeply freezes a caller-complete profile", () => {
    const input = createProfile();
    const profile =
      parsePoc2PerformanceProfile(input);

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(
      true,
    );
    expect(
      Object.isFrozen(profile.batching),
    ).toBe(true);
  });

  it("rejects missing, unsupported, and invalid measurement inputs without defaults", () => {
    const missing = {
      ...createProfile(),
    } as Record<string, unknown>;
    Reflect.deleteProperty(
      missing,
      "independentRunCount",
    );

    expect(() =>
      parsePoc2PerformanceProfile(
        missing,
      ),
    ).toThrow(/independentRunCount/);
    expect(() =>
      parsePoc2PerformanceProfile({
        ...createProfile(),
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow(/Unsupported/);
    expect(() =>
      parsePoc2PerformanceProfile({
        ...createProfile(),
        measuredSampleCountPerRun: 0,
      }),
    ).toThrow(
      /measuredSampleCountPerRun/,
    );
    expect(() =>
      parsePoc2PerformanceProfile({
        ...createProfile(),
        maximumDurableAckP95Ms:
          Number.NaN,
      }),
    ).toThrow(
      /maximumDurableAckP95Ms/,
    );
  });
});
