import {
  fork,
  execFileSync,
  type ChildProcess,
} from "node:child_process";
import {
  createHash,
  getHashes,
  randomInt,
  randomUUID,
} from "node:crypto";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  _electron as electron,
  type ElectronApplication,
} from "playwright";

import { parseManuscriptDocumentProfile } from "../../src/application/editor/manuscript-document-profile";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../../src/application/persistence/change-batch";
import {
  encodeCanonicalManuscriptVerificationBytes,
} from "../../src/application/persistence/compact-journal-into-revision";
import type { RevisionStore } from "../../src/application/revisions/revision-store";
import {
  entityId,
  type Anchor,
  type Document,
  type DocumentRevision,
  type ResumeCheckpoint,
  type Work,
} from "../../src/domain/writing";
import {
  createPoc2CrashWorkerCheckpointCodec,
  type Poc2CheckpointCrashWorkerProfile,
  type Poc2CompactionCrashWorkerProfile,
  type Poc2DurabilityCrashWorkerProfile,
} from "../../src/desktop/poc-2-durability-crash-worker";
import { parseManuscriptJournalRuntimeProfile } from "../../src/desktop/manuscript-journal-runtime-profile";
import {
  resolveManuscriptStartupRecovery,
  type ManuscriptStartupRecoveryResult,
} from "../../src/desktop/manuscript-startup-recovery";
import { parsePocRecoveryApplyRuntimeProfile } from "../../src/desktop/poc-recovery-apply-runtime-profile";
import {
  resolvePocResumeCheckpointPublication,
} from "../../src/platform/checkpoints/poc-resume-checkpoint-publication";
import {
  appendJournalPayloadDurably,
  scanAppendOnlyJournal,
} from "../../src/platform/journal/append-only-journal";
import {
  encodeJournalFrame,
} from "../../src/platform/journal/journal-frame";
import { createNodeCryptoJournalChecksumAdapter } from "../../src/platform/journal/node-crypto-journal-checksum";
import {
  resolvePocJournalCompaction,
} from "../../src/platform/persistence/poc-journal-compaction-port";
import {
  captureGitSourceProvenance,
} from "../evidence/git-source-provenance";

type SaveCrashDefinition = {
  readonly scenario:
    | "renderer-before-send"
    | "main-target-validated"
    | "before-journal-append"
    | "journal-frame-written-before-sync"
    | "durable-ack-observed";
  readonly crashGateStage:
    | "save-target-validated"
    | "before-journal-append"
    | "journal-frame-written-before-sync"
    | null;
};

const SAVE_CRASH_DEFINITIONS:
  readonly SaveCrashDefinition[] =
  Object.freeze([
    Object.freeze({
      scenario: "renderer-before-send",
      crashGateStage: null,
    }),
    Object.freeze({
      scenario: "main-target-validated",
      crashGateStage:
        "save-target-validated",
    }),
    Object.freeze({
      scenario: "before-journal-append",
      crashGateStage:
        "before-journal-append",
    }),
    Object.freeze({
      scenario:
        "journal-frame-written-before-sync",
      crashGateStage:
        "journal-frame-written-before-sync",
    }),
    Object.freeze({
      scenario: "durable-ack-observed",
      crashGateStage: null,
    }),
  ]);

const COMPACTION_CRASH_STAGES = Object.freeze([
  "publication-temp-synced",
  "publication-renamed",
] as const);

const CHECKPOINT_CRASH_STAGES = Object.freeze([
  "publication-temp-synced",
  "publication-renamed",
] as const);

const APPROVED_SCENARIO_COUNT =
  SAVE_CRASH_DEFINITIONS.length +
  COMPACTION_CRASH_STAGES.length +
  CHECKPOINT_CRASH_STAGES.length;

type ProcessKillEvidence = {
  readonly pid: number;
  readonly pidWasRunning: true;
  readonly killRequested: true;
  readonly exitObserved: true;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
};

type CrashScenarioEvidence = {
  readonly scenarioId: string;
  readonly category:
    | "save"
    | "compaction"
    | "checkpoint";
  readonly stage: string;
  readonly targetProcess:
    | "electron-main"
    | "node-worker";
  readonly manifestChecksum: string;
  readonly markerChecksum: string;
  readonly processKill: ProcessKillEvidence;
  readonly lastAcknowledgedSequence:
    number | null;
  readonly lastChecksumValidJournalSequence:
    number | null;
  readonly observedJournalSequences:
    readonly number[];
  readonly sourceChecksum: string;
  readonly recoverableChecksum: string;
  readonly displayedChecksum: string;
  readonly recoveryStatus: string;
  readonly classification: string;
  readonly issues:
    readonly {
      readonly source: string;
      readonly reason: string;
    }[];
  readonly workId: string;
  readonly documentId: string;
  readonly pointerBefore:
    string | null;
  readonly pointerAfter:
    string | null;
  readonly pass: true;
};

type JournalObservation = {
  readonly endByteOffset: number;
  readonly sequences: readonly number[];
  readonly tail:
    | null
    | {
        readonly byteOffset: number;
        readonly byteLength: number;
        readonly reason: string;
      };
};

const temporaryDirectories: string[] = [];
const scenarioEvidence:
  CrashScenarioEvidence[] = [];
let runtimeHashAlgorithm: string | null =
  null;

function requiredArtifactPath(): string {
  const artifactPath =
    process.env
      .EUM_STUDIO_POC_2_CRASH_ARTIFACT_PATH;
  if (
    artifactPath === undefined ||
    artifactPath.length === 0
  ) {
    throw new Error(
      "EUM_STUDIO_POC_2_CRASH_ARTIFACT_PATH is required",
    );
  }
  return artifactPath;
}

function selectedHashAlgorithm(): string {
  if (runtimeHashAlgorithm === null) {
    throw new Error(
      "Crash harness hash algorithm has not been selected",
    );
  }
  return runtimeHashAlgorithm;
}

function digestBytes(
  bytes: Uint8Array,
): string {
  return createHash(
    selectedHashAlgorithm(),
  )
    .update(bytes)
    .digest("hex");
}

