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
  basename,
  dirname,
  isAbsolute,
  resolve,
} from "node:path";

import type {
  BlobAddress,
} from "../application/storage/blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
  type NodeImmutableBlobStoreProfile,
} from "../platform/storage/node-immutable-blob-store-profile";
import type {
  NodeSqliteBackupFormat,
  NodeSqliteBackupSqliteOptions,
  NodeSqliteBackupStage,
} from "../platform/storage/node-sqlite-backup";

export type Poc3BackupCrashCallerChecksum = {
  readonly identity: string;
  readonly algorithm: string;
  readonly value: string;
};

export type Poc3BackupCrashBlobEntryProfile = {
  readonly address: BlobAddress;
  readonly entrySegments:
    readonly string[];
};

export type Poc3BackupCrashLayoutProfile = {
  readonly databaseEntrySegments:
    readonly string[];
  readonly manifestEntrySegments:
    readonly string[];
  readonly manifestChecksumEntrySegments:
    readonly string[];
  readonly blobEntries:
    readonly Poc3BackupCrashBlobEntryProfile[];
};

export type Poc3BackupCrashGateProfile = {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly reachedPath: string;
  readonly reachedTemporaryPath:
    string;
  readonly sourceDatabasePath:
    string;
  readonly sourceBlobStoreProfile:
    NodeImmutableBlobStoreProfile;
  readonly temporaryBundleRoot:
    string;
  readonly finalBundleRoot:
    string;
  readonly layout:
    Poc3BackupCrashLayoutProfile;
  readonly format:
    NodeSqliteBackupFormat;
  readonly sqlite:
    NodeSqliteBackupSqliteOptions;
  readonly canonicalJson: {
    readonly identity: string;
  };
  readonly checksum: {
    readonly identity: string;
    readonly algorithm: string;
  };
  readonly clock: {
    readonly createdAt: string;
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
  const expected =
    new Set(fields);
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

function readAbsolutePath(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value =
    readString(
      input,
      field,
      label,
    );
  if (!isAbsolute(value)) {
    throw new Error(
      `${label}.${field} must be absolute`,
    );
  }
  return resolve(value);
}

function readPositiveSafeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(
      value,
    ) ||
    value <= 0
  ) {
    throw new Error(
      `${label}.${field} must be a positive safe integer`,
    );
  }
  return value;
}

