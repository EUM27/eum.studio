import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "./change-batch";
import { replayJournal } from "./replay-journal";

function createAppendBatch(input: {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevisionId: EntityId<"DocumentRevision">;
  sequence: number;
  beforeText: string;
  insertedText: string;
}) {
  return parseChangeBatch({
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: randomUUID(),
    workId: input.workId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    sequence: input.sequence,
    createdAt: new Date().toISOString(),
    beforeTextLengthUtf16: input.beforeText.length,
    afterTextLengthUtf16:
      input.beforeText.length + input.insertedText.length,
    changes: [
      {
        fromUtf16: input.beforeText.length,
        toUtf16: input.beforeText.length,
        insertedText: input.insertedText,
      },
    ],
  });
}

describe("replayJournal", () => {
  it("applies consecutive batches and treats repeated canonical identity as an idempotent duplicate", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const firstInsertion = randomUUID();
    const secondInsertion = randomUUID();
    const firstResult = `${initialText}${firstInsertion}`;
    const expectedText = `${firstResult}${secondInsertion}`;
    const expectedSequence = randomInt(0, 32);
    const firstBatch = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: expectedSequence,
      beforeText: initialText,
      insertedText: firstInsertion,
    });
    const secondBatch = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: expectedSequence + 1,
      beforeText: firstResult,
      insertedText: secondInsertion,
    });

    const result = replayJournal({
      targets: [
        {
          workId,
          documentId,
          baseRevisionId,
          nextSequence: expectedSequence,
          text: initialText,
        },
      ],
      payloads: [
        serializeCanonicalChangeBatch(firstBatch),
        serializeCanonicalChangeBatch(secondBatch),
        serializeCanonicalChangeBatch(firstBatch),
      ],
    });

    expect(result.stoppedAtRecordIndex).toBeNull();
    expect(result.issues).toEqual([]);
    expect(result.appliedBatchIds).toEqual([
      firstBatch.batchId,
      secondBatch.batchId,
    ]);
    expect(result.duplicateBatchIds).toEqual([
      firstBatch.batchId,
    ]);
    expect(result.targets).toEqual([
      {
        workId,
        documentId,
        baseRevisionId,
        nextSequence: expectedSequence + 2,
        text: expectedText,
      },
    ]);
  });

  it("stops at a sequence gap and preserves the last exactly applied text", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const nextSequence = randomInt(0, 32);
    const gapBatch = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: nextSequence + randomInt(2, 32),
      beforeText: initialText,
      insertedText: randomUUID(),
    });

    const result = replayJournal({
      targets: [
        {
          workId,
          documentId,
          baseRevisionId,
          nextSequence,
          text: initialText,
        },
      ],
      payloads: [serializeCanonicalChangeBatch(gapBatch)],
    });

    expect(result.stoppedAtRecordIndex).toBe(0);
    expect(result.issues).toEqual([
      {
        recordIndex: 0,
        reason: "sequence-gap",
        batchId: gapBatch.batchId,
        documentId,
        expectedSequence: nextSequence,
        receivedSequence: gapBatch.sequence,
      },
    ]);
    expect(result.targets[0]?.text).toBe(initialText);
    expect(result.appliedBatchIds).toEqual([]);
  });

  it("stops at a cross-work batch without applying it to the matching document identity", () => {
    const targetWorkId = entityId<"Work">(randomUUID());
    const batchWorkId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const nextSequence = randomInt(0, 32);
    const batch = createAppendBatch({
      workId: batchWorkId,
      documentId,
      baseRevisionId,
      sequence: nextSequence,
      beforeText: initialText,
      insertedText: randomUUID(),
    });

    const result = replayJournal({
      targets: [
        {
          workId: targetWorkId,
          documentId,
          baseRevisionId,
          nextSequence,
          text: initialText,
        },
      ],
      payloads: [serializeCanonicalChangeBatch(batch)],
    });

    expect(result.issues[0]?.reason).toBe("work-boundary");
    expect(result.targets[0]?.text).toBe(initialText);
    expect(result.appliedBatchIds).toEqual([]);
  });

  it("stops without partial apply when declared before-length differs from the journal head", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const declaredText = `${initialText}${randomUUID()}`;
    const nextSequence = randomInt(0, 32);
    const batch = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: nextSequence,
      beforeText: declaredText,
      insertedText: randomUUID(),
    });

    const result = replayJournal({
      targets: [
        {
          workId,
          documentId,
          baseRevisionId,
          nextSequence,
          text: initialText,
        },
      ],
      payloads: [serializeCanonicalChangeBatch(batch)],
    });

    expect(result.issues[0]?.reason).toBe("apply-conflict");
    expect(result.targets[0]?.text).toBe(initialText);
    expect(result.targets[0]?.nextSequence).toBe(nextSequence);
  });

  it("stops before apply when the following sequence cannot be represented safely", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const batch = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: Number.MAX_SAFE_INTEGER,
      beforeText: initialText,
      insertedText: randomUUID(),
    });

    const result = replayJournal({
      targets: [
        {
          workId,
          documentId,
          baseRevisionId,
          nextSequence: Number.MAX_SAFE_INTEGER,
          text: initialText,
        },
      ],
      payloads: [serializeCanonicalChangeBatch(batch)],
    });

    expect(result.issues[0]?.reason).toBe("sequence-overflow");
    expect(result.targets[0]?.text).toBe(initialText);
    expect(result.appliedBatchIds).toEqual([]);
  });

  it("quarantines the same batch identity when its canonical bytes differ", () => {
    const workId = entityId<"Work">(randomUUID());
    const documentId = entityId<"Document">(randomUUID());
    const baseRevisionId =
      entityId<"DocumentRevision">(randomUUID());
    const initialText = randomUUID();
    const firstInsertion = randomUUID();
    const conflictingInsertion = randomUUID();
    const nextSequence = randomInt(0, 32);
    const accepted = createAppendBatch({
      workId,
      documentId,
      baseRevisionId,
      sequence: nextSequence,
      beforeText: initialText,
      insertedText: firstInsertion,
    });
    const conflicting = parseChangeBatch({
      ...accepted,
      afterTextLengthUtf16:
        initialText.length + conflictingInsertion.length,
      changes: [
        {
          fromUtf16: initialText.length,
          toUtf16: initialText.length,
          insertedText: conflictingInsertion,
        },
      ],
    });

    const result = replayJournal({
      targets: [
        {
          workId,
          documentId,
          baseRevisionId,
          nextSequence,
          text: initialText,
        },
      ],
      payloads: [
        serializeCanonicalChangeBatch(accepted),
        serializeCanonicalChangeBatch(conflicting),
      ],
    });

    expect(result.stoppedAtRecordIndex).toBe(1);
    expect(result.issues[0]?.reason).toBe(
      "batch-identity-conflict",
    );
    expect(result.targets[0]?.text).toBe(
      `${initialText}${firstInsertion}`,
    );
    expect(result.appliedBatchIds).toEqual([accepted.batchId]);
  });
});
