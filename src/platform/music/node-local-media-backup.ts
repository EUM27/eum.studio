import { constants as fileConstants } from "node:fs";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  isLocalMediaTrack,
  parseLocalMediaTrackProjection,
  parseMusicTrackProjection,
  type LocalMediaTrackProjection,
} from "../../application/music/media-track";
import type {
  LocalWorkspaceBackupMediaCounts,
} from "../../application/storage/local-workspace-backup-contract";
import type {
  LocalWorkspaceBackupProfile,
} from "../../application/storage/local-workspace-backup-profile";
import type {
  NodeSqliteBackupCanonicalBytesAdapter,
  NodeSqliteBackupChecksumAdapter,
  NodeSqliteBackupFormat,
} from "../storage/node-sqlite-backup";
import {
  checksumLocalMediaFile,
  createNodeLocalMediaLibraryPaths,
  ensureNodeLocalMediaLibraryPaths,
  isMissingLocalMediaError,
  localMediaSourcePath,
  parseStoredLocalMediaIntegrity,
  parseStoredLocalMediaDescriptor,
  readStoredLocalMediaDescriptor,
  sameStoredLocalMediaIntegrity,
  writeStoredLocalMediaDescriptor,
  type NodeLocalMediaChecksumProfile,
  type StoredLocalMediaDescriptor,
  type StoredLocalMediaIntegrity,
} from "./node-local-media-descriptor";

type NodeSqliteStatement = Readonly<{
  all(...parameters: readonly unknown[]): readonly Record<string, unknown>[];
}>;

type NodeSqliteDatabase = Readonly<{
  close(): void;
  prepare(sql: string): NodeSqliteStatement;
}>;

type NodeSqliteModule = Readonly<{
  DatabaseSync: new (
    fileName: string,
    options?: Readonly<{ readOnly?: boolean }>,
  ) => NodeSqliteDatabase;
}>;

type LocalMediaBackupManagedStorage = Readonly<{
  kind: "managed-file";
  fileName: string;
  bundleRelativeSegments: readonly string[];
}>;

type LocalMediaBackupExternalStorage = Readonly<{
  kind: "external-path";
  filePath: string;
  sourceFileName: string;
  availabilityAtBackup: "available" | "disconnected";
}>;

export type LocalMediaBackupEntry = Readonly<{
  track: LocalMediaTrackProjection;
  integrity: StoredLocalMediaIntegrity;
  storage: LocalMediaBackupManagedStorage | LocalMediaBackupExternalStorage;
}>;

export type LocalMediaBackupManifest = Readonly<{
  format: NodeSqliteBackupFormat;
  workspaceDatabase: StoredLocalMediaIntegrity;
  entries: readonly LocalMediaBackupEntry[];
}>;

type LocalMediaBackupSidecar = Readonly<{
  checksumIdentity: string;
  checksumValue: string;
  byteLength: number;
  manifestEntrySegments: readonly string[];
}>;

export type VerifiedLocalMediaBackupBundle = Readonly<{
  manifest: LocalMediaBackupManifest;
  counts: LocalWorkspaceBackupMediaCounts;
  requiredTargetByteCount: number;
}>;

function loadNodeSqlite(): NodeSqliteModule {
  const loaded = process.getBuiltinModule("node:sqlite") as
    | NodeSqliteModule
    | undefined;
  if (loaded === undefined) {
    throw new Error("node:sqlite is unavailable");
  }
  return loaded;
}

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

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function byteLength(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function relativeSegments(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty segment array`);
  }
  return Object.freeze(value.map((segment, index) => {
    if (
      typeof segment !== "string" ||
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      throw new Error(`${label}[${index}] must be one safe segment`);
    }
    return segment;
  }));
}

function parseFormat(value: unknown, label: string): NodeSqliteBackupFormat {
  const input = record(value, label);
  exact(input, ["identity", "version"], label);
  return Object.freeze({
    identity: nonEmpty(input.identity, `${label}.identity`),
    version: nonEmpty(input.version, `${label}.version`),
  });
}

function sameSegments(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((segment, index) => segment === right[index]);
}

function resolveEntry(
  rootDirectoryPath: string,
  segments: readonly string[],
  label: string,
): string {
  const safeSegments = relativeSegments(segments, label);
  const root = path.resolve(rootDirectoryPath);
  const resolved = path.resolve(root, ...safeSegments);
  const relative = path.relative(root, resolved);
  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} escapes its root`);
  }
  return resolved;
}

