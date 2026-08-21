import {
  entityId,
  type EntityId,
} from "../../domain/writing";

export type ListDocumentRevisionsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
};

export type RestoreDocumentRevisionCommand = ListDocumentRevisionsCommand & {
  readonly targetRevisionId: EntityId<"DocumentRevision">;
};

export type ReadDocumentRevisionCommand = ListDocumentRevisionsCommand & {
  readonly revisionId: EntityId<"DocumentRevision">;
};

export type CreateWorkSnapshotCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly label: string;
};

export type ListWorkSnapshotsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type DocumentRevisionProjection = {
  readonly schemaVersion: 1;
  readonly revisionId: EntityId<"DocumentRevision">;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly parentRevisionId: EntityId<"DocumentRevision"> | null;
  readonly length: number;
  readonly cause: string;
  readonly createdAt: string;
  readonly durableAt: string;
  readonly isCurrent: boolean;
};

export type DocumentRevisionListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly revisions: readonly DocumentRevisionProjection[];
};

export type DocumentRevisionContentProjection = {
  readonly schemaVersion: 1;
  readonly revision: DocumentRevisionProjection;
  readonly text: string;
};

export type RestoreDocumentRevisionResult = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly targetRevisionId: EntityId<"DocumentRevision">;
  readonly restoredRevisionId: EntityId<"DocumentRevision">;
};

export type WorkSnapshotDocumentRevision = {
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision">;
};

export type WorkSnapshotProjection = {
  readonly schemaVersion: 1;
  readonly workSnapshotId: EntityId<"WorkSnapshot">;
  readonly workId: EntityId<"Work">;
  readonly label: string;
  readonly cause: string;
  readonly manifestHash: string;
  readonly createdAt: string;
  readonly documentRevisions: readonly WorkSnapshotDocumentRevision[];
};

export type WorkSnapshotListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly snapshots: readonly WorkSnapshotProjection[];
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

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function stringValue(
  input: Record<string, unknown>,
  field: string,
  label: string,
  allowEmpty = false,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new Error(`${label}.${field} must be a string`);
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
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or an identity`);
  }
  return entityId<TEntity>(value);
}

function nonNegativeInteger(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

export function parseListDocumentRevisionsCommand(
  value: unknown,
): ListDocumentRevisionsCommand {
  const label = "ListDocumentRevisionsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "documentId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
  });
}

export function parseRestoreDocumentRevisionCommand(
  value: unknown,
): RestoreDocumentRevisionCommand {
  const label = "RestoreDocumentRevisionCommand";
  const input = record(value, label);
  exact(
    input,
    ["schemaVersion", "workId", "documentId", "targetRevisionId"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    targetRevisionId: id<"DocumentRevision">(
      input,
      "targetRevisionId",
      label,
    ),
  });
}

export function parseReadDocumentRevisionCommand(
  value: unknown,
): ReadDocumentRevisionCommand {
  const label = "ReadDocumentRevisionCommand";
  const input = record(value, label);
  exact(
    input,
    ["schemaVersion", "workId", "documentId", "revisionId"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    revisionId: id<"DocumentRevision">(input, "revisionId", label),
  });
}

export function parseCreateWorkSnapshotCommand(
  value: unknown,
): CreateWorkSnapshotCommand {
  const label = "CreateWorkSnapshotCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "label"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    label: stringValue(input, "label", label).trim(),
  });
}

export function parseListWorkSnapshotsCommand(
  value: unknown,
): ListWorkSnapshotsCommand {
  const label = "ListWorkSnapshotsCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseDocumentRevisionProjection(
  value: unknown,
): DocumentRevisionProjection {
  const label = "DocumentRevisionProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "revisionId",
      "workId",
      "documentId",
      "parentRevisionId",
      "length",
      "cause",
      "createdAt",
      "durableAt",
      "isCurrent",
    ],
    label,
  );
  schema(input, label);
  if (typeof input.isCurrent !== "boolean") {
    throw new Error(`${label}.isCurrent must be a boolean`);
  }
  return Object.freeze({
    schemaVersion: 1,
    revisionId: id<"DocumentRevision">(input, "revisionId", label),
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    parentRevisionId: nullableId<"DocumentRevision">(
      input,
      "parentRevisionId",
      label,
    ),
    length: nonNegativeInteger(input, "length", label),
    cause: stringValue(input, "cause", label),
    createdAt: stringValue(input, "createdAt", label),
    durableAt: stringValue(input, "durableAt", label),
    isCurrent: input.isCurrent,
  });
}

export function parseDocumentRevisionListProjection(
  value: unknown,
): DocumentRevisionListProjection {
  const label = "DocumentRevisionListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "documentId", "revisions"], label);
  schema(input, label);
  if (!Array.isArray(input.revisions)) {
    throw new Error(`${label}.revisions must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const documentId = id<"Document">(input, "documentId", label);
  const revisions = Object.freeze(
    input.revisions.map((candidate, index) => {
      const revision = parseDocumentRevisionProjection(candidate);
      if (revision.workId !== workId || revision.documentId !== documentId) {
        throw new Error(`${label}.revisions[${index}] is outside its Document`);
      }
      return revision;
    }),
  );
  return Object.freeze({ schemaVersion: 1, workId, documentId, revisions });
}

