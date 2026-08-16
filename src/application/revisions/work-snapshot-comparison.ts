import {
  entityId,
  type EntityId,
} from "../../domain/writing";
import type { WorkSnapshotProjection } from "./work-version-contract";

export type CompareWorkSnapshotCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly workSnapshotId: EntityId<"WorkSnapshot">;
};

export type WorkSnapshotDocumentComparisonStatus =
  | "unchanged"
  | "changed"
  | "added-after-snapshot"
  | "removed-after-snapshot";

export type WorkSnapshotDocumentComparison = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly status: WorkSnapshotDocumentComparisonStatus;
  readonly snapshotRevisionId: EntityId<"DocumentRevision"> | null;
  readonly currentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly snapshotLength: number;
  readonly currentLength: number;
  readonly characterDelta: number;
};

export type WorkSnapshotComparisonProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly workSnapshotId: EntityId<"WorkSnapshot">;
  readonly label: string;
  readonly createdAt: string;
  readonly totals: {
    readonly snapshotDocumentCount: number;
    readonly currentDocumentCount: number;
    readonly snapshotCharacters: number;
    readonly currentCharacters: number;
    readonly characterDelta: number;
    readonly unchangedCount: number;
    readonly changedCount: number;
    readonly addedCount: number;
    readonly removedCount: number;
  };
  readonly documents: readonly WorkSnapshotDocumentComparison[];
};

export type MaterializedWorkSnapshotDocument = {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
  readonly text: string;
};

export type DeriveWorkSnapshotComparisonInput = {
  readonly command: CompareWorkSnapshotCommand;
  readonly snapshot: WorkSnapshotProjection;
  readonly snapshotDocuments: readonly MaterializedWorkSnapshotDocument[];
  readonly currentDocuments: readonly MaterializedWorkSnapshotDocument[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(input).length !== expected.size ||
    Object.keys(input).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the schema`);
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function id<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(stringValue(input, field, label));
}

function nullableId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> | null {
  const value = input[field];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or an identity`);
  }
  return entityId<TEntity>(value);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

export function parseCompareWorkSnapshotCommand(
  value: unknown,
): CompareWorkSnapshotCommand {
  const label = "CompareWorkSnapshotCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "workSnapshotId"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    workSnapshotId: id<"WorkSnapshot">(
      input,
      "workSnapshotId",
      label,
    ),
  });
}

function indexMaterializedDocuments(
  documents: readonly MaterializedWorkSnapshotDocument[],
  label: string,
): Map<EntityId<"Document">, MaterializedWorkSnapshotDocument> {
  const indexed = new Map<
    EntityId<"Document">,
    MaterializedWorkSnapshotDocument
  >();
  for (const document of documents) {
    if (indexed.has(document.documentId)) {
      throw new Error(`${label} has a duplicate Document: ${document.documentId}`);
    }
    if (typeof document.title !== "string" || typeof document.text !== "string") {
      throw new Error(`${label} has invalid materialized Document values`);
    }
    indexed.set(document.documentId, document);
  }
  return indexed;
}

function row(input: {
  readonly documentId: EntityId<"Document">;
  readonly title: string;
  readonly status: WorkSnapshotDocumentComparisonStatus;
  readonly snapshotRevisionId: EntityId<"DocumentRevision"> | null;
  readonly currentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly snapshotText: string;
  readonly currentText: string;
}): WorkSnapshotDocumentComparison {
  return Object.freeze({
    documentId: input.documentId,
    title: input.title,
    status: input.status,
    snapshotRevisionId: input.snapshotRevisionId,
    currentRevisionId: input.currentRevisionId,
    snapshotLength: input.snapshotText.length,
    currentLength: input.currentText.length,
    characterDelta: input.currentText.length - input.snapshotText.length,
  });
}

