import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createUnsetContinuousReadingProgress,
  deriveContinuousReadingSession,
  parseSaveContinuousReadingProgressCommand,
  parseWorkContinuousReadingProgressProjection,
  splitContinuousReadingLines,
} from "./continuous-reading-progress";

const workId = entityId<"Work">("work-a");
const firstDocumentId = entityId<"Document">("document-1");
const secondDocumentId = entityId<"Document">("document-2");
const firstRevisionId = entityId<"DocumentRevision">("revision-1");
const secondRevisionId = entityId<"DocumentRevision">("revision-2");

const documents = Object.freeze([
  Object.freeze({
    workId,
    documentId: firstDocumentId,
    documentRevisionId: firstRevisionId,
    title: "1화",
    text: "첫 줄\n둘째 줄",
  }),
  Object.freeze({
    workId,
    documentId: secondDocumentId,
    documentRevisionId: secondRevisionId,
    title: "2화",
    text: "다음 줄\n마지막 줄",
  }),
]);

describe("continuous reading progress", () => {
  it("restores an exact same-revision line offset in Work document order", () => {
    const progress = parseWorkContinuousReadingProgressProjection({
      schemaVersion: 1,
      workId,
      revision: 3,
      location: {
        documentId: secondDocumentId,
        documentRevisionId: secondRevisionId,
        textOffset: 5,
      },
    });

    expect(
      deriveContinuousReadingSession({ workId, documents, progress }),
    ).toEqual({
      schemaVersion: 1,
      workId,
      status: "restored",
      initialLoadedCount: 2,
      initialLocation: progress.location,
      documents,
    });
  });

  it("does not remap a saved position when its immutable revision changed", () => {
    const progress = parseWorkContinuousReadingProgressProjection({
      schemaVersion: 1,
      workId,
      revision: 4,
      location: {
        documentId: secondDocumentId,
        documentRevisionId: entityId<"DocumentRevision">("old-revision"),
        textOffset: 5,
      },
    });

    expect(
      deriveContinuousReadingSession({ workId, documents, progress }),
    ).toMatchObject({
      status: "stale",
      initialLoadedCount: 1,
      initialLocation: null,
    });
  });

  it("keeps line starts as exact UTF-16 offsets and parses nullable progress", () => {
    expect(splitContinuousReadingLines("가😀\n나\n")).toEqual([
      { textOffset: 0, text: "가😀" },
      { textOffset: 4, text: "나" },
      { textOffset: 6, text: "" },
    ]);
    expect(createUnsetContinuousReadingProgress()).toBeNull();

    expect(
      parseSaveContinuousReadingProgressCommand({
        schemaVersion: 1,
        workId,
        expectedRevision: 0,
        location: {
          documentId: firstDocumentId,
          documentRevisionId: firstRevisionId,
          textOffset: 4,
        },
      }),
    ).toMatchObject({
      workId,
      expectedRevision: 0,
      location: { documentId: firstDocumentId, textOffset: 4 },
    });
  });
});
