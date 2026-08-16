import {
  ASSISTANT_CAPABILITIES,
  ASSISTANT_CONTEXT_SCOPES,
  assistantContextScopeContains,
  type AssistantCapability,
  type AssistantContextScope,
} from "./assistant-context-permission";

export const ASSISTANT_DESTINATION_KINDS = [
  "local-exact-vocabulary-search",
  "local-selected-notation-review",
  "local-exact-setting-review",
] as const;

export type AssistantDestinationKind =
  (typeof ASSISTANT_DESTINATION_KINDS)[number];

export type AssistantDestinationProfileEntry = {
  readonly destinationId: string;
  readonly label: string;
  readonly kind: AssistantDestinationKind;
  readonly capabilities: readonly AssistantCapability[];
  readonly requiredLocalScope: AssistantContextScope;
  readonly requiredExternalScope: AssistantContextScope;
};

export type AssistantDestinationProfile = {
  readonly schemaVersion: 1;
  readonly destinations: readonly AssistantDestinationProfileEntry[];
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

function nonEmptyString(
  input: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}.${field} must be non-empty`);
  }
  return value.trim();
}

function enumValue<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
  label: string,
): T {
  const value = input[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label}.${field} is unsupported`);
  }
  return value as T;
}

function parseEntry(
  value: unknown,
  index: number,
): AssistantDestinationProfileEntry {
  const label = `AssistantDestinationProfile.destinations[${index}]`;
  const input = record(value, label);
  exact(input, [
    "destinationId",
    "label",
    "kind",
    "capabilities",
    "requiredLocalScope",
    "requiredExternalScope",
  ], label);
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error(`${label}.capabilities must be a non-empty array`);
  }
  const capabilities = Object.freeze(input.capabilities.map((capability) => {
    if (
      typeof capability !== "string" ||
      !ASSISTANT_CAPABILITIES.includes(capability as AssistantCapability)
    ) {
      throw new Error(`${label}.capabilities contains an unsupported value`);
    }
    return capability as AssistantCapability;
  }));
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error(`${label}.capabilities contains duplicates`);
  }
  const kind = enumValue(input, "kind", ASSISTANT_DESTINATION_KINDS, label);
  const requiredLocalScope = enumValue(
    input,
    "requiredLocalScope",
    ASSISTANT_CONTEXT_SCOPES,
    label,
  );
  const requiredExternalScope = enumValue(
    input,
    "requiredExternalScope",
    ASSISTANT_CONTEXT_SCOPES,
    label,
  );
  if (!assistantContextScopeContains(requiredLocalScope, requiredExternalScope)) {
    throw new Error(`${label}.requiredExternalScope exceeds local scope`);
  }
  if (
    kind === "local-exact-vocabulary-search" &&
    (!capabilities.includes("vocabulary-lookup") ||
      requiredLocalScope !== "work" ||
      requiredExternalScope !== "none")
  ) {
    throw new Error(`${label} does not match local exact vocabulary semantics`);
  }
  if (
    kind === "local-selected-notation-review" &&
    (!capabilities.includes("vocabulary-lookup") ||
      requiredLocalScope !== "selection" ||
      requiredExternalScope !== "none")
  ) {
    throw new Error(`${label} does not match local selected notation semantics`);
  }
  if (
    kind === "local-exact-setting-review" &&
    (!capabilities.includes("lore-review") ||
      requiredLocalScope !== "work" ||
      requiredExternalScope !== "none")
  ) {
    throw new Error(`${label} does not match local exact setting review semantics`);
  }
  return Object.freeze({
    destinationId: nonEmptyString(input, "destinationId", label),
    label: nonEmptyString(input, "label", label),
    kind,
    capabilities,
    requiredLocalScope,
    requiredExternalScope,
  });
}

export function parseAssistantDestinationProfile(
  value: unknown,
): AssistantDestinationProfile {
  const label = "AssistantDestinationProfile";
  const input = record(value, label);
  exact(input, ["schemaVersion", "destinations"], label);
  if (input.schemaVersion !== 1) {
    throw new Error("Unsupported AssistantDestinationProfile.schemaVersion");
  }
  if (!Array.isArray(input.destinations)) {
    throw new Error("AssistantDestinationProfile.destinations must be an array");
  }
  const destinations = Object.freeze(
    input.destinations.map((entry, index) => parseEntry(entry, index)),
  );
  if (new Set(destinations.map((entry) => entry.destinationId)).size !== destinations.length) {
    throw new Error("AssistantDestinationProfile.destinationId must be unique");
  }
  return Object.freeze({ schemaVersion: 1, destinations });
}
