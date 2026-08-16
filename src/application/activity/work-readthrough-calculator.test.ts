import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  createUnsetWorkReadthrough,
  deriveWorkReadthrough,
  parseSaveWorkReadthroughCommand,
  parseWorkReadthroughProjection,
} from "./work-readthrough-calculator";

const workId = entityId<"Work">("work-a");
const firstDocumentId = entityId<"Document">("document-1");
const secondDocumentId = entityId<"Document">("document-2");
const thirdDocumentId = entityId<"Document">("document-3");

const documents = Object.freeze([
  Object.freeze({ documentId: firstDocumentId, title: "1화" }),
  Object.freeze({ documentId: secondDocumentId, title: "2화" }),
  Object.freeze({ documentId: thirdDocumentId, title: "3화" }),
]);

describe("Work readthrough calculator", () => {
  it("derives adjacent and first-episode rates in the exact Work document order", () => {
    const settings = parseWorkReadthroughProjection({
      schemaVersion: 1,
      workId,
      revision: 2,
      entries: [
        { documentId: firstDocumentId, readerCount: 1_000 },
        { documentId: secondDocumentId, readerCount: 800 },
        { documentId: thirdDocumentId, readerCount: 600 },
      ],
    });

    expect(deriveWorkReadthrough({ workId, documents, settings })).toEqual({
      schemaVersion: 1,
      workId,
      rows: [
        {
          documentId: firstDocumentId,
          title: "1화",
          readerCount: 1_000,
          adjacentRate: { status: "baseline", percent: null },
          firstEpisodeRate: { status: "calculated", percent: 100 },
        },
        {
          documentId: secondDocumentId,
          title: "2화",
          readerCount: 800,
          adjacentRate: { status: "calculated", percent: 80 },
          firstEpisodeRate: { status: "calculated", percent: 80 },
        },
        {
          documentId: thirdDocumentId,
          title: "3화",
          readerCount: 600,
          adjacentRate: { status: "calculated", percent: 75 },
          firstEpisodeRate: { status: "calculated", percent: 60 },
        },
      ],
    });
  });

  it("keeps missing counts unset and does not divide by a zero denominator", () => {
    const settings = parseWorkReadthroughProjection({
      schemaVersion: 1,
      workId,
      revision: 1,
      entries: [
        { documentId: firstDocumentId, readerCount: 0 },
        { documentId: thirdDocumentId, readerCount: 10 },
      ],
    });

    const projection = deriveWorkReadthrough({ workId, documents, settings });
    expect(projection.rows[0]?.firstEpisodeRate).toEqual({
      status: "unavailable",
      percent: null,
    });
    expect(projection.rows[1]).toMatchObject({
      readerCount: null,
      adjacentRate: { status: "missing", percent: null },
      firstEpisodeRate: { status: "missing", percent: null },
    });
    expect(projection.rows[2]).toMatchObject({
      adjacentRate: { status: "missing", percent: null },
      firstEpisodeRate: { status: "unavailable", percent: null },
    });
  });

  it("parses a stale-checked Work-owned save command without inventing entries", () => {
    expect(createUnsetWorkReadthrough()).toEqual([]);

    const command = parseSaveWorkReadthroughCommand({
      schemaVersion: 1,
      workId,
      expectedRevision: 0,
      entries: [
        { documentId: firstDocumentId, readerCount: 1_000 },
        { documentId: secondDocumentId, readerCount: null },
      ],
    });
    expect(command.entries).toEqual([
      { documentId: firstDocumentId, readerCount: 1_000 },
      { documentId: secondDocumentId, readerCount: null },
    ]);
  });
});
