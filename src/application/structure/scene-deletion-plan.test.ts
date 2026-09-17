import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { SceneProjection } from "./scene-projection";
import {
  deleteManuscriptEditorStateRange,
  planSceneDeletion,
  resolveSceneDeletionTarget,
} from "./scene-deletion-plan";

const workId = entityId<"Work">("work-delete-plan");
const documentId = entityId<"Document">("document-delete-plan");
const revisionId = entityId<"DocumentRevision">("revision-delete-plan");

function scene(
  index: number,
  start: number,
  end: number,
  startAnchor: string,
  endAnchor: string | null,
): SceneProjection {
  return {
    schemaVersion: 1,
    sceneKey: `scene-${index}`,
    workId,
    documentId,
    documentRevisionId: revisionId,
    documentTitle: "회차",
    documentIndex: 0,
    sceneIndex: index,
    startAnchorId: entityId<"Anchor">(startAnchor),
    endAnchorId: endAnchor === null ? null : entityId<"Anchor">(endAnchor),
    range: { start, end },
    integrity: "resolved",
    source: "rule",
    events: [],
    excludedEvents: [],
  };
}

const text = "하나\n---\n둘\n---\n셋";
const scenes = [
  scene(1, 0, 2, "start", "boundary-1"),
  scene(2, 7, 8, "boundary-1", "boundary-2"),
  scene(3, 13, 14, "boundary-2", null),
];
const document = {
  documentId,
  documentTitle: "회차",
  documentRevisionId: revisionId,
  text,
};

