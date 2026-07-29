import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  execFileSync,
} from "node:child_process";
import {
  createReadStream,
} from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  once,
} from "node:events";
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
  CreateAnchor,
} from "../../src/application/anchors/create-anchor";
import {
  CaptureResumeCheckpoint,
} from "../../src/application/checkpoints/capture-resume-checkpoint";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseCanonicalChangeBatch,
} from "../../src/application/persistence/change-batch";
import {
  createWritingCatalog,
  entityId,
  type DocumentRevision,
  type ResumeCheckpoint,
  type Work,
} from "../../src/domain/writing";
import {
  scanAppendOnlyJournal,
} from "../../src/platform/journal/append-only-journal";
import {
  createNodeCryptoJournalChecksumAdapter,
} from "../../src/platform/journal/node-crypto-journal-checksum";
import {
  resolvePocJournalCompaction,
} from "../../src/platform/persistence/poc-journal-compaction-port";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../../src/platform/anchors/node-crypto-anchor-evidence";
import {
  createPocResumeCheckpointCaptureTransaction,
} from "../../src/platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createJsonPocResumeCheckpointPublicationCodec,
} from "../../src/platform/checkpoints/poc-resume-checkpoint-json-codec";
import {
  InMemoryRevisionStore,
} from "../../src/platform/revisions/in-memory-revision-store";
import {
  parsePoc2InstalledPackageProfile,
} from "./poc-2-installed-package-profile";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";
import {
  assembleInstalledPackage,
  createNodeInstalledPackageAssemblyOperations,
  removeVerifiedTemporaryPackageDirectory,
} from "./poc-2-installed-package-assembly";
import {
  InstalledPackageResourceSlot,
} from "./poc-2-installed-package-resource-slot";

type ProcessKillEvidence = {
  readonly pid: number;
  readonly pidWasRunning: true;
  readonly killRequested: true;
  readonly exitObserved: true;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
};

type TreeEvidence = {
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly manifestChecksum: string;
};

function requiredEnvironmentPath(
  name:
    | "EUM_STUDIO_POC_2_PACKAGE_PROFILE_PATH"
    | "EUM_STUDIO_POC_2_PACKAGE_ARTIFACT_PATH",
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

function digestBytes(
  algorithm: string,
  bytes: Uint8Array,
): string {
  return createHash(algorithm)
    .update(bytes)
    .digest("hex");
}

function digestUtf8(
  algorithm: string,
  value: string,
): string {
  return digestBytes(
    algorithm,
    new TextEncoder().encode(value),
  );
}

function digestText(
  algorithm: string,
  value: string,
): string {
  return digestBytes(
    algorithm,
    encodeCanonicalManuscriptVerificationBytes(
      value,
    ),
  );
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
  algorithm: string,
  root: string,
): Promise<TreeEvidence> {
  const records: [
    string,
    number,
    string,
  ][] = [];
  const visit = async (
    directory: string,
  ): Promise<void> => {
    const entries = (
      await readdir(directory, {
        withFileTypes: true,
      })
    ).sort((left, right) =>
      left.name.localeCompare(
        right.name,
      ),
    );
    for (const entry of entries) {
      const entryPath = join(
        directory,
        entry.name,
      );
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        const fileStat =
          await stat(entryPath);
        records.push([
          relative(root, entryPath)
            .replaceAll("\\", "/"),
          fileStat.size,
          await digestFile(
            algorithm,
            entryPath,
          ),
        ]);
      } else {
        throw new Error(
          "Installed-package tree contains an unsupported entry type",
        );
      }
    }
  };
  await visit(root);
  return Object.freeze({
    fileCount: records.length,
    totalBytes: records.reduce(
      (total, record) =>
        total + record[1],
      0,
    ),
    manifestChecksum: digestUtf8(
      algorithm,
      JSON.stringify(records),
    ),
  });
}

async function selectCommonHashAlgorithm(
  executablePath: string,
  userDataPath: string,
): Promise<{
  readonly algorithm: string;
  readonly electronVersion: string;
}> {
  const application =
    await electron.launch({
      executablePath,
      args: [
        `--user-data-dir=${userDataPath}`,
      ],
      env: {
        ...inheritedEnvironment(),
        EUM_STUDIO_WINDOW_VISIBILITY:
          "hidden",
      },
    });
  try {
    const discovery =
      await application.evaluate(() => {
        const crypto =
          process.getBuiltinModule(
            "node:crypto",
          );
        return Object.freeze({
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
        });
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
        "Installed package found no common Node/Electron checksum algorithm",
      );
    }
    if (
      discovery.electronVersion.length ===
      0
    ) {
      throw new Error(
        "Installed package did not expose an Electron version",
      );
    }
    return Object.freeze({
      algorithm,
      electronVersion:
        discovery.electronVersion,
    });
  } finally {
    await application.close();
  }
}

