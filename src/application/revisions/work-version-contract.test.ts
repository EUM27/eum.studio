import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { entityId } from "../../domain/writing";
import {
  parseCreateWorkSnapshotCommand,
  parseDocumentRevisionListProjection,
  parseRestoreDocumentRevisionCommand,
  parseWorkSnapshotListProjection,
} from "./work-version-contract";

describe("Work version contract", () => {
  it("preserves exact Document revision and immutable Work snapshot identities", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const firstRevisionId = entityId<"DocumentRevision">(randomUUID());
    const currentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const createdAt = new Date().toISOString();
    const revisions = parseDocumentRevisionListProjection({
      schemaVersion: 1,
      workId,
      documentId,
      revisions: [
        {
          schemaVersion: 1,
          revisionId: currentRevisionId,
          workId,
          documentId,
          parentRevisionId: firstRevisionId,
          length: 19,
          cause: "manuscript-edit",
          createdAt,
          durableAt: createdAt,
          isCurrent: true,
        },
      ],
    });
    expect(revisions.revisions[0]).toMatchObject({
      revisionId: currentRevisionId,
      parentRevisionId: firstRevisionId,
      isCurrent: true,
    });
    expect(
      parseRestoreDocumentRevisionCommand({
        schemaVersion: 1,
        workId,
        documentId,
        targetRevisionId: firstRevisionId,
      }),
    ).toMatchObject({ targetRevisionId: firstRevisionId });

    const label = "1차 퇴고 전";
    expect(
      parseCreateWorkSnapshotCommand({ schemaVersion: 1, workId, label }),
    ).toMatchObject({ workId, label });
    const workSnapshotId = entityId<"WorkSnapshot">(randomUUID());
    const snapshots = parseWorkSnapshotListProjection({
      schemaVersion: 1,
      workId,
      snapshots: [
        {
          schemaVersion: 1,
          workSnapshotId,
          workId,
          label,
          cause: "manual",
          manifestHash: randomUUID(),
          createdAt,
          documentRevisions: [
            { documentId, documentRevisionId: currentRevisionId },
          ],
        },
      ],
    });
    expect(snapshots.snapshots[0]).toMatchObject({
      workSnapshotId,
      documentRevisions: [
        { documentId, documentRevisionId: currentRevisionId },
      ],
    });
  });
});