function parseEntry(value: unknown, index: number): LocalMediaBackupEntry {
  const label = `Local media backup entry ${index}`;
  const input = record(value, label);
  exact(input, ["track", "integrity", "storage"], label);
  const track = parseLocalMediaTrackProjection(input.track, `${label}.track`);
  const integrity = parseStoredLocalMediaIntegrity(
    input.integrity,
    `${label}.integrity`,
  );
  if (integrity.byteLength !== track.byteLength) {
    throw new Error(`${label}.integrity does not match track.byteLength`);
  }
  const storageInput = record(input.storage, `${label}.storage`);
  if (storageInput.kind === "managed-file") {
    exact(
      storageInput,
      ["kind", "fileName", "bundleRelativeSegments"],
      `${label}.storage`,
    );
    const fileName = nonEmpty(
      storageInput.fileName,
      `${label}.storage.fileName`,
    );
    const descriptor = parseStoredLocalMediaDescriptor({
      schemaVersion: 2,
      track,
      integrity,
      locator: { kind: "managed-file", fileName },
    });
    return Object.freeze({
      track: descriptor.track,
      integrity,
      storage: Object.freeze({
        kind: "managed-file",
        fileName,
        bundleRelativeSegments: relativeSegments(
          storageInput.bundleRelativeSegments,
          `${label}.storage.bundleRelativeSegments`,
        ),
      }),
    });
  }
  if (storageInput.kind === "external-path") {
    exact(
      storageInput,
      [
        "kind",
        "filePath",
        "sourceFileName",
        "availabilityAtBackup",
      ],
      `${label}.storage`,
    );
    const filePath = nonEmpty(
      storageInput.filePath,
      `${label}.storage.filePath`,
    );
    const sourceFileName = nonEmpty(
      storageInput.sourceFileName,
      `${label}.storage.sourceFileName`,
    );
    if (
      !path.isAbsolute(filePath) ||
      path.basename(filePath) !== sourceFileName ||
      (
        storageInput.availabilityAtBackup !== "available" &&
        storageInput.availabilityAtBackup !== "disconnected"
      )
    ) {
      throw new Error(`${label}.storage is invalid`);
    }
    const descriptor = parseStoredLocalMediaDescriptor({
      schemaVersion: 2,
      track,
      integrity,
      locator: { kind: "external-path", filePath },
    });
    return Object.freeze({
      track: descriptor.track,
      integrity,
      storage: Object.freeze({
        kind: "external-path",
        filePath,
        sourceFileName,
        availabilityAtBackup: storageInput.availabilityAtBackup,
      }),
    });
  }
  throw new Error(`${label}.storage.kind is unsupported`);
}

export function parseLocalMediaBackupManifest(
  value: unknown,
): LocalMediaBackupManifest {
  const label = "Local media backup manifest";
  const input = record(value, label);
  exact(input, ["format", "workspaceDatabase", "entries"], label);
  if (!Array.isArray(input.entries)) {
    throw new Error(`${label}.entries must be an array`);
  }
  const entries = Object.freeze(input.entries.map(parseEntry));
  const identities = entries.map(
    (entry) => `${entry.track.workId}\u0000${entry.track.mediaId}`,
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error(`${label}.entries contain duplicate identities`);
  }
  const sorted = [...identities].sort((left, right) => left.localeCompare(right));
  if (!identities.every((identity, index) => identity === sorted[index])) {
    throw new Error(`${label}.entries are not canonical ordered`);
  }
  return Object.freeze({
    format: parseFormat(input.format, `${label}.format`),
    workspaceDatabase: parseStoredLocalMediaIntegrity(
      input.workspaceDatabase,
      `${label}.workspaceDatabase`,
    ),
    entries,
  });
}

