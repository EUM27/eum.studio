import { entityId, type EntityId } from "../../domain/writing";

export type AssistantConnectionProjection = {
  readonly schemaVersion: 1;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly revision: number;
  readonly connectorKind: string | null;
  readonly label: string;
  readonly endpoint: string;
  readonly model: string;
  readonly credentialConfigured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AssistantConnectionListProjection = {
  readonly schemaVersion: 1;
  readonly connections: readonly AssistantConnectionProjection[];
};

export type AssistantCredentialChange =
  | Readonly<{ mode: "keep" }>
  | Readonly<{ mode: "replace"; value: string }>
  | Readonly<{ mode: "remove" }>;

export type SaveAssistantConnectionCommand = {
  readonly schemaVersion: 1;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly expectedRevision: number;
  readonly connectorKind: string;
  readonly label: string;
  readonly endpoint: string;
  readonly model: string;
  readonly credential: AssistantCredentialChange;
};

export type DeleteAssistantConnectionCommand = {
  readonly schemaVersion: 1;
  readonly connectionId: EntityId<"AssistantConnection">;
  readonly expectedRevision: number;
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

function schema(value: unknown, label: string): 1 {
  if (value !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  return 1;
}

function nonEmptyString(
  value: unknown,
  label: string,
  preserve = false,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return preserve ? value : value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function absoluteInstant(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be an absolute instant`);
  }
  return new Date(value).toISOString();
}

function parseCredentialChange(value: unknown): AssistantCredentialChange {
  const label = "Assistant credential change";
  const input = record(value, label);
  if (input.mode === "keep" || input.mode === "remove") {
    exact(input, ["mode"], label);
    return Object.freeze({ mode: input.mode });
  }
  if (input.mode === "replace") {
    exact(input, ["mode", "value"], label);
    return Object.freeze({
      mode: "replace",
      value: nonEmptyString(input.value, `${label}.value`, true),
    });
  }
  throw new Error(`${label}.mode is unsupported`);
}

export function parseSaveAssistantConnectionCommand(
  value: unknown,
): SaveAssistantConnectionCommand {
  const label = "Save assistant connection command";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "connectionId",
    "expectedRevision",
    "connectorKind",
    "label",
    "endpoint",
    "model",
    "credential",
  ], label);
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, label),
    connectionId: entityId<"AssistantConnection">(
      nonEmptyString(input.connectionId, `${label}.connectionId`),
    ),
    expectedRevision: nonNegativeInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
    connectorKind: nonEmptyString(
      input.connectorKind,
      `${label}.connectorKind`,
    ),
    label: nonEmptyString(input.label, `${label}.label`),
    endpoint: nonEmptyString(input.endpoint, `${label}.endpoint`),
    model: nonEmptyString(input.model, `${label}.model`),
    credential: parseCredentialChange(input.credential),
  });
}

export function parseDeleteAssistantConnectionCommand(
  value: unknown,
): DeleteAssistantConnectionCommand {
  const label = "Delete assistant connection command";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connectionId", "expectedRevision"], label);
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, label),
    connectionId: entityId<"AssistantConnection">(
      nonEmptyString(input.connectionId, `${label}.connectionId`),
    ),
    expectedRevision: positiveInteger(
      input.expectedRevision,
      `${label}.expectedRevision`,
    ),
  });
}

export function parseAssistantConnectionProjection(
  value: unknown,
): AssistantConnectionProjection {
  const label = "Assistant connection projection";
  const input = record(value, label);
  exact(input, [
    "schemaVersion",
    "connectionId",
    "revision",
    "connectorKind",
    "label",
    "endpoint",
    "model",
    "credentialConfigured",
    "createdAt",
    "updatedAt",
  ], label);
  if (typeof input.credentialConfigured !== "boolean") {
    throw new Error(`${label}.credentialConfigured must be boolean`);
  }
  if (
    input.connectorKind !== null &&
    (typeof input.connectorKind !== "string" ||
      input.connectorKind.trim().length === 0)
  ) {
    throw new Error(`${label}.connectorKind must be null or non-empty`);
  }
  const createdAt = absoluteInstant(input.createdAt, `${label}.createdAt`);
  const updatedAt = absoluteInstant(input.updatedAt, `${label}.updatedAt`);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error(`${label}.updatedAt precedes createdAt`);
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, label),
    connectionId: entityId<"AssistantConnection">(
      nonEmptyString(input.connectionId, `${label}.connectionId`),
    ),
    revision: positiveInteger(input.revision, `${label}.revision`),
    connectorKind: input.connectorKind === null
      ? null
      : input.connectorKind.trim(),
    label: nonEmptyString(input.label, `${label}.label`),
    endpoint: nonEmptyString(input.endpoint, `${label}.endpoint`),
    model: nonEmptyString(input.model, `${label}.model`),
    credentialConfigured: input.credentialConfigured,
    createdAt,
    updatedAt,
  });
}

export function parseAssistantConnectionListProjection(
  value: unknown,
): AssistantConnectionListProjection {
  const label = "Assistant connection list projection";
  const input = record(value, label);
  exact(input, ["schemaVersion", "connections"], label);
  if (!Array.isArray(input.connections)) {
    throw new Error(`${label}.connections must be an array`);
  }
  const connections = Object.freeze(
    input.connections.map((connection) =>
      parseAssistantConnectionProjection(connection)
    ),
  );
  if (
    new Set(connections.map((connection) => connection.connectionId)).size !==
    connections.length
  ) {
    throw new Error(`${label}.connections contains duplicate identities`);
  }
  return Object.freeze({
    schemaVersion: schema(input.schemaVersion, label),
    connections,
  });
}
