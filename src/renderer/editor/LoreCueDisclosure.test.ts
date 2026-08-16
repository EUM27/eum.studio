import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import type { LoreCue } from "../../application/lore/lore-cue-projection";
import { entityId } from "../../domain/writing";
import { LoreCueInspector, LoreCueTooltip } from "./LoreCueDisclosure";

const workId = entityId<"Work">("work-a");
const documentId = entityId<"Document">("document-a");
const loreEntryId = entityId<"LoreEntry">("lore-a");

const entry: LoreEntryProjection = Object.freeze({
  schemaVersion: 1,
  loreEntryId,
  revision: 1,
  workId,
  title: "북쪽 탑",
  content: "밤마다 종이 세 번 울린다.",
  category: "장소",
  aliases: Object.freeze(["북탑"]),
  enabled: true,
  evidences: Object.freeze([]),
  history: Object.freeze([]),
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

const cue: LoreCue = Object.freeze({
  cueId: "cue-a",
  workId,
  documentId,
  lineNumber: 2,
  lineFrom: 10,
  loreEntryIds: Object.freeze([loreEntryId]),
  occurrences: Object.freeze([
    Object.freeze({
      loreEntryId,
      from: 10,
      to: 12,
      matchedText: "북탑",
      matchedKeyword: "북탑",
    }),
  ]),
});

describe("LoreCueDisclosure", () => {
  it("shows a compact tooltip for confirmed lore only", () => {
    const markup = renderToStaticMarkup(createElement(LoreCueTooltip, {
      interaction: {
        cue,
        anchor: { left: 1, right: 2, top: 3, bottom: 4 },
      },
      entries: [entry],
    }));

    expect(markup).toContain("별빛 미리보기");
    expect(markup).toContain("북쪽 탑");
    expect(markup).toContain("밤마다 종이 세 번 울린다.");
    expect(markup).not.toContain("후보 승인");
  });

  it("shows aliases and exact occurrence controls in the pinned inspector", () => {
    const markup = renderToStaticMarkup(createElement(LoreCueInspector, {
      cue,
      entries: [entry],
      error: null,
      onClose: () => undefined,
      onSelectOccurrence: () => undefined,
    }));

    expect(markup).toContain("별빛 검사기");
    expect(markup).toContain("북탑");
    expect(markup).toContain("원고에서 보기");
    expect(markup).not.toContain("후보 승인");
  });
});
