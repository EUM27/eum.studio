import {
  createHash,
} from "node:crypto";
import {
  link,
  mkdir,
  open,
  readdir,
  readFile,
  unlink,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  BlobCleanupRefusedError,
  BlobContentMismatchError,
  BlobNotFoundError,
  BlobPublicationConflictError,
} from "../../application/storage/blob-store";
import type {
  AppendImmutableBlobInput,
  AppendImmutableBlobReceipt,
  BlobAddress,
  BlobInventoryReport,
  BlobReachabilityQuery,
  CleanupImmutableBlobStoreInput,
  CleanupImmutableBlobStoreReceipt,
  ImmutableBlobStore,
  PublishedBlobInventoryEntry,
  ReadImmutableBlobReceipt,
  TemporaryBlobInventoryEntry,
} from "../../application/storage/blob-store";
import type {
  NodeImmutableBlobStoreProfile,
} from "./node-immutable-blob-store-profile";

type ErrorWithCode = {
  readonly code?: unknown;
};

export type NodeImmutableBlobFaultStage =
  | "partial-write"
  | "sync"
  | "publish";

export type NodeImmutableBlobFaultInjection = {
  readonly stage:
    NodeImmutableBlobFaultStage;
  readonly partialWriteByteCount:
    number;
  inject(): Promise<void>;
};

export type NodeImmutableBlobStoreOptions = {
  readonly faultInjection?:
    NodeImmutableBlobFaultInjection;
  readonly publicationConflictInjection?: {
    inject(): Promise<void>;
  };
};

function hasErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode)
      .code === code
  );
}

function resolveInside(
  rootDirectoryPath: string,
  segments: readonly string[],
  label: string,
  allowRoot: boolean,
): string {
  const candidate = resolve(
    rootDirectoryPath,
    ...segments,
  );
  const relation = relative(
    rootDirectoryPath,
    candidate,
  );
  if (
    isAbsolute(relation) ||
    relation === ".." ||
    relation.startsWith(
      `..${sep}`,
    ) ||
    (
      !allowRoot &&
      relation.length === 0
    )
  ) {
    throw new Error(
      `${label} resolves outside the caller root`,
    );
  }
  return candidate;
}

function assertEntryIdentity(
  identity: string,
): void {
  if (
    identity.length === 0 ||
    basename(identity) !==
      identity ||
    identity === "." ||
    identity === ".."
  ) {
    throw new Error(
      "temporaryEntryIdentity must be one relative path segment",
    );
  }
}

function checksumBytes(
  profile:
    NodeImmutableBlobStoreProfile,
  bytes: Uint8Array,
): string {
  return createHash(
    profile.checksum.algorithm,
  )
    .update(bytes)
    .digest("hex");
}

function publishedPathForChecksum(
  profile:
    NodeImmutableBlobStoreProfile,
  checksumValue: string,
): string {
  let offset = 0;
  const shards =
    profile.publishedLayout
      .shardWidths
      .map((width) => {
        const shard =
          checksumValue.slice(
            offset,
            offset + width,
          );
        if (
          shard.length !== width
        ) {
          throw new Error(
            "Caller shard layout exceeds the checksum address",
          );
        }
        offset += width;
        return shard;
      });
  const fileName =
    `${
      profile.publishedLayout
        .fileNamePrefix
    }${checksumValue}${
      profile.publishedLayout
        .fileNameSuffix
    }`;
  return resolveInside(
    profile.rootDirectoryPath,
    [
      ...profile.publishedLayout
        .directorySegments,
      ...shards,
      fileName,
    ],
    "Published blob path",
    false,
  );
}

function temporaryPathForIdentity(
  profile:
    NodeImmutableBlobStoreProfile,
  identity: string,
): string {
  assertEntryIdentity(identity);
  return resolveInside(
    profile.rootDirectoryPath,
    [
      ...profile.temporaryLayout
        .directorySegments,
      identity,
    ],
    "Temporary blob path",
    false,
  );
}

function equalBytes(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (
    left.byteLength !==
      right.byteLength
  ) {
    return false;
  }
  return left.every(
    (value, index) =>
      value === right[index],
  );
}

