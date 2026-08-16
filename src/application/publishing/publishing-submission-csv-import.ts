import { entityId, type EntityId } from "../../domain/writing";
import type { WorkspaceCatalogProjection } from "../workspace/workspace-contract";
import type { PublishingPartnerProjection } from "./publishing-partner-contract";
import { parsePublishingPartnerCsvText } from "./publishing-partner-csv-import";

export const PUBLISHING_SUBMISSION_CSV_FIELDS = [
  "workLabel",
  "partnerLabel",
  "title",
  "submittedOn",
  "respondedOn",
  "status",
  "result",
  "note",
  "cardNote",
] as const;

export type PublishingSubmissionCsvField =
  (typeof PUBLISHING_SUBMISSION_CSV_FIELDS)[number];
export type PublishingSubmissionCsvMapping = Readonly<
  Partial<Record<PublishingSubmissionCsvField, string>>
> & {
  readonly workLabel: string;
  readonly partnerLabel: string;
};

export type SelectPublishingSubmissionCsvCommand = { readonly schemaVersion: 1 };
export type PublishingSubmissionCsvSelectionProjection =
  | { readonly schemaVersion: 1; readonly status: "cancelled" }
  | {
      readonly schemaVersion: 1;
      readonly status: "selected";
      readonly fileName: string;
      readonly csvText: string;
    };

export type ApplyPublishingSubmissionCsvImportCommand = {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly csvText: string;
  readonly mapping: PublishingSubmissionCsvMapping;
};

export type PublishingSubmissionCsvFileIssue =
  | "missing-header"
  | "duplicate-header"
  | "unknown-mapped-header";
export type PublishingSubmissionCsvRowIssueReason =
  | "missing-work-label"
  | "missing-partner-label"
  | "missing-work"
  | "ambiguous-work"
  | "missing-partner"
  | "ambiguous-partner"
  | "invalid-submitted-on"
  | "invalid-responded-on";

export type PublishingSubmissionCsvMappedValues = {
  readonly workLabel: string;
  readonly partnerLabel: string;
  readonly title?: string;
  readonly submittedOn?: string | null;
  readonly respondedOn?: string | null;
  readonly status?: string;
  readonly result?: string;
  readonly note?: string;
  readonly cardNote?: string;
};

export type PublishingSubmissionCsvReadyRow = {
  readonly rowNumber: number;
  readonly workId: EntityId<"Work">;
  readonly partnerId: EntityId<"PublishingPartner">;
  readonly values: PublishingSubmissionCsvMappedValues;
  readonly rawFields: Readonly<Record<string, string>>;
};

export type PublishingSubmissionCsvImportPreview = {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly headers: readonly string[];
  readonly mapping: PublishingSubmissionCsvMapping;
  readonly fileIssues: readonly PublishingSubmissionCsvFileIssue[];
  readonly readyRows: readonly PublishingSubmissionCsvReadyRow[];
  readonly rowIssues: readonly {
    readonly rowNumber: number;
    readonly reasons: readonly PublishingSubmissionCsvRowIssueReason[];
    readonly rawFields: Readonly<Record<string, string>>;
  }[];
};

