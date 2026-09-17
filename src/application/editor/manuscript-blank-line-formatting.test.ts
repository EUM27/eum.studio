import { describe, expect, it } from "vitest";

import { formatManuscriptBlankLines } from "./manuscript-blank-line-formatting";

describe("formatManuscriptBlankLines", () => {
  it("sets exactly one or two blank lines between manuscript lines", () => {
    expect(formatManuscriptBlankLines("첫 줄\n둘째 줄", 1)).toBe(
      "첫 줄\n\n둘째 줄",
    );
    expect(
      formatManuscriptBlankLines("첫 줄\n\n둘째 줄\n \n\n셋째 줄", 2),
    ).toBe("첫 줄\n\n\n둘째 줄\n\n\n셋째 줄");
  });

  it("removes blank and whitespace-only lines without changing line content", () => {
    expect(
      formatManuscriptBlankLines("\n  첫 줄  \n\t\n\t둘째 줄\n\n", 0),
    ).toBe("  첫 줄  \n\t둘째 줄");
  });

  it("is idempotent for each requested blank-line count", () => {
    for (const count of [0, 1, 2] as const) {
      const formatted = formatManuscriptBlankLines("첫 줄\n\n\n둘째 줄", count);
      expect(formatManuscriptBlankLines(formatted, count)).toBe(formatted);
    }
  });
});
