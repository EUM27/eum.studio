import { entityId, type EntityId } from "../../domain/writing";

export type ManuscriptAnnotationIntegrity =
  | "resolved"
  | "needsReview"
  | "broken";

export type ManuscriptAnnotationSourceRange = Readonly<{
  from: number;
  to: number;
}>;

export type CreateManuscriptAnnotationCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  documentId: EntityId<"Document">;
  selection: Readonly<{
    anchor: number;
    head: number;
  }>;
  exactText: string;
  body: string;
  tags: readonly string[];
}>;

export type ListManuscriptAnnotationsCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
}>;

export type UpdateManuscriptAnnotationCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  annotationId: EntityId<"ManuscriptAnnotation">;
  expectedRevision: number;
  changes: Readonly<{
    body?: string;
    tags?: readonly string[];
  }>;
}>;

export type RetireManuscriptAnnotationCommand = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  annotationId: EntityId<"ManuscriptAnnotation">;
  expectedRevision: number;
}>;

export type ManuscriptAnnotationProjection = Readonly<{
  schemaVersion: 1;
  annotationId: EntityId<"ManuscriptAnnotation">;
  revision: number;
  workId: EntityId<"Work">;
  sourceDocumentId: EntityId<"Document">;
  sourceDocumentRevisionId: EntityId<"DocumentRevision">;
  sourceAnchorId: EntityId<"Anchor">;
  body: string;
  tags: readonly string[];
  exactText: string;
  integrity: ManuscriptAnnotationIntegrity;
  range: ManuscriptAnnotationSourceRange | null;
  createdAt: string;
  updatedAt: string;
  retiredAt: string | null;
}>;

