import type { EntityId } from "../../domain/writing";
import {
  parseYouTubeVideoProjection,
  type YouTubeVideoProjection,
} from "./youtube-music";

export type LocalMediaStorageMode =
  | "external-reference"
  | "managed-copy";

export type LocalMediaTrackProjection = Readonly<{
  sourceKind: "local-file";
  mediaId: string;
  workId: EntityId<"Work">;
  title: string;
  fileName: string;
  mediaKind: "audio" | "video";
  mediaType: string;
  storageMode: LocalMediaStorageMode;
  byteLength: number;
}>;

export type MusicTrackProjection =
  | YouTubeVideoProjection
  | LocalMediaTrackProjection;

export type SelectLocalMediaCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  storageMode: LocalMediaStorageMode;
}>;

export type SelectLocalMediaResult =
  | Readonly<{ schemaVersion: 1; status: "cancelled" }>
  | Readonly<{
      schemaVersion: 1;
      status: "selected";
      workId: EntityId<"Work">;
      tracks: readonly LocalMediaTrackProjection[];
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

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function byteLength(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function storageMode(value: unknown, label: string): LocalMediaStorageMode {
  if (value !== "external-reference" && value !== "managed-copy") {
    throw new Error(`${label} is unsupported`);
  }
  return value;
}

export function parseLocalMediaTrackProjection(
  value: unknown,
  label = "LocalMediaTrackProjection",
): LocalMediaTrackProjection {
  const input = record(value, label);
  exact(input, [
    "sourceKind",
    "mediaId",
    "workId",
    "title",
    "fileName",
    "mediaKind",
    "mediaType",
    "storageMode",
    "byteLength",
  ], label);
  if (input.sourceKind !== "local-file") {
    throw new Error(`${label}.sourceKind must be local-file`);
  }
  if (input.mediaKind !== "audio" && input.mediaKind !== "video") {
    throw new Error(`${label}.mediaKind is unsupported`);
  }
  return Object.freeze({
    sourceKind: "local-file",
    mediaId: nonEmpty(input.mediaId, `${label}.mediaId`),
    workId: nonEmpty(input.workId, `${label}.workId`) as EntityId<"Work">,
    title: nonEmpty(input.title, `${label}.title`),
    fileName: nonEmpty(input.fileName, `${label}.fileName`),
    mediaKind: input.mediaKind,
    mediaType: nonEmpty(input.mediaType, `${label}.mediaType`),
    storageMode: storageMode(input.storageMode, `${label}.storageMode`),
    byteLength: byteLength(input.byteLength, `${label}.byteLength`),
  });
}

export function isLocalMediaTrack(
  track: MusicTrackProjection,
): track is LocalMediaTrackProjection {
  return "sourceKind" in track && track.sourceKind === "local-file";
}

export function isYouTubeMusicTrack(
  track: MusicTrackProjection,
): track is YouTubeVideoProjection {
  return !isLocalMediaTrack(track);
}

export function parseMusicTrackProjection(
  value: unknown,
  label = "MusicTrackProjection",
): MusicTrackProjection {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).sourceKind === "local-file"
  ) {
    return parseLocalMediaTrackProjection(value, label);
  }
  return parseYouTubeVideoProjection(value, label);
}

export function musicTrackIdentity(track: MusicTrackProjection): string {
  return isLocalMediaTrack(track)
    ? `local:${track.mediaId}`
    : `youtube:${track.providerId}:${track.videoId}`;
}

export function localMediaPlaybackUrl(
  track: Pick<LocalMediaTrackProjection, "workId" | "mediaId">,
): string {
  return `eum-media://library/${encodeURIComponent(track.workId)}/${encodeURIComponent(track.mediaId)}`;
}

export function parseLocalMediaPlaybackUrl(value: string): Readonly<{
  workId: string;
  mediaId: string;
}> {
  const parsed = new URL(value);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "eum-media:" ||
    parsed.hostname !== "library" ||
    segments.length !== 2 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error("Local media playback URL is invalid");
  }
  return Object.freeze({
    workId: nonEmpty(decodeURIComponent(segments[0]!), "Local media workId"),
    mediaId: nonEmpty(decodeURIComponent(segments[1]!), "Local media mediaId"),
  });
}

export function parseSelectLocalMediaCommand(
  value: unknown,
): SelectLocalMediaCommand {
  const label = "SelectLocalMediaCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "storageMode"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: nonEmpty(input.workId, `${label}.workId`) as EntityId<"Work">,
    storageMode: storageMode(input.storageMode, `${label}.storageMode`),
  });
}

export function parseSelectLocalMediaResult(
  value: unknown,
): SelectLocalMediaResult {
  const label = "SelectLocalMediaResult";
  const input = record(value, label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  if (input.status !== "selected") {
    throw new Error(`${label}.status is unsupported`);
  }
  exact(input, ["schemaVersion", "status", "workId", "tracks"], label);
  if (!Array.isArray(input.tracks) || input.tracks.length === 0) {
    throw new Error(`${label}.tracks must be a non-empty array`);
  }
  const workId = nonEmpty(input.workId, `${label}.workId`) as EntityId<"Work">;
  const tracks = Object.freeze(input.tracks.map((track, index) =>
    parseLocalMediaTrackProjection(track, `${label}.tracks[${index}]`)
  ));
  if (tracks.some((track) => track.workId !== workId)) {
    throw new Error(`${label}.tracks cross the Work boundary`);
  }
  if (new Set(tracks.map((track) => track.mediaId)).size !== tracks.length) {
    throw new Error(`${label}.tracks contain duplicate identities`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "selected",
    workId,
    tracks,
  });
}
