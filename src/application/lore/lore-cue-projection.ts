import type { EntityId } from "../../domain/writing";
import type { LoreEntryProjection } from "./lore-entry-contract";

export type LoreCueOccurrence = {
  readonly loreEntryId: EntityId<"LoreEntry">;
  readonly from: number;
  readonly to: number;
  readonly matchedText: string;
  readonly matchedKeyword: string;
};

export type LoreCue = {
  readonly cueId: string;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly lineNumber: number;
  readonly lineFrom: number;
  readonly loreEntryIds: readonly EntityId<"LoreEntry">[];
  readonly occurrences: readonly LoreCueOccurrence[];
};

export type LoreCueProjection = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly textLength: number;
  readonly cues: readonly LoreCue[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineStarts(text: string): readonly number[] {
  const result = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") result.push(index + 1);
  }
  return Object.freeze(result);
}

function lineIndexAt(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((starts[middle] ?? 0) <= offset) low = middle + 1;
    else high = middle - 1;
  }
  return Math.max(0, high);
}

function entryKeywords(entry: LoreEntryProjection): readonly string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const value of [entry.title, ...entry.aliases]) {
    const keyword = value.trim();
    const identity = keyword.toLocaleLowerCase();
    if (keyword.length === 0 || seen.has(identity)) continue;
    seen.add(identity);
    keywords.push(keyword);
  }
  return Object.freeze(keywords);
}

export function deriveLoreCueProjection(input: {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly text: string;
  readonly entries: readonly LoreEntryProjection[];
}): LoreCueProjection {
  const starts = lineStarts(input.text);
  const grouped = new Map<number, LoreCueOccurrence[]>();
  const occurrenceIdentities = new Set<string>();
  const entries = input.entries.filter(
    (entry) =>
      entry.workId === input.workId &&
      entry.enabled &&
      entry.retiredAt === null,
  );

  for (const entry of entries) {
    for (const keyword of entryKeywords(entry)) {
      const expression = new RegExp(escapeRegExp(keyword), "giu");
      for (const match of input.text.matchAll(expression)) {
        const from = match.index;
        if (from === undefined || match[0].length === 0) continue;
        const to = from + match[0].length;
        const identity = `${entry.loreEntryId}:${from}:${to}`;
        if (occurrenceIdentities.has(identity)) continue;
        occurrenceIdentities.add(identity);
        const lineIndex = lineIndexAt(starts, from);
        const occurrences = grouped.get(lineIndex) ?? [];
        occurrences.push(Object.freeze({
          loreEntryId: entry.loreEntryId,
          from,
          to,
          matchedText: match[0],
          matchedKeyword: keyword,
        }));
        grouped.set(lineIndex, occurrences);
      }
    }
  }

  const cues = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([lineIndex, values]) => {
      const occurrences = Object.freeze(
        [...values].sort(
          (left, right) =>
            left.from - right.from ||
            left.to - right.to ||
            left.loreEntryId.localeCompare(right.loreEntryId),
        ),
      );
      const loreEntryIds = Object.freeze(
        [...new Set(occurrences.map((occurrence) => occurrence.loreEntryId))]
          .sort(),
      );
      const lineFrom = starts[lineIndex] ?? 0;
      return Object.freeze({
        cueId: `${input.documentId}:${lineFrom}:${loreEntryIds.join(",")}`,
        workId: input.workId,
        documentId: input.documentId,
        lineNumber: lineIndex + 1,
        lineFrom,
        loreEntryIds,
        occurrences,
      });
    });

  return Object.freeze({
    workId: input.workId,
    documentId: input.documentId,
    textLength: input.text.length,
    cues: Object.freeze(cues),
  });
}
