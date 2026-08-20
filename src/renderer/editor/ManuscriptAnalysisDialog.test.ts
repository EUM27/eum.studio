import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManuscriptAnalysisDialog } from "./ManuscriptAnalysisDialog";

describe("ManuscriptAnalysisDialog", () => {
  it("shows keyword, sentence, and repetition analysis for the exact manuscript", () => {
    const markup = renderToStaticMarkup(
      createElement(ManuscriptAnalysisDialog, {
        documentTitle: "3화",
        manuscript: "별빛 별빛 별빛. 짧은 문장이다!",
        onClose: () => undefined,
      }),
    );

    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("원고 분석");
    expect(markup).toContain("3화");
    expect(markup).toContain("많이 사용한 단어");
    expect(markup).toContain("문장 길이");
    expect(markup).toContain("반복 어휘 밀도");
    expect(markup).toContain("별빛");
  });
});
