import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  spawn,
  execFile,
} from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import {
  promisify,
} from "node:util";

import type {
  Poc3DriverBakeOffManifest,
} from "../../src/application/storage/poc-3-driver-bake-off-contract";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";

const execFileAsync = promisify(
  execFile,
);

type ChildProbeResult = {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly applicationMode: string;
  readonly electronMainRuntime:
    boolean;
  readonly electronRunAsNode:
    boolean;
  readonly processType: string;
  readonly electronVersion: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly architecture: string;
  readonly manifestChecksum:
    string;
  readonly officialEvidence:
    Poc3DriverBakeOffManifest[
      "officialEvidence"
    ];
  readonly candidateLoads:
    readonly {
      readonly candidateId: string;
      readonly loaded: boolean;
      readonly contractChecksum:
        string;
      readonly correctness:
        Readonly<
          Record<string, boolean>
        >;
      readonly timingsMs:
        Readonly<
          Record<string, number>
        >;
      readonly databaseChecksum:
        string;
      readonly backupChecksum:
        string;
      readonly [field: string]:
        unknown;
    }[];
  readonly error?: {
    readonly name: string;
    readonly message: string;
  };
};

export type Poc3DriverPackageProbeResult =
  ChildProbeResult & {
    readonly provenance: {
      readonly source:
        Awaited<
          ReturnType<
            typeof captureGitSourceProvenance
          >
        >;
      readonly packageManifestChecksum:
        string;
      readonly packageLockChecksum:
        string;
      readonly launchDurationMs:
        number;
      readonly stdoutChecksum:
        string;
      readonly stderrChecksum:
        string;
    };
    readonly package: {
      readonly location:
        "os-temporary-directory";
      readonly finalPackagingConfigurationSelected:
        false;
      readonly finalDriverSelected:
        false;
    };
    readonly cleanup: {
      readonly mainProcessExited:
        true;
      readonly temporaryResourcesAppRemoved:
        true;
      readonly residualPackageProcesses:
        0;
    };
  };

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
      "POC-3 package target escapes or aliases its caller root",
    );
  }
  return target;
}

