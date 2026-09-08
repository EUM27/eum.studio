import { randomUUID } from "node:crypto";
import { constants as fileConstants, type BigIntStats } from "node:fs";
import {
  copyFile,
  open,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

import {
  parseInspectLocalMediaCommand,
  parseLocalMediaPlaybackUrl,
  parseLocalMediaTrackProjection,
  parseRelinkLocalMediaCommand,
  type InspectLocalMediaCommand,
  type InspectLocalMediaResult,
  type LocalMediaAvailabilityProjection,
  type LocalMediaStorageMode,
  type LocalMediaTrackProjection,
  type RelinkLocalMediaCommand,
} from "../../application/music/media-track";
import {
  checksumLocalMediaFile,
  createNodeLocalMediaLibraryPaths,
  ensureNodeLocalMediaLibraryPaths,
  isMissingLocalMediaError,
  localMediaDescriptorPath,
  localMediaOpaqueFileStem,
  localMediaSourcePath,
  readStoredLocalMediaDescriptor,
  sameStoredLocalMediaIntegrity,
  writeStoredLocalMediaDescriptor,
  type NodeLocalMediaChecksumProfile,
  type StoredLocalMediaDescriptor,
} from "./node-local-media-descriptor";

type SupportedMedia = Readonly<{
  mediaKind: "audio" | "video";
  mediaType: string;
}>;

const SUPPORTED_MEDIA_BY_EXTENSION: Readonly<Record<string, SupportedMedia>> =
  Object.freeze({
    ".mp3": Object.freeze({ mediaKind: "audio", mediaType: "audio/mpeg" }),
    ".mp4": Object.freeze({ mediaKind: "video", mediaType: "video/mp4" }),
  });

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
  inspect(input: InspectLocalMediaCommand): Promise<InspectLocalMediaResult>;
  relink(input: RelinkLocalMediaCommand & Readonly<{
    filePath: string;
  }>): Promise<LocalMediaAvailabilityProjection>;
  resolvePlaybackUrl(url: string): Promise<LocalMediaPlaybackSource>;
}>;

function supportedMedia(filePath: string): SupportedMedia {
  const extension = path.extname(filePath).toLocaleLowerCase();
  const media = SUPPORTED_MEDIA_BY_EXTENSION[extension];
  if (media === undefined) {
    throw new Error("지원하는 로컬 미디어 형식은 MP3와 MP4입니다.");
  }
  return media;
}

function fileVersion(details: BigIntStats): string {
  return [details.dev, details.ino, details.size, details.mtimeNs, details.ctimeNs].join(":");
}

