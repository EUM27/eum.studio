import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openNodePublishingMailScheduleStore } from "./node-publishing-mail-schedule-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("node publishing mail schedule store", () => {
  it("restores the user schedule and latest success or failure state", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "eum-mail-schedule-"));
    temporaryDirectories.push(directory);
    const store = await openNodePublishingMailScheduleStore({
      rootDirectoryPath: directory,
    });

    await store.saveSettings({ enabled: true, localTime: "10:00" });
    await store.recordAttempt({
      attemptedAt: "2026-08-10T01:00:00.000Z",
      status: "succeeded",
      successfulAt: "2026-08-10T01:00:02.000Z",
    });
    await store.recordAttempt({
      attemptedAt: "2026-08-11T01:00:00.000Z",
      status: "failed",
      successfulAt: null,
    });

    const reopened = await openNodePublishingMailScheduleStore({
      rootDirectoryPath: directory,
    });
    expect(reopened.readSchedule()).toEqual({
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
      lastAttemptedAt: "2026-08-11T01:00:00.000Z",
      lastSuccessfulAt: "2026-08-10T01:00:02.000Z",
      lastAttemptStatus: "failed",
    });
  });
});