async function verifyExisting(
  path: string,
  expectedBytes: Uint8Array,
  expectedChecksum: string,
  profile:
    NodeImmutableBlobStoreProfile,
): Promise<boolean> {
  let existing: Uint8Array;
  try {
    existing =
      new Uint8Array(
        await readFile(path),
      );
  } catch (error) {
    if (
      hasErrorCode(
        error,
        "ENOENT",
      )
    ) {
      return false;
    }
    throw error;
  }
  const actualChecksum =
    checksumBytes(
      profile,
      existing,
    );
  if (
    actualChecksum !==
      expectedChecksum ||
    !equalBytes(
      existing,
      expectedBytes,
    )
  ) {
    throw new BlobContentMismatchError(
      "Existing checksum address does not contain the exact caller bytes",
    );
  }
  return true;
}

async function writeAll(
  handle: Awaited<
    ReturnType<typeof open>
  >,
  bytes: Uint8Array,
  fileOffset: number,
): Promise<void> {
  let offset = 0;
  while (
    offset < bytes.byteLength
  ) {
    const result =
      await handle.write(
        bytes,
        offset,
        bytes.byteLength -
          offset,
        fileOffset + offset,
      );
    if (
      result.bytesWritten <= 0
    ) {
      throw new Error(
        "Blob temporary write made no progress",
      );
    }
    offset += result.bytesWritten;
  }
}

async function listFilePaths(
  directoryPath: string,
): Promise<readonly string[]> {
  const entries =
    await readdir(
      directoryPath,
      {
        withFileTypes: true,
      },
    );
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = resolve(
      directoryPath,
      entry.name,
    );
    if (entry.isDirectory()) {
      files.push(
        ...await listFilePaths(
          entryPath,
        ),
      );
    } else if (entry.isFile()) {
      files.push(entryPath);
    } else {
      throw new Error(
        "Blob inventory encountered an unsupported filesystem entry",
      );
    }
  }
  return files;
}

function relativePathSegments(
  profile:
    NodeImmutableBlobStoreProfile,
  path: string,
): readonly string[] {
  const relation = relative(
    profile.rootDirectoryPath,
    path,
  );
  const segments =
    relation.split(sep);
  resolveInside(
    profile.rootDirectoryPath,
    segments,
    "Inventory entry",
    false,
  );
  return Object.freeze(segments);
}

function checksumFromPublishedName(
  profile:
    NodeImmutableBlobStoreProfile,
  path: string,
  actualChecksumValue: string,
): string {
  const name = basename(path);
  const {
    fileNamePrefix,
    fileNameSuffix,
  } = profile.publishedLayout;
  const startsCorrectly =
    name.startsWith(
      fileNamePrefix,
    );
  const endsCorrectly =
    name.endsWith(
      fileNameSuffix,
    );
  const endOffset =
    name.length -
    fileNameSuffix.length;
  if (
    startsCorrectly &&
    endsCorrectly &&
    endOffset >=
      fileNamePrefix.length
  ) {
    const candidate =
      name.slice(
        fileNamePrefix.length,
        endOffset,
      );
    if (candidate.length > 0) {
      return candidate;
    }
  }
  return actualChecksumValue;
}

async function readPublishedInventory(
  profile:
    NodeImmutableBlobStoreProfile,
  directoryPath: string,
  reachability:
    BlobReachabilityQuery,
): Promise<
  readonly PublishedBlobInventoryEntry[]
> {
  const files =
    await listFilePaths(
      directoryPath,
    );
  const published =
    await Promise.all(
      files.map(async (path) => {
        const bytes =
          new Uint8Array(
            await readFile(path),
          );
        const actualChecksumValue =
          checksumBytes(
            profile,
            bytes,
          );
        const checksumValue =
          checksumFromPublishedName(
            profile,
            path,
            actualChecksumValue,
          );
        const address =
          Object.freeze({
            checksumIdentity:
              profile.checksum
                .identity,
            checksumValue,
          });
        const expectedPath =
          publishedPathForChecksum(
            profile,
            checksumValue,
          );
        return Object.freeze({
          address,
          actualChecksumValue,
          byteLength:
            bytes.byteLength,
          relativePathSegments:
            relativePathSegments(
              profile,
              path,
            ),
          status:
            (
              expectedPath === path &&
              actualChecksumValue ===
                checksumValue
            )
              ? "verified"
              : "corrupt",
          reachable:
            await reachability
              .isReachable(
                address,
              ),
        }) satisfies
          PublishedBlobInventoryEntry;
      }),
    );
  return Object.freeze(
    published.sort((left, right) =>
      JSON.stringify(
        left.relativePathSegments,
      ).localeCompare(
        JSON.stringify(
          right
            .relativePathSegments,
        ),
      ),
    ),
  );
}

