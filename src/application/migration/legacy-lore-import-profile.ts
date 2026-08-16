import type { AnchorPolicy } from "../anchors/create-anchor";
import type { MigrationSourceBranchKind } from "./source-branch-inventory";

export type LegacyLoreImportProfile = {
  readonly schemaVersion: 1;
  readonly source: {
    readonly sourceProfileId: string;
    readonly formatIdentity: string;
    readonly formatVersion: string;
    readonly checksumIdentity: string;
    readonly checksumAlgorithm: string;
    readonly mappingSourceLocator: string;
    readonly captures: readonly {
      readonly branchKind: MigrationSourceBranchKind;
      readonly sourceFileSegments: readonly string[];
      readonly sourceLocator: string;
      readonly rawEntrySegments: readonly string[];
    }[];
    readonly connectorProbes: readonly {
      readonly sourceFileSegments: readonly string[];
      readonly connectorKind: string;
      readonly credentialKind: string;
    }[];
    readonly archiveDirectoryName: string;
    readonly manifestEntrySegments: readonly string[];
  };
  readonly rehearsal: {
    readonly directoryName: string;
    readonly reportFileName: string;
    readonly mapperVersion: string;
    readonly resumeWorkspaceMode: string;
    readonly completedWritingSessionState: string;
    readonly secretLikeFieldFragments: readonly string[];
    readonly secretRedactionValue: string;
    readonly anchorPolicy: AnchorPolicy;
    readonly anchorEvidenceChecksumAlgorithm: string;
  };
  readonly content: {
    readonly manuscriptChecksumIdentity: string;
    readonly manuscriptChecksumAlgorithm: string;
    readonly rawSerializationIdentity: string;
    readonly rawChecksumIdentity: string;
    readonly rawChecksumAlgorithm: string;
  };
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

function text(
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

function safeSegment(value: string, label: string): string {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(`${label} must be one safe path segment`);
  }
  return value;
}

function segments(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty segment array`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (typeof entry !== "string") {
        throw new Error(`${label}.${field}[${index}] must be a string`);
      }
      return safeSegment(entry, `${label}.${field}[${index}]`);
    }),
  );
}

function strings(
  input: Record<string, unknown>,
  field: string,
  label: string,
): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value)) {
    throw new Error(`${label}.${field} must be a string array`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (typeof entry !== "string" || entry.length === 0) {
        throw new Error(`${label}.${field}[${index}] must be non-empty`);
      }
      return entry;
    }),
  );
}

function captures(
  input: Record<string, unknown>,
  field: string,
  label: string,
): LegacyLoreImportProfile["source"]["captures"] {
  const value = input[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}.${field} must be a non-empty capture array`);
  }
  const sourceLocators = new Set<string>();
  const rawEntries = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const entryLabel = `${label}.${field}[${index}]`;
    const capture = record(entry, entryLabel);
    exact(
      capture,
      ["branchKind", "sourceFileSegments", "sourceLocator", "rawEntrySegments"],
      entryLabel,
    );
    if (
      capture.branchKind !== "live-file" &&
      capture.branchKind !== "backup-file" &&
      capture.branchKind !== "local-storage" &&
      capture.branchKind !== "indexed-db"
    ) {
      throw new Error(`${entryLabel}.branchKind is unsupported`);
    }
    const sourceFileSegments = segments(
      capture,
      "sourceFileSegments",
      entryLabel,
    );
    const sourceLocator = text(capture, "sourceLocator", entryLabel);
    const rawEntrySegments = segments(
      capture,
      "rawEntrySegments",
      entryLabel,
    );
    const rawEntry = rawEntrySegments.join("/");
    if (sourceLocators.has(sourceLocator) || rawEntries.has(rawEntry)) {
      throw new Error(`${label}.${field} contains a duplicate identity`);
    }
    sourceLocators.add(sourceLocator);
    rawEntries.add(rawEntry);
    return Object.freeze({
      branchKind: capture.branchKind,
      sourceFileSegments,
      sourceLocator,
      rawEntrySegments,
    });
  }));
}

function connectorProbes(
  input: Record<string, unknown>,
  field: string,
  label: string,
): LegacyLoreImportProfile["source"]["connectorProbes"] {
  const value = input[field];
  if (!Array.isArray(value)) {
    throw new Error(`${label}.${field} must be a connector probe array`);
  }
  const identities = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const entryLabel = `${label}.${field}[${index}]`;
    const probe = record(entry, entryLabel);
    exact(
      probe,
      ["sourceFileSegments", "connectorKind", "credentialKind"],
      entryLabel,
    );
    const sourceFileSegments = segments(
      probe,
      "sourceFileSegments",
      entryLabel,
    );
    const connectorKind = text(probe, "connectorKind", entryLabel);
    const credentialKind = text(probe, "credentialKind", entryLabel);
    const identity = JSON.stringify([
      sourceFileSegments,
      connectorKind,
      credentialKind,
    ]);
    if (identities.has(identity)) {
      throw new Error(`${label}.${field} contains a duplicate probe`);
    }
    identities.add(identity);
    return Object.freeze({
      sourceFileSegments,
      connectorKind,
      credentialKind,
    });
  }));
}

