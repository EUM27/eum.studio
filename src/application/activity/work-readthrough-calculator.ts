import { entityId, type EntityId } from "../../domain/writing";

export type WorkReadthroughEntry = {
  readonly documentId: EntityId<"Document">;
  readonly readerCount: number | null;
};

export type GetWorkReadthroughCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type SaveWorkReadthroughCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly expectedRevision: number;
  readonly entries: readonly WorkReadthroughEntry[];
};

export type WorkReadthroughProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly revision: number;
  readonly entries: readonly WorkReadthroughEntry[];
};

export type WorkReadthroughRate = {
  readonly status: "baseline" | "missing" | "unavailable" | "calculated";
  readonly percent: number | null;
};

export type WorkReadthroughCalculatorProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly rows: readonly {
    readonly documentId: EntityId<"Document">;
    readonly title: string;
    readonly readerCount: number | null;
    readonly adjacentRate: WorkReadthroughRate;
    readonly firstEpisodeRate: WorkReadthroughRate;
  }[];
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

function readReaderCount(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be null or a non-negative safe integer`);
  }
  return value as number;
}

function parseEntries(value: unknown): readonly WorkReadthroughEntry[] {
  if (!Array.isArray(value)) {
    throw new Error("Work readthrough entries must be an array");
  }
  const documentIds = new Set<string>();
  return Object.freeze(
    value.map((candidate, index) => {
      const record = readRecord(candidate, `Work readthrough entry ${index}`);
      assertExactFields(
        record,
        ["documentId", "readerCount"],
        `Work readthrough entry ${index}`,
      );
      const documentId = readEntityId<"Document">(
        record.documentId,
        `Work readthrough entry ${index} documentId`,
      );
      if (documentIds.has(documentId)) {
        throw new Error(`Duplicate Work readthrough documentId: ${documentId}`);
      }
      documentIds.add(documentId);
      return Object.freeze({
        documentId,
        readerCount: readReaderCount(
          record.readerCount,
          `Work readthrough entry ${index} readerCount`,
        ),
      });
    }),
  );
}

export function createUnsetWorkReadthrough(): readonly WorkReadthroughEntry[] {
  return Object.freeze([]);
}

export function parseGetWorkReadthroughCommand(
  value: unknown,
): GetWorkReadthroughCommand {
  const record = readRecord(value, "Get Work readthrough command");
  assertExactFields(
    record,
    ["schemaVersion", "workId"],
    "Get Work readthrough command",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Get Work readthrough command",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
  });
}

export function parseSaveWorkReadthroughCommand(
  value: unknown,
): SaveWorkReadthroughCommand {
  const record = readRecord(value, "Save Work readthrough command");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "expectedRevision", "entries"],
    "Save Work readthrough command",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Save Work readthrough command",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
    expectedRevision: readRevision(record.expectedRevision, "expectedRevision"),
    entries: parseEntries(record.entries),
  });
}

export function parseWorkReadthroughProjection(
  value: unknown,
): WorkReadthroughProjection {
  const record = readRecord(value, "Work readthrough projection");
  assertExactFields(
    record,
    ["schemaVersion", "workId", "revision", "entries"],
    "Work readthrough projection",
  );
  return Object.freeze({
    schemaVersion: readSchemaVersion(
      record.schemaVersion,
      "Work readthrough projection",
    ),
    workId: readEntityId<"Work">(record.workId, "workId"),
    revision: readRevision(record.revision, "revision"),
    entries: parseEntries(record.entries),
  });
}

function calculatedRate(
  numerator: number | null,
  denominator: number | null,
): WorkReadthroughRate {
  if (numerator === null || denominator === null) {
    return Object.freeze({ status: "missing", percent: null });
  }
  if (denominator === 0) {
    return Object.freeze({ status: "unavailable", percent: null });
  }
  return Object.freeze({
    status: "calculated",
    percent: (numerator / denominator) * 100,
  });
}

export function deriveWorkReadthrough(input: {
  readonly workId: EntityId<"Work">;
  readonly documents: readonly {
    readonly documentId: EntityId<"Document">;
    readonly title: string;
  }[];
  readonly settings: WorkReadthroughProjection;
}): WorkReadthroughCalculatorProjection {
  if (input.settings.workId !== input.workId) {
    throw new Error(`Work readthrough is outside Work ${input.workId}`);
  }
  const documentIds = new Set(input.documents.map(({ documentId }) => documentId));
  if (documentIds.size !== input.documents.length) {
    throw new Error("Work readthrough document order contains duplicates");
  }
  for (const entry of input.settings.entries) {
    if (!documentIds.has(entry.documentId)) {
      throw new Error(`Work readthrough Document is outside Work: ${entry.documentId}`);
    }
  }

  const counts = new Map(
    input.settings.entries.map((entry) => [entry.documentId, entry.readerCount]),
  );
  const firstCount = input.documents[0]
    ? (counts.get(input.documents[0].documentId) ?? null)
    : null;
  const rows = input.documents.map((document, index) => {
    const readerCount = counts.get(document.documentId) ?? null;
    const previousDocument = input.documents[index - 1];
    const previousCount = previousDocument
      ? (counts.get(previousDocument.documentId) ?? null)
      : null;
    return Object.freeze({
      documentId: document.documentId,
      title: document.title,
      readerCount,
      adjacentRate:
        index === 0
          ? Object.freeze({ status: "baseline" as const, percent: null })
          : calculatedRate(readerCount, previousCount),
      firstEpisodeRate: calculatedRate(readerCount, firstCount),
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    workId: input.workId,
    rows: Object.freeze(rows),
  });
}
