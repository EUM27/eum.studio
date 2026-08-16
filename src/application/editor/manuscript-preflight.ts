import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type ManuscriptPreflightLineEnding = "preserve" | "lf" | "crlf";
export type ManuscriptPreflightTabReplacement = "preserve" | "spaces";
export type ManuscriptPreflightSpaceReplacement = "preserve" | "space";

export type ManuscriptPreflightSettings = {
  readonly trimTrailingWhitespace: boolean;
  readonly tabReplacement: ManuscriptPreflightTabReplacement;
  readonly tabWidth: number;
  readonly nonBreakingSpaceReplacement: ManuscriptPreflightSpaceReplacement;
  readonly lineEnding: ManuscriptPreflightLineEnding;
  readonly limitBlankLines: boolean;
  readonly maxConsecutiveBlankLines: number;
  readonly forbiddenTerms: readonly string[];
  readonly forbiddenCaseSensitive: boolean;
  readonly regexPattern: string;
  readonly regexCaseSensitive: boolean;
  readonly regexMultiline: boolean;
};

type IntegerRange = {
  readonly min: number;
  readonly max: number;
};

export type ManuscriptPreflightProfile = {
  readonly schemaVersion: 1;
  readonly defaults: ManuscriptPreflightSettings;
  readonly limits: {
    readonly tabWidth: IntegerRange;
    readonly maxConsecutiveBlankLines: IntegerRange;
  };
};

export type GetManuscriptPreflightSettingsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveManuscriptPreflightSettingsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly settings: ManuscriptPreflightSettings;
};

export type ManuscriptPreflightSettingsProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly settings: ManuscriptPreflightSettings;
};

export type ExportManuscriptTextCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly suggestedFileName: string;
  readonly text: string;
};

export type ExportManuscriptTextResult =
  | Readonly<{
      schemaVersion: 1;
      status: "completed";
      byteLength: number;
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "cancelled";
    }>;

export const MANUSCRIPT_PREFLIGHT_FINDING_KINDS = [
  "trailing-whitespace",
  "tab",
  "non-breaking-space",
  "mixed-line-ending",
  "excess-blank-line",
  "forbidden-term",
  "regex-match",
] as const;

export type ManuscriptPreflightFindingKind =
  (typeof MANUSCRIPT_PREFLIGHT_FINDING_KINDS)[number];

export type ManuscriptPreflightMatch = {
  readonly from: number;
  readonly to: number;
  readonly line: number;
  readonly column: number;
  readonly label?: string;
};

export type ManuscriptPreflightFinding = {
  readonly kind: ManuscriptPreflightFindingKind;
  readonly count: number;
  readonly matches: readonly ManuscriptPreflightMatch[];
};

export type ManuscriptPreflightReport = {
  readonly source: string;
  readonly statistics: {
    readonly characters: number;
    readonly utf8Bytes: number;
    readonly lines: number;
  };
  readonly findings: readonly ManuscriptPreflightFinding[];
  readonly regexError: string | null;
};

export type ManuscriptPreflightPreview = {
  readonly source: string;
  readonly result: string;
  readonly changed: boolean;
  readonly changedLineCount: number;
  readonly characterDelta: number;
};

export type ManuscriptPreflightPreviewOptions = Readonly<{
  readonly ensureBlankLineBetweenParagraphs?: boolean;
}>;

export type ManuscriptPreflightRange = {
  readonly from: number;
  readonly to: number;
};

export type ManuscriptPreflightBoundaryContext = {
  readonly startsAtLineStart: boolean;
  readonly endsAtLineEnd: boolean;
};

export function createManuscriptPreflightBoundaryContext(
  manuscript: string,
  range: ManuscriptPreflightRange,
): ManuscriptPreflightBoundaryContext {
  if (
    !Number.isSafeInteger(range.from) ||
    !Number.isSafeInteger(range.to) ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > manuscript.length
  ) {
    throw new Error("Manuscript preflight range is invalid");
  }
  const previousAtStart = manuscript[range.from - 1];
  const currentAtStart = manuscript[range.from];
  const previousAtEnd = manuscript[range.to - 1];
  const currentAtEnd = manuscript[range.to];
  return Object.freeze({
    startsAtLineStart:
      range.from === 0 ||
      previousAtStart === "\n" ||
      (previousAtStart === "\r" && currentAtStart !== "\n"),
    endsAtLineEnd:
      range.to === manuscript.length ||
      currentAtEnd === "\r" ||
      (currentAtEnd === "\n" && previousAtEnd !== "\r"),
  });
}

