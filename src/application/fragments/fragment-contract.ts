import { entityId, type EntityId } from "../../domain/writing";

export type FragmentShelfKind = {
  readonly id: string;
  readonly label: string;
};

export type FragmentShelfProfile = {
  readonly schemaVersion: 1;
  readonly defaultKindId: string;
  readonly kinds: readonly FragmentShelfKind[];
};

export type CaptureFragmentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
  readonly kindId: string;
  readonly title: string;
};

export type ListFragmentsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type UpdateFragmentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly fragmentId: EntityId<"Fragment">;
  readonly expectedRevision: number;
  readonly changes: {
    readonly title?: string;
    readonly kindId?: string;
    readonly pinned?: boolean;
  };
};

export type RetireFragmentCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly fragmentId: EntityId<"Fragment">;
  readonly expectedRevision: number;
};

export type RecordFragmentUseCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly fragmentId: EntityId<"Fragment">;
  readonly expectedRevision: number;
};

export type FragmentSourceRange = {
  readonly from: number;
  readonly to: number;
};

export type FragmentProjection = {
  readonly schemaVersion: 1;
  readonly fragmentId: EntityId<"Fragment">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly kindId: string;
  readonly title: string;
  readonly pinned: boolean;
  readonly useCount: number;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: FragmentSourceRange | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retiredAt: string | null;
};

export type FragmentListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly fragments: readonly FragmentProjection[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in input)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function assertOptionalFields(
  input: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`);
  }
}

function readString(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = readString(input, field, label);
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readTrimmedNonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = readString(input, field, label).trim();
  if (value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function readEntityId<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  return entityId<TEntity>(readTrimmedNonEmptyString(input, field, label));
}

function readOffset(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function readRevision(input: Record<string, unknown>, field: string, label: string): number {
  const value = readOffset(input, field, label);
  if (value < 1) {
    throw new Error(`${label}.${field} must be at least 1`);
  }
  return value;
}

function readBoolean(input: Record<string, unknown>, field: string, label: string): boolean {
  const value = input[field];
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

export function parseFragmentShelfProfile(value: unknown): FragmentShelfProfile {
  const label = "FragmentShelfProfile";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "defaultKindId", "kinds"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.kinds) || input.kinds.length === 0) {
    throw new Error(`${label}.kinds must be a non-empty array`);
  }
  const seen = new Set<string>();
  const kinds = Object.freeze(input.kinds.map((value, index) => {
    const kindLabel = `${label}.kinds[${index}]`;
    const kind = readRecord(value, kindLabel);
    assertExactFields(kind, ["id", "label"], kindLabel);
    const id = readTrimmedNonEmptyString(kind, "id", kindLabel);
    if (seen.has(id)) {
      throw new Error(`${label}.kinds contains duplicate id: ${id}`);
    }
    seen.add(id);
    return Object.freeze({
      id,
      label: readTrimmedNonEmptyString(kind, "label", kindLabel),
    });
  }));
  const defaultKindId = readTrimmedNonEmptyString(input, "defaultKindId", label);
  if (!seen.has(defaultKindId)) {
    throw new Error(`${label}.defaultKindId must reference a configured kind`);
  }
  return Object.freeze({ schemaVersion: 1, defaultKindId, kinds });
}

export function parseCaptureFragmentCommand(value: unknown): CaptureFragmentCommand {
  const label = "CaptureFragmentCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "documentId",
    "selection",
    "exactText",
    "kindId",
    "title",
  ], label);
  readSchemaVersion(input, label);
  const selectionLabel = `${label}.selection`;
  const selectionInput = readRecord(input.selection, selectionLabel);
  assertExactFields(selectionInput, ["anchor", "head"], selectionLabel);
  const anchor = readOffset(selectionInput, "anchor", selectionLabel);
  const head = readOffset(selectionInput, "head", selectionLabel);
  if (anchor === head) {
    throw new Error(`${label}.selection must not be empty`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    documentId: readEntityId<"Document">(input, "documentId", label),
    selection: Object.freeze({ anchor, head }),
    exactText: readNonEmptyString(input, "exactText", label),
    kindId: readTrimmedNonEmptyString(input, "kindId", label),
    title: readString(input, "title", label),
  });
}

export function parseListFragmentsCommand(value: unknown): ListFragmentsCommand {
  const label = "ListFragmentsCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

export function parseUpdateFragmentCommand(value: unknown): UpdateFragmentCommand {
  const label = "UpdateFragmentCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "fragmentId",
    "expectedRevision",
    "changes",
  ], label);
  readSchemaVersion(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = readRecord(input.changes, changesLabel);
  assertOptionalFields(changesInput, ["title", "kindId", "pinned"], changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${label}.changes must contain at least one field`);
  }
  const changes = Object.freeze({
    ...("title" in changesInput
      ? { title: readString(changesInput, "title", changesLabel) }
      : {}),
    ...("kindId" in changesInput
      ? { kindId: readTrimmedNonEmptyString(changesInput, "kindId", changesLabel) }
      : {}),
    ...("pinned" in changesInput
      ? { pinned: readBoolean(changesInput, "pinned", changesLabel) }
      : {}),
  });
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    fragmentId: readEntityId<"Fragment">(input, "fragmentId", label),
    expectedRevision: readRevision(input, "expectedRevision", label),
    changes,
  });
}

