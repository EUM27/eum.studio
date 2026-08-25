import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { PomodoroProjection } from "../../../application/activity/pomodoro-contract";
import type { WorkActivityProjection } from "../../../application/activity/work-activity-contract";
import type { WorkReadthroughProjection } from "../../../application/activity/work-readthrough-calculator";
import type { WorkRecordsGoalsProjection } from "../../../application/activity/work-records-preferences";
import { entityId } from "../../../domain/writing";
import type { ActivityWorkBundleClient } from "./activity-client";
import { loadActivityWorkBundle } from "./activity-controller";

const workId = entityId<"Work">("work-activity-loader");

const activity = Object.freeze({
  schemaVersion: 1,
  workId,
  activeSessionId: null,
  activeFocusCycleId: null,
  sessions: Object.freeze([]),
  focusCycles: Object.freeze([]),
}) satisfies WorkActivityProjection;

const pomodoro = Object.freeze({
  schemaVersion: 1,
  workId,
  settings: null,
  status: "unconfigured",
  completedWorkCycles: 0,
  activePhase: null,
}) satisfies PomodoroProjection;

const goals = Object.freeze({
  schemaVersion: 1,
  workId,
  revision: 0,
  goals: Object.freeze({
    dailyActiveMinutes: null,
    dailyCharacters: null,
    weeklyActiveMinutes: null,
    weeklyCharacters: null,
  }),
}) satisfies WorkRecordsGoalsProjection;

