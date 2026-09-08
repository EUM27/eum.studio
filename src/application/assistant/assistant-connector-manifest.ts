import type { EntityId } from "../../domain/writing";
import { parseAssistantRequestPolicy, withAssistantRequestLifetime, type AssistantRequestPolicy } from "./assistant-request-lifecycle";
import {
  ASSISTANT_CAPABILITIES,
  type AssistantCapability,
} from "./assistant-context-permission";

export const ASSISTANT_CONNECTOR_CREDENTIAL_POLICIES = [
  "none",
  "optional",
  "required",
] as const;
export type AssistantConnectorCredentialPolicy =
  (typeof ASSISTANT_CONNECTOR_CREDENTIAL_POLICIES)[number];

export const ASSISTANT_CONNECTOR_RUNTIME_FIELD_POLICIES = [
  "forbidden",
  "optional",
  "required",
] as const;
export type AssistantConnectorRuntimeFieldPolicy =
  (typeof ASSISTANT_CONNECTOR_RUNTIME_FIELD_POLICIES)[number];

export const ASSISTANT_CONNECTOR_OPERATIONS = [
  "vocabulary-suggestions",
  "setting-review",
  "publishing-intent",
] as const;
export type AssistantConnectorOperation =
  (typeof ASSISTANT_CONNECTOR_OPERATIONS)[number];

export type AssistantConnectorManifestEntry = {
  readonly requestPolicy?: AssistantRequestPolicy;
  readonly connectorKind: string;
  readonly displayName: string;
  readonly capabilities: readonly AssistantCapability[];
  readonly contextTokenBudget: number;
  readonly credentialPolicy: AssistantConnectorCredentialPolicy;
  readonly runtimeConfig: {
    readonly endpoint: AssistantConnectorRuntimeFieldPolicy;
    readonly model: AssistantConnectorRuntimeFieldPolicy;
  };
};

export type AssistantConnectorManifestProfile = {
  readonly schemaVersion: 1;
  readonly connectors: readonly AssistantConnectorManifestEntry[];
};

export type AssistantConnectorInternalConnection = {
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly connectorKind: string;
  readonly endpoint: string;
  readonly model: string;
  readonly credential: string | null;
};

export type AssistantConnectorExecutionCommand = {
  readonly signal?: AbortSignal;
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantConnectorRequest">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly capability: AssistantCapability;
  readonly operation: AssistantConnectorOperation;
  readonly requestFingerprint: string;
  readonly input: Readonly<Record<string, unknown>>;
};

export type AssistantConnectorAdapterInput = {
  readonly signal?: AbortSignal;
  readonly requestPolicy?: AssistantRequestPolicy;
  readonly schemaVersion: 1;
  readonly requestId: EntityId<"AssistantConnectorRequest">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly operation: AssistantConnectorOperation;
  readonly endpoint: string;
  readonly model: string;
  readonly credential: string | null;
  readonly input: Readonly<Record<string, unknown>>;
};

export type AssistantConnectorAdapter = {
  readonly connectorKind: string;
  readonly execute: (
    input: AssistantConnectorAdapterInput,
  ) => Promise<Readonly<{ schemaVersion: 1; payload: unknown }>>;
};

export type AssistantConnectorExecutionReceipt = {
  readonly schemaVersion: 1;
  readonly receiptId: EntityId<"ConnectorReceipt">;
  readonly requestId: EntityId<"AssistantConnectorRequest">;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly connectorKind: string;
  readonly operation: AssistantConnectorOperation;
  readonly requestFingerprint: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly resultState: "succeeded";
};

export type AssistantConnectorExecutionResult = {
  readonly schemaVersion: 1;
  readonly receipt: AssistantConnectorExecutionReceipt;
  readonly payload: unknown;
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

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as T;
}

function parseEntry(
  value: unknown,
  index: number,
): AssistantConnectorManifestEntry {
  const label = `AssistantConnectorManifestProfile.connectors[${index}]`;
  const input = record(value, label);
  exact(input, [
    "connectorKind",
    "displayName",
    "capabilities",
    "contextTokenBudget",
    "credentialPolicy",
    "runtimeConfig",
    ...(input.requestPolicy === undefined ? [] : ["requestPolicy"]),
  ], label);
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error(`${label}.capabilities must be a non-empty array`);
  }
  const capabilities = Object.freeze(input.capabilities.map((capability) =>
    enumValue(capability, ASSISTANT_CAPABILITIES, `${label}.capabilities`)
  ));
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error(`${label}.capabilities contains duplicates`);
  }
  const runtimeConfig = record(input.runtimeConfig, `${label}.runtimeConfig`);
  exact(runtimeConfig, ["endpoint", "model"], `${label}.runtimeConfig`);
  return Object.freeze({
    ...(input.requestPolicy === undefined ? {} : { requestPolicy: parseAssistantRequestPolicy(input.requestPolicy) }),
    connectorKind: nonEmptyString(input.connectorKind, `${label}.connectorKind`),
    displayName: nonEmptyString(input.displayName, `${label}.displayName`),
    capabilities,
    contextTokenBudget: (() => {
      if (
        typeof input.contextTokenBudget !== "number" ||
        !Number.isSafeInteger(input.contextTokenBudget) ||
        input.contextTokenBudget < 1
      ) {
        throw new Error(`${label}.contextTokenBudget must be a positive safe integer`);
      }
      return input.contextTokenBudget;
    })(),
    credentialPolicy: enumValue(
      input.credentialPolicy,
      ASSISTANT_CONNECTOR_CREDENTIAL_POLICIES,
      `${label}.credentialPolicy`,
    ),
    runtimeConfig: Object.freeze({
      endpoint: enumValue(
        runtimeConfig.endpoint,
        ASSISTANT_CONNECTOR_RUNTIME_FIELD_POLICIES,
        `${label}.runtimeConfig.endpoint`,
      ),
      model: enumValue(
        runtimeConfig.model,
        ASSISTANT_CONNECTOR_RUNTIME_FIELD_POLICIES,
        `${label}.runtimeConfig.model`,
      ),
    }),
  });
}

