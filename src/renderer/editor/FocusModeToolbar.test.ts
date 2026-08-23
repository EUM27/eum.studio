import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FocusModeToolbar } from "./FocusModeToolbar";

describe("FocusModeToolbar", () => {
  it("keeps the focus controls and exit path keyboard-discoverable", () => {
    const markup = renderToStaticMarkup(
      createElement(FocusModeToolbar, {
        contentWidthPx: 700,
        currentBlockHighlight: true,
        currentDocumentCharacterCount: 1_234,
        pomodoroPhase: "break",
        pomodoroStatus: "휴식 2/5 · 완료 2회",
        saveStatus: "저장됨",
        timerStatus: "04:12",
        typewriterMode: false,
        typewriterPositionPercent: 40,
        zoomPercent: 110,
        onContentWidthChange: () => undefined,
        onCurrentBlockHighlightChange: () => undefined,
        onExit: () => undefined,
        onTypewriterModeChange: () => undefined,
        onTypewriterPositionChange: () => undefined,
        onZoomChange: () => undefined,
      }),
    );

    expect(markup).toContain('aria-label="집중 화면 도구"');
    expect(markup).toContain('aria-label="집중 화면 도구 위치 이동"');
    expect(markup).toContain('aria-label="현재 집중 상태"');
    expect(markup).toContain('data-pomodoro-phase="break"');
    expect(markup).toContain('data-testid="focus-pomodoro-status"');
    expect(markup).toContain('aria-label="집중 화면 원고 폭"');
    expect(markup).toContain('aria-label="집중 화면 축소"');
    expect(markup).toContain('aria-label="집중 화면 확대"');
    expect(markup).toContain('aria-label="집중 화면 종료"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("현재 문단");
    expect(markup).toContain("타자기");
    expect(markup).toContain("휴식 모드");
    expect(markup).toContain("휴식 2/5 · 완료 2회");
    expect(markup).toContain("04:12");
    expect(markup).toContain("현재 회차 1234자");
    expect(markup).toContain('aria-label="현재 문서 글자 수"');
    expect(markup).toContain("저장됨");
  });

  it("shows forward-writing progress in the existing focus status surface", () => {
    const markup = renderToStaticMarkup(
      createElement(FocusModeToolbar, {
        contentWidthPx: 700,
        currentBlockHighlight: false,
        currentDocumentCharacterCount: 660,
        exitLabel: "수정금지 종료",
        modeLabel: "수정금지 집필",
        modeStatus: "목표까지 660자",
        pomodoroPhase: "work",
        pomodoroStatus: "작업 1/5 · 완료 0회",
        saveStatus: "저장됨",
        timerStatus: "24:27",
        typewriterMode: true,
        typewriterPositionPercent: 35,
        zoomPercent: 100,
        onContentWidthChange: () => undefined,
        onCurrentBlockHighlightChange: () => undefined,
        onExit: () => undefined,
        onTypewriterModeChange: () => undefined,
        onTypewriterPositionChange: () => undefined,
        onZoomChange: () => undefined,
      }),
    );

    expect(markup).toContain("수정금지 집필");
    expect(markup).toContain("목표까지 660자");
    expect(markup).toContain("현재 회차 660자");
    expect(markup).toContain("작업 모드 · 작업 1/5 · 완료 0회");
    expect(markup).toContain('aria-label="수정금지 종료"');
    expect(markup).toContain('aria-label="타자기 위치"');
    expect(markup).toContain("35%");
  });
});
