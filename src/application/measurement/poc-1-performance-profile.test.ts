import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parsePoc1PerformanceProfile,
  type Poc1PerformanceScenarioKind,
} from "./poc-1-performance-profile";

const scenarioKinds: readonly Poc1PerformanceScenarioKind[] = [
  "document-switch",
  "work-search",
  "input",
];

function createProfile() {
  return {
    schemaVersion: 1,
    longformFixturePath: randomUUID(),
    artifactDirectory: randomUUID(),
    correctness: {
      minimumDocumentSwitchCount: randomInt(1, 200),
      maximumOwnershipViolationCount: randomInt(0, 3),
      maximumSearchMismatchCount: randomInt(0, 3),
      maximumInputMismatchCount: randomInt(0, 3),
    },
    searchQueries: [randomUUID(), randomUUID()],
    inputSamples: [randomUUID().slice(0, 1), randomUUID().slice(0, 1)],
    scenarios: scenarioKinds.map((kind) => ({
      id: randomUUID(),
      kind,
      sampleCount: randomInt(3, 20),
      warmupCount: randomInt(0, 3),
      maximumP95Ms: randomInt(20, 2_000),
    })),
  };
}

describe("parsePoc1PerformanceProfile", () => {
  it("deeply freezes the fixture-owned scenarios and correctness budgets", () => {
    const input = createProfile();

    const profile = parsePoc1PerformanceProfile(input);

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.correctness)).toBe(true);
    expect(Object.isFrozen(profile.scenarios)).toBe(true);
    expect(Object.isFrozen(profile.scenarios[0])).toBe(true);
    expect(Object.isFrozen(profile.searchQueries)).toBe(true);
    expect(Object.isFrozen(profile.inputSamples)).toBe(true);
  });

  it("rejects missing, duplicate, and invalid scenario contracts", () => {
    const profile = createProfile();

    expect(() =>
      parsePoc1PerformanceProfile({
        ...profile,
        scenarios: profile.scenarios.slice(1),
      }),
    ).toThrow(/scenario kind/i);
    expect(() =>
      parsePoc1PerformanceProfile({
        ...profile,
        scenarios: [
          ...profile.scenarios,
          { ...profile.scenarios[0], id: randomUUID() },
        ],
      }),
    ).toThrow(/scenario kind/i);
    expect(() =>
      parsePoc1PerformanceProfile({
        ...profile,
        scenarios: profile.scenarios.map((scenario, index) =>
          index === 0
            ? { ...scenario, maximumP95Ms: Number.NaN }
            : scenario,
        ),
      }),
    ).toThrow(/p95/i);
  });
});
