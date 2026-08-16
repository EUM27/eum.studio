import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import type { WorkSnapshotProjection } from "./work-version-contract";
import {
  deriveWorkSnapshotComparison,
  parseCompareWorkSnapshotCommand,
  parseWorkSnapshotComparisonProjection,
} from "./work-snapshot-comparison";

const workId = entityId<"Work">("work-a");
const workSnapshotId = entityId<"WorkSnapshot">("snapshot-a");
const documentA = entityId<"Document">("document-a");
const documentB = entityId<"Document">("document-b");
const documentC = entityId<"Document">("document-c");
const documentD = entityId<"Document">("document-d");
const revision = (value: string) => entityId<"DocumentRevision">(value);

const snapshot: WorkSnapshotProjection = Object.freeze({
  schemaVersion: 1,
  workSnapshotId,
  workId,
  label: "초고 기준",
  cause: "manual",
  manifestHash: "hash-a",
  createdAt: "2026-08-10T00:00:00.000Z",
  documentRevisions: Object.freeze([
    Object.freeze({ documentId: documentA, documentRevisionId: revision("snapshot-a") }),
    Object.freeze({ documentId: documentB, documentRevisionId: revision("snapshot-b") }),
    Object.freeze({ documentId: documentD, documentRevisionId: revision("snapshot-d") }),
  ]),
});

describe("WorkSnapshot comparison", () => {
  it("derives exact-text changed, unchanged, added, and removed Document rows", () => {
    const command = parseCompareWorkSnapshotCommand({
      schemaVersion: 1,
      workId,
      workSnapshotId,
    });
    const projection = deriveWorkSnapshotComparison({
      command,
      snapshot,
      snapshotDocuments: [
        {
          documentId: documentA,
          title: "1화",
          documentRevisionId: revision("snapshot-a"),
          text: "초안",
        },
        {
          documentId: documentB,
          title: "2화",
          documentRevisionId: revision("snapshot-b"),
          text: "같음",
        },
        {
          documentId: documentD,
          title: "삭제 회차",
          documentRevisionId: revision("snapshot-d"),
          text: "삭제됨",
        },
      ],
      currentDocuments: [
        {
          documentId: documentA,
          title: "1화",
          documentRevisionId: revision("current-a"),
          text: "수정",
        },
        {
          documentId: documentB,
          title: "2화",
          documentRevisionId: revision("snapshot-b"),
          text: "같음",
        },
        {
          documentId: documentC,
          title: "새 회차",
          documentRevisionId: revision("current-c"),
          text: "추가",
        },
      ],
    });

    expect(projection.totals).toEqual({
      snapshotDocumentCount: 3,
      currentDocumentCount: 3,
      snapshotCharacters: 7,
      currentCharacters: 6,
      characterDelta: -1,
      unchangedCount: 1,
      changedCount: 1,
      addedCount: 1,
      removedCount: 1,
    });
    expect(projection.documents.map((document) => ({
      documentId: document.documentId,
      status: document.status,
      characterDelta: document.characterDelta,
    }))).toEqual([
      { documentId: documentA, status: "changed", characterDelta: 0 },
      { documentId: documentB, status: "unchanged", characterDelta: 0 },
      { documentId: documentC, status: "added-after-snapshot", characterDelta: 2 },
      { documentId: documentD, status: "removed-after-snapshot", characterDelta: -3 },
    ]);
    expect(parseWorkSnapshotComparisonProjection(projection)).toEqual(projection);
    expect(JSON.stringify(projection)).not.toContain("초안");
    expect(JSON.stringify(projection)).not.toContain("수정");
  });

  it("rejects another Work and incomplete snapshot materialization", () => {
    const command = parseCompareWorkSnapshotCommand({
      schemaVersion: 1,
      workId,
      workSnapshotId,
    });
    expect(() =>
      deriveWorkSnapshotComparison({
        command,
        snapshot: { ...snapshot, workId: entityId<"Work">("work-b") },
        snapshotDocuments: [],
        currentDocuments: [],
      }),
    ).toThrow(/outside Work/u);
    expect(() =>
      deriveWorkSnapshotComparison({
        command,
        snapshot,
        snapshotDocuments: [],
        currentDocuments: [],
      }),
    ).toThrow(/materialization/u);
  });
});