type LogicalLine = {
  readonly content: string;
  readonly ending: string;
  readonly start: number;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const keys = Object.keys(value);
  const allowed = new Set(fields);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function readSchemaVersion(value: unknown, label: string): 1 {
  if (value !== 1) {
    throw new Error(`${label} schemaVersion must be 1`);
  }
  return 1;
}

function readIdentity<TEntity extends string>(
  value: unknown,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return value;
}

function readIntegerRange(value: unknown, label: string): IntegerRange {
  const record = readRecord(value, label);
  assertExactFields(record, ["min", "max"], label);
  const min = readInteger(record.min, `${label}.min`);
  const max = readInteger(record.max, `${label}.max`);
  if (min > max) {
    throw new Error(`${label} minimum must not exceed its maximum`);
  }
  return Object.freeze({ min, max });
}

function readStringList(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const terms = value.map((item, index) =>
    readString(item, `${label}[${index}]`).trim(),
  );
  const uniqueTerms = [...new Set(terms.filter((term) => term.length > 0))];
  return Object.freeze(uniqueTerms);
}

function readEnum<TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  label: string,
): TValue {
  if (typeof value !== "string" || !allowed.includes(value as TValue)) {
    throw new Error(`${label} is not supported`);
  }
  return value as TValue;
}

function freezeSettings(
  settings: ManuscriptPreflightSettings,
): ManuscriptPreflightSettings {
  return Object.freeze({
    ...settings,
    forbiddenTerms: Object.freeze([...settings.forbiddenTerms]),
  });
}

export function parseManuscriptPreflightSettings(
  value: unknown,
  profile?: ManuscriptPreflightProfile,
): ManuscriptPreflightSettings {
  const record = readRecord(value, "Manuscript preflight settings");
  assertExactFields(
    record,
    [
      "trimTrailingWhitespace",
      "tabReplacement",
      "tabWidth",
      "nonBreakingSpaceReplacement",
      "lineEnding",
      "limitBlankLines",
      "maxConsecutiveBlankLines",
      "forbiddenTerms",
      "forbiddenCaseSensitive",
      "regexPattern",
      "regexCaseSensitive",
      "regexMultiline",
    ],
    "Manuscript preflight settings",
  );
  const tabWidth = readInteger(record.tabWidth, "tabWidth");
  const maxConsecutiveBlankLines = readInteger(
    record.maxConsecutiveBlankLines,
    "maxConsecutiveBlankLines",
  );
  if (
    profile !== undefined &&
    (tabWidth < profile.limits.tabWidth.min ||
      tabWidth > profile.limits.tabWidth.max)
  ) {
    throw new Error("tabWidth is outside the configured range");
  }
  if (
    profile !== undefined &&
    (maxConsecutiveBlankLines <
      profile.limits.maxConsecutiveBlankLines.min ||
      maxConsecutiveBlankLines >
        profile.limits.maxConsecutiveBlankLines.max)
  ) {
    throw new Error(
      "maxConsecutiveBlankLines is outside the configured range",
    );
  }
  return freezeSettings({
    trimTrailingWhitespace: readBoolean(
      record.trimTrailingWhitespace,
      "trimTrailingWhitespace",
    ),
    tabReplacement: readEnum(
      record.tabReplacement,
      ["preserve", "spaces"],
      "tabReplacement",
    ),
    tabWidth,
    nonBreakingSpaceReplacement: readEnum(
      record.nonBreakingSpaceReplacement,
      ["preserve", "space"],
      "nonBreakingSpaceReplacement",
    ),
    lineEnding: readEnum(
      record.lineEnding,
      ["preserve", "lf", "crlf"],
      "lineEnding",
    ),
    limitBlankLines: readBoolean(
      record.limitBlankLines,
      "limitBlankLines",
    ),
    maxConsecutiveBlankLines,
    forbiddenTerms: readStringList(record.forbiddenTerms, "forbiddenTerms"),
    forbiddenCaseSensitive: readBoolean(
      record.forbiddenCaseSensitive,
      "forbiddenCaseSensitive",
    ),
    regexPattern: readString(record.regexPattern, "regexPattern"),
    regexCaseSensitive: readBoolean(
      record.regexCaseSensitive,
      "regexCaseSensitive",
    ),
    regexMultiline: readBoolean(record.regexMultiline, "regexMultiline"),
  });
}

