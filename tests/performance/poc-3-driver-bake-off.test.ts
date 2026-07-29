import {
  randomUUID,
} from "node:crypto";
import {
  readFileSync,
} from "node:fs";
import {
  mkdir,
  open,
  readFile,
  rename,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc3DriverBakeOffManifest,
  type Poc3DriverBakeOffManifest,
} from "../../src/application/storage/poc-3-driver-bake-off-contract";

type PackageProbeResult = {
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
    readonly {
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
    }[];
};

type PackageProbeRunner = (
  input: {
    readonly projectRootPath: string;
    readonly manifestPath: string;
    readonly manifestRaw: string;
    readonly manifest:
      Poc3DriverBakeOffManifest;
    readonly artifactDirectoryPath:
      string;
  },
) => Promise<PackageProbeResult>;

type MeasuredPackageRun = {
  readonly independentRunOrdinal:
    number;
  readonly repetitionOrdinal: number;
  readonly result: PackageProbeResult;
};

function requiredEnvironmentPath(
  name:
    | "EUM_STUDIO_POC_3_DRIVER_MANIFEST_PATH"
    | "EUM_STUDIO_POC_3_DRIVER_ARTIFACT_DIRECTORY_PATH",
): string {
  const value = process.env[name];
  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(
      `${name} is required`,
    );
  }
  return resolve(value);
}

function resolveInside(
  rootPath: string,
  targetRelativePath: string,
): string {
  const root = resolve(rootPath);
  const target = resolve(
    root,
    targetRelativePath,
  );
  const relation = relative(
    root,
    target,
  );
  if (
    relation === "" ||
    relation === ".." ||
    relation.startsWith("../") ||
    relation.startsWith("..\\") ||
    isAbsolute(relation)
  ) {
    throw new Error(
      "POC-3 measurement target escapes or aliases its caller root",
    );
  }
  return target;
}

async function writeAtomicJson(
  artifactPath: string,
  value: unknown,
): Promise<void> {
  await mkdir(
    dirname(artifactPath),
    {
      recursive: true,
    },
  );
  const temporaryPath =
    resolveInside(
      dirname(artifactPath),
      `${randomUUID()}.tmp`,
    );
  const handle = await open(
    temporaryPath,
    "wx",
  );
  try {
    await handle.writeFile(
      `${JSON.stringify(
        value,
        null,
        2,
      )}\n`,
      "utf8",
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(
    temporaryPath,
    artifactPath,
  );
}

const manifestPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_DRIVER_MANIFEST_PATH",
  );
const artifactDirectoryPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_DRIVER_ARTIFACT_DIRECTORY_PATH",
  );
const manifestForTimeout =
  parsePoc3DriverBakeOffManifest(
    JSON.parse(
      readFileSync(
        manifestPath,
        "utf8",
      ),
    ),
  );

describe("POC-3 driver bake-off measurement", () => {
  it(
    "records actual Electron raw samples and min median p95 max without selecting a driver",
    {
      timeout:
        manifestForTimeout
          .measurement.timeoutMs,
    },
    async () => {
      const manifestRaw =
        await readFile(
          manifestPath,
          "utf8",
        );
      const manifest =
        parsePoc3DriverBakeOffManifest(
          JSON.parse(manifestRaw),
        );
      const packageModulePath =
        "../package/poc-3-driver-package-probe";
      const reportModulePath =
        "../../src/application/storage/poc-3-driver-bake-off-report";
      const packageImplementation =
        await import(
          packageModulePath
        ) as Record<string, unknown>;
      let reportImplementation:
        | Record<string, unknown>
        | undefined;
      try {
        reportImplementation =
          await import(
            reportModulePath
          );
      } catch {
        reportImplementation =
          undefined;
      }

      expect(
        packageImplementation
          .runPoc3DriverPackageProbe,
      ).toBeTypeOf("function");
      expect(
        reportImplementation
          ?.createPoc3DriverBakeOffReport,
      ).toBeTypeOf("function");

      const runProbe =
        packageImplementation
          .runPoc3DriverPackageProbe as
            PackageProbeRunner;
      const packageResults:
        MeasuredPackageRun[] = [];
      for (
        let independentRunOrdinal = 0;
        independentRunOrdinal <
          manifest.measurement
            .independentRunCount;
        independentRunOrdinal += 1
      ) {
        for (
          let repetitionOrdinal = 0;
          repetitionOrdinal <
            manifest.measurement
              .repetitionsPerRun;
          repetitionOrdinal += 1
        ) {
          const result =
            await runProbe({
              projectRootPath:
                process.cwd(),
              manifestPath,
              manifestRaw,
              manifest,
              artifactDirectoryPath:
                resolveInside(
                  artifactDirectoryPath,
                  randomUUID(),
                ),
            });
          packageResults.push({
            independentRunOrdinal,
            repetitionOrdinal,
            result,
          });
        }
      }

      const createReport =
        reportImplementation!
          .createPoc3DriverBakeOffReport as (
            input: {
              readonly manifest:
                typeof manifest;
              readonly generatedAt:
                string;
              readonly packageResults:
                typeof packageResults;
            },
          ) => {
            readonly rawSamples:
              readonly unknown[];
            readonly candidateSummaries:
              readonly {
                readonly candidateId:
                  string;
                readonly metricSummaries:
                  Readonly<
                    Record<
                      string,
                      {
                        readonly min:
                          number;
                        readonly median:
                          number;
                        readonly p95:
                          number;
                        readonly max:
                          number;
                      }
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
      const report = createReport({
        manifest,
        generatedAt:
          new Date().toISOString(),
        packageResults,
      });
      expect(
        report.rawSamples,
      ).toHaveLength(
        manifest.measurement
          .independentRunCount *
          manifest.measurement
            .repetitionsPerRun *
          manifest.candidates.length,
      );
      expect(
        report.candidateSummaries.map(
          (candidate) =>
            candidate.candidateId,
        ),
      ).toEqual(
        manifest.candidates.map(
          (candidate) => candidate.id,
        ),
      );
      for (
        const candidate
        of report.candidateSummaries
      ) {
        for (
          const summary
          of Object.values(
            candidate.metricSummaries,
          )
        ) {
          expect(summary.min).toBeLessThanOrEqual(
            summary.median,
          );
          expect(summary.median).toBeLessThanOrEqual(
            summary.p95,
          );
          expect(summary.p95).toBeLessThanOrEqual(
            summary.max,
          );
        }
      }
      expect(report.decision).toEqual({
        finalDriverSelected: false,
        productBudgetApplied: false,
      });
      expect(
        report.cleanup
          .packageRunsVerified,
      ).toBe(
        manifest.measurement
          .independentRunCount *
          manifest.measurement
            .repetitionsPerRun,
      );
      expect(
        report.cleanup
          .residualPackageProcesses,
      ).toBe(0);

      await writeAtomicJson(
        resolveInside(
          artifactDirectoryPath,
          manifest.artifactFiles
            .measurementFileName,
        ),
        report,
      );
    },
  );
});