async function readTemporaryInventory(
  profile:
    NodeImmutableBlobStoreProfile,
  directoryPath: string,
): Promise<
  readonly TemporaryBlobInventoryEntry[]
> {
  const files =
    await listFilePaths(
      directoryPath,
    );
  const temporary =
    await Promise.all(
      files.map(async (path) => {
        const bytes =
          new Uint8Array(
            await readFile(path),
          );
        return Object.freeze({
          temporaryEntryIdentity:
            basename(path),
          actualChecksumValue:
            checksumBytes(
              profile,
              bytes,
            ),
          byteLength:
            bytes.byteLength,
          relativePathSegments:
            relativePathSegments(
              profile,
              path,
            ),
        }) satisfies
          TemporaryBlobInventoryEntry;
      }),
    );
  return Object.freeze(
    temporary.sort((left, right) =>
      JSON.stringify(
        left.relativePathSegments,
      ).localeCompare(
        JSON.stringify(
          right
            .relativePathSegments,
        ),
      ),
    ),
  );
}

function inventoryFingerprint(
  profile:
    NodeImmutableBlobStoreProfile,
  published:
    readonly PublishedBlobInventoryEntry[],
  temporary:
    readonly TemporaryBlobInventoryEntry[],
): string {
  return createHash(
    profile.checksum.algorithm,
  )
    .update(
      JSON.stringify({
        checksumIdentity:
          profile.checksum.identity,
        published:
          published.map(
            (entry) => ({
              address:
                entry.address,
              actualChecksumValue:
                entry
                  .actualChecksumValue,
              byteLength:
                entry.byteLength,
              relativePathSegments:
                entry
                  .relativePathSegments,
              status:
                entry.status,
            }),
          ),
        temporary,
      }),
      "utf8",
    )
    .digest("hex");
}

async function readInventoryReport(
  profile:
    NodeImmutableBlobStoreProfile,
  publishedDirectory: string,
  temporaryDirectory: string,
  reachability:
    BlobReachabilityQuery,
): Promise<BlobInventoryReport> {
  const published =
    await readPublishedInventory(
      profile,
      publishedDirectory,
      reachability,
    );
  const temporary =
    await readTemporaryInventory(
      profile,
      temporaryDirectory,
    );
  return Object.freeze({
    checksumIdentity:
      profile.checksum.identity,
    fingerprint:
      inventoryFingerprint(
        profile,
        published,
        temporary,
      ),
    published,
    temporary,
  });
}

function sameAddress(
  left: BlobAddress,
  right: BlobAddress,
): boolean {
  return (
    left.checksumIdentity ===
      right.checksumIdentity &&
    left.checksumValue ===
      right.checksumValue
  );
}

function sameSegments(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (segment, index) =>
        segment === right[index],
    )
  );
}

function cleanupCandidatePath(
  profile:
    NodeImmutableBlobStoreProfile,
  expectedDirectoryPath: string,
  segments: readonly string[],
  label: string,
): string {
  const candidate =
    resolveInside(
      profile.rootDirectoryPath,
      segments,
      label,
      false,
    );
  const relation =
    relative(
      expectedDirectoryPath,
      candidate,
    );
  if (
    isAbsolute(relation) ||
    relation === ".." ||
    relation.startsWith(
      `..${sep}`,
    ) ||
    relation.length === 0
  ) {
    throw new BlobCleanupRefusedError(
      `${label} is not inside its caller-selected inventory directory`,
    );
  }
  return candidate;
}