export function parseManuscriptPreflightProfile(
  value: unknown,
): ManuscriptPreflightProfile {
  const record = readRecord(value, "Manuscript preflight profile");
  assertExactFields(record, ["schemaVersion", "defaults", "limits"], "Manuscript preflight profile");
  readSchemaVersion(record.schemaVersion, "Manuscript preflight profile");
  const limitsRecord = readRecord(record.limits, "Manuscript preflight limits");
  assertExactFields(
    limitsRecord,
    ["tabWidth", "maxConsecutiveBlankLines"],
    "Manuscript preflight limits",
  );
  const limits = Object.freeze({
    tabWidth: readIntegerRange(limitsRecord.tabWidth, "tabWidth limits"),
    maxConsecutiveBlankLines: readIntegerRange(
      limitsRecord.maxConsecutiveBlankLines,
      "blank-line limits",
    ),
  });
  const preliminary = Object.freeze({
    schemaVersion: 1 as const,
    defaults: parseManuscriptPreflightSettings(record.defaults),
    limits,
  });
  return Object.freeze({
    ...preliminary,
    defaults: parseManuscriptPreflightSettings(
      preliminary.defaults,
      preliminary,
    ),
  });
}

export function createDefaultManuscriptPreflightSettings(
  profile: ManuscriptPreflightProfile,
): ManuscriptPreflightSettings {
  return freezeSettings(profile.defaults);
}

export function parseGetManuscriptPreflightSettingsCommand(
  value: unknown,
): GetManuscriptPreflightSettingsCommand {
  const record = readRecord(value, "Get preflight settings command");
  assertExactFields(record, ["schemaVersion", "workId"], "Get preflight settings command");
  return Object.freeze({
    schemaVersion: readSchemaVersion(record.schemaVersion, "Get preflight settings command"),
    workId: readIdentity<"Work">(record.workId, "workId"),
  });
}

export function parseSaveManuscriptPreflightSettingsCommand(
  value: unknown,
  profile?: ManuscriptPreflightProfile,
): SaveManuscriptPreflightSettingsCommand {
  const record = readRecord(value, "Save preflight settings command");
  assertExactFields(record, ["schemaVersion", "workId", "settings"], "Save preflight settings command");
  return Object.freeze({
    schemaVersion: readSchemaVersion(record.schemaVersion, "Save preflight settings command"),
    workId: readIdentity<"Work">(record.workId, "workId"),
    settings: parseManuscriptPreflightSettings(record.settings, profile),
  });
}

export function parseManuscriptPreflightSettingsProjection(
  value: unknown,
  profile?: ManuscriptPreflightProfile,
): ManuscriptPreflightSettingsProjection {
  const record = readRecord(value, "Preflight settings projection");
  assertExactFields(record, ["schemaVersion", "workId", "revision", "settings"], "Preflight settings projection");
  const revision = readInteger(record.revision, "revision");
  if (revision < 0) {
    throw new Error("revision must be non-negative");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(record.schemaVersion, "Preflight settings projection"),
    workId: readIdentity<"Work">(record.workId, "workId"),
    revision,
    settings: parseManuscriptPreflightSettings(record.settings, profile),
  });
}

export function sanitizeManuscriptTextFileNamePart(value: string): string {
  const invalid = new Set('<>:"/\\|?*');
  return [...value.trim()]
    .map((character) =>
      character.charCodeAt(0) < 32 || invalid.has(character)
        ? "-"
        : character,
    )
    .join("");
}

