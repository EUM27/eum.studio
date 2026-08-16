import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LoreEntryProjection } from "../../application/lore/lore-entry-contract";
import { entityId } from "../../domain/writing";
import { LoreManagerDialog } from "./LoreManagerDialog";

const entry: LoreEntryProjection = Object.freeze({
  schemaVersion: 1,
  loreEntryId: entityId<"LoreEntry">("lore-a"),
  revision: 2,
  workId: entityId<"Work">("work-a"),
  title: "북쪽 탑",
  content: "밤마다 종이 세 번 울린다.",
  category: "장소",
  aliases: Object.freeze(["북탑", "종탑"]),
  enabled: true,
  evidences: Object.freeze([Object.freeze({
    anchorId: entityId<"Anchor">("anchor-a"),
    sourceDocumentId: entityId<"Document">("document-a"),
    sourceDocumentRevisionId: entityId<"DocumentRevision">("revision-a"),
    exactText: "북쪽 탑에서 종이 울렸다.",
    integrity: "resolved",
    range: Object.freeze({ from: 4, to: 18 }),
    createdAt: "2026-08-10T00:00:00.000Z",
  })]),
  history: Object.freeze([
    Object.freeze({
      historyId: entityId<"LoreEntryHistory">("history-a"),
      entryRevision: 1,
      changeKind: "created",
      title: "북쪽 탑",
      content: "종이 울린다.",
      category: "장소",
      aliases: Object.freeze(["북탑"]),
      enabled: true,
      evidenceAnchorIds: Object.freeze([entityId<"Anchor">("anchor-a")]),
      changedAt: "2026-08-10T00:00:00.000Z",
    }),
    Object.freeze({
      historyId: entityId<"LoreEntryHistory">("history-b"),
      entryRevision: 2,
      changeKind: "updated",
      title: "북쪽 탑",
      content: "밤마다 종이 세 번 울린다.",
      category: "장소",
      aliases: Object.freeze(["북탑", "종탑"]),
      enabled: true,
      evidenceAnchorIds: Object.freeze([entityId<"Anchor">("anchor-a")]),
      changedAt: "2026-08-10T00:01:00.000Z",
    }),
  ]),
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:01:00.000Z",
  retiredAt: null,
});

const lineId = entityId<"ForeshadowLine">("line-a");
const linkId = entityId<"LoreForeshadowLink">("link-a");

describe("LoreManagerDialog", () => {
  it("shows Work-owned lore fields, exact evidence, and immutable history", () => {
    const markup = renderToStaticMarkup(createElement(LoreManagerDialog, {
      actionState: "idle",
      canCaptureEvidence: true,
      documentLabels: { "document-a": "3화" },
      entries: [entry],
      error: null,
      foreshadowLines: [{
        schemaVersion: 1,
        lineId,
        revision: 1,
        workId: entry.workId,
        title: "세 번의 종소리",
        note: "후반부 회수",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        retiredAt: null,
      }],
      loreForeshadowLinks: [{
        schemaVersion: 1,
        linkId,
        revision: 1,
        workId: entry.workId,
        loreEntryId: entry.loreEntryId,
        lineId,
        linkedAt: "2026-08-10T00:00:00.000Z",
        unlinkedAt: null,
        unlinkReason: null,
      }],
      onAddEvidence: () => undefined,
      onClose: () => undefined,
      onCreate: () => undefined,
      onOpenEvidence: () => undefined,
      onLinkForeshadow: () => undefined,
      onRetire: () => undefined,
      onSelect: () => undefined,
      onUpdate: () => undefined,
      onUnlinkForeshadow: () => undefined,
      selectedLoreEntryId: entry.loreEntryId,
    }));

    expect(markup).toContain("별빛 관리");
    expect(markup).toContain("북쪽 탑");
    expect(markup).toContain("장소");
    expect(markup).toContain("북탑");
    expect(markup).toContain("밤마다 종이 세 번 울린다.");
    expect(markup).toContain("북쪽 탑에서 종이 울렸다.");
    expect(markup).toContain("3화");
    expect(markup).toContain("현재 선택을 근거로 추가");
    expect(markup).toContain("원문 열기");
    expect(markup).toContain("변경 이력");
    expect(markup).toContain("내용 변경");
    expect(markup).toContain("연결된 복선");
    expect(markup).toContain("세 번의 종소리");
    expect(markup).toContain("연결 해제");
    expect(markup).not.toContain("공용 별빛");
  });
});
