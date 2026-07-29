import {
  createHash,
} from "node:crypto";

import type {
  RevisionBlobProfile,
} from "../application/revisions/revision-store";
import {
  entityId,
} from "../domain/writing";
import {
  checksumPoc3RevisionCrashGateProfile,
  createPoc3RevisionCrashGate,
  parsePoc3RevisionCrashCallerChecksum,
  parsePoc3RevisionCrashGateProfile,
  type Poc3RevisionCrashBlobProfile,
  type Poc3RevisionCrashCallerChecksum,
  type Poc3RevisionCrashGateProfile,
} from "./poc-3-revision-crash-gate-profile";
import {
  createNodeImmutableBlobStore,
} from "../platform/storage/node-immutable-blob-store";
import {
  openNodeSqliteLedger,
} from "../platform/storage/node-sqlite-ledger";

type Poc3RevisionRaceWorkerRole =
  "holder" | "contender";

type Poc3RevisionRaceWorkerCommand = {
  readonly type:
    "poc-3-revision-race-worker-run";
  readonly role:
    Poc3RevisionRaceWorkerRole;
  readonly callerChecksum:
    Poc3RevisionCrashCallerChecksum;
  readonly profile:
    Poc3RevisionCrashGateProfile;
};

type Poc3RevisionRaceWorkerRelease = {
  readonly type:
    "poc-3-revision-race-worker-release";
  readonly scenarioId: string;
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
  for (const field of Object.keys(input)) {
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

function parseWorkerCommand(
  value: unknown,
): Poc3RevisionRaceWorkerCommand {
  const label =
    "POC-3 revision race worker command";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "type",
      "role",
      "callerChecksum",
      "profile",
    ],
    label,
  );
  if (
    input.type !==
    "poc-3-revision-race-worker-run"
  ) {
    throw new Error(
      `Unsupported ${label} type: ${String(input.type)}`,
    );
  }
  if (
    input.role !== "holder" &&
    input.role !== "contender"
  ) {
    throw new Error(
      `Unsupported ${label} role: ${String(input.role)}`,
    );
  }
  const profile =
    parsePoc3RevisionCrashGateProfile(
      input.profile,
    );
  const callerChecksum =
    parsePoc3RevisionCrashCallerChecksum(
      input.callerChecksum,
    );
  const actualChecksum =
    checksumPoc3RevisionCrashGateProfile(
      profile,
      callerChecksum.algorithm,
    );
  if (
    actualChecksum !==
      callerChecksum.value
  ) {
    throw new Error(
      "POC-3 revision race caller checksum mismatch",
    );
  }
  return Object.freeze({
    type:
      "poc-3-revision-race-worker-run",
    role: input.role,
    callerChecksum,
    profile,
  });
}

function parseWorkerRelease(
  value: unknown,
): Poc3RevisionRaceWorkerRelease {
  const label =
    "POC-3 revision race worker release";
  const input =
    readRecord(
      value,
      label,
    );
  assertExactFields(
    input,
    [
      "type",
      "scenarioId",
    ],
    label,
  );
  if (
    input.type !==
    "poc-3-revision-race-worker-release"
  ) {
    throw new Error(
      `Unsupported ${label} type: ${String(input.type)}`,
    );
  }
  return Object.freeze({
    type:
      "poc-3-revision-race-worker-release",
    scenarioId:
      readString(
        input,
        "scenarioId",
        label,
      ),
  });
}