function digestBytes(
  algorithm: string,
  value: string | Uint8Array,
): string {
  return createHash(algorithm)
    .update(value)
    .digest("hex");
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

function packageMainSource(): string {
  return [
    "'use strict';",
    "const crypto = require('node:crypto');",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const { app } = require('electron');",
    "const profile = JSON.parse(process.env.EUM_STUDIO_POC_3_DRIVER_PACKAGE_PROFILE);",
    "const contract = require(profile.contractModulePath);",
    "const platform = require(profile.platformModulePath);",
    "function digestFile(algorithm, filePath) {",
    "  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest('hex');",
    "}",
    "function writeResult(value) {",
    "  const temporaryPath = path.join(path.dirname(profile.resultPath), crypto.randomUUID() + '.tmp');",
    "  const descriptor = fs.openSync(temporaryPath, 'wx');",
    "  try {",
    "    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\\n', 'utf8');",
    "    fs.fsyncSync(descriptor);",
    "  } finally {",
    "    fs.closeSync(descriptor);",
    "  }",
    "  fs.renameSync(temporaryPath, profile.resultPath);",
    "}",
    "app.whenReady().then(async () => {",
    "  const manifestRaw = fs.readFileSync(profile.manifestPath, 'utf8');",
    "  const manifest = contract.parsePoc3DriverBakeOffManifest(JSON.parse(manifestRaw));",
    "  const fixture = contract.generatePoc3DriverFixture(",
    "    manifest,",
    "    crypto.randomUUID,",
    "    (value) => crypto.createHash(manifest.checksumAlgorithm).update(value, 'utf8').digest('hex')",
    "  );",
    "  const adapters = await platform.createPoc3DriverAdapters(manifest.candidates);",
    "  const candidateLoads = [];",
    "  for (const adapter of adapters) {",
    "    const candidateRoot = path.join(profile.databaseRootPath, crypto.randomUUID());",
    "    fs.mkdirSync(candidateRoot, { recursive: true });",
    "    const databasePath = path.join(candidateRoot, manifest.databaseFiles.primaryFileName);",
    "    const backupPath = path.join(candidateRoot, manifest.databaseFiles.backupFileName);",
    "    const result = await platform.runPoc3DriverCorrectnessContract({",
    "      manifest,",
    "      adapter,",
    "      fixture,",
    "      databasePath,",
    "      backupPath",
    "    });",
    "    candidateLoads.push(Object.freeze({",
    "      ...result,",
    "      loaded: true,",
    "      databaseChecksum: digestFile(manifest.checksumAlgorithm, databasePath),",
    "      backupChecksum: digestFile(manifest.checksumAlgorithm, backupPath)",
    "    }));",
    "  }",
    "  writeResult(Object.freeze({",
    "    schemaVersion: manifest.schemaVersion,",
    "    generatedAt: new Date().toISOString(),",
    "    applicationMode: 'electron-prebuilt-resources-app-poc',",
    "    electronMainRuntime: typeof process.versions.electron === 'string',",
    "    electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE === '1',",
    "    processType: process.type || '',",
    "    electronVersion: process.versions.electron || '',",
    "    nodeVersion: process.version,",
    "    platform: process.platform,",
    "    architecture: process.arch,",
    "    manifestChecksum: crypto.createHash(manifest.checksumAlgorithm).update(manifestRaw, 'utf8').digest('hex'),",
    "    officialEvidence: manifest.officialEvidence,",
    "    candidateLoads",
    "  }));",
    "  app.quit();",
    "}).catch((error) => {",
    "  writeResult({",
    "    error: {",
    "      name: error instanceof Error ? error.name : 'UnknownError',",
    "      message: error instanceof Error ? error.message : String(error)",
    "    }",
    "  });",
    "  app.exitCode = 1;",
    "  app.quit();",
    "});",
  ].join("\n");
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateProcessTree(
  pid: number,
): Promise<void> {
  if (!isPidRunning(pid)) {
    return;
  }
  if (process.platform === "win32") {
    try {
      await execFileAsync(
        "taskkill",
        [
          "/PID",
          String(pid),
          "/T",
          "/F",
        ],
      );
    } catch {
      if (isPidRunning(pid)) {
        throw new Error(
          `POC-3 package process tree did not terminate: ${pid}`,
        );
      }
    }
    return;
  }
  process.kill(pid, "SIGKILL");
}

async function launchPackage(
  input: {
    readonly executablePath: string;
    readonly userDataPath: string;
    readonly profileRaw: string;
    readonly timeoutMs: number;
  },
): Promise<{
  readonly pid: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const inherited = {
    ...process.env,
  };
  delete inherited
    .ELECTRON_RUN_AS_NODE;
  inherited
    .EUM_STUDIO_POC_3_DRIVER_PACKAGE_PROFILE =
      input.profileRaw;
  const startedAt =
    performance.now();
  const child = spawn(
    input.executablePath,
    [
      `--user-data-dir=${input.userDataPath}`,
    ],
    {
      env: inherited,
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
      windowsHide: true,
    },
  );
  if (child.pid === undefined) {
    throw new Error(
      "POC-3 Electron package did not expose a main PID",
    );
  }
  const pid = child.pid;
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on(
    "data",
    (chunk: string) => {
      stdout += chunk;
    },
  );
  child.stderr.on(
    "data",
    (chunk: string) => {
      stderr += chunk;
    },
  );

  const exitCode =
    await new Promise<number>(
      (resolveExit, rejectExit) => {
        let settled = false;
        const timer = setTimeout(
          () => {
            if (settled) {
              return;
            }
            settled = true;
            void terminateProcessTree(
              pid,
            ).finally(() => {
              rejectExit(
                new Error(
                  "POC-3 Electron package probe timed out",
                ),
              );
            });
          },
          input.timeoutMs,
        );
        child.once("error", (error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          rejectExit(error);
        });
        child.once(
          "close",
          (code) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            resolveExit(
              code ?? -1,
            );
          },
        );
      },
    );
  if (exitCode !== 0) {
    throw new Error(
      `POC-3 Electron package exited ${exitCode}: ${stderr}`,
    );
  }
  if (isPidRunning(pid)) {
    await terminateProcessTree(pid);
    throw new Error(
      `POC-3 Electron package main PID remained after exit: ${pid}`,
    );
  }
  return Object.freeze({
    pid,
    durationMs:
      performance.now() -
      startedAt,
    stdout,
    stderr,
  });
}

export async function runPoc3DriverPackageProbe(
  input: {
    readonly projectRootPath: string;
    readonly manifestPath: string;
    readonly manifestRaw: string;
    readonly manifest:
      Poc3DriverBakeOffManifest;
    readonly artifactDirectoryPath:
      string;
  },
): Promise<Poc3DriverPackageProbeResult> {
  const projectRoot = resolve(
    input.projectRootPath,
  );
  const sourceProvenance =
    await captureGitSourceProvenance({
      cwd: projectRoot,
      checksumAlgorithm:
        input.manifest
          .checksumAlgorithm,
    });
  const packageManifestRaw =
    await readFile(
      resolve(
        projectRoot,
        input.manifest
          .provenanceFiles
          .packageManifestPath,
      ),
      "utf8",
    );
  const packageLockRaw =
    await readFile(
      resolve(
        projectRoot,
        input.manifest
          .provenanceFiles
          .packageLockPath,
      ),
      "utf8",
    );
  const temporaryParent =
    await mkdtemp(
      join(
        tmpdir(),
        `${randomUUID()}-`,
      ),
    );
  let launch:
    Awaited<
      ReturnType<
        typeof launchPackage
      >
    > | undefined;
  let childResult:
    ChildProbeResult | undefined;
  let cleanupError:
    unknown;
  try {
    const packageRoot =
      resolveInside(
        temporaryParent,
        randomUUID(),
      );
    await cp(
      resolve(
        projectRoot,
        input.manifest
          .packageProbe
          .electronRuntimeDirectoryPath,
      ),
      packageRoot,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    const applicationRoot =
      resolveInside(
        packageRoot,
        input.manifest
          .packageProbe
          .applicationResourcesRelativePath,
      );
    await mkdir(
      applicationRoot,
      {
        recursive: true,
      },
    );
    const applicationManifestPath =
      resolveInside(
        applicationRoot,
        input.manifest
          .packageProbe
          .applicationManifestRelativePath,
      );
    const applicationMainPath =
      resolveInside(
        applicationRoot,
        input.manifest
          .packageProbe
          .applicationMainRelativePath,
      );
    const compiledApplicationTarget =
      resolveInside(
        applicationRoot,
        input.manifest
          .packageProbe
          .compiledApplicationTargetRelativePath,
      );
    const compiledPlatformTarget =
      resolveInside(
        applicationRoot,
        input.manifest
          .packageProbe
          .compiledPlatformTargetRelativePath,
      );
    const betterSqliteTarget =
      resolveInside(
        applicationRoot,
        input.manifest
          .packageProbe
          .betterSqlitePackageTargetRelativePath,
      );
    for (
      const target
      of [
        applicationManifestPath,
        applicationMainPath,
        compiledApplicationTarget,
        compiledPlatformTarget,
        betterSqliteTarget,
      ]
    ) {
      await mkdir(
        dirname(target),
        {
          recursive: true,
        },
      );
    }
    await cp(
      resolve(
        projectRoot,
        input.manifest
          .packageProbe
          .compiledApplicationRelativePath,
      ),
      compiledApplicationTarget,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    await cp(
      resolve(
        projectRoot,
        input.manifest
          .packageProbe
          .compiledPlatformRelativePath,
      ),
      compiledPlatformTarget,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    await cp(
      resolve(
        projectRoot,
        input.manifest
          .packageProbe
          .betterSqlitePackagePath,
      ),
      betterSqliteTarget,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );
    await writeAtomicJson(
      applicationManifestPath,
      {
        name: `poc-${randomUUID()}`,
        private: true,
        main:
          input.manifest
            .packageProbe
            .applicationMainRelativePath,
      },
    );
    await mkdir(
      dirname(applicationMainPath),
      {
        recursive: true,
      },
    );
    const mainHandle = await open(
      applicationMainPath,
      "wx",
    );
    try {
      await mainHandle.writeFile(
        packageMainSource(),
        "utf8",
      );
      await mainHandle.sync();
    } finally {
      await mainHandle.close();
    }

    const resultPath =
      resolveInside(
        temporaryParent,
        `${randomUUID()}.json`,
      );
    const databaseRootPath =
      resolveInside(
        temporaryParent,
        randomUUID(),
      );
    const userDataPath =
      resolveInside(
        temporaryParent,
        randomUUID(),
      );
    await Promise.all([
      mkdir(
        databaseRootPath,
        {
          recursive: true,
        },
      ),
      mkdir(
        userDataPath,
        {
          recursive: true,
        },
      ),
    ]);
    const contractModulePath =
      resolveInside(
        compiledApplicationTarget,
        input.manifest
          .packageProbe
          .compiledContractEntryFileName,
      );
    const platformModulePath =
      resolveInside(
        compiledPlatformTarget,
        input.manifest
          .packageProbe
          .compiledPlatformEntryFileName,
      );
    launch = await launchPackage({
      executablePath:
        resolveInside(
          packageRoot,
          input.manifest
            .packageProbe
            .electronExecutableRelativePath,
        ),
      userDataPath,
      profileRaw: JSON.stringify({
        manifestPath:
          resolve(input.manifestPath),
        resultPath,
        databaseRootPath,
        contractModulePath,
        platformModulePath,
      }),
      timeoutMs:
        input.manifest.measurement
          .timeoutMs,
    });
    childResult = JSON.parse(
      await readFile(
        resultPath,
        "utf8",
      ),
    ) as ChildProbeResult;
    if (childResult.error !== undefined) {
      throw new Error(
        `${childResult.error.name}: ${childResult.error.message}`,
      );
    }
  } finally {
    if (
      launch !== undefined &&
      isPidRunning(launch.pid)
    ) {
      await terminateProcessTree(
        launch.pid,
      );
    }
    try {
      await rm(
        temporaryParent,
        {
          recursive: true,
          force: true,
        },
      );
    } catch (error) {
      cleanupError = error;
    }
  }
  if (cleanupError !== undefined) {
    throw new Error(
      "POC-3 temporary resources/app package cleanup failed",
      {
        cause: cleanupError,
      },
    );
  }
  if (
    launch === undefined ||
    childResult === undefined
  ) {
    throw new Error(
      "POC-3 package probe produced no result",
    );
  }

  const result:
    Poc3DriverPackageProbeResult = {
      ...childResult,
      provenance: {
        source: sourceProvenance,
        packageManifestChecksum:
          digestBytes(
            input.manifest
              .checksumAlgorithm,
            packageManifestRaw,
          ),
        packageLockChecksum:
          digestBytes(
            input.manifest
              .checksumAlgorithm,
            packageLockRaw,
          ),
        launchDurationMs:
          launch.durationMs,
        stdoutChecksum:
          digestBytes(
            input.manifest
              .checksumAlgorithm,
            launch.stdout,
          ),
        stderrChecksum:
          digestBytes(
            input.manifest
              .checksumAlgorithm,
            launch.stderr,
          ),
      },
      package: {
        location:
          "os-temporary-directory",
        finalPackagingConfigurationSelected:
          false,
        finalDriverSelected: false,
      },
      cleanup: {
        mainProcessExited: true,
        temporaryResourcesAppRemoved:
          true,
        residualPackageProcesses: 0,
      },
    };
  const artifactPath =
    resolveInside(
      input.artifactDirectoryPath,
      input.manifest.artifactFiles
        .packageLoadFileName,
    );
  await writeAtomicJson(
    artifactPath,
    result,
  );
  return deepFreeze(result);
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