export type ManuscriptAnnotationListProjection = Readonly<{
  schemaVersion: 1;
  workId: EntityId<"Work">;
  annotations: readonly ManuscriptAnnotationProjection[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${label} is missing ${field}`);
    }
  }
}

function optionalFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) {
      throw new Error(`Unsupported ${label} field: ${field}`);
    }
  }
}

function schemaVersion(value: Record<string, unknown>, label: string): void {
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function stringValue(
  value: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const result = value[field];
  if (typeof result !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return result;
}

function nonEmptyString(
  value: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const result = stringValue(value, field, label);
  if (result.length === 0) {
    throw new Error(`${label}.${field} must not be empty`);
  }
  return result;
}

function id<TEntity extends string>(
  value: Record<string, unknown>,
  field: string,
  label: string,
): EntityId<TEntity> {
  const result = stringValue(value, field, label).trim();
  if (result.length === 0) {
    throw new Error(`${label}.${field} must not be empty`);
  }
  return entityId<TEntity>(result);
}

function integer(
  value: Record<string, unknown>,
  field: string,
  label: string,
  minimum: number,
): number {
  const result = value[field];
  if (
    typeof result !== "number" ||
    !Number.isSafeInteger(result) ||
    result < minimum
  ) {
    throw new Error(`${label}.${field} is invalid`);
  }
  return result;
}

function tags(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const seen = new Set<string>();
  const parsed: string[] = [];
  value.forEach((candidate, index) => {
    if (typeof candidate !== "string") {
      throw new Error(`${label}[${index}] must be a string`);
    }
    const tag = candidate.trim();
    if (tag.length > 0 && !seen.has(tag)) {
      seen.add(tag);
      parsed.push(tag);
    }
  });
  return Object.freeze(parsed);
}

function selection(
  value: unknown,
  label: string,
): CreateManuscriptAnnotationCommand["selection"] {
  const input = record(value, label);
  exactFields(input, ["anchor", "head"], label);
  const anchor = integer(input, "anchor", label, 0);
  const head = integer(input, "head", label, 0);
  if (anchor === head) {
    throw new Error(`${label} must not be empty`);
  }
  return Object.freeze({ anchor, head });
}

export function parseCreateManuscriptAnnotationCommand(
  value: unknown,
): CreateManuscriptAnnotationCommand {
  const label = "CreateManuscriptAnnotationCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "documentId",
      "selection",
      "exactText",
      "body",
      "tags",
    ],
    label,
  );
  schemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    documentId: id<"Document">(input, "documentId", label),
    selection: selection(input.selection, `${label}.selection`),
    exactText: nonEmptyString(input, "exactText", label),
    body: stringValue(input, "body", label),
    tags: tags(input.tags, `${label}.tags`),
  });
}

export function parseListManuscriptAnnotationsCommand(
  value: unknown,
): ListManuscriptAnnotationsCommand {
  const label = "ListManuscriptAnnotationsCommand";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId"], label);
  schemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
  });
}

export function parseUpdateManuscriptAnnotationCommand(
  value: unknown,
): UpdateManuscriptAnnotationCommand {
  const label = "UpdateManuscriptAnnotationCommand";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "workId",
      "annotationId",
      "expectedRevision",
      "changes",
    ],
    label,
  );
  schemaVersion(input, label);
  const changesLabel = `${label}.changes`;
  const changesInput = record(input.changes, changesLabel);
  optionalFields(changesInput, ["body", "tags"], changesLabel);
  if (Object.keys(changesInput).length === 0) {
    throw new Error(`${changesLabel} must contain at least one field`);
  }
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    annotationId: id<"ManuscriptAnnotation">(input, "annotationId", label),
    expectedRevision: integer(input, "expectedRevision", label, 1),
    changes: Object.freeze({
      ...("body" in changesInput
        ? { body: stringValue(changesInput, "body", changesLabel) }
        : {}),
      ...("tags" in changesInput
        ? { tags: tags(changesInput.tags, `${changesLabel}.tags`) }
        : {}),
    }),
  });
}

export function parseRetireManuscriptAnnotationCommand(
  value: unknown,
): RetireManuscriptAnnotationCommand {
  const label = "RetireManuscriptAnnotationCommand";
  const input = record(value, label);
  exactFields(
    input,
    ["schemaVersion", "workId", "annotationId", "expectedRevision"],
    label,
  );
  schemaVersion(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: id<"Work">(input, "workId", label),
    annotationId: id<"ManuscriptAnnotation">(input, "annotationId", label),
    expectedRevision: integer(input, "expectedRevision", label, 1),
  });
}

function range(
  value: unknown,
  label: string,
): ManuscriptAnnotationSourceRange | null {
  if (value === null) return null;
  const input = record(value, label);
  exactFields(input, ["from", "to"], label);
  const from = integer(input, "from", label, 0);
  const to = integer(input, "to", label, 0);
  if (to < from) {
    throw new Error(`${label}.to must not precede from`);
  }
  return Object.freeze({ from, to });
}

export function parseManuscriptAnnotationProjection(
  value: unknown,
): ManuscriptAnnotationProjection {
  const label = "ManuscriptAnnotationProjection";
  const input = record(value, label);
  exactFields(
    input,
    [
      "schemaVersion",
      "annotationId",
      "revision",
      "workId",
      "sourceDocumentId",
      "sourceDocumentRevisionId",
      "sourceAnchorId",
      "body",
      "tags",
      "exactText",
      "integrity",
      "range",
      "createdAt",
      "updatedAt",
      "retiredAt",
    ],
    label,
  );
  schemaVersion(input, label);
  if (
    input.integrity !== "resolved" &&
    input.integrity !== "needsReview" &&
    input.integrity !== "broken"
  ) {
    throw new Error(`${label}.integrity is invalid`);
  }
  const parsedRange = range(input.range, `${label}.range`);
  if ((input.integrity === "resolved") !== (parsedRange !== null)) {
    throw new Error(`${label}.range does not match integrity`);
  }
  if (input.retiredAt !== null && typeof input.retiredAt !== "string") {
    throw new Error(`${label}.retiredAt must be a string or null`);
  }
  return Object.freeze({
    schemaVersion: 1,
    annotationId: id<"ManuscriptAnnotation">(input, "annotationId", label),
    revision: integer(input, "revision", label, 1),
    workId: id<"Work">(input, "workId", label),
    sourceDocumentId: id<"Document">(input, "sourceDocumentId", label),
    sourceDocumentRevisionId: id<"DocumentRevision">(
      input,
      "sourceDocumentRevisionId",
      label,
    ),
    sourceAnchorId: id<"Anchor">(input, "sourceAnchorId", label),
    body: stringValue(input, "body", label),
    tags: tags(input.tags, `${label}.tags`),
    exactText: nonEmptyString(input, "exactText", label),
    integrity: input.integrity,
    range: parsedRange,
    createdAt: nonEmptyString(input, "createdAt", label),
    updatedAt: nonEmptyString(input, "updatedAt", label),
    retiredAt: input.retiredAt,
  });
}

export function parseManuscriptAnnotationListProjection(
  value: unknown,
): ManuscriptAnnotationListProjection {
  const label = "ManuscriptAnnotationListProjection";
  const input = record(value, label);
  exactFields(input, ["schemaVersion", "workId", "annotations"], label);
  schemaVersion(input, label);
  if (!Array.isArray(input.annotations)) {
    throw new Error(`${label}.annotations must be an array`);
  }
  const workId = id<"Work">(input, "workId", label);
  const annotations = Object.freeze(
    input.annotations.map((annotation, index) => {
      const parsed = parseManuscriptAnnotationProjection(annotation);
      if (parsed.workId !== workId) {
        throw new Error(`${label}.annotations[${index}] is outside the Work`);
      }
      return parsed;
    }),
  );
  return Object.freeze({ schemaVersion: 1, workId, annotations });
}
