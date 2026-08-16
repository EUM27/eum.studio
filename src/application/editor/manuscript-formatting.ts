import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  parseChangeBatch,
  type ChangeBatch,
} from "../persistence/change-batch";

export type ManuscriptFontFamily = {
  readonly id: string;
  readonly label: string;
  readonly cssFamily: string;
};

export type ManuscriptFormattingProfile = {
  readonly schemaVersion: 1;
  readonly fontFamilies: readonly ManuscriptFontFamily[];
  readonly fontSizesPx: readonly number[];
  readonly contentWidthRangePx: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  };
  readonly lineHeights: readonly number[];
  readonly paragraphSpacingsPx: readonly number[];
  readonly letterSpacingsEm: readonly number[];
  readonly defaults: {
    readonly fontFamilyId: string;
    readonly fontSizePx: number;
    readonly contentWidthPx: number;
    readonly lineHeight: number;
    readonly paragraphSpacingPx: number;
    readonly letterSpacingEm: number;
    readonly textColor: string;
    readonly highlightColor: string;
  };
};

export type ManuscriptParagraphAlignment =
  | "left"
  | "center"
  | "right"
  | "justify";

export type ManuscriptTextStyle = {
  readonly bold?: true;
  readonly italic?: true;
  readonly underline?: true;
  readonly fontFamilyId?: string;
  readonly fontSizePx?: number;
  readonly textColor?: string;
  readonly highlightColor?: string;
};

export type ManuscriptFormattingRange = {
  readonly from: number;
  readonly to: number;
  readonly style: ManuscriptTextStyle;
};

export type ManuscriptParagraphAlignmentEntry = {
  readonly at: number;
  readonly alignment: Exclude<ManuscriptParagraphAlignment, "left">;
};

export type ManuscriptEditorDocumentState = {
  readonly schemaVersion: 1;
  readonly ranges: readonly ManuscriptFormattingRange[];
  readonly contentWidthPx: number;
  readonly lineHeight: number;
  readonly paragraphSpacingPx: number;
  readonly letterSpacingEm: number;
  readonly paragraphAlignments: readonly ManuscriptParagraphAlignmentEntry[];
};

export type SaveManuscriptDocumentChangeCommand = {
  readonly schemaVersion: 1;
  readonly batch: ChangeBatch;
  readonly editorStateJson: string;
};

export type SaveManuscriptFormattingCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedCurrentRevisionId: EntityId<"DocumentRevision">;
  readonly editorStateJson: string;
};

export type SaveManuscriptFormattingReceipt = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revisionId: EntityId<"DocumentRevision">;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function assertExactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  assertOnlyFields(value, fields, label);
  if (Object.keys(value).length !== fields.length) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readIdentity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(readNonEmptyString(value, label));
}

function readPositiveInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function readFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function readNonNegativeNumber(value: unknown, label: string): number {
  const number = readFiniteNumber(value, label);
  if (number < 0) {
    throw new Error(`${label} must be non-negative`);
  }
  return number;
}

function readPositiveNumber(value: unknown, label: string): number {
  const number = readFiniteNumber(value, label);
  if (number <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return number;
}

function readCssColor(value: unknown, label: string): string {
  const color = readNonEmptyString(value, label).toLowerCase();
  if (!/^#[0-9a-f]{6}$/u.test(color)) {
    throw new Error(`${label} must be a six-digit hex color`);
  }
  return color;
}

function readOffset(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function readUniquePositiveIntegers(
  value: unknown,
  label: string,
): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const values = value.map((candidate, index) =>
    readPositiveInteger(candidate, `${label}[${index}]`),
  );
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return Object.freeze(values);
}

function readUniqueNumbers(
  value: unknown,
  label: string,
  read: (candidate: unknown, candidateLabel: string) => number,
): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const values = value.map((candidate, index) =>
    read(candidate, `${label}[${index}]`),
  );
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return Object.freeze(values);
}

