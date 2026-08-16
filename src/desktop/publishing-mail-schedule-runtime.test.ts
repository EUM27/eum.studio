import { describe, expect, it, vi } from "vitest";

import {
  parsePublishingMailScheduleProjection,
  type PublishingMailScheduleProjection,
} from "../application/publishing/publishing-mail-schedule-contract";
import { createPublishingMailScheduleRuntime } from "./publishing-mail-schedule-runtime";

function scheduleState(input?: Partial<PublishingMailScheduleProjection>) {
  return parsePublishingMailScheduleProjection({
    schemaVersion: 1,
    enabled: true,
    localTime: "10:00",
    lastAttemptedAt: null,
    lastSuccessfulAt: null,
    lastAttemptStatus: null,
    ...input,
  });
}

describe("publishing mail schedule runtime", () => {
  it("runs one due sync while the app is open and arms the next exact local time", async () => {
    let state = scheduleState();
    let now = new Date(2026, 7, 10, 10, 5);
    const timers: Array<{ readonly handler: () => void; readonly delay: number }> = [];
    const sync = vi.fn(async () => ({
      schemaVersion: 1 as const,
      discoveredCount: 1,
      newCandidateCount: 1,
      syncedAt: new Date(2026, 7, 10, 10, 5, 2).toISOString(),
    }));
    const runtime = createPublishingMailScheduleRuntime({
      readSchedule: () => state,
      saveSettings: async (value) => {
        state = scheduleState({ ...state, ...value });
        return state;
      },
      recordAttempt: async (value) => {
        state = scheduleState({
          ...state,
          lastAttemptedAt: value.attemptedAt,
          lastSuccessfulAt: value.status === "succeeded"
            ? value.successfulAt
            : state.lastSuccessfulAt,
          lastAttemptStatus: value.status,
        });
        return state;
      },
      isConnected: () => true,
      sync,
      now: () => now,
      setTimer: (handler, delay) => {
        timers.push({ handler, delay });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });

    runtime.reconcile();
    expect(timers[0]?.delay).toBe(0);
    const dueHandler = timers[0]?.handler;
    expect(dueHandler).toBeDefined();
    dueHandler?.();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(state.lastAttemptStatus).toBe("succeeded"));

    now = new Date(2026, 7, 10, 10, 6);
    runtime.reconcile();
    expect(timers.at(-1)?.delay).toBe(
      new Date(2026, 7, 11, 10, 0).getTime() - now.getTime(),
    );
    runtime.close();
  });

  it("persists a failed manual attempt and rethrows it to the caller", async () => {
    let state = scheduleState({ enabled: false, localTime: null });
    const runtime = createPublishingMailScheduleRuntime({
      readSchedule: () => state,
      saveSettings: async () => state,
      recordAttempt: async (value) => {
        state = scheduleState({
          ...state,
          lastAttemptedAt: value.attemptedAt,
          lastAttemptStatus: value.status,
        });
        return state;
      },
      isConnected: () => true,
      sync: async () => { throw new Error("mail unavailable"); },
      now: () => new Date("2026-08-10T10:05:00.000Z"),
    });

    await expect(runtime.sync({ schemaVersion: 1 })).rejects.toThrow("mail unavailable");
    expect(state.lastAttemptedAt).toBe("2026-08-10T10:05:00.000Z");
    expect(state.lastAttemptStatus).toBe("failed");
    runtime.close();
  });
});
