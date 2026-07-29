import type {
  EnvironmentManifest,
} from "./environment-manifest";
import {
  summarizeDurations,
  type DurationMeasurementSummary,
} from "./measurement-summary";
import type {
  Poc2PerformanceProfile,
} from "./poc-2-performance-profile";

export type Poc2MemorySample = {
  readonly stage: string;
  readonly mainRssBytes: number;
  readonly rendererHeapUsedBytes: number;
};

export type Poc2GcSample = {
  readonly stage: string;
  readonly rendererHeapBeforeBytes: number;
  readonly rendererHeapAfterBytes: number;
};

export type Poc2JournalMeasurement = {
  readonly beforeCompactionBytes: number;
  readonly nextGenerationBytes: number;
  readonly publicationBytes: number;
  readonly publicationStatus:
    | "published"
    | "not-published"
    | "invalid";
  readonly sourceJournalReclaimed: boolean;
};

export type Poc2PerformanceRunInput = {
  readonly runId: string;
  readonly durableAckDurationsMs:
    readonly number[];
  readonly memorySamples:
    readonly Poc2MemorySample[];
  readonly gcSamples:
    readonly Poc2GcSample[];
  readonly journal:
    Poc2JournalMeasurement;
  readonly correctness: {
    readonly durableReceiptCount: number;
    readonly scannedFrameCount: number;
    readonly expectedChecksum: string;
    readonly recoveredChecksum: string;
  };
};

export type Poc2PerformanceRun =
  Poc2PerformanceRunInput & {
    readonly durableAck:
      DurationMeasurementSummary & {
        readonly averageMs: number;
      };
    readonly correctness:
      Poc2PerformanceRunInput["correctness"] & {
        readonly passed: boolean;
      };
    readonly compactionPassed: boolean;
  };

export type Poc2SourceProvenance = {
  readonly branch: string;
  readonly dirtyStatusChecksum: string;
  readonly trackedDiffChecksum: string;
  readonly untrackedFileCount: number;
  readonly untrackedContentChecksum: string;
  readonly sourceFingerprint: string;
};

export type Poc2PerformanceReport = {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly commitId: string;
  readonly sourceState: "clean" | "dirty";
  readonly sourceProvenance:
    Poc2SourceProvenance;
  readonly capturedAt: string;
  readonly electronVersion: string;
  readonly checksumAlgorithm: string;
  readonly canonicalTextEncoding: string;
  readonly environment:
    EnvironmentManifest;
  readonly performanceProfile:
    Poc2PerformanceProfile;
  readonly performanceProfileChecksum: string;
  readonly runs:
    readonly Poc2PerformanceRun[];
  readonly durableAck:
    DurationMeasurementSummary & {
      readonly averageMs: number;
      readonly maximumP95Ms: number;
      readonly passed: boolean;
    };
  readonly artifactRefs:
    readonly string[];
  readonly verdict: "pass" | "fail";
};

function assertNonEmpty(
  value: string,
  field: string,
): void {
  if (value.length === 0) {
    throw new Error(
      `${field} must not be empty`,
    );
  }
}