export async function openNodeLocalMediaLibrary(input: {
  readonly rootDirectoryPath: string;
  readonly checksum: NodeLocalMediaChecksumProfile;
  readonly createId?: () => string;
}): Promise<NodeLocalMediaLibrary> {
  const paths = createNodeLocalMediaLibraryPaths(input.rootDirectoryPath);
  await ensureNodeLocalMediaLibraryPaths(paths);
  const createId = input.createId ?? randomUUID;
  const playbackVerifications = new Map<string, Readonly<{
    descriptor: string;
    version: string;
    complete: Promise<void>;
  }>>();

  const assertDescriptorIdentity = (
    descriptor: StoredLocalMediaDescriptor,
    workId: string,
    mediaId: string,
  ): void => {
    if (
      descriptor.track.mediaId !== mediaId ||
      descriptor.track.workId !== workId
    ) {
      throw new Error("Local media identity does not match its descriptor");
    }
  };

  const inspectOne = async (
    workId: string,
    mediaId: string,
  ): Promise<LocalMediaAvailabilityProjection> => {
    let descriptor: StoredLocalMediaDescriptor;
    try {
      descriptor = await readStoredLocalMediaDescriptor({ paths, mediaId });
    } catch (error) {
      if (isMissingLocalMediaError(error)) {
        return Object.freeze({
          schemaVersion: 1,
          workId: workId as LocalMediaAvailabilityProjection["workId"],
          mediaId,
          status: "disconnected",
        });
      }
      throw error;
    }
    assertDescriptorIdentity(descriptor, workId, mediaId);
    try {
      const observed = await checksumLocalMediaFile({
        filePath: localMediaSourcePath(paths, descriptor),
        checksum: input.checksum,
      });
      return Object.freeze({
        schemaVersion: 1,
        workId: descriptor.track.workId,
        mediaId,
        status: descriptor.integrity === null
          ? "unverified"
          : sameStoredLocalMediaIntegrity(descriptor.integrity, observed)
            ? "available"
            : "changed",
      });
    } catch (error) {
      if (isMissingLocalMediaError(error)) {
        return Object.freeze({
          schemaVersion: 1,
          workId: descriptor.track.workId,
          mediaId,
          status: "disconnected",
        });
      }
      throw error;
    }
  };

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
          const media = supportedMedia(filePath);
          const integrity = await checksumLocalMediaFile({
            filePath,
            checksum: input.checksum,
          });
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
            byteLength: integrity.byteLength,
          });
          return Object.freeze({ filePath, integrity, track });
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
        for (const { filePath, integrity, track } of prepared) {
          const stem = localMediaOpaqueFileStem(track.mediaId);
          let locator: StoredLocalMediaDescriptor["locator"];
          if (registrationInput.storageMode === "managed-copy") {
            const managedFileName = `${stem}${path.extname(filePath).toLocaleLowerCase()}`;
            const managedPath = path.join(paths.filesDirectoryPath, managedFileName);
            const temporaryManagedPath = path.join(
              paths.temporaryDirectoryPath,
              `${managedFileName}.${randomUUID()}.tmp`,
            );
            createdPaths.push(temporaryManagedPath);
            await copyFile(filePath, temporaryManagedPath, fileConstants.COPYFILE_EXCL);
            const copiedIntegrity = await checksumLocalMediaFile({
              filePath: temporaryManagedPath,
              checksum: input.checksum,
            });
            if (!sameStoredLocalMediaIntegrity(integrity, copiedIntegrity)) {
              throw new Error("Managed local media copy does not match its source");
            }
            const handle = await open(temporaryManagedPath, "r+");
            try {
              await handle.sync();
            } finally {
              await handle.close();
            }
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
            schemaVersion: 2,
            track,
            integrity,
            locator,
          });
          await writeStoredLocalMediaDescriptor({ paths, descriptor });
          createdPaths.push(localMediaDescriptorPath(paths, track.mediaId));
        }
      } catch (reason) {
        await Promise.all(createdPaths.map((createdPath) =>
          rm(createdPath, { force: true })
        ));
        throw reason;
      }

      return Object.freeze(prepared.map(({ track }) => track));
    },

    async inspect(value) {
      const command = parseInspectLocalMediaCommand(value);
      return Object.freeze({
        schemaVersion: 1,
        workId: command.workId,
        entries: Object.freeze(await Promise.all(command.mediaIds.map(
          (mediaId) => inspectOne(command.workId, mediaId),
        ))),
      });
    },

    async relink(value) {
      const command = parseRelinkLocalMediaCommand({
        schemaVersion: value.schemaVersion,
        workId: value.workId,
        mediaId: value.mediaId,
      });
      if (!path.isAbsolute(value.filePath)) {
        throw new Error("Selected local media path must be absolute");
      }
      const descriptor = await readStoredLocalMediaDescriptor({
        paths,
        mediaId: command.mediaId,
      });
      assertDescriptorIdentity(descriptor, command.workId, command.mediaId);
      if (
        descriptor.track.storageMode !== "external-reference" ||
        descriptor.locator.kind !== "external-path"
      ) {
        throw new Error("Only external local media can be reconnected");
      }
      const selectedMedia = supportedMedia(value.filePath);
      if (
        selectedMedia.mediaKind !== descriptor.track.mediaKind ||
        selectedMedia.mediaType !== descriptor.track.mediaType
      ) {
        throw new Error("선택한 파일 형식이 등록된 미디어와 일치하지 않습니다.");
      }
      const integrity = await checksumLocalMediaFile({
        filePath: value.filePath,
        checksum: input.checksum,
      });
      if (
        descriptor.integrity !== null
          ? !sameStoredLocalMediaIntegrity(descriptor.integrity, integrity)
          : integrity.byteLength !== descriptor.track.byteLength
      ) {
        throw new Error("선택한 파일이 등록된 원본과 일치하지 않습니다.");
      }
      await writeStoredLocalMediaDescriptor({
        paths,
        descriptor: Object.freeze({
          schemaVersion: 2,
          track: descriptor.track,
          integrity,
          locator: Object.freeze({
            kind: "external-path",
            filePath: path.resolve(value.filePath),
          }),
        }),
      });
      return Object.freeze({
        schemaVersion: 1,
        workId: descriptor.track.workId,
        mediaId: descriptor.track.mediaId,
        status: "available",
      });
    },

    async resolvePlaybackUrl(url) {
      const identity = parseLocalMediaPlaybackUrl(url);
      const descriptor = await readStoredLocalMediaDescriptor({
        paths,
        mediaId: identity.mediaId,
      });
      assertDescriptorIdentity(descriptor, identity.workId, identity.mediaId);
      const filePath = localMediaSourcePath(paths, descriptor);
      const fileStat = await stat(filePath, { bigint: true });
      if (!fileStat.isFile()) {
        throw new Error("Registered local media is unavailable");
      }
      if (descriptor.integrity !== null) {
        const descriptorKey = JSON.stringify([filePath, descriptor.integrity]);
        const version = fileVersion(fileStat);
        let verification = playbackVerifications.get(identity.mediaId);
        if (verification?.descriptor !== descriptorKey || verification.version !== version) {
          verification = {
            descriptor: descriptorKey,
            version,
            complete: (async () => {
              const observed = await checksumLocalMediaFile({ filePath, checksum: input.checksum });
              const after = await stat(filePath, { bigint: true });
              if (fileVersion(after) !== version || !sameStoredLocalMediaIntegrity(descriptor.integrity!, observed)) {
                throw new Error("등록된 미디어 파일이 변경되어 재생할 수 없습니다.");
              }
            })(),
          };
          playbackVerifications.set(identity.mediaId, verification);
        }
        try {
          await verification.complete;
        } catch (error) {
          if (playbackVerifications.get(identity.mediaId) === verification) playbackVerifications.delete(identity.mediaId);
          throw error;
        }
      }
      return Object.freeze({
        filePath,
        mediaType: descriptor.track.mediaType,
      });
    },
  });
}
