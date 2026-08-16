import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WorkSnapshotComparisonProjection } from "../../application/revisions/work-snapshot-comparison";
import { entityId } from "../../domain/writing";
import { WorkSnapshotComparisonDialog } from "./WorkSnapshotComparisonDialog";

const projection: WorkSnapshotComparisonProjection = Object.freeze({
  schemaVersion: 1,
  workId: entityId<"Work">("work-a"),
  workSnapshotId: entityId<"WorkSnapshot">("snapshot-a"),
  label: "초고 기준",
  createdAt: "2026-08-10T00:00:00.000Z",
  totals: Object.freeze({
    snapshotDocumentCount: 2,
    currentDocumentCount: 2,
    snapshotCharacters: 120,
    currentCharacters: 140,
    characterDelta: 20,
    unchangedCount: 1,
    changedCount: 1,
    addedCount: 1,
    removedCount: 1,
  }),
  documents: Object.freeze([
    Object.freeze({
      documentId: entityId<"Document">("document-a"),
      title: "1화",
      status: "changed",
      snapshotRevisionId: entityId<"DocumentRevision">("snapshot-revision-a"),
      currentRevisionId: entityId<"DocumentRevision">("current-revision-a"),
      snapshotLength: 100,
      currentLength: 120,
      characterDelta: 20,
    }),
    Object.freeze({
      documentId: entityId<"Document">("document-b"),
      title: "2화",
      status: "unchanged",
      snapshotRevisionId: entityId<"DocumentRevision">("snapshot-revision-b"),
      currentRevisionId: entityId<"DocumentRevision">("snapshot-revision-b"),
      snapshotLength: 20,
      currentLength: 20,
      characterDelta: 0,
    }),
  ]),
});

describe("WorkSnapshotComparisonDialog", () => {
  it("shows read-only snapshot totals and per-Document states without manuscript text", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkSnapshotComparisonDialog, {
        onClose: () => undefined,
        projection,
      }),
    );

    expect(markup).toContain("작품 스냅샷 비교");
    expect(markup).toContain("초고 기준");
    expect(markup).toContain("스냅샷 120자");
    expect(markup).toContain("현재 140자");
    expect(markup).toContain("+20자");
    expect(markup).toContain("1화");
    expect(markup).toContain("2화");
    expect(markup).toContain("변경됨");
    expect(markup).toContain("같음");
    expect(markup).toContain("읽기 전용 비교");
    expect(markup).not.toContain("snapshot-revision-a");
    expect(markup).not.toContain("복원");
  });
});
