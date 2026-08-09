import {
  createHash,
} from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import type {
  ConnectorMetadataReceipt,
  SourceArchiveExportReport,
  SourceArchiveFormat,
  SourceArchiveManifest,
  SourceSnapshotReceipt,
} from "../../application/migration/source-archive";

type ErrorWithCode = {
  readonly code?: unknown;
};

export type NodeSourceArchiveChecksumProfile = {
  readonly identity: string;
  readonly algorithm: string;
};

export type NodeSourceArchiveClock = {
  now(): string;
};

export type NodeSourceArchiveFileCapture = {
  readonly sourcePath: string;
  readonly sourceLocator: string;
  readonly archiveEntrySegments: readonly string[];
};

export type NodeSourceArchiveConnectorProbe = {
  readonly sourcePath: string;
  readonly connectorKind: string;
  readonly credentialKind: string;
};

export type ExportNodeSourceArchiveInput = {
  readonly sourceProfileId: string;
  readonly format: SourceArchiveFormat;
  readonly checksum: NodeSourceArchiveChecksumProfile;
  readonly clock: NodeSourceArchiveClock;
  readonly captures: readonly NodeSourceArchiveFileCapture[];
  readonly connectorProbes: readonly NodeSourceArchiveConnectorProbe[];
  readonly manifestEntrySegments: readonly string[];
  readonly temporaryArchiveRootPath: string;
  readonly finalArchiveRootPath: string;
};

function hasErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === code
  );
}

function assertNonEmpty(
  value: string,
  label: string,
): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
}

function assertAbsolute(
  path: string,
  label: string,
): void {
  if (!isAbsolute(path)) {
    throw new Error(`${label} must be absolute`);
  }
}

