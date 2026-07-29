import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  cpus,
  release,
  tmpdir,
  totalmem,
} from "node:os";
import {
  dirname,
  join,
  relative,
  resolve,
} from "node:path";

import {
  expect as expectPlaywright,
} from "@playwright/test";
import {
  _electron as electron,
  type CDPSession,
  type ElectronApplication,
  type Page,
} from "playwright";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  encodeCanonicalManuscriptVerificationBytes,
} from "../../src/application/persistence/compact-journal-into-revision";
import {
  createEnvironmentManifest,
} from "../../src/application/measurement/environment-manifest";
import {
  createPoc2PerformanceReport,
  type Poc2GcSample,
  type Poc2MemorySample,
  type Poc2PerformanceRunInput,
} from "../../src/application/measurement/poc-2-performance-report";
import {
  parsePoc2PerformanceProfile,
} from "../../src/application/measurement/poc-2-performance-profile";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
} from "../../src/application/persistence/change-batch";
import {
  entityId,
} from "../../src/domain/writing";
import {
  createNodeCryptoJournalChecksumAdapter,
} from "../../src/platform/journal/node-crypto-journal-checksum";
import {
  scanAppendOnlyJournal,
} from "../../src/platform/journal/append-only-journal";
import {
  resolvePocJournalCompaction,
} from "../../src/platform/persistence/poc-journal-compaction-port";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";

type PackageManifest = {
  readonly dependencies?: Readonly<
    Record<string, string>
  >;
  readonly devDependencies?: Readonly<
    Record<string, string>
  >;
};

type LockManifest = {
  readonly packages?: Readonly<
    Record<
      string,
      { readonly version?: string }
    >
  >;
};

type PerformanceMetric = {
  readonly name: string;
  readonly value: number;
};