function digestText(text: string): string {
  return digestBytes(
    encodeCanonicalManuscriptVerificationBytes(
      text,
    ),
  );
}

function digestManifest(value: unknown): string {
  return digestBytes(
    new TextEncoder().encode(
      JSON.stringify(value),
    ),
  );
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function removeVerifiedTemporaryDirectory(
  directory: string,
): Promise<void> {
  const temporaryRoot = resolve(tmpdir());
  const resolvedDirectory = resolve(directory);
  if (
    resolvedDirectory === temporaryRoot ||
    !resolvedDirectory.startsWith(
      temporaryRoot,
    )
  ) {
    throw new Error(
      "Refusing to remove a crash directory outside the OS temporary root",
    );
  }
  await rm(resolvedDirectory, {
    recursive: true,
    force: true,
  });
}

async function writeDurableParentMarker(
  markerPath: string,
  tuple: readonly unknown[],
): Promise<readonly unknown[]> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(tuple),
  );
  const handle = await open(markerPath, "wx");
  try {
    let byteOffset = 0;
    while (byteOffset < bytes.byteLength) {
      const { bytesWritten } =
        await handle.write(
          bytes,
          byteOffset,
          bytes.byteLength - byteOffset,
          null,
        );
      if (bytesWritten <= 0) {
        throw new Error(
          "Crash harness marker write made no progress",
        );
      }
      byteOffset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  return tuple;
}

async function waitForMarker(
  markerPath: string,
): Promise<readonly unknown[]> {
  for (;;) {
    try {
      const bytes = await readFile(markerPath);
      return JSON.parse(
        new TextDecoder("utf-8", {
          fatal: true,
        }).decode(bytes),
      ) as readonly unknown[];
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException)
          .code !== "ENOENT"
      ) {
        throw error;
      }
      await new Promise<void>((resolveNow) => {
        setImmediate(resolveNow);
      });
    }
  }
}

async function waitForWorkerMarker(
  markerPath: string,
  child: ChildProcess,
): Promise<readonly unknown[]> {
  const workerState: {
    failureName: string | null;
    completed: boolean;
  } = {
    failureName: null,
    completed: false,
  };
  const handleMessage = (value: unknown) => {
    if (
      typeof value !== "object" ||
      value === null
    ) {
      return;
    }
    const messageType = Reflect.get(
      value,
      "type",
    );
    if (
      messageType ===
      "poc-2-durability-crash-worker-failed"
    ) {
      const errorName = Reflect.get(
        value,
        "errorName",
      );
      workerState.failureName =
        typeof errorName === "string"
          ? errorName
          : "unknown";
    } else if (
      messageType ===
      "poc-2-durability-crash-worker-completed"
    ) {
      workerState.completed = true;
    }
  };
  child.on("message", handleMessage);
  try {
    for (;;) {
      if (workerState.failureName !== null) {
        throw new Error(
          `Crash worker failed before marker: ${workerState.failureName}`,
        );
      }
      if (workerState.completed) {
        throw new Error(
          "Crash worker completed before marker",
        );
      }
      if (
        child.exitCode !== null ||
        child.signalCode !== null
      ) {
        throw new Error(
          "Crash worker exited before marker",
        );
      }
      try {
        const bytes =
          await readFile(markerPath);
        return JSON.parse(
          new TextDecoder("utf-8", {
            fatal: true,
          }).decode(bytes),
        ) as readonly unknown[];
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException)
            .code !== "ENOENT"
        ) {
          throw error;
        }
        await new Promise<void>(
          (resolveNow) => {
            setImmediate(resolveNow);
          },
        );
      }
    }
  } finally {
    child.off("message", handleMessage);
  }
}

function verifyPidRunning(pid: number): true {
  process.kill(pid, 0);
  return true;
}

async function killElectronMain(
  electronApp: ElectronApplication,
  mainPid: number,
): Promise<ProcessKillEvidence> {
  if (process.platform !== "win32") {
    throw new Error(
      "POC-2 crash harness currently requires the approved Windows runtime",
    );
  }
  const child = electronApp.process();
  const wrapperExit =
    child.exitCode === null &&
    child.signalCode === null
      ? once(child, "exit")
      : Promise.resolve([
          child.exitCode,
          child.signalCode,
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
    child.exitCode === null &&
    child.signalCode === null
  ) {
    child.kill("SIGKILL");
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

async function killNodeWorker(
  child: ChildProcess,
): Promise<ProcessKillEvidence> {
  const pid = child.pid;
  if (pid === undefined) {
    throw new Error(
      "Crash worker has no PID",
    );
  }
  const pidWasRunning =
    verifyPidRunning(pid);
  const exited = once(child, "exit");
  const killRequested =
    child.kill("SIGKILL");
  if (!killRequested) {
    throw new Error(
      "Crash worker rejected SIGKILL",
    );
  }
  const [exitCode, signalCode] =
    await exited;
  return Object.freeze({
    pid,
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

function waitForWorkerReady(
  child: ChildProcess,
): Promise<void> {
  return new Promise((resolveNow, rejectNow) => {
    const handleMessage = (value: unknown) => {
      if (
        typeof value === "object" &&
        value !== null &&
        Reflect.get(value, "type") ===
          "poc-2-durability-crash-worker-ready"
      ) {
        cleanup();
        resolveNow();
      }
    };
    const handleExit = () => {
      cleanup();
      rejectNow(
        new Error(
          "Crash worker exited before ready",
        ),
      );
    };
    const cleanup = () => {
      child.off("message", handleMessage);
      child.off("exit", handleExit);
    };
    child.on("message", handleMessage);
    child.on("exit", handleExit);
  });
}

async function launchCrashWorker(
  profile: Poc2DurabilityCrashWorkerProfile,
): Promise<ChildProcess> {
  const workerPath = join(
    process.cwd(),
    "dist-electron",
    "desktop",
    "poc-2-durability-crash-worker.js",
  );
  const child = fork(workerPath, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_POC_2_DURABILITY_CRASH_WORKER:
        "1",
    },
    stdio: [
      "ignore",
      "ignore",
      "ignore",
      "ipc",
    ],
  });
  await waitForWorkerReady(child);
  child.send({
    type: "poc-2-durability-crash-worker-run",
    profile,
  });
  return child;
}

async function scanJournal(
  journalPath: string,
): Promise<JournalObservation> {
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      selectedHashAlgorithm(),
    );
  try {
    const scan = await scanAppendOnlyJournal({
      journalPath,
      resolveChecksumAdapter: (adapterId) =>
        adapterId === checksumAdapter.id
          ? checksumAdapter
          : null,
    });
    const sequences = scan.records.map(
      (record) =>
        parseCanonicalChangeBatch(
          record.payload,
        ).sequence,
    );
    return Object.freeze({
      endByteOffset:
        scan.tail === null
          ? scan.verifiedPrefixByteLength
          : scan.tail.byteOffset +
            scan.tail.bytes.byteLength,
      sequences: Object.freeze(sequences),
      tail:
        scan.tail === null
          ? null
          : Object.freeze({
              byteOffset:
                scan.tail.byteOffset,
              byteLength:
                scan.tail.bytes.byteLength,
              reason: scan.tail.reason,
            }),
    });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException)
        .code === "ENOENT"
    ) {
      return Object.freeze({
        endByteOffset: 0,
        sequences: Object.freeze([]),
        tail: null,
      });
    }
    throw error;
  }
}

function normalizedIssues(
  startup: ManuscriptStartupRecoveryResult,
): readonly {
  readonly source: string;
  readonly reason: string;
}[] {
  const issues =
    startup.status === "ready"
      ? startup.recovery.issues
      : startup.issues;
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        source: issue.source,
        reason: issue.reason,
      }),
    ),
  );
}