function parseSidecar(value: unknown): LocalMediaBackupSidecar {
  const label = "Local media backup manifest checksum";
  const input = record(value, label);
  exact(
    input,
    [
      "checksumIdentity",
      "checksumValue",
      "byteLength",
      "manifestEntrySegments",
    ],
    label,
  );
  return Object.freeze({
    checksumIdentity: nonEmpty(
      input.checksumIdentity,
      `${label}.checksumIdentity`,
    ),
    checksumValue: nonEmpty(input.checksumValue, `${label}.checksumValue`),
    byteLength: byteLength(input.byteLength, `${label}.byteLength`),
    manifestEntrySegments: relativeSegments(
      input.manifestEntrySegments,
      `${label}.manifestEntrySegments`,
    ),
  });
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

async function checksumBytes(
  adapter: NodeSqliteBackupChecksumAdapter,
  bytes: Uint8Array,
): Promise<string> {
  const value = await adapter.checksum(bytes);
  if (value.length === 0) {
    throw new Error("Local media backup checksum must not be empty");
  }
  return value;
}

async function syncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeExact(
  filePath: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });
  await syncFile(filePath);
}

function mediaCounts(
  entries: readonly LocalMediaBackupEntry[],
  disconnectedExternalReferenceCount: number,
): LocalWorkspaceBackupMediaCounts {
  let managedFileCount = 0;
  let externalReferenceCount = 0;
  let managedByteLength = 0;
  for (const entry of entries) {
    if (entry.storage.kind === "managed-file") {
      managedFileCount += 1;
      managedByteLength += entry.integrity.byteLength;
      if (!Number.isSafeInteger(managedByteLength)) {
        throw new Error("Managed media byte length exceeds the supported range");
      }
    } else {
      externalReferenceCount += 1;
    }
  }
  return Object.freeze({
    managedFileCount,
    externalReferenceCount,
    disconnectedExternalReferenceCount,
    managedByteLength,
  });
}

function localTracksFromSettings(
  settingsValue: unknown,
  workId: string,
): readonly LocalMediaTrackProjection[] {
  const settings = record(settingsValue, "Work music settings");
  const candidates: unknown[] = [];
  for (const field of ["localMedia", "favoriteTracks", "playlistTracks"]) {
    const value = settings[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      throw new Error(`Work music settings.${field} must be an array`);
    }
    candidates.push(...value);
  }
  const tracks = candidates.flatMap((value, index) => {
    try {
      const parsed = parseMusicTrackProjection(
        value,
        `Work music settings tracks[${index}]`,
      );
      return isLocalMediaTrack(parsed) ? [parsed] : [];
    } catch (error) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>).sourceKind !== "local-file"
      ) {
        return [];
      }
      throw error;
    }
  });
  if (tracks.some((track) => track.workId !== workId)) {
    throw new Error("Work music settings contain cross-Work local media");
  }
  const byId = new Map<string, LocalMediaTrackProjection>();
  for (const track of tracks) {
    const existing = byId.get(track.mediaId);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(track)) {
      throw new Error("Work music settings contain conflicting local media");
    }
    byId.set(track.mediaId, track);
  }
  return Object.freeze([...byId.values()]);
}

function readReferencedLocalMediaTracks(
  databasePath: string,
): readonly LocalMediaTrackProjection[] {
  const sqlite = loadNodeSqlite();
  const database = new sqlite.DatabaseSync(databasePath, { readOnly: true });
  try {
    const tableRows = database.prepare(`
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table' AND name = 'work_music_settings'
    `).all();
    if (tableRows.length === 0) return Object.freeze([]);
    const rows = database.prepare(`
      SELECT work_id AS "workId", settings_json AS "settingsJson"
      FROM work_music_settings
      ORDER BY work_id ASC
    `).all();
    const tracks = rows.flatMap((row, index) => {
      const workId = nonEmpty(row.workId, `Work music settings row ${index}.workId`);
      const settingsJson = nonEmpty(
        row.settingsJson,
        `Work music settings row ${index}.settingsJson`,
      );
      return localTracksFromSettings(JSON.parse(settingsJson), workId);
    });
    const identities = tracks.map(
      (track) => `${track.workId}\u0000${track.mediaId}`,
    );
    if (new Set(identities).size !== identities.length) {
      throw new Error("Workspace contains duplicate local media identities");
    }
    return Object.freeze([...tracks].sort((left, right) =>
      left.workId.localeCompare(right.workId) ||
      left.mediaId.localeCompare(right.mediaId)
    ));
  } finally {
    database.close();
  }
}

function assertSameTrack(
  expected: LocalMediaTrackProjection,
  actual: LocalMediaTrackProjection,
): void {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error("Local media descriptor does not match the database snapshot");
  }
}

