import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc3DriverBakeOffManifest,
} from "../../src/application/storage/poc-3-driver-bake-off-contract";

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

const manifestPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_DRIVER_MANIFEST_PATH",
  );
const artifactDirectoryPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_DRIVER_ARTIFACT_DIRECTORY_PATH",
  );
const manifestRaw = readFileSync(
  manifestPath,
  "utf8",
);
const manifest =
  parsePoc3DriverBakeOffManifest(
    JSON.parse(manifestRaw),
  );

describe("POC-3 actual Electron package candidate load", () => {
  it(
    "loads both candidates in the real main runtime from temporary resources/app",
    {
      timeout:
        manifest.measurement
          .timeoutMs,
    },
    async () => {
      const modulePath =
        "./poc-3-driver-package-probe";
      let implementation:
        | Record<string, unknown>
        | undefined;
      try {
        implementation =
          await import(modulePath);
      } catch {
        implementation = undefined;
      }

      expect(
        implementation
          ?.runPoc3DriverPackageProbe,
      ).toBeTypeOf("function");
      const runProbe =
        implementation!
          .runPoc3DriverPackageProbe as (
            input: {
              readonly projectRootPath:
                string;
              readonly manifestPath:
                string;
              readonly manifestRaw:
                string;
              readonly manifest:
                typeof manifest;
              readonly artifactDirectoryPath:
                string;
            },
          ) => Promise<{
            readonly applicationMode:
              string;
            readonly electronMainRuntime:
              boolean;
            readonly electronRunAsNode:
              boolean;
            readonly processType: string;
            readonly electronVersion:
              string;
            readonly candidateLoads:
              readonly {
                readonly candidateId:
                  string;
                readonly loaded: boolean;
                readonly contractChecksum:
                  string;
                readonly correctness:
                  Readonly<
                    Record<
                      string,
                      boolean
                    >
                  >;
              }[];
            readonly officialEvidence:
              typeof manifest.officialEvidence;
          }>;
      const result = await runProbe({
        projectRootPath:
          process.cwd(),
        manifestPath,
        manifestRaw,
        manifest,
        artifactDirectoryPath,
      });

      expect(
        result.applicationMode,
      ).toBe(
        "electron-prebuilt-resources-app-poc",
      );
      expect(
        result.electronMainRuntime,
      ).toBe(true);
      expect(
        result.electronRunAsNode,
      ).toBe(false);
      expect(result.processType).toBe(
        "browser",
      );
      expect(
        result.electronVersion.length,
      ).toBeGreaterThan(0);
      expect(
        result.candidateLoads.map(
          (candidate) =>
            candidate.candidateId,
        ),
      ).toEqual(
        manifest.candidates.map(
          (candidate) => candidate.id,
        ),
      );
      expect(
        new Set(
          result.candidateLoads.map(
            (candidate) =>
              candidate.contractChecksum,
          ),
        ).size,
      ).toBe(1);
      for (
        const candidate
        of result.candidateLoads
      ) {
        expect(candidate.loaded).toBe(
          true,
        );
        expect(
          Object.values(
            candidate.correctness,
          ).every(Boolean),
        ).toBe(true);
      }
      expect(
        result.officialEvidence,
      ).toEqual(
        manifest.officialEvidence,
      );
    },
  );
});
