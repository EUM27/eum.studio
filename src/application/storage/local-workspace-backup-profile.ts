export type LocalWorkspaceBackupLayoutProfile = {
  readonly databaseEntrySegments: readonly string[];
  readonly blobDirectorySegments: readonly string[];
  readonly blobShardWidths: readonly number[];
  readonly blobFileNameSuffix: string;
};

export type LocalWorkspaceBackupProfile = {
  readonly schemaVersion: 1;
  readonly format: {
    readonly identity: string;
    readonly version: string;
  };
  readonly checksum: {
    readonly identity: string;
    readonly algorithm: string;
  };
  readonly sqlite: {
    readonly sourceDatabaseName: string;
    readonly targetDatabaseName: string;
    readonly pagesPerStep: number;
    readonly standaloneSnapshotJournalMode: string;
  };
  readonly bundleLayout: LocalWorkspaceBackupLayoutProfile & {
    readonly manifestEntrySegments: readonly string[];
    readonly manifestChecksumEntrySegments: readonly string[];
  };
  readonly restoreLayout: LocalWorkspaceBackupLayoutProfile;
  readonly stateFileName: string;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function segments(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty segment array`);
  }
  return Object.freeze(
    value.map((segment, index) => {
      if (
        typeof segment !== "string" ||
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\")
      ) {
        throw new Error(`${label}.${field}[${index}] must be one safe segment`);
      }
      return segment;
    }),
  );
}

function positiveIntegers(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly number[] {
  const value = input[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty integer array`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (!Number.isSafeInteger(entry) || Number(entry) <= 0) {
        throw new Error(`${label}.${field}[${index}] must be positive`);
      }
      return Number(entry);
    }),
  );
}

function layout(
  value: unknown,
  label: string,
  includeManifest: boolean,
): LocalWorkspaceBackupLayoutProfile & {
  readonly manifestEntrySegments?: readonly string[];
  readonly manifestChecksumEntrySegments?: readonly string[];
} {
  const input = record(value, label);
  const fields = [
    "databaseEntrySegments",
    "blobDirectorySegments",
    "blobShardWidths",
    "blobFileNameSuffix",
    ...(includeManifest
      ? ["manifestEntrySegments", "manifestChecksumEntrySegments"]
      : []),
  ];
  exact(input, fields, label);
  return Object.freeze({
    databaseEntrySegments: segments(input, "databaseEntrySegments", label),
    blobDirectorySegments: segments(input, "blobDirectorySegments", label),
    blobShardWidths: positiveIntegers(input, "blobShardWidths", label),
    blobFileNameSuffix: stringValue(input, "blobFileNameSuffix", label),
    ...(includeManifest
      ? {
          manifestEntrySegments: segments(input, "manifestEntrySegments", label),
          manifestChecksumEntrySegments: segments(
            input,
            "manifestChecksumEntrySegments",
            label,
          ),
        }
      : {}),
  });
}

export function parseLocalWorkspaceBackupProfile(
  value: unknown,
): LocalWorkspaceBackupProfile {
  const label = "LocalWorkspaceBackupProfile";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "format",
      "checksum",
      "sqlite",
      "bundleLayout",
      "restoreLayout",
      "stateFileName",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  const format = record(input.format, `${label}.format`);
  exact(format, ["identity", "version"], `${label}.format`);
  const checksum = record(input.checksum, `${label}.checksum`);
  exact(checksum, ["identity", "algorithm"], `${label}.checksum`);
  const sqlite = record(input.sqlite, `${label}.sqlite`);
  exact(
    sqlite,
    [
      "sourceDatabaseName",
      "targetDatabaseName",
      "pagesPerStep",
      "standaloneSnapshotJournalMode",
    ],
    `${label}.sqlite`,
  );
  const pagesPerStep = sqlite.pagesPerStep;
  if (!Number.isSafeInteger(pagesPerStep) || Number(pagesPerStep) <= 0) {
    throw new Error(`${label}.sqlite.pagesPerStep must be positive`);
  }
  const bundleLayout = layout(
    input.bundleLayout,
    `${label}.bundleLayout`,
    true,
  );
  const restoreLayout = layout(
    input.restoreLayout,
    `${label}.restoreLayout`,
    false,
  );
  if (
    bundleLayout.manifestEntrySegments === undefined ||
    bundleLayout.manifestChecksumEntrySegments === undefined
  ) {
    throw new Error(`${label}.bundleLayout manifest entries are missing`);
  }
  const stateFileName = stringValue(input, "stateFileName", label);
  if (stateFileName.includes("/") || stateFileName.includes("\\")) {
    throw new Error(`${label}.stateFileName must be one file name`);
  }
  return Object.freeze({
    schemaVersion: 1,
    format: Object.freeze({
      identity: stringValue(format, "identity", `${label}.format`),
      version: stringValue(format, "version", `${label}.format`),
    }),
    checksum: Object.freeze({
      identity: stringValue(checksum, "identity", `${label}.checksum`),
      algorithm: stringValue(checksum, "algorithm", `${label}.checksum`),
    }),
    sqlite: Object.freeze({
      sourceDatabaseName: stringValue(
        sqlite,
        "sourceDatabaseName",
        `${label}.sqlite`,
      ),
      targetDatabaseName: stringValue(
        sqlite,
        "targetDatabaseName",
        `${label}.sqlite`,
      ),
      pagesPerStep: Number(pagesPerStep),
      standaloneSnapshotJournalMode: stringValue(
        sqlite,
        "standaloneSnapshotJournalMode",
        `${label}.sqlite`,
      ),
    }),
    bundleLayout: Object.freeze({
      ...bundleLayout,
      manifestEntrySegments: bundleLayout.manifestEntrySegments,
      manifestChecksumEntrySegments:
        bundleLayout.manifestChecksumEntrySegments,
    }),
    restoreLayout,
    stateFileName,
  });
}
