import { entityId, type EntityId } from "../../domain/writing";

export type SelectManuscriptTextImportCommand = {
  readonly schemaVersion: 1;
  readonly workId: EntityId<"Work">;
  readonly documentId: EntityId<"Document">;
  readonly documentRevisionId: EntityId<"DocumentRevision"> | null;
};

export type ManuscriptTextImportResult =
  | Readonly<{
      schemaVersion: 1;
      status: "cancelled";
    }>
  | Readonly<{
      schemaVersion: 1;
      status: "selected";
      workId: EntityId<"Work">;
      documentId: EntityId<"Document">;
      documentRevisionId: EntityId<"DocumentRevision"> | null;
      fileName: string;
      text: string;
      byteLength: number;
    }>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(
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

function string(value: Record<string, unknown>, field: string, label: string): string {
  const result = value[field];
  if (typeof result !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return result;
}

function nonEmpty(
  value: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const result = string(value, field, label);
  if (result.length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return result;
}

function schema(value: Record<string, unknown>, label: string): void {
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label} schemaVersion`);
  }
}

function nullableRevisionId(
  value: Record<string, unknown>,
  label: string,
): EntityId<"DocumentRevision"> | null {
  return value.documentRevisionId === null
    ? null
    : entityId<"DocumentRevision">(
        nonEmpty(value, "documentRevisionId", label),
      );
}

export function parseSelectManuscriptTextImportCommand(
  value: unknown,
): SelectManuscriptTextImportCommand {
  const label = "SelectManuscriptTextImportCommand";
  const input = record(value, label);
  exact(
    input,
    ["schemaVersion", "workId", "documentId", "documentRevisionId"],
    label,
  );
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    workId: entityId<"Work">(nonEmpty(input, "workId", label)),
    documentId: entityId<"Document">(nonEmpty(input, "documentId", label)),
    documentRevisionId: nullableRevisionId(input, label),
  });
}

export function parseManuscriptTextImportResult(
  value: unknown,
): ManuscriptTextImportResult {
  const label = "ManuscriptTextImportResult";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  if (input.status !== "selected") {
    throw new Error(`${label}.status is unsupported`);
  }
  exact(
    input,
    [
      "schemaVersion",
      "status",
      "workId",
      "documentId",
      "documentRevisionId",
      "fileName",
      "text",
      "byteLength",
    ],
    label,
  );
  const byteLength = input.byteLength;
  if (
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0
  ) {
    throw new Error(`${label}.byteLength must be a non-negative safe integer`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "selected",
    workId: entityId<"Work">(nonEmpty(input, "workId", label)),
    documentId: entityId<"Document">(nonEmpty(input, "documentId", label)),
    documentRevisionId: nullableRevisionId(input, label),
    fileName: nonEmpty(input, "fileName", label),
    text: string(input, "text", label),
    byteLength,
  });
}

export function normalizeImportedManuscriptText(text: string): string {
  return text.replace(/\r\n?/gu, "\n");
}
