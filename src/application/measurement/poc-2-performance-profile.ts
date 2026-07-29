import {
  parseManuscriptBatchingPolicy,
  type ManuscriptBatchingPolicy,
} from "../persistence/manuscript-persistence-profile";

export type Poc2PerformanceProfile = {
  readonly schemaVersion: 1;
  readonly independentRunCount: number;
  readonly warmupSampleCountPerRun: number;
  readonly measuredSampleCountPerRun: number;
  readonly maximumDurableAckP95Ms: number;
  readonly batching: ManuscriptBatchingPolicy;
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
      "POC-2 performance profile must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  input: Record<string, unknown>,
): void {
  const allowed = new Set([
    "schemaVersion",
    "independentRunCount",
    "warmupSampleCountPerRun",
    "measuredSampleCountPerRun",
    "maximumDurableAckP95Ms",
    "batching",
  ]);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported POC-2 performance profile field: ${field}`,
      );
    }
  }
}

function readSafeInteger(
  input: Record<string, unknown>,
  field: string,
  minimum: number,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(
      `${field} must be a safe integer greater than or equal to ${minimum}`,
    );
  }
  return value;
}

function readPositiveNumber(
  input: Record<string, unknown>,
  field: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${field} must be a positive finite number`,
    );
  }
  return value;
}

export function parsePoc2PerformanceProfile(
  value: unknown,
): Poc2PerformanceProfile {
  const input = readRecord(value);
  assertOnlyFields(input);
  if (input.schemaVersion !== 1) {
    throw new Error(
      "POC-2 performance profile schemaVersion must be 1",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    independentRunCount: readSafeInteger(
      input,
      "independentRunCount",
      2,
    ),
    warmupSampleCountPerRun:
      readSafeInteger(
        input,
        "warmupSampleCountPerRun",
        0,
      ),
    measuredSampleCountPerRun:
      readSafeInteger(
        input,
        "measuredSampleCountPerRun",
        1,
      ),
    maximumDurableAckP95Ms:
      readPositiveNumber(
        input,
        "maximumDurableAckP95Ms",
      ),
    batching:
      parseManuscriptBatchingPolicy(
        input.batching,
      ),
  });
}
