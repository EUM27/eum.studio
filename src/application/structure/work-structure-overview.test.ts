import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { CharacterProjection } from "../characters/character-contract";
import type { ManuscriptDocumentSource } from "../editor/manuscript-document-profile";
import type { PlotThreadProjection } from "../plots/plot-contract";
import type { PlotThreadSourceProjection } from "../plots/plot-source-contract";
import type { EventBlockProjection } from "./event-block-contract";
import type { SceneOverrideProjection } from "./scene-override-contract";
import { deriveWorkStructureOverview } from "./work-structure-overview";

const workId = entityId<"Work">("work-a");
const documentA = entityId<"Document">("document-a");
const documentB = entityId<"Document">("document-b");
const revisionA = entityId<"DocumentRevision">("revision-a");
const revisionB = entityId<"DocumentRevision">("revision-b");
const now = "2026-08-10T00:00:00.000Z";

const documents: readonly ManuscriptDocumentSource[] = [
  {
    workId,
    documentId: documentA,
    documentRevisionId: revisionA,
    label: "1화",
    initialText: "",
  },
  {
    workId,
    documentId: documentB,
    documentRevisionId: revisionB,
    label: "2화",
    initialText: "",
  },
];

const character: CharacterProjection = {
  schemaVersion: 1,
  characterId: entityId<"Character">("character-a"),
  revision: 1,
  workId,
  name: "윤서",
  role: "기록자",
  summary: "",
  note: "",
  createdAt: now,
  updatedAt: now,
  retiredAt: null,
};

const plot: PlotThreadProjection = {
  schemaVersion: 1,
  plotThreadId: entityId<"PlotThread">("plot-a"),
  revision: 1,
  workId,
  title: "사라진 기록",
  stage: "조사",
  summary: "",
  note: "",
  createdAt: now,
  updatedAt: now,
  retiredAt: null,
};

const source: PlotThreadSourceProjection = {
  schemaVersion: 1,
  sourceId: entityId<"PlotThreadSource">("source-a"),
  revision: 1,
  workId,
  plotThreadId: plot.plotThreadId,
  sourceDocumentId: documentB,
  sourceDocumentRevisionId: revisionB,
  sourceAnchorId: entityId<"Anchor">("anchor-source"),
  exactText: "기록 보관함은 비어 있었다.",
  integrity: "resolved",
  range: { from: 2, to: 17 },
  createdAt: now,
};

const event: EventBlockProjection = {
  schemaVersion: 1,
  eventBlockId: entityId<"EventBlock">("event-a"),
  anchorId: entityId<"Anchor">("anchor-event"),
  workId,
  documentId: documentA,
  documentRevisionId: revisionA,
  title: "기록 발견",
  note: "",
  exactQuote: "낡은 기록을 발견했다.",
  integrity: "resolved",
  range: { from: 5, to: 18 },
  createdAt: now,
};

const scene: SceneOverrideProjection = {
  schemaVersion: 1,
  sceneOverrideId: entityId<"SceneOverride">("scene-a"),
  workId,
  documentId: documentB,
  operation: "split",
  baseRuleSetRevision: 1,
  note: "",
  boundaries: [
    {
      anchorId: entityId<"Anchor">("anchor-scene-a"),
      documentRevisionId: revisionB,
      exactQuote: "",
      integrity: "resolved",
      range: { from: 4, to: 4 },
    },
    {
      anchorId: entityId<"Anchor">("anchor-scene-b"),
      documentRevisionId: revisionB,
      exactQuote: "장면 전환",
      integrity: "needsReview",
      range: null,
    },
  ],
  createdAt: now,
};

describe("work structure overview", () => {
  it("purely derives Work totals, document counts, and exact navigation items", () => {
    const projection = deriveWorkStructureOverview({
      workId,
      workTitle: "기록의 집",
      documents,
      characters: [character],
      plots: [plot],
      plotSources: [source],
      eventBlocks: [event],
      sceneOverrides: [scene],
    });

    expect(projection.totals).toEqual({
      documents: 2,
      characters: 1,
      plots: 1,
      plotSources: 1,
      events: 1,
      sceneBoundaries: 2,
    });
    expect(projection.documents).toEqual([
      expect.objectContaining({
        documentId: documentA,
        label: "1화",
        eventCount: 1,
        sceneBoundaryCount: 0,
        plotSourceCount: 0,
      }),
      expect.objectContaining({
        documentId: documentB,
        label: "2화",
        eventCount: 0,
        sceneBoundaryCount: 2,
        plotSourceCount: 1,
      }),
    ]);
    expect(projection.characters[0]).toMatchObject({
      characterId: character.characterId,
      name: "윤서",
    });
    expect(projection.plots[0]).toMatchObject({
      plotThreadId: plot.plotThreadId,
      source: {
        sourceId: source.sourceId,
        sourceDocumentId: documentB,
        integrity: "resolved",
        range: { from: 2, to: 17 },
      },
    });
    expect(projection.events[0]).toMatchObject({
      eventBlockId: event.eventBlockId,
      documentId: documentA,
      range: { from: 5, to: 18 },
    });
    expect(projection.sceneBoundaries).toHaveLength(2);
    expect(projection).not.toHaveProperty("music");
    expect(projection).not.toHaveProperty("lore");
  });

  it("rejects cross-Work, unknown-document, and duplicate source input", () => {
    expect(() => deriveWorkStructureOverview({
      workId,
      workTitle: "기록의 집",
      documents,
      characters: [{ ...character, workId: entityId<"Work">("work-b") }],
      plots: [plot],
      plotSources: [source],
      eventBlocks: [event],
      sceneOverrides: [scene],
    })).toThrow("characters[0] is outside Work work-a");

    expect(() => deriveWorkStructureOverview({
      workId,
      workTitle: "기록의 집",
      documents,
      characters: [character],
      plots: [plot],
      plotSources: [{
        ...source,
        sourceDocumentId: entityId<"Document">("missing"),
      }],
      eventBlocks: [event],
      sceneOverrides: [scene],
    })).toThrow("references unknown Document missing");

    expect(() => deriveWorkStructureOverview({
      workId,
      workTitle: "기록의 집",
      documents,
      characters: [character],
      plots: [plot],
      plotSources: [source, { ...source, sourceId: entityId<"PlotThreadSource">("source-b") }],
      eventBlocks: [event],
      sceneOverrides: [scene],
    })).toThrow("has more than one active source");
  });
});