export function parseLegacyLoreImportProfile(
  value: unknown,
): LegacyLoreImportProfile {
  const label = "LegacyLoreImportProfile";
  const input = record(value, label);
  exact(input, ["schemaVersion", "source", "rehearsal", "content"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported ${label}.schemaVersion`);
  }
  const source = record(input.source, `${label}.source`);
  exact(
    source,
    [
      "sourceProfileId",
      "formatIdentity",
      "formatVersion",
      "checksumIdentity",
      "checksumAlgorithm",
      "mappingSourceLocator",
      "captures",
      "connectorProbes",
      "archiveDirectoryName",
      "manifestEntrySegments",
    ],
    `${label}.source`,
  );
  const rehearsal = record(input.rehearsal, `${label}.rehearsal`);
  exact(
    rehearsal,
    [
      "directoryName",
      "reportFileName",
      "mapperVersion",
      "resumeWorkspaceMode",
      "completedWritingSessionState",
      "secretLikeFieldFragments",
      "secretRedactionValue",
      "anchorPolicy",
      "anchorEvidenceChecksumAlgorithm",
    ],
    `${label}.rehearsal`,
  );
  const anchorPolicy = record(
    rehearsal.anchorPolicy,
    `${label}.rehearsal.anchorPolicy`,
  );
  exact(
    anchorPolicy,
    ["schemaVersion", "version", "contextOffsetLength"],
    `${label}.rehearsal.anchorPolicy`,
  );
  if (
    anchorPolicy.schemaVersion !== 1 ||
    !Number.isSafeInteger(anchorPolicy.contextOffsetLength) ||
    Number(anchorPolicy.contextOffsetLength) < 0
  ) {
    throw new Error(`${label}.rehearsal.anchorPolicy is invalid`);
  }
  const content = record(input.content, `${label}.content`);
  exact(
    content,
    [
      "manuscriptChecksumIdentity",
      "manuscriptChecksumAlgorithm",
      "rawSerializationIdentity",
      "rawChecksumIdentity",
      "rawChecksumAlgorithm",
    ],
    `${label}.content`,
  );
  const parsedCaptures = captures(source, "captures", `${label}.source`);
  const mappingSourceLocator = text(
    source,
    "mappingSourceLocator",
    `${label}.source`,
  );
  if (
    parsedCaptures.filter(
      (capture) => capture.sourceLocator === mappingSourceLocator,
    ).length !== 1
  ) {
    throw new Error(
      `${label}.source.mappingSourceLocator must identify one capture`,
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    source: Object.freeze({
      sourceProfileId: text(source, "sourceProfileId", `${label}.source`),
      formatIdentity: text(source, "formatIdentity", `${label}.source`),
      formatVersion: text(source, "formatVersion", `${label}.source`),
      checksumIdentity: text(source, "checksumIdentity", `${label}.source`),
      checksumAlgorithm: text(source, "checksumAlgorithm", `${label}.source`),
      mappingSourceLocator,
      captures: parsedCaptures,
      connectorProbes: connectorProbes(
        source,
        "connectorProbes",
        `${label}.source`,
      ),
      archiveDirectoryName: safeSegment(
        text(source, "archiveDirectoryName", `${label}.source`),
        `${label}.source.archiveDirectoryName`,
      ),
      manifestEntrySegments: segments(
        source,
        "manifestEntrySegments",
        `${label}.source`,
      ),
    }),
    rehearsal: Object.freeze({
      directoryName: safeSegment(
        text(rehearsal, "directoryName", `${label}.rehearsal`),
        `${label}.rehearsal.directoryName`,
      ),
      reportFileName: safeSegment(
        text(rehearsal, "reportFileName", `${label}.rehearsal`),
        `${label}.rehearsal.reportFileName`,
      ),
      mapperVersion: text(rehearsal, "mapperVersion", `${label}.rehearsal`),
      resumeWorkspaceMode: text(
        rehearsal,
        "resumeWorkspaceMode",
        `${label}.rehearsal`,
      ),
      completedWritingSessionState: text(
        rehearsal,
        "completedWritingSessionState",
        `${label}.rehearsal`,
      ),
      secretLikeFieldFragments: strings(
        rehearsal,
        "secretLikeFieldFragments",
        `${label}.rehearsal`,
      ),
      secretRedactionValue: text(
        rehearsal,
        "secretRedactionValue",
        `${label}.rehearsal`,
      ),
      anchorPolicy: Object.freeze({
        schemaVersion: 1,
        version: text(
          anchorPolicy,
          "version",
          `${label}.rehearsal.anchorPolicy`,
        ),
        contextOffsetLength: Number(anchorPolicy.contextOffsetLength),
      }),
      anchorEvidenceChecksumAlgorithm: text(
        rehearsal,
        "anchorEvidenceChecksumAlgorithm",
        `${label}.rehearsal`,
      ),
    }),
    content: Object.freeze({
      manuscriptChecksumIdentity: text(
        content,
        "manuscriptChecksumIdentity",
        `${label}.content`,
      ),
      manuscriptChecksumAlgorithm: text(
        content,
        "manuscriptChecksumAlgorithm",
        `${label}.content`,
      ),
      rawSerializationIdentity: text(
        content,
        "rawSerializationIdentity",
        `${label}.content`,
      ),
      rawChecksumIdentity: text(
        content,
        "rawChecksumIdentity",
        `${label}.content`,
      ),
      rawChecksumAlgorithm: text(
        content,
        "rawChecksumAlgorithm",
        `${label}.content`,
      ),
    }),
  });
}
