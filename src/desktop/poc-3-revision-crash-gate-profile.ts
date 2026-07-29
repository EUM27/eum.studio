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

import type {
  BlobMetadata,
} from "../application/storage/blob-store";
import {
  parseNodeImmutableBlobStoreProfile,
  type NodeImmutableBlobStoreProfile,
} from "../platform/storage/node-immutable-blob-store-profile";
import {
  parsePoc3StorageOpenProfile,
  type Poc3StorageOpenProfile,
} from "../platform/storage/node-sqlite-ledger-profile";

export type Poc3RevisionCrashCallerChecksum = {
  readonly identity: string;
  readonly algorithm: string;
  readonly value: string;
};

export type Poc3RevisionCrashBlobProfile = {
  readonly codecIdentity: string;
  readonly encoding: string;
  readonly contentHashAlgorithm:
    string;
  readonly contentLengthOffset:
    number;
  readonly blobReferenceIdentity:
    string;
  readonly metadata: BlobMetadata;
  readonly temporaryEntryIdentity:
    string;
  readonly manifestMetadata: {
    readonly createdAt: string;
    readonly mediaType: string;
    readonly originalName: string;
  };
};

export type Poc3RevisionCrashAppendInput = {
  readonly revisionId: string;
  readonly workId: string;
  readonly documentId: string;
  readonly expectedCurrentRevisionId:
    string;
  readonly content: string;
  readonly changeSetRef?: string;
  readonly cause: string;
  readonly createdAt: string;
  readonly durableAt: string;
};

export type Poc3RevisionCrashGateProfile = {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly reachedPath: string;
  readonly reachedTemporaryPath:
    string;
  readonly storageOpenProfile:
    Poc3StorageOpenProfile;
  readonly blobStoreProfile:
    NodeImmutableBlobStoreProfile;
  readonly revisionBlobProfile:
    Poc3RevisionCrashBlobProfile;
  readonly appendInput:
    Poc3RevisionCrashAppendInput;
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
  allowEmpty = false,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    (
      !allowEmpty &&
      value.length === 0
    )
  ) {
    throw new Error(
      `${label}.${field} must be ${allowEmpty ? "a string" : "a non-empty string"}`,
    );
  }
  return value;
}

function readMetadata(
  value: unknown,
  label: string,
): BlobMetadata {
  const input = readRecord(
    value,
    label,
  );
  const parsed:
    Record<
      string,
      string |
      number |
      boolean |
      null
    > = {};
  for (
    const [field, entry]
    of Object.entries(input)
  ) {
    if (
      field.length === 0 ||
      !(
        entry === null ||
        typeof entry === "string" ||
        typeof entry === "boolean" ||
        (
          typeof entry === "number" &&
          Number.isSafeInteger(entry)
        )
      )
    ) {
      throw new Error(
        `${label} has an invalid metadata entry`,
      );
    }
    parsed[field] = entry;
  }
  return Object.freeze(parsed);
}

function readRevisionBlobProfile(
  value: unknown,
): Poc3RevisionCrashBlobProfile {
  const label =
    "POC-3 revision crash gate profile.revisionBlobProfile";
  const input = readRecord(
    value,
    label,
  );
  assertExactFields(
    input,
    [
      "codecIdentity",
      "encoding",
      "contentHashAlgorithm",
      "contentLengthOffset",
      "blobReferenceIdentity",
      "metadata",
      "temporaryEntryIdentity",
      "manifestMetadata",
    ],
    label,
  );
  const contentLengthOffset =
    input.contentLengthOffset;
  if (
    typeof contentLengthOffset !==
      "number" ||
    !Number.isSafeInteger(
      contentLengthOffset,
    ) ||
    contentLengthOffset < 0
  ) {
    throw new Error(
      `${label}.contentLengthOffset must be a non-negative safe integer`,
    );
  }
  const encoding =
    readString(
      input,
      "encoding",
      label,
    );
  if (!Buffer.isEncoding(encoding)) {
    throw new Error(
      `${label}.encoding is not supported by the current runtime`,
    );
  }
  const manifestLabel =
    `${label}.manifestMetadata`;
  const manifestInput =
    readRecord(
      input.manifestMetadata,
      manifestLabel,
    );
  assertExactFields(
    manifestInput,
    [
      "createdAt",
      "mediaType",
      "originalName",
    ],
    manifestLabel,
  );
  return Object.freeze({
    codecIdentity:
      readString(
        input,
        "codecIdentity",
        label,
      ),
    encoding,
    contentHashAlgorithm:
      readString(
        input,
        "contentHashAlgorithm",
        label,
      ),
    contentLengthOffset,
    blobReferenceIdentity:
      readString(
        input,
        "blobReferenceIdentity",
        label,
      ),
    metadata:
      readMetadata(
        input.metadata,
        `${label}.metadata`,
      ),
    temporaryEntryIdentity:
      readString(
        input,
        "temporaryEntryIdentity",
        label,
      ),
    manifestMetadata:
      Object.freeze({
        createdAt:
          readString(
            manifestInput,
            "createdAt",
            manifestLabel,
          ),
        mediaType:
          readString(
            manifestInput,
            "mediaType",
            manifestLabel,
          ),
        originalName:
          readString(
            manifestInput,
            "originalName",
            manifestLabel,
          ),
      }),
  });
}

