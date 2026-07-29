import {
  createHash,
} from "node:crypto";
import {
  lstat,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  resolve,
} from "node:path";

import {
  parsePoc3StorageOpenProfile,
  type Poc3SqliteReadbackValue,
  type Poc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";

export type Poc3MigrationCrashCallerChecksum = {
  readonly identity: string;
  readonly algorithm: string;
  readonly value: string;
};

export type Poc3MigrationCrashCatalogStepProfile = {
  readonly migrationId: string;
  readonly fromSchemaVersion:
    number;
  readonly toSchemaVersion: number;
  readonly definitionBytes:
    readonly number[];
  readonly expectedDefinitionChecksumValue:
    string;
  readonly statements:
    readonly string[];
  readonly verification: {
    readonly query: string;
    readonly expectedRows:
      readonly Readonly<
        Record<
          string,
          Poc3SqliteReadbackValue
        >
      >[];
  };
  readonly logicalSnapshot: {
    readonly scopeIdentity:
      string;
    readonly query: string;
    readonly verifyAfterChecksumOnNoOp:
      boolean;
  };
  readonly startedAt: string;
  readonly completedAt: string;
  readonly receiptId: string;
};

export type Poc3MigrationCrashGateProfile = {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly reachedPath: string;
  readonly reachedTemporaryPath:
    string;
  readonly storageOpenProfile:
    Poc3StorageOpenProfile;
  readonly migration: {
    readonly targetSchemaVersion:
      number;
    readonly checksum: {
      readonly identity: string;
      readonly algorithm: string;
    };
    readonly catalog:
      readonly Poc3MigrationCrashCatalogStepProfile[];
  };
};

function readRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object`,
    );
  }
  return value as Record<
    string,
    unknown
  >;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (
    const field
    of Object.keys(input)
  ) {
    if (!expected.has(field)) {
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

function readString(
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

function readPositiveSafeInteger(
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

function readDefinitionBytes(
  value: unknown,
  label: string,
): readonly number[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((byte, index) => {
      if (
        typeof byte !== "number" ||
        !Number.isSafeInteger(byte) ||
        byte < 0 ||
        byte > 255
      ) {
        throw new Error(
          `${label}[${index}] must be a byte`,
        );
      }
      return byte;
    }),
  );
}

function readStatements(
  value: unknown,
  label: string,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((statement, index) => {
      if (
        typeof statement !==
          "string" ||
        statement.length === 0
      ) {
        throw new Error(
          `${label}[${index}] must be a non-empty string`,
        );
      }
      return statement;
    }),
  );
}

function readExpectedRows(
  value: unknown,
  label: string,
): Poc3MigrationCrashCatalogStepProfile[
  "verification"
][
  "expectedRows"
] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((entry, index) => {
      const row = readRecord(
        entry,
        `${label}[${index}]`,
      );
      const parsed:
        Record<
          string,
          Poc3SqliteReadbackValue
        > = {};
      for (
        const [column, cell]
        of Object.entries(row)
      ) {
        if (
          column.length === 0 ||
          !(
            cell === null ||
            typeof cell ===
              "string" ||
            typeof cell ===
              "boolean" ||
            (
              typeof cell ===
                "number" &&
              Number.isSafeInteger(
                cell,
              )
            )
          )
        ) {
          throw new Error(
            `${label}[${index}] has an invalid SQLite readback value`,
          );
        }
        parsed[column] = cell;
      }
      return Object.freeze(
        parsed,
      );
    }),
  );
}

function readCatalogStep(
  value: unknown,
  index: number,
): Poc3MigrationCrashCatalogStepProfile {
  const label =
    `POC-3 migration crash gate profile.migration.catalog[${index}]`;
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "migrationId",
      "fromSchemaVersion",
      "toSchemaVersion",
      "definitionBytes",
      "expectedDefinitionChecksumValue",
      "statements",
      "verification",
      "logicalSnapshot",
      "startedAt",
      "completedAt",
      "receiptId",
    ],
    label,
  );
  const verificationLabel =
    `${label}.verification`;
  const verification =
    readRecord(
      input.verification,
      verificationLabel,
    );
  assertExactFields(
    verification,
    [
      "query",
      "expectedRows",
    ],
    verificationLabel,
  );
  const snapshotLabel =
    `${label}.logicalSnapshot`;
  const snapshot =
    readRecord(
      input.logicalSnapshot,
      snapshotLabel,
    );
  assertExactFields(
    snapshot,
    [
      "scopeIdentity",
      "query",
      "verifyAfterChecksumOnNoOp",
    ],
    snapshotLabel,
  );
  if (
    typeof snapshot
      .verifyAfterChecksumOnNoOp !==
      "boolean"
  ) {
    throw new Error(
      `${snapshotLabel}.verifyAfterChecksumOnNoOp must be a boolean`,
    );
  }
  return Object.freeze({
    migrationId:
      readString(
        input,
        "migrationId",
        label,
      ),
    fromSchemaVersion:
      readPositiveSafeInteger(
        input,
        "fromSchemaVersion",
        label,
      ),
    toSchemaVersion:
      readPositiveSafeInteger(
        input,
        "toSchemaVersion",
        label,
      ),
    definitionBytes:
      readDefinitionBytes(
        input.definitionBytes,
        `${label}.definitionBytes`,
      ),
    expectedDefinitionChecksumValue:
      readString(
        input,
        "expectedDefinitionChecksumValue",
        label,
      ),
    statements:
      readStatements(
        input.statements,
        `${label}.statements`,
      ),
    verification:
      Object.freeze({
        query:
          readString(
            verification,
            "query",
            verificationLabel,
          ),
        expectedRows:
          readExpectedRows(
            verification
              .expectedRows,
            `${verificationLabel}.expectedRows`,
          ),
      }),
    logicalSnapshot:
      Object.freeze({
        scopeIdentity:
          readString(
            snapshot,
            "scopeIdentity",
            snapshotLabel,
          ),
        query:
          readString(
            snapshot,
            "query",
            snapshotLabel,
          ),
        verifyAfterChecksumOnNoOp:
          snapshot
            .verifyAfterChecksumOnNoOp,
      }),
    startedAt:
      readString(
        input,
        "startedAt",
        label,
      ),
    completedAt:
      readString(
        input,
        "completedAt",
        label,
      ),
    receiptId:
      readString(
        input,
        "receiptId",
        label,
      ),
  });
}

function readCatalog(
  value: unknown,
): readonly Poc3MigrationCrashCatalogStepProfile[] {
  const label =
    "POC-3 migration crash gate profile.migration.catalog";
  if (!Array.isArray(value)) {
    throw new Error(
      `${label} must be an array`,
    );
  }
  return Object.freeze(
    value.map((entry, index) =>
      readCatalogStep(
        entry,
        index,
      ),
    ),
  );
}

export function parsePoc3MigrationCrashCallerChecksum(
  value: unknown,
): Poc3MigrationCrashCallerChecksum {
  const label =
    "POC-3 migration crash caller checksum";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "identity",
      "algorithm",
      "value",
    ],
    label,
  );
  return Object.freeze({
    identity:
      readString(
        input,
        "identity",
        label,
      ),
    algorithm:
      readString(
        input,
        "algorithm",
        label,
      ),
    value:
      readString(
        input,
        "value",
        label,
      ),
  });
}

export function parsePoc3MigrationCrashGateProfile(
  value: unknown,
): Poc3MigrationCrashGateProfile {
  const label =
    "POC-3 migration crash gate profile";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "schemaVersion",
      "scenarioId",
      "reachedPath",
      "reachedTemporaryPath",
      "storageOpenProfile",
      "migration",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schema version: ${String(input.schemaVersion)}`,
    );
  }
  const reachedPath =
    readString(
      input,
      "reachedPath",
      label,
    );
  const reachedTemporaryPath =
    readString(
      input,
      "reachedTemporaryPath",
      label,
    );
  if (
    !isAbsolute(reachedPath) ||
    !isAbsolute(
      reachedTemporaryPath,
    )
  ) {
    throw new Error(
      `${label} marker paths must be absolute`,
    );
  }
  const resolvedReachedPath =
    resolve(reachedPath);
  const resolvedTemporaryPath =
    resolve(
      reachedTemporaryPath,
    );
  if (
    resolvedReachedPath ===
    resolvedTemporaryPath
  ) {
    throw new Error(
      `${label} marker paths must differ`,
    );
  }
  if (
    dirname(
      resolvedReachedPath,
    ) !==
    dirname(
      resolvedTemporaryPath,
    )
  ) {
    throw new Error(
      `${label} marker paths must have the same parent`,
    );
  }
  const storageOpenProfile =
    parsePoc3StorageOpenProfile(
      input.storageOpenProfile,
    );
  if (
    !isAbsolute(
      storageOpenProfile
        .databasePath,
    )
  ) {
    throw new Error(
      `${label}.storageOpenProfile.databasePath must be absolute`,
    );
  }
  const migrationLabel =
    `${label}.migration`;
  const migration =
    readRecord(
      input.migration,
      migrationLabel,
    );
  assertExactFields(
    migration,
    [
      "targetSchemaVersion",
      "checksum",
      "catalog",
    ],
    migrationLabel,
  );
  const checksumLabel =
    `${migrationLabel}.checksum`;
  const checksum =
    readRecord(
      migration.checksum,
      checksumLabel,
    );
  assertExactFields(
    checksum,
    [
      "identity",
      "algorithm",
    ],
    checksumLabel,
  );
  return Object.freeze({
    schemaVersion: 1,
    scenarioId:
      readString(
        input,
        "scenarioId",
        label,
      ),
    reachedPath:
      resolvedReachedPath,
    reachedTemporaryPath:
      resolvedTemporaryPath,
    storageOpenProfile,
    migration:
      Object.freeze({
        targetSchemaVersion:
          readPositiveSafeInteger(
            migration,
            "targetSchemaVersion",
            migrationLabel,
          ),
        checksum:
          Object.freeze({
            identity:
              readString(
                checksum,
                "identity",
                checksumLabel,
              ),
            algorithm:
              readString(
                checksum,
                "algorithm",
                checksumLabel,
              ),
          }),
        catalog:
          readCatalog(
            migration.catalog,
          ),
      }),
  });
}