function startupStatus(
  startup: ManuscriptStartupRecoveryResult,
): string {
  return startup.status === "ready"
    ? `${startup.confirmedSource}:${startup.recovery.status}`
    : `${startup.confirmedSource}:${startup.status}`;
}

type SaveFixture = Awaited<
  ReturnType<typeof createSaveFixture>
>;

async function createSaveFixture(
  definition: SaveCrashDefinition,
) {
  const directory =
    await createTemporaryDirectory();
  const journalPath = join(
    directory,
    randomUUID(),
  );
  const workId = randomUUID();
  const documentId = randomUUID();
  const baseRevisionId = randomUUID();
  const initialText = randomUUID();
  const insertedText = randomUUID();
  const nextSequence =
    randomInt(0, 10_000);
  const timestamp = new Date().toISOString();
  const document = {
    workId,
    documentId,
    documentRevisionId:
      baseRevisionId,
    label: randomUUID(),
    initialText,
  };
  const batch = parseChangeBatch({
    schemaVersion: 1,
    textRepresentation:
      DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId,
    documentId,
    baseRevisionId,
    sequence: nextSequence,
    createdAt: timestamp,
    beforeTextLengthUtf16:
      initialText.length,
    afterTextLengthUtf16:
      initialText.length +
      insertedText.length,
    changes: [
      {
        fromUtf16: initialText.length,
        toUtf16: initialText.length,
        insertedText,
      },
    ],
  });
  const payload =
    serializeCanonicalChangeBatch(batch);
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      selectedHashAlgorithm(),
    );
  const frame = await encodeJournalFrame(
    payload,
    checksumAdapter,
  );
  const reachedPath = join(
    directory,
    randomUUID(),
  );
  const contentPath = join(
    directory,
    randomUUID(),
  );
  const documentProfile =
    parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId: documentId,
      documents: [document],
    });
  const journalProfile =
    parseManuscriptJournalRuntimeProfile({
      schemaVersion: 1,
      journalPath,
      checksumAlgorithm:
        selectedHashAlgorithm(),
      documentSequences: [
        {
          documentId,
          nextSequence,
        },
      ],
    });
  const batchingProfile = Object.freeze({
    schemaVersion: 1 as const,
    maxTransactionsPerBatch:
      insertedText.length +
      document.label.length,
    maxDelayMs:
      insertedText.length *
      documentId.length *
      workId.length,
  });
  const applyProfile =
    parsePocRecoveryApplyRuntimeProfile({
      schemaVersion: 1,
      compactionId: randomUUID(),
      expectedSourceJournalEndByteOffset:
        frame.byteLength,
      expectedSafeReplayThroughByteOffset:
        frame.byteLength,
      contentChecksumAlgorithm:
        selectedHashAlgorithm(),
      sourceJournalPath: journalPath,
      nextJournalPath: join(
        directory,
        randomUUID(),
      ),
      publicationTemporaryPath: join(
        directory,
        randomUUID(),
      ),
      publicationPath: join(
        directory,
        randomUUID(),
      ),
      revisions: [
        {
          workId,
          documentId,
          expectedBaseRevisionId:
            baseRevisionId,
          revisionId: randomUUID(),
          cause: randomUUID(),
          createdAt: timestamp,
          durableAt: timestamp,
          contentPath,
        },
      ],
    });
  const crashGateProfile =
    definition.crashGateStage === null
      ? null
      : Object.freeze({
          schemaVersion: 1 as const,
          scenarioId: randomUUID(),
          targetStage:
            definition.crashGateStage,
          reachedPath,
        });
  return Object.freeze({
    definition,
    directory,
    reachedPath,
    document,
    documentProfile,
    journalProfile,
    batchingProfile,
    applyProfile,
    crashGateProfile,
    batch,
    initialText,
    insertedText,
    recoveredText:
      initialText + insertedText,
    payload,
  });
}