function readRegisteredNumber(
  value: unknown,
  registered: readonly number[],
  label: string,
): number {
  const number = readFiniteNumber(value, label);
  if (!registered.includes(number)) {
    throw new Error(`${label} is not registered`);
  }
  return number;
}

function readContentWidthRange(
  value: unknown,
): ManuscriptFormattingProfile["contentWidthRangePx"] {
  const range = readRecord(value, "ManuscriptFormattingProfile.contentWidthRangePx");
  assertExactFields(
    range,
    ["min", "max", "step"],
    "ManuscriptFormattingProfile.contentWidthRangePx",
  );
  const min = readPositiveInteger(
    range.min,
    "ManuscriptFormattingProfile.contentWidthRangePx.min",
  );
  const max = readPositiveInteger(
    range.max,
    "ManuscriptFormattingProfile.contentWidthRangePx.max",
  );
  const step = readPositiveInteger(
    range.step,
    "ManuscriptFormattingProfile.contentWidthRangePx.step",
  );
  if (min >= max || (max - min) % step !== 0) {
    throw new Error(
      "ManuscriptFormattingProfile.contentWidthRangePx must have an ordered stepped range",
    );
  }
  return Object.freeze({ min, max, step });
}

function isRegisteredContentWidth(
  width: number,
  range: ManuscriptFormattingProfile["contentWidthRangePx"],
): boolean {
  return (
    width >= range.min &&
    width <= range.max &&
    (width - range.min) % range.step === 0
  );
}

export function parseManuscriptFormattingProfile(
  value: unknown,
): ManuscriptFormattingProfile {
  const input = readRecord(value, "ManuscriptFormattingProfile");
  assertExactFields(
    input,
    [
      "schemaVersion",
      "fontFamilies",
      "fontSizesPx",
      "contentWidthRangePx",
      "lineHeights",
      "paragraphSpacingsPx",
      "letterSpacingsEm",
      "defaults",
    ],
    "ManuscriptFormattingProfile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("ManuscriptFormattingProfile.schemaVersion must be 1");
  }
  if (!Array.isArray(input.fontFamilies) || input.fontFamilies.length === 0) {
    throw new Error(
      "ManuscriptFormattingProfile.fontFamilies must be a non-empty array",
    );
  }
  const fontIds = new Set<string>();
  const fontFamilies = input.fontFamilies.map((candidate, index) => {
    const label = `ManuscriptFormattingProfile.fontFamilies[${index}]`;
    const font = readRecord(candidate, label);
    assertExactFields(font, ["id", "label", "cssFamily"], label);
    const id = readNonEmptyString(font.id, `${label}.id`);
    if (fontIds.has(id)) {
      throw new Error(`Duplicate manuscript font identity: ${id}`);
    }
    fontIds.add(id);
    return Object.freeze({
      id,
      label: readNonEmptyString(font.label, `${label}.label`),
      cssFamily: readNonEmptyString(font.cssFamily, `${label}.cssFamily`),
    });
  });
  const fontSizesPx = readUniquePositiveIntegers(
    input.fontSizesPx,
    "ManuscriptFormattingProfile.fontSizesPx",
  );
  const contentWidthRangePx = readContentWidthRange(
    input.contentWidthRangePx,
  );
  const lineHeights = readUniqueNumbers(
    input.lineHeights,
    "ManuscriptFormattingProfile.lineHeights",
    readPositiveNumber,
  );
  const paragraphSpacingsPx = readUniqueNumbers(
    input.paragraphSpacingsPx,
    "ManuscriptFormattingProfile.paragraphSpacingsPx",
    readNonNegativeNumber,
  );
  const letterSpacingsEm = readUniqueNumbers(
    input.letterSpacingsEm,
    "ManuscriptFormattingProfile.letterSpacingsEm",
    readFiniteNumber,
  );
  const defaults = readRecord(
    input.defaults,
    "ManuscriptFormattingProfile.defaults",
  );
  assertExactFields(
    defaults,
    [
      "fontFamilyId",
      "fontSizePx",
      "contentWidthPx",
      "lineHeight",
      "paragraphSpacingPx",
      "letterSpacingEm",
      "textColor",
      "highlightColor",
    ],
    "ManuscriptFormattingProfile.defaults",
  );
  const fontFamilyId = readNonEmptyString(
    defaults.fontFamilyId,
    "ManuscriptFormattingProfile.defaults.fontFamilyId",
  );
  const fontSizePx = readPositiveInteger(
    defaults.fontSizePx,
    "ManuscriptFormattingProfile.defaults.fontSizePx",
  );
  const contentWidthPx = readPositiveInteger(
    defaults.contentWidthPx,
    "ManuscriptFormattingProfile.defaults.contentWidthPx",
  );
  const lineHeight = readRegisteredNumber(
    defaults.lineHeight,
    lineHeights,
    "ManuscriptFormattingProfile.defaults.lineHeight",
  );
  const paragraphSpacingPx = readRegisteredNumber(
    defaults.paragraphSpacingPx,
    paragraphSpacingsPx,
    "ManuscriptFormattingProfile.defaults.paragraphSpacingPx",
  );
  const letterSpacingEm = readRegisteredNumber(
    defaults.letterSpacingEm,
    letterSpacingsEm,
    "ManuscriptFormattingProfile.defaults.letterSpacingEm",
  );
  const textColor = readCssColor(
    defaults.textColor,
    "ManuscriptFormattingProfile.defaults.textColor",
  );
  const highlightColor = readCssColor(
    defaults.highlightColor,
    "ManuscriptFormattingProfile.defaults.highlightColor",
  );
  if (!fontIds.has(fontFamilyId)) {
    throw new Error("The default manuscript font is not registered");
  }
  if (!fontSizesPx.includes(fontSizePx)) {
    throw new Error("The default manuscript font size is not registered");
  }
  if (!isRegisteredContentWidth(contentWidthPx, contentWidthRangePx)) {
    throw new Error("The default manuscript content width is not registered");
  }
  return Object.freeze({
    schemaVersion: 1,
    fontFamilies: Object.freeze(fontFamilies),
    fontSizesPx,
    contentWidthRangePx,
    lineHeights,
    paragraphSpacingsPx,
    letterSpacingsEm,
    defaults: Object.freeze({
      fontFamilyId,
      fontSizePx,
      contentWidthPx,
      lineHeight,
      paragraphSpacingPx,
      letterSpacingEm,
      textColor,
      highlightColor,
    }),
  });
}

