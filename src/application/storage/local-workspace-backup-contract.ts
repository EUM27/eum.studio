export type LocalWorkspaceBackupCounts = {
  readonly workCount: number;
  readonly documentCount: number;
  readonly revisionCount: number;
  readonly resumeCheckpointCount: number;
  readonly writingSessionCount: number;
};

export type LocalWorkspaceBackupMediaCounts = {
  readonly managedFileCount: number;
  readonly externalReferenceCount: number;
  readonly disconnectedExternalReferenceCount: number;
  readonly managedByteLength: number;
};

export type LocalWorkspaceBackupSummary = {
  readonly schemaVersion: 1;
  readonly bundlePath: string;
  readonly targetPath: string | null;
  readonly createdAt: string;
  readonly verifiedAt: string;
  readonly lastAction: "created" | "restored";
  readonly counts: LocalWorkspaceBackupCounts;
  readonly media: LocalWorkspaceBackupMediaCounts;
};

export type LocalWorkspaceBackupStatusProjection = {
  readonly schemaVersion: 1;
  readonly lastVerified: LocalWorkspaceBackupSummary | null;
};

export type LocalWorkspaceBackupActionResult =
  | {
      readonly schemaVersion: 1;
      readonly status: "cancelled";
    }
  | {
      readonly schemaVersion: 1;
      readonly status: "completed";
      readonly summary: LocalWorkspaceBackupSummary;
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
): string {
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty string`);
  }
  return value;
}

function nullableString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string | null {
  const value = input[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${field} must be null or a non-empty string`);
  }
  return value;
}

function counts(value: unknown, label: string): LocalWorkspaceBackupCounts {
  const input = record(value, label);
  const fields = [
    "workCount",
    "documentCount",
    "revisionCount",
    "resumeCheckpointCount",
    "writingSessionCount",
  ] as const;
  exact(input, fields, label);
  return Object.freeze(
    Object.fromEntries(
      fields.map((field) => {
        const entry = input[field];
        if (
          typeof entry !== "number" ||
          !Number.isSafeInteger(entry) ||
          entry < 0
        ) {
          throw new Error(`${label}.${field} must be a non-negative integer`);
        }
        return [field, entry];
      }),
    ) as unknown as LocalWorkspaceBackupCounts,
  );
}

function mediaCounts(
  value: unknown,
  label: string,
): LocalWorkspaceBackupMediaCounts {
  const input = record(value, label);
  const fields = [
    "managedFileCount",
    "externalReferenceCount",
    "disconnectedExternalReferenceCount",
    "managedByteLength",
  ] as const;
  exact(input, fields, label);
  const parsed = Object.freeze(
    Object.fromEntries(
      fields.map((field) => {
        const entry = input[field];
        if (
          typeof entry !== "number" ||
          !Number.isSafeInteger(entry) ||
          entry < 0
        ) {
          throw new Error(`${label}.${field} must be a non-negative integer`);
        }
        return [field, entry];
      }),
    ) as unknown as LocalWorkspaceBackupMediaCounts,
  );
  if (
    parsed.disconnectedExternalReferenceCount >
      parsed.externalReferenceCount ||
    (parsed.managedFileCount === 0 && parsed.managedByteLength !== 0)
  ) {
    throw new Error(`${label} values are inconsistent`);
  }
  return parsed;
}

export const EMPTY_LOCAL_WORKSPACE_BACKUP_MEDIA_COUNTS =
  Object.freeze<LocalWorkspaceBackupMediaCounts>({
    managedFileCount: 0,
    externalReferenceCount: 0,
    disconnectedExternalReferenceCount: 0,
    managedByteLength: 0,
  });

export function parseLocalWorkspaceBackupSummary(
  value: unknown,
): LocalWorkspaceBackupSummary {
  const label = "LocalWorkspaceBackupSummary";
  const input = record(value, label);
  const fields = [
    "schemaVersion",
    "bundlePath",
    "targetPath",
    "createdAt",
    "verifiedAt",
    "lastAction",
    "counts",
  ];
  exact(input, input.media === undefined ? fields : [...fields, "media"], label);
  schema(input, label);
  if (input.lastAction !== "created" && input.lastAction !== "restored") {
    throw new Error(`${label}.lastAction is unsupported`);
  }
  return Object.freeze({
    schemaVersion: 1,
    bundlePath: stringValue(input, "bundlePath", label),
    targetPath: nullableString(input, "targetPath", label),
    createdAt: stringValue(input, "createdAt", label),
    verifiedAt: stringValue(input, "verifiedAt", label),
    lastAction: input.lastAction,
    counts: counts(input.counts, `${label}.counts`),
    media: input.media === undefined
      ? EMPTY_LOCAL_WORKSPACE_BACKUP_MEDIA_COUNTS
      : mediaCounts(input.media, `${label}.media`),
  });
}

export function parseLocalWorkspaceBackupStatusProjection(
  value: unknown,
): LocalWorkspaceBackupStatusProjection {
  const label = "LocalWorkspaceBackupStatusProjection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "lastVerified"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    lastVerified:
      input.lastVerified === null
        ? null
        : parseLocalWorkspaceBackupSummary(input.lastVerified),
  });
}

export function parseLocalWorkspaceBackupActionResult(
  value: unknown,
): LocalWorkspaceBackupActionResult {
  const label = "LocalWorkspaceBackupActionResult";
  const input = record(value, label);
  if (input.status === "cancelled") {
    exact(input, ["schemaVersion", "status"], label);
    schema(input, label);
    return Object.freeze({ schemaVersion: 1, status: "cancelled" });
  }
  if (input.status !== "completed") {
    throw new Error(`${label}.status is unsupported`);
  }
  exact(input, ["schemaVersion", "status", "summary"], label);
  schema(input, label);
  return Object.freeze({
    schemaVersion: 1,
    status: "completed",
    summary: parseLocalWorkspaceBackupSummary(input.summary),
  });
}
