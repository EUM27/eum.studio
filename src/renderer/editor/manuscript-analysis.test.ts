import { describe, expect, it } from "vitest";

import {
  analyzeManuscriptText,
  classifyRepeatedWord,
  classifySentenceHeatmapLine,
} from "./manuscript-analysis";

describe("manuscript analysis", () => {
  it("derives top words, sentence lengths, and repetition density without changing text", () => {
    const manuscript =
      "별빛 별빛 별빛 아래에서 문장을 쓴다. 짧은 문장이다! 마지막 문장은 조금 더 길게 이어진다?";

    expect(analyzeManuscriptText(manuscript)).toMatchObject({
      summary: expect.stringContaining("별빛"),
      topWords: expect.arrayContaining([{ word: "별빛", count: 3 }]),
      sentences: {
        count: 3,
        minimumLength: expect.any(Number),
        maximumLength: expect.any(Number),
        averageLength: expect.any(Number),
      },
      repetitionDensityPercent: expect.any(Number),
    });
    expect(manuscript).toContain("별빛 별빛 별빛");
  });

  it("uses the supplied source thresholds for sentence and repeated-word heatmaps", () => {
    expect(classifySentenceHeatmapLine("가".repeat(40))).toBeNull();
    expect(classifySentenceHeatmapLine("가".repeat(41))).toBe(
      "manuscript-heatmap-long",
    );
    expect(classifySentenceHeatmapLine("가".repeat(61))).toBe(
      "manuscript-heatmap-very-long",
    );
    expect(classifySentenceHeatmapLine("가".repeat(81))).toBe(
      "manuscript-heatmap-extreme",
    );
    expect(classifyRepeatedWord(2)).toBeNull();
    expect(classifyRepeatedWord(3)).toBe("repeated");
    expect(classifyRepeatedWord(6)).toBe("dense");
  });
});
