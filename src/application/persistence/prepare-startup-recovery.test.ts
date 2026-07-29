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
import {
  prepareStartupRecovery,
  type StartupRecoveryRecord,
} from "./prepare-startup-recovery";
import type { JournalReplayTarget } from "./replay-journal";

function createAppendBatch(input: {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly sequence: number;
  readonly beforeText: string;
  readonly insertedText: string;
  readonly batchId?: EntityId<"ChangeBatch">;
}) {
  return parseChangeBatch({
    schemaVersion: 1,
    textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
    batchId: input.batchId ?? randomUUID(),
    workId: input.workId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    sequence: input.sequence,
    createdAt: new Date(
      Date.now() + randomInt(0, 1_000),
    ).toISOString(),
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

function createTarget(input?: {
  readonly workId?: EntityId<"Work">;
  readonly documentId?: EntityId<"Document">;
  readonly baseRevisionId?: EntityId<"DocumentRevision">;
  readonly nextSequence?: number;
  readonly text?: string;
}): JournalReplayTarget {
  return {
    workId:
      input?.workId ?? entityId<"Work">(randomUUID()),
    documentId:
      input?.documentId ??
      entityId<"Document">(randomUUID()),
    baseRevisionId:
      input?.baseRevisionId ??
      entityId<"DocumentRevision">(randomUUID()),
    nextSequence: input?.nextSequence ?? randomInt(0, 32),
    text: input?.text ?? randomUUID(),
  };
}

function createRecords(
  payloads: readonly Uint8Array[],
): readonly StartupRecoveryRecord[] {
  let byteOffset = 0;
  return payloads.map((payload) => {
    const frameStartByteOffset = byteOffset;
    byteOffset +=
      payload.byteLength + randomInt(1, 64);
    return {
      payload,
      frameStartByteOffset,
      frameEndByteOffset: byteOffset,
    };
  });
}

describe("prepareStartupRecovery", () => {
  it("reports a clean startup when no journal record or issue follows the durable revisions", () => {
    const target = createTarget();

    const result = prepareStartupRecovery({
      targets: [target],
      records: [],
      sourceJournalEndByteOffset: 0,
      checksumVerifiedPrefixByteLength: 0,
      frameIssue: null,
    });

    expect(result).toEqual({
      status: "clean",
      issues: [],
    });
  });

  it("creates a recovery-pending candidate from the complete logically safe prefix", () => {
    const target = createTarget();
    const firstInsertion = randomUUID();
    const secondInsertion = randomUUID();
    const firstText = `${target.text}${firstInsertion}`;
    const first = createAppendBatch({
      ...target,
      sequence: target.nextSequence,
      beforeText: target.text,
      insertedText: firstInsertion,
    });
    const second = createAppendBatch({
      ...target,
      sequence: target.nextSequence + 1,
      beforeText: firstText,
      insertedText: secondInsertion,
    });
    const payloads = [
      serializeCanonicalChangeBatch(first),
      serializeCanonicalChangeBatch(second),
      serializeCanonicalChangeBatch(first),
    ];
    const records = createRecords(payloads);
    const sourceJournalEndByteOffset =
      records.at(-1)?.frameEndByteOffset ?? 0;

    const result = prepareStartupRecovery({
      targets: [target],
      records,
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        sourceJournalEndByteOffset,
      frameIssue: null,
    });

    expect(result.status).toBe("recovery-pending");
    if (result.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(result.candidate).toEqual({
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        sourceJournalEndByteOffset,
      safeReplayThroughByteOffset:
        sourceJournalEndByteOffset,
      affectedDocuments: [
        {
          workId: target.workId,
          documentId: target.documentId,
          baseRevisionId: target.baseRevisionId,
          recoveredText: `${firstText}${secondInsertion}`,
          nextSequence: target.nextSequence + 2,
        },
      ],
      appliedBatchIds: [first.batchId, second.batchId],
      duplicateBatchIds: [first.batchId],
      safePayloads: payloads,
      issues: [],
    });
    expect(result.issues).toEqual([]);
  });

  it("stops a candidate before the first logical issue and reports the exact rejected record", () => {
    const target = createTarget();
    const insertion = randomUUID();
    const applied = createAppendBatch({
      ...target,
      sequence: target.nextSequence,
      beforeText: target.text,
      insertedText: insertion,
    });
    const gap = createAppendBatch({
      ...target,
      sequence: target.nextSequence + randomInt(2, 32),
      beforeText: `${target.text}${insertion}`,
      insertedText: randomUUID(),
    });
    const records = createRecords([
      serializeCanonicalChangeBatch(applied),
      serializeCanonicalChangeBatch(gap),
    ]);
    const sourceJournalEndByteOffset =
      records.at(-1)?.frameEndByteOffset ?? 0;

    const result = prepareStartupRecovery({
      targets: [target],
      records,
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        sourceJournalEndByteOffset,
      frameIssue: null,
    });

    expect(result.status).toBe("recovery-pending");
    if (result.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(
      result.candidate.safeReplayThroughByteOffset,
    ).toBe(records[1]?.frameStartByteOffset);
    expect(result.candidate.safePayloads).toEqual([
      records[0]?.payload,
    ]);
    expect(result.candidate.affectedDocuments).toEqual([
      {
        workId: target.workId,
        documentId: target.documentId,
        baseRevisionId: target.baseRevisionId,
        recoveredText: `${target.text}${insertion}`,
        nextSequence: target.nextSequence + 1,
      },
    ]);
    expect(result.issues).toEqual([
      {
        source: "journal-replay",
        recordIndex: 1,
        reason: "sequence-gap",
        batchId: gap.batchId,
        documentId: target.documentId,
        expectedSequence: target.nextSequence + 1,
        receivedSequence: gap.sequence,
      },
    ]);
  });

  it("does not create a candidate when the first record crosses a Work boundary", () => {
    const target = createTarget();
    const batch = createAppendBatch({
      ...target,
      workId: entityId<"Work">(randomUUID()),
      sequence: target.nextSequence,
      beforeText: target.text,
      insertedText: randomUUID(),
    });
    const records = createRecords([
      serializeCanonicalChangeBatch(batch),
    ]);
    const sourceJournalEndByteOffset =
      records[0]?.frameEndByteOffset ?? 0;

    const result = prepareStartupRecovery({
      targets: [target],
      records,
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        sourceJournalEndByteOffset,
      frameIssue: null,
    });

    expect(result).toEqual({
      status: "read-only-error",
      issues: [
        {
          source: "journal-replay",
          recordIndex: 0,
          reason: "work-boundary",
          batchId: batch.batchId,
          documentId: target.documentId,
          receivedSequence: batch.sequence,
        },
      ],
    });
  });

  it("keeps a checksum-valid candidate and exposes a later raw frame tail as an issue", () => {
    const target = createTarget();
    const insertion = randomUUID();
    const batch = createAppendBatch({
      ...target,
      sequence: target.nextSequence,
      beforeText: target.text,
      insertedText: insertion,
    });
    const records = createRecords([
      serializeCanonicalChangeBatch(batch),
    ]);
    const checksumVerifiedPrefixByteLength =
      records[0]?.frameEndByteOffset ?? 0;
    const tailByteLength = randomInt(1, 64);
    const sourceJournalEndByteOffset =
      checksumVerifiedPrefixByteLength + tailByteLength;
    const reason = randomUUID();

    const result = prepareStartupRecovery({
      targets: [target],
      records,
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength,
      frameIssue: {
        byteOffset: checksumVerifiedPrefixByteLength,
        byteLength: tailByteLength,
        reason,
      },
    });

    expect(result.status).toBe("recovery-pending");
    if (result.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(
      result.candidate.safeReplayThroughByteOffset,
    ).toBe(checksumVerifiedPrefixByteLength);
    expect(result.issues).toEqual([
      {
        source: "journal-frame-tail",
        byteOffset: checksumVerifiedPrefixByteLength,
        byteLength: tailByteLength,
        reason,
      },
    ]);
    expect(result.candidate.affectedDocuments[0]).toEqual({
      workId: target.workId,
      documentId: target.documentId,
      baseRevisionId: target.baseRevisionId,
      recoveredText: `${target.text}${insertion}`,
      nextSequence: target.nextSequence + 1,
    });
  });

  it("reports an isolated frame tail without a safe change as read-only instead of inventing a revision", () => {
    const target = createTarget();
    const byteLength = randomInt(1, 64);
    const reason = randomUUID();

    const result = prepareStartupRecovery({
      targets: [target],
      records: [],
      sourceJournalEndByteOffset: byteLength,
      checksumVerifiedPrefixByteLength: 0,
      frameIssue: {
        byteOffset: 0,
        byteLength,
        reason,
      },
    });

    expect(result).toEqual({
      status: "read-only-error",
      issues: [
        {
          source: "journal-frame-tail",
          byteOffset: 0,
          byteLength,
          reason,
        },
      ],
    });
  });

  it("projects only the exact affected Document while preserving every target boundary", () => {
    const affected = createTarget();
    const untouched = createTarget();
    const insertion = randomUUID();
    const batch = createAppendBatch({
      ...affected,
      sequence: affected.nextSequence,
      beforeText: affected.text,
      insertedText: insertion,
    });
    const records = createRecords([
      serializeCanonicalChangeBatch(batch),
    ]);
    const sourceJournalEndByteOffset =
      records[0]?.frameEndByteOffset ?? 0;

    const result = prepareStartupRecovery({
      targets: [affected, untouched],
      records,
      sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        sourceJournalEndByteOffset,
      frameIssue: null,
    });

    expect(result.status).toBe("recovery-pending");
    if (result.status !== "recovery-pending") {
      throw new Error("Expected recovery-pending");
    }
    expect(result.candidate.affectedDocuments).toEqual([
      {
        workId: affected.workId,
        documentId: affected.documentId,
        baseRevisionId: affected.baseRevisionId,
        recoveredText: `${affected.text}${insertion}`,
        nextSequence: affected.nextSequence + 1,
      },
    ]);
    expect(
      result.candidate.affectedDocuments.some(
        (document) =>
          document.documentId === untouched.documentId,
      ),
    ).toBe(false);
    expect(untouched.text).not.toBe(affected.text);
  });
});
