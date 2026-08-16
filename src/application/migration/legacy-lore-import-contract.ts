import {
  parseMigrationSourceInspection,
  type MigrationSourceInspection,
} from "./source-branch-inventory";
import {
  parseLegacyBrowserSourceExportReceipt,
  type LegacyBrowserSourceExportReceipt,
} from "./browser-source-export";

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

export type LegacyLoreImportRehearsalSourceSnapshot = {
  readonly sourceSnapshotId: string;
  readonly sourceLocator: string;
  readonly checksumIdentity: string;
  readonly checksumValue: string;
  readonly byteLength: number;
};

export type LegacyLoreImportRehearsalConnectorMetadata = {
  readonly connectorKind: string;
  readonly credentialKind: string;
  readonly present: boolean;
};

export type LegacyLoreImportRehearsalSummary = {
  readonly schemaVersion: 1;
  readonly sourceRootPath: string;
  readonly sourceSnapshotId: string;
  readonly sourceChecksumIdentity: string;
  readonly sourceChecksumValue: string;
  readonly sourceByteLength: number;
  readonly sourceSnapshots: readonly LegacyLoreImportRehearsalSourceSnapshot[];
  readonly connectorMetadata: readonly LegacyLoreImportRehearsalConnectorMetadata[];
  readonly browserSourceReceipt: LegacyBrowserSourceExportReceipt | null;
  readonly sourceInspection: MigrationSourceInspection;
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

function parseSourceSnapshots(
  value: unknown,
  label: string,
): readonly LegacyLoreImportRehearsalSourceSnapshot[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const snapshotIds = new Set<string>();
  const sourceLocators = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    const input = record(entry, entryLabel);
    exact(
      input,
      [
        "sourceSnapshotId",
        "sourceLocator",
        "checksumIdentity",
        "checksumValue",
        "byteLength",
      ],
      entryLabel,
    );
    const sourceSnapshotId = text(input, "sourceSnapshotId", entryLabel);
    const sourceLocator = text(input, "sourceLocator", entryLabel);
    if (
      snapshotIds.has(sourceSnapshotId) ||
      sourceLocators.has(sourceLocator)
    ) {
      throw new Error(`${label} contains a duplicate snapshot identity`);
    }
    snapshotIds.add(sourceSnapshotId);
    sourceLocators.add(sourceLocator);
    return Object.freeze({
      sourceSnapshotId,
      sourceLocator,
      checksumIdentity: text(input, "checksumIdentity", entryLabel),
      checksumValue: text(input, "checksumValue", entryLabel),
      byteLength: count(input, "byteLength", entryLabel),
    });
  }));
}

function parseConnectorMetadata(
  value: unknown,
  label: string,
): readonly LegacyLoreImportRehearsalConnectorMetadata[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const identities = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    const input = record(entry, entryLabel);
    exact(
      input,
      ["connectorKind", "credentialKind", "present"],
      entryLabel,
    );
    const connectorKind = text(input, "connectorKind", entryLabel);
    const credentialKind = text(input, "credentialKind", entryLabel);
    if (typeof input.present !== "boolean") {
      throw new Error(`${entryLabel}.present must be a boolean`);
    }
    const identity = JSON.stringify([connectorKind, credentialKind]);
    if (identities.has(identity)) {
      throw new Error(`${label} contains a duplicate connector identity`);
    }
    identities.add(identity);
    return Object.freeze({
      connectorKind,
      credentialKind,
      present: input.present,
    });
  }));
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
      "sourceSnapshots",
      "connectorMetadata",
      "browserSourceReceipt",
      "sourceInspection",
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
  const sourceSnapshotId = text(input, "sourceSnapshotId", label);
  const sourceChecksumIdentity = text(input, "sourceChecksumIdentity", label);
  const sourceChecksumValue = text(input, "sourceChecksumValue", label);
  const sourceByteLength = count(input, "sourceByteLength", label);
  const sourceSnapshots = parseSourceSnapshots(
    input.sourceSnapshots,
    `${label}.sourceSnapshots`,
  );
  if (!sourceSnapshots.some((snapshot) =>
    snapshot.sourceSnapshotId === sourceSnapshotId &&
    snapshot.checksumIdentity === sourceChecksumIdentity &&
    snapshot.checksumValue === sourceChecksumValue &&
    snapshot.byteLength === sourceByteLength
  )) {
    throw new Error(`${label} mapping snapshot is not in sourceSnapshots`);
  }
  return Object.freeze({
    schemaVersion: 1,
    sourceRootPath: text(input, "sourceRootPath", label),
    sourceSnapshotId,
    sourceChecksumIdentity,
    sourceChecksumValue,
    sourceByteLength,
    sourceSnapshots,
    connectorMetadata: parseConnectorMetadata(
      input.connectorMetadata,
      `${label}.connectorMetadata`,
    ),
    browserSourceReceipt: input.browserSourceReceipt === null
      ? null
      : parseLegacyBrowserSourceExportReceipt(input.browserSourceReceipt),
    sourceInspection: parseMigrationSourceInspection(input.sourceInspection),
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