function electronEnvironment(
  fixture: SaveFixture,
  includeCrashGate: boolean,
): Record<string, string> {
  const inheritedEnvironment:
    Record<string, string> = {};
  for (
    const [key, value] of Object.entries(
      process.env,
    )
  ) {
    if (value !== undefined) {
      inheritedEnvironment[key] = value;
    }
  }
  return {
    ...inheritedEnvironment,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
      JSON.stringify(
        fixture.documentProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_JOURNAL_PROFILE:
      JSON.stringify(
        fixture.journalProfile,
      ),
    EUM_STUDIO_MANUSCRIPT_BATCHING_PROFILE:
      JSON.stringify(
        fixture.batchingProfile,
      ),
    EUM_STUDIO_POC_RECOVERY_APPLY_PROFILE:
      JSON.stringify(
        fixture.applyProfile,
      ),
    ...(includeCrashGate &&
    fixture.crashGateProfile !== null
      ? {
          EUM_STUDIO_POC_2_CRASH_GATE_PROFILE:
            JSON.stringify(
              fixture.crashGateProfile,
            ),
        }
      : {}),
    EUM_STUDIO_WINDOW_VISIBILITY:
      "hidden",
  };
}

async function waitForSaveState(
  electronApp: ElectronApplication,
  expectedState: string,
): Promise<void> {
  const page =
    await electronApp.firstWindow();
  await page.waitForFunction(
    (state) =>
      document.querySelector(
        '[data-testid="save-state"]',
      )?.textContent === state,
    expectedState,
  );
}

async function editFixtureManuscript(
  electronApp: ElectronApplication,
  fixture: SaveFixture,
  blurAfterEdit: boolean,
): Promise<void> {
  const page =
    await electronApp.firstWindow();
  const manuscript = page.getByRole(
    "textbox",
    {
      name: "원고",
      exact: true,
    },
  );
  await manuscript.click();
  await manuscript.press("End");
  await manuscript.pressSequentially(
    fixture.insertedText,
  );
  await waitForSaveState(
    electronApp,
    "편집 중",
  );
  if (blurAfterEdit) {
    await page
      .getByRole("heading", {
        name: "이음 스튜디오",
      })
      .click();
  }
}

type StartupObservation = {
  readonly startup:
    ManuscriptStartupRecoveryResult;
  readonly displayedText: string;
  readonly previewText: string | null;
  readonly applied: boolean;
};

async function observeStartupInElectron(
  fixture: SaveFixture,
  applyPending: boolean,
): Promise<StartupObservation> {
  const startup =
    await resolveManuscriptStartupRecovery({
      baselineDocumentProfile:
        fixture.documentProfile,
      baselineJournalProfile:
        fixture.journalProfile,
      recoveryApplyProfile:
        fixture.applyProfile,
    });
  const electronApp = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: electronEnvironment(
      fixture,
      false,
    ),
  });
  try {
    const page =
      await electronApp.firstWindow();
    const manuscript = page.getByRole(
      "textbox",
      {
        name: "원고",
        exact: true,
      },
    );
    let previewText: string | null =
      null;
    let applied = false;
    if (
      startup.status === "ready" &&
      startup.recovery.status ===
        "recovery-pending"
    ) {
      await page
        .getByRole("heading", {
          name: "복구 미리보기",
        })
        .waitFor();
      previewText =
        await page
          .getByTestId(
            "recovery-preview",
          )
          .inputValue();
      expect(
        await manuscript.getAttribute(
          "aria-readonly",
        ),
      ).toBe("true");
      if (applyPending) {
        await page
          .getByRole("button", {
            name: "복구 적용",
          })
          .click();
        await page.waitForFunction(
          (expectedText) =>
            document.querySelector(
              '[aria-label="원고"]',
            )?.textContent ===
              expectedText,
          previewText,
        );
        expect(
          await manuscript.getAttribute(
            "contenteditable",
          ),
        ).toBe("true");
        applied = true;
      }
    } else if (
      startup.status ===
      "read-only-error"
    ) {
      await page
        .getByRole("heading", {
          name: "복구 확인 필요",
        })
        .waitFor();
      expect(
        await manuscript.getAttribute(
          "aria-readonly",
        ),
      ).toBe("true");
    } else {
      expect(
        await manuscript.getAttribute(
          "contenteditable",
        ),
      ).toBe("true");
    }
    return Object.freeze({
      startup,
      displayedText:
        (await manuscript.textContent()) ??
        "",
      previewText,
      applied,
    });
  } finally {
    await electronApp.close();
  }
}

function highestSequence(
  sequences: readonly number[],
): number | null {
  return sequences.length === 0
    ? null
    : (sequences[
        sequences.length - 1
      ] ?? null);
}

function saveClassification(
  startup: ManuscriptStartupRecoveryResult,
): string {
  if (startup.status === "read-only-error") {
    return "ack-before-change-isolated";
  }
  if (
    startup.recovery.status ===
    "recovery-pending"
  ) {
    return "ack-before-change-recoverable";
  }
  return "ack-before-change-unsaved";
}

