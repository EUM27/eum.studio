import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  normalizeSceneBoundaryPreviews,
} from "./scene-boundary-preview-extension";

describe("scene boundary preview extension", () => {
  it("keeps only exact in-document Candidate boundaries in offset order", () => {
    const previews = normalizeSceneBoundaryPreviews([
      {
        boundaryId: "boundary-b",
        offset: 8,
        beforeTitle: "두 번째",
        afterTitle: "세 번째",
      },
      {
        boundaryId: "boundary-a",
        offset: 4,
        beforeTitle: "첫 번째",
        afterTitle: "두 번째",
      },
      {
        boundaryId: "outside",
        offset: 99,
        beforeTitle: "밖",
        afterTitle: "밖",
      },
    ], Text.of(["첫째", "둘째", "셋째"]));

    expect(previews).toEqual([
      expect.objectContaining({ boundaryId: "boundary-a", offset: 4 }),
      expect.objectContaining({ boundaryId: "boundary-b", offset: 8 }),
    ]);
  });
});
