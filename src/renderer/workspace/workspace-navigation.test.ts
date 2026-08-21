import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StructureWorkspace } from "./StructureWorkspace";
import { ReviewWorkspace } from "./ReviewWorkspace";

describe("work workspace navigation", () => {
  it("places every approved structure object under Structure", () => {
    const markup = renderToStaticMarkup(createElement(StructureWorkspace, {
      activeTab: "overview",
      onTabChange: () => undefined,
      panels: {
        overview: "개요 내용",
        plots: null,
        events: null,
        scenes: null,
        characters: null,
        foreshadow: null,
        lore: null,
      },
    }));
    for (const label of ["개요", "플롯", "사건", "장면", "인물", "복선", "별빛"]) {
      expect(markup).toContain(`>${label}<`);
    }
  });

  it("places records, manuscript checks, candidates, and versions under Review", () => {
    const markup = renderToStaticMarkup(createElement(ReviewWorkspace, {
      activeTab: "records",
      onTabChange: () => undefined,
      panels: {
        records: "기록 내용",
        manuscript: null,
        candidates: null,
        versions: null,
      },
    }));
    for (const label of ["집필 기록", "원고 점검", "후보 검토함", "버전"]) {
      expect(markup).toContain(`>${label}<`);
    }
  });
});
