import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  parseLocalMediaTrackProjection,
  type LocalMediaTrackProjection,
} from "../../application/music/media-track";

export type NodeLocalMediaChecksumProfile = Readonly<{
  identity: string;
  algorithm: string;
}>;

export type StoredLocalMediaIntegrity = Readonly<{
  checksumIdentity: string;
  checksumValue: string;
  byteLength: number;
}>;

export type StoredLocalMediaLocator =
  | Readonly<{ kind: "external-path"; filePath: string }>
  | Readonly<{ kind: "managed-file"; fileName: string }>;

export type StoredLocalMediaDescriptor = Readonly<{
  schemaVersion: 1 | 2;
  track: LocalMediaTrackProjection;
  integrity: StoredLocalMediaIntegrity | null;
  locator: StoredLocalMediaLocator;
}>;

export type NodeLocalMediaLibraryPaths = Readonly<{
  rootDirectoryPath: string;
  entriesDirectoryPath: string;
  filesDirectoryPath: string;
  temporaryDirectoryPath: string;
}>;

type ErrorWithCode = Readonly<{ code?: unknown }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function safeByteLength(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function parseStoredLocalMediaIntegrity(
  value: unknown,
  label: string,
): StoredLocalMediaIntegrity {
  const input = record(value, label);
  exact(
    input,
    ["checksumIdentity", "checksumValue", "byteLength"],
    label,
  );
  return Object.freeze({
    checksumIdentity: nonEmptyText(
      input.checksumIdentity,
      `${label}.checksumIdentity`,
    ),
    checksumValue: nonEmptyText(input.checksumValue, `${label}.checksumValue`),
    byteLength: safeByteLength(input.byteLength, `${label}.byteLength`),
  });
}

function parseLocator(
  value: unknown,
  track: LocalMediaTrackProjection,
  label: string,
): StoredLocalMediaLocator {
  const input = record(value, label);
  if (input.kind === "external-path") {
    exact(input, ["kind", "filePath"], label);
    const filePath = nonEmptyText(input.filePath, `${label}.filePath`);
    if (track.storageMode !== "external-reference" || !path.isAbsolute(filePath)) {
      throw new Error(`${label} does not match external-reference`);
    }
    return Object.freeze({ kind: "external-path", filePath });
  }
  if (input.kind === "managed-file") {
    exact(input, ["kind", "fileName"], label);
    const fileName = nonEmptyText(input.fileName, `${label}.fileName`);
    if (
      track.storageMode !== "managed-copy" ||
      path.basename(fileName) !== fileName
    ) {
      throw new Error(`${label} does not match managed-copy`);
    }
    return Object.freeze({ kind: "managed-file", fileName });
  }
  throw new Error(`${label}.kind is unsupported`);
}

export function parseStoredLocalMediaDescriptor(
  value: unknown,
): StoredLocalMediaDescriptor {
  const label = "Stored local media descriptor";
  const input = record(value, label);
  if (input.schemaVersion === 1) {
    exact(input, ["schemaVersion", "track", "locator"], label);
  } else if (input.schemaVersion === 2) {
    exact(input, ["schemaVersion", "track", "integrity", "locator"], label);
  } else {
    throw new Error(`${label}.schemaVersion is unsupported`);
  }
  const track = parseLocalMediaTrackProjection(input.track, `${label}.track`);
  const integrity = input.schemaVersion === 1
    ? null
    : parseStoredLocalMediaIntegrity(input.integrity, `${label}.integrity`);
  if (integrity !== null && integrity.byteLength !== track.byteLength) {
    throw new Error(`${label}.integrity does not match track.byteLength`);
  }
  return Object.freeze({
    schemaVersion: input.schemaVersion,
    track,
    integrity,
    locator: parseLocator(input.locator, track, `${label}.locator`),
  });
}

export function createNodeLocalMediaLibraryPaths(
  rootDirectoryPath: string,
): NodeLocalMediaLibraryPaths {
  if (!path.isAbsolute(rootDirectoryPath)) {
    throw new Error("Local media library rootDirectoryPath must be absolute");
  }
  const resolvedRoot = path.resolve(rootDirectoryPath);
  return Object.freeze({
    rootDirectoryPath: resolvedRoot,
    entriesDirectoryPath: path.join(resolvedRoot, "entries"),
    filesDirectoryPath: path.join(resolvedRoot, "files"),
    temporaryDirectoryPath: path.join(resolvedRoot, "temporary"),
  });
}

export async function ensureNodeLocalMediaLibraryPaths(
  paths: NodeLocalMediaLibraryPaths,
): Promise<void> {
  await Promise.all([
    mkdir(paths.entriesDirectoryPath, { recursive: true }),
    mkdir(paths.filesDirectoryPath, { recursive: true }),
    mkdir(paths.temporaryDirectoryPath, { recursive: true }),
  ]);
}

export function localMediaOpaqueFileStem(mediaId: string): string {
  return createHash("sha256").update(mediaId, "utf8").digest("hex");
}

export function localMediaDescriptorFileName(mediaId: string): string {
  return `${localMediaOpaqueFileStem(mediaId)}.json`;
}

export function localMediaDescriptorPath(
  paths: NodeLocalMediaLibraryPaths,
  mediaId: string,
): string {
  return path.join(paths.entriesDirectoryPath, localMediaDescriptorFileName(mediaId));
}

export function localMediaSourcePath(
  paths: NodeLocalMediaLibraryPaths,
  descriptor: StoredLocalMediaDescriptor,
): string {
  return descriptor.locator.kind === "external-path"
    ? descriptor.locator.filePath
    : path.join(paths.filesDirectoryPath, descriptor.locator.fileName);
}

export async function readStoredLocalMediaDescriptor(input: Readonly<{
  paths: NodeLocalMediaLibraryPaths;
  mediaId: string;
}>): Promise<StoredLocalMediaDescriptor> {
  return parseStoredLocalMediaDescriptor(
    JSON.parse(
      await readFile(localMediaDescriptorPath(input.paths, input.mediaId), "utf8"),
    ),
  );
}

async function syncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeStoredLocalMediaDescriptor(input: Readonly<{
  paths: NodeLocalMediaLibraryPaths;
  descriptor: StoredLocalMediaDescriptor;
}>): Promise<void> {
  await ensureNodeLocalMediaLibraryPaths(input.paths);
  if (input.descriptor.integrity === null) {
    throw new Error("Stored local media descriptor integrity is required");
  }
  const descriptor = parseStoredLocalMediaDescriptor({
    schemaVersion: 2,
    track: input.descriptor.track,
    integrity: input.descriptor.integrity,
    locator: input.descriptor.locator,
  });
  const finalPath = localMediaDescriptorPath(input.paths, descriptor.track.mediaId);
  const temporaryPath = path.join(
    input.paths.temporaryDirectoryPath,
    `${localMediaOpaqueFileStem(descriptor.track.mediaId)}.${randomUUID()}.json.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify({
      schemaVersion: 2,
      track: descriptor.track,
      integrity: descriptor.integrity,
      locator: descriptor.locator,
    })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await syncFile(temporaryPath);
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function checksumLocalMediaFile(input: Readonly<{
  filePath: string;
  checksum: NodeLocalMediaChecksumProfile;
}>): Promise<StoredLocalMediaIntegrity> {
  if (
    input.checksum.identity.length === 0 ||
    input.checksum.algorithm.length === 0
  ) {
    throw new Error("Local media checksum profile is invalid");
  }
  const before = await stat(input.filePath);
  if (!before.isFile() || !Number.isSafeInteger(before.size)) {
    throw new Error("Local media source must be a regular file of supported size");
  }
  const hash = createHash(input.checksum.algorithm);
  for await (const chunk of createReadStream(input.filePath)) {
    hash.update(chunk as Buffer);
  }
  const after = await stat(input.filePath);
  if (
    !after.isFile() ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new Error("Local media source changed while its checksum was computed");
  }
  return Object.freeze({
    checksumIdentity: input.checksum.identity,
    checksumValue: hash.digest("hex"),
    byteLength: before.size,
  });
}

export function sameStoredLocalMediaIntegrity(
  left: StoredLocalMediaIntegrity,
  right: StoredLocalMediaIntegrity,
): boolean {
  return left.checksumIdentity === right.checksumIdentity &&
    left.checksumValue === right.checksumValue &&
    left.byteLength === right.byteLength;
}

export function isMissingLocalMediaError(error: unknown): boolean {
  return (error as ErrorWithCode | null)?.code === "ENOENT";
}
