import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ForwardWritingGoalDialog,
} from "./ForwardWritingMode";

describe("ForwardWritingMode", () => {
  it("asks for a caller-owned positive goal without inserting a product default", () => {
    const markup = renderToStaticMarkup(
      createElement(ForwardWritingGoalDialog, {
        onCancel: () => undefined,
        onStart: () => undefined,
      }),
    );

    expect(markup).toContain('aria-label="목표 글자 수"');
    expect(markup).toContain('value=""');
    expect(markup).toContain(
      "일반 원고 편집기에서 기존 본문은 잠그고 그 뒤부터 계속 씁니다.",
    );
  });
});
