import {
  createHash,
} from "node:crypto";

import {
  checksumPoc3BackupCrashGateProfile,
  createPoc3BackupCrashGate,
  parsePoc3BackupCrashCallerChecksum,
  parsePoc3BackupCrashGateProfile,
  type Poc3BackupCrashCallerChecksum,
  type Poc3BackupCrashGateProfile,
} from "./poc-3-backup-crash-gate-profile";
import {
  createNodeImmutableBlobStore,
} from "../platform/storage/node-immutable-blob-store";
import {
  createNodeSqliteBackupBundle,
  type NodeSqliteBackupCanonicalBytesAdapter,
  type NodeSqliteBackupManifest,
  type NodeSqliteBackupManifestCodec,
} from "../platform/storage/node-sqlite-backup";

type Poc3BackupCrashWorkerCommand = {
  readonly type:
    "poc-3-backup-crash-worker-run";
  readonly callerChecksum:
    Poc3BackupCrashCallerChecksum;
  readonly profile:
    Poc3BackupCrashGateProfile;
};

type Poc3BackupCrashWorkerStage =
  | "parse-command"
  | "create-blob-store"
  | "create-backup";

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

function parseWorkerCommand(
  value: unknown,
): Poc3BackupCrashWorkerCommand {
  const label =
    "POC-3 backup crash worker command";
  const input =
    readRecord(
      value,
      label,
    );
  const fields = [
    "type",
    "callerChecksum",
    "profile",
  ] as const;
  const expected =
    new Set<string>(
      fields,
    );
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
  if (
    input.type !==
      "poc-3-backup-crash-worker-run"
  ) {
    throw new Error(
      `Unsupported ${label} type: ${String(input.type)}`,
    );
  }
  const profile =
    parsePoc3BackupCrashGateProfile(
      input.profile,
    );
  const callerChecksum =
    parsePoc3BackupCrashCallerChecksum(
      input.callerChecksum,
    );
  const actualChecksum =
    checksumPoc3BackupCrashGateProfile(
      profile,
      callerChecksum.algorithm,
    );
  if (
    actualChecksum !==
      callerChecksum.value
  ) {
    throw new Error(
      "POC-3 backup crash caller checksum mismatch",
    );
  }
  return Object.freeze({
    type:
      "poc-3-backup-crash-worker-run",
    callerChecksum,
    profile,
  });
}

function canonicalValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      canonicalValue,
    );
  }
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(
          ([left], [right]) =>
            left.localeCompare(
              right,
            ),
        )
        .map(
          ([key, entry]) => [
            key,
            canonicalValue(
              entry,
            ),
          ],
        ),
    );
  }
  return value;
}

function createCanonicalBytes():
NodeSqliteBackupCanonicalBytesAdapter {
  const encoder =
    new TextEncoder();
  const decoder =
    new TextDecoder();
  return Object.freeze({
    encode: (
      value: unknown,
    ): Uint8Array =>
      encoder.encode(
        JSON.stringify(
          canonicalValue(value),
        ),
      ),
    decode: (
      bytes: Uint8Array,
    ): unknown =>
      JSON.parse(
        decoder.decode(bytes),
      ),
  });
}

function createManifestCodec(
  canonicalBytes:
    NodeSqliteBackupCanonicalBytesAdapter,
): NodeSqliteBackupManifestCodec {
  return Object.freeze({
    encodeCanonical: (
      manifest:
        NodeSqliteBackupManifest,
    ): Uint8Array =>
      canonicalBytes.encode(
        manifest,
      ),
    decodeCanonical: (
      bytes: Uint8Array,
    ):
      NodeSqliteBackupManifest =>
      canonicalBytes.decode(
        bytes,
      ) as
        NodeSqliteBackupManifest,
  });
}

function addressKey(
  address: {
    readonly checksumIdentity:
      string;
    readonly checksumValue:
      string;
  },
): string {
  return JSON.stringify([
    address.checksumIdentity,
    address.checksumValue,
  ]);
}

async function enterPending():
Promise<void> {
  if (process.channel === undefined) {
    throw new Error(
      "POC-3 backup crash worker lost its IPC synchronization channel",
    );
  }
  process.channel.ref();
  await new Promise<void>(
    () => {
      // The parent harness terminates this process.
    },
  );
}