export function parseRetireFragmentCommand(value: unknown): RetireFragmentCommand {
  const label = "RetireFragmentCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "fragmentId",
    "expectedRevision",
  ], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    fragmentId: readEntityId<"Fragment">(input, "fragmentId", label),
    expectedRevision: readRevision(input, "expectedRevision", label),
  });
}

export function parseRecordFragmentUseCommand(
  value: unknown,
): RecordFragmentUseCommand {
  const label = "RecordFragmentUseCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "fragmentId",
    "expectedRevision",
  ], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
    fragmentId: readEntityId<"Fragment">(input, "fragmentId", label),
    expectedRevision: readRevision(input, "expectedRevision", label),
  });
}

function parseRange(value: unknown, label: string): FragmentSourceRange | null {
  if (value === null) return null;
  const input = readRecord(value, label);
  assertExactFields(input, ["from", "to"], label);
  const from = readOffset(input, "from", label);
  const to = readOffset(input, "to", label);
  if (to < from) {
    throw new Error(`${label}.to must not precede from`);
  }
  return Object.freeze({ from, to });
}

export function parseFragmentProjection(value: unknown): FragmentProjection {
  const label = "FragmentProjection";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "fragmentId",
    "revision",
    "workId",
    "sourceDocumentId",
    "sourceDocumentRevisionId",
    "sourceAnchorId",
    "kindId",
    "title",
    "pinned",
    "useCount",
    "exactText",
    "integrity",
    "range",
    "createdAt",
    "updatedAt",
    "retiredAt",
  ], label);
  readSchemaVersion(input, label);
  if (input.integrity !== "resolved" && input.integrity !== "needsReview" && input.integrity !== "broken") {
    throw new Error(`${label}.integrity is invalid`);
  }
  const range = parseRange(input.range, `${label}.range`);
  if (input.integrity === "resolved" && range === null) {
    throw new Error(`${label}.range is required when resolved`);
  }
  if (input.integrity !== "resolved" && range !== null) {
    throw new Error(`${label}.range must be null when unresolved`);
  }
  if (input.retiredAt !== null && typeof input.retiredAt !== "string") {
    throw new Error(`${label}.retiredAt must be a string or null`);
  }
  return Object.freeze({
    schemaVersion: 1,
    fragmentId: readEntityId<"Fragment">(input, "fragmentId", label),
    revision: readRevision(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    sourceDocumentId: readEntityId<"Document">(input, "sourceDocumentId", label),
    sourceDocumentRevisionId: readEntityId<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    sourceAnchorId: readEntityId<"Anchor">(input, "sourceAnchorId", label),
    kindId: readTrimmedNonEmptyString(input, "kindId", label),
    title: readString(input, "title", label),
    pinned: readBoolean(input, "pinned", label),
    useCount: readOffset(input, "useCount", label),
    exactText: readNonEmptyString(input, "exactText", label),
    integrity: input.integrity,
    range,
    createdAt: readNonEmptyString(input, "createdAt", label),
    updatedAt: readNonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parseFragmentListProjection(value: unknown): FragmentListProjection {
  const label = "FragmentListProjection";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "fragments"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.fragments)) {
    throw new Error(`${label}.fragments must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const fragments = Object.freeze(input.fragments.map((value, index) => {
    const fragment = parseFragmentProjection(value);
    if (fragment.workId !== workId) {
      throw new Error(`${label}.fragments[${index}] is outside Work ${workId}`);
    }
    return fragment;
  }));
  return Object.freeze({ schemaVersion: 1, workId, fragments });
}