export function parseExportManuscriptTextCommand(
  value: unknown,
): ExportManuscriptTextCommand {
  const record = readRecord(value, "Export manuscript text command");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "documentId", "suggestedFileName", "text"],
    "Export manuscript text command",
  );
  const suggestedFileName = readString(
    record.suggestedFileName,
    "suggestedFileName",
  );
  if (
    suggestedFileName.length === 0 ||
    sanitizeManuscriptTextFileNamePart(suggestedFileName) !== suggestedFileName
  ) {
    throw new Error("suggestedFileName must be a safe file name");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(record.schemaVersion, "Export manuscript text command"),
    workId: readIdentity<"Work">(record.workId, "workId"),
    documentId: readIdentity<"Document">(record.documentId, "documentId"),
    suggestedFileName,
    text: readString(record.text, "text"),
  });
}

export function parseExportManuscriptTextResult(
  value: unknown,
): ExportManuscriptTextResult {
  const record = readRecord(value, "Export manuscript text result");
  if (record.status === "cancelled") {
    assertExactFields(record, ["schemaVersion", "status"], "Export manuscript text result");
    return Object.freeze({
      schemaVersion: readSchemaVersion(record.schemaVersion, "Export manuscript text result"),
      status: "cancelled" as const,
    });
  }
  assertExactFields(record, ["schemaVersion", "status", "byteLength"], "Export manuscript text result");
  if (record.status !== "completed") {
    throw new Error("Export manuscript text status is not supported");
  }
  const byteLength = readInteger(record.byteLength, "byteLength");
  if (byteLength < 0) {
    throw new Error("byteLength must be non-negative");
  }
  return Object.freeze({
    schemaVersion: readSchemaVersion(record.schemaVersion, "Export manuscript text result"),
    status: "completed" as const,
    byteLength,
  });
}

function splitLogicalLines(source: string): readonly LogicalLine[] {
  const lines: LogicalLine[] = [];
  const endings = /\r\n|\n|\r/gu;
  let start = 0;
  let match = endings.exec(source);
  while (match !== null) {
    lines.push({
      content: source.slice(start, match.index),
      ending: match[0],
      start,
    });
    start = match.index + match[0].length;
    match = endings.exec(source);
  }
  lines.push({ content: source.slice(start), ending: "", start });
  return Object.freeze(lines);
}

function locate(
  source: string,
  from: number,
  to: number,
  label?: string,
): ManuscriptPreflightMatch {
  const prefix = source.slice(0, from);
  const lineBreaks = prefix.match(/\r\n|\n|\r/gu) ?? [];
  const lastBreak = Math.max(
    prefix.lastIndexOf("\n"),
    prefix.lastIndexOf("\r"),
  );
  return Object.freeze({
    from,
    to,
    line: lineBreaks.length + 1,
    column: from - lastBreak,
    ...(label === undefined ? {} : { label }),
  });
}

function findMatches(
  source: string,
  expression: RegExp,
  label?: string,
): readonly ManuscriptPreflightMatch[] {
  const matches: ManuscriptPreflightMatch[] = [];
  let match = expression.exec(source);
  while (match !== null) {
    matches.push(
      locate(source, match.index, match.index + match[0].length, label),
    );
    if (match[0].length === 0) {
      expression.lastIndex += 1;
    }
    match = expression.exec(source);
  }
  return Object.freeze(matches);
}

function findLiteralMatches(
  source: string,
  term: string,
  caseSensitive: boolean,
): readonly ManuscriptPreflightMatch[] {
  const haystack = caseSensitive ? source : source.toLocaleLowerCase();
  const needle = caseSensitive ? term : term.toLocaleLowerCase();
  const matches: ManuscriptPreflightMatch[] = [];
  let cursor = 0;
  while (cursor <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) {
      break;
    }
    matches.push(locate(source, index, index + term.length, term));
    cursor = index + needle.length;
  }
  return Object.freeze(matches);
}

function findMixedLineEndings(
  source: string,
): readonly ManuscriptPreflightMatch[] {
  const endings = findMatches(source, /\r\n|\n|\r/gu);
  const counts = new Map<string, number>();
  for (const ending of endings) {
    const value = source.slice(ending.from, ending.to);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size <= 1) {
    return Object.freeze([]);
  }
  const dominant = [...counts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0];
  return Object.freeze(
    endings.filter(
      (ending) => source.slice(ending.from, ending.to) !== dominant,
    ),
  );
}

