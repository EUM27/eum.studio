import { describe, expect, it } from "vitest";

import type { LoreEntryProjection } from "./lore-entry-contract";
import { entityId } from "../../domain/writing";
import { deriveLoreCueProjection } from "./lore-cue-projection";

const workId = entityId<"Work">("work-a");
const documentId = entityId<"Document">("document-a");

function loreEntry(input: {
  readonly id: string;
  readonly title: string;
  readonly aliases?: readonly string[];
  readonly enabled?: boolean;
  readonly retiredAt?: string | null;
  readonly owner?: "work-a" | "work-b";
}): LoreEntryProjection {
  return Object.freeze({
    schemaVersion: 1,
    loreEntryId: entityId<"LoreEntry">(input.id),
    revision: 1,
    workId: entityId<"Work">(input.owner ?? "work-a"),
    title: input.title,
    content: `${input.title} 내용`,
    category: "사용자 분류",
    aliases: Object.freeze([...(input.aliases ?? [])]),
    enabled: input.enabled ?? true,
    evidences: Object.freeze([]),
    history: Object.freeze([]),
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    retiredAt: input.retiredAt ?? null,
  });
}

describe("deriveLoreCueProjection", () => {
  it("groups exact title and alias occurrences by current manuscript line", () => {
    const tower = loreEntry({
      id: "lore-tower",
      title: "북쪽 탑",
      aliases: ["북탑"],
    });
    const bell = loreEntry({
      id: "lore-bell",
      title: "세 번의 종",
      aliases: ["종소리"],
    });
    const text = "북쪽 탑에는 종소리가 울렸다.\n북탑은 고요했다.";

    const projection = deriveLoreCueProjection({
      workId,
      documentId,
      text,
      entries: [bell, tower],
    });

    expect(projection.cues).toHaveLength(2);
    expect(projection.cues[0]).toMatchObject({
      workId,
      documentId,
      lineNumber: 1,
      lineFrom: 0,
      loreEntryIds: [bell.loreEntryId, tower.loreEntryId].sort(),
    });
    expect(projection.cues[0]?.occurrences.map((occurrence) => ({
      loreEntryId: occurrence.loreEntryId,
      matchedText: occurrence.matchedText,
      from: occurrence.from,
      to: occurrence.to,
    }))).toEqual([
      {
        loreEntryId: tower.loreEntryId,
        matchedText: "북쪽 탑",
        from: 0,
        to: 4,
      },
      {
        loreEntryId: bell.loreEntryId,
        matchedText: "종소리",
        from: 7,
        to: 10,
      },
    ]);
    expect(projection.cues[1]).toMatchObject({
      lineNumber: 2,
      occurrences: [{
        loreEntryId: tower.loreEntryId,
        matchedText: "북탑",
      }],
    });
  });

  it("uses only active confirmed entries owned by the requested Work", () => {
    const active = loreEntry({ id: "active", title: "확정 별빛" });
    const disabled = loreEntry({
      id: "disabled",
      title: "비활성 별빛",
      enabled: false,
    });
    const retired = loreEntry({
      id: "retired",
      title: "치운 별빛",
      retiredAt: "2026-08-10T01:00:00.000Z",
    });
    const foreign = loreEntry({
      id: "foreign",
      title: "다른 작품 별빛",
      owner: "work-b",
    });

    const projection = deriveLoreCueProjection({
      workId,
      documentId,
      text: "확정 별빛 비활성 별빛 치운 별빛 다른 작품 별빛 후보 별빛",
      entries: [active, disabled, retired, foreign],
    });

    expect(projection.cues).toHaveLength(1);
    expect(projection.cues[0]?.loreEntryIds).toEqual([active.loreEntryId]);
    expect(projection.cues[0]?.occurrences).toHaveLength(1);
  });

  it("keeps manuscript offsets and matched casing exact without changing the text", () => {
    const entry = loreEntry({
      id: "case",
      title: "Moon",
      aliases: ["moon", "달빛"],
    });
    const text = "MOON과 달빛";

    const projection = deriveLoreCueProjection({
      workId,
      documentId,
      text,
      entries: [entry],
    });

    expect(projection.textLength).toBe(text.length);
    expect(projection.cues[0]?.occurrences).toEqual([
      expect.objectContaining({ from: 0, to: 4, matchedText: "MOON" }),
      expect.objectContaining({ from: 6, to: 8, matchedText: "달빛" }),
    ]);
    expect(text).toBe("MOON과 달빛");
  });
});
