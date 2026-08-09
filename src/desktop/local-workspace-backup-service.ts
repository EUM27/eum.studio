import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  readFile,
  rename,
  statfs,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { ImmutableBlobStore, BlobAddress } from "../application/storage/blob-store";
import {
  parseLocalWorkspaceBackupStatusProjection,
  parseLocalWorkspaceBackupSummary,
  type LocalWorkspaceBackupStatusProjection,
  type LocalWorkspaceBackupSummary,
} from "../application/storage/local-workspace-backup-contract";
import type { LocalWorkspaceBackupProfile } from "../application/storage/local-workspace-backup-profile";
import {
  createNodeSqliteBackupBundle,
  restoreNodeSqliteBackupBundle,
  type NodeSqliteBackupCanonicalBytesAdapter,
  type NodeSqliteBackupManifest,
  type NodeSqliteBackupManifestCodec,
} from "../platform/storage/node-sqlite-backup";

type ErrorWithCode = { readonly code?: unknown };

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

function createCanonicalAdapters(profile: LocalWorkspaceBackupProfile) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const canonicalBytes: NodeSqliteBackupCanonicalBytesAdapter = Object.freeze({
    encode: (value: unknown) => encoder.encode(JSON.stringify(canonicalValue(value))),
    decode: (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)),
  });
  const manifestCodec: NodeSqliteBackupManifestCodec = Object.freeze({
    encodeCanonical: (manifest: NodeSqliteBackupManifest) =>
      canonicalBytes.encode(manifest),
    decodeCanonical: (bytes: Uint8Array) =>
      canonicalBytes.decode(bytes) as NodeSqliteBackupManifest,
  });
  return Object.freeze({
    canonicalBytes,
    manifestCodec,
    checksum: Object.freeze({
      identity: profile.checksum.identity,
      checksum: (bytes: Uint8Array) =>
        createHash(profile.checksum.algorithm).update(bytes).digest("hex"),
    }),
  });
}

function blobEntrySegments(
  address: BlobAddress,
  layout: LocalWorkspaceBackupProfile["restoreLayout"],
): readonly string[] {
  const checksum = address.checksumValue;
  let offset = 0;
  const shards = layout.blobShardWidths.map((width) => {
    const shard = checksum.slice(offset, offset + width);
    offset += width;
    if (shard.length !== width) {
      throw new Error("Blob checksum is too short for the configured shard layout");
    }
    return shard;
  });
  return Object.freeze([
    ...layout.blobDirectorySegments,
    ...shards,
    `${checksum}${layout.blobFileNameSuffix}`,
  ]);
}

function temporarySibling(finalPath: string, label: string): string {
  const resolved = path.resolve(finalPath);
  const name = path.basename(resolved);
  if (name.length === 0) {
    throw new Error(`${label} must name a directory`);
  }
  return path.join(path.dirname(resolved), `.${name}.${randomUUID()}.tmp`);
}

async function readStatus(
  statePath: string,
): Promise<LocalWorkspaceBackupStatusProjection> {
  try {
    return parseLocalWorkspaceBackupStatusProjection(
      JSON.parse(await readFile(statePath, "utf8")),
    );
  } catch (error) {
    if ((error as ErrorWithCode).code === "ENOENT") {
      return Object.freeze({ schemaVersion: 1, lastVerified: null });
    }
    throw error;
  }
}

async function writeStatus(
  statePath: string,
  status: LocalWorkspaceBackupStatusProjection,
): Promise<void> {
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(canonicalValue(status)), {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, statePath);
}

export type LocalWorkspaceBackupService = {
  getStatus(): Promise<LocalWorkspaceBackupStatusProjection>;
  createBundle(finalBundleRoot: string): Promise<LocalWorkspaceBackupSummary>;
  restoreBundle(
    finalBundleRoot: string,
    targetFinalRoot: string,
  ): Promise<LocalWorkspaceBackupSummary>;
};

