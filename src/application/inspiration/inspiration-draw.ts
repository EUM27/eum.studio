export type CharacterDrawTrait = Readonly<{
  category: string;
  value: string;
}>;

export type CharacterDrawDraft = Readonly<{
  name: string;
  traits: readonly CharacterDrawTrait[];
}>;

export type EventDrawCard = Readonly<{
  title: string;
  description: string;
}>;

export type EventDrawDraft = Readonly<{
  cards: readonly EventDrawCard[];
}>;

export type InspirationDrawProfile = Readonly<{
  schemaVersion: 1;
  characterDefaultName: string;
  characterTraitCount: number;
  characterUserKeywordCount: number;
  characterUserKeywordCategory: string;
  characterTraitGroups: readonly Readonly<{
    category: string;
    values: readonly string[];
  }>[];
  eventCardCount: number;
  eventUserKeywordDescription: string;
  eventCards: readonly EventDrawCard[];
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

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
  return value.trim();
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function textList(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((entry, index) =>
    text(entry, `${label}[${index}]`)
  ));
}

export function parseInspirationDrawProfile(
  value: unknown,
): InspirationDrawProfile {
  const label = "InspirationDrawProfile";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "characterDefaultName",
    "characterTraitCount",
    "characterUserKeywordCount",
    "characterUserKeywordCategory",
    "characterTraitGroups",
    "eventCardCount",
    "eventUserKeywordDescription",
    "eventCards",
  ], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (!Array.isArray(input.characterTraitGroups)) {
    throw new Error(`${label}.characterTraitGroups must be an array`);
  }
  if (!Array.isArray(input.eventCards)) {
    throw new Error(`${label}.eventCards must be an array`);
  }
  const characterTraitGroups = Object.freeze(
    input.characterTraitGroups.map((entry, index) => {
      const groupLabel = `${label}.characterTraitGroups[${index}]`;
      const group = record(entry, groupLabel);
      exact(group, ["category", "values"], groupLabel);
      return Object.freeze({
        category: text(group.category, `${groupLabel}.category`),
        values: textList(group.values, `${groupLabel}.values`),
      });
    }),
  );
  const eventCards = Object.freeze(input.eventCards.map((entry, index) => {
    const cardLabel = `${label}.eventCards[${index}]`;
    const card = record(entry, cardLabel);
    exact(card, ["title", "description"], cardLabel);
    return Object.freeze({
      title: text(card.title, `${cardLabel}.title`),
      description: text(card.description, `${cardLabel}.description`),
    });
  }));
  return Object.freeze({
    schemaVersion: 1,
    characterDefaultName: text(
      input.characterDefaultName,
      `${label}.characterDefaultName`,
    ),
    characterTraitCount: count(
      input.characterTraitCount,
      `${label}.characterTraitCount`,
    ),
    characterUserKeywordCount: count(
      input.characterUserKeywordCount,
      `${label}.characterUserKeywordCount`,
    ),
    characterUserKeywordCategory: text(
      input.characterUserKeywordCategory,
      `${label}.characterUserKeywordCategory`,
    ),
    characterTraitGroups,
    eventCardCount: count(input.eventCardCount, `${label}.eventCardCount`),
    eventUserKeywordDescription: text(
      input.eventUserKeywordDescription,
      `${label}.eventUserKeywordDescription`,
    ),
    eventCards,
  });
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[target]!;
    result[target] = current!;
  }
  return result;
}

function pick<T>(values: readonly T[], random: () => number): T | null {
  if (values.length === 0) return null;
  return values[Math.floor(random() * values.length)] ?? null;
}

export function drawCharacter(
  profile: InspirationDrawProfile,
  userKeywords: readonly string[],
  random: () => number = Math.random,
): CharacterDrawDraft {
  const baseTraits = shuffled(profile.characterTraitGroups, random)
    .slice(0, profile.characterTraitCount)
    .flatMap((group) => {
      const value = pick(group.values, random);
      return value === null
        ? []
        : [Object.freeze({ category: group.category, value })];
    });
  const customTraits = shuffled(userKeywords, random)
    .slice(0, profile.characterUserKeywordCount)
    .map((value) => Object.freeze({
      category: profile.characterUserKeywordCategory,
      value,
    }));
  return Object.freeze({
    name: profile.characterDefaultName,
    traits: Object.freeze([...baseTraits, ...customTraits]),
  });
}

export function drawEvents(
  profile: InspirationDrawProfile,
  userKeywords: readonly string[],
  random: () => number = Math.random,
): EventDrawDraft {
  const customCards = userKeywords.map((title) => Object.freeze({
    title,
    description: profile.eventUserKeywordDescription,
  }));
  return Object.freeze({
    cards: Object.freeze(
      shuffled([...profile.eventCards, ...customCards], random)
        .slice(0, profile.eventCardCount),
    ),
  });
}

export function parseKeywordDraft(value: string): readonly string[] {
  return Object.freeze([
    ...new Set(
      value
        .split(/[,\n]/u)
        .map((entry) => entry.replace(/\s+/gu, " ").trim())
        .filter((entry) => entry.length > 0),
    ),
  ]);
}