describe("Scene deletion plan", () => {
  it("removes the following boundary for first and middle Scenes", () => {
    const first = planSceneDeletion({
      target: { sceneId: null, documentId, sceneKey: "scene-1" },
      scenes,
      documents: [document],
    }).documents[0]!;
    expect(first.deletionRange).toEqual({ start: 0, end: 7 });
    expect(first.deletedText).toBe("하나\n---\n");
    expect(first.nextText).toBe("둘\n---\n셋");
    expect(first.removedBoundaryAnchorId).toBe("boundary-1");

    const middle = planSceneDeletion({
      target: { sceneId: null, documentId, sceneKey: "scene-2" },
      scenes,
      documents: [document],
    }).documents[0]!;
    expect(middle.deletionRange).toEqual({ start: 7, end: 13 });
    expect(middle.deletedText).toBe("둘\n---\n");
    expect(middle.nextText).toBe("하나\n---\n셋");
  });

  it("removes the preceding boundary for the last Scene", () => {
    const last = planSceneDeletion({
      target: { sceneId: null, documentId, sceneKey: "scene-3" },
      scenes,
      documents: [document],
    }).documents[0]!;
    expect(last.deletionRange).toEqual({ start: 8, end: 14 });
    expect(last.deletedText).toBe("\n---\n셋");
    expect(last.nextText).toBe("하나\n---\n둘");
    expect(last.removedBoundaryAnchorId).toBe("boundary-2");
  });

  it("deletes only the content of a sole Scene", () => {
    const only = scene(1, 0, 2, "start", null);
    const result = planSceneDeletion({
      target: { sceneId: null, documentId, sceneKey: only.sceneKey },
      scenes: [only],
      documents: [{ ...document, text: "하나" }],
    }).documents[0]!;
    expect(result.deletionRange).toEqual({ start: 0, end: 2 });
    expect(result.nextText).toBe("");
    expect(result.removedBoundaryAnchorId).toBeNull();
  });

  it("previews the first and last sentences even when they share one line", () => {
    const sentenceText = "첫 문장이다. 둘째 문장이다! 마지막 문장인가?";
    const only = scene(1, 0, sentenceText.length, "start", null);
    const result = planSceneDeletion({
      target: { sceneId: null, documentId, sceneKey: only.sceneKey },
      scenes: [only],
      documents: [{ ...document, text: sentenceText }],
    }).documents[0]!;

    expect(result.firstExcerpt).toBe("첫 문장이다.");
    expect(result.lastExcerpt).toBe("마지막 문장인가?");
  });

  it("rejects stale identities and duplicate segments in one Document", () => {
    expect(() => planSceneDeletion({
      target: {
        sceneId: entityId<"Scene">("wrong"),
        documentId,
        sceneKey: "scene-1",
      },
      scenes,
      documents: [document],
    })).toThrow("identity changed");
    const stableId = entityId<"Scene">("shared");
    const duplicated = scenes.slice(0, 2).map((candidate) => ({
      ...candidate,
      sceneIdentity: { sceneId: stableId, segments: [] },
    }));
    expect(() => planSceneDeletion({
      target: { sceneId: stableId, documentId, sceneKey: "scene-1" },
      scenes: duplicated,
      documents: [document],
    })).toThrow("ambiguous segments");
  });

  it("includes the sole resolved Scene for an edited cross-episode segment", () => {
    const secondDocumentId = entityId<"Document">("document-delete-plan-2");
    const secondRevisionId = entityId<"DocumentRevision">("revision-delete-plan-2");
    const stableId = entityId<"Scene">("shared-edited");
    const first = {
      ...scene(1, 0, 2, "start", null),
      sceneIdentity: {
        sceneId: stableId,
        segments: [
          {
            segmentId: entityId<"EpisodeSceneSegment">("segment-resolved"),
            sceneId: stableId,
            documentId,
            documentRevisionId: revisionId,
            documentTitle: "1화",
            documentIndex: 0,
            range: { start: 0, end: 2 },
            integrity: "resolved" as const,
          },
          {
            segmentId: entityId<"EpisodeSceneSegment">("segment-edited"),
            sceneId: stableId,
            documentId: secondDocumentId,
            documentRevisionId: secondRevisionId,
            documentTitle: "2화",
            documentIndex: 1,
            range: null,
            integrity: "broken" as const,
          },
        ],
      },
    };
    const editedContinuation: SceneProjection = {
      ...scene(1, 0, 5, "second-start", null),
      sceneKey: "scene-edited-continuation",
      documentId: secondDocumentId,
      documentRevisionId: secondRevisionId,
      documentTitle: "2화",
      documentIndex: 1,
    };

    const result = planSceneDeletion({
      target: {
        sceneId: stableId,
        documentId,
        sceneKey: first.sceneKey,
      },
      scenes: [first, editedContinuation],
      documents: [
        { ...document, text: "하나" },
        {
          documentId: secondDocumentId,
          documentTitle: "2화",
          documentRevisionId: secondRevisionId,
          text: "바뀐 장면",
        },
      ],
    });

    expect(result.documents.map((candidate) => candidate.documentId).sort())
      .toEqual([documentId, secondDocumentId].sort());
    expect(resolveSceneDeletionTarget({
      requestedScenes: [first, editedContinuation],
      scenes: [first, editedContinuation],
    })).toEqual({
      sceneId: stableId,
      documentId,
      sceneKey: first.sceneKey,
    });
  });

  it("does not guess among multiple Scenes for an unresolved episode segment", () => {
    const secondDocumentId = entityId<"Document">("document-delete-plan-2");
    const secondRevisionId = entityId<"DocumentRevision">("revision-delete-plan-2");
    const stableId = entityId<"Scene">("shared-ambiguous");
    const first = {
      ...scene(1, 0, 2, "start", null),
      sceneIdentity: {
        sceneId: stableId,
        segments: [
          {
            segmentId: entityId<"EpisodeSceneSegment">("segment-resolved"),
            sceneId: stableId,
            documentId,
            documentRevisionId: revisionId,
            documentTitle: "1화",
            documentIndex: 0,
            range: { start: 0, end: 2 },
            integrity: "resolved" as const,
          },
          {
            segmentId: entityId<"EpisodeSceneSegment">("segment-unresolved"),
            sceneId: stableId,
            documentId: secondDocumentId,
            documentRevisionId: secondRevisionId,
            documentTitle: "2화",
            documentIndex: 1,
            range: null,
            integrity: "broken" as const,
          },
        ],
      },
    };
    const secondScenes: SceneProjection[] = [
      {
        ...scene(1, 0, 2, "second-start", "second-boundary"),
        sceneKey: "scene-second-1",
        documentId: secondDocumentId,
        documentRevisionId: secondRevisionId,
        documentTitle: "2화",
        documentIndex: 1,
      },
      {
        ...scene(2, 3, 5, "second-boundary", null),
        sceneKey: "scene-second-2",
        documentId: secondDocumentId,
        documentRevisionId: secondRevisionId,
        documentTitle: "2화",
        documentIndex: 1,
      },
    ];

    expect(() => planSceneDeletion({
      target: {
        sceneId: stableId,
        documentId,
        sceneKey: first.sceneKey,
      },
      scenes: [first, ...secondScenes],
      documents: [
        { ...document, text: "하나" },
        {
          documentId: secondDocumentId,
          documentTitle: "2화",
          documentRevisionId: secondRevisionId,
          text: "둘\n셋",
        },
      ],
    })).toThrow("unresolved episode segment");
  });

  it("shifts and clamps formatting through the deleted envelope", () => {
    const base = {
      schemaVersion: 1,
      ranges: [],
      fontFamilyId: "serif",
      fontSizePx: 16,
      contentWidthPx: 720,
      lineHeight: 1.7,
      paragraphSpacingPx: 8,
      letterSpacingEm: 0,
      paragraphAlignments: [],
    } as const;
    const transformed = deleteManuscriptEditorStateRange({
      text: "abcdefghij",
      range: { start: 3, end: 7 },
      state: {
        ...base,
        ranges: [{ from: 1, to: 9, style: { bold: true } }],
        paragraphAlignments: [{ at: 8, alignment: "center" }],
      },
    });
    expect(transformed.ranges).toEqual([
      { from: 1, to: 5, style: { bold: true } },
    ]);
    expect(transformed.paragraphAlignments).toEqual([
      { at: 0, alignment: "center" },
    ]);
  });
});
