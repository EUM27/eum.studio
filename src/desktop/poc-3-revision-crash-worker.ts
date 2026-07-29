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

type Poc3RevisionCrashWorkerCommand = {
  readonly type:
    "poc-3-revision-crash-worker-run";
  readonly callerChecksum:
    Poc3RevisionCrashCallerChecksum;
  readonly profile:
    Poc3RevisionCrashGateProfile;
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

function parseWorkerCommand(
  value: unknown,
): Poc3RevisionCrashWorkerCommand {
  const label =
    "POC-3 revision crash worker command";
  const input = readRecord(
    value,
    label,
  );
  const fields = [
    "type",
    "callerChecksum",
    "profile",
  ] as const;
  const expected = new Set<string>(
    fields,
  );
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
  if (
    input.type !==
    "poc-3-revision-crash-worker-run"
  ) {
    throw new Error(
      `Unsupported ${label} type: ${String(input.type)}`,
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
      "POC-3 revision crash caller checksum mismatch",
    );
  }
  return Object.freeze({
    type:
      "poc-3-revision-crash-worker-run",
    callerChecksum,
    profile,
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
        const bytes = Buffer.from(
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
        checksumValue: decoded[2],
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

async function runWorkerCommand(
  value: unknown,
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
    const gate =
      createPoc3RevisionCrashGate({
        profile: command.profile,
        callerChecksum:
          command.callerChecksum,
        enterPending: () =>
          new Promise<void>(
            () => {
              // The parent harness terminates this process.
            },
          ),
      });
    const revisionStore =
      ledger.createRevisionStore({
        blobStore,
        blobProfile:
          createRevisionBlobProfile(
            command.profile
              .revisionBlobProfile,
          ),
        beforeDatabaseCommit:
          gate.beforeDatabaseCommit,
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
    process.send?.({
      type:
        "poc-3-revision-crash-worker-completed",
    });
  } finally {
    ledger.close();
  }
}

if (
  process.env
    .EUM_STUDIO_POC_3_REVISION_CRASH_WORKER ===
    "1"
) {
  if (process.send === undefined) {
    throw new Error(
      "POC-3 revision crash worker requires an IPC parent",
    );
  }
  process.on(
    "message",
    (value: unknown) => {
      void runWorkerCommand(value)
        .catch((error: unknown) => {
          process.send?.({
            type:
              "poc-3-revision-crash-worker-failed",
            errorName:
              error instanceof Error
                ? error.name
                : typeof error,
          });
        });
    },
  );
  process.send({
    type:
      "poc-3-revision-crash-worker-ready",
  });
}