function checksumProfile(
  checksum: NodeSqliteBackupChecksumAdapter,
  algorithm: string,
): NodeLocalMediaChecksumProfile {
  return Object.freeze({
    identity: checksum.identity,
    algorithm,
  });
}

export async function createNodeLocalMediaBackupExtension(input: Readonly<{
  sourceDatabasePath: string;
  sourceLibraryRootDirectoryPath: string;
  temporaryBundleRoot: string;
  profile: LocalWorkspaceBackupProfile;
  canonicalBytes: NodeSqliteBackupCanonicalBytesAdapter;
  checksum: NodeSqliteBackupChecksumAdapter;
}>): Promise<VerifiedLocalMediaBackupBundle> {
  const tracks = readReferencedLocalMediaTracks(input.sourceDatabasePath);
  const libraryPaths = createNodeLocalMediaLibraryPaths(
    input.sourceLibraryRootDirectoryPath,
  );
  const fileChecksum = checksumProfile(
    input.checksum,
    input.profile.checksum.algorithm,
  );
  const entries: LocalMediaBackupEntry[] = [];
  for (const track of tracks) {
    const descriptor = await readStoredLocalMediaDescriptor({
      paths: libraryPaths,
      mediaId: track.mediaId,
    });
    assertSameTrack(track, descriptor.track);
    const sourcePath = localMediaSourcePath(libraryPaths, descriptor);
    let integrity = descriptor.integrity;
    let observed: StoredLocalMediaIntegrity | null = null;
    try {
      observed = await checksumLocalMediaFile({
        filePath: sourcePath,
        checksum: fileChecksum,
      });
    } catch (error) {
      if (!isMissingLocalMediaError(error)) throw error;
    }
    if (integrity === null) {
      if (observed === null) {
        throw new Error(
          "Legacy external media is missing; reconnect it before creating a complete backup",
        );
      }
      integrity = observed;
    } else if (
      observed !== null &&
      !sameStoredLocalMediaIntegrity(integrity, observed)
    ) {
      throw new Error("Registered local media changed after it was added");
    }
    if (descriptor.locator.kind === "managed-file") {
      if (observed === null) {
        throw new Error("Managed local media is missing from the application library");
      }
      const bundleRelativeSegments = Object.freeze([
        ...input.profile.localMedia.bundleLayout.managedFileDirectorySegments,
        descriptor.locator.fileName,
      ]);
      const targetPath = resolveEntry(
        input.temporaryBundleRoot,
        bundleRelativeSegments,
        "Managed media backup entry",
      );
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath, fileConstants.COPYFILE_EXCL);
      await syncFile(targetPath);
      const copied = await checksumLocalMediaFile({
        filePath: targetPath,
        checksum: fileChecksum,
      });
      if (!sameStoredLocalMediaIntegrity(integrity, copied)) {
        throw new Error("Managed media backup copy failed checksum verification");
      }
      entries.push(Object.freeze({
        track,
        integrity,
        storage: Object.freeze({
          kind: "managed-file",
          fileName: descriptor.locator.fileName,
          bundleRelativeSegments,
        }),
      }));
    } else {
      entries.push(Object.freeze({
        track,
        integrity,
        storage: Object.freeze({
          kind: "external-path",
          filePath: descriptor.locator.filePath,
          sourceFileName: path.basename(descriptor.locator.filePath),
          availabilityAtBackup: observed === null
            ? "disconnected"
            : "available",
        }),
      }));
    }
  }
  const databaseIntegrity = await checksumLocalMediaFile({
    filePath: input.sourceDatabasePath,
    checksum: fileChecksum,
  });
  const manifest = parseLocalMediaBackupManifest({
    format: input.profile.localMedia.format,
    workspaceDatabase: databaseIntegrity,
    entries,
  });
  const manifestBytes = Uint8Array.from(
    input.canonicalBytes.encode(manifest),
  );
  const decoded = parseLocalMediaBackupManifest(
    input.canonicalBytes.decode(manifestBytes),
  );
  if (!bytesEqual(manifestBytes, input.canonicalBytes.encode(decoded))) {
    throw new Error("Local media backup manifest is not canonical");
  }
  const manifestPath = resolveEntry(
    input.temporaryBundleRoot,
    input.profile.localMedia.bundleLayout.manifestEntrySegments,
    "Local media backup manifest",
  );
  const sidecarPath = resolveEntry(
    input.temporaryBundleRoot,
    input.profile.localMedia.bundleLayout.manifestChecksumEntrySegments,
    "Local media backup manifest checksum",
  );
  const sidecar = Object.freeze({
    checksumIdentity: input.checksum.identity,
    checksumValue: await checksumBytes(input.checksum, manifestBytes),
    byteLength: manifestBytes.byteLength,
    manifestEntrySegments:
      input.profile.localMedia.bundleLayout.manifestEntrySegments,
  });
  await writeExact(manifestPath, manifestBytes);
  await writeExact(sidecarPath, input.canonicalBytes.encode(sidecar));
  const disconnected = entries.filter(
    (entry) =>
      entry.storage.kind === "external-path" &&
      entry.storage.availabilityAtBackup === "disconnected",
  ).length;
  return Object.freeze({
    manifest,
    counts: mediaCounts(entries, disconnected),
    requiredTargetByteCount: entries.reduce(
      (total, entry) =>
        total + (entry.storage.kind === "managed-file"
          ? entry.integrity.byteLength
          : 0),
      0,
    ),
  });
}

