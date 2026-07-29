import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import type {
  StartupRecoveryAffectedDocument,
  StartupRecoveryCandidate,
  StartupRecoveryIssue,
  StartupRecoveryState,
} from "./prepare-startup-recovery";

export type StartupRecoveryCandidateProjection = {
  readonly sourceJournalEndByteOffset: number;
  readonly checksumVerifiedPrefixByteLength: number;
  readonly safeReplayThroughByteOffset: number;
  readonly affectedDocuments:
    readonly StartupRecoveryAffectedDocument[];
  readonly appliedBatchIds:
    readonly EntityId<"ChangeBatch">[];
  readonly duplicateBatchIds:
    readonly EntityId<"ChangeBatch">[];
  readonly issues:
    readonly StartupRecoveryProjectionIssue[];
};

export type StartupRecoveryProjectionIssue =
  | StartupRecoveryIssue
  | {
      readonly source: "journal-read";
      readonly reason: string;
    }
  | {
      readonly source:
        "compaction-publication";
      readonly reason: string;
    };

export type StartupRecoveryProjection =
  | {
      readonly schemaVersion: 1;
      readonly status: "clean";
      readonly issues:
        readonly StartupRecoveryProjectionIssue[];
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "recovery-pending";
      readonly applyAvailable: boolean;
      readonly candidate:
        StartupRecoveryCandidateProjection;
      readonly issues:
        readonly StartupRecoveryProjectionIssue[];
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "read-only-error";
      readonly issues:
        readonly StartupRecoveryProjectionIssue[];
    };

export type ApplyStartupRecoveryAcknowledgement = {
  readonly schemaVersion: 1;
  readonly status: "applied";
  readonly compactionId:
    EntityId<"JournalCompaction">;
  readonly consumedThroughByteOffset: number;
  readonly reclamation: "completed" | "pending";
};

export type ApplyStartupRecoveryDocument = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly expectedBaseRevisionId:
    EntityId<"DocumentRevision">;
  readonly expectedNextSequence: number;
};

export type ApplyStartupRecoveryCommand = {
  readonly schemaVersion: 1;
  readonly expectedSourceJournalEndByteOffset: number;
  readonly expectedSafeReplayThroughByteOffset: number;
  readonly documents:
    readonly ApplyStartupRecoveryDocument[];
};

export type StartupRecoveryApprovalSource =
  Pick<
    StartupRecoveryCandidate,
    | "sourceJournalEndByteOffset"
    | "safeReplayThroughByteOffset"
    | "affectedDocuments"
  >;

export class StartupRecoveryCandidateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "StartupRecoveryCandidateConflictError";
  }
}

function freezeIssues(
  issues: readonly StartupRecoveryProjectionIssue[],
): readonly StartupRecoveryProjectionIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({ ...issue }),
    ),
  );
}

function projectCandidate(
  candidate: StartupRecoveryCandidate,
): StartupRecoveryCandidateProjection {
  const issues = freezeIssues(candidate.issues);
  return Object.freeze({
    sourceJournalEndByteOffset:
      candidate.sourceJournalEndByteOffset,
    checksumVerifiedPrefixByteLength:
      candidate.checksumVerifiedPrefixByteLength,
    safeReplayThroughByteOffset:
      candidate.safeReplayThroughByteOffset,
    affectedDocuments: Object.freeze(
      candidate.affectedDocuments.map((document) =>
        Object.freeze({ ...document }),
      ),
    ),
    appliedBatchIds: Object.freeze([
      ...candidate.appliedBatchIds,
    ]),
    duplicateBatchIds: Object.freeze([
      ...candidate.duplicateBatchIds,
    ]),
    issues,
  });
}

export function projectStartupRecovery(
  state: StartupRecoveryState,
  applyAvailable: boolean,
): StartupRecoveryProjection {
  if (state.status === "clean") {
    return Object.freeze({
      schemaVersion: 1,
      status: "clean",
      issues: freezeIssues(state.issues),
    });
  }
  if (state.status === "read-only-error") {
    return Object.freeze({
      schemaVersion: 1,
      status: "read-only-error",
      issues: freezeIssues(state.issues),
    });
  }
  const candidate = projectCandidate(
    state.candidate,
  );
  return Object.freeze({
    schemaVersion: 1,
    status: "recovery-pending",
    applyAvailable,
    candidate,
    issues: candidate.issues,
  });
}

