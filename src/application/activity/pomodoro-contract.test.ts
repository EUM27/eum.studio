import { randomInt, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createPomodoroPolicyPlan,
  parseConfigureAndStartPomodoroCommand,
  parsePomodoroPolicyPlan,
  parsePomodoroProjection,
  serializePomodoroPolicyPlan,
} from "./pomodoro-contract";

describe("Pomodoro contract", () => {
  it("accepts caller-owned durations and cycle counts without product defaults or clamps", () => {
    const workDurationMs = randomInt(1, 50_000);
    const breakDurationMs = randomInt(1, 50_000);
    const workCycleCount = randomInt(1, 20);
    const command = parseConfigureAndStartPomodoroCommand({
      schemaVersion: 1,
      workId: randomUUID(),
      documentId: randomUUID(),
      workDurationMs,
      breakDurationMs,
      workCycleCount,
      autoAdvance: true,
      note: "사용자가 정한 흐름",
    });

    expect(command).toMatchObject({
      workDurationMs,
      breakDurationMs,
      workCycleCount,
      autoAdvance: true,
    });
    expect(() =>
      parseConfigureAndStartPomodoroCommand({
        ...command,
        workDurationMs: 0,
      }),
    ).toThrow(/workDurationMs/u);
    expect(() =>
      parseConfigureAndStartPomodoroCommand({
        ...command,
        unexpected: true,
      }),
    ).toThrow(/fields/u);
  });

  it("round-trips one alternating Work-owned policy with unique caller-generated phase refs", () => {
    const settings = {
      workDurationMs: randomInt(1, 50_000),
      breakDurationMs: randomInt(1, 50_000),
      workCycleCount: randomInt(2, 8),
      autoAdvance: false,
    } as const;
    const plan = createPomodoroPolicyPlan(settings, () => randomUUID());
    const parsed = parsePomodoroPolicyPlan({
      phaseDefinitionsJson: serializePomodoroPolicyPlan(plan),
      completionPolicy: "manual",
    });

    expect(parsed?.settings).toEqual(settings);
    expect(parsed?.phases).toHaveLength(2);
    expect(parsed?.phases[0]).toMatchObject({ phase: "work" });
    expect(parsed?.phases[1]).toMatchObject({ phase: "break" });
    expect(new Set(parsed?.phases.map((phase) => phase.phaseRef)).size).toBe(
      parsed?.phases.length,
    );

    const singleCycleSettings = {
      workDurationMs: randomInt(1, 50_000),
      breakDurationMs: randomInt(50_001, 100_000),
      workCycleCount: 1,
      autoAdvance: true,
    } as const;
    const singleCyclePlan = createPomodoroPolicyPlan(
      singleCycleSettings,
      () => randomUUID(),
    );
    expect(
      parsePomodoroPolicyPlan({
        phaseDefinitionsJson: serializePomodoroPolicyPlan(singleCyclePlan),
        completionPolicy: "auto-advance",
      })?.settings,
    ).toEqual(singleCycleSettings);
  });

  it("rejects ambiguous policy sequences instead of inferring a fallback", () => {
    const phaseRef = randomUUID();
    const settings = {
      workDurationMs: 1_000,
      breakDurationMs: 500,
      workCycleCount: 2,
      autoAdvance: true,
    } as const;
    expect(() =>
      parsePomodoroPolicyPlan({
        phaseDefinitionsJson: JSON.stringify([
          { schemaVersion: 1, kind: "pomodoro", settings },
          {
            phaseRef,
            phase: "work",
            targetDurationMs: 1_000,
          },
          {
            phaseRef,
            phase: "break",
            targetDurationMs: 500,
          },
        ]),
        completionPolicy: "auto-advance",
      }),
    ).toThrow(/phaseRef/u);
    expect(() =>
      parsePomodoroPolicyPlan({
        phaseDefinitionsJson: JSON.stringify([
          {
            schemaVersion: 1,
            kind: "pomodoro",
            settings: { ...settings, autoAdvance: false },
          },
          {
            phaseRef: randomUUID(),
            phase: "break",
            targetDurationMs: 500,
          },
          {
            phaseRef: randomUUID(),
            phase: "work",
            targetDurationMs: 1_000,
          },
        ]),
        completionPolicy: "manual",
      }),
    ).toThrow(/work before break/u);
  });

  it("parses a paused projection without accepting manuscript, file, clock, or music fields", () => {
    const workId = randomUUID();
    const projection = {
      schemaVersion: 1,
      workId,
      settings: {
        workDurationMs: 7_321,
        breakDurationMs: 2_345,
        workCycleCount: 3,
        autoAdvance: false,
      },
      status: "paused",
      completedWorkCycles: 1,
      activePhase: {
        focusCycleId: randomUUID(),
        state: "paused",
        phase: "break",
        cycleNumber: 1,
        targetDurationMs: 2_345,
        remainingDurationMs: 1_234,
        startedAt: new Date().toISOString(),
        deadlineAt: null,
        pauseReason: "manual",
        note: "잠깐 멈춤",
      },
    } as const;

    expect(parsePomodoroProjection(projection)).toEqual(projection);
    expect(() =>
      parsePomodoroProjection({
        ...projection,
        manuscript: "원문",
      }),
    ).toThrow(/fields/u);
  });
});