async function runWorkerCommand(
  value: unknown,
  reportStage: (
    stage:
      Poc3BackupCrashWorkerStage,
  ) => void,
): Promise<void> {
  reportStage("parse-command");
  const command =
    parseWorkerCommand(value);
  const canonicalBytes =
    createCanonicalBytes();
  const manifestCodec =
    createManifestCodec(
      canonicalBytes,
    );
  reportStage(
    "create-blob-store",
  );
  const blobStore =
    await createNodeImmutableBlobStore(
      command.profile
        .sourceBlobStoreProfile,
    );
  const entries =
    new Map(
      command.profile.layout
        .blobEntries
        .map((entry) => [
          addressKey(
            entry.address,
          ),
          entry.entrySegments,
        ] as const),
    );
  let clockUsed = false;
  const gate =
    createPoc3BackupCrashGate({
      profile:
        command.profile,
      callerChecksum:
        command.callerChecksum,
      enterPending,
    });
  reportStage("create-backup");
  await createNodeSqliteBackupBundle({
    sourceDatabasePath:
      command.profile
        .sourceDatabasePath,
    sourceBlobStore:
      blobStore,
    temporaryBundleRoot:
      command.profile
        .temporaryBundleRoot,
    finalBundleRoot:
      command.profile
        .finalBundleRoot,
    layout:
      Object.freeze({
        databaseEntrySegments:
          command.profile
            .layout
            .databaseEntrySegments,
        manifestEntrySegments:
          command.profile
            .layout
            .manifestEntrySegments,
        manifestChecksumEntrySegments:
          command.profile
            .layout
            .manifestChecksumEntrySegments,
        blobEntrySegments:
          (address) => {
            const segments =
              entries.get(
                addressKey(
                  address,
                ),
              );
            if (
              segments ===
                undefined
            ) {
              throw new Error(
                "Caller backup layout has no exact entry for a referenced blob",
              );
            }
            return segments;
          },
      }),
    format:
      command.profile.format,
    sqlite:
      command.profile.sqlite,
    manifestCodec,
    canonicalBytes,
    checksum:
      Object.freeze({
        identity:
          command.profile
            .checksum
            .identity,
        checksum: (
          bytes: Uint8Array,
        ): string =>
          createHash(
            command.profile
              .checksum
              .algorithm,
          )
            .update(bytes)
            .digest("hex"),
      }),
    clock:
      Object.freeze({
        now: (): string => {
          if (clockUsed) {
            throw new Error(
              "Caller backup clock value is exhausted",
            );
          }
          clockUsed = true;
          return command.profile
            .clock.createdAt;
        },
      }),
    stageHook:
      gate.stageHook,
  });
  process.send?.({
    type:
      "poc-3-backup-crash-worker-completed",
  });
}

function sanitizedErrorCode(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const sqliteResultCode =
      Reflect.get(
        error,
        "errcode",
      );
    if (sqliteResultCode === 5) {
      return "SQLITE_BUSY";
    }
    if (sqliteResultCode === 6) {
      return "SQLITE_LOCKED";
    }
    const candidate =
      Reflect.get(
        error,
        "code",
      );
    if (
      typeof candidate === "string" &&
      /^[A-Z][A-Z0-9_]*$/.test(
        candidate,
      )
    ) {
      return candidate;
    }
  }
  return "UNCLASSIFIED_ERROR";
}

function sanitizedErrorOrigin(
  error: unknown,
): string {
  const stack =
    error instanceof Error
      ? error.stack
      : undefined;
  if (stack !== undefined) {
    for (
      const line
      of stack.split(/\r?\n/).slice(1)
    ) {
      const match =
        /^\s*at ([A-Za-z][A-Za-z0-9_.<>]*)/.exec(
          line,
        );
      if (match?.[1] !== undefined) {
        return match[1];
      }
    }
  }
  return "UNKNOWN_ORIGIN";
}

if (
  process.env
    .EUM_STUDIO_POC_3_BACKUP_CRASH_WORKER ===
    "1"
) {
  if (process.send === undefined) {
    throw new Error(
      "POC-3 backup crash worker requires an IPC parent",
    );
  }
  process.on(
    "message",
    (value: unknown) => {
      let stage:
        Poc3BackupCrashWorkerStage =
          "parse-command";
      void runWorkerCommand(
        value,
        (nextStage) => {
          stage = nextStage;
        },
      ).catch(
        (error: unknown) => {
          process.send?.({
            type:
              "poc-3-backup-crash-worker-failed",
            errorName:
              error instanceof Error
                ? error.name
                : typeof error,
            errorCode:
              sanitizedErrorCode(
                error,
              ),
            errorStage: stage,
            errorOrigin:
              sanitizedErrorOrigin(
                error,
              ),
          });
        },
      );
    },
  );
  process.send({
    type:
      "poc-3-backup-crash-worker-ready",
  });
}
