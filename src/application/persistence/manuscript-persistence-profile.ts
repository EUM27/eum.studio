import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type ManuscriptBatchingPolicy = {
  readonly schemaVersion: 1;
  readonly maxTransactionsPerBatch: number;
  readonly maxDelayMs: number;
};

export type ManuscriptPersistenceDocumentSequence = {
  readonly documentId: EntityId<"Document">;
  readonly nextSequence: number;
  readonly baseRevisionId?: EntityId<"DocumentRevision">;
};

export type ManuscriptPersistenceProfile = {
  readonly schemaVersion: 1;
  readonly batching: ManuscriptBatchingPolicy;
  readonly documentSequences: readonly ManuscriptPersistenceDocumentSequence[];
};

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
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
      throw new Error(`Unsupported ${field} field: ${key}`);
    }
  }
}

function readSafeInteger(
  value: unknown,
  field: string,
  minimum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(
      `${field} must be a safe integer greater than or equal to ${minimum}`,
    );
  }
  return value;
}

export function parseManuscriptBatchingPolicy(
  value: unknown,
): ManuscriptBatchingPolicy {
  const input = readRecord(value, "manuscriptBatchingPolicy");
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "maxTransactionsPerBatch",
      "maxDelayMs",
    ],
    "manuscriptBatchingPolicy",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "manuscriptBatchingPolicy.schemaVersion must be 1",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    maxTransactionsPerBatch: readSafeInteger(
      input.maxTransactionsPerBatch,
      "maxTransactionsPerBatch",
      1,
    ),
    maxDelayMs: readSafeInteger(
      input.maxDelayMs,
      "maxDelayMs",
      0,
    ),
  });
}

export function parseManuscriptPersistenceProfile(
  value: unknown,
): ManuscriptPersistenceProfile | null {
  if (value === null) {
    return null;
  }
  const input = readRecord(
    value,
    "manuscriptPersistenceProfile",
  );
  assertOnlyFields(
    input,
    ["schemaVersion", "batching", "documentSequences"],
    "manuscriptPersistenceProfile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "manuscriptPersistenceProfile.schemaVersion must be 1",
    );
  }
  if (
    !Array.isArray(input.documentSequences) ||
    input.documentSequences.length === 0
  ) {
    throw new Error(
      "documentSequences must be a non-empty array",
    );
  }

  const documentIds = new Set<EntityId<"Document">>();
  const documentSequences = input.documentSequences.map(
    (value, index) => {
      const sequence = readRecord(
        value,
        `documentSequences[${index}]`,
      );
      assertOnlyFields(
        sequence,
        ["documentId", "nextSequence", "baseRevisionId"],
        `documentSequences[${index}]`,
      );
      if (
        typeof sequence.documentId !== "string" ||
        sequence.documentId.length === 0
      ) {
        throw new Error(
          `documentSequences[${index}].documentId must be a non-empty string`,
        );
      }
      const documentId = entityId<"Document">(
        sequence.documentId,
      );
      if (documentIds.has(documentId)) {
        throw new Error(
          `Duplicate persistence document identity: ${documentId}`,
        );
      }
      documentIds.add(documentId);
      if (sequence.baseRevisionId !== undefined &&
        (typeof sequence.baseRevisionId !== "string" || sequence.baseRevisionId.length === 0)) {
        throw new Error(`documentSequences[${index}].baseRevisionId must be a non-empty string`);
      }
      return Object.freeze({
        documentId,
        ...(sequence.baseRevisionId === undefined ? {} : {
          baseRevisionId: entityId<"DocumentRevision">(sequence.baseRevisionId as string),
        }),
        nextSequence: readSafeInteger(
          sequence.nextSequence,
          `documentSequences[${index}].nextSequence`,
          0,
        ),
      });
    },
  );

  return Object.freeze({
    schemaVersion: 1,
    batching: parseManuscriptBatchingPolicy(input.batching),
    documentSequences: Object.freeze(documentSequences),
  });
}