export type PublishingSubmissionCsvImportResult = {
  readonly schemaVersion: 1;
  readonly importedCount: number;
  readonly skippedRowNumbers: readonly number[];
  readonly submissionIds: readonly EntityId<"PublishingSubmission">[];
  readonly submissionPackageIds: readonly EntityId<"SubmissionPackage">[];
  readonly sourceIds: readonly EntityId<"PublishingSource">[];
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(input: Record<string, unknown>, fields: readonly string[], label: string): void {
  const expected = new Set(fields);
  for (const field of Object.keys(input)) {
    if (!expected.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
  }
  for (const field of fields) {
    if (!(field in input)) throw new Error(`${label} is missing ${field}`);
  }
}

function schema(input: Record<string, unknown>, label: string): void {
  if (input.schemaVersion !== 1) throw new Error(`Unsupported ${label} schemaVersion`);
}

function string(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function nonEmpty(input: Record<string, unknown>, field: string, label: string): string {
  const value = string(input, field, label).trim();
  if (value.length === 0) throw new Error(`${label}.${field} must be non-empty`);
  return value;
}

function integer(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative safe integer`);
  }
  return value;
}

function parseMapping(value: unknown, label: string): PublishingSubmissionCsvMapping {
  const input = record(value, label);
  const allowed = new Set<string>(PUBLISHING_SUBMISSION_CSV_FIELDS);
  const output: Partial<Record<PublishingSubmissionCsvField, string>> = {};
  for (const [field, header] of Object.entries(input)) {
    if (!allowed.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
    if (typeof header !== "string" || header.trim().length === 0) {
      throw new Error(`${label}.${field} must be non-empty`);
    }
    output[field as PublishingSubmissionCsvField] = header.trim();
  }
  if (output.workLabel === undefined) throw new Error(`${label} is missing workLabel`);
  if (output.partnerLabel === undefined) throw new Error(`${label} is missing partnerLabel`);
  return Object.freeze(output) as PublishingSubmissionCsvMapping;
}

function normalized(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function mappedValues(
  rawFields: Readonly<Record<string, string>>,
  mapping: PublishingSubmissionCsvMapping,
): PublishingSubmissionCsvMappedValues {
  const value = (field: PublishingSubmissionCsvField) => {
    const header = mapping[field];
    return header === undefined ? undefined : rawFields[header] ?? "";
  };
  const date = (field: "submittedOn" | "respondedOn") => {
    const raw = value(field)?.trim();
    return raw === undefined ? undefined : raw.length === 0 ? null : raw;
  };
  return Object.freeze({
    workLabel: value("workLabel")?.trim() ?? "",
    partnerLabel: value("partnerLabel")?.trim() ?? "",
    ...(mapping.title === undefined ? {} : { title: value("title") ?? "" }),
    ...(mapping.submittedOn === undefined ? {} : {
      submittedOn: date("submittedOn") as string | null,
    }),
    ...(mapping.respondedOn === undefined ? {} : {
      respondedOn: date("respondedOn") as string | null,
    }),
    ...(mapping.status === undefined ? {} : { status: value("status") ?? "" }),
    ...(mapping.result === undefined ? {} : { result: value("result") ?? "" }),
    ...(mapping.note === undefined ? {} : { note: value("note") ?? "" }),
    ...(mapping.cardNote === undefined ? {} : { cardNote: value("cardNote") ?? "" }),
  });
}

export function buildPublishingSubmissionCsvImportPreview(input: {
  readonly fileName: string;
  readonly csvText: string;
  readonly mapping: PublishingSubmissionCsvMapping;
  readonly works: WorkspaceCatalogProjection["works"];
  readonly partners: readonly PublishingPartnerProjection[];
}): PublishingSubmissionCsvImportPreview {
  const parsed = parsePublishingPartnerCsvText(input.csvText);
  const fileIssues: PublishingSubmissionCsvFileIssue[] = [];
  if (parsed.headers.length === 0 || parsed.headers.some((header) => header.length === 0)) {
    fileIssues.push("missing-header");
  }
  if (new Set(parsed.headers).size !== parsed.headers.length) fileIssues.push("duplicate-header");
  if (Object.values(input.mapping).some((header) => !parsed.headers.includes(header))) {
    fileIssues.push("unknown-mapped-header");
  }

  const rows = parsed.rows.map((rawFields, index) => {
    const rowNumber = index + 2;
    const values = mappedValues(rawFields, input.mapping);
    const reasons: PublishingSubmissionCsvRowIssueReason[] = [];
    const workKey = normalized(values.workLabel);
    const partnerKey = normalized(values.partnerLabel);
    if (workKey.length === 0) reasons.push("missing-work-label");
    if (partnerKey.length === 0) reasons.push("missing-partner-label");
    const works = input.works.filter((work) => normalized(work.title) === workKey);
    const partners = input.partners.filter((partner) => normalized(partner.name) === partnerKey);
    if (workKey.length > 0 && works.length === 0) reasons.push("missing-work");
    else if (works.length > 1) reasons.push("ambiguous-work");
    if (partnerKey.length > 0 && partners.length === 0) reasons.push("missing-partner");
    else if (partners.length > 1) reasons.push("ambiguous-partner");
    if (typeof values.submittedOn === "string" && !isDateOnly(values.submittedOn)) {
      reasons.push("invalid-submitted-on");
    }
    if (typeof values.respondedOn === "string" && !isDateOnly(values.respondedOn)) {
      reasons.push("invalid-responded-on");
    }
    return {
      rowNumber,
      rawFields,
      values,
      workId: works[0]?.workId ?? null,
      partnerId: partners[0]?.partnerId ?? null,
      reasons,
    };
  });
  const readyRows = fileIssues.length > 0
    ? []
    : rows.filter((row) => row.reasons.length === 0).map((row) => Object.freeze({
        rowNumber: row.rowNumber,
        workId: row.workId as EntityId<"Work">,
        partnerId: row.partnerId as EntityId<"PublishingPartner">,
        values: row.values,
        rawFields: row.rawFields,
      }));
  const rowIssues = rows.filter((row) => row.reasons.length > 0).map((row) => Object.freeze({
    rowNumber: row.rowNumber,
    reasons: Object.freeze(row.reasons),
    rawFields: row.rawFields,
  }));
  return Object.freeze({
    schemaVersion: 1,
    fileName: input.fileName,
    headers: parsed.headers,
    mapping: input.mapping,
    fileIssues: Object.freeze(fileIssues),
    readyRows: Object.freeze(readyRows),
    rowIssues: Object.freeze(rowIssues),
  });
}

export function parseSelectPublishingSubmissionCsvCommand(
  value: unknown,
): SelectPublishingSubmissionCsvCommand {
  const label = "SelectPublishingSubmissionCsvCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parsePublishingSubmissionCsvSelectionProjection(
  value: unknown,
): PublishingSubmissionCsvSelectionProjection {
  const label = "PublishingSubmissionCsvSelectionProjection";
  const input = record(value, label);
  schema(input, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  if (input.status !== "selected") throw new Error(`${label}.status is unsupported`);
  exact(input, ["schemaVersion", "status", "fileName", "csvText"], label);
  return Object.freeze({
    schemaVersion: 1,
    status: "selected",
    fileName: nonEmpty(input, "fileName", label),
    csvText: string(input, "csvText", label),
  });
}

export function parseApplyPublishingSubmissionCsvImportCommand(
  value: unknown,
): ApplyPublishingSubmissionCsvImportCommand {
  const label = "ApplyPublishingSubmissionCsvImportCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion", "fileName", "csvText", "mapping"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    fileName: nonEmpty(input, "fileName", label),
    csvText: string(input, "csvText", label),
    mapping: parseMapping(input.mapping, `${label}.mapping`),
  });
}

function idArray<TEntity extends string>(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly EntityId<TEntity>[] {
  const value = input[field];
  if (!Array.isArray(value)) throw new Error(`${label}.${field} must be an array`);
  return Object.freeze(value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}.${field}[${index}] must be non-empty`);
    }
    return entityId<TEntity>(entry.trim());
  }));
}

export function parsePublishingSubmissionCsvImportResult(
  value: unknown,
): PublishingSubmissionCsvImportResult {
  const label = "PublishingSubmissionCsvImportResult";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "importedCount",
    "skippedRowNumbers",
    "submissionIds",
    "submissionPackageIds",
    "sourceIds",
  ], label);
  schema(input, label);
  const skipped = input.skippedRowNumbers;
  if (!Array.isArray(skipped)) throw new Error(`${label}.skippedRowNumbers must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    importedCount: integer(input, "importedCount", label),
    skippedRowNumbers: Object.freeze(skipped.map((entry, index) => {
      if (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 2) {
        throw new Error(`${label}.skippedRowNumbers[${index}] must be a CSV row number`);
      }
      return entry;
    })),
    submissionIds: idArray<"PublishingSubmission">(input, "submissionIds", label),
    submissionPackageIds: idArray<"SubmissionPackage">(
      input,
      "submissionPackageIds",
      label,
    ),
    sourceIds: idArray<"PublishingSource">(input, "sourceIds", label),
  });
}
