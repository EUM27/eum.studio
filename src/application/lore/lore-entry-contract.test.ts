import { describe, expect, it } from "vitest";

import {
  parseAddLoreEntryEvidenceCommand,
  parseCreateLoreEntryCommand,
  parseListLoreEntriesCommand,
  parseLoreEntryListProjection,
  parseRetireLoreEntryCommand,
  parseUpdateLoreEntryCommand,
} from "./lore-entry-contract";

describe("lore entry contract", () => {
  it("parses Work-owned create, update, evidence, list, and retirement commands", () => {
    expect(parseCreateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "  북쪽 탑  ",
      content: "밤마다 종이 세 번 울린다.",
      category: "장소",
      aliases: ["북탑", "종탑"],
      enabled: true,
      evidence: {
        documentId: "document-a",
        selection: { anchor: 12, head: 4 },
        exactText: "종이 울렸다",
      },
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      title: "북쪽 탑",
      content: "밤마다 종이 세 번 울린다.",
      category: "장소",
      aliases: ["북탑", "종탑"],
      enabled: true,
      evidence: {
        documentId: "document-a",
        selection: { anchor: 12, head: 4 },
        exactText: "종이 울렸다",
      },
    });
    expect(parseUpdateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      expectedRevision: 2,
      changes: {
        content: "해 질 무렵과 자정에 종이 울린다.",
        category: "배경 규칙",
        aliases: ["북탑"],
        enabled: false,
      },
    })).toMatchObject({ expectedRevision: 2, changes: { enabled: false } });
    expect(parseAddLoreEntryEvidenceCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      expectedRevision: 3,
      documentId: "document-b",
      selection: { anchor: 8, head: 16 },
      exactText: "세 번 울렸다",
    })).toMatchObject({ documentId: "document-b", expectedRevision: 3 });
    expect(parseListLoreEntriesCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
    expect(parseRetireLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      expectedRevision: 4,
    })).toMatchObject({ loreEntryId: "lore-a", expectedRevision: 4 });
  });

  it("keeps categories and aliases user-defined and rejects unsupported fields", () => {
    expect(parseCreateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "문 없는 방",
      content: "들어온 사람만 출구를 기억한다.",
      category: "사용자 분류",
      aliases: ["밀실", "출구 없는 방"],
      enabled: true,
      evidence: null,
    })).toMatchObject({ category: "사용자 분류", aliases: ["밀실", "출구 없는 방"] });
    expect(() => parseCreateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "문 없는 방",
      content: "들어온 사람만 출구를 기억한다.",
      category: "",
      aliases: [],
      enabled: true,
      evidence: null,
      shared: true,
    })).toThrow("Unsupported CreateLoreEntryCommand field: shared");
  });

  it("requires exact non-empty evidence instead of expanding a selection", () => {
    expect(() => parseCreateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "북쪽 탑",
      content: "종이 울린다.",
      category: "",
      aliases: [],
      enabled: true,
      evidence: {
        documentId: "document-a",
        selection: { anchor: 4, head: 4 },
        exactText: "",
      },
    })).toThrow("evidence selection must not be empty");
  });

  it("rejects an empty update and cross-Work projection data", () => {
    expect(() => parseUpdateLoreEntryCommand({
      schemaVersion: 1,
      workId: "work-a",
      loreEntryId: "lore-a",
      expectedRevision: 1,
      changes: {},
    })).toThrow("changes must contain at least one field");
    expect(() => parseLoreEntryListProjection({
      schemaVersion: 1,
      workId: "work-a",
      entries: [{
        schemaVersion: 1,
        loreEntryId: "lore-b",
        revision: 1,
        workId: "work-b",
        title: "다른 작품 별빛",
        content: "섞이면 안 된다.",
        category: "",
        aliases: [],
        enabled: true,
        evidences: [],
        history: [],
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        retiredAt: null,
      }],
    })).toThrow("outside Work work-a");
  });
});
