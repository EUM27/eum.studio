import {
  getNextPublishingMailScheduleAt,
  isPublishingMailScheduleDue,
  parseGetPublishingMailScheduleCommand,
  parseSavePublishingMailScheduleCommand,
  type PublishingMailScheduleProjection,
} from "../application/publishing/publishing-mail-schedule-contract";
import type { PublishingMailSyncResult } from "../application/publishing/publishing-mail-connection-contract";

type TimerHandle = ReturnType<typeof setTimeout>;

export function createPublishingMailScheduleRuntime(input: {
  readonly readSchedule: () => PublishingMailScheduleProjection;
  readonly saveSettings: (value: {
    readonly enabled: boolean;
    readonly localTime: string | null;
  }) => Promise<PublishingMailScheduleProjection>;
  readonly recordAttempt: (value: {
    readonly attemptedAt: string;
    readonly status: "succeeded" | "failed";
    readonly successfulAt: string | null;
  }) => Promise<PublishingMailScheduleProjection>;
  readonly isConnected: () => boolean;
  readonly sync: (value: unknown) => Promise<PublishingMailSyncResult>;
  readonly now?: () => Date;
  readonly setTimer?: (handler: () => void, delayMilliseconds: number) => TimerHandle;
  readonly clearTimer?: (handle: TimerHandle) => void;
}): {
  status(value: unknown): Promise<PublishingMailScheduleProjection>;
  save(value: unknown): Promise<PublishingMailScheduleProjection>;
  sync(value: unknown): Promise<PublishingMailSyncResult>;
  runDueIfNeeded(): Promise<void>;
  reconcile(): void;
  close(): void;
} {
  const now = input.now ?? (() => new Date());
  const setTimer = input.setTimer ?? ((handler, delay) => setTimeout(handler, delay));
  const clearTimer = input.clearTimer ?? ((handle) => clearTimeout(handle));
  let timer: TimerHandle | null = null;
  let closed = false;
  let syncInProgress = false;

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function reconcile(): void {
    cancelTimer();
    if (closed || syncInProgress || !input.isConnected()) return;
    const current = now().getTime();
    const next = getNextPublishingMailScheduleAt(input.readSchedule(), current);
    if (next === null) return;
    timer = setTimer(() => {
      timer = null;
      void runDueIfNeeded();
    }, Math.max(0, next - current));
  }

  async function performSync(
    value: unknown,
    rethrowFailure: boolean,
  ): Promise<PublishingMailSyncResult | null> {
    cancelTimer();
    syncInProgress = true;
    const attemptedAt = now().toISOString();
    try {
      const result = await input.sync(value);
      await input.recordAttempt({
        attemptedAt,
        status: "succeeded",
        successfulAt: result.syncedAt,
      });
      return result;
    } catch (reason) {
      await input.recordAttempt({
        attemptedAt,
        status: "failed",
        successfulAt: null,
      });
      if (rethrowFailure) throw reason;
      return null;
    } finally {
      syncInProgress = false;
      reconcile();
    }
  }

  async function runDueIfNeeded(): Promise<void> {
    if (
      closed ||
      syncInProgress ||
      !input.isConnected() ||
      !isPublishingMailScheduleDue(input.readSchedule(), now().getTime())
    ) {
      reconcile();
      return;
    }
    await performSync({ schemaVersion: 1 }, false);
  }

  return Object.freeze({
    async status(value) {
      parseGetPublishingMailScheduleCommand(value);
      return input.readSchedule();
    },
    async save(value) {
      const command = parseSavePublishingMailScheduleCommand(value);
      await input.saveSettings({
        enabled: command.enabled,
        localTime: command.localTime,
      });
      await runDueIfNeeded();
      return input.readSchedule();
    },
    async sync(value) {
      const result = await performSync(value, true);
      if (result === null) throw new Error("Publishing mail sync returned no result");
      return result;
    },
    runDueIfNeeded,
    reconcile,
    close() {
      closed = true;
      cancelTimer();
    },
  });
}