function isCompleteLine(
  index: number,
  lineCount: number,
  boundary?: ManuscriptPreflightBoundaryContext,
): boolean {
  if (index === 0 && boundary?.startsAtLineStart === false) {
    return false;
  }
  return !(
    index === lineCount - 1 && boundary?.endsAtLineEnd === false
  );
}

function findTrailingWhitespace(
  source: string,
  boundary?: ManuscriptPreflightBoundaryContext,
): readonly ManuscriptPreflightMatch[] {
  const matches = findMatches(source, /[ \t]+(?=\r?$)/gmu);
  if (boundary?.endsAtLineEnd !== false) {
    return matches;
  }
  return Object.freeze(matches.filter((match) => match.to < source.length));
}

function findExcessBlankLines(
  source: string,
  maximum: number,
  boundary?: ManuscriptPreflightBoundaryContext,
): readonly ManuscriptPreflightMatch[] {
  const lines = splitLogicalLines(source);
  const matches: ManuscriptPreflightMatch[] = [];
  let runLength = 0;
  for (const [index, line] of lines.entries()) {
    if (line.start === source.length && line.content.length === 0) {
      continue;
    }
    if (!isCompleteLine(index, lines.length, boundary)) {
      runLength = 0;
      continue;
    }
    if (line.content.trim().length === 0) {
      runLength += 1;
      if (runLength > maximum) {
        matches.push(
          locate(source, line.start, line.start + line.content.length),
        );
      }
    } else {
      runLength = 0;
    }
  }
  return Object.freeze(matches);
}

function createFinding(
  kind: ManuscriptPreflightFindingKind,
  matches: readonly ManuscriptPreflightMatch[],
): ManuscriptPreflightFinding | null {
  return matches.length === 0
    ? null
    : Object.freeze({ kind, count: matches.length, matches });
}

export function diagnoseManuscriptPreflight(
  source: string,
  settings: ManuscriptPreflightSettings,
  boundary?: ManuscriptPreflightBoundaryContext,
): ManuscriptPreflightReport {
  const findings: ManuscriptPreflightFinding[] = [];
  const builtIn = [
    createFinding(
      "trailing-whitespace",
      findTrailingWhitespace(source, boundary),
    ),
    createFinding("tab", findMatches(source, /\t/gu)),
    createFinding(
      "non-breaking-space",
      findMatches(source, /\u00a0/gu),
    ),
    createFinding("mixed-line-ending", findMixedLineEndings(source)),
    createFinding(
      "excess-blank-line",
      findExcessBlankLines(
        source,
        settings.maxConsecutiveBlankLines,
        boundary,
      ),
    ),
  ];
  for (const candidate of builtIn) {
    if (candidate !== null) {
      findings.push(candidate);
    }
  }
  const forbiddenMatches = settings.forbiddenTerms.flatMap((term) =>
    findLiteralMatches(source, term, settings.forbiddenCaseSensitive),
  );
  const forbiddenFinding = createFinding("forbidden-term", forbiddenMatches);
  if (forbiddenFinding !== null) {
    findings.push(forbiddenFinding);
  }
  let regexError: string | null = null;
  if (settings.regexPattern.length > 0) {
    try {
      const flags = `gu${settings.regexCaseSensitive ? "" : "i"}${settings.regexMultiline ? "m" : ""}`;
      const regexFinding = createFinding(
        "regex-match",
        findMatches(source, new RegExp(settings.regexPattern, flags)),
      );
      if (regexFinding !== null) {
        findings.push(regexFinding);
      }
    } catch (error) {
      regexError = error instanceof Error ? error.message : String(error);
    }
  }
  return Object.freeze({
    source,
    statistics: Object.freeze({
      characters: source.length,
      utf8Bytes: new TextEncoder().encode(source).length,
      lines: splitLogicalLines(source).length,
    }),
    findings: Object.freeze(findings),
    regexError,
  });
}

