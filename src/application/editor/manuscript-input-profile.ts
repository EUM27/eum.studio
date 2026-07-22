export type ManuscriptAutoClosePair = {
  readonly open: string;
  readonly close: string;
};

export type ManuscriptTextReplacement = {
  readonly trigger: string;
  readonly replacement: string;
};

export type ManuscriptInputProfile = {
  readonly schemaVersion: 1;
  readonly autoClosePairs: readonly ManuscriptAutoClosePair[];
  readonly textReplacements: readonly ManuscriptTextReplacement[];
};

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function readAutoClosePairs(value: unknown): readonly ManuscriptAutoClosePair[] {
  if (!Array.isArray(value)) {
    throw new Error("autoClosePairs must be an array");
  }

  const openingTokens = new Set<string>();
  const pairs = value.map((item, index) => {
    const record = readRecord(item, `autoClosePairs[${index}]`);
    const pair = Object.freeze({
      open: readNonEmptyString(record, "open"),
      close: readNonEmptyString(record, "close"),
    });
    if (openingTokens.has(pair.open)) {
      throw new Error("autoClosePairs contains an ambiguous opening token");
    }
    openingTokens.add(pair.open);
    return pair;
  });

  return Object.freeze(pairs);
}

function readTextReplacements(
  value: unknown,
): readonly ManuscriptTextReplacement[] {
  if (!Array.isArray(value)) {
    throw new Error("textReplacements must be an array");
  }

  const triggers = new Set<string>();
  const replacements = value.map((item, index) => {
    const record = readRecord(item, `textReplacements[${index}]`);
    const replacement = Object.freeze({
      trigger: readNonEmptyString(record, "trigger"),
      replacement: readNonEmptyString(record, "replacement"),
    });
    if (triggers.has(replacement.trigger)) {
      throw new Error("textReplacements contains an ambiguous trigger");
    }
    triggers.add(replacement.trigger);
    return replacement;
  });

  return Object.freeze(replacements);
}

export function parseManuscriptInputProfile(
  value: unknown,
): ManuscriptInputProfile {
  const record = readRecord(value, "manuscriptInputProfile");
  if (record.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }

  return Object.freeze({
    schemaVersion: 1,
    autoClosePairs: readAutoClosePairs(record.autoClosePairs),
    textReplacements: readTextReplacements(record.textReplacements),
  });
}
