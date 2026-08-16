import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  deriveWorkScheduleOccurrences,
  parseCreateWorkScheduleItemCommand,
  parseSetWorkScheduleCompletionCommand,
  parseWorkScheduleDdayWorkload,
  parseWorkScheduleProjection,
  type WorkScheduleItemProjection,
} from "./work-schedule-contract";

const workId = entityId<"Work">("work-a");
const createdAt = "2026-08-10T01:00:00.000Z";

function item(
  value: Partial<WorkScheduleItemProjection> &
    Pick<WorkScheduleItemProjection, "itemId" | "kind" | "label">,
): WorkScheduleItemProjection {
  const { itemId, kind, label, ...overrides } = value;
  const common = {
    schemaVersion: 1 as const,
    workId,
    revision: 1,
    time: null,
    createdAt,
    updatedAt: createdAt,
  };
  if (kind === "task") {
    return {
      ...common,
      itemId,
      kind: "task",
      label,
      date: "2026-08-11",
      completedAt: null,
      ...overrides,
    } as WorkScheduleItemProjection;
  }
  if (kind === "routine") {
    return {
      ...common,
      itemId,
      kind: "routine",
      label,
      startDate: "2026-08-10",
      ...overrides,
    } as WorkScheduleItemProjection;
  }
  return {
    ...common,
    itemId,
    kind: "dday",
    label,
    date: "2026-08-20",
    workload: { mode: "none" },
    ...overrides,
  } as WorkScheduleItemProjection;
}

describe("work schedule contract", () => {
  it("parses exact caller-supplied task, routine, and D-DAY values", () => {
    expect(
      parseCreateWorkScheduleItemCommand({
        schemaVersion: 1,
        workId,
        item: {
          kind: "task",
          label: "  마감 원고 확인  ",
          date: "2026-08-11",
          time: "09:30",
        },
      }),
    ).toMatchObject({
      workId,
      item: {
        kind: "task",
        label: "마감 원고 확인",
        date: "2026-08-11",
        time: "09:30",
      },
    });
    expect(
      parseWorkScheduleDdayWorkload({
        mode: "episodeCount",
        targetEpisodeCount: 37,
        baselineCompletedCount: 12,
      }),
    ).toEqual({
      mode: "episodeCount",
      targetEpisodeCount: 37,
      baselineCompletedCount: 12,
    });
    expect(() =>
      parseCreateWorkScheduleItemCommand({
        schemaVersion: 1,
        workId,
        item: {
          kind: "routine",
          label: "집필",
          startDate: "2026-02-30",
          time: null,
        },
      }),
    ).toThrow("real calendar date");
  });

  it("derives daily routine occurrences without storing generated instances", () => {
    const taskId = entityId<"WorkScheduleItem">("task-a");
    const routineId = entityId<"WorkScheduleItem">("routine-a");
    const ddayId = entityId<"WorkScheduleItem">("dday-a");
    const items = [
      item({ itemId: taskId, kind: "task", label: "명시 일정" }),
      item({ itemId: routineId, kind: "routine", label: "매일 집필" }),
      item({ itemId: ddayId, kind: "dday", label: "공모 마감" }),
    ];

    const occurrences = deriveWorkScheduleOccurrences({
      workId,
      range: { from: "2026-08-10", to: "2026-08-12" },
      items,
      routineCompletions: [
        {
          itemId: routineId,
          date: "2026-08-11",
          completedAt: "2026-08-11T03:00:00.000Z",
        },
      ],
    });

    expect(occurrences).toHaveLength(4);
    expect(
      occurrences.find(
        (occurrence) =>
          occurrence.itemId === routineId && occurrence.date === "2026-08-11",
      ),
    ).toMatchObject({ completed: true });
    expect(occurrences.some((occurrence) => occurrence.itemId === ddayId)).toBe(
      false,
    );
  });

  it("rejects cross-Work projections and completion command extras", () => {
    expect(() =>
      parseWorkScheduleProjection({
        schemaVersion: 1,
        workId,
        range: { from: "2026-08-10", to: "2026-08-10" },
        items: [
          item({
            itemId: entityId<"WorkScheduleItem">("task-b"),
            kind: "task",
            label: "다른 작품 일정",
            workId: entityId<"Work">("work-b"),
          }),
        ],
        occurrences: [],
        episodeProgress: {
          defaultEpisodeCharacters: 4_000,
          totalCharacters: 0,
          totalEpisodeCount: 1,
          completedEpisodeCount: 0,
          completedEpisodeNumbers: [],
        },
      }),
    ).toThrow("crosses the Work boundary");
    expect(() =>
      parseSetWorkScheduleCompletionCommand({
        schemaVersion: 1,
        workId,
        itemId: "task-a",
        expectedRevision: 1,
        date: "2026-08-11",
        completed: true,
        inferred: true,
      }),
    ).toThrow("fields do not match");
  });
});