async function runSaveCrashScenario(
  definition: SaveCrashDefinition,
): Promise<void> {
  const fixture =
    await createSaveFixture(definition);
  const electronApp =
    await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: electronEnvironment(
        fixture,
        true,
      ),
    });
  const mainPid = await electronApp.evaluate(
    () => process.pid,
  );
  let killed = false;
  let marker: readonly unknown[];
  let processKill: ProcessKillEvidence;
  try {
    await waitForSaveState(
      electronApp,
      "저장됨",
    );
    const blurAfterEdit =
      definition.scenario !==
      "renderer-before-send";
    await editFixtureManuscript(
      electronApp,
      fixture,
      blurAfterEdit,
    );
    if (
      definition.scenario ===
      "renderer-before-send"
    ) {
      marker =
        await writeDurableParentMarker(
          fixture.reachedPath,
          [
            "poc-2-crash-parent-observed",
            1,
            fixture.batch.batchId,
            definition.scenario,
            mainPid,
          ],
        );
    } else if (
      definition.scenario ===
      "durable-ack-observed"
    ) {
      await waitForSaveState(
        electronApp,
        "저장됨",
      );
      marker =
        await writeDurableParentMarker(
          fixture.reachedPath,
          [
            "poc-2-crash-parent-observed",
            1,
            fixture.batch.batchId,
            definition.scenario,
            mainPid,
          ],
        );
    } else {
      marker = await waitForMarker(
        fixture.reachedPath,
      );
      expect(marker).toEqual([
        "poc-2-crash-gate-reached",
        1,
        fixture.crashGateProfile
          ?.scenarioId,
        fixture.crashGateProfile
          ?.targetStage,
      ]);
    }
    processKill =
      await killElectronMain(
        electronApp,
        mainPid,
      );
    killed = true;
  } finally {
    if (!killed) {
      await electronApp
        .close()
        .catch(() => undefined);
    }
  }
  const journal = await scanJournal(
    fixture.journalProfile.journalPath,
  );
  const startup =
    await resolveManuscriptStartupRecovery({
      baselineDocumentProfile:
        fixture.documentProfile,
      baselineJournalProfile:
        fixture.journalProfile,
      recoveryApplyProfile:
        fixture.applyProfile,
    });
  const shouldApplyPending =
    definition.scenario ===
      "durable-ack-observed" ||
    (definition.scenario ===
      "journal-frame-written-before-sync" &&
      startup.status === "ready" &&
      startup.recovery.status ===
        "recovery-pending");
  const observation =
    await observeStartupInElectron(
      fixture,
      shouldApplyPending,
    );
  expect(
    startupStatus(observation.startup),
  ).toBe(startupStatus(startup));
  if (
    definition.scenario ===
    "durable-ack-observed"
  ) {
    expect(startup.status).toBe("ready");
    if (startup.status !== "ready") {
      throw new Error(
        "Durable ack restart was not ready",
      );
    }
    expect(startup.recovery.status).toBe(
      "recovery-pending",
    );
    expect(observation.applied).toBe(true);
    expect(observation.displayedText).toBe(
      fixture.recoveredText,
    );
  } else if (
    definition.scenario !==
    "journal-frame-written-before-sync"
  ) {
    expect(startup.status).toBe("ready");
    if (startup.status !== "ready") {
      throw new Error(
        "Pre-append restart was not ready",
      );
    }
    expect(startup.recovery.status).toBe(
      "clean",
    );
    expect(observation.displayedText).toBe(
      fixture.initialText,
    );
  }
  const recoverableText =
    startup.status === "ready" &&
    startup.recovery.status ===
      "recovery-pending"
      ? startup.recovery.candidate
          .affectedDocuments[0]
          ?.recoveredText ??
        fixture.initialText
      : fixture.initialText;
  const expectedDisplayedText =
    shouldApplyPending &&
    startup.status === "ready" &&
    startup.recovery.status ===
      "recovery-pending"
      ? recoverableText
      : fixture.initialText;
  expect(
    observation.displayedText,
  ).toBe(expectedDisplayedText);
  scenarioEvidence.push(
    Object.freeze({
      scenarioId:
        fixture.crashGateProfile
          ?.scenarioId ??
        fixture.batch.batchId,
      category: "save",
      stage: definition.scenario,
      targetProcess: "electron-main",
      manifestChecksum: digestManifest({
        documentProfile:
          fixture.documentProfile,
        journalProfile:
          fixture.journalProfile,
        batchingProfile:
          fixture.batchingProfile,
        applyProfile:
          fixture.applyProfile,
        crashGateProfile:
          fixture.crashGateProfile,
        batch: fixture.batch,
      }),
      markerChecksum:
        digestManifest(marker),
      processKill,
      lastAcknowledgedSequence:
        definition.scenario ===
        "durable-ack-observed"
          ? fixture.batch.sequence
          : null,
      lastChecksumValidJournalSequence:
        highestSequence(
          journal.sequences,
        ),
      observedJournalSequences:
        journal.sequences,
      sourceChecksum:
        digestText(fixture.initialText),
      recoverableChecksum:
        digestText(recoverableText),
      displayedChecksum:
        digestText(
          observation.displayedText,
        ),
      recoveryStatus:
        startupStatus(startup),
      classification:
        definition.scenario ===
        "durable-ack-observed"
          ? "durable-ack-recovered"
          : saveClassification(startup),
      issues: normalizedIssues(startup),
      workId:
        fixture.document.workId,
      documentId:
        fixture.document.documentId,
      pointerBefore: null,
      pointerAfter: null,
      pass: true,
    }),
  );
}

async function createCompactionFixture(
  targetStage:
    (typeof COMPACTION_CRASH_STAGES)[number],
) {
  const saveFixture =
    await createSaveFixture({
      scenario: "durable-ack-observed",
      crashGateStage: null,
    });
  const appendReceipt =
    await appendJournalPayloadDurably({
      journalPath:
        saveFixture.journalProfile
          .journalPath,
      payload: saveFixture.payload,
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          selectedHashAlgorithm(),
        ),
    });
  expect(
    appendReceipt.frameEndByteOffset,
  ).toBe(
    saveFixture.applyProfile
      .expectedSourceJournalEndByteOffset,
  );
  const revision =
    saveFixture.applyProfile.revisions[0];
  if (revision === undefined) {
    throw new Error(
      "Compaction fixture has no revision plan",
    );
  }
  const sourceDocument =
    saveFixture.documentProfile.documents[0];
  if (
    sourceDocument === undefined ||
    sourceDocument.documentRevisionId === null
  ) {
    throw new Error(
      "Compaction fixture has no durable source document",
    );
  }
  const reachedPath = join(
    saveFixture.directory,
    randomUUID(),
  );
  const profile:
    Poc2CompactionCrashWorkerProfile =
    Object.freeze({
      schemaVersion: 1,
      kind: "compaction",
      scenarioId: randomUUID(),
      targetStage,
      reachedPath,
      checksumAlgorithm:
        selectedHashAlgorithm(),
      storagePlan: Object.freeze({
        compactionId:
          saveFixture.applyProfile
            .compactionId,
        sourceJournalPath:
          saveFixture.applyProfile
            .sourceJournalPath,
        nextJournalPath:
          saveFixture.applyProfile
            .nextJournalPath,
        publicationTemporaryPath:
          saveFixture.applyProfile
            .publicationTemporaryPath,
        publicationPath:
          saveFixture.applyProfile
            .publicationPath,
        revisionFiles: Object.freeze([
          Object.freeze({
            revisionId:
              revision.revisionId,
            contentPath:
              revision.contentPath,
          }),
        ]),
      }),
      expectedJournalEndByteOffset:
        appendReceipt.frameEndByteOffset,
      target: Object.freeze({
        workId: sourceDocument.workId,
        documentId:
          sourceDocument.documentId,
        baseRevisionId:
          sourceDocument
            .documentRevisionId,
        nextSequence:
          saveFixture.batch.sequence,
        text: saveFixture.initialText,
      }),
      payloadBase64: Buffer.from(
        saveFixture.payload,
      ).toString("base64"),
      revisionPlan: Object.freeze({
        workId: revision.workId,
        documentId: revision.documentId,
        expectedBaseRevisionId:
          revision.expectedBaseRevisionId,
        revisionId: revision.revisionId,
        cause: revision.cause,
        createdAt: revision.createdAt,
        durableAt: revision.durableAt,
      }),
    });
  return Object.freeze({
    saveFixture,
    profile,
    reachedPath,
  });
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

