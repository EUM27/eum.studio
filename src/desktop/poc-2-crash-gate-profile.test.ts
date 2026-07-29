import {
  randomInt,
  randomUUID,
} from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createPoc2CrashGate,
  parsePoc2CrashGateProfile,
  POC_2_CRASH_GATE_STAGES,
  type Poc2CrashGateStage,
} from "./poc-2-crash-gate-profile";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), randomUUID()),
  );
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  const temporaryRoot = resolve(tmpdir());
  for (const directory of temporaryDirectories.splice(0)) {
    const resolvedDirectory = resolve(directory);
    if (
      resolvedDirectory === temporaryRoot ||
      !resolvedDirectory.startsWith(temporaryRoot)
    ) {
      throw new Error(
        "Refusing to remove a test directory outside the OS temporary root",
      );
    }
    await rm(resolvedDirectory, {
      recursive: true,
      force: true,
    });
  }
});

function selectStage(): Poc2CrashGateStage {
  const stage =
    POC_2_CRASH_GATE_STAGES[
      randomInt(0, POC_2_CRASH_GATE_STAGES.length)
    ];
  if (stage === undefined) {
    throw new Error("Crash gate stage catalog is empty");
  }
  return stage;
}

describe("POC-2 crash gate profile", () => {
  it("strictly parses caller scenario, target stage, and reached path without defaults", async () => {
    const directory = await createTemporaryDirectory();
    const input = {
      schemaVersion: 1,
      scenarioId: randomUUID(),
      targetStage: selectStage(),
      reachedPath: join(directory, randomUUID()),
    };

    const profile = parsePoc2CrashGateProfile(input);

    expect(profile).toEqual(input);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(() =>
      parsePoc2CrashGateProfile({
        ...input,
        [randomUUID()]: randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      parsePoc2CrashGateProfile({
        ...input,
        targetStage: randomUUID(),
      }),
    ).toThrow();
    expect(() =>
      parsePoc2CrashGateProfile({
        ...input,
        reachedPath: "",
      }),
    ).toThrow();
  });

  it("writes and syncs the exact reached marker before entering the caller pending gate", async () => {
    const directory = await createTemporaryDirectory();
    const profile = parsePoc2CrashGateProfile({
      schemaVersion: 1,
      scenarioId: randomUUID(),
      targetStage: selectStage(),
      reachedPath: join(directory, randomUUID()),
    });
    let releasePending:
      (() => void) | undefined;
    let reportPending:
      (() => void) | undefined;
    const pendingEntered = new Promise<void>(
      (resolvePendingEntered) => {
        reportPending = resolvePendingEntered;
      },
    );
    const pending = new Promise<void>((resolvePending) => {
      releasePending = resolvePending;
    });
    const gate = createPoc2CrashGate({
      profile,
      enterPending: async () => {
        reportPending?.();
        await pending;
      },
    });

    const reached = gate.reach(profile.targetStage);
    await pendingEntered;
    const marker = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(await readFile(profile.reachedPath)),
    );
    expect(marker).toEqual([
      "poc-2-crash-gate-reached",
      1,
      profile.scenarioId,
      profile.targetStage,
    ]);
    releasePending?.();
    await reached;
  });

  it("does not create a marker or enter pending for a different stage", async () => {
    const directory = await createTemporaryDirectory();
    const targetStage = selectStage();
    const otherStage =
      POC_2_CRASH_GATE_STAGES.find(
        (stage) => stage !== targetStage,
      );
    if (otherStage === undefined) {
      throw new Error(
        "Crash gate requires more than one stage",
      );
    }
    const profile = parsePoc2CrashGateProfile({
      schemaVersion: 1,
      scenarioId: randomUUID(),
      targetStage,
      reachedPath: join(directory, randomUUID()),
    });
    let pendingEntered = false;
    const gate = createPoc2CrashGate({
      profile,
      enterPending: async () => {
        pendingEntered = true;
      },
    });

    await gate.reach(otherStage);

    expect(pendingEntered).toBe(false);
    const presence = await stat(
      profile.reachedPath,
    ).then(
      () => "present",
      (error: NodeJS.ErrnoException) => error.code,
    );
    expect(presence).toBe("ENOENT");
  });
});
