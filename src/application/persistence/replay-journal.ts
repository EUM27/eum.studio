import type { EntityId } from "../../domain/writing";
import {
  ChangeBatchApplicationConflictError,
  applyChangeBatch,
} from "./apply-change-batch";
import {
  classifyChangeBatchIdentity,
  parseCanonicalChangeBatch,
  type ChangeBatch,
} from "./change-batch";

export type JournalReplayTarget = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
  readonly text: string;
};

export type JournalReplayIssueReason =
  | "invalid-batch"
  | "unknown-document"
  | "work-boundary"
  | "base-revision-conflict"
  | "batch-identity-conflict"
  | "sequence-gap"
  | "stale-sequence"
  | "sequence-overflow"
  | "apply-conflict";

export type JournalReplayIssue = {
  readonly recordIndex: number;
  readonly reason: JournalReplayIssueReason;
  readonly batchId?: EntityId<"ChangeBatch">;
  readonly documentId?: EntityId<"Document">;
  readonly expectedSequence?: number;
  readonly receivedSequence?: number;
};

export type JournalReplayResult = {
  readonly targets: readonly JournalReplayTarget[];
  readonly appliedBatchIds: readonly EntityId<"ChangeBatch">[];
  readonly duplicateBatchIds: readonly EntityId<"ChangeBatch">[];
  readonly issues: readonly JournalReplayIssue[];
  readonly stoppedAtRecordIndex: number | null;
};

type MutableReplayTarget = {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevisionId: EntityId<"DocumentRevision">;
  nextSequence: number;
  text: string;
};

function freezeTarget(target: MutableReplayTarget): JournalReplayTarget {
  return Object.freeze({ ...target });
}

function freezeResult(input: {
  readonly orderedTargets: readonly MutableReplayTarget[];
  readonly appliedBatchIds: readonly EntityId<"ChangeBatch">[];
  readonly duplicateBatchIds: readonly EntityId<"ChangeBatch">[];
  readonly issue?: JournalReplayIssue;
}): JournalReplayResult {
  return Object.freeze({
    targets: Object.freeze(input.orderedTargets.map(freezeTarget)),
    appliedBatchIds: Object.freeze([...input.appliedBatchIds]),
    duplicateBatchIds: Object.freeze([...input.duplicateBatchIds]),
    issues: Object.freeze(
      input.issue === undefined
        ? []
        : [Object.freeze({ ...input.issue })],
    ),
    stoppedAtRecordIndex:
      input.issue?.recordIndex ?? null,
  });
}

function issueForBatch(input: {
  readonly recordIndex: number;
  readonly reason: JournalReplayIssueReason;
  readonly batch: ChangeBatch;
  readonly expectedSequence?: number;
}): JournalReplayIssue {
  return {
    recordIndex: input.recordIndex,
    reason: input.reason,
    batchId: input.batch.batchId,
    documentId: input.batch.documentId,
    ...(input.expectedSequence === undefined
      ? {}
      : { expectedSequence: input.expectedSequence }),
    receivedSequence: input.batch.sequence,
  };
}

export function replayJournal(input: {
  readonly targets: readonly JournalReplayTarget[];
  readonly payloads: readonly Uint8Array[];
}): JournalReplayResult {
  const orderedTargets: MutableReplayTarget[] = [];
  const targetsByDocument = new Map<
    EntityId<"Document">,
    MutableReplayTarget
  >();
  for (const target of input.targets) {
    if (
      !Number.isSafeInteger(target.nextSequence) ||
      target.nextSequence < 0
    ) {
      throw new Error(
        `Invalid next journal sequence for document ${target.documentId}`,
      );
    }
    if (targetsByDocument.has(target.documentId)) {
      throw new Error(
        `Duplicate journal replay document: ${target.documentId}`,
      );
    }
    const mutableTarget = { ...target };
    orderedTargets.push(mutableTarget);
    targetsByDocument.set(target.documentId, mutableTarget);
  }

  const acceptedByBatchId = new Map<
    EntityId<"ChangeBatch">,
    ChangeBatch
  >();
  const appliedBatchIds: EntityId<"ChangeBatch">[] = [];
  const duplicateBatchIds: EntityId<"ChangeBatch">[] = [];

  for (const [recordIndex, payload] of input.payloads.entries()) {
    let batch: ChangeBatch;
    try {
      batch = parseCanonicalChangeBatch(payload);
    } catch {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: {
          recordIndex,
          reason: "invalid-batch",
        },
      });
    }

    const accepted = acceptedByBatchId.get(batch.batchId);
    if (accepted !== undefined) {
      const identity = classifyChangeBatchIdentity(accepted, batch);
      if (identity === "duplicate") {
        duplicateBatchIds.push(batch.batchId);
        continue;
      }
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "batch-identity-conflict",
          batch,
        }),
      });
    }

    const target = targetsByDocument.get(batch.documentId);
    if (target === undefined) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "unknown-document",
          batch,
        }),
      });
    }
    if (target.workId !== batch.workId) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "work-boundary",
          batch,
        }),
      });
    }
    if (target.baseRevisionId !== batch.baseRevisionId) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "base-revision-conflict",
          batch,
        }),
      });
    }
    if (batch.sequence > target.nextSequence) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "sequence-gap",
          batch,
          expectedSequence: target.nextSequence,
        }),
      });
    }
    if (batch.sequence < target.nextSequence) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "stale-sequence",
          batch,
          expectedSequence: target.nextSequence,
        }),
      });
    }
    if (!Number.isSafeInteger(batch.sequence + 1)) {
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "sequence-overflow",
          batch,
          expectedSequence: target.nextSequence,
        }),
      });
    }

    let nextText: string;
    try {
      nextText = applyChangeBatch(target.text, batch);
    } catch (error) {
      if (!(error instanceof ChangeBatchApplicationConflictError)) {
        throw error;
      }
      return freezeResult({
        orderedTargets,
        appliedBatchIds,
        duplicateBatchIds,
        issue: issueForBatch({
          recordIndex,
          reason: "apply-conflict",
          batch,
          expectedSequence: target.nextSequence,
        }),
      });
    }

    target.text = nextText;
    target.nextSequence = batch.sequence + 1;
    acceptedByBatchId.set(batch.batchId, batch);
    appliedBatchIds.push(batch.batchId);
  }

  return freezeResult({
    orderedTargets,
    appliedBatchIds,
    duplicateBatchIds,
  });
}
