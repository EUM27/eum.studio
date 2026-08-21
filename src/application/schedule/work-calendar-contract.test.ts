import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { parseWorkCalendarProjection } from "./work-calendar-contract";

describe("Work calendar contract", () => {
  it("unions Schedule occurrences with deterministic Document completion facts", () => {
    const workId = entityId<"Work">("work-a");
    const taskId = entityId<"WorkScheduleItem">("task-a");
    const projection = parseWorkCalendarProjection({
      schemaVersion: 1,
      workId,
      range: { from: "2026-08-21", to: "2026-08-22" },
      items: [
        {
          schemaVersion: 1,
          itemId: taskId,
          workId,
          revision: 1,
          kind: "task",
          label: "원고 검토",
          date: "2026-08-22",
          time: null,
          completedAt: null,
          createdAt: "2026-08-21T01:00:00.000Z",
          updatedAt: "2026-08-21T01:00:00.000Z",
        },
      ],
      occurrences: [
        {
          occurrenceId: `task:${taskId}`,
          itemId: taskId,
          workId,
          kind: "task",
          label: "원고 검토",
          date: "2026-08-22",
          time: null,
          completed: false,
          completedAt: null,
        },
        {
          occurrenceId: "document-completion:document-a",
          workId,
          documentId: "document-a",
          documentTitle: "5화",
          kind: "document-completion",
          label: "5화 완료",
          date: "2026-08-21",
          time: null,
          completed: true,
          completedAt: "2026-08-21T12:00:00.000Z",
          completedDocumentRevisionId: "revision-a",
        },
      ],
      episodeProgress: {
        defaultEpisodeCharacters: 4_000,
        totalCharacters: 0,
        totalEpisodeCount: 1,
        completedEpisodeCount: 0,
        completedEpisodeNumbers: [],
      },
      completedDocumentCount: 1,
    });

    expect(projection.occurrences.map((entry) => entry.kind)).toEqual([
      "document-completion",
      "task",
    ]);
    expect(projection.occurrences[0]).not.toHaveProperty("itemId");
  });

  it("rejects a completion fact owned by another Work", () => {
    expect(() =>
      parseWorkCalendarProjection({
        schemaVersion: 1,
        workId: "work-a",
        range: { from: "2026-08-21", to: "2026-08-21" },
        items: [],
        occurrences: [
          {
            occurrenceId: "document-completion:document-a",
            workId: "work-b",
            documentId: "document-a",
            documentTitle: "1화",
            kind: "document-completion",
            label: "1화 완료",
            date: "2026-08-21",
            time: null,
            completed: true,
            completedAt: "2026-08-21T12:00:00.000Z",
            completedDocumentRevisionId: "revision-a",
          },
        ],
        episodeProgress: {
          defaultEpisodeCharacters: 4_000,
          totalCharacters: 0,
          totalEpisodeCount: 1,
          completedEpisodeCount: 0,
          completedEpisodeNumbers: [],
        },
        completedDocumentCount: 1,
      }),
    ).toThrow("crosses the Work boundary");
  });
});
