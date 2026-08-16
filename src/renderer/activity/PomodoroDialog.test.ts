import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PomodoroDialog } from "./PomodoroDialog";

describe("PomodoroDialog", () => {
  it("starts unconfigured without inventing numeric settings or music controls", () => {
    const markup = renderToStaticMarkup(
      createElement(PomodoroDialog, {
        error: null,
        onCancel: () => undefined,
        onSubmit: () => undefined,
        settings: null,
        submitting: false,
      }),
    );

    expect(markup).toContain("집중 타이머 설정");
    expect(markup).toContain("작업 시간(분)");
    expect(markup).toContain("휴식 시간(분)");
    expect(markup).toContain("작업 주기");
    expect(markup).toContain("단계 자동 전환");
    expect(markup.match(/value=""/gu)).toHaveLength(4);
    expect(markup).not.toContain("음악");
    expect(markup).not.toContain("완료음");
  });

  it("prefills only the exact Work-owned settings", () => {
    const markup = renderToStaticMarkup(
      createElement(PomodoroDialog, {
        error: null,
        onCancel: () => undefined,
        onSubmit: () => undefined,
        settings: {
          workDurationMs: 7_500,
          breakDurationMs: 3_000,
          workCycleCount: 7,
          autoAdvance: true,
        },
        submitting: false,
      }),
    );

    expect(markup).toContain('value="0.125"');
    expect(markup).toContain('value="0.05"');
    expect(markup).toContain('value="7"');
    expect(markup).toContain('checked=""');
  });
});