async function runCompactionCrashScenario(
  targetStage:
    (typeof COMPACTION_CRASH_STAGES)[number],
): Promise<void> {
  const fixture =
    await createCompactionFixture(
      targetStage,
    );
  const child =
    await launchCrashWorker(
      fixture.profile,
    );
  let killed = false;
  let processKill: ProcessKillEvidence;
  try {
    const marker =
      await waitForWorkerMarker(
        fixture.reachedPath,
        child,
      );
    expect(marker).toEqual([
      "poc-2-durability-crash-worker-reached",
      1,
      fixture.profile.scenarioId,
      "compaction",
      targetStage,
    ]);
    processKill =
      await killNodeWorker(child);
    killed = true;
  } finally {
    if (!killed) {
      child.kill("SIGKILL");
    }
  }
  const marker = await waitForMarker(
    fixture.reachedPath,
  );
  const checksumAdapter =
    createNodeCryptoJournalChecksumAdapter(
      selectedHashAlgorithm(),
    );
  const publication =
    await resolvePocJournalCompaction({
      storagePlan:
        fixture.profile.storagePlan,
      checksumAdapter,
      resolveActiveJournalChecksumAdapter: (
        adapterId,
      ) =>
        adapterId === checksumAdapter.id
          ? checksumAdapter
          : null,
    });
  if (
    targetStage ===
    "publication-temp-synced"
  ) {
    expect(publication.status).toBe(
      "not-published",
    );
  } else {
    expect(publication.status).toBe(
      "published",
    );
  }
  expect(
    await pathExists(
      fixture.profile.storagePlan
        .sourceJournalPath,
    ),
  ).toBe(true);
  const startup =
    await resolveManuscriptStartupRecovery({
      baselineDocumentProfile:
        fixture.saveFixture
          .documentProfile,
      baselineJournalProfile:
        fixture.saveFixture
          .journalProfile,
      recoveryApplyProfile:
        fixture.saveFixture.applyProfile,
    });
  const observation =
    await observeStartupInElectron(
      fixture.saveFixture,
      false,
    );
  if (
    targetStage ===
    "publication-temp-synced"
  ) {
    expect(startup.status).toBe("ready");
    if (startup.status !== "ready") {
      throw new Error(
        "Pre-publication compaction restart was not ready",
      );
    }
    expect(startup.confirmedSource).toBe(
      "baseline",
    );
    expect(startup.recovery.status).toBe(
      "recovery-pending",
    );
    expect(observation.previewText).toBe(
      fixture.saveFixture.recoveredText,
    );
    expect(observation.displayedText).toBe(
      fixture.saveFixture.initialText,
    );
  } else {
    expect(startup.status).toBe("ready");
    if (startup.status !== "ready") {
      throw new Error(
        "Post-publication compaction restart was not ready",
      );
    }
    expect(startup.confirmedSource).toBe(
      "published",
    );
    expect(startup.recovery.status).toBe(
      "clean",
    );
    expect(observation.displayedText).toBe(
      fixture.saveFixture.recoveredText,
    );
  }
  const journal = await scanJournal(
    fixture.profile.storagePlan
      .sourceJournalPath,
  );
  scenarioEvidence.push(
    Object.freeze({
      scenarioId:
        fixture.profile.scenarioId,
      category: "compaction",
      stage: targetStage,
      targetProcess: "node-worker",
      manifestChecksum:
        digestManifest(fixture.profile),
      markerChecksum:
        digestManifest(marker),
      processKill,
      lastAcknowledgedSequence:
        fixture.saveFixture.batch
          .sequence,
      lastChecksumValidJournalSequence:
        highestSequence(
          journal.sequences,
        ),
      observedJournalSequences:
        journal.sequences,
      sourceChecksum: digestText(
        fixture.saveFixture.initialText,
      ),
      recoverableChecksum: digestText(
        fixture.saveFixture
          .recoveredText,
      ),
      displayedChecksum: digestText(
        observation.displayedText,
      ),
      recoveryStatus:
        startupStatus(startup),
      classification:
        targetStage ===
        "publication-temp-synced"
          ? "old-base-and-journal-recoverable"
          : "new-publication-recovered",
      issues: normalizedIssues(startup),
      workId:
        fixture.saveFixture.document
          .workId,
      documentId:
        fixture.saveFixture.document
          .documentId,
      pointerBefore: null,
      pointerAfter: null,
      pass: true,
    }),
  );
}

function createCheckpointRevisionStore(
  profile: Poc2CheckpointCrashWorkerProfile,
): RevisionStore {
  return {
    async append() {
      throw new Error(
        "Crash harness checkpoint scenario does not append revisions",
      );
    },
    async getCurrentRevision(documentId) {
      return documentId ===
        profile.document.meta.id
        ? profile.revision
        : null;
    },
    async getRevision(revisionId) {
      return revisionId === profile.revision.id
        ? profile.revision
        : null;
    },
    async materialize(revisionId) {
      if (revisionId !== profile.revision.id) {
        throw new Error(
          "Crash harness checkpoint revision identity conflict",
        );
      }
      return profile.revisionContent;
    },
  };
}

