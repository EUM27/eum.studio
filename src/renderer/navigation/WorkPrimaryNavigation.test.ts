import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkPrimaryNavigation } from "./WorkPrimaryNavigation";

describe("WorkPrimaryNavigation", () => {
  it("shows the four approved work actions in one stable navigation", () => {
    const markup = renderToStaticMarkup(createElement(WorkPrimaryNavigation, {
      activeSection: "structure",
      onChange: () => undefined,
    }));

    expect(markup).toContain('aria-label="작품 작업면"');
    expect(markup).toContain(">쓰기<");
    expect(markup).toContain(">구조<");
    expect(markup).toContain(">검토<");
    expect(markup).toContain(">운영<");
    expect(markup).toContain('aria-current="page"');
  });
});