export function parseDocumentRevisionContentProjection(
  value: unknown,
): DocumentRevisionContentProjection {
  const label = "DocumentRevisionContentProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "revision", "text"], label);
  schema(input, label);
  if (typeof input.text !== "string") {
    throw new Error(`${label}.text must be a string`);
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: parseDocumentRevisionProjection(input.revision),
    text: input.text,
  });
}

export function parseRestoreDocumentRevisionResult(
  value: unknown,
): RestoreDocumentRevisionResult {
  const label = "RestoreDocumentRevisionResult";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "targetRevisionId",
      "restoredRevisionId",
    ],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    targetRevisionId: id<"DocumentRevision">(
      input,
      "targetRevisionId",
      label,
    ),
    restoredRevisionId: id<"DocumentRevision">(
      input,
      "restoredRevisionId",
      label,
    ),
  });
}

function parseSnapshotDocumentRevision(
  value: unknown,
  label: string,
): WorkSnapshotDocumentRevision {
  const input = record(value, label);
  exact(input, ["documentId", "documentRevisionId"], label);
  return Object.freeze({
    documentId: id<"Document">(input, "documentId", label),
    documentRevisionId: id<"DocumentRevision">(
      input,
      "documentRevisionId",
      label,
    ),
  });
}

export function parseWorkSnapshotProjection(
  value: unknown,
): WorkSnapshotProjection {
  const label = "WorkSnapshotProjection";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "workSnapshotId",
      "workId",
      "label",
      "cause",
      "manifestHash",
      "createdAt",
      "documentRevisions",
    ],
    label,
  );
  schema(input, label);
  if (!Array.isArray(input.documentRevisions)) {
    throw new Error(`${label}.documentRevisions must be an array`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workSnapshotId: id<"WorkSnapshot">(input, "workSnapshotId", label),
    workId: id<"Work">(input, "workId", label),
    label: stringValue(input, "label", label),
    cause: stringValue(input, "cause", label),
    manifestHash: stringValue(input, "manifestHash", label),
    createdAt: stringValue(input, "createdAt", label),
    documentRevisions: Object.freeze(
      input.documentRevisions.map((candidate, index) =>
        parseSnapshotDocumentRevision(
          candidate,
          `${label}.documentRevisions[${index}]`,
        ),
      ),
    ),
  });
}

export function parseWorkSnapshotListProjection(
  value: unknown,
): WorkSnapshotListProjection {
  const label = "WorkSnapshotListProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "workId", "snapshots"], label);
  schema(input, label);
  if (!Array.isArray(input.snapshots)) {
    throw new Error(`${label}.snapshots must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const snapshots = Object.freeze(
    input.snapshots.map((candidate, index) => {
      const snapshot = parseWorkSnapshotProjection(candidate);
      if (snapshot.workId !== workId) {
        throw new Error(`${label}.snapshots[${index}] is outside its Work`);
      }
      return snapshot;
    }),
  );
  return Object.freeze({ schemaVersion: 1, workId, snapshots });
}