export async function verifyNodeLocalMediaBackupExtension(input: Readonly<{
  bundleRoot: string;
  sourceDatabasePath: string;
  profile: LocalWorkspaceBackupProfile;
  canonicalBytes: NodeSqliteBackupCanonicalBytesAdapter;
  checksum: NodeSqliteBackupChecksumAdapter;
}>): Promise<VerifiedLocalMediaBackupBundle> {
  const manifestPath = resolveEntry(
    input.bundleRoot,
    input.profile.localMedia.bundleLayout.manifestEntrySegments,
    "Local media backup manifest",
  );
  const sidecarPath = resolveEntry(
    input.bundleRoot,
    input.profile.localMedia.bundleLayout.manifestChecksumEntrySegments,
    "Local media backup manifest checksum",
  );
  const sidecarBytes = new Uint8Array(await readFile(sidecarPath));
  const sidecar = parseSidecar(input.canonicalBytes.decode(sidecarBytes));
  if (
    !bytesEqual(sidecarBytes, input.canonicalBytes.encode(sidecar)) ||
    sidecar.checksumIdentity !== input.checksum.identity ||
    !sameSegments(
      sidecar.manifestEntrySegments,
      input.profile.localMedia.bundleLayout.manifestEntrySegments,
    )
  ) {
    throw new Error("Local media backup manifest checksum sidecar is invalid");
  }
  const manifestBytes = new Uint8Array(await readFile(manifestPath));
  if (
    manifestBytes.byteLength !== sidecar.byteLength ||
    await checksumBytes(input.checksum, manifestBytes) !== sidecar.checksumValue
  ) {
    throw new Error("Local media backup manifest checksum verification failed");
  }
  const manifest = parseLocalMediaBackupManifest(
    input.canonicalBytes.decode(manifestBytes),
  );
  if (
    !bytesEqual(manifestBytes, input.canonicalBytes.encode(manifest)) ||
    manifest.format.identity !== input.profile.localMedia.format.identity ||
    manifest.format.version !== input.profile.localMedia.format.version
  ) {
    throw new Error("Local media backup manifest format is incompatible");
  }
  const fileChecksum = checksumProfile(
    input.checksum,
    input.profile.checksum.algorithm,
  );
  const databaseIntegrity = await checksumLocalMediaFile({
    filePath: input.sourceDatabasePath,
    checksum: fileChecksum,
  });
  if (!sameStoredLocalMediaIntegrity(
    manifest.workspaceDatabase,
    databaseIntegrity,
  )) {
    throw new Error("Local media manifest does not match the workspace snapshot");
  }
  const referencedTracks = readReferencedLocalMediaTracks(input.sourceDatabasePath);
  if (referencedTracks.length !== manifest.entries.length) {
    throw new Error("Local media manifest entry count does not match the workspace");
  }
  let disconnected = 0;
  let requiredTargetByteCount = 0;
  for (const [index, entry] of manifest.entries.entries()) {
    assertSameTrack(referencedTracks[index]!, entry.track);
    if (entry.storage.kind === "managed-file") {
      const expectedSegments = [
        ...input.profile.localMedia.bundleLayout.managedFileDirectorySegments,
        entry.storage.fileName,
      ];
      if (!sameSegments(entry.storage.bundleRelativeSegments, expectedSegments)) {
        throw new Error("Managed media backup layout is invalid");
      }
      const bundleFilePath = resolveEntry(
        input.bundleRoot,
        entry.storage.bundleRelativeSegments,
        "Managed media bundle entry",
      );
      const bundledIntegrity = await checksumLocalMediaFile({
        filePath: bundleFilePath,
        checksum: fileChecksum,
      });
      if (!sameStoredLocalMediaIntegrity(entry.integrity, bundledIntegrity)) {
        throw new Error("Managed media bundle entry failed checksum verification");
      }
      requiredTargetByteCount += entry.integrity.byteLength;
      if (!Number.isSafeInteger(requiredTargetByteCount)) {
        throw new Error("Local media restore byte count exceeds the supported range");
      }
    } else {
      try {
        const observed = await checksumLocalMediaFile({
          filePath: entry.storage.filePath,
          checksum: fileChecksum,
        });
        if (!sameStoredLocalMediaIntegrity(entry.integrity, observed)) {
          disconnected += 1;
        }
      } catch (error) {
        if (!isMissingLocalMediaError(error)) throw error;
        disconnected += 1;
      }
    }
  }
  return Object.freeze({
    manifest,
    counts: mediaCounts(manifest.entries, disconnected),
    requiredTargetByteCount,
  });
}

