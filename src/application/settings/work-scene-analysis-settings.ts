import { entityId, type EntityId } from "../../domain/writing";

export type WorkSceneAnalysisSettings = Readonly<{
  enabled: boolean;
}>;

export type WorkSceneAnalysisSettingsProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  revision: number;
  settings: WorkSceneAnalysisSettings;
  updatedAt: string | null;
}>;

export type GetWorkSceneAnalysisSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type SaveWorkSceneAnalysisSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  expectedRevision: number;
  settings: WorkSceneAnalysisSettings;
}>;

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
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function workId(value: unknown, label: string): EntityId<"Work"> {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return entityId<"Work">(value.trim());
}

function revision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function settings(value: unknown, label: string): WorkSceneAnalysisSettings {
  const input = record(value, label);
  exact(input, ["enabled"], label);
  if (typeof input.enabled !== "boolean") {
    throw new Error(`${label}.enabled must be a boolean`);
  }
  return Object.freeze({ enabled: input.enabled });
}

function updatedAt(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be null or an instant`);
  }
  return new Date(value).toISOString();
}

export function createDefaultWorkSceneAnalysisSettingsProjection(
  id: EntityId<"Work">,
): WorkSceneAnalysisSettingsProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId: id,
    revision: 0,
    settings: Object.freeze({ enabled: false }),
    updatedAt: null,
  });
}

export function parseGetWorkSceneAnalysisSettingsCommand(
  value: unknown,
): GetWorkSceneAnalysisSettingsCommand {
  const label = "GetWorkSceneAnalysisSettingsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: workId(input.workId, `${label}.workId`),
  });
}

export function parseSaveWorkSceneAnalysisSettingsCommand(
  value: unknown,
): SaveWorkSceneAnalysisSettingsCommand {
  const label = "SaveWorkSceneAnalysisSettingsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "expectedRevision", "settings"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: workId(input.workId, `${label}.workId`),
    expectedRevision: revision(input.expectedRevision, `${label}.expectedRevision`),
    settings: settings(input.settings, `${label}.settings`),
  });
}

export function parseWorkSceneAnalysisSettingsProjection(
  value: unknown,
): WorkSceneAnalysisSettingsProjection {
  const label = "WorkSceneAnalysisSettingsProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "revision", "settings", "updatedAt"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  const parsedRevision = revision(input.revision, `${label}.revision`);
  const parsedUpdatedAt = updatedAt(input.updatedAt, `${label}.updatedAt`);
  if ((parsedRevision === 0) !== (parsedUpdatedAt === null)) {
    throw new Error(`${label}.revision and updatedAt are inconsistent`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: workId(input.workId, `${label}.workId`),
    revision: parsedRevision,
    settings: settings(input.settings, `${label}.settings`),
    updatedAt: parsedUpdatedAt,
  });
}
