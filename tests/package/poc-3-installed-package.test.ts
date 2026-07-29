import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  createReadStream,
  watch,
} from "node:fs";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
} from "node:fs/promises";
import {
  once,
} from "node:events";
import {
  dirname,
  isAbsolute,
  join,
  relative,
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
  checksumPoc3RevisionCrashGateProfile,
  parsePoc3RevisionCrashGateProfile,
} from "../../src/desktop/poc-3-revision-crash-gate-profile";
import {
  parsePoc3InstalledPackageProbeProfile,
} from "../../src/desktop/poc-3-installed-package-probe";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";
import {
  assembleInstalledPackage,
  createNodeInstalledPackageAssemblyOperations,
  removeVerifiedTemporaryPackageDirectory,
} from "./poc-2-installed-package-assembly";
import {
  parsePoc3InstalledPackageManifest,
} from "./poc-3-installed-package-profile";
import {
  createRuntimeProbeFixture,
} from "./poc-3-installed-package-runtime-profile";

type TreeEvidence = {
  readonly fileCount: number;
  readonly totalByteCount: number;
  readonly treeChecksum: string;
};

type BackupCounts = {
  readonly workCount: number;
  readonly documentCount: number;
  readonly revisionCount: number;
  readonly resumeCheckpointCount:
    number;
  readonly writingSessionCount:
    number;
};

type LogicalChecksums = Readonly<
  Record<string, string>
>;

type ProbeReceipt = {
  readonly schemaVersion: 1;
  readonly runIdentity: string;
  readonly runtime: {
    readonly mainProcessId: number;
    readonly processType: string;
    readonly platform: string;
    readonly electronVersion:
      string;
    readonly nodeVersion: string;
  };
  readonly identities: {
    readonly checksumIdentity:
      string;
    readonly checksumAlgorithm:
      string;
    readonly revisionBlobCodecIdentity:
      string;
    readonly workId: string;
    readonly documentId: string;
    readonly currentRevisionId:
      string;
    readonly checkpointId: string;
    readonly backupChecksumIdentity:
      string;
    readonly backupFormatIdentity:
      string;
    readonly backupFormatVersion:
      string;
  };
  readonly source: {
    readonly counts: BackupCounts;
    readonly logicalChecksums:
      LogicalChecksums;
    readonly materializedContentChecksum:
      string;
    readonly checkpointPointerMatches:
      true;
  };
  readonly backup: {
    readonly publication:
      "published";
    readonly manifestChecksum:
      string;
    readonly blobCount: number;
  };
  readonly restore: {
    readonly publication:
      "published";
    readonly preflight: {
      readonly identity: string;
      readonly requiredByteCount:
        number;
      readonly authorized: true;
      readonly capacitySufficient:
        true;
    };
  };
  readonly target: {
    readonly counts: BackupCounts;
    readonly logicalChecksums:
      LogicalChecksums;
    readonly integrityValid: true;
    readonly integrityFingerprint:
      string;
    readonly integrityCounts:
      Readonly<
        Record<string, number>
      >;
    readonly materializedContentChecksum:
      string;
    readonly currentRevisionMatches:
      true;
    readonly checkpointPointerMatches:
      true;
  };
};

type RevisionRaceProbeOutcome =
  | {
      readonly type:
        "poc-3-revision-race-probe-completed";
    }
  | {
      readonly type:
        "poc-3-revision-race-probe-failed";
      readonly errorName: string;
      readonly errorCode: string;
    };

type RevisionRaceReadback = {
  readonly runtime: {
    readonly mainProcessId: number;
    readonly processType: string;
    readonly platform: string;
    readonly electronVersion: string;
    readonly nodeVersion: string;
    readonly rendererUrlAbsent:
      boolean;
  };
  readonly pointer: {
    readonly currentRevisionId:
      string;
    readonly durableRevisionId:
      string;
  };
  readonly revisionCount: number;
  readonly holderRevision: {
    readonly id: string;
    readonly contentRef: string;
    readonly contentHash: string;
  } | null;
  readonly contenderRevision: {
    readonly id: string;
    readonly contentRef: string;
    readonly contentHash: string;
  } | null;
};

async function runPackagedRevisionRaceProbe(
  application: ElectronApplication,
  input: {
    readonly probeModulePath:
      string;
    readonly command:
      Readonly<
        Record<string, unknown>
      >;
    readonly releaseDirectoryPath?:
      string;
    readonly releasePath?: string;
  },
): Promise<
  RevisionRaceProbeOutcome