export function parseAssistantConnectorManifestProfile(
  value: unknown,
): AssistantConnectorManifestProfile {
  const label = "AssistantConnectorManifestProfile";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connectors"], label);
  if (input.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`);
  }
  if (!Array.isArray(input.connectors)) {
    throw new Error(`${label}.connectors must be an array`);
  }
  const connectors = Object.freeze(
    input.connectors.map((entry, index) => parseEntry(entry, index)),
  );
  if (
    new Set(connectors.map((entry) => entry.connectorKind)).size !==
    connectors.length
  ) {
    throw new Error(`${label}.connectorKind must be unique`);
  }
  return Object.freeze({ schemaVersion: 1, connectors });
}

function fieldMatches(
  value: string,
  policy: AssistantConnectorRuntimeFieldPolicy,
): boolean {
  if (policy === "required") return value.trim().length > 0;
  if (policy === "forbidden") return value.length === 0;
  return true;
}

export function createAssistantConnectorExecutor(input: {
  readonly manifestProfile: AssistantConnectorManifestProfile;
  readonly adapters: readonly AssistantConnectorAdapter[];
  readonly readConnection: (
    connectionId: EntityId<"AssistantConnection">,
  ) => AssistantConnectorInternalConnection;
  readonly createReceiptId: () => EntityId<"ConnectorReceipt">;
  readonly now: () => string;
}): {
  execute(
    command: AssistantConnectorExecutionCommand,
  ): Promise<AssistantConnectorExecutionResult>;
} {
  const adapterByKind = new Map(
    input.adapters.map((adapter) => [adapter.connectorKind, adapter]),
  );
  return Object.freeze({
    async execute(
      command: AssistantConnectorExecutionCommand,
    ): Promise<AssistantConnectorExecutionResult> {
      const connection = input.readConnection(command.connectionId);
      const manifest = input.manifestProfile.connectors.find(
        (entry) => entry.connectorKind === connection.connectorKind,
      );
      if (manifest === undefined) {
        throw new Error(`Unknown assistant connector kind: ${connection.connectorKind}`);
      }
      if (!manifest.capabilities.includes(command.capability)) {
        throw new Error(`Assistant connector capability is unavailable: ${command.capability}`);
      }
      if (
        !fieldMatches(connection.endpoint, manifest.runtimeConfig.endpoint) ||
        !fieldMatches(connection.model, manifest.runtimeConfig.model)
      ) {
        throw new Error("Assistant connector runtime config does not match its manifest");
      }
      if (
        (manifest.credentialPolicy === "required" && connection.credential === null) ||
        (manifest.credentialPolicy === "none" && connection.credential !== null)
      ) {
        throw new Error("Assistant connector credential does not match its manifest");
      }
      const adapter = adapterByKind.get(connection.connectorKind);
      if (adapter === undefined) {
        throw new Error(`Assistant connector adapter is unavailable: ${connection.connectorKind}`);
      }
      const startedAt = input.now();
      const adapterResult = await withAssistantRequestLifetime({
        ...(command.signal === undefined ? {} : { signal: command.signal }),
        ...(manifest.requestPolicy === undefined ? {} : { timeoutMs: manifest.requestPolicy.timeoutMs }),
        execute: (signal) => adapter.execute(Object.freeze({
          signal,
          ...(manifest.requestPolicy === undefined ? {} : { requestPolicy: manifest.requestPolicy }),
          schemaVersion: 1,
          requestId: command.requestId,
          connectionId: command.connectionId,
          operation: command.operation,
          endpoint: connection.endpoint,
          model: connection.model,
          credential: connection.credential,
          input: command.input,
        })),
      });
      const completedAt = input.now();
      return Object.freeze({
        schemaVersion: 1,
        receipt: Object.freeze({
          schemaVersion: 1,
          receiptId: input.createReceiptId(),
          requestId: command.requestId,
          connectionId: command.connectionId,
          connectorKind: connection.connectorKind,
          operation: command.operation,
          requestFingerprint: nonEmptyString(
            command.requestFingerprint,
            "Assistant connector requestFingerprint",
          ),
          startedAt,
          completedAt,
          resultState: "succeeded" as const,
        }),
        payload: adapterResult.payload,
      });
    },
  });
}
