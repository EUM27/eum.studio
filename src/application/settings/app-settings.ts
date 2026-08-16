import type { EntityId } from "../../domain/writing";

export type AppSettingsProfile = {
  readonly schemaVersion: 1;
  readonly defaultEpisodeCharacters: {
    readonly defaultValue: number;
    readonly minValue: number;
    readonly maxValue: number;
  };
};

export type AppSettings = {
  readonly defaultEpisodeCharacters: number;
};

export type AppSettingsProjection = {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly settings: AppSettings;
  readonly updatedAt: string | null;
};

export type SaveAppSettingsCommand = {
  readonly schemaVersion: 1;
  readonly expectedRevision: number;
  readonly settings: AppSettings;
};

export type WorkEpisodeCharacterProgress = {
  readonly defaultEpisodeCharacters: number;
  readonly totalCharacters: number;
  readonly totalEpisodeCount: number;
  readonly completedEpisodeCount: number;
  readonly completedEpisodeNumbers: readonly number[];
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
    Object.keys(value).length !== allowed.size ||
    Object.keys(value).some((field) => !allowed.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function schema(value: unknown, label: string): 1 {
  if (value !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return 1;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function absoluteInstant(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be null or an absolute instant`);
  }
  return new Date(value).toISOString();
}

export function parseAppSettingsProfile(value: unknown): AppSettingsProfile {
  const input = record(value, "App settings profile");
  exact(
    input,
    ["schemaVersion", "defaultEpisodeCharacters"],
    "App settings profile",
  );
  const field = record(
    input.defaultEpisodeCharacters,
    "App settings profile.defaultEpisodeCharacters",
  );
  exact(
    field,
    ["defaultValue", "minValue", "maxValue"],
    "App settings profile.defaultEpisodeCharacters",
  );
  const minValue = positiveInteger(
    field.minValue,
    "App settings profile.defaultEpisodeCharacters.minValue",
  );
  const maxValue = positiveInteger(
    field.maxValue,
    "App settings profile.defaultEpisodeCharacters.maxValue",
  );
  const defaultValue = positiveInteger(
    field.defaultValue,
    "App settings profile.defaultEpisodeCharacters.defaultValue",
  );
  if (minValue > maxValue || defaultValue < minValue || defaultValue > maxValue) {
    throw new Error("App settings profile defaultEpisodeCharacters range is invalid");
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "App settings profile"),
    defaultEpisodeCharacters: Object.freeze({
      defaultValue,
      minValue,
      maxValue,
    }),
  });
}

function parseSettings(
  value: unknown,
  profile?: AppSettingsProfile,
): AppSettings {
  const input = record(value, "App settings");
  exact(input, ["defaultEpisodeCharacters"], "App settings");
  const defaultEpisodeCharacters = positiveInteger(
    input.defaultEpisodeCharacters,
    "App settings.defaultEpisodeCharacters",
  );
  if (
    profile !== undefined &&
    (defaultEpisodeCharacters < profile.defaultEpisodeCharacters.minValue ||
      defaultEpisodeCharacters > profile.defaultEpisodeCharacters.maxValue)
  ) {
    throw new Error("App settings.defaultEpisodeCharacters is outside the profile range");
  }
  return Object.freeze({ defaultEpisodeCharacters });
}

export function createDefaultAppSettingsProjection(
  profile: AppSettingsProfile,
): AppSettingsProjection {
  return Object.freeze({
    schemaVersion: 1,
    revision: 0,
    settings: Object.freeze({
      defaultEpisodeCharacters:
        profile.defaultEpisodeCharacters.defaultValue,
    }),
    updatedAt: null,
  });
}

export function parseSaveAppSettingsCommand(
  value: unknown,
  profile: AppSettingsProfile,
): SaveAppSettingsCommand {
  const input = record(value, "Save app settings command");
  exact(
    input,
    ["schemaVersion", "expectedRevision", "settings"],
    "Save app settings command",
  );
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "Save app settings command"),
    expectedRevision: nonNegativeInteger(
      input.expectedRevision,
      "Save app settings command.expectedRevision",
    ),
    settings: parseSettings(input.settings, profile),
  });
}

export function parseAppSettingsProjection(
  value: unknown,
  profile?: AppSettingsProfile,
): AppSettingsProjection {
  const input = record(value, "App settings projection");
  exact(
    input,
    ["schemaVersion", "revision", "settings", "updatedAt"],
    "App settings projection",
  );
  const revision = nonNegativeInteger(
    input.revision,
    "App settings projection.revision",
  );
  const updatedAt = absoluteInstant(
    input.updatedAt,
    "App settings projection.updatedAt",
  );
  if ((revision === 0) !== (updatedAt === null)) {
    throw new Error("App settings projection revision and updatedAt are inconsistent");
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, "App settings projection"),
    revision,
    settings: parseSettings(input.settings, profile),
    updatedAt,
  });
}

export function parseWorkEpisodeCharacterProgress(
  value: unknown,
): WorkEpisodeCharacterProgress {
  const input = record(value, "Work episode character progress");
  exact(
    input,
    [
      "defaultEpisodeCharacters",
      "totalCharacters",
      "totalEpisodeCount",
      "completedEpisodeCount",
      "completedEpisodeNumbers",
    ],
    "Work episode character progress",
  );
  if (!Array.isArray(input.completedEpisodeNumbers)) {
    throw new Error(
      "Work episode character progress.completedEpisodeNumbers must be an array",
    );
  }
  const totalEpisodeCount = nonNegativeInteger(
    input.totalEpisodeCount,
    "Work episode character progress.totalEpisodeCount",
  );
  const completedEpisodeNumbers = input.completedEpisodeNumbers.map(
    (value, index) =>
      positiveInteger(
        value,
        `Work episode character progress.completedEpisodeNumbers[${index}]`,
      ),
  );
  if (
    completedEpisodeNumbers.some(
      (episodeNumber, index) =>
        episodeNumber > totalEpisodeCount ||
        (index > 0 &&
          episodeNumber <= (completedEpisodeNumbers[index - 1] ?? 0)),
    )
  ) {
    throw new Error(
      "Work episode character progress completed episode numbers are invalid",
    );
  }
  const completedEpisodeCount = nonNegativeInteger(
    input.completedEpisodeCount,
    "Work episode character progress.completedEpisodeCount",
  );
  if (completedEpisodeCount !== completedEpisodeNumbers.length) {
    throw new Error(
      "Work episode character progress completed episode count is inconsistent",
    );
  }
  return Object.freeze({
    defaultEpisodeCharacters: positiveInteger(
      input.defaultEpisodeCharacters,
      "Work episode character progress.defaultEpisodeCharacters",
    ),
    totalCharacters: nonNegativeInteger(
      input.totalCharacters,
      "Work episode character progress.totalCharacters",
    ),
    totalEpisodeCount,
    completedEpisodeCount,
    completedEpisodeNumbers: Object.freeze(completedEpisodeNumbers),
  });
}

function countUserCharacters(text: string): number {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
  ).length;
}

export function deriveWorkEpisodeCharacterProgress(input: {
  readonly workId: EntityId<"Work">;
  readonly defaultEpisodeCharacters: number;
  readonly documents: readonly {
    readonly workId: EntityId<"Work">;
    readonly documentId: EntityId<"Document">;
    readonly text: string;
  }[];
}): WorkEpisodeCharacterProgress {
  const target = positiveInteger(
    input.defaultEpisodeCharacters,
    "defaultEpisodeCharacters",
  );
  if (input.documents.some((document) => document.workId !== input.workId)) {
    throw new Error("Work boundary violation in episode character progress");
  }
  const characterCounts = input.documents.map((document) =>
    countUserCharacters(document.text),
  );
  const completedEpisodeNumbers = characterCounts.flatMap((count, index) =>
    count >= target ? [index + 1] : [],
  );
  return parseWorkEpisodeCharacterProgress({
    defaultEpisodeCharacters: target,
    totalCharacters: characterCounts.reduce((sum, count) => sum + count, 0),
    totalEpisodeCount: input.documents.length,
    completedEpisodeCount: completedEpisodeNumbers.length,
    completedEpisodeNumbers,
  });
}
