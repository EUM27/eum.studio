import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlotWorkspace } from "./PlotWorkspace";

describe("PlotWorkspace", () => {
  it("keeps the editor-owned event rail out of the plot tabs", () => {
    const markup = renderToStaticMarkup(createElement(PlotWorkspace, {
      board: createElement("p", null, "보드 내용"),
      scenes: createElement("p", null, "장면 내용"),
    }));

    expect(markup).toContain('aria-label="플롯 작업면"');
    expect(markup).toContain(">플롯<");
    expect(markup).not.toContain("사건 레일");
    expect(markup).toContain("장면");
    expect(markup).toContain("보드 내용");
    expect(markup).not.toContain("장면 내용");
  });

  it("renders the selected existing structure surface without duplicating it", () => {
    const sceneMarkup = renderToStaticMarkup(createElement(PlotWorkspace, {
      board: createElement("p", null, "보드 내용"),
      initialTab: "scenes",
      scenes: createElement("p", null, "장면 내용"),
    }));

    expect(sceneMarkup).toContain("장면 내용");
    expect(sceneMarkup).not.toContain("보드 내용");
  });
});