function requiredEnvironmentPath(
  name:
    | "EUM_STUDIO_POC_2_PERFORMANCE_PROFILE_PATH"
    | "EUM_STUDIO_POC_2_PERFORMANCE_ARTIFACT_PATH",
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

function digestBytes(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function digestText(
  algorithm: string,
  text: string,
): string {
  return digestBytes(
    algorithm,
    encodeCanonicalManuscriptVerificationBytes(
      text,
    ),
  );
}

function digestUtf8(
  algorithm: string,
  text: string,
): string {
  return digestBytes(
    algorithm,
    new TextEncoder().encode(text),
  );
}

function inheritedEnvironment(): Record<
  string,
  string
> {
  const environment: Record<
    string,
    string
  > = {};
  for (
    const [key, value] of Object.entries(
      process.env,
    )
  ) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  for (const key of [
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
  return environment;
}

function createEnvironment(
  packageRaw: string,
  lockRaw: string,
) {
  const packageManifest = JSON.parse(
    packageRaw,
  ) as PackageManifest;
  const lockManifest = JSON.parse(
    lockRaw,
  ) as LockManifest;
  const packageNames = new Set([
    ...Object.keys(
      packageManifest.dependencies ?? {},
    ),
    ...Object.keys(
      packageManifest.devDependencies ?? {},
    ),
  ]);
  const packages = [...packageNames].map(
    (name) => {
      const version =
        lockManifest.packages?.[
          `node_modules/${name}`
        ]?.version;
      if (version === undefined) {
        throw new Error(
          `Missing installed package version: ${name}`,
        );
      }
      return { name, version };
    },
  );
  const processors = cpus();
  return createEnvironmentManifest({
    capturedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    osRelease: release(),
    nodeVersion: process.version,
    cpuModel: [
      ...new Set(
        processors.map(
          (processor) =>
            processor.model,
        ),
      ),
    ].join(" | "),
    logicalProcessorCount:
      processors.length,
    totalMemoryBytes: totalmem(),
    packages,
  });
}

async function selectCommonHashAlgorithm(): Promise<{
  readonly algorithm: string;
  readonly electronVersion: string;
}> {
  const discoveryApp =
    await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: {
        ...inheritedEnvironment(),
        EUM_STUDIO_WINDOW_VISIBILITY:
          "hidden",
      },
    });
  try {
    const discovery =
      await discoveryApp.evaluate(() => {
        const crypto =
          process.getBuiltinModule(
            "node:crypto",
          );
        return {
          electronVersion:
            process.versions.electron ?? "",
          algorithms: crypto
            .getHashes()
            .filter((algorithm) => {
              try {
                crypto
                  .createHash(algorithm)
                  .digest();
                return true;
              } catch {
                return false;
              }
            }),
        };
      });
    const nodeAlgorithms =
      getHashes().filter((algorithm) => {
        try {
          createHash(algorithm).digest();
          return true;
        } catch {
          return false;
        }
      });
    const common =
      discovery.algorithms.filter(
        (algorithm) =>
          nodeAlgorithms.includes(
            algorithm,
          ),
      );
    const algorithm =
      common[
        randomInt(0, common.length)
      ];
    if (algorithm === undefined) {
      throw new Error(
        "No common Node/Electron hash algorithm",
      );
    }
    if (
      discovery.electronVersion.length ===
      0
    ) {
      throw new Error(
        "Electron version is unavailable",
      );
    }
    return {
      algorithm,
      electronVersion:
        discovery.electronVersion,
    };
  } finally {
    await discoveryApp.close();
  }
}

function nextInputCodeUnit(): string {
  const material = randomUUID().replaceAll(
    "-",
    "",
  );
  return material[
    randomInt(0, material.length)
  ]!;
}

function metricValue(
  metrics: readonly PerformanceMetric[],
  name: string,
): number {
  const metric = metrics.find(
    (candidate) =>
      candidate.name === name,
  );
  if (metric === undefined) {
    throw new Error(
      `Missing Chromium performance metric: ${name}`,
    );
  }
  return metric.value;
}

async function prepareDurableAckMeasurement(
  page: Page,
  measurementKey: string,
): Promise<void> {
  await page.evaluate(
    ({ key }) => {
      const saveState =
        document.querySelector(
          '[data-testid="save-state"]',
        );
      if (saveState === null) {
        throw new Error(
          "Save-state measurement surface is unavailable",
        );
      }
      const startedAt =
        performance.now();
      let leftSaved = false;
      const measurement =
        new Promise<number>(
          (resolveNow) => {
            const observeState = () => {
              const text =
                saveState.textContent;
              if (text !== "저장됨") {
                leftSaved = true;
              } else if (leftSaved) {
                observer.disconnect();
                resolveNow(
                  performance.now() -
                    startedAt,
                );
              }
            };
            const observer =
              new MutationObserver(
                observeState,
              );
            observer.observe(saveState, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          },
        );
      Reflect.set(
        globalThis,
        key,
        measurement,
      );
    },
    { key: measurementKey },
  );
}

async function readDurableAckMeasurement(
  page: Page,
  measurementKey: string,
): Promise<number> {
  return page.evaluate(async (key) => {
    const measurement = Reflect.get(
      globalThis,
      key,
    );
    Reflect.deleteProperty(
      globalThis,
      key,
    );
    if (
      !(measurement instanceof Promise)
    ) {
      throw new Error(
        "Durable-ack measurement is unavailable",
      );
    }
    return (await measurement) as number;
  }, measurementKey);
}

async function rendererHeapUsedBytes(
  session: CDPSession,
): Promise<number> {
  const result = await session.send(
    "Performance.getMetrics",
  ) as {
    readonly metrics:
      readonly PerformanceMetric[];
  };
  return metricValue(
    result.metrics,
    "JSHeapUsedSize",
  );
}

async function mainRssBytes(
  electronApp: ElectronApplication,
): Promise<number> {
  return electronApp.evaluate(
    () => process.memoryUsage().rss,
  );
}

async function captureMemory(
  stage: string,
  electronApp: ElectronApplication,
  session: CDPSession,
): Promise<Poc2MemorySample> {
  return {
    stage,
    mainRssBytes:
      await mainRssBytes(electronApp),
    rendererHeapUsedBytes:
      await rendererHeapUsedBytes(
        session,
      ),
  };
}

async function collectRendererGc(
  stage: string,
  session: CDPSession,
): Promise<Poc2GcSample> {
  const rendererHeapBeforeBytes =
    await rendererHeapUsedBytes(session);
  await session.send(
    "HeapProfiler.collectGarbage",
  );
  const rendererHeapAfterBytes =
    await rendererHeapUsedBytes(session);
  return {
    stage,
    rendererHeapBeforeBytes,
    rendererHeapAfterBytes,
  };
}

async function pathExists(
  filePath: string,
): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException)
        .code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function removeVerifiedTemporaryDirectory(
  directory: string,
): Promise<void> {
  const root = resolve(tmpdir());
  const target = resolve(directory);
  if (
    target === root ||
    !target.startsWith(root)
  ) {
    throw new Error(
      "Refusing to remove a performance directory outside the OS temporary root",
    );
  }
  await rm(target, {
    recursive: true,
    force: true,
  });
}

async function runIndependentMeasurement(
  input: {
    readonly algorithm: string;
    readonly profile: ReturnType<
      typeof parsePoc2PerformanceProfile
    >;
    readonly ordinal: number;
  },
): Promise<{
  readonly run:
    Poc2PerformanceRunInput;
  readonly consoleErrors:
    readonly string[];
}> {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  const consoleErrors: string[] = [];
  try {
    const workId = randomUUID();
    const documentId = randomUUID();
    const baseRevisionId = randomUUID();
    const initialText = randomUUID();
    const nextSequence =
      randomInt(0, 10_000);
    const journalPath = join(
      directory,
      randomUUID(),
    );
    const documentProfile = {
      schemaVersion: 1,
      initialDocumentId: documentId,
      documents: [
        {
          workId,
          documentId,
          documentRevisionId:
            baseRevisionId,
          label: randomUUID(),
          initialText,
        },
      ],
    } as const;
    const journalProfile = {
      schemaVersion: 1,
      journalPath,
      checksumAlgorithm:
        input.algorithm,
      documentSequences: [
        {
          documentId,
          nextSequence,
        },
      ],
    } as const;
    const batchingProfile =
      input.profile.batching;
    const baseEnvironment = {
      ...inheritedEnvironment(),
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(
          documentProfile,
        ),
      EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
        JSON.stringify(journalProfile),
      EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
        JSON.stringify(
          batchingProfile,
        ),
      EUM_STUDIO_WINDOW_VISIBILITY:
        "hidden",
    };
    let expectedText = initialText;
    let durableReceiptCount = 0;
    const durableAckDurationsMs:
      number[] = [];
    const memorySamples:
      Poc2MemorySample[] = [];
    const gcSamples: Poc2GcSample[] =
      [];
    const electronApp =
      await electron.launch({
        args: ["."],
        cwd: process.cwd(),
        env: baseEnvironment,
      });
    try {
      const page =
        await electronApp.firstWindow();
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(
            message.text(),
          );
        }
      });
      const manuscript =
        page.getByRole("textbox", {
          name: "원고",
          exact: true,
        });
      const saveState =
        page.getByTestId("save-state");
      await expectPlaywright(
        saveState,
      ).toHaveText("저장됨");
      await manuscript.click();
      await manuscript.press("End");
      const session =
        await page
          .context()
          .newCDPSession(page);
      await session.send(
        "Performance.enable",
      );
      gcSamples.push(
        await collectRendererGc(
          `run-${input.ordinal}-before-warmup`,
          session,
        ),
      );
      memorySamples.push(
        await captureMemory(
          `run-${input.ordinal}-before-warmup`,
          electronApp,
          session,
        ),
      );
      const totalSampleCount =
        input.profile
          .warmupSampleCountPerRun +
        input.profile
          .measuredSampleCountPerRun;
      for (
        let index = 0;
        index < totalSampleCount;
        index += 1
      ) {
        const insertedText =
          nextInputCodeUnit();
        expectedText += insertedText;
        const measurementKey =
          randomUUID();
        await prepareDurableAckMeasurement(
          page,
          measurementKey,
        );
        await session.send(
          "Input.insertText",
          { text: insertedText },
        );
        await page.waitForFunction(
          (expectedLength) =>
            document
              .querySelector(
                '[role="textbox"][aria-label="원고"]',
              )
              ?.textContent?.length ===
            expectedLength,
          expectedText.length,
        );
        const duration =
          await readDurableAckMeasurement(
            page,
            measurementKey,
          );
        await expectPlaywright(saveState)
          .toHaveText("저장됨");
        durableReceiptCount += 1;
        if (
          index >=
          input.profile
            .warmupSampleCountPerRun
        ) {
          durableAckDurationsMs.push(
            duration,
          );
          memorySamples.push(
            await captureMemory(
              `run-${input.ordinal}-ack-${
                index -
                input.profile
                  .warmupSampleCountPerRun
              }`,
              electronApp,
              session,
            ),
          );
        }
      }
      gcSamples.push(
        await collectRendererGc(
          `run-${input.ordinal}-after-acks`,
          session,
        ),
      );
      memorySamples.push(
        await captureMemory(
          `run-${input.ordinal}-after-acks-gc`,
          electronApp,
          session,
        ),
      );
      await session.detach();
    } finally {
      await electronApp.close();
    }
    const checksumAdapter =
      createNodeCryptoJournalChecksumAdapter(
        input.algorithm,
      );
    const scan =
      await scanAppendOnlyJournal({
        journalPath,
        resolveChecksumAdapter: (
          adapterId,
        ) =>
          adapterId ===
          checksumAdapter.id
            ? checksumAdapter
            : null,
      });
    expect(scan.tail).toBeNull();
    const beforeCompactionBytes = (
      await stat(journalPath)
    ).size;
    const timestamp =
      new Date().toISOString();
    const compactionId =
      entityId<"JournalCompaction">(
        randomUUID(),
      );
    const revisionId =
      entityId<"DocumentRevision">(
        randomUUID(),
      );
    const contentPath = join(
      directory,
      randomUUID(),
    );
    const nextJournalPath = join(
      directory,
      randomUUID(),
    );
    const publicationTemporaryPath =
      join(directory, randomUUID());
    const publicationPath = join(
      directory,
      randomUUID(),
    );
    const applyProfile = {
      schemaVersion: 1,
      compactionId,
      expectedSourceJournalEndByteOffset:
        scan.verifiedPrefixByteLength,
      expectedSafeReplayThroughByteOffset:
        scan.verifiedPrefixByteLength,
      contentChecksumAlgorithm:
        input.algorithm,
      sourceJournalPath: journalPath,
      nextJournalPath,
      publicationTemporaryPath,
      publicationPath,
      revisions: [
        {
          workId,
          documentId,
          expectedBaseRevisionId:
            baseRevisionId,
          revisionId,
          cause: randomUUID(),
          createdAt: timestamp,
          durableAt: timestamp,
          contentPath,
        },
      ],
    } as const;
    const recoveryApp =
      await electron.launch({
        args: ["."],
        cwd: process.cwd(),
        env: {
          ...baseEnvironment,
          EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE:
            JSON.stringify(
              applyProfile,
            ),
        },
      });
    try {
      const page =
        await recoveryApp.firstWindow();
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(
            message.text(),
          );
        }
      });
      await expectPlaywright(
        page.getByRole("heading", {
          name: "복구 미리보기",
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "복구 적용",
        })
        .click();
      await expectPlaywright(
        page.getByTestId("save-state"),
      ).toHaveText("저장됨");
      await expectPlaywright(
        page.getByRole("textbox", {
          name: "원고",
          exact: true,
        }),
      ).toHaveText(expectedText);
      const session =
        await page
          .context()
          .newCDPSession(page);
      await session.send(
        "Performance.enable",
      );
      gcSamples.push(
        await collectRendererGc(
          `run-${input.ordinal}-after-compaction`,
          session,
        ),
      );
      memorySamples.push(
        await captureMemory(
          `run-${input.ordinal}-after-compaction-gc`,
          recoveryApp,
          session,
        ),
      );
      await session.detach();
    } finally {
      await recoveryApp.close();
    }
    const publication =
      await resolvePocJournalCompaction({
        storagePlan: {
          compactionId,
          sourceJournalPath:
            journalPath,
          nextJournalPath,
          publicationTemporaryPath,
          publicationPath,
          revisionFiles: [
            {
              revisionId,
              contentPath,
            },
          ],
        },
        checksumAdapter,
        resolveActiveJournalChecksumAdapter:
          (adapterId) =>
            adapterId ===
            checksumAdapter.id
              ? checksumAdapter
              : null,
      });
    const recoveredText =
      new TextDecoder(
        DURABLE_TEXT_REPRESENTATION_V1
          .hashAndAnchorInputEncoding,
      ).decode(await readFile(contentPath));
    return {
      run: {
        runId: randomUUID(),
        durableAckDurationsMs,
        memorySamples,
        gcSamples,
        journal: {
          beforeCompactionBytes,
          nextGenerationBytes: (
            await stat(nextJournalPath)
          ).size,
          publicationBytes: (
            await stat(publicationPath)
          ).size,
          publicationStatus:
            publication.status,
          sourceJournalReclaimed:
            !(await pathExists(
              journalPath,
            )),
        },
        correctness: {
          durableReceiptCount,
          scannedFrameCount:
            scan.records.length,
          expectedChecksum: digestText(
            input.algorithm,
            expectedText,
          ),
          recoveredChecksum: digestText(
            input.algorithm,
            recoveredText,
          ),
        },
      },
      consoleErrors,
    };
  } finally {
    await removeVerifiedTemporaryDirectory(
      directory,
    );
  }
}