function verifyPidRunning(pid: number): true {
  process.kill(pid, 0);
  return true;
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

async function killElectronMain(
  application: ElectronApplication,
  mainPid: number,
): Promise<ProcessKillEvidence> {
  if (process.platform !== "win32") {
    throw new Error(
      "Installed-package crash harness requires the approved Windows runtime",
    );
  }
  const wrapper = application.process();
  const wrapperExit =
    wrapper.exitCode === null &&
    wrapper.signalCode === null
      ? once(wrapper, "exit")
      : Promise.resolve([
          wrapper.exitCode,
          wrapper.signalCode,
        ]);
  const pidWasRunning =
    verifyPidRunning(mainPid);
  execFileSync(
    "taskkill",
    [
      "/PID",
      String(mainPid),
      "/T",
      "/F",
    ],
    {
      windowsHide: true,
      stdio: "ignore",
    },
  );
  for (;;) {
    try {
      process.kill(mainPid, 0);
      await new Promise<void>(
        (resolveNow) => {
          setImmediate(resolveNow);
        },
      );
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException)
          .code === "ESRCH"
      ) {
        break;
      }
      throw error;
    }
  }
  if (
    wrapper.exitCode === null &&
    wrapper.signalCode === null
  ) {
    wrapper.kill("SIGKILL");
  }
  const [exitCode, signalCode] =
    await wrapperExit;
  return Object.freeze({
    pid: mainPid,
    pidWasRunning,
    killRequested: true,
    exitObserved: true,
    exitCode:
      typeof exitCode === "number"
        ? exitCode
        : null,
    signalCode:
      typeof signalCode === "string"
        ? signalCode
        : null,
  });
}

