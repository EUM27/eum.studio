import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { EnvironmentManifest } from "./environment-manifest";
import {
  createPoc1PerformanceReport,
  renderPoc1PerformanceVerdict,
} from "./poc-1-performance-report";
import {
  parsePoc1PerformanceProfile,
  type Poc1PerformanceScenarioKind,
} from "./poc-1-performance-profile";

const kinds: readonly Poc1PerformanceScenarioKind[] = [
  "document-switch",
  "work-search",
  "input",
];

function createEnvironment(): EnvironmentManifest {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    platform: randomUUID(),
    architecture: randomUUID(),
    osRelease: randomUUID(),
    nodeVersion: randomUUID(),
    cpuModel: randomUUID(),
    logicalProcessorCount: randomInt(1, 64),
    totalMemoryBytes: randomInt(1_000_000, 2_000_000),
    packages: [],
  };
}

describe("createPoc1PerformanceReport", () => {
  it("records p50, p95, max, budgets, checksums, and a passing verdict", () => {
    const sampleCount = randomInt(4, 12);
    const maximumP95Ms = randomInt(100, 500);
    const minimumSwitches = randomInt(1, sampleCount + 1);
    const profile = parsePoc1PerformanceProfile({
      schemaVersion: 1,
      longformFixturePath: randomUUID(),
      artifactDirectory: randomUUID(),
      correctness: {
        minimumDocumentSwitchCount: minimumSwitches,
        maximumOwnershipViolationCount: 0,
        maximumSearchMismatchCount: 0,
        maximumInputMismatchCount: 0,
      },
      searchQueries: [randomUUID()],
      inputSamples: [randomUUID().slice(0, 1)],
      scenarios: kinds.map((kind) => ({
        id: randomUUID(),
        kind,
        sampleCount,
        warmupCount: randomInt(0, 3),
        maximumP95Ms,
      })),
    });
    const scenarioDurations = Object.fromEntries(
      profile.scenarios.map((scenario) => [
        scenario.id,
        Array.from(
          { length: scenario.sampleCount },
          (_, index) => index + 1,
        ),
      ]),
    );
    const input = {
      runId: randomUUID(),
      commitId: randomUUID(),
      sourceState: "clean" as const,
      capturedAt: new Date().toISOString(),
      environment: createEnvironment(),
      fixture: {
        manifestPath: profile.longformFixturePath,
        manifestChecksum: randomUUID(),
        generatedProfileChecksum: randomUUID(),
      },
      performanceProfile: profile,
      performanceProfileChecksum: randomUUID(),
      scenarioDurations,
      correctness: {
        documentSwitchCount: minimumSwitches,
        ownershipViolationCount: 0,
        searchMismatchCount: 0,
        inputMismatchCount: 0,
      },
      artifactRefs: [randomUUID(), randomUUID()],
    };

    const report = createPoc1PerformanceReport(input);

    expect(report.verdict).toBe("pass");
    expect(report.scenarios).toHaveLength(kinds.length);
    expect(report.scenarios[0]).toMatchObject({
      runId: input.runId,
      scenarioId: profile.scenarios[0]?.id,
      sampleCount,
      p50Ms: Math.ceil(sampleCount / 2),
      p95Ms: sampleCount,
      maxMs: sampleCount,
      maximumP95Ms,
      passed: true,
    });
    expect(report.fixture).toEqual(input.fixture);
    expect(report.performanceProfileChecksum).toBe(
      input.performanceProfileChecksum,
    );
    expect(report.artifactRefs).toEqual(input.artifactRefs);
    expect(Object.isFrozen(report)).toBe(true);
    expect(renderPoc1PerformanceVerdict(report)).toContain("PASS");
  });

  it("fails when a p95 budget or correctness boundary is exceeded", () => {
    const budget = randomInt(2, 20);
    const profile = parsePoc1PerformanceProfile({
      schemaVersion: 1,
      longformFixturePath: randomUUID(),
      artifactDirectory: randomUUID(),
      correctness: {
        minimumDocumentSwitchCount: randomInt(2, 10),
        maximumOwnershipViolationCount: 0,
        maximumSearchMismatchCount: 0,
        maximumInputMismatchCount: 0,
      },
      searchQueries: [randomUUID()],
      inputSamples: [randomUUID().slice(0, 1)],
      scenarios: kinds.map((kind) => ({
        id: randomUUID(),
        kind,
        sampleCount: 3,
        warmupCount: 0,
        maximumP95Ms: budget,
      })),
    });
    const durations = Object.fromEntries(
      profile.scenarios.map((scenario) => [
        scenario.id,
        [budget, budget, budget + 1],
      ]),
    );

    const report = createPoc1PerformanceReport({
      runId: randomUUID(),
      commitId: randomUUID(),
      sourceState: "dirty",
      capturedAt: new Date().toISOString(),
      environment: createEnvironment(),
      fixture: {
        manifestPath: profile.longformFixturePath,
        manifestChecksum: randomUUID(),
        generatedProfileChecksum: randomUUID(),
      },
      performanceProfile: profile,
      performanceProfileChecksum: randomUUID(),
      scenarioDurations: durations,
      correctness: {
        documentSwitchCount: 0,
        ownershipViolationCount: 1,
        searchMismatchCount: 1,
        inputMismatchCount: 1,
      },
      artifactRefs: [],
    });

    expect(report.verdict).toBe("fail");
    expect(report.scenarios.every((scenario) => !scenario.passed)).toBe(
      true,
    );
    expect(report.correctness.passed).toBe(false);
    expect(renderPoc1PerformanceVerdict(report)).toContain("FAIL");
  });
});