function documentCommandFrom(
  document: StartupRecoveryAffectedDocument,
): ApplyStartupRecoveryDocument {
  return Object.freeze({
    workId: document.workId,
    documentId: document.documentId,
    expectedBaseRevisionId:
      document.baseRevisionId,
    expectedNextSequence: document.nextSequence,
  });
}

export function createApplyStartupRecoveryCommand(
  candidate: StartupRecoveryApprovalSource,
): ApplyStartupRecoveryCommand {
  return Object.freeze({
    schemaVersion: 1,
    expectedSourceJournalEndByteOffset:
      candidate.sourceJournalEndByteOffset,
    expectedSafeReplayThroughByteOffset:
      candidate.safeReplayThroughByteOffset,
    documents: Object.freeze(
      candidate.affectedDocuments.map(
        documentCommandFrom,
      ),
    ),
  });
}

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
  fields: readonly string[],
  field: string,
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
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

function readSafeInteger(
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

function readOptionalSafeInteger(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  if (!(field in record)) {
    return undefined;
  }
  return readSafeInteger(record, field);
}

function readOptionalEntityId<
  TEntity extends string,
>(
  record: Record<string, unknown>,
  field: string,
): EntityId<TEntity> | undefined {
  if (!(field in record)) {
    return undefined;
  }
  return entityId<TEntity>(
    readNonEmptyString(record, field),
  );
}

function parseProjectionIssue(
  value: unknown,
  index: number,
): StartupRecoveryProjectionIssue {
  const field = `issues[${index}]`;
  const input = readRecord(value, field);
  const source = readNonEmptyString(
    input,
    "source",
  );
  if (source === "journal-frame-tail") {
    assertOnlyFields(
      input,
      [
        "source",
        "byteOffset",
        "byteLength",
        "reason",
      ],
      field,
    );
    return Object.freeze({
      source,
      byteOffset: readSafeInteger(
        input,
        "byteOffset",
      ),
      byteLength: readSafeInteger(
        input,
        "byteLength",
      ),
      reason: readNonEmptyString(
        input,
        "reason",
      ),
    });
  }
  if (source === "compaction-publication") {
    assertOnlyFields(
      input,
      ["source", "reason"],
      field,
    );
    return Object.freeze({
      source,
      reason: readNonEmptyString(
        input,
        "reason",
      ),
    });
  }
  if (source === "journal-read") {
    assertOnlyFields(
      input,
      ["source", "reason"],
      field,
    );
    return Object.freeze({
      source,
      reason: readNonEmptyString(
        input,
        "reason",
      ),
    });
  }
  if (source === "journal-replay") {
    assertOnlyFields(
      input,
      [
        "source",
        "recordIndex",
        "reason",
        "batchId",
        "documentId",
        "expectedSequence",
        "receivedSequence",
      ],
      field,
    );
    const batchId =
      readOptionalEntityId<"ChangeBatch">(
        input,
        "batchId",
      );
    const documentId =
      readOptionalEntityId<"Document">(
        input,
        "documentId",
      );
    const expectedSequence =
      readOptionalSafeInteger(
        input,
        "expectedSequence",
      );
    const receivedSequence =
      readOptionalSafeInteger(
        input,
        "receivedSequence",
      );
    return Object.freeze({
      source,
      recordIndex: readSafeInteger(
        input,
        "recordIndex",
      ),
      reason: readNonEmptyString(
        input,
        "reason",
      ) as Extract<
        StartupRecoveryIssue,
        { readonly source: "journal-replay" }
      >["reason"],
      ...(batchId === undefined
        ? {}
        : { batchId }),
      ...(documentId === undefined
        ? {}
        : { documentId }),
      ...(expectedSequence === undefined
        ? {}
        : { expectedSequence }),
      ...(receivedSequence === undefined
        ? {}
        : { receivedSequence }),
    });
  }
  throw new Error(
    `Unsupported ${field} source: ${source}`,
  );
}

function parseProjectionIssues(
  value: unknown,
): readonly StartupRecoveryProjectionIssue[] {
  if (!Array.isArray(value)) {
    throw new Error("issues must be an array");
  }
  return Object.freeze(
    value.map(parseProjectionIssue),
  );
}

function parseAffectedDocument(
  value: unknown,
  index: number,
): StartupRecoveryAffectedDocument {
  const field = `affectedDocuments[${index}]`;
  const input = readRecord(value, field);
  assertOnlyFields(
    input,
    [
      "workId",
      "documentId",
      "baseRevisionId",
      "recoveredText",
      "nextSequence",
    ],
    field,
  );
  const recoveredText = input.recoveredText;
  if (typeof recoveredText !== "string") {
    throw new Error(
      "recoveredText must be a string",
    );
  }
  return Object.freeze({
    workId: entityId<"Work">(
      readNonEmptyString(input, "workId"),
    ),
    documentId: entityId<"Document">(
      readNonEmptyString(input, "documentId"),
    ),
    baseRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "baseRevisionId",
        ),
      ),
    recoveredText,
    nextSequence: readSafeInteger(
      input,
      "nextSequence",
    ),
  });
}

