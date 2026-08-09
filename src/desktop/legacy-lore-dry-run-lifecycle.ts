import { createHash } from "node:crypto";
import { access, readFile, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { BlobAddress } from "../application/storage/blob-store";
import type {
  NodeSqliteBackupCanonicalBytesAdapter,
  NodeSqliteBackupChecksumAdapter,
  NodeSqliteBackupFormat,
  NodeSqliteBackupManifest,
  NodeSqliteBackupManifestCodec,
  NodeSqliteBackupSqliteOptions,
  NodeSqliteRestorePreflightPort,
} from "../platform/storage/node-sqlite-backup";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
} from "../platform/storage/node-sqlite-backup";
import { createNodeImmutableBlobStore } from "../platform/storage/node-immutable-blob-store";
import type { NodeImmutableBlobStoreProfile } from "../platform/storage/node-immutable-blob-store-profile";
import {
  createLocalWorkspaceStorageProfiles,
} from "./local-workspace-runtime";
import {
  regenerateLegacyLoreDryRunReport,
  writeLegacyLoreDryRun,
  type WriteLegacyLoreDryRunInput,
} from "./legacy-lore-dry-run-writer";

type ErrorWithCode = {
  readonly code?: unknown;
};

export type LegacyLoreDryRunLifecycleChecksumProfile = {
  readonly identity: string;
  readonly algorithm: string;
};

export type DiscardLegacyLoreDryRunInput = {
  readonly dryRunTargetRootPath: string;
  readonly sourceArchiveRootPath: string;
  readonly sourceArchiveProofPaths: readonly string[];
  readonly checksum: LegacyLoreDryRunLifecycleChecksumProfile;
};

export type DiscardLegacyLoreDryRunReceipt = {
  readonly removedTargetRootPath: string;
  readonly preservedSourceArchiveRootPath: string;
  readonly sourceArchiveProofCount: number;
};

export type BackupRestoreLegacyLoreDryRunInput = {
  readonly writerInput: WriteLegacyLoreDryRunInput;
  readonly temporaryBundleRootPath: string;
  readonly finalBundleRootPath: string;
  readonly restoreStagingRootPath: string;
  readonly restoreFinalRootPath: string;
  readonly bundleDatabaseEntrySegments: readonly string[];
  readonly bundleManifestEntrySegments: readonly string[];
  readonly bundleManifestChecksumEntrySegments: readonly string[];
  readonly bundleBlobEntrySegments: (
    address: BlobAddress,
  ) => readonly string[];
  readonly format: NodeSqliteBackupFormat;
  readonly sqlite: NodeSqliteBackupSqliteOptions;
  readonly checksum: LegacyLoreDryRunLifecycleChecksumProfile;
  readonly createdAt: string;
  readonly restorePreflight: NodeSqliteRestorePreflightPort;
};

