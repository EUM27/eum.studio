import { describe, expect, it } from "vitest";

import {
  getNextPublishingMailScheduleAt,
  isPublishingMailScheduleDue,
  parsePublishingMailScheduleProjection,
  parseSavePublishingMailScheduleCommand,
} from "./publishing-mail-schedule-contract";

describe("publishing mail schedule contract", () => {
  it("keeps one user-configured local time and persisted attempt state", () => {
    expect(parseSavePublishingMailScheduleCommand({
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
    })).toEqual({ schemaVersion: 1, enabled: true, localTime: "10:00" });

    expect(parsePublishingMailScheduleProjection({
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
      lastAttemptedAt: "2026-08-10T01:05:00.000Z",
      lastSuccessfulAt: null,
      lastAttemptStatus: "failed",
    })).toEqual({
      schemaVersion: 1,
      enabled: true,
      localTime: "10:00",
      lastAttemptedAt: "2026-08-10T01:05:00.000Z",
      lastSuccessfulAt: null,
      lastAttemptStatus: "failed",
    });
  });

  it("runs once after the local time and calculates the next timer without polling", () => {
    const before = new Date(2026, 7, 10, 9, 59).toISOString();
    const after = new Date(2026, 7, 10, 10, 1).toISOString();
    const now = new Date(2026, 7, 10, 10, 5).getTime();
    const projection = (lastAttemptedAt: string | null) =>
      parsePublishingMailScheduleProjection({
        schemaVersion: 1,
        enabled: true,
        localTime: "10:00",
        lastAttemptedAt,
        lastSuccessfulAt: null,
        lastAttemptStatus: lastAttemptedAt === null ? null : "succeeded",
      });

    expect(isPublishingMailScheduleDue(projection(before), now)).toBe(true);
    expect(isPublishingMailScheduleDue(projection(after), now)).toBe(false);
    expect(getNextPublishingMailScheduleAt(projection(after), now)).toBe(
      new Date(2026, 7, 11, 10, 0).getTime(),
    );
  });
});