export function deriveWorkSnapshotComparison(
  input: DeriveWorkSnapshotComparisonInput,
): WorkSnapshotComparisonProjection {
  const command = parseCompareWorkSnapshotCommand(input.command);
  if (input.snapshot.workId !== command.workId) {
    throw new Error("WorkSnapshot comparison is outside Work");
  }
  if (input.snapshot.workSnapshotId !== command.workSnapshotId) {
    throw new Error("WorkSnapshot comparison selected another snapshot");
  }

  const snapshotByDocument = indexMaterializedDocuments(
    input.snapshotDocuments,
    "WorkSnapshot materialization",
  );
  const expectedSnapshotDocuments = new Map<
    EntityId<"Document">,
    EntityId<"DocumentRevision">
  >();
  for (const reference of input.snapshot.documentRevisions) {
    if (expectedSnapshotDocuments.has(reference.documentId)) {
      throw new Error(
        `WorkSnapshot has a duplicate Document: ${reference.documentId}`,
      );
    }
    expectedSnapshotDocuments.set(
      reference.documentId,
      reference.documentRevisionId,
    );
  }
  if (snapshotByDocument.size !== expectedSnapshotDocuments.size) {
    throw new Error("WorkSnapshot materialization is incomplete");
  }
  for (const [documentId, revisionId] of expectedSnapshotDocuments) {
    if (snapshotByDocument.get(documentId)?.documentRevisionId !== revisionId) {
      throw new Error(
        `WorkSnapshot materialization does not match ${documentId}`,
      );
    }
  }

  const currentByDocument = indexMaterializedDocuments(
    input.currentDocuments,
    "Current Work materialization",
  );
  const documents: WorkSnapshotDocumentComparison[] = [];
  for (const current of input.currentDocuments) {
    const previous = snapshotByDocument.get(current.documentId);
    if (previous === undefined) {
      documents.push(
        row({
          documentId: current.documentId,
          title: current.title,
          status: "added-after-snapshot",
          snapshotRevisionId: null,
          currentRevisionId: current.documentRevisionId,
          snapshotText: "",
          currentText: current.text,
        }),
      );
      continue;
    }
    documents.push(
      row({
        documentId: current.documentId,
        title: current.title,
        status: previous.text === current.text ? "unchanged" : "changed",
        snapshotRevisionId: previous.documentRevisionId,
        currentRevisionId: current.documentRevisionId,
        snapshotText: previous.text,
        currentText: current.text,
      }),
    );
  }
  for (const reference of input.snapshot.documentRevisions) {
    if (currentByDocument.has(reference.documentId)) continue;
    const previous = snapshotByDocument.get(reference.documentId);
    if (previous === undefined) {
      throw new Error(
        `WorkSnapshot materialization is missing ${reference.documentId}`,
      );
    }
    documents.push(
      row({
        documentId: previous.documentId,
        title: previous.title,
        status: "removed-after-snapshot",
        snapshotRevisionId: previous.documentRevisionId,
        currentRevisionId: null,
        snapshotText: previous.text,
        currentText: "",
      }),
    );
  }

  const snapshotCharacters = input.snapshotDocuments.reduce(
    (total, document) => total + document.text.length,
    0,
  );
  const currentCharacters = input.currentDocuments.reduce(
    (total, document) => total + document.text.length,
    0,
  );
  const statusCount = (status: WorkSnapshotDocumentComparisonStatus) =>
    documents.filter((document) => document.status === status).length;
  return parseWorkSnapshotComparisonProjection({
    schemaVersion: 1,
    workId: command.workId,
    workSnapshotId: command.workSnapshotId,
    label: input.snapshot.label,
    createdAt: input.snapshot.createdAt,
    totals: {
      snapshotDocumentCount: input.snapshotDocuments.length,
      currentDocumentCount: input.currentDocuments.length,
      snapshotCharacters,
      currentCharacters,
      characterDelta: currentCharacters - snapshotCharacters,
      unchangedCount: statusCount("unchanged"),
      changedCount: statusCount("changed"),
      addedCount: statusCount("added-after-snapshot"),
      removedCount: statusCount("removed-after-snapshot"),
    },
    documents,
  });
}

