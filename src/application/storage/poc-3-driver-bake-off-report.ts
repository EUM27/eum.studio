import type {
  Poc3DriverBakeOffManifest,
} from "./poc-3-driver-bake-off-contract";

type CandidateLoad = {
  readonly candidateId: string;
  readonly moduleSpecifier: string;
  readonly driverVersion: string;
  readonly sqliteVersion: string;
  readonly contractChecksum: string;
  readonly ledgerChecksum: string;
  readonly backupLedgerChecksum:
    string;
  readonly databaseChecksum: string;
  readonly backupChecksum: string;
  readonly correctness:
    Readonly<
      Record<string, boolean>
    >;
  readonly timingsMs:
    Readonly<
      Record<string, number>
    >;
};

type PackageResult = {
  readonly provenance: unknown;
  readonly cleanup: {
    readonly mainProcessExited:
      true;
    readonly temporaryResourcesAppRemoved:
      true;
    readonly residualPackageProcesses:
      0;
  };
  readonly electronVersion: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly architecture: string;
  readonly manifestChecksum: string;
  readonly candidateLoads:
    readonly CandidateLoad[];
};

type PackageRun = {
  readonly independentRunOrdinal:
    number;
  readonly repetitionOrdinal: number;
  readonly result: PackageResult;
};

export type Poc3DriverRawSample = {
  readonly independentRunOrdinal:
    number;
  readonly repetitionOrdinal: number;
  readonly candidateId: string;
  readonly moduleSpecifier: string;
  readonly driverVersion: string;
  readonly sqliteVersion: string;
  readonly contractChecksum: string;
  readonly ledgerChecksum: string;
  readonly backupLedgerChecksum:
    string;
  readonly databaseChecksum: string;
  readonly backupChecksum: string;
  readonly correctness:
    Readonly<
      Record<string, boolean>
    >;
  readonly timingsMs:
    Readonly<
      Record<string, number>
    >;
};

export type Poc3MetricSummary = {
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
};

export type Poc3DriverBakeOffReport = {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly officialEvidence:
    Poc3DriverBakeOffManifest[
      "officialEvidence"
    ];
  readonly comparisonContract: {
    readonly manifestChecksum:
      string;
    readonly contractChecksum:
      string;
    readonly summaryPercentile:
      number;
    readonly identicalCandidateConditions:
      true;
  };
  readonly provenance: {
    readonly packageRuns:
      readonly {
        readonly independentRunOrdinal:
          number;
        readonly repetitionOrdinal:
          number;
        readonly electronVersion:
          string;
        readonly nodeVersion: string;
        readonly platform: string;
        readonly architecture: string;
        readonly source: unknown;
      }[];
  };
  readonly rawSamples:
    readonly Poc3DriverRawSample[];
  readonly candidateSummaries:
    readonly {
      readonly candidateId: string;
      readonly moduleSpecifier:
        string;
      readonly driverVersion: string;
      readonly sqliteVersions:
        readonly string[];
      readonly sampleCount: number;
      readonly metricSummaries:
        Readonly<
          Record<
            string,
            Poc3MetricSummary
          >
        >;
    }[];
  readonly decision: {
    readonly finalDriverSelected:
      false;
    readonly productBudgetApplied:
      false;
  };
  readonly cleanup: {
    readonly packageRunsVerified:
      number;
    readonly residualPackageProcesses:
      0;
  };
};

function percentile(
  values: readonly number[],
  requestedPercentile: number,
): number {
  const sorted = [...values].sort(
    (left, right) => left - right,
  );
  const rank = Math.ceil(
    (
      requestedPercentile /
      100
    ) * sorted.length,
  );
  return sorted[
    Math.max(
      0,
      rank - 1,
    )
  ]!;
}

function median(
  values: readonly number[],
): number {
  const sorted = [...values].sort(
    (left, right) => left - right,
  );
  const midpoint = Math.floor(
    sorted.length / 2,
  );
  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[midpoint - 1]! +
      sorted[midpoint]!
    ) / 2;
  }
  return sorted[midpoint]!;
}

function deepFreeze<T>(value: T): T {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value === right[index],
    )
  );
}

