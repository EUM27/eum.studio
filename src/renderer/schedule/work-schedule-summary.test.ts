import { describe, expect, it } from "vitest";

import type { WorkCalendarProjection } from "../../application/schedule/work-calendar-contract";
import { entityId } from "../../domain/writing";
import { deriveWorkScheduleSummary } from "./work-schedule-summary";

describe("deriveWorkScheduleSummary", () => {
  it("projects today's open count and the nearest D-DAY from one Work schedule", () => {
    const workId = entityId<"Work">("work-1");
    const projection: WorkCalendarProjection = {
      schemaVersion: 1,
      workId,
      range: { from: "2026-08-21", to: "2026-08-21" },
      items: [
        {
          schemaVersion: 1,
          itemId: entityId<"WorkScheduleItem">("dday-later"),
          workId,
          revision: 1,
          kind: "dday",
          label: "나중 마감",
          date: "2026-09-10",
          time: null,
          workload: { mode: "none" },
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
        {
          schemaVersion: 1,
          itemId: entityId<"WorkScheduleItem">("dday-nearest"),
          workId,
          revision: 1,
          kind: "dday",
          label: "가까운 마감",
          date: "2026-08-24",
          time: null,
          workload: { mode: "none" },
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      occurrences: [
        {
          occurrenceId: "open",
          itemId: entityId<"WorkScheduleItem">("task-open"),
          workId,
          kind: "task",
          label: "초고",
          date: "2026-08-21",
          time: null,
          completed: false,
          completedAt: null,
        },
        {
          occurrenceId: "done",
          itemId: entityId<"WorkScheduleItem">("task-done"),
          workId,
          kind: "task",
          label: "완료한 일",
          date: "2026-08-21",
          time: null,
          completed: true,
          completedAt: "2026-08-21T01:00:00.000Z",
        },
      ],
      episodeProgress: {
        defaultEpisodeCharacters: 1,
        completedEpisodeCount: 0,
        completedEpisodeNumbers: [],
        totalCharacters: 0,
        totalEpisodeCount: 0,
      },
      completedDocumentCount: 0,
    };

    expect(deriveWorkScheduleSummary(projection, "2026-08-21")).toEqual({
      todayCount: 1,
      nearestDday: { label: "가까운 마감", days: 3 },
    });
  });
});