function resolveArchiveEntry(
  rootPath: string,
  segments: readonly string[],
  label: string,
): string {
  if (segments.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  const candidate = resolve(rootPath, ...segments);
  const relation = relative(rootPath, candidate);
  if (
    relation.length === 0 ||
    isAbsolute(relation) ||
    relation === ".." ||
    relation.startsWith(`..${sep}`)
  ) {
    throw new Error(`${label} resolves outside the archive root`);
  }
  return candidate;
}

function toArchiveEntry(
  segments: readonly string[],
): string {
  return segments.join("/");
}

function checksumBytes(
  profile: NodeSourceArchiveChecksumProfile,
  bytes: Uint8Array,
): string {
  return createHash(profile.algorithm)
    .update(bytes)
    .digest("hex");
}

function encodeCanonicalJson(
  value: unknown,
): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

async function pathExists(
  path: string,
): Promise<boolean> {
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

async function writeExactNoReplace(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx");
  try {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.write(
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (result.bytesWritten <= 0) {
        throw new Error("Source archive write made no progress");
      }
      offset += result.bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function assertOwnedSiblingRoots(
  temporaryRootPath: string,
  finalRootPath: string,
): void {
  assertAbsolute(temporaryRootPath, "temporaryArchiveRootPath");
  assertAbsolute(finalRootPath, "finalArchiveRootPath");
  const temporary = resolve(temporaryRootPath);
  const final = resolve(finalRootPath);
  if (
    temporary === final ||
    resolve(dirname(temporary)) !== resolve(dirname(final))
  ) {
    throw new Error(
      "Temporary and final archive roots must be distinct siblings",
    );
  }
}

async function cleanupTemporaryRoot(
  temporaryRootPath: string,
  finalRootPath: string,
): Promise<void> {
  assertOwnedSiblingRoots(temporaryRootPath, finalRootPath);
  await rm(temporaryRootPath, {
    recursive: true,
    force: true,
  });
}

async function captureFile(
  input: ExportNodeSourceArchiveInput,
  capture: NodeSourceArchiveFileCapture,
  capturedAt: string,
): Promise<SourceSnapshotReceipt> {
  assertAbsolute(capture.sourcePath, "capture sourcePath");
  assertNonEmpty(capture.sourceLocator, "capture sourceLocator");
  const sourceBefore = await readFile(capture.sourcePath);
  const sourceChecksum = checksumBytes(input.checksum, sourceBefore);
  const targetPath = resolveArchiveEntry(
    input.temporaryArchiveRootPath,
    capture.archiveEntrySegments,
    "archiveEntrySegments",
  );
  await writeExactNoReplace(targetPath, sourceBefore);

  const publishedBytes = await readFile(targetPath);
  if (
    publishedBytes.byteLength !== sourceBefore.byteLength ||
    checksumBytes(input.checksum, publishedBytes) !== sourceChecksum
  ) {
    throw new Error("Source archive readback does not match source bytes");
  }

  const sourceAfter = await readFile(capture.sourcePath);
  if (
    sourceAfter.byteLength !== sourceBefore.byteLength ||
    checksumBytes(input.checksum, sourceAfter) !== sourceChecksum
  ) {
    throw new Error("Source changed while its snapshot was captured");
  }

  const identityBytes = encodeCanonicalJson([
    input.sourceProfileId,
    capture.sourceLocator,
    input.checksum.identity,
    sourceChecksum,
  ]);
  return Object.freeze({
    snapshotId: checksumBytes(input.checksum, identityBytes),
    sourceKind: "file",
    sourceLocator: capture.sourceLocator,
    capturedAt,
    byteLength: sourceBefore.byteLength,
    checksumIdentity: input.checksum.identity,
    checksumValue: sourceChecksum,
    rawEntry: toArchiveEntry(capture.archiveEntrySegments),
  });
}

async function probeConnector(
  probe: NodeSourceArchiveConnectorProbe,
): Promise<ConnectorMetadataReceipt> {
  assertAbsolute(probe.sourcePath, "connector probe sourcePath");
  assertNonEmpty(probe.connectorKind, "connectorKind");
  assertNonEmpty(probe.credentialKind, "credentialKind");
  let present = false;
  try {
    const sourceStat = await stat(probe.sourcePath);
    present = sourceStat.isFile();
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
  return Object.freeze({
    connectorKind: probe.connectorKind,
    credentialKind: probe.credentialKind,
    present,
  });
}

function assertUniqueProfileEntries(
  input: ExportNodeSourceArchiveInput,
): void {
  const locators = new Set<string>();
  const archiveEntries = new Set<string>();
  for (const capture of input.captures) {
    if (locators.has(capture.sourceLocator)) {
      throw new Error("Source archive contains a duplicate source locator");
    }
    locators.add(capture.sourceLocator);
    const archiveEntry = toArchiveEntry(capture.archiveEntrySegments);
    if (archiveEntries.has(archiveEntry)) {
      throw new Error("Source archive contains a duplicate raw entry");
    }
    archiveEntries.add(archiveEntry);
  }
  const manifestEntry = toArchiveEntry(input.manifestEntrySegments);
  if (archiveEntries.has(manifestEntry)) {
    throw new Error("Source archive manifest overlaps a raw entry");
  }
}

export async function exportNodeSourceArchive(
  input: ExportNodeSourceArchiveInput,
): Promise<SourceArchiveExportReport> {
  assertNonEmpty(input.sourceProfileId, "sourceProfileId");
  assertNonEmpty(input.format.identity, "format identity");
  assertNonEmpty(input.format.version, "format version");
  assertNonEmpty(input.checksum.identity, "checksum identity");
  assertNonEmpty(input.checksum.algorithm, "checksum algorithm");
  createHash(input.checksum.algorithm).digest();
  assertOwnedSiblingRoots(
    input.temporaryArchiveRootPath,
    input.finalArchiveRootPath,
  );
  assertUniqueProfileEntries(input);
  resolveArchiveEntry(
    input.temporaryArchiveRootPath,
    input.manifestEntrySegments,
    "manifestEntrySegments",
  );
  if (
    await pathExists(input.temporaryArchiveRootPath) ||
    await pathExists(input.finalArchiveRootPath)
  ) {
    throw new Error("Source archive target already exists");
  }

  const capturedAt = input.clock.now();
  assertNonEmpty(capturedAt, "capturedAt");
  await mkdir(input.temporaryArchiveRootPath, { recursive: false });
  let published = false;
  try {
    const snapshots: SourceSnapshotReceipt[] = [];
    for (const capture of input.captures) {
      snapshots.push(
        await captureFile(input, capture, capturedAt),
      );
    }
    const connectorMetadata: ConnectorMetadataReceipt[] = [];
    for (const probe of input.connectorProbes) {
      connectorMetadata.push(await probeConnector(probe));
    }
    const manifest: SourceArchiveManifest = Object.freeze({
      schemaVersion: 1,
      format: Object.freeze({ ...input.format }),
      sourceProfileId: input.sourceProfileId,
      capturedAt,
      checksumIdentity: input.checksum.identity,
      snapshots: Object.freeze(snapshots),
      connectorMetadata: Object.freeze(connectorMetadata),
    });
    const manifestPath = resolveArchiveEntry(
      input.temporaryArchiveRootPath,
      input.manifestEntrySegments,
      "manifestEntrySegments",
    );
    await writeExactNoReplace(
      manifestPath,
      encodeCanonicalJson(manifest),
    );
    await rename(
      input.temporaryArchiveRootPath,
      input.finalArchiveRootPath,
    );
    published = true;
    return Object.freeze({
      manifest,
      finalArchiveRootPath: input.finalArchiveRootPath,
      publication: "published",
    });
  } finally {
    if (!published) {
      await cleanupTemporaryRoot(
        input.temporaryArchiveRootPath,
        input.finalArchiveRootPath,
      );
    }
  }
}
