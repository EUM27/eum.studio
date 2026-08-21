import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import { projectStudioToday } from "./studio-today-contract";

describe("Studio Today projection", () => {
  it("projects every Work calendar and derives today's completed Document count", () => {
    const date = "2026-08-21";
    const workA = entityId<"Work">("work-a");
    const workB = entityId<"Work">("work-b");
    const documentA = entityId<"Document">("document-a");
    const revisionA = entityId<"DocumentRevision">("revision-a");
    const projection = projectStudioToday({
      date,
      works: [
        {
          workId: workA,
          workTitle: "작품 A",
          calendar: {
            schemaVersion: 1,
            workId: workA,
            range: { from: date, to: date },
            items: [],
            occurrences: [
              {
                occurrenceId: "document-completion:document-a",
                workId: workA,
                documentId: documentA,
                documentTitle: "5화",
                kind: "document-completion",
                label: "5화 완료",
                date,
                time: null,
                completed: true,
                completedAt: "2026-08-21T12:00:00.000Z",
                completedDocumentRevisionId: revisionA,
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
          },
        },
        {
          workId: workB,
          workTitle: "작품 B",
          calendar: {
            schemaVersion: 1,
            workId: workB,
            range: { from: date, to: date },
            items: [],
            occurrences: [],
            episodeProgress: {
              defaultEpisodeCharacters: 4_000,
              totalCharacters: 0,
              totalEpisodeCount: 1,
              completedEpisodeCount: 0,
              completedEpisodeNumbers: [],
            },
            completedDocumentCount: 0,
          },
        },
      ],
    });

    expect(projection.works.map((work) => work.workId)).toEqual([
      "work-a",
      "work-b",
    ]);
    expect(projection.completedDocumentCount).toBe(1);
  });
});