function readStyle(
  value: unknown,
  profile: ManuscriptFormattingProfile,
  label: string,
): ManuscriptTextStyle {
  const input = readRecord(value, label);
  assertOnlyFields(
    input,
    [
      "bold",
      "italic",
      "underline",
      "fontFamilyId",
      "fontSizePx",
      "textColor",
      "highlightColor",
    ],
    label,
  );
  for (const flag of ["bold", "italic", "underline"] as const) {
    if (input[flag] !== undefined && input[flag] !== true) {
      throw new Error(`${label}.${flag} must be true when present`);
    }
  }
  const fontFamilyId =
    input.fontFamilyId === undefined
      ? undefined
      : readNonEmptyString(input.fontFamilyId, `${label}.fontFamilyId`);
  if (
    fontFamilyId !== undefined &&
    !profile.fontFamilies.some((font) => font.id === fontFamilyId)
  ) {
    throw new Error(`${label}.fontFamilyId is not registered`);
  }
  const fontSizePx =
    input.fontSizePx === undefined
      ? undefined
      : readPositiveInteger(input.fontSizePx, `${label}.fontSizePx`);
  if (fontSizePx !== undefined && !profile.fontSizesPx.includes(fontSizePx)) {
    throw new Error(`${label}.fontSizePx is not registered`);
  }
  const textColor =
    input.textColor === undefined
      ? undefined
      : readCssColor(input.textColor, `${label}.textColor`);
  const highlightColor =
    input.highlightColor === undefined
      ? undefined
      : readCssColor(input.highlightColor, `${label}.highlightColor`);
  if (Object.keys(input).length === 0) {
    throw new Error(`${label} must contain at least one style`);
  }
  return Object.freeze({
    ...(input.bold === true ? { bold: true as const } : {}),
    ...(input.italic === true ? { italic: true as const } : {}),
    ...(input.underline === true ? { underline: true as const } : {}),
    ...(fontFamilyId === undefined ? {} : { fontFamilyId }),
    ...(fontSizePx === undefined ? {} : { fontSizePx }),
    ...(textColor === undefined ? {} : { textColor }),
    ...(highlightColor === undefined ? {} : { highlightColor }),
  });
}

