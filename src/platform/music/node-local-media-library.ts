import { createHash, randomUUID } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  parseLocalMediaPlaybackUrl,
  parseLocalMediaTrackProjection,
  type LocalMediaStorageMode,
  type LocalMediaTrackProjection,
} from "../../application/music/media-track";

type SupportedMedia = Readonly<{
  mediaKind: "audio" | "video";
  mediaType: string;
}>;

const SUPPORTED_MEDIA_BY_EXTENSION: Readonly<Record<string, SupportedMedia>> =
  Object.freeze({
    ".mp3": Object.freeze({ mediaKind: "audio", mediaType: "audio/mpeg" }),
    ".mp4": Object.freeze({ mediaKind: "video", mediaType: "video/mp4" }),
  });

type StoredLocalMediaDescriptor = Readonly<{
  schemaVersion: 1;
  track: LocalMediaTrackProjection;
  locator:
    | Readonly<{ kind: "external-path"; filePath: string }>
    | Readonly<{ kind: "managed-file"; fileName: string }>;
}>;

export type LocalMediaPlaybackSource = Readonly<{
  filePath: string;
  mediaType: string;
}>;

export type NodeLocalMediaLibrary = Readonly<{
  register(input: Readonly<{
    workId: string;
    storageMode: LocalMediaStorageMode;
    filePaths: readonly string[];
  }>): Promise<readonly LocalMediaTrackProjection[]>;
  resolvePlaybackUrl(url: string): Promise<LocalMediaPlaybackSource>;
}>;

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

