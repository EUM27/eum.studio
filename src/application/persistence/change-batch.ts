import {
  entityId,
  type EntityId,
  type Instant,
} from "../../domain/writing";

export const DURABLE_TEXT_REPRESENTATION_V1 = Object.freeze({
  schemaVersion: 1,
  offsetUnit: "utf-16-code-unit",
  lineEnding: "lf",
  unicodeNormalization: "none",
  hashAndAnchorInputEncoding: "utf-16le",
} as const);

export type DurableTextRepresentation =
  typeof DURABLE_TEXT_REPRESENTATION_V1;

export type ChangeBatchChange = {
  readonly fromUtf16: number;
  readonly toUtf16: number;
  readonly insertedText: string;
};

export type ChangeBatch = {
  readonly schemaVersion: 1;
  readonly textRepresentation: DurableTextRepresentation;
  readonly batchId: EntityId<"ChangeBatch">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly baseRevisionId: EntityId<"DocumentRevision">;
  readonly sequence: number;
  readonly createdAt: Instant;
  readonly beforeTextLengthUtf16: number;
  readonly afterTextLengthUtf16: number;
  readonly changes: readonly ChangeBatchChange[];
};

function assertOnlyFields(
  record: Record<string, unknown>,
  allowedFields: readonly string[],
  recordName: string,
): void {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      throw new Error(`Unsupported ${recordName} field: ${field}`);
    }
  }
}

function readRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function readNonNegativeSafeInteger(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative safe integer`,
    );
  }
  return value;
}

function readAbsoluteInstant(
  value: unknown,
  fieldName: string,
): Instant {
  const instant = readString(value, fieldName);
  if (
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(instant) ||
    !Number.isFinite(Date.parse(instant))
  ) {
    throw new Error(`${fieldName} must include an absolute timezone`);
  }
  return new Date(instant).toISOString();
}

function assertCanonicalText(text: string, fieldName: string): void {
  if (text.includes("\r")) {
    throw new Error(`${fieldName} must use LF line endings`);
  }
}

function readTextRepresentation(
  value: unknown,
): DurableTextRepresentation {
  const representation = readRecord(
    value,
    "textRepresentation",
  );
  const expected = DURABLE_TEXT_REPRESENTATION_V1;
  assertOnlyFields(
    representation,
    Object.keys(expected),
    "textRepresentation",
  );

  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (representation[key] !== expected[key]) {
      throw new Error(
        `Unsupported textRepresentation.${key}: ${String(
          representation[key],
        )}`,
      );
    }
  }

  return expected;
}

function readChanges(
  value: unknown,
  beforeTextLengthUtf16: number,
  afterTextLengthUtf16: number,
): readonly ChangeBatchChange[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("changes must contain at least one text change");
  }

  const changes: ChangeBatchChange[] = [];
  let expectedAfterLength = beforeTextLengthUtf16;
  let previousFrom = 0;
  let previousTo = 0;

  for (const [index, candidate] of value.entries()) {
    const change = readRecord(candidate, `changes[${index}]`);
    assertOnlyFields(
      change,
      ["fromUtf16", "toUtf16", "insertedText"],
      `changes[${index}]`,
    );
    const fromUtf16 = readNonNegativeSafeInteger(
      change.fromUtf16,
      `changes[${index}].fromUtf16`,
    );
    const toUtf16 = readNonNegativeSafeInteger(
      change.toUtf16,
      `changes[${index}].toUtf16`,
    );
    const insertedText =
      typeof change.insertedText === "string"
        ? change.insertedText
        : (() => {
            throw new Error(
              `changes[${index}].insertedText must be a string`,
            );
          })();

    assertCanonicalText(
      insertedText,
      `changes[${index}].insertedText`,
    );
    if (fromUtf16 > toUtf16) {
      throw new Error(
        `changes[${index}] has an inverted UTF-16 range`,
      );
    }
    if (toUtf16 > beforeTextLengthUtf16) {
      throw new Error(
        `changes[${index}] exceeds beforeTextLengthUtf16`,
      );
    }
    if (
      index > 0 &&
      (fromUtf16 < previousFrom || fromUtf16 < previousTo)
    ) {
      throw new Error(
        `changes[${index}] is not ordered or overlaps a prior change`,
      );
    }
    if (fromUtf16 === toUtf16 && insertedText.length === 0) {
      throw new Error(`changes[${index}] must not be a no-op`);
    }

    expectedAfterLength +=
      insertedText.length - (toUtf16 - fromUtf16);
    if (
      !Number.isSafeInteger(expectedAfterLength) ||
      expectedAfterLength < 0
    ) {
      throw new Error(
        "changes produce a non-representable UTF-16 length",
      );
    }

    changes.push(
      Object.freeze({
        fromUtf16,
        toUtf16,
        insertedText,
      }),
    );
    previousFrom = fromUtf16;
    previousTo = toUtf16;
  }

  if (expectedAfterLength !== afterTextLengthUtf16) {
    throw new Error(
      "afterTextLengthUtf16 does not match the ordered changes",
    );
  }

  return Object.freeze(changes);
}

export function encodeDurableText(text: string): Uint8Array {
  assertCanonicalText(text, "Durable text");

  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    bytes[index * 2] = codeUnit & 0xff;
    bytes[index * 2 + 1] = codeUnit >>> 8;
  }
  return bytes;
}

export function parseChangeBatch(value: unknown): ChangeBatch {
  const input = readRecord(value, "ChangeBatch");
  assertOnlyFields(
    input,
    [
      "schemaVersion",
      "textRepresentation",
      "batchId",
      "workId",
      "documentId",
      "baseRevisionId",
      "sequence",
      "createdAt",
      "beforeTextLengthUtf16",
      "afterTextLengthUtf16",
      "changes",
    ],
    "ChangeBatch",
  );
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ChangeBatch schemaVersion: ${String(
        input.schemaVersion,
      )}`,
    );
  }

  const beforeTextLengthUtf16 = readNonNegativeSafeInteger(
    input.beforeTextLengthUtf16,
    "beforeTextLengthUtf16",
  );
  const afterTextLengthUtf16 = readNonNegativeSafeInteger(
    input.afterTextLengthUtf16,
    "afterTextLengthUtf16",
  );

  return Object.freeze({
    schemaVersion: 1,
    textRepresentation: readTextRepresentation(
      input.textRepresentation,
    ),
    batchId: entityId<"ChangeBatch">(
      readString(input.batchId, "batchId"),
    ),
    workId: entityId<"Work">(
      readString(input.workId, "workId"),
    ),
    documentId: entityId<"Document">(
      readString(input.documentId, "documentId"),
    ),
    baseRevisionId: entityId<"DocumentRevision">(
      readString(input.baseRevisionId, "baseRevisionId"),
    ),
    sequence: readNonNegativeSafeInteger(
      input.sequence,
      "sequence",
    ),
    createdAt: readAbsoluteInstant(input.createdAt, "createdAt"),
    beforeTextLengthUtf16,
    afterTextLengthUtf16,
    changes: readChanges(
      input.changes,
      beforeTextLengthUtf16,
      afterTextLengthUtf16,
    ),
  });
}

