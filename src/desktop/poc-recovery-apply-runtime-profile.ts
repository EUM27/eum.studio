import type { CompactionRevisionPlan } from "../application/persistence/compact-journal-into-revision";
import {
  entityId,
  type EntityId,
} from "../domain/writing";

export type PocRecoveryApplyRevisionPlan =
  CompactionRevisionPlan & {
    readonly contentPath: string;
  };

export type PocRecoveryApplyRuntimeProfile = {
  readonly schemaVersion: 1;
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly expectedSourceJournalEndByteOffset: number;
  readonly expectedSafeReplayThroughByteOffset: number;
  readonly contentChecksumAlgorithm: string;
  readonly sourceJournalPath: string;
  readonly nextJournalPath: string;
  readonly publicationTemporaryPath: string;
  readonly publicationPath: string;
  readonly revisions:
    readonly PocRecoveryApplyRevisionPlan[];
};

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  const allowedFields = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throw new Error(
        `Unsupported ${field} field: ${key}`,
      );
    }
  }
}

function readNonEmptyString(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function readBoundary(
  record: Record<string, unknown>,
  field: string,
): number {
  const value = record[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${field} must be a non-negative safe integer`,
    );
  }
  return value;
}

function parseRevisionPlan(
  value: unknown,
  index: number,
): PocRecoveryApplyRevisionPlan {
  const field = `revisions[${index}]`;
  const record = readRecord(value, field);
  assertOnlyFields(
    record,
    [
      "workId",
      "documentId",
      "expectedBaseRevisionId",
      "revisionId",
      "cause",
      "createdAt",
      "durableAt",
      "contentPath",
    ],
    field,
  );
  return Object.freeze({
    workId: entityId<"Work">(
      readNonEmptyString(record, "workId"),
    ),
    documentId: entityId<"Document">(
      readNonEmptyString(record, "documentId"),
    ),
    expectedBaseRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          record,
          "expectedBaseRevisionId",
        ),
      ),
    revisionId: entityId<"DocumentRevision">(
      readNonEmptyString(record, "revisionId"),
    ),
    cause: readNonEmptyString(record, "cause"),
    createdAt: readNonEmptyString(
      record,
      "createdAt",
    ),
    durableAt: readNonEmptyString(
      record,
      "durableAt",
    ),
    contentPath: readNonEmptyString(
      record,
      "contentPath",
    ),
  });
}

export function parsePocRecoveryApplyRuntimeProfile(
  value: unknown,
): PocRecoveryApplyRuntimeProfile {
  const input = readRecord(
    value,
    "pocRecoveryApplyRuntimeProfile",
  );
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "compactionId",
      "expectedSourceJournalEndByteOffset",
      "expectedSafeReplayThroughByteOffset",
      "contentChecksumAlgorithm",
      "sourceJournalPath",
      "nextJournalPath",
      "publicationTemporaryPath",
      "publicationPath",
      "revisions",
    ],
    "pocRecoveryApplyRuntimeProfile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "pocRecoveryApplyRuntimeProfile.schemaVersion must be 1",
    );
  }
  if (
    !Array.isArray(input.revisions) ||
    input.revisions.length === 0
  ) {
    throw new Error(
      "revisions must be a non-empty array",
    );
  }

  const expectedSourceJournalEndByteOffset =
    readBoundary(
      input,
      "expectedSourceJournalEndByteOffset",
    );
  const expectedSafeReplayThroughByteOffset =
    readBoundary(
      input,
      "expectedSafeReplayThroughByteOffset",
    );
  if (
    expectedSafeReplayThroughByteOffset >
    expectedSourceJournalEndByteOffset
  ) {
    throw new Error(
      "expectedSafeReplayThroughByteOffset must not exceed expectedSourceJournalEndByteOffset",
    );
  }

  const documentIds = new Set<
    EntityId<"Document">
  >();
  const revisionIds = new Set<
    EntityId<"DocumentRevision">
  >();
  const revisions = input.revisions.map(
    (value, index) => {
      const revision = parseRevisionPlan(
        value,
        index,
      );
      if (documentIds.has(revision.documentId)) {
        throw new Error(
          `Duplicate recovery apply document identity: ${revision.documentId}`,
        );
      }
      if (revisionIds.has(revision.revisionId)) {
        throw new Error(
          `Duplicate recovery apply revision identity: ${revision.revisionId}`,
        );
      }
      documentIds.add(revision.documentId);
      revisionIds.add(revision.revisionId);
      return revision;
    },
  );

  return Object.freeze({
    schemaVersion: 1,
    compactionId: entityId<"JournalCompaction">(
      readNonEmptyString(input, "compactionId"),
    ),
    expectedSourceJournalEndByteOffset,
    expectedSafeReplayThroughByteOffset,
    contentChecksumAlgorithm: readNonEmptyString(
      input,
      "contentChecksumAlgorithm",
    ),
    sourceJournalPath: readNonEmptyString(
      input,
      "sourceJournalPath",
    ),
    nextJournalPath: readNonEmptyString(
      input,
      "nextJournalPath",
    ),
    publicationTemporaryPath: readNonEmptyString(
      input,
      "publicationTemporaryPath",
    ),
    publicationPath: readNonEmptyString(
      input,
      "publicationPath",
    ),
    revisions: Object.freeze(revisions),
  });
}
