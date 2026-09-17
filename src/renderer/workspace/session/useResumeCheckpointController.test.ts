import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { ManuscriptResumeCheckpointProjection } from "../../../application/checkpoints/manuscript-resume-checkpoint-projection";
import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import { entityId } from "../../../domain/writing";
import type { ManuscriptDocumentStateSummary } from "../../editor/ManuscriptEditor";
import { captureResumeWithCache } from "./useResumeCheckpointController";

describe("captureResumeWithCache", () => {
  it("reuses the latest durable checkpoint for the same revision and selection", async () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const sourceRevisionId = entityId<"DocumentRevision">(randomUUID());
    const currentRevisionId = entityId<"DocumentRevision">(randomUUID());
    const document: ManuscriptDocumentSource = Object.freeze({
      workId,
      documentId,
      documentRevisionId: sourceRevisionId,
      label: randomUUID(),
      initialText: randomUUID(),
    });
    const offset = document.initialText.length;
    const summary: ManuscriptDocumentStateSummary = Object.freeze({
      statistics: Object.freeze({
        characterCount: offset,
        characterCountWithoutWhitespace: offset,
      }),
      selection: Object.freeze({
        mainIndex: 0,
        ranges: Object.freeze([Object.freeze({
          anchor: offset,
          head: offset,
          from: offset,
          to: offset,
          empty: true,
        })]),
      }),
    });
    const captured: ManuscriptResumeCheckpointProjection = Object.freeze({
      schemaVersion: 1,
      status: "resolved",
      workId,
      documentId,
      targetRevisionId: currentRevisionId,
      selection: Object.freeze({ anchor: offset, head: offset }),
    });
    let currentCheckpoint: ManuscriptResumeCheckpointProjection | null = null;
    const captureResume = vi.fn(async () => captured);
    const execute = () => captureResumeWithCache({
      client: { captureResume },
      currentCheckpoint: () => currentCheckpoint,
      document,
      getCurrentRevisionId: () => currentRevisionId,
      installCheckpoint: (checkpoint) => {
        currentCheckpoint = checkpoint;
      },
      readDocumentState: () => summary,
      summary,
    });

    await execute();
    await execute();

    expect(captureResume).toHaveBeenCalledTimes(1);
    expect(currentCheckpoint).toBe(captured);
  });
});
