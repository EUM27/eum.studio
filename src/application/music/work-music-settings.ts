import { entityId, type EntityId } from "../../domain/writing";
import {
  isLocalMediaTrack,
  musicTrackIdentity,
  parseLocalMediaTrackProjection,
  parseMusicTrackProjection,
  type LocalMediaTrackProjection,
  type MusicTrackProjection,
} from "./media-track";

export type MusicTransitionPlaybackMode = string;

export type WorkMusicSettings = {
  readonly autoOnEpisodeTransition: boolean;
  readonly autoOnSceneTransition: boolean;
  readonly autoPlayOnPomodoroStart: boolean;
  readonly favoriteTracks: readonly MusicTrackProjection[];
  readonly playlistTracks: readonly MusicTrackProjection[];
  readonly localMedia: readonly LocalMediaTrackProjection[];
  readonly preciseSelection: boolean;
  readonly transitionPlaybackMode: MusicTransitionPlaybackMode;
};

export type MusicSettingsProfile = {
  readonly schemaVersion: 1;
  readonly workDefaults: WorkMusicSettings;
  readonly transitionPlaybackModes: readonly MusicTransitionPlaybackMode[];
};

export type GetWorkMusicSettingsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveWorkMusicSettingsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly expectedRevision: number;
  readonly settings: WorkMusicSettings;
};