> {
  return application.evaluate(
    async (
      _electron,
      probeInput,
    ) => {
      const moduleBuiltin =
        process.getBuiltinModule(
          "node:module",
        );
      const requireFromPackage =
        moduleBuiltin.createRequire(
          probeInput.probeModulePath,
        );
      const probeModule =
        requireFromPackage(
          probeInput.probeModulePath,
        ) as {
          runPoc3RevisionRaceProbe(
            command: unknown,
            enterHolderPending?:
              () => Promise<void>,
          ): Promise<
            RevisionRaceProbeOutcome
          >;
        };
      const enterHolderPending =
        probeInput
          .releaseDirectoryPath ===
          undefined ||
        probeInput.releasePath ===
          undefined
          ? undefined
          : () =>
              new Promise<void>(
                (
                  resolveNow,
                  rejectNow,
                ) => {
                  const fsBuiltin =
                    process
                      .getBuiltinModule(
                        "node:fs",
                      );
                  const fsPromisesBuiltin =
                    process
                      .getBuiltinModule(
                        "node:fs/promises",
                      );
                  let settled = false;
                  const watcher =
                    fsBuiltin.watch(
                      probeInput
                        .releaseDirectoryPath!,
                      () => {
                        void checkRelease();
                      },
                    );
                  const settle = (
                    error?: unknown,
                  ) => {
                    if (settled) {
                      return;
                    }
                    settled = true;
                    watcher.close();
                    if (
                      error === undefined
                    ) {
                      resolveNow();
                    } else {
                      rejectNow(error);
                    }
                  };
                  const checkRelease =
                    async () => {
                      try {
                        await fsPromisesBuiltin
                          .stat(
                            probeInput
                              .releasePath!,
                          );
                        settle();
                      } catch (error) {
                        if (
                          typeof error ===
                            "object" &&
                          error !== null &&
                          Reflect.get(
                            error,
                            "code",
                          ) === "ENOENT"
                        ) {
                          return;
                        }
                        settle(error);
                      }
                    };
                  watcher.once(
                    "error",
                    settle,
                  );
                  void checkRelease();
                },
              );
      return probeModule
        .runPoc3RevisionRaceProbe(
          probeInput.command,
          enterHolderPending,
        );
    },
    input,
  );
}

async function readPackagedRevisionRaceState(
  application: ElectronApplication,
  input: {
    readonly databasePath: string;
    readonly documentId: string;
    readonly holderRevisionId:
      string;
    readonly contenderRevisionId:
      string;
  },
): Promise<
  RevisionRaceReadback
> {
  return application.evaluate(
    (
      _electron,
      readbackInput,
    ) => {
      const sqliteBuiltin =
        process.getBuiltinModule(
          "node:sqlite",
        );
      const database =
        new sqliteBuiltin.DatabaseSync(
          readbackInput.databasePath,
          {
            readOnly: true,
          },
        );
      try {
        const pointer =
          database.prepare(`
            SELECT
              current_revision_id AS "currentRevisionId",
              durable_revision_id AS "durableRevisionId"
            FROM manuscripts
            WHERE document_id = ?
          `).get(
            readbackInput.documentId,
          ) as
            | {
                readonly currentRevisionId:
                  string;
                readonly durableRevisionId:
                  string;
              }
            | undefined;
        if (pointer === undefined) {
          throw new Error(
            "Packaged revision race readback found no manuscript pointer",
          );
        }
        const readRevision = (
          revisionId: string,
        ) =>
          (database.prepare(`
            SELECT
              id,
              content_ref AS "contentRef",
              content_hash AS "contentHash"
            FROM document_revisions
            WHERE id = ?
          `).get(revisionId) ?? null) as
            RevisionRaceReadback[
              "holderRevision"
            ];
        const countRow =
          database.prepare(`
            SELECT COUNT(*) AS "count"
            FROM document_revisions
          `).get() as {
            readonly count: number;
          };
        return Object.freeze({
          runtime: Object.freeze({
            mainProcessId:
              process.pid,
            processType:
              process.type ?? "",
            platform:
              process.platform,
            electronVersion:
              process.versions
                .electron ?? "",
            nodeVersion:
              process.version,
            rendererUrlAbsent:
              process.env
                .EUM_STUDIO_RENDERER_URL ===
              undefined,
          }),
          pointer:
            Object.freeze(pointer),
          revisionCount:
            countRow.count,
          holderRevision:
            readRevision(
              readbackInput
                .holderRevisionId,
            ),
          contenderRevision:
            readRevision(
              readbackInput
                .contenderRevisionId,
            ),
        });
      } finally {
        database.close();
      }
    },
    input,
  );
}

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