async function disposeInstalledPackageApplication(
  application: ElectronApplication,
): Promise<void> {
  const child = application.process();
  if (
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }
  const pid = child.pid;
  if (pid === undefined) {
    throw new Error(
      "Installed-package Electron process has no PID",
    );
  }
  const exited = once(child, "exit");
  if (process.platform === "win32") {
    try {
      execFileSync(
        "taskkill",
        [
          "/PID",
          String(pid),
          "/T",
          "/F",
        ],
        {
          windowsHide: true,
          stdio: "ignore",
        },
      );
    } catch (error) {
      if (
        child.exitCode === null &&
        child.signalCode === null
      ) {
        throw error;
      }
    }
  } else if (!child.kill("SIGKILL")) {
    throw new Error(
      "Installed-package Electron cleanup rejected SIGKILL",
    );
  }
  if (
    child.exitCode === null &&
    child.signalCode === null
  ) {
    await exited;
  }
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

async function expectExactEditorSelection(
  page: Page,
  selection: {
    readonly anchor: number;
    readonly head: number;
  },
): Promise<void> {
  const editor = page.locator(
    ".manuscript-editor",
  );
  await expectPlaywright(editor).toHaveAttribute(
    "data-selection-anchor",
    String(selection.anchor),
  );
  await expectPlaywright(editor).toHaveAttribute(
    "data-selection-head",
    String(selection.head),
  );
}

async function cleanupInstalledPackageHarnessResources(
  applicationSlot:
    InstalledPackageResourceSlot<
      ElectronApplication
    >,
  parentDirectory: string,
): Promise<void> {
  const cleanupErrors: unknown[] = [];
  try {
    await applicationSlot.cleanup(
      disposeInstalledPackageApplication,
    );
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await removeVerifiedTemporaryPackageDirectory(
      parentDirectory,
    );
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length === 1) {
    throw cleanupErrors[0];
  }
  if (cleanupErrors.length > 1) {
    throw new AggregateError(
      cleanupErrors,
      "Installed-package process and temporary directory cleanup both failed",
      { cause: cleanupErrors[0] },
    );
  }
}

describe.sequential(
  "POC-2 installed-package Electron",
  () => {
    it("durably saves, is force-killed, explicitly recovers, and restarts from the published revision", async () => {
      const profilePath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_2_PACKAGE_PROFILE_PATH",
        );
      const artifactPath =
        requiredEnvironmentPath(
          "EUM_STUDIO_POC_2_PACKAGE_ARTIFACT_PATH",
        );
      const profileRaw = await readFile(
        profilePath,
        "utf8",
      );
      const profile =
        parsePoc2InstalledPackageProfile(
          JSON.parse(profileRaw),
        );
      const installed =
        await assembleInstalledPackage(
          profile,
          createNodeInstalledPackageAssemblyOperations(),
        );
      const applicationSlot =
        new InstalledPackageResourceSlot<
          ElectronApplication
        >();
      try {
        const discovery =
          await selectCommonHashAlgorithm(
            installed.executablePath,
            join(
              installed.parentDirectory,
              randomUUID(),
            ),
          );
        const algorithm =
          discovery.algorithm;
        const packageTree =
          await collectTreeEvidence(
            algorithm,
            installed.packageRoot,
          );
        const applicationTree =
          await collectTreeEvidence(
            algorithm,
            installed.applicationRoot,
          );
        const workId = randomUUID();
        const documentId =
          randomUUID();
        const baseRevisionId =
          randomUUID();
        const initialText =
          randomUUID();
        const insertedText =
          randomUUID();
        const recoveredText =
          initialText + insertedText;
        const nextSequence =
          randomInt(0, 10_000);
        const journalPath = join(
          installed.parentDirectory,
          randomUUID(),
        );
        const documentProfile = {
          schemaVersion: 1,
          initialDocumentId:
            documentId,
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
            algorithm,
          documentSequences: [
            {
              documentId,
              nextSequence,
            },
          ],
        } as const;
        const baseEnvironment = {
          ...inheritedEnvironment(),
          EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
            JSON.stringify(
              documentProfile,
            ),
          EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
            JSON.stringify(
              journalProfile,
            ),
          EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
            JSON.stringify(
              profile.batching,
            ),
          EUM_STUDIO_WINDOW_VISIBILITY:
            "hidden",
        };
        const packageUserDataPath = join(
          installed.parentDirectory,
          randomUUID(),
        );
        let application =
          await electron.launch({
            executablePath:
              installed.executablePath,
            args: [
              `--user-data-dir=${packageUserDataPath}`,
            ],
            env: baseEnvironment,
          });
        applicationSlot.track(
          application,
        );
        const firstPage =
          await application.firstWindow();
        const consoleErrors: string[] =
          [];
        firstPage.on(
          "console",
          (message) => {
            if (
              message.type() === "error"
            ) {
              consoleErrors.push(
                message.text(),
              );
            }
          },
        );
        const manuscript =
          firstPage.getByRole(
            "textbox",
            {
              name: "원고",
              exact: true,
            },
          );
        await expectPlaywright(
          firstPage.getByTestId(
            "save-state",
          ),
        ).toHaveText("저장됨");
        await manuscript.click();
        await manuscript.press("End");
        const inputSession =
          await firstPage
            .context()
            .newCDPSession(firstPage);
        const ackMeasurementKey =
          randomUUID();
        await prepareDurableAckMeasurement(
          firstPage,
          ackMeasurementKey,
        );
        await inputSession.send(
          "Input.insertText",
          { text: insertedText },
        );
        await expectPlaywright(
          manuscript,
        ).toHaveText(recoveredText);
        const durableAckObservedMs =
          await readDurableAckMeasurement(
            firstPage,
            ackMeasurementKey,
          );
        await expectPlaywright(
          firstPage.getByTestId(
            "save-state",
          ),
        ).toHaveText("저장됨");
        await inputSession.detach();
        const firstMainPid =
          await application.evaluate(
            () => process.pid,
          );
        const durableKill =
          await killElectronMain(
            application,
            firstMainPid,
          );
        applicationSlot.release(
          application,
        );
        const checksumAdapter =
          createNodeCryptoJournalChecksumAdapter(
            algorithm,
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
        expect(scan.records).toHaveLength(
          1,
        );
        const durableSequences =
          scan.records.map(
            (record) =>
              parseCanonicalChangeBatch(
                record.payload,
              ).sequence,
          );
        expect(durableSequences).toEqual([
          nextSequence,
        ]);
        const compactionId =
          entityId<"JournalCompaction">(
            randomUUID(),
          );
        const revisionId =
          entityId<"DocumentRevision">(
            randomUUID(),
          );
        const timestamp =
          new Date().toISOString();
        const contentPath = join(
          installed.parentDirectory,
          randomUUID(),
        );
        const nextJournalPath = join(
          installed.parentDirectory,
          randomUUID(),
        );
        const publicationTemporaryPath =
          join(
            installed.parentDirectory,
            randomUUID(),
          );
        const publicationPath = join(
          installed.parentDirectory,
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
            algorithm,
          sourceJournalPath:
            journalPath,
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
        const domainWorkId =
          entityId<"Work">(workId);
        const domainDocumentId =
          entityId<"Document">(
            documentId,
          );
        const domainBaseRevisionId =
          entityId<"DocumentRevision">(
            baseRevisionId,
          );
        const work: Work = {
          meta: {
            id: domainWorkId,
            schemaVersion:
              randomInt(1, 32),
            revision:
              randomInt(0, 32),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          studioId:
            entityId<"Studio">(
              randomUUID(),
            ),
          title: randomUUID(),
          orderKey: randomUUID(),
          settingsId:
            entityId<"WorkSettings">(
              randomUUID(),
            ),
        };
        const domainDocument = {
          meta: {
            id: domainDocumentId,
            schemaVersion:
              randomInt(1, 32),
            revision:
              randomInt(0, 32),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          workId: domainWorkId,
          title: randomUUID(),
          orderKey: randomUUID(),
          manuscriptId:
            entityId<"Manuscript">(
              randomUUID(),
            ),
        };
        const catalog =
          createWritingCatalog({
            works: [work],
            documents: [
              domainDocument,
            ],
          });
        const checkpointRevisionStore =
          new InMemoryRevisionStore({
            catalog,
            describeContent: (
              content,
            ) => ({
              contentRef:
                randomUUID(),
              contentHash:
                digestText(
                  algorithm,
                  content,
                ),
              length: content.length,
            }),
          });
        const baseRevision =
          await checkpointRevisionStore.append({
            revisionId:
              domainBaseRevisionId,
            workId: domainWorkId,
            documentId:
              domainDocumentId,
            expectedCurrentRevisionId:
              null,
            content: initialText,
            cause: randomUUID(),
            createdAt: timestamp,
            durableAt: timestamp,
          });
        const cursorOffset =
          randomInt(
            0,
            initialText.length + 1,
          );
        const anchorEvidenceChecksumAlgorithm =
          algorithm;
        const anchorPolicy = {
          schemaVersion: 1 as const,
          version: randomUUID(),
          contextOffsetLength:
            initialText.length,
        };
        const cursorAnchor =
          await new CreateAnchor({
            catalog,
            revisionStore:
              checkpointRevisionStore,
            describeEvidence:
              createNodeCryptoAnchorEvidenceDescriptor(
                anchorEvidenceChecksumAlgorithm,
              ),
          }).execute({
            meta: {
              id:
                entityId<"Anchor">(
                  randomUUID(),
                ),
              schemaVersion:
                randomInt(1, 32),
              revision:
                randomInt(0, 32),
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            workId: domainWorkId,
            documentId:
              domainDocumentId,
            documentRevisionId:
              domainBaseRevisionId,
            startOffset:
              cursorOffset,
            endOffset:
              cursorOffset,
            policy: anchorPolicy,
            commandRef: randomUUID(),
            actorRef: randomUUID(),
          });
        const checkpoint:
          ResumeCheckpoint = {
          meta: {
            id:
              entityId<"ResumeCheckpoint">(
                randomUUID(),
              ),
            schemaVersion:
              randomInt(1, 32),
            revision:
              randomInt(0, 32),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          workId: domainWorkId,
          documentId:
            domainDocumentId,
          documentRevisionId:
            domainBaseRevisionId,
          cursorAnchorId:
            cursorAnchor.meta.id,
          workspaceMode:
            randomUUID(),
          capturedAt: timestamp,
        };
        const checkpointCodecId =
          randomUUID();
        const checkpointStoragePlan = {
          publicationId:
            entityId<"ResumeCheckpointPublication">(
              randomUUID(),
            ),
          publicationTemporaryPath:
            join(
              installed.parentDirectory,
              randomUUID(),
            ),
          publicationPath:
            join(
              installed.parentDirectory,
              randomUUID(),
            ),
        };
        const checkpointTransaction =
          createPocResumeCheckpointCaptureTransaction({
            works: [work],
            checkpoints: [],
            anchors: [
              cursorAnchor,
            ],
            revisionStore:
              checkpointRevisionStore,
            storagePlan:
              checkpointStoragePlan,
            codec:
              createJsonPocResumeCheckpointPublicationCodec(
                checkpointCodecId,
              ),
            checksumAdapter,
          });
        await new CaptureResumeCheckpoint({
          catalog,
          revisionStore:
            checkpointRevisionStore,
          transaction:
            checkpointTransaction,
        }).execute({
          checkpoint,
          expectedWorkRevision:
            work.meta.revision,
          expectedResumeCheckpointId:
            null,
          expectedCurrentDocumentRevisionId:
            baseRevision.id,
        });
        const publishedRevision:
          DocumentRevision = {
          id: revisionId,
          documentId:
            domainDocumentId,
          parentRevisionId:
            domainBaseRevisionId,
          contentRef: contentPath,
          contentHash: digestText(
            algorithm,
            recoveredText,
          ),
          length:
            recoveredText.length,
          cause:
            applyProfile.revisions[0]
              .cause,
          createdAt: timestamp,
          durableAt: timestamp,
        };
        const resumeCheckpointProfile = {
          schemaVersion: 1,
          codecId:
            checkpointCodecId,
          publicationChecksumAlgorithm:
            algorithm,
          anchorEvidenceChecksumAlgorithm,
          storagePlan:
            checkpointStoragePlan,
          works: [work],
          documents: [
            domainDocument,
          ],
          revisions: [
            {
              revision:
                baseRevision,
              content: initialText,
            },
            {
              revision:
                publishedRevision,
              content:
                recoveredText,
            },
          ],
          publicationRevisionHeads: [
            {
              documentId:
                domainDocumentId,
              revisionId:
                domainBaseRevisionId,
            },
          ],
          baselineCheckpoints: [],
          anchors: [
            cursorAnchor,
          ],
        } as const;
        const recoveryEnvironment = {
          ...baseEnvironment,
          EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE:
            JSON.stringify(
              applyProfile,
            ),
          EUM_STUDIO_POC_RESUME_CHECKPOINT_PROFILE:
            JSON.stringify(
              resumeCheckpointProfile,
            ),
        };
        application =
          await electron.launch({
            executablePath:
              installed.executablePath,
            args: [
              `--user-data-dir=${packageUserDataPath}`,
            ],
            env: recoveryEnvironment,
          });
        applicationSlot.track(
          application,
        );
        const recoveryPage =
          await application.firstWindow();
        recoveryPage.on(
          "console",
          (message) => {
            if (
              message.type() === "error"
            ) {
              consoleErrors.push(
                message.text(),
              );
            }
          },
        );
        await expectPlaywright(
          recoveryPage.getByRole(
            "heading",
            {
              name: "복구 미리보기",
            },
          ),
        ).toBeVisible();
        await expectPlaywright(
          recoveryPage.getByTestId(
            "recovery-preview",
          ),
        ).toHaveValue(recoveredText);
        await expectExactEditorSelection(
          recoveryPage,
          {
            anchor: cursorOffset,
            head: cursorOffset,
          },
        );
        await recoveryPage
          .getByRole("button", {
            name: "복구 적용",
          })
          .click();
        await expectPlaywright(
          recoveryPage.getByTestId(
            "save-state",
          ),
        ).toHaveText("저장됨");
        await expectPlaywright(
          recoveryPage.getByRole(
            "textbox",
            {
              name: "원고",
              exact: true,
            },
          ),
        ).toHaveText(recoveredText);
        await expectExactEditorSelection(
          recoveryPage,
          {
            anchor: cursorOffset,
            head: cursorOffset,
          },
        );
        const applyMainPid =
          await application.evaluate(
            () => process.pid,
          );
        const publicationKill =
          await killElectronMain(
            application,
            applyMainPid,
          );
        applicationSlot.release(
          application,
        );
        application =
          await electron.launch({
            executablePath:
              installed.executablePath,
            args: [
              `--user-data-dir=${packageUserDataPath}`,
            ],
            env: recoveryEnvironment,
          });
        applicationSlot.track(
          application,
        );
        try {
          const restartedPage =
            await application.firstWindow();
          restartedPage.on(
            "console",
            (message) => {
              if (
                message.type() ===
                "error"
              ) {
                consoleErrors.push(
                  message.text(),
                );
              }
            },
          );
          await expectPlaywright(
            restartedPage.getByRole(
              "heading",
              {
                name: "복구 미리보기",
              },
            ),
          ).toHaveCount(0);
          const restartedManuscript =
            restartedPage.getByRole(
              "textbox",
              {
                name: "원고",
                exact: true,
              },
            );
          await expectPlaywright(
            restartedManuscript,
          ).toHaveText(recoveredText);
          await expectPlaywright(
            restartedManuscript,
          ).toHaveAttribute(
            "contenteditable",
            "true",
          );
          await expectPlaywright(
            restartedPage.getByTestId(
              "save-state",
            ),
          ).toHaveText("저장됨");
          await expectExactEditorSelection(
            restartedPage,
            {
              anchor:
                cursorOffset,
              head: cursorOffset,
            },
          );
        } finally {
          await application.close();
          applicationSlot.release(
            application,
          );
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
        const recoveredRevisionText =
          new TextDecoder(
            DURABLE_TEXT_REPRESENTATION_V1
              .hashAndAnchorInputEncoding,
          ).decode(
            await readFile(contentPath),
          );
        const sourceReclaimed =
          !(await pathExists(journalPath));
        const nextJournalBytes = (
          await stat(nextJournalPath)
        ).size;
        expect(publication.status).toBe(
          "published",
        );
        expect(sourceReclaimed).toBe(true);
        expect(nextJournalBytes).toBe(0);
        expect(
          recoveredRevisionText,
        ).toBe(recoveredText);
        expect(consoleErrors).toEqual([]);
        const sourceProvenance =
          await captureGitSourceProvenance({
            cwd: process.cwd(),
            checksumAlgorithm:
              algorithm,
          });
        const artifact = Object.freeze({
          schemaVersion: 1,
          generatedAt:
            new Date().toISOString(),
          provenance: Object.freeze({
            ...sourceProvenance,
            nodeVersion:
              process.version,
            electronVersion:
              discovery.electronVersion,
            platform: process.platform,
            architecture:
              process.arch,
            checksumAlgorithm:
              algorithm,
            canonicalTextEncoding:
              DURABLE_TEXT_REPRESENTATION_V1
                .hashAndAnchorInputEncoding,
            packageProfileRef:
              relative(
                process.cwd(),
                profilePath,
              ).replaceAll("\\", "/"),
            packageProfileChecksum:
              digestUtf8(
                algorithm,
                profileRaw,
              ),
          }),
          package: Object.freeze({
            mode: "electron-prebuilt-resources-app-poc",
            location:
              "os-temporary-directory",
            finalPackagingConfigurationSelected:
              false,
            tree: packageTree,
            applicationTree,
            executableChecksum:
              await digestFile(
                algorithm,
                installed.executablePath,
              ),
            applicationManifestChecksum:
              await digestFile(
                algorithm,
                installed.applicationManifestPath,
              ),
          }),
          scenario: Object.freeze({
            stage:
              "installed-package-durable-ack-force-kill-recovery",
            durableAckObservedMs,
            durableKill,
            publicationKill,
            lastDurableSequence:
              nextSequence,
            observedJournalSequences:
              Object.freeze(
                durableSequences,
              ),
            sourceChecksum:
              digestText(
                algorithm,
                initialText,
              ),
            recoverableChecksum:
              digestText(
                algorithm,
                recoveredText,
              ),
            recoveredRevisionChecksum:
              digestText(
                algorithm,
                recoveredRevisionText,
              ),
            recoveredCursorOffset:
              cursorOffset,
            checkpointPublicationId:
              checkpointStoragePlan
                .publicationId,
            publicationStatus:
              publication.status,
            sourceJournalReclaimed:
              sourceReclaimed,
            nextJournalBytes,
            classification:
              "durable-ack-recovered-and-published",
            pass: true,
          }),
          summary: Object.freeze({
            passedScenarioCount: 1,
            failedScenarioCount: 0,
            allPassed: true,
          }),
        });
        await mkdir(
          dirname(artifactPath),
          { recursive: true },
        );
        await writeFile(
          artifactPath,
          `${JSON.stringify(
            artifact,
            null,
            2,
          )}\n`,
          "utf8",
        );
        expect(
          artifact.summary.allPassed,
        ).toBe(true);
      } finally {
        await cleanupInstalledPackageHarnessResources(
          applicationSlot,
          installed.parentDirectory,
        );
      }
    });
  },
);