export async function stageNodeLocalMediaBackupRestore(input: Readonly<{
  verified: VerifiedLocalMediaBackupBundle;
  bundleRoot: string;
  targetLibraryRootDirectoryPath: string;
  profile: LocalWorkspaceBackupProfile;
  checksum: NodeSqliteBackupChecksumAdapter;
}>): Promise<LocalWorkspaceBackupMediaCounts> {
  const targetPaths = createNodeLocalMediaLibraryPaths(
    input.targetLibraryRootDirectoryPath,
  );
  try {
    await stat(targetPaths.rootDirectoryPath);
    throw new Error("Local media restore target already exists");
  } catch (error) {
    if (!isMissingLocalMediaError(error)) throw error;
  }
  await ensureNodeLocalMediaLibraryPaths(targetPaths);
  const fileChecksum = checksumProfile(
    input.checksum,
    input.profile.checksum.algorithm,
  );
  let disconnected = 0;
  for (const entry of input.verified.manifest.entries) {
    let locator: StoredLocalMediaDescriptor["locator"];
    if (entry.storage.kind === "managed-file") {
      const sourcePath = resolveEntry(
        input.bundleRoot,
        entry.storage.bundleRelativeSegments,
        "Managed media bundle entry",
      );
      const targetPath = path.join(
        targetPaths.filesDirectoryPath,
        entry.storage.fileName,
      );
      await copyFile(sourcePath, targetPath, fileConstants.COPYFILE_EXCL);
      await syncFile(targetPath);
      const restoredIntegrity = await checksumLocalMediaFile({
        filePath: targetPath,
        checksum: fileChecksum,
      });
      if (!sameStoredLocalMediaIntegrity(entry.integrity, restoredIntegrity)) {
        throw new Error("Restored managed media failed checksum verification");
      }
      locator = Object.freeze({
        kind: "managed-file",
        fileName: entry.storage.fileName,
      });
    } else {
      locator = Object.freeze({
        kind: "external-path",
        filePath: entry.storage.filePath,
      });
      try {
        const observed = await checksumLocalMediaFile({
          filePath: entry.storage.filePath,
          checksum: fileChecksum,
        });
        if (!sameStoredLocalMediaIntegrity(entry.integrity, observed)) {
          disconnected += 1;
        }
      } catch (error) {
        if (!isMissingLocalMediaError(error)) throw error;
        disconnected += 1;
      }
    }
    await writeStoredLocalMediaDescriptor({
      paths: targetPaths,
      descriptor: Object.freeze({
        schemaVersion: 2,
        track: entry.track,
        integrity: entry.integrity,
        locator,
      }),
    });
  }
  return mediaCounts(input.verified.manifest.entries, disconnected);
}