export function createPoc3DriverBakeOffReport(
  input: {
    readonly manifest:
      Poc3DriverBakeOffManifest;
    readonly generatedAt: string;
    readonly packageResults:
      readonly PackageRun[];
  },
): Poc3DriverBakeOffReport {
  const {
    manifest,
    packageResults,
  } = input;
  const expectedPackageRuns =
    manifest.measurement
      .independentRunCount *
    manifest.measurement
      .repetitionsPerRun;
  if (
    packageResults.length !==
    expectedPackageRuns
  ) {
    throw new Error(
      "POC-3 report requires every manifest-owned package run",
    );
  }

  const candidateIds =
    manifest.candidates.map(
      (candidate) => candidate.id,
    );
  const rawSamples:
    Poc3DriverRawSample[] = [];
  const packageProvenance = [];
  let manifestChecksum:
    string | undefined;
  let contractChecksum:
    string | undefined;
  let metricNames:
    readonly string[] | undefined;
  for (
    const packageRun
    of packageResults
  ) {
    const { result } = packageRun;
    if (
      result.cleanup
        .mainProcessExited !== true ||
      result.cleanup
        .temporaryResourcesAppRemoved !==
        true ||
      result.cleanup
        .residualPackageProcesses !== 0
    ) {
      throw new Error(
        "POC-3 report rejected an unclean package run",
      );
    }
    if (
      !sameStrings(
        result.candidateLoads.map(
          (candidate) =>
            candidate.candidateId,
        ),
        candidateIds,
      )
    ) {
      throw new Error(
        "POC-3 report candidate order differs from the caller manifest",
      );
    }
    if (
      manifestChecksum !== undefined &&
      manifestChecksum !==
        result.manifestChecksum
    ) {
      throw new Error(
        "POC-3 report package runs used different manifests",
      );
    }
    manifestChecksum =
      result.manifestChecksum;
    packageProvenance.push({
      independentRunOrdinal:
        packageRun
          .independentRunOrdinal,
      repetitionOrdinal:
        packageRun.repetitionOrdinal,
      electronVersion:
        result.electronVersion,
      nodeVersion: result.nodeVersion,
      platform: result.platform,
      architecture:
        result.architecture,
      source: result.provenance,
    });

    for (
      const candidate
      of result.candidateLoads
    ) {
      if (
        !Object.values(
          candidate.correctness,
        ).every(Boolean) ||
        candidate.ledgerChecksum !==
          candidate
            .backupLedgerChecksum
      ) {
        throw new Error(
          `POC-3 report rejected incorrect candidate sample: ${candidate.candidateId}`,
        );
      }
      if (
        contractChecksum !==
          undefined &&
        contractChecksum !==
          candidate.contractChecksum
      ) {
        throw new Error(
          "POC-3 report candidates did not use one identical contract",
        );
      }
      contractChecksum =
        candidate.contractChecksum;
      const candidateMetricNames =
        Object.keys(
          candidate.timingsMs,
        ).sort();
      if (
        metricNames !== undefined &&
        !sameStrings(
          metricNames,
          candidateMetricNames,
        )
      ) {
        throw new Error(
          "POC-3 report candidate timing phases differ",
        );
      }
      metricNames =
        candidateMetricNames;
      for (
        const value
        of Object.values(
          candidate.timingsMs,
        )
      ) {
        if (
          !Number.isFinite(value) ||
          value < 0
        ) {
          throw new Error(
            `POC-3 report has an invalid raw timing: ${candidate.candidateId}`,
          );
        }
      }
      rawSamples.push({
        independentRunOrdinal:
          packageRun
            .independentRunOrdinal,
        repetitionOrdinal:
          packageRun
            .repetitionOrdinal,
        candidateId:
          candidate.candidateId,
        moduleSpecifier:
          candidate.moduleSpecifier,
        driverVersion:
          candidate.driverVersion,
        sqliteVersion:
          candidate.sqliteVersion,
        contractChecksum:
          candidate.contractChecksum,
        ledgerChecksum:
          candidate.ledgerChecksum,
        backupLedgerChecksum:
          candidate
            .backupLedgerChecksum,
        databaseChecksum:
          candidate.databaseChecksum,
        backupChecksum:
          candidate.backupChecksum,
        correctness:
          candidate.correctness,
        timingsMs:
          candidate.timingsMs,
      });
    }
  }
  if (
    manifestChecksum === undefined ||
    contractChecksum === undefined ||
    metricNames === undefined
  ) {
    throw new Error(
      "POC-3 report has no package samples",
    );
  }

  const candidateSummaries =
    manifest.candidates.map(
      (candidate) => {
        const samples =
          rawSamples.filter(
            (sample) =>
              sample.candidateId ===
              candidate.id,
          );
        const metricSummaries:
          Record<
            string,
            Poc3MetricSummary
          > = {};
        for (
          const metricName
          of metricNames
        ) {
          const values = samples.map(
            (sample) =>
              sample.timingsMs[
                metricName
              ]!,
          );
          metricSummaries[
            metricName
          ] = {
            min: Math.min(...values),
            median: median(values),
            p95: percentile(
              values,
              manifest.measurement
                .summaryPercentile,
            ),
            max: Math.max(...values),
          };
        }
        return {
          candidateId: candidate.id,
          moduleSpecifier:
            candidate.moduleSpecifier,
          driverVersion:
            samples[0]!
              .driverVersion,
          sqliteVersions: [
            ...new Set(
              samples.map(
                (sample) =>
                  sample.sqliteVersion,
              ),
            ),
          ],
          sampleCount:
            samples.length,
          metricSummaries,
        };
      },
    );

  return deepFreeze({
    schemaVersion:
      manifest.schemaVersion,
    generatedAt: input.generatedAt,
    officialEvidence:
      manifest.officialEvidence,
    comparisonContract: {
      manifestChecksum,
      contractChecksum,
      summaryPercentile:
        manifest.measurement
          .summaryPercentile,
      identicalCandidateConditions:
        true,
    },
    provenance: {
      packageRuns:
        packageProvenance,
    },
    rawSamples,
    candidateSummaries,
    decision: {
      finalDriverSelected: false,
      productBudgetApplied: false,
    },
    cleanup: {
      packageRunsVerified:
        packageResults.length,
      residualPackageProcesses: 0,
    },
  });
}
