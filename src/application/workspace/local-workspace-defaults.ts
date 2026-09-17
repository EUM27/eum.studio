import type { AnchorPolicy } from "../anchors/create-anchor";
import {
  parseSceneBoundaryRule,
  type SceneBoundaryRule,
  type SceneRuleSetProjection,
} from "../structure/scene-projection";
import {
  parseManuscriptBatchingPolicy,
  type ManuscriptBatchingPolicy,
} from "../persistence/manuscript-persistence-profile";

export type LocalWorkspaceDefaults = {
  readonly schemaVersion: 1;
  readonly anchorPolicy: AnchorPolicy;
  readonly anchorEvidenceChecksumAlgorithm: string;
  readonly manuscriptBatchingPolicy: ManuscriptBatchingPolicy;
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
  readonly sceneRuleSet: {
    readonly displayName: string;
    readonly boundaryRules: readonly SceneBoundaryRule[];
    readonly normalizationPolicy: SceneRuleSetProjection["normalizationPolicy"];
    readonly enabled: boolean;
  };
  readonly plotBoard: {
    readonly defaultBoardTitle: string;
    readonly defaultLaneTitle: string;
    readonly orderKeyLengthLimit: number;
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

function readPositiveInteger(value: unknown, label: string): number {
  const parsed = readDuration(value, label);
  if (parsed < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return parsed;
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
      "manuscriptBatchingPolicy",
      "activityPolicy",
      "focusPolicy",
      "sceneRuleSet",
      "plotBoard",
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
  const plotBoard = readRecord(
    input.plotBoard,
    "LocalWorkspaceDefaults.plotBoard",
  );
  const sceneRuleSet = readRecord(
    input.sceneRuleSet,
    "LocalWorkspaceDefaults.sceneRuleSet",
  );
  assertFields(
    sceneRuleSet,
    ["displayName", "boundaryRules", "normalizationPolicy", "enabled"],
    "LocalWorkspaceDefaults.sceneRuleSet",
  );
  if (!Array.isArray(sceneRuleSet.boundaryRules)) {
    throw new Error(
      "LocalWorkspaceDefaults.sceneRuleSet.boundaryRules must be an array",
    );
  }
  if (
    sceneRuleSet.normalizationPolicy !== "preserve" &&
    sceneRuleSet.normalizationPolicy !== "trim-line-whitespace"
  ) {
    throw new Error(
      "LocalWorkspaceDefaults.sceneRuleSet.normalizationPolicy is invalid",
    );
  }
  assertFields(
    plotBoard,
    ["defaultBoardTitle", "defaultLaneTitle", "orderKeyLengthLimit"],
    "LocalWorkspaceDefaults.plotBoard",
  );
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
    manuscriptBatchingPolicy: parseManuscriptBatchingPolicy(
      input.manuscriptBatchingPolicy,
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
    sceneRuleSet: Object.freeze({
      displayName: readString(
        sceneRuleSet.displayName,
        "LocalWorkspaceDefaults.sceneRuleSet.displayName",
      ),
      boundaryRules: Object.freeze(
        sceneRuleSet.boundaryRules.map((rule, index) =>
          parseSceneBoundaryRule(
            rule,
            `LocalWorkspaceDefaults.sceneRuleSet.boundaryRules[${index}]`,
          ),
        ),
      ),
      normalizationPolicy: sceneRuleSet.normalizationPolicy,
      enabled: readBoolean(
        sceneRuleSet.enabled,
        "LocalWorkspaceDefaults.sceneRuleSet.enabled",
      ),
    }),
    plotBoard: Object.freeze({
      defaultBoardTitle: readString(
        plotBoard.defaultBoardTitle,
        "LocalWorkspaceDefaults.plotBoard.defaultBoardTitle",
      ),
      defaultLaneTitle: readString(
        plotBoard.defaultLaneTitle,
        "LocalWorkspaceDefaults.plotBoard.defaultLaneTitle",
      ),
      orderKeyLengthLimit: readPositiveInteger(
        plotBoard.orderKeyLengthLimit,
        "LocalWorkspaceDefaults.plotBoard.orderKeyLengthLimit",
      ),
    }),
    railPreferencesJson: JSON.stringify(railPreferences),
  });
}
