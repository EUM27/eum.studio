export type ManuscriptAutoClosePair = {
  readonly trigger?: string;
  readonly open: string;
  readonly close: string;
};

export type ManuscriptEvolutionCycle = {
  readonly trigger: string;
  readonly pairs: readonly Readonly<{
    open: string;
    close: string;
  }>[];
};

export type ManuscriptTextReplacement = {
  readonly trigger: string;
  readonly replacement: string;
};

export type ManuscriptInputProfile = {
  readonly schemaVersion: 1;
  readonly autoClosePairs: readonly ManuscriptAutoClosePair[];
  readonly evolutionCycles?: readonly ManuscriptEvolutionCycle[];
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
    const open = readNonEmptyString(record, "open");
    const trigger = record.trigger === undefined
      ? undefined
      : readNonEmptyString(record, "trigger");
    const pair = Object.freeze({
      ...(trigger === undefined ? {} : { trigger }),
      open,
      close: readNonEmptyString(record, "close"),
    });
    const openingToken = trigger ?? open;
    if (openingTokens.has(openingToken)) {
      throw new Error("autoClosePairs contains an ambiguous opening token");
    }
    openingTokens.add(openingToken);
    return pair;
  });

  return Object.freeze(pairs);
}

function readEvolutionCycles(
  value: unknown,
): readonly ManuscriptEvolutionCycle[] {
  if (!Array.isArray(value)) {
    throw new Error("evolutionCycles must be an array");
  }
  const triggers = new Set<string>();
  return Object.freeze(value.map((item, index) => {
    const record = readRecord(item, `evolutionCycles[${index}]`);
    const trigger = readNonEmptyString(record, "trigger");
    if (triggers.has(trigger)) {
      throw new Error("evolutionCycles contains an ambiguous trigger");
    }
    triggers.add(trigger);
    if (!Array.isArray(record.pairs) || record.pairs.length === 0) {
      throw new Error(`evolutionCycles[${index}].pairs must be a non-empty array`);
    }
    const pairs = record.pairs.map((pairValue, pairIndex) => {
      const pair = readRecord(
        pairValue,
        `evolutionCycles[${index}].pairs[${pairIndex}]`,
      );
      return Object.freeze({
        open: readNonEmptyString(pair, "open"),
        close: readNonEmptyString(pair, "close"),
      });
    });
    return Object.freeze({ trigger, pairs: Object.freeze(pairs) });
  }));
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

  const evolutionCycles = record.evolutionCycles === undefined
    ? undefined
    : readEvolutionCycles(record.evolutionCycles);
  return Object.freeze({
    schemaVersion: 1,
    autoClosePairs: readAutoClosePairs(record.autoClosePairs),
    ...(evolutionCycles === undefined ? {} : { evolutionCycles }),
    textReplacements: readTextReplacements(record.textReplacements),
  });
}
