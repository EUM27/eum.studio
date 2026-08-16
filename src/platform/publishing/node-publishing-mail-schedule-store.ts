import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parsePublishingMailScheduleProjection,
  type PublishingMailScheduleAttemptStatus,
  type PublishingMailScheduleProjection,
} from "../../application/publishing/publishing-mail-schedule-contract";

export type PublishingMailScheduleStore = {
  readSchedule(): PublishingMailScheduleProjection;
  saveSettings(value: {
    readonly enabled: boolean;
    readonly localTime: string | null;
  }): Promise<PublishingMailScheduleProjection>;
  recordAttempt(value: {
    readonly attemptedAt: string;
    readonly status: Exclude<PublishingMailScheduleAttemptStatus, null>;
    readonly successfulAt: string | null;
  }): Promise<PublishingMailScheduleProjection>;
};

const DEFAULT_SCHEDULE = parsePublishingMailScheduleProjection({
  schemaVersion: 1,
  enabled: false,
  localTime: null,
  lastAttemptedAt: null,
  lastSuccessfulAt: null,
  lastAttemptStatus: null,
});

class NodePublishingMailScheduleStore implements PublishingMailScheduleStore {
  readonly #filePath: string;
  #state: PublishingMailScheduleProjection;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(input: {
    readonly filePath: string;
    readonly initialState: PublishingMailScheduleProjection;
  }) {
    this.#filePath = input.filePath;
    this.#state = input.initialState;
  }

  readSchedule(): PublishingMailScheduleProjection {
    return this.#state;
  }

  saveSettings(value: {
    readonly enabled: boolean;
    readonly localTime: string | null;
  }): Promise<PublishingMailScheduleProjection> {
    return this.#serialize(async () => this.#publish(
      parsePublishingMailScheduleProjection({
        ...this.#state,
        enabled: value.enabled,
        localTime: value.localTime,
      }),
    ));
  }

  recordAttempt(value: {
    readonly attemptedAt: string;
    readonly status: Exclude<PublishingMailScheduleAttemptStatus, null>;
    readonly successfulAt: string | null;
  }): Promise<PublishingMailScheduleProjection> {
    return this.#serialize(async () => this.#publish(
      parsePublishingMailScheduleProjection({
        ...this.#state,
        lastAttemptedAt: value.attemptedAt,
        lastSuccessfulAt:
          value.status === "succeeded"
            ? value.successfulAt
            : this.#state.lastSuccessfulAt,
        lastAttemptStatus: value.status,
      }),
    ));
  }

  #serialize(
    operation: () => Promise<PublishingMailScheduleProjection>,
  ): Promise<PublishingMailScheduleProjection> {
    let result: PublishingMailScheduleProjection | null = null;
    const queued = this.#writeQueue.then(async () => {
      result = await operation();
    });
    this.#writeQueue = queued.then(() => undefined, () => undefined);
    return queued.then(() => {
      if (result === null) throw new Error("Publishing mail schedule write produced no result");
      return result;
    });
  }

  async #publish(
    next: PublishingMailScheduleProjection,
  ): Promise<PublishingMailScheduleProjection> {
    const temporaryPath = `${this.#filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(next)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#filePath);
      this.#state = next;
      return next;
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
}

export async function openNodePublishingMailScheduleStore(input: {
  readonly rootDirectoryPath: string;
}): Promise<PublishingMailScheduleStore> {
  if (!path.isAbsolute(input.rootDirectoryPath)) {
    throw new Error("Publishing mail schedule rootDirectoryPath must be absolute");
  }
  await mkdir(input.rootDirectoryPath, { recursive: true });
  const filePath = path.join(input.rootDirectoryPath, "schedule.json");
  let initialState = DEFAULT_SCHEDULE;
  try {
    initialState = parsePublishingMailScheduleProjection(
      JSON.parse(await readFile(filePath, "utf8")),
    );
  } catch (reason) {
    if (!(reason instanceof Error) || !("code" in reason) || reason.code !== "ENOENT") {
      throw reason;
    }
  }
  return new NodePublishingMailScheduleStore({ filePath, initialState });
}
