import type { EntityId } from "../../domain/writing";
import {
  parseManuscriptEditorDocumentState,
  type ManuscriptEditorDocumentState,
  type ManuscriptFormattingProfile,
} from "./manuscript-formatting";

export type ManuscriptLayoutSettings = Readonly<{
  fontFamilyId: string;
  fontSizePx: number;
  contentWidthPx: number;
  lineHeight: number;
  paragraphSpacingPx: number;
  letterSpacingEm: number;
}>;

export type WorkManuscriptLayoutSettingsProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  revision: number;
  settings: ManuscriptLayoutSettings;
}>;

export type GetWorkManuscriptLayoutSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type SaveWorkManuscriptLayoutSettingsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  expectedRevision: number;
  settings: ManuscriptLayoutSettings;
}>;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function readIdentity(value: unknown, label: string): EntityId<"Work"> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value as EntityId<"Work">;
}

function readRevision(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function readPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return value;
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
  return value;
}

function readFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return value;
}

function parseUnregisteredLayoutSettings(
  value: unknown,
  label: string,
  legacyDefaults?: Pick<ManuscriptLayoutSettings, "fontFamilyId" | "fontSizePx">,
): ManuscriptLayoutSettings {
  const input = readRecord(value, label);
  const legacy =
    input.fontFamilyId === undefined && input.fontSizePx === undefined;
  if (legacy && legacyDefaults === undefined) {
    throw new Error(`${label} is missing fontFamilyId and fontSizePx`);
  }
  assertExactFields(
    input,
    legacy && legacyDefaults !== undefined
      ? ["contentWidthPx", "lineHeight", "paragraphSpacingPx", "letterSpacingEm"]
      : [
          "fontFamilyId",
          "fontSizePx",
          "contentWidthPx",
          "lineHeight",
          "paragraphSpacingPx",
          "letterSpacingEm",
        ],
    label,
  );
  return Object.freeze({
    fontFamilyId: legacy
      ? legacyDefaults!.fontFamilyId
      : readNonEmptyString(input.fontFamilyId, `${label}.fontFamilyId`),
    fontSizePx: legacy
      ? legacyDefaults!.fontSizePx
      : readPositiveNumber(input.fontSizePx, `${label}.fontSizePx`),
    contentWidthPx: readPositiveNumber(
      input.contentWidthPx,
      `${label}.contentWidthPx`,
    ),
    lineHeight: readPositiveNumber(input.lineHeight, `${label}.lineHeight`),
    paragraphSpacingPx: readNonNegativeNumber(
      input.paragraphSpacingPx,
      `${label}.paragraphSpacingPx`,
    ),
    letterSpacingEm: readFiniteNumber(
      input.letterSpacingEm,
      `${label}.letterSpacingEm`,
    ),
  });
}

export function readManuscriptLayoutSettings(
  state: ManuscriptEditorDocumentState,
): ManuscriptLayoutSettings {
  return Object.freeze({
    fontFamilyId: state.fontFamilyId,
    fontSizePx: state.fontSizePx,
    contentWidthPx: state.contentWidthPx,
    lineHeight: state.lineHeight,
    paragraphSpacingPx: state.paragraphSpacingPx,
    letterSpacingEm: state.letterSpacingEm,
  });
}

export function applyManuscriptLayoutSettings(
  state: ManuscriptEditorDocumentState,
  settings: ManuscriptLayoutSettings,
): ManuscriptEditorDocumentState {
  return Object.freeze({ ...state, ...settings });
}

export function parseManuscriptLayoutSettings(
  value: unknown,
  profile: ManuscriptFormattingProfile,
): ManuscriptLayoutSettings {
  const candidate = parseUnregisteredLayoutSettings(
    value,
    "ManuscriptLayoutSettings",
    {
      fontFamilyId: profile.defaults.fontFamilyId,
      fontSizePx: profile.defaults.fontSizePx,
    },
  );
  const parsed = parseManuscriptEditorDocumentState(
    {
      schemaVersion: 1,
      ranges: [],
      ...candidate,
      paragraphAlignments: [],
    },
    profile,
    0,
  );
  return readManuscriptLayoutSettings(parsed);
}

export function createDefaultWorkManuscriptLayoutSettingsProjection(
  workId: EntityId<"Work">,
  profile: ManuscriptFormattingProfile,
): WorkManuscriptLayoutSettingsProjection {
  return Object.freeze({
    schemaVersion: 1,
    workId,
    revision: 0,
    settings: Object.freeze({
      fontFamilyId: profile.defaults.fontFamilyId,
      fontSizePx: profile.defaults.fontSizePx,
      contentWidthPx: profile.defaults.contentWidthPx,
      lineHeight: profile.defaults.lineHeight,
      paragraphSpacingPx: profile.defaults.paragraphSpacingPx,
      letterSpacingEm: profile.defaults.letterSpacingEm,
    }),
  });
}

export function parseGetWorkManuscriptLayoutSettingsCommand(
  value: unknown,
): GetWorkManuscriptLayoutSettingsCommand {
  const input = readRecord(value, "GetWorkManuscriptLayoutSettingsCommand");
  assertExactFields(input, ["schemaVersion", "workId"], "GetWorkManuscriptLayoutSettingsCommand");
  if (input.schemaVersion !== 1) {
    throw new Error("GetWorkManuscriptLayoutSettingsCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity(input.workId, "GetWorkManuscriptLayoutSettingsCommand.workId"),
  });
}

export function parseSaveWorkManuscriptLayoutSettingsCommand(
  value: unknown,
): SaveWorkManuscriptLayoutSettingsCommand {
  const input = readRecord(value, "SaveWorkManuscriptLayoutSettingsCommand");
  assertExactFields(
    input,
    ["schemaVersion", "workId", "expectedRevision", "settings"],
    "SaveWorkManuscriptLayoutSettingsCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveWorkManuscriptLayoutSettingsCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity(input.workId, "SaveWorkManuscriptLayoutSettingsCommand.workId"),
    expectedRevision: readRevision(
      input.expectedRevision,
      "SaveWorkManuscriptLayoutSettingsCommand.expectedRevision",
    ),
    settings: parseUnregisteredLayoutSettings(
      input.settings,
      "SaveWorkManuscriptLayoutSettingsCommand.settings",
    ),
  });
}

export function parseWorkManuscriptLayoutSettingsProjection(
  value: unknown,
): WorkManuscriptLayoutSettingsProjection {
  const input = readRecord(value, "WorkManuscriptLayoutSettingsProjection");
  assertExactFields(
    input,
    ["schemaVersion", "workId", "revision", "settings"],
    "WorkManuscriptLayoutSettingsProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("WorkManuscriptLayoutSettingsProjection.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity(input.workId, "WorkManuscriptLayoutSettingsProjection.workId"),
    revision: readRevision(
      input.revision,
      "WorkManuscriptLayoutSettingsProjection.revision",
    ),
    settings: parseUnregisteredLayoutSettings(
      input.settings,
      "WorkManuscriptLayoutSettingsProjection.settings",
    ),
  });
}