async function readCleanupCandidate(
  path: string,
  label: string,
): Promise<Uint8Array> {
  try {
    return new Uint8Array(
      await readFile(path),
    );
  } catch {
    throw new BlobCleanupRefusedError(
      `${label} changed after inventory`,
    );
  }
}

async function verifyPublishedCleanupCandidate(
  profile:
    NodeImmutableBlobStoreProfile,
  publishedDirectory: string,
  entry:
    PublishedBlobInventoryEntry,
): Promise<string> {
  const path =
    cleanupCandidatePath(
      profile,
      publishedDirectory,
      entry.relativePathSegments,
      "Published cleanup candidate",
    );
  const bytes =
    await readCleanupCandidate(
      path,
      "Published cleanup candidate",
    );
  const actualChecksumValue =
    checksumBytes(
      profile,
      bytes,
    );
  if (
    entry.status !==
      "verified" ||
    entry.address
      .checksumIdentity !==
      profile.checksum.identity ||
    actualChecksumValue !==
      entry.actualChecksumValue ||
    actualChecksumValue !==
      entry.address
        .checksumValue ||
    bytes.byteLength !==
      entry.byteLength ||
    publishedPathForChecksum(
      profile,
      entry.address
        .checksumValue,
    ) !== path ||
    !sameSegments(
      relativePathSegments(
        profile,
        path,
      ),
      entry.relativePathSegments,
    )
  ) {
    throw new BlobCleanupRefusedError(
      "Published cleanup candidate changed after inventory",
    );
  }
  return path;
}

async function verifyTemporaryCleanupCandidate(
  profile:
    NodeImmutableBlobStoreProfile,
  temporaryDirectory: string,
  entry:
    TemporaryBlobInventoryEntry,
): Promise<string> {
  const path =
    cleanupCandidatePath(
      profile,
      temporaryDirectory,
      entry.relativePathSegments,
      "Temporary cleanup candidate",
    );
  const bytes =
    await readCleanupCandidate(
      path,
      "Temporary cleanup candidate",
    );
  if (
    basename(path) !==
      entry
        .temporaryEntryIdentity ||
    checksumBytes(
      profile,
      bytes,
    ) !==
      entry.actualChecksumValue ||
    bytes.byteLength !==
      entry.byteLength ||
    !sameSegments(
      relativePathSegments(
        profile,
        path,
      ),
      entry.relativePathSegments,
    )
  ) {
    throw new BlobCleanupRefusedError(
      "Temporary cleanup candidate changed after inventory",
    );
  }
  return path;
}

function receipt(
  profile:
    NodeImmutableBlobStoreProfile,
  input:
    AppendImmutableBlobInput,
  checksumValue: string,
  publication:
    AppendImmutableBlobReceipt[
      "publication"
    ],
): AppendImmutableBlobReceipt {
  return Object.freeze({
    address: Object.freeze({
      checksumIdentity:
        profile.checksum.identity,
      checksumValue,
    }),
    byteLength:
      input.bytes.byteLength,
    metadata: input.metadata,
    publication,
  });
}

export async function createNodeImmutableBlobStore(
  profile:
    NodeImmutableBlobStoreProfile,
  options?:
    NodeImmutableBlobStoreOptions,
): Promise<
  ImmutableBlobStore