export function checksumPoc3MigrationCrashGateProfile(
  profile:
    Poc3MigrationCrashGateProfile,
  algorithm: string,
): string {
  return createHash(algorithm)
    .update(
      JSON.stringify(profile),
    )
    .digest("hex");
}

async function writeReachedMarker(
  profile:
    Poc3MigrationCrashGateProfile,
  callerChecksum:
    Poc3MigrationCrashCallerChecksum,
): Promise<void> {
  const assertAbsent =
    async (
      path: string,
      label: string,
    ): Promise<void> => {
      try {
        await lstat(path);
      } catch (error) {
        if (
          (
            error as
              NodeJS.ErrnoException
          ).code === "ENOENT"
        ) {
          return;
        }
        throw error;
      }
      throw new Error(
        `${label} must be absent: ${path}`,
      );
    };
  const finalPath =
    profile.reachedPath;
  const temporaryPath =
    profile
      .reachedTemporaryPath;
  if (
    finalPath === temporaryPath ||
    dirname(finalPath) !==
      dirname(temporaryPath)
  ) {
    throw new Error(
      "POC-3 migration crash marker paths are not verified same-parent distinct paths",
    );
  }
  await assertAbsent(
    temporaryPath,
    "POC-3 migration crash temporary marker",
  );
  await assertAbsent(
    finalPath,
    "POC-3 migration crash final marker",
  );
  const bytes =
    new TextEncoder().encode(
      JSON.stringify([
        "poc-3-migration-crash-gate-reached",
        profile.schemaVersion,
        profile.scenarioId,
        profile.migration
          .targetSchemaVersion,
        callerChecksum.identity,
        callerChecksum.value,
      ]),
    );
  let createdTemporary = false;
  try {
    const handle = await open(
      temporaryPath,
      "wx",
    );
    createdTemporary = true;
    try {
      let byteOffset = 0;
      while (
        byteOffset <
        bytes.byteLength
      ) {
        const {
          bytesWritten,
        } = await handle.write(
          bytes,
          byteOffset,
          bytes.byteLength -
            byteOffset,
          null,
        );
        if (bytesWritten <= 0) {
          throw new Error(
            `POC-3 migration crash marker write made no progress: ${temporaryPath}`,
          );
        }
        byteOffset +=
          bytesWritten;
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertAbsent(
      finalPath,
      "POC-3 migration crash final marker",
    );
    await rename(
      temporaryPath,
      finalPath,
    );
    createdTemporary = false;
  } catch (error) {
    if (createdTemporary) {
      if (
        temporaryPath ===
          finalPath ||
        dirname(temporaryPath) !==
          dirname(finalPath)
      ) {
        throw new AggregateError(
          [error],
          "Refusing to clean an unverified POC-3 migration crash temporary marker",
          {
            cause: error,
          },
        );
      }
      try {
        await unlink(
          temporaryPath,
        );
      } catch (cleanupError) {
        if (
          (
            cleanupError as
              NodeJS.ErrnoException
          ).code !== "ENOENT"
        ) {
          throw new AggregateError(
            [
              error,
              cleanupError,
            ],
            "POC-3 migration crash marker publication and verified temporary cleanup both failed",
            {
              cause:
                cleanupError,
            },
          );
        }
      }
    }
    throw error;
  }
}

export function createPoc3MigrationCrashGate(
  input: {
    readonly profile:
      Poc3MigrationCrashGateProfile;
    readonly callerChecksum:
      Poc3MigrationCrashCallerChecksum;
    readonly enterPending:
      () => Promise<void>;
  },
): {
  beforeCommit(): Promise<void>;
} {
  return Object.freeze({
    async beforeCommit() {
      await writeReachedMarker(
        input.profile,
        input.callerChecksum,
      );
      await input.enterPending();
    },
  });
}
