import { entityId, type EntityId } from "../../domain/writing";

export type MusicTransitionPlaybackMode = string;

export type WorkMusicSettings = {
  readonly autoOnEpisodeTransition: boolean;
  readonly autoOnSceneTransition: boolean;
  readonly autoPlayOnPomodoroStart: boolean;
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
  return Object.freeze({ ...settings });
}

export function parseWorkMusicSettings(
  value: unknown,
  profile: MusicSettingsProfile,
): WorkMusicSettings {
  const input = record(value, "WorkMusicSettings");
  exact(input, [
    "autoOnEpisodeTransition",
    "autoOnSceneTransition",
    "autoPlayOnPomodoroStart",
    "preciseSelection",
    "transitionPlaybackMode",
  ], "WorkMusicSettings");
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
  return Object.freeze({
    schemaVersion: schemaVersion(input.schemaVersion, "SaveWorkMusicSettingsCommand"),
    workId: identity<"Work">(input.workId, "SaveWorkMusicSettingsCommand.workId"),
    expectedRevision: revision(input.expectedRevision, "SaveWorkMusicSettingsCommand.expectedRevision"),
    settings: parseWorkMusicSettings(input.settings, profile),
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
  return Object.freeze({
    schemaVersion: schemaVersion(input.schemaVersion, "WorkMusicSettingsProjection"),
    workId: identity<"Work">(input.workId, "WorkMusicSettingsProjection.workId"),
    revision: parsedRevision,
    settings: parseWorkMusicSettings(input.settings, profile),
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
