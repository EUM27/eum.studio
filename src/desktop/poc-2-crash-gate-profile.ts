import {
  open,
} from "node:fs/promises";

export const POC_2_CRASH_GATE_STAGES =
  Object.freeze([
    "save-target-validated",
    "before-journal-append",
    "journal-frame-written-before-sync",
  ] as const);

export type Poc2CrashGateStage =
  (typeof POC_2_CRASH_GATE_STAGES)[number];

export type Poc2CrashGateProfile = {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly targetStage: Poc2CrashGateStage;
  readonly reachedPath: string;
};

function readRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "POC-2 crash gate profile must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `POC-2 crash gate ${field} must be a non-empty string`,
    );
  }
  return value;
}

export function parsePoc2CrashGateProfile(
  value: unknown,
): Poc2CrashGateProfile {
  const input = readRecord(value);
  const fields = [
    "schemaVersion",
    "scenarioId",
    "targetStage",
    "reachedPath",
  ] as const;
  const allowedFields = new Set<string>(fields);
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw new Error(
        `Unsupported POC-2 crash gate profile field: ${field}`,
      );
    }
  }
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported POC-2 crash gate schema version: ${String(input.schemaVersion)}`,
    );
  }
  const scenarioId = readNonEmptyString(
    input.scenarioId,
    "scenarioId",
  );
  const targetStageValue = readNonEmptyString(
    input.targetStage,
    "targetStage",
  );
  if (
    !POC_2_CRASH_GATE_STAGES.some(
      (stage) => stage === targetStageValue,
    )
  ) {
    throw new Error(
      `Unsupported POC-2 crash gate target stage: ${targetStageValue}`,
    );
  }
  const reachedPath = readNonEmptyString(
    input.reachedPath,
    "reachedPath",
  );
  return Object.freeze({
    schemaVersion: 1,
    scenarioId,
    targetStage:
      targetStageValue as Poc2CrashGateStage,
    reachedPath,
  });
}

async function writeMarkerDurablyExclusive(
  profile: Poc2CrashGateProfile,
): Promise<void> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      "poc-2-crash-gate-reached",
      1,
      profile.scenarioId,
      profile.targetStage,
    ]),
  );
  const handle = await open(
    profile.reachedPath,
    "wx",
  );
  try {
    let byteOffset = 0;
    while (byteOffset < bytes.byteLength) {
      const { bytesWritten } = await handle.write(
        bytes,
        byteOffset,
        bytes.byteLength - byteOffset,
        null,
      );
      if (bytesWritten <= 0) {
        throw new Error(
          `POC-2 crash gate marker write made no progress: ${profile.reachedPath}`,
        );
      }
      byteOffset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export function createPoc2CrashGate(input: {
  readonly profile: Poc2CrashGateProfile;
  readonly enterPending: () => Promise<void>;
}): {
  reach(stage: Poc2CrashGateStage): Promise<void>;
} {
  return Object.freeze({
    async reach(stage: Poc2CrashGateStage) {
      if (stage !== input.profile.targetStage) {
        return;
      }
      await writeMarkerDurablyExclusive(
        input.profile,
      );
      await input.enterPending();
    },
  });
}
