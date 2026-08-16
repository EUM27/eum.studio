import { entityId, type EntityId } from "../../domain/writing";
import type { PublishingPartnerProjection } from "./publishing-partner-contract";

export const PUBLISHING_PARTNER_CSV_FIELDS = [
  "name",
  "parentPartnerName",
  "submissionMethod",
  "websiteUrl",
  "email",
  "genres",
  "requiredLength",
  "priority",
  "note",
] as const;

export type PublishingPartnerCsvField =
  (typeof PUBLISHING_PARTNER_CSV_FIELDS)[number];
export type PublishingPartnerCsvMapping = Readonly<
  Partial<Record<PublishingPartnerCsvField, string>>
> & { readonly name: string };

export type SelectPublishingPartnerCsvCommand = { readonly schemaVersion: 1 };
export type PublishingPartnerCsvSelectionProjection =
  | { readonly schemaVersion: 1; readonly status: "cancelled" }
  | {
      readonly schemaVersion: 1;
      readonly status: "selected";
      readonly fileName: string;
      readonly csvText: string;
    };

export type ApplyPublishingPartnerCsvImportCommand = {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly csvText: string;
  readonly mapping: PublishingPartnerCsvMapping;
};

export type PublishingPartnerCsvFileIssue =
  | "missing-header"
  | "duplicate-header"
  | "unknown-mapped-header";
export type PublishingPartnerCsvRowIssueReason =
  | "missing-name"
  | "duplicate-import-name"
  | "ambiguous-existing-partner"
  | "missing-parent"
  | "ambiguous-parent"
  | "self-parent";

export type PublishingPartnerCsvMappedValues = {
  readonly name: string;
  readonly parentPartnerName?: string;
  readonly submissionMethod?: string;
  readonly websiteUrl?: string;
  readonly email?: string;
  readonly genres?: readonly string[];
  readonly requiredLength?: string;
  readonly priority?: string;
  readonly note?: string;
};

export type PublishingPartnerCsvReadyRow = {
  readonly rowNumber: number;
  readonly existingPartnerId: EntityId<"PublishingPartner"> | null;
  readonly values: PublishingPartnerCsvMappedValues;
  readonly rawFields: Readonly<Record<string, string>>;
};

export type PublishingPartnerCsvImportPreview = {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly headers: readonly string[];
  readonly mapping: PublishingPartnerCsvMapping;
  readonly fileIssues: readonly PublishingPartnerCsvFileIssue[];
  readonly readyRows: readonly PublishingPartnerCsvReadyRow[];
  readonly rowIssues: readonly {
    readonly rowNumber: number;
    readonly reasons: readonly PublishingPartnerCsvRowIssueReason[];
    readonly rawFields: Readonly<Record<string, string>>;
  }[];
};

export type PublishingPartnerCsvImportResult = {
  readonly schemaVersion: 1;
  readonly importedCount: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly skippedRowNumbers: readonly number[];
  readonly partnerIds: readonly EntityId<"PublishingPartner">[];
  readonly sourceIds: readonly EntityId<"PublishingSource">[];
};

type ParsedCsv = {
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
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

function parseMapping(value: unknown, label: string): PublishingPartnerCsvMapping {
  const input = record(value, label);
  const allowed = new Set<string>(PUBLISHING_PARTNER_CSV_FIELDS);
  const output: Partial<Record<PublishingPartnerCsvField, string>> = {};
  for (const [field, header] of Object.entries(input)) {
    if (!allowed.has(field)) throw new Error(`Unsupported ${label} field: ${field}`);
    if (typeof header !== "string" || header.trim().length === 0) {
      throw new Error(`${label}.${field} must be non-empty`);
    }
    output[field as PublishingPartnerCsvField] = header.trim();
  }
  if (output.name === undefined) throw new Error(`${label} is missing name`);
  return Object.freeze(output) as PublishingPartnerCsvMapping;
}

function parseCells(input: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return Object.freeze(rows.map((entry) => Object.freeze(entry)));
}

export function parsePublishingPartnerCsvText(csvText: string): ParsedCsv {
  const cells = parseCells(csvText.replace(/^\uFEFF/u, ""));
  const headers = Object.freeze((cells[0] ?? []).map((header) => header.trim()));
  if (headers.length === 0 || headers.some((header) => header.length === 0)) {
    return Object.freeze({ headers, rows: Object.freeze([]) });
  }
  const rows = Object.freeze(cells.slice(1)
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) => Object.freeze(Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    ))));
  return Object.freeze({ headers, rows });
}

