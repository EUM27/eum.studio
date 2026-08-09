import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import {
  ChangeBatchApplicationConflictError,
  applyChangeBatch,
} from "./apply-change-batch";
import {
  classifyChangeBatchIdentity,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
  type ChangeBatch,
} from "./change-batch";

export type DurableSaveTarget = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly nextSequence: number;
  readonly text: string;
};

export type DurableJournalAppendReceipt = {
  readonly frameStartByteOffset: number;
  readonly frameEndByteOffset: number;
  readonly frameByteLength: number;
};

type SaveReceiptIdentity = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly batchId: EntityId<"ChangeBatch">;
  readonly sequence: number;
};

export type JournalSaveReceipt =
  SaveReceiptIdentity &
  DurableJournalAppendReceipt;

export type RevisionSaveReceipt =
  SaveReceiptIdentity & {
    readonly revisionId:
      EntityId<"DocumentRevision">;
  };

export type SaveReceipt =
  | JournalSaveReceipt
  | RevisionSaveReceipt;

function readReceiptRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("SaveReceipt must be an object");
  }
  return value as Record<string, unknown>;
}

function readReceiptIdentity<TEntity extends string>(
  value: unknown,
  field: string,
): EntityId<TEntity> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`SaveReceipt.${field} must be a non-empty string`);
  }
  return entityId<TEntity>(value);
}

function readReceiptInteger(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `SaveReceipt.${field} must be a non-negative safe integer`,
    );
  }
  return value;
}

export function parseSaveReceipt(value: unknown): SaveReceipt {
  const input = readReceiptRecord(value);
  const identityFields = [
    "workId",
    "documentId",
    "baseRevisionId",
    "batchId",
    "sequence",
  ] as const;
  const isRevisionReceipt =
    Object.hasOwn(input, "revisionId");
  const fields = isRevisionReceipt
    ? [...identityFields, "revisionId"]
    : [
        ...identityFields,
        "frameStartByteOffset",
        "frameEndByteOffset",
        "frameByteLength",
      ];
  const allowedFields = new Set<string>(fields);
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw new Error(`Unsupported SaveReceipt field: ${field}`);
    }
  }

  const identity = {
    workId: readReceiptIdentity<"Work">(
      input.workId,
      "workId",
    ),
    documentId: readReceiptIdentity<"Document">(
      input.documentId,
      "documentId",
    ),
    baseRevisionId: readReceiptIdentity<"DocumentRevision">(
      input.baseRevisionId,
      "baseRevisionId",
    ),
    batchId: readReceiptIdentity<"ChangeBatch">(
      input.batchId,
      "batchId",
    ),
    sequence: readReceiptInteger(input.sequence, "sequence"),
  };
  if (isRevisionReceipt) {
    return Object.freeze({
      ...identity,
      revisionId:
        readReceiptIdentity<"DocumentRevision">(
          input.revisionId,
          "revisionId",
        ),
    });
  }

  const frameStartByteOffset = readReceiptInteger(
    input.frameStartByteOffset,
    "frameStartByteOffset",
  );
  const frameEndByteOffset = readReceiptInteger(
    input.frameEndByteOffset,
    "frameEndByteOffset",
  );
  const frameByteLength = readReceiptInteger(
    input.frameByteLength,
    "frameByteLength",
  );
  if (
    frameByteLength === 0 ||
    !Number.isSafeInteger(
      frameStartByteOffset + frameByteLength,
    ) ||
    frameStartByteOffset + frameByteLength !==
      frameEndByteOffset
  ) {
    throw new Error(
      "SaveReceipt frame byte range is inconsistent",
    );
  }
  return Object.freeze({
    ...identity,
    frameStartByteOffset,
    frameEndByteOffset,
    frameByteLength,
  });
}

export type ChangeBatchTargetValidator = {
  execute(batch: ChangeBatch): Promise<ChangeBatch>;
};

export type SaveChangeBatchStage =
  | "target-validated"
  | "before-journal-append";

type MutableSaveTarget = {
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  baseRevisionId: EntityId<"DocumentRevision">;
  nextSequence: number;
  text: string;
};

type AcceptedBatch = {
  readonly batch: ChangeBatch;
  readonly receipt: SaveReceipt;
};

export class DurableChangeBatchSaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DurableChangeBatchSaveConflictError";
  }
}