function parseStoredDescriptor(value: unknown): StoredLocalMediaDescriptor {
  const label = "Stored local media descriptor";
  const input = record(value, label);
  exact(input, ["schemaVersion", "track", "locator"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  const track = parseLocalMediaTrackProjection(input.track, `${label}.track`);
  const locatorInput = record(input.locator, `${label}.locator`);
  if (locatorInput.kind === "external-path") {
    exact(locatorInput, ["kind", "filePath"], `${label}.locator`);
    if (
      track.storageMode !== "external-reference" ||
      typeof locatorInput.filePath !== "string" ||
      !path.isAbsolute(locatorInput.filePath)
    ) {
      throw new Error(`${label}.locator does not match external-reference`);
    }
    return Object.freeze({
      schemaVersion: 1,
      track,
      locator: Object.freeze({
        kind: "external-path",
        filePath: locatorInput.filePath,
      }),
    });
  }
  if (locatorInput.kind === "managed-file") {
    exact(locatorInput, ["kind", "fileName"], `${label}.locator`);
    if (
      track.storageMode !== "managed-copy" ||
      typeof locatorInput.fileName !== "string" ||
      locatorInput.fileName.length === 0 ||
      path.basename(locatorInput.fileName) !== locatorInput.fileName
    ) {
      throw new Error(`${label}.locator does not match managed-copy`);
    }
    return Object.freeze({
      schemaVersion: 1,
      track,
      locator: Object.freeze({
        kind: "managed-file",
        fileName: locatorInput.fileName,
      }),
    });
  }
  throw new Error(`${label}.locator.kind is unsupported`);
}

function opaqueFileStem(mediaId: string): string {
  return createHash("sha256").update(mediaId, "utf8").digest("hex");
}

function descriptorFileName(mediaId: string): string {
  return `${opaqueFileStem(mediaId)}.json`;
}

function supportedMedia(filePath: string): SupportedMedia {
  const extension = path.extname(filePath).toLocaleLowerCase();
  const media = SUPPORTED_MEDIA_BY_EXTENSION[extension];
  if (media === undefined) {
    throw new Error("지원하는 로컬 미디어 형식은 MP3와 MP4입니다.");
  }
  return media;
}

export async function openNodeLocalMediaLibrary(input: {
  readonly rootDirectoryPath: string;
  readonly createId?: () => string;
}): Promise<NodeLocalMediaLibrary> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("Local media library rootDirectoryPath must be absolute");
  }
  const entriesDirectoryPath = path.join(input.rootDirectoryPath, "entries");
  const filesDirectoryPath = path.join(input.rootDirectoryPath, "files");
  const temporaryDirectoryPath = path.join(input.rootDirectoryPath, "temporary");
  await Promise.all([
    mkdir(entriesDirectoryPath, { recursive: true }),
    mkdir(filesDirectoryPath, { recursive: true }),
    mkdir(temporaryDirectoryPath, { recursive: true }),
  ]);
  const createId = input.createId ?? randomUUID;

  return Object.freeze({
    async register(registrationInput) {
      if (registrationInput.workId.trim().length === 0) {
        throw new Error("Local media Work identity must not be empty");
      }
      if (
        registrationInput.storageMode !== "external-reference" &&
        registrationInput.storageMode !== "managed-copy"
      ) {
        throw new Error("Local media storage mode is unsupported");
      }
      if (registrationInput.filePaths.length === 0) {
        return Object.freeze([]);
      }

      const prepared = await Promise.all(registrationInput.filePaths.map(
        async (filePath) => {
          if (!path.isAbsolute(filePath)) {
            throw new Error("Selected local media path must be absolute");
          }
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) {
            throw new Error("Selected local media path must be a file");
          }
          const media = supportedMedia(filePath);
          const mediaId = createId();
          if (mediaId.trim().length === 0) {
            throw new Error("Local media identity must not be empty");
          }
          const fileName = path.basename(filePath);
          const title = path.parse(fileName).name || fileName;
          const track = parseLocalMediaTrackProjection({
            sourceKind: "local-file",
            mediaId,
            workId: registrationInput.workId,
            title,
            fileName,
            mediaKind: media.mediaKind,
            mediaType: media.mediaType,
            storageMode: registrationInput.storageMode,
            byteLength: fileStat.size,
          });
          return Object.freeze({ filePath, track });
        },
      ));
      if (
        new Set(prepared.map(({ track }) => track.mediaId)).size !==
          prepared.length
      ) {
        throw new Error("Local media identities must be unique");
      }

      const createdPaths: string[] = [];
      try {
        for (const { filePath, track } of prepared) {
          const stem = opaqueFileStem(track.mediaId);
          let locator: StoredLocalMediaDescriptor["locator"];
          if (registrationInput.storageMode === "managed-copy") {
            const managedFileName = `${stem}${path.extname(filePath).toLocaleLowerCase()}`;
            const managedPath = path.join(filesDirectoryPath, managedFileName);
            const temporaryManagedPath = path.join(
              temporaryDirectoryPath,
              `${managedFileName}.${randomUUID()}.tmp`,
            );
            createdPaths.push(temporaryManagedPath);
            await copyFile(filePath, temporaryManagedPath, fileConstants.COPYFILE_EXCL);
            await rename(temporaryManagedPath, managedPath);
            createdPaths.push(managedPath);
            locator = Object.freeze({
              kind: "managed-file",
              fileName: managedFileName,
            });
          } else {
            locator = Object.freeze({ kind: "external-path", filePath });
          }

          const descriptor: StoredLocalMediaDescriptor = Object.freeze({
            schemaVersion: 1,
            track,
            locator,
          });
          const descriptorPath = path.join(
            entriesDirectoryPath,
            descriptorFileName(track.mediaId),
          );
          const temporaryDescriptorPath = path.join(
            temporaryDirectoryPath,
            `${stem}.${randomUUID()}.json.tmp`,
          );
          createdPaths.push(temporaryDescriptorPath);
          await writeFile(
            temporaryDescriptorPath,
            `${JSON.stringify(descriptor)}\n`,
            { encoding: "utf8", flag: "wx", mode: 0o600 },
          );
          await rename(temporaryDescriptorPath, descriptorPath);
          createdPaths.push(descriptorPath);
        }
      } catch (reason) {
        await Promise.all(createdPaths.map((createdPath) =>
          rm(createdPath, { force: true })
        ));
        throw reason;
      }

      return Object.freeze(prepared.map(({ track }) => track));
    },

    async resolvePlaybackUrl(url) {
      const identity = parseLocalMediaPlaybackUrl(url);
      const descriptorPath = path.join(
        entriesDirectoryPath,
        descriptorFileName(identity.mediaId),
      );
      const descriptor = parseStoredDescriptor(
        JSON.parse(await readFile(descriptorPath, "utf8")),
      );
      if (
        descriptor.track.mediaId !== identity.mediaId ||
        descriptor.track.workId !== identity.workId
      ) {
        throw new Error("Local media playback identity does not match its descriptor");
      }
      const filePath = descriptor.locator.kind === "external-path"
        ? descriptor.locator.filePath
        : path.join(filesDirectoryPath, descriptor.locator.fileName);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new Error("Registered local media is unavailable");
      }
      return Object.freeze({
        filePath,
        mediaType: descriptor.track.mediaType,
      });
    },
  });
}