export function createDefaultManuscriptEditorDocumentState(
  profile: ManuscriptFormattingProfile,
): ManuscriptEditorDocumentState {
  return Object.freeze({
    schemaVersion: 1,
    ranges: Object.freeze([]),
    contentWidthPx: profile.defaults.contentWidthPx,
    lineHeight: profile.defaults.lineHeight,
    paragraphSpacingPx: profile.defaults.paragraphSpacingPx,
    letterSpacingEm: profile.defaults.letterSpacingEm,
    paragraphAlignments: Object.freeze([]),
  });
}

export function parseManuscriptEditorDocumentState(
  value: unknown,
  profile: ManuscriptFormattingProfile,
  textLength: number,
): ManuscriptEditorDocumentState {
  const input = readRecord(value, "ManuscriptEditorDocumentState");
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "ranges",
      "contentWidthPx",
      "lineHeight",
      "paragraphSpacingPx",
      "letterSpacingEm",
      "paragraphAlignments",
    ],
    "ManuscriptEditorDocumentState",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("ManuscriptEditorDocumentState.schemaVersion must be 1");
  }
  const contentWidthPx = readPositiveInteger(
    input.contentWidthPx,
    "ManuscriptEditorDocumentState.contentWidthPx",
  );
  if (!isRegisteredContentWidth(contentWidthPx, profile.contentWidthRangePx)) {
    throw new Error(
      "ManuscriptEditorDocumentState.contentWidthPx is not registered",
    );
  }
  if (!Number.isSafeInteger(textLength) || textLength < 0) {
    throw new Error("Manuscript text length must be a non-negative safe integer");
  }
  if (!Array.isArray(input.ranges)) {
    throw new Error("ManuscriptEditorDocumentState.ranges must be an array");
  }
  let previousTo = 0;
  const ranges = input.ranges.map((candidate, index) => {
    const label = `ManuscriptEditorDocumentState.ranges[${index}]`;
    const range = readRecord(candidate, label);
    assertExactFields(range, ["from", "to", "style"], label);
    const from = readOffset(range.from, `${label}.from`);
    const to = readOffset(range.to, `${label}.to`);
    if (from >= to) {
      throw new Error(`${label} must contain a non-empty forward range`);
    }
    if (to > textLength) {
      throw new Error(`${label} exceeds the manuscript text`);
    }
    if (index > 0 && from < previousTo) {
      throw new Error(`${label} overlaps a prior formatting range`);
    }
    previousTo = to;
    return Object.freeze({
      from,
      to,
      style: readStyle(range.style, profile, `${label}.style`),
    });
  });
  const lineHeight =
    input.lineHeight === undefined
      ? profile.defaults.lineHeight
      : readRegisteredNumber(
          input.lineHeight,
          profile.lineHeights,
          "ManuscriptEditorDocumentState.lineHeight",
        );
  const paragraphSpacingPx =
    input.paragraphSpacingPx === undefined
      ? profile.defaults.paragraphSpacingPx
      : readRegisteredNumber(
          input.paragraphSpacingPx,
          profile.paragraphSpacingsPx,
          "ManuscriptEditorDocumentState.paragraphSpacingPx",
        );
  const letterSpacingEm =
    input.letterSpacingEm === undefined
      ? profile.defaults.letterSpacingEm
      : readRegisteredNumber(
          input.letterSpacingEm,
          profile.letterSpacingsEm,
          "ManuscriptEditorDocumentState.letterSpacingEm",
        );
  const paragraphInput = input.paragraphAlignments ?? [];
  if (!Array.isArray(paragraphInput)) {
    throw new Error(
      "ManuscriptEditorDocumentState.paragraphAlignments must be an array",
    );
  }
  let previousAt = -1;
  const paragraphAlignments = paragraphInput.map((candidate, index) => {
    const label = `ManuscriptEditorDocumentState.paragraphAlignments[${index}]`;
    const entry = readRecord(candidate, label);
    assertExactFields(entry, ["at", "alignment"], label);
    const at = readOffset(entry.at, `${label}.at`);
    if (at > textLength) {
      throw new Error(`${label}.at exceeds the manuscript text`);
    }
    if (at <= previousAt) {
      throw new Error(`${label}.at must be unique and ascending`);
    }
    previousAt = at;
    if (
      entry.alignment !== "center" &&
      entry.alignment !== "right" &&
      entry.alignment !== "justify"
    ) {
      throw new Error(`${label}.alignment is not supported`);
    }
    return Object.freeze({ at, alignment: entry.alignment });
  });
  return Object.freeze({
    schemaVersion: 1,
    ranges: Object.freeze(ranges),
    contentWidthPx,
    lineHeight,
    paragraphSpacingPx,
    letterSpacingEm,
    paragraphAlignments: Object.freeze(paragraphAlignments),
  });
}

