import {
  readFile,
} from "node:fs/promises";
import {
  join,
  resolve,
} from "node:path";

import {
  _electron as electron,
  type ElectronApplication,
} from "playwright";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parsePoc3InstalledPackageProbeProfile,
  runPoc3InstalledPackageProbe,
} from "../../src/desktop/poc-3-installed-package-probe";
import {
  assembleInstalledPackage,
  createNodeInstalledPackageAssemblyOperations,
  removeVerifiedTemporaryPackageDirectory,
} from "./poc-2-installed-package-assembly";
import {
  parsePoc3InstalledPackageManifest,
} from "./poc-3-installed-package-profile";

function requiredEnvironmentPath(
  name:
    | "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_PROFILE_PATH"
    | "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_ARTIFACT_PATH",
): string {
  const value = process.env[name];
  if (
    value === undefined ||
    value.length === 0
  ) {
    throw new Error(`${name} is required`);
  }
  return resolve(value);
}

function packageEnvironment(): Record<
  string,
  string
> {
  const environment: Record<
    string,
    string
  > = {};
  for (
    const [key, value]
    of Object.entries(process.env)
  ) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  for (const key of [
    "ELECTRON_RUN_AS_NODE",
    "EUM_STUDIO_RENDERER_URL",
    "EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE",
    "EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH",
    "EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE",
    "EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE_PATH",
    "EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE",
    "EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE_PATH",
    "EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE",
    "EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE_PATH",
    "EUM_STUDIO_POC_2_CRASH_GATE_PROFILE",
    "EUM_STUDIO_POC_2_CRASH_GATE_PROFILE_PATH",
  ]) {
    Reflect.deleteProperty(
      environment,
      key,
    );
  }
  environment
    .EUM_STUDIO_WINDOW_VISIBILITY =
      "hidden";
  return environment;
}

const profilePath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_PROFILE_PATH",
  );
const artifactPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_ARTIFACT_PATH",
  );
const timeoutMs = Number(
  process.env
    .EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS,
);
const manifest =
  parsePoc3InstalledPackageManifest(
    JSON.parse(
      await readFile(
        profilePath,
        "utf8",
      ),
    ),
  );

describe(
  "POC-3 installed-package main evaluation",
  () => {
    it("exposes the strict caller-profile probe contract", () => {
      expect(
        parsePoc3InstalledPackageProbeProfile,
      ).toBeTypeOf("function");
      expect(
        runPoc3InstalledPackageProbe,
      ).toBeTypeOf("function");
      expect(artifactPath).not.toBe(
        profilePath,
      );
    });

    it("launches the normal local-file app and loads the existing ledger export with main-process createRequire", async () => {
      expect(process.platform).toBe(
        "win32",
      );
      const installed =
        await assembleInstalledPackage(
          manifest.package,
          createNodeInstalledPackageAssemblyOperations(),
        );
      let application:
        ElectronApplication | undefined;
      try {
        application =
          await electron.launch({
            executablePath:
              installed.executablePath,
            args: [
              `--user-data-dir=${join(
                installed.parentDirectory,
                crypto.randomUUID(),
              )}`,
            ],
            env: packageEnvironment(),
          });
        const page =
          await application.firstWindow();
        expect(
          new URL(page.url()).protocol,
        ).toBe("file:");
        const manuscript =
          page.getByRole("textbox", {
            name: "원고",
            exact: true,
          });
        await manuscript.waitFor({
          state: "attached",
          timeout: timeoutMs,
        });
        expect(
          await manuscript.count(),
        ).toBe(1);
        const loaded =
          await application.evaluate(
            (
              _electron,
              ledgerModulePath,
            ) => {
              const moduleBuiltin =
                process.getBuiltinModule(
                  "node:module",
                );
              const requireFromPackage =
                moduleBuiltin.createRequire(
                  ledgerModulePath,
                );
              const ledger =
                requireFromPackage(
                  ledgerModulePath,
                ) as Record<
                  string,
                  unknown
                >;
              return Object.freeze({
                processId: process.pid,
                platform:
                  process.platform,
                electronVersion:
                  process.versions
                    .electron ?? "",
                nodeVersion:
                  process.version,
                processType:
                  process.type ?? "",
                rendererUrlAbsent:
                  process.env
                    .EUM_STUDIO_RENDERER_URL ===
                  undefined,
                openLedgerExportType:
                  typeof ledger
                    .openNodeSqliteLedger,
              });
            },
            join(
              installed.mainBundlePath,
              manifest
                .compiledLedgerTargetRelativePath,
            ),
          );
        expect(loaded).toMatchObject({
          platform: "win32",
          processType: "browser",
          rendererUrlAbsent: true,
          openLedgerExportType:
            "function",
        });
        expect(
          loaded.processId,
        ).toBeGreaterThan(0);
        expect(
          loaded.electronVersion.length,
        ).toBeGreaterThan(0);
        expect(
          loaded.nodeVersion.length,
        ).toBeGreaterThan(0);
      } finally {
        if (application !== undefined) {
          await application.close();
        }
        await removeVerifiedTemporaryPackageDirectory(
          installed.parentDirectory,
        );
      }
    });
  },
);
