import type { EnvironmentManifest } from "./environment-manifest";
import {
  summarizeDurations,
  type DurationMeasurementSummary,
} from "./measurement-summary";
import type {
  Poc1PerformanceProfile,
  Poc1PerformanceScenarioKind,
} from "./poc-1-performance-profile";

export type Poc1PerformanceCorrectnessInput = {
  readonly documentSwitchCount: number;
  readonly ownershipViolationCount: number;
  readonly searchMismatchCount: number;
  readonly inputMismatchCount: number;
};

export type Poc1PerformanceScenarioResult =
  DurationMeasurementSummary & {
    readonly kind: Poc1PerformanceScenarioKind;
    readonly maximumP95Ms: number;
    readonly passed: boolean;
  };

export type Poc1PerformanceReport = {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly commitId: string;
  readonly sourceState: "clean" | "dirty";
  readonly capturedAt: string;
  readonly environment: EnvironmentManifest;
  readonly fixture: {
    readonly manifestPath: string;
    readonly manifestChecksum: string;
    readonly generatedProfileChecksum: string;
  };
  readonly performanceProfileChecksum: string;
  readonly scenarios: readonly Poc1PerformanceScenarioResult[];
  readonly correctness: Poc1PerformanceCorrectnessInput & {
    readonly passed: boolean;
  };
  readonly artifactRefs: readonly string[];
  readonly verdict: "pass" | "fail";
};

function freezeEnvironment(
  environment: EnvironmentManifest,
): EnvironmentManifest {
  return Object.freeze({
    ...environment,
    packages: Object.freeze(
      environment.packages.map((item) => Object.freeze({ ...item })),
    ),
  });
}

function assertCorrectnessValue(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
}

export function createPoc1PerformanceReport(input: {
  readonly runId: string;
  readonly commitId: string;
  readonly sourceState: "clean" | "dirty";
  readonly capturedAt: string;
  readonly environment: EnvironmentManifest;
  readonly fixture: {
    readonly manifestPath: string;
    readonly manifestChecksum: string;
    readonly generatedProfileChecksum: string;
  };
  readonly performanceProfile: Poc1PerformanceProfile;
  readonly performanceProfileChecksum: string;
  readonly scenarioDurations: Readonly<
    Record<string, readonly number[]>
  >;
  readonly correctness: Poc1PerformanceCorrectnessInput;
  readonly artifactRefs: readonly string[];
}): Poc1PerformanceReport {
  for (const [field, value] of Object.entries(input.correctness)) {
    assertCorrectnessValue(value, field);
  }
  const scenarios = input.performanceProfile.scenarios.map((scenario) => {
    const durations = input.scenarioDurations[scenario.id];
    if (durations === undefined) {
      throw new Error(`Missing durations for scenario ${scenario.id}`);
    }
    if (durations.length !== scenario.sampleCount) {
      throw new Error(
        `Scenario ${scenario.id} requires ${scenario.sampleCount} samples`,
      );
    }
    const summary = summarizeDurations({
      runId: input.runId,
      scenarioId: scenario.id,
      durationsMs: durations,
    });
    return Object.freeze({
      ...summary,
      kind: scenario.kind,
      maximumP95Ms: scenario.maximumP95Ms,
      passed: summary.p95Ms <= scenario.maximumP95Ms,
    });
  });
  const correctnessPassed =
    input.correctness.documentSwitchCount >=
      input.performanceProfile.correctness
        .minimumDocumentSwitchCount &&
    input.correctness.ownershipViolationCount <=
      input.performanceProfile.correctness
        .maximumOwnershipViolationCount &&
    input.correctness.searchMismatchCount <=
      input.performanceProfile.correctness
        .maximumSearchMismatchCount &&
    input.correctness.inputMismatchCount <=
      input.performanceProfile.correctness.maximumInputMismatchCount;
  const correctness = Object.freeze({
    ...input.correctness,
    passed: correctnessPassed,
  });
  const verdict =
    correctnessPassed &&
    scenarios.every((scenario) => scenario.passed)
      ? "pass"
      : "fail";

  return Object.freeze({
    schemaVersion: 1,
    runId: input.runId,
    commitId: input.commitId,
    sourceState: input.sourceState,
    capturedAt: input.capturedAt,
    environment: freezeEnvironment(input.environment),
    fixture: Object.freeze({ ...input.fixture }),
    performanceProfileChecksum: input.performanceProfileChecksum,
    scenarios: Object.freeze(scenarios),
    correctness,
    artifactRefs: Object.freeze([...input.artifactRefs]),
    verdict,
  });
}

export function renderPoc1PerformanceVerdict(
  report: Poc1PerformanceReport,
): string {
  const heading = report.verdict === "pass" ? "PASS" : "FAIL";
  const scenarioRows = report.scenarios
    .map(
      (scenario) =>
        `| ${scenario.scenarioId} | ${scenario.sampleCount} | ${scenario.p50Ms.toFixed(3)} | ${scenario.p95Ms.toFixed(3)} | ${scenario.maxMs.toFixed(3)} | ${scenario.maximumP95Ms.toFixed(3)} | ${scenario.passed ? "pass" : "fail"} |`,
    )
    .join("\n");
  return [
    `# POC-1 performance verdict: ${heading}`,
    "",
    `- Run: ${report.runId}`,
    `- Commit: ${report.commitId} (${report.sourceState})`,
    `- Fixture checksum: ${report.fixture.manifestChecksum}`,
    `- Correctness: ${report.correctness.passed ? "pass" : "fail"}`,
    "",
    "| Scenario | Samples | p50 ms | p95 ms | max ms | budget ms | Result |",
    "|---|---:|---:|---:|---:|---:|---|",
    scenarioRows,
    "",
  ].join("\n");
}
