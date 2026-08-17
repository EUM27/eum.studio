import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseGetDefaultPlotBoardCommand,
  parseMovePlotPlacementCommand,
  parsePlotBoardProjection,
  parseSetPlotPlacementStoryTimeCommand,
} from "./plot-board-contract";

describe("plot board contract", () => {
  it("parses an authoritative default board and relative placement move", () => {
    const workId = randomUUID();
    const plotBoardId = randomUUID();
    const plotLaneId = randomUUID();
    const plotPlacementId = randomUUID();
    const plotBeatId = randomUUID();
    const afterPlacementId = randomUUID();
    const timestamp = new Date().toISOString();

    expect(parseGetDefaultPlotBoardCommand({
      schemaVersion: 1,
      workId,
    })).toEqual({ schemaVersion: 1, workId });
    expect(parseMovePlotPlacementCommand({
      schemaVersion: 1,
      workId,
      plotPlacementId,
      targetBoardId: plotBoardId,
      targetLaneId: plotLaneId,
      afterPlacementId,
      expectedPlacementRevision: 1,
      expectedBoardRevision: 2,
    })).toEqual({
      schemaVersion: 1,
      workId,
      plotPlacementId,
      targetBoardId: plotBoardId,
      targetLaneId: plotLaneId,
      afterPlacementId,
      expectedPlacementRevision: 1,
      expectedBoardRevision: 2,
    });

    const projection = parsePlotBoardProjection({
      schemaVersion: 1,
      plotBoardId,
      revision: 2,
      workId,
      title: "작품 플롯 보드",
      mode: "sequence",
      createdAt: timestamp,
      updatedAt: timestamp,
      lanes: [{
        schemaVersion: 1,
        plotLaneId,
        revision: 1,
        workId,
        plotBoardId,
        title: "기본 흐름",
        kind: "default",
        orderKey: "0/1",
        createdAt: timestamp,
        updatedAt: timestamp,
        placements: [{
          schemaVersion: 1,
          plotPlacementId,
          revision: 1,
          workId,
          plotBoardId,
          plotLaneId,
          plotBeatId,
          orderKey: "0/1",
          storyTime: null,
          storyTimeEnd: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          retiredAt: null,
          plotBeat: {
            schemaVersion: 1,
            plotThreadId: plotBeatId,
            revision: 1,
            workId,
            title: "첫 플롯",
            stage: "",
            summary: "",
            note: "",
            createdAt: timestamp,
            updatedAt: timestamp,
            retiredAt: null,
          },
        }],
      }],
    });
    expect(projection.lanes[0]?.placements[0]).toMatchObject({
      plotPlacementId,
      orderKey: "0/1",
      plotBeat: { plotThreadId: plotBeatId, title: "첫 플롯" },
    });
  });

  it("accepts unsnapped normalized story time without accepting screen coordinates", () => {
    const command = {
      schemaVersion: 1,
      workId: randomUUID(),
      plotPlacementId: randomUUID(),
      plotBoardId: randomUUID(),
      storyTime: 37.416666666666664,
      storyTimeEnd: 62.8125,
      expectedPlacementRevision: 3,
      expectedBoardRevision: 5,
    } as const;

    expect(parseSetPlotPlacementStoryTimeCommand(command)).toEqual(command);
    expect(() => parseSetPlotPlacementStoryTimeCommand({
      ...command,
      pixelX: 359,
    })).toThrow(/Unsupported SetPlotPlacementStoryTimeCommand field: pixelX/);
  });

  it("enforces the normalized story-time interval", () => {
    const command = {
      schemaVersion: 1,
      workId: randomUUID(),
      plotPlacementId: randomUUID(),
      plotBoardId: randomUUID(),
      storyTime: 20,
      storyTimeEnd: null,
      expectedPlacementRevision: 1,
      expectedBoardRevision: 1,
    } as const;

    expect(() => parseSetPlotPlacementStoryTimeCommand({
      ...command,
      storyTime: -0.001,
    })).toThrow(/storyTime must be between 0 and 100/);
    expect(() => parseSetPlotPlacementStoryTimeCommand({
      ...command,
      storyTime: 100.001,
    })).toThrow(/storyTime must be between 0 and 100/);
    expect(() => parseSetPlotPlacementStoryTimeCommand({
      ...command,
      storyTimeEnd: 19.999,
    })).toThrow(/storyTimeEnd must be between storyTime and 100/);
    expect(() => parseSetPlotPlacementStoryTimeCommand({
      ...command,
      storyTimeEnd: 100.001,
    })).toThrow(/storyTimeEnd must be between storyTime and 100/);
  });
});
