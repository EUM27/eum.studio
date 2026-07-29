import {
  entityId,
  type EntityId,
} from "../domain/writing";

export type ManuscriptJournalDocumentSequence = {
  readonly documentId: EntityId<"Document">;
  readonly nextSequence: number;
};

export type ManuscriptJournalRuntimeProfile = {
  readonly schemaVersion: 1;
  readonly journalPath: string;
  readonly checksumAlgorithm: string;
  readonly documentSequences: readonly ManuscriptJournalDocumentSequence[];
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

function readNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function readSequence(value: unknown, field: string): number {
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

export function parseManuscriptJournalRuntimeProfile(
  value: unknown,
): ManuscriptJournalRuntimeProfile {
  const input = readRecord(
    value,
    "manuscriptJournalRuntimeProfile",
  );
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "journalPath",
      "checksumAlgorithm",
      "documentSequences",
    ],
    "manuscriptJournalRuntimeProfile",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      "manuscriptJournalRuntimeProfile.schemaVersion must be 1",
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
        ["documentId", "nextSequence"],
        `documentSequences[${index}]`,
      );
      const documentId = entityId<"Document">(
        readNonEmptyString(
          sequence.documentId,
          `documentSequences[${index}].documentId`,
        ),
      );
      if (documentIds.has(documentId)) {
        throw new Error(
          `Duplicate journal document identity: ${documentId}`,
        );
      }
      documentIds.add(documentId);
      return Object.freeze({
        documentId,
        nextSequence: readSequence(
          sequence.nextSequence,
          `documentSequences[${index}].nextSequence`,
        ),
      });
    },
  );

  return Object.freeze({
    schemaVersion: 1,
    journalPath: readNonEmptyString(
      input.journalPath,
      "journalPath",
    ),
    checksumAlgorithm: readNonEmptyString(
      input.checksumAlgorithm,
      "checksumAlgorithm",
    ),
    documentSequences: Object.freeze(documentSequences),
  });
}
