import { describe, expect, it } from "vitest";

import {
  parseCreatePlotThreadCommand,
  parseListPlotThreadsCommand,
  parsePlotThreadListProjection,
  parsePlotThreadProjection,
  parseRetirePlotThreadCommand,
  parseUpdatePlotThreadCommand,
} from "./plot-contract";

describe("plot thread contract", () => {
  it("parses explicit Work-owned create, list, update, and retirement commands", () => {
    expect(parseCreatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "  사라진 기록  ",
      stage: "조사 중",
      summary: "기록의 행방을 추적한다.",
      note: "3화 단서 확인",
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      title: "사라진 기록",
      stage: "조사 중",
      summary: "기록의 행방을 추적한다.",
      note: "3화 단서 확인",
    });
    expect(parseListPlotThreadsCommand({
      schemaVersion: 1,
      workId: "work-a",
    })).toEqual({ schemaVersion: 1, workId: "work-a" });
    expect(parseUpdatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedRevision: 2,
      changes: {
        title: "돌아온 기록",
        stage: "회수",
        summary: "기록이 돌아온 이유를 밝힌다.",
        note: "결말 직전 확인",
      },
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedRevision: 2,
      changes: {
        title: "돌아온 기록",
        stage: "회수",
        summary: "기록이 돌아온 이유를 밝힌다.",
        note: "결말 직전 확인",
      },
    });
    expect(parseRetirePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedRevision: 3,
    })).toEqual({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedRevision: 3,
    });
  });

  it("requires an explicit title but no fixed stage or music fields", () => {
    expect(parseCreatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "사라진 기록",
      stage: "",
      summary: "",
      note: "",
    })).toMatchObject({ title: "사라진 기록", stage: "" });
    expect(() => parseCreatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "   ",
      stage: "",
      summary: "",
      note: "",
    })).toThrow("title must be a non-empty string");
    expect(() => parseCreatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      title: "사라진 기록",
      stage: "",
      summary: "",
      note: "",
      musicProfile: "sample",
    })).toThrow("Unsupported CreatePlotThreadCommand field: musicProfile");
  });

  it("requires at least one explicit editable field", () => {
    expect(() => parseUpdatePlotThreadCommand({
      schemaVersion: 1,
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedRevision: 1,
      changes: {},
    })).toThrow("changes must contain at least one field");
  });

  it("rejects a plot list containing another Work", () => {
    expect(() => parsePlotThreadListProjection({
      schemaVersion: 1,
      workId: "work-a",
      plots: [{
        schemaVersion: 1,
        plotThreadId: "plot-b",
        revision: 1,
        workId: "work-b",
        title: "다른 작품 플롯",
        stage: "",
        summary: "",
        note: "",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        retiredAt: null,
      }],
    })).toThrow("outside Work work-a");
  });

  it("parses only metadata-owned projection fields", () => {
    expect(parsePlotThreadProjection({
      schemaVersion: 1,
      plotThreadId: "plot-a",
      revision: 1,
      workId: "work-a",
      title: "사라진 기록",
      stage: "",
      summary: "",
      note: "",
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      retiredAt: null,
    })).toMatchObject({ plotThreadId: "plot-a", title: "사라진 기록" });
  });
});