function createRevisionBlobProfile(
  input:
    Poc3RevisionCrashBlobProfile,
): RevisionBlobProfile {
  if (!Buffer.isEncoding(input.encoding)) {
    throw new Error(
      `Unsupported caller encoding: ${input.encoding}`,
    );
  }
  const encoding =
    input.encoding as BufferEncoding;
  return Object.freeze({
    codec: Object.freeze({
      identity:
        input.codecIdentity,
      encode: (content: string) =>
        Uint8Array.from(
          Buffer.from(
            content,
            encoding,
          ),
        ),
      decode: (bytes: Uint8Array) =>
        Buffer.from(bytes)
          .toString(encoding),
      describe: (content: string) => {
        const bytes =
          Buffer.from(
            content,
            encoding,
          );
        const length =
          bytes.byteLength +
          input.contentLengthOffset;
        if (
          !Number.isSafeInteger(length)
        ) {
          throw new Error(
            "Caller revision length is not a safe integer",
          );
        }
        return Object.freeze({
          contentHash:
            createHash(
              input
                .contentHashAlgorithm,
            )
              .update(bytes)
              .digest("hex"),
          length,
        });
      },
    }),
    blobRefForAddress: (address) =>
      JSON.stringify([
        input
          .blobReferenceIdentity,
        address.checksumIdentity,
        address.checksumValue,
      ]),
    addressForBlobRef: (blobRef) => {
      const decoded =
        JSON.parse(blobRef) as
          readonly unknown[];
      if (
        decoded.length !== 3 ||
        decoded[0] !==
          input
            .blobReferenceIdentity ||
        typeof decoded[1] !==
          "string" ||
        typeof decoded[2] !==
          "string"
      ) {
        throw new Error(
          "Caller blob reference is invalid",
        );
      }
      return Object.freeze({
        checksumIdentity:
          decoded[1],
        checksumValue:
          decoded[2],
      });
    },
    metadataForAppend: () =>
      input.metadata,
    temporaryEntryIdentityForAppend:
      () =>
        input
          .temporaryEntryIdentity,
    manifestMetadataForAppend:
      () =>
        input.manifestMetadata,
  });
}

function assertCallerDeadline(): void {
  const value =
    process.env
      .EUM_STUDIO_POC_3_REVISION_PROCESS_TEST_DEADLINE_EPOCH_MS;
  const deadline =
    value === undefined
      ? Number.NaN
      : Number(value);
  if (
    !Number.isSafeInteger(deadline) ||
    deadline <= Date.now()
  ) {
    throw new Error(
      "EUM_STUDIO_POC_3_REVISION_PROCESS_TEST_DEADLINE_EPOCH_MS must be a caller-provided future epoch millisecond safe integer",
    );
  }
}

function waitForHolderRelease(
  command:
    Poc3RevisionRaceWorkerCommand,
): Promise<void> {
  return new Promise<void>(
    (resolveNow, rejectNow) => {
      if (process.send === undefined) {
        rejectNow(
          new Error(
            "POC-3 revision race holder requires an IPC parent",
          ),
        );
        return;
      }
      let settled = false;
      const handleRelease =
        (value: unknown) => {
          try {
            const release =
              parseWorkerRelease(
                value,
              );
            if (
              release.scenarioId !==
              command.profile
                .scenarioId
            ) {
              throw new Error(
                "POC-3 revision race release scenario mismatch",
              );
            }
            settled = true;
            resolveNow();
          } catch (error) {
            settled = true;
            rejectNow(error);
          }
        };
      process.once(
        "message",
        handleRelease,
      );
      process.send(
        {
          type:
            "poc-3-revision-race-worker-holding",
        },
        (error) => {
          if (
            error !== null &&
            !settled
          ) {
            process.off(
              "message",
              handleRelease,
            );
            settled = true;
            rejectNow(error);
          }
        },
      );
    },
  );
}

async function runWorkerCommand(
  value: unknown,
  enterHolderPending?:
    () => Promise<void>,
): Promise<void> {
  const command =
    parseWorkerCommand(value);
  const blobStore =
    await createNodeImmutableBlobStore(
      command.profile
        .blobStoreProfile,
    );
  const ledger =
    await openNodeSqliteLedger(
      command.profile
        .storageOpenProfile,
    );
  try {
    const holderGate =
      command.role === "holder"
        ? createPoc3RevisionCrashGate({
            profile:
              command.profile,
            callerChecksum:
              command.callerChecksum,
            enterPending: () =>
              enterHolderPending ===
              undefined
                ? waitForHolderRelease(
                    command,
                  )
                : enterHolderPending(),
          })
        : undefined;
    const revisionStore =
      ledger.createRevisionStore({
        blobStore,
        blobProfile:
          createRevisionBlobProfile(
            command.profile
              .revisionBlobProfile,
          ),
        ...(holderGate === undefined
          ? {}
          : {
              beforeDatabaseCommit:
                holderGate
                  .beforeDatabaseCommit,
            }),
      });
    const input =
      command.profile.appendInput;
    await revisionStore.append({
      revisionId:
        entityId<"DocumentRevision">(
          input.revisionId,
        ),
      workId: entityId<"Work">(
        input.workId,
      ),
      documentId:
        entityId<"Document">(
          input.documentId,
        ),
      expectedCurrentRevisionId:
        entityId<"DocumentRevision">(
          input
            .expectedCurrentRevisionId,
        ),
      content: input.content,
      ...(input.changeSetRef ===
      undefined
        ? {}
        : {
            changeSetRef:
              input.changeSetRef,
          }),
      cause: input.cause,
      createdAt: input.createdAt,
      durableAt: input.durableAt,
    });
  } finally {
    ledger.close();
  }
}

