import { entityId, type EntityId } from "../../domain/writing";

export type ForeshadowPointRole = {
  readonly id: string;
  readonly label: string;
};

export type ForeshadowPointProfile = {
  readonly schemaVersion: 1;
  readonly defaultRoleId: string;
  readonly payoffRoleId: string;
  readonly roles: readonly ForeshadowPointRole[];
};

export type CreateForeshadowPointCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly documentId: EntityId<"Document">;
  readonly selection: {
    readonly anchor: number;
    readonly head: number;
  };
  readonly exactText: string;
  readonly roleId: string;
  readonly note: string;
};

export type ListForeshadowPointsCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
};

export type ForeshadowPointSourceRange = {
  readonly from: number;
  readonly to: number;
};

export type ForeshadowPointProjection = {
  readonly schemaVersion: 1;
  readonly pointId: EntityId<"ForeshadowPoint">;
  readonly revision: number;
  readonly workId: EntityId<"Work">;
  readonly lineId: EntityId<"ForeshadowLine">;
  readonly sourceDocumentId: EntityId<"Document">;
  readonly sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  readonly sourceAnchorId: EntityId<"Anchor">;
  readonly roleId: string;
  readonly note: string;
  readonly exactText: string;
  readonly integrity: "resolved" | "needsReview" | "broken";
  readonly range: ForeshadowPointSourceRange | null;
  readonly createdAt: string;
};

export type ForeshadowPointListProjection = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly points: readonly ForeshadowPointProjection[];
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

function readSchemaVersion(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(input.schemaVersion)}`,
    );
  }
}

function readString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
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
  return entityId<TEntity>(
    readTrimmedNonEmptyString(input, field, label),
  );
}

function readOffset(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function readRevision(
  input: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = readOffset(input, field, label);
  if (value < 1) {
    throw new Error(`${label}.${field} must be at least 1`);
  }
  return value;
}

export function parseForeshadowPointProfile(
  value: unknown,
): ForeshadowPointProfile {
  const label = "ForeshadowPointProfile";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "defaultRoleId",
    "payoffRoleId",
    "roles",
  ], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    throw new Error(`${label}.roles must be a non-empty array`);
  }
  const seenIds = new Set<string>();
  const roles = Object.freeze(input.roles.map((value, index) => {
    const roleLabel = `${label}.roles[${index}]`;
    const role = readRecord(value, roleLabel);
    assertExactFields(role, ["id", "label"], roleLabel);
    const id = readTrimmedNonEmptyString(role, "id", roleLabel);
    if (seenIds.has(id)) {
      throw new Error(`${label}.roles contains duplicate id: ${id}`);
    }
    seenIds.add(id);
    return Object.freeze({
      id,
      label: readTrimmedNonEmptyString(role, "label", roleLabel),
    });
  }));
  const defaultRoleId = readTrimmedNonEmptyString(
    input,
    "defaultRoleId",
    label,
  );
  const payoffRoleId = readTrimmedNonEmptyString(
    input,
    "payoffRoleId",
    label,
  );
  if (!seenIds.has(defaultRoleId)) {
    throw new Error(`${label}.defaultRoleId is not configured`);
  }
  if (!seenIds.has(payoffRoleId)) {
    throw new Error(`${label}.payoffRoleId is not configured`);
  }
  return Object.freeze({
    schemaVersion: 1,
    defaultRoleId,
    payoffRoleId,
    roles,
  });
}

export function parseCreateForeshadowPointCommand(
  value: unknown,
): CreateForeshadowPointCommand {
  const label = "CreateForeshadowPointCommand";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "workId",
    "lineId",
    "documentId",
    "selection",
    "exactText",
    "roleId",
    "note",
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
    lineId: readEntityId<"ForeshadowLine">(input, "lineId", label),
    documentId: readEntityId<"Document">(input, "documentId", label),
    selection: Object.freeze({ anchor, head }),
    exactText: readNonEmptyString(input, "exactText", label),
    roleId: readTrimmedNonEmptyString(input, "roleId", label),
    note: readString(input, "note", label),
  });
}

export function parseListForeshadowPointsCommand(
  value: unknown,
): ListForeshadowPointsCommand {
  const label = "ListForeshadowPointsCommand";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId"], label);
  readSchemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: readEntityId<"Work">(input, "workId", label),
  });
}

function parseRange(
  value: unknown,
  label: string,
): ForeshadowPointSourceRange | null {
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

export function parseForeshadowPointProjection(
  value: unknown,
): ForeshadowPointProjection {
  const label = "ForeshadowPointProjection";
  const input = readRecord(value, label);
  assertExactFields(input, [
    "schemaVersion",
    "pointId",
    "revision",
    "workId",
    "lineId",
    "sourceDocumentId",
    "sourceDocumentRevisionId",
    "sourceAnchorId",
    "roleId",
    "note",
    "exactText",
    "integrity",
    "range",
    "createdAt",
  ], label);
  readSchemaVersion(input, label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  const range = parseRange(input.range, `${label}.range`);
  if (input.integrity === "resolved" && range === null) {
    throw new Error(`${label}.range is required when resolved`);
  }
  if (input.integrity !== "resolved" && range !== null) {
    throw new Error(`${label}.range must be null when unresolved`);
  }
  return Object.freeze({
    schemaVersion: 1,
    pointId: readEntityId<"ForeshadowPoint">(input, "pointId", label),
    revision: readRevision(input, "revision", label),
    workId: readEntityId<"Work">(input, "workId", label),
    lineId: readEntityId<"ForeshadowLine">(input, "lineId", label),
    sourceDocumentId: readEntityId<"Document">(
      input,
      "sourceDocumentId",
      label,
    ),
    sourceDocumentRevisionId: readEntityId<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    sourceAnchorId: readEntityId<"Anchor">(
      input,
      "sourceAnchorId",
      label,
    ),
    roleId: readTrimmedNonEmptyString(input, "roleId", label),
    note: readString(input, "note", label),
    exactText: readNonEmptyString(input, "exactText", label),
    integrity: input.integrity,
    range,
    createdAt: readNonEmptyString(input, "createdAt", label),
  });
}

export function parseForeshadowPointListProjection(
  value: unknown,
): ForeshadowPointListProjection {
  const label = "ForeshadowPointListProjection";
  const input = readRecord(value, label);
  assertExactFields(input, ["schemaVersion", "workId", "points"], label);
  readSchemaVersion(input, label);
  if (!Array.isArray(input.points)) {
    throw new Error(`${label}.points must be an array`);
  }
  const workId = readEntityId<"Work">(input, "workId", label);
  const points = Object.freeze(input.points.map((value, index) => {
    const point = parseForeshadowPointProjection(value);
    if (point.workId !== workId) {
      throw new Error(`${label}.points[${index}] is outside Work ${workId}`);
    }
    return point;
  }));
  return Object.freeze({ schemaVersion: 1, workId, points });
}

export function deriveForeshadowLineResolution(input: {
  readonly points: readonly Pick<ForeshadowPointProjection, "roleId">[];
  readonly payoffRoleId: string;
}): "unresolved" | "resolved" {
  return input.points.some((point) => point.roleId === input.payoffRoleId)
    ? "resolved"
    : "unresolved";
}