function trimTrailingWhitespace(
  source: string,
  boundary?: ManuscriptPreflightBoundaryContext,
): string {
  return source.replace(
    /[ \t]+(?=\r?$)/gmu,
    (match: string, offset: number) =>
      boundary?.endsAtLineEnd === false &&
      offset + match.length === source.length
        ? match
        : "",
  );
}

function limitBlankLines(
  source: string,
  maximum: number,
  boundary?: ManuscriptPreflightBoundaryContext,
): string {
  const lines = splitLogicalLines(source);
  let runLength = 0;
  return lines
    .flatMap((line, index) => {
      if (!isCompleteLine(index, lines.length, boundary)) {
        runLength = 0;
        return [`${line.content}${line.ending}`];
      }
      if (line.content.trim().length === 0) {
        runLength += 1;
        if (runLength > maximum) {
          return [];
        }
      } else {
        runLength = 0;
      }
      return [`${line.content}${line.ending}`];
    })
    .join("");
}

function ensureBlankLineBetweenParagraphs(
  source: string,
  boundary?: ManuscriptPreflightBoundaryContext,
): string {
  const lines = splitLogicalLines(source);
  return lines
    .flatMap((line, index) => {
      const serialized = `${line.content}${line.ending}`;
      const next = lines[index + 1];
      if (
        line.ending.length === 0 ||
        next === undefined ||
        !isCompleteLine(index, lines.length, boundary) ||
        !isCompleteLine(index + 1, lines.length, boundary) ||
        line.content.trim().length === 0 ||
        next.content.trim().length === 0
      ) {
        return [serialized];
      }
      return [serialized, line.ending];
    })
    .join("");
}

export function buildManuscriptPreflightPreview(
  source: string,
  settings: ManuscriptPreflightSettings,
  boundary?: ManuscriptPreflightBoundaryContext,
  options: ManuscriptPreflightPreviewOptions = {},
): ManuscriptPreflightPreview {
  let result = source;
  if (settings.nonBreakingSpaceReplacement === "space") {
    result = result.replace(/\u00a0/gu, " ");
  }
  if (settings.tabReplacement === "spaces") {
    result = result.replace(/\t/gu, " ".repeat(settings.tabWidth));
  }
  if (settings.trimTrailingWhitespace) {
    result = trimTrailingWhitespace(result, boundary);
  }
  if (settings.limitBlankLines) {
    result = limitBlankLines(
      result,
      settings.maxConsecutiveBlankLines,
      boundary,
    );
  }
  if (options.ensureBlankLineBetweenParagraphs === true) {
    result = ensureBlankLineBetweenParagraphs(result, boundary);
  }
  if (settings.lineEnding === "lf") {
    result = result.replace(/\r\n|\r|\n/gu, "\n");
  } else if (settings.lineEnding === "crlf") {
    result = result.replace(/\r\n|\r|\n/gu, "\r\n");
  }
  const sourceLines = splitLogicalLines(source).map(
    (line) => `${line.content}${line.ending}`,
  );
  const resultLines = splitLogicalLines(result).map(
    (line) => `${line.content}${line.ending}`,
  );
  const changedLineCount = Array.from({
    length: Math.max(sourceLines.length, resultLines.length),
  }).filter((_, index) => sourceLines[index] !== resultLines[index]).length;
  return Object.freeze({
    source,
    result,
    changed: result !== source,
    changedLineCount,
    characterDelta: result.length - source.length,
  });
}

export function applyManuscriptPreflightReplacement(
  manuscript: string,
  range: ManuscriptPreflightRange,
  expectedSource: string,
  result: string,
):
  | Readonly<{ ok: true; value: string; cursor: number }>
  | Readonly<{ ok: false; reason: "invalid-range" | "stale" }> {
  if (
    !Number.isSafeInteger(range.from) ||
    !Number.isSafeInteger(range.to) ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > manuscript.length
  ) {
    return Object.freeze({ ok: false, reason: "invalid-range" as const });
  }
  if (manuscript.slice(range.from, range.to) !== expectedSource) {
    return Object.freeze({ ok: false, reason: "stale" as const });
  }
  return Object.freeze({
    ok: true,
    value: `${manuscript.slice(0, range.from)}${result}${manuscript.slice(range.to)}`,
    cursor: range.from + result.length,
  });
}