function readSegments(
  value: unknown,
  label: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty array`,
    );
  }
  return Object.freeze(
    value.map(
      (entry, index) => {
        if (
          typeof entry !==
            "string" ||
          entry.length === 0 ||
          basename(entry) !==
            entry ||
          entry === "." ||
          entry === ".."
        ) {
          throw new Error(
            `${label}[${index}] must be one relative path segment`,
          );
        }
        return entry;
      },
    ),
  );
}

function readAddress(
  value: unknown,
  label: string,
): BlobAddress {
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "checksumIdentity",
      "checksumValue",
    ],
    label,
  );
  return Object.freeze({
    checksumIdentity:
      readString(
        input,
        "checksumIdentity",
        label,
      ),
    checksumValue:
      readString(
        input,
        "checksumValue",
        label,
      ),
  });
}

function readBlobEntries(
  value: unknown,
  label: string,
): readonly Poc3BackupCrashBlobEntryProfile[] {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `${label} must be a non-empty array`,
    );
  }
  const addressKeys =
    new Set<string>();
  const entryKeys =
    new Set<string>();
  return Object.freeze(
    value.map(
      (entry, index) => {
        const entryLabel =
          `${label}[${index}]`;
        const input =
          readRecord(
            entry,
            entryLabel,
          );
        assertExactFields(
          input,
          [
            "address",
            "entrySegments",
          ],
          entryLabel,
        );
        const address =
          readAddress(
            input.address,
            `${entryLabel}.address`,
          );
        const entrySegments =
          readSegments(
            input.entrySegments,
            `${entryLabel}.entrySegments`,
          );
        const addressKey =
          JSON.stringify([
            address
              .checksumIdentity,
            address
              .checksumValue,
          ]);
        const entryKey =
          JSON.stringify(
            entrySegments,
          );
        if (
          addressKeys.has(
            addressKey,
          )
        ) {
          throw new Error(
            `${label} has a duplicate blob address`,
          );
        }
        if (
          entryKeys.has(entryKey)
        ) {
          throw new Error(
            `${label} has a duplicate bundle entry`,
          );
        }
        addressKeys.add(
          addressKey,
        );
        entryKeys.add(entryKey);
        return Object.freeze({
          address,
          entrySegments,
        });
      },
    ),
  );
}

function readLayout(
  value: unknown,
): Poc3BackupCrashLayoutProfile {
  const label =
    "POC-3 backup crash gate profile.layout";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "databaseEntrySegments",
      "manifestEntrySegments",
      "manifestChecksumEntrySegments",
      "blobEntries",
    ],
    label,
  );
  const databaseEntrySegments =
    readSegments(
      input.databaseEntrySegments,
      `${label}.databaseEntrySegments`,
    );
  const manifestEntrySegments =
    readSegments(
      input.manifestEntrySegments,
      `${label}.manifestEntrySegments`,
    );
  const manifestChecksumEntrySegments =
    readSegments(
      input
        .manifestChecksumEntrySegments,
      `${label}.manifestChecksumEntrySegments`,
    );
  const entryKeys = [
    databaseEntrySegments,
    manifestEntrySegments,
    manifestChecksumEntrySegments,
  ].map(
    (segments) =>
      JSON.stringify(segments),
  );
  if (
    new Set(entryKeys).size !==
      entryKeys.length
  ) {
    throw new Error(
      `${label} has duplicate fixed entries`,
    );
  }
  const blobEntries =
    readBlobEntries(
      input.blobEntries,
      `${label}.blobEntries`,
    );
  const fixedEntries =
    new Set(entryKeys);
  for (
    const entry
    of blobEntries
  ) {
    if (
      fixedEntries.has(
        JSON.stringify(
          entry.entrySegments,
        ),
      )
    ) {
      throw new Error(
        `${label} reuses a fixed entry for a blob`,
      );
    }
  }
  return Object.freeze({
    databaseEntrySegments,
    manifestEntrySegments,
    manifestChecksumEntrySegments,
    blobEntries,
  });
}

function readFormat(
  value: unknown,
): NodeSqliteBackupFormat {
  const label =
    "POC-3 backup crash gate profile.format";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "identity",
      "version",
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
    version:
      readString(
        input,
        "version",
        label,
      ),
  });
}

function readSqlite(
  value: unknown,
): NodeSqliteBackupSqliteOptions {
  const label =
    "POC-3 backup crash gate profile.sqlite";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "sourceDatabaseName",
      "targetDatabaseName",
      "pagesPerStep",
      "standaloneSnapshotJournalMode",
    ],
    label,
  );
  return Object.freeze({
    sourceDatabaseName:
      readString(
        input,
        "sourceDatabaseName",
        label,
      ),
    targetDatabaseName:
      readString(
        input,
        "targetDatabaseName",
        label,
      ),
    pagesPerStep:
      readPositiveSafeInteger(
        input,
        "pagesPerStep",
        label,
      ),
    standaloneSnapshotJournalMode:
      readString(
        input,
        "standaloneSnapshotJournalMode",
        label,
      ),
  });
}

function readIdentity(
  value: unknown,
  label: string,
): Readonly<{
  readonly identity: string;
}> {
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "identity",
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
  });
}

function readChecksumProfile(
  value: unknown,
): Poc3BackupCrashGateProfile[
  "checksum"
] {
  const label =
    "POC-3 backup crash gate profile.checksum";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "identity",
      "algorithm",
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
  });
}

function readClock(
  value: unknown,
): Poc3BackupCrashGateProfile[
  "clock"
] {
  const label =
    "POC-3 backup crash gate profile.clock";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "createdAt",
    ],
    label,
  );
  return Object.freeze({
    createdAt:
      readString(
        input,
        "createdAt",
        label,
      ),
  });
}

export function parsePoc3BackupCrashCallerChecksum(
  value: unknown,
): Poc3BackupCrashCallerChecksum {
  const label =
    "POC-3 backup crash caller checksum";
  const input =
    readRecord(
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

export function parsePoc3BackupCrashGateProfile(
  value: unknown,
): Poc3BackupCrashGateProfile {
  const label =
    "POC-3 backup crash gate profile";
  const input =
    readRecord(
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
      "sourceDatabasePath",
      "sourceBlobStoreProfile",
      "temporaryBundleRoot",
      "finalBundleRoot",
      "layout",
      "format",
      "sqlite",
      "canonicalJson",
      "checksum",
      "clock",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schema version: ${String(input.schemaVersion)}`,
    );
  }
  const reachedPath =
    readAbsolutePath(
      input,
      "reachedPath",
      label,
    );
  const reachedTemporaryPath =
    readAbsolutePath(
      input,
      "reachedTemporaryPath",
      label,
    );
  if (
    reachedPath ===
      reachedTemporaryPath ||
    dirname(reachedPath) !==
      dirname(
        reachedTemporaryPath,
      )
  ) {
    throw new Error(
      `${label} marker paths must be distinct and have the same parent`,
    );
  }
  const temporaryBundleRoot =
    readAbsolutePath(
      input,
      "temporaryBundleRoot",
      label,
    );
  const finalBundleRoot =
    readAbsolutePath(
      input,
      "finalBundleRoot",
      label,
    );
  if (
    temporaryBundleRoot ===
      finalBundleRoot ||
    dirname(
      temporaryBundleRoot,
    ) !==
      dirname(finalBundleRoot)
  ) {
    throw new Error(
      `${label} bundle roots must be distinct siblings`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    scenarioId:
      readString(
        input,
        "scenarioId",
        label,
      ),
    reachedPath,
    reachedTemporaryPath,
    sourceDatabasePath:
      readAbsolutePath(
        input,
        "sourceDatabasePath",
        label,
      ),
    sourceBlobStoreProfile:
      parseNodeImmutableBlobStoreProfile(
        input
          .sourceBlobStoreProfile,
      ),
    temporaryBundleRoot,
    finalBundleRoot,
    layout:
      readLayout(
        input.layout,
      ),
    format:
      readFormat(
        input.format,
      ),
    sqlite:
      readSqlite(
        input.sqlite,
      ),
    canonicalJson:
      readIdentity(
        input.canonicalJson,
        `${label}.canonicalJson`,
      ),
    checksum:
      readChecksumProfile(
        input.checksum,
      ),
    clock:
      readClock(
        input.clock,
      ),
  });
}

