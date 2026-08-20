import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";

import {
  createSceneExtractionParagraphs,
  parseSceneExtractionModelPayload,
  resolveSceneExtractionModelScenes,
} from "./scene-extraction-contract";

describe("scene extraction contract", () => {
  it("maps model paragraph identities back to exact current revision ranges", () => {
    const sourceRange = {
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
      from: 10,
      to: 23,
    };
    const paragraphs = createSceneExtractionParagraphs({
      sourceRange,
      manuscript: "첫 문단\n둘째 문단\n셋째",
    });
    expect(paragraphs).toMatchObject([
      { paragraphId: "p1", from: 10, to: 14, text: "첫 문단" },
      { paragraphId: "p2", from: 15, to: 20, text: "둘째 문단" },
      { paragraphId: "p3", from: 21, to: 23, text: "셋째" },
    ]);
    const payload = parseSceneExtractionModelPayload({
      scenes: [
        {
          title: "첫 장면",
          fromParagraphId: "p1",
          toParagraphId: "p1",
          summary: "",
          povCharacter: "",
          location: "",
          time: "",
          characters: [],
          goal: "",
          conflict: "",
          outcome: "",
        },
        {
          title: "둘째 장면",
          fromParagraphId: "p2",
          toParagraphId: "p3",
          summary: "",
          povCharacter: "",
          location: "",
          time: "",
          characters: [],
          goal: "",
          conflict: "",
          outcome: "",
        },
      ],
    });
    expect(resolveSceneExtractionModelScenes({
      sourceRange,
      paragraphs,
      payload,
    }).map((scene) => scene.range)).toEqual([
      { documentId: "document-a", documentRevisionId: "revision-a", from: 10, to: 14 },
      { documentId: "document-a", documentRevisionId: "revision-a", from: 15, to: 23 },
    ]);
  });

  it("rejects unknown, reversed, and overlapping paragraph ranges", () => {
    const sourceRange = {
      documentId: entityId<"Document">("document-a"),
      documentRevisionId: entityId<"DocumentRevision">("revision-a"),
      from: 0,
      to: 5,
    };
    const paragraphs = createSceneExtractionParagraphs({
      sourceRange,
      manuscript: "가\n나\n다",
    });
    const scene = {
      title: "장면",
      fromParagraphId: "p1",
      toParagraphId: "p2",
      summary: "",
      povCharacter: "",
      location: "",
      time: "",
      characters: [],
      goal: "",
      conflict: "",
      outcome: "",
    };
    expect(() => resolveSceneExtractionModelScenes({
      sourceRange,
      paragraphs,
      payload: { scenes: [scene, { ...scene, fromParagraphId: "p2", toParagraphId: "p3" }] },
    })).toThrow("overlaps a previous scene");
    expect(() => resolveSceneExtractionModelScenes({
      sourceRange,
      paragraphs,
      payload: { scenes: [{ ...scene, fromParagraphId: "missing" }] },
    })).toThrow("invalid paragraph references");
  });
});
