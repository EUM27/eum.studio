export type FocusModePreferences = Readonly<{
  contentWidthPx: number;
  zoomPercent: number;
  currentBlockHighlight: boolean;
  typewriterMode: boolean;
  typewriterPositionPercent: number;
}>;

export type UiPreferencesProjection = Readonly<{
  schemaVersion: 1;
  revision: number;
  themeKey: string;
  focusMode: FocusModePreferences;
}>;

export type SaveUiPreferencesCommand = Readonly<{
  schemaVersion: 1;
  expectedRevision: number;
  themeKey: string;
  focusMode: FocusModePreferences;
}>;

export const DEFAULT_FOCUS_MODE_PREFERENCES: FocusModePreferences =
  Object.freeze({
    contentWidthPx: 700,
    zoomPercent: 100,
    currentBlockHighlight: false,
    typewriterMode: false,
    typewriterPositionPercent: 40,
  });

export const DEFAULT_UI_PREFERENCES: UiPreferencesProjection = Object.freeze({
  schemaVersion: 1,
  revision: 0,
  themeKey: "light-mode",
  focusMode: DEFAULT_FOCUS_MODE_PREFERENCES,
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

export function parseFocusModePreferences(
  value: unknown,
  label = "FocusModePreferences",
): FocusModePreferences {
  const input = record(value, label);
  exact(input, [
    "contentWidthPx",
    "zoomPercent",
    "currentBlockHighlight",
    "typewriterMode",
    "typewriterPositionPercent",
  ], label);
  return Object.freeze({
    contentWidthPx: positiveFinite(input.contentWidthPx, `${label}.contentWidthPx`),
    zoomPercent: positiveFinite(input.zoomPercent, `${label}.zoomPercent`),
    currentBlockHighlight: boolean(
      input.currentBlockHighlight,
      `${label}.currentBlockHighlight`,
    ),
    typewriterMode: boolean(input.typewriterMode, `${label}.typewriterMode`),
    typewriterPositionPercent: positiveFinite(
      input.typewriterPositionPercent,
      `${label}.typewriterPositionPercent`,
    ),
  });
}

export function parseUiPreferencesProjection(
  value: unknown,
): UiPreferencesProjection {
  const input = record(value, "UiPreferencesProjection");
  exact(
    input,
    ["schemaVersion", "revision", "themeKey", "focusMode"],
    "UiPreferencesProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("UiPreferencesProjection.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: nonNegativeInteger(input.revision, "UiPreferencesProjection.revision"),
    themeKey: nonEmptyText(input.themeKey, "UiPreferencesProjection.themeKey"),
    focusMode: parseFocusModePreferences(
      input.focusMode,
      "UiPreferencesProjection.focusMode",
    ),
  });
}

export function parseSaveUiPreferencesCommand(
  value: unknown,
): SaveUiPreferencesCommand {
  const input = record(value, "SaveUiPreferencesCommand");
  exact(
    input,
    ["schemaVersion", "expectedRevision", "themeKey", "focusMode"],
    "SaveUiPreferencesCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveUiPreferencesCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    expectedRevision: nonNegativeInteger(
      input.expectedRevision,
      "SaveUiPreferencesCommand.expectedRevision",
    ),
    themeKey: nonEmptyText(input.themeKey, "SaveUiPreferencesCommand.themeKey"),
    focusMode: parseFocusModePreferences(
      input.focusMode,
      "SaveUiPreferencesCommand.focusMode",
    ),
  });
}
