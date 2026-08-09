import type { AnchorPolicy } from "../anchors/create-anchor";

export type LocalWorkspaceDefaults = {
  readonly schemaVersion: 1;
  readonly anchorPolicy: AnchorPolicy;
  readonly anchorEvidenceChecksumAlgorithm: string;
  readonly activityPolicy: {
    readonly idleTimeout: number;
    readonly navigationGrace: number;
    readonly hiddenWindowPolicy: string;
    readonly activityClassRulesJson: string;
    readonly autoStartEnabled: boolean;
    readonly autoResumeFromIdle: boolean;
    readonly recoveryPolicy: string;
  };
  readonly focusPolicy: {
    readonly phaseDefinitionsJson: string;
    readonly backgroundPolicy: string;
    readonly musicStartPolicy: string;
    readonly completionPolicy: string;
    readonly visibility: string;
  };
  readonly railPreferencesJson: string;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  const expected = new Set(fields);
  if (
    Object.keys(value).length !== expected.size ||
    Object.keys(value).some((field) => !expected.has(field))
  ) {
    throw new Error(`${label} fields do not match the configured schema`);
  }
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readDuration(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

export function parseLocalWorkspaceDefaults(
  value: unknown,
): LocalWorkspaceDefaults {
  const input = readRecord(value, "LocalWorkspaceDefaults");
  assertFields(
    input,
    [
      "schemaVersion",
      "anchorPolicy",
      "anchorEvidenceChecksumAlgorithm",
      "activityPolicy",
      "focusPolicy",
      "railPreferences",
    ],
    "LocalWorkspaceDefaults",
  );
  if (input.schemaVersion !== 1) {
    throw new Error("LocalWorkspaceDefaults.schemaVersion must be 1");
  }
  const anchorPolicy = readRecord(
    input.anchorPolicy,
    "LocalWorkspaceDefaults.anchorPolicy",
  );
  assertFields(
    anchorPolicy,
    ["schemaVersion", "version", "contextOffsetLength"],
    "LocalWorkspaceDefaults.anchorPolicy",
  );
  if (anchorPolicy.schemaVersion !== 1) {
    throw new Error("LocalWorkspaceDefaults.anchorPolicy.schemaVersion must be 1");
  }
  const activityPolicy = readRecord(
    input.activityPolicy,
    "LocalWorkspaceDefaults.activityPolicy",
  );
  assertFields(
    activityPolicy,
    [
      "idleTimeout",
      "navigationGrace",
      "hiddenWindowPolicy",
      "activityClassRules",
      "autoStartEnabled",
      "autoResumeFromIdle",
      "recoveryPolicy",
    ],
    "LocalWorkspaceDefaults.activityPolicy",
  );
  const focusPolicy = readRecord(
    input.focusPolicy,
    "LocalWorkspaceDefaults.focusPolicy",
  );
  assertFields(
    focusPolicy,
    [
      "phaseDefinitions",
      "backgroundPolicy",
      "musicStartPolicy",
      "completionPolicy",
      "visibility",
    ],
    "LocalWorkspaceDefaults.focusPolicy",
  );
  if (!Array.isArray(activityPolicy.activityClassRules)) {
    throw new Error(
      "LocalWorkspaceDefaults.activityPolicy.activityClassRules must be an array",
    );
  }
  if (!Array.isArray(focusPolicy.phaseDefinitions)) {
    throw new Error(
      "LocalWorkspaceDefaults.focusPolicy.phaseDefinitions must be an array",
    );
  }
  const railPreferences = readRecord(
    input.railPreferences,
    "LocalWorkspaceDefaults.railPreferences",
  );
  return Object.freeze({
    schemaVersion: 1,
    anchorPolicy: Object.freeze({
      schemaVersion: 1,
      version: readString(
        anchorPolicy.version,
        "LocalWorkspaceDefaults.anchorPolicy.version",
      ),
      contextOffsetLength: readDuration(
        anchorPolicy.contextOffsetLength,
        "LocalWorkspaceDefaults.anchorPolicy.contextOffsetLength",
      ),
    }),
    anchorEvidenceChecksumAlgorithm: readString(
      input.anchorEvidenceChecksumAlgorithm,
      "LocalWorkspaceDefaults.anchorEvidenceChecksumAlgorithm",
    ),
    activityPolicy: Object.freeze({
      idleTimeout: readDuration(
        activityPolicy.idleTimeout,
        "LocalWorkspaceDefaults.activityPolicy.idleTimeout",
      ),
      navigationGrace: readDuration(
        activityPolicy.navigationGrace,
        "LocalWorkspaceDefaults.activityPolicy.navigationGrace",
      ),
      hiddenWindowPolicy: readString(
        activityPolicy.hiddenWindowPolicy,
        "LocalWorkspaceDefaults.activityPolicy.hiddenWindowPolicy",
      ),
      activityClassRulesJson: JSON.stringify(
        activityPolicy.activityClassRules,
      ),
      autoStartEnabled: readBoolean(
        activityPolicy.autoStartEnabled,
        "LocalWorkspaceDefaults.activityPolicy.autoStartEnabled",
      ),
      autoResumeFromIdle: readBoolean(
        activityPolicy.autoResumeFromIdle,
        "LocalWorkspaceDefaults.activityPolicy.autoResumeFromIdle",
      ),
      recoveryPolicy: readString(
        activityPolicy.recoveryPolicy,
        "LocalWorkspaceDefaults.activityPolicy.recoveryPolicy",
      ),
    }),
    focusPolicy: Object.freeze({
      phaseDefinitionsJson: JSON.stringify(focusPolicy.phaseDefinitions),
      backgroundPolicy: readString(
        focusPolicy.backgroundPolicy,
        "LocalWorkspaceDefaults.focusPolicy.backgroundPolicy",
      ),
      musicStartPolicy: readString(
        focusPolicy.musicStartPolicy,
        "LocalWorkspaceDefaults.focusPolicy.musicStartPolicy",
      ),
      completionPolicy: readString(
        focusPolicy.completionPolicy,
        "LocalWorkspaceDefaults.focusPolicy.completionPolicy",
      ),
      visibility: readString(
        focusPolicy.visibility,
        "LocalWorkspaceDefaults.focusPolicy.visibility",
      ),
    }),
    railPreferencesJson: JSON.stringify(railPreferences),
  });
}
