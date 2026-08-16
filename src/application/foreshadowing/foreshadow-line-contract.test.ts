import { describe, expect, it } from "vitest";

import {
  parseCreateForeshadowLineCommand,
  parseForeshadowLineListProjection,
  parseForeshadowLineProjection,
  parseListForeshadowLinesCommand,
  parseRetireForeshadowLineCommand,
  parseUpdateForeshadowLineCommand,
} from "./foreshadow-line-contract";

describe("foreshadow line contract", () => {
  it("parses explicit Work-owned create, list, update, and retirement commands", () => {
    expect(parseCreateForeshadowLineCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "  되돌아올 약속  ",
      note: "첫 회차에 심는다.",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      title: "되돌아올 약속",
      note: "첫 회차에 심는다.",
    });
    expect(parseListForeshadowLinesCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
    expect(parseUpdateForeshadowLineCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      expectedRevision: 3,
      changes: { title: "바뀐 약속", note: "메모 수정" },
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      expectedRevision: 3,
      changes: { title: "바뀐 약속", note: "메모 수정" },
    });
    expect(parseRetireForeshadowLineCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      expectedRevision: 4,
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      expectedRevision: 4,
    });
  });

  it("requires a non-empty line title and at least one explicit update field", () => {
    expect(() => parseCreateForeshadowLineCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "   ",
      note: "",
    })).toThrow("title must be a non-empty string");
    expect(() => parseUpdateForeshadowLineCommand({
      schemaVersion: 1,
      workId: "work-a",
      lineId: "line-a",
      expectedRevision: 1,
      changes: {},
    })).toThrow("changes must contain at least one field");
  });

  it("does not accept stored payoff or resolution state on a line", () => {
    expect(() => parseForeshadowLineProjection({
      schemaVersion: 1,
      lineId: "line-a",
      revision: 1,
      workId: "work-a",
      title: "약속",
      note: "",
      resolution: "unresolved",
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      retiredAt: null,
    })).toThrow("Unsupported ForeshadowLineProjection field: resolution");
  });

  it("rejects a line list containing another Work", () => {
    expect(() => parseForeshadowLineListProjection({
      schemaVersion: 1,
      workId: "work-a",
      lines: [{
        schemaVersion: 1,
        lineId: "line-b",
        revision: 1,
        workId: "work-b",
        title: "다른 작품의 복선",
        note: "",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        retiredAt: null,
      }],
    })).toThrow("outside Work work-a");
  });
});