export type WorkMusicSettingsProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly settings: WorkMusicSettings;
  readonly updatedAt: string | null;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((field) => !allowed.has(field))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function schemaVersion(value: unknown, label: string): 1 {
  if (value !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return 1;
}

function identity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function timestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be null or an ISO timestamp`);
  }
  return value;
}

function freezeSettings(settings: WorkMusicSettings): WorkMusicSettings {
  return Object.freeze({
    ...settings,
    favoriteTracks: Object.freeze([...settings.favoriteTracks]),
    playlistTracks: Object.freeze([...settings.playlistTracks]),
    localMedia: Object.freeze([...settings.localMedia]),
  });
}

function parseUniqueTracks(
  value: unknown,
  label: string,
): readonly MusicTrackProjection[] {
  const values = value ?? [];
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  const tracks = values.map((track, index) =>
    parseMusicTrackProjection(track, `${label}[${index}]`)
  );
  if (
    new Set(tracks.map((track) => musicTrackIdentity(track))).size !==
      tracks.length
  ) {
    throw new Error(`${label} must be unique`);
  }
  return Object.freeze(tracks);
}

function parseUniqueLocalMedia(
  value: unknown,
  label: string,
): readonly LocalMediaTrackProjection[] {
  const values = value ?? [];
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  const tracks = values.map((track, index) =>
    parseLocalMediaTrackProjection(track, `${label}[${index}]`)
  );
  if (new Set(tracks.map((track) => track.mediaId)).size !== tracks.length) {
    throw new Error(`${label} must be unique`);
  }
  return Object.freeze(tracks);
}

function assertWorkOwnedLocalMedia(
  settings: WorkMusicSettings,
  workId: EntityId<"Work">,
  label: string,
): void {
  const localTracks = [
    ...settings.localMedia,
    ...settings.favoriteTracks.filter(isLocalMediaTrack),
    ...settings.playlistTracks.filter(isLocalMediaTrack),
  ];
  if (localTracks.some((track) => track.workId !== workId)) {
    throw new Error(`${label} local media crosses the Work boundary`);
  }
}

export function parseWorkMusicSettings(
  value: unknown,
  profile: MusicSettingsProfile,
): WorkMusicSettings {
  const input = record(value, "WorkMusicSettings");
  const baseFields = [
    "autoOnEpisodeTransition",
    "autoOnSceneTransition",
    "autoPlayOnPomodoroStart",
    "preciseSelection",
    "transitionPlaybackMode",
  ] as const;
  const fields = Object.keys(input);
  const optionalFields = [
    "favoriteTracks",
    "playlistTracks",
    "localMedia",
    "favoriteVideos",
    "playlistVideos",
  ] as const;
  if (
    !fields.every((field) =>
      baseFields.includes(field as (typeof baseFields)[number]) ||
      optionalFields.includes(field as (typeof optionalFields)[number])
    ) ||
    !baseFields.every((field) => fields.includes(field)) ||
    (fields.includes("favoriteTracks") && fields.includes("favoriteVideos")) ||
    (fields.includes("playlistTracks") && fields.includes("playlistVideos"))
  ) {
    throw new Error("WorkMusicSettings fields do not match the configured schema");
  }
  if (
    typeof input.transitionPlaybackMode !== "string" ||
    !profile.transitionPlaybackModes.includes(input.transitionPlaybackMode)
  ) {
    throw new Error("WorkMusicSettings.transitionPlaybackMode is not configured");
  }
  return freezeSettings({
    autoOnEpisodeTransition: booleanValue(
      input.autoOnEpisodeTransition,
      "WorkMusicSettings.autoOnEpisodeTransition",
    ),
    autoOnSceneTransition: booleanValue(
      input.autoOnSceneTransition,
      "WorkMusicSettings.autoOnSceneTransition",
    ),
    autoPlayOnPomodoroStart: booleanValue(
      input.autoPlayOnPomodoroStart,
      "WorkMusicSettings.autoPlayOnPomodoroStart",
    ),
    favoriteTracks: parseUniqueTracks(
      fields.includes("favoriteTracks")
        ? input.favoriteTracks
        : input.favoriteVideos,
      "WorkMusicSettings.favoriteTracks",
    ),
    playlistTracks: parseUniqueTracks(
      fields.includes("playlistTracks")
        ? input.playlistTracks
        : input.playlistVideos,
      "WorkMusicSettings.playlistTracks",
    ),
    localMedia: parseUniqueLocalMedia(
      input.localMedia,
      "WorkMusicSettings.localMedia",
    ),
    preciseSelection: booleanValue(
      input.preciseSelection,
      "WorkMusicSettings.preciseSelection",
    ),
    transitionPlaybackMode: input.transitionPlaybackMode,
  });
}

export function parseMusicSettingsProfile(value: unknown): MusicSettingsProfile {
  const input = record(value, "MusicSettingsProfile");
  exact(input, ["schemaVersion", "workDefaults", "transitionPlaybackModes"], "MusicSettingsProfile");
  schemaVersion(input.schemaVersion, "MusicSettingsProfile");
  if (!Array.isArray(input.transitionPlaybackModes)) {
    throw new Error("MusicSettingsProfile.transitionPlaybackModes must be an array");
  }
  const modes = input.transitionPlaybackModes.map((mode, index) => {
    if (typeof mode !== "string" || mode.length === 0) {
      throw new Error(`MusicSettingsProfile.transitionPlaybackModes[${index}] must be text`);
    }
    return mode;
  });
  if (modes.length === 0 || new Set(modes).size !== modes.length) {
    throw new Error("MusicSettingsProfile.transitionPlaybackModes must be unique and non-empty");
  }
  const partial = Object.freeze({
    schemaVersion: 1 as const,
    transitionPlaybackModes: Object.freeze(modes),
  });
  return Object.freeze({
    ...partial,
    workDefaults: parseWorkMusicSettings(input.workDefaults, {
      ...partial,
      workDefaults: input.workDefaults as WorkMusicSettings,
    }),
  });
}

export function parseGetWorkMusicSettingsCommand(
  value: unknown,
): GetWorkMusicSettingsCommand {
  const input = record(value, "GetWorkMusicSettingsCommand");
  exact(input, ["schemaVersion", "workId"], "GetWorkMusicSettingsCommand");
  return Object.freeze({
    schemaVersion: schemaVersion(input.schemaVersion, "GetWorkMusicSettingsCommand"),
    workId: identity<"Work">(input.workId, "GetWorkMusicSettingsCommand.workId"),
  });
}

export function parseSaveWorkMusicSettingsCommand(
  value: unknown,
  profile: MusicSettingsProfile,
): SaveWorkMusicSettingsCommand {
  const input = record(value, "SaveWorkMusicSettingsCommand");
  exact(input, ["schemaVersion", "workId", "expectedRevision", "settings"], "SaveWorkMusicSettingsCommand");
  const workId = identity<"Work">(input.workId, "SaveWorkMusicSettingsCommand.workId");
  const settings = parseWorkMusicSettings(input.settings, profile);
  assertWorkOwnedLocalMedia(settings, workId, "SaveWorkMusicSettingsCommand");
  return Object.freeze({
    schemaVersion: schemaVersion(input.schemaVersion, "SaveWorkMusicSettingsCommand"),
    workId,
    expectedRevision: revision(input.expectedRevision, "SaveWorkMusicSettingsCommand.expectedRevision"),
    settings,
  });
}

export function parseWorkMusicSettingsProjection(
  value: unknown,
  profile: MusicSettingsProfile,
): WorkMusicSettingsProjection {
  const input = record(value, "WorkMusicSettingsProjection");
  exact(input, ["schemaVersion", "workId", "revision", "settings", "updatedAt"], "WorkMusicSettingsProjection");
  const parsedRevision = revision(input.revision, "WorkMusicSettingsProjection.revision");
  const updatedAt = timestamp(input.updatedAt, "WorkMusicSettingsProjection.updatedAt");
  if ((parsedRevision === 0) !== (updatedAt === null)) {
    throw new Error("WorkMusicSettingsProjection revision and updatedAt are inconsistent");
  }
  const workId = identity<"Work">(input.workId, "WorkMusicSettingsProjection.workId");
  const settings = parseWorkMusicSettings(input.settings, profile);
  assertWorkOwnedLocalMedia(settings, workId, "WorkMusicSettingsProjection");
  return Object.freeze({
    schemaVersion: schemaVersion(input.schemaVersion, "WorkMusicSettingsProjection"),
    workId,
    revision: parsedRevision,
    settings,
    updatedAt,
  });
}

export function createDefaultWorkMusicSettingsProjection(
  workId: EntityId<"Work">,
  profile: MusicSettingsProfile,
): WorkMusicSettingsProjection {
  return parseWorkMusicSettingsProjection({
    schemaVersion: 1,
    workId,
    revision: 0,
    settings: profile.workDefaults,
    updatedAt: null,
  }, profile);
}
