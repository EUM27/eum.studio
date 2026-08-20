import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parsePomodoroProjection } from "../../application/activity/pomodoro-contract";
import { entityId } from "../../domain/writing";
import {
  derivePomodoroPhaseAlert,
  PomodoroPhaseAlert,
} from "./PomodoroPhaseAlert";

const shellStyles = readFileSync(
  new URL("../shell/studio-app-shell.css", import.meta.url),
  "utf8",
);

function projection(input: {
  readonly phase: "work" | "break";
  readonly cycleNumber: number;
  readonly completedWorkCycles: number;
  readonly workId: string;
}) {
  return parsePomodoroProjection({
    schemaVersion: 1,
    workId: input.workId,
    settings: {
      workDurationMs: 1_500,
      breakDurationMs: 500,
      workCycleCount: 4,
      autoAdvance: false,
    },
    status: "paused",
    completedWorkCycles: input.completedWorkCycles,
    activePhase: {
      focusCycleId: randomUUID(),
      state: "paused",
      phase: input.phase,
      cycleNumber: input.cycleNumber,
      targetDurationMs: input.phase === "work" ? 1_500 : 500,
      remainingDurationMs: input.phase === "work" ? 1_500 : 500,
      startedAt: new Date().toISOString(),
      deadlineAt: null,
      pauseReason: "phase-complete",
      note: "",
    },
  });
}

describe("PomodoroPhaseAlert", () => {
  it("describes work-to-break and break-to-work transitions with completed counts", () => {
    const workId = randomUUID();
    const work = projection({
      workId,
      phase: "work",
      cycleNumber: 1,
      completedWorkCycles: 0,
    });
    const rest = projection({
      workId,
      phase: "break",
      cycleNumber: 1,
      completedWorkCycles: 1,
    });
    const nextWork = projection({
      workId,
      phase: "work",
      cycleNumber: 2,
      completedWorkCycles: 1,
    });

    expect(derivePomodoroPhaseAlert(work, rest)).toMatchObject({
      phase: "break",
      title: "휴식 시간입니다",
      message: "작업 1/4회 완료 · 1번째 휴식을 시작하세요.",
    });
    expect(derivePomodoroPhaseAlert(rest, nextWork)).toMatchObject({
      phase: "work",
      title: "작업을 재개할 시간입니다",
      message: "작업 1/4회 완료 · 2번째 작업을 시작하세요.",
    });
    expect(derivePomodoroPhaseAlert(work, work)).toBeNull();
  });

  it("renders a dismissible in-app phase alert", () => {
    const alert = Object.freeze({
      alertId: randomUUID(),
      workId: entityId<"Work">(randomUUID()),
      phase: "break" as const,
      title: "휴식 시간입니다",
      message: "작업 1/4회 완료 · 1번째 휴식을 시작하세요.",
    });
    const markup = renderToStaticMarkup(
      createElement(PomodoroPhaseAlert, {
        alert,
        onDismiss: () => undefined,
      }),
    );

    expect(markup).toContain('aria-label="집중 단계 알림"');
    expect(markup).toContain('data-pomodoro-phase="break"');
    expect(markup).toContain("휴식 시간입니다");
    expect(markup).toContain("작업 1/4회 완료");
    expect(markup).toContain('aria-label="집중 단계 알림 닫기"');
  });

  it("uses the theme point color for work and green for breaks", () => {
    expect(shellStyles).toMatch(
      /data-pomodoro-phase="work"[\s\S]*--pomodoro-phase-color:\s*var\(--eum-accent\)/u,
    );
    expect(shellStyles).toMatch(
      /data-pomodoro-phase="break"[\s\S]*--pomodoro-phase-color:\s*#2f9e61/u,
    );
    expect(shellStyles).toContain(
      "background: var(--pomodoro-phase-color) !important",
    );
  });
});