export function serializeCanonicalChangeBatch(
  value: ChangeBatch,
): Uint8Array {
  const batch = parseChangeBatch(value);
  const representation = batch.textRepresentation;
  const canonicalRecord = [
    "change-batch",
    batch.schemaVersion,
    [
      representation.schemaVersion,
      representation.offsetUnit,
      representation.lineEnding,
      representation.unicodeNormalization,
      representation.hashAndAnchorInputEncoding,
    ],
    batch.batchId,
    batch.workId,
    batch.documentId,
    batch.baseRevisionId,
    batch.sequence,
    batch.createdAt,
    batch.beforeTextLengthUtf16,
    batch.afterTextLengthUtf16,
    batch.changes.map((change) => [
      change.fromUtf16,
      change.toUtf16,
      change.insertedText,
    ]),
  ];

  return new TextEncoder().encode(JSON.stringify(canonicalRecord));
}

function equalCanonicalBytes(
  first: Uint8Array,
  second: Uint8Array,
): boolean {
  if (first.byteLength !== second.byteLength) {
    return false;
  }
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

export function parseCanonicalChangeBatch(
  sourceBytes: Uint8Array,
): ChangeBatch {
  const source = new Uint8Array(sourceBytes);
  let record: unknown;
  try {
    record = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(source),
    );
  } catch {
    throw new Error("Invalid canonical ChangeBatch bytes");
  }
  if (!Array.isArray(record) || record.length !== 12) {
    throw new Error("Invalid canonical ChangeBatch record");
  }
  if (record[0] !== "change-batch") {
    throw new Error("Invalid canonical ChangeBatch record type");
  }

  const representation = record[2];
  if (
    !Array.isArray(representation) ||
    representation.length !== 5
  ) {
    throw new Error(
      "Invalid canonical ChangeBatch text representation",
    );
  }
  const changes = record[11];
  if (!Array.isArray(changes)) {
    throw new Error("Invalid canonical ChangeBatch changes");
  }

  const batch = parseChangeBatch({
    schemaVersion: record[1],
    textRepresentation: {
      schemaVersion: representation[0],
      offsetUnit: representation[1],
      lineEnding: representation[2],
      unicodeNormalization: representation[3],
      hashAndAnchorInputEncoding: representation[4],
    },
    batchId: record[3],
    workId: record[4],
    documentId: record[5],
    baseRevisionId: record[6],
    sequence: record[7],
    createdAt: record[8],
    beforeTextLengthUtf16: record[9],
    afterTextLengthUtf16: record[10],
    changes: changes.map((change) =>
      Array.isArray(change) && change.length === 3
        ? {
            fromUtf16: change[0],
            toUtf16: change[1],
            insertedText: change[2],
          }
        : change,
    ),
  });
  if (
    !equalCanonicalBytes(
      serializeCanonicalChangeBatch(batch),
      source,
    )
  ) {
    throw new Error("ChangeBatch bytes are not canonical");
  }
  return batch;
}

export type ChangeBatchIdentityClassification =
  | "distinct"
  | "duplicate"
  | "conflict";

export function classifyChangeBatchIdentity(
  accepted: ChangeBatch,
  candidate: ChangeBatch,
): ChangeBatchIdentityClassification {
  if (accepted.batchId !== candidate.batchId) {
    return "distinct";
  }

  const acceptedBytes = serializeCanonicalChangeBatch(accepted);
  const candidateBytes = serializeCanonicalChangeBatch(candidate);
  return equalCanonicalBytes(acceptedBytes, candidateBytes)
    ? "duplicate"
    : "conflict";
}