export function createLocalWorkspaceBackupService(input: {
  readonly rootDirectoryPath: string;
  readonly sourceBlobStore: ImmutableBlobStore;
  readonly profile: LocalWorkspaceBackupProfile;
}): LocalWorkspaceBackupService {
  const rootDirectoryPath = path.resolve(input.rootDirectoryPath);
  const statePath = path.join(rootDirectoryPath, input.profile.stateFileName);
  const sourceDatabasePath = path.join(
    rootDirectoryPath,
    ...input.profile.restoreLayout.databaseEntrySegments,
  );
  const adapters = createCanonicalAdapters(input.profile);
  const bundleLayout = Object.freeze({
    databaseEntrySegments: input.profile.bundleLayout.databaseEntrySegments,
    manifestEntrySegments: input.profile.bundleLayout.manifestEntrySegments,
    manifestChecksumEntrySegments:
      input.profile.bundleLayout.manifestChecksumEntrySegments,
    blobEntrySegments: (address: BlobAddress) =>
      blobEntrySegments(address, input.profile.bundleLayout),
  });
  const targetLayout = Object.freeze({
    databaseEntrySegments: input.profile.restoreLayout.databaseEntrySegments,
    blobEntrySegments: (address: BlobAddress) =>
      blobEntrySegments(address, input.profile.restoreLayout),
  });

  const persistSummary = async (
    summary: LocalWorkspaceBackupSummary,
  ): Promise<LocalWorkspaceBackupSummary> => {
    const parsed = parseLocalWorkspaceBackupSummary(summary);
    await writeStatus(statePath, {
      schemaVersion: 1,
      lastVerified: parsed,
    });
    return parsed;
  };

  return Object.freeze({
    getStatus: () => readStatus(statePath),
    createBundle: async (finalBundleRoot: string) => {
      if (!path.isAbsolute(finalBundleRoot)) {
        throw new Error("Backup bundle path must be absolute");
      }
      const report = await createNodeSqliteBackupBundle({
        sourceDatabasePath,
        sourceBlobStore: input.sourceBlobStore,
        temporaryBundleRoot: temporarySibling(finalBundleRoot, "Backup bundle"),
        finalBundleRoot,
        layout: bundleLayout,
        format: input.profile.format,
        sqlite: input.profile.sqlite,
        manifestCodec: adapters.manifestCodec,
        canonicalBytes: adapters.canonicalBytes,
        checksum: adapters.checksum,
        clock: Object.freeze({ now: () => new Date().toISOString() }),
      });
      return persistSummary({
        schemaVersion: 1,
        bundlePath: path.resolve(finalBundleRoot),
        targetPath: null,
        createdAt: report.manifest.createdAt,
        verifiedAt: new Date().toISOString(),
        lastAction: "created",
        counts: report.manifest.counts,
      });
    },
    restoreBundle: async (
      finalBundleRoot: string,
      targetFinalRoot: string,
    ) => {
      if (!path.isAbsolute(finalBundleRoot) || !path.isAbsolute(targetFinalRoot)) {
        throw new Error("Backup source and restore target paths must be absolute");
      }
      const targetParent = path.dirname(path.resolve(targetFinalRoot));
      const report = await restoreNodeSqliteBackupBundle({
        finalBundleRoot,
        bundleLayout,
        targetStagingRoot: temporarySibling(targetFinalRoot, "Restore target"),
        targetFinalRoot,
        targetLayout,
        expectedFormat: input.profile.format,
        manifestCodec: adapters.manifestCodec,
        canonicalBytes: adapters.canonicalBytes,
        checksum: adapters.checksum,
        preflight: Object.freeze({
          preflight: async ({ requiredByteCount }) => {
            await access(targetParent, constants.W_OK);
            const available = await statfs(targetParent, { bigint: true });
            if (
              available.bavail * available.bsize <
              BigInt(requiredByteCount)
            ) {
              throw new Error("Restore target does not have enough free space");
            }
          },
        }),
      });
      return persistSummary({
        schemaVersion: 1,
        bundlePath: path.resolve(finalBundleRoot),
        targetPath: path.resolve(targetFinalRoot),
        createdAt: report.manifest.createdAt,
        verifiedAt: new Date().toISOString(),
        lastAction: "restored",
        counts: report.restoredCounts,
      });
    },
  });
}