export type BackupRestoreLegacyLoreDryRunReceipt = {
  readonly backupBundleRootPath: string;
  readonly restoredTargetRootPath: string;
  readonly reportRegenerated: true;
  readonly countsMatch: true;
  readonly checksumsMatch: true;
};

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === code
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const relation = relative(resolve(rootPath), resolve(candidatePath));
  return (
    relation.length === 0 ||
    (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${sep}`))
  );
}

function checksumBytes(
  profile: LegacyLoreDryRunLifecycleChecksumProfile,
  bytes: Uint8Array,
): string {
  return createHash(profile.algorithm).update(bytes).digest("hex");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

function createBackupAdapters(
  checksumProfile: LegacyLoreDryRunLifecycleChecksumProfile,
): {
  readonly canonicalBytes: NodeSqliteBackupCanonicalBytesAdapter;
  readonly manifestCodec: NodeSqliteBackupManifestCodec;
  readonly checksum: NodeSqliteBackupChecksumAdapter;
} {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const canonicalBytes: NodeSqliteBackupCanonicalBytesAdapter = Object.freeze({
    encode: (value: unknown) =>
      encoder.encode(JSON.stringify(canonicalValue(value))),
    decode: (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)),
  });
  return Object.freeze({
    canonicalBytes,
    manifestCodec: Object.freeze({
      encodeCanonical: (manifest: NodeSqliteBackupManifest) =>
        canonicalBytes.encode(manifest),
      decodeCanonical: (bytes: Uint8Array) =>
        canonicalBytes.decode(bytes) as NodeSqliteBackupManifest,
    }),
    checksum: Object.freeze({
      identity: checksumProfile.identity,
      checksum: (bytes: Uint8Array) => checksumBytes(checksumProfile, bytes),
    }),
  });
}

function localBlobEntrySegments(
  profile: NodeImmutableBlobStoreProfile,
  address: BlobAddress,
): readonly string[] {
  let offset = 0;
  const shards = profile.publishedLayout.shardWidths.map((width) => {
    const shard = address.checksumValue.slice(offset, offset + width);
    offset += width;
    return shard;
  });
  return Object.freeze([
    ...profile.publishedLayout.directorySegments,
    ...shards,
    `${profile.publishedLayout.fileNamePrefix}${address.checksumValue}${profile.publishedLayout.fileNameSuffix}`,
  ]);
}

function relativePathSegments(
  rootPath: string,
  path: string,
): readonly string[] {
  const relation = relative(resolve(rootPath), resolve(path));
  if (
    relation.length === 0 ||
    isAbsolute(relation) ||
    relation === ".." ||
    relation.startsWith(`..${sep}`)
  ) {
    throw new Error("Local workspace path is outside its root");
  }
  return Object.freeze(relation.split(sep));
}

export async function discardLegacyLoreDryRun(
  input: DiscardLegacyLoreDryRunInput,
): Promise<DiscardLegacyLoreDryRunReceipt> {
  if (
    !isAbsolute(input.dryRunTargetRootPath) ||
    !isAbsolute(input.sourceArchiveRootPath)
  ) {
    throw new Error("Dry-run lifecycle roots must be absolute");
  }
  const targetRoot = resolve(input.dryRunTargetRootPath);
  const archiveRoot = resolve(input.sourceArchiveRootPath);
  if (isInside(targetRoot, archiveRoot) || isInside(archiveRoot, targetRoot)) {
    throw new Error("Dry-run target and source archive must be separate trees");
  }
  const proofBefore = new Map<string, string>();
  for (const proofPath of input.sourceArchiveProofPaths) {
    if (!isAbsolute(proofPath) || !isInside(archiveRoot, proofPath)) {
      throw new Error("Source archive proof must stay inside the archive root");
    }
    proofBefore.set(
      resolve(proofPath),
      checksumBytes(input.checksum, await readFile(proofPath)),
    );
  }
  await rm(targetRoot, { recursive: true, force: true });
  if (await pathExists(targetRoot)) {
    throw new Error("Dry-run target still exists after discard");
  }
  for (const [proofPath, checksumBefore] of proofBefore) {
    const checksumAfter = checksumBytes(input.checksum, await readFile(proofPath));
    if (checksumAfter !== checksumBefore) {
      throw new Error("Source archive changed while discarding the dry-run target");
    }
  }
  return Object.freeze({
    removedTargetRootPath: targetRoot,
    preservedSourceArchiveRootPath: archiveRoot,
    sourceArchiveProofCount: proofBefore.size,
  });
}

export async function backupAndRestoreLegacyLoreDryRun(
  input: BackupRestoreLegacyLoreDryRunInput,
): Promise<BackupRestoreLegacyLoreDryRunReceipt> {
  const source = await writeLegacyLoreDryRun(input.writerInput);
  const sourceProfiles = createLocalWorkspaceStorageProfiles(
    source.targetRootDirectoryPath,
  );
  const restoredProfiles = createLocalWorkspaceStorageProfiles(
    input.restoreFinalRootPath,
  );
  const adapters = createBackupAdapters(input.checksum);
  const bundleLayout = Object.freeze({
    databaseEntrySegments: input.bundleDatabaseEntrySegments,
    manifestEntrySegments: input.bundleManifestEntrySegments,
    manifestChecksumEntrySegments:
      input.bundleManifestChecksumEntrySegments,
    blobEntrySegments: input.bundleBlobEntrySegments,
  });
  const created = await createNodeSqliteBackupBundle({
    sourceDatabasePath: sourceProfiles.databasePath,
    sourceBlobStore: await createNodeImmutableBlobStore(
      sourceProfiles.blobStoreProfile,
    ),
    temporaryBundleRoot: input.temporaryBundleRootPath,
    finalBundleRoot: input.finalBundleRootPath,
    layout: bundleLayout,
    format: input.format,
    sqlite: input.sqlite,
    manifestCodec: adapters.manifestCodec,
    canonicalBytes: adapters.canonicalBytes,
    checksum: adapters.checksum,
    clock: Object.freeze({ now: () => input.createdAt }),
  });
  const restored = await restoreNodeSqliteBackupBundle({
    finalBundleRoot: input.finalBundleRootPath,
    bundleLayout,
    targetStagingRoot: input.restoreStagingRootPath,
    targetFinalRoot: input.restoreFinalRootPath,
    targetLayout: Object.freeze({
      databaseEntrySegments: relativePathSegments(
        input.restoreFinalRootPath,
        restoredProfiles.databasePath,
      ),
      blobEntrySegments: (address: BlobAddress) =>
        localBlobEntrySegments(restoredProfiles.blobStoreProfile, address),
    }),
    expectedFormat: input.format,
    manifestCodec: adapters.manifestCodec,
    canonicalBytes: adapters.canonicalBytes,
    checksum: adapters.checksum,
    preflight: input.restorePreflight,
  });
  if (
    JSON.stringify(restored.restoredCounts) !==
      JSON.stringify(created.manifest.counts) ||
    JSON.stringify(restored.logicalChecksums) !==
      JSON.stringify(created.manifest.logicalChecksums)
  ) {
    throw new Error("Restored dry-run counts or checksums differ from backup");
  }
  const regenerated = await regenerateLegacyLoreDryRunReport({
    ...input.writerInput,
    targetRootDirectoryPath: input.restoreFinalRootPath,
  });
  if (JSON.stringify(regenerated) !== JSON.stringify(source.report)) {
    throw new Error("Restored dry-run migration report differs from source");
  }
  return Object.freeze({
    backupBundleRootPath: input.finalBundleRootPath,
    restoredTargetRootPath: input.restoreFinalRootPath,
    reportRegenerated: true,
    countsMatch: true,
    checksumsMatch: true,
  });
}
