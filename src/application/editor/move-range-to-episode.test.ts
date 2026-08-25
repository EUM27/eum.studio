import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  moveManuscriptEditorStateRange,
  moveRangeToEpisodeText,
  parseMoveRangeToEpisodeCommand,
  parseMoveRangeToEpisodeReceipt,
  planEpisodeSceneIdentityChanges,
  resolveHereToEpisodeEndRange,
} from "./move-range-to-episode";

const workId = entityId<"Work">("work-move-range");
const sourceEpisodeId = entityId<"Document">("episode-9");
const targetEpisodeId = entityId<"Document">("episode-10");
const sourceRevisionId = entityId<"DocumentRevision">("revision-9");
const targetRevisionId = entityId<"DocumentRevision">("revision-10");

describe("MoveRangeToEpisode", () => {
  it("parses the exact revision-checked editor command", () => {
    expect(parseMoveRangeToEpisodeCommand({
      schemaVersion: 1,
      workId,
      sourceEpisodeId,
      targetEpisodeId,
      expectedSourceRevisionId: sourceRevisionId,
      expectedTargetRevisionId: targetRevisionId,
      from: 8,
      to: 16,
      placement: "start",
    })).toEqual({
      schemaVersion: 1,
      workId,
      sourceEpisodeId,
      targetEpisodeId,
      expectedSourceRevisionId: sourceRevisionId,
      expectedTargetRevisionId: targetRevisionId,
      from: 8,
      to: 16,
      placement: "start",
    });
  });

  it("uses the selection start and the exact current episode end", () => {
    expect(resolveHereToEpisodeEndRange(
      { from: 7, to: 11 },
      19,
    )).toEqual({ from: 7, to: 19 });
    expect(resolveHereToEpisodeEndRange(
      { from: 5, to: 5 },
      19,
    )).toEqual({ from: 5, to: 19 });
  });

  it("moves exact text to the beginning without adding separators", () => {
    expect(moveRangeToEpisodeText({
      sourceText: "AAAABBBB",
      targetText: "CCCC",
      from: 4,
      to: 8,
      placement: "start",
    })).toEqual({
      movedText: "BBBB",
      sourceText: "AAAA",
      targetText: "BBBBCCCC",
      targetInsertOffset: 0,
    });
  });

  it("moves formatting ranges with the text while retaining each episode layout", () => {
    const result = moveManuscriptEditorStateRange({
      sourceText: "AAAA\nBBBB\n",
      targetText: "CCCC",
      from: 5,
      to: 10,
      placement: "start",
      sourceState: {
        schemaVersion: 1,
        ranges: [
          { from: 1, to: 3, style: { bold: true } },
          { from: 5, to: 9, style: { italic: true } },
        ],
        fontFamilyId: "source-font",
        fontSizePx: 18,
        contentWidthPx: 720,
        lineHeight: 1.8,
        paragraphSpacingPx: 8,
        letterSpacingEm: 0,
        paragraphAlignments: [{ at: 5, alignment: "center" }],
      },
      targetState: {
        schemaVersion: 1,
        ranges: [{ from: 0, to: 4, style: { underline: true } }],
        fontFamilyId: "target-font",
        fontSizePx: 16,
        contentWidthPx: 640,
        lineHeight: 1.6,
        paragraphSpacingPx: 4,
        letterSpacingEm: 0,
        paragraphAlignments: [{ at: 0, alignment: "right" }],
      },
    });

    expect(result.sourceState).toMatchObject({
      fontFamilyId: "source-font",
      ranges: [{ from: 1, to: 3, style: { bold: true } }],
      paragraphAlignments: [],
    });
    expect(result.targetState).toMatchObject({
      fontFamilyId: "target-font",
      ranges: [
        { from: 0, to: 4, style: { italic: true } },
        { from: 5, to: 9, style: { underline: true } },
      ],
      paragraphAlignments: [
        { at: 0, alignment: "center" },
        { at: 5, alignment: "right" },
      ],
    });
  });

  it("keeps one scene identity across source and target segments", () => {
    let sceneSequence = 0;
    let segmentSequence = 0;
    const plan = planEpisodeSceneIdentityChanges({
      sourceEpisodeId,
      targetEpisodeId,
      from: 12,
      to: 20,
      targetInsertOffset: 0,
      scenes: [
        {
          sceneKey: "scene-b",
          sceneId: null,
          range: { start: 8, end: 20 },
          explicitlyStructured: true,
          existingSegments: [],
        },
      ],
      createSceneId: () =>
        entityId<"Scene">(`scene-${++sceneSequence}`),
      createSegmentId: () =>
        entityId<"EpisodeSceneSegment">(`segment-${++segmentSequence}`),
    });

    expect(plan.createdSceneIds).toEqual([entityId<"Scene">("scene-1")]);
    expect(plan.retiredSegmentIds).toEqual([]);
    expect(plan.createdSegments).toEqual([
      {
        segmentId: entityId<"EpisodeSceneSegment">("segment-1"),
        sceneId: entityId<"Scene">("scene-1"),
        documentId: sourceEpisodeId,
        range: { start: 8, end: 12 },
      },
      {
        segmentId: entityId<"EpisodeSceneSegment">("segment-2"),
        sceneId: entityId<"Scene">("scene-1"),
        documentId: targetEpisodeId,
        range: { start: 0, end: 8 },
      },
    ]);
  });

  it("moves unstructured manuscript text without creating a scene identity", () => {
    const plan = planEpisodeSceneIdentityChanges({
      sourceEpisodeId,
      targetEpisodeId,
      from: 4,
      to: 8,
      targetInsertOffset: 0,
      scenes: [
        {
          sceneKey: "document-only-derived-scene",
          sceneId: null,
          range: { start: 0, end: 8 },
          explicitlyStructured: false,
          existingSegments: [],
        },
      ],
      createSceneId: () => entityId<"Scene">("unused-scene"),
      createSegmentId: () =>
        entityId<"EpisodeSceneSegment">("unused-segment"),
    });

    expect(plan).toEqual({
      createdSceneIds: [],
      retiredSegmentIds: [],
      createdSegments: [],
    });
  });

  it("parses one atomic move receipt with both revisions and linked scenes", () => {
    expect(parseMoveRangeToEpisodeReceipt({
      schemaVersion: 1,
      status: "moved",
      moveId: "move-1",
      workId,
      sourceEpisodeId,
      targetEpisodeId,
      sourceRevisionId: "source-after",
      targetRevisionId: "target-after",
      sceneIds: ["scene-1"],
    })).toEqual({
      schemaVersion: 1,
      status: "moved",
      moveId: entityId<"EpisodeRangeMove">("move-1"),
      workId,
      sourceEpisodeId,
      targetEpisodeId,
      sourceRevisionId: entityId<"DocumentRevision">("source-after"),
      targetRevisionId: entityId<"DocumentRevision">("target-after"),
      sceneIds: [entityId<"Scene">("scene-1")],
    });
  });
});
