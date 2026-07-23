export type Poc1PerformanceScenarioKind =
  | "document-switch"
  | "work-search"
  | "input";

export type Poc1PerformanceScenarioProfile = {
  readonly id: string;
  readonly kind: Poc1PerformanceScenarioKind;
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly maximumP95Ms: number;
};

export type Poc1CorrectnessProfile = {
  readonly minimumDocumentSwitchCount: number;
  readonly maximumOwnershipViolationCount: number;
  readonly maximumSearchMismatchCount: number;
  readonly maximumInputMismatchCount: number;
};

export type Poc1PerformanceProfile = {
  readonly schemaVersion: 1;
  readonly longformFixturePath: string;
  readonly artifactDirectory: string;
  readonly correctness: Poc1CorrectnessProfile;
  readonly searchQueries: readonly string[];
  readonly inputSamples: readonly string[];
  readonly scenarios: readonly Poc1PerformanceScenarioProfile[];
};

const scenarioKinds: readonly Poc1PerformanceScenarioKind[] = [
  "document-switch",
  "work-search",
  "input",
];

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function readPositiveInteger(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value as number;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value as number;
}

function readPositiveNumber(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(`${field} p95 budget must be a positive number`);
  }
  return value;
}

function readNonEmptyStrings(
  record: Record<string, unknown>,
  field: string,
): readonly string[] {
  const value = record[field];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`${field} must contain non-empty strings`);
  }
  return Object.freeze([...(value as string[])]);
}

function readScenarioKind(
  record: Record<string, unknown>,
): Poc1PerformanceScenarioKind {
  const value = record.kind;
  if (
    typeof value !== "string" ||
    !scenarioKinds.includes(value as Poc1PerformanceScenarioKind)
  ) {
    throw new Error(`Unsupported POC-1 scenario kind: ${String(value)}`);
  }
  return value as Poc1PerformanceScenarioKind;
}

export function parsePoc1PerformanceProfile(
  value: unknown,
): Poc1PerformanceProfile {
  const record = readRecord(value, "poc1PerformanceProfile");
  if (record.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }
  const correctnessRecord = readRecord(
    record.correctness,
    "correctness",
  );
  const correctness = Object.freeze({
    minimumDocumentSwitchCount: readPositiveInteger(
      correctnessRecord,
      "minimumDocumentSwitchCount",
    ),
    maximumOwnershipViolationCount: readNonNegativeInteger(
      correctnessRecord,
      "maximumOwnershipViolationCount",
    ),
    maximumSearchMismatchCount: readNonNegativeInteger(
      correctnessRecord,
      "maximumSearchMismatchCount",
    ),
    maximumInputMismatchCount: readNonNegativeInteger(
      correctnessRecord,
      "maximumInputMismatchCount",
    ),
  });
  if (!Array.isArray(record.scenarios)) {
    throw new Error("scenarios must be an array");
  }
  const scenarioIds = new Set<string>();
  const seenKinds = new Set<Poc1PerformanceScenarioKind>();
  const scenarios = record.scenarios.map((item, index) => {
    const scenario = readRecord(item, `scenarios[${index}]`);
    const id = readNonEmptyString(scenario, "id");
    const kind = readScenarioKind(scenario);
    if (scenarioIds.has(id)) {
      throw new Error(`Duplicate scenario identity: ${id}`);
    }
    if (seenKinds.has(kind)) {
      throw new Error(`Duplicate scenario kind: ${kind}`);
    }
    scenarioIds.add(id);
    seenKinds.add(kind);
    return Object.freeze({
      id,
      kind,
      sampleCount: readPositiveInteger(scenario, "sampleCount"),
      warmupCount: readNonNegativeInteger(scenario, "warmupCount"),
      maximumP95Ms: readPositiveNumber(scenario, "maximumP95Ms"),
    });
  });
  for (const kind of scenarioKinds) {
    if (!seenKinds.has(kind)) {
      throw new Error(`Missing POC-1 scenario kind: ${kind}`);
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    longformFixturePath: readNonEmptyString(
      record,
      "longformFixturePath",
    ),
    artifactDirectory: readNonEmptyString(
      record,
      "artifactDirectory",
    ),
    correctness,
    searchQueries: readNonEmptyStrings(record, "searchQueries"),
    inputSamples: readNonEmptyStrings(record, "inputSamples"),
    scenarios: Object.freeze(scenarios),
  });
}