function assertCount(
  value: number,
  field: string,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${field} must be a non-negative safe integer`,
    );
  }
}

function assertBytes(
  value: number,
  field: string,
): void {
  assertCount(value, field);
}

function average(
  values: readonly number[],
): number {
  return (
    values.reduce(
      (total, value) => total + value,
      0,
    ) / values.length
  );
}

function freezeEnvironment(
  environment: EnvironmentManifest,
): EnvironmentManifest {
  return Object.freeze({
    ...environment,
    packages: Object.freeze(
      environment.packages.map(
        (item) =>
          Object.freeze({ ...item }),
      ),
    ),
  });
}

function freezeSourceProvenance(
  provenance: Poc2SourceProvenance,
): Poc2SourceProvenance {
  assertNonEmpty(
    provenance.branch,
    "sourceProvenance.branch",
  );
  assertNonEmpty(
    provenance.dirtyStatusChecksum,
    "sourceProvenance.dirtyStatusChecksum",
  );
  assertNonEmpty(
    provenance.trackedDiffChecksum,
    "sourceProvenance.trackedDiffChecksum",
  );
  assertCount(
    provenance.untrackedFileCount,
    "sourceProvenance.untrackedFileCount",
  );
  assertNonEmpty(
    provenance.untrackedContentChecksum,
    "sourceProvenance.untrackedContentChecksum",
  );
  assertNonEmpty(
    provenance.sourceFingerprint,
    "sourceProvenance.sourceFingerprint",
  );
  return Object.freeze({
    ...provenance,
  });
}

function freezeMemorySample(
  sample: Poc2MemorySample,
): Poc2MemorySample {
  assertNonEmpty(sample.stage, "memory stage");
  assertBytes(
    sample.mainRssBytes,
    "mainRssBytes",
  );
  assertBytes(
    sample.rendererHeapUsedBytes,
    "rendererHeapUsedBytes",
  );
  return Object.freeze({ ...sample });
}

function freezeGcSample(
  sample: Poc2GcSample,
): Poc2GcSample {
  assertNonEmpty(sample.stage, "GC stage");
  assertBytes(
    sample.rendererHeapBeforeBytes,
    "rendererHeapBeforeBytes",
  );
  assertBytes(
    sample.rendererHeapAfterBytes,
    "rendererHeapAfterBytes",
  );
  return Object.freeze({ ...sample });
}

function freezeJournal(
  journal: Poc2JournalMeasurement,
): Poc2JournalMeasurement {
  assertBytes(
    journal.beforeCompactionBytes,
    "beforeCompactionBytes",
  );
  assertBytes(
    journal.nextGenerationBytes,
    "nextGenerationBytes",
  );
  assertBytes(
    journal.publicationBytes,
    "publicationBytes",
  );
  return Object.freeze({ ...journal });
}

function createRun(input: {
  readonly profile:
    Poc2PerformanceProfile;
  readonly run: Poc2PerformanceRunInput;
}): Poc2PerformanceRun {
  const { profile, run } = input;
  assertNonEmpty(run.runId, "runId");
  if (
    run.durableAckDurationsMs.length !==
    profile.measuredSampleCountPerRun
  ) {
    throw new Error(
      `Run ${run.runId} durable ack samples must match measuredSampleCountPerRun`,
    );
  }
  if (run.memorySamples.length === 0) {
    throw new Error(
      `Run ${run.runId} requires memory samples`,
    );
  }
  if (run.gcSamples.length === 0) {
    throw new Error(
      `Run ${run.runId} requires GC samples`,
    );
  }
  const durableAck = summarizeDurations({
    runId: run.runId,
    scenarioId: "poc-2.durable-ack",
    durationsMs:
      run.durableAckDurationsMs,
  });
  assertCount(
    run.correctness
      .durableReceiptCount,
    "durableReceiptCount",
  );
  assertCount(
    run.correctness.scannedFrameCount,
    "scannedFrameCount",
  );
  assertNonEmpty(
    run.correctness.expectedChecksum,
    "expectedChecksum",
  );
  assertNonEmpty(
    run.correctness.recoveredChecksum,
    "recoveredChecksum",
  );
  const expectedReceiptCount =
    profile.warmupSampleCountPerRun +
    profile.measuredSampleCountPerRun;
  const correctnessPassed =
    run.correctness
      .durableReceiptCount ===
      expectedReceiptCount &&
    run.correctness.scannedFrameCount ===
      expectedReceiptCount &&
    run.correctness.expectedChecksum ===
      run.correctness.recoveredChecksum;
  const journal = freezeJournal(
    run.journal,
  );
  const compactionPassed =
    journal.publicationStatus ===
      "published" &&
    journal.nextGenerationBytes === 0 &&
    journal.sourceJournalReclaimed;
  return Object.freeze({
    runId: run.runId,
    durableAckDurationsMs:
      Object.freeze([
        ...run.durableAckDurationsMs,
      ]),
    durableAck: Object.freeze({
      ...durableAck,
      averageMs: average(
        run.durableAckDurationsMs,
      ),
    }),
    memorySamples: Object.freeze(
      run.memorySamples.map(
        freezeMemorySample,
      ),
    ),
    gcSamples: Object.freeze(
      run.gcSamples.map(freezeGcSample),
    ),
    journal,
    correctness: Object.freeze({
      ...run.correctness,
      passed: correctnessPassed,
    }),
    compactionPassed,
  });
}

export function createPoc2PerformanceReport(
  input: {
    readonly runId: string;
    readonly commitId: string;
    readonly sourceState:
      | "clean"
      | "dirty";
    readonly sourceProvenance:
      Poc2SourceProvenance;
    readonly capturedAt: string;
    readonly electronVersion: string;
    readonly checksumAlgorithm: string;
    readonly canonicalTextEncoding:
      string;
    readonly environment:
      EnvironmentManifest;
    readonly performanceProfile:
      Poc2PerformanceProfile;
    readonly performanceProfileChecksum:
      string;
    readonly runs:
      readonly Poc2PerformanceRunInput[];
    readonly artifactRefs:
      readonly string[];
  },
): Poc2PerformanceReport {
  assertNonEmpty(input.runId, "runId");
  assertNonEmpty(
    input.commitId,
    "commitId",
  );
  assertNonEmpty(
    input.capturedAt,
    "capturedAt",
  );
  assertNonEmpty(
    input.electronVersion,
    "electronVersion",
  );
  assertNonEmpty(
    input.checksumAlgorithm,
    "checksumAlgorithm",
  );
  assertNonEmpty(
    input.canonicalTextEncoding,
    "canonicalTextEncoding",
  );
  assertNonEmpty(
    input.performanceProfileChecksum,
    "performanceProfileChecksum",
  );
  if (
    input.runs.length !==
    input.performanceProfile
      .independentRunCount
  ) {
    throw new Error(
      "POC-2 report runs must match independentRunCount",
    );
  }
  const runIds = new Set<string>();
  const runs = input.runs.map((run) => {
    if (runIds.has(run.runId)) {
      throw new Error(
        `Duplicate POC-2 performance run: ${run.runId}`,
      );
    }
    runIds.add(run.runId);
    return createRun({
      profile:
        input.performanceProfile,
      run,
    });
  });
  const allDurations = runs.flatMap(
    (run) => [
      ...run.durableAckDurationsMs,
    ],
  );
  const durableAck =
    summarizeDurations({
      runId: input.runId,
      scenarioId:
        "poc-2.durable-ack",
      durationsMs: allDurations,
    });
  const durableAckPassed =
    durableAck.p95Ms <=
    input.performanceProfile
      .maximumDurableAckP95Ms;
  const verdict =
    durableAckPassed &&
    runs.every(
      (run) =>
        run.correctness.passed &&
        run.compactionPassed,
    )
      ? "pass"
      : "fail";
  return Object.freeze({
    schemaVersion: 1,
    runId: input.runId,
    commitId: input.commitId,
    sourceState: input.sourceState,
    sourceProvenance:
      freezeSourceProvenance(
        input.sourceProvenance,
      ),
    capturedAt: input.capturedAt,
    electronVersion:
      input.electronVersion,
    checksumAlgorithm:
      input.checksumAlgorithm,
    canonicalTextEncoding:
      input.canonicalTextEncoding,
    environment: freezeEnvironment(
      input.environment,
    ),
    performanceProfile:
      Object.freeze({
        ...input.performanceProfile,
        batching: Object.freeze({
          ...input.performanceProfile
            .batching,
        }),
      }),
    performanceProfileChecksum:
      input.performanceProfileChecksum,
    runs: Object.freeze(runs),
    durableAck: Object.freeze({
      ...durableAck,
      averageMs: average(allDurations),
      maximumP95Ms:
        input.performanceProfile
          .maximumDurableAckP95Ms,
      passed: durableAckPassed,
    }),
    artifactRefs: Object.freeze([
      ...input.artifactRefs,
    ]),
    verdict,
  });
}
