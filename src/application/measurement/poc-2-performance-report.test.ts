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
  createEnvironmentManifest,
} from "./environment-manifest";
import {
  createPoc2PerformanceReport,
} from "./poc-2-performance-report";
import {
  parsePoc2PerformanceProfile,
} from "./poc-2-performance-profile";

function createEnvironment() {
  return createEnvironmentManifest({
    capturedAt: new Date().toISOString(),
    platform: randomUUID(),
    architecture: randomUUID(),
    osRelease: randomUUID(),
    nodeVersion: randomUUID(),
    cpuModel: randomUUID(),
    logicalProcessorCount:
      randomInt(1, 64),
    totalMemoryBytes:
      randomInt(1, 1_000_000),
    packages: [],
  });
}

function createInput(
  maximumDurableAckP95Ms:
    number = randomInt(100, 2_000),
) {
  const independentRunCount =
    randomInt(2, 5);
  const measuredSampleCountPerRun =
    randomInt(2, 8);
  const warmupSampleCountPerRun =
    randomInt(0, 4);
  const profile =
    parsePoc2PerformanceProfile({
      schemaVersion: 1,
      independentRunCount,
      warmupSampleCountPerRun,
      measuredSampleCountPerRun,
      maximumDurableAckP95Ms,
      batching: {
        schemaVersion: 1,
        maxTransactionsPerBatch: 1,
        maxDelayMs: randomInt(0, 2_000),
      },
    });
  const runs = Array.from(
    {
      length: independentRunCount,
    },
    () => {
      const expectedChecksum =
        randomUUID();
      return {
        runId: randomUUID(),
        durableAckDurationsMs:
          Array.from(
            {
              length:
                measuredSampleCountPerRun,
            },
            () => randomInt(1, 50),
          ),
        memorySamples: [
          {
            stage: randomUUID(),
            mainRssBytes:
              randomInt(1, 1_000_000),
            rendererHeapUsedBytes:
              randomInt(1, 1_000_000),
          },
        ],
        gcSamples: [
          {
            stage: randomUUID(),
            rendererHeapBeforeBytes:
              randomInt(1, 1_000_000),
            rendererHeapAfterBytes:
              randomInt(1, 1_000_000),
          },
        ],
        journal: {
          beforeCompactionBytes:
            randomInt(1, 1_000_000),
          nextGenerationBytes: 0,
          publicationBytes:
            randomInt(1, 1_000_000),
          publicationStatus:
            "published",
          sourceJournalReclaimed: true,
        },
        correctness: {
          durableReceiptCount:
            warmupSampleCountPerRun +
            measuredSampleCountPerRun,
          scannedFrameCount:
            warmupSampleCountPerRun +
            measuredSampleCountPerRun,
          expectedChecksum,
          recoveredChecksum:
            expectedChecksum,
        },
      } as const;
    },
  );
  return {
    runId: randomUUID(),
    commitId: randomUUID(),
    sourceState: "dirty" as const,
    sourceProvenance: {
      branch: randomUUID(),
      dirtyStatusChecksum:
        randomUUID(),
      trackedDiffChecksum:
        randomUUID(),
      untrackedFileCount:
        randomInt(0, 1_000),
      untrackedContentChecksum:
        randomUUID(),
      sourceFingerprint:
        randomUUID(),
    },
    capturedAt: new Date().toISOString(),
    electronVersion: randomUUID(),
    checksumAlgorithm: randomUUID(),
    canonicalTextEncoding:
      randomUUID(),
    environment: createEnvironment(),
    performanceProfile: profile,
    performanceProfileChecksum:
      randomUUID(),
    runs,
    artifactRefs: [randomUUID()],
  };
}

describe("POC-2 performance report", () => {
  it("records all raw samples, average and p95 durable ack, memory, GC, journal compaction, and provenance", () => {
    const input = createInput();
    const report =
      createPoc2PerformanceReport(input);

    expect(report.schemaVersion).toBe(
      1,
    );
    expect(
      report.sourceProvenance,
    ).toEqual(input.sourceProvenance);
    expect(report.runs).toHaveLength(
      input.performanceProfile
        .independentRunCount,
    );
    expect(
      report.durableAck.averageMs,
    ).toBeGreaterThanOrEqual(0);
    expect(
      report.durableAck.p95Ms,
    ).toBeGreaterThanOrEqual(
      report.durableAck.p50Ms,
    );
    expect(
      report.runs[0]
        ?.durableAckDurationsMs,
    ).toEqual(
      input.runs[0]
        ?.durableAckDurationsMs,
    );
    expect(
      report.runs[0]?.memorySamples,
    ).toEqual(
      input.runs[0]?.memorySamples,
    );
    expect(
      report.runs[0]?.gcSamples,
    ).toEqual(input.runs[0]?.gcSamples);
    expect(report.verdict).toBe("pass");
    expect(Object.isFrozen(report)).toBe(
      true,
    );
  });

  it("fails instead of hiding a durable ack budget or correctness violation", () => {
    const input = createInput(1);
    const runs = input.runs.map(
      (run, index) =>
        index === 0
          ? {
              ...run,
              correctness: {
                ...run.correctness,
                recoveredChecksum:
                  randomUUID(),
              },
            }
          : run,
    );
    const report =
      createPoc2PerformanceReport({
        ...input,
        runs,
      });

    expect(
      report.durableAck.passed,
    ).toBe(false);
    expect(
      report.runs[0]?.correctness
        .passed,
    ).toBe(false);
    expect(report.verdict).toBe("fail");
  });

  it("rejects missing runs and malformed raw samples", () => {
    const input = createInput();

    expect(() =>
      createPoc2PerformanceReport({
        ...input,
        runs: input.runs.slice(1),
      }),
    ).toThrow(/independent/);
    expect(() =>
      createPoc2PerformanceReport({
        ...input,
        runs: input.runs.map(
          (run, index) =>
            index === 0
              ? {
                  ...run,
                  durableAckDurationsMs:
                    [Number.NaN],
                }
              : run,
        ),
      }),
    ).toThrow(/samples|durations/i);
    expect(() =>
      createPoc2PerformanceReport({
        ...input,
        runs: input.runs.map(
          (run, index) =>
            index === 0
              ? {
                  ...run,
                  memorySamples: [],
                }
              : run,
        ),
      }),
    ).toThrow(/memory/i);
    expect(() =>
      createPoc2PerformanceReport({
        ...input,
        runs: input.runs.map(
          (run, index) =>
            index === 0
              ? {
                  ...run,
                  gcSamples: [],
                }
              : run,
        ),
      }),
    ).toThrow(/GC/);
  });
});