export function checksumPoc3BackupCrashGateProfile(
  profile:
    Poc3BackupCrashGateProfile,
  algorithm: string,
): string {
  return createHash(algorithm)
    .update(
      JSON.stringify(profile),
    )
    .digest("hex");
}

async function assertAbsent(
  path: string,
  label: string,
): Promise<void> {
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
}

async function syncFile(
  path: string,
): Promise<void> {
  const handle =
    await open(path, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeReachedMarker(
  profile:
    Poc3BackupCrashGateProfile,
  callerChecksum:
    Poc3BackupCrashCallerChecksum,
): Promise<void> {
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
      "POC-3 backup crash marker paths are not verified same-parent distinct paths",
    );
  }
  await assertAbsent(
    temporaryPath,
    "POC-3 backup crash temporary marker",
  );
  await assertAbsent(
    finalPath,
    "POC-3 backup crash final marker",
  );
  const bytes =
    new TextEncoder().encode(
      JSON.stringify([
        "poc-3-backup-crash-gate-reached",
        profile.schemaVersion,
        profile.scenarioId,
        "before-bundle-publish",
        profile
          .canonicalJson
          .identity,
        callerChecksum.identity,
        callerChecksum.value,
      ]),
    );
  let temporaryOwned = false;
  try {
    const handle =
      await open(
        temporaryPath,
        "wx",
      );
    temporaryOwned = true;
    try {
      let offset = 0;
      while (
        offset <
          bytes.byteLength
      ) {
        const {
          bytesWritten,
        } = await handle.write(
          bytes,
          offset,
          bytes.byteLength -
            offset,
          null,
        );
        if (bytesWritten <= 0) {
          throw new Error(
            "POC-3 backup crash marker write made no progress",
          );
        }
        offset += bytesWritten;
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertAbsent(
      finalPath,
      "POC-3 backup crash final marker",
    );
    await rename(
      temporaryPath,
      finalPath,
    );
    temporaryOwned = false;
    await syncFile(finalPath);
  } catch (error) {
    if (temporaryOwned) {
      if (
        temporaryPath ===
          finalPath ||
        dirname(
          temporaryPath,
        ) !== dirname(finalPath)
      ) {
        throw new AggregateError(
          [error],
          "Refusing to clean an unverified POC-3 backup crash temporary marker",
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
            "POC-3 backup crash marker publication and verified temporary cleanup both failed",
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

export function createPoc3BackupCrashGate(
  input: {
    readonly profile:
      Poc3BackupCrashGateProfile;
    readonly callerChecksum:
      Poc3BackupCrashCallerChecksum;
    readonly enterPending:
      () => Promise<void>;
  },
): {
  stageHook(
    stage:
      NodeSqliteBackupStage,
  ): Promise<void>;
} {
  return Object.freeze({
    async stageHook(
      stage:
        NodeSqliteBackupStage,
    ) {
      if (
        stage !==
          "before-bundle-publish"
      ) {
        return;
      }
      await writeReachedMarker(
        input.profile,
        input.callerChecksum,
      );
      await input.enterPending();
    },
  });
}
