export type LegacyLoreImportRehearsalCounts = {
  readonly workCount: number;
  readonly folderCount: number;
  readonly documentCount: number;
  readonly revisionCount: number;
  readonly resumeCheckpointCount: number;
  readonly writingSessionCount: number;
  readonly rawItemCount: number;
  readonly receiptCount: number;
  readonly sourceItemCount: number;
  readonly uncoveredItemCount: number;
  readonly orphanManuscriptCount: number;
};

export type LegacyLoreImportRehearsalSummary = {
  readonly schemaVersion: 1;
  readonly sourceRootPath: string;
  readonly sourceSnapshotId: string;
  readonly sourceChecksumIdentity: string;
  readonly sourceChecksumValue: string;
  readonly sourceByteLength: number;
  readonly targetRootPath: string;
  readonly rehearsalWorkspacePath: string;
  readonly reportPath: string;
  readonly capturedAt: string;
  readonly publication: "published" | "reused";
  readonly sourceUnchanged: true;
  readonly issueCount: number;
  readonly counts: LegacyLoreImportRehearsalCounts;
};

export type LegacyLoreImportRehearsalActionResult =
  | { readonly schemaVersion: 1; readonly status: "cancelled" }
  | {
      readonly schemaVersion: 1;
      readonly status: "completed";
      readonly summary: LegacyLoreImportRehearsalSummary;
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

function text(input: Record<string, unknown>, field: string, label: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function count(input: Record<string, unknown>, field: string, label: string): number {
  const value = input[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

export function parseLegacyLoreImportRehearsalSummary(
  value: unknown,
): LegacyLoreImportRehearsalSummary {
  const label = "LegacyLoreImportRehearsalSummary";
  const input = record(value, label);
  exact(
    input,
    [
      "schemaVersion",
      "sourceRootPath",
      "sourceSnapshotId",
      "sourceChecksumIdentity",
      "sourceChecksumValue",
      "sourceByteLength",
      "targetRootPath",
      "rehearsalWorkspacePath",
      "reportPath",
      "capturedAt",
      "publication",
      "sourceUnchanged",
      "issueCount",
      "counts",
    ],
    label,
  );
  if (
    input.schemaVersion !== 1 ||
    (input.publication !== "published" && input.publication !== "reused") ||
    input.sourceUnchanged !== true
  ) {
    throw new Error(`${label} contains an unsupported value`);
  }
  const countsInput = record(input.counts, `${label}.counts`);
  const countFields = [
    "workCount",
    "folderCount",
    "documentCount",
    "revisionCount",
    "resumeCheckpointCount",
    "writingSessionCount",
    "rawItemCount",
    "receiptCount",
    "sourceItemCount",
    "uncoveredItemCount",
    "orphanManuscriptCount",
  ] as const;
  exact(countsInput, countFields, `${label}.counts`);
  const counts = Object.freeze(
    Object.fromEntries(
      countFields.map((field) => [field, count(countsInput, field, `${label}.counts`)]),
    ),
  ) as LegacyLoreImportRehearsalCounts;
  return Object.freeze({
    schemaVersion: 1,
    sourceRootPath: text(input, "sourceRootPath", label),
    sourceSnapshotId: text(input, "sourceSnapshotId", label),
    sourceChecksumIdentity: text(input, "sourceChecksumIdentity", label),
    sourceChecksumValue: text(input, "sourceChecksumValue", label),
    sourceByteLength: count(input, "sourceByteLength", label),
    targetRootPath: text(input, "targetRootPath", label),
    rehearsalWorkspacePath: text(input, "rehearsalWorkspacePath", label),
    reportPath: text(input, "reportPath", label),
    capturedAt: text(input, "capturedAt", label),
    publication: input.publication,
    sourceUnchanged: true,
    issueCount: count(input, "issueCount", label),
    counts,
  });
}

export function parseLegacyLoreImportRehearsalActionResult(
  value: unknown,
): LegacyLoreImportRehearsalActionResult {
  const label = "LegacyLoreImportRehearsalActionResult";
  const input = record(value, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    if (input.schemaVersion !== 1) {
      throw new Error(`Unsupported ${label}.schemaVersion`);
    }
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  exact(input, ["schemaVersion", "status", "summary"], label);
  if (input.schemaVersion !== 1 || input.status !== "completed") {
    throw new Error(`${label} contains an unsupported value`);
  }
  return Object.freeze({
    schemaVersion: 1,
    status: "completed",
    summary: parseLegacyLoreImportRehearsalSummary(input.summary),
  });
}