function parseEntityIdArray<
  TEntity extends string,
>(
  value: unknown,
  field: string,
): readonly EntityId<TEntity>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return Object.freeze(
    value.map((item, index) => {
      if (
        typeof item !== "string" ||
        item.length === 0
      ) {
        throw new Error(
          `${field}[${index}] must be a non-empty string`,
        );
      }
      return entityId<TEntity>(item);
    }),
  );
}

function parseCandidateProjection(
  value: unknown,
): StartupRecoveryCandidateProjection {
  const input = readRecord(
    value,
    "recoveryCandidate",
  );
  assertOnlyFields(
    input,
    [
      "sourceJournalEndByteOffset",
      "checksumVerifiedPrefixByteLength",
      "safeReplayThroughByteOffset",
      "affectedDocuments",
      "appliedBatchIds",
      "duplicateBatchIds",
      "issues",
    ],
    "recoveryCandidate",
  );
  if (
    !Array.isArray(input.affectedDocuments) ||
    input.affectedDocuments.length === 0
  ) {
    throw new Error(
      "affectedDocuments must be a non-empty array",
    );
  }
  return Object.freeze({
    sourceJournalEndByteOffset:
      readSafeInteger(
        input,
        "sourceJournalEndByteOffset",
      ),
    checksumVerifiedPrefixByteLength:
      readSafeInteger(
        input,
        "checksumVerifiedPrefixByteLength",
      ),
    safeReplayThroughByteOffset:
      readSafeInteger(
        input,
        "safeReplayThroughByteOffset",
      ),
    affectedDocuments: Object.freeze(
      input.affectedDocuments.map(
        parseAffectedDocument,
      ),
    ),
    appliedBatchIds:
      parseEntityIdArray<"ChangeBatch">(
        input.appliedBatchIds,
        "appliedBatchIds",
      ),
    duplicateBatchIds:
      parseEntityIdArray<"ChangeBatch">(
        input.duplicateBatchIds,
        "duplicateBatchIds",
      ),
    issues: parseProjectionIssues(
      input.issues,
    ),
  });
}

export function parseStartupRecoveryProjection(
  value: unknown,
): StartupRecoveryProjection {
  const input = readRecord(
    value,
    "startupRecoveryProjection",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "startupRecoveryProjection.schemaVersion must be 1",
    );
  }
  const status = input.status;
  if (
    status === "clean" ||
    status === "read-only-error"
  ) {
    assertOnlyFields(
      input,
      ["schemaVersion", "status", "issues"],
      "startupRecoveryProjection",
    );
    return Object.freeze({
      schemaVersion: 1,
      status,
      issues: parseProjectionIssues(
        input.issues,
      ),
    });
  }
  if (status === "recovery-pending") {
    assertOnlyFields(
      input,
      [
        "schemaVersion",
        "status",
        "applyAvailable",
        "candidate",
        "issues",
      ],
      "startupRecoveryProjection",
    );
    if (
      typeof input.applyAvailable !== "boolean"
    ) {
      throw new Error(
        "applyAvailable must be a boolean",
      );
    }
    return Object.freeze({
      schemaVersion: 1,
      status,
      applyAvailable: input.applyAvailable,
      candidate: parseCandidateProjection(
        input.candidate,
      ),
      issues: parseProjectionIssues(
        input.issues,
      ),
    });
  }
  throw new Error(
    `Unsupported startup recovery status: ${String(status)}`,
  );
}

