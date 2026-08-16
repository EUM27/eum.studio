import { entityId, type EntityId } from "../../domain/writing";

export type ContinuousReadingLocation = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly textOffset: number;
};

export type GetContinuousReadingProgressCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveContinuousReadingProgressCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly expectedRevision: number;
  readonly location: ContinuousReadingLocation | null;
};

export type WorkContinuousReadingProgressProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly location: ContinuousReadingLocation | null;
};

export type ContinuousReadingDocument = {
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly title: string;
  readonly text: string;
};

export type ContinuousReadingSession = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly status: "empty" | "fresh" | "restored" | "stale";
  readonly initialLoadedCount: number;
  readonly initialLocation: ContinuousReadingLocation | null;
  readonly documents: readonly ContinuousReadingDocument[];
};

export type ContinuousReadingLine = {
  readonly textOffset: number;
  readonly text: string;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function readSchemaVersion(value: unknown, label: string): 1 {
  if (value !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  return 1;
}

function readRevision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function readEntityId<T extends string>(
  value: unknown,
  label: string,
): EntityId<T> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return entityId<T>(value);
}

function parseContinuousReadingLocation(
  value: unknown,
): ContinuousReadingLocation | null {
  if (value === null) return null;
  const record = readRecord(value, "Continuous reading location");
  assertExactFields(
    record,
    ["documentId", "documentRevisionId", "textOffset"],
    "Continuous reading location",
  );
  return Object.freeze({
    documentId: readEntityId<"Document">(
      record.documentId,
      "Continuous reading documentId",
    ),
    documentRevisionId: readEntityId<"DocumentRevision">(
      record.documentRevisionId,
      "Continuous reading documentRevisionId",
    ),
    textOffset: readRevision(
      record.textOffset,
      "Continuous reading textOffset",
    ),
  });
}

export function createUnsetContinuousReadingProgress(): null {
  return null;
}

export function parseGetContinuousReadingProgressCommand(
  value: unknown,
): GetContinuousReadingProgressCommand {
  const record = readRecord(value, "Get continuous reading progress command");
  assertExactFields(
    record,
    ["schemaVersion", "workId"],
    "Get continuous reading progress command",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Get continuous reading progress command",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
  });
}

export function parseSaveContinuousReadingProgressCommand(
  value: unknown,
): SaveContinuousReadingProgressCommand {
  const record = readRecord(value, "Save continuous reading progress command");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "expectedRevision", "location"],
    "Save continuous reading progress command",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Save continuous reading progress command",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
    expectedRevision: readRevision(record.expectedRevision, "expectedRevision"),
    location: parseContinuousReadingLocation(record.location),
  });
}

export function parseWorkContinuousReadingProgressProjection(
  value: unknown,
): WorkContinuousReadingProgressProjection {
  const record = readRecord(value, "Continuous reading progress projection");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "revision", "location"],
    "Continuous reading progress projection",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Continuous reading progress projection",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
    revision: readRevision(record.revision, "revision"),
    location: parseContinuousReadingLocation(record.location),
  });
}

export function splitContinuousReadingLines(
  text: string,
): readonly ContinuousReadingLine[] {
  const lines = text.split("\n");
  let textOffset = 0;
  return Object.freeze(
    lines.map((line, index) => {
      const result = Object.freeze({ textOffset, text: line });
      textOffset += line.length + (index < lines.length - 1 ? 1 : 0);
      return result;
    }),
  );
}

export function deriveContinuousReadingSession(input: {
  readonly workId: EntityId<"Work">;
  readonly documents: readonly ContinuousReadingDocument[];
  readonly progress: WorkContinuousReadingProgressProjection;
}): ContinuousReadingSession {
  if (input.progress.workId !== input.workId) {
    throw new Error(`Continuous reading progress is outside Work ${input.workId}`);
  }
  const documentIds = new Set<string>();
  for (const document of input.documents) {
    if (document.workId !== input.workId) {
      throw new Error(`Continuous reading Document is outside Work: ${document.documentId}`);
    }
    if (documentIds.has(document.documentId)) {
      throw new Error(`Duplicate continuous reading Document: ${document.documentId}`);
    }
    documentIds.add(document.documentId);
  }

  if (input.documents.length === 0) {
    return Object.freeze({
      schemaVersion: 1,
      workId: input.workId,
      status: "empty",
      initialLoadedCount: 0,
      initialLocation: null,
      documents: input.documents,
    });
  }
  const location = input.progress.location;
  if (location === null) {
    return Object.freeze({
      schemaVersion: 1,
      workId: input.workId,
      status: "fresh",
      initialLoadedCount: 1,
      initialLocation: null,
      documents: input.documents,
    });
  }

  const documentIndex = input.documents.findIndex(
    (document) => document.documentId === location.documentId,
  );
  const document = input.documents[documentIndex];
  const isExactLocation =
    document !== undefined &&
    document.documentRevisionId === location.documentRevisionId &&
    splitContinuousReadingLines(document.text).some(
      (line) => line.textOffset === location.textOffset,
    );
  if (!isExactLocation) {
    return Object.freeze({
      schemaVersion: 1,
      workId: input.workId,
      status: "stale",
      initialLoadedCount: 1,
      initialLocation: null,
      documents: input.documents,
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    workId: input.workId,
    status: "restored",
    initialLoadedCount: documentIndex + 1,
    initialLocation: location,
    documents: input.documents,
  });
}