describe.sequential(
  "POC-2 production-bundle performance",
  () => {
    it("records independent durable ack, journal compaction, RSS, renderer heap, GC, and raw samples", async () => {
      const profilePath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_2_PERFORMANCE_PROFILE_PATH",
        );
      const artifactPath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_2_PERFORMANCE_ARTIFACT_PATH",
        );
      const profileRaw = await readFile(
        profilePath,
        "utf8",
      );
      const profile =
        parsePoc2PerformanceProfile(
          JSON.parse(profileRaw),
        );
      const packageRaw = await readFile(
        resolve("package.json"),
        "utf8",
      );
      const lockRaw = await readFile(
        resolve("package-lock.json"),
        "utf8",
      );
      const discovery =
        await selectCommonHashAlgorithm();
      const measuredRuns: {
        readonly run:
          Poc2PerformanceRunInput;
        readonly consoleErrors:
          readonly string[];
      }[] = [];
      for (
        let ordinal = 0;
        ordinal <
        profile.independentRunCount;
        ordinal += 1
      ) {
        measuredRuns.push(
          await runIndependentMeasurement({
            algorithm:
              discovery.algorithm,
            profile,
            ordinal,
          }),
        );
      }
      const sourceProvenance =
        await captureGitSourceProvenance({
          cwd: process.cwd(),
          checksumAlgorithm:
            discovery.algorithm,
        });
      const report =
        createPoc2PerformanceReport({
          runId: randomUUID(),
          commitId:
            sourceProvenance.commit,
          sourceState:
            sourceProvenance.dirty
              ? "dirty"
              : "clean",
          sourceProvenance: {
            branch:
              sourceProvenance.branch,
            dirtyStatusChecksum:
              sourceProvenance
                .dirtyStatusChecksum,
            trackedDiffChecksum:
              sourceProvenance
                .trackedDiffChecksum,
            untrackedFileCount:
              sourceProvenance
                .untrackedFileCount,
            untrackedContentChecksum:
              sourceProvenance
                .untrackedContentChecksum,
            sourceFingerprint:
              sourceProvenance
                .sourceFingerprint,
          },
          capturedAt:
            new Date().toISOString(),
          electronVersion:
            discovery.electronVersion,
          checksumAlgorithm:
            discovery.algorithm,
          canonicalTextEncoding:
            DURABLE_TEXT_REPRESENTATION_V1
              .hashAndAnchorInputEncoding,
          environment:
            createEnvironment(
              packageRaw,
              lockRaw,
            ),
          performanceProfile: profile,
          performanceProfileChecksum:
            digestUtf8(
              discovery.algorithm,
              profileRaw,
            ),
          runs: measuredRuns.map(
            (measured) => measured.run,
          ),
          artifactRefs: [
            relative(
              process.cwd(),
              profilePath,
            ).replaceAll("\\", "/"),
            relative(
              process.cwd(),
              artifactPath,
            ).replaceAll("\\", "/"),
          ],
        });
      await mkdir(
        dirname(artifactPath),
        { recursive: true },
      );
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          report,
          null,
          2,
        )}\n`,
        "utf8",
      );

      expect(
        measuredRuns.flatMap(
          (measured) =>
            measured.consoleErrors,
        ),
      ).toEqual([]);
      expect(report.verdict).toBe(
        "pass",
      );
      process.stdout.write(
        `\nPOC-2 performance report: ${relative(
          process.cwd(),
          artifactPath,
        ).replaceAll("\\", "/")}\n`,
      );
    });
  },
);