function requiredTimeout(): number {
  const input =
    process.env
      .EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS;
  const value = Number(input);
  if (
    input === undefined ||
    input.length === 0 ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_TEST_TIMEOUT_MS must be a caller-provided positive safe integer",
    );
  }
  return value;
}

function packageEnvironment(
  secretCanary: string,
): Record<string, string> {
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
  environment
    .EUM_STUDIO_POC_3_INSTALLED_PACKAGE_SECRET_CANARY =
      secretCanary;
  return environment;
}

function digest(
  algorithm: string,
  bytes: string | Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

async function digestFile(
  algorithm: string,
  filePath: string,
): Promise<string> {
  const hash = createHash(algorithm);
  for await (
    const chunk of createReadStream(
      filePath,
    )
  ) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function collectTreeEvidence(
  rootPath: string,
  algorithm: string,
): Promise<TreeEvidence> {
  const records: (
    readonly [
      string,
      number,
      string,
    ]
  )[] = [];
  const visit = async (
    directoryPath: string,
  ): Promise<void> => {
    const entries = (
      await readdir(
        directoryPath,
        {
          withFileTypes: true,
        },
      )
    ).sort((left, right) =>
      left.name.localeCompare(
        right.name,
      ),
    );
    for (const entry of entries) {
      const entryPath = join(
        directoryPath,
        entry.name,
      );
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        const fileStat =
          await stat(entryPath);
        records.push(
          Object.freeze([
            relative(
              rootPath,
              entryPath,
            ).replaceAll(
              "\\",
              "/",
            ),
            fileStat.size,
            await digestFile(
              algorithm,
              entryPath,
            ),
          ]),
        );
      } else {
        throw new Error(
          "Package evidence found an unsupported tree entry",
        );
      }
    }
  };
  await visit(rootPath);
  return Object.freeze({
    fileCount: records.length,
    totalByteCount:
      records.reduce(
        (total, record) =>
          total + record[1],
        0,
      ),
    treeChecksum: digest(
      algorithm,
      JSON.stringify(records),
    ),
  });
}

async function writeAtomicJson(
  targetPath: string,
  value: unknown,
): Promise<void> {
  await mkdir(
    dirname(targetPath),
    {
      recursive: true,
    },
  );
  const temporaryPath = join(
    dirname(targetPath),
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
    targetPath,
  );
}

function isPidRunning(
  processId: number,
): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

function assertDeepFrozen(
  value: unknown,
): void {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }
  expect(Object.isFrozen(value)).toBe(
    true,
  );
  for (const child of Object.values(
    value,
  )) {
    assertDeepFrozen(child);
  }
}

function findAbsoluteString(
  value: unknown,
): string | undefined {
  if (typeof value === "string") {
    return isAbsolute(value)
      ? value
      : undefined;
  }
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return undefined;
  }
  for (const child of Object.values(
    value,
  )) {
    const found =
      findAbsoluteString(child);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

const profilePath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_PROFILE_PATH",
  );
const artifactPath =
  requiredEnvironmentPath(
    "EUM_STUDIO_POC_3_INSTALLED_PACKAGE_ARTIFACT_PATH",
  );
const timeoutMs = requiredTimeout();
const manifestRaw =
  await readFile(
    profilePath,
    "utf8",
  );
const manifestValue: unknown =
  JSON.parse(manifestRaw);
const manifest =
  parsePoc3InstalledPackageManifest(
    manifestValue,
  );