> {
  const publishedDirectory =
    resolveInside(
      profile.rootDirectoryPath,
      profile.publishedLayout
        .directorySegments,
      "Published blob directory",
      true,
    );
  const temporaryDirectory =
    resolveInside(
      profile.rootDirectoryPath,
      profile.temporaryLayout
        .directorySegments,
      "Temporary blob directory",
      true,
    );
  await mkdir(
    publishedDirectory,
    {
      recursive: true,
    },
  );
  await mkdir(
    temporaryDirectory,
    {
      recursive: true,
    },
  );

  return Object.freeze({
    append: async (
      input:
        AppendImmutableBlobInput,
    ): Promise<
      AppendImmutableBlobReceipt
    > => {
      const bytes =
        Uint8Array.from(
          input.bytes,
        );
      const checksumValue =
        checksumBytes(
          profile,
          bytes,
        );
      const publishedPath =
        publishedPathForChecksum(
          profile,
          checksumValue,
        );
      if (
        await verifyExisting(
          publishedPath,
          bytes,
          checksumValue,
          profile,
        )
      ) {
        return receipt(
          profile,
          input,
          checksumValue,
          "existing-verified",
        );
      }

      const temporaryPath =
        temporaryPathForIdentity(
          profile,
          input
            .temporaryEntryIdentity,
        );
      await mkdir(
        dirname(publishedPath),
        {
          recursive: true,
        },
      );
      const handle = await open(
        temporaryPath,
        "wx",
      );
      try {
        const faultInjection =
          options?.faultInjection;
        if (
          faultInjection?.stage ===
          "partial-write"
        ) {
          const partialWriteByteCount =
            faultInjection
              .partialWriteByteCount;
          if (
            !Number.isSafeInteger(
              partialWriteByteCount,
            ) ||
            partialWriteByteCount <=
              0 ||
            partialWriteByteCount >=
              bytes.byteLength
          ) {
            throw new Error(
              "partialWriteByteCount must select a non-empty proper prefix",
            );
          }
          await writeAll(
            handle,
            bytes.subarray(
              0,
              partialWriteByteCount,
            ),
            0,
          );
          await faultInjection
            .inject();
          await writeAll(
            handle,
            bytes.subarray(
              partialWriteByteCount,
            ),
            partialWriteByteCount,
          );
        } else {
          await writeAll(
            handle,
            bytes,
            0,
          );
        }
        if (
          faultInjection?.stage ===
          "sync"
        ) {
          await faultInjection
            .inject();
        }
        await handle.sync();
      } finally {
        await handle.close();
      }

      if (
        options
          ?.faultInjection
          ?.stage === "publish"
      ) {
        await options
          .faultInjection
          .inject();
      }
      try {
        await link(
          temporaryPath,
          publishedPath,
        );
      } catch (error) {
        if (
          !hasErrorCode(
            error,
            "EEXIST",
          )
        ) {
          throw error;
        }
        await options
          ?.publicationConflictInjection
          ?.inject();
        if (
          !await verifyExisting(
            publishedPath,
            bytes,
            checksumValue,
            profile,
          )
        ) {
          throw new BlobPublicationConflictError(
            "Publication conflict target disappeared before exact verification",
          );
        }
        await unlink(
          temporaryPath,
        );
        return receipt(
          profile,
          input,
          checksumValue,
          "existing-verified",
        );
      }
      await unlink(temporaryPath);
      return receipt(
        profile,
        input,
        checksumValue,
        "published",
      );
    },
    readExact: async (
      address: BlobAddress,
    ): Promise<
      ReadImmutableBlobReceipt
    > => {
      if (
        address.checksumIdentity !==
          profile.checksum.identity
      ) {
        throw new BlobContentMismatchError(
          "Blob address checksum identity does not match the caller profile",
        );
      }
      const path =
        publishedPathForChecksum(
          profile,
          address.checksumValue,
        );
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(
          await readFile(path),
        );
      } catch (error) {
        if (
          hasErrorCode(
            error,
            "ENOENT",
          )
        ) {
          throw new BlobNotFoundError(
            "Published blob is missing at its exact address",
          );
        }
        throw error;
      }
      const actualChecksumValue =
        checksumBytes(
          profile,
          bytes,
        );
      if (
        actualChecksumValue !==
          address.checksumValue
      ) {
        throw new BlobContentMismatchError(
          "Published blob bytes do not match their exact checksum address",
        );
      }
      return Object.freeze({
        address: Object.freeze({
          checksumIdentity:
            address.checksumIdentity,
          checksumValue:
            address.checksumValue,
        }),
        bytes,
        byteLength:
          bytes.byteLength,
      });
    },
    inventory: async (
      input:
        BlobReachabilityQuery,
    ): Promise<
      BlobInventoryReport
    > =>
      readInventoryReport(
        profile,
        publishedDirectory,
        temporaryDirectory,
        input,
      ),
    cleanup: async (
      input:
        CleanupImmutableBlobStoreInput,
    ): Promise<
      CleanupImmutableBlobStoreReceipt
    > => {
      const before =
        await readInventoryReport(
          profile,
          publishedDirectory,
          temporaryDirectory,
          input.reachability,
        );
      if (
        before.fingerprint !==
          input
            .expectedInventoryFingerprint
      ) {
        throw new BlobCleanupRefusedError(
          "Blob inventory fingerprint changed before cleanup",
        );
      }

      const publishedSelectionKeys =
        new Set<string>();
      const selectedPublished =
        input
          .selectedPublishedAddresses
          .map((address) => {
            const selectionKey =
              JSON.stringify([
                address
                  .checksumIdentity,
                address
                  .checksumValue,
              ]);
            if (
              publishedSelectionKeys.has(
                selectionKey,
              )
            ) {
              throw new BlobCleanupRefusedError(
                "Published cleanup selection contains a duplicate address",
              );
            }
            publishedSelectionKeys.add(
              selectionKey,
            );
            const matches =
              before.published.filter(
                (entry) =>
                  sameAddress(
                    entry.address,
                    address,
                  ),
              );
            if (
              matches.length !== 1 ||
              matches[0] ===
                undefined
            ) {
              throw new BlobCleanupRefusedError(
                "Published cleanup selection changed after inventory",
              );
            }
            if (
              matches[0].reachable
            ) {
              throw new BlobCleanupRefusedError(
                "Published cleanup selection is reachable",
              );
            }
            return matches[0];
          });
      const temporarySelectionIdentities =
        new Set<string>();
      const selectedTemporary =
        input
          .selectedTemporaryEntryIdentities
          .map((identity) => {
            if (
              temporarySelectionIdentities
                .has(identity)
            ) {
              throw new BlobCleanupRefusedError(
                "Temporary cleanup selection contains a duplicate identity",
              );
            }
            temporarySelectionIdentities
              .add(identity);
            const matches =
              before.temporary.filter(
                (entry) =>
                  entry
                    .temporaryEntryIdentity ===
                  identity,
              );
            if (
              matches.length !== 1 ||
              matches[0] ===
                undefined
            ) {
              throw new BlobCleanupRefusedError(
                "Temporary cleanup selection changed after inventory",
              );
            }
            return matches[0];
          });

      await Promise.all(
        selectedPublished.map(
          (entry) =>
            verifyPublishedCleanupCandidate(
              profile,
              publishedDirectory,
              entry,
            ),
        ),
      );
      await Promise.all(
        selectedTemporary.map(
          (entry) =>
            verifyTemporaryCleanupCandidate(
              profile,
              temporaryDirectory,
              entry,
            ),
        ),
      );

      for (
        const entry
        of selectedPublished
      ) {
        const path =
          await verifyPublishedCleanupCandidate(
            profile,
            publishedDirectory,
            entry,
          );
        if (
          await input
            .reachability
            .isReachable(
              entry.address,
            )
        ) {
          throw new BlobCleanupRefusedError(
            "Published cleanup selection became reachable before deletion",
          );
        }
        try {
          await unlink(path);
        } catch {
          throw new BlobCleanupRefusedError(
            "Published cleanup selection changed before deletion",
          );
        }
      }
      for (
        const entry
        of selectedTemporary
      ) {
        const path =
          await verifyTemporaryCleanupCandidate(
            profile,
            temporaryDirectory,
            entry,
          );
        try {
          await unlink(path);
        } catch {
          throw new BlobCleanupRefusedError(
            "Temporary cleanup selection changed before deletion",
          );
        }
      }

      const after =
        await readInventoryReport(
          profile,
          publishedDirectory,
          temporaryDirectory,
          input.reachability,
        );
      return Object.freeze({
        inventoryFingerprintBefore:
          before.fingerprint,
        inventoryFingerprintAfter:
          after.fingerprint,
        deletedPublishedAddresses:
          Object.freeze(
            selectedPublished.map(
              (entry) =>
                Object.freeze({
                  checksumIdentity:
                    entry.address
                      .checksumIdentity,
                  checksumValue:
                    entry.address
                      .checksumValue,
                }),
            ),
          ),
        deletedTemporaryEntryIdentities:
          Object.freeze(
            selectedTemporary.map(
              (entry) =>
                entry
                  .temporaryEntryIdentity,
            ),
          ),
      });
    },
  });
}