export function parseSaveManuscriptDocumentChangeCommand(
  value: unknown,
): SaveManuscriptDocumentChangeCommand {
  const input = readRecord(value, "SaveManuscriptDocumentChangeCommand");
  assertExactFields(
    input,
    ["schemaVersion", "batch", "editorStateJson"],
    "SaveManuscriptDocumentChangeCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveManuscriptDocumentChangeCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    batch: parseChangeBatch(input.batch),
    editorStateJson: readNonEmptyString(
      input.editorStateJson,
      "SaveManuscriptDocumentChangeCommand.editorStateJson",
    ),
  });
}

export function parseSaveManuscriptFormattingCommand(
  value: unknown,
): SaveManuscriptFormattingCommand {
  const input = readRecord(value, "SaveManuscriptFormattingCommand");
  assertExactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "expectedCurrentRevisionId",
      "editorStateJson",
    ],
    "SaveManuscriptFormattingCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveManuscriptFormattingCommand.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "SaveManuscriptFormattingCommand.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "SaveManuscriptFormattingCommand.documentId",
    ),
    expectedCurrentRevisionId: readIdentity<"DocumentRevision">(
      input.expectedCurrentRevisionId,
      "SaveManuscriptFormattingCommand.expectedCurrentRevisionId",
    ),
    editorStateJson: readNonEmptyString(
      input.editorStateJson,
      "SaveManuscriptFormattingCommand.editorStateJson",
    ),
  });
}

export function parseSaveManuscriptFormattingReceipt(
  value: unknown,
): SaveManuscriptFormattingReceipt {
  const input = readRecord(value, "SaveManuscriptFormattingReceipt");
  assertExactFields(
    input,
    ["schemaVersion", "workId", "documentId", "revisionId"],
    "SaveManuscriptFormattingReceipt",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("SaveManuscriptFormattingReceipt.schemaVersion must be 1");
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readIdentity<"Work">(
      input.workId,
      "SaveManuscriptFormattingReceipt.workId",
    ),
    documentId: readIdentity<"Document">(
      input.documentId,
      "SaveManuscriptFormattingReceipt.documentId",
    ),
    revisionId: readIdentity<"DocumentRevision">(
      input.revisionId,
      "SaveManuscriptFormattingReceipt.revisionId",
    ),
  });
}

export function serializeManuscriptEditorDocumentState(
  value: ManuscriptEditorDocumentState,
): string {
  return JSON.stringify(value);
}
