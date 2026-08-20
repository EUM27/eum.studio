import { describe, expect, it } from "vitest";

import {
  parsePrepareSceneDraftInsertionResult,
  parseRunSceneDraftCommand,
  parseSceneDraftCandidate,
  parseSceneDraftModelPayload,
} from "./scene-draft-contract";

const context = {
  plot: {
    plotThreadId: "plot-a",
    revision: 2,
    title: "닫힌 문",
    stage: "전환",
    summary: "문을 열어야 한다.",
    note: "긴장을 유지한다.",
  },
  events: [{
    plotEventLinkId: "link-a",
    linkRevision: 1,
    role: "primary",
    eventBlockId: "event-a",
    eventRevision: 3,
    title: "문이 잠김",
    note: "경보가 울린다.",
  }],
  characters: [{
    characterId: "character-a",
    revision: 4,
    name: "윤서",
    aliases: [],
    role: "기록자",
    summary: "상황을 기록한다.",
    appearance: "",
    personality: "침착함",
    speech: "",
    goal: "문을 연다.",
    conflict: "문이 잠겼다.",
    note: "",
  }],
  settings: [{
    loreEntryId: "setting-a",
    revision: 2,
    title: "경보 장치",
    content: "붉은 빛과 함께 울린다.",
    category: "장소",
    aliases: [],
  }],
} as const;

const candidate = {
  schemaVersion: 1,
  candidateId: "candidate-a",
  revision: 1,
  workId: "work-a",
  context,
  target: {
    documentId: "document-a",
    documentRevisionId: "revision-a",
    insertionOffset: 17,
  },
  providerId: "provider-a",
  modelId: "model-a",
  promptVersion: "scene-draft-v1",
  generatedText: "\n윤서는 문을 밀었다.\n",
  draftText: "\n윤서는 문을 밀었다.\n",
  status: "ready",
  integrity: "current",
  appliedDocumentRevisionId: null,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
} as const;

describe("scene draft contract", () => {
  it("binds generation to an exact Plot revision, selected context, and insertion target", () => {
    expect(parseRunSceneDraftCommand({
      schemaVersion: 1,
      requestId: "request-a",
      workId: "work-a",
      plotThreadId: "plot-a",
      expectedPlotRevision: 2,
      target: candidate.target,
      characterIds: ["character-a"],
      settingIds: ["setting-a"],
    })).toMatchObject({
      plotThreadId: "plot-a",
      expectedPlotRevision: 2,
      target: { documentRevisionId: "revision-a", insertionOffset: 17 },
      characterIds: ["character-a"],
      settingIds: ["setting-a"],
    });
  });

  it("preserves exact candidate whitespace for the later manuscript transaction", () => {
    expect(parseSceneDraftModelPayload({
      draftText: "\n윤서는 문을 밀었다.\n",
    }).draftText).toBe("\n윤서는 문을 밀었다.\n");
    expect(parseSceneDraftCandidate(candidate).draftText)
      .toBe("\n윤서는 문을 밀었다.\n");
  });

  it("projects an already inserted Candidate without treating it as applied", () => {
    expect(parsePrepareSceneDraftInsertionResult({
      schemaVersion: 1,
      status: "already-inserted",
      candidate: { ...candidate, integrity: "inserted" },
      resultDocumentRevisionId: "revision-b",
    })).toMatchObject({
      status: "already-inserted",
      candidate: { status: "ready", integrity: "inserted" },
      resultDocumentRevisionId: "revision-b",
    });
  });
});
