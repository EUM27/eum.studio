import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { summarizeDurations } from "./measurement-summary";

describe("measurement summary", () => {
  it("summarizes a copied sample set without mutating the caller input", () => {
    const sampleCount = randomInt(8, 32);
    const durations = Array.from({ length: sampleCount }, () =>
      randomInt(1, 10_000),
    );
    const originalOrder = [...durations];
    const summary = summarizeDurations({
      runId: randomUUID(),
      scenarioId: randomUUID(),
      durationsMs: durations,
    });

    expect(durations).toEqual(originalOrder);
    expect(summary.sampleCount).toBe(sampleCount);
    expect(summary.p50Ms).toBeGreaterThanOrEqual(summary.minMs);
    expect(summary.p95Ms).toBeGreaterThanOrEqual(summary.p50Ms);
    expect(summary.maxMs).toBeGreaterThanOrEqual(summary.p95Ms);
  });

  it("rejects empty or invalid duration sets", () => {
    expect(() =>
      summarizeDurations({
        runId: randomUUID(),
        scenarioId: randomUUID(),
        durationsMs: [],
      }),
    ).toThrow("at least one duration");

    expect(() =>
      summarizeDurations({
        runId: randomUUID(),
        scenarioId: randomUUID(),
        durationsMs: [Number.NaN],
      }),
    ).toThrow("finite non-negative");
  });
});
