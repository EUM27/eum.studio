import {
  isAbsolute,
  normalize,
  sep,
} from "node:path";

import {
  parseManuscriptBatchingPolicy,
  type ManuscriptBatchingPolicy,
} from "../../src/application/persistence/manuscript-persistence-profile";

export type Poc2InstalledPackageProfile = {
  readonly schemaVersion: 1;
  readonly electronRuntimeDirectoryPath:
    string;
  readonly applicationManifestPath:
    string;
  readonly applicationManifestTargetRelativePath:
    string;
  readonly mainBundleDirectoryPath:
    string;
  readonly mainBundleTargetRelativePath:
    string;
  readonly rendererBundleDirectoryPath:
    string;
  readonly rendererBundleTargetRelativePath:
    string;
  readonly applicationResourcesRelativePath:
    string;
  readonly electronExecutableRelativePath:
    string;
  readonly batching:
    ManuscriptBatchingPolicy;
};

function readRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "POC-2 installed-package profile must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function readTargetRelativePath(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = readNonEmptyString(
    input,
    field,
  );
  const normalized = normalize(value);
  if (
    isAbsolute(value) ||
    normalized === ".." ||
    normalized.startsWith(
      `..${sep}`,
    )
  ) {
    throw new Error(
      `${field} must be a target-relative path`,
    );
  }
  return value;
}

export function parsePoc2InstalledPackageProfile(
  value: unknown,
): Poc2InstalledPackageProfile {
  const input = readRecord(value);
  const allowed = new Set([
    "schemaVersion",
    "electronRuntimeDirectoryPath",
    "applicationManifestPath",
    "applicationManifestTargetRelativePath",
    "mainBundleDirectoryPath",
    "mainBundleTargetRelativePath",
    "rendererBundleDirectoryPath",
    "rendererBundleTargetRelativePath",
    "applicationResourcesRelativePath",
    "electronExecutableRelativePath",
    "batching",
  ]);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      throw new Error(
        `Unsupported POC-2 installed-package profile field: ${field}`,
      );
    }
  }
  if (input.schemaVersion !== 1) {
    throw new Error(
      "POC-2 installed-package profile schemaVersion must be 1",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    electronRuntimeDirectoryPath:
      readNonEmptyString(
        input,
        "electronRuntimeDirectoryPath",
      ),
    applicationManifestPath:
      readNonEmptyString(
        input,
        "applicationManifestPath",
      ),
    applicationManifestTargetRelativePath:
      readTargetRelativePath(
        input,
        "applicationManifestTargetRelativePath",
      ),
    mainBundleDirectoryPath:
      readNonEmptyString(
        input,
        "mainBundleDirectoryPath",
      ),
    mainBundleTargetRelativePath:
      readTargetRelativePath(
        input,
        "mainBundleTargetRelativePath",
      ),
    rendererBundleDirectoryPath:
      readNonEmptyString(
        input,
        "rendererBundleDirectoryPath",
      ),
    rendererBundleTargetRelativePath:
      readTargetRelativePath(
        input,
        "rendererBundleTargetRelativePath",
      ),
    applicationResourcesRelativePath:
      readTargetRelativePath(
        input,
        "applicationResourcesRelativePath",
      ),
    electronExecutableRelativePath:
      readTargetRelativePath(
        input,
        "electronExecutableRelativePath",
      ),
    batching:
      parseManuscriptBatchingPolicy(
        input.batching,
      ),
  });
}