function sanitizedErrorName(
  error: unknown,
): string {
  const candidate =
    error instanceof Error
      ? error.name
      : typeof error;
  return /^[A-Za-z][A-Za-z0-9]*$/.test(
    candidate,
  )
    ? candidate
    : "Error";
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
  }
  if (
    error instanceof Error &&
    /^Revision conflict for document .+$/.test(
      error.message,
    )
  ) {
    return "REVISION_CONFLICT";
  }
  if (
    typeof error === "object" &&
    error !== null
  ) {
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

export type Poc3RevisionRaceProbeOutcome =
  | {
      readonly type:
        "poc-3-revision-race-probe-completed";
    }
  | {
      readonly type:
        "poc-3-revision-race-probe-failed";
      readonly errorName: string;
      readonly errorCode: string;
    };

export async function runPoc3RevisionRaceProbe(
  value: unknown,
  enterHolderPending?:
    () => Promise<void>,
): Promise<
  Poc3RevisionRaceProbeOutcome
> {
  try {
    await runWorkerCommand(
      value,
      enterHolderPending,
    );
    return Object.freeze({
      type:
        "poc-3-revision-race-probe-completed",
    });
  } catch (error) {
    return Object.freeze({
      type:
        "poc-3-revision-race-probe-failed",
      errorName:
        sanitizedErrorName(error),
      errorCode:
        sanitizedErrorCode(error),
    });
  }
}

function sendFinalReply(
  value: Readonly<
    Record<string, string>
  >,
  exitCode: number,
): Promise<void> {
  process.exitCode = exitCode;
  return new Promise<void>(
    (resolveNow) => {
      if (
        process.send === undefined ||
        !process.connected
      ) {
        resolveNow();
        return;
      }
      process.send(
        value,
        (error) => {
          if (error !== null) {
            process.exitCode = 1;
          }
          if (process.connected) {
            process.disconnect?.();
          }
          resolveNow();
        },
      );
    },
  );
}

async function startWorker():
Promise<void> {
  assertCallerDeadline();
  if (process.send === undefined) {
    throw new Error(
      "POC-3 revision race worker requires an IPC parent",
    );
  }
  process.once(
    "message",
    (value: unknown) => {
      void runWorkerCommand(value)
        .then(() =>
          sendFinalReply(
            {
              type:
                "poc-3-revision-race-worker-completed",
            },
            0,
          ),
        )
        .catch((error: unknown) =>
          sendFinalReply(
            {
              type:
                "poc-3-revision-race-worker-failed",
              errorName:
                sanitizedErrorName(
                  error,
                ),
              errorCode:
                sanitizedErrorCode(
                  error,
                ),
            },
            1,
          ),
        );
    },
  );
  process.send({
    type:
      "poc-3-revision-race-worker-ready",
  });
}

if (
  process.env
    .EUM_STUDIO_POC_3_REVISION_RACE_WORKER ===
    "1"
) {
  void startWorker()
    .catch((error: unknown) =>
      sendFinalReply(
        {
          type:
            "poc-3-revision-race-worker-failed",
          errorName:
            sanitizedErrorName(
              error,
            ),
          errorCode:
            sanitizedErrorCode(
              error,
            ),
        },
        1,
      ),
    );
}