function readAppendInput(
  value: unknown,
): Poc3RevisionCrashAppendInput {
  const label =
    "POC-3 revision crash gate profile.appendInput";
  const input = readRecord(
    value,
    label,
  );
  const requiredFields = [
    "revisionId",
    "workId",
    "documentId",
    "expectedCurrentRevisionId",
    "content",
    "cause",
    "createdAt",
    "durableAt",
  ] as const;
  const allowedFields =
    new Set<string>([
      ...requiredFields,
      "changeSetRef",
    ]);
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw new Error(
        `Unsupported ${label} field: ${field}`,
      );
    }
  }
  for (const field of requiredFields) {
    if (!(field in input)) {
      throw new Error(
        `${label} is missing ${field}`,
      );
    }
  }
  return Object.freeze({
    revisionId:
      readString(
        input,
        "revisionId",
        label,
      ),
    workId:
      readString(
        input,
        "workId",
        label,
      ),
    documentId:
      readString(
        input,
        "documentId",
        label,
      ),
    expectedCurrentRevisionId:
      readString(
        input,
        "expectedCurrentRevisionId",
        label,
      ),
    content:
      readString(
        input,
        "content",
        label,
        true,
      ),
    ...(
      "changeSetRef" in input
        ? {
            changeSetRef:
              readString(
                input,
                "changeSetRef",
                label,
              ),
          }
        : {}
    ),
    cause:
      readString(
        input,
        "cause",
        label,
      ),
    createdAt:
      readString(
        input,
        "createdAt",
        label,
      ),
    durableAt:
      readString(
        input,
        "durableAt",
        label,
      ),
  });
}

export function parsePoc3RevisionCrashCallerChecksum(
  value: unknown,
): Poc3RevisionCrashCallerChecksum {
  const label =
    "POC-3 revision crash caller checksum";
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

export function parsePoc3RevisionCrashGateProfile(
  value: unknown,
): Poc3RevisionCrashGateProfile {
  const label =
    "POC-3 revision crash gate profile";
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
      "blobStoreProfile",
      "revisionBlobProfile",
      "appendInput",
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
  if (!isAbsolute(reachedPath)) {
    throw new Error(
      `${label}.reachedPath must be absolute`,
    );
  }
  const reachedTemporaryPath =
    readString(
      input,
      "reachedTemporaryPath",
      label,
    );
  if (
    !isAbsolute(
      reachedTemporaryPath,
    )
  ) {
    throw new Error(
      `${label}.reachedTemporaryPath must be absolute`,
    );
  }
  const resolvedReachedPath =
    resolve(reachedPath);
  const resolvedTemporaryPath =
    resolve(reachedTemporaryPath);
  if (
    resolvedReachedPath ===
      resolvedTemporaryPath
  ) {
    throw new Error(
      `${label} marker paths must differ`,
    );
  }
  if (
    dirname(resolvedReachedPath) !==
    dirname(resolvedTemporaryPath)
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
      storageOpenProfile.databasePath,
    )
  ) {
    throw new Error(
      `${label}.storageOpenProfile.databasePath must be absolute`,
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
    reachedPath:
      resolvedReachedPath,
    reachedTemporaryPath:
      resolvedTemporaryPath,
    storageOpenProfile,
    blobStoreProfile:
      parseNodeImmutableBlobStoreProfile(
        input.blobStoreProfile,
      ),
    revisionBlobProfile:
      readRevisionBlobProfile(
        input.revisionBlobProfile,
      ),
    appendInput:
      readAppendInput(
        input.appendInput,
      ),
  });
}

export function checksumPoc3RevisionCrashGateProfile(
  profile:
    Poc3RevisionCrashGateProfile,
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
    Poc3RevisionCrashGateProfile,
  callerChecksum:
    Poc3RevisionCrashCallerChecksum,
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
          (error as NodeJS.ErrnoException)
            .code === "ENOENT"
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
    profile.reachedTemporaryPath;
  if (
    finalPath === temporaryPath ||
    dirname(finalPath) !==
      dirname(temporaryPath)
  ) {
    throw new Error(
      "POC-3 revision crash marker paths are not verified same-parent distinct paths",
    );
  }
  await assertAbsent(
    temporaryPath,
    "POC-3 revision crash temporary marker",
  );
  await assertAbsent(
    finalPath,
    "POC-3 revision crash final marker",
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      "poc-3-revision-crash-gate-reached",
      profile.schemaVersion,
      profile.scenarioId,
      profile.appendInput.revisionId,
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
        const { bytesWritten } =
          await handle.write(
            bytes,
            byteOffset,
            bytes.byteLength -
              byteOffset,
            null,
          );
        if (bytesWritten <= 0) {
          throw new Error(
            `POC-3 revision crash marker write made no progress: ${temporaryPath}`,
          );
        }
        byteOffset += bytesWritten;
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertAbsent(
      finalPath,
      "POC-3 revision crash final marker",
    );
    await rename(
      temporaryPath,
      finalPath,
    );
    createdTemporary = false;
  } catch (error) {
    if (createdTemporary) {
      if (
        temporaryPath === finalPath ||
        dirname(temporaryPath) !==
          dirname(finalPath)
      ) {
        throw new AggregateError(
          [error],
          "Refusing to clean an unverified POC-3 revision crash temporary marker",
          {
            cause: error,
          },
        );
      }
      try {
        await unlink(temporaryPath);
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
            "POC-3 revision crash marker publication and verified temporary cleanup both failed",
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

export function createPoc3RevisionCrashGate(input: {
  readonly profile:
    Poc3RevisionCrashGateProfile;
  readonly callerChecksum:
    Poc3RevisionCrashCallerChecksum;
  readonly enterPending:
    () => Promise<void>;
}): {
  beforeDatabaseCommit():
    Promise<void>;
} {
  return Object.freeze({
    async beforeDatabaseCommit() {
      await writeReachedMarker(
        input.profile,
        input.callerChecksum,
      );
      await input.enterPending();
    },
  });
}
