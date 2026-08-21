import { describe, expect, it } from "vitest";

import {
  buildCalendarMonth,
  formatDdayDistance,
  formatDdayProgress,
  localDateKey,
} from "./WorkScheduleDashboard";

describe("Work schedule dashboard calendar", () => {
  it("builds a complete six-week month grid and exact storage range", () => {
    const calendar = buildCalendarMonth("2026-08");
    expect(calendar.range).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(calendar.cells).toHaveLength(42);
    expect(calendar.cells[0]).toEqual({
      date: "2026-07-26",
      day: 26,
      inMonth: false,
    });
    expect(calendar.cells[41]?.date).toBe("2026-09-05");
  });

  it("formats local dates and D-DAY distance without timezone inference", () => {
    expect(localDateKey(new Date(2026, 7, 10, 23, 59))).toBe("2026-08-10");
    expect(formatDdayDistance("2026-08-10", "2026-08-10")).toBe("D-DAY");
    expect(formatDdayDistance("2026-08-13", "2026-08-10")).toBe("D-3");
    expect(formatDdayDistance("2026-08-08", "2026-08-10")).toBe("D+2");
  });

  it("derives D-DAY progress from the configured episode character completion", () => {
    const progress = {
      defaultEpisodeCharacters: 4_000,
      totalCharacters: 9_000,
      totalEpisodeCount: 3,
      completedEpisodeCount: 2,
      completedEpisodeNumbers: [1, 3],
    } as const;
    expect(
      formatDdayProgress(
        { mode: "totalCharacters", targetCharacters: 12_000 },
        progress,
      ),
    ).toContain("3,000자 남음");
    expect(
      formatDdayProgress(
        {
          mode: "episodeCount",
          targetEpisodeCount: 2,
          baselineCompletedCount: 1,
        },
        progress,
      ),
    ).toBe("추가 완료 1/2회차 · 1회차 남음");
    expect(
      formatDdayProgress(
        { mode: "episodeNumber", targetEpisodeNumber: 3 },
        progress,
      ),
    ).toBe("완료 2/3회차 · 1회차 남음");
    expect(
      formatDdayProgress(
        {
          mode: "additionalCompletedDocuments",
          targetCount: 10,
          baselineCompletedCount: 5,
        },
        progress,
        8,
      ),
    ).toBe("추가 완료 3/10회차 · 7회차 남음");
    expect(
      formatDdayProgress(
        { mode: "totalCompletedDocuments", targetCount: 20 },
        progress,
        8,
      ),
    ).toBe("완료 8/20회차 · 12회차 남음");
    expect(formatDdayProgress({ mode: "none" }, progress)).toBeNull();
  });
});
