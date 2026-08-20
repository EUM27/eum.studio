import { describe, expect, it } from "vitest";

import { resolveManuscriptContextSelection } from "./ManuscriptEditor";

describe("resolveManuscriptContextSelection", () => {
  it("preserves an exact selection when the manuscript is right-clicked inside it", () => {
    expect(resolveManuscriptContextSelection(
      { anchor: 14, head: 5, from: 5, to: 14 },
      9,
    )).toEqual({ anchor: 14, head: 5 });
  });

  it("moves the cursor to an unselected right-click position", () => {
    expect(resolveManuscriptContextSelection(
      { anchor: 5, head: 14, from: 5, to: 14 },
      18,
    )).toEqual({ anchor: 18, head: 18 });
  });
});
