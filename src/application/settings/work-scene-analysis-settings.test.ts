import { describe, expect, it } from "vitest";

import {
  createDefaultWorkSceneAnalysisSettingsProjection,
  parseGetWorkSceneAnalysisSettingsCommand,
  parseSaveWorkSceneAnalysisSettingsCommand,
  parseWorkSceneAnalysisSettingsProjection,
} from "./work-scene-analysis-settings";
import { entityId } from "../../domain/writing";

describe("Work scene analysis settings", () => {
  it("defaults each Work to disabled and parses explicit saves", () => {
    expect(
      createDefaultWorkSceneAnalysisSettingsProjection(entityId<"Work">("work-1")),
    ).toEqual({
      schemaVersion: 1,
      workId: "work-1",
      revision: 0,
      settings: { enabled: false },
      updatedAt: null,
    });
    expect(parseGetWorkSceneAnalysisSettingsCommand({
      schemaVersion: 1,
      workId: "work-1",
    })).toMatchObject({ workId: "work-1" });
    expect(parseSaveWorkSceneAnalysisSettingsCommand({
      schemaVersion: 1,
      workId: "work-1",
      expectedRevision: 0,
      settings: { enabled: true },
    })).toMatchObject({ expectedRevision: 0, settings: { enabled: true } });
  });

  it("rejects implicit fields and inconsistent projections", () => {
    expect(() => parseSaveWorkSceneAnalysisSettingsCommand({
      schemaVersion: 1,
      workId: "work-1",
      expectedRevision: 0,
      settings: { enabled: true, mode: "all" },
    })).toThrow(/fields/u);
    expect(() => parseWorkSceneAnalysisSettingsProjection({
      schemaVersion: 1,
      workId: "work-1",
      revision: 1,
      settings: { enabled: true },
      updatedAt: null,
    })).toThrow(/inconsistent/u);
  });
});