const readthrough = Object.freeze({
  schemaVersion: 1,
  workId,
  revision: 0,
  entries: Object.freeze([]),
}) satisfies WorkReadthroughProjection;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("activity Work bundle loader", () => {
  it("calls the exact four queries once in order and returns their tuple identities", async () => {
    const order: string[] = [];
    const listWork = vi.fn(async () => {
      order.push("listWork");
      return activity;
    });
    const getPomodoro = vi.fn(async () => {
      order.push("getPomodoro");
      return pomodoro;
    });
    const getRecordsGoals = vi.fn(async () => {
      order.push("getRecordsGoals");
      return goals;
    });
    const getReadthrough = vi.fn(async () => {
      order.push("getReadthrough");
      return readthrough;
    });
    const client: ActivityWorkBundleClient = {
      listWork,
      getPomodoro,
      getRecordsGoals,
      getReadthrough,
    };

    const result = await loadActivityWorkBundle(client, workId);
    expect(order).toEqual([
      "listWork",
      "getPomodoro",
      "getRecordsGoals",
      "getReadthrough",
    ]);
    expect(result).toEqual([activity, pomodoro, goals, readthrough]);
    expect(result[0]).toBe(activity);
    expect(result[1]).toBe(pomodoro);
    expect(result[2]).toBe(goals);
    expect(result[3]).toBe(readthrough);
    for (const query of [
      listWork,
      getPomodoro,
      getRecordsGoals,
      getReadthrough,
    ]) {
      expect(query).toHaveBeenCalledOnce();
      expect(query).toHaveBeenCalledWith({ schemaVersion: 1, workId });
    }
  });

  it("remains pending until all four queries settle", async () => {
    const activityRead = deferred<WorkActivityProjection>();
    const pomodoroRead = deferred<PomodoroProjection>();
    const goalsRead = deferred<WorkRecordsGoalsProjection>();
    const readthroughRead = deferred<WorkReadthroughProjection>();
    const promise = loadActivityWorkBundle({
      listWork: vi.fn(() => activityRead.promise),
      getPomodoro: vi.fn(() => pomodoroRead.promise),
      getRecordsGoals: vi.fn(() => goalsRead.promise),
      getReadthrough: vi.fn(() => readthroughRead.promise),
    }, workId);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    activityRead.resolve(activity);
    pomodoroRead.resolve(pomodoro);
    goalsRead.resolve(goals);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    readthroughRead.resolve(readthrough);
    await expect(promise).resolves.toEqual([
      activity,
      pomodoro,
      goals,
      readthrough,
    ]);
  });

  it("rejects the whole load after one failure without retry or partial result", async () => {
    const listWork = vi.fn(async () => activity);
    const getPomodoro = vi.fn(async () => pomodoro);
    const getRecordsGoals = vi.fn(() =>
      Promise.reject(new Error("goals failed"))
    );
    const getReadthrough = vi.fn(async () => readthrough);
    await expect(loadActivityWorkBundle({
      listWork,
      getPomodoro,
      getRecordsGoals,
      getReadthrough,
    }, workId)).rejects.toThrow("goals failed");
    expect(listWork).toHaveBeenCalledOnce();
    expect(getPomodoro).toHaveBeenCalledOnce();
    expect(getRecordsGoals).toHaveBeenCalledOnce();
    expect(getReadthrough).toHaveBeenCalledOnce();
  });

  it("keeps the loader pure while the activity slice owns state and UI hosts own rendering", () => {
    const appSource = readFileSync(
      new URL("../../App.tsx", import.meta.url),
      "utf8",
    );
    const controllerSource = readFileSync(
      new URL("./activity-controller.ts", import.meta.url),
      "utf8",
    );
    const clientSource = readFileSync(
      new URL("./activity-client.ts", import.meta.url),
      "utf8",
    );
    const hookSource = readFileSync(
      new URL("./useActivityController.ts", import.meta.url),
      "utf8",
    );
    const coreSource = readFileSync(
      new URL("../../workspace/useWorkspaceCoreFeatureKernel.ts", import.meta.url),
      "utf8",
    );
    const dialogHostSource = readFileSync(
      new URL("../../workspace/dialogs/WorkspaceDialogHost.tsx", import.meta.url),
      "utf8",
    );
    const statusHostSource = readFileSync(
      new URL("../../workspace/WorkspaceStatusToolsHost.tsx", import.meta.url),
      "utf8",
    );
    expect(controllerSource).not.toContain("window.");
    expect(controllerSource).not.toContain("react");
    expect(controllerSource).not.toContain("retry");
    expect(controllerSource).not.toContain("catch");
    expect(controllerSource).not.toMatch(
      /startSession|stopSession|configureAndStartPomodoro|pausePomodoro|resumePomodoro|completePomodoro/u,
    );
    expect(clientSource).not.toContain("window.");
    expect(coreSource.match(/useActivityController\(/gu)).toHaveLength(1);
    expect(hookSource).toContain("window.setTimeout");
    expect(hookSource).toContain("window.clearTimeout");
    expect(hookSource).toContain("let disposed = false");
    expect(hookSource).toContain(
      "loadActivityWorkBundle(input.client, input.activeWorkId)",
    );
    expect(hookSource).toContain("setWorkActivity(activityProjection)");
    expect(hookSource).toContain("setPomodoro(pomodoroProjection)");
    expect(hookSource).toContain("setDailyGoals(goalsProjection)");
    expect(hookSource).toContain(
      "setReadthroughSettings(readthroughProjection)",
    );
    expect(hookSource).toContain("집필 기록 설정을 불러오지 못했습니다.");
    expect(hookSource).toContain(
      "작업 기록과 집중 타이머를 불러오지 못했습니다.",
    );
    expect(hookSource).toContain("const configureAndStartPomodoro = useCallback(");
    expect(hookSource).toContain("const pausePomodoro = useCallback(");
    expect(hookSource).toContain("const resumePomodoro = useCallback(");
    expect(hookSource).toContain("const stopPomodoro = useCallback(");
    expect(appSource).not.toMatch(/window\.eumStudio\.activity\.[A-Za-z]+\(/u);
    expect(dialogHostSource).toContain("<PomodoroDialog");
    expect(statusHostSource).toContain("<SessionFeedbackWithTelemetry");
  });
});
