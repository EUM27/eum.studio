import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ForeshadowLineProjection } from "../../application/foreshadowing/foreshadow-line-contract";
import type {
  ForeshadowPointProfile,
  ForeshadowPointProjection,
} from "../../application/foreshadowing/foreshadow-point-contract";
import { entityId } from "../../domain/writing";
import { ForeshadowLineDialog } from "./ForeshadowLineDialog";

const line: ForeshadowLineProjection = Object.freeze({
  schemaVersion: 1,
  lineId: entityId<"ForeshadowLine">("line-1"),
  revision: 2,
  workId: entityId<"Work">("work-1"),
  title: "되돌아올 약속",
  note: "첫 회차의 문을 기억한다.",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});

const profile: ForeshadowPointProfile = Object.freeze({
  schemaVersion: 1,
  defaultRoleId: "plant",
  payoffRoleId: "payoff",
  roles: Object.freeze([
    Object.freeze({ id: "plant", label: "배치" }),
    Object.freeze({ id: "reinforcement", label: "강화" }),
    Object.freeze({ id: "payoff", label: "회수" }),
  ]),
});

const point: ForeshadowPointProjection = Object.freeze({
  schemaVersion: 1,
  pointId: entityId<"ForeshadowPoint">("point-1"),
  revision: 1,
  workId: line.workId,
  lineId: line.lineId,
  sourceDocumentId: entityId<"Document">("document-2"),
  sourceDocumentRevisionId:
    entityId<"DocumentRevision">("revision-2"),
  sourceAnchorId: entityId<"Anchor">("anchor-2"),
  roleId: "plant",
  note: "문 앞의 종소리",
  exactText: "  종소리가 세 번 울렸다.  ",
  integrity: "resolved",
  range: Object.freeze({ from: 10, to: 28 }),
  createdAt: "2026-08-10T00:00:00.000Z",
});

const loreEntryId = entityId<"LoreEntry">("lore-1");
const loreEntry = Object.freeze({
  schemaVersion: 1 as const,
  loreEntryId,
  revision: 1,
  workId: line.workId,
  title: "북쪽 탑",
  content: "종이 세 번 울린다.",
  category: "장소",
  aliases: Object.freeze(["북탑"]),
  enabled: true,
  evidences: Object.freeze([]),
  history: Object.freeze([]),
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  retiredAt: null,
});
const loreLink = Object.freeze({
  schemaVersion: 1 as const,
  linkId: entityId<"LoreForeshadowLink">("link-1"),
  revision: 1,
  workId: line.workId,
  loreEntryId,
  lineId: line.lineId,
  linkedAt: "2026-08-10T00:00:00.000Z",
  unlinkedAt: null,
  unlinkReason: null,
});

describe("ForeshadowLineDialog", () => {
  it("offers line creation, title and note editing, and soft retirement", () => {
    const markup = renderToStaticMarkup(
      createElement(ForeshadowLineDialog, {
        actionState: "idle",
        canCapture: true,
        documentLabels: { "document-2": "2화" },
        error: null,
        lines: [line],
        loreEntries: [loreEntry],
        loreForeshadowLinks: [loreLink],
        onClose: () => undefined,
        onCapture: () => undefined,
        onCreate: () => undefined,
        onOpenPoint: () => undefined,
        onLinkLore: () => undefined,
        onRetire: () => undefined,
        onUpdate: () => undefined,
        onUnlinkLore: () => undefined,
        points: [point],
        profile,
        selectedLineId: line.lineId,
      }),
    );

    expect(markup).toContain("복선 라인");
    expect(markup).toContain("새 복선 이름");
    expect(markup).toContain("라인 만들기");
    expect(markup).toContain("되돌아올 약속");
    expect(markup).toContain("첫 회차의 문을 기억한다.");
    expect(markup).toContain("라인 치우기");
    expect(markup).toContain("선택 지점 연결");
    expect(markup).toContain("배치");
    expect(markup).toContain("2화");
    expect(markup).toContain("  종소리가 세 번 울렸다.  ");
    expect(markup).toContain("미회수");
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain("연결된 별빛");
    expect(markup).toContain("북쪽 탑");
    expect(markup).toContain("연결 해제");
  });

  it("shows an empty Work without inventing a line", () => {
    const markup = renderToStaticMarkup(
      createElement(ForeshadowLineDialog, {
        actionState: "idle",
        canCapture: false,
        documentLabels: {},
        error: null,
        lines: [],
        loreEntries: [],
        loreForeshadowLinks: [],
        onClose: () => undefined,
        onCapture: () => undefined,
        onCreate: () => undefined,
        onOpenPoint: () => undefined,
        onLinkLore: () => undefined,
        onRetire: () => undefined,
        onUpdate: () => undefined,
        onUnlinkLore: () => undefined,
        points: [],
        profile,
        selectedLineId: null,
      }),
    );

    expect(markup).toContain("이 작품에 만든 복선 라인이 없습니다.");
  });

  it("derives a resolved line only from a configured payoff point", () => {
    const markup = renderToStaticMarkup(
      createElement(ForeshadowLineDialog, {
        actionState: "idle",
        canCapture: false,
        documentLabels: { "document-2": "2화" },
        error: null,
        lines: [line],
        loreEntries: [],
        loreForeshadowLinks: [],
        onClose: () => undefined,
        onCapture: () => undefined,
        onCreate: () => undefined,
        onOpenPoint: () => undefined,
        onLinkLore: () => undefined,
        onRetire: () => undefined,
        onUpdate: () => undefined,
        onUnlinkLore: () => undefined,
        points: [Object.freeze({ ...point, roleId: "payoff" })],
        profile,
        selectedLineId: null,
      }),
    );

    expect(markup).toContain("회수 완료");
  });
});