async function createCheckpointFixture(
  targetStage:
    (typeof CHECKPOINT_CRASH_STAGES)[number],
) {
  const directory =
    await createTemporaryDirectory();
  const timestamp = new Date().toISOString();
  const workId =
    entityId<"Work">(randomUUID());
  const documentId =
    entityId<"Document">(randomUUID());
  const revisionId =
    entityId<"DocumentRevision">(
      randomUUID(),
    );
  const revisionContent = randomUUID();
  const work: Work = Object.freeze({
    meta: Object.freeze({
      id: workId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    studioId:
      entityId<"Studio">(randomUUID()),
    title: randomUUID(),
    orderKey: randomUUID(),
    settingsId:
      entityId<"WorkSettings">(
        randomUUID(),
      ),
    customFields: Object.freeze({
      [randomUUID()]: randomUUID(),
    }),
  });
  const document: Document = Object.freeze({
    meta: Object.freeze({
      id: documentId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    workId,
    title: randomUUID(),
    orderKey: randomUUID(),
    manuscriptId:
      entityId<"Manuscript">(
        randomUUID(),
      ),
  });
  const revision: DocumentRevision =
    Object.freeze({
      id: revisionId,
      documentId,
      contentRef: randomUUID(),
      contentHash: randomUUID(),
      length: revisionContent.length,
      cause: randomUUID(),
      createdAt: timestamp,
      durableAt: timestamp,
    });
  const cursorAnchorId =
    entityId<"Anchor">(randomUUID());
  const cursorOffset = randomInt(
    0,
    revisionContent.length + 1,
  );
  const anchor: Anchor = Object.freeze({
    meta: Object.freeze({
      id: cursorAnchorId,
      schemaVersion: 1,
      revision: randomInt(0, 10_000),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    documentId,
    originRevisionId: revisionId,
    resolvedRevisionId: revisionId,
    startOffset: cursorOffset,
    endOffset: cursorOffset,
    exactQuote: "",
    prefixContext:
      revisionContent.slice(
        0,
        cursorOffset,
      ),
    suffixContext:
      revisionContent.slice(
        cursorOffset,
      ),
    quoteHash: randomUUID(),
    contextHash: randomUUID(),
    status: "resolved",
    resolutionEvidence: Object.freeze({
      targetRevisionId: revisionId,
      method: "created",
      matchedEvidence: Object.freeze([
        "origin-revision",
      ] as const),
      candidateOffsets: Object.freeze([
        cursorOffset,
      ]),
      policyVersion: randomUUID(),
      assessedAt: timestamp,
    }),
  });
  const checkpoint: ResumeCheckpoint =
    Object.freeze({
      meta: Object.freeze({
        id:
          entityId<"ResumeCheckpoint">(
            randomUUID(),
          ),
        schemaVersion: 1,
        revision: randomInt(0, 10_000),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      workId,
      documentId,
      documentRevisionId: revisionId,
      cursorAnchorId,
      workspaceMode: randomUUID(),
      contextRefs: Object.freeze([
        Object.freeze({
          entityType: randomUUID(),
          entityId: randomUUID(),
        }),
      ]),
      capturedAt: timestamp,
    });
  const profile:
    Poc2CheckpointCrashWorkerProfile =
    Object.freeze({
      schemaVersion: 1,
      kind: "checkpoint",
      scenarioId: randomUUID(),
      targetStage,
      reachedPath: join(
        directory,
        randomUUID(),
      ),
      checksumAlgorithm:
        selectedHashAlgorithm(),
      codecId: randomUUID(),
      storagePlan: Object.freeze({
        publicationId:
          entityId<"ResumeCheckpointPublication">(
            randomUUID(),
          ),
        publicationTemporaryPath: join(
          directory,
          randomUUID(),
        ),
        publicationPath: join(
          directory,
          randomUUID(),
        ),
      }),
      work,
      document,
      revision,
      revisionContent,
      baselineCheckpoints:
        Object.freeze([]),
      checkpoint,
      anchors: Object.freeze([anchor]),
      expectedWorkRevision:
        work.meta.revision,
      expectedResumeCheckpointId: null,
      expectedCurrentDocumentRevisionId:
        revisionId,
    });
  return Object.freeze({
    directory,
    profile,
  });
}

async function runCheckpointCrashScenario(
  targetStage:
    (typeof CHECKPOINT_CRASH_STAGES)[number],
): Promise<void> {
  const fixture =
    await createCheckpointFixture(
      targetStage,
    );
  const child =
    await launchCrashWorker(
      fixture.profile,
    );
  let killed = false;
  let processKill: ProcessKillEvidence;
  try {
    const marker = await waitForMarker(
      fixture.profile.reachedPath,
    );
    expect(marker).toEqual([
      "poc-2-durability-crash-worker-reached",
      1,
      fixture.profile.scenarioId,
      "checkpoint",
      targetStage,
    ]);
    processKill =
      await killNodeWorker(child);
    killed = true;
  } finally {
    if (!killed) {
      child.kill("SIGKILL");
    }
  }
  const marker = await waitForMarker(
    fixture.profile.reachedPath,
  );
  const recovery =
    await resolvePocResumeCheckpointPublication({
      works: [fixture.profile.work],
      checkpoints:
        fixture.profile
          .baselineCheckpoints,
      anchors: fixture.profile.anchors,
      revisionStore:
        createCheckpointRevisionStore(
          fixture.profile,
        ),
      storagePlan:
        fixture.profile.storagePlan,
      codec:
        createPoc2CrashWorkerCheckpointCodec(
          fixture.profile.codecId,
        ),
      checksumAdapter:
        createNodeCryptoJournalChecksumAdapter(
          fixture.profile
            .checksumAlgorithm,
        ),
    });
  const expectedPointer =
    targetStage ===
    "publication-temp-synced"
      ? null
      : fixture.profile.checkpoint.meta.id;
  if (
    targetStage ===
    "publication-temp-synced"
  ) {
    expect(recovery.status).toBe(
      "baseline",
    );
    expect(
      recovery.state.checkpoints,
    ).toEqual([]);
  } else {
    expect(recovery.status).toBe(
      "published",
    );
    expect(
      recovery.state.checkpoints,
    ).toContainEqual(
      fixture.profile.checkpoint,
    );
  }
  const recoveredPointer =
    recovery.state.works[0]
      ?.resumeCheckpointId ?? null;
  expect(recoveredPointer).toBe(
    expectedPointer,
  );
  scenarioEvidence.push(
    Object.freeze({
      scenarioId:
        fixture.profile.scenarioId,
      category: "checkpoint",
      stage: targetStage,
      targetProcess: "node-worker",
      manifestChecksum:
        digestManifest(fixture.profile),
      markerChecksum:
        digestManifest(marker),
      processKill,
      lastAcknowledgedSequence: null,
      lastChecksumValidJournalSequence:
        null,
      observedJournalSequences:
        Object.freeze([]),
      sourceChecksum: digestText(
        fixture.profile.revisionContent,
      ),
      recoverableChecksum: digestText(
        fixture.profile.revisionContent,
      ),
      displayedChecksum: digestText(
        fixture.profile.revisionContent,
      ),
      recoveryStatus: recovery.status,
      classification:
        targetStage ===
        "publication-temp-synced"
          ? "old-work-pointer-recovered"
          : "new-work-pointer-and-checkpoint-recovered",
      issues:
        recovery.status === "invalid"
          ? Object.freeze([
              Object.freeze({
                source:
                  "checkpoint-publication",
                reason: recovery.reason,
              }),
            ])
          : Object.freeze([]),
      workId:
        fixture.profile.work.meta.id,
      documentId:
        fixture.profile.document.meta.id,
      pointerBefore:
        fixture.profile
          .expectedResumeCheckpointId,
      pointerAfter: recoveredPointer,
      pass: true,
    }),
  );
}

beforeAll(async () => {
  requiredArtifactPath();
  const discoveryApp =
    await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: {
        ...process.env,
        EUM_STUDIO_WINDOW_VISIBILITY:
          "hidden",
      },
    });
  try {
    const electronAlgorithms =
      await discoveryApp.evaluate(() => {
        const crypto =
          process.getBuiltinModule(
            "node:crypto",
          );
        return crypto
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
    const compatibleAlgorithms =
      electronAlgorithms.filter(
        (algorithm) =>
          nodeAlgorithms.includes(
            algorithm,
          ),
      );
    const selected =
      compatibleAlgorithms[
        randomInt(
          0,
          compatibleAlgorithms.length,
        )
      ];
    if (selected === undefined) {
      throw new Error(
        "Crash harness found no common Node/Electron checksum algorithm",
      );
    }
    runtimeHashAlgorithm = selected;
  } finally {
    await discoveryApp.close();
  }
});

afterEach(async () => {
  const directories =
    temporaryDirectories.splice(0);
  for (const directory of directories) {
    await removeVerifiedTemporaryDirectory(
      directory,
    );
  }
});

afterAll(async () => {
  const artifactPath =
    requiredArtifactPath();
  const sourceProvenance =
    await captureGitSourceProvenance({
      cwd: process.cwd(),
      checksumAlgorithm:
        selectedHashAlgorithm(),
    });
  const electronPackage = JSON.parse(
    await readFile(
      join(
        process.cwd(),
        "node_modules",
        "electron",
        "package.json",
      ),
      "utf8",
    ),
  ) as { readonly version: string };
  const matrixManifest = Object.freeze({
    save: SAVE_CRASH_DEFINITIONS.map(
      (definition) =>
        definition.scenario,
    ),
    compaction:
      COMPACTION_CRASH_STAGES,
    checkpoint:
      CHECKPOINT_CRASH_STAGES,
    scenarioManifestChecksums:
      scenarioEvidence.map(
        (evidence) =>
          evidence.manifestChecksum,
      ),
  });
  const artifact = Object.freeze({
    schemaVersion: 1,
    generatedAt:
      new Date().toISOString(),
    provenance: Object.freeze({
      ...sourceProvenance,
      nodeVersion: process.version,
      electronVersion:
        electronPackage.version,
      platform: process.platform,
      architecture: process.arch,
      checksumAlgorithm:
        selectedHashAlgorithm(),
      canonicalTextEncoding:
        DURABLE_TEXT_REPRESENTATION_V1
          .hashAndAnchorInputEncoding,
      testTimeoutMs: Number(
        process.env
          .EUM_STUDIO_POC_2_CRASH_TEST_TIMEOUT_MS,
      ),
      matrixManifestChecksum:
        digestManifest(matrixManifest),
    }),
    summary: Object.freeze({
      approvedScenarioCount:
        APPROVED_SCENARIO_COUNT,
      passedScenarioCount:
        scenarioEvidence.length,
      failedScenarioCount:
        APPROVED_SCENARIO_COUNT -
        scenarioEvidence.length,
      allPassed:
        scenarioEvidence.length ===
          APPROVED_SCENARIO_COUNT &&
        scenarioEvidence.every(
          (evidence) => evidence.pass,
        ),
    }),
    scenarios: Object.freeze([
      ...scenarioEvidence,
    ]),
  });
  await mkdir(dirname(artifactPath), {
    recursive: true,
  });
  await writeFile(
    artifactPath,
    `${JSON.stringify(
      artifact,
      null,
      2,
    )}\n`,
    "utf8",
  );
});

describe.sequential(
  "POC-2 actual process-kill crash matrix",
  () => {
    it.each(SAVE_CRASH_DEFINITIONS)(
      "$scenario",
      async (definition) => {
        await runSaveCrashScenario(
          definition,
        );
      },
    );

    it.each(COMPACTION_CRASH_STAGES)(
      "compaction $stage",
      async (targetStage) => {
        await runCompactionCrashScenario(
          targetStage,
        );
      },
    );

    it.each(CHECKPOINT_CRASH_STAGES)(
      "checkpoint $stage",
      async (targetStage) => {
        await runCheckpointCrashScenario(
          targetStage,
        );
      },
    );
  },
);
