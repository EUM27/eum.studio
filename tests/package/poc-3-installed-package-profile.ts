import {
  isAbsolute,
  normalize,
  sep,
} from "node:path";

import {
  parsePoc2InstalledPackageProfile,
  type Poc2InstalledPackageProfile,
} from "./poc-2-installed-package-profile";

export type Poc3InstalledPackageManifest = {
  readonly schemaVersion: 1;
  readonly package:
    Poc2InstalledPackageProfile;
  readonly compiledLedgerTargetRelativePath:
    string;
  readonly compiledProbeTargetRelativePath:
    string;
  readonly compiledRevisionRaceProbeTargetRelativePath:
    string;
  readonly probeFixture: {
    readonly targetSchemaVersion:
      number;
    readonly requestedSettings:
      unknown;
    readonly encodedBlobByteLength:
      number;
    readonly publishedShardWidths:
      readonly number[];
    readonly layoutSegmentDepth:
      number;
    readonly backupSqlite: {
      readonly sourceDatabaseName:
        string;
      readonly targetDatabaseName:
        string;
      readonly pagesPerStep: number;
      readonly standaloneSnapshotJournalMode:
        string;
    };
    readonly anchor: {
      readonly status: string;
      readonly resolutionMethod:
        string;
      readonly matchedEvidence:
        readonly string[];
    };
    readonly restorePreflightAuthorized:
      boolean;
  };
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
      "POC-3 installed-package manifest must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function readTargetRelativePath(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty target-relative path`,
    );
  }
  const normalized = normalize(value);
  if (
    isAbsolute(value) ||
    normalized === ".." ||
    normalized.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `${field} must be a target-relative path`,
    );
  }
  return value;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
}

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${label}.${field} must be a non-empty string`,
    );
  }
  return value;
}

function readPositiveInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label}.${field} must be a positive safe integer`,
    );
  }
  return value;
}

function readStringArray(
  value: unknown,
  label: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0,
    )
  ) {
    throw new Error(
      `${label} must be an array of non-empty strings`,
    );
  }
  return Object.freeze([
    ...value,
  ]) as readonly string[];
}

function readProbeFixture(
  value: unknown,
): Poc3InstalledPackageManifest[
  "probeFixture"
] {
  const label =
    "POC-3 installed-package probeFixture";
  const input = readRecord(value);
  assertExactFields(
    input,
    [
      "targetSchemaVersion",
      "requestedSettings",
      "encodedBlobByteLength",
      "publishedShardWidths",
      "layoutSegmentDepth",
      "backupSqlite",
      "anchor",
      "restorePreflightAuthorized",
    ],
    label,
  );
  const backupSqlite =
    readRecord(input.backupSqlite);
  assertExactFields(
    backupSqlite,
    [
      "sourceDatabaseName",
      "targetDatabaseName",
      "pagesPerStep",
      "standaloneSnapshotJournalMode",
    ],
    `${label}.backupSqlite`,
  );
  const anchor =
    readRecord(input.anchor);
  assertExactFields(
    anchor,
    [
      "status",
      "resolutionMethod",
      "matchedEvidence",
    ],
    `${label}.anchor`,
  );
  if (
    typeof input
      .restorePreflightAuthorized !==
    "boolean"
  ) {
    throw new Error(
      `${label}.restorePreflightAuthorized must be boolean`,
    );
  }
  const shardWidths =
    input.publishedShardWidths;
  if (
    !Array.isArray(shardWidths) ||
    shardWidths.some(
      (entry) =>
        typeof entry !== "number" ||
        !Number.isSafeInteger(entry) ||
        entry <= 0,
    )
  ) {
    throw new Error(
      `${label}.publishedShardWidths must contain positive safe integers`,
    );
  }
  return Object.freeze({
    targetSchemaVersion:
      readPositiveInteger(
        input,
        "targetSchemaVersion",
        label,
      ),
    requestedSettings:
      input.requestedSettings,
    encodedBlobByteLength:
      readPositiveInteger(
        input,
        "encodedBlobByteLength",
        label,
      ),
    publishedShardWidths:
      Object.freeze([
        ...shardWidths,
      ]) as readonly number[],
    layoutSegmentDepth:
      readPositiveInteger(
        input,
        "layoutSegmentDepth",
        label,
      ),
    backupSqlite:
      Object.freeze({
        sourceDatabaseName:
          readNonEmptyString(
            backupSqlite,
            "sourceDatabaseName",
            `${label}.backupSqlite`,
          ),
        targetDatabaseName:
          readNonEmptyString(
            backupSqlite,
            "targetDatabaseName",
            `${label}.backupSqlite`,
          ),
        pagesPerStep:
          readPositiveInteger(
            backupSqlite,
            "pagesPerStep",
            `${label}.backupSqlite`,
          ),
        standaloneSnapshotJournalMode:
          readNonEmptyString(
            backupSqlite,
            "standaloneSnapshotJournalMode",
            `${label}.backupSqlite`,
          ),
      }),
    anchor: Object.freeze({
      status:
        readNonEmptyString(
          anchor,
          "status",
          `${label}.anchor`,
        ),
      resolutionMethod:
        readNonEmptyString(
          anchor,
          "resolutionMethod",
          `${label}.anchor`,
        ),
      matchedEvidence:
        readStringArray(
          anchor.matchedEvidence,
          `${label}.anchor.matchedEvidence`,
        ),
    }),
    restorePreflightAuthorized:
      input
        .restorePreflightAuthorized,
  });
}

export function parsePoc3InstalledPackageManifest(
  value: unknown,
): Poc3InstalledPackageManifest {
  const input = readRecord(value);
  const fields = [
    "schemaVersion",
    "package",
    "compiledLedgerTargetRelativePath",
    "compiledProbeTargetRelativePath",
    "compiledRevisionRaceProbeTargetRelativePath",
    "probeFixture",
  ] as const;
  const allowed = new Set<string>(
    fields,
  );
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported POC-3 installed-package manifest field: ${field}`,
      );
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(
        `POC-3 installed-package manifest is missing ${field}`,
      );
    }
  }
  if (input.schemaVersion !== 1) {
    throw new Error(
      "POC-3 installed-package manifest schemaVersion must be 1",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    package:
      parsePoc2InstalledPackageProfile(
        input.package,
      ),
    compiledLedgerTargetRelativePath:
      readTargetRelativePath(
        input,
        "compiledLedgerTargetRelativePath",
      ),
    compiledProbeTargetRelativePath:
      readTargetRelativePath(
        input,
        "compiledProbeTargetRelativePath",
      ),
    compiledRevisionRaceProbeTargetRelativePath:
      readTargetRelativePath(
        input,
        "compiledRevisionRaceProbeTargetRelativePath",
      ),
    probeFixture:
      readProbeFixture(
        input.probeFixture,
      ),
  });
}