export class SaveChangeBatch {
  readonly #targetsByDocument = new Map<
    EntityId<"Document">,
    MutableSaveTarget
  >();
  readonly #acceptedByBatchId = new Map<
    EntityId<"ChangeBatch">,
    AcceptedBatch
  >();
  readonly #validateTarget: ChangeBatchTargetValidator;
  readonly #appendPayload: (
    payload: Uint8Array,
  ) => Promise<DurableJournalAppendReceipt>;
  readonly #onStage:
    | ((
        stage: SaveChangeBatchStage,
        batch: ChangeBatch,
      ) => Promise<void>)
    | undefined;
  #pending: Promise<void> = Promise.resolve();

  constructor(input: {
    readonly targets: readonly DurableSaveTarget[];
    readonly validateTarget: ChangeBatchTargetValidator;
    readonly appendPayload: (
      payload: Uint8Array,
    ) => Promise<DurableJournalAppendReceipt>;
    readonly onStage?: (
      stage: SaveChangeBatchStage,
      batch: ChangeBatch,
    ) => Promise<void>;
  }) {
    this.#validateTarget = input.validateTarget;
    this.#appendPayload = input.appendPayload;
    this.#onStage = input.onStage;

    for (const target of input.targets) {
      if (
        !Number.isSafeInteger(target.nextSequence) ||
        target.nextSequence < 0
      ) {
        throw new Error(
          `Invalid next journal sequence for document ${target.documentId}`,
        );
      }
      if (this.#targetsByDocument.has(target.documentId)) {
        throw new Error(
          `Duplicate durable save document: ${target.documentId}`,
        );
      }
      this.#targetsByDocument.set(target.documentId, {
        ...target,
      });
    }
  }

  execute(value: unknown): Promise<SaveReceipt> {
    const execution = this.#pending.then(() =>
      this.#executeSerially(value),
    );
    this.#pending = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  async #executeSerially(value: unknown): Promise<SaveReceipt> {
    const batch = parseChangeBatch(value);
    const accepted = this.#acceptedByBatchId.get(batch.batchId);
    if (accepted !== undefined) {
      if (
        classifyChangeBatchIdentity(
          accepted.batch,
          batch,
        ) === "duplicate"
      ) {
        return accepted.receipt;
      }
      throw new DurableChangeBatchSaveConflictError(
        `Batch identity conflict: ${batch.batchId}`,
      );
    }

    const target = this.#targetsByDocument.get(batch.documentId);
    if (target === undefined) {
      throw new DurableChangeBatchSaveConflictError(
        `Unknown durable save document: ${batch.documentId}`,
      );
    }
    if (target.workId !== batch.workId) {
      throw new DurableChangeBatchSaveConflictError(
        `Work/document boundary violation: ${batch.workId}/${batch.documentId}`,
      );
    }
    if (target.baseRevisionId !== batch.baseRevisionId) {
      throw new DurableChangeBatchSaveConflictError(
        `Base revision conflict for document ${batch.documentId}`,
      );
    }
    if (batch.sequence > target.nextSequence) {
      throw new DurableChangeBatchSaveConflictError(
        `Sequence gap for document ${batch.documentId}: expected ${target.nextSequence}, received ${batch.sequence}`,
      );
    }
    if (batch.sequence < target.nextSequence) {
      throw new DurableChangeBatchSaveConflictError(
        `Stale sequence for document ${batch.documentId}: expected ${target.nextSequence}, received ${batch.sequence}`,
      );
    }
    if (!Number.isSafeInteger(batch.sequence + 1)) {
      throw new DurableChangeBatchSaveConflictError(
        `Sequence cannot advance for document ${batch.documentId}`,
      );
    }

    let nextText: string;
    try {
      nextText = applyChangeBatch(target.text, batch);
    } catch (error) {
      if (!(error instanceof ChangeBatchApplicationConflictError)) {
        throw error;
      }
      throw new DurableChangeBatchSaveConflictError(error.message);
    }

    await this.#validateTarget.execute(batch);
    if (this.#onStage !== undefined) {
      await this.#onStage(
        "target-validated",
        batch,
      );
    }
    const payload =
      serializeCanonicalChangeBatch(batch);
    if (this.#onStage !== undefined) {
      await this.#onStage(
        "before-journal-append",
        batch,
      );
    }
    const appendReceipt = await this.#appendPayload(
      payload,
    );
    const receipt = Object.freeze({
      workId: batch.workId,
      documentId: batch.documentId,
      baseRevisionId: batch.baseRevisionId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      frameStartByteOffset:
        appendReceipt.frameStartByteOffset,
      frameEndByteOffset: appendReceipt.frameEndByteOffset,
      frameByteLength: appendReceipt.frameByteLength,
    });

    target.text = nextText;
    target.nextSequence = batch.sequence + 1;
    this.#acceptedByBatchId.set(batch.batchId, {
      batch,
      receipt,
    });
    return receipt;
  }
}