describe(
  "POC-3 installed-package closed loop",
  () => {
    it("requires the caller manifest to own the compiled revision race probe target-relative path", () => {
      expect(
        Reflect.get(
          manifestValue as object,
          "compiledRevisionRaceProbeTargetRelativePath",
        ),
      ).toEqual(
        expect.any(String),
      );
    });

    it("runs storage, backup, empty restore, integrity, and materialization inside the normal packaged main process", async () => {
      expect(process.platform).toBe(
        "win32",
      );
      const secretCanary =
        randomUUID();
      const installed =
        await assembleInstalledPackage(
          manifest.package,
          createNodeInstalledPackageAssemblyOperations(),
        );
      let application:
        ElectronApplication | undefined;
      let holderApplication:
        ElectronApplication | undefined;
      let contenderApplication:
        ElectronApplication | undefined;
      let temporaryPackageRemoved =
        false;
      try {
        application =
          await electron.launch({
            executablePath:
              installed.executablePath,
            args: [
              `--user-data-dir=${join(
                installed.parentDirectory,
                randomUUID(),
              )}`,
            ],
            env: packageEnvironment(
              secretCanary,
            ),
          });
        const processWrapper =
          application.process();
        const processExit =
          once(
            processWrapper,
            "exit",
          );
        const page =
          await application.firstWindow();
        const manuscript =
          page.getByRole("textbox", {
            name: "원고",
            exact: true,
          });
        await manuscript.waitFor({
          state: "attached",
          timeout: timeoutMs,
        });
        const pageProtocol =
          new URL(page.url()).protocol;
        const mainDiscovery =
          await application.evaluate(
            () => {
              const cryptoBuiltin =
                process.getBuiltinModule(
                  "node:crypto",
                );
              return Object.freeze({
                mainProcessId:
                  process.pid,
                processType:
                  process.type ?? "",
                platform:
                  process.platform,
                electronVersion:
                  process.versions
                    .electron ?? "",
                nodeVersion:
                  process.version,
                rendererUrlAbsent:
                  process.env
                    .EUM_STUDIO_RENDERER_URL ===
                  undefined,
                hashAlgorithms:
                  cryptoBuiltin
                    .getHashes(),
              });
            },
          );
        const runtimeFixture =
          createRuntimeProbeFixture({
            temporaryParentPath:
              installed.parentDirectory,
            electronHashAlgorithms:
              mainDiscovery
                .hashAlgorithms,
            manifest,
            secretCanary,
          });
        const parsed =
          parsePoc3InstalledPackageProbeProfile(
            runtimeFixture.profile,
          );
        assertDeepFrozen(parsed);
        const probeModulePath = join(
          installed.mainBundlePath,
          manifest
            .compiledProbeTargetRelativePath,
        );
        const receipt =
          await application.evaluate(
            async (
              _electron,
              probeInput,
            ) => {
              const moduleBuiltin =
                process.getBuiltinModule(
                  "node:module",
                );
              const requireFromPackage =
                moduleBuiltin.createRequire(
                  probeInput
                    .probeModulePath,
                );
              const probeModule =
                requireFromPackage(
                  probeInput
                    .probeModulePath,
                ) as {
                  runPoc3InstalledPackageProbe(
                    profile: unknown,
                  ): Promise<
                    ProbeReceipt
                  >;
                };
              return probeModule
                .runPoc3InstalledPackageProbe(
                  probeInput.profile,
                );
            },
            {
              probeModulePath,
              profile:
                runtimeFixture.profile,
            },
          );
        expect(receipt.runtime).toEqual(
          {
            mainProcessId:
              mainDiscovery
                .mainProcessId,
            processType: "browser",
            platform: "win32",
            electronVersion:
              mainDiscovery
                .electronVersion,
            nodeVersion:
              mainDiscovery
                .nodeVersion,
          },
        );
        expect(receipt).toMatchObject({
          schemaVersion: 1,
          runIdentity:
            runtimeFixture
              .expected.runIdentity,
          identities: {
            workId:
              runtimeFixture
                .expected.workId,
            documentId:
              runtimeFixture
                .expected.documentId,
            currentRevisionId:
              runtimeFixture
                .expected.revisionId,
            checkpointId:
              runtimeFixture
                .expected.checkpointId,
          },
          source: {
            counts:
              runtimeFixture
                .expected.counts,
            materializedContentChecksum:
              runtimeFixture
                .expected
                .materializedChecksum,
            checkpointPointerMatches:
              true,
          },
          backup: {
            publication:
              "published",
            blobCount: 2,
          },
          restore: {
            publication:
              "published",
            preflight: {
              authorized: true,
              capacitySufficient:
                true,
            },
          },
          target: {
            counts:
              runtimeFixture
                .expected.counts,
            integrityValid: true,
            materializedContentChecksum:
              runtimeFixture
                .expected
                .materializedChecksum,
            currentRevisionMatches:
              true,
            checkpointPointerMatches:
              true,
          },
        });
        expect(
          receipt.target.counts,
        ).toEqual(
          receipt.source.counts,
        );
        expect(
          receipt.target
            .logicalChecksums,
        ).toEqual(
          receipt.source
            .logicalChecksums,
        );
        expect(
          receipt.restore.preflight
            .requiredByteCount,
        ).toBeGreaterThan(0);
        expect(
          page.isClosed(),
        ).toBe(false);
        expect(
          await manuscript.count(),
        ).toBe(1);
        expect(pageProtocol).toBe(
          "file:",
        );
        expect(
          mainDiscovery
            .rendererUrlAbsent,
        ).toBe(true);
        expect(
          isPidRunning(
            receipt.runtime
              .mainProcessId,
          ),
        ).toBe(true);
        const algorithm =
          receipt.identities
            .checksumAlgorithm;
        const raceProbeModulePath =
          join(
            installed.mainBundlePath,
            manifest
              .compiledRevisionRaceProbeTargetRelativePath,
          );
        const markerDirectoryPath =
          join(
            installed.parentDirectory,
            randomUUID(),
          );
        const releaseDirectoryPath =
          join(
            installed.parentDirectory,
            randomUUID(),
          );
        await Promise.all([
          mkdir(markerDirectoryPath),
          mkdir(releaseDirectoryPath),
        ]);
        const releasePath = join(
          releaseDirectoryPath,
          randomUUID(),
        );
        const holderInput =
          Object.freeze({
            revisionId:
              randomUUID(),
            workId:
              receipt.identities
                .workId,
            documentId:
              receipt.identities
                .documentId,
            expectedCurrentRevisionId:
              receipt.identities
                .currentRevisionId,
            content:
              randomUUID(),
            cause:
              randomUUID(),
            createdAt:
              new Date()
                .toISOString(),
            durableAt:
              new Date()
                .toISOString(),
          });
        const contenderInput =
          Object.freeze({
            revisionId:
              randomUUID(),
            workId:
              receipt.identities
                .workId,
            documentId:
              receipt.identities
                .documentId,
            expectedCurrentRevisionId:
              receipt.identities
                .currentRevisionId,
            content:
              randomUUID(),
            cause:
              randomUUID(),
            createdAt:
              new Date()
                .toISOString(),
            durableAt:
              new Date()
                .toISOString(),
          });
        expect(
          holderInput.revisionId,
        ).not.toBe(
          contenderInput.revisionId,
        );
        expect(
          holderInput.content,
        ).not.toBe(
          contenderInput.content,
        );
        const commonRevisionBlobProfile =
          Object.freeze({
            codecIdentity:
              randomUUID(),
            encoding:
              new TextEncoder()
                .encoding,
            contentHashAlgorithm:
              algorithm,
            contentLengthOffset:
              receipt.source.counts
                .revisionCount -
              runtimeFixture.expected
                .counts.revisionCount,
            blobReferenceIdentity:
              randomUUID(),
            metadata:
              Object.freeze({
                [randomUUID()]:
                  randomUUID(),
              }),
            manifestMetadata:
              Object.freeze({
                createdAt:
                  new Date()
                    .toISOString(),
                mediaType:
                  randomUUID(),
                originalName:
                  randomUUID(),
              }),
          });
        const createRaceProfile = (
          appendInput:
            typeof holderInput,
          temporaryEntryIdentity:
            string,
        ) =>
          parsePoc3RevisionCrashGateProfile({
            schemaVersion:
              manifest.schemaVersion,
            scenarioId:
              randomUUID(),
            reachedPath:
              join(
                markerDirectoryPath,
                randomUUID(),
              ),
            reachedTemporaryPath:
              join(
                markerDirectoryPath,
                randomUUID(),
              ),
            storageOpenProfile:
              parsed.storage.source,
            blobStoreProfile:
              parsed.blobStores.source,
            revisionBlobProfile: {
              ...commonRevisionBlobProfile,
              temporaryEntryIdentity,
            },
            appendInput,
          });
        const holderProfile =
          createRaceProfile(
            holderInput,
            randomUUID(),
          );
        const contenderProfile =
          createRaceProfile(
            contenderInput,
            randomUUID(),
          );
        const holderCallerChecksum =
          Object.freeze({
            identity:
              randomUUID(),
            algorithm,
            value:
              checksumPoc3RevisionCrashGateProfile(
                holderProfile,
                algorithm,
              ),
          });
        const contenderCallerChecksum =
          Object.freeze({
            identity:
              randomUUID(),
            algorithm,
            value:
              checksumPoc3RevisionCrashGateProfile(
                contenderProfile,
                algorithm,
              ),
          });
        const holderUserDataPath =
          join(
            installed.parentDirectory,
            randomUUID(),
          );
        const contenderUserDataPath =
          join(
            installed.parentDirectory,
            randomUUID(),
          );
        expect(
          holderUserDataPath,
        ).not.toBe(
          contenderUserDataPath,
        );
        const raceApplications =
          await Promise.all([
            electron.launch({
              executablePath:
                installed.executablePath,
              args: [
                `--user-data-dir=${holderUserDataPath}`,
              ],
              env: packageEnvironment(
                secretCanary,
              ),
            }),
            electron.launch({
              executablePath:
                installed.executablePath,
              args: [
                `--user-data-dir=${contenderUserDataPath}`,
              ],
              env: packageEnvironment(
                secretCanary,
              ),
            }),
          ]);
        holderApplication =
          raceApplications[0];
        contenderApplication =
          raceApplications[1];
        const holderProcessExit =
          once(
            holderApplication.process(),
            "exit",
          );
        const contenderProcessExit =
          once(
            contenderApplication.process(),
            "exit",
          );
        const [
          holderPage,
          contenderPage,
        ] = await Promise.all([
          holderApplication
            .firstWindow(),
          contenderApplication
            .firstWindow(),
        ]);
        const racePageProtocols =
          Object.freeze({
            holder:
              new URL(
                holderPage.url(),
              ).protocol,
            contender:
              new URL(
                contenderPage.url(),
              ).protocol,
          });
        expect(
          racePageProtocols,
        ).toEqual({
          holder: "file:",
          contender: "file:",
        });
        const holderCommand =
          Object.freeze({
            type:
              "poc-3-revision-race-worker-run",
            role: "holder",
            callerChecksum:
              holderCallerChecksum,
            profile:
              holderProfile,
          });
        const contenderCommand =
          Object.freeze({
            type:
              "poc-3-revision-race-worker-run",
            role: "contender",
            callerChecksum:
              contenderCallerChecksum,
            profile:
              contenderProfile,
          });
        const markerWatcher =
          watch(
            markerDirectoryPath,
          );
        const markerObservation =
          new Promise<void>(
            (
              resolveNow,
              rejectNow,
            ) => {
              let settled = false;
              const settle = (
                error?: unknown,
              ) => {
                if (settled) {
                  return;
                }
                settled = true;
                if (
                  error === undefined
                ) {
                  resolveNow();
                } else {
                  rejectNow(error);
                }
              };
              const checkMarker =
                async () => {
                  try {
                    await stat(
                      holderProfile
                        .reachedPath,
                    );
                    settle();
                  } catch (error) {
                    if (
                      typeof error ===
                        "object" &&
                      error !== null &&
                      Reflect.get(
                        error,
                        "code",
                      ) === "ENOENT"
                    ) {
                      return;
                    }
                    settle(error);
                  }
                };
              markerWatcher.on(
                "change",
                () => {
                  void checkMarker();
                },
              );
              markerWatcher.once(
                "error",
                settle,
              );
              void checkMarker();
            },
          );
        const holderProbe =
          runPackagedRevisionRaceProbe(
            holderApplication,
            {
              probeModulePath:
                raceProbeModulePath,
              command:
                holderCommand,
              releaseDirectoryPath,
              releasePath,
            },
          );
        try {
          await Promise.race([
            markerObservation,
            holderProbe.then(
              (outcome) => {
                throw new Error(
                  `Packaged holder returned before reaching its pre-commit gate: ${outcome.type}`,
                );
              },
            ),
          ]);
        } finally {
          markerWatcher.close();
        }
        expect(
          JSON.parse(
            await readFile(
              holderProfile
                .reachedPath,
              "utf8",
            ),
          ),
        ).toEqual([
          "poc-3-revision-crash-gate-reached",
          holderProfile.schemaVersion,
          holderProfile.scenarioId,
          holderInput.revisionId,
          holderCallerChecksum
            .identity,
          holderCallerChecksum.value,
        ]);
        const contenderOutcome =
          await runPackagedRevisionRaceProbe(
            contenderApplication,
            {
              probeModulePath:
                raceProbeModulePath,
              command:
                contenderCommand,
            },
          );
        expect(
          contenderOutcome,
        ).toMatchObject({
          type:
            "poc-3-revision-race-probe-failed",
          errorName:
            expect.any(String),
          errorCode:
            expect.stringMatching(
              /^(SQLITE_BUSY|SQLITE_LOCKED)$/,
            ),
        });
        expect(
          contenderOutcome,
        ).not.toHaveProperty(
          "message",
        );
        const beforeRelease =
          await readPackagedRevisionRaceState(
            contenderApplication,
            {
              databasePath:
                parsed.storage.source
                  .databasePath,
              documentId:
                receipt.identities
                  .documentId,
              holderRevisionId:
                holderInput
                  .revisionId,
              contenderRevisionId:
                contenderInput
                  .revisionId,
            },
          );
        expect(
          beforeRelease.pointer,
        ).toEqual({
          currentRevisionId:
            receipt.identities
              .currentRevisionId,
          durableRevisionId:
            receipt.identities
              .currentRevisionId,
        });
        expect(
          beforeRelease
            .holderRevision,
        ).toBeNull();
        expect(
          beforeRelease
            .contenderRevision,
        ).toBeNull();
        const releaseHandle =
          await open(
            releasePath,
            "wx",
          );
        try {
          await releaseHandle.sync();
        } finally {
          await releaseHandle.close();
        }
        const holderOutcome =
          await holderProbe;
        expect(
          holderOutcome,
        ).toEqual({
          type:
            "poc-3-revision-race-probe-completed",
        });
        const afterCommit =
          await readPackagedRevisionRaceState(
            holderApplication,
            {
              databasePath:
                parsed.storage.source
                  .databasePath,
              documentId:
                receipt.identities
                  .documentId,
              holderRevisionId:
                holderInput
                  .revisionId,
              contenderRevisionId:
                contenderInput
                  .revisionId,
            },
          );
        if (
          !Buffer.isEncoding(
            commonRevisionBlobProfile
              .encoding,
          )
        ) {
          throw new Error(
            "Runtime TextEncoder encoding is unsupported by Buffer",
          );
        }
        const holderBytes =
          Buffer.from(
            holderInput.content,
            commonRevisionBlobProfile
              .encoding as BufferEncoding,
          );
        const holderContentHash =
          digest(
            commonRevisionBlobProfile
              .contentHashAlgorithm,
            holderBytes,
          );
        const holderBlobChecksum =
          digest(
            parsed.blobStores.source
              .checksum.algorithm,
            holderBytes,
          );
        const holderContentRef =
          JSON.stringify([
            commonRevisionBlobProfile
              .blobReferenceIdentity,
            parsed.blobStores.source
              .checksum.identity,
            holderBlobChecksum,
          ]);
        expect(
          afterCommit.pointer,
        ).toEqual({
          currentRevisionId:
            holderInput.revisionId,
          durableRevisionId:
            holderInput.revisionId,
        });
        expect(
          afterCommit.revisionCount,
        ).toBe(
          beforeRelease
            .revisionCount + 1,
        );
        expect(
          afterCommit
            .holderRevision,
        ).toEqual({
          id:
            holderInput.revisionId,
          contentRef:
            holderContentRef,
          contentHash:
            holderContentHash,
        });
        expect(
          afterCommit
            .contenderRevision,
        ).toBeNull();
        expect(
          beforeRelease.runtime
            .mainProcessId,
        ).not.toBe(
          afterCommit.runtime
            .mainProcessId,
        );
        expect(
          beforeRelease.runtime,
        ).toMatchObject({
          processType: "browser",
          platform: "win32",
          rendererUrlAbsent: true,
        });
        expect(
          afterCommit.runtime,
        ).toMatchObject({
          processType: "browser",
          platform: "win32",
          rendererUrlAbsent: true,
        });
        const raceEvidence =
          Object.freeze({
            executableIdentityChecksum:
              digest(
                algorithm,
                installed
                  .executablePath,
              ),
            sharedSource:
              Object.freeze({
                databaseIdentityChecksum:
                  digest(
                    algorithm,
                    parsed.storage.source
                      .databasePath,
                  ),
                baselineRevisionIdChecksum:
                  digest(
                    algorithm,
                    receipt.identities
                      .currentRevisionId,
                  ),
              }),
            holder: Object.freeze({
              runtime:
                afterCommit.runtime,
              pageProtocol:
                racePageProtocols
                  .holder,
              userDataIdentityChecksum:
                digest(
                  algorithm,
                  holderUserDataPath,
                ),
              outcome:
                holderOutcome,
              revisionIdChecksum:
                digest(
                  algorithm,
                  holderInput
                    .revisionId,
                ),
              contentChecksum:
                holderContentHash,
            }),
            contender:
              Object.freeze({
                runtime:
                  beforeRelease
                    .runtime,
                pageProtocol:
                  racePageProtocols
                    .contender,
                userDataIdentityChecksum:
                  digest(
                    algorithm,
                    contenderUserDataPath,
                  ),
                outcome:
                  contenderOutcome,
                revisionIdChecksum:
                  digest(
                    algorithm,
                    contenderInput
                      .revisionId,
                  ),
                contentChecksum:
                  digest(
                    commonRevisionBlobProfile
                      .contentHashAlgorithm,
                    Buffer.from(
                      contenderInput
                        .content,
                      commonRevisionBlobProfile
                        .encoding as BufferEncoding,
                    ),
                  ),
              }),
            readback:
              Object.freeze({
                beforeRelease:
                  Object.freeze({
                    currentRevisionIdChecksum:
                      digest(
                        algorithm,
                        beforeRelease
                          .pointer
                          .currentRevisionId,
                      ),
                    durableRevisionIdChecksum:
                      digest(
                        algorithm,
                        beforeRelease
                          .pointer
                          .durableRevisionId,
                      ),
                    revisionCount:
                      beforeRelease
                        .revisionCount,
                    holderReferencePresent:
                      false,
                    contenderReferencePresent:
                      false,
                  }),
                afterCommit:
                  Object.freeze({
                    currentRevisionIdChecksum:
                      digest(
                        algorithm,
                        afterCommit.pointer
                          .currentRevisionId,
                      ),
                    durableRevisionIdChecksum:
                      digest(
                        algorithm,
                        afterCommit.pointer
                          .durableRevisionId,
                      ),
                    revisionCount:
                      afterCommit
                        .revisionCount,
                    holderReferencePresent:
                      true,
                    contenderReferencePresent:
                      false,
                    holderContentRefChecksum:
                      digest(
                        algorithm,
                        holderContentRef,
                      ),
                    holderContentHash,
                  }),
              }),
            developmentServerUsed:
              false,
          });
        const runtimeSourceTree =
          await collectTreeEvidence(
            resolve(
              manifest.package
                .electronRuntimeDirectoryPath,
            ),
            algorithm,
          );
        const packageTree =
          await collectTreeEvidence(
            installed.packageRoot,
            algorithm,
          );
        const applicationTree =
          await collectTreeEvidence(
            installed.applicationRoot,
            algorithm,
          );
        const sourceProvenance =
          await captureGitSourceProvenance({
            cwd: process.cwd(),
            checksumAlgorithm:
              algorithm,
          });
        const compiledProbeChecksum =
          await digestFile(
            algorithm,
            probeModulePath,
          );
        const compiledRevisionRaceProbeChecksum =
          await digestFile(
            algorithm,
            raceProbeModulePath,
          );
        await Promise.all([
          application.close(),
          holderApplication.close(),
          contenderApplication.close(),
        ]);
        await Promise.all([
          processExit,
          holderProcessExit,
          contenderProcessExit,
        ]);
        application = undefined;
        holderApplication = undefined;
        contenderApplication =
          undefined;
        expect(
          isPidRunning(
            receipt.runtime
              .mainProcessId,
          ),
        ).toBe(false);
        await removeVerifiedTemporaryPackageDirectory(
          installed.parentDirectory,
        );
        temporaryPackageRemoved =
          true;
        const artifact = Object.freeze({
          schemaVersion: 1,
          generatedAt:
            new Date().toISOString(),
          provenance: Object.freeze({
            ...sourceProvenance,
            packageProfileChecksum:
              digest(
                algorithm,
                manifestRaw,
              ),
            compiledProbeChecksum:
              compiledProbeChecksum,
            compiledRevisionRaceProbeChecksum,
          }),
          runtimeSource:
            Object.freeze({
              mode:
                "electron-prebuilt-runtime",
              tree:
                runtimeSourceTree,
            }),
          package: Object.freeze({
            mode:
              "electron-prebuilt-resources-app-poc",
            pageProtocol,
            rendererUrlAbsent:
              mainDiscovery
                .rendererUrlAbsent,
            developmentServerUsed:
              false,
            mainProcessId:
              receipt.runtime
                .mainProcessId,
            runtime:
              receipt.runtime,
            tree: packageTree,
            applicationTree,
          }),
          receipt,
          revisionRace:
            raceEvidence,
          lifecycle: Object.freeze({
            normalWindowFunctionalAfterProbe:
              true,
            cleanClose: true,
            mainProcessExited: true,
            revisionRaceMainProcessesExited:
              true,
            temporaryPackageRemoved,
          }),
          summary: Object.freeze({
            sourceTargetCountsMatch:
              true,
            sourceTargetLogicalChecksumsMatch:
              true,
            allPassed: true,
          }),
        });
        const artifactText =
          JSON.stringify(artifact);
        for (
          const forbidden
          of [
            ...runtimeFixture
              .forbiddenArtifactValues,
            holderInput.content,
            contenderInput.content,
          ]
        ) {
          expect(
            artifactText.includes(
              forbidden,
            ),
          ).toBe(false);
        }
        expect(
          findAbsoluteString(
            artifact,
          ),
        ).toBeUndefined();
        await writeAtomicJson(
          artifactPath,
          artifact,
        );
      } finally {
        if (
          contenderApplication !==
          undefined
        ) {
          await contenderApplication
            .close();
        }
        if (
          holderApplication !==
          undefined
        ) {
          await holderApplication
            .close();
        }
        if (application !== undefined) {
          await application.close();
        }
        if (!temporaryPackageRemoved) {
          await removeVerifiedTemporaryPackageDirectory(
            installed.parentDirectory,
          );
        }
      }
    });
  },
);
