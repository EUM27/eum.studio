export type ManuscriptFocusPreferences = Readonly<{
  manuscriptWidthPx: number;
  textScalePercent: number;
  highlightCurrentParagraph: boolean;
  cursorFollowEnabled: boolean;
  cursorViewportPercent: number;
}>;

export type UiPreferencesProjection = Readonly<{
  schemaVersion: 2;
  revision: number;
  themeKey: string;
  manuscriptFocus: ManuscriptFocusPreferences;
}>;

export type SaveUiPreferencesCommand = Readonly<{
  schemaVersion: 2;
  expectedRevision: number;
  themeKey: string;
  manuscriptFocus: ManuscriptFocusPreferences;
}>;

export const DEFAULT_MANUSCRIPT_FOCUS_PREFERENCES: ManuscriptFocusPreferences =
  Object.freeze({
    manuscriptWidthPx: 700,
    textScalePercent: 100,
    highlightCurrentParagraph: false,
    cursorFollowEnabled: false,
    cursorViewportPercent: 40,
  });

export const DEFAULT_UI_PREFERENCES: UiPreferencesProjection = Object.freeze({
  schemaVersion: 2,
  revision: 0,
  themeKey: "light-mode",
  manuscriptFocus: DEFAULT_MANUSCRIPT_FOCUS_PREFERENCES,
});

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
    throw new Error(`${label} fields do not match the schema`);
  }
}

function nonEmptyText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function positiveFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

export function parseManuscriptFocusPreferences(
  value: unknown,
  label = "ManuscriptFocusPreferences",
): ManuscriptFocusPreferences {
  const input = record(value, label);
  exact(input, [
    "manuscriptWidthPx",
    "textScalePercent",
    "highlightCurrentParagraph",
    "cursorFollowEnabled",
    "cursorViewportPercent",
  ], label);
  return Object.freeze({
    manuscriptWidthPx: positiveFinite(
      input.manuscriptWidthPx,
      `${label}.manuscriptWidthPx`,
    ),
    textScalePercent: positiveFinite(
      input.textScalePercent,
      `${label}.textScalePercent`,
    ),
    highlightCurrentParagraph: boolean(
      input.highlightCurrentParagraph,
      `${label}.highlightCurrentParagraph`,
    ),
    cursorFollowEnabled: boolean(
      input.cursorFollowEnabled,
      `${label}.cursorFollowEnabled`,
    ),
    cursorViewportPercent: positiveFinite(
      input.cursorViewportPercent,
      `${label}.cursorViewportPercent`,
    ),
  });
}

export function parseUiPreferencesProjection(
  value: unknown,
): UiPreferencesProjection {
  const input = record(value, "UiPreferencesProjection");
  exact(
    input,
    ["schemaVersion", "revision", "themeKey", "manuscriptFocus"],
    "UiPreferencesProjection",
  );
  if (input.schemaVersion !== 2) {
    throw new Error("UiPreferencesProjection.schemaVersion must be 2");
  }
  return Object.freeze({
    schemaVersion: 2,
    revision: nonNegativeInteger(input.revision, "UiPreferencesProjection.revision"),
    themeKey: nonEmptyText(input.themeKey, "UiPreferencesProjection.themeKey"),
    manuscriptFocus: parseManuscriptFocusPreferences(
      input.manuscriptFocus,
      "UiPreferencesProjection.manuscriptFocus",
    ),
  });
}

export function parseSaveUiPreferencesCommand(
  value: unknown,
): SaveUiPreferencesCommand {
  const input = record(value, "SaveUiPreferencesCommand");
  exact(
    input,
    ["schemaVersion", "expectedRevision", "themeKey", "manuscriptFocus"],
    "SaveUiPreferencesCommand",
  );
  if (input.schemaVersion !== 2) {
    throw new Error("SaveUiPreferencesCommand.schemaVersion must be 2");
  }
  return Object.freeze({
    schemaVersion: 2,
    expectedRevision: nonNegativeInteger(
      input.expectedRevision,
      "SaveUiPreferencesCommand.expectedRevision",
    ),
    themeKey: nonEmptyText(input.themeKey, "SaveUiPreferencesCommand.themeKey"),
    manuscriptFocus: parseManuscriptFocusPreferences(
      input.manuscriptFocus,
      "SaveUiPreferencesCommand.manuscriptFocus",
    ),
  });
}
