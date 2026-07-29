import type { EntityId } from "../../domain/writing";
import {
  parseCanonicalChangeBatch,
} from "./change-batch";
import {
  replayJournal,
  type JournalReplayIssue,
  type JournalReplayTarget,
} from "./replay-journal";

export type StartupRecoveryRecord = {
  readonly payload: Uint8Array;
  readonly frameStartByteOffset: number;
  readonly frameEndByteOffset: number;
};

export type StartupRecoveryFrameIssue = {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly reason: string;
};

export type StartupRecoveryIssue =
  | ({
      readonly source: "journal-replay";
    } & JournalReplayIssue)
  | {
      readonly source: "journal-frame-tail";
      readonly byteOffset: number;
      readonly byteLength: number;
      readonly reason: string;
    };

export type StartupRecoveryAffectedDocument = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly recoveredText: string;
  readonly nextSequence: number;
};

export type StartupRecoveryCandidate = {
  readonly sourceJournalEndByteOffset: number;
  readonly checksumVerifiedPrefixByteLength: number;
  readonly safeReplayThroughByteOffset: number;
  readonly affectedDocuments:
    readonly StartupRecoveryAffectedDocument[];
  readonly appliedBatchIds:
    readonly EntityId<"ChangeBatch">[];
  readonly duplicateBatchIds:
    readonly EntityId<"ChangeBatch">[];
  readonly safePayloads: readonly Uint8Array[];
  readonly issues: readonly StartupRecoveryIssue[];
};

export type StartupRecoveryState =
  | {
      readonly status: "clean";
      readonly issues: readonly StartupRecoveryIssue[];
    }
  | {
      readonly status: "recovery-pending";
      readonly candidate: StartupRecoveryCandidate;
      readonly issues: readonly StartupRecoveryIssue[];
    }
  | {
      readonly status: "read-only-error";
      readonly issues: readonly StartupRecoveryIssue[];
    };

function freezeReplayIssue(
  issue: JournalReplayIssue,
): StartupRecoveryIssue {
  return Object.freeze({
    source: "journal-replay",
    ...issue,
  });
}

function freezeFrameIssue(
  issue: StartupRecoveryFrameIssue,
): StartupRecoveryIssue {
  return Object.freeze({
    source: "journal-frame-tail",
    byteOffset: issue.byteOffset,
    byteLength: issue.byteLength,
    reason: issue.reason,
  });
}

function collectAffectedDocuments(input: {
  readonly records: readonly StartupRecoveryRecord[];
  readonly safeRecordCount: number;
  readonly appliedBatchIds:
    readonly EntityId<"ChangeBatch">[];
  readonly replayTargets: readonly JournalReplayTarget[];
}): readonly StartupRecoveryAffectedDocument[] {
  const appliedBatchIds = new Set(
    input.appliedBatchIds,
  );
  const affectedDocumentIds: EntityId<"Document">[] = [];
  const affectedDocumentSet = new Set<
    EntityId<"Document">
  >();

  for (const record of input.records.slice(
    0,
    input.safeRecordCount,
  )) {
    const batch = parseCanonicalChangeBatch(record.payload);
    if (
      appliedBatchIds.has(batch.batchId) &&
      !affectedDocumentSet.has(batch.documentId)
    ) {
      affectedDocumentSet.add(batch.documentId);
      affectedDocumentIds.push(batch.documentId);
    }
  }

  const replayTargetsByDocument = new Map(
    input.replayTargets.map((target) => [
      target.documentId,
      target,
    ]),
  );
  return Object.freeze(
    affectedDocumentIds.map((documentId) => {
      const target =
        replayTargetsByDocument.get(documentId);
      if (target === undefined) {
        throw new Error(
          `Startup recovery has no replay target: ${documentId}`,
        );
      }
      return Object.freeze({
        workId: target.workId,
        documentId: target.documentId,
        baseRevisionId: target.baseRevisionId,
        recoveredText: target.text,
        nextSequence: target.nextSequence,
      });
    }),
  );
}

export function prepareStartupRecovery(input: {
  readonly targets: readonly JournalReplayTarget[];
  readonly records: readonly StartupRecoveryRecord[];
  readonly sourceJournalEndByteOffset: number;
  readonly checksumVerifiedPrefixByteLength: number;
  readonly frameIssue: StartupRecoveryFrameIssue | null;
}): StartupRecoveryState {
  const replay = replayJournal({
    targets: input.targets,
    payloads: input.records.map(
      (record) => record.payload,
    ),
  });
  const safeRecordCount =
    replay.stoppedAtRecordIndex ??
    input.records.length;
  const safeReplayThroughByteOffset =
    replay.stoppedAtRecordIndex === null
      ? input.checksumVerifiedPrefixByteLength
      : (input.records[
          replay.stoppedAtRecordIndex
        ]?.frameStartByteOffset ??
        input.checksumVerifiedPrefixByteLength);
  const issues: StartupRecoveryIssue[] = [
    ...replay.issues.map(freezeReplayIssue),
    ...(input.frameIssue === null
      ? []
      : [freezeFrameIssue(input.frameIssue)]),
  ];
  const frozenIssues = Object.freeze(issues);

  if (replay.appliedBatchIds.length === 0) {
    if (frozenIssues.length === 0) {
      return Object.freeze({
        status: "clean",
        issues: Object.freeze([]),
      });
    }
    return Object.freeze({
      status: "read-only-error",
      issues: frozenIssues,
    });
  }

  const candidate: StartupRecoveryCandidate =
    Object.freeze({
      sourceJournalEndByteOffset:
        input.sourceJournalEndByteOffset,
      checksumVerifiedPrefixByteLength:
        input.checksumVerifiedPrefixByteLength,
      safeReplayThroughByteOffset,
      affectedDocuments: collectAffectedDocuments({
        records: input.records,
        safeRecordCount,
        appliedBatchIds: replay.appliedBatchIds,
        replayTargets: replay.targets,
      }),
      appliedBatchIds: Object.freeze([
        ...replay.appliedBatchIds,
      ]),
      duplicateBatchIds: Object.freeze([
        ...replay.duplicateBatchIds,
      ]),
      safePayloads: Object.freeze(
        input.records
          .slice(0, safeRecordCount)
          .map((record) => record.payload),
      ),
      issues: frozenIssues,
    });

  return Object.freeze({
    status: "recovery-pending",
    candidate,
    issues: frozenIssues,
  });
}
