import { entityId, type EntityId } from "../../domain/writing";

export type WorkInspirationSettings = Readonly<{
  characterKeywords: readonly string[];
  eventKeywords: readonly string[];
}>;

export type GetWorkInspirationSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type SaveWorkInspirationSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  expectedRevision: number;
  settings: WorkInspirationSettings;
}>;

export type WorkInspirationSettingsProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  revision: number;
  settings: WorkInspirationSettings;
  updatedAt: string | null;
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
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function identity(value: unknown, label: string): EntityId<"Work"> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return entityId<"Work">(value);
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function keywordList(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const keywords = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be non-empty text`);
    }
    return entry.replace(/\s+/gu, " ").trim();
  });
  return Object.freeze([...new Set(keywords)]);
}

function timestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be null or an ISO timestamp`);
  }
  return value;
}

export function parseWorkInspirationSettings(
  value: unknown,
): WorkInspirationSettings {
  const label = "WorkInspirationSettings";
  const input = record(value, label);
  exact(input, ["characterKeywords", "eventKeywords"], label);
  return Object.freeze({
    characterKeywords: keywordList(
      input.characterKeywords,
      `${label}.characterKeywords`,
    ),
    eventKeywords: keywordList(input.eventKeywords, `${label}.eventKeywords`),
  });
}

export function parseGetWorkInspirationSettingsCommand(
  value: unknown,
): GetWorkInspirationSettingsCommand {
  const label = "GetWorkInspirationSettingsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return Object.freeze({
    schemaVersion: 1,
    workId: identity(input.workId, `${label}.workId`),
  });
}

export function parseSaveWorkInspirationSettingsCommand(
  value: unknown,
): SaveWorkInspirationSettingsCommand {
  const label = "SaveWorkInspirationSettingsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "expectedRevision", "settings"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return Object.freeze({
    schemaVersion: 1,
    workId: identity(input.workId, `${label}.workId`),
    expectedRevision: revision(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    settings: parseWorkInspirationSettings(input.settings),
  });
}

export function parseWorkInspirationSettingsProjection(
  value: unknown,
): WorkInspirationSettingsProjection {
  const label = "WorkInspirationSettingsProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "revision", "settings", "updatedAt"], label);
  if (input.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  const parsedRevision = revision(input.revision, `${label}.revision`);
  const updatedAt = timestamp(input.updatedAt, `${label}.updatedAt`);
  if ((parsedRevision === 0) !== (updatedAt === null)) {
    throw new Error(`${label} revision and updatedAt are inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: identity(input.workId, `${label}.workId`),
    revision: parsedRevision,
    settings: parseWorkInspirationSettings(input.settings),
    updatedAt,
  });
}

export function createDefaultWorkInspirationSettingsProjection(
  workId: EntityId<"Work">,
): WorkInspirationSettingsProjection {
  return parseWorkInspirationSettingsProjection({
    schemaVersion: 1,
    workId,
    revision: 0,
    settings: {
      characterKeywords: [],
      eventKeywords: [],
    },
    updatedAt: null,
  });
}