function normalized(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function splitGenres(value: string): readonly string[] {
  return Object.freeze(value.split(",").map((entry) => entry.trim()).filter(Boolean));
}

function mappedValues(
  rawFields: Readonly<Record<string, string>>,
  mapping: PublishingPartnerCsvMapping,
): PublishingPartnerCsvMappedValues {
  const value = (field: PublishingPartnerCsvField) => {
    const header = mapping[field];
    return header === undefined ? undefined : rawFields[header] ?? "";
  };
  const name = value("name")?.trim() ?? "";
  return Object.freeze({
    name,
    ...(mapping.parentPartnerName === undefined ? {} : {
      parentPartnerName: value("parentPartnerName")?.trim() ?? "",
    }),
    ...(mapping.submissionMethod === undefined ? {} : {
      submissionMethod: value("submissionMethod") ?? "",
    }),
    ...(mapping.websiteUrl === undefined ? {} : { websiteUrl: value("websiteUrl") ?? "" }),
    ...(mapping.email === undefined ? {} : { email: value("email") ?? "" }),
    ...(mapping.genres === undefined ? {} : { genres: splitGenres(value("genres") ?? "") }),
    ...(mapping.requiredLength === undefined ? {} : {
      requiredLength: value("requiredLength") ?? "",
    }),
    ...(mapping.priority === undefined ? {} : { priority: value("priority") ?? "" }),
    ...(mapping.note === undefined ? {} : { note: value("note") ?? "" }),
  });
}

export function buildPublishingPartnerCsvImportPreview(input: {
  readonly fileName: string;
  readonly csvText: string;
  readonly mapping: PublishingPartnerCsvMapping;
  readonly partners: readonly PublishingPartnerProjection[];
}): PublishingPartnerCsvImportPreview {
  const parsed = parsePublishingPartnerCsvText(input.csvText);
  const fileIssues: PublishingPartnerCsvFileIssue[] = [];
  if (parsed.headers.length === 0 || parsed.headers.some((header) => header.length === 0)) {
    fileIssues.push("missing-header");
  }
  if (new Set(parsed.headers).size !== parsed.headers.length) {
    fileIssues.push("duplicate-header");
  }
  if (Object.values(input.mapping).some((header) => !parsed.headers.includes(header))) {
    fileIssues.push("unknown-mapped-header");
  }

  const candidates = parsed.rows.map((rawFields, index) => ({
    rowNumber: index + 2,
    rawFields,
    values: mappedValues(rawFields, input.mapping),
  }));
  const importNameCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = normalized(candidate.values.name);
    if (key.length > 0) importNameCounts.set(key, (importNameCounts.get(key) ?? 0) + 1);
  }
  const base = candidates.map((candidate) => {
    const reasons: PublishingPartnerCsvRowIssueReason[] = [];
    const nameKey = normalized(candidate.values.name);
    if (nameKey.length === 0) reasons.push("missing-name");
    if ((importNameCounts.get(nameKey) ?? 0) > 1) reasons.push("duplicate-import-name");
    const existing = input.partners.filter((partner) => normalized(partner.name) === nameKey);
    if (existing.length > 1) reasons.push("ambiguous-existing-partner");
    return {
      ...candidate,
      existingPartnerId: existing[0]?.partnerId ?? null,
      reasons,
    };
  });

  const identityByName = new Map<string, Set<string>>();
  for (const partner of input.partners) {
    const key = normalized(partner.name);
    const identities = identityByName.get(key) ?? new Set<string>();
    identities.add(partner.partnerId);
    identityByName.set(key, identities);
  }
  for (const candidate of base) {
    if (candidate.reasons.length > 0) continue;
    const key = normalized(candidate.values.name);
    const identities = identityByName.get(key) ?? new Set<string>();
    identities.add(candidate.existingPartnerId ?? `row:${candidate.rowNumber}`);
    identityByName.set(key, identities);
  }

  for (const candidate of base) {
    const parentName = candidate.values.parentPartnerName;
    if (parentName === undefined || parentName.length === 0 || candidate.reasons.length > 0) continue;
    const identities = [...(identityByName.get(normalized(parentName)) ?? [])];
    if (identities.length === 0) candidate.reasons.push("missing-parent");
    else if (identities.length > 1) candidate.reasons.push("ambiguous-parent");
    else if (identities[0] === (candidate.existingPartnerId ?? `row:${candidate.rowNumber}`)) {
      candidate.reasons.push("self-parent");
    }
  }

  const readyRows = fileIssues.length > 0
    ? []
    : base.filter((candidate) => candidate.reasons.length === 0).map((candidate) =>
        Object.freeze({
          rowNumber: candidate.rowNumber,
          existingPartnerId: candidate.existingPartnerId,
          values: candidate.values,
          rawFields: candidate.rawFields,
        }));
  const rowIssues = base.filter((candidate) => candidate.reasons.length > 0).map((candidate) =>
    Object.freeze({
      rowNumber: candidate.rowNumber,
      reasons: Object.freeze(candidate.reasons),
      rawFields: candidate.rawFields,
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

export function parseSelectPublishingPartnerCsvCommand(value: unknown): SelectPublishingPartnerCsvCommand {
  const label = "SelectPublishingPartnerCsvCommand";
  const input = record(value, label);
  exact(input, ["schemaVersion"], label);
  schema(input, label);
  return Object.freeze({ schemaVersion: 1 });
}

export function parsePublishingPartnerCsvSelectionProjection(
  value: unknown,
): PublishingPartnerCsvSelectionProjection {
  const label = "PublishingPartnerCsvSelectionProjection";
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

export function parseApplyPublishingPartnerCsvImportCommand(
  value: unknown,
): ApplyPublishingPartnerCsvImportCommand {
  const label = "ApplyPublishingPartnerCsvImportCommand";
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

export function parsePublishingPartnerCsvImportResult(
  value: unknown,
): PublishingPartnerCsvImportResult {
  const label = "PublishingPartnerCsvImportResult";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "importedCount",
    "createdCount",
    "updatedCount",
    "skippedRowNumbers",
    "partnerIds",
    "sourceIds",
  ], label);
  schema(input, label);
  const skipped = input.skippedRowNumbers;
  if (!Array.isArray(skipped)) throw new Error(`${label}.skippedRowNumbers must be an array`);
  return Object.freeze({
    schemaVersion: 1,
    importedCount: integer(input, "importedCount", label),
    createdCount: integer(input, "createdCount", label),
    updatedCount: integer(input, "updatedCount", label),
    skippedRowNumbers: Object.freeze(skipped.map((entry, index) => {
      if (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 2) {
        throw new Error(`${label}.skippedRowNumbers[${index}] must be a CSV row number`);
      }
      return entry;
    })),
    partnerIds: idArray<"PublishingPartner">(input, "partnerIds", label),
    sourceIds: idArray<"PublishingSource">(input, "sourceIds", label),
  });
}