function parseDocumentComparison(
  value: unknown,
  label: string,
): WorkSnapshotDocumentComparison {
  const input = record(value, label);
  exact(
    input,
    [
      "documentId",
      "title",
      "status",
      "snapshotRevisionId",
      "currentRevisionId",
      "snapshotLength",
      "currentLength",
      "characterDelta",
    ],
    label,
  );
  if (
    input.status !== "unchanged" &&
    input.status !== "changed" &&
    input.status !== "added-after-snapshot" &&
    input.status !== "removed-after-snapshot"
  ) {
    throw new Error(`${label}.status is invalid`);
  }
  return Object.freeze({
    documentId: id<"Document">(input, "documentId", label),
    title: stringValue(input, "title", label),
    status: input.status,
    snapshotRevisionId: nullableId<"DocumentRevision">(
      input,
      "snapshotRevisionId",
      label,
    ),
    currentRevisionId: nullableId<"DocumentRevision">(
      input,
      "currentRevisionId",
      label,
    ),
    snapshotLength: nonNegativeInteger(
      input.snapshotLength,
      `${label}.snapshotLength`,
    ),
    currentLength: nonNegativeInteger(
      input.currentLength,
      `${label}.currentLength`,
    ),
    characterDelta: integer(input.characterDelta, `${label}.characterDelta`),
  });
}

export function parseWorkSnapshotComparisonProjection(
  value: unknown,
): WorkSnapshotComparisonProjection {
  const label = "WorkSnapshotComparisonProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "workSnapshotId",
      "label",
      "createdAt",
      "totals",
      "documents",
    ],
    label,
  );
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
  if (!Array.isArray(input.documents)) {
    throw new Error(`${label}.documents must be an array`);
  }
  const totalsInput = record(input.totals, `${label}.totals`);
  const totalFields = [
    "snapshotDocumentCount",
    "currentDocumentCount",
    "snapshotCharacters",
    "currentCharacters",
    "characterDelta",
    "unchangedCount",
    "changedCount",
    "addedCount",
    "removedCount",
  ] as const;
  exact(totalsInput, totalFields, `${label}.totals`);
  const documents = Object.freeze(
    input.documents.map((document, index) =>
      parseDocumentComparison(document, `${label}.documents[${index}]`),
    ),
  );
  const totals = Object.freeze({
    snapshotDocumentCount: nonNegativeInteger(
      totalsInput.snapshotDocumentCount,
      `${label}.totals.snapshotDocumentCount`,
    ),
    currentDocumentCount: nonNegativeInteger(
      totalsInput.currentDocumentCount,
      `${label}.totals.currentDocumentCount`,
    ),
    snapshotCharacters: nonNegativeInteger(
      totalsInput.snapshotCharacters,
      `${label}.totals.snapshotCharacters`,
    ),
    currentCharacters: nonNegativeInteger(
      totalsInput.currentCharacters,
      `${label}.totals.currentCharacters`,
    ),
    characterDelta: integer(
      totalsInput.characterDelta,
      `${label}.totals.characterDelta`,
    ),
    unchangedCount: nonNegativeInteger(
      totalsInput.unchangedCount,
      `${label}.totals.unchangedCount`,
    ),
    changedCount: nonNegativeInteger(
      totalsInput.changedCount,
      `${label}.totals.changedCount`,
    ),
    addedCount: nonNegativeInteger(
      totalsInput.addedCount,
      `${label}.totals.addedCount`,
    ),
    removedCount: nonNegativeInteger(
      totalsInput.removedCount,
      `${label}.totals.removedCount`,
    ),
  });
  const counts = {
    unchangedCount: documents.filter((document) => document.status === "unchanged").length,
    changedCount: documents.filter((document) => document.status === "changed").length,
    addedCount: documents.filter((document) => document.status === "added-after-snapshot").length,
    removedCount: documents.filter((document) => document.status === "removed-after-snapshot").length,
  };
  const statusCountFields = [
    "unchangedCount",
    "changedCount",
    "addedCount",
    "removedCount",
  ] as const;
  if (
    totals.characterDelta !== totals.currentCharacters - totals.snapshotCharacters ||
    totals.snapshotDocumentCount !==
      documents.filter((document) => document.snapshotRevisionId !== null).length ||
    totals.currentDocumentCount !==
      documents.filter((document) => document.currentRevisionId !== null).length ||
    statusCountFields.some(
      (field) => totals[field] !== counts[field],
    )
  ) {
    throw new Error(`${label}.totals do not match its Document rows`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    workSnapshotId: id<"WorkSnapshot">(
      input,
      "workSnapshotId",
      label,
    ),
    label: stringValue(input, "label", label),
    createdAt: stringValue(input, "createdAt", label),
    totals,
    documents,
  });
}