export function parseApplyStartupRecoveryAcknowledgement(
  value: unknown,
): ApplyStartupRecoveryAcknowledgement {
  const input = readRecord(
    value,
    "applyStartupRecoveryAcknowledgement",
  );
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "status",
      "compactionId",
      "consumedThroughByteOffset",
      "reclamation",
    ],
    "applyStartupRecoveryAcknowledgement",
  );
  if (
    input.schemaVersion !== 1 ||
    input.status !== "applied"
  ) {
    throw new Error(
      "applyStartupRecoveryAcknowledgement must identify schema 1 applied",
    );
  }
  if (
    input.reclamation !== "completed" &&
    input.reclamation !== "pending"
  ) {
    throw new Error(
      "reclamation must be completed or pending",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "applied",
    compactionId:
      entityId<"JournalCompaction">(
        readNonEmptyString(
          input,
          "compactionId",
        ),
      ),
    consumedThroughByteOffset:
      readSafeInteger(
        input,
        "consumedThroughByteOffset",
      ),
    reclamation: input.reclamation,
  });
}

function parseCommandDocument(
  value: unknown,
  index: number,
): ApplyStartupRecoveryDocument {
  const field = `documents[${index}]`;
  const input = readRecord(value, field);
  assertOnlyFields(
    input,
    [
      "workId",
      "documentId",
      "expectedBaseRevisionId",
      "expectedNextSequence",
    ],
    field,
  );
  return Object.freeze({
    workId: entityId<"Work">(
      readNonEmptyString(input, "workId"),
    ),
    documentId: entityId<"Document">(
      readNonEmptyString(input, "documentId"),
    ),
    expectedBaseRevisionId:
      entityId<"DocumentRevision">(
        readNonEmptyString(
          input,
          "expectedBaseRevisionId",
        ),
      ),
    expectedNextSequence: readSafeInteger(
      input,
      "expectedNextSequence",
    ),
  });
}

export function parseApplyStartupRecoveryCommand(
  value: unknown,
): ApplyStartupRecoveryCommand {
  const input = readRecord(
    value,
    "applyStartupRecoveryCommand",
  );
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "expectedSourceJournalEndByteOffset",
      "expectedSafeReplayThroughByteOffset",
      "documents",
    ],
    "applyStartupRecoveryCommand",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "applyStartupRecoveryCommand.schemaVersion must be 1",
    );
  }
  if (
    !Array.isArray(input.documents) ||
    input.documents.length === 0
  ) {
    throw new Error(
      "documents must be a non-empty array",
    );
  }

  const documentIds = new Set<
    EntityId<"Document">
  >();
  const documents = input.documents.map(
    (value, index) => {
      const document = parseCommandDocument(
        value,
        index,
      );
      if (documentIds.has(document.documentId)) {
        throw new Error(
          `Duplicate recovery approval document: ${document.documentId}`,
        );
      }
      documentIds.add(document.documentId);
      return document;
    },
  );
  return Object.freeze({
    schemaVersion: 1,
    expectedSourceJournalEndByteOffset:
      readSafeInteger(
        input,
        "expectedSourceJournalEndByteOffset",
      ),
    expectedSafeReplayThroughByteOffset:
      readSafeInteger(
        input,
        "expectedSafeReplayThroughByteOffset",
      ),
    documents: Object.freeze(documents),
  });
}

export function assertApplyStartupRecoveryMatchesCandidate(
  command: ApplyStartupRecoveryCommand,
  candidate: StartupRecoveryCandidate,
): void {
  if (
    command.expectedSourceJournalEndByteOffset !==
      candidate.sourceJournalEndByteOffset ||
    command.expectedSafeReplayThroughByteOffset !==
      candidate.safeReplayThroughByteOffset ||
    command.documents.length !==
      candidate.affectedDocuments.length
  ) {
    throw new StartupRecoveryCandidateConflictError(
      "Recovery approval does not identify the current candidate",
    );
  }
  for (
    let index = 0;
    index < command.documents.length;
    index += 1
  ) {
    const approved = command.documents[index];
    const current =
      candidate.affectedDocuments[index];
    if (
      approved === undefined ||
      current === undefined ||
      approved.workId !== current.workId ||
      approved.documentId !==
        current.documentId ||
      approved.expectedBaseRevisionId !==
        current.baseRevisionId ||
      approved.expectedNextSequence !==
        current.nextSequence
    ) {
      throw new StartupRecoveryCandidateConflictError(
        "Recovery approval document tuple does not identify the current candidate",
      );
    }
  }
}
